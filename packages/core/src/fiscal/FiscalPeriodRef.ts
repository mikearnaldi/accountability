/**
 * FiscalPeriodRef - Reference to a fiscal period value object
 *
 * A Schema.Struct representing a reference to a specific fiscal period
 * within a fiscal year. Consists of a year number and period (1-13).
 * Period 13 is used for year-end adjusting entries.
 *
 * @module fiscal/FiscalPeriodRef
 */

import * as Order from "effect/Order"
import * as Schema from "effect/Schema"

/**
 * FiscalPeriodRef - A Schema.Class representing a fiscal period reference
 *
 * Contains:
 * - year: The fiscal year (e.g., 2025)
 * - period: The period within the year (1-13, where 13 is for adjustments)
 */
export class FiscalPeriodRef extends Schema.Class<FiscalPeriodRef>("FiscalPeriodRef")({
  year: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1900),
    Schema.lessThanOrEqualTo(2999),
    Schema.annotations({
      description: "The fiscal year (e.g., 2025)"
    })
  ),
  period: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
    Schema.lessThanOrEqualTo(13),
    Schema.annotations({
      description: "The period within the fiscal year (1-12 for months, 13 for adjustments)"
    })
  )
}) {
  /**
   * Check if this is a regular period (1-12)
   */
  get isRegularPeriod(): boolean {
    return this.period >= 1 && this.period <= 12
  }

  /**
   * Check if this is an adjustment period (13)
   */
  get isAdjustmentPeriod(): boolean {
    return this.period === 13
  }

  /**
   * Format as a display string (e.g., "FY2025-P01")
   */
  toString(): string {
    const paddedPeriod = String(this.period).padStart(2, "0")
    return `FY${this.year}-P${paddedPeriod}`
  }

  /**
   * Format as a short display string (e.g., "2025.01")
   */
  toShortString(): string {
    const paddedPeriod = String(this.period).padStart(2, "0")
    return `${this.year}.${paddedPeriod}`
  }
}

/**
 * Type guard for FiscalPeriodRef using Schema.is
 */
export const isFiscalPeriodRef = Schema.is(FiscalPeriodRef)

/**
 * Order for FiscalPeriodRef - compares chronologically (year first, then period)
 */
export const Order_: Order.Order<FiscalPeriodRef> = Order.make((a, b) => {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1
  if (a.period !== b.period) return a.period < b.period ? -1 : 1
  return 0
})

/**
 * Check if first period is before second
 */
export const isBefore = (a: FiscalPeriodRef, b: FiscalPeriodRef): boolean => {
  return Order_(a, b) === -1
}

/**
 * Check if first period is after second
 */
export const isAfter = (a: FiscalPeriodRef, b: FiscalPeriodRef): boolean => {
  return Order_(a, b) === 1
}

/**
 * Check if two period refs are equal
 */
export const equals = (a: FiscalPeriodRef, b: FiscalPeriodRef): boolean => {
  return a.year === b.year && a.period === b.period
}

/**
 * Get the next fiscal period
 * If current period is 12, advances to period 1 of next year
 * Period 13 (adjustment) advances to period 1 of next year
 */
export const nextPeriod = (ref: FiscalPeriodRef): FiscalPeriodRef => {
  if (ref.period >= 12) {
    return FiscalPeriodRef.make({ year: ref.year + 1, period: 1 })
  }
  return FiscalPeriodRef.make({ year: ref.year, period: ref.period + 1 })
}

/**
 * Get the previous fiscal period
 * If current period is 1, goes to period 12 of previous year
 * Period 13 goes to period 12 of same year
 */
export const previousPeriod = (ref: FiscalPeriodRef): FiscalPeriodRef => {
  if (ref.period === 13) {
    return FiscalPeriodRef.make({ year: ref.year, period: 12 })
  }
  if (ref.period === 1) {
    return FiscalPeriodRef.make({ year: ref.year - 1, period: 12 })
  }
  return FiscalPeriodRef.make({ year: ref.year, period: ref.period - 1 })
}

/**
 * Get the first period of the fiscal year
 */
export const startOfYear = (year: number): FiscalPeriodRef => {
  return FiscalPeriodRef.make({ year, period: 1 })
}

/**
 * Get the last regular period (12) of the fiscal year
 */
export const endOfYear = (year: number): FiscalPeriodRef => {
  return FiscalPeriodRef.make({ year, period: 12 })
}

/**
 * Get the adjustment period (13) of the fiscal year
 */
export const adjustmentPeriod = (year: number): FiscalPeriodRef => {
  return FiscalPeriodRef.make({ year, period: 13 })
}

/**
 * Get all regular periods (1-12) for a fiscal year
 */
export const allRegularPeriods = (year: number): ReadonlyArray<FiscalPeriodRef> => {
  return Array.from({ length: 12 }, (_, i) => FiscalPeriodRef.make({ year, period: i + 1 }))
}

/**
 * Get all periods (1-13) for a fiscal year including adjustment period
 */
export const allPeriods = (year: number): ReadonlyArray<FiscalPeriodRef> => {
  return Array.from({ length: 13 }, (_, i) => FiscalPeriodRef.make({ year, period: i + 1 }))
}

/**
 * Check if a period is within a range (inclusive)
 */
export const isWithinRange = (
  ref: FiscalPeriodRef,
  start: FiscalPeriodRef,
  end: FiscalPeriodRef
): boolean => {
  return !isBefore(ref, start) && !isAfter(ref, end)
}

/**
 * Get the number of periods between two fiscal period refs (inclusive)
 * Only counts regular periods (1-12)
 */
export const periodsBetween = (start: FiscalPeriodRef, end: FiscalPeriodRef): number => {
  if (isAfter(start, end)) {
    return 0
  }
  const startPeriod = start.period > 12 ? 12 : start.period
  const endPeriod = end.period > 12 ? 12 : end.period
  return (end.year - start.year) * 12 + (endPeriod - startPeriod) + 1
}
