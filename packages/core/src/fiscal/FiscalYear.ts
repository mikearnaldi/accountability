/**
 * FiscalYear - Fiscal year entity for period management
 *
 * Represents a fiscal year for a company with status tracking,
 * enabling period close/lock functionality for authorization enforcement.
 *
 * @module fiscal/FiscalYear
 */

import * as Schema from "effect/Schema"
import { CompanyId } from "../company/Company.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"
import { FiscalYearStatus } from "./FiscalYearStatus.ts"

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
 * FiscalYear - Represents a fiscal year for a company
 *
 * Tracks the status of a fiscal year (Open/Closed) and contains
 * the date boundaries for the year. Fiscal periods are linked to fiscal years.
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
   * Display name for the fiscal year (e.g., "FY 2025")
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Fiscal Year Name",
    description: "Display name for the fiscal year"
  }),

  /**
   * The fiscal year number (e.g., 2025)
   * Named after the calendar year in which the fiscal year ends
   */
  year: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1900),
    Schema.lessThanOrEqualTo(2999),
    Schema.annotations({
      description: "The fiscal year number"
    })
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
  includesAdjustmentPeriod: Schema.Boolean.annotations({
    title: "Includes Adjustment Period",
    description: "Whether period 13 exists for year-end adjustments"
  }),

  /**
   * When the fiscal year was created
   */
  createdAt: Timestamp,

  /**
   * When the fiscal year was last updated
   */
  updatedAt: Timestamp
}) {
  /**
   * Check if the fiscal year is open for transactions
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
   * Format as a display string (e.g., "FY 2025 (Open)")
   */
  toString(): string {
    return `FY ${this.year} (${this.status})`
  }
}

/**
 * Type guard for FiscalYear using Schema.is
 */
export const isFiscalYear = Schema.is(FiscalYear)
