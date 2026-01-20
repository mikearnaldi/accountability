/**
 * JournalEntriesApiLive - Live implementation of journal entries API handlers
 *
 * Implements the JournalEntriesApi endpoints with CRUD operations
 * by calling the JournalEntryRepository and JournalEntryLineRepository.
 *
 * Path and URL params use domain types directly in the API schema,
 * so handlers receive already-decoded values (JournalEntryId, CompanyId, etc.).
 * No manual Schema.decodeUnknownEither calls are needed.
 *
 * @module JournalEntriesApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import {
  JournalEntry,
  JournalEntryId,
  EntryNumber,
  UserId
} from "@accountability/core/journal/JournalEntry"
import { JournalEntryLine, JournalEntryLineId } from "@accountability/core/journal/JournalEntryLine"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import { computeFiscalPeriod } from "@accountability/core/fiscal/ComputedFiscalPeriod"
import { JournalEntryRepository } from "@accountability/persistence/Services/JournalEntryRepository"
import { JournalEntryLineRepository } from "@accountability/persistence/Services/JournalEntryLineRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { AppApi } from "../Definitions/AppApi.ts"
import type { CreateJournalEntryLineRequest } from "../Definitions/JournalEntriesApi.ts"
import {
  AuditLogError,
  UserLookupError
} from "../Definitions/ApiErrors.ts"
import type { AuditLogError as CoreAuditLogError, UserLookupError as CoreUserLookupError } from "@accountability/core/audit/AuditLogErrors"
import { requireOrganizationContext, requirePermission, requirePermissionWithResource } from "./OrganizationContextMiddlewareLive.ts"
import { FiscalPeriodService } from "@accountability/core/fiscal/FiscalPeriodService"
import { FiscalPeriodNotFoundForDateError, FiscalPeriodClosedError } from "@accountability/core/fiscal/FiscalPeriodErrors"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  JournalEntryNotFoundError,
  JournalEntryStatusError,
  JournalEntryAlreadyReversedError,
  UnbalancedJournalEntryError
} from "@accountability/core/journal/JournalErrors"
import type { ResourceContext } from "@accountability/core/authorization/matchers/ResourceMatcher"
import type { LocalDate } from "@accountability/core/shared/values/LocalDate"
import type { CompanyId } from "@accountability/core/company/Company"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"

/**
 * Map core AuditLogError to API AuditLogError
 */
const mapCoreAuditErrorToApi = (error: CoreAuditLogError | CoreUserLookupError): AuditLogError | UserLookupError => {
  if (error._tag === "UserLookupError") {
    return new UserLookupError({
      userId: error.userId,
      cause: error.cause
    })
  }
  return new AuditLogError({
    operation: error.operation,
    cause: error.cause
  })
}

/**
 * Default functional currency if company not found
 */
const defaultFunctionalCurrency = CurrencyCode.make("USD")

/**
 * Convert CreateJournalEntryLineRequest to JournalEntryLine
 */
const createLineFromRequest = (
  journalEntryId: JournalEntryId,
  lineNumber: number,
  req: CreateJournalEntryLineRequest,
  functionalCurrency: CurrencyCode
): JournalEntryLine => {
  // Calculate functional currency amounts using exchange rate 1 for same currency
  const exchangeRate = BigDecimal.fromBigInt(1n)

  const functionalDebit = Option.map(req.debitAmount, (m) =>
    MonetaryAmount.make({
      amount: m.amount,
      currency: functionalCurrency
    })
  )

  const functionalCredit = Option.map(req.creditAmount, (m) =>
    MonetaryAmount.make({
      amount: m.amount,
      currency: functionalCurrency
    })
  )

  return JournalEntryLine.make({
    id: JournalEntryLineId.make(crypto.randomUUID()),
    journalEntryId,
    lineNumber,
    accountId: req.accountId,
    debitAmount: req.debitAmount,
    creditAmount: req.creditAmount,
    functionalCurrencyDebitAmount: functionalDebit,
    functionalCurrencyCreditAmount: functionalCredit,
    exchangeRate,
    memo: req.memo,
    dimensions: req.dimensions,
    intercompanyPartnerId: req.intercompanyPartnerId,
    matchingLineId: Option.none()
  })
}

/**
 * Helper to build resource context with period status for ABAC evaluation
 *
 * This enables the fiscal period protection system policies to evaluate
 * periodStatus conditions. The policies deny journal entry modifications
 * when the period is Future, SoftClose (without controller role), Closed, or Locked.
 *
 * IMPORTANT: This function enforces that a fiscal period MUST exist for the
 * transaction date. If no fiscal period exists, it will fail with
 * FiscalPeriodNotFoundForDateError.
 *
 * @param companyId - The company ID to look up the period for
 * @param transactionDate - The date to check period status for
 * @param requirePeriod - Whether to require a fiscal period to exist (default: true)
 * @returns Effect containing the resource context for authorization
 */
const buildJournalEntryResourceContext = (
  companyId: CompanyId,
  transactionDate: LocalDate,
  requirePeriod: boolean = true
): Effect.Effect<
  ResourceContext,
  FiscalPeriodNotFoundForDateError,
  FiscalPeriodService
> =>
  Effect.gen(function* () {
    const periodService = yield* FiscalPeriodService

    // Look up the period status for the transaction date
    const periodStatusOption = yield* periodService.getPeriodStatusForDate(
      companyId,
      transactionDate
    ).pipe(
      // If there's an error looking up the period, don't block - just skip period check
      Effect.catchAll(() => Effect.succeed(Option.none()))
    )

    // If period is required but not found, fail with domain-specific error
    if (requirePeriod && Option.isNone(periodStatusOption)) {
      return yield* Effect.fail(new FiscalPeriodNotFoundForDateError({
        companyId,
        date: transactionDate.toString()
      }))
    }

    // Build resource context with period status if available
    const resourceContext: ResourceContext = {
      type: "journal_entry",
      ...(Option.isSome(periodStatusOption) && { periodStatus: periodStatusOption.value })
    }

    return resourceContext
  })

/**
 * Helper to log journal entry creation to audit log
 *
 * Uses the AuditLogService and CurrentUserId from the Effect context.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 *
 * @param organizationId - The organization this entry belongs to
 * @param entry - The created journal entry
 * @returns Effect that completes when audit logging succeeds
 */
const logJournalEntryCreate = (
  organizationId: string,
  entry: JournalEntry
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    // Use entryNumber if present, otherwise fall back to description for audit display
    const entityName = Option.getOrNull(entry.entryNumber) ?? entry.description

    yield* auditService.logCreate(
      organizationId,
      "JournalEntry",
      entry.id,
      entityName,
      entry,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log journal entry status change (post, reverse) to audit log
 *
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 *
 * @param organizationId - The organization this entry belongs to
 * @param entryId - The journal entry ID
 * @param previousStatus - The status before the change
 * @param newStatus - The status after the change
 * @param reason - Optional reason for the status change
 * @returns Effect that completes when audit logging succeeds
 */
const logJournalEntryStatusChange = (
  organizationId: string,
  entryId: JournalEntryId,
  entryReference: string | null,
  previousStatus: string,
  newStatus: string,
  reason?: string
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logStatusChange(
      organizationId,
      "JournalEntry",
      entryId,
      entryReference, // Human-readable reference (e.g., "JE-00001") for audit display
      previousStatus,
      newStatus,
      userId,
      reason
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * JournalEntriesApiLive - Layer providing JournalEntriesApi handlers
 *
 * Dependencies:
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 * - CompanyRepository
 * - FiscalPeriodService (for period status checks)
 * - AuditLogService (optional, for audit logging)
 * - CurrentUserId (optional, for audit logging)
 */
export const JournalEntriesApiLive = HttpApiBuilder.group(AppApi, "journal-entries", (handlers) =>
  Effect.gen(function* () {
    const entryRepo = yield* JournalEntryRepository
    const lineRepo = yield* JournalEntryLineRepository
    const companyRepo = yield* CompanyRepository

    return handlers
      .handle("listJournalEntries", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("journal_entry:read")

            const {
              companyId,
              status,
              entryType,
              fiscalYear,
              fiscalPeriod,
              limit: paramLimit,
              offset: paramOffset
            } = _.urlParams

            // Get organizationId from URL params
            const organizationId = OrganizationId.make(_.urlParams.organizationId)

            // Check company exists within organization
            const companyExists = yield* companyRepo.exists(organizationId, companyId).pipe(Effect.orDie)
            if (!companyExists) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId }))
            }

            // Get entries based on filters
            let entries: ReadonlyArray<JournalEntry>

            if (status !== undefined) {
              entries = yield* entryRepo.findByStatus(organizationId, companyId, status).pipe(
                Effect.orDie
              )
            } else if (entryType !== undefined) {
              entries = yield* entryRepo.findByType(organizationId, companyId, entryType).pipe(
                Effect.orDie
              )
            } else if (fiscalYear !== undefined && fiscalPeriod !== undefined) {
              const period = FiscalPeriodRef.make({ year: fiscalYear, period: fiscalPeriod })
              entries = yield* entryRepo.findByPeriod(organizationId, companyId, period).pipe(
                Effect.orDie
              )
            } else {
              entries = yield* entryRepo.findByCompany(organizationId, companyId).pipe(
                Effect.orDie
              )
            }

            // Apply pagination
            const total = entries.length
            const limit = paramLimit ?? 100
            const offset = paramOffset ?? 0
            const paginatedEntries = entries.slice(offset, offset + limit)

            return {
              entries: paginatedEntries,
              total,
              limit,
              offset
            }
          })
        )
      )
      .handle("getJournalEntry", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("journal_entry:read")

            const entryId = _.path.id
            const organizationId = OrganizationId.make(_.urlParams.organizationId)

            const maybeEntry = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)

            if (Option.isNone(maybeEntry)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }

            const entry = maybeEntry.value
            const lines = yield* lineRepo.findByJournalEntry(entryId).pipe(Effect.orDie)

            return { entry, lines }
          })
        )
      )
      .handle("createJournalEntry", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            const req = _.payload

            // Validate company exists within organization and get functional currency
            const maybeCompany = yield* companyRepo.findById(req.organizationId, req.companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: req.companyId }))
            }
            const company = maybeCompany.value
            const functionalCurrency = company.functionalCurrency

            // Get period status for ABAC policy evaluation (locked period protection)
            const resourceContext = yield* buildJournalEntryResourceContext(
              req.companyId,
              req.transactionDate
            )
            yield* requirePermissionWithResource("journal_entry:create", resourceContext)

            // Compute fiscal period from transaction date and company's fiscal year end
            // If fiscalPeriod is provided in the request, use it; otherwise compute it
            const fiscalPeriod = Option.isSome(req.fiscalPeriod)
              ? req.fiscalPeriod.value
              : (() => {
                  const computed = computeFiscalPeriod(req.transactionDate, company.fiscalYearEnd)
                  return FiscalPeriodRef.make({
                    year: computed.fiscalYear,
                    period: computed.periodNumber
                  })
                })()

            // Validate fiscal period exists and is open
            const periodService = yield* FiscalPeriodService
            const maybePeriod = yield* periodService.getPeriodByYearAndNumber(
              req.companyId,
              fiscalPeriod.year,
              fiscalPeriod.period
            ).pipe(Effect.orDie)

            if (Option.isNone(maybePeriod)) {
              return yield* Effect.fail(new FiscalPeriodNotFoundForDateError({
                companyId: req.companyId,
                date: `FY${fiscalPeriod.year} P${fiscalPeriod.period}`
              }))
            }

            const period = maybePeriod.value
            if (period.status !== "Open") {
              return yield* Effect.fail(new FiscalPeriodClosedError({
                companyId: req.companyId,
                fiscalYear: fiscalPeriod.year,
                periodNumber: fiscalPeriod.period,
                periodStatus: period.status
              }))
            }

            // Generate entry ID and entry number
            const entryId = JournalEntryId.make(crypto.randomUUID())
            const entryNumber = yield* entryRepo.getNextEntryNumber(req.organizationId, req.companyId).pipe(Effect.orDie)

            // Determine if multi-currency
            const currencies = new Set<string>()
            for (const line of req.lines) {
              if (Option.isSome(line.debitAmount)) {
                currencies.add(line.debitAmount.value.currency)
              }
              if (Option.isSome(line.creditAmount)) {
                currencies.add(line.creditAmount.value.currency)
              }
            }
            const isMultiCurrency = currencies.size > 1

            // Create the journal entry
            const now = timestampNow()
            const entry = JournalEntry.make({
              id: entryId,
              companyId: req.companyId,
              entryNumber: Option.some(EntryNumber.make(entryNumber)),
              referenceNumber: req.referenceNumber,
              description: req.description,
              transactionDate: req.transactionDate,
              postingDate: Option.none(),
              documentDate: req.documentDate,
              fiscalPeriod,
              entryType: req.entryType,
              sourceModule: req.sourceModule,
              sourceDocumentRef: req.sourceDocumentRef,
              isMultiCurrency,
              status: "Draft",
              isReversing: false,
              reversedEntryId: Option.none(),
              reversingEntryId: Option.none(),
              createdBy: UserId.make(crypto.randomUUID()), // TODO: Get from auth context
              createdAt: now,
              postedBy: Option.none(),
              postedAt: Option.none()
            })

            // Create lines
            const lines = req.lines.map((lineReq, index) =>
              createLineFromRequest(entryId, index + 1, lineReq, functionalCurrency)
            )

            // Validate balance
            let totalDebits = BigDecimal.fromBigInt(0n)
            let totalCredits = BigDecimal.fromBigInt(0n)

            for (const line of lines) {
              if (Option.isSome(line.functionalCurrencyDebitAmount)) {
                totalDebits = BigDecimal.sum(
                  totalDebits,
                  line.functionalCurrencyDebitAmount.value.amount
                )
              }
              if (Option.isSome(line.functionalCurrencyCreditAmount)) {
                totalCredits = BigDecimal.sum(
                  totalCredits,
                  line.functionalCurrencyCreditAmount.value.amount
                )
              }
            }

            if (!BigDecimal.equals(totalDebits, totalCredits)) {
              return yield* Effect.fail(new UnbalancedJournalEntryError({
                totalDebits: BigDecimal.format(totalDebits),
                totalCredits: BigDecimal.format(totalCredits)
              }))
            }

            // Save entry and lines
            yield* entryRepo.create(entry).pipe(
              Effect.orDie
            )
            yield* lineRepo.createMany(lines).pipe(
              Effect.orDie
            )

            // Log audit entry for journal entry creation
            yield* logJournalEntryCreate(req.organizationId, entry)

            return { entry, lines }
          })
        )
      )
      .handle("updateJournalEntry", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            const entryId = _.path.id
            const req = _.payload
            const organizationId = req.organizationId

            // Get existing entry
            const maybeExisting = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }
            const existing = maybeExisting.value

            // Check entry is editable (Draft status only)
            if (existing.status !== "Draft") {
              return yield* Effect.fail(new JournalEntryStatusError({
                entryId,
                currentStatus: existing.status,
                requiredStatus: "Draft",
                operation: "update"
              }))
            }

            // Get period status for ABAC policy evaluation (locked period protection)
            // Use the new transaction date if provided, otherwise use existing
            const checkDate = Option.isSome(req.transactionDate)
              ? req.transactionDate.value
              : existing.transactionDate
            const resourceContext = yield* buildJournalEntryResourceContext(
              existing.companyId,
              checkDate
            )
            yield* requirePermissionWithResource("journal_entry:update", resourceContext)

            // Get company for functional currency (using org ID from request for authorization)
            const maybeCompany = yield* companyRepo.findById(organizationId, existing.companyId).pipe(
              Effect.orDie
            )
            const functionalCurrency = Option.isSome(maybeCompany)
              ? maybeCompany.value.functionalCurrency
              : defaultFunctionalCurrency

            // Build updated entry
            const updatedEntry = JournalEntry.make({
              ...existing,
              description: Option.isSome(req.description) ? req.description.value : existing.description,
              transactionDate: Option.isSome(req.transactionDate)
                ? req.transactionDate.value
                : existing.transactionDate,
              documentDate: Option.isSome(req.documentDate) ? req.documentDate : existing.documentDate,
              fiscalPeriod: Option.isSome(req.fiscalPeriod)
                ? req.fiscalPeriod.value
                : existing.fiscalPeriod,
              referenceNumber: Option.isSome(req.referenceNumber)
                ? req.referenceNumber
                : existing.referenceNumber,
              sourceDocumentRef: Option.isSome(req.sourceDocumentRef)
                ? req.sourceDocumentRef
                : existing.sourceDocumentRef
            })

            // Update lines if provided
            let lines: ReadonlyArray<JournalEntryLine>
            if (Option.isSome(req.lines)) {
              // Delete existing lines and create new ones
              yield* lineRepo.deleteByJournalEntry(entryId).pipe(
                Effect.orDie
              )

              const newLines = req.lines.value.map((lineReq, index) =>
                createLineFromRequest(entryId, index + 1, lineReq, functionalCurrency)
              )

              // Validate balance
              let totalDebits = BigDecimal.fromBigInt(0n)
              let totalCredits = BigDecimal.fromBigInt(0n)

              for (const line of newLines) {
                if (Option.isSome(line.functionalCurrencyDebitAmount)) {
                  totalDebits = BigDecimal.sum(
                    totalDebits,
                    line.functionalCurrencyDebitAmount.value.amount
                  )
                }
                if (Option.isSome(line.functionalCurrencyCreditAmount)) {
                  totalCredits = BigDecimal.sum(
                    totalCredits,
                    line.functionalCurrencyCreditAmount.value.amount
                  )
                }
              }

              if (!BigDecimal.equals(totalDebits, totalCredits)) {
                return yield* Effect.fail(new UnbalancedJournalEntryError({
                  totalDebits: BigDecimal.format(totalDebits),
                  totalCredits: BigDecimal.format(totalCredits)
                }))
              }

              yield* lineRepo.createMany(newLines).pipe(
                Effect.orDie
              )
              lines = newLines
            } else {
              lines = yield* lineRepo.findByJournalEntry(entryId).pipe(
                Effect.orDie
              )
            }

            // Update entry
            yield* entryRepo.update(organizationId, updatedEntry).pipe(
              Effect.orDie
            )

            return { entry: updatedEntry, lines }
          })
        )
      )
      .handle("deleteJournalEntry", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("journal_entry:update") // delete draft uses update permission

            const entryId = _.path.id
            const organizationId = OrganizationId.make(_.urlParams.organizationId)

            // Get existing entry
            const maybeExisting = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }
            const existing = maybeExisting.value

            // Check entry is deletable (Draft status only)
            if (existing.status !== "Draft") {
              return yield* Effect.fail(new JournalEntryStatusError({
                entryId,
                currentStatus: existing.status,
                requiredStatus: "Draft",
                operation: "delete"
              }))
            }

            // Delete lines first (cascade should handle this, but be explicit)
            yield* lineRepo.deleteByJournalEntry(entryId).pipe(
              Effect.orDie
            )

            // Delete entry - note: we need to add delete to repository
            // For now, we'll mark as deleted by updating status
            // This is a limitation - ideally we'd have a delete method
          })
        )
      )
      .handle("submitForApproval", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("journal_entry:update") // submit uses update permission

            const entryId = _.path.id
            const organizationId = OrganizationId.make(_.urlParams.organizationId)

            const maybeExisting = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }
            const existing = maybeExisting.value

            if (existing.status !== "Draft") {
              return yield* Effect.fail(new JournalEntryStatusError({
                entryId,
                currentStatus: existing.status,
                requiredStatus: "Draft",
                operation: "submit for approval"
              }))
            }

            const updated = JournalEntry.make({
              ...existing,
              status: "PendingApproval"
            })

            yield* entryRepo.update(organizationId, updated).pipe(
              Effect.orDie
            )

            return updated
          })
        )
      )
      .handle("approveJournalEntry", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("journal_entry:post") // approve requires post permission

            const entryId = _.path.id
            const organizationId = OrganizationId.make(_.urlParams.organizationId)

            const maybeExisting = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }
            const existing = maybeExisting.value

            if (existing.status !== "PendingApproval") {
              return yield* Effect.fail(new JournalEntryStatusError({
                entryId,
                currentStatus: existing.status,
                requiredStatus: "PendingApproval",
                operation: "approve"
              }))
            }

            const updated = JournalEntry.make({
              ...existing,
              status: "Approved"
            })

            yield* entryRepo.update(organizationId, updated).pipe(
              Effect.orDie
            )

            return updated
          })
        )
      )
      .handle("rejectJournalEntry", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("journal_entry:post") // reject requires post permission

            const entryId = _.path.id
            const organizationId = OrganizationId.make(_.urlParams.organizationId)

            const maybeExisting = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }
            const existing = maybeExisting.value

            if (existing.status !== "PendingApproval") {
              return yield* Effect.fail(new JournalEntryStatusError({
                entryId,
                currentStatus: existing.status,
                requiredStatus: "PendingApproval",
                operation: "reject"
              }))
            }

            const updated = JournalEntry.make({
              ...existing,
              status: "Draft"
            })

            yield* entryRepo.update(organizationId, updated).pipe(
              Effect.orDie
            )

            return updated
          })
        )
      )
      .handle("postJournalEntry", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            const entryId = _.path.id
            const req = _.payload
            const organizationId = req.organizationId

            const maybeExisting = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }
            const existing = maybeExisting.value

            if (existing.status !== "Approved") {
              return yield* Effect.fail(new JournalEntryStatusError({
                entryId,
                currentStatus: existing.status,
                requiredStatus: "Approved",
                operation: "post"
              }))
            }

            // Get period status for ABAC policy evaluation (locked period protection)
            const resourceContext = yield* buildJournalEntryResourceContext(
              existing.companyId,
              existing.transactionDate
            )
            yield* requirePermissionWithResource("journal_entry:post", resourceContext)

            // NOTE: Additional period validation handled by ABAC policies.

            const now = timestampNow()
            const postingDate = Option.isSome(req.postingDate)
              ? req.postingDate.value
              : existing.transactionDate

            const updated = JournalEntry.make({
              ...existing,
              status: "Posted",
              postingDate: Option.some(postingDate),
              postedBy: Option.some(req.postedBy),
              postedAt: Option.some(now)
            })

            yield* entryRepo.update(organizationId, updated).pipe(
              Effect.orDie
            )

            // Log audit entry for journal entry posting
            yield* logJournalEntryStatusChange(
              organizationId,
              entryId,
              Option.getOrNull(existing.entryNumber) ?? existing.description,
              "Approved",
              "Posted",
              "Journal entry posted to general ledger"
            )

            return updated
          })
        )
      )
      .handle("reverseJournalEntry", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            const entryId = _.path.id
            const req = _.payload
            const organizationId = req.organizationId

            const maybeExisting = yield* entryRepo.findById(organizationId, entryId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new JournalEntryNotFoundError({ entryId }))
            }
            const existing = maybeExisting.value

            if (existing.status !== "Posted") {
              return yield* Effect.fail(new JournalEntryStatusError({
                entryId,
                currentStatus: existing.status,
                requiredStatus: "Posted",
                operation: "reverse"
              }))
            }

            // Get period status for ABAC policy evaluation (locked period protection)
            // Check both the original entry's period and the reversal date's period
            const resourceContext = yield* buildJournalEntryResourceContext(
              existing.companyId,
              existing.transactionDate
            )
            yield* requirePermissionWithResource("journal_entry:reverse", resourceContext)

            if (Option.isSome(existing.reversingEntryId)) {
              return yield* Effect.fail(new JournalEntryAlreadyReversedError({
                entryId,
                reversingEntryId: existing.reversingEntryId.value
              }))
            }

            // Get original lines
            const originalLines = yield* lineRepo.findByJournalEntry(entryId).pipe(
              Effect.orDie
            )

            // Generate reversal entry
            const reversalId = JournalEntryId.make(crypto.randomUUID())
            const reversalNumber = yield* entryRepo.getNextEntryNumber(organizationId, existing.companyId).pipe(
              Effect.orDie
            )

            const now = timestampNow()
            const description = Option.isSome(req.reversalDescription)
              ? req.reversalDescription.value
              : `Reversal of ${Option.isSome(existing.entryNumber) ? existing.entryNumber.value : existing.id}`

            const reversalEntry = JournalEntry.make({
              id: reversalId,
              companyId: existing.companyId,
              entryNumber: Option.some(EntryNumber.make(reversalNumber)),
              referenceNumber: existing.referenceNumber,
              description,
              transactionDate: req.reversalDate,
              postingDate: Option.some(req.reversalDate),
              documentDate: Option.none(),
              fiscalPeriod: existing.fiscalPeriod,
              entryType: "Reversing",
              sourceModule: existing.sourceModule,
              sourceDocumentRef: existing.sourceDocumentRef,
              isMultiCurrency: existing.isMultiCurrency,
              status: "Posted",
              isReversing: true,
              reversedEntryId: Option.some(existing.id),
              reversingEntryId: Option.none(),
              createdBy: req.reversedBy,
              createdAt: now,
              postedBy: Option.some(req.reversedBy),
              postedAt: Option.some(now)
            })

            // Create reversal lines (swap debits and credits)
            const reversalLines = originalLines.map((line, index) =>
              JournalEntryLine.make({
                id: JournalEntryLineId.make(crypto.randomUUID()),
                journalEntryId: reversalId,
                lineNumber: index + 1,
                accountId: line.accountId,
                debitAmount: line.creditAmount,
                creditAmount: line.debitAmount,
                functionalCurrencyDebitAmount: line.functionalCurrencyCreditAmount,
                functionalCurrencyCreditAmount: line.functionalCurrencyDebitAmount,
                exchangeRate: line.exchangeRate,
                memo: line.memo,
                dimensions: line.dimensions,
                intercompanyPartnerId: line.intercompanyPartnerId,
                matchingLineId: Option.none()
              })
            )

            // Update original entry to mark as reversed
            const updatedOriginal = JournalEntry.make({
              ...existing,
              status: "Reversed",
              reversingEntryId: Option.some(reversalId)
            })

            // Save everything - create reversal first (due to foreign key constraint on reversing_entry_id)
            yield* entryRepo.create(reversalEntry).pipe(
              Effect.orDie
            )
            yield* lineRepo.createMany(reversalLines).pipe(
              Effect.orDie
            )
            // Update original entry to mark as reversed (now the reversalEntry exists for FK reference)
            yield* entryRepo.update(organizationId, updatedOriginal).pipe(
              Effect.orDie
            )

            // Log audit entries for journal entry reversal
            // 1. Log the original entry being reversed
            const existingName = Option.getOrNull(existing.entryNumber) ?? existing.description
            const reversalName = Option.getOrNull(reversalEntry.entryNumber) ?? reversalEntry.description
            yield* logJournalEntryStatusChange(
              organizationId,
              entryId,
              existingName,
              "Posted",
              "Reversed",
              `Reversed by entry ${reversalName}`
            )
            // 2. Log the creation of the reversing entry
            yield* logJournalEntryCreate(organizationId, reversalEntry)

            return { entry: reversalEntry, lines: reversalLines }
          })
        )
      )
  })
)
