/**
 * AccountsApiLive - Live implementation of accounts API handlers
 *
 * Implements the AccountsApi endpoints with real CRUD operations
 * by calling the AccountRepository and CompanyRepository.
 *
 * Path and URL params use domain types directly in the API schema,
 * so handlers receive already-decoded values (AccountId, CompanyId, etc.).
 * No manual Schema.decodeUnknownEither calls are needed.
 *
 * @module AccountsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as Option from "effect/Option"
import {
  Account,
  AccountId,
  type AccountCategory
} from "@accountability/core/accounting/Account"
import { CompanyId } from "@accountability/core/company/Company"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { AccountRepository } from "@accountability/persistence/Services/AccountRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  AuditLogError,
  UserLookupError
} from "../Definitions/ApiErrors.ts"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  AccountNotFoundError,
  ParentAccountNotFoundError,
  ParentAccountDifferentCompanyError,
  AccountNumberAlreadyExistsError,
  CircularAccountReferenceError,
  HasActiveChildAccountsError
} from "@accountability/core/accounting/AccountErrors"
import type {
  AuditLogError as CoreAuditLogError,
  UserLookupError as CoreUserLookupError
} from "@accountability/core/audit/AuditLogErrors"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"

/**
 * Map core audit errors to API errors
 *
 * The core AuditLogError/UserLookupError and API equivalents have the same shape,
 * but different types. This maps between them for proper API error handling.
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
 * Helper to log account creation to audit log
 *
 * Uses the AuditLogService and CurrentUserId from the Effect context.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param organizationId - The organization this account belongs to
 * @param account - The created account
 * @returns Effect that completes when audit logging succeeds
 */
const logAccountCreate = (
  organizationId: string,
  account: Account
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      organizationId,
      "Account",
      account.id,
      account.name, // Human-readable account name for audit display
      account,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log account update to audit log
 *
 * Records the before/after state of the account for auditing.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param organizationId - The organization this account belongs to
 * @param before - The account state before the update
 * @param after - The account state after the update
 * @returns Effect that completes when audit logging succeeds
 */
const logAccountUpdate = (
  organizationId: string,
  before: Account,
  after: Account
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logUpdate(
      organizationId,
      "Account",
      after.id,
      after.name, // Human-readable account name for audit display
      before,
      after,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log account deactivation (status change) to audit log
 *
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param organizationId - The organization this account belongs to
 * @param accountId - The account ID
 * @returns Effect that completes when audit logging succeeds
 */
const logAccountDeactivate = (
  organizationId: string,
  accountId: AccountId,
  accountName: string | null
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logStatusChange(
      organizationId,
      "Account",
      accountId,
      accountName, // Human-readable account name for audit display
      "active",
      "inactive",
      userId,
      "Account deactivated"
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * AccountsApiLive - Layer providing AccountsApi handlers
 *
 * Dependencies:
 * - AccountRepository
 * - CompanyRepository
 */
export const AccountsApiLive = HttpApiBuilder.group(AppApi, "accounts", (handlers) =>
  Effect.gen(function* () {
    const accountRepo = yield* AccountRepository
    const companyRepo = yield* CompanyRepository

    return handlers
      .handle("listAccounts", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:read")

            // listAccounts declares CompanyNotFoundError, OrganizationNotFoundError, ForbiddenError
            const { accountType, accountCategory, isActive, isPostable, parentAccountId } = _.urlParams
            const organizationId = OrganizationId.make(_.urlParams.organizationId)
            const companyId = CompanyId.make(_.urlParams.companyId)
            const parentAcctId = parentAccountId !== undefined ? AccountId.make(parentAccountId) : undefined

            // Check company exists within organization
            const companyExists = yield* companyRepo.exists(organizationId, companyId).pipe(Effect.orDie)
            if (!companyExists) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.urlParams.companyId }))
            }

            // Get accounts based on filters
            let accounts: ReadonlyArray<Account>

            if (accountType !== undefined) {
              accounts = yield* accountRepo.findByType(organizationId, companyId, accountType).pipe(Effect.orDie)
            } else if (isActive !== undefined) {
              if (isActive) {
                accounts = yield* accountRepo.findActiveByCompany(organizationId, companyId).pipe(Effect.orDie)
              } else {
                const all = yield* accountRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)
                accounts = all.filter((a) => !a.isActive)
              }
            } else if (parentAcctId !== undefined) {
              accounts = yield* accountRepo.findChildren(organizationId, parentAcctId).pipe(Effect.orDie)
            } else {
              accounts = yield* accountRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)
            }

            // Apply category filter if provided
            if (accountCategory !== undefined) {
              const category: AccountCategory = accountCategory
              accounts = accounts.filter((a) => a.accountCategory === category)
            }

            // Apply postable filter if provided - already decoded
            if (isPostable !== undefined) {
              accounts = accounts.filter((a) => a.isPostable === isPostable)
            }

            // Apply pagination
            const total = accounts.length
            const limit = _.urlParams.limit ?? 100
            const offset = _.urlParams.offset ?? 0
            const paginatedAccounts = accounts.slice(offset, offset + limit)

            return {
              accounts: paginatedAccounts,
              total,
              limit,
              offset
            }
          })
        )
      )
      .handle("getAccount", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:read")

            // getAccount declares AccountNotFoundError, OrganizationNotFoundError, ForbiddenError
            const organizationId = OrganizationId.make(_.path.organizationId)
            const accountId = AccountId.make(_.path.id)

            const maybeAccount = yield* accountRepo.findById(organizationId, accountId).pipe(Effect.orDie)

            return yield* Option.match(maybeAccount, {
              onNone: () => Effect.fail(new AccountNotFoundError({ accountId: _.path.id })),
              onSome: Effect.succeed
            })
          })
        )
      )
      .handle("createAccount", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:create")

            // createAccount declares CompanyNotFoundError, AccountNumberAlreadyExistsError,
            // ParentAccountNotFoundError, ParentAccountDifferentCompanyError, ConflictError,
            // OrganizationNotFoundError, ForbiddenError, AuditLogError, UserLookupError
            const req = _.payload
            const organizationId = OrganizationId.make(req.organizationId)

            // Validate company exists within organization
            const companyExists = yield* companyRepo.exists(organizationId, req.companyId).pipe(Effect.orDie)
            if (!companyExists) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: req.companyId }))
            }

            // Check for duplicate account number
            const existingAccount = yield* accountRepo.findByNumber(organizationId, req.companyId, req.accountNumber).pipe(Effect.orDie)
            if (Option.isSome(existingAccount)) {
              return yield* Effect.fail(new AccountNumberAlreadyExistsError({
                accountNumber: req.accountNumber,
                companyId: req.companyId
              }))
            }

            // Validate parent account if specified
            let hierarchyLevel = 1
            if (Option.isSome(req.parentAccountId)) {
              const parentAccount = yield* accountRepo.findById(organizationId, req.parentAccountId.value).pipe(Effect.orDie)
              if (Option.isNone(parentAccount)) {
                return yield* Effect.fail(new ParentAccountNotFoundError({
                  parentAccountId: req.parentAccountId.value
                }))
              }
              if (!Equal.equals(parentAccount.value.companyId, req.companyId)) {
                return yield* Effect.fail(new ParentAccountDifferentCompanyError({
                  accountCompanyId: req.companyId,
                  parentAccountCompanyId: parentAccount.value.companyId
                }))
              }
              hierarchyLevel = parentAccount.value.hierarchyLevel + 1
            }

            // Create the account
            const newAccount = Account.make({
              id: AccountId.make(crypto.randomUUID()),
              companyId: req.companyId,
              accountNumber: req.accountNumber,
              name: req.name,
              description: req.description,
              accountType: req.accountType,
              accountCategory: req.accountCategory,
              normalBalance: req.normalBalance,
              parentAccountId: req.parentAccountId,
              hierarchyLevel,
              isPostable: req.isPostable,
              isCashFlowRelevant: req.isCashFlowRelevant,
              cashFlowCategory: req.cashFlowCategory,
              isIntercompany: req.isIntercompany,
              intercompanyPartnerId: req.intercompanyPartnerId,
              currencyRestriction: req.currencyRestriction,
              isActive: true,
              isRetainedEarnings: req.isRetainedEarnings,
              createdAt: timestampNow(),
              deactivatedAt: Option.none()
            })

            const createdAccount = yield* accountRepo.create(newAccount).pipe(
              Effect.mapError(() => new AccountNumberAlreadyExistsError({
                accountNumber: req.accountNumber,
                companyId: req.companyId
              }))
            )

            // Log account creation to audit log
            yield* logAccountCreate(req.organizationId, createdAccount)

            return createdAccount
          })
        )
      )
      .handle("updateAccount", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:update")

            // updateAccount declares AccountNotFoundError, ParentAccountNotFoundError,
            // ParentAccountDifferentCompanyError, CircularAccountReferenceError, ConflictError,
            // OrganizationNotFoundError, ForbiddenError, AuditLogError, UserLookupError
            const req = _.payload

            // Convert path params to branded types
            const organizationId = OrganizationId.make(_.path.organizationId)
            const accountId = AccountId.make(_.path.id)

            // Get existing account
            const maybeExisting = yield* accountRepo.findById(organizationId, accountId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new AccountNotFoundError({ accountId: _.path.id }))
            }
            const existing = maybeExisting.value

            // Validate parent account if changing
            let hierarchyLevel = existing.hierarchyLevel
            const newParentAccountId = Option.isSome(req.parentAccountId)
              ? req.parentAccountId
              : existing.parentAccountId

            if (Option.isSome(req.parentAccountId) &&
                !Equal.equals(req.parentAccountId, existing.parentAccountId)) {
              if (Option.isSome(req.parentAccountId)) {
                if (req.parentAccountId.value === accountId) {
                  return yield* Effect.fail(new CircularAccountReferenceError({
                    accountId: _.path.id,
                    parentAccountId: _.path.id
                  }))
                }

                const parentAccount = yield* accountRepo.findById(organizationId, req.parentAccountId.value).pipe(Effect.orDie)
                if (Option.isNone(parentAccount)) {
                  return yield* Effect.fail(new ParentAccountNotFoundError({
                    parentAccountId: req.parentAccountId.value
                  }))
                }
                if (!Equal.equals(parentAccount.value.companyId, existing.companyId)) {
                  return yield* Effect.fail(new ParentAccountDifferentCompanyError({
                    accountCompanyId: existing.companyId,
                    parentAccountCompanyId: parentAccount.value.companyId
                  }))
                }
                hierarchyLevel = parentAccount.value.hierarchyLevel + 1
              } else {
                hierarchyLevel = 1
              }
            }

            // Build updated account
            const updatedAccount = Account.make({
              ...existing,
              name: Option.isSome(req.name) ? req.name.value : existing.name,
              description: Option.isSome(req.description) ? req.description : existing.description,
              parentAccountId: newParentAccountId,
              hierarchyLevel,
              isPostable: Option.isSome(req.isPostable) ? req.isPostable.value : existing.isPostable,
              isCashFlowRelevant: Option.isSome(req.isCashFlowRelevant)
                ? req.isCashFlowRelevant.value
                : existing.isCashFlowRelevant,
              cashFlowCategory: Option.isSome(req.cashFlowCategory)
                ? req.cashFlowCategory
                : existing.cashFlowCategory,
              isIntercompany: Option.isSome(req.isIntercompany)
                ? req.isIntercompany.value
                : existing.isIntercompany,
              intercompanyPartnerId: Option.isSome(req.intercompanyPartnerId)
                ? req.intercompanyPartnerId
                : existing.intercompanyPartnerId,
              currencyRestriction: Option.isSome(req.currencyRestriction)
                ? req.currencyRestriction
                : existing.currencyRestriction,
              isActive: Option.isSome(req.isActive) ? req.isActive.value : existing.isActive,
              isRetainedEarnings: Option.isSome(req.isRetainedEarnings)
                ? req.isRetainedEarnings.value
                : existing.isRetainedEarnings,
              deactivatedAt: Option.isSome(req.isActive) && !req.isActive.value && existing.isActive
                ? Option.some(timestampNow())
                : existing.deactivatedAt
            })

            const savedAccount = yield* accountRepo.update(organizationId, updatedAccount).pipe(
              Effect.mapError(() => new AccountNumberAlreadyExistsError({
                accountNumber: updatedAccount.accountNumber,
                companyId: updatedAccount.companyId
              }))
            )

            // Log account update to audit log with before/after state
            yield* logAccountUpdate(_.path.organizationId, existing, savedAccount)

            return savedAccount
          })
        )
      )
      .handle("deactivateAccount", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("account:deactivate")

            // deactivateAccount declares AccountNotFoundError, HasActiveChildAccountsError,
            // OrganizationNotFoundError, ForbiddenError, AuditLogError, UserLookupError
            const organizationId = OrganizationId.make(_.path.organizationId)
            const accountId = AccountId.make(_.path.id)

            // Get existing account
            const maybeExisting = yield* accountRepo.findById(organizationId, accountId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new AccountNotFoundError({ accountId: _.path.id }))
            }
            const existing = maybeExisting.value

            // Check for child accounts
            const children = yield* accountRepo.findChildren(organizationId, accountId).pipe(Effect.orDie)
            const activeChildren = children.filter((c) => c.isActive)
            if (activeChildren.length > 0) {
              return yield* Effect.fail(new HasActiveChildAccountsError({
                accountId: _.path.id,
                childCount: activeChildren.length
              }))
            }

            // Deactivate the account
            const deactivatedAccount = Account.make({
              ...existing,
              isActive: false,
              deactivatedAt: Option.some(timestampNow())
            })

            yield* accountRepo.update(organizationId, deactivatedAccount).pipe(Effect.orDie)

            // Log account deactivation to audit log
            yield* logAccountDeactivate(_.path.organizationId, accountId, existing.name)
          })
        )
      )
  })
)
