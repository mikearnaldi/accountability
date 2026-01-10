/**
 * FiscalPeriodRepository - Repository interface for FiscalYear and FiscalPeriod entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module FiscalPeriodRepository
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type {
  FiscalYear,
  FiscalYearId,
  FiscalPeriod,
  FiscalPeriodId,
  FiscalPeriodStatus
} from "@accountability/core/services/PeriodService.js"
import type { CompanyId } from "@accountability/core/domain/Company.js"
import type { EntityNotFoundError, PersistenceError } from "./RepositoryError.js"

/**
 * FiscalPeriodRepository - Service interface for FiscalYear and FiscalPeriod persistence
 *
 * Provides CRUD operations for FiscalYear and FiscalPeriod entities with typed error handling.
 */
export interface FiscalPeriodRepositoryService {
  /**
   * Find a fiscal period by its unique identifier
   *
   * @param id - The fiscal period ID to search for
   * @returns Effect containing Option of FiscalPeriod (None if not found)
   */
  readonly findById: (
    id: FiscalPeriodId
  ) => Effect.Effect<Option.Option<FiscalPeriod>, PersistenceError>

  /**
   * Find all fiscal periods for a company
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of fiscal periods
   */
  readonly findByCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * Find open fiscal periods for a company
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of open fiscal periods
   */
  readonly findOpen: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * Create a new fiscal period
   *
   * @param period - The fiscal period entity to create
   * @returns Effect containing the created fiscal period
   */
  readonly create: (
    period: FiscalPeriod
  ) => Effect.Effect<FiscalPeriod, PersistenceError>

  /**
   * Update an existing fiscal period
   *
   * @param period - The fiscal period entity with updated values
   * @returns Effect containing the updated fiscal period
   * @throws EntityNotFoundError if period doesn't exist
   */
  readonly update: (
    period: FiscalPeriod
  ) => Effect.Effect<FiscalPeriod, EntityNotFoundError | PersistenceError>

  /**
   * Find a fiscal period by its unique identifier, throwing if not found
   *
   * @param id - The fiscal period ID to search for
   * @returns Effect containing the FiscalPeriod
   * @throws EntityNotFoundError if period doesn't exist
   */
  readonly getById: (
    id: FiscalPeriodId
  ) => Effect.Effect<FiscalPeriod, EntityNotFoundError | PersistenceError>

  /**
   * Find all periods for a fiscal year
   *
   * @param fiscalYearId - The fiscal year ID to filter by
   * @returns Effect containing array of fiscal periods ordered by period number
   */
  readonly findByFiscalYear: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * Find periods by status for a company
   *
   * @param companyId - The company ID to filter by
   * @param status - The period status to filter by
   * @returns Effect containing array of fiscal periods
   */
  readonly findByStatus: (
    companyId: CompanyId,
    status: FiscalPeriodStatus
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * Find the current open period for a company
   *
   * @param companyId - The company ID to find current period for
   * @returns Effect containing Option of current FiscalPeriod
   */
  readonly findCurrentPeriod: (
    companyId: CompanyId
  ) => Effect.Effect<Option.Option<FiscalPeriod>, PersistenceError>

  /**
   * Bulk create fiscal periods
   *
   * @param periods - Array of fiscal periods to create
   * @returns Effect containing array of created fiscal periods
   */
  readonly createMany: (
    periods: ReadonlyArray<FiscalPeriod>
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  // =========================================================================
  // Fiscal Year Operations
  // =========================================================================

  /**
   * Find a fiscal year by its unique identifier
   *
   * @param id - The fiscal year ID to search for
   * @returns Effect containing Option of FiscalYear (None if not found)
   */
  readonly findFiscalYearById: (
    id: FiscalYearId
  ) => Effect.Effect<Option.Option<FiscalYear>, PersistenceError>

  /**
   * Find a fiscal year by its unique identifier, throwing if not found
   *
   * @param id - The fiscal year ID to search for
   * @returns Effect containing the FiscalYear
   * @throws EntityNotFoundError if fiscal year doesn't exist
   */
  readonly getFiscalYearById: (
    id: FiscalYearId
  ) => Effect.Effect<FiscalYear, EntityNotFoundError | PersistenceError>

  /**
   * Find all fiscal years for a company
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of fiscal years ordered by year descending
   */
  readonly findFiscalYearsByCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<FiscalYear>, PersistenceError>

  /**
   * Find fiscal year by company and year number
   *
   * @param companyId - The company ID to filter by
   * @param year - The fiscal year number (e.g., 2025)
   * @returns Effect containing Option of FiscalYear
   */
  readonly findFiscalYearByCompanyAndYear: (
    companyId: CompanyId,
    year: number
  ) => Effect.Effect<Option.Option<FiscalYear>, PersistenceError>

  /**
   * Find open fiscal years for a company
   *
   * @param companyId - The company ID to filter by
   * @returns Effect containing array of open fiscal years
   */
  readonly findOpenFiscalYears: (
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
   * @param fiscalYear - The fiscal year entity with updated values
   * @returns Effect containing the updated fiscal year
   * @throws EntityNotFoundError if fiscal year doesn't exist
   */
  readonly updateFiscalYear: (
    fiscalYear: FiscalYear
  ) => Effect.Effect<FiscalYear, EntityNotFoundError | PersistenceError>

  /**
   * Check if a fiscal period exists
   *
   * @param id - The fiscal period ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    id: FiscalPeriodId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Check if a fiscal year exists
   *
   * @param id - The fiscal year ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly fiscalYearExists: (
    id: FiscalYearId
  ) => Effect.Effect<boolean, PersistenceError>
}

/**
 * FiscalPeriodRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { FiscalPeriodRepository } from "@accountability/persistence"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* FiscalPeriodRepository
 *   const periods = yield* repo.findOpen(companyId)
 *   // ...
 * })
 * ```
 */
export class FiscalPeriodRepository extends Context.Tag("FiscalPeriodRepository")<
  FiscalPeriodRepository,
  FiscalPeriodRepositoryService
>() {}
