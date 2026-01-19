/**
 * OrganizationRepository - Repository interface for Organization entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module OrganizationRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { Organization, OrganizationId } from "@accountability/core/organization/Organization"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * OrganizationRepositoryService - Service interface for Organization persistence
 *
 * Provides CRUD operations for Organization entities with typed error handling.
 */
export interface OrganizationRepositoryService {
  /**
   * Find an organization by its unique identifier
   *
   * @param id - The organization ID to search for
   * @returns Effect containing Option of Organization (None if not found)
   */
  readonly findById: (
    id: OrganizationId
  ) => Effect.Effect<Option.Option<Organization>, PersistenceError>

  /**
   * Find all organizations
   *
   * @returns Effect containing array of organizations
   */
  readonly findAll: () => Effect.Effect<ReadonlyArray<Organization>, PersistenceError>

  /**
   * Create a new organization
   *
   * @param organization - The organization entity to create
   * @returns Effect containing the created organization
   */
  readonly create: (
    organization: Organization
  ) => Effect.Effect<Organization, PersistenceError>

  /**
   * Update an existing organization
   *
   * @param organization - The organization entity with updated values
   * @returns Effect containing the updated organization
   * @throws EntityNotFoundError if organization doesn't exist
   */
  readonly update: (
    organization: Organization
  ) => Effect.Effect<Organization, EntityNotFoundError | PersistenceError>

  /**
   * Delete an organization by ID
   *
   * @param id - The organization ID to delete
   * @returns Effect that completes when deleted
   * @throws EntityNotFoundError if organization doesn't exist
   */
  readonly delete: (
    id: OrganizationId
  ) => Effect.Effect<void, EntityNotFoundError | PersistenceError>

  /**
   * Find an organization by its unique identifier, throwing if not found
   *
   * @param id - The organization ID to search for
   * @returns Effect containing the Organization
   * @throws EntityNotFoundError if organization doesn't exist
   */
  readonly getById: (
    id: OrganizationId
  ) => Effect.Effect<Organization, EntityNotFoundError | PersistenceError>

  /**
   * Check if an organization exists
   *
   * @param id - The organization ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    id: OrganizationId
  ) => Effect.Effect<boolean, PersistenceError>
}

/**
 * OrganizationRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { OrganizationRepository } from "@accountability/persistence/Services/OrganizationRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* OrganizationRepository
 *   const org = yield* repo.findById(orgId)
 *   // ...
 * })
 * ```
 */
export class OrganizationRepository extends Context.Tag("OrganizationRepository")<
  OrganizationRepository,
  OrganizationRepositoryService
>() {}
