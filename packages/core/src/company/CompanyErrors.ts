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

// =============================================================================
// Conflict Errors (409)
// =============================================================================

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
