import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  AccountNumber,
  isAccountNumber,
  isAccountType,
  isAccountCategory,
  getAccountType,
  getAccountCategory,
  isAssetAccount,
  isLiabilityAccount,
  isEquityAccount,
  isRevenueAccount,
  isExpenseAccount,
  isOtherAccount,
  isSpecialAccount,
  isBalanceSheetAccount,
  isIncomeStatementAccount,
  hasNormalDebitBalance,
  hasNormalCreditBalance,
  getSubcategory
} from "../../src/accounting/AccountNumber.ts"

describe("AccountNumber", () => {
  describe("validation", () => {
    it.effect("accepts valid 4-digit account numbers starting with 1-9", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountNumber)

        // Test each leading digit 1-9
        const num1 = yield* decode("1000")
        expect(num1).toBe("1000")

        const num2 = yield* decode("2500")
        expect(num2).toBe("2500")

        const num3 = yield* decode("3456")
        expect(num3).toBe("3456")

        const num4 = yield* decode("4999")
        expect(num4).toBe("4999")

        const num5 = yield* decode("5123")
        expect(num5).toBe("5123")

        const num6 = yield* decode("6789")
        expect(num6).toBe("6789")

        const num7 = yield* decode("7000")
        expect(num7).toBe("7000")

        const num8 = yield* decode("8888")
        expect(num8).toBe("8888")

        const num9 = yield* decode("9999")
        expect(num9).toBe("9999")
      })
    )

    it.effect("rejects numbers starting with 0", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountNumber)
        const result = yield* Effect.exit(decode("0123"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects 3-digit numbers", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountNumber)
        const result = yield* Effect.exit(decode("999"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects 5-digit numbers", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountNumber)
        const result = yield* Effect.exit(decode("10000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-numeric strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountNumber)

        const resultA = yield* Effect.exit(decode("123A"))
        expect(Exit.isFailure(resultA)).toBe(true)

        const resultB = yield* Effect.exit(decode("ABCD"))
        expect(Exit.isFailure(resultB)).toBe(true)

        const resultC = yield* Effect.exit(decode("12.5"))
        expect(Exit.isFailure(resultC)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountNumber)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects strings with leading/trailing spaces", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountNumber)

        const result1 = yield* Effect.exit(decode(" 1000"))
        expect(Exit.isFailure(result1)).toBe(true)

        const result2 = yield* Effect.exit(decode("1000 "))
        expect(Exit.isFailure(result2)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAccountNumber returns true for valid account numbers", () => {
      expect(isAccountNumber("1000")).toBe(true)
      expect(isAccountNumber("2500")).toBe(true)
      expect(isAccountNumber("3456")).toBe(true)
      expect(isAccountNumber("4999")).toBe(true)
      expect(isAccountNumber("5123")).toBe(true)
      expect(isAccountNumber("6789")).toBe(true)
      expect(isAccountNumber("7000")).toBe(true)
      expect(isAccountNumber("8888")).toBe(true)
      expect(isAccountNumber("9999")).toBe(true)
    })

    it("isAccountNumber returns false for invalid account numbers", () => {
      expect(isAccountNumber("0123")).toBe(false)
      expect(isAccountNumber("999")).toBe(false)
      expect(isAccountNumber("10000")).toBe(false)
      expect(isAccountNumber("123A")).toBe(false)
      expect(isAccountNumber("")).toBe(false)
      expect(isAccountNumber(1000)).toBe(false)
      expect(isAccountNumber(null)).toBe(false)
      expect(isAccountNumber(undefined)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates AccountNumber using Schema's .make()", () => {
      const num = AccountNumber.make("1234")
      expect(num).toBe("1234")
    })
  })

  describe("encoding", () => {
    it.effect("encodes AccountNumber back to string", () =>
      Effect.gen(function* () {
        const encode = Schema.encodeSync(AccountNumber)
        const decode = Schema.decodeUnknownSync(AccountNumber)

        const num = decode("1234")
        const encoded = encode(num)

        expect(encoded).toBe("1234")
      })
    )
  })

  describe("AccountType schema", () => {
    it("isAccountType validates account types", () => {
      expect(isAccountType("Asset")).toBe(true)
      expect(isAccountType("Liability")).toBe(true)
      expect(isAccountType("Equity")).toBe(true)
      expect(isAccountType("Revenue")).toBe(true)
      expect(isAccountType("Expense")).toBe(true)
      expect(isAccountType("Invalid")).toBe(false)
      expect(isAccountType("")).toBe(false)
    })
  })

  describe("AccountCategory schema", () => {
    it("isAccountCategory validates account categories", () => {
      expect(isAccountCategory("Asset")).toBe(true)
      expect(isAccountCategory("Liability")).toBe(true)
      expect(isAccountCategory("Equity")).toBe(true)
      expect(isAccountCategory("Revenue")).toBe(true)
      expect(isAccountCategory("Expense")).toBe(true)
      expect(isAccountCategory("Other")).toBe(true)
      expect(isAccountCategory("Special")).toBe(true)
      expect(isAccountCategory("Invalid")).toBe(false)
    })
  })

  describe("getAccountType", () => {
    it("returns Asset for 1xxx accounts", () => {
      expect(Option.getOrNull(getAccountType(AccountNumber.make("1000")))).toBe("Asset")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("1234")))).toBe("Asset")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("1999")))).toBe("Asset")
    })

    it("returns Liability for 2xxx accounts", () => {
      expect(Option.getOrNull(getAccountType(AccountNumber.make("2000")))).toBe("Liability")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("2500")))).toBe("Liability")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("2999")))).toBe("Liability")
    })

    it("returns Equity for 3xxx accounts", () => {
      expect(Option.getOrNull(getAccountType(AccountNumber.make("3000")))).toBe("Equity")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("3500")))).toBe("Equity")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("3999")))).toBe("Equity")
    })

    it("returns Revenue for 4xxx accounts", () => {
      expect(Option.getOrNull(getAccountType(AccountNumber.make("4000")))).toBe("Revenue")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("4500")))).toBe("Revenue")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("4999")))).toBe("Revenue")
    })

    it("returns Expense for 5xxx-7xxx accounts", () => {
      expect(Option.getOrNull(getAccountType(AccountNumber.make("5000")))).toBe("Expense")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("5999")))).toBe("Expense")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("6000")))).toBe("Expense")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("6999")))).toBe("Expense")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("7000")))).toBe("Expense")
      expect(Option.getOrNull(getAccountType(AccountNumber.make("7999")))).toBe("Expense")
    })

    it("returns None for 8xxx accounts (Other Income/Expense)", () => {
      expect(Option.isNone(getAccountType(AccountNumber.make("8000")))).toBe(true)
      expect(Option.isNone(getAccountType(AccountNumber.make("8999")))).toBe(true)
    })

    it("returns None for 9xxx accounts (Special)", () => {
      expect(Option.isNone(getAccountType(AccountNumber.make("9000")))).toBe(true)
      expect(Option.isNone(getAccountType(AccountNumber.make("9999")))).toBe(true)
    })
  })

  describe("getAccountCategory", () => {
    it("returns correct category for each range", () => {
      expect(getAccountCategory(AccountNumber.make("1000"))).toBe("Asset")
      expect(getAccountCategory(AccountNumber.make("2000"))).toBe("Liability")
      expect(getAccountCategory(AccountNumber.make("3000"))).toBe("Equity")
      expect(getAccountCategory(AccountNumber.make("4000"))).toBe("Revenue")
      expect(getAccountCategory(AccountNumber.make("5000"))).toBe("Expense")
      expect(getAccountCategory(AccountNumber.make("6000"))).toBe("Expense")
      expect(getAccountCategory(AccountNumber.make("7000"))).toBe("Expense")
      expect(getAccountCategory(AccountNumber.make("8000"))).toBe("Other")
      expect(getAccountCategory(AccountNumber.make("9000"))).toBe("Special")
    })
  })

  describe("account type predicates", () => {
    describe("isAssetAccount", () => {
      it("returns true for 1xxx accounts", () => {
        expect(isAssetAccount(AccountNumber.make("1000"))).toBe(true)
        expect(isAssetAccount(AccountNumber.make("1500"))).toBe(true)
        expect(isAssetAccount(AccountNumber.make("1999"))).toBe(true)
      })

      it("returns false for non-asset accounts", () => {
        expect(isAssetAccount(AccountNumber.make("2000"))).toBe(false)
        expect(isAssetAccount(AccountNumber.make("5000"))).toBe(false)
        expect(isAssetAccount(AccountNumber.make("9000"))).toBe(false)
      })
    })

    describe("isLiabilityAccount", () => {
      it("returns true for 2xxx accounts", () => {
        expect(isLiabilityAccount(AccountNumber.make("2000"))).toBe(true)
        expect(isLiabilityAccount(AccountNumber.make("2500"))).toBe(true)
        expect(isLiabilityAccount(AccountNumber.make("2999"))).toBe(true)
      })

      it("returns false for non-liability accounts", () => {
        expect(isLiabilityAccount(AccountNumber.make("1000"))).toBe(false)
        expect(isLiabilityAccount(AccountNumber.make("3000"))).toBe(false)
      })
    })

    describe("isEquityAccount", () => {
      it("returns true for 3xxx accounts", () => {
        expect(isEquityAccount(AccountNumber.make("3000"))).toBe(true)
        expect(isEquityAccount(AccountNumber.make("3500"))).toBe(true)
        expect(isEquityAccount(AccountNumber.make("3999"))).toBe(true)
      })

      it("returns false for non-equity accounts", () => {
        expect(isEquityAccount(AccountNumber.make("2000"))).toBe(false)
        expect(isEquityAccount(AccountNumber.make("4000"))).toBe(false)
      })
    })

    describe("isRevenueAccount", () => {
      it("returns true for 4xxx accounts", () => {
        expect(isRevenueAccount(AccountNumber.make("4000"))).toBe(true)
        expect(isRevenueAccount(AccountNumber.make("4500"))).toBe(true)
        expect(isRevenueAccount(AccountNumber.make("4999"))).toBe(true)
      })

      it("returns false for non-revenue accounts", () => {
        expect(isRevenueAccount(AccountNumber.make("3000"))).toBe(false)
        expect(isRevenueAccount(AccountNumber.make("5000"))).toBe(false)
      })
    })

    describe("isExpenseAccount", () => {
      it("returns true for 5xxx-7xxx accounts", () => {
        expect(isExpenseAccount(AccountNumber.make("5000"))).toBe(true)
        expect(isExpenseAccount(AccountNumber.make("5999"))).toBe(true)
        expect(isExpenseAccount(AccountNumber.make("6000"))).toBe(true)
        expect(isExpenseAccount(AccountNumber.make("6999"))).toBe(true)
        expect(isExpenseAccount(AccountNumber.make("7000"))).toBe(true)
        expect(isExpenseAccount(AccountNumber.make("7999"))).toBe(true)
      })

      it("returns false for non-expense accounts", () => {
        expect(isExpenseAccount(AccountNumber.make("4000"))).toBe(false)
        expect(isExpenseAccount(AccountNumber.make("8000"))).toBe(false)
      })
    })

    describe("isOtherAccount", () => {
      it("returns true for 8xxx accounts", () => {
        expect(isOtherAccount(AccountNumber.make("8000"))).toBe(true)
        expect(isOtherAccount(AccountNumber.make("8500"))).toBe(true)
        expect(isOtherAccount(AccountNumber.make("8999"))).toBe(true)
      })

      it("returns false for non-other accounts", () => {
        expect(isOtherAccount(AccountNumber.make("7000"))).toBe(false)
        expect(isOtherAccount(AccountNumber.make("9000"))).toBe(false)
      })
    })

    describe("isSpecialAccount", () => {
      it("returns true for 9xxx accounts", () => {
        expect(isSpecialAccount(AccountNumber.make("9000"))).toBe(true)
        expect(isSpecialAccount(AccountNumber.make("9500"))).toBe(true)
        expect(isSpecialAccount(AccountNumber.make("9999"))).toBe(true)
      })

      it("returns false for non-special accounts", () => {
        expect(isSpecialAccount(AccountNumber.make("8000"))).toBe(false)
        expect(isSpecialAccount(AccountNumber.make("1000"))).toBe(false)
      })
    })
  })

  describe("balance sheet vs income statement", () => {
    describe("isBalanceSheetAccount", () => {
      it("returns true for Asset, Liability, and Equity accounts (1xxx-3xxx)", () => {
        expect(isBalanceSheetAccount(AccountNumber.make("1000"))).toBe(true)
        expect(isBalanceSheetAccount(AccountNumber.make("2000"))).toBe(true)
        expect(isBalanceSheetAccount(AccountNumber.make("3000"))).toBe(true)
      })

      it("returns false for income statement and other accounts", () => {
        expect(isBalanceSheetAccount(AccountNumber.make("4000"))).toBe(false)
        expect(isBalanceSheetAccount(AccountNumber.make("5000"))).toBe(false)
        expect(isBalanceSheetAccount(AccountNumber.make("8000"))).toBe(false)
        expect(isBalanceSheetAccount(AccountNumber.make("9000"))).toBe(false)
      })
    })

    describe("isIncomeStatementAccount", () => {
      it("returns true for Revenue and Expense accounts (4xxx-7xxx)", () => {
        expect(isIncomeStatementAccount(AccountNumber.make("4000"))).toBe(true)
        expect(isIncomeStatementAccount(AccountNumber.make("5000"))).toBe(true)
        expect(isIncomeStatementAccount(AccountNumber.make("6000"))).toBe(true)
        expect(isIncomeStatementAccount(AccountNumber.make("7000"))).toBe(true)
      })

      it("returns false for balance sheet and other accounts", () => {
        expect(isIncomeStatementAccount(AccountNumber.make("1000"))).toBe(false)
        expect(isIncomeStatementAccount(AccountNumber.make("2000"))).toBe(false)
        expect(isIncomeStatementAccount(AccountNumber.make("3000"))).toBe(false)
        expect(isIncomeStatementAccount(AccountNumber.make("8000"))).toBe(false)
        expect(isIncomeStatementAccount(AccountNumber.make("9000"))).toBe(false)
      })
    })
  })

  describe("normal balance", () => {
    describe("hasNormalDebitBalance", () => {
      it("returns true for Asset and Expense accounts", () => {
        // Assets (1xxx)
        expect(hasNormalDebitBalance(AccountNumber.make("1000"))).toBe(true)
        expect(hasNormalDebitBalance(AccountNumber.make("1999"))).toBe(true)
        // Expenses (5xxx-7xxx)
        expect(hasNormalDebitBalance(AccountNumber.make("5000"))).toBe(true)
        expect(hasNormalDebitBalance(AccountNumber.make("6000"))).toBe(true)
        expect(hasNormalDebitBalance(AccountNumber.make("7000"))).toBe(true)
      })

      it("returns false for Liability, Equity, Revenue accounts", () => {
        expect(hasNormalDebitBalance(AccountNumber.make("2000"))).toBe(false)
        expect(hasNormalDebitBalance(AccountNumber.make("3000"))).toBe(false)
        expect(hasNormalDebitBalance(AccountNumber.make("4000"))).toBe(false)
      })

      it("returns false for Other and Special accounts", () => {
        expect(hasNormalDebitBalance(AccountNumber.make("8000"))).toBe(false)
        expect(hasNormalDebitBalance(AccountNumber.make("9000"))).toBe(false)
      })
    })

    describe("hasNormalCreditBalance", () => {
      it("returns true for Liability, Equity, Revenue accounts", () => {
        // Liabilities (2xxx)
        expect(hasNormalCreditBalance(AccountNumber.make("2000"))).toBe(true)
        expect(hasNormalCreditBalance(AccountNumber.make("2999"))).toBe(true)
        // Equity (3xxx)
        expect(hasNormalCreditBalance(AccountNumber.make("3000"))).toBe(true)
        expect(hasNormalCreditBalance(AccountNumber.make("3999"))).toBe(true)
        // Revenue (4xxx)
        expect(hasNormalCreditBalance(AccountNumber.make("4000"))).toBe(true)
        expect(hasNormalCreditBalance(AccountNumber.make("4999"))).toBe(true)
      })

      it("returns false for Asset and Expense accounts", () => {
        expect(hasNormalCreditBalance(AccountNumber.make("1000"))).toBe(false)
        expect(hasNormalCreditBalance(AccountNumber.make("5000"))).toBe(false)
        expect(hasNormalCreditBalance(AccountNumber.make("6000"))).toBe(false)
        expect(hasNormalCreditBalance(AccountNumber.make("7000"))).toBe(false)
      })

      it("returns false for Other and Special accounts", () => {
        expect(hasNormalCreditBalance(AccountNumber.make("8000"))).toBe(false)
        expect(hasNormalCreditBalance(AccountNumber.make("9000"))).toBe(false)
      })
    })
  })

  describe("getSubcategory", () => {
    it("returns Current Assets for 1000-1499", () => {
      expect(getSubcategory(AccountNumber.make("1000"))).toBe("Current Assets")
      expect(getSubcategory(AccountNumber.make("1250"))).toBe("Current Assets")
      expect(getSubcategory(AccountNumber.make("1499"))).toBe("Current Assets")
    })

    it("returns Non-Current Assets for 1500-1999", () => {
      expect(getSubcategory(AccountNumber.make("1500"))).toBe("Non-Current Assets")
      expect(getSubcategory(AccountNumber.make("1750"))).toBe("Non-Current Assets")
      expect(getSubcategory(AccountNumber.make("1999"))).toBe("Non-Current Assets")
    })

    it("returns Current Liabilities for 2000-2499", () => {
      expect(getSubcategory(AccountNumber.make("2000"))).toBe("Current Liabilities")
      expect(getSubcategory(AccountNumber.make("2250"))).toBe("Current Liabilities")
      expect(getSubcategory(AccountNumber.make("2499"))).toBe("Current Liabilities")
    })

    it("returns Non-Current Liabilities for 2500-2999", () => {
      expect(getSubcategory(AccountNumber.make("2500"))).toBe("Non-Current Liabilities")
      expect(getSubcategory(AccountNumber.make("2750"))).toBe("Non-Current Liabilities")
      expect(getSubcategory(AccountNumber.make("2999"))).toBe("Non-Current Liabilities")
    })

    it("returns Shareholders' Equity for 3000-3999", () => {
      expect(getSubcategory(AccountNumber.make("3000"))).toBe("Shareholders' Equity")
      expect(getSubcategory(AccountNumber.make("3500"))).toBe("Shareholders' Equity")
      expect(getSubcategory(AccountNumber.make("3999"))).toBe("Shareholders' Equity")
    })

    it("returns Operating Revenue for 4000-4999", () => {
      expect(getSubcategory(AccountNumber.make("4000"))).toBe("Operating Revenue")
      expect(getSubcategory(AccountNumber.make("4500"))).toBe("Operating Revenue")
      expect(getSubcategory(AccountNumber.make("4999"))).toBe("Operating Revenue")
    })

    it("returns Cost of Sales for 5000-5999", () => {
      expect(getSubcategory(AccountNumber.make("5000"))).toBe("Cost of Sales")
      expect(getSubcategory(AccountNumber.make("5500"))).toBe("Cost of Sales")
      expect(getSubcategory(AccountNumber.make("5999"))).toBe("Cost of Sales")
    })

    it("returns Operating Expenses for 6000-7999", () => {
      expect(getSubcategory(AccountNumber.make("6000"))).toBe("Operating Expenses")
      expect(getSubcategory(AccountNumber.make("6999"))).toBe("Operating Expenses")
      expect(getSubcategory(AccountNumber.make("7000"))).toBe("Operating Expenses")
      expect(getSubcategory(AccountNumber.make("7999"))).toBe("Operating Expenses")
    })

    it("returns Other Income/Expense for 8000-8999", () => {
      expect(getSubcategory(AccountNumber.make("8000"))).toBe("Other Income/Expense")
      expect(getSubcategory(AccountNumber.make("8500"))).toBe("Other Income/Expense")
      expect(getSubcategory(AccountNumber.make("8999"))).toBe("Other Income/Expense")
    })

    it("returns Special for 9000-9999", () => {
      expect(getSubcategory(AccountNumber.make("9000"))).toBe("Special")
      expect(getSubcategory(AccountNumber.make("9500"))).toBe("Special")
      expect(getSubcategory(AccountNumber.make("9999"))).toBe("Special")
    })
  })

  describe("boundary values", () => {
    it("handles exact boundary values correctly", () => {
      // Asset boundaries
      expect(isAssetAccount(AccountNumber.make("1000"))).toBe(true)
      expect(isAssetAccount(AccountNumber.make("1999"))).toBe(true)

      // Liability boundaries
      expect(isLiabilityAccount(AccountNumber.make("2000"))).toBe(true)
      expect(isLiabilityAccount(AccountNumber.make("2999"))).toBe(true)

      // Equity boundaries
      expect(isEquityAccount(AccountNumber.make("3000"))).toBe(true)
      expect(isEquityAccount(AccountNumber.make("3999"))).toBe(true)

      // Revenue boundaries
      expect(isRevenueAccount(AccountNumber.make("4000"))).toBe(true)
      expect(isRevenueAccount(AccountNumber.make("4999"))).toBe(true)

      // Expense boundaries
      expect(isExpenseAccount(AccountNumber.make("5000"))).toBe(true)
      expect(isExpenseAccount(AccountNumber.make("7999"))).toBe(true)

      // Other boundaries
      expect(isOtherAccount(AccountNumber.make("8000"))).toBe(true)
      expect(isOtherAccount(AccountNumber.make("8999"))).toBe(true)

      // Special boundaries
      expect(isSpecialAccount(AccountNumber.make("9000"))).toBe(true)
      expect(isSpecialAccount(AccountNumber.make("9999"))).toBe(true)
    })
  })
})
