/**
 * CompanyErrors - Domain errors for Company domain
 *
 * These errors are used for Company-related operations and include
 * HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * @module company/CompanyErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404)
// =============================================================================

/**
 * CompanyNotFoundError - Company does not exist
 */
export class CompanyNotFoundError extends Schema.TaggedError<CompanyNotFoundError>()(
  "CompanyNotFoundError",
  {
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Company not found: ${this.companyId}`
  }
}

export const isCompanyNotFoundError = Schema.is(CompanyNotFoundError)

/**
 * ParentCompanyNotFoundError - Parent company reference not found
 */
export class ParentCompanyNotFoundError extends Schema.TaggedError<ParentCompanyNotFoundError>()(
  "ParentCompanyNotFoundError",
  {
    parentCompanyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Parent company not found: ${this.parentCompanyId}`
  }
}

export const isParentCompanyNotFoundError = Schema.is(ParentCompanyNotFoundError)

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * InvalidCompanyIdError - Invalid company ID format
 */
export class InvalidCompanyIdError extends Schema.TaggedError<InvalidCompanyIdError>()(
  "InvalidCompanyIdError",
  {
    value: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid company ID format: ${this.value}`
  }
}

export const isInvalidCompanyIdError = Schema.is(InvalidCompanyIdError)

/**
 * OwnershipPercentageRequiredError - Ownership percentage required for subsidiaries
 */
export class OwnershipPercentageRequiredError extends Schema.TaggedError<OwnershipPercentageRequiredError>()(
  "OwnershipPercentageRequiredError",
  {},
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return "Ownership percentage is required for subsidiaries"
  }
}

export const isOwnershipPercentageRequiredError = Schema.is(OwnershipPercentageRequiredError)

// =============================================================================
// Conflict Errors (409)
// =============================================================================

/**
 * CircularCompanyReferenceError - Circular reference in company hierarchy
 */
export class CircularCompanyReferenceError extends Schema.TaggedError<CircularCompanyReferenceError>()(
  "CircularCompanyReferenceError",
  {
    companyId: Schema.String,
    parentCompanyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Circular reference: setting ${this.parentCompanyId} as parent of ${this.companyId} would create a cycle`
  }
}

export const isCircularCompanyReferenceError = Schema.is(CircularCompanyReferenceError)

/**
 * CompanyNameAlreadyExistsError - Company name already exists in this organization
 */
export class CompanyNameAlreadyExistsError extends Schema.TaggedError<CompanyNameAlreadyExistsError>()(
  "CompanyNameAlreadyExistsError",
  {
    companyName: Schema.String,
    organizationId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Company with name '${this.companyName}' already exists in this organization`
  }
}

export const isCompanyNameAlreadyExistsError = Schema.is(CompanyNameAlreadyExistsError)

/**
 * HasActiveSubsidiariesError - Cannot deactivate company with active subsidiaries
 */
export class HasActiveSubsidiariesError extends Schema.TaggedError<HasActiveSubsidiariesError>()(
  "HasActiveSubsidiariesError",
  {
    companyId: Schema.String,
    subsidiaryCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot deactivate company with ${this.subsidiaryCount} active subsidiaries`
  }
}

export const isHasActiveSubsidiariesError = Schema.is(HasActiveSubsidiariesError)
