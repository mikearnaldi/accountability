import { describe, it, expect } from "@effect/vitest"
import { Effect, Either, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  AccountNumberRangeError,
  isAccountNumberRangeError,
  NormalBalanceError,
  isNormalBalanceError,
  IntercompanyPartnerMissingError,
  isIntercompanyPartnerMissingError,
  UnexpectedIntercompanyPartnerError,
  isUnexpectedIntercompanyPartnerError,
  CashFlowCategoryOnIncomeStatementError,
  isCashFlowCategoryOnIncomeStatementError,
  validateAccountNumberRange,
  validateNormalBalance,
  validateIntercompanyConfiguration,
  validateCashFlowCategory,
  validateAccount,
  validateAccounts,
  isValidAccount,
  getValidationErrors
} from "../../src/accounting/AccountValidation.ts"
import type {
  AccountType,
  AccountCategory,
  NormalBalance,
  CashFlowCategory
} from "../../src/accounting/Account.ts";
import {
  Account,
  AccountId
} from "../../src/accounting/Account.ts"
import { AccountNumber } from "../../src/accounting/AccountNumber.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

/**
 * Helper functions for creating test accounts
 */
const accountUUID = "550e8400-e29b-41d4-a716-446655440000"
const companyUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const partnerCompanyUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c8"

const createBaseAccount = (overrides: Partial<{
  id: string
  accountNumber: string
  accountType: AccountType
  accountCategory: AccountCategory
  normalBalance: NormalBalance
  isIntercompany: boolean
  intercompanyPartnerId: string | null
  cashFlowCategory: CashFlowCategory | null
}>): Account => {
  return Account.make({
    id: AccountId.make(overrides.id ?? accountUUID),
    companyId: CompanyId.make(companyUUID),
    accountNumber: AccountNumber.make(overrides.accountNumber ?? "1000"),
    name: "Test Account",
    description: Option.none(),
    accountType: overrides.accountType ?? "Asset",
    accountCategory: overrides.accountCategory ?? "CurrentAsset",
    normalBalance: overrides.normalBalance ?? "Debit",
    parentAccountId: Option.none(),
    hierarchyLevel: 1,
    isPostable: true,
    isCashFlowRelevant: overrides.cashFlowCategory !== null,
    cashFlowCategory: overrides.cashFlowCategory !== undefined && overrides.cashFlowCategory !== null
      ? Option.some(overrides.cashFlowCategory)
      : Option.none(),
    isIntercompany: overrides.isIntercompany ?? false,
    intercompanyPartnerId: overrides.intercompanyPartnerId
      ? Option.some(CompanyId.make(overrides.intercompanyPartnerId))
      : Option.none(),
    currencyRestriction: Option.none(),
    isActive: true,
    createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
    deactivatedAt: Option.none()
  })
}

describe("AccountNumberRangeError", () => {
  describe("creation", () => {
    it("creates error with expected type", () => {
      const error = new AccountNumberRangeError({
        accountId: AccountId.make(accountUUID),
        accountNumber: AccountNumber.make("2000"),
        declaredType: "Asset",
        expectedType: Option.some("Liability")
      })

      expect(error.accountId).toBe(accountUUID)
      expect(error.accountNumber).toBe("2000")
      expect(error.declaredType).toBe("Asset")
      expect(Option.getOrNull(error.expectedType)).toBe("Liability")
      expect(error._tag).toBe("AccountNumberRangeError")
    })

    it("creates error without expected type (special range)", () => {
      const error = new AccountNumberRangeError({
        accountId: AccountId.make(accountUUID),
        accountNumber: AccountNumber.make("9000"),
        declaredType: "Asset",
        expectedType: Option.none()
      })

      expect(Option.isNone(error.expectedType)).toBe(true)
    })

    it("generates correct message when expected type is present", () => {
      const error = new AccountNumberRangeError({
        accountId: AccountId.make(accountUUID),
        accountNumber: AccountNumber.make("2000"),
        declaredType: "Asset",
        expectedType: Option.some("Liability")
      })

      expect(error.message).toContain("2000")
      expect(error.message).toContain("Asset")
      expect(error.message).toContain("Liability")
    })

    it("generates correct message for special range", () => {
      const error = new AccountNumberRangeError({
        accountId: AccountId.make(accountUUID),
        accountNumber: AccountNumber.make("8000"),
        declaredType: "Asset",
        expectedType: Option.none()
      })

      expect(error.message).toContain("special range")
      expect(error.message).toContain("8xxx or 9xxx")
    })
  })

  describe("type guard", () => {
    it("isAccountNumberRangeError returns true for valid error", () => {
      const error = new AccountNumberRangeError({
        accountId: AccountId.make(accountUUID),
        accountNumber: AccountNumber.make("2000"),
        declaredType: "Asset",
        expectedType: Option.some("Liability")
      })
      expect(isAccountNumberRangeError(error)).toBe(true)
    })

    it("isAccountNumberRangeError returns false for other errors", () => {
      const error = new NormalBalanceError({
        accountId: AccountId.make(accountUUID),
        accountType: "Asset",
        declaredBalance: "Credit",
        expectedBalance: "Debit"
      })
      expect(isAccountNumberRangeError(error)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes AccountNumberRangeError with expected type", () =>
      Effect.gen(function* () {
        const original = new AccountNumberRangeError({
          accountId: AccountId.make(accountUUID),
          accountNumber: AccountNumber.make("2000"),
          declaredType: "Asset",
          expectedType: Option.some("Liability")
        })
        const encoded = yield* Schema.encode(AccountNumberRangeError)(original)
        const decoded = yield* Schema.decodeUnknown(AccountNumberRangeError)(encoded)

        expect(decoded._tag).toBe("AccountNumberRangeError")
        expect(decoded.accountId).toBe(accountUUID)
        expect(Option.getOrNull(decoded.expectedType)).toBe("Liability")
      })
    )

    it.effect("encodes and decodes AccountNumberRangeError without expected type", () =>
      Effect.gen(function* () {
        const original = new AccountNumberRangeError({
          accountId: AccountId.make(accountUUID),
          accountNumber: AccountNumber.make("9000"),
          declaredType: "Asset",
          expectedType: Option.none()
        })
        const encoded = yield* Schema.encode(AccountNumberRangeError)(original)
        const decoded = yield* Schema.decodeUnknown(AccountNumberRangeError)(encoded)

        expect(decoded._tag).toBe("AccountNumberRangeError")
        expect(Option.isNone(decoded.expectedType)).toBe(true)
      })
    )
  })
})

describe("NormalBalanceError", () => {
  describe("creation", () => {
    it("creates error with correct properties", () => {
      const error = new NormalBalanceError({
        accountId: AccountId.make(accountUUID),
        accountType: "Asset",
        declaredBalance: "Credit",
        expectedBalance: "Debit"
      })

      expect(error.accountId).toBe(accountUUID)
      expect(error.accountType).toBe("Asset")
      expect(error.declaredBalance).toBe("Credit")
      expect(error.expectedBalance).toBe("Debit")
      expect(error._tag).toBe("NormalBalanceError")
    })

    it("generates correct message", () => {
      const error = new NormalBalanceError({
        accountId: AccountId.make(accountUUID),
        accountType: "Asset",
        declaredBalance: "Credit",
        expectedBalance: "Debit"
      })

      expect(error.message).toContain("Asset")
      expect(error.message).toContain("Debit")
      expect(error.message).toContain("Credit")
    })
  })

  describe("type guard", () => {
    it("isNormalBalanceError returns true for valid error", () => {
      const error = new NormalBalanceError({
        accountId: AccountId.make(accountUUID),
        accountType: "Asset",
        declaredBalance: "Credit",
        expectedBalance: "Debit"
      })
      expect(isNormalBalanceError(error)).toBe(true)
    })

    it("isNormalBalanceError returns false for other errors", () => {
      const error = new IntercompanyPartnerMissingError({
        accountId: AccountId.make(accountUUID)
      })
      expect(isNormalBalanceError(error)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes NormalBalanceError", () =>
      Effect.gen(function* () {
        const original = new NormalBalanceError({
          accountId: AccountId.make(accountUUID),
          accountType: "Liability",
          declaredBalance: "Debit",
          expectedBalance: "Credit"
        })
        const encoded = yield* Schema.encode(NormalBalanceError)(original)
        const decoded = yield* Schema.decodeUnknown(NormalBalanceError)(encoded)

        expect(decoded._tag).toBe("NormalBalanceError")
        expect(decoded.accountType).toBe("Liability")
        expect(decoded.declaredBalance).toBe("Debit")
        expect(decoded.expectedBalance).toBe("Credit")
      })
    )
  })
})

describe("IntercompanyPartnerMissingError", () => {
  describe("creation", () => {
    it("creates error with correct properties", () => {
      const error = new IntercompanyPartnerMissingError({
        accountId: AccountId.make(accountUUID)
      })

      expect(error.accountId).toBe(accountUUID)
      expect(error._tag).toBe("IntercompanyPartnerMissingError")
    })

    it("generates correct message", () => {
      const error = new IntercompanyPartnerMissingError({
        accountId: AccountId.make(accountUUID)
      })

      expect(error.message).toContain("Intercompany account")
      expect(error.message).toContain("partner company")
    })
  })

  describe("type guard", () => {
    it("isIntercompanyPartnerMissingError returns true for valid error", () => {
      const error = new IntercompanyPartnerMissingError({
        accountId: AccountId.make(accountUUID)
      })
      expect(isIntercompanyPartnerMissingError(error)).toBe(true)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes IntercompanyPartnerMissingError", () =>
      Effect.gen(function* () {
        const original = new IntercompanyPartnerMissingError({
          accountId: AccountId.make(accountUUID)
        })
        const encoded = yield* Schema.encode(IntercompanyPartnerMissingError)(original)
        const decoded = yield* Schema.decodeUnknown(IntercompanyPartnerMissingError)(encoded)

        expect(decoded._tag).toBe("IntercompanyPartnerMissingError")
        expect(decoded.accountId).toBe(accountUUID)
      })
    )
  })
})

describe("UnexpectedIntercompanyPartnerError", () => {
  describe("creation", () => {
    it("creates error with correct properties", () => {
      const error = new UnexpectedIntercompanyPartnerError({
        accountId: AccountId.make(accountUUID),
        partnerId: CompanyId.make(partnerCompanyUUID)
      })

      expect(error.accountId).toBe(accountUUID)
      expect(error.partnerId).toBe(partnerCompanyUUID)
      expect(error._tag).toBe("UnexpectedIntercompanyPartnerError")
    })

    it("generates correct message", () => {
      const error = new UnexpectedIntercompanyPartnerError({
        accountId: AccountId.make(accountUUID),
        partnerId: CompanyId.make(partnerCompanyUUID)
      })

      expect(error.message).toContain("not an intercompany account")
      expect(error.message).toContain("partner company")
    })
  })

  describe("type guard", () => {
    it("isUnexpectedIntercompanyPartnerError returns true for valid error", () => {
      const error = new UnexpectedIntercompanyPartnerError({
        accountId: AccountId.make(accountUUID),
        partnerId: CompanyId.make(partnerCompanyUUID)
      })
      expect(isUnexpectedIntercompanyPartnerError(error)).toBe(true)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes UnexpectedIntercompanyPartnerError", () =>
      Effect.gen(function* () {
        const original = new UnexpectedIntercompanyPartnerError({
          accountId: AccountId.make(accountUUID),
          partnerId: CompanyId.make(partnerCompanyUUID)
        })
        const encoded = yield* Schema.encode(UnexpectedIntercompanyPartnerError)(original)
        const decoded = yield* Schema.decodeUnknown(UnexpectedIntercompanyPartnerError)(encoded)

        expect(decoded._tag).toBe("UnexpectedIntercompanyPartnerError")
        expect(decoded.partnerId).toBe(partnerCompanyUUID)
      })
    )
  })
})

describe("CashFlowCategoryOnIncomeStatementError", () => {
  describe("creation", () => {
    it("creates error with correct properties", () => {
      const error = new CashFlowCategoryOnIncomeStatementError({
        accountId: AccountId.make(accountUUID),
        accountType: "Revenue",
        cashFlowCategory: "Operating"
      })

      expect(error.accountId).toBe(accountUUID)
      expect(error.accountType).toBe("Revenue")
      expect(error.cashFlowCategory).toBe("Operating")
      expect(error._tag).toBe("CashFlowCategoryOnIncomeStatementError")
    })

    it("generates correct message", () => {
      const error = new CashFlowCategoryOnIncomeStatementError({
        accountId: AccountId.make(accountUUID),
        accountType: "Expense",
        cashFlowCategory: "Investing"
      })

      expect(error.message).toContain("income statement account")
      expect(error.message).toContain("Expense")
      expect(error.message).toContain("Investing")
    })
  })

  describe("type guard", () => {
    it("isCashFlowCategoryOnIncomeStatementError returns true for valid error", () => {
      const error = new CashFlowCategoryOnIncomeStatementError({
        accountId: AccountId.make(accountUUID),
        accountType: "Revenue",
        cashFlowCategory: "Operating"
      })
      expect(isCashFlowCategoryOnIncomeStatementError(error)).toBe(true)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes CashFlowCategoryOnIncomeStatementError", () =>
      Effect.gen(function* () {
        const original = new CashFlowCategoryOnIncomeStatementError({
          accountId: AccountId.make(accountUUID),
          accountType: "Expense",
          cashFlowCategory: "Financing"
        })
        const encoded = yield* Schema.encode(CashFlowCategoryOnIncomeStatementError)(original)
        const decoded = yield* Schema.decodeUnknown(CashFlowCategoryOnIncomeStatementError)(encoded)

        expect(decoded._tag).toBe("CashFlowCategoryOnIncomeStatementError")
        expect(decoded.accountType).toBe("Expense")
        expect(decoded.cashFlowCategory).toBe("Financing")
      })
    )
  })
})

describe("validateAccountNumberRange", () => {
  describe("Assets (1xxx)", () => {
    it("accepts Asset account with 1xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Asset account with 1499 number", () => {
      const account = createBaseAccount({
        accountNumber: "1499",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Asset account with 1500 number", () => {
      const account = createBaseAccount({
        accountNumber: "1500",
        accountType: "Asset",
        accountCategory: "NonCurrentAsset",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Asset account with 1999 number", () => {
      const account = createBaseAccount({
        accountNumber: "1999",
        accountType: "Asset",
        accountCategory: "NonCurrentAsset",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Liability account with 1xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("AccountNumberRangeError")
        expect(result.left.declaredType).toBe("Liability")
        expect(Option.getOrNull(result.left.expectedType)).toBe("Asset")
      }
    })
  })

  describe("Liabilities (2xxx)", () => {
    it("accepts Liability account with 2xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "2000",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Liability account with 2500 number", () => {
      const account = createBaseAccount({
        accountNumber: "2500",
        accountType: "Liability",
        accountCategory: "NonCurrentLiability",
        normalBalance: "Credit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Asset account with 2xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "2000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(Option.getOrNull(result.left.expectedType)).toBe("Liability")
      }
    })
  })

  describe("Equity (3xxx)", () => {
    it("accepts Equity account with 3xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "3000",
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: "Credit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Revenue account with 3xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "3000",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(Option.getOrNull(result.left.expectedType)).toBe("Equity")
      }
    })
  })

  describe("Revenue (4xxx)", () => {
    it("accepts Revenue account with 4xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "4000",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Expense account with 4xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "4000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(Option.getOrNull(result.left.expectedType)).toBe("Revenue")
      }
    })
  })

  describe("Expenses (5xxx-7xxx)", () => {
    it("accepts Expense account with 5xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "5000",
        accountType: "Expense",
        accountCategory: "CostOfGoodsSold",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Expense account with 6xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "6000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Expense account with 7xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "7000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Asset account with 5xxx number", () => {
      const account = createBaseAccount({
        accountNumber: "5000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      })
      const result = validateAccountNumberRange(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(Option.getOrNull(result.left.expectedType)).toBe("Expense")
      }
    })
  })

  describe("Special ranges (8xxx, 9xxx)", () => {
    it("accepts any account type with 8xxx number", () => {
      const assetWith8000 = createBaseAccount({
        accountNumber: "8000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      })
      expect(Either.isRight(validateAccountNumberRange(assetWith8000))).toBe(true)

      const revenueWith8000 = createBaseAccount({
        accountNumber: "8500",
        accountType: "Revenue",
        accountCategory: "OtherRevenue",
        normalBalance: "Credit"
      })
      expect(Either.isRight(validateAccountNumberRange(revenueWith8000))).toBe(true)

      const expenseWith8000 = createBaseAccount({
        accountNumber: "8999",
        accountType: "Expense",
        accountCategory: "OtherExpense",
        normalBalance: "Debit"
      })
      expect(Either.isRight(validateAccountNumberRange(expenseWith8000))).toBe(true)
    })

    it("accepts any account type with 9xxx number", () => {
      const assetWith9000 = createBaseAccount({
        accountNumber: "9000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      })
      expect(Either.isRight(validateAccountNumberRange(assetWith9000))).toBe(true)

      const liabilityWith9000 = createBaseAccount({
        accountNumber: "9500",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit"
      })
      expect(Either.isRight(validateAccountNumberRange(liabilityWith9000))).toBe(true)

      const equityWith9000 = createBaseAccount({
        accountNumber: "9999",
        accountType: "Equity",
        accountCategory: "RetainedEarnings",
        normalBalance: "Credit"
      })
      expect(Either.isRight(validateAccountNumberRange(equityWith9000))).toBe(true)
    })
  })
})

describe("validateNormalBalance", () => {
  describe("Assets should have Debit balance", () => {
    it("accepts Asset with Debit balance", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Asset with Credit balance", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Credit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("NormalBalanceError")
        expect(result.left.accountType).toBe("Asset")
        expect(result.left.declaredBalance).toBe("Credit")
        expect(result.left.expectedBalance).toBe("Debit")
      }
    })
  })

  describe("Liabilities should have Credit balance", () => {
    it("accepts Liability with Credit balance", () => {
      const account = createBaseAccount({
        accountNumber: "2000",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Liability with Debit balance", () => {
      const account = createBaseAccount({
        accountNumber: "2000",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Debit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.expectedBalance).toBe("Credit")
      }
    })
  })

  describe("Equity should have Credit balance", () => {
    it("accepts Equity with Credit balance", () => {
      const account = createBaseAccount({
        accountNumber: "3000",
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: "Credit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Equity with Debit balance", () => {
      const account = createBaseAccount({
        accountNumber: "3000",
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: "Debit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.expectedBalance).toBe("Credit")
      }
    })
  })

  describe("Revenue should have Credit balance", () => {
    it("accepts Revenue with Credit balance", () => {
      const account = createBaseAccount({
        accountNumber: "4000",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Revenue with Debit balance", () => {
      const account = createBaseAccount({
        accountNumber: "4000",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Debit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.expectedBalance).toBe("Credit")
      }
    })
  })

  describe("Expenses should have Debit balance", () => {
    it("accepts Expense with Debit balance", () => {
      const account = createBaseAccount({
        accountNumber: "6000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects Expense with Credit balance", () => {
      const account = createBaseAccount({
        accountNumber: "6000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Credit"
      })
      const result = validateNormalBalance(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.expectedBalance).toBe("Debit")
      }
    })
  })
})

describe("validateIntercompanyConfiguration", () => {
  describe("intercompany accounts must have partner", () => {
    it("accepts intercompany account with partner company set", () => {
      const account = createBaseAccount({
        accountNumber: "9100",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        isIntercompany: true,
        intercompanyPartnerId: partnerCompanyUUID
      })
      const result = validateIntercompanyConfiguration(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects intercompany account without partner company", () => {
      const account = createBaseAccount({
        accountNumber: "9100",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        isIntercompany: true,
        intercompanyPartnerId: null
      })
      const result = validateIntercompanyConfiguration(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("IntercompanyPartnerMissingError")
      }
    })
  })

  describe("non-intercompany accounts should not have partner", () => {
    it("accepts non-intercompany account without partner company", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        isIntercompany: false,
        intercompanyPartnerId: null
      })
      const result = validateIntercompanyConfiguration(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("rejects non-intercompany account with partner company set", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        isIntercompany: false,
        intercompanyPartnerId: partnerCompanyUUID
      })
      const result = validateIntercompanyConfiguration(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result) && isUnexpectedIntercompanyPartnerError(result.left)) {
        expect(result.left.partnerId).toBe(partnerCompanyUUID)
      }
    })
  })
})

describe("validateCashFlowCategory", () => {
  describe("balance sheet accounts can have cash flow category", () => {
    it("accepts Asset with Operating cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        cashFlowCategory: "Operating"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Asset with Investing cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "1500",
        accountType: "Asset",
        accountCategory: "FixedAsset",
        normalBalance: "Debit",
        cashFlowCategory: "Investing"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Liability with Financing cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "2500",
        accountType: "Liability",
        accountCategory: "NonCurrentLiability",
        normalBalance: "Credit",
        cashFlowCategory: "Financing"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Equity with Financing cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "3000",
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: "Credit",
        cashFlowCategory: "Financing"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Asset with NonCash cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "1500",
        accountType: "Asset",
        accountCategory: "FixedAsset",
        normalBalance: "Debit",
        cashFlowCategory: "NonCash"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe("income statement accounts should not have cash flow category", () => {
    it("rejects Revenue with Operating cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "4000",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit",
        cashFlowCategory: "Operating"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left._tag).toBe("CashFlowCategoryOnIncomeStatementError")
        expect(result.left.accountType).toBe("Revenue")
        expect(result.left.cashFlowCategory).toBe("Operating")
      }
    })

    it("rejects Expense with Operating cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "6000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit",
        cashFlowCategory: "Operating"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.accountType).toBe("Expense")
      }
    })

    it("rejects Expense with Investing cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "6000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit",
        cashFlowCategory: "Investing"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isLeft(result)).toBe(true)
    })

    it("rejects Revenue with Financing cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "4500",
        accountType: "Revenue",
        accountCategory: "OtherRevenue",
        normalBalance: "Credit",
        cashFlowCategory: "Financing"
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe("accounts without cash flow category pass validation", () => {
    it("accepts Revenue without cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "4000",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit",
        cashFlowCategory: null
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Expense without cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "6000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit",
        cashFlowCategory: null
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("accepts Asset without cash flow category", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        cashFlowCategory: null
      })
      const result = validateCashFlowCategory(account)
      expect(Either.isRight(result)).toBe(true)
    })
  })
})

describe("validateAccount (combined validation)", () => {
  describe("valid accounts pass all validations", () => {
    it("validates correctly configured Asset account", () => {
      const account = createBaseAccount({
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        cashFlowCategory: "Operating"
      })
      const result = validateAccount(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("validates correctly configured Liability account", () => {
      const account = createBaseAccount({
        accountNumber: "2000",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit",
        cashFlowCategory: "Operating"
      })
      const result = validateAccount(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("validates correctly configured Equity account", () => {
      const account = createBaseAccount({
        accountNumber: "3000",
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: "Credit",
        cashFlowCategory: "Financing"
      })
      const result = validateAccount(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("validates correctly configured Revenue account", () => {
      const account = createBaseAccount({
        accountNumber: "4000",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit",
        cashFlowCategory: null
      })
      const result = validateAccount(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("validates correctly configured Expense account", () => {
      const account = createBaseAccount({
        accountNumber: "6000",
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit",
        cashFlowCategory: null
      })
      const result = validateAccount(account)
      expect(Either.isRight(result)).toBe(true)
    })

    it("validates correctly configured intercompany account", () => {
      const account = createBaseAccount({
        accountNumber: "9100",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        isIntercompany: true,
        intercompanyPartnerId: partnerCompanyUUID,
        cashFlowCategory: "Operating"
      })
      const result = validateAccount(account)
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe("invalid accounts return all errors", () => {
    it("returns single error for one validation failure", () => {
      const account = createBaseAccount({
        accountNumber: "2000", // Liability range
        accountType: "Asset", // Wrong type for 2xxx
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        cashFlowCategory: null
      })
      const result = validateAccount(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toHaveLength(1)
        expect(result.left[0]._tag).toBe("AccountNumberRangeError")
      }
    })

    it("returns multiple errors for multiple validation failures", () => {
      const account = createBaseAccount({
        accountNumber: "2000", // Liability range
        accountType: "Asset", // Wrong type for 2xxx
        accountCategory: "CurrentAsset",
        normalBalance: "Credit", // Wrong balance for Asset
        isIntercompany: true, // Intercompany without partner
        intercompanyPartnerId: null,
        cashFlowCategory: null
      })
      const result = validateAccount(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left.length).toBeGreaterThanOrEqual(3)
        const tags = result.left.map((e) => e._tag)
        expect(tags).toContain("AccountNumberRangeError")
        expect(tags).toContain("NormalBalanceError")
        expect(tags).toContain("IntercompanyPartnerMissingError")
      }
    })

    it("returns four errors when all validations fail", () => {
      const account = createBaseAccount({
        accountNumber: "2000", // Liability range
        accountType: "Revenue", // Wrong type for 2xxx (should be Liability)
        accountCategory: "OperatingRevenue",
        normalBalance: "Debit", // Wrong balance for Revenue (should be Credit)
        isIntercompany: true, // Intercompany without partner
        intercompanyPartnerId: null,
        cashFlowCategory: "Operating" // Cash flow on income statement account
      })
      const result = validateAccount(account)
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toHaveLength(4)
        const tags = result.left.map((e) => e._tag)
        expect(tags).toContain("AccountNumberRangeError")
        expect(tags).toContain("NormalBalanceError")
        expect(tags).toContain("IntercompanyPartnerMissingError")
        expect(tags).toContain("CashFlowCategoryOnIncomeStatementError")
      }
    })
  })
})

describe("validateAccounts (batch validation)", () => {
  it("returns all valid accounts when all pass", () => {
    const accounts = [
      createBaseAccount({
        id: "550e8400-e29b-41d4-a716-446655440001",
        accountNumber: "1000",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      }),
      createBaseAccount({
        id: "550e8400-e29b-41d4-a716-446655440002",
        accountNumber: "2000",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit"
      }),
      createBaseAccount({
        id: "550e8400-e29b-41d4-a716-446655440003",
        accountNumber: "3000",
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: "Credit"
      })
    ]
    const result = validateAccounts(accounts)
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right).toHaveLength(3)
    }
  })

  it("returns errors from all invalid accounts", () => {
    const accounts = [
      createBaseAccount({
        id: "550e8400-e29b-41d4-a716-446655440001",
        accountNumber: "2000", // Wrong - should be Liability
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit"
      }),
      createBaseAccount({
        id: "550e8400-e29b-41d4-a716-446655440002",
        accountNumber: "2000",
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit"
      }),
      createBaseAccount({
        id: "550e8400-e29b-41d4-a716-446655440003",
        accountNumber: "3000", // Wrong - should be Equity
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit"
      })
    ]
    const result = validateAccounts(accounts)
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      // Two accounts have errors
      expect(result.left.length).toBeGreaterThanOrEqual(2)
    }
  })

  it("returns empty array for empty input", () => {
    const result = validateAccounts([])
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right).toHaveLength(0)
    }
  })
})

describe("isValidAccount", () => {
  it("returns true for valid account", () => {
    const account = createBaseAccount({
      accountNumber: "1000",
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit"
    })
    expect(isValidAccount(account)).toBe(true)
  })

  it("returns false for invalid account", () => {
    const account = createBaseAccount({
      accountNumber: "2000",
      accountType: "Asset", // Wrong type for 2xxx
      accountCategory: "CurrentAsset",
      normalBalance: "Debit"
    })
    expect(isValidAccount(account)).toBe(false)
  })
})

describe("getValidationErrors", () => {
  it("returns empty array for valid account", () => {
    const account = createBaseAccount({
      accountNumber: "1000",
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit"
    })
    const errors = getValidationErrors(account)
    expect(errors).toHaveLength(0)
  })

  it("returns array of errors for invalid account", () => {
    const account = createBaseAccount({
      accountNumber: "2000",
      accountType: "Asset", // Wrong type for 2xxx
      accountCategory: "CurrentAsset",
      normalBalance: "Credit", // Wrong balance for Asset
      cashFlowCategory: null
    })
    const errors = getValidationErrors(account)
    expect(errors.length).toBeGreaterThanOrEqual(2)
    expect(errors.some((e) => e._tag === "AccountNumberRangeError")).toBe(true)
    expect(errors.some((e) => e._tag === "NormalBalanceError")).toBe(true)
  })
})

describe("edge cases", () => {
  describe("all account types with their number ranges", () => {
    it.effect("validates complete set of correctly configured accounts", () =>
      Effect.gen(function* () {
        const accounts = [
          // Assets (1xxx)
          createBaseAccount({ accountNumber: "1000", accountType: "Asset", accountCategory: "CurrentAsset", normalBalance: "Debit" }),
          createBaseAccount({ accountNumber: "1500", accountType: "Asset", accountCategory: "NonCurrentAsset", normalBalance: "Debit" }),
          // Liabilities (2xxx)
          createBaseAccount({ accountNumber: "2000", accountType: "Liability", accountCategory: "CurrentLiability", normalBalance: "Credit" }),
          createBaseAccount({ accountNumber: "2500", accountType: "Liability", accountCategory: "NonCurrentLiability", normalBalance: "Credit" }),
          // Equity (3xxx)
          createBaseAccount({ accountNumber: "3000", accountType: "Equity", accountCategory: "ContributedCapital", normalBalance: "Credit" }),
          createBaseAccount({ accountNumber: "3500", accountType: "Equity", accountCategory: "RetainedEarnings", normalBalance: "Credit" }),
          // Revenue (4xxx)
          createBaseAccount({ accountNumber: "4000", accountType: "Revenue", accountCategory: "OperatingRevenue", normalBalance: "Credit" }),
          createBaseAccount({ accountNumber: "4500", accountType: "Revenue", accountCategory: "OtherRevenue", normalBalance: "Credit" }),
          // Expenses (5xxx-7xxx)
          createBaseAccount({ accountNumber: "5000", accountType: "Expense", accountCategory: "CostOfGoodsSold", normalBalance: "Debit" }),
          createBaseAccount({ accountNumber: "6000", accountType: "Expense", accountCategory: "OperatingExpense", normalBalance: "Debit" }),
          createBaseAccount({ accountNumber: "7000", accountType: "Expense", accountCategory: "OtherExpense", normalBalance: "Debit" }),
          // Special ranges (8xxx, 9xxx) - any type allowed
          createBaseAccount({ accountNumber: "8000", accountType: "Revenue", accountCategory: "OtherRevenue", normalBalance: "Credit" }),
          createBaseAccount({ accountNumber: "9000", accountType: "Asset", accountCategory: "CurrentAsset", normalBalance: "Debit" })
        ]

        const result = validateAccounts(accounts)
        expect(Either.isRight(result)).toBe(true)
      })
    )
  })

  describe("boundary numbers", () => {
    it("validates 1000 (start of Asset range)", () => {
      const account = createBaseAccount({ accountNumber: "1000", accountType: "Asset", accountCategory: "CurrentAsset", normalBalance: "Debit" })
      expect(isValidAccount(account)).toBe(true)
    })

    it("validates 1999 (end of Asset range)", () => {
      const account = createBaseAccount({ accountNumber: "1999", accountType: "Asset", accountCategory: "NonCurrentAsset", normalBalance: "Debit" })
      expect(isValidAccount(account)).toBe(true)
    })

    it("validates 2000 (start of Liability range)", () => {
      const account = createBaseAccount({ accountNumber: "2000", accountType: "Liability", accountCategory: "CurrentLiability", normalBalance: "Credit" })
      expect(isValidAccount(account)).toBe(true)
    })

    it("validates 7999 (end of Expense range)", () => {
      const account = createBaseAccount({ accountNumber: "7999", accountType: "Expense", accountCategory: "OperatingExpense", normalBalance: "Debit" })
      expect(isValidAccount(account)).toBe(true)
    })

    it("validates 8000 (start of Other range)", () => {
      const account = createBaseAccount({ accountNumber: "8000", accountType: "Asset", accountCategory: "CurrentAsset", normalBalance: "Debit" })
      expect(isValidAccount(account)).toBe(true)
    })

    it("validates 9999 (end of Special range)", () => {
      const account = createBaseAccount({ accountNumber: "9999", accountType: "Liability", accountCategory: "CurrentLiability", normalBalance: "Credit" })
      expect(isValidAccount(account)).toBe(true)
    })
  })

  describe("all cash flow categories with balance sheet accounts", () => {
    it("validates all cash flow categories on Asset accounts", () => {
      const categories: CashFlowCategory[] = ["Operating", "Investing", "Financing", "NonCash"]
      for (const category of categories) {
        const account = createBaseAccount({
          accountNumber: "1000",
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          cashFlowCategory: category
        })
        expect(isValidAccount(account)).toBe(true)
      }
    })

    it("validates all cash flow categories on Liability accounts", () => {
      const categories: CashFlowCategory[] = ["Operating", "Investing", "Financing", "NonCash"]
      for (const category of categories) {
        const account = createBaseAccount({
          accountNumber: "2000",
          accountType: "Liability",
          accountCategory: "CurrentLiability",
          normalBalance: "Credit",
          cashFlowCategory: category
        })
        expect(isValidAccount(account)).toBe(true)
      }
    })

    it("validates all cash flow categories on Equity accounts", () => {
      const categories: CashFlowCategory[] = ["Operating", "Investing", "Financing", "NonCash"]
      for (const category of categories) {
        const account = createBaseAccount({
          accountNumber: "3000",
          accountType: "Equity",
          accountCategory: "ContributedCapital",
          normalBalance: "Credit",
          cashFlowCategory: category
        })
        expect(isValidAccount(account)).toBe(true)
      }
    })
  })
})
