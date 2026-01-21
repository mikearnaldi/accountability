/**
 * FiscalPeriodService - Service interface for fiscal period management
 *
 * Provides business logic for managing fiscal years and periods including:
 * - Creating and configuring fiscal years with periods
 * - Opening, closing, and locking fiscal periods
 * - Reopening periods with audit trail
 * - Managing fiscal year status transitions
 *
 * This service is critical for the "Locked Period Protection" authorization policy
 * that prevents journal entry modifications in locked periods.
 *
 * @module fiscal/FiscalPeriodService
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { FiscalYear, FiscalYearId } from "./FiscalYear.ts"
import type { FiscalPeriod, FiscalPeriodId, PeriodReopenAuditEntry } from "./FiscalPeriod.ts"
import type { FiscalPeriodStatus } from "./FiscalPeriodStatus.ts"
import type { CompanyId } from "../company/Company.ts"
import type { LocalDate } from "../shared/values/LocalDate.ts"
import type { AuthUserId } from "../authentication/AuthUserId.ts"
import type {
  FiscalYearNotFoundError,
  FiscalPeriodNotFoundError,
  InvalidStatusTransitionError,
  InvalidYearStatusTransitionError,
  FiscalYearAlreadyExistsError,
  FiscalYearOverlapError
} from "./FiscalPeriodErrors.ts"
import type { PersistenceError, EntityNotFoundError } from "../shared/errors/RepositoryError.ts"

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * Input for creating a new fiscal year
 *
 * Note: Period 13 (adjustment period) is ALWAYS created automatically.
 * This is mandatory for consolidation compatibility and audit compliance.
 */
export interface CreateFiscalYearInput {
  readonly companyId: CompanyId
  /** The fiscal year number (e.g., 2025) - named after the calendar year in which it ends */
  readonly year: number
  /** Optional custom name (defaults to "FY {year}") */
  readonly name?: string
  /** Start date of the fiscal year */
  readonly startDate: LocalDate
  /** End date of the fiscal year */
  readonly endDate: LocalDate
}

/**
 * Input for creating fiscal periods for a fiscal year
 *
 * Periods are auto-generated based on the fiscal year dates.
 * Always generates 13 periods: 12 regular monthly periods + 1 adjustment period.
 */
export interface GeneratePeriodsInput {
  readonly fiscalYearId: FiscalYearId
  /** Number of regular periods (typically 12 for monthly) */
  readonly periodCount?: number
  /** Start date of the fiscal year (for calculating period dates) */
  readonly startDate: LocalDate
  /** End date of the fiscal year (for calculating period dates) */
  readonly endDate: LocalDate
}

/**
 * Input for changing a fiscal period's status
 */
export interface ChangePeriodStatusInput {
  readonly periodId: FiscalPeriodId
  readonly targetStatus: FiscalPeriodStatus
  readonly userId: AuthUserId
}

/**
 * Filter options for listing fiscal periods
 */
export interface ListPeriodsFilter {
  readonly companyId: CompanyId
  readonly fiscalYearId?: FiscalYearId
  readonly status?: FiscalPeriodStatus
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * FiscalPeriodServiceShape - The shape of the fiscal period service
 *
 * Provides all fiscal period management operations including:
 * - Creating and configuring fiscal years
 * - Generating fiscal periods
 * - Managing period status transitions
 * - Reopening periods with audit trail
 */
export interface FiscalPeriodServiceShape {
  // ==================== Fiscal Year Operations ====================

  /**
   * Create a new fiscal year for a company
   *
   * Creates the fiscal year entity and optionally generates
   * the fiscal periods for it.
   *
   * @param input - The fiscal year configuration
   * @returns Effect containing the created fiscal year
   * @errors FiscalYearAlreadyExistsError - A fiscal year for this year already exists
   * @errors FiscalYearOverlapError - The date range overlaps with existing years
   * @errors PersistenceError - Database operation failed
   */
  readonly createFiscalYear: (
    input: CreateFiscalYearInput
  ) => Effect.Effect<
    FiscalYear,
    FiscalYearAlreadyExistsError | FiscalYearOverlapError | PersistenceError
  >

  /**
   * Get a fiscal year by ID
   *
   * @param companyId - The company ID for authorization
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect containing the fiscal year
   * @errors FiscalYearNotFoundError - Fiscal year doesn't exist
   * @errors PersistenceError - Database operation failed
   */
  readonly getFiscalYear: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<FiscalYear, FiscalYearNotFoundError | PersistenceError>

  /**
   * Get a fiscal year by year number
   *
   * @param companyId - The company ID
   * @param year - The fiscal year number (e.g., 2025)
   * @returns Effect containing the fiscal year, or None if not found
   * @errors PersistenceError - Database operation failed
   */
  readonly getFiscalYearByNumber: (
    companyId: CompanyId,
    year: number
  ) => Effect.Effect<Option.Option<FiscalYear>, PersistenceError>

  /**
   * List all fiscal years for a company
   *
   * @param companyId - The company ID
   * @returns Effect containing fiscal years ordered by year desc
   * @errors PersistenceError - Database operation failed
   */
  readonly listFiscalYears: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<FiscalYear>, PersistenceError>

  /**
   * Close a fiscal year
   *
   * Transitions the fiscal year status from "Open" to "Closed".
   * This is a single atomic operation - no intermediate "Closing" state.
   * All periods will be automatically closed.
   *
   * Note: For the full year-end close workflow with closing entries,
   * use YearEndCloseService which includes preview and closing entry generation.
   *
   * @param companyId - The company ID for authorization
   * @param fiscalYearId - The fiscal year to close
   * @returns Effect containing the updated fiscal year
   * @errors FiscalYearNotFoundError - Fiscal year doesn't exist
   * @errors InvalidYearStatusTransitionError - Year is not in Open status
   * @errors PersistenceError - Database operation failed
   */
  readonly closeFiscalYear: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<
    FiscalYear,
    FiscalYearNotFoundError | InvalidYearStatusTransitionError | PersistenceError | EntityNotFoundError
  >

  /**
   * Reopen a closed fiscal year
   *
   * Transitions a fiscal year from "Closed" back to "Open".
   * Use with caution - this is typically for correction scenarios.
   *
   * @param companyId - The company ID for authorization
   * @param fiscalYearId - The fiscal year to reopen
   * @returns Effect containing the updated fiscal year
   * @errors FiscalYearNotFoundError - Fiscal year doesn't exist
   * @errors InvalidYearStatusTransitionError - Year is not in Closed status
   * @errors PersistenceError - Database operation failed
   */
  readonly reopenFiscalYear: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<
    FiscalYear,
    FiscalYearNotFoundError | InvalidYearStatusTransitionError | PersistenceError | EntityNotFoundError
  >

  // ==================== Fiscal Period Operations ====================

  /**
   * Generate fiscal periods for a fiscal year
   *
   * Creates monthly periods based on the fiscal year start/end dates.
   * Periods are created in "Closed" status by default.
   *
   * @param input - The period generation configuration
   * @returns Effect containing the created periods
   * @errors FiscalYearNotFoundError - Fiscal year doesn't exist
   * @errors PersistenceError - Database operation failed
   */
  readonly generatePeriods: (
    input: GeneratePeriodsInput
  ) => Effect.Effect<
    ReadonlyArray<FiscalPeriod>,
    FiscalYearNotFoundError | PersistenceError | EntityNotFoundError
  >

  /**
   * Get a fiscal period by ID
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param periodId - The period ID
   * @returns Effect containing the fiscal period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors PersistenceError - Database operation failed
   */
  readonly getPeriod: (
    fiscalYearId: FiscalYearId,
    periodId: FiscalPeriodId
  ) => Effect.Effect<FiscalPeriod, FiscalPeriodNotFoundError | PersistenceError>

  /**
   * Find the fiscal period containing a specific date
   *
   * @param companyId - The company ID
   * @param date - The date to find the period for
   * @returns Effect containing the period, or None if no period matches
   * @errors PersistenceError - Database operation failed
   */
  readonly findPeriodByDate: (
    companyId: CompanyId,
    date: LocalDate
  ) => Effect.Effect<Option.Option<FiscalPeriod>, PersistenceError>

  /**
   * List all periods for a fiscal year
   *
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect containing periods ordered by period number
   * @errors PersistenceError - Database operation failed
   */
  readonly listPeriods: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * List periods by filter criteria
   *
   * @param filter - The filter options
   * @returns Effect containing matching periods
   * @errors PersistenceError - Database operation failed
   */
  readonly listPeriodsByFilter: (
    filter: ListPeriodsFilter
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>, PersistenceError>

  /**
   * Open a fiscal period
   *
   * Transitions a period from "Closed" to "Open" status.
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param periodId - The period to open
   * @param userId - The user performing the action
   * @returns Effect containing the updated period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors InvalidStatusTransitionError - Period is already open
   * @errors PersistenceError - Database operation failed
   */
  readonly openPeriod: (
    fiscalYearId: FiscalYearId,
    periodId: FiscalPeriodId,
    userId: AuthUserId
  ) => Effect.Effect<
    FiscalPeriod,
    FiscalPeriodNotFoundError | InvalidStatusTransitionError | PersistenceError | EntityNotFoundError
  >

  /**
   * Close a fiscal period
   *
   * Transitions a period from "Open" to "Closed" status.
   * No modifications allowed after close.
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param periodId - The period to close
   * @param userId - The user performing the action
   * @returns Effect containing the updated period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors InvalidStatusTransitionError - Period is already closed
   * @errors PersistenceError - Database operation failed
   */
  readonly closePeriod: (
    fiscalYearId: FiscalYearId,
    periodId: FiscalPeriodId,
    userId: AuthUserId
  ) => Effect.Effect<
    FiscalPeriod,
    FiscalPeriodNotFoundError | InvalidStatusTransitionError | PersistenceError | EntityNotFoundError
  >

  /**
   * Get the reopen audit history for a period
   *
   * @param periodId - The period ID
   * @returns Effect containing audit entries ordered by date desc
   * @errors PersistenceError - Database operation failed
   */
  readonly getPeriodReopenHistory: (
    periodId: FiscalPeriodId
  ) => Effect.Effect<ReadonlyArray<PeriodReopenAuditEntry>, PersistenceError>

  // ==================== Period Status Queries ====================

  /**
   * Check if a period is open for new journal entries
   *
   * @param companyId - The company ID
   * @param date - The journal entry date
   * @returns Effect containing true if the period allows new entries
   * @errors PersistenceError - Database operation failed
   */
  readonly isPeriodOpenForEntries: (
    companyId: CompanyId,
    date: LocalDate
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Check if a period allows modifications (with proper authorization)
   *
   * @param companyId - The company ID
   * @param date - The entry date
   * @returns Effect containing true if the period allows modifications
   * @errors PersistenceError - Database operation failed
   */
  readonly isPeriodOpenForModifications: (
    companyId: CompanyId,
    date: LocalDate
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Get the period status for a specific date
   *
   * @param companyId - The company ID
   * @param date - The date to check
   * @returns Effect containing the period status, or None if no period
   * @errors PersistenceError - Database operation failed
   */
  readonly getPeriodStatusForDate: (
    companyId: CompanyId,
    date: LocalDate
  ) => Effect.Effect<Option.Option<FiscalPeriodStatus>, PersistenceError>

  /**
   * Get a period by fiscal year number and period number
   *
   * Used for journal entry validation to check if a period exists and is open.
   *
   * @param companyId - The company ID
   * @param fiscalYear - The fiscal year number (e.g., 2025)
   * @param periodNumber - The period number (1-13)
   * @returns Effect containing the period, or None if not found
   * @errors PersistenceError - Database operation failed
   */
  readonly getPeriodByYearAndNumber: (
    companyId: CompanyId,
    fiscalYear: number,
    periodNumber: number
  ) => Effect.Effect<Option.Option<FiscalPeriod>, PersistenceError>

  /**
   * Get all periods for a company (for periods summary endpoint)
   *
   * Returns all periods across all fiscal years for a company,
   * used by the frontend to constrain date picker selections.
   *
   * @param companyId - The company ID
   * @returns Effect containing all periods for the company
   * @errors PersistenceError - Database operation failed
   */
  readonly getAllPeriodsForCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod & { fiscalYear: number }>, PersistenceError>
}

/**
 * FiscalPeriodService - Context.Tag for the fiscal period service
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const periodService = yield* FiscalPeriodService
 *   const fiscalYear = yield* periodService.createFiscalYear({
 *     companyId,
 *     year: 2025,
 *     startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
 *     endDate: LocalDate.make({ year: 2025, month: 12, day: 31 })
 *   })
 *   return fiscalYear
 * })
 *
 * // Provide the implementation
 * program.pipe(Effect.provide(FiscalPeriodServiceLive))
 * ```
 */
export class FiscalPeriodService extends Context.Tag("FiscalPeriodService")<
  FiscalPeriodService,
  FiscalPeriodServiceShape
>() {}

// =============================================================================
// Error Union Types
// =============================================================================

/**
 * CreateFiscalYearError - Union of errors for creating a fiscal year
 */
export type CreateFiscalYearError =
  | FiscalYearAlreadyExistsError
  | FiscalYearOverlapError
  | PersistenceError

/**
 * PeriodStatusTransitionError - Union of errors for period status changes
 */
export type PeriodStatusTransitionError =
  | FiscalPeriodNotFoundError
  | InvalidStatusTransitionError
  | PersistenceError
  | EntityNotFoundError

/**
 * YearStatusTransitionError - Union of errors for year status changes
 */
export type YearStatusTransitionError =
  | FiscalYearNotFoundError
  | InvalidYearStatusTransitionError
  | PersistenceError
  | EntityNotFoundError
