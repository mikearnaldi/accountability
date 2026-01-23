/**
 * CompaniesApi - HTTP API group for company management
 *
 * Provides endpoints for CRUD operations on companies and organizations.
 *
 * @module CompaniesApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { Address } from "@accountability/core/shared/values/Address"
import { AccountId } from "@accountability/core/accounting/Account"
import {
  Company,
  FiscalYearEnd
} from "@accountability/core/company/Company"
import { CompanyType } from "@accountability/core/company/CompanyType"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { Organization, OrganizationId, OrganizationSettings } from "@accountability/core/organization/Organization"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/jurisdiction/JurisdictionCode"
import {
  AuditLogError,
  ForbiddenError,
  UserLookupError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import {
  OrganizationNotFoundError,
  OrganizationHasCompaniesError,
  MembershipCreationFailedError,
  SystemPolicySeedingFailedError,
  OrganizationNameAlreadyExistsError,
  OrganizationUpdateFailedError
} from "@accountability/core/organization/OrganizationErrors"
import {
  CompanyNotFoundError,
  CompanyNameAlreadyExistsError
} from "@accountability/core/company/CompanyErrors"

// =============================================================================
// Organization Request/Response Schemas
// =============================================================================

/**
 * CreateOrganizationRequest - Request body for creating a new organization
 */
export class CreateOrganizationRequest extends Schema.Class<CreateOrganizationRequest>("CreateOrganizationRequest")({
  name: Schema.NonEmptyTrimmedString,
  reportingCurrency: CurrencyCode,
  settings: Schema.OptionFromNullOr(OrganizationSettings)
}) {}

/**
 * UpdateOrganizationRequest - Request body for updating an organization
 */
export class UpdateOrganizationRequest extends Schema.Class<UpdateOrganizationRequest>("UpdateOrganizationRequest")({
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  reportingCurrency: Schema.OptionFromNullOr(CurrencyCode),
  settings: Schema.OptionFromNullOr(OrganizationSettings)
}) {}

/**
 * OrganizationListResponse - Response containing a list of organizations
 */
export class OrganizationListResponse extends Schema.Class<OrganizationListResponse>("OrganizationListResponse")({
  organizations: Schema.Array(Organization),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

// =============================================================================
// Company Request/Response Schemas
// =============================================================================

/**
 * CreateCompanyRequest - Request body for creating a new company
 */
export class CreateCompanyRequest extends Schema.Class<CreateCompanyRequest>("CreateCompanyRequest")({
  organizationId: OrganizationId,
  name: Schema.NonEmptyTrimmedString,
  legalName: Schema.NonEmptyTrimmedString,
  jurisdiction: JurisdictionCode,
  taxId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  incorporationDate: Schema.OptionFromNullOr(LocalDate),
  registrationNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  registeredAddress: Schema.OptionFromNullOr(Address),
  industryCode: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  companyType: Schema.OptionFromNullOr(CompanyType),
  incorporationJurisdiction: Schema.OptionFromNullOr(JurisdictionCode),
  functionalCurrency: CurrencyCode,
  reportingCurrency: CurrencyCode,
  fiscalYearEnd: FiscalYearEnd
}) {}

/**
 * UpdateCompanyRequest - Request body for updating a company
 */
export class UpdateCompanyRequest extends Schema.Class<UpdateCompanyRequest>("UpdateCompanyRequest")({
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  legalName: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  taxId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  incorporationDate: Schema.OptionFromNullOr(LocalDate),
  registrationNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  registeredAddress: Schema.OptionFromNullOr(Address),
  industryCode: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  companyType: Schema.OptionFromNullOr(CompanyType),
  incorporationJurisdiction: Schema.OptionFromNullOr(JurisdictionCode),
  reportingCurrency: Schema.OptionFromNullOr(CurrencyCode),
  fiscalYearEnd: Schema.OptionFromNullOr(FiscalYearEnd),
  retainedEarningsAccountId: Schema.OptionFromNullOr(AccountId),
  isActive: Schema.OptionFromNullOr(Schema.Boolean)
}) {}

/**
 * CompanyListResponse - Response containing a list of companies
 */
export class CompanyListResponse extends Schema.Class<CompanyListResponse>("CompanyListResponse")({
  companies: Schema.Array(Company),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Query parameters for listing companies
 * Uses string types for URL parameters
 */
export const CompanyListParams = Schema.Struct({
  organizationId: Schema.String,
  isActive: Schema.optional(Schema.BooleanFromString),
  jurisdiction: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

/**
 * Type for CompanyListParams
 */
export type CompanyListParams = typeof CompanyListParams.Type

// =============================================================================
// Organization API Endpoints
// =============================================================================

/**
 * List all organizations
 */
const listOrganizations = HttpApiEndpoint.get("listOrganizations", "/organizations")
  .addSuccess(OrganizationListResponse)
  .annotateContext(OpenApi.annotations({
    summary: "List organizations",
    description: "Retrieve all organizations accessible by the current user."
  }))

/**
 * Get a single organization by ID
 */
const getOrganization = HttpApiEndpoint.get("getOrganization", "/organizations/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .addSuccess(Organization)
  .addError(OrganizationNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get organization",
    description: "Retrieve a single organization by its unique identifier."
  }))

/**
 * Create a new organization
 */
const createOrganization = HttpApiEndpoint.post("createOrganization", "/organizations")
  .setPayload(CreateOrganizationRequest)
  .addSuccess(Organization, { status: 201 })
  .addError(OrganizationNameAlreadyExistsError)
  .addError(MembershipCreationFailedError)
  .addError(SystemPolicySeedingFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Create organization",
    description: "Create a new organization. Organizations are the top-level container for companies and shared settings."
  }))

/**
 * Update an existing organization
 */
const updateOrganization = HttpApiEndpoint.put("updateOrganization", "/organizations/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .setPayload(UpdateOrganizationRequest)
  .addSuccess(Organization)
  .addError(OrganizationNotFoundError)
  .addError(OrganizationUpdateFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Update organization",
    description: "Update an existing organization. Only provided fields will be updated."
  }))

/**
 * Delete an organization (only if no companies exist)
 */
const deleteOrganization = HttpApiEndpoint.del("deleteOrganization", "/organizations/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(OrganizationNotFoundError)
  .addError(OrganizationHasCompaniesError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete organization",
    description: "Delete an organization. Organizations can only be deleted if they contain no companies."
  }))

// =============================================================================
// Company API Endpoints
// =============================================================================

/**
 * List all companies
 */
const listCompanies = HttpApiEndpoint.get("listCompanies", "/companies")
  .setUrlParams(CompanyListParams)
  .addSuccess(CompanyListResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List companies",
    description: "Retrieve a paginated list of companies for an organization. Supports filtering by status, parent company, and jurisdiction."
  }))

/**
 * Get a single company by ID within an organization
 */
const getCompany = HttpApiEndpoint.get("getCompany", "/organizations/:organizationId/companies/:id")
  .setPath(Schema.Struct({ organizationId: Schema.String, id: Schema.String }))
  .addSuccess(Company)
  .addError(CompanyNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get company",
    description: "Retrieve a single company by its unique identifier within an organization."
  }))

/**
 * Create a new company
 */
const createCompany = HttpApiEndpoint.post("createCompany", "/companies")
  .setPayload(CreateCompanyRequest)
  .addSuccess(Company, { status: 201 })
  .addError(OrganizationNotFoundError)
  .addError(CompanyNameAlreadyExistsError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Create company",
    description: "Create a new company within an organization. Parent-subsidiary relationships are defined in Consolidation Groups, not on individual companies."
  }))

/**
 * Update an existing company within an organization
 */
const updateCompany = HttpApiEndpoint.put("updateCompany", "/organizations/:organizationId/companies/:id")
  .setPath(Schema.Struct({ organizationId: Schema.String, id: Schema.String }))
  .setPayload(UpdateCompanyRequest)
  .addSuccess(Company)
  .addError(CompanyNotFoundError)
  .addError(CompanyNameAlreadyExistsError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Update company",
    description: "Update an existing company within an organization. Only provided fields will be updated."
  }))

/**
 * Deactivate a company within an organization (soft delete)
 */
const deactivateCompany = HttpApiEndpoint.del("deactivateCompany", "/organizations/:organizationId/companies/:id")
  .setPath(Schema.Struct({ organizationId: Schema.String, id: Schema.String }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(CompanyNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Deactivate company",
    description: "Deactivate a company within an organization (soft delete). Companies with unposted entries cannot be deactivated."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * CompaniesApi - API group for company and organization management
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class CompaniesApi extends HttpApiGroup.make("companies")
  .add(listOrganizations)
  .add(getOrganization)
  .add(createOrganization)
  .add(updateOrganization)
  .add(deleteOrganization)
  .add(listCompanies)
  .add(getCompany)
  .add(createCompany)
  .add(updateCompany)
  .add(deactivateCompany)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Companies",
    description: "Manage organizations and companies. Organizations group companies together, while companies are the legal entities with their own Chart of Accounts."
  })) {}
