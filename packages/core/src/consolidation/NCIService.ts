/**
 * NCIService - Non-Controlling Interest (Minority Interest) Calculation Service
 *
 * Per ASC 810 (Consolidation), when a parent company owns less than 100% of a
 * subsidiary, the non-controlling interest (NCI) represents the minority
 * shareholders' portion of the subsidiary's equity and income.
 *
 * Key concepts:
 * - NCI % = 100% - parent ownership %
 * - NCI is calculated for both equity (at acquisition + subsequent changes)
 * - NCI is calculated for net income for the period
 * - NCI appears as separate line items in consolidated financial statements
 *
 * @module NCIService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { CompanyId } from "../company/Company.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { Percentage, complement as percentageComplement } from "../shared/values/Percentage.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when subsidiary data is not found
 */
export class SubsidiaryNotFoundError extends Schema.TaggedError<SubsidiaryNotFoundError>()(
  "SubsidiaryNotFoundError",
  {
    subsidiaryId: Schema.UUID.pipe(Schema.brand("CompanyId"))
  }
) {
  get message(): string {
    return `Subsidiary not found: ${this.subsidiaryId}`
  }
}

/**
 * Type guard for SubsidiaryNotFoundError
 */
export const isSubsidiaryNotFoundError = Schema.is(SubsidiaryNotFoundError)

/**
 * Error when ownership percentage is invalid for NCI calculation
 */
export class InvalidOwnershipPercentageError extends Schema.TaggedError<InvalidOwnershipPercentageError>()(
  "InvalidOwnershipPercentageError",
  {
    ownershipPercentage: Percentage,
    reason: Schema.NonEmptyTrimmedString
  }
) {
  get message(): string {
    return `Invalid ownership percentage ${this.ownershipPercentage}%: ${this.reason}`
  }
}

/**
 * Type guard for InvalidOwnershipPercentageError
 */
export const isInvalidOwnershipPercentageError = Schema.is(InvalidOwnershipPercentageError)

/**
 * Error when NCI calculation fails
 */
export class NCICalculationError extends Schema.TaggedError<NCICalculationError>()(
  "NCICalculationError",
  {
    subsidiaryId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    reason: Schema.NonEmptyTrimmedString
  }
) {
  get message(): string {
    return `NCI calculation failed for subsidiary ${this.subsidiaryId}: ${this.reason}`
  }
}

/**
 * Type guard for NCICalculationError
 */
export const isNCICalculationError = Schema.is(NCICalculationError)

/**
 * Union type for all NCI service errors
 */
export type NCIServiceError =
  | SubsidiaryNotFoundError
  | InvalidOwnershipPercentageError
  | NCICalculationError

// =============================================================================
// NCI Result Types
// =============================================================================

/**
 * NCIPercentage - The calculated NCI percentage
 *
 * NCI % = 100% - parent ownership %
 */
export class NCIPercentage extends Schema.Class<NCIPercentage>("NCIPercentage")({
  /**
   * The parent's ownership percentage in the subsidiary
   */
  parentOwnershipPercentage: Percentage,

  /**
   * The NCI percentage (100% - parent ownership %)
   */
  nciPercentage: Percentage
}) {
  /**
   * Get the NCI percentage as a decimal (0-1)
   */
  get nciDecimal(): number {
    return this.nciPercentage / 100
  }

  /**
   * Get the parent ownership as a decimal (0-1)
   */
  get parentDecimal(): number {
    return this.parentOwnershipPercentage / 100
  }

  /**
   * Check if there is any NCI (parent owns less than 100%)
   */
  get hasNCI(): boolean {
    return this.nciPercentage > 0
  }

  /**
   * Check if this is a wholly-owned subsidiary (no NCI)
   */
  get isWhollyOwned(): boolean {
    return this.parentOwnershipPercentage === 100
  }
}

/**
 * Type guard for NCIPercentage
 */
export const isNCIPercentage = Schema.is(NCIPercentage)

/**
 * NCIEquityAtAcquisition - NCI share of subsidiary equity at acquisition date
 *
 * This represents the initial NCI equity value at the time of acquisition,
 * calculated as NCI% × fair value of subsidiary's net identifiable assets.
 */
export class NCIEquityAtAcquisition extends Schema.Class<NCIEquityAtAcquisition>("NCIEquityAtAcquisition")({
  /**
   * Reference to the subsidiary company
   */
  subsidiaryId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * Fair value of subsidiary's net identifiable assets at acquisition
   */
  fairValueNetAssets: MonetaryAmount,

  /**
   * NCI percentage at acquisition
   */
  nciPercentage: Percentage,

  /**
   * NCI share of fair value (NCI% × fair value)
   */
  nciShareOfFairValue: MonetaryAmount,

  /**
   * Any additional NCI premium/discount (e.g., NCI measured at fair value option)
   */
  nciPremiumDiscount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Total NCI at acquisition (fair value share + premium/discount)
   */
  totalNCIAtAcquisition: MonetaryAmount
}) {
  /**
   * Check if NCI was measured at fair value (includes premium/discount)
   */
  get isMeasuredAtFairValue(): boolean {
    return Option.isSome(this.nciPremiumDiscount)
  }
}

/**
 * Type guard for NCIEquityAtAcquisition
 */
export const isNCIEquityAtAcquisition = Schema.is(NCIEquityAtAcquisition)

/**
 * NCIEquityChange - Represents a change in NCI equity since acquisition
 *
 * This tracks subsequent changes to NCI equity after the acquisition date,
 * such as NCI share of net income, dividends, and other comprehensive income.
 */
export class NCIEquityChange extends Schema.Class<NCIEquityChange>("NCIEquityChange")({
  /**
   * Type of equity change
   */
  changeType: Schema.Literal(
    "NetIncome",
    "Dividends",
    "OtherComprehensiveIncome",
    "OwnershipChange",
    "Acquisition",
    "Disposal",
    "Other"
  ),

  /**
   * Description of the change
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * Amount of the change (positive increases NCI, negative decreases)
   */
  amount: MonetaryAmount,

  /**
   * Period when the change occurred (year and period)
   */
  periodYear: Schema.Number,

  /**
   * Period number (1-12 for months, 13+ for adjustments)
   */
  periodNumber: Schema.Number
}) {}

/**
 * Type guard for NCIEquityChange
 */
export const isNCIEquityChange = Schema.is(NCIEquityChange)

/**
 * NCISubsequentChanges - Summary of all NCI changes since acquisition
 */
export class NCISubsequentChanges extends Schema.Class<NCISubsequentChanges>("NCISubsequentChanges")({
  /**
   * All individual changes
   */
  changes: Schema.Chunk(NCIEquityChange),

  /**
   * Total NCI share of cumulative net income since acquisition
   */
  totalNetIncome: MonetaryAmount,

  /**
   * Total dividends paid to NCI shareholders
   */
  totalDividends: MonetaryAmount,

  /**
   * Total NCI share of other comprehensive income
   */
  totalOCI: MonetaryAmount,

  /**
   * Other changes (ownership changes, disposals, etc.)
   */
  totalOther: MonetaryAmount,

  /**
   * Net change in NCI equity since acquisition
   */
  netChange: MonetaryAmount
}) {
  /**
   * Get the number of changes
   */
  get changeCount(): number {
    return Chunk.size(this.changes)
  }

  /**
   * Check if there are any changes
   */
  get hasChanges(): boolean {
    return Chunk.isNonEmpty(this.changes)
  }
}

/**
 * Type guard for NCISubsequentChanges
 */
export const isNCISubsequentChanges = Schema.is(NCISubsequentChanges)

/**
 * NCINetIncome - NCI share of subsidiary net income for a period
 */
export class NCINetIncome extends Schema.Class<NCINetIncome>("NCINetIncome")({
  /**
   * Reference to the subsidiary company
   */
  subsidiaryId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * Subsidiary's total net income for the period
   */
  subsidiaryNetIncome: MonetaryAmount,

  /**
   * NCI percentage
   */
  nciPercentage: Percentage,

  /**
   * NCI share of net income (NCI% × net income)
   */
  nciShareOfNetIncome: MonetaryAmount,

  /**
   * Period year
   */
  periodYear: Schema.Number,

  /**
   * Period number
   */
  periodNumber: Schema.Number
}) {
  /**
   * Check if NCI share is profitable
   */
  get isProfitable(): boolean {
    return this.nciShareOfNetIncome.isPositive
  }

  /**
   * Check if subsidiary had a loss
   */
  get isLoss(): boolean {
    return this.subsidiaryNetIncome.isNegative
  }
}

/**
 * Type guard for NCINetIncome
 */
export const isNCINetIncome = Schema.is(NCINetIncome)

/**
 * NCILineItem - Line item for NCI in consolidated financial statements
 */
export class NCILineItem extends Schema.Class<NCILineItem>("NCILineItem")({
  /**
   * Line item type for statement presentation
   */
  lineItemType: Schema.Literal(
    "NCIEquity",           // Balance sheet: NCI equity section
    "NCINetIncome",        // Income statement: Net income attributable to NCI
    "NCIOCI",              // OCI: NCI share of OCI
    "NCIDividends",        // Changes in equity: Dividends to NCI
    "NCIAcquisition",      // Changes in equity: NCI at acquisition
    "NCIOther"             // Changes in equity: Other NCI changes
  ),

  /**
   * Description for the line item
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * Amount for this line item
   */
  amount: MonetaryAmount,

  /**
   * Reference to subsidiary company (if subsidiary-specific)
   */
  subsidiaryId: Schema.OptionFromNullOr(Schema.UUID.pipe(Schema.brand("CompanyId"))),

  /**
   * Subsidiary name for display
   */
  subsidiaryName: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {
  /**
   * Check if this is a balance sheet item
   */
  get isBalanceSheetItem(): boolean {
    return this.lineItemType === "NCIEquity"
  }

  /**
   * Check if this is an income statement item
   */
  get isIncomeStatementItem(): boolean {
    return this.lineItemType === "NCINetIncome"
  }

  /**
   * Check if this is an OCI item
   */
  get isOCIItem(): boolean {
    return this.lineItemType === "NCIOCI"
  }

  /**
   * Check if this is an equity statement item
   */
  get isEquityStatementItem(): boolean {
    return this.lineItemType === "NCIDividends" ||
           this.lineItemType === "NCIAcquisition" ||
           this.lineItemType === "NCIOther"
  }
}

/**
 * Type guard for NCILineItem
 */
export const isNCILineItem = Schema.is(NCILineItem)

/**
 * NCIResult - Complete NCI calculation result for a subsidiary
 *
 * This is the main output of calculateNCI function, containing all NCI
 * information needed for consolidated financial statements.
 */
export class NCIResult extends Schema.Class<NCIResult>("NCIResult")({
  /**
   * Reference to the subsidiary company
   */
  subsidiaryId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * Subsidiary company name
   */
  subsidiaryName: Schema.NonEmptyTrimmedString,

  /**
   * NCI percentage calculation
   */
  nciPercentage: NCIPercentage,

  /**
   * NCI equity at acquisition
   */
  equityAtAcquisition: NCIEquityAtAcquisition,

  /**
   * Subsequent changes to NCI equity
   */
  subsequentChanges: NCISubsequentChanges,

  /**
   * Current period NCI net income
   */
  currentPeriodNetIncome: NCINetIncome,

  /**
   * Total NCI equity (at acquisition + subsequent changes)
   */
  totalNCIEquity: MonetaryAmount,

  /**
   * NCI line items for consolidated statements
   */
  lineItems: Schema.Chunk(NCILineItem),

  /**
   * Currency for all amounts
   */
  currency: CurrencyCode
}) {
  /**
   * Check if there is any NCI
   */
  get hasNCI(): boolean {
    return this.nciPercentage.hasNCI
  }

  /**
   * Get line items for balance sheet
   */
  get balanceSheetLineItems(): Chunk.Chunk<NCILineItem> {
    return Chunk.filter(this.lineItems, (item) => item.isBalanceSheetItem)
  }

  /**
   * Get line items for income statement
   */
  get incomeStatementLineItems(): Chunk.Chunk<NCILineItem> {
    return Chunk.filter(this.lineItems, (item) => item.isIncomeStatementItem)
  }

  /**
   * Get line items for OCI
   */
  get ociLineItems(): Chunk.Chunk<NCILineItem> {
    return Chunk.filter(this.lineItems, (item) => item.isOCIItem)
  }

  /**
   * Get line items for equity statement
   */
  get equityStatementLineItems(): Chunk.Chunk<NCILineItem> {
    return Chunk.filter(this.lineItems, (item) => item.isEquityStatementItem)
  }
}

/**
 * Type guard for NCIResult
 */
export const isNCIResult = Schema.is(NCIResult)

/**
 * Encoded type interface for NCIResult
 */
export interface NCIResultEncoded extends Schema.Schema.Encoded<typeof NCIResult> {}

/**
 * ConsolidatedNCISummary - Summary of NCI across all subsidiaries
 */
export class ConsolidatedNCISummary extends Schema.Class<ConsolidatedNCISummary>("ConsolidatedNCISummary")({
  /**
   * Individual NCI results for each subsidiary
   */
  subsidiaryResults: Schema.Chunk(NCIResult),

  /**
   * Total NCI equity across all subsidiaries
   */
  totalNCIEquity: MonetaryAmount,

  /**
   * Total NCI net income across all subsidiaries for the period
   */
  totalNCINetIncome: MonetaryAmount,

  /**
   * Total NCI OCI across all subsidiaries
   */
  totalNCIOCI: MonetaryAmount,

  /**
   * Consolidated NCI line items (aggregated)
   */
  consolidatedLineItems: Schema.Chunk(NCILineItem),

  /**
   * Currency for all amounts
   */
  currency: CurrencyCode
}) {
  /**
   * Get number of subsidiaries with NCI
   */
  get subsidiaryCount(): number {
    return Chunk.size(this.subsidiaryResults)
  }

  /**
   * Check if there is any NCI
   */
  get hasNCI(): boolean {
    return Chunk.isNonEmpty(this.subsidiaryResults)
  }
}

/**
 * Type guard for ConsolidatedNCISummary
 */
export const isConsolidatedNCISummary = Schema.is(ConsolidatedNCISummary)

// =============================================================================
// NCI Calculation Functions
// =============================================================================

/**
 * Calculate NCI percentage from parent ownership percentage
 *
 * NCI % = 100% - parent ownership %
 *
 * @param parentOwnershipPct - Parent's ownership percentage (0-100)
 * @returns NCIPercentage containing both percentages
 */
export const calculateNCIPercentage = (
  parentOwnershipPct: Percentage
): NCIPercentage => {
  return NCIPercentage.make({
    parentOwnershipPercentage: parentOwnershipPct,
    nciPercentage: percentageComplement(parentOwnershipPct)
  })
}

/**
 * Calculate NCI share of an amount
 *
 * @param amount - The amount to calculate NCI share of
 * @param nciPercentage - The NCI percentage
 * @returns The NCI share of the amount
 */
export const calculateNCIShare = (
  amount: MonetaryAmount,
  nciPercentage: Percentage
): MonetaryAmount => {
  const nciDecimal = BigDecimal.unsafeFromNumber(nciPercentage / 100)
  return MonetaryAmount.fromBigDecimal(
    BigDecimal.multiply(amount.amount, nciDecimal),
    amount.currency
  )
}

/**
 * Calculate NCI equity at acquisition
 *
 * @param subsidiaryId - Subsidiary company ID
 * @param fairValueNetAssets - Fair value of subsidiary's net assets at acquisition
 * @param nciPercentage - NCI percentage
 * @param nciPremiumDiscount - Optional premium/discount for fair value measurement
 * @returns NCIEquityAtAcquisition
 */
export const calculateNCIEquityAtAcquisition = (
  subsidiaryId: CompanyId,
  fairValueNetAssets: MonetaryAmount,
  nciPercentage: Percentage,
  nciPremiumDiscount?: MonetaryAmount
): NCIEquityAtAcquisition => {
  const nciShareOfFairValue = calculateNCIShare(fairValueNetAssets, nciPercentage)

  let totalNCIAtAcquisition = nciShareOfFairValue
  if (nciPremiumDiscount) {
    totalNCIAtAcquisition = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(nciShareOfFairValue.amount, nciPremiumDiscount.amount),
      fairValueNetAssets.currency
    )
  }

  return NCIEquityAtAcquisition.make({
    subsidiaryId,
    fairValueNetAssets,
    nciPercentage,
    nciShareOfFairValue,
    nciPremiumDiscount: nciPremiumDiscount ? Option.some(nciPremiumDiscount) : Option.none(),
    totalNCIAtAcquisition
  })
}

/**
 * Calculate NCI net income for a period
 *
 * @param subsidiaryId - Subsidiary company ID
 * @param subsidiaryNetIncome - Subsidiary's net income for the period
 * @param nciPercentage - NCI percentage
 * @param periodYear - Fiscal year
 * @param periodNumber - Period number
 * @returns NCINetIncome
 */
export const calculateNCINetIncome = (
  subsidiaryId: CompanyId,
  subsidiaryNetIncome: MonetaryAmount,
  nciPercentage: Percentage,
  periodYear: number,
  periodNumber: number
): NCINetIncome => {
  const nciShareOfNetIncome = calculateNCIShare(subsidiaryNetIncome, nciPercentage)

  return NCINetIncome.make({
    subsidiaryId,
    subsidiaryNetIncome,
    nciPercentage,
    nciShareOfNetIncome,
    periodYear,
    periodNumber
  })
}

/**
 * Create NCI line items for consolidated statements
 *
 * @param result - NCI calculation inputs
 * @returns Array of NCILineItems
 */
export const createNCILineItems = (
  subsidiaryId: CompanyId,
  subsidiaryName: string,
  totalNCIEquity: MonetaryAmount,
  nciNetIncome: MonetaryAmount,
  nciOCI: MonetaryAmount,
  nciDividends: MonetaryAmount
): Chunk.Chunk<NCILineItem> => {
  const items: NCILineItem[] = []

  const subName = Schema.NonEmptyTrimmedString.make(subsidiaryName)

  // Balance sheet line item - NCI Equity
  items.push(NCILineItem.make({
    lineItemType: "NCIEquity",
    description: Schema.NonEmptyTrimmedString.make(`Non-controlling interest - ${subsidiaryName}`),
    amount: totalNCIEquity,
    subsidiaryId: Option.some(subsidiaryId),
    subsidiaryName: Option.some(subName)
  }))

  // Income statement line item - NCI Net Income
  if (!nciNetIncome.isZero) {
    items.push(NCILineItem.make({
      lineItemType: "NCINetIncome",
      description: Schema.NonEmptyTrimmedString.make(`Net income attributable to non-controlling interest - ${subsidiaryName}`),
      amount: nciNetIncome,
      subsidiaryId: Option.some(subsidiaryId),
      subsidiaryName: Option.some(subName)
    }))
  }

  // OCI line item - NCI OCI
  if (!nciOCI.isZero) {
    items.push(NCILineItem.make({
      lineItemType: "NCIOCI",
      description: Schema.NonEmptyTrimmedString.make(`OCI attributable to non-controlling interest - ${subsidiaryName}`),
      amount: nciOCI,
      subsidiaryId: Option.some(subsidiaryId),
      subsidiaryName: Option.some(subName)
    }))
  }

  // Equity statement line item - NCI Dividends
  if (!nciDividends.isZero) {
    items.push(NCILineItem.make({
      lineItemType: "NCIDividends",
      description: Schema.NonEmptyTrimmedString.make(`Dividends to non-controlling interest - ${subsidiaryName}`),
      amount: nciDividends.negate(),
      subsidiaryId: Option.some(subsidiaryId),
      subsidiaryName: Option.some(subName)
    }))
  }

  return Chunk.fromIterable(items)
}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * SubsidiaryData - Data about a subsidiary needed for NCI calculation
 */
export interface SubsidiaryData {
  /** Subsidiary company ID */
  readonly subsidiaryId: CompanyId
  /** Subsidiary company name */
  readonly subsidiaryName: string
  /** Parent's ownership percentage */
  readonly parentOwnershipPercentage: Percentage
  /** Fair value of net assets at acquisition */
  readonly fairValueNetAssetsAtAcquisition: MonetaryAmount
  /** Optional NCI premium/discount at acquisition */
  readonly nciPremiumDiscountAtAcquisition?: MonetaryAmount
  /** Subsidiary's net income for the period */
  readonly subsidiaryNetIncome: MonetaryAmount
  /** Subsidiary's OCI for the period */
  readonly subsidiaryOCI: MonetaryAmount
  /** Dividends declared by subsidiary for the period */
  readonly dividendsDeclared: MonetaryAmount
  /** Cumulative NCI net income since acquisition (prior to current period) */
  readonly cumulativeNCINetIncome: MonetaryAmount
  /** Cumulative dividends paid to NCI since acquisition */
  readonly cumulativeDividendsToNCI: MonetaryAmount
  /** Cumulative NCI OCI since acquisition */
  readonly cumulativeNCIOCI: MonetaryAmount
  /** Period year */
  readonly periodYear: number
  /** Period number */
  readonly periodNumber: number
  /** Currency for all amounts */
  readonly currency: CurrencyCode
}

/**
 * CalculateNCIInput - Input for calculateNCI function
 */
export interface CalculateNCIInput {
  /** Subsidiary data */
  readonly subsidiary: SubsidiaryData
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * NCIServiceShape - Service interface for NCI calculations
 */
export interface NCIServiceShape {
  /**
   * Calculate NCI for a single subsidiary
   *
   * @param input - Subsidiary data for NCI calculation
   * @returns NCIResult containing all NCI information
   */
  readonly calculateNCI: (
    input: CalculateNCIInput
  ) => Effect.Effect<NCIResult, NCIServiceError>

  /**
   * Calculate consolidated NCI summary for multiple subsidiaries
   *
   * @param subsidiaries - Array of subsidiary data
   * @param currency - Reporting currency for consolidated amounts
   * @returns ConsolidatedNCISummary
   */
  readonly calculateConsolidatedNCI: (
    subsidiaries: ReadonlyArray<SubsidiaryData>,
    currency: CurrencyCode
  ) => Effect.Effect<ConsolidatedNCISummary, NCIServiceError>

  /**
   * Calculate NCI percentage from parent ownership
   *
   * @param parentOwnershipPct - Parent's ownership percentage
   * @returns NCIPercentage
   */
  readonly calculateNCIPercentage: (
    parentOwnershipPct: Percentage
  ) => Effect.Effect<NCIPercentage, InvalidOwnershipPercentageError>
}

/**
 * NCIService Context.Tag
 */
export class NCIService extends Context.Tag("NCIService")<
  NCIService,
  NCIServiceShape
>() {}

// =============================================================================
// Internal Implementation Functions
// =============================================================================

/**
 * Internal pure function to calculate NCI for a subsidiary
 * This is used by both calculateNCI service method and calculateConsolidatedNCI
 */
const calculateNCIForSubsidiary = (
  subsidiary: SubsidiaryData
): Effect.Effect<NCIResult, InvalidOwnershipPercentageError> =>
  Effect.gen(function* () {
    // Validate ownership percentage
    if (subsidiary.parentOwnershipPercentage < 0 || subsidiary.parentOwnershipPercentage > 100) {
      return yield* Effect.fail(
        new InvalidOwnershipPercentageError({
          ownershipPercentage: subsidiary.parentOwnershipPercentage,
          reason: Schema.NonEmptyTrimmedString.make("Ownership percentage must be between 0 and 100")
        })
      )
    }

    // Calculate NCI percentage
    const nciPercentageResult = calculateNCIPercentage(subsidiary.parentOwnershipPercentage)

    // If 100% owned, return early with zero NCI
    if (nciPercentageResult.isWhollyOwned) {
      const zeroAmount = MonetaryAmount.zero(subsidiary.currency)
      const zeroPercentage = Percentage.make(0)

      return NCIResult.make({
        subsidiaryId: subsidiary.subsidiaryId,
        subsidiaryName: Schema.NonEmptyTrimmedString.make(subsidiary.subsidiaryName),
        nciPercentage: nciPercentageResult,
        equityAtAcquisition: NCIEquityAtAcquisition.make({
          subsidiaryId: subsidiary.subsidiaryId,
          fairValueNetAssets: subsidiary.fairValueNetAssetsAtAcquisition,
          nciPercentage: zeroPercentage,
          nciShareOfFairValue: zeroAmount,
          nciPremiumDiscount: Option.none(),
          totalNCIAtAcquisition: zeroAmount
        }),
        subsequentChanges: NCISubsequentChanges.make({
          changes: Chunk.empty(),
          totalNetIncome: zeroAmount,
          totalDividends: zeroAmount,
          totalOCI: zeroAmount,
          totalOther: zeroAmount,
          netChange: zeroAmount
        }),
        currentPeriodNetIncome: NCINetIncome.make({
          subsidiaryId: subsidiary.subsidiaryId,
          subsidiaryNetIncome: subsidiary.subsidiaryNetIncome,
          nciPercentage: zeroPercentage,
          nciShareOfNetIncome: zeroAmount,
          periodYear: subsidiary.periodYear,
          periodNumber: subsidiary.periodNumber
        }),
        totalNCIEquity: zeroAmount,
        lineItems: Chunk.empty(),
        currency: subsidiary.currency
      })
    }

    // Calculate NCI equity at acquisition
    const equityAtAcquisition = calculateNCIEquityAtAcquisition(
      subsidiary.subsidiaryId,
      subsidiary.fairValueNetAssetsAtAcquisition,
      nciPercentageResult.nciPercentage,
      subsidiary.nciPremiumDiscountAtAcquisition
    )

    // Calculate current period NCI net income
    const currentPeriodNetIncome = calculateNCINetIncome(
      subsidiary.subsidiaryId,
      subsidiary.subsidiaryNetIncome,
      nciPercentageResult.nciPercentage,
      subsidiary.periodYear,
      subsidiary.periodNumber
    )

    // Calculate NCI share of current period OCI
    const currentPeriodNciOCI = calculateNCIShare(
      subsidiary.subsidiaryOCI,
      nciPercentageResult.nciPercentage
    )

    // Calculate NCI share of current period dividends
    const currentPeriodNciDividends = calculateNCIShare(
      subsidiary.dividendsDeclared,
      nciPercentageResult.nciPercentage
    )

    // Build subsequent changes
    const changes: NCIEquityChange[] = []

    // Add cumulative net income change
    if (!subsidiary.cumulativeNCINetIncome.isZero) {
      changes.push(NCIEquityChange.make({
        changeType: "NetIncome",
        description: Schema.NonEmptyTrimmedString.make("Cumulative NCI share of net income"),
        amount: subsidiary.cumulativeNCINetIncome,
        periodYear: subsidiary.periodYear,
        periodNumber: subsidiary.periodNumber
      }))
    }

    // Add current period net income change
    if (!currentPeriodNetIncome.nciShareOfNetIncome.isZero) {
      changes.push(NCIEquityChange.make({
        changeType: "NetIncome",
        description: Schema.NonEmptyTrimmedString.make("Current period NCI share of net income"),
        amount: currentPeriodNetIncome.nciShareOfNetIncome,
        periodYear: subsidiary.periodYear,
        periodNumber: subsidiary.periodNumber
      }))
    }

    // Add cumulative dividends change
    if (!subsidiary.cumulativeDividendsToNCI.isZero) {
      changes.push(NCIEquityChange.make({
        changeType: "Dividends",
        description: Schema.NonEmptyTrimmedString.make("Cumulative dividends to NCI"),
        amount: subsidiary.cumulativeDividendsToNCI.negate(),
        periodYear: subsidiary.periodYear,
        periodNumber: subsidiary.periodNumber
      }))
    }

    // Add current period dividends change
    if (!currentPeriodNciDividends.isZero) {
      changes.push(NCIEquityChange.make({
        changeType: "Dividends",
        description: Schema.NonEmptyTrimmedString.make("Current period dividends to NCI"),
        amount: currentPeriodNciDividends.negate(),
        periodYear: subsidiary.periodYear,
        periodNumber: subsidiary.periodNumber
      }))
    }

    // Add cumulative OCI change
    if (!subsidiary.cumulativeNCIOCI.isZero) {
      changes.push(NCIEquityChange.make({
        changeType: "OtherComprehensiveIncome",
        description: Schema.NonEmptyTrimmedString.make("Cumulative NCI share of OCI"),
        amount: subsidiary.cumulativeNCIOCI,
        periodYear: subsidiary.periodYear,
        periodNumber: subsidiary.periodNumber
      }))
    }

    // Add current period OCI change
    if (!currentPeriodNciOCI.isZero) {
      changes.push(NCIEquityChange.make({
        changeType: "OtherComprehensiveIncome",
        description: Schema.NonEmptyTrimmedString.make("Current period NCI share of OCI"),
        amount: currentPeriodNciOCI,
        periodYear: subsidiary.periodYear,
        periodNumber: subsidiary.periodNumber
      }))
    }

    // Calculate totals for subsequent changes
    const totalNetIncome = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(
        subsidiary.cumulativeNCINetIncome.amount,
        currentPeriodNetIncome.nciShareOfNetIncome.amount
      ),
      subsidiary.currency
    )

    const totalDividends = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(
        subsidiary.cumulativeDividendsToNCI.amount,
        currentPeriodNciDividends.amount
      ),
      subsidiary.currency
    )

    const totalOCI = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(
        subsidiary.cumulativeNCIOCI.amount,
        currentPeriodNciOCI.amount
      ),
      subsidiary.currency
    )

    const totalOther = MonetaryAmount.zero(subsidiary.currency)

    // Net change = net income - dividends + OCI + other
    const netChange = MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(
        BigDecimal.sum(
          BigDecimal.sum(totalNetIncome.amount, totalOCI.amount),
          totalOther.amount
        ),
        totalDividends.amount
      ),
      subsidiary.currency
    )

    const subsequentChanges = NCISubsequentChanges.make({
      changes: Chunk.fromIterable(changes),
      totalNetIncome,
      totalDividends,
      totalOCI,
      totalOther,
      netChange
    })

    // Calculate total NCI equity
    const totalNCIEquity = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(
        equityAtAcquisition.totalNCIAtAcquisition.amount,
        netChange.amount
      ),
      subsidiary.currency
    )

    // Create line items
    const lineItems = createNCILineItems(
      subsidiary.subsidiaryId,
      subsidiary.subsidiaryName,
      totalNCIEquity,
      currentPeriodNetIncome.nciShareOfNetIncome,
      currentPeriodNciOCI,
      currentPeriodNciDividends
    )

    return NCIResult.make({
      subsidiaryId: subsidiary.subsidiaryId,
      subsidiaryName: Schema.NonEmptyTrimmedString.make(subsidiary.subsidiaryName),
      nciPercentage: nciPercentageResult,
      equityAtAcquisition,
      subsequentChanges,
      currentPeriodNetIncome,
      totalNCIEquity,
      lineItems,
      currency: subsidiary.currency
    })
  })

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the NCIService implementation
 */
const make = Effect.gen(function* () {
  return {
    calculateNCI: (input: CalculateNCIInput) =>
      calculateNCIForSubsidiary(input.subsidiary),

    calculateConsolidatedNCI: (
      subsidiaries: ReadonlyArray<SubsidiaryData>,
      currency: CurrencyCode
    ) =>
      Effect.gen(function* () {
        const results: NCIResult[] = []

        for (const subsidiary of subsidiaries) {
          const result = yield* calculateNCIForSubsidiary(subsidiary)
          results.push(result)
        }

        // Filter out wholly-owned subsidiaries (no NCI)
        const resultsWithNCI = results.filter((r) => r.hasNCI)

        // Calculate totals
        let totalNCIEquity = BigDecimal.fromNumber(0)
        let totalNCINetIncome = BigDecimal.fromNumber(0)
        let totalNCIOCI = BigDecimal.fromNumber(0)

        for (const result of resultsWithNCI) {
          totalNCIEquity = BigDecimal.sum(totalNCIEquity, result.totalNCIEquity.amount)
          totalNCINetIncome = BigDecimal.sum(
            totalNCINetIncome,
            result.currentPeriodNetIncome.nciShareOfNetIncome.amount
          )
          const ociItems = result.ociLineItems
          for (const item of Chunk.toReadonlyArray(ociItems)) {
            totalNCIOCI = BigDecimal.sum(totalNCIOCI, item.amount.amount)
          }
        }

        // Create consolidated line items
        const consolidatedLineItems: NCILineItem[] = []

        // Add consolidated NCI equity line
        if (!BigDecimal.isZero(totalNCIEquity)) {
          consolidatedLineItems.push(NCILineItem.make({
            lineItemType: "NCIEquity",
            description: Schema.NonEmptyTrimmedString.make("Total non-controlling interests"),
            amount: MonetaryAmount.fromBigDecimal(totalNCIEquity, currency),
            subsidiaryId: Option.none(),
            subsidiaryName: Option.none()
          }))
        }

        // Add consolidated NCI net income line
        if (!BigDecimal.isZero(totalNCINetIncome)) {
          consolidatedLineItems.push(NCILineItem.make({
            lineItemType: "NCINetIncome",
            description: Schema.NonEmptyTrimmedString.make("Net income attributable to non-controlling interests"),
            amount: MonetaryAmount.fromBigDecimal(totalNCINetIncome, currency),
            subsidiaryId: Option.none(),
            subsidiaryName: Option.none()
          }))
        }

        // Add consolidated NCI OCI line
        if (!BigDecimal.isZero(totalNCIOCI)) {
          consolidatedLineItems.push(NCILineItem.make({
            lineItemType: "NCIOCI",
            description: Schema.NonEmptyTrimmedString.make("OCI attributable to non-controlling interests"),
            amount: MonetaryAmount.fromBigDecimal(totalNCIOCI, currency),
            subsidiaryId: Option.none(),
            subsidiaryName: Option.none()
          }))
        }

        return ConsolidatedNCISummary.make({
          subsidiaryResults: Chunk.fromIterable(resultsWithNCI),
          totalNCIEquity: MonetaryAmount.fromBigDecimal(totalNCIEquity, currency),
          totalNCINetIncome: MonetaryAmount.fromBigDecimal(totalNCINetIncome, currency),
          totalNCIOCI: MonetaryAmount.fromBigDecimal(totalNCIOCI, currency),
          consolidatedLineItems: Chunk.fromIterable(consolidatedLineItems),
          currency
        })
      }),

    calculateNCIPercentage: (parentOwnershipPct: Percentage) =>
      Effect.gen(function* () {
        if (parentOwnershipPct < 0 || parentOwnershipPct > 100) {
          return yield* Effect.fail(
            new InvalidOwnershipPercentageError({
              ownershipPercentage: parentOwnershipPct,
              reason: Schema.NonEmptyTrimmedString.make("Ownership percentage must be between 0 and 100")
            })
          )
        }
        return calculateNCIPercentage(parentOwnershipPct)
      })
  } satisfies NCIServiceShape
})

// =============================================================================
// Layer
// =============================================================================

/**
 * NCIServiceLive - Live implementation of NCIService
 */
export const NCIServiceLive: Layer.Layer<NCIService> = Layer.effect(NCIService, make)
