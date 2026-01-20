/**
 * FiscalPeriodStatus - Status of a fiscal period
 *
 * Defines the possible states for a fiscal period:
 * - 'Open': Period is active and accepts journal entries
 * - 'Closed': Period is closed (no entries allowed)
 *
 * This simplified 2-state model replaces the previous 5-state model
 * (Future, Open, SoftClose, Closed, Locked) for better usability.
 *
 * @module fiscal/FiscalPeriodStatus
 */

import * as Schema from "effect/Schema"

/**
 * FiscalPeriodStatus - The status of a fiscal period
 *
 * Simple 2-state workflow: Open ←→ Closed
 * A period is either open for entries or it's not.
 */
export const FiscalPeriodStatus = Schema.Literal(
  "Open",
  "Closed"
).annotations({
  identifier: "FiscalPeriodStatus",
  title: "Fiscal Period Status",
  description: "The status of a fiscal period"
})

/**
 * The FiscalPeriodStatus type
 */
export type FiscalPeriodStatus = typeof FiscalPeriodStatus.Type

/**
 * Type guard for FiscalPeriodStatus using Schema.is
 */
export const isFiscalPeriodStatus = Schema.is(FiscalPeriodStatus)

/**
 * All valid FiscalPeriodStatus values
 */
export const FiscalPeriodStatusValues: readonly FiscalPeriodStatus[] = [
  "Open",
  "Closed"
] as const

/**
 * Check if a status allows new journal entries
 */
export function statusAllowsJournalEntries(status: FiscalPeriodStatus): boolean {
  return status === "Open"
}

/**
 * Check if a status allows modifications (with proper authorization)
 */
export function statusAllowsModifications(status: FiscalPeriodStatus): boolean {
  return status === "Open"
}

/**
 * Check if a period can be transitioned to a new status
 *
 * With the simplified 2-state model, you can always toggle between Open and Closed.
 */
export function canTransitionTo(
  currentStatus: FiscalPeriodStatus,
  newStatus: FiscalPeriodStatus
): boolean {
  // Can always toggle between Open and Closed
  return currentStatus !== newStatus
}
