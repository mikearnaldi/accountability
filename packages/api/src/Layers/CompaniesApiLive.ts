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
} from "@accountability/core/Domains/Company"
import {
  Organization,
  OrganizationId,
  OrganizationSettings
} from "@accountability/core/Domains/Organization"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { OrganizationRepository } from "@accountability/persistence/Services/OrganizationRepository"
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
  BusinessRuleError
} from "../Definitions/ApiErrors.ts"

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

/**
 * CompaniesApiLive - Layer providing CompaniesApi handlers
 *
 * Dependencies:
 * - CompanyRepository
 * - OrganizationRepository
 */
export const CompaniesApiLive = HttpApiBuilder.group(AppApi, "companies", (handlers) =>
  Effect.gen(function* () {
    const companyRepo = yield* CompanyRepository
    const orgRepo = yield* OrganizationRepository

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
          return yield* orgRepo.create(newOrg).pipe(
            Effect.mapError((e) => mapPersistenceToConflict(e))
          )
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
        Effect.gen(function* () {
          // listCompanies declares NotFoundError and ValidationError
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
      .handle("getCompany", (_) =>
        Effect.gen(function* () {
          // getCompany only declares NotFoundError
          const companyId = CompanyId.make(_.path.id)

          const maybeCompany = yield* companyRepo.findById(companyId).pipe(Effect.orDie)

          return yield* Option.match(maybeCompany, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "Company", id: _.path.id })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("createCompany", (_) =>
        Effect.gen(function* () {
          // createCompany declares ValidationError, ConflictError, BusinessRuleError
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
            const parentCompany = yield* companyRepo.findById(req.parentCompanyId.value).pipe(Effect.orDie)
            if (Option.isNone(parentCompany)) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "PARENT_COMPANY_NOT_FOUND",
                message: `Parent company not found: ${req.parentCompanyId.value}`,
                details: Option.none()
              }))
            }
            if (parentCompany.value.organizationId !== req.organizationId) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "PARENT_DIFFERENT_ORGANIZATION",
                message: "Parent company must be in the same organization",
                details: Option.none()
              }))
            }
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

          return yield* companyRepo.create(newCompany).pipe(
            Effect.mapError((e) => mapPersistenceToConflict(e))
          )
        })
      )
      .handle("updateCompany", (_) =>
        Effect.gen(function* () {
          // updateCompany declares NotFoundError, ValidationError, ConflictError, BusinessRuleError
          const req = _.payload
          const companyId = CompanyId.make(_.path.id)

          // Get existing company
          const maybeExisting = yield* companyRepo.findById(companyId).pipe(Effect.orDie)
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

            const parentCompany = yield* companyRepo.findById(req.parentCompanyId.value).pipe(Effect.orDie)
            if (Option.isNone(parentCompany)) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "PARENT_COMPANY_NOT_FOUND",
                message: `Parent company not found: ${req.parentCompanyId.value}`,
                details: Option.none()
              }))
            }
            if (parentCompany.value.organizationId !== existing.organizationId) {
              return yield* Effect.fail(new BusinessRuleError({
                code: "PARENT_DIFFERENT_ORGANIZATION",
                message: "Parent company must be in the same organization",
                details: Option.none()
              }))
            }

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
              const nextParent = yield* companyRepo.findById(currentParent.parentCompanyId.value).pipe(Effect.orDie)
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

          return yield* companyRepo.update(updatedCompany).pipe(
            Effect.mapError((e) => mapPersistenceToConflict(e))
          )
        })
      )
      .handle("deactivateCompany", (_) =>
        Effect.gen(function* () {
          // deactivateCompany declares NotFoundError and BusinessRuleError
          const companyId = CompanyId.make(_.path.id)

          // Get existing company
          const maybeExisting = yield* companyRepo.findById(companyId).pipe(Effect.orDie)
          if (Option.isNone(maybeExisting)) {
            return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.id }))
          }
          const existing = maybeExisting.value

          // Check for subsidiary companies
          const subsidiaries = yield* companyRepo.findSubsidiaries(companyId).pipe(Effect.orDie)
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

          yield* companyRepo.update(deactivatedCompany).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
  })
)
