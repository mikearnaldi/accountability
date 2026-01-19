/**
 * ComputedFiscalPeriod - Compute fiscal periods at runtime from company settings
 *
 * Fiscal periods are computed automatically from the company's fiscal year end date.
 * No persistence needed - periods are calculated on demand from a transaction date.
 *
 * @module fiscal/ComputedFiscalPeriod
 */

import * as Schema from "effect/Schema"
import { LocalDate, daysInMonth } from "../shared/values/LocalDate.ts"
import type { FiscalYearEnd } from "../company/Company.ts"

/**
 * ComputedFiscalPeriod - Represents a computed fiscal period
 *
 * Given a date and a fiscal year end setting, this computes:
 * - The fiscal year number (e.g., 2024)
 * - The period number within the year (1-12)
 * - The period name (e.g., "March 2024" or "P3 FY2024")
 * - The start and end dates of the period
 * - The start and end dates of the fiscal year
 */
export class ComputedFiscalPeriod extends Schema.Class<ComputedFiscalPeriod>("ComputedFiscalPeriod")({
  /**
   * The fiscal year number (e.g., 2024)
   * Named after the calendar year in which the fiscal year ends
   */
  fiscalYear: Schema.Number.pipe(Schema.int()),

  /**
   * The period number within the fiscal year (1-12)
   */
  periodNumber: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(12)),

  /**
   * Short period name (e.g., "P3")
   */
  periodName: Schema.String,

  /**
   * Long period name (e.g., "March 2024")
   */
  periodDisplayName: Schema.String,

  /**
   * Start date of this period
   */
  periodStartDate: LocalDate,

  /**
   * End date of this period
   */
  periodEndDate: LocalDate,

  /**
   * Start date of the fiscal year
   */
  fiscalYearStart: LocalDate,

  /**
   * End date of the fiscal year
   */
  fiscalYearEnd: LocalDate
}) {
  /**
   * Format as a display string (e.g., "P3 FY2024")
   */
  toString(): string {
    return `${this.periodName} FY${this.fiscalYear}`
  }

  /**
   * Format as full display (e.g., "March 2024 (P3 FY2024)")
   */
  toFullDisplayString(): string {
    return `${this.periodDisplayName} (${this.toString()})`
  }
}

/**
 * Type guard for ComputedFiscalPeriod using Schema.is
 */
export const isComputedFiscalPeriod = Schema.is(ComputedFiscalPeriod)

/**
 * Month names for display
 */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

/**
 * Compute the fiscal year boundaries for a given fiscal year number
 *
 * @param fiscalYear - The fiscal year number (year in which the FY ends)
 * @param fiscalYearEnd - The fiscal year end date setting
 * @returns Object with start and end dates of the fiscal year
 */
function computeFiscalYearBoundaries(
  fiscalYear: number,
  fiscalYearEnd: FiscalYearEnd
): { start: LocalDate; end: LocalDate } {
  // Fiscal year ends on the specified month/day in the fiscal year number
  const endYear = fiscalYear
  const endMonth = fiscalYearEnd.month
  const endDay = Math.min(fiscalYearEnd.day, daysInMonth(endYear, endMonth))

  // Fiscal year starts the day after the previous fiscal year end
  // For calendar year (Dec 31), FY2024 is Jan 1, 2024 - Dec 31, 2024
  // For June 30 end, FY2024 is July 1, 2023 - June 30, 2024
  let startYear: number
  let startMonth: number
  let startDay: number

  if (endMonth === 12 && endDay === 31) {
    // Calendar year: starts Jan 1 of the same year
    startYear = fiscalYear
    startMonth = 1
    startDay = 1
  } else {
    // Non-calendar year: starts day after previous FY end
    // Previous FY ends on endMonth/endDay of (fiscalYear - 1)
    const prevEndMonth = endMonth
    const prevEndDay = Math.min(endDay, daysInMonth(fiscalYear - 1, prevEndMonth))

    // Day after the previous FY end
    const prevEndDate = new Date(Date.UTC(fiscalYear - 1, prevEndMonth - 1, prevEndDay))
    prevEndDate.setUTCDate(prevEndDate.getUTCDate() + 1)

    startYear = prevEndDate.getUTCFullYear()
    startMonth = prevEndDate.getUTCMonth() + 1
    startDay = prevEndDate.getUTCDate()
  }

  return {
    start: LocalDate.make({ year: startYear, month: startMonth, day: startDay }),
    end: LocalDate.make({ year: endYear, month: endMonth, day: endDay })
  }
}

/**
 * Compute the fiscal period for a given date
 *
 * @param date - The date to compute the fiscal period for (LocalDate or ISO string)
 * @param fiscalYearEnd - The company's fiscal year end setting
 * @returns The computed fiscal period
 */
export function computeFiscalPeriod(
  date: LocalDate | string,
  fiscalYearEnd: FiscalYearEnd
): ComputedFiscalPeriod {
  // Convert string to LocalDate if needed
  const localDate = typeof date === "string" ? parseDateString(date) : date

  // Determine which fiscal year this date falls into
  const fiscalYear = determineFiscalYear(localDate, fiscalYearEnd)

  // Get the fiscal year boundaries
  const fyBounds = computeFiscalYearBoundaries(fiscalYear, fiscalYearEnd)

  // Determine which period (1-12) this date falls into
  const { periodNumber, periodStart, periodEnd } = determinePeriodInFiscalYear(
    localDate,
    fyBounds.start,
    fyBounds.end
  )

  // Generate period names
  const periodName = `P${periodNumber}`
  const periodDisplayName = `${MONTH_NAMES[periodStart.month - 1]} ${periodStart.year}`

  return ComputedFiscalPeriod.make({
    fiscalYear,
    periodNumber,
    periodName,
    periodDisplayName,
    periodStartDate: periodStart,
    periodEndDate: periodEnd,
    fiscalYearStart: fyBounds.start,
    fiscalYearEnd: fyBounds.end
  })
}

/**
 * Parse an ISO date string (YYYY-MM-DD) to LocalDate
 */
function parseDateString(dateStr: string): LocalDate {
  const [yearStr, monthStr, dayStr] = dateStr.split("-")
  return LocalDate.make({
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10)
  })
}

/**
 * Determine which fiscal year a date falls into
 */
function determineFiscalYear(date: LocalDate, fiscalYearEnd: FiscalYearEnd): number {
  const { month: fyEndMonth, day: fyEndDay } = fiscalYearEnd

  // Check if we're past the fiscal year end date in the current calendar year
  const isPastFYEnd =
    date.month > fyEndMonth ||
    (date.month === fyEndMonth && date.day > fyEndDay)

  if (fyEndMonth === 12 && fyEndDay === 31) {
    // Calendar year: FY = calendar year
    return date.year
  }

  // For non-calendar fiscal years:
  // If we're past the FY end in the current calendar year, we're in the NEXT fiscal year
  // e.g., July 15, 2023 with June 30 FY end -> FY2024 (which runs July 1, 2023 - June 30, 2024)
  return isPastFYEnd ? date.year + 1 : date.year
}

/**
 * Determine which period (1-12) a date falls into within a fiscal year
 */
function determinePeriodInFiscalYear(
  date: LocalDate,
  fyStart: LocalDate,
  fyEnd: LocalDate
): { periodNumber: number; periodStart: LocalDate; periodEnd: LocalDate } {
  // Calculate number of months from FY start to the date's month
  // Period 1 is the first month, Period 2 is the second month, etc.

  let currentPeriodStart = fyStart
  let periodNumber = 1

  while (periodNumber <= 12) {
    // Calculate end of this period (last day of the month, or FY end if P12)
    let periodEndMonth = currentPeriodStart.month
    let periodEndYear = currentPeriodStart.year
    let periodEndDay = daysInMonth(periodEndYear, periodEndMonth)

    // For Period 12, cap at FY end date
    if (periodNumber === 12) {
      periodEndYear = fyEnd.year
      periodEndMonth = fyEnd.month
      periodEndDay = fyEnd.day
    }

    const periodEnd = LocalDate.make({ year: periodEndYear, month: periodEndMonth, day: periodEndDay })

    // Check if date falls within this period
    const dateValue = dateToNumber(date)
    const periodStartValue = dateToNumber(currentPeriodStart)
    const periodEndValue = dateToNumber(periodEnd)

    if (dateValue >= periodStartValue && dateValue <= periodEndValue) {
      return {
        periodNumber,
        periodStart: currentPeriodStart,
        periodEnd
      }
    }

    // Move to next period (first day of next month)
    if (periodNumber < 12) {
      const nextMonth = currentPeriodStart.month === 12 ? 1 : currentPeriodStart.month + 1
      const nextYear = currentPeriodStart.month === 12 ? currentPeriodStart.year + 1 : currentPeriodStart.year
      currentPeriodStart = LocalDate.make({ year: nextYear, month: nextMonth, day: 1 })
    }

    periodNumber++
  }

  // Fallback (should not reach here for valid dates within FY)
  // Return period 12 as default
  return {
    periodNumber: 12,
    periodStart: fyStart,
    periodEnd: fyEnd
  }
}

/**
 * Convert LocalDate to a comparable number (YYYYMMDD)
 */
function dateToNumber(date: LocalDate): number {
  return date.year * 10000 + date.month * 100 + date.day
}

/**
 * Get all fiscal periods for a fiscal year
 *
 * @param fiscalYear - The fiscal year number
 * @param fiscalYearEnd - The company's fiscal year end setting
 * @returns Array of 12 computed fiscal periods
 */
export function getAllPeriodsForFiscalYear(
  fiscalYear: number,
  fiscalYearEnd: FiscalYearEnd
): ReadonlyArray<ComputedFiscalPeriod> {
  const fyBounds = computeFiscalYearBoundaries(fiscalYear, fiscalYearEnd)
  const periods: ComputedFiscalPeriod[] = []

  let currentPeriodStart = fyBounds.start

  for (let periodNumber = 1; periodNumber <= 12; periodNumber++) {
    // Calculate end of this period
    let periodEndMonth = currentPeriodStart.month
    let periodEndYear = currentPeriodStart.year
    let periodEndDay = daysInMonth(periodEndYear, periodEndMonth)

    // For Period 12, cap at FY end date
    if (periodNumber === 12) {
      periodEndYear = fyBounds.end.year
      periodEndMonth = fyBounds.end.month
      periodEndDay = fyBounds.end.day
    }

    const periodEnd = LocalDate.make({ year: periodEndYear, month: periodEndMonth, day: periodEndDay })
    const periodName = `P${periodNumber}`
    const periodDisplayName = `${MONTH_NAMES[currentPeriodStart.month - 1]} ${currentPeriodStart.year}`

    periods.push(ComputedFiscalPeriod.make({
      fiscalYear,
      periodNumber,
      periodName,
      periodDisplayName,
      periodStartDate: currentPeriodStart,
      periodEndDate: periodEnd,
      fiscalYearStart: fyBounds.start,
      fiscalYearEnd: fyBounds.end
    }))

    // Move to next period (first day of next month)
    if (periodNumber < 12) {
      const nextMonth = currentPeriodStart.month === 12 ? 1 : currentPeriodStart.month + 1
      const nextYear = currentPeriodStart.month === 12 ? currentPeriodStart.year + 1 : currentPeriodStart.year
      currentPeriodStart = LocalDate.make({ year: nextYear, month: nextMonth, day: 1 })
    }
  }

  return periods
}

/**
 * Format a computed fiscal period for display in the UI
 *
 * @param period - The computed fiscal period
 * @returns Formatted string like "P3 FY2024 (March 2024)"
 */
export function formatFiscalPeriodForDisplay(period: ComputedFiscalPeriod): string {
  return `${period.periodName} FY${period.fiscalYear} (${period.periodDisplayName})`
}
