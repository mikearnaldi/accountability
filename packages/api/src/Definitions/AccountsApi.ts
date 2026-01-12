/**
 * AccountsApi - HTTP API group for account management
 *
 * Provides endpoints for CRUD operations on accounts in the Chart of Accounts.
 *
 * @module AccountsApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  Account,
  AccountCategory,
  AccountId,
  AccountType,
  CashFlowCategory,
  NormalBalance
} from "@accountability/core/Domains/Account"
import { AccountNumber } from "@accountability/core/Domains/AccountNumber"
import { CompanyId } from "@accountability/core/Domains/Company"
import { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * CreateAccountRequest - Request body for creating a new account
 */
export class CreateAccountRequest extends Schema.Class<CreateAccountRequest>("CreateAccountRequest")({
  companyId: CompanyId,
  accountNumber: AccountNumber,
  name: Schema.NonEmptyTrimmedString,
  description: Schema.OptionFromNullOr(Schema.String),
  accountType: AccountType,
  accountCategory: AccountCategory,
  normalBalance: NormalBalance,
  parentAccountId: Schema.OptionFromNullOr(AccountId),
  isPostable: Schema.Boolean,
  isCashFlowRelevant: Schema.Boolean,
  cashFlowCategory: Schema.OptionFromNullOr(CashFlowCategory),
  isIntercompany: Schema.Boolean,
  intercompanyPartnerId: Schema.OptionFromNullOr(CompanyId),
  currencyRestriction: Schema.OptionFromNullOr(CurrencyCode)
}) {}

/**
 * UpdateAccountRequest - Request body for updating an existing account
 *
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateAccountRequest extends Schema.Class<UpdateAccountRequest>("UpdateAccountRequest")({
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  description: Schema.OptionFromNullOr(Schema.String),
  parentAccountId: Schema.OptionFromNullOr(AccountId),
  isPostable: Schema.OptionFromNullOr(Schema.Boolean),
  isCashFlowRelevant: Schema.OptionFromNullOr(Schema.Boolean),
  cashFlowCategory: Schema.OptionFromNullOr(CashFlowCategory),
  isIntercompany: Schema.OptionFromNullOr(Schema.Boolean),
  intercompanyPartnerId: Schema.OptionFromNullOr(CompanyId),
  currencyRestriction: Schema.OptionFromNullOr(CurrencyCode),
  isActive: Schema.OptionFromNullOr(Schema.Boolean)
}) {}

/**
 * AccountListResponse - Response containing a list of accounts
 */
export class AccountListResponse extends Schema.Class<AccountListResponse>("AccountListResponse")({
  accounts: Schema.Array(Account),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Query parameters for listing accounts
 * Uses domain types directly - HttpApi handles automatic decoding
 */
export const AccountListParams = Schema.Struct({
  companyId: CompanyId,
  accountType: Schema.optional(AccountType),
  accountCategory: Schema.optional(AccountCategory),
  isActive: Schema.optional(Schema.BooleanFromString),
  isPostable: Schema.optional(Schema.BooleanFromString),
  parentAccountId: Schema.optional(AccountId),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

/**
 * Type for AccountListParams
 */
export type AccountListParams = typeof AccountListParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List all accounts for a company
 */
const listAccounts = HttpApiEndpoint.get("listAccounts", "/")
  .setUrlParams(AccountListParams)
  .addSuccess(AccountListResponse)
  .addError(NotFoundError)
  .addError(ValidationError)
  .annotateContext(OpenApi.annotations({
    summary: "List accounts",
    description: "Retrieve a paginated list of accounts for a company. Supports filtering by account type, category, status, and parent account."
  }))

/**
 * Get a single account by ID
 */
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))
  .addSuccess(Account)
  .addError(NotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get account",
    description: "Retrieve a single account by its unique identifier."
  }))

/**
 * Create a new account
 */
const createAccount = HttpApiEndpoint.post("createAccount", "/")
  .setPayload(CreateAccountRequest)
  .addSuccess(Account, { status: 201 })
  .addError(ValidationError)
  .addError(ConflictError)
  .addError(BusinessRuleError)
  .annotateContext(OpenApi.annotations({
    summary: "Create account",
    description: "Create a new account in the Chart of Accounts. The account number must be unique within the company."
  }))

/**
 * Update an existing account
 */
const updateAccount = HttpApiEndpoint.put("updateAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))
  .setPayload(UpdateAccountRequest)
  .addSuccess(Account)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(ConflictError)
  .addError(BusinessRuleError)
  .annotateContext(OpenApi.annotations({
    summary: "Update account",
    description: "Update an existing account. Only provided fields will be updated. Account type and category cannot be changed after creation."
  }))

/**
 * Deactivate an account (soft delete)
 */
const deactivateAccount = HttpApiEndpoint.del("deactivateAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .annotateContext(OpenApi.annotations({
    summary: "Deactivate account",
    description: "Deactivate an account (soft delete). Accounts with posted transactions cannot be deactivated."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * AccountsApi - API group for account management
 *
 * Base path: /api/v1/accounts
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class AccountsApi extends HttpApiGroup.make("accounts")
  .add(listAccounts)
  .add(getAccount)
  .add(createAccount)
  .add(updateAccount)
  .add(deactivateAccount)
  .middleware(AuthMiddleware)
  .prefix("/v1/accounts")
  .annotateContext(OpenApi.annotations({
    title: "Accounts",
    description: "Manage the Chart of Accounts. Accounts are hierarchical and support multiple account types (Asset, Liability, Equity, Revenue, Expense)."
  })) {}
