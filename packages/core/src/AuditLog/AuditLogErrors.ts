/**
 * AuditLogErrors - Error types for audit logging operations
 *
 * Defines typed errors for audit log operations using Schema.TaggedError
 * for proper error handling throughout the application.
 *
 * @module AuditLogErrors
 */

import * as Schema from "effect/Schema"

/**
 * AuditLogError - Error when an audit log operation fails
 *
 * Used to wrap underlying persistence errors while preserving context.
 */
export class AuditLogError extends Schema.TaggedError<AuditLogError>()(
  "AuditLogError",
  {
    operation: Schema.String,
    cause: Schema.Defect
  }
) {
  get message(): string {
    return `Audit log error during ${this.operation}: ${String(this.cause)}`
  }
}

/**
 * Type guard for AuditLogError
 */
export const isAuditLogError = Schema.is(AuditLogError)
