/**
 * FiscalYearStatus - Status of a fiscal year
 *
 * Defines the possible states for a fiscal year:
 * - 'Open': Fiscal year is active and periods can be managed
 * - 'Closing': Year-end close is in progress
 * - 'Closed': Fiscal year has been closed (no new entries allowed)
 *
 * @module fiscal/FiscalYearStatus
 */

import * as Schema from "effect/Schema"

/**
 * FiscalYearStatus - The status of a fiscal year
 *
 * Workflow: Open -> Closing -> Closed
 */
export const FiscalYearStatus = Schema.Literal(
  "Open",
  "Closing",
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
  "Closing",
  "Closed"
] as const
