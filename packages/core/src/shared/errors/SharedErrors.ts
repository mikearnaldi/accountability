/**
 * SharedErrors - Cross-domain shared errors
 *
 * These errors are used across multiple domains and don't belong
 * to any specific domain. They include HttpApiSchema annotations
 * for automatic HTTP status code mapping.
 *
 * @module shared/errors/SharedErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Internal Errors (500)
// =============================================================================

/**
 * DataCorruptionError - Data integrity violation detected
 */
export class DataCorruptionError extends Schema.TaggedError<DataCorruptionError>()(
  "DataCorruptionError",
  {
    entityType: Schema.String,
    entityId: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Data corruption detected for ${this.entityType} ${this.entityId}: ${this.reason}`
  }
}

export const isDataCorruptionError = Schema.is(DataCorruptionError)

/**
 * OperationFailedError - Generic operation failure (when specific error doesn't exist)
 */
export class OperationFailedError extends Schema.TaggedError<OperationFailedError>()(
  "OperationFailedError",
  {
    operation: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Operation '${this.operation}' failed: ${this.reason}`
  }
}

export const isOperationFailedError = Schema.is(OperationFailedError)
