/**
 * FiscalPeriodType - Type of a fiscal period
 *
 * Defines the types of fiscal periods:
 * - 'Regular': Standard monthly period (1-12)
 * - 'Adjustment': Period 13 for year-end adjusting entries
 * - 'Closing': Special period for year-end closing entries
 *
 * @module fiscal/FiscalPeriodType
 */

import * as Schema from "effect/Schema"

/**
 * FiscalPeriodType - The type of a fiscal period
 */
export const FiscalPeriodType = Schema.Literal(
  "Regular",
  "Adjustment",
  "Closing"
).annotations({
  identifier: "FiscalPeriodType",
  title: "Fiscal Period Type",
  description: "The type of fiscal period"
})

/**
 * The FiscalPeriodType type
 */
export type FiscalPeriodType = typeof FiscalPeriodType.Type

/**
 * Type guard for FiscalPeriodType using Schema.is
 */
export const isFiscalPeriodType = Schema.is(FiscalPeriodType)

/**
 * All valid FiscalPeriodType values
 */
export const FiscalPeriodTypeValues: readonly FiscalPeriodType[] = [
  "Regular",
  "Adjustment",
  "Closing"
] as const
