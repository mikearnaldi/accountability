/**
 * FiscalYearStatus - Status of a fiscal year
 *
 * Defines the possible states for a fiscal year:
 * - 'Open': Fiscal year is active, accepts journal entries
 * - 'Closed': Fiscal year has been closed (no new entries allowed)
 *
 * Note: The intermediate "Closing" state has been removed for simplicity.
 * Year-end close is now a single atomic operation with preview functionality.
 *
 * @module fiscal/FiscalYearStatus
 */

import * as Schema from "effect/Schema"

/**
 * FiscalYearStatus - The status of a fiscal year
 *
 * Simple 2-state model: Open ←→ Closed
 */
export const FiscalYearStatus = Schema.Literal(
  "Open",
  "Closed"
).annotations({
  identifier: "FiscalYearStatus",
  title: "Fiscal Year Status",
  description: "The status of a fiscal year"
})

/**
 * The FiscalYearStatus type
 */
export type FiscalYearStatus = typeof FiscalYearStatus.Type

/**
 * Type guard for FiscalYearStatus using Schema.is
 */
export const isFiscalYearStatus = Schema.is(FiscalYearStatus)

/**
 * All valid FiscalYearStatus values
 */
export const FiscalYearStatusValues: readonly FiscalYearStatus[] = [
  "Open",
  "Closed"
] as const
