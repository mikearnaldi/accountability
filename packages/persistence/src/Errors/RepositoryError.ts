/**
 * RepositoryError - Typed errors for repository operations
 *
 * All repository operations return Effect with typed errors for proper
 * error handling and type safety throughout the application.
 *
 * @module RepositoryError
 */

import { HttpApiSchema } from "@effect/platform"
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
  },
  HttpApiSchema.annotations({ status: 404 })
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
 * PersistenceError - Generic persistence layer error
 *
 * Used to wrap underlying database errors while preserving the cause.
 */
export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  {
    operation: Schema.String,
    cause: Schema.Defect
  },
  HttpApiSchema.annotations({ status: 500 })
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
 * Union type for all repository errors
 */
export type RepositoryError =
  | EntityNotFoundError
  | PersistenceError

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
