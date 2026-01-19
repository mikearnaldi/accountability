/**
 * AccountErrors - Domain errors for Accounting domain
 *
 * These errors are used for Account-related operations and include
 * HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * @module accounting/AccountErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404)
// =============================================================================

/**
 * AccountNotFoundError - Account does not exist
 */
export class AccountNotFoundError extends Schema.TaggedError<AccountNotFoundError>()(
  "AccountNotFoundError",
  {
    accountId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Account not found: ${this.accountId}`
  }
}

export const isAccountNotFoundError = Schema.is(AccountNotFoundError)

/**
 * ParentAccountNotFoundError - Parent account reference does not exist
 */
export class ParentAccountNotFoundError extends Schema.TaggedError<ParentAccountNotFoundError>()(
  "ParentAccountNotFoundError",
  {
    parentAccountId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Parent account not found: ${this.parentAccountId}`
  }
}

export const isParentAccountNotFoundError = Schema.is(ParentAccountNotFoundError)

/**
 * AccountTemplateNotFoundError - Account template does not exist
 */
export class AccountTemplateNotFoundError extends Schema.TaggedError<AccountTemplateNotFoundError>()(
  "AccountTemplateNotFoundError",
  {
    templateType: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Account template not found: ${this.templateType}`
  }
}

export const isAccountTemplateNotFoundError = Schema.is(AccountTemplateNotFoundError)

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * ParentAccountDifferentCompanyError - Parent account must be in the same company
 */
export class ParentAccountDifferentCompanyError extends Schema.TaggedError<ParentAccountDifferentCompanyError>()(
  "ParentAccountDifferentCompanyError",
  {
    accountCompanyId: Schema.String,
    parentAccountCompanyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return "Parent account must be in the same company"
  }
}

export const isParentAccountDifferentCompanyError = Schema.is(ParentAccountDifferentCompanyError)

// =============================================================================
// Conflict Errors (409)
// =============================================================================

/**
 * HasActiveChildAccountsError - Cannot deactivate account with active child accounts
 */
export class HasActiveChildAccountsError extends Schema.TaggedError<HasActiveChildAccountsError>()(
  "HasActiveChildAccountsError",
  {
    accountId: Schema.String,
    childCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot deactivate account with ${this.childCount} active child accounts`
  }
}

export const isHasActiveChildAccountsError = Schema.is(HasActiveChildAccountsError)

/**
 * AccountNumberAlreadyExistsError - Account number already exists in this company
 */
export class AccountNumberAlreadyExistsError extends Schema.TaggedError<AccountNumberAlreadyExistsError>()(
  "AccountNumberAlreadyExistsError",
  {
    accountNumber: Schema.String,
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Account number ${this.accountNumber} already exists in this company`
  }
}

export const isAccountNumberAlreadyExistsError = Schema.is(AccountNumberAlreadyExistsError)

/**
 * CircularAccountReferenceError - Circular reference in account hierarchy
 */
export class CircularAccountReferenceError extends Schema.TaggedError<CircularAccountReferenceError>()(
  "CircularAccountReferenceError",
  {
    accountId: Schema.String,
    parentAccountId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Circular reference: setting ${this.parentAccountId} as parent of ${this.accountId} would create a cycle`
  }
}

export const isCircularAccountReferenceError = Schema.is(CircularAccountReferenceError)

/**
 * AccountsAlreadyExistError - Company already has accounts (cannot apply template)
 */
export class AccountsAlreadyExistError extends Schema.TaggedError<AccountsAlreadyExistError>()(
  "AccountsAlreadyExistError",
  {
    companyId: Schema.String,
    accountCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Company already has ${this.accountCount} accounts. Cannot apply template to a company with existing accounts.`
  }
}

export const isAccountsAlreadyExistError = Schema.is(AccountsAlreadyExistError)
