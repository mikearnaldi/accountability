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
} from "@accountability/core/consolidation/ConsolidationGroup"
import type {
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationRunStatus
} from "@accountability/core/consolidation/ConsolidationRun"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import type { ConsolidationDataCorruptionError } from "@accountability/core/consolidation/ConsolidationService"
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
   * Find a consolidation group by its unique identifier within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The consolidation group ID to search for
   * @returns Effect containing Option of ConsolidationGroup (None if not found or not in org)
   */
  readonly findGroup: (
    organizationId: OrganizationId,
    id: ConsolidationGroupId
  ) => Effect.Effect<Option.Option<ConsolidationGroup>, PersistenceError>

  /**
   * Find a consolidation group by its unique identifier, throwing if not found
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The consolidation group ID to search for
   * @returns Effect containing the ConsolidationGroup
   * @throws EntityNotFoundError if group doesn't exist or not in org
   */
  readonly getGroup: (
    organizationId: OrganizationId,
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
   * Update an existing consolidation group within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param group - The consolidation group entity with updated values
   * @returns Effect containing the updated consolidation group
   * @throws EntityNotFoundError if group doesn't exist or not in org
   */
  readonly updateGroup: (
    organizationId: OrganizationId,
    group: ConsolidationGroup
  ) => Effect.Effect<ConsolidationGroup, EntityNotFoundError | PersistenceError>

  /**
   * Check if a consolidation group exists within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The consolidation group ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly groupExists: (
    organizationId: OrganizationId,
    id: ConsolidationGroupId
  ) => Effect.Effect<boolean, PersistenceError>

  // =========================================================================
  // ConsolidationRun Operations
  // =========================================================================

  /**
   * Find a consolidation run by its unique identifier within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The consolidation run ID to search for
   * @returns Effect containing Option of ConsolidationRun (None if not found or not in org)
   */
  readonly findRun: (
    organizationId: OrganizationId,
    id: ConsolidationRunId
  ) => Effect.Effect<Option.Option<ConsolidationRun>, PersistenceError | ConsolidationDataCorruptionError>

  /**
   * Find a consolidation run by its unique identifier, throwing if not found
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The consolidation run ID to search for
   * @returns Effect containing the ConsolidationRun
   * @throws EntityNotFoundError if run doesn't exist or not in org
   */
  readonly getRun: (
    organizationId: OrganizationId,
    id: ConsolidationRunId
  ) => Effect.Effect<ConsolidationRun, EntityNotFoundError | PersistenceError | ConsolidationDataCorruptionError>

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
   * Update an existing consolidation run within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param run - The consolidation run entity with updated values
   * @returns Effect containing the updated consolidation run
   * @throws EntityNotFoundError if run doesn't exist or not in org
   */
  readonly updateRun: (
    organizationId: OrganizationId,
    run: ConsolidationRun
  ) => Effect.Effect<ConsolidationRun, EntityNotFoundError | PersistenceError>

  /**
   * Find all consolidation runs for a group within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param groupId - The consolidation group ID to filter by
   * @returns Effect containing array of consolidation runs ordered by date descending
   */
  readonly findRunsByGroup: (
    organizationId: OrganizationId,
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError | ConsolidationDataCorruptionError>

  /**
   * Find consolidation run for a specific group and period within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param groupId - The consolidation group ID
   * @param period - The fiscal period reference
   * @returns Effect containing Option of ConsolidationRun
   */
  readonly findRunByGroupAndPeriod: (
    organizationId: OrganizationId,
    groupId: ConsolidationGroupId,
    period: FiscalPeriodRef
  ) => Effect.Effect<Option.Option<ConsolidationRun>, PersistenceError | ConsolidationDataCorruptionError>

  /**
   * Find consolidation runs by status within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param groupId - The consolidation group ID to filter by
   * @param status - The run status to filter by
   * @returns Effect containing array of consolidation runs
   */
  readonly findRunsByStatus: (
    organizationId: OrganizationId,
    groupId: ConsolidationGroupId,
    status: ConsolidationRunStatus
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError | ConsolidationDataCorruptionError>

  /**
   * Find the latest completed consolidation run for a group within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param groupId - The consolidation group ID
   * @returns Effect containing Option of the latest completed ConsolidationRun
   */
  readonly findLatestCompletedRun: (
    organizationId: OrganizationId,
    groupId: ConsolidationGroupId
  ) => Effect.Effect<Option.Option<ConsolidationRun>, PersistenceError | ConsolidationDataCorruptionError>

  /**
   * Find all in-progress consolidation runs for a group within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param groupId - The consolidation group ID
   * @returns Effect containing array of in-progress consolidation runs
   */
  readonly findInProgressRuns: (
    organizationId: OrganizationId,
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError | ConsolidationDataCorruptionError>

  /**
   * Find consolidation runs within a period range for a group within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param groupId - The consolidation group ID
   * @param startPeriod - The start fiscal period (inclusive)
   * @param endPeriod - The end fiscal period (inclusive)
   * @returns Effect containing array of consolidation runs
   */
  readonly findRunsByPeriodRange: (
    organizationId: OrganizationId,
    groupId: ConsolidationGroupId,
    startPeriod: FiscalPeriodRef,
    endPeriod: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<ConsolidationRun>, PersistenceError | ConsolidationDataCorruptionError>

  /**
   * Check if a consolidation run exists within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The consolidation run ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly runExists: (
    organizationId: OrganizationId,
    id: ConsolidationRunId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Delete a consolidation run within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The consolidation run ID to delete
   * @returns Effect indicating success
   * @throws EntityNotFoundError if run doesn't exist or not in org
   */
  readonly deleteRun: (
    organizationId: OrganizationId,
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
