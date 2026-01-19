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
} from "@accountability/core/journal/JournalEntry"
import type { CompanyId } from "@accountability/core/company/Company"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * JournalEntryRepository - Service interface for JournalEntry persistence
 *
 * Provides CRUD operations for JournalEntry entities with typed error handling.
 */
export interface JournalEntryRepositoryService {
  /**
   * Find a journal entry by its unique identifier within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The journal entry ID to search for
   * @returns Effect containing Option of JournalEntry (None if not found or not in org)
   */
  readonly findById: (
    organizationId: OrganizationId,
    id: JournalEntryId
  ) => Effect.Effect<Option.Option<JournalEntry>, PersistenceError>

  /**
   * Find all journal entries belonging to a company within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of journal entries
   */
  readonly findByCompany: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find all journal entries within a specific fiscal period
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param period - The fiscal period reference (year and period)
   * @returns Effect containing array of journal entries
   */
  readonly findByPeriod: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    period: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Create a new journal entry (company must belong to organization)
   *
   * @param entry - The journal entry entity to create
   * @returns Effect containing the created journal entry
   */
  readonly create: (
    entry: JournalEntry
  ) => Effect.Effect<JournalEntry, PersistenceError>

  /**
   * Update an existing journal entry within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param entry - The journal entry entity with updated values
   * @returns Effect containing the updated journal entry
   * @throws EntityNotFoundError if entry doesn't exist or not in org
   */
  readonly update: (
    organizationId: OrganizationId,
    entry: JournalEntry
  ) => Effect.Effect<JournalEntry, EntityNotFoundError | PersistenceError>

  /**
   * Find a journal entry by its unique identifier, throwing if not found
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The journal entry ID to search for
   * @returns Effect containing the JournalEntry
   * @throws EntityNotFoundError if entry doesn't exist or not in org
   */
  readonly getById: (
    organizationId: OrganizationId,
    id: JournalEntryId
  ) => Effect.Effect<JournalEntry, EntityNotFoundError | PersistenceError>

  /**
   * Find journal entries by status within a company/organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param status - The status to filter by
   * @returns Effect containing array of journal entries
   */
  readonly findByStatus: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    status: JournalEntryStatus
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find journal entries by type within a company/organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param entryType - The entry type to filter by
   * @returns Effect containing array of journal entries
   */
  readonly findByType: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    entryType: JournalEntryType
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find journal entries within a date range
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param startPeriod - The start fiscal period (inclusive)
   * @param endPeriod - The end fiscal period (inclusive)
   * @returns Effect containing array of journal entries
   */
  readonly findByPeriodRange: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    startPeriod: FiscalPeriodRef,
    endPeriod: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find draft journal entries for a company within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of draft journal entries
   */
  readonly findDraftEntries: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find posted journal entries for a company in a period
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param period - The fiscal period reference
   * @returns Effect containing array of posted journal entries
   */
  readonly findPostedByPeriod: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    period: FiscalPeriodRef
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Find the reversing entry for a given journal entry within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param entryId - The journal entry ID that was reversed
   * @returns Effect containing Option of the reversing entry
   */
  readonly findReversingEntry: (
    organizationId: OrganizationId,
    entryId: JournalEntryId
  ) => Effect.Effect<Option.Option<JournalEntry>, PersistenceError>

  /**
   * Count draft entries in a specific fiscal period within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @param period - The fiscal period reference
   * @returns Effect containing the count of draft entries
   */
  readonly countDraftEntriesInPeriod: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    period: FiscalPeriodRef
  ) => Effect.Effect<number, PersistenceError>

  /**
   * Find intercompany journal entries for a company within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of intercompany journal entries
   */
  readonly findIntercompanyEntries: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntry>, PersistenceError>

  /**
   * Check if a journal entry exists within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param id - The journal entry ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    organizationId: OrganizationId,
    id: JournalEntryId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Get the next entry number for a company within an organization
   *
   * @param organizationId - The organization ID for authorization
   * @param companyId - The company ID to get next number for
   * @returns Effect containing the next entry number string
   */
  readonly getNextEntryNumber: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<string, PersistenceError>
}

/**
 * JournalEntryRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { JournalEntryRepository } from "@accountability/persistence/Services/JournalEntryRepository"
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
