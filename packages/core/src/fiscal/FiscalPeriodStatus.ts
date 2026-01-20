/**
 * FiscalPeriodStatus - Status of a fiscal period
 *
 * Defines the possible states for a fiscal period:
 * - 'Future': Period hasn't started yet (future dates)
 * - 'Open': Period is active and accepts journal entries
 * - 'SoftClose': Period is soft-closed (limited entry allowed with approval)
 * - 'Closed': Period is closed (no entries allowed)
 * - 'Locked': Period is permanently locked (requires special unlock)
 *
 * @module fiscal/FiscalPeriodStatus
 */

import * as Schema from "effect/Schema"

/**
 * FiscalPeriodStatus - The status of a fiscal period
 *
 * Workflow: Future -> Open -> SoftClose -> Closed -> Locked
 * (with ability to reopen from Closed/Locked with proper authorization)
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
  "Future",
  "Open",
  "SoftClose",
  "Closed",
  "Locked"
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
  return status === "Open" || status === "SoftClose"
}

/**
 * Check if a period can be transitioned to a new status
 *
 * Valid transitions:
 * - Future -> Open
 * - Open -> SoftClose
 * - SoftClose -> Closed
 * - Closed -> Locked
 * - SoftClose -> Open (reopen)
 * - Closed -> Open (reopen - requires special authorization)
 * - Locked -> Open (reopen - requires special authorization: fiscal_period:reopen)
 */
export function canTransitionTo(
  currentStatus: FiscalPeriodStatus,
  newStatus: FiscalPeriodStatus
): boolean {
  if (currentStatus === newStatus) return false

  const validTransitions: Record<FiscalPeriodStatus, readonly FiscalPeriodStatus[]> = {
    Future: ["Open"],
    Open: ["SoftClose"],
    SoftClose: ["Closed", "Open"],
    Closed: ["Locked", "Open"],
    Locked: ["Open"] // reopen - requires special authorization (fiscal_period:reopen)
  }

  return validTransitions[currentStatus].includes(newStatus)
}
