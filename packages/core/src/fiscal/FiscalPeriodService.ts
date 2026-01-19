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
  FiscalYearOverlapError,
  PeriodsNotClosedError
} from "./FiscalPeriodErrors.ts"
import type { PersistenceError, EntityNotFoundError } from "../shared/errors/RepositoryError.ts"

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * Input for creating a new fiscal year
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
  /** Whether to include a 13th adjustment period (default: false) */
  readonly includeAdjustmentPeriod?: boolean
}

/**
 * Input for creating fiscal periods for a fiscal year
 * Periods are usually auto-generated based on the fiscal year dates
 */
export interface GeneratePeriodsInput {
  readonly fiscalYearId: FiscalYearId
  /** Number of regular periods (typically 12 for monthly) */
  readonly periodCount?: number
  /** Start date of the fiscal year (for calculating period dates) */
  readonly startDate: LocalDate
  /** End date of the fiscal year (for calculating period dates) */
  readonly endDate: LocalDate
  /** Whether to include Period 13 adjustment period */
  readonly includeAdjustmentPeriod?: boolean
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
 * Input for reopening a closed/locked period
 */
export interface ReopenPeriodInput {
  readonly periodId: FiscalPeriodId
  readonly reason: string
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
   * Begin year-end close process
   *
   * Transitions the fiscal year status to "Closing"
   *
   * @param companyId - The company ID for authorization
   * @param fiscalYearId - The fiscal year to close
   * @returns Effect containing the updated fiscal year
   * @errors FiscalYearNotFoundError - Fiscal year doesn't exist
   * @errors InvalidYearStatusTransitionError - Year is not in Open status
   * @errors PersistenceError - Database operation failed
   */
  readonly beginYearClose: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<
    FiscalYear,
    FiscalYearNotFoundError | InvalidYearStatusTransitionError | PersistenceError | EntityNotFoundError
  >

  /**
   * Complete year-end close
   *
   * Transitions the fiscal year status to "Closed"
   * All periods must be closed first.
   *
   * @param companyId - The company ID for authorization
   * @param fiscalYearId - The fiscal year to close
   * @returns Effect containing the updated fiscal year
   * @errors FiscalYearNotFoundError - Fiscal year doesn't exist
   * @errors InvalidYearStatusTransitionError - Year is not in Closing status
   * @errors PeriodsNotClosedError - Not all periods are closed
   * @errors PersistenceError - Database operation failed
   */
  readonly completeYearClose: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<
    FiscalYear,
    FiscalYearNotFoundError | InvalidYearStatusTransitionError | PeriodsNotClosedError | PersistenceError | EntityNotFoundError
  >

  // ==================== Fiscal Period Operations ====================

  /**
   * Generate fiscal periods for a fiscal year
   *
   * Creates monthly periods based on the fiscal year start/end dates.
   * Periods are created in "Future" status by default.
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
   * Transitions a period from "Future" to "Open" status.
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param periodId - The period to open
   * @param userId - The user performing the action
   * @returns Effect containing the updated period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors InvalidStatusTransitionError - Period is not in Future status
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
   * Soft-close a fiscal period
   *
   * Transitions a period from "Open" to "SoftClose" status.
   * Limited operations are still allowed with approval.
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param periodId - The period to soft-close
   * @param userId - The user performing the action
   * @returns Effect containing the updated period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors InvalidStatusTransitionError - Period is not in Open status
   * @errors PersistenceError - Database operation failed
   */
  readonly softClosePeriod: (
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
   * Transitions a period from "SoftClose" to "Closed" status.
   * No modifications allowed.
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param periodId - The period to close
   * @param userId - The user performing the action
   * @returns Effect containing the updated period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors InvalidStatusTransitionError - Period is not in SoftClose status
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
   * Lock a fiscal period
   *
   * Transitions a period from "Closed" to "Locked" status.
   * Permanently locked - requires special unlock.
   *
   * @param fiscalYearId - The fiscal year ID for authorization
   * @param periodId - The period to lock
   * @param userId - The user performing the action
   * @returns Effect containing the updated period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors InvalidStatusTransitionError - Period is not in Closed status
   * @errors PersistenceError - Database operation failed
   */
  readonly lockPeriod: (
    fiscalYearId: FiscalYearId,
    periodId: FiscalPeriodId,
    userId: AuthUserId
  ) => Effect.Effect<
    FiscalPeriod,
    FiscalPeriodNotFoundError | InvalidStatusTransitionError | PersistenceError | EntityNotFoundError
  >

  /**
   * Reopen a closed or locked period
   *
   * Returns a period to "Open" status with an audit trail.
   * Requires special authorization (fiscal_period:reopen).
   *
   * @param input - The reopen request with reason
   * @returns Effect containing the updated period
   * @errors FiscalPeriodNotFoundError - Period doesn't exist
   * @errors PeriodProtectedError - Period cannot be reopened
   * @errors PersistenceError - Database operation failed
   */
  readonly reopenPeriod: (
    fiscalYearId: FiscalYearId,
    input: ReopenPeriodInput
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
  | PeriodsNotClosedError
  | PersistenceError
  | EntityNotFoundError
