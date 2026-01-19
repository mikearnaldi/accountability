/**
 * EliminationRuleRepository - Repository interface for EliminationRule entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module EliminationRuleRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type {
  EliminationRule,
  EliminationType
} from "@accountability/core/consolidation/EliminationRule"
import type {
  ConsolidationGroupId,
  EliminationRuleId
} from "@accountability/core/consolidation/ConsolidationGroup"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * EliminationRuleRepositoryService - Service interface for EliminationRule persistence
 *
 * Provides CRUD operations for EliminationRule entities with typed error handling.
 */
export interface EliminationRuleRepositoryService {
  /**
   * Find an elimination rule by its unique identifier
   *
   * @param id - The rule ID to search for
   * @returns Effect containing Option of EliminationRule (None if not found)
   */
  readonly findById: (
    id: EliminationRuleId
  ) => Effect.Effect<Option.Option<EliminationRule>, PersistenceError>

  /**
   * Find an elimination rule by its unique identifier, throwing if not found
   *
   * @param id - The rule ID to search for
   * @returns Effect containing the EliminationRule
   * @throws EntityNotFoundError if rule doesn't exist
   */
  readonly getById: (
    id: EliminationRuleId
  ) => Effect.Effect<EliminationRule, EntityNotFoundError | PersistenceError>

  /**
   * Create a new elimination rule
   *
   * @param rule - The rule entity to create
   * @returns Effect containing the created rule
   */
  readonly create: (
    rule: EliminationRule
  ) => Effect.Effect<EliminationRule, PersistenceError>

  /**
   * Update an existing elimination rule
   *
   * @param rule - The rule entity with updated values
   * @returns Effect containing the updated rule
   * @throws EntityNotFoundError if rule doesn't exist
   */
  readonly update: (
    rule: EliminationRule
  ) => Effect.Effect<EliminationRule, EntityNotFoundError | PersistenceError>

  /**
   * Delete an elimination rule
   *
   * @param id - The rule ID to delete
   * @returns Effect that completes when deleted
   * @throws EntityNotFoundError if rule doesn't exist
   */
  readonly delete: (
    id: EliminationRuleId
  ) => Effect.Effect<void, EntityNotFoundError | PersistenceError>

  /**
   * Find all elimination rules for a consolidation group
   *
   * @param groupId - The consolidation group ID to filter by
   * @returns Effect containing array of rules ordered by priority
   */
  readonly findByConsolidationGroup: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<EliminationRule>, PersistenceError>

  /**
   * Find active elimination rules for a consolidation group
   *
   * @param groupId - The consolidation group ID to filter by
   * @returns Effect containing array of active rules ordered by priority
   */
  readonly findActiveByConsolidationGroup: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<EliminationRule>, PersistenceError>

  /**
   * Find automatic elimination rules for a consolidation group
   *
   * @param groupId - The consolidation group ID to filter by
   * @returns Effect containing array of automatic rules ordered by priority
   */
  readonly findAutomaticByConsolidationGroup: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<EliminationRule>, PersistenceError>

  /**
   * Find elimination rules by type for a consolidation group
   *
   * @param groupId - The consolidation group ID to filter by
   * @param eliminationType - The elimination type to filter by
   * @returns Effect containing array of rules ordered by priority
   */
  readonly findByType: (
    groupId: ConsolidationGroupId,
    eliminationType: EliminationType
  ) => Effect.Effect<ReadonlyArray<EliminationRule>, PersistenceError>

  /**
   * Find high priority rules (priority <= 10) for a consolidation group
   *
   * @param groupId - The consolidation group ID to filter by
   * @returns Effect containing array of high priority rules
   */
  readonly findHighPriority: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<ReadonlyArray<EliminationRule>, PersistenceError>

  /**
   * Check if an elimination rule exists
   *
   * @param id - The rule ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    id: EliminationRuleId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Activate an elimination rule
   *
   * @param id - The rule ID to activate
   * @returns Effect containing the updated rule
   * @throws EntityNotFoundError if rule doesn't exist
   */
  readonly activate: (
    id: EliminationRuleId
  ) => Effect.Effect<EliminationRule, EntityNotFoundError | PersistenceError>

  /**
   * Deactivate an elimination rule
   *
   * @param id - The rule ID to deactivate
   * @returns Effect containing the updated rule
   * @throws EntityNotFoundError if rule doesn't exist
   */
  readonly deactivate: (
    id: EliminationRuleId
  ) => Effect.Effect<EliminationRule, EntityNotFoundError | PersistenceError>

  /**
   * Update the priority of an elimination rule
   *
   * @param id - The rule ID
   * @param priority - The new priority value (lower executes first)
   * @returns Effect containing the updated rule
   * @throws EntityNotFoundError if rule doesn't exist
   */
  readonly updatePriority: (
    id: EliminationRuleId,
    priority: number
  ) => Effect.Effect<EliminationRule, EntityNotFoundError | PersistenceError>

  /**
   * Batch create multiple elimination rules
   *
   * @param rules - Array of rules to create
   * @returns Effect containing array of created rules
   */
  readonly createMany: (
    rules: ReadonlyArray<EliminationRule>
  ) => Effect.Effect<ReadonlyArray<EliminationRule>, PersistenceError>
}

/**
 * EliminationRuleRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { EliminationRuleRepository } from "@accountability/persistence/Services/EliminationRuleRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* EliminationRuleRepository
 *   const rules = yield* repo.findByConsolidationGroup(groupId)
 *   // ...
 * })
 * ```
 */
export class EliminationRuleRepository extends Context.Tag("EliminationRuleRepository")<
  EliminationRuleRepository,
  EliminationRuleRepositoryService
>() {}
