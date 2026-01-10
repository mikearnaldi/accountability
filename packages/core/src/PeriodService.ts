/**
 * PeriodService - Effect service for fiscal year and period management
 *
 * Implements fiscal year creation with auto-generated periods per SPECIFICATIONS.md:
 * - Creates fiscal years with 12 monthly periods based on company fiscal settings
 * - Optional period 13 (adjustment period) support
 * - Validates that fiscal years don't overlap for the same company
 *
 * Uses Context.Tag and Layer patterns for dependency injection.
 *
 * @module PeriodService
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import * as Schema from "effect/Schema"
import { CompanyId, FiscalYearEnd } from "./Company.js"
import { LocalDate, addMonths, daysInMonth } from "./LocalDate.js"
import { Timestamp, nowEffect as timestampNowEffect } from "./Timestamp.js"

// =============================================================================
// Entity IDs
// =============================================================================

/**
 * FiscalYearId - Branded UUID string for fiscal year identification
 */
export const FiscalYearId = Schema.UUID.pipe(
  Schema.brand("FiscalYearId"),
  Schema.annotations({
    identifier: "FiscalYearId",
    title: "Fiscal Year ID",
    description: "A unique identifier for a fiscal year (UUID format)"
  })
)

/**
 * The branded FiscalYearId type
 */
export type FiscalYearId = typeof FiscalYearId.Type

/**
 * Type guard for FiscalYearId using Schema.is
 */
export const isFiscalYearId = Schema.is(FiscalYearId)

/**
 * FiscalPeriodId - Branded UUID string for fiscal period identification
 */
export const FiscalPeriodId = Schema.UUID.pipe(
  Schema.brand("FiscalPeriodId"),
  Schema.annotations({
    identifier: "FiscalPeriodId",
    title: "Fiscal Period ID",
    description: "A unique identifier for a fiscal period (UUID format)"
  })
)

/**
 * The branded FiscalPeriodId type
 */
export type FiscalPeriodId = typeof FiscalPeriodId.Type

/**
 * Type guard for FiscalPeriodId using Schema.is
 */
export const isFiscalPeriodId = Schema.is(FiscalPeriodId)

// =============================================================================
// Fiscal Year Status
// =============================================================================

/**
 * FiscalYearStatus - Status of a fiscal year
 *
 * Per SPECIFICATIONS.md:
 * - Open: Normal operations
 * - Closing: Year-end close in progress
 * - Closed: Year is closed
 */
export const FiscalYearStatus = Schema.Literal("Open", "Closing", "Closed").annotations({
  identifier: "FiscalYearStatus",
  title: "Fiscal Year Status",
  description: "Status of a fiscal year"
})

/**
 * The FiscalYearStatus type
 */
export type FiscalYearStatus = typeof FiscalYearStatus.Type

/**
 * Type guard for FiscalYearStatus using Schema.is
 */
export const isFiscalYearStatus = Schema.is(FiscalYearStatus)

// =============================================================================
// Fiscal Period Status
// =============================================================================

/**
 * FiscalPeriodStatus - Status of a fiscal period
 *
 * Per SPECIFICATIONS.md:
 * - Future: Period not yet open, posting not allowed
 * - Open: Normal operations, unrestricted posting
 * - SoftClose: Limited posting, only with approval
 * - Closed: Period closed, no posting
 * - Locked: Permanently sealed, cannot reopen
 */
export const FiscalPeriodStatus = Schema.Literal(
  "Future",
  "Open",
  "SoftClose",
  "Closed",
  "Locked"
).annotations({
  identifier: "FiscalPeriodStatus",
  title: "Fiscal Period Status",
  description: "Status of a fiscal period"
})

/**
 * The FiscalPeriodStatus type
 */
export type FiscalPeriodStatus = typeof FiscalPeriodStatus.Type

/**
 * Type guard for FiscalPeriodStatus using Schema.is
 */
export const isFiscalPeriodStatus = Schema.is(FiscalPeriodStatus)

// =============================================================================
// Fiscal Period Type
// =============================================================================

/**
 * FiscalPeriodType - Type of fiscal period
 *
 * Per SPECIFICATIONS.md:
 * - Regular: Standard monthly period (1-12)
 * - Adjustment: Period 13 for year-end adjustments
 * - Closing: Period for closing entries
 */
export const FiscalPeriodType = Schema.Literal(
  "Regular",
  "Adjustment",
  "Closing"
).annotations({
  identifier: "FiscalPeriodType",
  title: "Fiscal Period Type",
  description: "Type of fiscal period"
})

/**
 * The FiscalPeriodType type
 */
export type FiscalPeriodType = typeof FiscalPeriodType.Type

/**
 * Type guard for FiscalPeriodType using Schema.is
 */
export const isFiscalPeriodType = Schema.is(FiscalPeriodType)

// =============================================================================
// FiscalPeriod Entity
// =============================================================================

/**
 * FiscalPeriod - A period within a fiscal year
 *
 * Per SPECIFICATIONS.md Fiscal Period structure:
 * - Unique identifier
 * - Fiscal year reference
 * - Period number (1-12 for months, 13+ for adjustments)
 * - Period name (e.g., "January 2025", "Adjustment Period")
 * - Period type: Regular, Adjustment, or Closing
 * - Start date
 * - End date
 * - Status: Future, Open, SoftClose, Closed, or Locked
 * - Closed by user (if closed)
 * - Closed timestamp (if closed)
 */
export class FiscalPeriod extends Schema.Class<FiscalPeriod>("FiscalPeriod")({
  /**
   * Unique identifier for the fiscal period
   */
  id: FiscalPeriodId,

  /**
   * Reference to the parent fiscal year
   */
  fiscalYearId: FiscalYearId,

  /**
   * Period number within the fiscal year (1-13)
   * 1-12 for regular monthly periods, 13 for adjustment period
   */
  periodNumber: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
    Schema.lessThanOrEqualTo(13)
  ),

  /**
   * Display name of the period (e.g., "January 2025", "Adjustment Period")
   */
  name: Schema.NonEmptyTrimmedString,

  /**
   * Type of the period
   */
  periodType: FiscalPeriodType,

  /**
   * Start date of the period
   */
  startDate: LocalDate,

  /**
   * End date of the period
   */
  endDate: LocalDate,

  /**
   * Current status of the period
   */
  status: FiscalPeriodStatus,

  /**
   * User who closed the period (if closed)
   */
  closedBy: Schema.OptionFromNullOr(Schema.UUID.pipe(Schema.brand("UserId"))),

  /**
   * When the period was closed (if closed)
   */
  closedAt: Schema.OptionFromNullOr(Timestamp)
}) {
  /**
   * Check if the period is open for posting
   */
  get isOpenForPosting(): boolean {
    return this.status === "Open"
  }

  /**
   * Check if the period allows limited posting (soft close)
   */
  get allowsLimitedPosting(): boolean {
    return this.status === "Open" || this.status === "SoftClose"
  }

  /**
   * Check if this is an adjustment period (period 13)
   */
  get isAdjustmentPeriod(): boolean {
    return this.periodNumber === 13
  }

  /**
   * Check if this is a regular monthly period
   */
  get isRegularPeriod(): boolean {
    return this.periodNumber >= 1 && this.periodNumber <= 12
  }

  /**
   * Format as a display string (e.g., "FY2025-P01")
   */
  toString(): string {
    return this.name
  }
}

/**
 * Type guard for FiscalPeriod using Schema.is
 */
export const isFiscalPeriod = Schema.is(FiscalPeriod)

// =============================================================================
// FiscalYear Entity
// =============================================================================

/**
 * FiscalYear - A fiscal year for a company
 *
 * Per SPECIFICATIONS.md Fiscal Year structure:
 * - Unique identifier
 * - Company reference
 * - Year name (e.g., "FY2025")
 * - Start date
 * - End date
 * - List of fiscal periods
 * - Status: Open, Closing, or Closed
 */
export class FiscalYear extends Schema.Class<FiscalYear>("FiscalYear")({
  /**
   * Unique identifier for the fiscal year
   */
  id: FiscalYearId,

  /**
   * Reference to the company this fiscal year belongs to
   */
  companyId: CompanyId,

  /**
   * Display name of the fiscal year (e.g., "FY2025")
   */
  name: Schema.NonEmptyTrimmedString,

  /**
   * The year number (e.g., 2025)
   */
  year: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1900),
    Schema.lessThanOrEqualTo(2999)
  ),

  /**
   * Start date of the fiscal year
   */
  startDate: LocalDate,

  /**
   * End date of the fiscal year
   */
  endDate: LocalDate,

  /**
   * Current status of the fiscal year
   */
  status: FiscalYearStatus,

  /**
   * Whether this fiscal year includes an adjustment period (period 13)
   */
  includesAdjustmentPeriod: Schema.Boolean,

  /**
   * When the fiscal year was created
   */
  createdAt: Timestamp
}) {
  /**
   * Check if the fiscal year is open
   */
  get isOpen(): boolean {
    return this.status === "Open"
  }

  /**
   * Check if the fiscal year is closed
   */
  get isClosed(): boolean {
    return this.status === "Closed"
  }

  /**
   * Check if the fiscal year is in closing process
   */
  get isClosing(): boolean {
    return this.status === "Closing"
  }

  /**
   * Format as a display string
   */
  toString(): string {
    return this.name
  }
}

/**
 * Type guard for FiscalYear using Schema.is
 */
export const isFiscalYear = Schema.is(FiscalYear)

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when a fiscal year overlaps with an existing year for the same company
 */
export class FiscalYearOverlapError extends Schema.TaggedError<FiscalYearOverlapError>()(
  "FiscalYearOverlapError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    newYearStart: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    newYearEnd: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    existingYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")),
    existingYearName: Schema.String
  }
) {
  get message(): string {
    const start = `${this.newYearStart.year}-${String(this.newYearStart.month).padStart(2, "0")}-${String(this.newYearStart.day).padStart(2, "0")}`
    const end = `${this.newYearEnd.year}-${String(this.newYearEnd.month).padStart(2, "0")}-${String(this.newYearEnd.day).padStart(2, "0")}`
    return `Fiscal year ${start} to ${end} overlaps with existing fiscal year '${this.existingYearName}' for company ${this.companyId}`
  }
}

/**
 * Type guard for FiscalYearOverlapError
 */
export const isFiscalYearOverlapError = Schema.is(FiscalYearOverlapError)

/**
 * Error when a fiscal year is not found
 */
export class FiscalYearNotFoundError extends Schema.TaggedError<FiscalYearNotFoundError>()(
  "FiscalYearNotFoundError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    year: Schema.Number
  }
) {
  get message(): string {
    return `Fiscal year ${this.year} not found for company ${this.companyId}`
  }
}

/**
 * Type guard for FiscalYearNotFoundError
 */
export const isFiscalYearNotFoundError = Schema.is(FiscalYearNotFoundError)

/**
 * Error when a company is not found
 */
export class CompanyNotFoundError extends Schema.TaggedError<CompanyNotFoundError>()(
  "CompanyNotFoundError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId"))
  }
) {
  get message(): string {
    return `Company not found: ${this.companyId}`
  }
}

/**
 * Type guard for CompanyNotFoundError
 */
export const isCompanyNotFoundError = Schema.is(CompanyNotFoundError)

/**
 * Error when an invalid fiscal year configuration is provided
 */
export class InvalidFiscalYearConfigError extends Schema.TaggedError<InvalidFiscalYearConfigError>()(
  "InvalidFiscalYearConfigError",
  {
    reason: Schema.String
  }
) {
  get message(): string {
    return `Invalid fiscal year configuration: ${this.reason}`
  }
}

/**
 * Type guard for InvalidFiscalYearConfigError
 */
export const isInvalidFiscalYearConfigError = Schema.is(InvalidFiscalYearConfigError)

/**
 * Union type for all period service errors
 */
export type PeriodServiceError =
  | FiscalYearOverlapError
  | FiscalYearNotFoundError
  | CompanyNotFoundError
  | InvalidFiscalYearConfigError

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * Company fiscal settings info
 */
export interface CompanyFiscalSettings {
  readonly companyId: CompanyId
  readonly fiscalYearEnd: FiscalYearEnd
}

/**
 * Existing fiscal year info for overlap checking
 */
export interface ExistingFiscalYearInfo {
  readonly id: FiscalYearId
  readonly name: string
  readonly startDate: LocalDate
  readonly endDate: LocalDate
}

/**
 * FiscalYearRepository - Repository interface for fiscal year persistence
 *
 * Used by PeriodService for fiscal year storage and retrieval.
 */
export interface FiscalYearRepositoryService {
  /**
   * Get company fiscal settings
   * @param companyId - The company ID
   * @returns Effect containing the company fiscal settings or None if not found
   */
  readonly getCompanyFiscalSettings: (
    companyId: CompanyId
  ) => Effect.Effect<Option.Option<CompanyFiscalSettings>>

  /**
   * Get all existing fiscal years for a company
   * @param companyId - The company ID
   * @returns Effect containing array of existing fiscal years
   */
  readonly getExistingFiscalYears: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<ExistingFiscalYearInfo>>

  /**
   * Find a fiscal year by company and year number
   * @param companyId - The company ID
   * @param year - The fiscal year number (e.g., 2025)
   * @returns Effect containing the fiscal year or None if not found
   */
  readonly findByCompanyAndYear: (
    companyId: CompanyId,
    year: number
  ) => Effect.Effect<Option.Option<FiscalYear>>

  /**
   * Save a new fiscal year
   * @param fiscalYear - The fiscal year to save
   * @returns Effect containing the saved fiscal year
   */
  readonly saveFiscalYear: (fiscalYear: FiscalYear) => Effect.Effect<FiscalYear>

  /**
   * Save fiscal periods
   * @param periods - The fiscal periods to save
   * @returns Effect containing the saved periods
   */
  readonly saveFiscalPeriods: (
    periods: ReadonlyArray<FiscalPeriod>
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>>
}

/**
 * FiscalYearRepository Context.Tag
 */
export class FiscalYearRepository extends Context.Tag("FiscalYearRepository")<
  FiscalYearRepository,
  FiscalYearRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * CreateFiscalYearInput - Input for creating a new fiscal year
 */
export interface CreateFiscalYearInput {
  /** The ID for the new fiscal year */
  readonly fiscalYearId: FiscalYearId
  /** The company to create the fiscal year for */
  readonly companyId: CompanyId
  /** The start date of the fiscal year */
  readonly startDate: LocalDate
  /** Whether to include an adjustment period (period 13) */
  readonly includeAdjustmentPeriod?: boolean
  /** IDs for the fiscal periods (must provide 12 or 13 IDs depending on includeAdjustmentPeriod) */
  readonly periodIds: ReadonlyArray<FiscalPeriodId>
}

/**
 * CreateFiscalYearResult - Result of creating a fiscal year
 */
export interface CreateFiscalYearResult {
  /** The created fiscal year */
  readonly fiscalYear: FiscalYear
  /** The created fiscal periods */
  readonly periods: ReadonlyArray<FiscalPeriod>
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * PeriodService - Service interface for fiscal year and period management
 */
export interface PeriodServiceShape {
  /**
   * Create a new fiscal year with auto-generated periods
   *
   * Creates a fiscal year for a company with:
   * - 12 monthly periods based on company's fiscal year settings
   * - Optional period 13 (adjustment period)
   * - Validates that the year doesn't overlap existing years for the company
   *
   * @param input - The fiscal year creation input
   * @returns Effect containing the created fiscal year and periods
   * @throws CompanyNotFoundError if the company doesn't exist
   * @throws FiscalYearOverlapError if the year overlaps with an existing year
   * @throws InvalidFiscalYearConfigError if the configuration is invalid
   */
  readonly createFiscalYear: (
    input: CreateFiscalYearInput
  ) => Effect.Effect<
    CreateFiscalYearResult,
    CompanyNotFoundError | FiscalYearOverlapError | InvalidFiscalYearConfigError,
    never
  >
}

/**
 * PeriodService Context.Tag
 */
export class PeriodService extends Context.Tag("PeriodService")<
  PeriodService,
  PeriodServiceShape
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate the fiscal year end date given a start date and fiscal year end settings
 */
const calculateFiscalYearEndDate = (
  startDate: LocalDate,
  fiscalYearEnd: FiscalYearEnd
): LocalDate => {
  // The fiscal year end is in the same calendar year if the end month >= start month,
  // otherwise it's in the next calendar year
  let endYear = startDate.year

  // If fiscal year end is before start month in calendar, end is in next year
  if (fiscalYearEnd.month < startDate.month ||
      (fiscalYearEnd.month === startDate.month && fiscalYearEnd.day < startDate.day)) {
    endYear = startDate.year + 1
  }

  // Ensure the day is valid for the month
  const maxDaysInMonth = daysInMonth(endYear, fiscalYearEnd.month)
  const endDay = Math.min(fiscalYearEnd.day, maxDaysInMonth)

  return LocalDate.make(
    { year: endYear, month: fiscalYearEnd.month, day: endDay },
    { disableValidation: true }
  )
}

/**
 * Get the month name for a given month number (1-12)
 */
const getMonthName = (month: number): string => {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]
  return monthNames[month - 1] || "Unknown"
}

/**
 * Generate period dates for a fiscal year
 * Returns an array of { startDate, endDate, name, periodNumber } for each period
 */
const generatePeriodDates = (
  fiscalYearStartDate: LocalDate,
  fiscalYearEndDate: LocalDate,
  year: number,
  includeAdjustmentPeriod: boolean
): ReadonlyArray<{
  periodNumber: number
  name: string
  periodType: FiscalPeriodType
  startDate: LocalDate
  endDate: LocalDate
}> => {
  const periods: Array<{
    periodNumber: number
    name: string
    periodType: FiscalPeriodType
    startDate: LocalDate
    endDate: LocalDate
  }> = []

  // Generate 12 monthly periods
  let currentStart = fiscalYearStartDate

  for (let i = 1; i <= 12; i++) {
    // Calculate end of this period (last day of the month)
    const periodEndMonth = currentStart.month
    const periodEndYear = currentStart.year
    const maxDay = daysInMonth(periodEndYear, periodEndMonth)

    let periodEnd = LocalDate.make(
      { year: periodEndYear, month: periodEndMonth, day: maxDay },
      { disableValidation: true }
    )

    // For the last period (12), ensure it ends on the fiscal year end date
    if (i === 12) {
      periodEnd = fiscalYearEndDate
    }

    const monthName = getMonthName(currentStart.month)

    periods.push({
      periodNumber: i,
      name: `${monthName} ${currentStart.year}`,
      periodType: "Regular",
      startDate: currentStart,
      endDate: periodEnd
    })

    // Move to the next month for the next period
    if (i < 12) {
      currentStart = addMonths(currentStart, 1)
      // Ensure we start at day 1 of the month
      currentStart = LocalDate.make(
        { year: currentStart.year, month: currentStart.month, day: 1 },
        { disableValidation: true }
      )
    }
  }

  // Add adjustment period (period 13) if requested
  if (includeAdjustmentPeriod) {
    // Adjustment period spans the entire fiscal year but is used for adjusting entries
    periods.push({
      periodNumber: 13,
      name: `Adjustment Period FY${year}`,
      periodType: "Adjustment",
      startDate: fiscalYearStartDate,
      endDate: fiscalYearEndDate
    })
  }

  return periods
}

/**
 * Check if two date ranges overlap
 */
const dateRangesOverlap = (
  start1: LocalDate,
  end1: LocalDate,
  start2: LocalDate,
  end2: LocalDate
): boolean => {
  // Ranges overlap if start1 <= end2 AND start2 <= end1
  const start1LteEnd2 = start1.year < end2.year ||
    (start1.year === end2.year && start1.month < end2.month) ||
    (start1.year === end2.year && start1.month === end2.month && start1.day <= end2.day)

  const start2LteEnd1 = start2.year < end1.year ||
    (start2.year === end1.year && start2.month < end1.month) ||
    (start2.year === end1.year && start2.month === end1.month && start2.day <= end1.day)

  return start1LteEnd2 && start2LteEnd1
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the PeriodService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* FiscalYearRepository

  return {
    createFiscalYear: (input: CreateFiscalYearInput) =>
      Effect.gen(function* () {
        const {
          fiscalYearId,
          companyId,
          startDate,
          includeAdjustmentPeriod = false,
          periodIds
        } = input

        // Validate period IDs count
        const requiredPeriodCount = includeAdjustmentPeriod ? 13 : 12
        if (periodIds.length !== requiredPeriodCount) {
          return yield* Effect.fail(
            new InvalidFiscalYearConfigError({
              reason: `Expected ${requiredPeriodCount} period IDs, got ${periodIds.length}`
            })
          )
        }

        // Get company fiscal settings
        const companySettings = yield* repository.getCompanyFiscalSettings(companyId)

        if (Option.isNone(companySettings)) {
          return yield* Effect.fail(new CompanyNotFoundError({ companyId }))
        }

        const { fiscalYearEnd } = companySettings.value

        // Calculate fiscal year end date
        const endDate = calculateFiscalYearEndDate(startDate, fiscalYearEnd)

        // Validate start date is valid (should be day after previous fiscal year end or first of month)
        // For simplicity, we just validate that start is before end
        if (startDate.year > endDate.year ||
            (startDate.year === endDate.year && startDate.month > endDate.month) ||
            (startDate.year === endDate.year && startDate.month === endDate.month && startDate.day > endDate.day)) {
          return yield* Effect.fail(
            new InvalidFiscalYearConfigError({
              reason: `Start date ${startDate.toISOString()} must be before end date ${endDate.toISOString()}`
            })
          )
        }

        // Get existing fiscal years for overlap check
        const existingYears = yield* repository.getExistingFiscalYears(companyId)

        // Check for overlaps
        for (const existing of existingYears) {
          if (dateRangesOverlap(startDate, endDate, existing.startDate, existing.endDate)) {
            return yield* Effect.fail(
              new FiscalYearOverlapError({
                companyId,
                newYearStart: {
                  year: startDate.year,
                  month: startDate.month,
                  day: startDate.day
                },
                newYearEnd: {
                  year: endDate.year,
                  month: endDate.month,
                  day: endDate.day
                },
                existingYearId: existing.id,
                existingYearName: existing.name
              })
            )
          }
        }

        // Determine fiscal year number (year of the end date is typically used)
        const fiscalYearNumber = endDate.year

        // Create the fiscal year name
        const fiscalYearName = `FY${fiscalYearNumber}`

        // Get current timestamp
        const now = yield* timestampNowEffect

        // Create the fiscal year entity
        const fiscalYear = FiscalYear.make({
          id: fiscalYearId,
          companyId,
          name: fiscalYearName,
          year: fiscalYearNumber,
          startDate,
          endDate,
          status: "Open",
          includesAdjustmentPeriod: includeAdjustmentPeriod,
          createdAt: now
        })

        // Generate period dates
        const periodDates = generatePeriodDates(
          startDate,
          endDate,
          fiscalYearNumber,
          includeAdjustmentPeriod
        )

        // Create fiscal period entities
        const periods = Array.map(periodDates, (pd, index) =>
          FiscalPeriod.make({
            id: periodIds[index],
            fiscalYearId,
            periodNumber: pd.periodNumber,
            name: pd.name,
            periodType: pd.periodType,
            startDate: pd.startDate,
            endDate: pd.endDate,
            status: pd.periodNumber === 1 ? "Open" : "Future",
            closedBy: Option.none(),
            closedAt: Option.none()
          })
        )

        // Save fiscal year and periods
        const savedFiscalYear = yield* repository.saveFiscalYear(fiscalYear)
        const savedPeriods = yield* repository.saveFiscalPeriods(periods)

        return {
          fiscalYear: savedFiscalYear,
          periods: savedPeriods
        } satisfies CreateFiscalYearResult
      })
  } satisfies PeriodServiceShape
})

/**
 * PeriodServiceLive - Live implementation of PeriodService
 *
 * Requires FiscalYearRepository
 */
export const PeriodServiceLive: Layer.Layer<
  PeriodService,
  never,
  FiscalYearRepository
> = Layer.effect(PeriodService, make)
