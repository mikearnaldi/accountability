/**
 * JournalEntryLineRepository - Repository interface for JournalEntryLine entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module JournalEntryLineRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type {
  JournalEntryLine,
  JournalEntryLineId
} from "@accountability/core/journal/JournalEntryLine"
import type { JournalEntryId } from "@accountability/core/journal/JournalEntry"
import type { AccountId } from "@accountability/core/accounting/Account"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * JournalEntryLineRepository - Service interface for JournalEntryLine persistence
 *
 * Provides CRUD operations for JournalEntryLine entities with typed error handling.
 */
export interface JournalEntryLineRepositoryService {
  /**
   * Find all lines for a journal entry
   *
   * @param journalEntryId - The journal entry ID to get lines for
   * @returns Effect containing array of journal entry lines sorted by line number
   */
  readonly findByJournalEntry: (
    journalEntryId: JournalEntryId
  ) => Effect.Effect<ReadonlyArray<JournalEntryLine>, PersistenceError>

  /**
   * Find all lines for multiple journal entries
   *
   * @param journalEntryIds - The journal entry IDs to get lines for
   * @returns Effect containing a Map of journal entry ID to its lines
   */
  readonly findByJournalEntries: (
    journalEntryIds: ReadonlyArray<JournalEntryId>
  ) => Effect.Effect<ReadonlyMap<JournalEntryId, ReadonlyArray<JournalEntryLine>>, PersistenceError>

  /**
   * Create multiple journal entry lines
   *
   * @param lines - The journal entry lines to create
   * @returns Effect containing the created lines
   */
  readonly createMany: (
    lines: ReadonlyArray<JournalEntryLine>
  ) => Effect.Effect<ReadonlyArray<JournalEntryLine>, PersistenceError>

  /**
   * Delete all lines for a journal entry
   *
   * @param journalEntryId - The journal entry ID to delete lines for
   * @returns Effect containing void
   */
  readonly deleteByJournalEntry: (
    journalEntryId: JournalEntryId
  ) => Effect.Effect<void, PersistenceError>

  /**
   * Find lines by account ID (for balance queries)
   *
   * @param accountId - The account ID to find lines for
   * @returns Effect containing array of journal entry lines
   */
  readonly findByAccount: (
    accountId: AccountId
  ) => Effect.Effect<ReadonlyArray<JournalEntryLine>, PersistenceError>

  /**
   * Find a specific line by ID
   *
   * @param lineId - The line ID to find
   * @returns Effect containing the line or fails with EntityNotFoundError
   */
  readonly getById: (
    lineId: JournalEntryLineId
  ) => Effect.Effect<JournalEntryLine, EntityNotFoundError | PersistenceError>

  /**
   * Update multiple journal entry lines
   *
   * @param lines - The journal entry lines to update
   * @returns Effect containing the updated lines
   */
  readonly updateMany: (
    lines: ReadonlyArray<JournalEntryLine>
  ) => Effect.Effect<ReadonlyArray<JournalEntryLine>, EntityNotFoundError | PersistenceError>
}

/**
 * JournalEntryLineRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { JournalEntryLineRepository } from "@accountability/persistence/Services/JournalEntryLineRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* JournalEntryLineRepository
 *   const lines = yield* repo.findByJournalEntry(entryId)
 *   // ...
 * })
 * ```
 */
export class JournalEntryLineRepository extends Context.Tag("JournalEntryLineRepository")<
  JournalEntryLineRepository,
  JournalEntryLineRepositoryService
>() {}
