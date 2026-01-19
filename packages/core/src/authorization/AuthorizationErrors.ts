/**
 * AuthorizationErrors - Domain errors for Authorization domain
 *
 * These errors are used for policy and permission operations
 * and include HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * Note: Core authorization errors are defined in Auth/AuthorizationErrors.ts and
 * re-exported here for the new import path. Policy-specific errors are defined
 * directly in this file.
 *
 * @module authorization/AuthorizationErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404) - Defined here
// =============================================================================

/**
 * PolicyNotFoundError - Policy does not exist
 */
export class PolicyNotFoundError extends Schema.TaggedError<PolicyNotFoundError>()(
  "PolicyNotFoundError",
  {
    policyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Policy not found: ${this.policyId}`
  }
}

export const isPolicyNotFoundError = Schema.is(PolicyNotFoundError)

// =============================================================================
// Validation Errors (400) - Defined here
// =============================================================================

/**
 * InvalidPolicyIdError - Invalid policy ID format
 */
export class InvalidPolicyIdError extends Schema.TaggedError<InvalidPolicyIdError>()(
  "InvalidPolicyIdError",
  {
    value: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid policy ID format: ${this.value}`
  }
}

export const isInvalidPolicyIdError = Schema.is(InvalidPolicyIdError)

/**
 * InvalidPolicyConditionError - Invalid policy condition
 */
export class InvalidPolicyConditionError extends Schema.TaggedError<InvalidPolicyConditionError>()(
  "InvalidPolicyConditionError",
  {
    condition: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid policy condition '${this.condition}': ${this.reason}`
  }
}

export const isInvalidPolicyConditionError = Schema.is(InvalidPolicyConditionError)

/**
 * PolicyPriorityValidationError - Policy priority is out of valid range
 */
export class PolicyPriorityValidationError extends Schema.TaggedError<PolicyPriorityValidationError>()(
  "PolicyPriorityValidationError",
  {
    priority: Schema.Number,
    maxAllowed: Schema.Number
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Custom policy priority must be between 0 and ${this.maxAllowed}, got ${this.priority}`
  }
}

export const isPolicyPriorityValidationError = Schema.is(PolicyPriorityValidationError)

/**
 * InvalidResourceTypeError - Invalid resource type for policy testing
 */
export class InvalidResourceTypeError extends Schema.TaggedError<InvalidResourceTypeError>()(
  "InvalidResourceTypeError",
  {
    resourceType: Schema.String,
    validTypes: Schema.Array(Schema.String)
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid resource type: ${this.resourceType}. Valid types: ${this.validTypes.join(", ")}`
  }
}

export const isInvalidResourceTypeError = Schema.is(InvalidResourceTypeError)

// =============================================================================
// Conflict Errors (409) - Defined here
// =============================================================================

/**
 * PolicyAlreadyExistsError - Policy with same name already exists
 */
export class PolicyAlreadyExistsError extends Schema.TaggedError<PolicyAlreadyExistsError>()(
  "PolicyAlreadyExistsError",
  {
    name: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Policy with name '${this.name}' already exists`
  }
}

export const isPolicyAlreadyExistsError = Schema.is(PolicyAlreadyExistsError)

/**
 * SystemPolicyCannotBeModifiedError - System policies cannot be modified or deleted
 */
export class SystemPolicyCannotBeModifiedError extends Schema.TaggedError<SystemPolicyCannotBeModifiedError>()(
  "SystemPolicyCannotBeModifiedError",
  {
    policyId: Schema.String,
    operation: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `System policy ${this.policyId} cannot be ${this.operation}`
  }
}

export const isSystemPolicyCannotBeModifiedError = Schema.is(SystemPolicyCannotBeModifiedError)

// =============================================================================
// Re-exports from Auth/AuthorizationErrors.ts
// =============================================================================

export {
  // Permission errors
  PermissionDeniedError,
  isPermissionDeniedError,

  // Policy errors
  PolicyLoadError,
  isPolicyLoadError,
  AuthorizationAuditError,
  isAuthorizationAuditError,

  // Error types and status codes
  type AuthorizationError,
  AUTHORIZATION_ERROR_STATUS_CODES
} from "../Auth/AuthorizationErrors.ts"
