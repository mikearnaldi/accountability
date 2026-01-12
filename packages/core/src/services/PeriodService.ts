/**
 * PeriodService - Effect service for fiscal year and period management
 *
 * Implements fiscal year creation with auto-generated periods per specs/ACCOUNTING_RESEARCH.md:
 * - Creates fiscal years with 12 monthly periods based on company fiscal settings
 * - Optional period 13 (adjustment period) support
 * - Validates that fiscal years don't overlap for the same company
 *
 * Uses Context.Tag and Layer patterns for dependency injection.
 *
 * @module PeriodService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import * as Schema from "effect/Schema"
import type { FiscalYearEnd } from "../Domains/Company.ts";
import { CompanyId } from "../Domains/Company.ts"
import { LocalDate, addMonths, daysInMonth } from "../Domains/LocalDate.ts"
import { Timestamp, nowEffect as timestampNowEffect } from "../Domains/Timestamp.ts"
import { UserId, JournalEntryId } from "../Domains/JournalEntry.ts"
import { AccountId, AccountType } from "../Domains/Account.ts"
import { MonetaryAmount } from "../Domains/MonetaryAmount.ts"
import type { CurrencyCode } from "../Domains/CurrencyCode.ts"

// Re-export UserId for convenience
export { UserId }

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
 * Per specs/ACCOUNTING_RESEARCH.md:
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
 * Per specs/ACCOUNTING_RESEARCH.md:
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
 * Per specs/ACCOUNTING_RESEARCH.md:
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
 * Per specs/ACCOUNTING_RESEARCH.md Fiscal Period structure:
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
 * Per specs/ACCOUNTING_RESEARCH.md Fiscal Year structure:
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
 * Error when a fiscal period is not found
 */
export class PeriodNotFoundError extends Schema.TaggedError<PeriodNotFoundError>()(
  "PeriodNotFoundError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId"))
  }
) {
  get message(): string {
    return `Fiscal period not found: ${this.periodId}`
  }
}

/**
 * Type guard for PeriodNotFoundError
 */
export const isPeriodNotFoundError = Schema.is(PeriodNotFoundError)

/**
 * Error when attempting to close a period that has draft journal entries
 */
export class HasDraftEntriesError extends Schema.TaggedError<HasDraftEntriesError>()(
  "HasDraftEntriesError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId")),
    draftEntryCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))
  }
) {
  get message(): string {
    return `Cannot close period ${this.periodId}: ${this.draftEntryCount} draft entries exist`
  }
}

/**
 * Type guard for HasDraftEntriesError
 */
export const isHasDraftEntriesError = Schema.is(HasDraftEntriesError)

/**
 * Error when attempting to close an already closed period
 */
export class AlreadyClosedError extends Schema.TaggedError<AlreadyClosedError>()(
  "AlreadyClosedError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId")),
    currentStatus: FiscalPeriodStatus
  }
) {
  get message(): string {
    return `Period ${this.periodId} is already ${this.currentStatus}`
  }
}

/**
 * Type guard for AlreadyClosedError
 */
export const isAlreadyClosedError = Schema.is(AlreadyClosedError)

/**
 * Error when attempting to open a period that is not in Future status
 */
export class PeriodNotFutureError extends Schema.TaggedError<PeriodNotFutureError>()(
  "PeriodNotFutureError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId")),
    currentStatus: FiscalPeriodStatus
  }
) {
  get message(): string {
    return `Cannot open period ${this.periodId}: current status is ${this.currentStatus}, must be Future`
  }
}

/**
 * Type guard for PeriodNotFutureError
 */
export const isPeriodNotFutureError = Schema.is(PeriodNotFutureError)

/**
 * Error when attempting to open a period that is Locked
 */
export class PeriodLockedError extends Schema.TaggedError<PeriodLockedError>()(
  "PeriodLockedError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId"))
  }
) {
  get message(): string {
    return `Period ${this.periodId} is locked and cannot be modified`
  }
}

/**
 * Type guard for PeriodLockedError
 */
export const isPeriodLockedError = Schema.is(PeriodLockedError)

/**
 * Error when attempting to reopen a period that is not Closed
 */
export class PeriodNotClosedError extends Schema.TaggedError<PeriodNotClosedError>()(
  "PeriodNotClosedError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId")),
    currentStatus: FiscalPeriodStatus
  }
) {
  get message(): string {
    return `Cannot reopen period ${this.periodId}: current status is ${this.currentStatus}, must be Closed`
  }
}

/**
 * Type guard for PeriodNotClosedError
 */
export const isPeriodNotClosedError = Schema.is(PeriodNotClosedError)

/**
 * Error when attempting to soft close a period that is not Open
 */
export class PeriodNotOpenError extends Schema.TaggedError<PeriodNotOpenError>()(
  "PeriodNotOpenError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId")),
    currentStatus: FiscalPeriodStatus
  }
) {
  get message(): string {
    return `Cannot modify period ${this.periodId}: current status is ${this.currentStatus}, must be Open`
  }
}

/**
 * Type guard for PeriodNotOpenError
 */
export const isPeriodNotOpenError = Schema.is(PeriodNotOpenError)

/**
 * Error when attempting to close from SoftClose but not fully validated
 */
export class SoftCloseNotApprovedError extends Schema.TaggedError<SoftCloseNotApprovedError>()(
  "SoftCloseNotApprovedError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId"))
  }
) {
  get message(): string {
    return `Period ${this.periodId} soft close requires approval before full close`
  }
}

/**
 * Type guard for SoftCloseNotApprovedError
 */
export const isSoftCloseNotApprovedError = Schema.is(SoftCloseNotApprovedError)

/**
 * Error when reopen reason is required but not provided
 */
export class ReopenReasonRequiredError extends Schema.TaggedError<ReopenReasonRequiredError>()(
  "ReopenReasonRequiredError",
  {
    periodId: Schema.UUID.pipe(Schema.brand("FiscalPeriodId"))
  }
) {
  get message(): string {
    return `Reopening period ${this.periodId} requires a reason for audit trail`
  }
}

/**
 * Type guard for ReopenReasonRequiredError
 */
export const isReopenReasonRequiredError = Schema.is(ReopenReasonRequiredError)

/**
 * Error when attempting to close a year that is not in Open status
 */
export class YearNotOpenError extends Schema.TaggedError<YearNotOpenError>()(
  "YearNotOpenError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")),
    currentStatus: FiscalYearStatus
  }
) {
  get message(): string {
    return `Cannot close year ${this.fiscalYearId}: current status is ${this.currentStatus}, must be Open`
  }
}

/**
 * Type guard for YearNotOpenError
 */
export const isYearNotOpenError = Schema.is(YearNotOpenError)

/**
 * Error when a fiscal year is not found by ID
 */
export class FiscalYearNotFoundByIdError extends Schema.TaggedError<FiscalYearNotFoundByIdError>()(
  "FiscalYearNotFoundByIdError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId"))
  }
) {
  get message(): string {
    return `Fiscal year not found: ${this.fiscalYearId}`
  }
}

/**
 * Type guard for FiscalYearNotFoundByIdError
 */
export const isFiscalYearNotFoundByIdError = Schema.is(FiscalYearNotFoundByIdError)

/**
 * Error when attempting to reopen a year that is not in Closed status
 */
export class YearNotClosedError extends Schema.TaggedError<YearNotClosedError>()(
  "YearNotClosedError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")),
    currentStatus: FiscalYearStatus
  }
) {
  get message(): string {
    return `Cannot reopen year ${this.fiscalYearId}: current status is ${this.currentStatus}, must be Closed`
  }
}

/**
 * Type guard for YearNotClosedError
 */
export const isYearNotClosedError = Schema.is(YearNotClosedError)

/**
 * Error when reopen reason is required for year but not provided
 */
export class YearReopenReasonRequiredError extends Schema.TaggedError<YearReopenReasonRequiredError>()(
  "YearReopenReasonRequiredError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId"))
  }
) {
  get message(): string {
    return `Reopening fiscal year ${this.fiscalYearId} requires a reason for audit trail`
  }
}

/**
 * Type guard for YearReopenReasonRequiredError
 */
export const isYearReopenReasonRequiredError = Schema.is(YearReopenReasonRequiredError)

/**
 * Error when retained earnings account is not valid
 */
export class InvalidRetainedEarningsAccountError extends Schema.TaggedError<InvalidRetainedEarningsAccountError>()(
  "InvalidRetainedEarningsAccountError",
  {
    accountId: Schema.UUID.pipe(Schema.brand("AccountId")),
    reason: Schema.String
  }
) {
  get message(): string {
    return `Invalid retained earnings account ${this.accountId}: ${this.reason}`
  }
}

/**
 * Type guard for InvalidRetainedEarningsAccountError
 */
export const isInvalidRetainedEarningsAccountError = Schema.is(InvalidRetainedEarningsAccountError)

/**
 * Error when there are open periods that need to be closed first
 */
export class OpenPeriodsExistError extends Schema.TaggedError<OpenPeriodsExistError>()(
  "OpenPeriodsExistError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")),
    openPeriodCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1))
  }
) {
  get message(): string {
    return `Cannot close year ${this.fiscalYearId}: ${this.openPeriodCount} periods are still open`
  }
}

/**
 * Type guard for OpenPeriodsExistError
 */
export const isOpenPeriodsExistError = Schema.is(OpenPeriodsExistError)

/**
 * Error when closing entries not found for reversing
 */
export class ClosingEntriesNotFoundError extends Schema.TaggedError<ClosingEntriesNotFoundError>()(
  "ClosingEntriesNotFoundError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId"))
  }
) {
  get message(): string {
    return `Closing entries not found for fiscal year ${this.fiscalYearId}`
  }
}

/**
 * Type guard for ClosingEntriesNotFoundError
 */
export const isClosingEntriesNotFoundError = Schema.is(ClosingEntriesNotFoundError)

/**
 * Union type for all period service errors
 */
export type PeriodServiceError =
  | FiscalYearOverlapError
  | FiscalYearNotFoundError
  | CompanyNotFoundError
  | InvalidFiscalYearConfigError
  | PeriodNotFoundError
  | HasDraftEntriesError
  | AlreadyClosedError
  | PeriodNotFutureError
  | PeriodLockedError
  | PeriodNotClosedError
  | PeriodNotOpenError
  | SoftCloseNotApprovedError
  | ReopenReasonRequiredError
  | YearNotOpenError
  | FiscalYearNotFoundByIdError
  | YearNotClosedError
  | YearReopenReasonRequiredError
  | InvalidRetainedEarningsAccountError
  | OpenPeriodsExistError
  | ClosingEntriesNotFoundError

// =============================================================================
// Audit Entry for Period Reopening
// =============================================================================

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
 * Type guard for PeriodReopenAuditEntryId using Schema.is
 */
export const isPeriodReopenAuditEntryId = Schema.is(PeriodReopenAuditEntryId)

/**
 * PeriodReopenAuditEntry - Audit trail entry for period reopening
 *
 * Per specs/ACCOUNTING_RESEARCH.md: reopenPeriod with audit trail (requires reason)
 */
export class PeriodReopenAuditEntry extends Schema.Class<PeriodReopenAuditEntry>("PeriodReopenAuditEntry")({
  /**
   * Unique identifier for the audit entry
   */
  id: PeriodReopenAuditEntryId,

  /**
   * Reference to the fiscal period that was reopened
   */
  periodId: FiscalPeriodId,

  /**
   * The reason for reopening the period (required for audit)
   */
  reason: Schema.NonEmptyTrimmedString,

  /**
   * User who reopened the period
   */
  reopenedBy: UserId,

  /**
   * Timestamp when the period was reopened
   */
  reopenedAt: Timestamp,

  /**
   * Previous status before reopening
   */
  previousStatus: FiscalPeriodStatus
}) {
  /**
   * Format as a display string
   */
  toString(): string {
    return `Period ${this.periodId} reopened by ${this.reopenedBy}: ${this.reason}`
  }
}

/**
 * Type guard for PeriodReopenAuditEntry using Schema.is
 */
export const isPeriodReopenAuditEntry = Schema.is(PeriodReopenAuditEntry)

// =============================================================================
// Year-End Close Types
// =============================================================================

/**
 * YearEndClosingEntryId - Branded UUID string for closing entry identification
 */
export const YearEndClosingEntryId = Schema.UUID.pipe(
  Schema.brand("YearEndClosingEntryId"),
  Schema.annotations({
    identifier: "YearEndClosingEntryId",
    title: "Year End Closing Entry ID",
    description: "A unique identifier for a year-end closing entry (UUID format)"
  })
)

/**
 * The branded YearEndClosingEntryId type
 */
export type YearEndClosingEntryId = typeof YearEndClosingEntryId.Type

/**
 * Type guard for YearEndClosingEntryId using Schema.is
 */
export const isYearEndClosingEntryId = Schema.is(YearEndClosingEntryId)

/**
 * ClosingEntryType - Type of closing entry
 *
 * - RevenueClose: Closes revenue accounts to retained earnings
 * - ExpenseClose: Closes expense accounts to retained earnings
 * - OpeningBalance: Opening balance for new year (balance sheet accounts)
 */
export const ClosingEntryType = Schema.Literal(
  "RevenueClose",
  "ExpenseClose",
  "OpeningBalance"
).annotations({
  identifier: "ClosingEntryType",
  title: "Closing Entry Type",
  description: "Type of year-end closing entry"
})

/**
 * The ClosingEntryType type
 */
export type ClosingEntryType = typeof ClosingEntryType.Type

/**
 * Type guard for ClosingEntryType using Schema.is
 */
export const isClosingEntryType = Schema.is(ClosingEntryType)

/**
 * ClosingEntry - A single closing journal entry line
 *
 * Represents one line in a closing journal entry, containing:
 * - Account to debit or credit
 * - Amount and currency
 * - Description of the closing entry
 */
export class ClosingEntry extends Schema.Class<ClosingEntry>("ClosingEntry")({
  /**
   * The account ID being closed
   */
  accountId: AccountId,

  /**
   * The account type (for reference)
   */
  accountType: AccountType,

  /**
   * Debit amount (positive value if debiting)
   */
  debitAmount: MonetaryAmount,

  /**
   * Credit amount (positive value if crediting)
   */
  creditAmount: MonetaryAmount,

  /**
   * Description of the closing entry
   */
  description: Schema.String
}) {}

/**
 * Type guard for ClosingEntry using Schema.is
 */
export const isClosingEntry = Schema.is(ClosingEntry)

/**
 * AccountBalance - Represents the balance of an account
 */
export interface AccountBalance {
  readonly accountId: AccountId
  readonly accountType: AccountType
  readonly balance: MonetaryAmount
}

/**
 * ClosingJournalEntry - A complete closing journal entry
 */
export class ClosingJournalEntry extends Schema.Class<ClosingJournalEntry>("ClosingJournalEntry")({
  /**
   * Journal entry ID
   */
  journalEntryId: JournalEntryId,

  /**
   * Type of closing entry
   */
  entryType: ClosingEntryType,

  /**
   * Entry description
   */
  description: Schema.String,

  /**
   * The closing entry lines
   */
  lines: Schema.Array(ClosingEntry),

  /**
   * Total debit amount
   */
  totalDebit: MonetaryAmount,

  /**
   * Total credit amount
   */
  totalCredit: MonetaryAmount
}) {}

/**
 * Type guard for ClosingJournalEntry using Schema.is
 */
export const isClosingJournalEntry = Schema.is(ClosingJournalEntry)

/**
 * YearEndResult - Result of closing a fiscal year
 *
 * Contains all closing entries generated during the year-end close process.
 */
export class YearEndResult extends Schema.Class<YearEndResult>("YearEndResult")({
  /**
   * The fiscal year that was closed
   */
  fiscalYear: FiscalYear,

  /**
   * Revenue closing entries (credits to retained earnings)
   */
  revenueClosingEntries: Schema.Array(ClosingEntry),

  /**
   * Expense closing entries (debits to retained earnings)
   */
  expenseClosingEntries: Schema.Array(ClosingEntry),

  /**
   * Net income (total revenue credits - total expense debits)
   */
  netIncome: MonetaryAmount,

  /**
   * Opening balance entries for the new year (balance sheet accounts)
   */
  openingBalanceEntries: Schema.Array(ClosingEntry),

  /**
   * The closing journal entries created
   */
  closingJournalEntries: Schema.Array(ClosingJournalEntry),

  /**
   * User who performed the close
   */
  closedBy: UserId,

  /**
   * Timestamp when the year was closed
   */
  closedAt: Timestamp
}) {
  /**
   * Total revenue closed
   */
  get totalRevenue(): MonetaryAmount {
    return Array.reduce(
      this.revenueClosingEntries,
      MonetaryAmount.make({ amount: BigDecimal.fromNumber(0), currency: this.netIncome.currency }),
      (acc, entry) => MonetaryAmount.make({
        amount: BigDecimal.sum(acc.amount, entry.creditAmount.amount),
        currency: acc.currency
      })
    )
  }

  /**
   * Total expenses closed
   */
  get totalExpenses(): MonetaryAmount {
    return Array.reduce(
      this.expenseClosingEntries,
      MonetaryAmount.make({ amount: BigDecimal.fromNumber(0), currency: this.netIncome.currency }),
      (acc, entry) => MonetaryAmount.make({
        amount: BigDecimal.sum(acc.amount, entry.debitAmount.amount),
        currency: acc.currency
      })
    )
  }
}

/**
 * Type guard for YearEndResult using Schema.is
 */
export const isYearEndResult = Schema.is(YearEndResult)

/**
 * YearReopenResult - Result of reopening a closed fiscal year
 */
export class YearReopenResult extends Schema.Class<YearReopenResult>("YearReopenResult")({
  /**
   * The fiscal year that was reopened
   */
  fiscalYear: FiscalYear,

  /**
   * Reversing journal entries created
   */
  reversingJournalEntries: Schema.Array(ClosingJournalEntry),

  /**
   * User who performed the reopen
   */
  reopenedBy: UserId,

  /**
   * Reason for reopening
   */
  reason: Schema.NonEmptyTrimmedString,

  /**
   * Timestamp when the year was reopened
   */
  reopenedAt: Timestamp
}) {}

/**
 * Type guard for YearReopenResult using Schema.is
 */
export const isYearReopenResult = Schema.is(YearReopenResult)

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

  /**
   * Find a fiscal period by ID
   * @param periodId - The period ID
   * @returns Effect containing the period or None if not found
   */
  readonly findPeriodById: (
    periodId: FiscalPeriodId
  ) => Effect.Effect<Option.Option<FiscalPeriod>>

  /**
   * Update a fiscal period
   * @param period - The updated period
   * @returns Effect containing the saved period
   */
  readonly updatePeriod: (period: FiscalPeriod) => Effect.Effect<FiscalPeriod>

  /**
   * Count draft journal entries in a fiscal period
   * @param periodId - The period ID
   * @returns Effect containing the count of draft entries
   */
  readonly countDraftEntriesInPeriod: (periodId: FiscalPeriodId) => Effect.Effect<number>

  /**
   * Save a period reopen audit entry
   * @param auditEntry - The audit entry to save
   * @returns Effect containing the saved audit entry
   */
  readonly saveReopenAuditEntry: (
    auditEntry: PeriodReopenAuditEntry
  ) => Effect.Effect<PeriodReopenAuditEntry>

  /**
   * Find a fiscal year by ID
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect containing the fiscal year or None if not found
   */
  readonly findFiscalYearById: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<Option.Option<FiscalYear>>

  /**
   * Update a fiscal year
   * @param fiscalYear - The updated fiscal year
   * @returns Effect containing the saved fiscal year
   */
  readonly updateFiscalYear: (fiscalYear: FiscalYear) => Effect.Effect<FiscalYear>

  /**
   * Get all periods for a fiscal year
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect containing the periods
   */
  readonly getPeriodsForFiscalYear: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<ReadonlyArray<FiscalPeriod>>

  /**
   * Get account balances for year-end close
   * @param fiscalYearId - The fiscal year to get balances for
   * @param accountTypes - Filter by account types (Revenue, Expense, etc.)
   * @returns Effect containing account balances
   */
  readonly getAccountBalances: (
    fiscalYearId: FiscalYearId,
    accountTypes: ReadonlyArray<AccountType>
  ) => Effect.Effect<ReadonlyArray<AccountBalance>>

  /**
   * Validate retained earnings account
   * @param accountId - The account ID to validate
   * @returns Effect containing the account type if valid
   */
  readonly validateRetainedEarningsAccount: (
    accountId: AccountId
  ) => Effect.Effect<Option.Option<AccountType>>

  /**
   * Get company currency for the fiscal year
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect containing the currency code
   */
  readonly getCompanyCurrency: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<CurrencyCode>

  /**
   * Save closing journal entries
   * @param fiscalYearId - The fiscal year ID
   * @param entries - The closing journal entries
   * @returns Effect containing the saved entries
   */
  readonly saveClosingJournalEntries: (
    fiscalYearId: FiscalYearId,
    entries: ReadonlyArray<ClosingJournalEntry>
  ) => Effect.Effect<ReadonlyArray<ClosingJournalEntry>>

  /**
   * Get closing journal entries for a fiscal year
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect containing the closing entries
   */
  readonly getClosingJournalEntries: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<ReadonlyArray<ClosingJournalEntry>>

  /**
   * Delete closing journal entries for a fiscal year
   * @param fiscalYearId - The fiscal year ID
   * @returns Effect indicating success
   */
  readonly deleteClosingJournalEntries: (
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<void>
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

/**
 * OpenPeriodInput - Input for opening a fiscal period
 */
export interface OpenPeriodInput {
  /** The ID of the period to open */
  readonly periodId: FiscalPeriodId
}

/**
 * ClosePeriodInput - Input for closing a fiscal period
 */
export interface ClosePeriodInput {
  /** The ID of the period to close */
  readonly periodId: FiscalPeriodId
  /** User closing the period */
  readonly closedBy: typeof UserId.Type
}

/**
 * SoftClosePeriodInput - Input for soft closing a fiscal period
 */
export interface SoftClosePeriodInput {
  /** The ID of the period to soft close */
  readonly periodId: FiscalPeriodId
  /** User soft closing the period */
  readonly closedBy: typeof UserId.Type
}

/**
 * ReopenPeriodInput - Input for reopening a closed fiscal period
 */
export interface ReopenPeriodInput {
  /** The ID of the period to reopen */
  readonly periodId: FiscalPeriodId
  /** User reopening the period */
  readonly reopenedBy: typeof UserId.Type
  /** Reason for reopening (required for audit trail) */
  readonly reason: string
  /** ID for the audit entry */
  readonly auditEntryId: PeriodReopenAuditEntryId
}

/**
 * ReopenPeriodResult - Result of reopening a fiscal period
 */
export interface ReopenPeriodResult {
  /** The reopened period */
  readonly period: FiscalPeriod
  /** The audit trail entry */
  readonly auditEntry: PeriodReopenAuditEntry
}

/**
 * CloseYearInput - Input for closing a fiscal year
 */
export interface CloseYearInput {
  /** The ID of the fiscal year to close */
  readonly fiscalYearId: FiscalYearId
  /** The retained earnings account ID to close income/expense to */
  readonly retainedEarningsAccountId: AccountId
  /** User performing the close */
  readonly closedBy: typeof UserId.Type
  /** Journal entry IDs for the closing entries */
  readonly closingJournalEntryIds: ReadonlyArray<JournalEntryId>
}

/**
 * ReopenYearInput - Input for reopening a closed fiscal year
 */
export interface ReopenYearInput {
  /** The ID of the fiscal year to reopen */
  readonly fiscalYearId: FiscalYearId
  /** User performing the reopen */
  readonly reopenedBy: typeof UserId.Type
  /** Reason for reopening (required for audit trail) */
  readonly reason: string
  /** Journal entry IDs for the reversing entries */
  readonly reversingJournalEntryIds: ReadonlyArray<JournalEntryId>
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

  /**
   * Open a fiscal period for posting
   *
   * Changes a period from Future status to Open.
   * Only periods in Future status can be opened.
   *
   * @param input - The period to open
   * @returns Effect containing the opened period
   * @throws PeriodNotFoundError if the period doesn't exist
   * @throws PeriodNotFutureError if the period is not in Future status
   */
  readonly openPeriod: (
    input: OpenPeriodInput
  ) => Effect.Effect<
    FiscalPeriod,
    PeriodNotFoundError | PeriodNotFutureError,
    never
  >

  /**
   * Close a fiscal period
   *
   * Changes a period from Open or SoftClose status to Closed.
   * Validates that no draft journal entries exist before closing.
   *
   * @param input - The period to close and user closing it
   * @returns Effect containing the closed period
   * @throws PeriodNotFoundError if the period doesn't exist
   * @throws PeriodNotOpenError if the period is not Open or SoftClose
   * @throws HasDraftEntriesError if draft entries exist in the period
   * @throws PeriodLockedError if the period is locked
   * @throws AlreadyClosedError if the period is already closed
   */
  readonly closePeriod: (
    input: ClosePeriodInput
  ) => Effect.Effect<
    FiscalPeriod,
    PeriodNotFoundError | PeriodNotOpenError | HasDraftEntriesError | PeriodLockedError | AlreadyClosedError,
    never
  >

  /**
   * Soft close a fiscal period for limited posting
   *
   * Changes a period from Open status to SoftClose.
   * In SoftClose status, posting requires approval.
   *
   * @param input - The period to soft close and user closing it
   * @returns Effect containing the soft closed period
   * @throws PeriodNotFoundError if the period doesn't exist
   * @throws PeriodNotOpenError if the period is not in Open status
   * @throws PeriodLockedError if the period is locked
   * @throws AlreadyClosedError if the period is already closed or soft closed
   */
  readonly softClosePeriod: (
    input: SoftClosePeriodInput
  ) => Effect.Effect<
    FiscalPeriod,
    PeriodNotFoundError | PeriodNotOpenError | PeriodLockedError | AlreadyClosedError,
    never
  >

  /**
   * Reopen a closed fiscal period
   *
   * Changes a period from Closed status back to Open.
   * Requires a reason for audit trail.
   * Cannot reopen Locked periods.
   *
   * @param input - The period to reopen, user, and reason
   * @returns Effect containing the reopened period and audit entry
   * @throws PeriodNotFoundError if the period doesn't exist
   * @throws PeriodNotClosedError if the period is not in Closed status
   * @throws PeriodLockedError if the period is locked
   * @throws ReopenReasonRequiredError if no reason is provided
   */
  readonly reopenPeriod: (
    input: ReopenPeriodInput
  ) => Effect.Effect<
    ReopenPeriodResult,
    PeriodNotFoundError | PeriodNotClosedError | PeriodLockedError | ReopenReasonRequiredError,
    never
  >

  /**
   * Close a fiscal year
   *
   * Performs the year-end closing process:
   * - Validates all periods are closed
   * - Generates closing entries for revenue accounts (credit to retained earnings)
   * - Generates closing entries for expense accounts (debit to retained earnings)
   * - Calculates net income (total revenue credits - total expense debits)
   * - Generates opening balances for the new year (balance sheet accounts)
   * - Updates fiscal year status to Closed
   *
   * @param input - The close year input
   * @returns Effect containing the year-end result
   * @throws FiscalYearNotFoundByIdError if the fiscal year doesn't exist
   * @throws YearNotOpenError if the fiscal year is not in Open status
   * @throws OpenPeriodsExistError if there are open periods
   * @throws InvalidRetainedEarningsAccountError if the RE account is invalid
   */
  readonly closeYear: (
    input: CloseYearInput
  ) => Effect.Effect<
    YearEndResult,
    FiscalYearNotFoundByIdError | YearNotOpenError | OpenPeriodsExistError | InvalidRetainedEarningsAccountError,
    never
  >

  /**
   * Reopen a closed fiscal year
   *
   * Reverses the year-end closing process:
   * - Creates reversing entries for all closing entries
   * - Updates fiscal year status back to Open
   * - Requires a reason for audit trail
   *
   * @param input - The reopen year input
   * @returns Effect containing the year reopen result
   * @throws FiscalYearNotFoundByIdError if the fiscal year doesn't exist
   * @throws YearNotClosedError if the fiscal year is not in Closed status
   * @throws YearReopenReasonRequiredError if no reason is provided
   * @throws ClosingEntriesNotFoundError if no closing entries are found
   */
  readonly reopenYear: (
    input: ReopenYearInput
  ) => Effect.Effect<
    YearReopenResult,
    FiscalYearNotFoundByIdError | YearNotClosedError | YearReopenReasonRequiredError | ClosingEntriesNotFoundError,
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

  return LocalDate.make({ year: endYear, month: fiscalYearEnd.month, day: endDay })
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

    let periodEnd = LocalDate.make({ year: periodEndYear, month: periodEndMonth, day: maxDay })

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
      currentStart = LocalDate.make({ year: currentStart.year, month: currentStart.month, day: 1 })
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
      }),

    openPeriod: (input: OpenPeriodInput) =>
      Effect.gen(function* () {
        const { periodId } = input

        // Find the period
        const periodOption = yield* repository.findPeriodById(periodId)

        if (Option.isNone(periodOption)) {
          return yield* Effect.fail(new PeriodNotFoundError({ periodId }))
        }

        const period = periodOption.value

        // Validate period is in Future status
        if (period.status !== "Future") {
          return yield* Effect.fail(
            new PeriodNotFutureError({
              periodId,
              currentStatus: period.status
            })
          )
        }

        // Update period status to Open
        const updatedPeriod = FiscalPeriod.make({
          ...period,
          status: "Open"
        })

        // Save and return the updated period
        return yield* repository.updatePeriod(updatedPeriod)
      }),

    closePeriod: (input: ClosePeriodInput) =>
      Effect.gen(function* () {
        const { periodId, closedBy } = input

        // Find the period
        const periodOption = yield* repository.findPeriodById(periodId)

        if (Option.isNone(periodOption)) {
          return yield* Effect.fail(new PeriodNotFoundError({ periodId }))
        }

        const period = periodOption.value

        // Check if period is locked
        if (period.status === "Locked") {
          return yield* Effect.fail(new PeriodLockedError({ periodId }))
        }

        // Check if period is already closed
        if (period.status === "Closed") {
          return yield* Effect.fail(
            new AlreadyClosedError({
              periodId,
              currentStatus: period.status
            })
          )
        }

        // Validate period is Open or SoftClose
        if (period.status !== "Open" && period.status !== "SoftClose") {
          return yield* Effect.fail(
            new PeriodNotOpenError({
              periodId,
              currentStatus: period.status
            })
          )
        }

        // Check for draft entries
        const draftEntryCount = yield* repository.countDraftEntriesInPeriod(periodId)

        if (draftEntryCount > 0) {
          return yield* Effect.fail(
            new HasDraftEntriesError({
              periodId,
              draftEntryCount
            })
          )
        }

        // Get current timestamp
        const now = yield* timestampNowEffect

        // Update period status to Closed
        const updatedPeriod = FiscalPeriod.make({
          ...period,
          status: "Closed",
          closedBy: Option.some(closedBy),
          closedAt: Option.some(now)
        })

        // Save and return the updated period
        return yield* repository.updatePeriod(updatedPeriod)
      }),

    softClosePeriod: (input: SoftClosePeriodInput) =>
      Effect.gen(function* () {
        const { periodId, closedBy } = input

        // Find the period
        const periodOption = yield* repository.findPeriodById(periodId)

        if (Option.isNone(periodOption)) {
          return yield* Effect.fail(new PeriodNotFoundError({ periodId }))
        }

        const period = periodOption.value

        // Check if period is locked
        if (period.status === "Locked") {
          return yield* Effect.fail(new PeriodLockedError({ periodId }))
        }

        // Check if period is already closed or soft closed
        if (period.status === "Closed" || period.status === "SoftClose") {
          return yield* Effect.fail(
            new AlreadyClosedError({
              periodId,
              currentStatus: period.status
            })
          )
        }

        // Validate period is Open
        if (period.status !== "Open") {
          return yield* Effect.fail(
            new PeriodNotOpenError({
              periodId,
              currentStatus: period.status
            })
          )
        }

        // Get current timestamp
        const now = yield* timestampNowEffect

        // Update period status to SoftClose
        const updatedPeriod = FiscalPeriod.make({
          ...period,
          status: "SoftClose",
          closedBy: Option.some(closedBy),
          closedAt: Option.some(now)
        })

        // Save and return the updated period
        return yield* repository.updatePeriod(updatedPeriod)
      }),

    reopenPeriod: (input: ReopenPeriodInput) =>
      Effect.gen(function* () {
        const { periodId, reopenedBy, reason, auditEntryId } = input

        // Validate reason is provided
        if (!reason || reason.trim().length === 0) {
          return yield* Effect.fail(new ReopenReasonRequiredError({ periodId }))
        }

        // Find the period
        const periodOption = yield* repository.findPeriodById(periodId)

        if (Option.isNone(periodOption)) {
          return yield* Effect.fail(new PeriodNotFoundError({ periodId }))
        }

        const period = periodOption.value

        // Check if period is locked
        if (period.status === "Locked") {
          return yield* Effect.fail(new PeriodLockedError({ periodId }))
        }

        // Validate period is Closed
        if (period.status !== "Closed") {
          return yield* Effect.fail(
            new PeriodNotClosedError({
              periodId,
              currentStatus: period.status
            })
          )
        }

        // Get current timestamp
        const now = yield* timestampNowEffect

        // Create audit entry
        const auditEntry = PeriodReopenAuditEntry.make({
          id: auditEntryId,
          periodId,
          reason: Schema.NonEmptyTrimmedString.make(reason.trim()),
          reopenedBy,
          reopenedAt: now,
          previousStatus: period.status
        })

        // Update period status to Open
        const updatedPeriod = FiscalPeriod.make({
          ...period,
          status: "Open",
          closedBy: Option.none(),
          closedAt: Option.none()
        })

        // Save audit entry and updated period
        const savedAuditEntry = yield* repository.saveReopenAuditEntry(auditEntry)
        const savedPeriod = yield* repository.updatePeriod(updatedPeriod)

        return {
          period: savedPeriod,
          auditEntry: savedAuditEntry
        } satisfies ReopenPeriodResult
      }),

    closeYear: (input: CloseYearInput) =>
      Effect.gen(function* () {
        const { fiscalYearId, retainedEarningsAccountId, closedBy, closingJournalEntryIds } = input

        // Find the fiscal year
        const fiscalYearOption = yield* repository.findFiscalYearById(fiscalYearId)

        if (Option.isNone(fiscalYearOption)) {
          return yield* Effect.fail(new FiscalYearNotFoundByIdError({ fiscalYearId }))
        }

        const fiscalYear = fiscalYearOption.value

        // Validate fiscal year is in Open status
        if (fiscalYear.status !== "Open") {
          return yield* Effect.fail(
            new YearNotOpenError({
              fiscalYearId,
              currentStatus: fiscalYear.status
            })
          )
        }

        // Validate all periods are closed
        const periods = yield* repository.getPeriodsForFiscalYear(fiscalYearId)
        const openPeriods = Array.filter(periods, (p) =>
          p.status === "Open" || p.status === "SoftClose" || p.status === "Future"
        )

        if (openPeriods.length > 0) {
          return yield* Effect.fail(
            new OpenPeriodsExistError({
              fiscalYearId,
              openPeriodCount: openPeriods.length
            })
          )
        }

        // Validate retained earnings account
        const reAccountType = yield* repository.validateRetainedEarningsAccount(retainedEarningsAccountId)

        if (Option.isNone(reAccountType)) {
          return yield* Effect.fail(
            new InvalidRetainedEarningsAccountError({
              accountId: retainedEarningsAccountId,
              reason: "Account not found"
            })
          )
        }

        if (reAccountType.value !== "Equity") {
          return yield* Effect.fail(
            new InvalidRetainedEarningsAccountError({
              accountId: retainedEarningsAccountId,
              reason: `Account must be an Equity account, got ${reAccountType.value}`
            })
          )
        }

        // Get company currency
        const currency = yield* repository.getCompanyCurrency(fiscalYearId)

        // Create zero amount for initialization
        const zeroAmount = MonetaryAmount.make({
          amount: BigDecimal.fromNumber(0),
          currency
        })

        // Get revenue account balances
        const revenueBalances = yield* repository.getAccountBalances(fiscalYearId, ["Revenue"])

        // Get expense account balances
        const expenseBalances = yield* repository.getAccountBalances(fiscalYearId, ["Expense"])

        // Get balance sheet account balances for opening entries
        const balanceSheetBalances = yield* repository.getAccountBalances(
          fiscalYearId,
          ["Asset", "Liability", "Equity"]
        )

        // Generate revenue closing entries (debit revenue, credit RE)
        // Revenue accounts have credit balances, so we debit to close them
        const revenueClosingEntries = Array.map(revenueBalances, (balance) =>
          ClosingEntry.make({
            accountId: balance.accountId,
            accountType: balance.accountType,
            debitAmount: balance.balance,
            creditAmount: zeroAmount,
            description: `Close revenue account to Retained Earnings`
          })
        )

        // Calculate total revenue (sum of all revenue balances)
        const totalRevenue = Array.reduce(
          revenueBalances,
          zeroAmount,
          (acc, balance) => MonetaryAmount.make({
            amount: BigDecimal.sum(acc.amount, balance.balance.amount),
            currency: acc.currency
          })
        )

        // Generate expense closing entries (credit expense, debit RE)
        // Expense accounts have debit balances, so we credit to close them
        const expenseClosingEntries = Array.map(expenseBalances, (balance) =>
          ClosingEntry.make({
            accountId: balance.accountId,
            accountType: balance.accountType,
            debitAmount: zeroAmount,
            creditAmount: balance.balance,
            description: `Close expense account to Retained Earnings`
          })
        )

        // Calculate total expenses (sum of all expense balances)
        const totalExpenses = Array.reduce(
          expenseBalances,
          zeroAmount,
          (acc, balance) => MonetaryAmount.make({
            amount: BigDecimal.sum(acc.amount, balance.balance.amount),
            currency: acc.currency
          })
        )

        // Calculate net income = revenue - expenses
        const netIncome = MonetaryAmount.make({
          amount: BigDecimal.subtract(totalRevenue.amount, totalExpenses.amount),
          currency
        })

        // Generate opening balance entries for balance sheet accounts
        const openingBalanceEntries = Array.map(balanceSheetBalances, (balance) => {
          const isDebitBalance = balance.accountType === "Asset"
          return ClosingEntry.make({
            accountId: balance.accountId,
            accountType: balance.accountType,
            debitAmount: isDebitBalance ? balance.balance : zeroAmount,
            creditAmount: isDebitBalance ? zeroAmount : balance.balance,
            description: `Opening balance for new fiscal year`
          })
        })

        // Create closing journal entries
        const closingJournalEntries: ClosingJournalEntry[] = []

        // Revenue closing entry
        if (revenueClosingEntries.length > 0 && closingJournalEntryIds.length > 0) {
          // Create the RE credit entry for total revenue
          const reRevenueEntry = ClosingEntry.make({
            accountId: retainedEarningsAccountId,
            accountType: "Equity",
            debitAmount: zeroAmount,
            creditAmount: totalRevenue,
            description: `Credit Retained Earnings for revenue close`
          })

          closingJournalEntries.push(
            ClosingJournalEntry.make({
              journalEntryId: closingJournalEntryIds[0],
              entryType: "RevenueClose",
              description: `Close revenue accounts to Retained Earnings for ${fiscalYear.name}`,
              lines: [...revenueClosingEntries, reRevenueEntry],
              totalDebit: totalRevenue,
              totalCredit: totalRevenue
            })
          )
        }

        // Expense closing entry
        if (expenseClosingEntries.length > 0 && closingJournalEntryIds.length > 1) {
          // Create the RE debit entry for total expenses
          const reExpenseEntry = ClosingEntry.make({
            accountId: retainedEarningsAccountId,
            accountType: "Equity",
            debitAmount: totalExpenses,
            creditAmount: zeroAmount,
            description: `Debit Retained Earnings for expense close`
          })

          closingJournalEntries.push(
            ClosingJournalEntry.make({
              journalEntryId: closingJournalEntryIds[1],
              entryType: "ExpenseClose",
              description: `Close expense accounts to Retained Earnings for ${fiscalYear.name}`,
              lines: [...expenseClosingEntries, reExpenseEntry],
              totalDebit: totalExpenses,
              totalCredit: totalExpenses
            })
          )
        }

        // Opening balance entry
        if (openingBalanceEntries.length > 0 && closingJournalEntryIds.length > 2) {
          const totalOpeningDebit = Array.reduce(
            openingBalanceEntries,
            zeroAmount,
            (acc, entry) => MonetaryAmount.make({
              amount: BigDecimal.sum(acc.amount, entry.debitAmount.amount),
              currency: acc.currency
            })
          )

          const totalOpeningCredit = Array.reduce(
            openingBalanceEntries,
            zeroAmount,
            (acc, entry) => MonetaryAmount.make({
              amount: BigDecimal.sum(acc.amount, entry.creditAmount.amount),
              currency: acc.currency
            })
          )

          closingJournalEntries.push(
            ClosingJournalEntry.make({
              journalEntryId: closingJournalEntryIds[2],
              entryType: "OpeningBalance",
              description: `Opening balances for new fiscal year after ${fiscalYear.name}`,
              lines: openingBalanceEntries,
              totalDebit: totalOpeningDebit,
              totalCredit: totalOpeningCredit
            })
          )
        }

        // Save closing journal entries
        yield* repository.saveClosingJournalEntries(fiscalYearId, closingJournalEntries)

        // Get current timestamp
        const now = yield* timestampNowEffect

        // Update fiscal year status to Closed
        const closedFiscalYear = FiscalYear.make({
          ...fiscalYear,
          status: "Closed"
        })

        yield* repository.updateFiscalYear(closedFiscalYear)

        return YearEndResult.make({
          fiscalYear: closedFiscalYear,
          revenueClosingEntries,
          expenseClosingEntries,
          netIncome,
          openingBalanceEntries,
          closingJournalEntries,
          closedBy,
          closedAt: now
        })
      }),

    reopenYear: (input: ReopenYearInput) =>
      Effect.gen(function* () {
        const { fiscalYearId, reopenedBy, reason, reversingJournalEntryIds } = input

        // Validate reason is provided
        if (!reason || reason.trim().length === 0) {
          return yield* Effect.fail(new YearReopenReasonRequiredError({ fiscalYearId }))
        }

        // Find the fiscal year
        const fiscalYearOption = yield* repository.findFiscalYearById(fiscalYearId)

        if (Option.isNone(fiscalYearOption)) {
          return yield* Effect.fail(new FiscalYearNotFoundByIdError({ fiscalYearId }))
        }

        const fiscalYear = fiscalYearOption.value

        // Validate fiscal year is in Closed status
        if (fiscalYear.status !== "Closed") {
          return yield* Effect.fail(
            new YearNotClosedError({
              fiscalYearId,
              currentStatus: fiscalYear.status
            })
          )
        }

        // Get closing journal entries
        const closingEntries = yield* repository.getClosingJournalEntries(fiscalYearId)

        if (closingEntries.length === 0) {
          return yield* Effect.fail(new ClosingEntriesNotFoundError({ fiscalYearId }))
        }

        // Get company currency
        yield* repository.getCompanyCurrency(fiscalYearId)

        // Create reversing journal entries (swap debits and credits)
        const reversingJournalEntries = closingEntries.map((entry, index) => {
          // Reverse each line: swap debit and credit
          const reversedLines = Array.map(entry.lines, (line: ClosingEntry) =>
            ClosingEntry.make({
              accountId: line.accountId,
              accountType: line.accountType,
              debitAmount: line.creditAmount,
              creditAmount: line.debitAmount,
              description: `Reverse: ${line.description}`
            })
          )

          // Determine entry type based on original
          const entryType = entry.entryType

          return ClosingJournalEntry.make({
            journalEntryId: index < reversingJournalEntryIds.length
              ? reversingJournalEntryIds[index]
              : entry.journalEntryId,
            entryType,
            description: `Reverse ${entry.description}`,
            lines: reversedLines,
            totalDebit: entry.totalCredit,
            totalCredit: entry.totalDebit
          })
        })

        // Delete original closing journal entries
        yield* repository.deleteClosingJournalEntries(fiscalYearId)

        // Get current timestamp
        const now = yield* timestampNowEffect

        // Update fiscal year status to Open
        const reopenedFiscalYear = FiscalYear.make({
          ...fiscalYear,
          status: "Open"
        })

        yield* repository.updateFiscalYear(reopenedFiscalYear)

        return YearReopenResult.make({
          fiscalYear: reopenedFiscalYear,
          reversingJournalEntries,
          reopenedBy,
          reason: Schema.NonEmptyTrimmedString.make(reason.trim()),
          reopenedAt: now
        })
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
