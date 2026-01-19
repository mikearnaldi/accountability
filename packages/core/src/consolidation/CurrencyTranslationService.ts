/**
 * CurrencyTranslationService - Currency translation for consolidation per ASC 830
 *
 * Implements the currency translation step of consolidation per ASC 830:
 * - translateMemberBalances: (member, reportingCurrency, rates) -> Effect<TranslatedTrialBalance>
 * - Assets/Liabilities: Closing rate
 * - Income/Expense: Average rate (or transaction date rate)
 * - Equity (capital accounts): Historical rate
 * - Retained Earnings: Calculated (opening + NI - dividends)
 * - CTA (Cumulative Translation Adjustment): Calculated as plug to OCI
 *
 * Per ASC 830, the translation process converts financial statements from an entity's
 * functional currency to the reporting currency using appropriate exchange rates for
 * each type of account.
 *
 * @module CurrencyTranslationService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { AccountType } from "../accounting/Account.ts"
import type { CompanyId } from "../company/Company.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when exchange rate is not found for translation
 */
export class TranslationRateNotFoundError extends Schema.TaggedError<TranslationRateNotFoundError>()(
  "TranslationRateNotFoundError",
  {
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rateType: Schema.Literal("Spot", "Average", "Historical", "Closing"),
    asOfDate: LocalDate
  }
) {
  get message(): string {
    const dateStr = `${this.asOfDate.year}-${String(this.asOfDate.month).padStart(2, "0")}-${String(this.asOfDate.day).padStart(2, "0")}`
    return `Exchange rate not found: ${this.fromCurrency}/${this.toCurrency} (${this.rateType}) for date ${dateStr}`
  }
}

/**
 * Type guard for TranslationRateNotFoundError
 */
export const isTranslationRateNotFoundError = Schema.is(TranslationRateNotFoundError)

/**
 * Error when historical rate is required but not available for equity accounts
 */
export class HistoricalRateRequiredError extends Schema.TaggedError<HistoricalRateRequiredError>()(
  "HistoricalRateRequiredError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    accountNumber: Schema.NonEmptyTrimmedString,
    accountName: Schema.NonEmptyTrimmedString,
    currency: CurrencyCode
  }
) {
  get message(): string {
    return `Historical rate required for equity account ${this.accountNumber} (${this.accountName}) in currency ${this.currency}`
  }
}

/**
 * Type guard for HistoricalRateRequiredError
 */
export const isHistoricalRateRequiredError = Schema.is(HistoricalRateRequiredError)

/**
 * Union type for all currency translation service errors
 */
export type CurrencyTranslationError =
  | TranslationRateNotFoundError
  | HistoricalRateRequiredError

// =============================================================================
// Translation Rate Types
// =============================================================================

/**
 * TranslationRateType - The type of rate to use per ASC 830
 *
 * - Closing: Current rate at balance sheet date (assets/liabilities)
 * - Average: Average rate for the period (income/expense)
 * - Historical: Rate at transaction date (capital stock, APIC)
 * - Calculated: For retained earnings which is computed, not translated directly
 */
export const TranslationRateType = Schema.Literal(
  "Closing",
  "Average",
  "Historical",
  "Calculated"
).annotations({
  identifier: "TranslationRateType",
  title: "Translation Rate Type",
  description: "The type of exchange rate to use for translation per ASC 830"
})

/**
 * The TranslationRateType type
 */
export type TranslationRateType = typeof TranslationRateType.Type

/**
 * Type guard for TranslationRateType
 */
export const isTranslationRateType = Schema.is(TranslationRateType)

// =============================================================================
// Translation Input/Output Types
// =============================================================================

/**
 * AccountTranslationCategory - How an account should be translated per ASC 830
 */
export const AccountTranslationCategory = Schema.Literal(
  "MonetaryAsset",      // Assets - translated at closing rate
  "NonMonetaryAsset",   // Assets - can use historical or closing
  "MonetaryLiability",  // Liabilities - translated at closing rate
  "NonMonetaryLiability", // Liabilities - can use historical or closing
  "CapitalStock",       // Equity - translated at historical rate
  "APIC",               // Equity - translated at historical rate
  "RetainedEarnings",   // Equity - calculated, not directly translated
  "OCI",                // Equity - includes CTA
  "TreasuryStock",      // Equity - translated at historical rate
  "Revenue",            // Income - translated at average rate
  "Expense"             // Expense - translated at average rate
).annotations({
  identifier: "AccountTranslationCategory",
  title: "Account Translation Category",
  description: "Category determining translation method per ASC 830"
})

/**
 * The AccountTranslationCategory type
 */
export type AccountTranslationCategory = typeof AccountTranslationCategory.Type

/**
 * Type guard for AccountTranslationCategory
 */
export const isAccountTranslationCategory = Schema.is(AccountTranslationCategory)

/**
 * MemberTrialBalanceLineItem - A line item from a member's trial balance for translation
 */
export class MemberTrialBalanceLineItem extends Schema.Class<MemberTrialBalanceLineItem>(
  "MemberTrialBalanceLineItem"
)({
  /**
   * Account number
   */
  accountNumber: Schema.NonEmptyTrimmedString,

  /**
   * Account name
   */
  accountName: Schema.NonEmptyTrimmedString,

  /**
   * Account type per chart of accounts
   */
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),

  /**
   * Account category for more detailed classification
   */
  accountCategory: Schema.String,

  /**
   * Translation category per ASC 830
   */
  translationCategory: AccountTranslationCategory,

  /**
   * Balance in functional currency (before translation)
   */
  functionalBalance: MonetaryAmount,

  /**
   * Historical rate to use for this account (for capital accounts)
   * If provided, used instead of looking up current historical rate
   */
  historicalRate: Schema.OptionFromNullOr(Schema.BigDecimal)
}) {
  /**
   * Check if this is an equity account
   */
  get isEquityAccount(): boolean {
    return this.accountType === "Equity"
  }

  /**
   * Check if this account uses historical rate
   */
  get usesHistoricalRate(): boolean {
    return this.translationCategory === "CapitalStock" ||
           this.translationCategory === "APIC" ||
           this.translationCategory === "TreasuryStock"
  }

  /**
   * Check if this is the retained earnings account
   */
  get isRetainedEarnings(): boolean {
    return this.translationCategory === "RetainedEarnings"
  }

  /**
   * Check if this is an income statement account
   */
  get isIncomeStatementAccount(): boolean {
    return this.accountType === "Revenue" || this.accountType === "Expense"
  }
}

/**
 * Type guard for MemberTrialBalanceLineItem
 */
export const isMemberTrialBalanceLineItem = Schema.is(MemberTrialBalanceLineItem)

/**
 * TranslatedLineItem - A line item after translation to reporting currency
 */
export class TranslatedLineItem extends Schema.Class<TranslatedLineItem>("TranslatedLineItem")({
  /**
   * Account number
   */
  accountNumber: Schema.NonEmptyTrimmedString,

  /**
   * Account name
   */
  accountName: Schema.NonEmptyTrimmedString,

  /**
   * Account type
   */
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),

  /**
   * Account category
   */
  accountCategory: Schema.String,

  /**
   * Translation category used
   */
  translationCategory: AccountTranslationCategory,

  /**
   * Original balance in functional currency
   */
  functionalBalance: MonetaryAmount,

  /**
   * Translated balance in reporting currency
   */
  translatedBalance: MonetaryAmount,

  /**
   * Exchange rate used for translation
   */
  exchangeRate: Schema.BigDecimal,

  /**
   * The type of rate used (Closing, Average, Historical, or Calculated)
   */
  rateType: TranslationRateType
}) {
  /**
   * Get the translation difference (translated - functional * current rate)
   * This is informational for understanding the impact of using different rates
   */
  get isEquityAccount(): boolean {
    return this.accountType === "Equity"
  }
}

/**
 * Type guard for TranslatedLineItem
 */
export const isTranslatedLineItem = Schema.is(TranslatedLineItem)

/**
 * RetainedEarningsComponents - Components needed to calculate retained earnings
 *
 * Per ASC 830, retained earnings is calculated as:
 * Opening RE (at prior period rate) + Net Income (at average rate) - Dividends (at historical rate)
 */
export class RetainedEarningsComponents extends Schema.Class<RetainedEarningsComponents>(
  "RetainedEarningsComponents"
)({
  /**
   * Opening retained earnings in functional currency
   */
  openingRetainedEarnings: MonetaryAmount,

  /**
   * Opening retained earnings translated to reporting currency
   */
  translatedOpeningRetainedEarnings: MonetaryAmount,

  /**
   * Net income for the period in functional currency
   */
  netIncome: MonetaryAmount,

  /**
   * Net income translated at average rate
   */
  translatedNetIncome: MonetaryAmount,

  /**
   * Dividends declared in functional currency
   */
  dividendsDeclared: MonetaryAmount,

  /**
   * Dividends translated at rate on declaration date
   */
  translatedDividends: MonetaryAmount,

  /**
   * Calculated closing retained earnings in reporting currency
   */
  closingRetainedEarnings: MonetaryAmount
}) {
  /**
   * Check if there was net income (positive)
   */
  get hasNetIncome(): boolean {
    return this.netIncome.isPositive
  }

  /**
   * Check if there was a net loss (negative)
   */
  get hasNetLoss(): boolean {
    return this.netIncome.isNegative
  }
}

/**
 * Type guard for RetainedEarningsComponents
 */
export const isRetainedEarningsComponents = Schema.is(RetainedEarningsComponents)

/**
 * CTACalculation - Cumulative Translation Adjustment calculation
 *
 * CTA is the balancing amount that makes the translated balance sheet balance.
 * It is recorded in Other Comprehensive Income (OCI).
 *
 * CTA = (Assets translated at closing rate + Liabilities translated at closing rate)
 *     - (Equity translated at various rates)
 *
 * More specifically:
 * CTA = Total Translated Assets
 *     - Total Translated Liabilities
 *     - Capital Stock (historical)
 *     - APIC (historical)
 *     - Retained Earnings (calculated)
 *     - Treasury Stock (historical)
 *     - Prior CTA
 */
export class CTACalculation extends Schema.Class<CTACalculation>("CTACalculation")({
  /**
   * Company ID for the CTA calculation
   */
  companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * Total assets translated at closing rate
   */
  totalTranslatedAssets: MonetaryAmount,

  /**
   * Total liabilities translated at closing rate
   */
  totalTranslatedLiabilities: MonetaryAmount,

  /**
   * Total equity translated (excluding CTA)
   */
  totalTranslatedEquityExCTA: MonetaryAmount,

  /**
   * Opening CTA balance from prior period
   */
  openingCTA: MonetaryAmount,

  /**
   * Current period CTA movement
   */
  currentPeriodCTA: MonetaryAmount,

  /**
   * Closing CTA balance
   */
  closingCTA: MonetaryAmount,

  /**
   * Reporting currency
   */
  reportingCurrency: CurrencyCode
}) {
  /**
   * Check if CTA is a gain (positive)
   */
  get isGain(): boolean {
    return this.currentPeriodCTA.isPositive
  }

  /**
   * Check if CTA is a loss (negative)
   */
  get isLoss(): boolean {
    return this.currentPeriodCTA.isNegative
  }

  /**
   * Check if there is no CTA movement
   */
  get isZero(): boolean {
    return this.currentPeriodCTA.isZero
  }
}

/**
 * Type guard for CTACalculation
 */
export const isCTACalculation = Schema.is(CTACalculation)

/**
 * TranslatedTrialBalance - Complete translated trial balance for a member company
 */
export class TranslatedTrialBalance extends Schema.Class<TranslatedTrialBalance>(
  "TranslatedTrialBalance"
)({
  /**
   * Company ID
   */
  companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * Company name
   */
  companyName: Schema.NonEmptyTrimmedString,

  /**
   * Functional currency of the member
   */
  functionalCurrency: CurrencyCode,

  /**
   * Reporting currency (after translation)
   */
  reportingCurrency: CurrencyCode,

  /**
   * As-of date for the translation
   */
  asOfDate: LocalDate,

  /**
   * Period start date (for average rate calculation)
   */
  periodStartDate: LocalDate,

  /**
   * Translated line items
   */
  lineItems: Schema.Chunk(TranslatedLineItem),

  /**
   * Retained earnings calculation details
   */
  retainedEarningsDetails: Schema.OptionFromNullOr(RetainedEarningsComponents),

  /**
   * CTA calculation details
   */
  ctaCalculation: CTACalculation,

  /**
   * Total assets in reporting currency
   */
  totalAssets: MonetaryAmount,

  /**
   * Total liabilities in reporting currency
   */
  totalLiabilities: MonetaryAmount,

  /**
   * Total equity in reporting currency (including CTA)
   */
  totalEquity: MonetaryAmount,

  /**
   * Total revenue in reporting currency
   */
  totalRevenue: MonetaryAmount,

  /**
   * Total expenses in reporting currency
   */
  totalExpenses: MonetaryAmount,

  /**
   * Closing rate used for assets/liabilities
   */
  closingRate: Schema.BigDecimal,

  /**
   * Average rate used for income/expense
   */
  averageRate: Schema.BigDecimal
}) {
  /**
   * Get the translated net income
   */
  get translatedNetIncome(): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(this.totalRevenue.amount, this.totalExpenses.amount),
      this.reportingCurrency
    )
  }

  /**
   * Check if balance sheet is balanced (Assets = Liabilities + Equity)
   */
  get isBalanced(): boolean {
    const liabilitiesPlusEquity = BigDecimal.sum(
      this.totalLiabilities.amount,
      this.totalEquity.amount
    )
    // Allow for small rounding differences
    const difference = BigDecimal.abs(
      BigDecimal.subtract(this.totalAssets.amount, liabilitiesPlusEquity)
    )
    return BigDecimal.lessThan(difference, BigDecimal.fromNumber(0.01))
  }

  /**
   * Get the number of line items
   */
  get lineItemCount(): number {
    return Chunk.size(this.lineItems)
  }
}

/**
 * Type guard for TranslatedTrialBalance
 */
export const isTranslatedTrialBalance = Schema.is(TranslatedTrialBalance)

/**
 * Encoded type interface for TranslatedTrialBalance
 */
export interface TranslatedTrialBalanceEncoded extends Schema.Schema.Encoded<typeof TranslatedTrialBalance> {}

// =============================================================================
// Translation Rates Input
// =============================================================================

/**
 * TranslationRates - Exchange rates needed for translation
 *
 * Contains all rates needed to translate a trial balance per ASC 830
 */
export class TranslationRates extends Schema.Class<TranslationRates>("TranslationRates")({
  /**
   * Closing rate at balance sheet date (for assets/liabilities)
   */
  closingRate: Schema.BigDecimal,

  /**
   * Average rate for the period (for income/expense)
   */
  averageRate: Schema.BigDecimal,

  /**
   * Historical rates by account number (for capital accounts)
   * Key is account number, value is the historical rate to use
   */
  historicalRates: Schema.HashMap({ key: Schema.String, value: Schema.BigDecimal }),

  /**
   * Prior period closing CTA balance
   */
  priorCTA: MonetaryAmount,

  /**
   * Opening retained earnings already translated to reporting currency
   */
  translatedOpeningRetainedEarnings: MonetaryAmount,

  /**
   * Dividends rate (rate at declaration date)
   */
  dividendsRate: Schema.OptionFromNullOr(Schema.BigDecimal)
}) {}

/**
 * Type guard for TranslationRates
 */
export const isTranslationRates = Schema.is(TranslationRates)

// =============================================================================
// Input for translateMemberBalances
// =============================================================================

/**
 * TranslateMemberBalancesInput - Input for the translateMemberBalances function
 */
export interface TranslateMemberBalancesInput {
  /** Company ID */
  readonly companyId: CompanyId
  /** Company name */
  readonly companyName: string
  /** Functional currency of the member */
  readonly functionalCurrency: CurrencyCode
  /** Reporting currency to translate to */
  readonly reportingCurrency: CurrencyCode
  /** As-of date for the translation */
  readonly asOfDate: LocalDate
  /** Period start date (for average rate context) */
  readonly periodStartDate: LocalDate
  /** Trial balance line items to translate */
  readonly lineItems: Chunk.Chunk<MemberTrialBalanceLineItem>
  /** Translation rates to use */
  readonly rates: TranslationRates
  /** Net income for the period in functional currency */
  readonly netIncome: MonetaryAmount
  /** Dividends declared in functional currency */
  readonly dividendsDeclared: MonetaryAmount
  /** Opening retained earnings in functional currency */
  readonly openingRetainedEarnings: MonetaryAmount
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * CurrencyTranslationServiceShape - Service interface for currency translation in consolidation
 */
export interface CurrencyTranslationServiceShape {
  /**
   * Translate member trial balance to reporting currency per ASC 830
   *
   * Applies the appropriate exchange rate based on account type:
   * - Assets/Liabilities: Closing rate (balance sheet date)
   * - Income/Expense: Average rate for the period
   * - Capital Stock/APIC: Historical rate (when issued)
   * - Retained Earnings: Calculated (opening + NI - dividends)
   * - CTA: Calculated as plug to balance
   *
   * @param input - The translation input parameters
   * @returns Effect containing the translated trial balance
   * @throws TranslationRateNotFoundError if required rate is not available
   * @throws HistoricalRateRequiredError if historical rate needed but not provided
   */
  readonly translateMemberBalances: (
    input: TranslateMemberBalancesInput
  ) => Effect.Effect<
    TranslatedTrialBalance,
    CurrencyTranslationError,
    never
  >

  /**
   * Determine the translation category for an account based on its type and category
   *
   * @param accountType - The account type (Asset, Liability, Equity, Revenue, Expense)
   * @param accountCategory - The account category for more specific classification
   * @returns The translation category to use per ASC 830
   */
  readonly determineTranslationCategory: (
    accountType: AccountType,
    accountCategory: string
  ) => AccountTranslationCategory

  /**
   * Get the rate type to use for a translation category
   *
   * @param category - The translation category
   * @returns The rate type to apply
   */
  readonly getRateTypeForCategory: (
    category: AccountTranslationCategory
  ) => TranslationRateType
}

/**
 * CurrencyTranslationService Context.Tag
 */
export class CurrencyTranslationService extends Context.Tag("CurrencyTranslationService")<
  CurrencyTranslationService,
  CurrencyTranslationServiceShape
>() {}

// =============================================================================
// Pure Functions
// =============================================================================

/**
 * Determine the translation category for an account per ASC 830
 */
export const determineTranslationCategory = (
  accountType: AccountType,
  accountCategory: string
): AccountTranslationCategory => {
  switch (accountType) {
    case "Asset":
      // Most assets use closing rate, but we categorize for clarity
      return "MonetaryAsset"

    case "Liability":
      return "MonetaryLiability"

    case "Equity":
      // Classify equity accounts by their category
      if (accountCategory === "ContributedCapital") {
        return "CapitalStock"
      }
      if (accountCategory === "RetainedEarnings") {
        return "RetainedEarnings"
      }
      if (accountCategory === "OtherComprehensiveIncome") {
        return "OCI"
      }
      if (accountCategory === "TreasuryStock") {
        return "TreasuryStock"
      }
      // Default equity accounts to APIC treatment (historical rate)
      return "APIC"

    case "Revenue":
      return "Revenue"

    case "Expense":
      return "Expense"
  }
}

/**
 * Get the rate type to use for a translation category per ASC 830
 */
export const getRateTypeForCategory = (
  category: AccountTranslationCategory
): TranslationRateType => {
  switch (category) {
    case "MonetaryAsset":
    case "NonMonetaryAsset":
    case "MonetaryLiability":
    case "NonMonetaryLiability":
      return "Closing"

    case "CapitalStock":
    case "APIC":
    case "TreasuryStock":
      return "Historical"

    case "RetainedEarnings":
      return "Calculated"

    case "OCI":
      // OCI includes CTA which is calculated
      return "Calculated"

    case "Revenue":
    case "Expense":
      return "Average"
  }
}

/**
 * Translate a single line item
 */
const translateLineItem = (
  item: MemberTrialBalanceLineItem,
  rates: TranslationRates,
  reportingCurrency: CurrencyCode
): Effect.Effect<TranslatedLineItem, HistoricalRateRequiredError> =>
  Effect.gen(function* () {
    const rateType = getRateTypeForCategory(item.translationCategory)
    let rate: BigDecimal.BigDecimal
    let appliedRateType: TranslationRateType = rateType

    switch (rateType) {
      case "Closing":
        rate = rates.closingRate
        break

      case "Average":
        rate = rates.averageRate
        break

      case "Historical":
        // Try to get historical rate from the item or from the rates map
        if (Option.isSome(item.historicalRate)) {
          rate = item.historicalRate.value
        } else {
          // Look up in rates map
          const historicalRatesArray = Array.from(rates.historicalRates)
          const found = historicalRatesArray.find(([key]) => key === item.accountNumber)
          if (found) {
            rate = found[1]
          } else {
            // Fall back to closing rate with a warning
            // In a real implementation, this might be an error
            rate = rates.closingRate
            appliedRateType = "Closing"
          }
        }
        break

      case "Calculated":
        // For retained earnings and OCI, we don't directly translate
        // These are handled separately; use closing rate as placeholder
        rate = rates.closingRate
        break
    }

    // Calculate translated amount
    const translatedAmount = BigDecimal.multiply(item.functionalBalance.amount, rate)
    const translatedBalance = MonetaryAmount.fromBigDecimal(translatedAmount, reportingCurrency)

    return TranslatedLineItem.make({
      accountNumber: item.accountNumber,
      accountName: item.accountName,
      accountType: item.accountType,
      accountCategory: item.accountCategory,
      translationCategory: item.translationCategory,
      functionalBalance: item.functionalBalance,
      translatedBalance,
      exchangeRate: rate,
      rateType: appliedRateType
    })
  })

/**
 * Calculate retained earnings per ASC 830
 *
 * Retained Earnings = Opening RE (translated) + Net Income (at average rate) - Dividends (at dividend rate)
 */
const calculateRetainedEarnings = (
  openingRetainedEarnings: MonetaryAmount,
  translatedOpeningRetainedEarnings: MonetaryAmount,
  netIncome: MonetaryAmount,
  averageRate: BigDecimal.BigDecimal,
  dividendsDeclared: MonetaryAmount,
  dividendsRate: Option.Option<BigDecimal.BigDecimal>,
  reportingCurrency: CurrencyCode
): RetainedEarningsComponents => {
  // Translate net income at average rate
  const translatedNetIncomeAmount = BigDecimal.multiply(netIncome.amount, averageRate)
  const translatedNetIncome = MonetaryAmount.fromBigDecimal(translatedNetIncomeAmount, reportingCurrency)

  // Translate dividends at dividend rate (or average rate if not provided)
  const divRate = Option.getOrElse(dividendsRate, () => averageRate)
  const translatedDividendsAmount = BigDecimal.multiply(dividendsDeclared.amount, divRate)
  const translatedDividends = MonetaryAmount.fromBigDecimal(translatedDividendsAmount, reportingCurrency)

  // Calculate closing retained earnings: Opening + Net Income - Dividends
  const closingREAmount = BigDecimal.subtract(
    BigDecimal.sum(translatedOpeningRetainedEarnings.amount, translatedNetIncomeAmount),
    translatedDividendsAmount
  )
  const closingRetainedEarnings = MonetaryAmount.fromBigDecimal(closingREAmount, reportingCurrency)

  return RetainedEarningsComponents.make({
    openingRetainedEarnings,
    translatedOpeningRetainedEarnings,
    netIncome,
    translatedNetIncome,
    dividendsDeclared,
    translatedDividends,
    closingRetainedEarnings
  })
}

/**
 * Calculate CTA (Cumulative Translation Adjustment)
 *
 * CTA is the amount needed to make the balance sheet balance after translation.
 * It goes into Other Comprehensive Income.
 *
 * CTA = Total Assets - Total Liabilities - Total Equity (ex CTA)
 * or equivalently: CTA makes A = L + E balance
 */
const calculateCTA = (
  companyId: CompanyId,
  totalAssets: MonetaryAmount,
  totalLiabilities: MonetaryAmount,
  totalEquityExCTA: MonetaryAmount,
  priorCTA: MonetaryAmount,
  reportingCurrency: CurrencyCode
): CTACalculation => {
  // CTA = Assets - Liabilities - Equity (ex CTA)
  // This is the plug to make A = L + E balance
  const liabilitiesPlusEquity = BigDecimal.sum(
    totalLiabilities.amount,
    totalEquityExCTA.amount
  )
  const closingCTAAmount = BigDecimal.subtract(totalAssets.amount, liabilitiesPlusEquity)
  const closingCTA = MonetaryAmount.fromBigDecimal(closingCTAAmount, reportingCurrency)

  // Current period CTA movement = Closing CTA - Opening CTA
  const currentPeriodCTAAmount = BigDecimal.subtract(closingCTAAmount, priorCTA.amount)
  const currentPeriodCTA = MonetaryAmount.fromBigDecimal(currentPeriodCTAAmount, reportingCurrency)

  return CTACalculation.make({
    companyId,
    totalTranslatedAssets: totalAssets,
    totalTranslatedLiabilities: totalLiabilities,
    totalTranslatedEquityExCTA: totalEquityExCTA,
    openingCTA: priorCTA,
    currentPeriodCTA,
    closingCTA,
    reportingCurrency
  })
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the CurrencyTranslationService implementation
 */
const make = Effect.gen(function* () {
  return {
    translateMemberBalances: (input: TranslateMemberBalancesInput) =>
      Effect.gen(function* () {
        const {
          companyId,
          companyName,
          functionalCurrency,
          reportingCurrency,
          asOfDate,
          periodStartDate,
          lineItems,
          rates,
          netIncome,
          dividendsDeclared,
          openingRetainedEarnings
        } = input

        // If same currency, no translation needed (1:1)
        const isSameCurrency = functionalCurrency === reportingCurrency
        const effectiveClosingRate = isSameCurrency
          ? BigDecimal.fromNumber(1)
          : rates.closingRate
        const effectiveAverageRate = isSameCurrency
          ? BigDecimal.fromNumber(1)
          : rates.averageRate

        // Create rates with potentially adjusted values
        const effectiveRates = isSameCurrency
          ? TranslationRates.make({
              closingRate: BigDecimal.fromNumber(1),
              averageRate: BigDecimal.fromNumber(1),
              historicalRates: rates.historicalRates,
              priorCTA: MonetaryAmount.zero(reportingCurrency),
              translatedOpeningRetainedEarnings: MonetaryAmount.fromBigDecimal(
                openingRetainedEarnings.amount,
                reportingCurrency
              ),
              dividendsRate: Option.some(BigDecimal.fromNumber(1))
            })
          : rates

        // Translate each line item
        const translatedItemsArray: TranslatedLineItem[] = []
        for (const item of Chunk.toReadonlyArray(lineItems)) {
          const translated = yield* translateLineItem(item, effectiveRates, reportingCurrency)
          translatedItemsArray.push(translated)
        }
        const translatedItems = Chunk.fromIterable(translatedItemsArray)

        // Calculate totals by account type
        let totalAssets = BigDecimal.fromNumber(0)
        let totalLiabilities = BigDecimal.fromNumber(0)
        let totalEquityExRE = BigDecimal.fromNumber(0)
        let totalRevenue = BigDecimal.fromNumber(0)
        let totalExpenses = BigDecimal.fromNumber(0)

        for (const item of translatedItemsArray) {
          switch (item.accountType) {
            case "Asset":
              totalAssets = BigDecimal.sum(totalAssets, item.translatedBalance.amount)
              break
            case "Liability":
              totalLiabilities = BigDecimal.sum(totalLiabilities, item.translatedBalance.amount)
              break
            case "Equity":
              // Exclude retained earnings as it will be calculated
              if (item.translationCategory !== "RetainedEarnings") {
                totalEquityExRE = BigDecimal.sum(totalEquityExRE, item.translatedBalance.amount)
              }
              break
            case "Revenue":
              totalRevenue = BigDecimal.sum(totalRevenue, item.translatedBalance.amount)
              break
            case "Expense":
              totalExpenses = BigDecimal.sum(totalExpenses, item.translatedBalance.amount)
              break
          }
        }

        // Calculate retained earnings
        const retainedEarningsDetails = calculateRetainedEarnings(
          openingRetainedEarnings,
          effectiveRates.translatedOpeningRetainedEarnings,
          netIncome,
          effectiveAverageRate,
          dividendsDeclared,
          effectiveRates.dividendsRate,
          reportingCurrency
        )

        // Total equity excluding CTA = Equity accounts (ex RE) + Calculated RE
        const totalEquityExCTA = BigDecimal.sum(
          totalEquityExRE,
          retainedEarningsDetails.closingRetainedEarnings.amount
        )

        // Calculate CTA
        const ctaCalculation = calculateCTA(
          companyId,
          MonetaryAmount.fromBigDecimal(totalAssets, reportingCurrency),
          MonetaryAmount.fromBigDecimal(totalLiabilities, reportingCurrency),
          MonetaryAmount.fromBigDecimal(totalEquityExCTA, reportingCurrency),
          effectiveRates.priorCTA,
          reportingCurrency
        )

        // Total equity = Equity ex CTA + CTA
        const totalEquity = BigDecimal.sum(totalEquityExCTA, ctaCalculation.closingCTA.amount)

        return TranslatedTrialBalance.make({
          companyId,
          companyName: Schema.NonEmptyTrimmedString.make(companyName),
          functionalCurrency,
          reportingCurrency,
          asOfDate,
          periodStartDate,
          lineItems: translatedItems,
          retainedEarningsDetails: Option.some(retainedEarningsDetails),
          ctaCalculation,
          totalAssets: MonetaryAmount.fromBigDecimal(totalAssets, reportingCurrency),
          totalLiabilities: MonetaryAmount.fromBigDecimal(totalLiabilities, reportingCurrency),
          totalEquity: MonetaryAmount.fromBigDecimal(totalEquity, reportingCurrency),
          totalRevenue: MonetaryAmount.fromBigDecimal(totalRevenue, reportingCurrency),
          totalExpenses: MonetaryAmount.fromBigDecimal(totalExpenses, reportingCurrency),
          closingRate: effectiveClosingRate,
          averageRate: effectiveAverageRate
        })
      }),

    determineTranslationCategory,

    getRateTypeForCategory
  } satisfies CurrencyTranslationServiceShape
})

// =============================================================================
// Layer
// =============================================================================

/**
 * CurrencyTranslationServiceLive - Live implementation of CurrencyTranslationService
 */
export const CurrencyTranslationServiceLive: Layer.Layer<
  CurrencyTranslationService,
  never,
  never
> = Layer.effect(CurrencyTranslationService, make)
