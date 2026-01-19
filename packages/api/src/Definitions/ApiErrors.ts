/**
 * ApiErrors - Shared error types for the HTTP API
 *
 * These error types are used across all API endpoints and include
 * HttpApiSchema annotations for proper HTTP status code mapping.
 *
 * Following the one-layer error architecture from ERROR_DESIGN.md:
 * - Most domain-specific errors are defined in packages/core/src/Errors/DomainErrors.ts
 * - This file contains only API-layer errors that serve distinct purposes:
 *   - UnauthorizedError (401) - Authentication layer concern
 *   - ForbiddenError (403) - Authorization layer concern
 *   - InternalServerError (500) - Catch-all for unexpected errors
 *   - AuditLogError (500) - Audit logging failures
 *   - UserLookupError (500) - User lookup failures during audit
 *
 * @module ApiErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

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
 * UserLookupError - User lookup failed during audit logging (500)
 *
 * Audit logs must include complete actor information for compliance.
 * If we cannot look up the user, the audit entry would be incomplete,
 * which could violate compliance requirements.
 */
export class UserLookupError extends Schema.TaggedError<UserLookupError>()(
  "UserLookupError",
  {
    userId: Schema.String.annotations({
      description: "The user ID that could not be looked up"
    }),
    cause: Schema.Defect.annotations({
      description: "The underlying cause of the lookup failure"
    })
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Failed to look up user ${this.userId} for audit log: ${String(this.cause)}`
  }
}

/**
 * Type guard for UserLookupError
 */
export const isUserLookupError = Schema.is(UserLookupError)

/**
 * Union of all API-layer error types
 *
 * Note: Domain-specific errors are defined in packages/core/src/Errors/DomainErrors.ts
 */
export type ApiError =
  | UnauthorizedError
  | ForbiddenError
  | InternalServerError
  | AuditLogError
  | UserLookupError
