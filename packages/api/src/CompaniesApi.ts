/**
 * CompaniesApi - HTTP API group for company management
 *
 * Provides endpoints for CRUD operations on companies and organizations.
 *
 * @module CompaniesApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  Company,
  CompanyId,
  ConsolidationMethod,
  FiscalYearEnd
} from "@accountability/core/domain/Company"
import { Organization, OrganizationId, OrganizationSettings } from "@accountability/core/domain/Organization"
import { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/domain/JurisdictionCode"
import { Percentage } from "@accountability/core/domain/Percentage"
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"

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
  functionalCurrency: CurrencyCode,
  reportingCurrency: CurrencyCode,
  fiscalYearEnd: FiscalYearEnd,
  parentCompanyId: Schema.OptionFromNullOr(CompanyId),
  ownershipPercentage: Schema.OptionFromNullOr(Percentage),
  consolidationMethod: Schema.OptionFromNullOr(ConsolidationMethod)
}) {}

/**
 * UpdateCompanyRequest - Request body for updating a company
 */
export class UpdateCompanyRequest extends Schema.Class<UpdateCompanyRequest>("UpdateCompanyRequest")({
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  legalName: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  taxId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  reportingCurrency: Schema.OptionFromNullOr(CurrencyCode),
  fiscalYearEnd: Schema.OptionFromNullOr(FiscalYearEnd),
  parentCompanyId: Schema.OptionFromNullOr(CompanyId),
  ownershipPercentage: Schema.OptionFromNullOr(Percentage),
  consolidationMethod: Schema.OptionFromNullOr(ConsolidationMethod),
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
  parentCompanyId: Schema.optional(Schema.String),
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

/**
 * Get a single organization by ID
 */
const getOrganization = HttpApiEndpoint.get("getOrganization", "/organizations/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .addSuccess(Organization)
  .addError(NotFoundError)

/**
 * Create a new organization
 */
const createOrganization = HttpApiEndpoint.post("createOrganization", "/organizations")
  .setPayload(CreateOrganizationRequest)
  .addSuccess(Organization, { status: 201 })
  .addError(ValidationError)
  .addError(ConflictError)

/**
 * Update an existing organization
 */
const updateOrganization = HttpApiEndpoint.put("updateOrganization", "/organizations/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .setPayload(UpdateOrganizationRequest)
  .addSuccess(Organization)
  .addError(NotFoundError)
  .addError(ValidationError)

/**
 * Delete an organization (only if no companies exist)
 */
const deleteOrganization = HttpApiEndpoint.del("deleteOrganization", "/organizations/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

// =============================================================================
// Company API Endpoints
// =============================================================================

/**
 * List all companies
 */
const listCompanies = HttpApiEndpoint.get("listCompanies", "/companies")
  .setUrlParams(CompanyListParams)
  .addSuccess(CompanyListResponse)
  .addError(NotFoundError)
  .addError(ValidationError)

/**
 * Get a single company by ID
 */
const getCompany = HttpApiEndpoint.get("getCompany", "/companies/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .addSuccess(Company)
  .addError(NotFoundError)

/**
 * Create a new company
 */
const createCompany = HttpApiEndpoint.post("createCompany", "/companies")
  .setPayload(CreateCompanyRequest)
  .addSuccess(Company, { status: 201 })
  .addError(ValidationError)
  .addError(ConflictError)
  .addError(BusinessRuleError)

/**
 * Update an existing company
 */
const updateCompany = HttpApiEndpoint.put("updateCompany", "/companies/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .setPayload(UpdateCompanyRequest)
  .addSuccess(Company)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(ConflictError)
  .addError(BusinessRuleError)

/**
 * Deactivate a company (soft delete)
 */
const deactivateCompany = HttpApiEndpoint.del("deactivateCompany", "/companies/:id")
  .setPath(Schema.Struct({ id: Schema.String }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

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
  .prefix("/v1") {}
