/**
 * ConsolidationRepository - Repository interface for ConsolidationGroup and ConsolidationRun persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module ConsolidationRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type {
  ConsolidationGroup,
  ConsolidationGroupId
} from "@accountability/core/Domains/ConsolidationGroup"
import type {
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationRunStatus
} from "@accountability/core/Domains/ConsolidationRun"
import type { OrganizationId } from "@accountability/core/Domains/Organization"
import type { FiscalPeriodRef } from "@accountability/core/Domains/FiscalPeriodRef"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * ConsolidationRepository - Service interface for ConsolidationGroup and ConsolidationRun persistence
 *
 * Provides CRUD operations for consolidation entities with typed error handling.
 */
export interface ConsolidationRepositoryService {
  // =========================================================================
  // ConsolidationGroup Operations
  // =========================================================================

  /**
   * Find a consolidation group by its unique identifier
   *
   * @param id - The consolidation group ID to search for
   * @returns Effect containing Option of ConsolidationGroup (None if not found)
   */
  readonly findGroup: (
    id: ConsolidationGroupId
  ) => Effect.Effect<Option.Option<ConsolidationGroup>, PersistenceError>

  /**
   * Find a consolidation group by its unique identifier, throwing if not found
   *
   * @param id - The consolidation group ID to search for
   * @returns Effect containing the ConsolidationGroup
   * @throws EntityNotFoundError if group doesn't exist
   */
  readonly getGroup: (
    id: ConsolidationGroupId
  ) => Effect.Effect<ConsolidationGroup, EntityNotFoundError | PersistenceError>

  /**
   * Find all consolidation groups for an organization
   *
   * @param organizationId - The organization ID to filter by
   * @returns Effect containing array of consolidation groups
   */
  readonly findGroupsByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<ConsolidationGroup>, PersistenceError>

  /**
   * Find active consolidation groups for an organization
   *
   * @param organizationId - The organization ID to filter by
   * @returns Effect containing array of active consolidation groups
   */
  readonly findActiveGroups: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<ConsolidationGroup>, PersistenceError>

  /**
   * Create a new consolidation group
   *
   * @param group - The consolidation group entity to create
   * @returns Effect containing the created consolidation group
   */
  readonly createGroup: (
    group: ConsolidationGroup
  ) => Effect.Effect<ConsolidationGroup, PersistenceError>

  /**
   * Update an existing consolidation group
   *
   * @param group - The consolidation group entity with updated values
   * @returns Effect containing the updated consolidation group
   * @throws EntityNotFoundError if group doesn't exist
   */
  readonly updateGroup: (
    group: ConsolidationGroup
  ) => Effect.Effect<ConsolidationGroup, EntityNotFoundError | PersistenceError>

  /**
   * Check if a consolidation group exists
   *
   * @param id - The consolidation group ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly groupExists: (
    id: ConsolidationGroupId
  ) => Effect.Effect<boolean, PersistenceError>

  // =========================================================================
  // ConsolidationRun Operations
  // =========================================================================

  /**
   * Find a consolidation run by its unique identifier
   *
   * @param id - The consolidation run ID to search for
   * @returns Effect containing Option of ConsolidationRun (None if not found)
   */
  readonly findRun: (
    id: ConsolidationRunId
  ) => Effect.Effect<Option.Option<ConsolidationRun>, PersistenceError>

  /**
   * Find a consolidation run by its unique identifier, throwing if not found
   *
   * @param id - The consolidation run ID to search for
   * @returns Effect containing the ConsolidationRun
   * @throws EntityNotFoundError if run doesn't exist
   */
  readonly getRun: (
    id: ConsolidationRunId
  ) => Effect.Effect<ConsolidationRun, EntityNotFoundError | PersistenceError>

  /**
   * Create a new consolidation run
   *
   * @param run - The consolidation run entity to create
   * @returns Effect containing the created consolidation run
   */
  readonly createRun: (
    run: ConsolidationRun
  ) => Effect.Effect<ConsolidationRun, PersistenceError>

  /**
   * Update an existing consolidation run
   *
   * @param run - The consolidation run entity with updated values
   * @returns Effect containing the updated consolidation run
   * @throws EntityNotFoundError if run doesn't exist
   */
  readonly updateRun: (
    run: ConsolidationRun
  ) => Effect.Effect<ConsolidationRun, EntityNotFoundError | PersistenceError>

  /**
   * Find all consolidation runs for a group
   *
   * @param groupId - The consolidation group ID to filter by
   * @returns Effect containing array of consolidation runs ordered by date descending
   */
  readonly findRunsByGroup: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError>

  /**
   * Find consolidation run for a specific group and period
   *
   * @param groupId - The consolidation group ID
   * @param period - The fiscal period reference
   * @returns Effect containing Option of ConsolidationRun
   */
  readonly findRunByGroupAndPeriod: (
    groupId: ConsolidationGroupId,
    period: FiscalPeriodRef
  ) => Effect.Effect<Option.Option<ConsolidationRun>, PersistenceError>

  /**
   * Find consolidation runs by status
   *
   * @param groupId - The consolidation group ID to filter by
   * @param status - The run status to filter by
   * @returns Effect containing array of consolidation runs
   */
  readonly findRunsByStatus: (
    groupId: ConsolidationGroupId,
    status: ConsolidationRunStatus
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError>

  /**
   * Find the latest completed consolidation run for a group
   *
   * @param groupId - The consolidation group ID
   * @returns Effect containing Option of the latest completed ConsolidationRun
   */
  readonly findLatestCompletedRun: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<Option.Option<ConsolidationRun>, PersistenceError>

  /**
   * Find all in-progress consolidation runs for a group
   *
   * @param groupId - The consolidation group ID
   * @returns Effect containing array of in-progress consolidation runs
   */
  readonly findInProgressRuns: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError>

  /**
   * Find consolidation runs within a period range
   *
   * @param groupId - The consolidation group ID
   * @param startPeriod - The start fiscal period (inclusive)
   * @param endPeriod - The end fiscal period (inclusive)
   * @returns Effect containing array of consolidation runs
   */
  readonly findRunsByPeriodRange: (
    groupId: ConsolidationGroupId,
    startPeriod: FiscalPeriodRef,
    endPeriod: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError>

  /**
   * Check if a consolidation run exists
   *
   * @param id - The consolidation run ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly runExists: (
    id: ConsolidationRunId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Delete a consolidation run
   *
   * @param id - The consolidation run ID to delete
   * @returns Effect indicating success
   * @throws EntityNotFoundError if run doesn't exist
   */
  readonly deleteRun: (
    id: ConsolidationRunId
  ) => Effect.Effect<void, EntityNotFoundError | PersistenceError>
}

/**
 * ConsolidationRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { ConsolidationRepository } from "@accountability/persistence/Services/ConsolidationRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* ConsolidationRepository
 *   const group = yield* repo.findGroup(groupId)
 *   const run = yield* repo.createRun(consolidationRun)
 *   // ...
 * })
 * ```
 */
export class ConsolidationRepository extends Context.Tag("ConsolidationRepository")<
  ConsolidationRepository,
  ConsolidationRepositoryService
>() {}
