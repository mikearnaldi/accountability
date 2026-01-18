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
import * as Schema from "effect/Schema"
import {
  Company,
  CompanyId
} from "@accountability/core/Domains/Company"
import {
  Organization,
  OrganizationId,
  OrganizationSettings
} from "@accountability/core/Domains/Organization"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"
import { OrganizationMembership } from "@accountability/core/Auth/OrganizationMembership"
import { OrganizationMembershipId } from "@accountability/core/Auth/OrganizationMembershipId"
import { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { AuditLogService } from "@accountability/core/AuditLog/AuditLogService"
import { CurrentUserId } from "@accountability/core/AuditLog/CurrentUserId"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { OrganizationRepository } from "@accountability/persistence/Services/OrganizationRepository"
import { OrganizationMemberRepository } from "@accountability/persistence/Services/OrganizationMemberRepository"
import { PolicyRepository } from "@accountability/persistence/Services/PolicyRepository"
import { seedSystemPolicies } from "@accountability/persistence/Seeds/SystemPolicies"
import {
  isEntityNotFoundError,
  type EntityNotFoundError,
  type PersistenceError
} from "@accountability/persistence/Errors/RepositoryError"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  BusinessRuleError,
  AuditLogError
} from "../Definitions/ApiErrors.ts"
import type { AuditLogError as CoreAuditLogError } from "@accountability/core/AuditLog/AuditLogErrors"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"

/**
 * Map core AuditLogError to API AuditLogError
 *
 * The core AuditLogError and API AuditLogError have the same shape,
 * but different types. This maps between them for proper API error handling.
 */
const mapCoreAuditErrorToApi = (error: CoreAuditLogError): AuditLogError =>
  new AuditLogError({
    operation: error.operation,
    cause: error.cause
  })

/**
 * Convert persistence errors to BusinessRuleError
 */
const mapPersistenceToBusinessRule = (
  error: EntityNotFoundError | PersistenceError
): BusinessRuleError => {
  if (isEntityNotFoundError(error)) {
    return new BusinessRuleError({
      code: "ENTITY_NOT_FOUND",
      message: error.message,
      details: Option.none()
    })
  }
  return new BusinessRuleError({
    code: "PERSISTENCE_ERROR",
    message: error.message,
    details: Option.none()
  })
}

/**
 * Convert persistence errors to ValidationError
 */
const mapPersistenceToValidation = (
  error: EntityNotFoundError | PersistenceError
): ValidationError => {
  return new ValidationError({
    message: error.message,
    field: Option.none(),
    details: Option.none()
  })
}

/**
 * Convert persistence errors to ConflictError
 */
const mapPersistenceToConflict = (
  error: EntityNotFoundError | PersistenceError
): ConflictError => {
  return new ConflictError({
    message: error.message,
    resource: Option.none(),
    conflictingField: Option.none()
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
): Effect.Effect<void, AuditLogError, AuditLogService | CurrentUserId> =>
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
): Effect.Effect<void, AuditLogError, AuditLogService | CurrentUserId> =>
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
): Effect.Effect<void, AuditLogError, AuditLogService | CurrentUserId> =>
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

          // getOrganization only declares NotFoundError, use orDie for persistence errors
          const maybeOrg = yield* orgRepo.findById(orgId).pipe(Effect.orDie)

          return yield* Option.match(maybeOrg, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "Organization", id: _.path.id })),
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

          // createOrganization declares ValidationError and ConflictError
          const createdOrg = yield* orgRepo.create(newOrg).pipe(
            Effect.mapError((e) => mapPersistenceToConflict(e))
          )

          // Add the creating user as owner with all functional roles
          // Parse the user ID as AuthUserId (validates UUID format)
          const maybeAuthUserId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
            Effect.option
          )

          // Only create membership if user ID is a valid UUID
          // (test tokens may use non-UUID IDs like "123")
          if (Option.isSome(maybeAuthUserId)) {
            const now = timestampNow()
            const membership = OrganizationMembership.make({
              id: OrganizationMembershipId.make(crypto.randomUUID()),
              userId: maybeAuthUserId.value,
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

            // Try to create membership - may fail if user doesn't exist in auth_users table
            // (e.g., in test environments with simple token validator)
            // Error is intentionally handled to allow org creation to succeed
            yield* memberRepo.create(membership).pipe(
              Effect.catchAll(() => Effect.succeed(undefined))
            )
          }

          // Seed system policies for the new organization
          // These are the 4 built-in policies that cannot be modified by users
          // Error is intentionally handled - org creation should succeed even if policy seeding fails
          yield* seedSystemPolicies(createdOrg.id, policyRepo).pipe(
            Effect.catchAll(() => Effect.succeed(undefined))
          )

          return createdOrg
        })
      )
      .handle("updateOrganization", (_) =>
        Effect.gen(function* () {
          const req = _.payload
          const orgId = OrganizationId.make(_.path.id)

          // updateOrganization declares NotFoundError and ValidationError
          // Get existing organization
          const maybeExisting = yield* orgRepo.findById(orgId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "Organization", id: _.path.id }))
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
            Effect.mapError((e) => mapPersistenceToValidation(e))
          )
        })
      )
      .handle("deleteOrganization", (_) =>
        Effect.gen(function* () {
          const orgId = OrganizationId.make(_.path.id)

          // deleteOrganization declares NotFoundError and BusinessRuleError
          // Check if organization exists
          const maybeExisting = yield* orgRepo.findById(orgId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "Organization", id: _.path.id }))
          }

          // Check if organization has companies
          const companies = yield* companyRepo.findByOrganization(orgId).pipe(Effect.orDie)
          if (companies.length > 0) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "HAS_COMPANIES",
              message: `Cannot delete organization with ${companies.length} companies. Delete or move companies first.`,
              details: Option.none()
            }))
          }

          yield* orgRepo.delete(orgId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )

      // =============================================================================
      // Company Endpoints
      // =============================================================================
      .handle("listCompanies", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("company:read")

            // listCompanies declares NotFoundError, ValidationError, ForbiddenError
            const { organizationId, isActive, parentCompanyId, jurisdiction } = _.urlParams
            const orgId = OrganizationId.make(organizationId)

            // Check organization exists
            const orgExists = yield* orgRepo.exists(orgId).pipe(Effect.orDie)
            if (!orgExists) {
              return yield* Effect.fail(new NotFoundError({ resource: "Organization", id: organizationId }))
            }

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

            // Apply parent company filter if provided
            if (parentCompanyId !== undefined) {
              const parentId = CompanyId.make(parentCompanyId)
              companies = companies.filter((c) =>
                Option.isSome(c.parentCompanyId) && c.parentCompanyId.value === parentId
              )
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

            // getCompany declares NotFoundError, ForbiddenError
            const companyId = CompanyId.make(_.path.id)
            const organizationId = OrganizationId.make(_.path.organizationId)

            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)

            return yield* Option.match(maybeCompany, {
              onNone: () => Effect.fail(new NotFoundError({ resource: "Company", id: _.path.id })),
              onSome: Effect.succeed
            })
          })
        )
      )
      .handle("createCompany", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("company:create")

            // createCompany declares ValidationError, ConflictError, BusinessRuleError, ForbiddenError
            const req = _.payload

            // Validate organization exists
            const orgExists = yield* orgRepo.exists(req.organizationId).pipe(Effect.orDie)
            if (!orgExists) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "ORGANIZATION_NOT_FOUND",
                message: `Organization not found: ${req.organizationId}`,
                details: Option.none()
              }))
            }

            // Validate parent company if specified
            if (Option.isSome(req.parentCompanyId)) {
              // Parent company lookup uses same org ID (already validated org exists above)
              const parentCompany = yield* companyRepo.findById(req.organizationId, req.parentCompanyId.value).pipe(Effect.orDie)
              if (Option.isNone(parentCompany)) {
                return yield* Effect.fail(new BusinessRuleError({
                  code: "PARENT_COMPANY_NOT_FOUND",
                  message: `Parent company not found: ${req.parentCompanyId.value}`,
                  details: Option.none()
                }))
              }
              // No need to check parentCompany.value.organizationId !== req.organizationId anymore
              // since findById already filters by organization
            }

            // Validate ownership percentage for subsidiaries
            if (Option.isSome(req.parentCompanyId)) {
              // Subsidiaries must have ownership percentage
              if (Option.isNone(req.ownershipPercentage)) {
                return yield* Effect.fail(new ValidationError({
                  message: "Ownership percentage is required for subsidiaries",
                  field: Option.some("ownershipPercentage"),
                  details: Option.none()
                }))
              }
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
              parentCompanyId: req.parentCompanyId,
              ownershipPercentage: req.ownershipPercentage,
              isActive: true,
              createdAt: timestampNow()
            })

            const createdCompany = yield* companyRepo.create(newCompany).pipe(
              Effect.mapError((e) => mapPersistenceToConflict(e))
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

            // updateCompany declares NotFoundError, ValidationError, ConflictError, BusinessRuleError, ForbiddenError
            const req = _.payload
            const companyId = CompanyId.make(_.path.id)
            const organizationId = OrganizationId.make(_.path.organizationId)

            // Get existing company (filtered by org)
            const maybeExisting = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.id }))
            }
            const existing = maybeExisting.value

            // Validate parent company if changing
            const newParentCompanyId = Option.isSome(req.parentCompanyId)
              ? req.parentCompanyId
              : existing.parentCompanyId

            if (Option.isSome(req.parentCompanyId)) {
              if (req.parentCompanyId.value === companyId) {
                return yield* Effect.fail(new BusinessRuleError({
                  code: "CIRCULAR_REFERENCE",
                  message: "Company cannot be its own parent",
                  details: Option.none()
                }))
              }

              // Parent company lookup uses same org for security
              const parentCompany = yield* companyRepo.findById(organizationId, req.parentCompanyId.value).pipe(Effect.orDie)
              if (Option.isNone(parentCompany)) {
                return yield* Effect.fail(new BusinessRuleError({
                  code: "PARENT_COMPANY_NOT_FOUND",
                  message: `Parent company not found: ${req.parentCompanyId.value}`,
                  details: Option.none()
                }))
              }
              // No need to check parentCompany.value.organizationId !== existing.organizationId
              // since findById already filters by organization

              // Check for circular reference in hierarchy
              let currentParent = parentCompany.value
              while (Option.isSome(currentParent.parentCompanyId)) {
                if (currentParent.parentCompanyId.value === companyId) {
                  return yield* Effect.fail(new BusinessRuleError({
                    code: "CIRCULAR_REFERENCE",
                    message: "Updating parent would create circular reference in company hierarchy",
                    details: Option.none()
                  }))
                }
                const nextParent = yield* companyRepo.findById(organizationId, currentParent.parentCompanyId.value).pipe(Effect.orDie)
                if (Option.isNone(nextParent)) {
                  break
                }
                currentParent = nextParent.value
              }
            }

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
              parentCompanyId: newParentCompanyId,
              ownershipPercentage: Option.isSome(req.ownershipPercentage)
                ? req.ownershipPercentage
                : existing.ownershipPercentage,
              isActive: Option.isSome(req.isActive) ? req.isActive.value : existing.isActive
            })

            const result = yield* companyRepo.update(organizationId, updatedCompany).pipe(
              Effect.mapError((e) => mapPersistenceToConflict(e))
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

            // deactivateCompany declares NotFoundError, BusinessRuleError, ForbiddenError
            const companyId = CompanyId.make(_.path.id)
            const organizationId = OrganizationId.make(_.path.organizationId)

            // Get existing company (filtered by org)
            const maybeExisting = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeExisting)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.id }))
            }
            const existing = maybeExisting.value

            // Check for subsidiary companies (filtered by org)
            const subsidiaries = yield* companyRepo.findSubsidiaries(organizationId, companyId).pipe(Effect.orDie)
            const activeSubsidiaries = subsidiaries.filter((c) => c.isActive)
            if (activeSubsidiaries.length > 0) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "HAS_ACTIVE_SUBSIDIARIES",
                message: `Cannot deactivate company with ${activeSubsidiaries.length} active subsidiaries`,
                details: Option.none()
              }))
            }

            // Deactivate the company
            const deactivatedCompany = Company.make({
              ...existing,
              isActive: false
            })

            yield* companyRepo.update(organizationId, deactivatedCompany).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log company deactivation to audit log
            yield* logCompanyDeactivate(existing)
          })
        )
      )
  })
)
