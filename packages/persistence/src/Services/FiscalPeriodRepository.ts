/**
 * FiscalPeriodRepository - Repository interface for FiscalYear and FiscalPeriod persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * IMPORTANT: All methods require companyId for authorization enforcement.
 * This ensures data isolation - users can only access fiscal periods within their organization's companies.
 *
 * @module FiscalPeriodRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { CompanyId } from "@accountability/core/company/Company"
import type { FiscalYear, FiscalYearId } from "@accountability/core/fiscal/FiscalYear"
import type { FiscalPeriod, FiscalPeriodId, PeriodReopenAuditEntry } from "@accountability/core/fiscal/FiscalPeriod"
import type { FiscalPeriodStatus } from "@accountability/core/fiscal/FiscalPeriodStatus"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * FiscalPeriodRepositoryService - Service interface for FiscalYear and FiscalPeriod persistence
 *
 * Provides CRUD operations for FiscalYear and FiscalPeriod entities with typed error handling.
 * All methods require companyId to enforce data isolation.
 */
export interface FiscalPeriodRepositoryService {
  // ==================== FiscalYear Operations ====================

  /**
   * Find a fiscal year by its unique identifier
   *
   * @param companyId - The company ID for authorization
   * @param id - The fiscal year ID to search for
   * @returns Effect containing Option of FiscalYear (None if not found or not in company)
   */
  readonly findFiscalYearById: (
    companyId: CompanyId,
    id: FiscalYearId
  ) => Effect.Effect<Option.Option<FiscalYear>, PersistenceError>

  /**
   * Get a fiscal year by its unique identifier, throwing if not found
   *
   * @param companyId - The company ID for authorization
   * @param id - The fiscal year ID to search for
   * @returns Effect containing the FiscalYear
   * @throws EntityNotFoundError if fiscal year doesn't exist or not in company
   */
  readonly getFiscalYearById: (
    companyId: CompanyId,
    id: FiscalYearId
  ) => Effect.Effect<FiscalYear, EntityNotFoundError | PersistenceError>

  /**
   * Find a fiscal year by year number for a company
   *
   * @param companyId - The company ID
   * @param year - The fiscal year number (e.g., 2025)
   * @returns Effect containing Option of FiscalYear
   */
  readonly findFiscalYearByNumber: (
    companyId: CompanyId,
    year: number
  ) => Effect.Effect<Option.Option<FiscalYear>, PersistenceError>

  /**
   * Find all fiscal years for a company
   *
   * @param companyId - The company ID
   * @returns Effect containing array of fiscal years ordered by year desc
   */
  readonly findFiscalYearsByCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<FiscalYear>, PersistenceError>

  /**
   * Create a new fiscal year
   *
   * @param fiscalYear - The fiscal year entity to create
   * @returns Effect containing the created fiscal year
   */
  readonly createFiscalYear: (
    fiscalYear: FiscalYear
  ) => Effect.Effect<FiscalYear, PersistenceError>

  /**
   * Update an existing fiscal year
   *
   * @param companyId - The company ID for authorization
   * @param fiscalYear - The fiscal year entity with updated values
   * @returns Effect containing the updated fiscal year
   * @throws EntityNotFoundError if fiscal year doesn't exist or not in company
   */
  readonly updateFiscalYear: (
    companyId: CompanyId,
    fiscalYear: FiscalYear
  ) => Effect.Effect<FiscalYear, EntityNotFoundError | PersistenceError>

  // ==================== FiscalPeriod Operations ====================

  /**
   * Find a fiscal period by its unique identifier
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param id - The fiscal period ID to search for
   * @returns Effect containing Option of FiscalPeriod (None if not found or not in fiscal year)
   */
  readonly findPeriodById: (
    fiscalYearId: FiscalYearId,
    id: FiscalPeriodId
  ) => Effect.Effect<Option.Option<FiscalPeriod>, PersistenceError>

  /**
   * Get a fiscal period by its unique identifier, throwing if not found
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param id - The fiscal period ID to search for
   * @returns Effect containing the FiscalPeriod
   * @throws EntityNotFoundError if fiscal period doesn't exist or not in fiscal year
   */
  readonly getPeriodById: (
    fiscalYearId: FiscalYearId,
    id: FiscalPeriodId
  ) => Effect.Effect<FiscalPeriod, EntityNotFoundError | PersistenceError>

  /**
   * Find a fiscal period by period number within a fiscal year
   *
   * @param fiscalYearId - The fiscal year ID
   * @param periodNumber - The period number (1-13)
   * @returns Effect containing Option of FiscalPeriod
   */
  readonly findPeriodByNumber: (
    fiscalYearId: FiscalYearId,
    periodNumber: number
  ) => Effect.Effect<Option.Option<FiscalPeriod>, PersistenceError>

  /**
   * Find all fiscal periods for a fiscal year
   *
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect containing array of fiscal periods ordered by period number
   */
  readonly findPeriodsByFiscalYear: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * Find the fiscal period that contains a specific date for a company
   *
   * @param companyId - The company ID
   * @param date - The date to find the period for (YYYY-MM-DD)
   * @returns Effect containing Option of FiscalPeriod
   */
  readonly findPeriodByDate: (
    companyId: CompanyId,
    date: string
  ) => Effect.Effect<Option.Option<FiscalPeriod>, PersistenceError>

  /**
   * Find all fiscal periods with a specific status for a company
   *
   * @param companyId - The company ID
   * @param status - The status to filter by
   * @returns Effect containing array of fiscal periods
   */
  readonly findPeriodsByStatus: (
    companyId: CompanyId,
    status: FiscalPeriodStatus
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * Create a new fiscal period
   *
   * @param period - The fiscal period entity to create
   * @returns Effect containing the created fiscal period
   */
  readonly createPeriod: (
    period: FiscalPeriod
  ) => Effect.Effect<FiscalPeriod, PersistenceError>

  /**
   * Update an existing fiscal period
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param period - The fiscal period entity with updated values
   * @returns Effect containing the updated fiscal period
   * @throws EntityNotFoundError if fiscal period doesn't exist or not in fiscal year
   */
  readonly updatePeriod: (
    fiscalYearId: FiscalYearId,
    period: FiscalPeriod
  ) => Effect.Effect<FiscalPeriod, EntityNotFoundError | PersistenceError>

  /**
   * Bulk create fiscal periods for a fiscal year
   *
   * @param periods - Array of fiscal period entities to create
   * @returns Effect containing the created fiscal periods
   */
  readonly createPeriods: (
    periods: ReadonlyArray<FiscalPeriod>
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  // ==================== Audit Operations ====================

  /**
   * Create a period reopen audit entry
   *
   * @param entry - The audit entry to create
   * @returns Effect containing the created audit entry
   */
  readonly createReopenAuditEntry: (
    entry: PeriodReopenAuditEntry
  ) => Effect.Effect<PeriodReopenAuditEntry, PersistenceError>

  /**
   * Find all reopen audit entries for a fiscal period
   *
   * @param periodId - The fiscal period ID
   * @returns Effect containing array of audit entries ordered by date desc
   */
  readonly findReopenAuditEntriesByPeriod: (
    periodId: FiscalPeriodId
  ) => Effect.Effect<ReadonlyArray<PeriodReopenAuditEntry>, PersistenceError>
}

/**
 * FiscalPeriodRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { FiscalPeriodRepository } from "@accountability/persistence/Services/FiscalPeriodRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* FiscalPeriodRepository
 *   const fiscalYear = yield* repo.findFiscalYearById(companyId, fiscalYearId)
 *   // ...
 * })
 * ```
 */
export class FiscalPeriodRepository extends Context.Tag("FiscalPeriodRepository")<
  FiscalPeriodRepository,
  FiscalPeriodRepositoryService
>() {}
