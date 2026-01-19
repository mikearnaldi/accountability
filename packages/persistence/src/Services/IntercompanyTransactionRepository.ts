/**
 * IntercompanyTransactionRepository - Repository interface for IntercompanyTransaction entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module IntercompanyTransactionRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type {
  IntercompanyTransaction,
  IntercompanyTransactionId,
  IntercompanyTransactionType,
  MatchingStatus
} from "@accountability/core/consolidation/IntercompanyTransaction"
import type { CompanyId } from "@accountability/core/company/Company"
import type { JournalEntryId } from "@accountability/core/journal/JournalEntry"
import type { LocalDate } from "@accountability/core/shared/values/LocalDate"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * IntercompanyTransactionRepositoryService - Service interface for IntercompanyTransaction persistence
 *
 * Provides CRUD operations for IntercompanyTransaction entities with typed error handling.
 */
export interface IntercompanyTransactionRepositoryService {
  /**
   * Find an intercompany transaction by its unique identifier
   *
   * @param id - The transaction ID to search for
   * @returns Effect containing Option of IntercompanyTransaction (None if not found)
   */
  readonly findById: (
    id: IntercompanyTransactionId
  ) => Effect.Effect<Option.Option<IntercompanyTransaction>, PersistenceError>

  /**
   * Find an intercompany transaction by its unique identifier, throwing if not found
   *
   * @param id - The transaction ID to search for
   * @returns Effect containing the IntercompanyTransaction
   * @throws EntityNotFoundError if transaction doesn't exist
   */
  readonly getById: (
    id: IntercompanyTransactionId
  ) => Effect.Effect<IntercompanyTransaction, EntityNotFoundError | PersistenceError>

  /**
   * Create a new intercompany transaction
   *
   * @param transaction - The transaction entity to create
   * @returns Effect containing the created transaction
   */
  readonly create: (
    transaction: IntercompanyTransaction
  ) => Effect.Effect<IntercompanyTransaction, PersistenceError>

  /**
   * Update an existing intercompany transaction
   *
   * @param transaction - The transaction entity with updated values
   * @returns Effect containing the updated transaction
   * @throws EntityNotFoundError if transaction doesn't exist
   */
  readonly update: (
    transaction: IntercompanyTransaction
  ) => Effect.Effect<IntercompanyTransaction, EntityNotFoundError | PersistenceError>

  /**
   * Delete an intercompany transaction
   *
   * @param id - The transaction ID to delete
   * @returns Effect that completes when deleted
   * @throws EntityNotFoundError if transaction doesn't exist
   */
  readonly delete: (
    id: IntercompanyTransactionId
  ) => Effect.Effect<void, EntityNotFoundError | PersistenceError>

  /**
   * Find all transactions where a company is the "from" (seller/lender) party
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of transactions
   */
  readonly findByFromCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find all transactions where a company is the "to" (buyer/borrower) party
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of transactions
   */
  readonly findByToCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find all transactions involving a company (either as from or to party)
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of transactions
   */
  readonly findByCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find transactions between two specific companies
   *
   * @param fromCompanyId - The "from" company ID
   * @param toCompanyId - The "to" company ID
   * @returns Effect containing array of transactions
   */
  readonly findBetweenCompanies: (
    fromCompanyId: CompanyId,
    toCompanyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find transactions by matching status
   *
   * @param status - The matching status to filter by
   * @returns Effect containing array of transactions
   */
  readonly findByMatchingStatus: (
    status: MatchingStatus
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find transactions by transaction type
   *
   * @param transactionType - The transaction type to filter by
   * @returns Effect containing array of transactions
   */
  readonly findByTransactionType: (
    transactionType: IntercompanyTransactionType
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find transactions within a date range
   *
   * @param startDate - The start date (inclusive)
   * @param endDate - The end date (inclusive)
   * @returns Effect containing array of transactions
   */
  readonly findByDateRange: (
    startDate: LocalDate,
    endDate: LocalDate
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find unmatched transactions for reconciliation
   *
   * @returns Effect containing array of unmatched transactions
   */
  readonly findUnmatched: () => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find transactions linked to a journal entry
   *
   * @param journalEntryId - The journal entry ID to search by
   * @returns Effect containing array of transactions
   */
  readonly findByJournalEntry: (
    journalEntryId: JournalEntryId
  ) => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Find transactions that require elimination during consolidation
   * (status is Matched or VarianceApproved)
   *
   * @returns Effect containing array of transactions requiring elimination
   */
  readonly findRequiringElimination: () => Effect.Effect<ReadonlyArray<IntercompanyTransaction>, PersistenceError>

  /**
   * Check if an intercompany transaction exists
   *
   * @param id - The transaction ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    id: IntercompanyTransactionId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Update the matching status of a transaction
   *
   * @param id - The transaction ID
   * @param status - The new matching status
   * @returns Effect containing the updated transaction
   * @throws EntityNotFoundError if transaction doesn't exist
   */
  readonly updateMatchingStatus: (
    id: IntercompanyTransactionId,
    status: MatchingStatus
  ) => Effect.Effect<IntercompanyTransaction, EntityNotFoundError | PersistenceError>

  /**
   * Link a journal entry to the "from" side of the transaction
   *
   * @param id - The transaction ID
   * @param journalEntryId - The journal entry ID to link
   * @returns Effect containing the updated transaction
   * @throws EntityNotFoundError if transaction doesn't exist
   */
  readonly linkFromJournalEntry: (
    id: IntercompanyTransactionId,
    journalEntryId: JournalEntryId
  ) => Effect.Effect<IntercompanyTransaction, EntityNotFoundError | PersistenceError>

  /**
   * Link a journal entry to the "to" side of the transaction
   *
   * @param id - The transaction ID
   * @param journalEntryId - The journal entry ID to link
   * @returns Effect containing the updated transaction
   * @throws EntityNotFoundError if transaction doesn't exist
   */
  readonly linkToJournalEntry: (
    id: IntercompanyTransactionId,
    journalEntryId: JournalEntryId
  ) => Effect.Effect<IntercompanyTransaction, EntityNotFoundError | PersistenceError>
}

/**
 * IntercompanyTransactionRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { IntercompanyTransactionRepository } from "@accountability/persistence/Services/IntercompanyTransactionRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* IntercompanyTransactionRepository
 *   const transaction = yield* repo.findById(transactionId)
 *   // ...
 * })
 * ```
 */
export class IntercompanyTransactionRepository extends Context.Tag("IntercompanyTransactionRepository")<
  IntercompanyTransactionRepository,
  IntercompanyTransactionRepositoryService
>() {}
