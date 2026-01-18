/**
 * ApiErrors - Shared error types for the HTTP API
 *
 * These error types are used across all API endpoints and include
 * HttpApiSchema annotations for proper HTTP status code mapping.
 *
 * @module ApiErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

/**
 * NotFoundError - Resource not found (404)
 *
 * Generic not found error for any resource type.
 */
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    resource: Schema.String.annotations({
      description: "The type of resource that was not found (e.g., 'Account', 'Company')"
    }),
    id: Schema.String.annotations({
      description: "The identifier of the resource that was not found"
    })
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `${this.resource} not found: ${this.id}`
  }
}

/**
 * Type guard for NotFoundError
 */
export const isNotFoundError = Schema.is(NotFoundError)

/**
 * ValidationError - Request validation failed (400)
 *
 * Used when request data fails validation rules.
 */
export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String.annotations({
      description: "A human-readable description of the validation error"
    }),
    field: Schema.OptionFromNullOr(Schema.String).annotations({
      description: "The field that failed validation, if applicable"
    }),
    details: Schema.OptionFromNullOr(
      Schema.Array(
        Schema.Struct({
          field: Schema.String,
          message: Schema.String
        })
      )
    ).annotations({
      description: "Detailed validation errors for multiple fields"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * Type guard for ValidationError
 */
export const isValidationError = Schema.is(ValidationError)

/**
 * UnauthorizedError - Authentication required (401)
 *
 * Used when the request lacks valid authentication credentials.
 */
export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  "UnauthorizedError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Authentication required")
    )
  },
  HttpApiSchema.annotations({ status: 401 })
) {}

/**
 * Type guard for UnauthorizedError
 */
export const isUnauthorizedError = Schema.is(UnauthorizedError)

/**
 * ForbiddenError - Access denied (403)
 *
 * Used when the authenticated user lacks permission for the requested action.
 */
export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
  "ForbiddenError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "Access denied")
    ),
    resource: Schema.OptionFromNullOr(Schema.String).annotations({
      description: "The resource access was denied to"
    }),
    action: Schema.OptionFromNullOr(Schema.String).annotations({
      description: "The action that was denied"
    })
  },
  HttpApiSchema.annotations({ status: 403 })
) {}

/**
 * Type guard for ForbiddenError
 */
export const isForbiddenError = Schema.is(ForbiddenError)

/**
 * ConflictError - Resource conflict (409)
 *
 * Used when the request conflicts with the current state of the resource.
 */
export class ConflictError extends Schema.TaggedError<ConflictError>()(
  "ConflictError",
  {
    message: Schema.String.annotations({
      description: "A human-readable description of the conflict"
    }),
    resource: Schema.OptionFromNullOr(Schema.String).annotations({
      description: "The type of resource that has a conflict"
    }),
    conflictingField: Schema.OptionFromNullOr(Schema.String).annotations({
      description: "The field that caused the conflict"
    })
  },
  HttpApiSchema.annotations({ status: 409 })
) {}

/**
 * Type guard for ConflictError
 */
export const isConflictError = Schema.is(ConflictError)

/**
 * InternalServerError - Server error (500)
 *
 * Used for unexpected server-side errors.
 */
export class InternalServerError extends Schema.TaggedError<InternalServerError>()(
  "InternalServerError",
  {
    message: Schema.propertySignature(Schema.String).pipe(
      Schema.withConstructorDefault(() => "An unexpected error occurred")
    ),
    requestId: Schema.OptionFromNullOr(Schema.String).annotations({
      description: "A unique identifier for the request, useful for debugging"
    })
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

/**
 * Type guard for InternalServerError
 */
export const isInternalServerError = Schema.is(InternalServerError)

/**
 * BusinessRuleError - Business rule violation (422)
 *
 * Used when the request violates business rules (e.g., journal entry doesn't balance).
 */
export class BusinessRuleError extends Schema.TaggedError<BusinessRuleError>()(
  "BusinessRuleError",
  {
    code: Schema.String.annotations({
      description: "A machine-readable error code"
    }),
    message: Schema.String.annotations({
      description: "A human-readable description of the business rule violation"
    }),
    details: Schema.OptionFromNullOr(Schema.Unknown).annotations({
      description: "Additional details about the violation"
    })
  },
  HttpApiSchema.annotations({ status: 422 })
) {}

/**
 * Type guard for BusinessRuleError
 */
export const isBusinessRuleError = Schema.is(BusinessRuleError)

/**
 * AuditLogError - Audit logging failed (500)
 *
 * Used when an audit log operation fails. Per AUDIT_PAGE.md spec,
 * audit logging failures should NOT be silently swallowed - they
 * must propagate through the type system.
 */
export class AuditLogError extends Schema.TaggedError<AuditLogError>()(
  "AuditLogError",
  {
    operation: Schema.String.annotations({
      description: "The audit operation that failed (e.g., 'logCreate', 'logUpdate')"
    }),
    cause: Schema.Defect.annotations({
      description: "The underlying cause of the failure"
    })
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Audit log error during ${this.operation}: ${String(this.cause)}`
  }
}

/**
 * Type guard for AuditLogError
 */
export const isAuditLogError = Schema.is(AuditLogError)

/**
 * Union of all API error types
 */
export type ApiError =
  | NotFoundError
  | ValidationError
  | UnauthorizedError
  | ForbiddenError
  | ConflictError
  | InternalServerError
  | BusinessRuleError
  | AuditLogError
