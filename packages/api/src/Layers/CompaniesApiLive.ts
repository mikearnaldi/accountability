/**
 * CompaniesApiLive - Live implementation of companies API handlers
 *
 * Implements the CompaniesApi endpoints with real CRUD operations
 * by calling the CompanyRepository and OrganizationRepository.
 *
 * Path and URL params use domain types directly in the API schema,
 * so handlers receive already-decoded values.
 *
 * @module CompaniesApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import {
  Company,
  CompanyId
} from "@accountability/core/company/Company"
import {
  Organization,
  OrganizationId,
  OrganizationSettings
} from "@accountability/core/organization/Organization"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { OrganizationMembership } from "@accountability/core/membership/OrganizationMembership"
import { OrganizationMembershipId } from "@accountability/core/membership/OrganizationMembershipId"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { OrganizationRepository } from "@accountability/persistence/Services/OrganizationRepository"
import { OrganizationMemberRepository } from "@accountability/persistence/Services/OrganizationMemberRepository"
import { PolicyRepository } from "@accountability/persistence/Services/PolicyRepository"
import { seedSystemPolicies } from "@accountability/persistence/Seeds/SystemPolicies"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  AuditLogError,
  UserLookupError
} from "../Definitions/ApiErrors.ts"
import {
  OrganizationNotFoundError,
  OrganizationHasCompaniesError,
  OrganizationNameAlreadyExistsError,
  OrganizationUpdateFailedError
} from "@accountability/core/organization/OrganizationErrors"
import {
  CompanyNotFoundError,
  CompanyNameAlreadyExistsError
} from "@accountability/core/company/CompanyErrors"
import {
  MembershipCreationFailedError,
  SystemPolicySeedingFailedError
} from "@accountability/core/organization/OrganizationErrors"
import type { AuditLogError as CoreAuditLogError, UserLookupError as CoreUserLookupError } from "@accountability/core/audit/AuditLogErrors"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"

/**
 * Map core AuditLogError to API AuditLogError
 *
 * The core AuditLogError and API AuditLogError have the same shape,
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


// =============================================================================
// Audit Log Helpers
// =============================================================================

/**
 * Helper to log company creation to audit log
 *
 * Uses the AuditLogService and CurrentUserId from the Effect context.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param company - The created company
 * @returns Effect that completes when audit logging succeeds
 */
const logCompanyCreate = (
  company: Company
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      company.organizationId,
      "Company",
      company.id,
      company.name, // Human-readable company name for audit display
      company,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log company update to audit log
 *
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param before - The company state before the update
 * @param after - The company state after the update
 * @returns Effect that completes when audit logging succeeds
 */
const logCompanyUpdate = (
  before: Company,
  after: Company
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logUpdate(
      after.organizationId,
      "Company",
      after.id,
      after.name, // Human-readable company name for audit display
      before,
      after,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log company deactivation to audit log
 *
 * Uses logStatusChange since deactivation is a status transition (active → inactive).
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param company - The company being deactivated
 * @returns Effect that completes when audit logging succeeds
 */
const logCompanyDeactivate = (
  company: Company
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logStatusChange(
      company.organizationId,
      "Company",
      company.id,
      company.name, // Human-readable company name for audit display
      "active",
      "inactive",
      userId,
      "Company deactivated"
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * CompaniesApiLive - Layer providing CompaniesApi handlers
 *
 * Dependencies:
 * - CompanyRepository
 * - OrganizationRepository
 * - OrganizationMemberRepository
 * - PolicyRepository
 * - AuditLogService (optional, for audit logging)
 * - CurrentUserId (optional, for audit logging)
 */
export const CompaniesApiLive = HttpApiBuilder.group(AppApi, "companies", (handlers) =>
  Effect.gen(function* () {
    const companyRepo = yield* CompanyRepository
    const orgRepo = yield* OrganizationRepository
    const memberRepo = yield* OrganizationMemberRepository
    const policyRepo = yield* PolicyRepository

    return handlers
      // =============================================================================
      // Organization Endpoints
      // =============================================================================
      .handle("listOrganizations", () =>
        Effect.gen(function* () {
          // listOrganizations endpoint declares no errors, so we use orDie
          // to convert any persistence errors to defects
          const organizations = yield* orgRepo.findAll().pipe(Effect.orDie)

          return {
            organizations: [...organizations],
            total: organizations.length
          }
        })
      )
      .handle("getOrganization", (_) =>
        Effect.gen(function* () {
          const orgId = OrganizationId.make(_.path.id)

          // getOrganization declares OrganizationNotFoundError, use orDie for persistence errors
          const maybeOrg = yield* orgRepo.findById(orgId).pipe(Effect.orDie)

          return yield* Option.match(maybeOrg, {
            onNone: () => Effect.fail(new OrganizationNotFoundError({ organizationId: _.path.id })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("createOrganization", (_) =>
        Effect.gen(function* () {
          const req = _.payload
          const currentUser = yield* CurrentUser

          // Create organization with defaults for optional settings
          const settings = Option.isSome(req.settings)
            ? req.settings.value
            : OrganizationSettings.make({})

          const newOrg = Organization.make({
            id: OrganizationId.make(crypto.randomUUID()),
            name: req.name,
            reportingCurrency: req.reportingCurrency,
            createdAt: timestampNow(),
            settings
          })

          // createOrganization - name uniqueness enforced by database
          const createdOrg = yield* orgRepo.create(newOrg).pipe(
            Effect.mapError(() => new OrganizationNameAlreadyExistsError({ name: req.name }))
          )

          // Add the creating user as owner with all functional roles
          // currentUser.userId is already typed as AuthUserId (validated at auth middleware)
          const now = timestampNow()
          const membership = OrganizationMembership.make({
            id: OrganizationMembershipId.make(crypto.randomUUID()),
            userId: currentUser.userId,
            organizationId: createdOrg.id,
            role: "owner",
            isController: true,
            isFinanceManager: true,
            isAccountant: true,
            isPeriodAdmin: true,
            isConsolidationManager: true,
            status: "active",
            removedAt: Option.none(),
            removedBy: Option.none(),
            removalReason: Option.none(),
            reinstatedAt: Option.none(),
            reinstatedBy: Option.none(),
            createdAt: now,
            updatedAt: now,
            invitedBy: Option.none()
          })

          // Create membership - this is critical for proper authorization
          // If membership creation fails, organization creation must fail to maintain
          // data integrity (organization creator must be auto-added as owner)
          yield* memberRepo.create(membership).pipe(
            Effect.mapError((e) => new MembershipCreationFailedError({
              reason: e.message
            }))
          )

          // Seed system policies for the new organization
          // These are the 4 built-in policies that cannot be modified by users
          // If policy seeding fails, organization creation fails - system policies
          // are essential baseline access controls that must always exist
          yield* seedSystemPolicies(createdOrg.id, policyRepo).pipe(
            Effect.mapError(() => new SystemPolicySeedingFailedError({}))
          )

          return createdOrg
        })
      )
      .handle("updateOrganization", (_) =>
        Effect.gen(function* () {
          const req = _.payload
          const orgId = OrganizationId.make(_.path.id)

          // updateOrganization declares OrganizationNotFoundError and ValidationError
          // Get existing organization
          const maybeExisting = yield* orgRepo.findById(orgId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new OrganizationNotFoundError({ organizationId: _.path.id }))
          }
          const existing = maybeExisting.value

          // Build updated organization
          const updatedOrg = Organization.make({
            ...existing,
            name: Option.isSome(req.name) ? req.name.value : existing.name,
            reportingCurrency: Option.isSome(req.reportingCurrency)
              ? req.reportingCurrency.value
              : existing.reportingCurrency,
            settings: Option.isSome(req.settings) ? req.settings.value : existing.settings
          })

          return yield* orgRepo.update(updatedOrg).pipe(
            Effect.mapError((e) => new OrganizationUpdateFailedError({
              organizationId: _.path.id,
              reason: e.message
            }))
          )
        })
      )
      .handle("deleteOrganization", (_) =>
        Effect.gen(function* () {
          const orgId = OrganizationId.make(_.path.id)

          // deleteOrganization declares OrganizationNotFoundError and OrganizationHasCompaniesError
          // Check if organization exists
          const maybeExisting = yield* orgRepo.findById(orgId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new OrganizationNotFoundError({ organizationId: _.path.id }))
          }

          // Check if organization has companies
          const companies = yield* companyRepo.findByOrganization(orgId).pipe(Effect.orDie)
          if (companies.length > 0) {
            return yield* Effect.fail(new OrganizationHasCompaniesError({
              organizationId: _.path.id,
              companyCount: companies.length
            }))
          }

          yield* orgRepo.delete(orgId).pipe(Effect.orDie)
        })
      )

      // =============================================================================
      // Company Endpoints
      // =============================================================================
      .handle("listCompanies", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("company:read")

            // listCompanies declares OrganizationNotFoundError, ForbiddenError
            // Organization context is already validated by requireOrganizationContext
            const { organizationId, isActive, jurisdiction } = _.urlParams
            const orgId = OrganizationId.make(organizationId)

            // Get companies based on filters
            let companies: ReadonlyArray<Company>

            if (isActive !== undefined) {
              if (isActive) {
                companies = yield* companyRepo.findActiveByOrganization(orgId).pipe(Effect.orDie)
              } else {
                const all = yield* companyRepo.findByOrganization(orgId).pipe(Effect.orDie)
                companies = all.filter((c) => !c.isActive)
              }
            } else {
              companies = yield* companyRepo.findByOrganization(orgId).pipe(Effect.orDie)
            }

            // Apply jurisdiction filter if provided
            if (jurisdiction !== undefined) {
              companies = companies.filter((c) => c.jurisdiction === jurisdiction)
            }

            // Apply pagination
            const total = companies.length
            const limit = _.urlParams.limit ?? 100
            const offset = _.urlParams.offset ?? 0
            const paginatedCompanies = companies.slice(offset, offset + limit)

            return {
              companies: [...paginatedCompanies],
              total,
              limit,
              offset
            }
          })
        )
      )
      .handle("getCompany", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("company:read")

            // getCompany declares CompanyNotFoundError, OrganizationNotFoundError, ForbiddenError
            const companyId = CompanyId.make(_.path.id)
            const organizationId = OrganizationId.make(_.path.organizationId)

            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)

            return yield* Option.match(maybeCompany, {
              onNone: () => Effect.fail(new CompanyNotFoundError({ companyId: _.path.id })),
              onSome: Effect.succeed
            })
          })
        )
      )
      .handle("createCompany", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("company:create")

            // createCompany declares OrganizationNotFoundError, CompanyNameAlreadyExistsError,
            // ForbiddenError, AuditLogError, UserLookupError
            const req = _.payload

            // Validate organization exists (requireOrganizationContext validates access,
            // this confirms the org exists in the database)
            const orgExists = yield* orgRepo.exists(req.organizationId).pipe(Effect.orDie)
            if (!orgExists) {
              return yield* Effect.fail(new OrganizationNotFoundError({
                organizationId: req.organizationId
              }))
            }

            // Create the company
            const newCompany = Company.make({
              id: CompanyId.make(crypto.randomUUID()),
              organizationId: req.organizationId,
              name: req.name,
              legalName: req.legalName,
              jurisdiction: req.jurisdiction,
              taxId: req.taxId,
              incorporationDate: req.incorporationDate,
              registrationNumber: req.registrationNumber,
              registeredAddress: req.registeredAddress,
              industryCode: req.industryCode,
              companyType: req.companyType,
              incorporationJurisdiction: req.incorporationJurisdiction,
              functionalCurrency: req.functionalCurrency,
              reportingCurrency: req.reportingCurrency,
              fiscalYearEnd: req.fiscalYearEnd,
              retainedEarningsAccountId: Option.none(),
              isActive: true,
              createdAt: timestampNow()
            })

            const createdCompany = yield* companyRepo.create(newCompany).pipe(
              Effect.mapError(() => new CompanyNameAlreadyExistsError({
                companyName: req.name,
                organizationId: req.organizationId
              }))
            )

            // Log company creation to audit log
            yield* logCompanyCreate(createdCompany)

            return createdCompany
          })
        )
      )
      .handle("updateCompany", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("company:update")

            // updateCompany declares CompanyNotFoundError, CompanyNameAlreadyExistsError,
            // OrganizationNotFoundError, ForbiddenError, AuditLogError, UserLookupError
            const req = _.payload
            const companyId = CompanyId.make(_.path.id)
            const organizationId = OrganizationId.make(_.path.organizationId)

            // Get existing company (filtered by org)
            const maybeExisting = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.id }))
            }
            const existing = maybeExisting.value

            // Build updated fiscal year end if provided
            const newFiscalYearEnd = Option.isSome(req.fiscalYearEnd)
              ? req.fiscalYearEnd.value
              : existing.fiscalYearEnd

            // Build updated company
            const updatedCompany = Company.make({
              ...existing,
              name: Option.isSome(req.name) ? req.name.value : existing.name,
              legalName: Option.isSome(req.legalName) ? req.legalName.value : existing.legalName,
              taxId: Option.isSome(req.taxId) ? req.taxId : existing.taxId,
              incorporationDate: Option.isSome(req.incorporationDate)
                ? req.incorporationDate
                : existing.incorporationDate,
              registrationNumber: Option.isSome(req.registrationNumber)
                ? req.registrationNumber
                : existing.registrationNumber,
              registeredAddress: Option.isSome(req.registeredAddress)
                ? req.registeredAddress
                : existing.registeredAddress,
              industryCode: Option.isSome(req.industryCode)
                ? req.industryCode
                : existing.industryCode,
              companyType: Option.isSome(req.companyType)
                ? req.companyType
                : existing.companyType,
              incorporationJurisdiction: Option.isSome(req.incorporationJurisdiction)
                ? req.incorporationJurisdiction
                : existing.incorporationJurisdiction,
              reportingCurrency: Option.isSome(req.reportingCurrency)
                ? req.reportingCurrency.value
                : existing.reportingCurrency,
              fiscalYearEnd: newFiscalYearEnd,
              retainedEarningsAccountId: Option.isSome(req.retainedEarningsAccountId)
                ? req.retainedEarningsAccountId
                : existing.retainedEarningsAccountId,
              isActive: Option.isSome(req.isActive) ? req.isActive.value : existing.isActive
            })

            const result = yield* companyRepo.update(organizationId, updatedCompany).pipe(
              Effect.mapError(() => new CompanyNameAlreadyExistsError({
                companyName: updatedCompany.name,
                organizationId: _.path.organizationId
              }))
            )

            // Log company update to audit log
            yield* logCompanyUpdate(existing, result)

            return result
          })
        )
      )
      .handle("deactivateCompany", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("company:delete")

            // deactivateCompany declares CompanyNotFoundError, OrganizationNotFoundError,
            // ForbiddenError, AuditLogError, UserLookupError
            const companyId = CompanyId.make(_.path.id)
            const organizationId = OrganizationId.make(_.path.organizationId)

            // Get existing company (filtered by org)
            const maybeExisting = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.id }))
            }
            const existing = maybeExisting.value

            // Deactivate the company
            const deactivatedCompany = Company.make({
              ...existing,
              isActive: false
            })

            yield* companyRepo.update(organizationId, deactivatedCompany).pipe(Effect.orDie)

            // Log company deactivation to audit log
            yield* logCompanyDeactivate(existing)
          })
        )
      )
  })
)
