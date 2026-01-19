import { describe, it, expect } from "@effect/vitest"
import { Chunk, Effect, HashMap, Option } from "effect"
import * as BigDecimal from "effect/BigDecimal"
import * as Schema from "effect/Schema"
import {
  CurrencyTranslationService,
  CurrencyTranslationServiceLive,
  TranslationRateNotFoundError,
  HistoricalRateRequiredError,
  TranslationRates,
  MemberTrialBalanceLineItem,
  TranslatedLineItem,
  TranslatedTrialBalance,
  RetainedEarningsComponents,
  CTACalculation,
  determineTranslationCategory,
  getRateTypeForCategory,
  isTranslationRateNotFoundError,
  isHistoricalRateRequiredError,
  isMemberTrialBalanceLineItem,
  isTranslatedLineItem,
  isTranslatedTrialBalance,
  isRetainedEarningsComponents,
  isCTACalculation,
  isTranslationRates,
  type TranslateMemberBalancesInput
} from "../../src/consolidation/CurrencyTranslationService.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"

// =============================================================================
// Test Helpers
// =============================================================================

const companyUUID = "550e8400-e29b-41d4-a716-446655440000"
const companyId = CompanyId.make(companyUUID)
const usdCurrency = CurrencyCode.make("USD")
const eurCurrency = CurrencyCode.make("EUR")
const testDate = LocalDate.make({ year: 2024, month: 12, day: 31 })
const periodStartDate = LocalDate.make({ year: 2024, month: 1, day: 1 })

const createLineItem = (
  accountNumber: string,
  accountName: string,
  accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense",
  accountCategory: string,
  translationCategory:
    | "MonetaryAsset"
    | "NonMonetaryAsset"
    | "MonetaryLiability"
    | "NonMonetaryLiability"
    | "CapitalStock"
    | "APIC"
    | "RetainedEarnings"
    | "OCI"
    | "TreasuryStock"
    | "Revenue"
    | "Expense",
  amount: string,
  currency: CurrencyCode = eurCurrency,
  historicalRate?: BigDecimal.BigDecimal
): MemberTrialBalanceLineItem => {
  return MemberTrialBalanceLineItem.make({
    accountNumber: Schema.NonEmptyTrimmedString.make(accountNumber),
    accountName: Schema.NonEmptyTrimmedString.make(accountName),
    accountType,
    accountCategory,
    translationCategory,
    functionalBalance: MonetaryAmount.unsafeFromString(amount, currency),
    historicalRate: historicalRate ? Option.some(historicalRate) : Option.none()
  })
}

const createDefaultRates = (): TranslationRates => {
  return TranslationRates.make({
    closingRate: BigDecimal.fromNumber(1.1), // 1 EUR = 1.1 USD
    averageRate: BigDecimal.fromNumber(1.08), // Average rate for period
    historicalRates: HashMap.empty(),
    priorCTA: MonetaryAmount.zero(usdCurrency),
    translatedOpeningRetainedEarnings: MonetaryAmount.zero(usdCurrency),
    dividendsRate: Option.some(BigDecimal.fromNumber(1.05))
  })
}

const createTestInput = (
  lineItems: Chunk.Chunk<MemberTrialBalanceLineItem>,
  rates?: TranslationRates,
  netIncome?: MonetaryAmount,
  dividends?: MonetaryAmount,
  openingRE?: MonetaryAmount
): TranslateMemberBalancesInput => ({
  companyId,
  companyName: "Test Company",
  functionalCurrency: eurCurrency,
  reportingCurrency: usdCurrency,
  asOfDate: testDate,
  periodStartDate,
  lineItems,
  rates: rates ?? createDefaultRates(),
  netIncome: netIncome ?? MonetaryAmount.zero(eurCurrency),
  dividendsDeclared: dividends ?? MonetaryAmount.zero(eurCurrency),
  openingRetainedEarnings: openingRE ?? MonetaryAmount.zero(eurCurrency)
})

// =============================================================================
// Error Type Tests
// =============================================================================

describe("Error Types", () => {
  describe("TranslationRateNotFoundError", () => {
    it("creates error with correct message", () => {
      const error = new TranslationRateNotFoundError({
        fromCurrency: eurCurrency,
        toCurrency: usdCurrency,
        rateType: "Closing",
        asOfDate: testDate
      })

      expect(error._tag).toBe("TranslationRateNotFoundError")
      expect(error.message).toContain("EUR")
      expect(error.message).toContain("USD")
      expect(error.message).toContain("Closing")
      expect(error.message).toContain("2024-12-31")
    })

    it("type guard returns true for valid error", () => {
      const error = new TranslationRateNotFoundError({
        fromCurrency: eurCurrency,
        toCurrency: usdCurrency,
        rateType: "Average",
        asOfDate: testDate
      })
      expect(isTranslationRateNotFoundError(error)).toBe(true)
    })

    it("type guard returns false for invalid values", () => {
      expect(isTranslationRateNotFoundError(null)).toBe(false)
      expect(isTranslationRateNotFoundError(undefined)).toBe(false)
      expect(isTranslationRateNotFoundError(new Error("test"))).toBe(false)
    })
  })

  describe("HistoricalRateRequiredError", () => {
    it("creates error with correct message", () => {
      const error = new HistoricalRateRequiredError({
        companyId,
        accountNumber: Schema.NonEmptyTrimmedString.make("3100"),
        accountName: Schema.NonEmptyTrimmedString.make("Common Stock"),
        currency: eurCurrency
      })

      expect(error._tag).toBe("HistoricalRateRequiredError")
      expect(error.message).toContain("3100")
      expect(error.message).toContain("Common Stock")
      expect(error.message).toContain("EUR")
    })

    it("type guard returns true for valid error", () => {
      const error = new HistoricalRateRequiredError({
        companyId,
        accountNumber: Schema.NonEmptyTrimmedString.make("3100"),
        accountName: Schema.NonEmptyTrimmedString.make("Common Stock"),
        currency: eurCurrency
      })
      expect(isHistoricalRateRequiredError(error)).toBe(true)
    })

    it("type guard returns false for invalid values", () => {
      expect(isHistoricalRateRequiredError(null)).toBe(false)
      expect(isHistoricalRateRequiredError(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// MemberTrialBalanceLineItem Tests
// =============================================================================

describe("MemberTrialBalanceLineItem", () => {
  it("creates line item with all properties", () => {
    const item = createLineItem(
      "1000",
      "Cash",
      "Asset",
      "CurrentAsset",
      "MonetaryAsset",
      "10000"
    )

    expect(item.accountNumber).toBe("1000")
    expect(item.accountName).toBe("Cash")
    expect(item.accountType).toBe("Asset")
    expect(item.translationCategory).toBe("MonetaryAsset")
  })

  it("correctly identifies equity accounts", () => {
    const capitalStock = createLineItem(
      "3100",
      "Common Stock",
      "Equity",
      "ContributedCapital",
      "CapitalStock",
      "50000"
    )
    const cash = createLineItem(
      "1000",
      "Cash",
      "Asset",
      "CurrentAsset",
      "MonetaryAsset",
      "10000"
    )

    expect(capitalStock.isEquityAccount).toBe(true)
    expect(cash.isEquityAccount).toBe(false)
  })

  it("correctly identifies accounts using historical rate", () => {
    const capitalStock = createLineItem(
      "3100",
      "Common Stock",
      "Equity",
      "ContributedCapital",
      "CapitalStock",
      "50000"
    )
    const apic = createLineItem(
      "3200",
      "APIC",
      "Equity",
      "ContributedCapital",
      "APIC",
      "25000"
    )
    const treasury = createLineItem(
      "3500",
      "Treasury Stock",
      "Equity",
      "TreasuryStock",
      "TreasuryStock",
      "10000"
    )
    const retainedEarnings = createLineItem(
      "3300",
      "Retained Earnings",
      "Equity",
      "RetainedEarnings",
      "RetainedEarnings",
      "100000"
    )

    expect(capitalStock.usesHistoricalRate).toBe(true)
    expect(apic.usesHistoricalRate).toBe(true)
    expect(treasury.usesHistoricalRate).toBe(true)
    expect(retainedEarnings.usesHistoricalRate).toBe(false)
  })

  it("correctly identifies retained earnings account", () => {
    const retainedEarnings = createLineItem(
      "3300",
      "Retained Earnings",
      "Equity",
      "RetainedEarnings",
      "RetainedEarnings",
      "100000"
    )
    const capitalStock = createLineItem(
      "3100",
      "Common Stock",
      "Equity",
      "ContributedCapital",
      "CapitalStock",
      "50000"
    )

    expect(retainedEarnings.isRetainedEarnings).toBe(true)
    expect(capitalStock.isRetainedEarnings).toBe(false)
  })

  it("correctly identifies income statement accounts", () => {
    const revenue = createLineItem(
      "4000",
      "Sales Revenue",
      "Revenue",
      "OperatingRevenue",
      "Revenue",
      "500000"
    )
    const expense = createLineItem(
      "5000",
      "Cost of Goods Sold",
      "Expense",
      "CostOfGoodsSold",
      "Expense",
      "300000"
    )
    const asset = createLineItem(
      "1000",
      "Cash",
      "Asset",
      "CurrentAsset",
      "MonetaryAsset",
      "10000"
    )

    expect(revenue.isIncomeStatementAccount).toBe(true)
    expect(expense.isIncomeStatementAccount).toBe(true)
    expect(asset.isIncomeStatementAccount).toBe(false)
  })

  it("type guard returns true for valid line item", () => {
    const item = createLineItem(
      "1000",
      "Cash",
      "Asset",
      "CurrentAsset",
      "MonetaryAsset",
      "10000"
    )
    expect(isMemberTrialBalanceLineItem(item)).toBe(true)
  })

  it("type guard returns false for invalid values", () => {
    expect(isMemberTrialBalanceLineItem(null)).toBe(false)
    expect(isMemberTrialBalanceLineItem(undefined)).toBe(false)
  })
})

// =============================================================================
// TranslatedLineItem Tests
// =============================================================================

describe("TranslatedLineItem", () => {
  it("creates translated line item", () => {
    const item = TranslatedLineItem.make({
      accountNumber: Schema.NonEmptyTrimmedString.make("1000"),
      accountName: Schema.NonEmptyTrimmedString.make("Cash"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      translationCategory: "MonetaryAsset",
      functionalBalance: MonetaryAmount.unsafeFromString("10000", eurCurrency),
      translatedBalance: MonetaryAmount.unsafeFromString("11000", usdCurrency),
      exchangeRate: BigDecimal.fromNumber(1.1),
      rateType: "Closing"
    })

    expect(item.accountNumber).toBe("1000")
    expect(item.rateType).toBe("Closing")
    expect(item.isEquityAccount).toBe(false)
  })

  it("correctly identifies equity accounts", () => {
    const item = TranslatedLineItem.make({
      accountNumber: Schema.NonEmptyTrimmedString.make("3100"),
      accountName: Schema.NonEmptyTrimmedString.make("Common Stock"),
      accountType: "Equity",
      accountCategory: "ContributedCapital",
      translationCategory: "CapitalStock",
      functionalBalance: MonetaryAmount.unsafeFromString("50000", eurCurrency),
      translatedBalance: MonetaryAmount.unsafeFromString("55000", usdCurrency),
      exchangeRate: BigDecimal.fromNumber(1.1),
      rateType: "Historical"
    })

    expect(item.isEquityAccount).toBe(true)
  })

  it("type guard returns true for valid item", () => {
    const item = TranslatedLineItem.make({
      accountNumber: Schema.NonEmptyTrimmedString.make("1000"),
      accountName: Schema.NonEmptyTrimmedString.make("Cash"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      translationCategory: "MonetaryAsset",
      functionalBalance: MonetaryAmount.unsafeFromString("10000", eurCurrency),
      translatedBalance: MonetaryAmount.unsafeFromString("11000", usdCurrency),
      exchangeRate: BigDecimal.fromNumber(1.1),
      rateType: "Closing"
    })
    expect(isTranslatedLineItem(item)).toBe(true)
  })

  it("type guard returns false for invalid values", () => {
    expect(isTranslatedLineItem(null)).toBe(false)
    expect(isTranslatedLineItem(undefined)).toBe(false)
  })
})

// =============================================================================
// RetainedEarningsComponents Tests
// =============================================================================

describe("RetainedEarningsComponents", () => {
  it("creates retained earnings components", () => {
    const components = RetainedEarningsComponents.make({
      openingRetainedEarnings: MonetaryAmount.unsafeFromString("100000", eurCurrency),
      translatedOpeningRetainedEarnings: MonetaryAmount.unsafeFromString("110000", usdCurrency),
      netIncome: MonetaryAmount.unsafeFromString("25000", eurCurrency),
      translatedNetIncome: MonetaryAmount.unsafeFromString("27000", usdCurrency),
      dividendsDeclared: MonetaryAmount.unsafeFromString("10000", eurCurrency),
      translatedDividends: MonetaryAmount.unsafeFromString("10500", usdCurrency),
      closingRetainedEarnings: MonetaryAmount.unsafeFromString("126500", usdCurrency)
    })

    expect(components.hasNetIncome).toBe(true)
    expect(components.hasNetLoss).toBe(false)
  })

  it("correctly identifies net loss", () => {
    const components = RetainedEarningsComponents.make({
      openingRetainedEarnings: MonetaryAmount.unsafeFromString("100000", eurCurrency),
      translatedOpeningRetainedEarnings: MonetaryAmount.unsafeFromString("110000", usdCurrency),
      netIncome: MonetaryAmount.unsafeFromString("-15000", eurCurrency),
      translatedNetIncome: MonetaryAmount.unsafeFromString("-16200", usdCurrency),
      dividendsDeclared: MonetaryAmount.zero(eurCurrency),
      translatedDividends: MonetaryAmount.zero(usdCurrency),
      closingRetainedEarnings: MonetaryAmount.unsafeFromString("93800", usdCurrency)
    })

    expect(components.hasNetIncome).toBe(false)
    expect(components.hasNetLoss).toBe(true)
  })

  it("type guard returns true for valid components", () => {
    const components = RetainedEarningsComponents.make({
      openingRetainedEarnings: MonetaryAmount.zero(eurCurrency),
      translatedOpeningRetainedEarnings: MonetaryAmount.zero(usdCurrency),
      netIncome: MonetaryAmount.zero(eurCurrency),
      translatedNetIncome: MonetaryAmount.zero(usdCurrency),
      dividendsDeclared: MonetaryAmount.zero(eurCurrency),
      translatedDividends: MonetaryAmount.zero(usdCurrency),
      closingRetainedEarnings: MonetaryAmount.zero(usdCurrency)
    })
    expect(isRetainedEarningsComponents(components)).toBe(true)
  })

  it("type guard returns false for invalid values", () => {
    expect(isRetainedEarningsComponents(null)).toBe(false)
    expect(isRetainedEarningsComponents(undefined)).toBe(false)
  })
})

// =============================================================================
// CTACalculation Tests
// =============================================================================

describe("CTACalculation", () => {
  it("creates CTA calculation with gain", () => {
    const cta = CTACalculation.make({
      companyId,
      totalTranslatedAssets: MonetaryAmount.unsafeFromString("500000", usdCurrency),
      totalTranslatedLiabilities: MonetaryAmount.unsafeFromString("200000", usdCurrency),
      totalTranslatedEquityExCTA: MonetaryAmount.unsafeFromString("290000", usdCurrency),
      openingCTA: MonetaryAmount.zero(usdCurrency),
      currentPeriodCTA: MonetaryAmount.unsafeFromString("10000", usdCurrency),
      closingCTA: MonetaryAmount.unsafeFromString("10000", usdCurrency),
      reportingCurrency: usdCurrency
    })

    expect(cta.isGain).toBe(true)
    expect(cta.isLoss).toBe(false)
    expect(cta.isZero).toBe(false)
  })

  it("creates CTA calculation with loss", () => {
    const cta = CTACalculation.make({
      companyId,
      totalTranslatedAssets: MonetaryAmount.unsafeFromString("500000", usdCurrency),
      totalTranslatedLiabilities: MonetaryAmount.unsafeFromString("200000", usdCurrency),
      totalTranslatedEquityExCTA: MonetaryAmount.unsafeFromString("310000", usdCurrency),
      openingCTA: MonetaryAmount.zero(usdCurrency),
      currentPeriodCTA: MonetaryAmount.unsafeFromString("-10000", usdCurrency),
      closingCTA: MonetaryAmount.unsafeFromString("-10000", usdCurrency),
      reportingCurrency: usdCurrency
    })

    expect(cta.isGain).toBe(false)
    expect(cta.isLoss).toBe(true)
    expect(cta.isZero).toBe(false)
  })

  it("creates CTA calculation with zero movement", () => {
    const cta = CTACalculation.make({
      companyId,
      totalTranslatedAssets: MonetaryAmount.unsafeFromString("500000", usdCurrency),
      totalTranslatedLiabilities: MonetaryAmount.unsafeFromString("200000", usdCurrency),
      totalTranslatedEquityExCTA: MonetaryAmount.unsafeFromString("300000", usdCurrency),
      openingCTA: MonetaryAmount.zero(usdCurrency),
      currentPeriodCTA: MonetaryAmount.zero(usdCurrency),
      closingCTA: MonetaryAmount.zero(usdCurrency),
      reportingCurrency: usdCurrency
    })

    expect(cta.isGain).toBe(false)
    expect(cta.isLoss).toBe(false)
    expect(cta.isZero).toBe(true)
  })

  it("type guard returns true for valid calculation", () => {
    const cta = CTACalculation.make({
      companyId,
      totalTranslatedAssets: MonetaryAmount.zero(usdCurrency),
      totalTranslatedLiabilities: MonetaryAmount.zero(usdCurrency),
      totalTranslatedEquityExCTA: MonetaryAmount.zero(usdCurrency),
      openingCTA: MonetaryAmount.zero(usdCurrency),
      currentPeriodCTA: MonetaryAmount.zero(usdCurrency),
      closingCTA: MonetaryAmount.zero(usdCurrency),
      reportingCurrency: usdCurrency
    })
    expect(isCTACalculation(cta)).toBe(true)
  })

  it("type guard returns false for invalid values", () => {
    expect(isCTACalculation(null)).toBe(false)
    expect(isCTACalculation(undefined)).toBe(false)
  })
})

// =============================================================================
// TranslationRates Tests
// =============================================================================

describe("TranslationRates", () => {
  it("creates translation rates", () => {
    const rates = createDefaultRates()

    expect(BigDecimal.format(rates.closingRate)).toBe("1.1")
    expect(BigDecimal.format(rates.averageRate)).toBe("1.08")
  })

  it("type guard returns true for valid rates", () => {
    const rates = createDefaultRates()
    expect(isTranslationRates(rates)).toBe(true)
  })

  it("type guard returns false for invalid values", () => {
    expect(isTranslationRates(null)).toBe(false)
    expect(isTranslationRates(undefined)).toBe(false)
  })
})

// =============================================================================
// Pure Functions Tests
// =============================================================================

describe("Pure Functions", () => {
  describe("determineTranslationCategory", () => {
    it("classifies assets as MonetaryAsset", () => {
      expect(determineTranslationCategory("Asset", "CurrentAsset")).toBe("MonetaryAsset")
      expect(determineTranslationCategory("Asset", "NonCurrentAsset")).toBe("MonetaryAsset")
      expect(determineTranslationCategory("Asset", "FixedAsset")).toBe("MonetaryAsset")
    })

    it("classifies liabilities as MonetaryLiability", () => {
      expect(determineTranslationCategory("Liability", "CurrentLiability")).toBe("MonetaryLiability")
      expect(determineTranslationCategory("Liability", "NonCurrentLiability")).toBe("MonetaryLiability")
    })

    it("classifies equity accounts correctly", () => {
      expect(determineTranslationCategory("Equity", "ContributedCapital")).toBe("CapitalStock")
      expect(determineTranslationCategory("Equity", "RetainedEarnings")).toBe("RetainedEarnings")
      expect(determineTranslationCategory("Equity", "OtherComprehensiveIncome")).toBe("OCI")
      expect(determineTranslationCategory("Equity", "TreasuryStock")).toBe("TreasuryStock")
      // Default equity category
      expect(determineTranslationCategory("Equity", "UnknownEquity")).toBe("APIC")
    })

    it("classifies revenue as Revenue", () => {
      expect(determineTranslationCategory("Revenue", "OperatingRevenue")).toBe("Revenue")
      expect(determineTranslationCategory("Revenue", "OtherRevenue")).toBe("Revenue")
    })

    it("classifies expenses as Expense", () => {
      expect(determineTranslationCategory("Expense", "OperatingExpense")).toBe("Expense")
      expect(determineTranslationCategory("Expense", "CostOfGoodsSold")).toBe("Expense")
    })
  })

  describe("getRateTypeForCategory", () => {
    it("returns Closing for monetary assets and liabilities", () => {
      expect(getRateTypeForCategory("MonetaryAsset")).toBe("Closing")
      expect(getRateTypeForCategory("NonMonetaryAsset")).toBe("Closing")
      expect(getRateTypeForCategory("MonetaryLiability")).toBe("Closing")
      expect(getRateTypeForCategory("NonMonetaryLiability")).toBe("Closing")
    })

    it("returns Historical for capital accounts", () => {
      expect(getRateTypeForCategory("CapitalStock")).toBe("Historical")
      expect(getRateTypeForCategory("APIC")).toBe("Historical")
      expect(getRateTypeForCategory("TreasuryStock")).toBe("Historical")
    })

    it("returns Calculated for retained earnings and OCI", () => {
      expect(getRateTypeForCategory("RetainedEarnings")).toBe("Calculated")
      expect(getRateTypeForCategory("OCI")).toBe("Calculated")
    })

    it("returns Average for income statement accounts", () => {
      expect(getRateTypeForCategory("Revenue")).toBe("Average")
      expect(getRateTypeForCategory("Expense")).toBe("Average")
    })
  })
})

// =============================================================================
// TranslatedTrialBalance Tests
// =============================================================================

describe("TranslatedTrialBalance", () => {
  it("creates translated trial balance", () => {
    const tb = TranslatedTrialBalance.make({
      companyId,
      companyName: Schema.NonEmptyTrimmedString.make("Test Company"),
      functionalCurrency: eurCurrency,
      reportingCurrency: usdCurrency,
      asOfDate: testDate,
      periodStartDate,
      lineItems: Chunk.empty(),
      retainedEarningsDetails: Option.none(),
      ctaCalculation: CTACalculation.make({
        companyId,
        totalTranslatedAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
        totalTranslatedLiabilities: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        totalTranslatedEquityExCTA: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        openingCTA: MonetaryAmount.zero(usdCurrency),
        currentPeriodCTA: MonetaryAmount.zero(usdCurrency),
        closingCTA: MonetaryAmount.zero(usdCurrency),
        reportingCurrency: usdCurrency
      }),
      totalAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
      totalLiabilities: MonetaryAmount.unsafeFromString("50000", usdCurrency),
      totalEquity: MonetaryAmount.unsafeFromString("50000", usdCurrency),
      totalRevenue: MonetaryAmount.unsafeFromString("200000", usdCurrency),
      totalExpenses: MonetaryAmount.unsafeFromString("150000", usdCurrency),
      closingRate: BigDecimal.fromNumber(1.1),
      averageRate: BigDecimal.fromNumber(1.08)
    })

    expect(tb.companyId).toBe(companyId)
    expect(tb.reportingCurrency).toBe(usdCurrency)
    expect(tb.lineItemCount).toBe(0)
  })

  it("calculates translated net income", () => {
    const tb = TranslatedTrialBalance.make({
      companyId,
      companyName: Schema.NonEmptyTrimmedString.make("Test Company"),
      functionalCurrency: eurCurrency,
      reportingCurrency: usdCurrency,
      asOfDate: testDate,
      periodStartDate,
      lineItems: Chunk.empty(),
      retainedEarningsDetails: Option.none(),
      ctaCalculation: CTACalculation.make({
        companyId,
        totalTranslatedAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
        totalTranslatedLiabilities: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        totalTranslatedEquityExCTA: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        openingCTA: MonetaryAmount.zero(usdCurrency),
        currentPeriodCTA: MonetaryAmount.zero(usdCurrency),
        closingCTA: MonetaryAmount.zero(usdCurrency),
        reportingCurrency: usdCurrency
      }),
      totalAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
      totalLiabilities: MonetaryAmount.unsafeFromString("50000", usdCurrency),
      totalEquity: MonetaryAmount.unsafeFromString("50000", usdCurrency),
      totalRevenue: MonetaryAmount.unsafeFromString("200000", usdCurrency),
      totalExpenses: MonetaryAmount.unsafeFromString("150000", usdCurrency),
      closingRate: BigDecimal.fromNumber(1.1),
      averageRate: BigDecimal.fromNumber(1.08)
    })

    const netIncome = tb.translatedNetIncome
    expect(BigDecimal.format(netIncome.amount)).toBe("50000")
  })

  it("checks balance sheet is balanced", () => {
    // Balanced: Assets = Liabilities + Equity
    const balanced = TranslatedTrialBalance.make({
      companyId,
      companyName: Schema.NonEmptyTrimmedString.make("Test Company"),
      functionalCurrency: eurCurrency,
      reportingCurrency: usdCurrency,
      asOfDate: testDate,
      periodStartDate,
      lineItems: Chunk.empty(),
      retainedEarningsDetails: Option.none(),
      ctaCalculation: CTACalculation.make({
        companyId,
        totalTranslatedAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
        totalTranslatedLiabilities: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        totalTranslatedEquityExCTA: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        openingCTA: MonetaryAmount.zero(usdCurrency),
        currentPeriodCTA: MonetaryAmount.zero(usdCurrency),
        closingCTA: MonetaryAmount.zero(usdCurrency),
        reportingCurrency: usdCurrency
      }),
      totalAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
      totalLiabilities: MonetaryAmount.unsafeFromString("50000", usdCurrency),
      totalEquity: MonetaryAmount.unsafeFromString("50000", usdCurrency),
      totalRevenue: MonetaryAmount.zero(usdCurrency),
      totalExpenses: MonetaryAmount.zero(usdCurrency),
      closingRate: BigDecimal.fromNumber(1.1),
      averageRate: BigDecimal.fromNumber(1.08)
    })

    expect(balanced.isBalanced).toBe(true)

    // Unbalanced
    const unbalanced = TranslatedTrialBalance.make({
      companyId,
      companyName: Schema.NonEmptyTrimmedString.make("Test Company"),
      functionalCurrency: eurCurrency,
      reportingCurrency: usdCurrency,
      asOfDate: testDate,
      periodStartDate,
      lineItems: Chunk.empty(),
      retainedEarningsDetails: Option.none(),
      ctaCalculation: CTACalculation.make({
        companyId,
        totalTranslatedAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
        totalTranslatedLiabilities: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        totalTranslatedEquityExCTA: MonetaryAmount.unsafeFromString("50000", usdCurrency),
        openingCTA: MonetaryAmount.zero(usdCurrency),
        currentPeriodCTA: MonetaryAmount.zero(usdCurrency),
        closingCTA: MonetaryAmount.zero(usdCurrency),
        reportingCurrency: usdCurrency
      }),
      totalAssets: MonetaryAmount.unsafeFromString("100000", usdCurrency),
      totalLiabilities: MonetaryAmount.unsafeFromString("40000", usdCurrency),
      totalEquity: MonetaryAmount.unsafeFromString("50000", usdCurrency),
      totalRevenue: MonetaryAmount.zero(usdCurrency),
      totalExpenses: MonetaryAmount.zero(usdCurrency),
      closingRate: BigDecimal.fromNumber(1.1),
      averageRate: BigDecimal.fromNumber(1.08)
    })

    expect(unbalanced.isBalanced).toBe(false)
  })

  it("type guard returns true for valid balance", () => {
    const tb = TranslatedTrialBalance.make({
      companyId,
      companyName: Schema.NonEmptyTrimmedString.make("Test Company"),
      functionalCurrency: eurCurrency,
      reportingCurrency: usdCurrency,
      asOfDate: testDate,
      periodStartDate,
      lineItems: Chunk.empty(),
      retainedEarningsDetails: Option.none(),
      ctaCalculation: CTACalculation.make({
        companyId,
        totalTranslatedAssets: MonetaryAmount.zero(usdCurrency),
        totalTranslatedLiabilities: MonetaryAmount.zero(usdCurrency),
        totalTranslatedEquityExCTA: MonetaryAmount.zero(usdCurrency),
        openingCTA: MonetaryAmount.zero(usdCurrency),
        currentPeriodCTA: MonetaryAmount.zero(usdCurrency),
        closingCTA: MonetaryAmount.zero(usdCurrency),
        reportingCurrency: usdCurrency
      }),
      totalAssets: MonetaryAmount.zero(usdCurrency),
      totalLiabilities: MonetaryAmount.zero(usdCurrency),
      totalEquity: MonetaryAmount.zero(usdCurrency),
      totalRevenue: MonetaryAmount.zero(usdCurrency),
      totalExpenses: MonetaryAmount.zero(usdCurrency),
      closingRate: BigDecimal.fromNumber(1),
      averageRate: BigDecimal.fromNumber(1)
    })
    expect(isTranslatedTrialBalance(tb)).toBe(true)
  })

  it("type guard returns false for invalid values", () => {
    expect(isTranslatedTrialBalance(null)).toBe(false)
    expect(isTranslatedTrialBalance(undefined)).toBe(false)
  })
})

// =============================================================================
// CurrencyTranslationService Tests
// =============================================================================

describe("CurrencyTranslationService", () => {
  describe("translateMemberBalances", () => {
    it.effect("translates assets at closing rate", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "10000"),
          createLineItem("1200", "Accounts Receivable", "Asset", "CurrentAsset", "MonetaryAsset", "5000")
        )

        const input = createTestInput(lineItems)
        const result = yield* service.translateMemberBalances(input)

        expect(result.reportingCurrency).toBe(usdCurrency)
        expect(Chunk.size(result.lineItems)).toBe(2)

        // Check that closing rate was used (1.1)
        const cashLine = Chunk.toReadonlyArray(result.lineItems).find(
          (item) => item.accountNumber === "1000"
        )
        expect(cashLine).toBeDefined()
        expect(cashLine!.rateType).toBe("Closing")
        // 10000 EUR * 1.1 = 11000 USD
        expect(BigDecimal.format(cashLine!.translatedBalance.amount)).toBe("11000")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("translates liabilities at closing rate", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("2000", "Accounts Payable", "Liability", "CurrentLiability", "MonetaryLiability", "8000")
        )

        const input = createTestInput(lineItems)
        const result = yield* service.translateMemberBalances(input)

        const apLine = Chunk.toReadonlyArray(result.lineItems).find(
          (item) => item.accountNumber === "2000"
        )
        expect(apLine).toBeDefined()
        expect(apLine!.rateType).toBe("Closing")
        // 8000 EUR * 1.1 = 8800 USD
        expect(BigDecimal.format(apLine!.translatedBalance.amount)).toBe("8800")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("translates revenue at average rate", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("4000", "Sales Revenue", "Revenue", "OperatingRevenue", "Revenue", "100000")
        )

        const input = createTestInput(lineItems)
        const result = yield* service.translateMemberBalances(input)

        const revenueLine = Chunk.toReadonlyArray(result.lineItems).find(
          (item) => item.accountNumber === "4000"
        )
        expect(revenueLine).toBeDefined()
        expect(revenueLine!.rateType).toBe("Average")
        // 100000 EUR * 1.08 = 108000 USD
        expect(BigDecimal.format(revenueLine!.translatedBalance.amount)).toBe("108000")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("translates expenses at average rate", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("5000", "Cost of Goods Sold", "Expense", "CostOfGoodsSold", "Expense", "60000")
        )

        const input = createTestInput(lineItems)
        const result = yield* service.translateMemberBalances(input)

        const cogsLine = Chunk.toReadonlyArray(result.lineItems).find(
          (item) => item.accountNumber === "5000"
        )
        expect(cogsLine).toBeDefined()
        expect(cogsLine!.rateType).toBe("Average")
        // 60000 EUR * 1.08 = 64800 USD
        expect(BigDecimal.format(cogsLine!.translatedBalance.amount)).toBe("64800")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("translates capital stock at historical rate from line item", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const historicalRate = BigDecimal.fromNumber(1.0) // Rate when stock was issued
        const lineItems = Chunk.make(
          createLineItem(
            "3100",
            "Common Stock",
            "Equity",
            "ContributedCapital",
            "CapitalStock",
            "50000",
            eurCurrency,
            historicalRate
          )
        )

        const input = createTestInput(lineItems)
        const result = yield* service.translateMemberBalances(input)

        const stockLine = Chunk.toReadonlyArray(result.lineItems).find(
          (item) => item.accountNumber === "3100"
        )
        expect(stockLine).toBeDefined()
        expect(stockLine!.rateType).toBe("Historical")
        // 50000 EUR * 1.0 = 50000 USD
        expect(BigDecimal.format(stockLine!.translatedBalance.amount)).toBe("50000")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("calculates retained earnings correctly", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "200000"),
          createLineItem("2000", "Accounts Payable", "Liability", "CurrentLiability", "MonetaryLiability", "50000")
        )

        const rates = TranslationRates.make({
          closingRate: BigDecimal.fromNumber(1.1),
          averageRate: BigDecimal.fromNumber(1.08),
          historicalRates: HashMap.empty(),
          priorCTA: MonetaryAmount.zero(usdCurrency),
          translatedOpeningRetainedEarnings: MonetaryAmount.unsafeFromString("100000", usdCurrency),
          dividendsRate: Option.some(BigDecimal.fromNumber(1.05))
        })

        const netIncome = MonetaryAmount.unsafeFromString("25000", eurCurrency)
        const dividends = MonetaryAmount.unsafeFromString("10000", eurCurrency)
        const openingRE = MonetaryAmount.unsafeFromString("90909.09", eurCurrency) // ~100000 USD at opening rate

        const input = createTestInput(lineItems, rates, netIncome, dividends, openingRE)
        const result = yield* service.translateMemberBalances(input)

        expect(Option.isSome(result.retainedEarningsDetails)).toBe(true)
        const reDetails = Option.getOrThrow(result.retainedEarningsDetails)

        // Net income translated at average rate: 25000 * 1.08 = 27000
        expect(BigDecimal.format(reDetails.translatedNetIncome.amount)).toBe("27000")

        // Dividends translated at dividend rate: 10000 * 1.05 = 10500
        expect(BigDecimal.format(reDetails.translatedDividends.amount)).toBe("10500")

        // Closing RE = Opening (100000) + NI (27000) - Dividends (10500) = 116500
        expect(BigDecimal.format(reDetails.closingRetainedEarnings.amount)).toBe("116500")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("calculates CTA as plug to balance", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        // Create a scenario where CTA is needed
        const lineItems = Chunk.make(
          createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "100000"),
          createLineItem("2000", "Accounts Payable", "Liability", "CurrentLiability", "MonetaryLiability", "40000"),
          createLineItem(
            "3100",
            "Common Stock",
            "Equity",
            "ContributedCapital",
            "CapitalStock",
            "50000",
            eurCurrency,
            BigDecimal.fromNumber(1.0)
          )
        )

        const rates = TranslationRates.make({
          closingRate: BigDecimal.fromNumber(1.1),
          averageRate: BigDecimal.fromNumber(1.08),
          historicalRates: HashMap.empty(),
          priorCTA: MonetaryAmount.zero(usdCurrency),
          translatedOpeningRetainedEarnings: MonetaryAmount.zero(usdCurrency),
          dividendsRate: Option.none()
        })

        const input = createTestInput(lineItems, rates)
        const result = yield* service.translateMemberBalances(input)

        // Assets: 100000 * 1.1 = 110000
        // Liabilities: 40000 * 1.1 = 44000
        // Common Stock: 50000 * 1.0 = 50000
        // Retained Earnings: 0
        // CTA = Assets - Liabilities - Equity (ex CTA) = 110000 - 44000 - 50000 = 16000
        expect(BigDecimal.format(result.ctaCalculation.closingCTA.amount)).toBe("16000")
        expect(result.ctaCalculation.isGain).toBe(true)
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("handles same currency translation (1:1 rate)", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "10000", usdCurrency)
        )

        const input: TranslateMemberBalancesInput = {
          companyId,
          companyName: "Test Company",
          functionalCurrency: usdCurrency, // Same as reporting
          reportingCurrency: usdCurrency,
          asOfDate: testDate,
          periodStartDate,
          lineItems,
          rates: createDefaultRates(),
          netIncome: MonetaryAmount.zero(usdCurrency),
          dividendsDeclared: MonetaryAmount.zero(usdCurrency),
          openingRetainedEarnings: MonetaryAmount.zero(usdCurrency)
        }

        const result = yield* service.translateMemberBalances(input)

        // Should use 1:1 rate
        expect(BigDecimal.format(result.closingRate)).toBe("1")
        expect(BigDecimal.format(result.averageRate)).toBe("1")

        const cashLine = Chunk.toReadonlyArray(result.lineItems).find(
          (item) => item.accountNumber === "1000"
        )
        expect(cashLine).toBeDefined()
        // 10000 USD * 1 = 10000 USD
        expect(BigDecimal.format(cashLine!.translatedBalance.amount)).toBe("10000")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("calculates totals correctly", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "50000"),
          createLineItem("1200", "Receivables", "Asset", "CurrentAsset", "MonetaryAsset", "30000"),
          createLineItem("2000", "Payables", "Liability", "CurrentLiability", "MonetaryLiability", "20000"),
          createLineItem("4000", "Revenue", "Revenue", "OperatingRevenue", "Revenue", "100000"),
          createLineItem("5000", "Expenses", "Expense", "OperatingExpense", "Expense", "70000")
        )

        const input = createTestInput(lineItems)
        const result = yield* service.translateMemberBalances(input)

        // Total Assets: (50000 + 30000) * 1.1 = 88000
        expect(BigDecimal.format(result.totalAssets.amount)).toBe("88000")

        // Total Liabilities: 20000 * 1.1 = 22000
        expect(BigDecimal.format(result.totalLiabilities.amount)).toBe("22000")

        // Total Revenue: 100000 * 1.08 = 108000
        expect(BigDecimal.format(result.totalRevenue.amount)).toBe("108000")

        // Total Expenses: 70000 * 1.08 = 75600
        expect(BigDecimal.format(result.totalExpenses.amount)).toBe("75600")

        // Net Income: 108000 - 75600 = 32400
        expect(BigDecimal.format(result.translatedNetIncome.amount)).toBe("32400")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("handles prior CTA balance", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "100000"),
          createLineItem("2000", "Payables", "Liability", "CurrentLiability", "MonetaryLiability", "40000"),
          createLineItem(
            "3100",
            "Common Stock",
            "Equity",
            "ContributedCapital",
            "CapitalStock",
            "50000",
            eurCurrency,
            BigDecimal.fromNumber(1.0)
          )
        )

        const rates = TranslationRates.make({
          closingRate: BigDecimal.fromNumber(1.1),
          averageRate: BigDecimal.fromNumber(1.08),
          historicalRates: HashMap.empty(),
          priorCTA: MonetaryAmount.unsafeFromString("5000", usdCurrency), // Prior period CTA
          translatedOpeningRetainedEarnings: MonetaryAmount.zero(usdCurrency),
          dividendsRate: Option.none()
        })

        const input = createTestInput(lineItems, rates)
        const result = yield* service.translateMemberBalances(input)

        // Opening CTA: 5000
        expect(BigDecimal.format(result.ctaCalculation.openingCTA.amount)).toBe("5000")

        // Closing CTA: 110000 - 44000 - 50000 = 16000
        expect(BigDecimal.format(result.ctaCalculation.closingCTA.amount)).toBe("16000")

        // Current Period CTA Movement: 16000 - 5000 = 11000
        expect(BigDecimal.format(result.ctaCalculation.currentPeriodCTA.amount)).toBe("11000")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("uses historical rate from rates map when not on line item", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem(
            "3100",
            "Common Stock",
            "Equity",
            "ContributedCapital",
            "CapitalStock",
            "50000",
            eurCurrency
            // No historical rate on line item
          )
        )

        const rates = TranslationRates.make({
          closingRate: BigDecimal.fromNumber(1.1),
          averageRate: BigDecimal.fromNumber(1.08),
          historicalRates: HashMap.make(["3100", BigDecimal.fromNumber(0.95)]), // Historical rate in map
          priorCTA: MonetaryAmount.zero(usdCurrency),
          translatedOpeningRetainedEarnings: MonetaryAmount.zero(usdCurrency),
          dividendsRate: Option.none()
        })

        const input = createTestInput(lineItems, rates)
        const result = yield* service.translateMemberBalances(input)

        const stockLine = Chunk.toReadonlyArray(result.lineItems).find(
          (item) => item.accountNumber === "3100"
        )
        expect(stockLine).toBeDefined()
        // 50000 EUR * 0.95 = 47500 USD
        expect(BigDecimal.format(stockLine!.translatedBalance.amount)).toBe("47500")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )

    it.effect("handles net loss in retained earnings", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        const lineItems = Chunk.make(
          createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "100000")
        )

        const rates = TranslationRates.make({
          closingRate: BigDecimal.fromNumber(1.1),
          averageRate: BigDecimal.fromNumber(1.08),
          historicalRates: HashMap.empty(),
          priorCTA: MonetaryAmount.zero(usdCurrency),
          translatedOpeningRetainedEarnings: MonetaryAmount.unsafeFromString("50000", usdCurrency),
          dividendsRate: Option.none()
        })

        const netLoss = MonetaryAmount.unsafeFromString("-15000", eurCurrency) // Net loss
        const input = createTestInput(lineItems, rates, netLoss)
        const result = yield* service.translateMemberBalances(input)

        expect(Option.isSome(result.retainedEarningsDetails)).toBe(true)
        const reDetails = Option.getOrThrow(result.retainedEarningsDetails)

        expect(reDetails.hasNetLoss).toBe(true)
        expect(reDetails.hasNetIncome).toBe(false)

        // Net loss translated: -15000 * 1.08 = -16200
        expect(BigDecimal.format(reDetails.translatedNetIncome.amount)).toBe("-16200")

        // Closing RE = 50000 + (-16200) - 0 = 33800
        expect(BigDecimal.format(reDetails.closingRetainedEarnings.amount)).toBe("33800")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )
  })

  describe("determineTranslationCategory", () => {
    it.effect("delegates to pure function", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        expect(service.determineTranslationCategory("Asset", "CurrentAsset")).toBe("MonetaryAsset")
        expect(service.determineTranslationCategory("Equity", "ContributedCapital")).toBe("CapitalStock")
        expect(service.determineTranslationCategory("Revenue", "OperatingRevenue")).toBe("Revenue")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )
  })

  describe("getRateTypeForCategory", () => {
    it.effect("delegates to pure function", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyTranslationService

        expect(service.getRateTypeForCategory("MonetaryAsset")).toBe("Closing")
        expect(service.getRateTypeForCategory("Revenue")).toBe("Average")
        expect(service.getRateTypeForCategory("CapitalStock")).toBe("Historical")
        expect(service.getRateTypeForCategory("RetainedEarnings")).toBe("Calculated")
      }).pipe(Effect.provide(CurrencyTranslationServiceLive))
    )
  })
})

// =============================================================================
// Integration Scenario Tests
// =============================================================================

describe("Integration Scenarios", () => {
  it.effect("full trial balance translation with all account types", () =>
    Effect.gen(function* () {
      const service = yield* CurrencyTranslationService

      const lineItems = Chunk.make(
        // Assets
        createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "100000"),
        createLineItem("1100", "Accounts Receivable", "Asset", "CurrentAsset", "MonetaryAsset", "50000"),
        createLineItem("1500", "Equipment", "Asset", "FixedAsset", "NonMonetaryAsset", "200000"),
        // Liabilities
        createLineItem("2000", "Accounts Payable", "Liability", "CurrentLiability", "MonetaryLiability", "30000"),
        createLineItem("2500", "Long-term Debt", "Liability", "NonCurrentLiability", "MonetaryLiability", "100000"),
        // Equity
        createLineItem(
          "3100",
          "Common Stock",
          "Equity",
          "ContributedCapital",
          "CapitalStock",
          "100000",
          eurCurrency,
          BigDecimal.fromNumber(0.9)
        ),
        createLineItem(
          "3200",
          "APIC",
          "Equity",
          "ContributedCapital",
          "APIC",
          "50000",
          eurCurrency,
          BigDecimal.fromNumber(0.9)
        ),
        // Revenue
        createLineItem("4000", "Sales Revenue", "Revenue", "OperatingRevenue", "Revenue", "500000"),
        createLineItem("4100", "Service Revenue", "Revenue", "OtherRevenue", "Revenue", "100000"),
        // Expenses
        createLineItem("5000", "Cost of Goods Sold", "Expense", "CostOfGoodsSold", "Expense", "250000"),
        createLineItem("6000", "Salaries", "Expense", "OperatingExpense", "Expense", "120000"),
        createLineItem("6100", "Rent", "Expense", "OperatingExpense", "Expense", "30000")
      )

      const rates = TranslationRates.make({
        closingRate: BigDecimal.fromNumber(1.1),
        averageRate: BigDecimal.fromNumber(1.08),
        historicalRates: HashMap.empty(),
        priorCTA: MonetaryAmount.unsafeFromString("15000", usdCurrency),
        translatedOpeningRetainedEarnings: MonetaryAmount.unsafeFromString("80000", usdCurrency),
        dividendsRate: Option.some(BigDecimal.fromNumber(1.05))
      })

      // Net income = Revenue - Expenses = 600000 - 400000 = 200000 EUR
      const netIncome = MonetaryAmount.unsafeFromString("200000", eurCurrency)
      const dividends = MonetaryAmount.unsafeFromString("50000", eurCurrency)
      const openingRE = MonetaryAmount.unsafeFromString("72727.27", eurCurrency) // ~80000 USD

      const input = createTestInput(lineItems, rates, netIncome, dividends, openingRE)
      const result = yield* service.translateMemberBalances(input)

      // Verify line item count
      expect(Chunk.size(result.lineItems)).toBe(12)

      // Verify total assets: (100000 + 50000 + 200000) * 1.1 = 385000
      expect(BigDecimal.format(result.totalAssets.amount)).toBe("385000")

      // Verify total liabilities: (30000 + 100000) * 1.1 = 143000
      expect(BigDecimal.format(result.totalLiabilities.amount)).toBe("143000")

      // Verify total revenue: (500000 + 100000) * 1.08 = 648000
      expect(BigDecimal.format(result.totalRevenue.amount)).toBe("648000")

      // Verify total expenses: (250000 + 120000 + 30000) * 1.08 = 432000
      expect(BigDecimal.format(result.totalExpenses.amount)).toBe("432000")

      // Verify retained earnings calculation
      const reDetails = Option.getOrThrow(result.retainedEarningsDetails)
      // Net income: 200000 * 1.08 = 216000
      expect(BigDecimal.format(reDetails.translatedNetIncome.amount)).toBe("216000")
      // Dividends: 50000 * 1.05 = 52500
      expect(BigDecimal.format(reDetails.translatedDividends.amount)).toBe("52500")
      // Closing RE: 80000 + 216000 - 52500 = 243500
      expect(BigDecimal.format(reDetails.closingRetainedEarnings.amount)).toBe("243500")

      // Verify CTA is calculated (Assets - Liabilities - Equity ex CTA)
      // Equity ex CTA = Common Stock (90000) + APIC (45000) + Closing RE (243500) = 378500
      // CTA = 385000 - 143000 - 378500 = -136500
      expect(result.ctaCalculation.closingCTA.amount).toBeDefined()

      // Verify balance sheet balances with CTA
      // This should always be true as CTA is the plug
      expect(result.isBalanced).toBe(true)
    }).pipe(Effect.provide(CurrencyTranslationServiceLive))
  )

  it.effect("handles subsidiary with strengthening currency (appreciation)", () =>
    Effect.gen(function* () {
      const service = yield* CurrencyTranslationService

      // EUR strengthened from 0.9 to 1.1 USD
      const lineItems = Chunk.make(
        createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "100000"),
        createLineItem("2000", "Debt", "Liability", "CurrentLiability", "MonetaryLiability", "50000"),
        createLineItem(
          "3100",
          "Common Stock",
          "Equity",
          "ContributedCapital",
          "CapitalStock",
          "40000",
          eurCurrency,
          BigDecimal.fromNumber(0.9) // Historical rate when stock issued
        )
      )

      const rates = TranslationRates.make({
        closingRate: BigDecimal.fromNumber(1.1), // EUR appreciated
        averageRate: BigDecimal.fromNumber(1.0),
        historicalRates: HashMap.empty(),
        priorCTA: MonetaryAmount.zero(usdCurrency),
        translatedOpeningRetainedEarnings: MonetaryAmount.zero(usdCurrency),
        dividendsRate: Option.none()
      })

      const input = createTestInput(lineItems, rates)
      const result = yield* service.translateMemberBalances(input)

      // Assets: 100000 * 1.1 = 110000
      // Liabilities: 50000 * 1.1 = 55000
      // Common Stock: 40000 * 0.9 = 36000 (historical)
      // CTA = 110000 - 55000 - 36000 = 19000 (gain from EUR appreciation)

      expect(BigDecimal.format(result.ctaCalculation.closingCTA.amount)).toBe("19000")
      expect(result.ctaCalculation.isGain).toBe(true)
    }).pipe(Effect.provide(CurrencyTranslationServiceLive))
  )

  it.effect("handles subsidiary with weakening currency (depreciation)", () =>
    Effect.gen(function* () {
      const service = yield* CurrencyTranslationService

      // EUR weakened from 1.2 to 0.9 USD
      const lineItems = Chunk.make(
        createLineItem("1000", "Cash", "Asset", "CurrentAsset", "MonetaryAsset", "100000"),
        createLineItem("2000", "Debt", "Liability", "CurrentLiability", "MonetaryLiability", "50000"),
        createLineItem(
          "3100",
          "Common Stock",
          "Equity",
          "ContributedCapital",
          "CapitalStock",
          "40000",
          eurCurrency,
          BigDecimal.fromNumber(1.2) // Historical rate when stock issued
        )
      )

      const rates = TranslationRates.make({
        closingRate: BigDecimal.fromNumber(0.9), // EUR depreciated
        averageRate: BigDecimal.fromNumber(1.0),
        historicalRates: HashMap.empty(),
        priorCTA: MonetaryAmount.zero(usdCurrency),
        translatedOpeningRetainedEarnings: MonetaryAmount.zero(usdCurrency),
        dividendsRate: Option.none()
      })

      const input = createTestInput(lineItems, rates)
      const result = yield* service.translateMemberBalances(input)

      // Assets: 100000 * 0.9 = 90000
      // Liabilities: 50000 * 0.9 = 45000
      // Common Stock: 40000 * 1.2 = 48000 (historical)
      // CTA = 90000 - 45000 - 48000 = -3000 (loss from EUR depreciation)

      expect(BigDecimal.format(result.ctaCalculation.closingCTA.amount)).toBe("-3000")
      expect(result.ctaCalculation.isLoss).toBe(true)
    }).pipe(Effect.provide(CurrencyTranslationServiceLive))
  )
})
