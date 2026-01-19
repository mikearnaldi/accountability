/**
 * Percentage - Value object for percentage values (0-100)
 *
 * A branded type representing a valid percentage value constrained to 0-100.
 * Supports decimal values (e.g., 12.5%, 99.99%).
 * Uses Schema.brand for compile-time type safety.
 *
 * @module shared/values/Percentage
 */

import * as Schema from "effect/Schema"

/**
 * Schema for a valid percentage value.
 * Must be a number between 0 and 100 (inclusive).
 * Supports decimal values.
 */
export const Percentage = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("Percentage"),
  Schema.annotations({
    identifier: "Percentage",
    title: "Percentage",
    description: "A percentage value between 0 and 100 (inclusive)"
  })
)

/**
 * The branded Percentage type
 */
export type Percentage = typeof Percentage.Type

/**
 * Type guard for Percentage using Schema.is
 */
export const isPercentage = Schema.is(Percentage)

/**
 * Common percentage values
 * Using Schema's .make() constructor which validates by default
 */
export const ZERO: Percentage = Percentage.make(0)
export const TWENTY: Percentage = Percentage.make(20)
export const FIFTY: Percentage = Percentage.make(50)
export const HUNDRED: Percentage = Percentage.make(100)

/**
 * Convert percentage to decimal (0-1 range)
 * E.g., 50% -> 0.5
 */
export const toDecimal = (percentage: Percentage): number => percentage / 100

/**
 * Convert decimal (0-1 range) to percentage
 * E.g., 0.5 -> 50%
 * Note: Uses Schema's .make() for validation
 */
export const fromDecimal = (decimal: number): Percentage => Percentage.make(decimal * 100)

/**
 * Check if percentage is zero
 */
export const isZero = (percentage: Percentage): boolean => percentage === 0

/**
 * Check if percentage is 100%
 */
export const isFull = (percentage: Percentage): boolean => percentage === 100

/**
 * Get the complement of a percentage (100 - value)
 * E.g., 30% -> 70%
 */
export const complement = (percentage: Percentage): Percentage => Percentage.make(100 - percentage)

/**
 * Format percentage as a display string
 */
export const format = (percentage: Percentage, decimalPlaces: number = 2): string => {
  return `${percentage.toFixed(decimalPlaces)}%`
}
