/**
 * EquityStatementService - Statement of Changes in Equity Report generation service
 *
 * Implements statement of changes in equity per specs/ACCOUNTING_RESEARCH.md Phase 3.5:
 * - EquityStatementReport schema with component columns and movement rows
 * - generateEquityStatement: (companyId, periodStart, periodEnd) -> Effect<EquityStatementReport>
 * - Columns: Common Stock, APIC, Retained Earnings, Treasury Stock, AOCI, NCI (if consolidated)
 * - Rows: Opening Balance, Net Income, OCI, Dividends, Stock Issuance/Repurchase, Closing Balance
 * - Column totals and row totals
 *
 * The Statement of Changes in Equity shows movements in each equity component:
 * 1. Opening balances for each component
 * 2. Changes during the period (net income, OCI, dividends, stock transactions)
 * 3. Closing balances for each component
 *
 * @module EquityStatementService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import * as Schema from "effect/Schema"
import type {
  Account} from "../accounting/Account.ts";
import {
  getNormalBalanceForType
} from "../accounting/Account.ts"
import { CompanyId } from "../company/Company.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { Timestamp, nowEffect as timestampNowEffect } from "../shared/values/Timestamp.ts"
import type { JournalEntryWithLines } from "../accounting/AccountBalance.ts"
import {
  calculateBalance,
  calculatePeriodBalance
} from "../accounting/AccountBalance.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when company is not found
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
 * Error for invalid period (start date after end date)
 */
export class InvalidPeriodError extends Schema.TaggedError<InvalidPeriodError>()(
  "InvalidPeriodError",
  {
    periodStart: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    periodEnd: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    })
  }
) {
  get message(): string {
    const startStr = `${this.periodStart.year}-${String(this.periodStart.month).padStart(2, "0")}-${String(this.periodStart.day).padStart(2, "0")}`
    const endStr = `${this.periodEnd.year}-${String(this.periodEnd.month).padStart(2, "0")}-${String(this.periodEnd.day).padStart(2, "0")}`
    return `Invalid period: start date ${startStr} is after end date ${endStr}`
  }
}

/**
 * Type guard for InvalidPeriodError
 */
export const isInvalidPeriodError = Schema.is(InvalidPeriodError)

/**
 * Union type for all equity statement service errors
 */
export type EquityStatementServiceError =
  | CompanyNotFoundError
  | InvalidPeriodError

// =============================================================================
// Equity Component Types
// =============================================================================

/**
 * EquityComponentType - The main equity component columns in the statement
 *
 * Per the acceptance criteria:
 * - Common Stock: Par value of issued common shares
 * - APIC: Additional Paid-In Capital (premium over par)
 * - Retained Earnings: Accumulated profits not distributed as dividends
 * - Treasury Stock: Cost of shares repurchased (contra-equity)
 * - AOCI: Accumulated Other Comprehensive Income
 * - NCI: Non-Controlling Interest (for consolidated statements)
 */
export const EquityComponentType = Schema.Literal(
  "CommonStock",
  "APIC",
  "RetainedEarnings",
  "TreasuryStock",
  "AOCI",
  "NCI"
).annotations({
  identifier: "EquityComponentType",
  title: "Equity Component Type",
  description: "The main equity component columns in the statement of changes in equity"
})

export type EquityComponentType = typeof EquityComponentType.Type

/**
 * Get the display name for an equity component
 */
export const getComponentDisplayName = (component: EquityComponentType): string => {
  switch (component) {
    case "CommonStock":
      return "Common Stock"
    case "APIC":
      return "Additional Paid-In Capital"
    case "RetainedEarnings":
      return "Retained Earnings"
    case "TreasuryStock":
      return "Treasury Stock"
    case "AOCI":
      return "Accumulated Other Comprehensive Income"
    case "NCI":
      return "Non-Controlling Interest"
  }
}

/**
 * EquityMovementType - The types of movements (rows) in the equity statement
 *
 * Per the acceptance criteria:
 * - OpeningBalance: Balance at the start of the period
 * - NetIncome: Net income from the income statement (flows to Retained Earnings)
 * - OCI: Other Comprehensive Income (flows to AOCI)
 * - Dividends: Dividends declared (reduces Retained Earnings)
 * - StockIssuance: Issuance of new shares (increases Common Stock and APIC)
 * - StockRepurchase: Repurchase of shares (increases Treasury Stock)
 * - OtherAdjustments: Other equity adjustments
 * - ClosingBalance: Balance at the end of the period
 */
export const EquityMovementType = Schema.Literal(
  "OpeningBalance",
  "NetIncome",
  "OCI",
  "Dividends",
  "StockIssuance",
  "StockRepurchase",
  "OtherAdjustments",
  "ClosingBalance"
).annotations({
  identifier: "EquityMovementType",
  title: "Equity Movement Type",
  description: "The types of equity movements (rows) in the statement"
})

export type EquityMovementType = typeof EquityMovementType.Type

/**
 * Get the display name for an equity movement type
 */
export const getMovementDisplayName = (movement: EquityMovementType): string => {
  switch (movement) {
    case "OpeningBalance":
      return "Opening Balance"
    case "NetIncome":
      return "Net Income"
    case "OCI":
      return "Other Comprehensive Income"
    case "Dividends":
      return "Dividends Declared"
    case "StockIssuance":
      return "Stock Issuance"
    case "StockRepurchase":
      return "Stock Repurchase"
    case "OtherAdjustments":
      return "Other Adjustments"
    case "ClosingBalance":
      return "Closing Balance"
  }
}

// =============================================================================
// Row and Column Types
// =============================================================================

/**
 * EquityComponentColumn - A column in the equity statement representing one equity component
 */
export class EquityComponentColumn extends Schema.Class<EquityComponentColumn>("EquityComponentColumn")({
  /**
   * The equity component type
   */
  componentType: EquityComponentType,

  /**
   * Display name for the column
   */
  displayName: Schema.NonEmptyTrimmedString,

  /**
   * Opening balance for this component
   */
  openingBalance: MonetaryAmount,

  /**
   * Net income (only applicable to Retained Earnings)
   */
  netIncome: MonetaryAmount,

  /**
   * Other comprehensive income (only applicable to AOCI)
   */
  oci: MonetaryAmount,

  /**
   * Dividends (only applicable to Retained Earnings, shown as negative)
   */
  dividends: MonetaryAmount,

  /**
   * Stock issuance (applicable to CommonStock and APIC)
   */
  stockIssuance: MonetaryAmount,

  /**
   * Stock repurchase (applicable to TreasuryStock)
   */
  stockRepurchase: MonetaryAmount,

  /**
   * Other adjustments
   */
  otherAdjustments: MonetaryAmount,

  /**
   * Closing balance for this component
   */
  closingBalance: MonetaryAmount
}) {
  /**
   * Calculate the total change during the period
   */
  get totalChange(): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(this.closingBalance.amount, this.openingBalance.amount),
      this.openingBalance.currency
    )
  }

  /**
   * Check if there was any movement in this component
   */
  get hasMovement(): boolean {
    return !this.totalChange.isZero
  }

  /**
   * Get the sum of all movements (should equal closing - opening)
   */
  get sumOfMovements(): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(
      ReadonlyArray.reduce(
        [
          this.netIncome.amount,
          this.oci.amount,
          this.dividends.amount,
          this.stockIssuance.amount,
          this.stockRepurchase.amount,
          this.otherAdjustments.amount
        ],
        BigDecimal.fromBigInt(0n),
        BigDecimal.sum
      ),
      this.openingBalance.currency
    )
  }
}

/**
 * Type guard for EquityComponentColumn
 */
export const isEquityComponentColumn = Schema.is(EquityComponentColumn)

/**
 * EquityMovementRow - A row in the equity statement representing a type of movement
 */
export class EquityMovementRow extends Schema.Class<EquityMovementRow>("EquityMovementRow")({
  /**
   * The movement type
   */
  movementType: EquityMovementType,

  /**
   * Display name for the row
   */
  displayName: Schema.NonEmptyTrimmedString,

  /**
   * Amount for Common Stock column
   */
  commonStock: MonetaryAmount,

  /**
   * Amount for APIC column
   */
  apic: MonetaryAmount,

  /**
   * Amount for Retained Earnings column
   */
  retainedEarnings: MonetaryAmount,

  /**
   * Amount for Treasury Stock column
   */
  treasuryStock: MonetaryAmount,

  /**
   * Amount for AOCI column
   */
  aoci: MonetaryAmount,

  /**
   * Amount for NCI column (if consolidated)
   */
  nci: MonetaryAmount,

  /**
   * Row total (sum across all columns)
   */
  rowTotal: MonetaryAmount
}) {
  /**
   * Check if this is a balance row (opening or closing)
   */
  get isBalanceRow(): boolean {
    return this.movementType === "OpeningBalance" || this.movementType === "ClosingBalance"
  }

  /**
   * Check if this is a movement row (not a balance)
   */
  get isMovementRow(): boolean {
    return !this.isBalanceRow
  }

  /**
   * Check if the row has any non-zero amounts
   */
  get hasAmounts(): boolean {
    return !this.rowTotal.isZero
  }
}

/**
 * Type guard for EquityMovementRow
 */
export const isEquityMovementRow = Schema.is(EquityMovementRow)

// =============================================================================
// Report Types
// =============================================================================

/**
 * EquityStatementReportMetadata - Metadata about the equity statement report
 */
export class EquityStatementReportMetadata extends Schema.Class<EquityStatementReportMetadata>("EquityStatementReportMetadata")({
  /**
   * The company ID
   */
  companyId: CompanyId,

  /**
   * The period start date
   */
  periodStart: LocalDate,

  /**
   * The period end date
   */
  periodEnd: LocalDate,

  /**
   * The presentation currency used for the report
   */
  currency: CurrencyCode,

  /**
   * When the report was generated
   */
  generatedAt: Timestamp,

  /**
   * Whether this is a consolidated statement (includes NCI)
   */
  isConsolidated: Schema.Boolean
}) {}

/**
 * Type guard for EquityStatementReportMetadata
 */
export const isEquityStatementReportMetadata = Schema.is(EquityStatementReportMetadata)

/**
 * EquityStatementReport - Complete Statement of Changes in Equity
 *
 * Shows movements in each equity component across a period with:
 * - Columns for each equity component
 * - Rows for each type of movement
 * - Column totals and row totals
 */
export class EquityStatementReport extends Schema.Class<EquityStatementReport>("EquityStatementReport")({
  /**
   * Report metadata
   */
  metadata: EquityStatementReportMetadata,

  /**
   * Column data for each equity component
   */
  columns: Schema.Struct({
    commonStock: EquityComponentColumn,
    apic: EquityComponentColumn,
    retainedEarnings: EquityComponentColumn,
    treasuryStock: EquityComponentColumn,
    aoci: EquityComponentColumn,
    nci: EquityComponentColumn
  }),

  /**
   * Row data for each movement type
   */
  rows: Schema.Array(EquityMovementRow),

  /**
   * Total opening equity
   */
  totalOpeningEquity: MonetaryAmount,

  /**
   * Total closing equity
   */
  totalClosingEquity: MonetaryAmount,

  /**
   * Total change in equity during the period
   */
  totalChangeInEquity: MonetaryAmount
}) {
  /**
   * Get all columns as an array
   */
  get allColumns(): ReadonlyArray<EquityComponentColumn> {
    return [
      this.columns.commonStock,
      this.columns.apic,
      this.columns.retainedEarnings,
      this.columns.treasuryStock,
      this.columns.aoci,
      this.columns.nci
    ]
  }

  /**
   * Get opening balance row
   */
  get openingBalanceRow(): EquityMovementRow | undefined {
    return this.rows.find(r => r.movementType === "OpeningBalance")
  }

  /**
   * Get closing balance row
   */
  get closingBalanceRow(): EquityMovementRow | undefined {
    return this.rows.find(r => r.movementType === "ClosingBalance")
  }

  /**
   * Get all movement rows (excluding opening and closing balances)
   */
  get movementRows(): ReadonlyArray<EquityMovementRow> {
    return this.rows.filter(r => r.isMovementRow)
  }

  /**
   * Check if equity increased during the period
   */
  get equityIncreased(): boolean {
    return this.totalChangeInEquity.isPositive
  }

  /**
   * Check if equity decreased during the period
   */
  get equityDecreased(): boolean {
    return this.totalChangeInEquity.isNegative
  }

  /**
   * Get the net income row
   */
  get netIncomeRow(): EquityMovementRow | undefined {
    return this.rows.find(r => r.movementType === "NetIncome")
  }

  /**
   * Get the dividends row
   */
  get dividendsRow(): EquityMovementRow | undefined {
    return this.rows.find(r => r.movementType === "Dividends")
  }

  /**
   * Get the total net income for the period
   */
  get netIncome(): MonetaryAmount {
    const row = this.netIncomeRow
    return row ? row.rowTotal : MonetaryAmount.zero(this.metadata.currency)
  }

  /**
   * Get the total dividends for the period
   */
  get dividends(): MonetaryAmount {
    const row = this.dividendsRow
    return row ? row.rowTotal : MonetaryAmount.zero(this.metadata.currency)
  }
}

/**
 * Type guard for EquityStatementReport
 */
export const isEquityStatementReport = Schema.is(EquityStatementReport)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * EquityStatementRepository - Repository interface for fetching data needed for equity statement
 */
export interface EquityStatementRepositoryService {
  /**
   * Get all active accounts for a company
   */
  readonly getAccountsForCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<Account>>

  /**
   * Get the functional currency for a company
   */
  readonly getCompanyFunctionalCurrency: (
    companyId: CompanyId
  ) => Effect.Effect<Option.Option<CurrencyCode>>

  /**
   * Get all posted journal entries with lines for a company
   */
  readonly getPostedJournalEntriesWithLines: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntryWithLines>>

  /**
   * Check if this is a consolidated company (has subsidiaries)
   */
  readonly isConsolidatedCompany: (
    companyId: CompanyId
  ) => Effect.Effect<boolean>
}

/**
 * EquityStatementRepository Context.Tag
 */
export class EquityStatementRepository extends Context.Tag("EquityStatementRepository")<
  EquityStatementRepository,
  EquityStatementRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * GenerateEquityStatementInput - Input for generating an equity statement report
 */
export interface GenerateEquityStatementInput {
  /** The company ID */
  readonly companyId: CompanyId
  /** The period start date */
  readonly periodStart: LocalDate
  /** The period end date */
  readonly periodEnd: LocalDate
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if periodStart is before or equal to periodEnd
 */
const isValidPeriod = (periodStart: LocalDate, periodEnd: LocalDate): boolean => {
  if (periodStart.year < periodEnd.year) return true
  if (periodStart.year > periodEnd.year) return false
  if (periodStart.month < periodEnd.month) return true
  if (periodStart.month > periodEnd.month) return false
  return periodStart.day <= periodEnd.day
}

/**
 * Get the day before periodStart for beginning balance calculation
 */
const getDayBefore = (date: LocalDate): LocalDate => {
  if (date.day > 1) {
    return LocalDate.make({ year: date.year, month: date.month, day: date.day - 1 })
  } else if (date.month > 1) {
    const prevMonth = date.month - 1
    const daysInPrevMonth = getDaysInMonth(date.year, prevMonth)
    return LocalDate.make({ year: date.year, month: prevMonth, day: daysInPrevMonth })
  } else {
    return LocalDate.make({ year: date.year - 1, month: 12, day: 31 })
  }
}

/**
 * Get days in a month
 */
const getDaysInMonth = (year: number, month: number): number => {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
    case 2:
      return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
    default:
      return 30
  }
}

/**
 * Classify an equity account into its component type
 */
const classifyEquityAccount = (account: Account): EquityComponentType | null => {
  if (account.accountType !== "Equity") return null

  // Use account category to determine component
  switch (account.accountCategory) {
    case "ContributedCapital": {
      // Check if it's APIC vs Common Stock based on name
      const lowerName = account.name.toLowerCase()
      if (
        lowerName.includes("additional paid") ||
        lowerName.includes("apic") ||
        lowerName.includes("paid-in capital") ||
        lowerName.includes("share premium")
      ) {
        return "APIC"
      }
      return "CommonStock"
    }
    case "RetainedEarnings":
      return "RetainedEarnings"
    case "TreasuryStock":
      return "TreasuryStock"
    case "OtherComprehensiveIncome":
      return "AOCI"
    default:
      // Check for NCI based on name
      if (
        account.name.toLowerCase().includes("non-controlling") ||
        account.name.toLowerCase().includes("noncontrolling") ||
        account.name.toLowerCase().includes("minority interest")
      ) {
        return "NCI"
      }
      // Default other equity accounts to Retained Earnings or APIC based on context
      return "RetainedEarnings"
  }
}

/**
 * Check if an account represents dividends
 */
const isDividendAccount = (account: Account): boolean => {
  const lowerName = account.name.toLowerCase()
  return (
    lowerName.includes("dividend") ||
    lowerName.includes("distribution")
  )
}

/**
 * Calculate net income from income statement accounts
 */
const calculateNetIncome = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let revenue = BigDecimal.fromBigInt(0n)
  let expenses = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    if (account.accountType === "Revenue") {
      revenue = BigDecimal.sum(revenue, balance.amount)
    } else if (account.accountType === "Expense") {
      expenses = BigDecimal.sum(expenses, balance.amount)
    }
  }

  return MonetaryAmount.fromBigDecimal(
    BigDecimal.subtract(revenue, expenses),
    functionalCurrency
  )
}

/**
 * Calculate balance for a specific equity component at a point in time
 */
const calculateComponentBalance = (
  component: EquityComponentType,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable) continue
    if (classifyEquityAccount(account) !== component) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculateBalance(
      account.id,
      normalBalance,
      entries,
      asOfDate,
      functionalCurrency
    )

    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

/**
 * Calculate period change for a specific equity component
 */
const calculateComponentPeriodChange = (
  component: EquityComponentType,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable) continue
    if (classifyEquityAccount(account) !== component) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

/**
 * Calculate dividends for the period
 *
 * Dividend accounts are typically equity accounts (category RetainedEarnings)
 * that are debited when dividends are declared. A debit to an equity account
 * (normal credit balance) results in a negative period balance.
 *
 * We return the balance as-is because:
 * - Debit to dividend account = negative period balance (debit vs normal credit)
 * - This negative value correctly represents a reduction in equity
 */
const calculateDividends = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable) continue
    if (!isDividendAccount(account)) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Dividends already show as negative (debit to credit-normal account)
    // so we use the value directly
    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

/**
 * Calculate OCI for the period
 */
const calculateOCI = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable) continue
    if (account.accountCategory !== "OtherComprehensiveIncome") continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

/**
 * Create an equity component column with all movements
 *
 * The closing balance is calculated as:
 *   Opening + NetIncome + OCI + Dividends + StockIssuance + StockRepurchase + OtherAdjustments
 *
 * This is important because:
 * - Net income is calculated from revenue/expense accounts, not retained earnings directly
 * - Until year-end closing entries are made, retained earnings won't reflect net income
 * - The statement of changes in equity should show the "pro-forma" closing balance
 */
const createComponentColumn = (
  component: EquityComponentType,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  netIncome: MonetaryAmount,
  dividends: MonetaryAmount,
  oci: MonetaryAmount,
  functionalCurrency: CurrencyCode
): EquityComponentColumn => {
  const dayBefore = getDayBefore(periodStart)
  const openingBalance = calculateComponentBalance(
    component,
    accounts,
    entries,
    dayBefore,
    functionalCurrency
  )

  const zero = MonetaryAmount.zero(functionalCurrency)

  // Determine what movements apply to this component
  let netIncomeAmount = zero
  let ociAmount = zero
  let dividendsAmount = zero
  let stockIssuanceAmount = zero
  let stockRepurchaseAmount = zero
  let otherAdjustmentsAmount = zero

  switch (component) {
    case "RetainedEarnings":
      // Net income flows to retained earnings
      netIncomeAmount = netIncome
      // Dividends reduce retained earnings
      dividendsAmount = dividends
      break
    case "AOCI":
      // OCI flows to AOCI
      ociAmount = oci
      break
    case "CommonStock":
    case "APIC":
      // Stock issuance increases these
      // Calculate the change and attribute to stock issuance
      {
        const periodChange = calculateComponentPeriodChange(
          component,
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency
        )
        if (periodChange.isPositive) {
          stockIssuanceAmount = periodChange
        } else if (periodChange.isNegative) {
          // Could be stock redemption - treat as other adjustment
          otherAdjustmentsAmount = periodChange
        }
      }
      break
    case "TreasuryStock":
      // Stock repurchase increases treasury stock (as a negative in total equity)
      {
        const periodChange = calculateComponentPeriodChange(
          component,
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency
        )
        stockRepurchaseAmount = periodChange
      }
      break
    case "NCI":
      // NCI changes are treated as other adjustments
      {
        const periodChange = calculateComponentPeriodChange(
          component,
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency
        )
        otherAdjustmentsAmount = periodChange
      }
      break
  }

  // Calculate closing balance as opening + all movements
  // This gives the "pro-forma" closing balance that includes net income
  // even before closing entries have been posted
  const closingBalance = MonetaryAmount.fromBigDecimal(
    ReadonlyArray.reduce(
      [
        openingBalance.amount,
        netIncomeAmount.amount,
        ociAmount.amount,
        dividendsAmount.amount,
        stockIssuanceAmount.amount,
        stockRepurchaseAmount.amount,
        otherAdjustmentsAmount.amount
      ],
      BigDecimal.fromBigInt(0n),
      BigDecimal.sum
    ),
    functionalCurrency
  )

  return EquityComponentColumn.make({
    componentType: component,
    displayName: getComponentDisplayName(component),
    openingBalance,
    netIncome: netIncomeAmount,
    oci: ociAmount,
    dividends: dividendsAmount,
    stockIssuance: stockIssuanceAmount,
    stockRepurchase: stockRepurchaseAmount,
    otherAdjustments: otherAdjustmentsAmount,
    closingBalance
  })
}

/**
 * Create a movement row
 */
const createMovementRow = (
  movementType: EquityMovementType,
  columns: {
    commonStock: EquityComponentColumn
    apic: EquityComponentColumn
    retainedEarnings: EquityComponentColumn
    treasuryStock: EquityComponentColumn
    aoci: EquityComponentColumn
    nci: EquityComponentColumn
  },
  functionalCurrency: CurrencyCode
): EquityMovementRow => {
  let commonStock: MonetaryAmount
  let apic: MonetaryAmount
  let retainedEarnings: MonetaryAmount
  let treasuryStock: MonetaryAmount
  let aoci: MonetaryAmount
  let nci: MonetaryAmount

  switch (movementType) {
    case "OpeningBalance":
      commonStock = columns.commonStock.openingBalance
      apic = columns.apic.openingBalance
      retainedEarnings = columns.retainedEarnings.openingBalance
      treasuryStock = columns.treasuryStock.openingBalance
      aoci = columns.aoci.openingBalance
      nci = columns.nci.openingBalance
      break
    case "NetIncome":
      commonStock = columns.commonStock.netIncome
      apic = columns.apic.netIncome
      retainedEarnings = columns.retainedEarnings.netIncome
      treasuryStock = columns.treasuryStock.netIncome
      aoci = columns.aoci.netIncome
      nci = columns.nci.netIncome
      break
    case "OCI":
      commonStock = columns.commonStock.oci
      apic = columns.apic.oci
      retainedEarnings = columns.retainedEarnings.oci
      treasuryStock = columns.treasuryStock.oci
      aoci = columns.aoci.oci
      nci = columns.nci.oci
      break
    case "Dividends":
      commonStock = columns.commonStock.dividends
      apic = columns.apic.dividends
      retainedEarnings = columns.retainedEarnings.dividends
      treasuryStock = columns.treasuryStock.dividends
      aoci = columns.aoci.dividends
      nci = columns.nci.dividends
      break
    case "StockIssuance":
      commonStock = columns.commonStock.stockIssuance
      apic = columns.apic.stockIssuance
      retainedEarnings = columns.retainedEarnings.stockIssuance
      treasuryStock = columns.treasuryStock.stockIssuance
      aoci = columns.aoci.stockIssuance
      nci = columns.nci.stockIssuance
      break
    case "StockRepurchase":
      commonStock = columns.commonStock.stockRepurchase
      apic = columns.apic.stockRepurchase
      retainedEarnings = columns.retainedEarnings.stockRepurchase
      treasuryStock = columns.treasuryStock.stockRepurchase
      aoci = columns.aoci.stockRepurchase
      nci = columns.nci.stockRepurchase
      break
    case "OtherAdjustments":
      commonStock = columns.commonStock.otherAdjustments
      apic = columns.apic.otherAdjustments
      retainedEarnings = columns.retainedEarnings.otherAdjustments
      treasuryStock = columns.treasuryStock.otherAdjustments
      aoci = columns.aoci.otherAdjustments
      nci = columns.nci.otherAdjustments
      break
    case "ClosingBalance":
      commonStock = columns.commonStock.closingBalance
      apic = columns.apic.closingBalance
      retainedEarnings = columns.retainedEarnings.closingBalance
      treasuryStock = columns.treasuryStock.closingBalance
      aoci = columns.aoci.closingBalance
      nci = columns.nci.closingBalance
      break
  }

  // Calculate row total
  const rowTotal = MonetaryAmount.fromBigDecimal(
    ReadonlyArray.reduce(
      [
        commonStock.amount,
        apic.amount,
        retainedEarnings.amount,
        treasuryStock.amount,
        aoci.amount,
        nci.amount
      ],
      BigDecimal.fromBigInt(0n),
      BigDecimal.sum
    ),
    functionalCurrency
  )

  return EquityMovementRow.make({
    movementType,
    displayName: getMovementDisplayName(movementType),
    commonStock,
    apic,
    retainedEarnings,
    treasuryStock,
    aoci,
    nci,
    rowTotal
  })
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * EquityStatementService - Service interface for generating equity statement reports
 */
export interface EquityStatementServiceShape {
  /**
   * Generate an equity statement report for a company for a specific period
   *
   * @param input - The input parameters
   * @returns Effect containing the equity statement report
   * @throws CompanyNotFoundError if the company doesn't exist
   * @throws InvalidPeriodError if periodStart is after periodEnd
   */
  readonly generateEquityStatement: (
    input: GenerateEquityStatementInput
  ) => Effect.Effect<EquityStatementReport, CompanyNotFoundError | InvalidPeriodError, never>
}

/**
 * EquityStatementService Context.Tag
 */
export class EquityStatementService extends Context.Tag("EquityStatementService")<
  EquityStatementService,
  EquityStatementServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the EquityStatementService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* EquityStatementRepository

  return {
    generateEquityStatement: (input: GenerateEquityStatementInput) =>
      Effect.gen(function* () {
        const { companyId, periodStart, periodEnd } = input

        // Validate period
        if (!isValidPeriod(periodStart, periodEnd)) {
          return yield* Effect.fail(
            new InvalidPeriodError({
              periodStart: {
                year: periodStart.year,
                month: periodStart.month,
                day: periodStart.day
              },
              periodEnd: {
                year: periodEnd.year,
                month: periodEnd.month,
                day: periodEnd.day
              }
            })
          )
        }

        // Get company's functional currency
        const currencyOption = yield* repository.getCompanyFunctionalCurrency(companyId)
        if (Option.isNone(currencyOption)) {
          return yield* Effect.fail(new CompanyNotFoundError({ companyId }))
        }
        const functionalCurrency = currencyOption.value

        // Get all accounts for the company
        const accounts = yield* repository.getAccountsForCompany(companyId)

        // Get all posted journal entries with lines
        const entries = yield* repository.getPostedJournalEntriesWithLines(companyId)

        // Check if consolidated
        const isConsolidated = yield* repository.isConsolidatedCompany(companyId)

        // Generate the report using the pure function
        return yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency,
          { isConsolidated }
        )
      })
  } satisfies EquityStatementServiceShape
})

/**
 * EquityStatementServiceLive - Live implementation of EquityStatementService
 *
 * Requires EquityStatementRepository
 */
export const EquityStatementServiceLive: Layer.Layer<
  EquityStatementService,
  never,
  EquityStatementRepository
> = Layer.effect(EquityStatementService, make)

// =============================================================================
// Pure Functions for Direct Use (without repository)
// =============================================================================

/**
 * Generate an equity statement from provided accounts and journal entries
 *
 * This is a pure function that can be used directly without the service layer
 * when all data is already available in memory.
 *
 * @param companyId - The company ID
 * @param accounts - All accounts for the company
 * @param entries - All posted journal entries with lines
 * @param periodStart - The period start date
 * @param periodEnd - The period end date
 * @param functionalCurrency - The functional currency for calculations
 * @param options - Optional parameters
 * @returns Effect containing the equity statement report
 */
export const generateEquityStatementFromData = (
  companyId: CompanyId,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode,
  options?: {
    isConsolidated?: boolean
  }
): Effect.Effect<EquityStatementReport, InvalidPeriodError> =>
  Effect.gen(function* () {
    // Validate period
    if (!isValidPeriod(periodStart, periodEnd)) {
      return yield* Effect.fail(
        new InvalidPeriodError({
          periodStart: {
            year: periodStart.year,
            month: periodStart.month,
            day: periodStart.day
          },
          periodEnd: {
            year: periodEnd.year,
            month: periodEnd.month,
            day: periodEnd.day
          }
        })
      )
    }

    const isConsolidated = options?.isConsolidated ?? false

    // Calculate net income
    const netIncome = calculateNetIncome(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Calculate dividends
    const dividends = calculateDividends(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Calculate OCI
    const oci = calculateOCI(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Create columns for each component
    const commonStock = createComponentColumn(
      "CommonStock",
      accounts,
      entries,
      periodStart,
      periodEnd,
      netIncome,
      dividends,
      oci,
      functionalCurrency
    )

    const apic = createComponentColumn(
      "APIC",
      accounts,
      entries,
      periodStart,
      periodEnd,
      netIncome,
      dividends,
      oci,
      functionalCurrency
    )

    const retainedEarnings = createComponentColumn(
      "RetainedEarnings",
      accounts,
      entries,
      periodStart,
      periodEnd,
      netIncome,
      dividends,
      oci,
      functionalCurrency
    )

    const treasuryStock = createComponentColumn(
      "TreasuryStock",
      accounts,
      entries,
      periodStart,
      periodEnd,
      netIncome,
      dividends,
      oci,
      functionalCurrency
    )

    const aoci = createComponentColumn(
      "AOCI",
      accounts,
      entries,
      periodStart,
      periodEnd,
      netIncome,
      dividends,
      oci,
      functionalCurrency
    )

    const nci = createComponentColumn(
      "NCI",
      accounts,
      entries,
      periodStart,
      periodEnd,
      netIncome,
      dividends,
      oci,
      functionalCurrency
    )

    const columns = {
      commonStock,
      apic,
      retainedEarnings,
      treasuryStock,
      aoci,
      nci
    }

    // Create rows for each movement type
    const rows: EquityMovementRow[] = [
      createMovementRow("OpeningBalance", columns, functionalCurrency),
      createMovementRow("NetIncome", columns, functionalCurrency),
      createMovementRow("OCI", columns, functionalCurrency),
      createMovementRow("Dividends", columns, functionalCurrency),
      createMovementRow("StockIssuance", columns, functionalCurrency),
      createMovementRow("StockRepurchase", columns, functionalCurrency),
      createMovementRow("OtherAdjustments", columns, functionalCurrency),
      createMovementRow("ClosingBalance", columns, functionalCurrency)
    ]

    // Calculate totals
    const totalOpeningEquity = MonetaryAmount.fromBigDecimal(
      ReadonlyArray.reduce(
        [
          commonStock.openingBalance.amount,
          apic.openingBalance.amount,
          retainedEarnings.openingBalance.amount,
          treasuryStock.openingBalance.amount,
          aoci.openingBalance.amount,
          nci.openingBalance.amount
        ],
        BigDecimal.fromBigInt(0n),
        BigDecimal.sum
      ),
      functionalCurrency
    )

    const totalClosingEquity = MonetaryAmount.fromBigDecimal(
      ReadonlyArray.reduce(
        [
          commonStock.closingBalance.amount,
          apic.closingBalance.amount,
          retainedEarnings.closingBalance.amount,
          treasuryStock.closingBalance.amount,
          aoci.closingBalance.amount,
          nci.closingBalance.amount
        ],
        BigDecimal.fromBigInt(0n),
        BigDecimal.sum
      ),
      functionalCurrency
    )

    const totalChangeInEquity = MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(totalClosingEquity.amount, totalOpeningEquity.amount),
      functionalCurrency
    )

    // Generate timestamp
    const generatedAt = yield* timestampNowEffect

    // Create metadata
    const metadata = EquityStatementReportMetadata.make({
      companyId,
      periodStart,
      periodEnd,
      currency: functionalCurrency,
      generatedAt,
      isConsolidated
    })

    // Create and return the report
    return EquityStatementReport.make({
      metadata,
      columns,
      rows,
      totalOpeningEquity,
      totalClosingEquity,
      totalChangeInEquity
    })
  })
