/**
 * RepositoryError - Typed errors for repository operations
 *
 * All repository operations return Effect with typed errors for proper
 * error handling and type safety throughout the application.
 *
 * @module RepositoryError
 */

import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

/**
 * EntityNotFoundError - Error when an entity is not found by ID
 *
 * Generic error for any entity lookup that returns no results.
 */
export class EntityNotFoundError extends Schema.TaggedError<EntityNotFoundError>()(
  "EntityNotFoundError",
  {
    entityType: Schema.String,
    entityId: Schema.String
  }
) {
  get message(): string {
    return `${this.entityType} not found: ${this.entityId}`
  }
}

/**
 * Type guard for EntityNotFoundError
 */
export const isEntityNotFoundError = Schema.is(EntityNotFoundError)

/**
 * DuplicateEntityError - Error when attempting to create a duplicate entity
 */
export class DuplicateEntityError extends Schema.TaggedError<DuplicateEntityError>()(
  "DuplicateEntityError",
  {
    entityType: Schema.String,
    entityId: Schema.String,
    conflictField: Schema.OptionFromNullOr(Schema.String)
  }
) {
  get message(): string {
    const conflict = this.conflictField._tag === "Some"
      ? ` on field '${this.conflictField.value}'`
      : ""
    return `Duplicate ${this.entityType}${conflict}: ${this.entityId}`
  }
}

/**
 * Type guard for DuplicateEntityError
 */
export const isDuplicateEntityError = Schema.is(DuplicateEntityError)

/**
 * PersistenceError - Generic persistence layer error
 *
 * Used to wrap underlying database errors while preserving the cause.
 */
export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  {
    operation: Schema.String,
    cause: Schema.Defect
  }
) {
  get message(): string {
    return `Persistence error during ${this.operation}: ${String(this.cause)}`
  }
}

/**
 * Type guard for PersistenceError
 */
export const isPersistenceError = Schema.is(PersistenceError)

/**
 * ValidationError - Error when entity validation fails
 */
export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    entityType: Schema.String,
    field: Schema.String,
    message: Schema.String
  }
) {
  get formattedMessage(): string {
    return `Validation failed for ${this.entityType}.${this.field}: ${this.message}`
  }
}

/**
 * Type guard for ValidationError
 */
export const isValidationError = Schema.is(ValidationError)

/**
 * ConcurrencyError - Error when optimistic locking fails
 */
export class ConcurrencyError extends Schema.TaggedError<ConcurrencyError>()(
  "ConcurrencyError",
  {
    entityType: Schema.String,
    entityId: Schema.String
  }
) {
  get message(): string {
    return `Concurrency conflict on ${this.entityType}: ${this.entityId} was modified by another process`
  }
}

/**
 * Type guard for ConcurrencyError
 */
export const isConcurrencyError = Schema.is(ConcurrencyError)

/**
 * Union type for all repository errors
 */
export type RepositoryError =
  | EntityNotFoundError
  | DuplicateEntityError
  | PersistenceError
  | ValidationError
  | ConcurrencyError

/**
 * Wrap SQL errors in PersistenceError
 *
 * Uses Effect.mapError to only transform expected errors, not defects.
 * This is the correct approach - defects (bugs) should propagate and crash,
 * while expected SQL errors get wrapped for proper error handling.
 *
 * @param operation - The name of the operation for error context
 * @returns A function that wraps the effect's error in PersistenceError
 *
 * @example
 * ```typescript
 * const findById = (id: string) =>
 *   sql`SELECT * FROM accounts WHERE id = ${id}`.pipe(
 *     wrapSqlError("findById")
 *   )
 * ```
 */
export const wrapSqlError =
  (operation: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> =>
    Effect.mapError(effect, (cause) => new PersistenceError({ operation, cause }))
