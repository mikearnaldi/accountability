/**
 * RepositoryError - Typed errors for repository operations
 *
 * All repository operations return Effect with typed errors for proper
 * error handling and type safety throughout the application.
 *
 * These error types are defined in core to avoid circular dependencies
 * between core and persistence packages.
 *
 * @module shared/errors/RepositoryError
 */

import { HttpApiSchema } from "@effect/platform"
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
