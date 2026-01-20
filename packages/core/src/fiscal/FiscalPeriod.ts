/**
 * FiscalPeriod - Fiscal period entity for period management
 *
 * Represents a fiscal period within a fiscal year with status tracking,
 * enabling period close/lock functionality for authorization enforcement.
 *
 * Period statuses support the "Locked Period Protection" authorization policy:
 * - Future: Period hasn't started
 * - Open: Normal operations allowed
 * - SoftClose: Limited operations with approval
 * - Closed: No modifications allowed
 * - Locked: Permanently locked (requires special unlock)
 *
 * @module fiscal/FiscalPeriod
 */

import * as Schema from "effect/Schema"
import { FiscalYearId } from "./FiscalYear.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"
import { FiscalPeriodStatus } from "./FiscalPeriodStatus.ts"
import { FiscalPeriodType } from "./FiscalPeriodType.ts"

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

/**
 * UserId schema for closed_by reference (used in FiscalPeriod)
 * Exported so it can be used in repository layer
 */
export const FiscalPeriodUserId = Schema.UUID.pipe(
  Schema.brand("UserId"),
  Schema.annotations({
    identifier: "UserId",
    title: "User ID",
    description: "A unique identifier for a user (UUID format)"
  })
)

/**
 * The branded UserId type for FiscalPeriod
 */
export type FiscalPeriodUserId = typeof FiscalPeriodUserId.Type

/**
 * PeriodReopenAuditEntryId - Branded UUID string for audit entry identification
 */
export const PeriodReopenAuditEntryId = Schema.UUID.pipe(
  Schema.brand("PeriodReopenAuditEntryId"),
  Schema.annotations({
    identifier: "PeriodReopenAuditEntryId",
    title: "Period Reopen Audit Entry ID",
    description: "A unique identifier for a period reopen audit entry (UUID format)"
  })
)

/**
 * The branded PeriodReopenAuditEntryId type
 */
export type PeriodReopenAuditEntryId = typeof PeriodReopenAuditEntryId.Type

/**
 * FiscalPeriod - Represents a fiscal period within a fiscal year
 *
 * Each period has a status that determines what operations are allowed.
 * The status workflow is: Future -> Open -> SoftClose -> Closed -> Locked
 *
 * The period status is critical for the "Locked Period Protection" system policy,
 * which prevents journal entry modifications in locked periods.
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
   * 1-12 are regular monthly periods, 13 is for adjustments
   */
  periodNumber: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
    Schema.lessThanOrEqualTo(13),
    Schema.annotations({
      description: "Period number within the fiscal year (1-13)"
    })
  ),

  /**
   * Display name for the period (e.g., "January 2025" or "P1")
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Period Name",
    description: "Display name for the fiscal period"
  }),

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
   * User who closed this period (if closed)
   */
  closedBy: Schema.OptionFromNullOr(FiscalPeriodUserId).annotations({
    title: "Closed By",
    description: "User who closed this period"
  }),

  /**
   * When the period was closed (if closed)
   */
  closedAt: Schema.OptionFromNullOr(Timestamp).annotations({
    title: "Closed At",
    description: "When this period was closed"
  }),

  /**
   * When the fiscal period was created
   */
  createdAt: Timestamp,

  /**
   * When the fiscal period was last updated
   */
  updatedAt: Timestamp
}) {
  /**
   * Check if this is a regular monthly period (1-12)
   */
  get isRegularPeriod(): boolean {
    return this.periodType === "Regular"
  }

  /**
   * Check if this is an adjustment period (period 13)
   */
  get isAdjustmentPeriod(): boolean {
    return this.periodType === "Adjustment"
  }

  /**
   * Check if the period is open for normal operations
   */
  get isOpen(): boolean {
    return this.status === "Open"
  }

  /**
   * Check if the period is closed
   */
  get isClosed(): boolean {
    return this.status === "Closed"
  }

  /**
   * Check if the period allows new journal entries
   */
  get allowsJournalEntries(): boolean {
    return this.status === "Open"
  }

  /**
   * Check if the period allows any modifications
   */
  get allowsModifications(): boolean {
    return this.status === "Open"
  }

  /**
   * Check if the period is protected (closed)
   */
  get isProtected(): boolean {
    return this.status === "Closed"
  }

  /**
   * Format as a display string (e.g., "P1 (Open)")
   */
  toString(): string {
    return `P${this.periodNumber} (${this.status})`
  }

  /**
   * Format as a short reference (e.g., "P1")
   */
  toShortString(): string {
    return `P${this.periodNumber}`
  }
}

/**
 * Type guard for FiscalPeriod using Schema.is
 */
export const isFiscalPeriod = Schema.is(FiscalPeriod)

/**
 * PeriodReopenAuditEntry - Audit record for period reopening
 *
 * Tracks when periods are reopened with the reason and previous status,
 * providing an audit trail for compliance.
 */
export class PeriodReopenAuditEntry extends Schema.Class<PeriodReopenAuditEntry>("PeriodReopenAuditEntry")({
  /**
   * Unique identifier for the audit entry
   */
  id: PeriodReopenAuditEntryId,

  /**
   * The fiscal period that was reopened
   */
  periodId: FiscalPeriodId,

  /**
   * Reason for reopening the period
   */
  reason: Schema.NonEmptyTrimmedString.annotations({
    title: "Reason",
    description: "Reason for reopening the period"
  }),

  /**
   * User who reopened the period
   */
  reopenedBy: FiscalPeriodUserId,

  /**
   * When the period was reopened
   */
  reopenedAt: Timestamp,

  /**
   * The status the period had before being reopened
   */
  previousStatus: FiscalPeriodStatus
}) {}

/**
 * Type guard for PeriodReopenAuditEntry using Schema.is
 */
export const isPeriodReopenAuditEntry = Schema.is(PeriodReopenAuditEntry)
