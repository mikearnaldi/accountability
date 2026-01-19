import { describe, it, expect } from "@effect/vitest"
import { Chunk, Effect, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  NCIService,
  NCIServiceLive,
  NCIPercentage,
  NCIEquityAtAcquisition,
  NCIEquityChange,
  NCISubsequentChanges,
  NCINetIncome,
  NCILineItem,
  NCIResult,
  ConsolidatedNCISummary,
  SubsidiaryNotFoundError,
  InvalidOwnershipPercentageError,
  NCICalculationError,
  calculateNCIPercentage,
  calculateNCIShare,
  calculateNCIEquityAtAcquisition,
  calculateNCINetIncome,
  createNCILineItems,
  isNCIPercentage,
  isNCIEquityAtAcquisition,
  isNCIEquityChange,
  isNCISubsequentChanges,
  isNCINetIncome,
  isNCILineItem,
  isNCIResult,
  isConsolidatedNCISummary,
  isSubsidiaryNotFoundError,
  isInvalidOwnershipPercentageError,
  isNCICalculationError,
  type SubsidiaryData
} from "../../src/consolidation/NCIService.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { Percentage } from "../../src/shared/values/Percentage.ts"

// =============================================================================
// Test Helpers
// =============================================================================

const subsidiaryUUID1 = "550e8400-e29b-41d4-a716-446655440000"
const subsidiaryUUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const testCurrency = CurrencyCode.make("USD")

const createSubsidiaryData = (
  options: Partial<{
    subsidiaryId: string
    subsidiaryName: string
    parentOwnershipPercentage: number
    fairValueNetAssetsAtAcquisition: string
    nciPremiumDiscountAtAcquisition: string
    subsidiaryNetIncome: string
    subsidiaryOCI: string
    dividendsDeclared: string
    cumulativeNCINetIncome: string
    cumulativeDividendsToNCI: string
    cumulativeNCIOCI: string
    periodYear: number
    periodNumber: number
    currency: string
  }> = {}
): SubsidiaryData => {
  const data: SubsidiaryData = {
    subsidiaryId: CompanyId.make(options.subsidiaryId ?? subsidiaryUUID1),
    subsidiaryName: options.subsidiaryName ?? "Test Subsidiary Inc",
    parentOwnershipPercentage: Percentage.make(options.parentOwnershipPercentage ?? 80),
    fairValueNetAssetsAtAcquisition: MonetaryAmount.unsafeFromString(
      options.fairValueNetAssetsAtAcquisition ?? "1000000",
      options.currency ?? "USD"
    ),
    subsidiaryNetIncome: MonetaryAmount.unsafeFromString(
      options.subsidiaryNetIncome ?? "100000",
      options.currency ?? "USD"
    ),
    subsidiaryOCI: MonetaryAmount.unsafeFromString(
      options.subsidiaryOCI ?? "5000",
      options.currency ?? "USD"
    ),
    dividendsDeclared: MonetaryAmount.unsafeFromString(
      options.dividendsDeclared ?? "20000",
      options.currency ?? "USD"
    ),
    cumulativeNCINetIncome: MonetaryAmount.unsafeFromString(
      options.cumulativeNCINetIncome ?? "50000",
      options.currency ?? "USD"
    ),
    cumulativeDividendsToNCI: MonetaryAmount.unsafeFromString(
      options.cumulativeDividendsToNCI ?? "10000",
      options.currency ?? "USD"
    ),
    cumulativeNCIOCI: MonetaryAmount.unsafeFromString(
      options.cumulativeNCIOCI ?? "2000",
      options.currency ?? "USD"
    ),
    periodYear: options.periodYear ?? 2024,
    periodNumber: options.periodNumber ?? 12,
    currency: CurrencyCode.make(options.currency ?? "USD")
  }
  if (options.nciPremiumDiscountAtAcquisition) {
    return {
      ...data,
      nciPremiumDiscountAtAcquisition: MonetaryAmount.unsafeFromString(
        options.nciPremiumDiscountAtAcquisition,
        options.currency ?? "USD"
      )
    }
  }
  return data
}

// =============================================================================
// NCIPercentage Tests
// =============================================================================

describe("NCIPercentage", () => {
  describe("creation", () => {
    it("creates NCI percentage from parent ownership", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(80),
        nciPercentage: Percentage.make(20)
      })
      expect(nciPct.parentOwnershipPercentage).toBe(80)
      expect(nciPct.nciPercentage).toBe(20)
    })

    it("handles 100% ownership (no NCI)", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(100),
        nciPercentage: Percentage.make(0)
      })
      expect(nciPct.isWhollyOwned).toBe(true)
      expect(nciPct.hasNCI).toBe(false)
    })

    it("handles 0% ownership (100% NCI)", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(0),
        nciPercentage: Percentage.make(100)
      })
      expect(nciPct.isWhollyOwned).toBe(false)
      expect(nciPct.hasNCI).toBe(true)
    })
  })

  describe("computed properties", () => {
    it("nciDecimal returns correct decimal value", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(80),
        nciPercentage: Percentage.make(20)
      })
      expect(nciPct.nciDecimal).toBe(0.2)
    })

    it("parentDecimal returns correct decimal value", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(75),
        nciPercentage: Percentage.make(25)
      })
      expect(nciPct.parentDecimal).toBe(0.75)
    })

    it("hasNCI returns true when NCI > 0", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(51),
        nciPercentage: Percentage.make(49)
      })
      expect(nciPct.hasNCI).toBe(true)
    })

    it("hasNCI returns false when NCI = 0", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(100),
        nciPercentage: Percentage.make(0)
      })
      expect(nciPct.hasNCI).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isNCIPercentage returns true for valid NCIPercentage", () => {
      const nciPct = NCIPercentage.make({
        parentOwnershipPercentage: Percentage.make(80),
        nciPercentage: Percentage.make(20)
      })
      expect(isNCIPercentage(nciPct)).toBe(true)
    })

    it("isNCIPercentage returns false for invalid values", () => {
      expect(isNCIPercentage(null)).toBe(false)
      expect(isNCIPercentage(undefined)).toBe(false)
      expect(isNCIPercentage({ parentOwnershipPercentage: 80 })).toBe(false)
    })
  })
})

// =============================================================================
// NCIEquityAtAcquisition Tests
// =============================================================================

describe("NCIEquityAtAcquisition", () => {
  describe("creation", () => {
    it("creates NCI equity at acquisition without premium", () => {
      const equity = NCIEquityAtAcquisition.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        fairValueNetAssets: MonetaryAmount.unsafeFromString("1000000", "USD"),
        nciPercentage: Percentage.make(20),
        nciShareOfFairValue: MonetaryAmount.unsafeFromString("200000", "USD"),
        nciPremiumDiscount: Option.none(),
        totalNCIAtAcquisition: MonetaryAmount.unsafeFromString("200000", "USD")
      })
      expect(equity.nciPercentage).toBe(20)
      expect(equity.nciShareOfFairValue.format()).toBe("200000")
      expect(equity.isMeasuredAtFairValue).toBe(false)
    })

    it("creates NCI equity at acquisition with premium", () => {
      const equity = NCIEquityAtAcquisition.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        fairValueNetAssets: MonetaryAmount.unsafeFromString("1000000", "USD"),
        nciPercentage: Percentage.make(20),
        nciShareOfFairValue: MonetaryAmount.unsafeFromString("200000", "USD"),
        nciPremiumDiscount: Option.some(MonetaryAmount.unsafeFromString("10000", "USD")),
        totalNCIAtAcquisition: MonetaryAmount.unsafeFromString("210000", "USD")
      })
      expect(equity.isMeasuredAtFairValue).toBe(true)
      expect(equity.totalNCIAtAcquisition.format()).toBe("210000")
    })
  })

  describe("type guard", () => {
    it("isNCIEquityAtAcquisition returns true for valid instance", () => {
      const equity = NCIEquityAtAcquisition.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        fairValueNetAssets: MonetaryAmount.unsafeFromString("1000000", "USD"),
        nciPercentage: Percentage.make(20),
        nciShareOfFairValue: MonetaryAmount.unsafeFromString("200000", "USD"),
        nciPremiumDiscount: Option.none(),
        totalNCIAtAcquisition: MonetaryAmount.unsafeFromString("200000", "USD")
      })
      expect(isNCIEquityAtAcquisition(equity)).toBe(true)
    })

    it("isNCIEquityAtAcquisition returns false for invalid values", () => {
      expect(isNCIEquityAtAcquisition(null)).toBe(false)
      expect(isNCIEquityAtAcquisition(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// NCIEquityChange Tests
// =============================================================================

describe("NCIEquityChange", () => {
  describe("creation", () => {
    it("creates net income change", () => {
      const change = NCIEquityChange.make({
        changeType: "NetIncome",
        description: Schema.NonEmptyTrimmedString.make("NCI share of net income"),
        amount: MonetaryAmount.unsafeFromString("20000", "USD"),
        periodYear: 2024,
        periodNumber: 12
      })
      expect(change.changeType).toBe("NetIncome")
      expect(change.amount.format()).toBe("20000")
    })

    it("creates dividend change", () => {
      const change = NCIEquityChange.make({
        changeType: "Dividends",
        description: Schema.NonEmptyTrimmedString.make("Dividends to NCI"),
        amount: MonetaryAmount.unsafeFromString("-5000", "USD"),
        periodYear: 2024,
        periodNumber: 12
      })
      expect(change.changeType).toBe("Dividends")
      expect(change.amount.isNegative).toBe(true)
    })

    it("creates OCI change", () => {
      const change = NCIEquityChange.make({
        changeType: "OtherComprehensiveIncome",
        description: Schema.NonEmptyTrimmedString.make("NCI share of OCI"),
        amount: MonetaryAmount.unsafeFromString("1000", "USD"),
        periodYear: 2024,
        periodNumber: 12
      })
      expect(change.changeType).toBe("OtherComprehensiveIncome")
    })

    it("creates ownership change", () => {
      const change = NCIEquityChange.make({
        changeType: "OwnershipChange",
        description: Schema.NonEmptyTrimmedString.make("Parent increased ownership"),
        amount: MonetaryAmount.unsafeFromString("-10000", "USD"),
        periodYear: 2024,
        periodNumber: 6
      })
      expect(change.changeType).toBe("OwnershipChange")
    })
  })

  describe("type guard", () => {
    it("isNCIEquityChange returns true for valid instance", () => {
      const change = NCIEquityChange.make({
        changeType: "NetIncome",
        description: Schema.NonEmptyTrimmedString.make("Test"),
        amount: MonetaryAmount.unsafeFromString("1000", "USD"),
        periodYear: 2024,
        periodNumber: 1
      })
      expect(isNCIEquityChange(change)).toBe(true)
    })

    it("isNCIEquityChange returns false for invalid values", () => {
      expect(isNCIEquityChange(null)).toBe(false)
      expect(isNCIEquityChange(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// NCISubsequentChanges Tests
// =============================================================================

describe("NCISubsequentChanges", () => {
  describe("creation", () => {
    it("creates subsequent changes with multiple items", () => {
      const changes = NCISubsequentChanges.make({
        changes: Chunk.make(
          NCIEquityChange.make({
            changeType: "NetIncome",
            description: Schema.NonEmptyTrimmedString.make("Net income"),
            amount: MonetaryAmount.unsafeFromString("20000", "USD"),
            periodYear: 2024,
            periodNumber: 12
          }),
          NCIEquityChange.make({
            changeType: "Dividends",
            description: Schema.NonEmptyTrimmedString.make("Dividends"),
            amount: MonetaryAmount.unsafeFromString("-5000", "USD"),
            periodYear: 2024,
            periodNumber: 12
          })
        ),
        totalNetIncome: MonetaryAmount.unsafeFromString("20000", "USD"),
        totalDividends: MonetaryAmount.unsafeFromString("5000", "USD"),
        totalOCI: MonetaryAmount.zero(testCurrency),
        totalOther: MonetaryAmount.zero(testCurrency),
        netChange: MonetaryAmount.unsafeFromString("15000", "USD")
      })
      expect(changes.changeCount).toBe(2)
      expect(changes.hasChanges).toBe(true)
    })

    it("creates empty subsequent changes", () => {
      const changes = NCISubsequentChanges.make({
        changes: Chunk.empty(),
        totalNetIncome: MonetaryAmount.zero(testCurrency),
        totalDividends: MonetaryAmount.zero(testCurrency),
        totalOCI: MonetaryAmount.zero(testCurrency),
        totalOther: MonetaryAmount.zero(testCurrency),
        netChange: MonetaryAmount.zero(testCurrency)
      })
      expect(changes.changeCount).toBe(0)
      expect(changes.hasChanges).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isNCISubsequentChanges returns true for valid instance", () => {
      const changes = NCISubsequentChanges.make({
        changes: Chunk.empty(),
        totalNetIncome: MonetaryAmount.zero(testCurrency),
        totalDividends: MonetaryAmount.zero(testCurrency),
        totalOCI: MonetaryAmount.zero(testCurrency),
        totalOther: MonetaryAmount.zero(testCurrency),
        netChange: MonetaryAmount.zero(testCurrency)
      })
      expect(isNCISubsequentChanges(changes)).toBe(true)
    })

    it("isNCISubsequentChanges returns false for invalid values", () => {
      expect(isNCISubsequentChanges(null)).toBe(false)
      expect(isNCISubsequentChanges(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// NCINetIncome Tests
// =============================================================================

describe("NCINetIncome", () => {
  describe("creation", () => {
    it("creates NCI net income for profitable subsidiary", () => {
      const nciIncome = NCINetIncome.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        subsidiaryNetIncome: MonetaryAmount.unsafeFromString("100000", "USD"),
        nciPercentage: Percentage.make(20),
        nciShareOfNetIncome: MonetaryAmount.unsafeFromString("20000", "USD"),
        periodYear: 2024,
        periodNumber: 12
      })
      expect(nciIncome.nciShareOfNetIncome.format()).toBe("20000")
      expect(nciIncome.isProfitable).toBe(true)
      expect(nciIncome.isLoss).toBe(false)
    })

    it("creates NCI net income for loss-making subsidiary", () => {
      const nciIncome = NCINetIncome.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        subsidiaryNetIncome: MonetaryAmount.unsafeFromString("-50000", "USD"),
        nciPercentage: Percentage.make(20),
        nciShareOfNetIncome: MonetaryAmount.unsafeFromString("-10000", "USD"),
        periodYear: 2024,
        periodNumber: 12
      })
      expect(nciIncome.nciShareOfNetIncome.format()).toBe("-10000")
      expect(nciIncome.isProfitable).toBe(false)
      expect(nciIncome.isLoss).toBe(true)
    })
  })

  describe("type guard", () => {
    it("isNCINetIncome returns true for valid instance", () => {
      const nciIncome = NCINetIncome.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        subsidiaryNetIncome: MonetaryAmount.unsafeFromString("100000", "USD"),
        nciPercentage: Percentage.make(20),
        nciShareOfNetIncome: MonetaryAmount.unsafeFromString("20000", "USD"),
        periodYear: 2024,
        periodNumber: 12
      })
      expect(isNCINetIncome(nciIncome)).toBe(true)
    })

    it("isNCINetIncome returns false for invalid values", () => {
      expect(isNCINetIncome(null)).toBe(false)
      expect(isNCINetIncome(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// NCILineItem Tests
// =============================================================================

describe("NCILineItem", () => {
  describe("creation", () => {
    it("creates balance sheet line item", () => {
      const item = NCILineItem.make({
        lineItemType: "NCIEquity",
        description: Schema.NonEmptyTrimmedString.make("Non-controlling interest"),
        amount: MonetaryAmount.unsafeFromString("250000", "USD"),
        subsidiaryId: Option.some(CompanyId.make(subsidiaryUUID1)),
        subsidiaryName: Option.some(Schema.NonEmptyTrimmedString.make("Test Subsidiary"))
      })
      expect(item.isBalanceSheetItem).toBe(true)
      expect(item.isIncomeStatementItem).toBe(false)
      expect(item.isOCIItem).toBe(false)
      expect(item.isEquityStatementItem).toBe(false)
    })

    it("creates income statement line item", () => {
      const item = NCILineItem.make({
        lineItemType: "NCINetIncome",
        description: Schema.NonEmptyTrimmedString.make("Net income to NCI"),
        amount: MonetaryAmount.unsafeFromString("20000", "USD"),
        subsidiaryId: Option.none(),
        subsidiaryName: Option.none()
      })
      expect(item.isBalanceSheetItem).toBe(false)
      expect(item.isIncomeStatementItem).toBe(true)
    })

    it("creates OCI line item", () => {
      const item = NCILineItem.make({
        lineItemType: "NCIOCI",
        description: Schema.NonEmptyTrimmedString.make("OCI to NCI"),
        amount: MonetaryAmount.unsafeFromString("1000", "USD"),
        subsidiaryId: Option.none(),
        subsidiaryName: Option.none()
      })
      expect(item.isOCIItem).toBe(true)
    })

    it("creates equity statement line items", () => {
      const dividends = NCILineItem.make({
        lineItemType: "NCIDividends",
        description: Schema.NonEmptyTrimmedString.make("Dividends to NCI"),
        amount: MonetaryAmount.unsafeFromString("-5000", "USD"),
        subsidiaryId: Option.none(),
        subsidiaryName: Option.none()
      })
      expect(dividends.isEquityStatementItem).toBe(true)

      const acquisition = NCILineItem.make({
        lineItemType: "NCIAcquisition",
        description: Schema.NonEmptyTrimmedString.make("NCI at acquisition"),
        amount: MonetaryAmount.unsafeFromString("200000", "USD"),
        subsidiaryId: Option.none(),
        subsidiaryName: Option.none()
      })
      expect(acquisition.isEquityStatementItem).toBe(true)

      const other = NCILineItem.make({
        lineItemType: "NCIOther",
        description: Schema.NonEmptyTrimmedString.make("Other NCI changes"),
        amount: MonetaryAmount.unsafeFromString("1000", "USD"),
        subsidiaryId: Option.none(),
        subsidiaryName: Option.none()
      })
      expect(other.isEquityStatementItem).toBe(true)
    })
  })

  describe("type guard", () => {
    it("isNCILineItem returns true for valid instance", () => {
      const item = NCILineItem.make({
        lineItemType: "NCIEquity",
        description: Schema.NonEmptyTrimmedString.make("Test"),
        amount: MonetaryAmount.unsafeFromString("1000", "USD"),
        subsidiaryId: Option.none(),
        subsidiaryName: Option.none()
      })
      expect(isNCILineItem(item)).toBe(true)
    })

    it("isNCILineItem returns false for invalid values", () => {
      expect(isNCILineItem(null)).toBe(false)
      expect(isNCILineItem(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// NCIResult Tests
// =============================================================================

describe("NCIResult", () => {
  describe("computed properties", () => {
    it("filters line items by type", () => {
      const result = NCIResult.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        subsidiaryName: Schema.NonEmptyTrimmedString.make("Test"),
        nciPercentage: NCIPercentage.make({
          parentOwnershipPercentage: Percentage.make(80),
          nciPercentage: Percentage.make(20)
        }),
        equityAtAcquisition: NCIEquityAtAcquisition.make({
          subsidiaryId: CompanyId.make(subsidiaryUUID1),
          fairValueNetAssets: MonetaryAmount.unsafeFromString("1000000", "USD"),
          nciPercentage: Percentage.make(20),
          nciShareOfFairValue: MonetaryAmount.unsafeFromString("200000", "USD"),
          nciPremiumDiscount: Option.none(),
          totalNCIAtAcquisition: MonetaryAmount.unsafeFromString("200000", "USD")
        }),
        subsequentChanges: NCISubsequentChanges.make({
          changes: Chunk.empty(),
          totalNetIncome: MonetaryAmount.zero(testCurrency),
          totalDividends: MonetaryAmount.zero(testCurrency),
          totalOCI: MonetaryAmount.zero(testCurrency),
          totalOther: MonetaryAmount.zero(testCurrency),
          netChange: MonetaryAmount.zero(testCurrency)
        }),
        currentPeriodNetIncome: NCINetIncome.make({
          subsidiaryId: CompanyId.make(subsidiaryUUID1),
          subsidiaryNetIncome: MonetaryAmount.unsafeFromString("100000", "USD"),
          nciPercentage: Percentage.make(20),
          nciShareOfNetIncome: MonetaryAmount.unsafeFromString("20000", "USD"),
          periodYear: 2024,
          periodNumber: 12
        }),
        totalNCIEquity: MonetaryAmount.unsafeFromString("220000", "USD"),
        lineItems: Chunk.make(
          NCILineItem.make({
            lineItemType: "NCIEquity",
            description: Schema.NonEmptyTrimmedString.make("Balance sheet"),
            amount: MonetaryAmount.unsafeFromString("220000", "USD"),
            subsidiaryId: Option.none(),
            subsidiaryName: Option.none()
          }),
          NCILineItem.make({
            lineItemType: "NCINetIncome",
            description: Schema.NonEmptyTrimmedString.make("Income statement"),
            amount: MonetaryAmount.unsafeFromString("20000", "USD"),
            subsidiaryId: Option.none(),
            subsidiaryName: Option.none()
          }),
          NCILineItem.make({
            lineItemType: "NCIOCI",
            description: Schema.NonEmptyTrimmedString.make("OCI"),
            amount: MonetaryAmount.unsafeFromString("1000", "USD"),
            subsidiaryId: Option.none(),
            subsidiaryName: Option.none()
          }),
          NCILineItem.make({
            lineItemType: "NCIDividends",
            description: Schema.NonEmptyTrimmedString.make("Dividends"),
            amount: MonetaryAmount.unsafeFromString("-5000", "USD"),
            subsidiaryId: Option.none(),
            subsidiaryName: Option.none()
          })
        ),
        currency: testCurrency
      })

      expect(Chunk.size(result.balanceSheetLineItems)).toBe(1)
      expect(Chunk.size(result.incomeStatementLineItems)).toBe(1)
      expect(Chunk.size(result.ociLineItems)).toBe(1)
      expect(Chunk.size(result.equityStatementLineItems)).toBe(1)
    })

    it("hasNCI returns true when NCI percentage > 0", () => {
      const result = NCIResult.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        subsidiaryName: Schema.NonEmptyTrimmedString.make("Test"),
        nciPercentage: NCIPercentage.make({
          parentOwnershipPercentage: Percentage.make(80),
          nciPercentage: Percentage.make(20)
        }),
        equityAtAcquisition: NCIEquityAtAcquisition.make({
          subsidiaryId: CompanyId.make(subsidiaryUUID1),
          fairValueNetAssets: MonetaryAmount.zero(testCurrency),
          nciPercentage: Percentage.make(20),
          nciShareOfFairValue: MonetaryAmount.zero(testCurrency),
          nciPremiumDiscount: Option.none(),
          totalNCIAtAcquisition: MonetaryAmount.zero(testCurrency)
        }),
        subsequentChanges: NCISubsequentChanges.make({
          changes: Chunk.empty(),
          totalNetIncome: MonetaryAmount.zero(testCurrency),
          totalDividends: MonetaryAmount.zero(testCurrency),
          totalOCI: MonetaryAmount.zero(testCurrency),
          totalOther: MonetaryAmount.zero(testCurrency),
          netChange: MonetaryAmount.zero(testCurrency)
        }),
        currentPeriodNetIncome: NCINetIncome.make({
          subsidiaryId: CompanyId.make(subsidiaryUUID1),
          subsidiaryNetIncome: MonetaryAmount.zero(testCurrency),
          nciPercentage: Percentage.make(20),
          nciShareOfNetIncome: MonetaryAmount.zero(testCurrency),
          periodYear: 2024,
          periodNumber: 12
        }),
        totalNCIEquity: MonetaryAmount.zero(testCurrency),
        lineItems: Chunk.empty(),
        currency: testCurrency
      })
      expect(result.hasNCI).toBe(true)
    })
  })

  describe("type guard", () => {
    it("isNCIResult returns true for valid instance", () => {
      const result = NCIResult.make({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        subsidiaryName: Schema.NonEmptyTrimmedString.make("Test"),
        nciPercentage: NCIPercentage.make({
          parentOwnershipPercentage: Percentage.make(100),
          nciPercentage: Percentage.make(0)
        }),
        equityAtAcquisition: NCIEquityAtAcquisition.make({
          subsidiaryId: CompanyId.make(subsidiaryUUID1),
          fairValueNetAssets: MonetaryAmount.zero(testCurrency),
          nciPercentage: Percentage.make(0),
          nciShareOfFairValue: MonetaryAmount.zero(testCurrency),
          nciPremiumDiscount: Option.none(),
          totalNCIAtAcquisition: MonetaryAmount.zero(testCurrency)
        }),
        subsequentChanges: NCISubsequentChanges.make({
          changes: Chunk.empty(),
          totalNetIncome: MonetaryAmount.zero(testCurrency),
          totalDividends: MonetaryAmount.zero(testCurrency),
          totalOCI: MonetaryAmount.zero(testCurrency),
          totalOther: MonetaryAmount.zero(testCurrency),
          netChange: MonetaryAmount.zero(testCurrency)
        }),
        currentPeriodNetIncome: NCINetIncome.make({
          subsidiaryId: CompanyId.make(subsidiaryUUID1),
          subsidiaryNetIncome: MonetaryAmount.zero(testCurrency),
          nciPercentage: Percentage.make(0),
          nciShareOfNetIncome: MonetaryAmount.zero(testCurrency),
          periodYear: 2024,
          periodNumber: 12
        }),
        totalNCIEquity: MonetaryAmount.zero(testCurrency),
        lineItems: Chunk.empty(),
        currency: testCurrency
      })
      expect(isNCIResult(result)).toBe(true)
    })

    it("isNCIResult returns false for invalid values", () => {
      expect(isNCIResult(null)).toBe(false)
      expect(isNCIResult(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidatedNCISummary Tests
// =============================================================================

describe("ConsolidatedNCISummary", () => {
  describe("computed properties", () => {
    it("subsidiaryCount returns correct count", () => {
      const summary = ConsolidatedNCISummary.make({
        subsidiaryResults: Chunk.empty(),
        totalNCIEquity: MonetaryAmount.zero(testCurrency),
        totalNCINetIncome: MonetaryAmount.zero(testCurrency),
        totalNCIOCI: MonetaryAmount.zero(testCurrency),
        consolidatedLineItems: Chunk.empty(),
        currency: testCurrency
      })
      expect(summary.subsidiaryCount).toBe(0)
      expect(summary.hasNCI).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isConsolidatedNCISummary returns true for valid instance", () => {
      const summary = ConsolidatedNCISummary.make({
        subsidiaryResults: Chunk.empty(),
        totalNCIEquity: MonetaryAmount.zero(testCurrency),
        totalNCINetIncome: MonetaryAmount.zero(testCurrency),
        totalNCIOCI: MonetaryAmount.zero(testCurrency),
        consolidatedLineItems: Chunk.empty(),
        currency: testCurrency
      })
      expect(isConsolidatedNCISummary(summary)).toBe(true)
    })

    it("isConsolidatedNCISummary returns false for invalid values", () => {
      expect(isConsolidatedNCISummary(null)).toBe(false)
      expect(isConsolidatedNCISummary(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// Error Type Tests
// =============================================================================

describe("Error Types", () => {
  describe("SubsidiaryNotFoundError", () => {
    it("creates error with correct message", () => {
      const error = new SubsidiaryNotFoundError({
        subsidiaryId: CompanyId.make(subsidiaryUUID1)
      })
      expect(error._tag).toBe("SubsidiaryNotFoundError")
      expect(error.message).toContain(subsidiaryUUID1)
      expect(error.message).toContain("Subsidiary not found")
    })

    it("type guard returns true for valid error", () => {
      const error = new SubsidiaryNotFoundError({
        subsidiaryId: CompanyId.make(subsidiaryUUID1)
      })
      expect(isSubsidiaryNotFoundError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isSubsidiaryNotFoundError(null)).toBe(false)
      expect(isSubsidiaryNotFoundError(new Error("test"))).toBe(false)
    })
  })

  describe("InvalidOwnershipPercentageError", () => {
    it("creates error with correct message", () => {
      const error = new InvalidOwnershipPercentageError({
        ownershipPercentage: Percentage.make(80),
        reason: Schema.NonEmptyTrimmedString.make("Test reason")
      })
      expect(error._tag).toBe("InvalidOwnershipPercentageError")
      expect(error.message).toContain("80")
      expect(error.message).toContain("Test reason")
    })

    it("type guard returns true for valid error", () => {
      const error = new InvalidOwnershipPercentageError({
        ownershipPercentage: Percentage.make(80),
        reason: Schema.NonEmptyTrimmedString.make("Test")
      })
      expect(isInvalidOwnershipPercentageError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isInvalidOwnershipPercentageError(null)).toBe(false)
    })
  })

  describe("NCICalculationError", () => {
    it("creates error with correct message", () => {
      const error = new NCICalculationError({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        reason: Schema.NonEmptyTrimmedString.make("Calculation failed")
      })
      expect(error._tag).toBe("NCICalculationError")
      expect(error.message).toContain(subsidiaryUUID1)
      expect(error.message).toContain("Calculation failed")
    })

    it("type guard returns true for valid error", () => {
      const error = new NCICalculationError({
        subsidiaryId: CompanyId.make(subsidiaryUUID1),
        reason: Schema.NonEmptyTrimmedString.make("Test")
      })
      expect(isNCICalculationError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isNCICalculationError(null)).toBe(false)
    })
  })
})

// =============================================================================
// Pure Function Tests
// =============================================================================

describe("Pure Functions", () => {
  describe("calculateNCIPercentage", () => {
    it("calculates NCI percentage correctly", () => {
      const result = calculateNCIPercentage(Percentage.make(80))
      expect(result.parentOwnershipPercentage).toBe(80)
      expect(result.nciPercentage).toBe(20)
    })

    it("handles 100% ownership", () => {
      const result = calculateNCIPercentage(Percentage.make(100))
      expect(result.nciPercentage).toBe(0)
      expect(result.isWhollyOwned).toBe(true)
    })

    it("handles 0% ownership", () => {
      const result = calculateNCIPercentage(Percentage.make(0))
      expect(result.nciPercentage).toBe(100)
    })

    it("handles fractional ownership", () => {
      const result = calculateNCIPercentage(Percentage.make(51.5))
      expect(result.nciPercentage).toBe(48.5)
    })
  })

  describe("calculateNCIShare", () => {
    it("calculates NCI share correctly", () => {
      const amount = MonetaryAmount.unsafeFromString("100000", "USD")
      const result = calculateNCIShare(amount, Percentage.make(20))
      expect(result.format()).toBe("20000")
    })

    it("handles 0% NCI", () => {
      const amount = MonetaryAmount.unsafeFromString("100000", "USD")
      const result = calculateNCIShare(amount, Percentage.make(0))
      expect(result.isZero).toBe(true)
    })

    it("handles 100% NCI", () => {
      const amount = MonetaryAmount.unsafeFromString("100000", "USD")
      const result = calculateNCIShare(amount, Percentage.make(100))
      expect(result.format()).toBe("100000")
    })

    it("handles negative amounts", () => {
      const amount = MonetaryAmount.unsafeFromString("-50000", "USD")
      const result = calculateNCIShare(amount, Percentage.make(20))
      expect(result.format()).toBe("-10000")
    })
  })

  describe("calculateNCIEquityAtAcquisition", () => {
    it("calculates equity at acquisition without premium", () => {
      const result = calculateNCIEquityAtAcquisition(
        CompanyId.make(subsidiaryUUID1),
        MonetaryAmount.unsafeFromString("1000000", "USD"),
        Percentage.make(20)
      )
      expect(result.nciShareOfFairValue.format()).toBe("200000")
      expect(result.totalNCIAtAcquisition.format()).toBe("200000")
      expect(result.isMeasuredAtFairValue).toBe(false)
    })

    it("calculates equity at acquisition with premium", () => {
      const result = calculateNCIEquityAtAcquisition(
        CompanyId.make(subsidiaryUUID1),
        MonetaryAmount.unsafeFromString("1000000", "USD"),
        Percentage.make(20),
        MonetaryAmount.unsafeFromString("15000", "USD")
      )
      expect(result.nciShareOfFairValue.format()).toBe("200000")
      expect(result.totalNCIAtAcquisition.format()).toBe("215000")
      expect(result.isMeasuredAtFairValue).toBe(true)
    })

    it("calculates equity at acquisition with discount (negative premium)", () => {
      const result = calculateNCIEquityAtAcquisition(
        CompanyId.make(subsidiaryUUID1),
        MonetaryAmount.unsafeFromString("1000000", "USD"),
        Percentage.make(20),
        MonetaryAmount.unsafeFromString("-10000", "USD")
      )
      expect(result.totalNCIAtAcquisition.format()).toBe("190000")
    })
  })

  describe("calculateNCINetIncome", () => {
    it("calculates NCI net income correctly", () => {
      const result = calculateNCINetIncome(
        CompanyId.make(subsidiaryUUID1),
        MonetaryAmount.unsafeFromString("100000", "USD"),
        Percentage.make(25),
        2024,
        12
      )
      expect(result.nciShareOfNetIncome.format()).toBe("25000")
      expect(result.periodYear).toBe(2024)
      expect(result.periodNumber).toBe(12)
      expect(result.isProfitable).toBe(true)
    })

    it("handles loss-making subsidiary", () => {
      const result = calculateNCINetIncome(
        CompanyId.make(subsidiaryUUID1),
        MonetaryAmount.unsafeFromString("-80000", "USD"),
        Percentage.make(20),
        2024,
        12
      )
      expect(result.nciShareOfNetIncome.format()).toBe("-16000")
      expect(result.isLoss).toBe(true)
    })
  })

  describe("createNCILineItems", () => {
    it("creates all line items for full NCI calculation", () => {
      const items = createNCILineItems(
        CompanyId.make(subsidiaryUUID1),
        "Test Subsidiary",
        MonetaryAmount.unsafeFromString("250000", "USD"),
        MonetaryAmount.unsafeFromString("20000", "USD"),
        MonetaryAmount.unsafeFromString("1000", "USD"),
        MonetaryAmount.unsafeFromString("5000", "USD")
      )

      expect(Chunk.size(items)).toBe(4)

      const itemArray = Chunk.toReadonlyArray(items)
      expect(itemArray[0].lineItemType).toBe("NCIEquity")
      expect(itemArray[1].lineItemType).toBe("NCINetIncome")
      expect(itemArray[2].lineItemType).toBe("NCIOCI")
      expect(itemArray[3].lineItemType).toBe("NCIDividends")
    })

    it("excludes zero amounts", () => {
      const items = createNCILineItems(
        CompanyId.make(subsidiaryUUID1),
        "Test Subsidiary",
        MonetaryAmount.unsafeFromString("250000", "USD"),
        MonetaryAmount.zero(testCurrency), // Zero net income
        MonetaryAmount.zero(testCurrency), // Zero OCI
        MonetaryAmount.zero(testCurrency)  // Zero dividends
      )

      expect(Chunk.size(items)).toBe(1) // Only equity line item
      expect(Chunk.unsafeGet(items, 0).lineItemType).toBe("NCIEquity")
    })
  })
})

// =============================================================================
// NCIService Tests
// =============================================================================

describe("NCIService", () => {
  describe("calculateNCI", () => {
    it.effect("calculates NCI for 80% owned subsidiary", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCI({
          subsidiary: createSubsidiaryData({
            parentOwnershipPercentage: 80,
            fairValueNetAssetsAtAcquisition: "1000000",
            subsidiaryNetIncome: "100000",
            subsidiaryOCI: "5000",
            dividendsDeclared: "20000",
            cumulativeNCINetIncome: "50000",
            cumulativeDividendsToNCI: "10000",
            cumulativeNCIOCI: "2000"
          })
        })

        // NCI% should be 20%
        expect(result.nciPercentage.nciPercentage).toBe(20)
        expect(result.hasNCI).toBe(true)

        // NCI at acquisition: 20% of 1,000,000 = 200,000
        expect(result.equityAtAcquisition.nciShareOfFairValue.format()).toBe("200000")

        // Current period NCI net income: 20% of 100,000 = 20,000
        expect(result.currentPeriodNetIncome.nciShareOfNetIncome.format()).toBe("20000")

        // Line items should be created
        expect(Chunk.isNonEmpty(result.lineItems)).toBe(true)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("returns zero NCI for 100% owned subsidiary", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCI({
          subsidiary: createSubsidiaryData({
            parentOwnershipPercentage: 100,
            fairValueNetAssetsAtAcquisition: "1000000",
            subsidiaryNetIncome: "100000"
          })
        })

        expect(result.nciPercentage.nciPercentage).toBe(0)
        expect(result.nciPercentage.isWhollyOwned).toBe(true)
        expect(result.hasNCI).toBe(false)
        expect(result.totalNCIEquity.isZero).toBe(true)
        expect(Chunk.isEmpty(result.lineItems)).toBe(true)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("handles NCI premium at acquisition", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCI({
          subsidiary: createSubsidiaryData({
            parentOwnershipPercentage: 80,
            fairValueNetAssetsAtAcquisition: "1000000",
            nciPremiumDiscountAtAcquisition: "25000", // Premium
            subsidiaryNetIncome: "0",
            subsidiaryOCI: "0",
            dividendsDeclared: "0",
            cumulativeNCINetIncome: "0",
            cumulativeDividendsToNCI: "0",
            cumulativeNCIOCI: "0"
          })
        })

        // NCI at acquisition with premium: 200,000 + 25,000 = 225,000
        expect(result.equityAtAcquisition.totalNCIAtAcquisition.format()).toBe("225000")
        expect(result.equityAtAcquisition.isMeasuredAtFairValue).toBe(true)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("calculates subsequent changes correctly", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCI({
          subsidiary: createSubsidiaryData({
            parentOwnershipPercentage: 80,
            fairValueNetAssetsAtAcquisition: "1000000",
            subsidiaryNetIncome: "100000",      // 20% = 20,000
            subsidiaryOCI: "10000",              // 20% = 2,000
            dividendsDeclared: "50000",          // 20% = 10,000
            cumulativeNCINetIncome: "100000",    // Prior cumulative
            cumulativeDividendsToNCI: "25000",   // Prior cumulative
            cumulativeNCIOCI: "5000"             // Prior cumulative
          })
        })

        // Total net income: 100,000 (cumulative) + 20,000 (current) = 120,000
        expect(result.subsequentChanges.totalNetIncome.format()).toBe("120000")

        // Total dividends: 25,000 (cumulative) + 10,000 (current) = 35,000
        expect(result.subsequentChanges.totalDividends.format()).toBe("35000")

        // Total OCI: 5,000 (cumulative) + 2,000 (current) = 7,000
        expect(result.subsequentChanges.totalOCI.format()).toBe("7000")

        // Net change: 120,000 - 35,000 + 7,000 = 92,000
        expect(result.subsequentChanges.netChange.format()).toBe("92000")

        // Total NCI equity: 200,000 (at acquisition) + 92,000 (net change) = 292,000
        expect(result.totalNCIEquity.format()).toBe("292000")
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("handles loss-making subsidiary", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCI({
          subsidiary: createSubsidiaryData({
            parentOwnershipPercentage: 75,
            fairValueNetAssetsAtAcquisition: "500000",
            subsidiaryNetIncome: "-100000", // Loss
            subsidiaryOCI: "-5000",
            dividendsDeclared: "0",
            cumulativeNCINetIncome: "0",
            cumulativeDividendsToNCI: "0",
            cumulativeNCIOCI: "0"
          })
        })

        // NCI% = 25%
        expect(result.nciPercentage.nciPercentage).toBe(25)

        // NCI share of loss: 25% of -100,000 = -25,000
        expect(result.currentPeriodNetIncome.nciShareOfNetIncome.format()).toBe("-25000")
        expect(result.currentPeriodNetIncome.isLoss).toBe(true)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("creates correct line items", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCI({
          subsidiary: createSubsidiaryData({
            parentOwnershipPercentage: 70,
            fairValueNetAssetsAtAcquisition: "1000000",
            subsidiaryNetIncome: "50000",
            subsidiaryOCI: "2500",
            dividendsDeclared: "10000",
            cumulativeNCINetIncome: "0",
            cumulativeDividendsToNCI: "0",
            cumulativeNCIOCI: "0"
          })
        })

        // Should have 4 line items (equity, net income, OCI, dividends)
        expect(Chunk.size(result.lineItems)).toBe(4)
        expect(Chunk.size(result.balanceSheetLineItems)).toBe(1)
        expect(Chunk.size(result.incomeStatementLineItems)).toBe(1)
        expect(Chunk.size(result.ociLineItems)).toBe(1)
        expect(Chunk.size(result.equityStatementLineItems)).toBe(1)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("handles different currency", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCI({
          subsidiary: createSubsidiaryData({
            parentOwnershipPercentage: 80,
            fairValueNetAssetsAtAcquisition: "500000",
            subsidiaryNetIncome: "50000",
            currency: "EUR"
          })
        })

        expect(result.currency).toBe("EUR")
        expect(result.totalNCIEquity.currency).toBe("EUR")
      }).pipe(Effect.provide(NCIServiceLive))
    )
  })

  describe("calculateNCIPercentage", () => {
    it.effect("calculates NCI percentage for valid ownership", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCIPercentage(Percentage.make(65))
        expect(result.nciPercentage).toBe(35)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("handles 100% ownership", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCIPercentage(Percentage.make(100))
        expect(result.nciPercentage).toBe(0)
        expect(result.isWhollyOwned).toBe(true)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("handles 0% ownership", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateNCIPercentage(Percentage.make(0))
        expect(result.nciPercentage).toBe(100)
      }).pipe(Effect.provide(NCIServiceLive))
    )
  })

  describe("calculateConsolidatedNCI", () => {
    it.effect("calculates consolidated NCI for multiple subsidiaries", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateConsolidatedNCI(
          [
            createSubsidiaryData({
              subsidiaryId: subsidiaryUUID1,
              subsidiaryName: "Subsidiary A",
              parentOwnershipPercentage: 80,
              fairValueNetAssetsAtAcquisition: "1000000",
              subsidiaryNetIncome: "100000",
              subsidiaryOCI: "5000",
              dividendsDeclared: "0",
              cumulativeNCINetIncome: "0",
              cumulativeDividendsToNCI: "0",
              cumulativeNCIOCI: "0"
            }),
            createSubsidiaryData({
              subsidiaryId: subsidiaryUUID2,
              subsidiaryName: "Subsidiary B",
              parentOwnershipPercentage: 70,
              fairValueNetAssetsAtAcquisition: "500000",
              subsidiaryNetIncome: "50000",
              subsidiaryOCI: "2500",
              dividendsDeclared: "0",
              cumulativeNCINetIncome: "0",
              cumulativeDividendsToNCI: "0",
              cumulativeNCIOCI: "0"
            })
          ],
          testCurrency
        )

        expect(result.subsidiaryCount).toBe(2)
        expect(result.hasNCI).toBe(true)

        // Total NCI equity: 200,000 (Sub A) + 150,000 (Sub B) + subsequent changes
        // Sub A: 200,000 + 20,000 (net income) + 1,000 (OCI) = 221,000
        // Sub B: 150,000 + 15,000 (net income) + 750 (OCI) = 165,750
        // Total: 386,750
        expect(result.totalNCIEquity.format()).toBe("386750")

        // Total NCI net income: 20,000 + 15,000 = 35,000
        expect(result.totalNCINetIncome.format()).toBe("35000")

        // Total NCI OCI: 1,000 + 750 = 1,750
        expect(result.totalNCIOCI.format()).toBe("1750")
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("excludes wholly-owned subsidiaries from NCI summary", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateConsolidatedNCI(
          [
            createSubsidiaryData({
              subsidiaryId: subsidiaryUUID1,
              parentOwnershipPercentage: 100, // Wholly owned - no NCI
              fairValueNetAssetsAtAcquisition: "1000000",
              subsidiaryNetIncome: "100000"
            }),
            createSubsidiaryData({
              subsidiaryId: subsidiaryUUID2,
              parentOwnershipPercentage: 80, // 20% NCI
              fairValueNetAssetsAtAcquisition: "500000",
              subsidiaryNetIncome: "50000",
              subsidiaryOCI: "0",
              dividendsDeclared: "0",
              cumulativeNCINetIncome: "0",
              cumulativeDividendsToNCI: "0",
              cumulativeNCIOCI: "0"
            })
          ],
          testCurrency
        )

        // Only one subsidiary should have NCI
        expect(result.subsidiaryCount).toBe(1)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("handles empty subsidiary list", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateConsolidatedNCI([], testCurrency)

        expect(result.subsidiaryCount).toBe(0)
        expect(result.hasNCI).toBe(false)
        expect(result.totalNCIEquity.isZero).toBe(true)
      }).pipe(Effect.provide(NCIServiceLive))
    )

    it.effect("creates consolidated line items", () =>
      Effect.gen(function* () {
        const service = yield* NCIService
        const result = yield* service.calculateConsolidatedNCI(
          [
            createSubsidiaryData({
              parentOwnershipPercentage: 75,
              fairValueNetAssetsAtAcquisition: "1000000",
              subsidiaryNetIncome: "100000",
              subsidiaryOCI: "5000",
              dividendsDeclared: "0",
              cumulativeNCINetIncome: "0",
              cumulativeDividendsToNCI: "0",
              cumulativeNCIOCI: "0"
            })
          ],
          testCurrency
        )

        // Should have consolidated line items
        expect(Chunk.isNonEmpty(result.consolidatedLineItems)).toBe(true)

        // Find the equity line item
        const equityItem = Chunk.findFirst(
          result.consolidatedLineItems,
          (item) => item.lineItemType === "NCIEquity"
        )
        expect(Option.isSome(equityItem)).toBe(true)
      }).pipe(Effect.provide(NCIServiceLive))
    )
  })
})

// =============================================================================
// Equality Tests
// =============================================================================

describe("Equality", () => {
  it("NCIPercentage equality works correctly", () => {
    const nci1 = NCIPercentage.make({
      parentOwnershipPercentage: Percentage.make(80),
      nciPercentage: Percentage.make(20)
    })
    const nci2 = NCIPercentage.make({
      parentOwnershipPercentage: Percentage.make(80),
      nciPercentage: Percentage.make(20)
    })
    const nci3 = NCIPercentage.make({
      parentOwnershipPercentage: Percentage.make(70),
      nciPercentage: Percentage.make(30)
    })

    expect(Equal.equals(nci1, nci2)).toBe(true)
    expect(Equal.equals(nci1, nci3)).toBe(false)
  })

  it("NCIEquityChange equality works correctly", () => {
    const change1 = NCIEquityChange.make({
      changeType: "NetIncome",
      description: Schema.NonEmptyTrimmedString.make("Test"),
      amount: MonetaryAmount.unsafeFromString("1000", "USD"),
      periodYear: 2024,
      periodNumber: 12
    })
    const change2 = NCIEquityChange.make({
      changeType: "NetIncome",
      description: Schema.NonEmptyTrimmedString.make("Test"),
      amount: MonetaryAmount.unsafeFromString("1000", "USD"),
      periodYear: 2024,
      periodNumber: 12
    })
    const change3 = NCIEquityChange.make({
      changeType: "Dividends",
      description: Schema.NonEmptyTrimmedString.make("Test"),
      amount: MonetaryAmount.unsafeFromString("1000", "USD"),
      periodYear: 2024,
      periodNumber: 12
    })

    expect(Equal.equals(change1, change2)).toBe(true)
    expect(Equal.equals(change1, change3)).toBe(false)
  })

  it("NCILineItem equality works correctly", () => {
    const item1 = NCILineItem.make({
      lineItemType: "NCIEquity",
      description: Schema.NonEmptyTrimmedString.make("Test"),
      amount: MonetaryAmount.unsafeFromString("100000", "USD"),
      subsidiaryId: Option.none(),
      subsidiaryName: Option.none()
    })
    const item2 = NCILineItem.make({
      lineItemType: "NCIEquity",
      description: Schema.NonEmptyTrimmedString.make("Test"),
      amount: MonetaryAmount.unsafeFromString("100000", "USD"),
      subsidiaryId: Option.none(),
      subsidiaryName: Option.none()
    })
    const item3 = NCILineItem.make({
      lineItemType: "NCINetIncome",
      description: Schema.NonEmptyTrimmedString.make("Test"),
      amount: MonetaryAmount.unsafeFromString("100000", "USD"),
      subsidiaryId: Option.none(),
      subsidiaryName: Option.none()
    })

    expect(Equal.equals(item1, item2)).toBe(true)
    expect(Equal.equals(item1, item3)).toBe(false)
  })
})
