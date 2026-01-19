import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  AccountId,
  isAccountId,
  AccountType,
  isAccountType,
  AccountCategory,
  isAccountCategory,
  NormalBalance,
  isNormalBalance,
  CashFlowCategory,
  isCashFlowCategory,
  getAccountTypeForCategory,
  getCategoriesForType,
  getNormalBalanceForType,
  Account,
  isAccount
} from "../../src/accounting/Account.ts"
import { AccountNumber } from "../../src/accounting/AccountNumber.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { USD } from "../../src/currency/CurrencyCode.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("AccountId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = AccountId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = AccountId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountId)
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAccountId returns true for valid AccountId", () => {
      const id = AccountId.make(validUUID)
      expect(isAccountId(id)).toBe(true)
    })

    it("isAccountId returns true for plain UUID string (validates pattern)", () => {
      expect(isAccountId(validUUID)).toBe(true)
    })

    it("isAccountId returns false for non-string values", () => {
      expect(isAccountId(null)).toBe(false)
      expect(isAccountId(undefined)).toBe(false)
      expect(isAccountId(123)).toBe(false)
      expect(isAccountId({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates AccountId using Schema's .make()", () => {
      const id = AccountId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isAccountId(id)).toBe(true)
    })
  })
})

describe("AccountType", () => {
  describe("validation", () => {
    it.effect("accepts Asset", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(AccountType)("Asset")
        expect(type).toBe("Asset")
      })
    )

    it.effect("accepts Liability", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(AccountType)("Liability")
        expect(type).toBe("Liability")
      })
    )

    it.effect("accepts Equity", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(AccountType)("Equity")
        expect(type).toBe("Equity")
      })
    )

    it.effect("accepts Revenue", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(AccountType)("Revenue")
        expect(type).toBe("Revenue")
      })
    )

    it.effect("accepts Expense", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(AccountType)("Expense")
        expect(type).toBe("Expense")
      })
    )

    it.effect("rejects invalid account types", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountType)
        const result = yield* Effect.exit(decode("InvalidType"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountType)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountType)
        const result = yield* Effect.exit(decode(123))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAccountType returns true for valid types", () => {
      expect(isAccountType("Asset")).toBe(true)
      expect(isAccountType("Liability")).toBe(true)
      expect(isAccountType("Equity")).toBe(true)
      expect(isAccountType("Revenue")).toBe(true)
      expect(isAccountType("Expense")).toBe(true)
    })

    it("isAccountType returns false for invalid types", () => {
      expect(isAccountType("InvalidType")).toBe(false)
      expect(isAccountType("")).toBe(false)
      expect(isAccountType(null)).toBe(false)
      expect(isAccountType(undefined)).toBe(false)
    })
  })
})

describe("AccountCategory", () => {
  describe("validation", () => {
    const assetCategories = ["CurrentAsset", "NonCurrentAsset", "FixedAsset", "IntangibleAsset"]
    const liabilityCategories = ["CurrentLiability", "NonCurrentLiability"]
    const equityCategories = ["ContributedCapital", "RetainedEarnings", "OtherComprehensiveIncome", "TreasuryStock"]
    const revenueCategories = ["OperatingRevenue", "OtherRevenue"]
    const expenseCategories = ["CostOfGoodsSold", "OperatingExpense", "DepreciationAmortization", "InterestExpense", "TaxExpense", "OtherExpense"]

    it.effect("accepts all valid asset categories", () =>
      Effect.gen(function* () {
        for (const category of assetCategories) {
          const result = yield* Schema.decodeUnknown(AccountCategory)(category)
          expect(result).toBe(category)
        }
      })
    )

    it.effect("accepts all valid liability categories", () =>
      Effect.gen(function* () {
        for (const category of liabilityCategories) {
          const result = yield* Schema.decodeUnknown(AccountCategory)(category)
          expect(result).toBe(category)
        }
      })
    )

    it.effect("accepts all valid equity categories", () =>
      Effect.gen(function* () {
        for (const category of equityCategories) {
          const result = yield* Schema.decodeUnknown(AccountCategory)(category)
          expect(result).toBe(category)
        }
      })
    )

    it.effect("accepts all valid revenue categories", () =>
      Effect.gen(function* () {
        for (const category of revenueCategories) {
          const result = yield* Schema.decodeUnknown(AccountCategory)(category)
          expect(result).toBe(category)
        }
      })
    )

    it.effect("accepts all valid expense categories", () =>
      Effect.gen(function* () {
        for (const category of expenseCategories) {
          const result = yield* Schema.decodeUnknown(AccountCategory)(category)
          expect(result).toBe(category)
        }
      })
    )

    it.effect("rejects invalid categories", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountCategory)
        const result = yield* Effect.exit(decode("InvalidCategory"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAccountCategory returns true for valid categories", () => {
      expect(isAccountCategory("CurrentAsset")).toBe(true)
      expect(isAccountCategory("NonCurrentLiability")).toBe(true)
      expect(isAccountCategory("RetainedEarnings")).toBe(true)
      expect(isAccountCategory("OperatingRevenue")).toBe(true)
      expect(isAccountCategory("CostOfGoodsSold")).toBe(true)
    })

    it("isAccountCategory returns false for invalid categories", () => {
      expect(isAccountCategory("InvalidCategory")).toBe(false)
      expect(isAccountCategory("")).toBe(false)
      expect(isAccountCategory(null)).toBe(false)
    })
  })
})

describe("NormalBalance", () => {
  describe("validation", () => {
    it.effect("accepts Debit", () =>
      Effect.gen(function* () {
        const balance = yield* Schema.decodeUnknown(NormalBalance)("Debit")
        expect(balance).toBe("Debit")
      })
    )

    it.effect("accepts Credit", () =>
      Effect.gen(function* () {
        const balance = yield* Schema.decodeUnknown(NormalBalance)("Credit")
        expect(balance).toBe("Credit")
      })
    )

    it.effect("rejects invalid values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(NormalBalance)
        const result = yield* Effect.exit(decode("Invalid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isNormalBalance returns true for valid values", () => {
      expect(isNormalBalance("Debit")).toBe(true)
      expect(isNormalBalance("Credit")).toBe(true)
    })

    it("isNormalBalance returns false for invalid values", () => {
      expect(isNormalBalance("Invalid")).toBe(false)
      expect(isNormalBalance(null)).toBe(false)
    })
  })
})

describe("CashFlowCategory", () => {
  describe("validation", () => {
    it.effect("accepts Operating", () =>
      Effect.gen(function* () {
        const category = yield* Schema.decodeUnknown(CashFlowCategory)("Operating")
        expect(category).toBe("Operating")
      })
    )

    it.effect("accepts Investing", () =>
      Effect.gen(function* () {
        const category = yield* Schema.decodeUnknown(CashFlowCategory)("Investing")
        expect(category).toBe("Investing")
      })
    )

    it.effect("accepts Financing", () =>
      Effect.gen(function* () {
        const category = yield* Schema.decodeUnknown(CashFlowCategory)("Financing")
        expect(category).toBe("Financing")
      })
    )

    it.effect("accepts NonCash", () =>
      Effect.gen(function* () {
        const category = yield* Schema.decodeUnknown(CashFlowCategory)("NonCash")
        expect(category).toBe("NonCash")
      })
    )

    it.effect("rejects invalid values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CashFlowCategory)
        const result = yield* Effect.exit(decode("Invalid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isCashFlowCategory returns true for valid values", () => {
      expect(isCashFlowCategory("Operating")).toBe(true)
      expect(isCashFlowCategory("Investing")).toBe(true)
      expect(isCashFlowCategory("Financing")).toBe(true)
      expect(isCashFlowCategory("NonCash")).toBe(true)
    })

    it("isCashFlowCategory returns false for invalid values", () => {
      expect(isCashFlowCategory("Invalid")).toBe(false)
      expect(isCashFlowCategory(null)).toBe(false)
    })
  })
})

describe("Helper functions", () => {
  describe("getAccountTypeForCategory", () => {
    it("returns Asset for asset categories", () => {
      expect(getAccountTypeForCategory("CurrentAsset")).toBe("Asset")
      expect(getAccountTypeForCategory("NonCurrentAsset")).toBe("Asset")
      expect(getAccountTypeForCategory("FixedAsset")).toBe("Asset")
      expect(getAccountTypeForCategory("IntangibleAsset")).toBe("Asset")
    })

    it("returns Liability for liability categories", () => {
      expect(getAccountTypeForCategory("CurrentLiability")).toBe("Liability")
      expect(getAccountTypeForCategory("NonCurrentLiability")).toBe("Liability")
    })

    it("returns Equity for equity categories", () => {
      expect(getAccountTypeForCategory("ContributedCapital")).toBe("Equity")
      expect(getAccountTypeForCategory("RetainedEarnings")).toBe("Equity")
      expect(getAccountTypeForCategory("OtherComprehensiveIncome")).toBe("Equity")
      expect(getAccountTypeForCategory("TreasuryStock")).toBe("Equity")
    })

    it("returns Revenue for revenue categories", () => {
      expect(getAccountTypeForCategory("OperatingRevenue")).toBe("Revenue")
      expect(getAccountTypeForCategory("OtherRevenue")).toBe("Revenue")
    })

    it("returns Expense for expense categories", () => {
      expect(getAccountTypeForCategory("CostOfGoodsSold")).toBe("Expense")
      expect(getAccountTypeForCategory("OperatingExpense")).toBe("Expense")
      expect(getAccountTypeForCategory("DepreciationAmortization")).toBe("Expense")
      expect(getAccountTypeForCategory("InterestExpense")).toBe("Expense")
      expect(getAccountTypeForCategory("TaxExpense")).toBe("Expense")
      expect(getAccountTypeForCategory("OtherExpense")).toBe("Expense")
    })
  })

  describe("getCategoriesForType", () => {
    it("returns correct categories for Asset", () => {
      const categories = getCategoriesForType("Asset")
      expect(categories).toContain("CurrentAsset")
      expect(categories).toContain("NonCurrentAsset")
      expect(categories).toContain("FixedAsset")
      expect(categories).toContain("IntangibleAsset")
      expect(categories).toHaveLength(4)
    })

    it("returns correct categories for Liability", () => {
      const categories = getCategoriesForType("Liability")
      expect(categories).toContain("CurrentLiability")
      expect(categories).toContain("NonCurrentLiability")
      expect(categories).toHaveLength(2)
    })

    it("returns correct categories for Equity", () => {
      const categories = getCategoriesForType("Equity")
      expect(categories).toContain("ContributedCapital")
      expect(categories).toContain("RetainedEarnings")
      expect(categories).toContain("OtherComprehensiveIncome")
      expect(categories).toContain("TreasuryStock")
      expect(categories).toHaveLength(4)
    })

    it("returns correct categories for Revenue", () => {
      const categories = getCategoriesForType("Revenue")
      expect(categories).toContain("OperatingRevenue")
      expect(categories).toContain("OtherRevenue")
      expect(categories).toHaveLength(2)
    })

    it("returns correct categories for Expense", () => {
      const categories = getCategoriesForType("Expense")
      expect(categories).toContain("CostOfGoodsSold")
      expect(categories).toContain("OperatingExpense")
      expect(categories).toContain("DepreciationAmortization")
      expect(categories).toContain("InterestExpense")
      expect(categories).toContain("TaxExpense")
      expect(categories).toContain("OtherExpense")
      expect(categories).toHaveLength(6)
    })
  })

  describe("getNormalBalanceForType", () => {
    it("returns Debit for Asset", () => {
      expect(getNormalBalanceForType("Asset")).toBe("Debit")
    })

    it("returns Debit for Expense", () => {
      expect(getNormalBalanceForType("Expense")).toBe("Debit")
    })

    it("returns Credit for Liability", () => {
      expect(getNormalBalanceForType("Liability")).toBe("Credit")
    })

    it("returns Credit for Equity", () => {
      expect(getNormalBalanceForType("Equity")).toBe("Credit")
    })

    it("returns Credit for Revenue", () => {
      expect(getNormalBalanceForType("Revenue")).toBe("Credit")
    })
  })
})

describe("Account", () => {
  const accountUUID = "550e8400-e29b-41d4-a716-446655440000"
  const companyUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const parentAccountUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const partnerCompanyUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createCashAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("1000"),
      name: "Cash",
      description: Option.some("Cash and cash equivalents"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createIntercompanyReceivable = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("9100"),
      name: "Intercompany Receivable - Partner",
      description: Option.some("Amounts due from partner company"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
      isIntercompany: true,
      intercompanyPartnerId: Option.some(CompanyId.make(partnerCompanyUUID)),
      currencyRestriction: Option.some(USD),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createSubAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("1001"),
      name: "Petty Cash",
      description: Option.some("Petty cash fund"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit",
      parentAccountId: Option.some(AccountId.make(parentAccountUUID)),
      hierarchyLevel: 2,
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createSummaryAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("1000"),
      name: "Total Current Assets",
      description: Option.some("Summary of all current assets"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: false,
      isCashFlowRelevant: false,
      cashFlowCategory: Option.none(),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createRevenueAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("4000"),
      name: "Sales Revenue",
      description: Option.some("Revenue from sales of goods and services"),
      accountType: "Revenue",
      accountCategory: "OperatingRevenue",
      normalBalance: "Credit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createExpenseAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("6000"),
      name: "Salaries Expense",
      description: Option.some("Employee salaries and wages"),
      accountType: "Expense",
      accountCategory: "OperatingExpense",
      normalBalance: "Debit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createLiabilityAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("2000"),
      name: "Accounts Payable",
      description: Option.some("Amounts owed to vendors"),
      accountType: "Liability",
      accountCategory: "CurrentLiability",
      normalBalance: "Credit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createEquityAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("3000"),
      name: "Common Stock",
      description: Option.some("Issued common stock"),
      accountType: "Equity",
      accountCategory: "ContributedCapital",
      normalBalance: "Credit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Financing"),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.none()
    })
  }

  const createDeactivatedAccount = () => {
    return Account.make({
      id: AccountId.make(accountUUID),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make("1999"),
      name: "Old Asset Account",
      description: Option.none(),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit",
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable: true,
      isCashFlowRelevant: false,
      cashFlowCategory: Option.none(),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: false,
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      deactivatedAt: Option.some(Timestamp.make({ epochMillis: 1718496000000 }))
    })
  }

  describe("validation", () => {
    it.effect("accepts valid cash account data", () =>
      Effect.gen(function* () {
        const account = createCashAccount()
        expect(account.id).toBe(accountUUID)
        expect(account.name).toBe("Cash")
        expect(account.accountType).toBe("Asset")
        expect(account.accountCategory).toBe("CurrentAsset")
        expect(account.normalBalance).toBe("Debit")
        expect(account.hierarchyLevel).toBe(1)
        expect(account.isPostable).toBe(true)
        expect(account.isCashFlowRelevant).toBe(true)
        expect(Option.getOrNull(account.cashFlowCategory)).toBe("Operating")
        expect(account.isIntercompany).toBe(false)
        expect(account.isActive).toBe(true)
      })
    )

    it.effect("accepts valid intercompany account data", () =>
      Effect.gen(function* () {
        const account = createIntercompanyReceivable()
        expect(account.isIntercompany).toBe(true)
        expect(Option.getOrNull(account.intercompanyPartnerId)).toBe(partnerCompanyUUID)
        expect(Option.getOrNull(account.currencyRestriction)).toBe(USD)
      })
    )

    it.effect("accepts valid sub-account data", () =>
      Effect.gen(function* () {
        const account = createSubAccount()
        expect(Option.getOrNull(account.parentAccountId)).toBe(parentAccountUUID)
        expect(account.hierarchyLevel).toBe(2)
      })
    )

    it.effect("accepts summary account (not postable)", () =>
      Effect.gen(function* () {
        const account = createSummaryAccount()
        expect(account.isPostable).toBe(false)
        expect(account.isCashFlowRelevant).toBe(false)
        expect(Option.isNone(account.cashFlowCategory)).toBe(true)
      })
    )

    it.effect("accepts revenue account", () =>
      Effect.gen(function* () {
        const account = createRevenueAccount()
        expect(account.accountType).toBe("Revenue")
        expect(account.accountCategory).toBe("OperatingRevenue")
        expect(account.normalBalance).toBe("Credit")
      })
    )

    it.effect("accepts expense account", () =>
      Effect.gen(function* () {
        const account = createExpenseAccount()
        expect(account.accountType).toBe("Expense")
        expect(account.accountCategory).toBe("OperatingExpense")
        expect(account.normalBalance).toBe("Debit")
      })
    )

    it.effect("accepts liability account", () =>
      Effect.gen(function* () {
        const account = createLiabilityAccount()
        expect(account.accountType).toBe("Liability")
        expect(account.accountCategory).toBe("CurrentLiability")
        expect(account.normalBalance).toBe("Credit")
      })
    )

    it.effect("accepts equity account", () =>
      Effect.gen(function* () {
        const account = createEquityAccount()
        expect(account.accountType).toBe("Equity")
        expect(account.accountCategory).toBe("ContributedCapital")
        expect(account.normalBalance).toBe("Credit")
      })
    )

    it.effect("accepts deactivated account with deactivatedAt timestamp", () =>
      Effect.gen(function* () {
        const account = createDeactivatedAccount()
        expect(account.isActive).toBe(false)
        expect(Option.isSome(account.deactivatedAt)).toBe(true)
      })
    )

    it.effect("accepts all cash flow categories", () =>
      Effect.gen(function* () {
        const categories: CashFlowCategory[] = ["Operating", "Investing", "Financing", "NonCash"]

        for (const category of categories) {
          const account = Account.make({
            id: AccountId.make(accountUUID),
            companyId: CompanyId.make(companyUUID),
            accountNumber: AccountNumber.make("1000"),
            name: `${category} Account`,
            description: Option.none(),
            accountType: "Asset",
            accountCategory: "CurrentAsset",
            normalBalance: "Debit",
            parentAccountId: Option.none(),
            hierarchyLevel: 1,
            isPostable: true,
            isCashFlowRelevant: true,
            cashFlowCategory: Option.some(category),
            isIntercompany: false,
            intercompanyPartnerId: Option.none(),
            currencyRestriction: Option.none(),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            deactivatedAt: Option.none()
          })
          expect(Option.getOrNull(account.cashFlowCategory)).toBe(category)
        }
      })
    )

    it.effect("accepts all account types", () =>
      Effect.gen(function* () {
        const typeData: Array<{ type: AccountType; category: AccountCategory; balance: NormalBalance; number: string }> = [
          { type: "Asset", category: "CurrentAsset", balance: "Debit", number: "1000" },
          { type: "Liability", category: "CurrentLiability", balance: "Credit", number: "2000" },
          { type: "Equity", category: "RetainedEarnings", balance: "Credit", number: "3000" },
          { type: "Revenue", category: "OperatingRevenue", balance: "Credit", number: "4000" },
          { type: "Expense", category: "OperatingExpense", balance: "Debit", number: "6000" }
        ]

        for (const data of typeData) {
          const account = Account.make({
            id: AccountId.make(accountUUID),
            companyId: CompanyId.make(companyUUID),
            accountNumber: AccountNumber.make(data.number),
            name: `${data.type} Account`,
            description: Option.none(),
            accountType: data.type,
            accountCategory: data.category,
            normalBalance: data.balance,
            parentAccountId: Option.none(),
            hierarchyLevel: 1,
            isPostable: true,
            isCashFlowRelevant: false,
            cashFlowCategory: Option.none(),
            isIntercompany: false,
            intercompanyPartnerId: Option.none(),
            currencyRestriction: Option.none(),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            deactivatedAt: Option.none()
          })
          expect(account.accountType).toBe(data.type)
        }
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid account number", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "INVALID",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid account type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "InvalidType",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid account category", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "InvalidCategory",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid normal balance", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "InvalidBalance",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid cash flow category", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: true,
          cashFlowCategory: "InvalidCategory",
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects hierarchy level less than 1", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 0,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-integer hierarchy level", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1.5,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid account id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: "not-a-uuid",
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid company id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: "not-a-uuid",
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid currency restriction", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Account)
        const result = yield* Effect.exit(decode({
          id: accountUUID,
          companyId: companyUUID,
          accountNumber: "1000",
          name: "Test Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          hierarchyLevel: 1,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: "INVALID",
          isActive: true,
          createdAt: { epochMillis: 1718409600000 },
          deactivatedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties", () => {
    it("isTopLevel returns true for account without parent", () => {
      const account = createCashAccount()
      expect(account.isTopLevel).toBe(true)
    })

    it("isTopLevel returns false for sub-account", () => {
      const account = createSubAccount()
      expect(account.isTopLevel).toBe(false)
    })

    it("isSubAccount returns false for account without parent", () => {
      const account = createCashAccount()
      expect(account.isSubAccount).toBe(false)
    })

    it("isSubAccount returns true for sub-account", () => {
      const account = createSubAccount()
      expect(account.isSubAccount).toBe(true)
    })

    it("isBalanceSheetAccount returns true for Asset", () => {
      const account = createCashAccount()
      expect(account.isBalanceSheetAccount).toBe(true)
    })

    it("isBalanceSheetAccount returns true for Liability", () => {
      const account = createLiabilityAccount()
      expect(account.isBalanceSheetAccount).toBe(true)
    })

    it("isBalanceSheetAccount returns true for Equity", () => {
      const account = createEquityAccount()
      expect(account.isBalanceSheetAccount).toBe(true)
    })

    it("isBalanceSheetAccount returns false for Revenue", () => {
      const account = createRevenueAccount()
      expect(account.isBalanceSheetAccount).toBe(false)
    })

    it("isBalanceSheetAccount returns false for Expense", () => {
      const account = createExpenseAccount()
      expect(account.isBalanceSheetAccount).toBe(false)
    })

    it("isIncomeStatementAccount returns false for Asset", () => {
      const account = createCashAccount()
      expect(account.isIncomeStatementAccount).toBe(false)
    })

    it("isIncomeStatementAccount returns true for Revenue", () => {
      const account = createRevenueAccount()
      expect(account.isIncomeStatementAccount).toBe(true)
    })

    it("isIncomeStatementAccount returns true for Expense", () => {
      const account = createExpenseAccount()
      expect(account.isIncomeStatementAccount).toBe(true)
    })

    it("hasNormalDebitBalance returns true for Asset with Debit balance", () => {
      const account = createCashAccount()
      expect(account.hasNormalDebitBalance).toBe(true)
    })

    it("hasNormalDebitBalance returns false for Revenue with Credit balance", () => {
      const account = createRevenueAccount()
      expect(account.hasNormalDebitBalance).toBe(false)
    })

    it("hasNormalCreditBalance returns true for Revenue with Credit balance", () => {
      const account = createRevenueAccount()
      expect(account.hasNormalCreditBalance).toBe(true)
    })

    it("hasNormalCreditBalance returns false for Asset with Debit balance", () => {
      const account = createCashAccount()
      expect(account.hasNormalCreditBalance).toBe(false)
    })

    it("hasStandardNormalBalance returns true for Asset with Debit balance", () => {
      const account = createCashAccount()
      expect(account.hasStandardNormalBalance).toBe(true)
    })

    it("hasStandardNormalBalance returns true for Revenue with Credit balance", () => {
      const account = createRevenueAccount()
      expect(account.hasStandardNormalBalance).toBe(true)
    })

    it("hasStandardNormalBalance returns false for contra-type account", () => {
      const contraAsset = Account.make({
        id: AccountId.make(accountUUID),
        companyId: CompanyId.make(companyUUID),
        accountNumber: AccountNumber.make("1900"),
        name: "Accumulated Depreciation",
        description: Option.some("Contra asset account"),
        accountType: "Asset",
        accountCategory: "FixedAsset",
        normalBalance: "Credit", // Contra to normal asset
        parentAccountId: Option.none(),
        hierarchyLevel: 1,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: Option.none(),
        isIntercompany: false,
        intercompanyPartnerId: Option.none(),
        currencyRestriction: Option.none(),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        deactivatedAt: Option.none()
      })
      expect(contraAsset.hasStandardNormalBalance).toBe(false)
    })

    it("hasCategoryMatchingType returns true for matching category and type", () => {
      const account = createCashAccount()
      expect(account.hasCategoryMatchingType).toBe(true)
    })

    it("hasCategoryMatchingType returns false for mismatched category and type", () => {
      // Create an account with mismatched category and type
      const mismatched = Account.make({
        id: AccountId.make(accountUUID),
        companyId: CompanyId.make(companyUUID),
        accountNumber: AccountNumber.make("1000"),
        name: "Mismatched Account",
        description: Option.none(),
        accountType: "Asset",
        accountCategory: "CurrentLiability", // Wrong category for Asset type
        normalBalance: "Debit",
        parentAccountId: Option.none(),
        hierarchyLevel: 1,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: Option.none(),
        isIntercompany: false,
        intercompanyPartnerId: Option.none(),
        currencyRestriction: Option.none(),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        deactivatedAt: Option.none()
      })
      expect(mismatched.hasCategoryMatchingType).toBe(false)
    })

    it("hasCurrencyRestriction returns true when currency is restricted", () => {
      const account = createIntercompanyReceivable()
      expect(account.hasCurrencyRestriction).toBe(true)
    })

    it("hasCurrencyRestriction returns false when no currency restriction", () => {
      const account = createCashAccount()
      expect(account.hasCurrencyRestriction).toBe(false)
    })

    it("isSummaryAccount returns true for non-postable account", () => {
      const account = createSummaryAccount()
      expect(account.isSummaryAccount).toBe(true)
    })

    it("isSummaryAccount returns false for postable account", () => {
      const account = createCashAccount()
      expect(account.isSummaryAccount).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isAccount returns true for Account instances", () => {
      const account = createCashAccount()
      expect(isAccount(account)).toBe(true)
    })

    it("isAccount returns false for plain objects", () => {
      expect(isAccount({
        id: accountUUID,
        companyId: companyUUID,
        accountNumber: "1000",
        name: "Test",
        accountType: "Asset"
      })).toBe(false)
    })

    it("isAccount returns false for non-object values", () => {
      expect(isAccount(null)).toBe(false)
      expect(isAccount(undefined)).toBe(false)
      expect(isAccount("account")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for Account", () => {
      const account1 = createCashAccount()
      const account2 = Account.make({
        id: AccountId.make(accountUUID),
        companyId: CompanyId.make(companyUUID),
        accountNumber: AccountNumber.make("1000"),
        name: "Cash",
        description: Option.some("Cash and cash equivalents"),
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: Option.none(),
        hierarchyLevel: 1,
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
        isIntercompany: false,
        intercompanyPartnerId: Option.none(),
        currencyRestriction: Option.none(),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        deactivatedAt: Option.none()
      })
      const account3 = createRevenueAccount()

      expect(Equal.equals(account1, account2)).toBe(true)
      expect(Equal.equals(account1, account3)).toBe(false)
    })

    it("Equal.equals is false for different timestamps", () => {
      const account1 = createCashAccount()
      const account2 = Account.make({
        id: AccountId.make(accountUUID),
        companyId: CompanyId.make(companyUUID),
        accountNumber: AccountNumber.make("1000"),
        name: "Cash",
        description: Option.some("Cash and cash equivalents"),
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: Option.none(),
        hierarchyLevel: 1,
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
        isIntercompany: false,
        intercompanyPartnerId: Option.none(),
        currencyRestriction: Option.none(),
        isActive: true,
        createdAt: Timestamp.make({ epochMillis: 1718409600001 }),
        deactivatedAt: Option.none()
      })

      expect(Equal.equals(account1, account2)).toBe(false)
    })

    it("Equal.equals is false for different account types", () => {
      const asset = createCashAccount()
      const revenue = createRevenueAccount()

      expect(Equal.equals(asset, revenue)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes cash Account", () =>
      Effect.gen(function* () {
        const original = createCashAccount()
        const encoded = yield* Schema.encode(Account)(original)
        const decoded = yield* Schema.decodeUnknown(Account)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes intercompany Account", () =>
      Effect.gen(function* () {
        const original = createIntercompanyReceivable()
        const encoded = yield* Schema.encode(Account)(original)
        const decoded = yield* Schema.decodeUnknown(Account)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes sub-account", () =>
      Effect.gen(function* () {
        const original = createSubAccount()
        const encoded = yield* Schema.encode(Account)(original)
        const decoded = yield* Schema.decodeUnknown(Account)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes deactivated Account", () =>
      Effect.gen(function* () {
        const original = createDeactivatedAccount()
        const encoded = yield* Schema.encode(Account)(original)
        const decoded = yield* Schema.decodeUnknown(Account)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const account = createCashAccount()
        const encoded = yield* Schema.encode(Account)(account)

        expect(encoded).toHaveProperty("id", accountUUID)
        expect(encoded).toHaveProperty("companyId", companyUUID)
        expect(encoded).toHaveProperty("accountNumber", "1000")
        expect(encoded).toHaveProperty("name", "Cash")
        expect(encoded).toHaveProperty("description", "Cash and cash equivalents")
        expect(encoded).toHaveProperty("accountType", "Asset")
        expect(encoded).toHaveProperty("accountCategory", "CurrentAsset")
        expect(encoded).toHaveProperty("normalBalance", "Debit")
        expect(encoded).toHaveProperty("parentAccountId", null)
        expect(encoded).toHaveProperty("hierarchyLevel", 1)
        expect(encoded).toHaveProperty("isPostable", true)
        expect(encoded).toHaveProperty("isCashFlowRelevant", true)
        expect(encoded).toHaveProperty("cashFlowCategory", "Operating")
        expect(encoded).toHaveProperty("isIntercompany", false)
        expect(encoded).toHaveProperty("intercompanyPartnerId", null)
        expect(encoded).toHaveProperty("currencyRestriction", null)
        expect(encoded).toHaveProperty("isActive", true)
        expect(encoded).toHaveProperty("createdAt")
        expect(encoded).toHaveProperty("deactivatedAt", null)
      })
    )

    it.effect("encodes intercompany account with partner ID", () =>
      Effect.gen(function* () {
        const account = createIntercompanyReceivable()
        const encoded = yield* Schema.encode(Account)(account)

        expect(encoded).toHaveProperty("isIntercompany", true)
        expect(encoded).toHaveProperty("intercompanyPartnerId", partnerCompanyUUID)
        expect(encoded).toHaveProperty("currencyRestriction", "USD")
      })
    )
  })

  describe("immutability", () => {
    it("Account properties are readonly at compile time", () => {
      const account = createCashAccount()
      expect(account.name).toBe("Cash")
      expect(account.accountType).toBe("Asset")
    })
  })

  describe("all account categories", () => {
    it.effect("creates accounts with all asset categories", () =>
      Effect.gen(function* () {
        const assetCategories: AccountCategory[] = ["CurrentAsset", "NonCurrentAsset", "FixedAsset", "IntangibleAsset"]

        for (const category of assetCategories) {
          const account = Account.make({
            id: AccountId.make(accountUUID),
            companyId: CompanyId.make(companyUUID),
            accountNumber: AccountNumber.make("1000"),
            name: `${category} Account`,
            description: Option.none(),
            accountType: "Asset",
            accountCategory: category,
            normalBalance: "Debit",
            parentAccountId: Option.none(),
            hierarchyLevel: 1,
            isPostable: true,
            isCashFlowRelevant: false,
            cashFlowCategory: Option.none(),
            isIntercompany: false,
            intercompanyPartnerId: Option.none(),
            currencyRestriction: Option.none(),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            deactivatedAt: Option.none()
          })
          expect(account.accountCategory).toBe(category)
          expect(account.hasCategoryMatchingType).toBe(true)
        }
      })
    )

    it.effect("creates accounts with all liability categories", () =>
      Effect.gen(function* () {
        const liabilityCategories: AccountCategory[] = ["CurrentLiability", "NonCurrentLiability"]

        for (const category of liabilityCategories) {
          const account = Account.make({
            id: AccountId.make(accountUUID),
            companyId: CompanyId.make(companyUUID),
            accountNumber: AccountNumber.make("2000"),
            name: `${category} Account`,
            description: Option.none(),
            accountType: "Liability",
            accountCategory: category,
            normalBalance: "Credit",
            parentAccountId: Option.none(),
            hierarchyLevel: 1,
            isPostable: true,
            isCashFlowRelevant: false,
            cashFlowCategory: Option.none(),
            isIntercompany: false,
            intercompanyPartnerId: Option.none(),
            currencyRestriction: Option.none(),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            deactivatedAt: Option.none()
          })
          expect(account.accountCategory).toBe(category)
          expect(account.hasCategoryMatchingType).toBe(true)
        }
      })
    )

    it.effect("creates accounts with all equity categories", () =>
      Effect.gen(function* () {
        const equityCategories: AccountCategory[] = ["ContributedCapital", "RetainedEarnings", "OtherComprehensiveIncome", "TreasuryStock"]

        for (const category of equityCategories) {
          const account = Account.make({
            id: AccountId.make(accountUUID),
            companyId: CompanyId.make(companyUUID),
            accountNumber: AccountNumber.make("3000"),
            name: `${category} Account`,
            description: Option.none(),
            accountType: "Equity",
            accountCategory: category,
            normalBalance: "Credit",
            parentAccountId: Option.none(),
            hierarchyLevel: 1,
            isPostable: true,
            isCashFlowRelevant: false,
            cashFlowCategory: Option.none(),
            isIntercompany: false,
            intercompanyPartnerId: Option.none(),
            currencyRestriction: Option.none(),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            deactivatedAt: Option.none()
          })
          expect(account.accountCategory).toBe(category)
          expect(account.hasCategoryMatchingType).toBe(true)
        }
      })
    )

    it.effect("creates accounts with all revenue categories", () =>
      Effect.gen(function* () {
        const revenueCategories: AccountCategory[] = ["OperatingRevenue", "OtherRevenue"]

        for (const category of revenueCategories) {
          const account = Account.make({
            id: AccountId.make(accountUUID),
            companyId: CompanyId.make(companyUUID),
            accountNumber: AccountNumber.make("4000"),
            name: `${category} Account`,
            description: Option.none(),
            accountType: "Revenue",
            accountCategory: category,
            normalBalance: "Credit",
            parentAccountId: Option.none(),
            hierarchyLevel: 1,
            isPostable: true,
            isCashFlowRelevant: false,
            cashFlowCategory: Option.none(),
            isIntercompany: false,
            intercompanyPartnerId: Option.none(),
            currencyRestriction: Option.none(),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            deactivatedAt: Option.none()
          })
          expect(account.accountCategory).toBe(category)
          expect(account.hasCategoryMatchingType).toBe(true)
        }
      })
    )

    it.effect("creates accounts with all expense categories", () =>
      Effect.gen(function* () {
        const expenseCategories: AccountCategory[] = [
          "CostOfGoodsSold",
          "OperatingExpense",
          "DepreciationAmortization",
          "InterestExpense",
          "TaxExpense",
          "OtherExpense"
        ]

        for (const category of expenseCategories) {
          const account = Account.make({
            id: AccountId.make(accountUUID),
            companyId: CompanyId.make(companyUUID),
            accountNumber: AccountNumber.make("6000"),
            name: `${category} Account`,
            description: Option.none(),
            accountType: "Expense",
            accountCategory: category,
            normalBalance: "Debit",
            parentAccountId: Option.none(),
            hierarchyLevel: 1,
            isPostable: true,
            isCashFlowRelevant: false,
            cashFlowCategory: Option.none(),
            isIntercompany: false,
            intercompanyPartnerId: Option.none(),
            currencyRestriction: Option.none(),
            isActive: true,
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            deactivatedAt: Option.none()
          })
          expect(account.accountCategory).toBe(category)
          expect(account.hasCategoryMatchingType).toBe(true)
        }
      })
    )
  })
})
