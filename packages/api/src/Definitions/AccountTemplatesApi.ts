/**
 * AccountTemplatesApi - HTTP API group for account template master data
 *
 * Provides endpoints to list and apply chart of accounts templates.
 * Templates are predefined sets of accounts for different business types:
 * - GeneralBusiness: Standard commercial entities
 * - Manufacturing: Includes inventory and COGS detail
 * - ServiceBusiness: Service revenue focused
 * - HoldingCompany: Investment and intercompany focused
 *
 * @module AccountTemplatesApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  TemplateType,
  type AccountTemplate,
  type TemplateAccountDefinition
} from "@accountability/core/accounting/AccountTemplate"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import { AccountsAlreadyExistError } from "@accountability/core/accounting/AccountErrors"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { AuditLogError, ForbiddenError, UserLookupError } from "./ApiErrors.ts"

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * AccountTemplateItem - Summary information about a template for list response
 */
export class AccountTemplateItem extends Schema.Class<AccountTemplateItem>("AccountTemplateItem")({
  templateType: TemplateType,
  name: Schema.NonEmptyTrimmedString,
  description: Schema.String,
  accountCount: Schema.Number
}) {
  /**
   * Create an AccountTemplateItem from an AccountTemplate entity
   */
  static fromTemplate(template: AccountTemplate): AccountTemplateItem {
    return AccountTemplateItem.make({
      templateType: template.templateType,
      name: template.name,
      description: template.description,
      accountCount: template.accountCount
    })
  }
}

/**
 * TemplateAccountItem - Account definition within a template for detail response
 */
export class TemplateAccountItem extends Schema.Class<TemplateAccountItem>("TemplateAccountItem")({
  accountNumber: Schema.String,
  name: Schema.NonEmptyTrimmedString,
  description: Schema.OptionFromNullOr(Schema.String),
  accountType: Schema.String,
  accountCategory: Schema.String,
  normalBalance: Schema.OptionFromNullOr(Schema.String),
  parentAccountNumber: Schema.OptionFromNullOr(Schema.String),
  isPostable: Schema.Boolean,
  isCashFlowRelevant: Schema.Boolean,
  cashFlowCategory: Schema.OptionFromNullOr(Schema.String),
  isIntercompany: Schema.Boolean
}) {
  /**
   * Create a TemplateAccountItem from a TemplateAccountDefinition
   */
  static fromDefinition(def: TemplateAccountDefinition): TemplateAccountItem {
    return TemplateAccountItem.make({
      accountNumber: def.accountNumber,
      name: def.name,
      description: def.description,
      accountType: def.accountType,
      accountCategory: def.accountCategory,
      normalBalance: def.normalBalance,
      parentAccountNumber: def.parentAccountNumber,
      isPostable: def.isPostable,
      isCashFlowRelevant: def.isCashFlowRelevant,
      cashFlowCategory: def.cashFlowCategory,
      isIntercompany: def.isIntercompany
    })
  }
}

/**
 * AccountTemplateListResponse - Response containing a list of available templates
 */
export class AccountTemplateListResponse extends Schema.Class<AccountTemplateListResponse>("AccountTemplateListResponse")({
  templates: Schema.Array(AccountTemplateItem)
}) {}

/**
 * AccountTemplateDetailResponse - Response containing a template with all account definitions
 */
export class AccountTemplateDetailResponse extends Schema.Class<AccountTemplateDetailResponse>("AccountTemplateDetailResponse")({
  template: Schema.Struct({
    templateType: TemplateType,
    name: Schema.NonEmptyTrimmedString,
    description: Schema.String,
    accounts: Schema.Array(TemplateAccountItem)
  })
}) {}

/**
 * ApplyTemplateRequest - Request body for applying a template to a company
 */
export class ApplyTemplateRequest extends Schema.Class<ApplyTemplateRequest>("ApplyTemplateRequest")({
  organizationId: Schema.UUID,
  companyId: Schema.UUID
}) {}

/**
 * ApplyTemplateResponse - Response after applying a template
 */
export class ApplyTemplateResponse extends Schema.Class<ApplyTemplateResponse>("ApplyTemplateResponse")({
  createdCount: Schema.Number,
  companyId: Schema.UUID,
  templateType: TemplateType
}) {}

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List all available account templates
 *
 * Returns summary information about each template including account count.
 */
const listTemplates = HttpApiEndpoint.get("listAccountTemplates", "/")
  .addSuccess(AccountTemplateListResponse)
  .annotateContext(OpenApi.annotations({
    summary: "List account templates",
    description: "Retrieve a list of available chart of accounts templates. Each template is designed for a specific business type and includes a predefined set of accounts."
  }))

/**
 * Get a specific template with all account definitions
 *
 * Returns the complete template including all account definitions.
 */
const getTemplate = HttpApiEndpoint.get("getAccountTemplate", "/:type")
  .setPath(Schema.Struct({ type: TemplateType }))
  .addSuccess(AccountTemplateDetailResponse)
  .annotateContext(OpenApi.annotations({
    summary: "Get account template",
    description: "Retrieve a specific account template with all its account definitions. The type parameter must be one of: GeneralBusiness, Manufacturing, ServiceBusiness, HoldingCompany."
  }))

/**
 * Apply a template to a company
 *
 * Creates all accounts from the template for the specified company.
 */
const applyTemplate = HttpApiEndpoint.post("applyAccountTemplate", "/:type/apply")
  .setPath(Schema.Struct({ type: TemplateType }))
  .setPayload(ApplyTemplateRequest)
  .addSuccess(ApplyTemplateResponse)
  .addError(OrganizationNotFoundError)
  .addError(CompanyNotFoundError)
  .addError(AccountsAlreadyExistError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Apply account template",
    description: "Apply an account template to a company, creating all accounts defined in the template. The company must exist and should not already have accounts from a template. Requires account:create permission."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * AccountTemplatesApi - API group for account template master data
 *
 * Base path: /api/v1/account-templates
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class AccountTemplatesApi extends HttpApiGroup.make("accountTemplates")
  .add(listTemplates)
  .add(getTemplate)
  .add(applyTemplate)
  .middleware(AuthMiddleware)
  .prefix("/v1/account-templates")
  .annotateContext(OpenApi.annotations({
    title: "Account Templates",
    description: "Chart of accounts templates for different business types. Templates provide predefined account structures that can be applied to companies to quickly set up their chart of accounts."
  })) {}
