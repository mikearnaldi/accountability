/**
 * JournalEntryRepository - Repository interface for JournalEntry entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module JournalEntryRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type {
  JournalEntry,
  JournalEntryId,
  JournalEntryStatus,
  JournalEntryType
} from "@accountability/core/domain/JournalEntry"
import type { CompanyId } from "@accountability/core/domain/Company"
import type { FiscalPeriodRef } from "@accountability/core/domain/FiscalPeriodRef"
import type { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * JournalEntryRepository - Service interface for JournalEntry persistence
 *
 * Provides CRUD operations for JournalEntry entities with typed error handling.
 */
export interface JournalEntryRepositoryService {
  /**
   * Find a journal entry by its unique identifier
   *
   * @param id - The journal entry ID to search for
   * @returns Effect containing Option of JournalEntry (None if not found)
   */
  readonly findById: (
    id: JournalEntryId
  ) => Effect.Effect<Option.Option<JournalEntry>, PersistenceError>

  /**
   * Find all journal entries belonging to a company
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of journal entries
   */
  readonly findByCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find all journal entries within a specific fiscal period
   *
   * @param companyId - The company ID to filter by
   * @param period - The fiscal period reference (year and period)
   * @returns Effect containing array of journal entries
   */
  readonly findByPeriod: (
    companyId: CompanyId,
    period: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Create a new journal entry
   *
   * @param entry - The journal entry entity to create
   * @returns Effect containing the created journal entry
   */
  readonly create: (
    entry: JournalEntry
  ) => Effect.Effect<JournalEntry, PersistenceError>

  /**
   * Update an existing journal entry
   *
   * @param entry - The journal entry entity with updated values
   * @returns Effect containing the updated journal entry
   * @throws EntityNotFoundError if entry doesn't exist
   */
  readonly update: (
    entry: JournalEntry
  ) => Effect.Effect<JournalEntry, EntityNotFoundError | PersistenceError>

  /**
   * Find a journal entry by its unique identifier, throwing if not found
   *
   * @param id - The journal entry ID to search for
   * @returns Effect containing the JournalEntry
   * @throws EntityNotFoundError if entry doesn't exist
   */
  readonly getById: (
    id: JournalEntryId
  ) => Effect.Effect<JournalEntry, EntityNotFoundError | PersistenceError>

  /**
   * Find journal entries by status within a company
   *
   * @param companyId - The company ID to filter by
   * @param status - The status to filter by
   * @returns Effect containing array of journal entries
   */
  readonly findByStatus: (
    companyId: CompanyId,
    status: JournalEntryStatus
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find journal entries by type within a company
   *
   * @param companyId - The company ID to filter by
   * @param entryType - The entry type to filter by
   * @returns Effect containing array of journal entries
   */
  readonly findByType: (
    companyId: CompanyId,
    entryType: JournalEntryType
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find journal entries within a date range
   *
   * @param companyId - The company ID to filter by
   * @param startPeriod - The start fiscal period (inclusive)
   * @param endPeriod - The end fiscal period (inclusive)
   * @returns Effect containing array of journal entries
   */
  readonly findByPeriodRange: (
    companyId: CompanyId,
    startPeriod: FiscalPeriodRef,
    endPeriod: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find draft journal entries for a company
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of draft journal entries
   */
  readonly findDraftEntries: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find posted journal entries for a company in a period
   *
   * @param companyId - The company ID to filter by
   * @param period - The fiscal period reference
   * @returns Effect containing array of posted journal entries
   */
  readonly findPostedByPeriod: (
    companyId: CompanyId,
    period: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find the reversing entry for a given journal entry
   *
   * @param entryId - The journal entry ID that was reversed
   * @returns Effect containing Option of the reversing entry
   */
  readonly findReversingEntry: (
    entryId: JournalEntryId
  ) => Effect.Effect<Option.Option<JournalEntry>, PersistenceError>

  /**
   * Count draft entries in a specific fiscal period
   *
   * @param companyId - The company ID to filter by
   * @param period - The fiscal period reference
   * @returns Effect containing the count of draft entries
   */
  readonly countDraftEntriesInPeriod: (
    companyId: CompanyId,
    period: FiscalPeriodRef
  ) => Effect.Effect<number, PersistenceError>

  /**
   * Find intercompany journal entries for a company
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of intercompany journal entries
   */
  readonly findIntercompanyEntries: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Check if a journal entry exists
   *
   * @param id - The journal entry ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    id: JournalEntryId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Get the next entry number for a company
   *
   * @param companyId - The company ID to get next number for
   * @returns Effect containing the next entry number string
   */
  readonly getNextEntryNumber: (
    companyId: CompanyId
  ) => Effect.Effect<string, PersistenceError>
}

/**
 * JournalEntryRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { JournalEntryRepository } from "@accountability/persistence"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* JournalEntryRepository
 *   const entry = yield* repo.findById(entryId)
 *   // ...
 * })
 * ```
 */
export class JournalEntryRepository extends Context.Tag("JournalEntryRepository")<
  JournalEntryRepository,
  JournalEntryRepositoryService
>() {}
