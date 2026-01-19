import { describe, it, expect, beforeEach } from "@effect/vitest"
import { Effect, Exit, Equal, Option, Array as Arr, Chunk, Hash } from "effect"
import * as Schema from "effect/Schema"
import {
  TemplateAccountDefinition,
  isTemplateAccountDefinition,
  TemplateType,
  isTemplateType,
  AccountTemplate,
  isAccountTemplate,
  GeneralBusinessTemplate,
  ManufacturingTemplate,
  ServiceBusinessTemplate,
  HoldingCompanyTemplate,
  getTemplateByType,
  getAllTemplates,
  instantiateTemplate,
  instantiateTemplateEffect
} from "../../src/accounting/AccountTemplate.ts"
import type { CashFlowCategory, NormalBalance } from "../../src/accounting/Account.ts";
import { AccountId, getNormalBalanceForType } from "../../src/accounting/Account.ts"
import { AccountNumber } from "../../src/accounting/AccountNumber.ts"
import { CompanyId } from "../../src/company/Company.ts"

describe("TemplateAccountDefinition", () => {
  const createBasicDef = () =>
    TemplateAccountDefinition.make({
      accountNumber: AccountNumber.make("1000"),
      name: "Cash",
      description: Option.some("Cash and cash equivalents"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: Option.none<NormalBalance>(),
      parentAccountNumber: Option.none<AccountNumber>(),
      isPostable: true,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
      isIntercompany: false
    })

  const createContraAccountDef = () =>
    TemplateAccountDefinition.make({
      accountNumber: AccountNumber.make("1110"),
      name: "Allowance for Doubtful Accounts",
      description: Option.some("Reserve for uncollectible receivables"),
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: Option.some<NormalBalance>("Credit"),
      parentAccountNumber: Option.some(AccountNumber.make("1100")),
      isPostable: true,
      isCashFlowRelevant: false,
      cashFlowCategory: Option.none<CashFlowCategory>(),
      isIntercompany: false
    })

  describe("validation", () => {
    it.effect("accepts valid template account definition", () =>
      Effect.gen(function* () {
        const def = createBasicDef()
        expect(def.accountNumber).toBe("1000")
        expect(def.name).toBe("Cash")
        expect(def.accountType).toBe("Asset")
        expect(def.accountCategory).toBe("CurrentAsset")
        expect(def.isPostable).toBe(true)
        expect(def.isCashFlowRelevant).toBe(true)
        expect(Option.getOrNull(def.cashFlowCategory)).toBe("Operating")
        expect(def.isIntercompany).toBe(false)
      })
    )

    it.effect("accepts contra account with explicit normal balance", () =>
      Effect.gen(function* () {
        const def = createContraAccountDef()
        expect(Option.getOrNull(def.normalBalance)).toBe("Credit")
        expect(def.effectiveNormalBalance).toBe("Credit")
      })
    )

    it.effect("rejects invalid account number", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TemplateAccountDefinition)
        const result = yield* Effect.exit(decode({
          accountNumber: "INVALID",
          name: "Test",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: null,
          parentAccountNumber: null,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TemplateAccountDefinition)
        const result = yield* Effect.exit(decode({
          accountNumber: "1000",
          name: "",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: null,
          parentAccountNumber: null,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid account type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TemplateAccountDefinition)
        const result = yield* Effect.exit(decode({
          accountNumber: "1000",
          name: "Test",
          description: null,
          accountType: "InvalidType",
          accountCategory: "CurrentAsset",
          normalBalance: null,
          parentAccountNumber: null,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid account category", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TemplateAccountDefinition)
        const result = yield* Effect.exit(decode({
          accountNumber: "1000",
          name: "Test",
          description: null,
          accountType: "Asset",
          accountCategory: "InvalidCategory",
          normalBalance: null,
          parentAccountNumber: null,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid cash flow category", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TemplateAccountDefinition)
        const result = yield* Effect.exit(decode({
          accountNumber: "1000",
          name: "Test",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: null,
          parentAccountNumber: null,
          isPostable: true,
          isCashFlowRelevant: true,
          cashFlowCategory: "InvalidCategory",
          isIntercompany: false
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("effectiveNormalBalance", () => {
    it("returns standard balance when not specified for Asset", () => {
      const def = createBasicDef()
      expect(def.effectiveNormalBalance).toBe("Debit")
      expect(def.effectiveNormalBalance).toBe(getNormalBalanceForType("Asset"))
    })

    it("returns standard balance when not specified for Liability", () => {
      const def = TemplateAccountDefinition.make({
        accountNumber: AccountNumber.make("2000"),
        name: "Accounts Payable",
        description: Option.none<string>(),
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: Option.none<NormalBalance>(),
        parentAccountNumber: Option.none<AccountNumber>(),
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: Option.none<CashFlowCategory>(),
        isIntercompany: false
      })
      expect(def.effectiveNormalBalance).toBe("Credit")
    })

    it("returns standard balance when not specified for Equity", () => {
      const def = TemplateAccountDefinition.make({
        accountNumber: AccountNumber.make("3000"),
        name: "Common Stock",
        description: Option.none<string>(),
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: Option.none<NormalBalance>(),
        parentAccountNumber: Option.none<AccountNumber>(),
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: Option.none<CashFlowCategory>(),
        isIntercompany: false
      })
      expect(def.effectiveNormalBalance).toBe("Credit")
    })

    it("returns standard balance when not specified for Revenue", () => {
      const def = TemplateAccountDefinition.make({
        accountNumber: AccountNumber.make("4000"),
        name: "Sales Revenue",
        description: Option.none<string>(),
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: Option.none<NormalBalance>(),
        parentAccountNumber: Option.none<AccountNumber>(),
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: Option.none<CashFlowCategory>(),
        isIntercompany: false
      })
      expect(def.effectiveNormalBalance).toBe("Credit")
    })

    it("returns standard balance when not specified for Expense", () => {
      const def = TemplateAccountDefinition.make({
        accountNumber: AccountNumber.make("6000"),
        name: "Salaries",
        description: Option.none<string>(),
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: Option.none<NormalBalance>(),
        parentAccountNumber: Option.none<AccountNumber>(),
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: Option.none<CashFlowCategory>(),
        isIntercompany: false
      })
      expect(def.effectiveNormalBalance).toBe("Debit")
    })

    it("returns explicit balance when specified", () => {
      const def = createContraAccountDef()
      expect(def.effectiveNormalBalance).toBe("Credit")
    })
  })

  describe("type guard", () => {
    it("isTemplateAccountDefinition returns true for valid definition", () => {
      const def = createBasicDef()
      expect(isTemplateAccountDefinition(def)).toBe(true)
    })

    it("isTemplateAccountDefinition returns false for plain objects", () => {
      expect(isTemplateAccountDefinition({
        accountNumber: "1000",
        name: "Cash"
      })).toBe(false)
    })

    it("isTemplateAccountDefinition returns false for null", () => {
      expect(isTemplateAccountDefinition(null)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const original = createBasicDef()
        const encoded = yield* Schema.encode(TemplateAccountDefinition)(original)
        const decoded = yield* Schema.decodeUnknown(TemplateAccountDefinition)(encoded)
        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes contra account with parent", () =>
      Effect.gen(function* () {
        const original = createContraAccountDef()
        const encoded = yield* Schema.encode(TemplateAccountDefinition)(original)
        expect(encoded).toHaveProperty("normalBalance", "Credit")
        expect(encoded).toHaveProperty("parentAccountNumber", "1100")
      })
    )
  })
})

describe("TemplateType", () => {
  describe("validation", () => {
    it.effect("accepts GeneralBusiness", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(TemplateType)("GeneralBusiness")
        expect(type).toBe("GeneralBusiness")
      })
    )

    it.effect("accepts Manufacturing", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(TemplateType)("Manufacturing")
        expect(type).toBe("Manufacturing")
      })
    )

    it.effect("accepts ServiceBusiness", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(TemplateType)("ServiceBusiness")
        expect(type).toBe("ServiceBusiness")
      })
    )

    it.effect("accepts HoldingCompany", () =>
      Effect.gen(function* () {
        const type = yield* Schema.decodeUnknown(TemplateType)("HoldingCompany")
        expect(type).toBe("HoldingCompany")
      })
    )

    it.effect("rejects invalid template type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TemplateType)
        const result = yield* Effect.exit(decode("InvalidType"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isTemplateType returns true for valid types", () => {
      expect(isTemplateType("GeneralBusiness")).toBe(true)
      expect(isTemplateType("Manufacturing")).toBe(true)
      expect(isTemplateType("ServiceBusiness")).toBe(true)
      expect(isTemplateType("HoldingCompany")).toBe(true)
    })

    it("isTemplateType returns false for invalid types", () => {
      expect(isTemplateType("InvalidType")).toBe(false)
      expect(isTemplateType("")).toBe(false)
      expect(isTemplateType(null)).toBe(false)
    })
  })
})

describe("AccountTemplate", () => {
  describe("accountCount", () => {
    it("returns correct count for GeneralBusinessTemplate", () => {
      expect(GeneralBusinessTemplate.accountCount).toBeGreaterThanOrEqual(50)
    })

    it("returns correct count for ManufacturingTemplate", () => {
      // Manufacturing extends general business
      expect(ManufacturingTemplate.accountCount).toBeGreaterThan(GeneralBusinessTemplate.accountCount)
    })
  })

  describe("getAccountsByType", () => {
    it("returns only Asset accounts for Asset type", () => {
      const assets = GeneralBusinessTemplate.getAccountsByType("Asset")
      expect(Chunk.size(assets)).toBeGreaterThan(0)
      expect(Chunk.every(assets, (acc) => acc.accountType === "Asset")).toBe(true)
    })

    it("returns only Liability accounts for Liability type", () => {
      const liabilities = GeneralBusinessTemplate.getAccountsByType("Liability")
      expect(Chunk.size(liabilities)).toBeGreaterThan(0)
      expect(Chunk.every(liabilities, (acc) => acc.accountType === "Liability")).toBe(true)
    })

    it("returns only Equity accounts for Equity type", () => {
      const equity = GeneralBusinessTemplate.getAccountsByType("Equity")
      expect(Chunk.size(equity)).toBeGreaterThan(0)
      expect(Chunk.every(equity, (acc) => acc.accountType === "Equity")).toBe(true)
    })

    it("returns only Revenue accounts for Revenue type", () => {
      const revenue = GeneralBusinessTemplate.getAccountsByType("Revenue")
      expect(Chunk.size(revenue)).toBeGreaterThan(0)
      expect(Chunk.every(revenue, (acc) => acc.accountType === "Revenue")).toBe(true)
    })

    it("returns only Expense accounts for Expense type", () => {
      const expenses = GeneralBusinessTemplate.getAccountsByType("Expense")
      expect(Chunk.size(expenses)).toBeGreaterThan(0)
      expect(Chunk.every(expenses, (acc) => acc.accountType === "Expense")).toBe(true)
    })
  })

  describe("findByAccountNumber", () => {
    it("finds existing account", () => {
      const result = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("1000"))
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrNull(result)?.name).toBe("Cash and Cash Equivalents")
    })

    it("returns None for non-existent account", () => {
      const result = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("9999"))
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("type guard", () => {
    it("isAccountTemplate returns true for templates", () => {
      expect(isAccountTemplate(GeneralBusinessTemplate)).toBe(true)
      expect(isAccountTemplate(ManufacturingTemplate)).toBe(true)
      expect(isAccountTemplate(ServiceBusinessTemplate)).toBe(true)
      expect(isAccountTemplate(HoldingCompanyTemplate)).toBe(true)
    })

    it("isAccountTemplate returns false for non-templates", () => {
      expect(isAccountTemplate(null)).toBe(false)
      expect(isAccountTemplate({})).toBe(false)
    })
  })

  describe("structural equality with Chunk", () => {
    const createTestAccountDef = (accountNumber: string, name: string) =>
      TemplateAccountDefinition.make({
        accountNumber: AccountNumber.make(accountNumber),
        name,
        description: Option.none(),
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: Option.none(),
        parentAccountNumber: Option.none(),
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: Option.none(),
        isIntercompany: false
      })

    it("Equal.equals returns true for structurally identical templates", () => {
      // Create two identical templates with the same accounts Chunk
      const template1 = AccountTemplate.make({
        templateType: "GeneralBusiness",
        name: "Test Template",
        description: "A test template",
        accounts: Chunk.make(createTestAccountDef("1000", "Cash"))
      })

      const template2 = AccountTemplate.make({
        templateType: "GeneralBusiness",
        name: "Test Template",
        description: "A test template",
        accounts: Chunk.make(createTestAccountDef("1000", "Cash"))
      })

      // With Chunk, structural equality works correctly
      expect(Equal.equals(template1, template2)).toBe(true)
    })

    it("Equal.equals returns false for templates with different accounts", () => {
      const template1 = AccountTemplate.make({
        templateType: "GeneralBusiness",
        name: "Test Template",
        description: "A test template",
        accounts: Chunk.make(createTestAccountDef("1000", "Cash"))
      })

      const template2 = AccountTemplate.make({
        templateType: "GeneralBusiness",
        name: "Test Template",
        description: "A test template",
        accounts: Chunk.make(createTestAccountDef("1010", "Bank")) // Different account
      })

      expect(Equal.equals(template1, template2)).toBe(false)
    })

    it("Hash.hash returns consistent values for equal templates", () => {
      const template1 = AccountTemplate.make({
        templateType: "GeneralBusiness",
        name: "Test Template",
        description: "A test template",
        accounts: Chunk.make(createTestAccountDef("1000", "Cash"))
      })

      const template2 = AccountTemplate.make({
        templateType: "GeneralBusiness",
        name: "Test Template",
        description: "A test template",
        accounts: Chunk.make(createTestAccountDef("1000", "Cash"))
      })

      expect(Hash.hash(template1)).toBe(Hash.hash(template2))
    })
  })
})

describe("GeneralBusinessTemplate", () => {
  it("has correct template type", () => {
    expect(GeneralBusinessTemplate.templateType).toBe("GeneralBusiness")
  })

  it("has at least 50 accounts", () => {
    expect(GeneralBusinessTemplate.accountCount).toBeGreaterThanOrEqual(50)
  })

  it("has accounts for all five types", () => {
    const types = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const
    for (const type of types) {
      const accounts = GeneralBusinessTemplate.getAccountsByType(type)
      expect(accounts.length).toBeGreaterThan(0)
    }
  })

  it("has cash accounts in 1xxx range", () => {
    const cash = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("1010"))
    expect(Option.isSome(cash)).toBe(true)
    expect(Option.getOrNull(cash)?.name).toContain("Cash")
  })

  it("has accounts payable in 2xxx range", () => {
    const ap = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("2000"))
    expect(Option.isSome(ap)).toBe(true)
    expect(Option.getOrNull(ap)?.name).toBe("Accounts Payable")
  })

  it("has equity accounts in 3xxx range", () => {
    const stock = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("3000"))
    expect(Option.isSome(stock)).toBe(true)
    expect(Option.getOrNull(stock)?.name).toBe("Common Stock")
  })

  it("has revenue accounts in 4xxx range", () => {
    const revenue = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("4000"))
    expect(Option.isSome(revenue)).toBe(true)
    expect(Option.getOrNull(revenue)?.accountType).toBe("Revenue")
  })

  it("has expense accounts in 5xxx-7xxx range", () => {
    const cogs = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("5000"))
    const salaries = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("6000"))
    const depreciation = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("7000"))

    expect(Option.isSome(cogs)).toBe(true)
    expect(Option.isSome(salaries)).toBe(true)
    expect(Option.isSome(depreciation)).toBe(true)
  })

  it("has contra accounts with correct normal balance", () => {
    const allowance = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("1110"))
    expect(Option.isSome(allowance)).toBe(true)
    expect(Option.getOrNull(allowance)?.effectiveNormalBalance).toBe("Credit")
  })

  it("has parent-child relationships", () => {
    const accounts = GeneralBusinessTemplate.accounts
    const childAccounts = Chunk.filter(accounts, (acc) => Option.isSome(acc.parentAccountNumber))
    expect(Chunk.size(childAccounts)).toBeGreaterThan(0)
  })

  it("has cash flow relevant accounts with categories", () => {
    const cashFlowAccounts = Chunk.filter(
      GeneralBusinessTemplate.accounts,
      (acc) => acc.isCashFlowRelevant
    )
    expect(Chunk.size(cashFlowAccounts)).toBeGreaterThan(0)

    for (const acc of cashFlowAccounts) {
      expect(Option.isSome(acc.cashFlowCategory)).toBe(true)
    }
  })

  it("has summary accounts that are not postable", () => {
    const cash = GeneralBusinessTemplate.findByAccountNumber(AccountNumber.make("1000"))
    expect(Option.getOrNull(cash)?.isPostable).toBe(false)
  })
})

describe("ManufacturingTemplate", () => {
  it("has correct template type", () => {
    expect(ManufacturingTemplate.templateType).toBe("Manufacturing")
  })

  it("extends general business template", () => {
    expect(ManufacturingTemplate.accountCount).toBeGreaterThan(GeneralBusinessTemplate.accountCount)
  })

  it("has raw materials inventory account", () => {
    const rawMaterials = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("1210"))
    expect(Option.isSome(rawMaterials)).toBe(true)
    expect(Option.getOrNull(rawMaterials)?.name).toContain("Raw Materials")
  })

  it("has work-in-process inventory account", () => {
    const wip = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("1220"))
    expect(Option.isSome(wip)).toBe(true)
    expect(Option.getOrNull(wip)?.name).toContain("Work-in-Process")
  })

  it("has finished goods inventory account", () => {
    const finished = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("1230"))
    expect(Option.isSome(finished)).toBe(true)
    expect(Option.getOrNull(finished)?.name).toContain("Finished Goods")
  })

  it("has manufacturing equipment account", () => {
    const equipment = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("1560"))
    expect(Option.isSome(equipment)).toBe(true)
    expect(Option.getOrNull(equipment)?.name).toContain("Manufacturing Equipment")
  })

  it("has detailed COGS accounts", () => {
    const rawMaterialsUsed = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("5010"))
    const directLabor = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("5020"))
    const overhead = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("5030"))

    expect(Option.isSome(rawMaterialsUsed)).toBe(true)
    expect(Option.isSome(directLabor)).toBe(true)
    expect(Option.isSome(overhead)).toBe(true)
  })

  it("has manufacturing overhead sub-accounts", () => {
    const factoryRent = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("5031"))
    const factoryUtilities = ManufacturingTemplate.findByAccountNumber(AccountNumber.make("5032"))

    expect(Option.isSome(factoryRent)).toBe(true)
    expect(Option.isSome(factoryUtilities)).toBe(true)
    expect(Option.getOrNull(factoryRent)?.parentAccountNumber).toEqual(Option.some("5030"))
  })
})

describe("ServiceBusinessTemplate", () => {
  it("has correct template type", () => {
    expect(ServiceBusinessTemplate.templateType).toBe("ServiceBusiness")
  })

  it("has service-focused revenue accounts", () => {
    const consulting = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("4010"))
    const professional = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("4020"))
    const project = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("4030"))

    expect(Option.isSome(consulting)).toBe(true)
    expect(Option.isSome(professional)).toBe(true)
    expect(Option.isSome(project)).toBe(true)

    expect(Option.getOrNull(consulting)?.name).toContain("Consulting")
    expect(Option.getOrNull(professional)?.name).toContain("Professional")
    expect(Option.getOrNull(project)?.name).toContain("Project")
  })

  it("has unbilled revenue account", () => {
    const unbilled = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("1120"))
    expect(Option.isSome(unbilled)).toBe(true)
    expect(Option.getOrNull(unbilled)?.name).toContain("Unbilled")
  })

  it("has deferred revenue account", () => {
    const deferred = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("2300"))
    expect(Option.isSome(deferred)).toBe(true)
    expect(Option.getOrNull(deferred)?.name).toContain("Deferred Revenue")
  })

  it("has service cost accounts", () => {
    const directLabor = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("5010"))
    const subcontractors = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("5020"))

    expect(Option.isSome(directLabor)).toBe(true)
    expect(Option.isSome(subcontractors)).toBe(true)
    expect(Option.getOrNull(subcontractors)?.name).toContain("Subcontractor")
  })

  it("does not have manufacturing-specific inventory accounts", () => {
    const rawMaterials = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("1210"))
    const wip = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("1220"))

    expect(Option.isNone(rawMaterials)).toBe(true)
    expect(Option.isNone(wip)).toBe(true)
  })

  it("has professional liability insurance account", () => {
    const insurance = ServiceBusinessTemplate.findByAccountNumber(AccountNumber.make("6510"))
    expect(Option.isSome(insurance)).toBe(true)
    expect(Option.getOrNull(insurance)?.name).toContain("Professional Liability")
  })
})

describe("HoldingCompanyTemplate", () => {
  it("has correct template type", () => {
    expect(HoldingCompanyTemplate.templateType).toBe("HoldingCompany")
  })

  it("has investment in subsidiaries accounts", () => {
    const subsidiaries = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("1500"))
    const subA = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("1510"))
    const subB = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("1520"))

    expect(Option.isSome(subsidiaries)).toBe(true)
    expect(Option.isSome(subA)).toBe(true)
    expect(Option.isSome(subB)).toBe(true)
    expect(Option.getOrNull(subsidiaries)?.name).toContain("Subsidiaries")
  })

  it("has intercompany receivable accounts", () => {
    const icReceivables = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("1200"))
    expect(Option.isSome(icReceivables)).toBe(true)
    expect(Option.getOrNull(icReceivables)?.isIntercompany).toBe(true)
  })

  it("has intercompany payable accounts", () => {
    const icPayables = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("2200"))
    expect(Option.isSome(icPayables)).toBe(true)
    expect(Option.getOrNull(icPayables)?.isIntercompany).toBe(true)
  })

  it("has dividend income accounts by subsidiary", () => {
    const dividendA = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("4010"))
    const dividendB = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("4020"))

    expect(Option.isSome(dividendA)).toBe(true)
    expect(Option.isSome(dividendB)).toBe(true)
    expect(Option.getOrNull(dividendA)?.name).toContain("Dividend")
    expect(Option.getOrNull(dividendA)?.isIntercompany).toBe(true)
  })

  it("has equity in earnings of subsidiaries account", () => {
    const equityEarnings = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("4300"))
    expect(Option.isSome(equityEarnings)).toBe(true)
    expect(Option.getOrNull(equityEarnings)?.name).toContain("Equity in Earnings")
  })

  it("has marketable securities accounts", () => {
    const securities = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("1700"))
    const afs = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("1710"))
    const htm = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("1720"))

    expect(Option.isSome(securities)).toBe(true)
    expect(Option.isSome(afs)).toBe(true)
    expect(Option.isSome(htm)).toBe(true)
  })

  it("has accumulated OCI sub-accounts", () => {
    const aoci = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("3500"))
    const unrealized = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("3510"))
    const cta = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("3520"))

    expect(Option.isSome(aoci)).toBe(true)
    expect(Option.isSome(unrealized)).toBe(true)
    expect(Option.isSome(cta)).toBe(true)
    expect(Option.getOrNull(cta)?.name).toContain("Translation")
  })

  it("has limited operating expenses", () => {
    // Holding companies typically have minimal operating expenses
    const expenses = HoldingCompanyTemplate.getAccountsByType("Expense")
    const operatingExpenses = Chunk.filter(expenses, (acc) => acc.accountCategory === "OperatingExpense")
    expect(Chunk.size(operatingExpenses)).toBeLessThan(15)
  })

  it("has intercompany interest accounts", () => {
    const icInterestIncome = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("8010"))
    const icInterestExpense = HoldingCompanyTemplate.findByAccountNumber(AccountNumber.make("8110"))

    expect(Option.isSome(icInterestIncome)).toBe(true)
    expect(Option.isSome(icInterestExpense)).toBe(true)
    expect(Option.getOrNull(icInterestIncome)?.isIntercompany).toBe(true)
    expect(Option.getOrNull(icInterestExpense)?.isIntercompany).toBe(true)
  })
})

describe("getTemplateByType", () => {
  it("returns GeneralBusinessTemplate for GeneralBusiness", () => {
    const template = getTemplateByType("GeneralBusiness")
    expect(template).toBe(GeneralBusinessTemplate)
  })

  it("returns ManufacturingTemplate for Manufacturing", () => {
    const template = getTemplateByType("Manufacturing")
    expect(template).toBe(ManufacturingTemplate)
  })

  it("returns ServiceBusinessTemplate for ServiceBusiness", () => {
    const template = getTemplateByType("ServiceBusiness")
    expect(template).toBe(ServiceBusinessTemplate)
  })

  it("returns HoldingCompanyTemplate for HoldingCompany", () => {
    const template = getTemplateByType("HoldingCompany")
    expect(template).toBe(HoldingCompanyTemplate)
  })
})

describe("getAllTemplates", () => {
  it("returns all four templates", () => {
    const templates = getAllTemplates()
    expect(templates.length).toBe(4)
  })

  it("includes all template types", () => {
    const templates = getAllTemplates()
    const types = Arr.map(templates, (t) => t.templateType)

    expect(types).toContain("GeneralBusiness")
    expect(types).toContain("Manufacturing")
    expect(types).toContain("ServiceBusiness")
    expect(types).toContain("HoldingCompany")
  })
})

describe("instantiateTemplate", () => {
  const companyId = CompanyId.make("550e8400-e29b-41d4-a716-446655440000")
  let idCounter = 0

  const mockIdGenerator = (): AccountId => {
    idCounter++
    const uuid = `550e8400-e29b-41d4-a716-${idCounter.toString().padStart(12, "0")}`
    return AccountId.make(uuid)
  }

  beforeEach(() => {
    idCounter = 0
  })

  it("creates Account entities from template", () => {
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)

    expect(Chunk.size(accounts)).toBe(GeneralBusinessTemplate.accountCount)
    expect(Chunk.every(accounts, (acc) => acc.companyId === companyId)).toBe(true)
  })

  it("assigns unique IDs to each account", () => {
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)

    const ids = Chunk.map(accounts, (acc) => acc.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(Chunk.size(accounts))
  })

  it("resolves parent-child relationships", () => {
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)

    // Find a child account and verify its parent exists
    const pettyCash = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "1030")
    expect(Option.isSome(pettyCash)).toBe(true)

    const pettyCashAcc = Option.getOrThrow(pettyCash)
    expect(Option.isSome(pettyCashAcc.parentAccountId)).toBe(true)

    // Verify the parent account exists
    const parentId = Option.getOrThrow(pettyCashAcc.parentAccountId)
    const parent = Chunk.findFirst(accounts, (acc) => acc.id === parentId)
    expect(Option.isSome(parent)).toBe(true)
    expect(Option.getOrNull(parent)?.accountNumber).toBe("1000")
  })

  it("calculates correct hierarchy levels", () => {
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)

    // Root level account
    const cash = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "1000")
    expect(Option.getOrNull(cash)?.hierarchyLevel).toBe(1)

    // Second level account
    const pettyCash = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "1030")
    expect(Option.getOrNull(pettyCash)?.hierarchyLevel).toBe(2)
  })

  it("sets correct normal balance from effective balance", () => {
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)

    // Standard asset - Debit
    const cash = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "1010")
    expect(Option.getOrNull(cash)?.normalBalance).toBe("Debit")

    // Contra asset - Credit
    const allowance = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "1110")
    expect(Option.getOrNull(allowance)?.normalBalance).toBe("Credit")

    // Revenue - Credit
    const revenue = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "4000")
    expect(Option.getOrNull(revenue)?.normalBalance).toBe("Credit")
  })

  it("sets all accounts as active", () => {
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)
    expect(Chunk.every(accounts, (acc) => acc.isActive)).toBe(true)
  })

  it("sets intercompany partner and currency restriction to None", () => {
    const accounts = instantiateTemplate(HoldingCompanyTemplate, companyId, mockIdGenerator)

    // Even intercompany accounts should have None for partner
    const icReceivable = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "1210")
    expect(Option.getOrNull(icReceivable)?.isIntercompany).toBe(true)
    expect(Option.isNone(Option.getOrNull(icReceivable)?.intercompanyPartnerId ?? Option.none())).toBe(true)
  })

  it("preserves cash flow settings", () => {
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)

    const cash = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "1010")
    expect(Option.getOrNull(cash)?.isCashFlowRelevant).toBe(true)
    expect(Option.getOrNull(cash)?.cashFlowCategory).toEqual(Option.some("Operating"))

    const depreciation = Chunk.findFirst(accounts, (acc) => acc.accountNumber === "7000")
    expect(Option.getOrNull(depreciation)?.isCashFlowRelevant).toBe(false)
  })

  it("sets timestamp on all accounts", () => {
    const before = Date.now()
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId, mockIdGenerator)
    const after = Date.now()

    for (const acc of accounts) {
      expect(acc.createdAt.epochMillis).toBeGreaterThanOrEqual(before)
      expect(acc.createdAt.epochMillis).toBeLessThanOrEqual(after)
    }
  })

  it("works with default ID generator", () => {
    // This uses crypto.randomUUID
    const accounts = instantiateTemplate(GeneralBusinessTemplate, companyId)
    expect(Chunk.size(accounts)).toBe(GeneralBusinessTemplate.accountCount)

    // All IDs should be valid UUIDs
    for (const acc of accounts) {
      expect(acc.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })
})

describe("instantiateTemplateEffect", () => {
  const companyId = CompanyId.make("550e8400-e29b-41d4-a716-446655440000")
  let idCounter = 0

  const mockIdGeneratorEffect = Effect.sync(() => {
    idCounter++
    const uuid = `550e8400-e29b-41d4-a716-${idCounter.toString().padStart(12, "0")}`
    return AccountId.make(uuid)
  })

  beforeEach(() => {
    idCounter = 0
  })

  it.effect("creates Account entities from template", () =>
    Effect.gen(function* () {
      const accounts = yield* instantiateTemplateEffect(
        GeneralBusinessTemplate,
        companyId,
        mockIdGeneratorEffect
      )

      expect(accounts.length).toBe(GeneralBusinessTemplate.accountCount)
    })
  )

  it.effect("resolves parent-child relationships", () =>
    Effect.gen(function* () {
      const accounts = yield* instantiateTemplateEffect(
        GeneralBusinessTemplate,
        companyId,
        mockIdGeneratorEffect
      )

      // Find a child account and verify its parent exists
      const pettyCash = Arr.findFirst(accounts, (acc) => acc.accountNumber === "1030")
      expect(Option.isSome(pettyCash)).toBe(true)

      const pettyCashAcc = Option.getOrThrow(pettyCash)
      expect(Option.isSome(pettyCashAcc.parentAccountId)).toBe(true)

      const parentId = Option.getOrThrow(pettyCashAcc.parentAccountId)
      const parent = Arr.findFirst(accounts, (acc) => acc.id === parentId)
      expect(Option.isSome(parent)).toBe(true)
    })
  )

  it.effect("propagates errors from ID generator", () =>
    Effect.gen(function* () {
      const failingGenerator = Effect.fail("ID generation failed" as const)

      const result = yield* Effect.exit(
        instantiateTemplateEffect(GeneralBusinessTemplate, companyId, failingGenerator)
      )

      expect(Exit.isFailure(result)).toBe(true)
    })
  )
})

describe("Template account validation", () => {
  describe("all templates have valid account numbers", () => {
    const templates = getAllTemplates()

    for (const template of templates) {
      it(`${template.name} has valid account numbers`, () => {
        for (const acc of template.accounts) {
          expect(acc.accountNumber).toMatch(/^[1-9]\d{3}$/)
        }
      })
    }
  })

  describe("all templates have unique account numbers", () => {
    const templates = getAllTemplates()

    for (const template of templates) {
      it(`${template.name} has unique account numbers`, () => {
        const numbers = Chunk.map(template.accounts, (acc) => acc.accountNumber)
        const uniqueNumbers = new Set(numbers)
        expect(uniqueNumbers.size).toBe(Chunk.size(numbers))
      })
    }
  })

  describe("parent references are valid", () => {
    const templates = getAllTemplates()

    for (const template of templates) {
      it(`${template.name} has valid parent references`, () => {
        const accountNumbers = new Set(Chunk.map(template.accounts, (acc) => acc.accountNumber))

        for (const acc of template.accounts) {
          if (Option.isSome(acc.parentAccountNumber)) {
            const parentNumber = Option.getOrThrow(acc.parentAccountNumber)
            expect(accountNumbers.has(parentNumber)).toBe(true)
          }
        }
      })
    }
  })

  describe("account types match number ranges", () => {
    const templates = getAllTemplates()

    for (const template of templates) {
      it(`${template.name} has account types matching number ranges`, () => {
        for (const acc of template.accounts) {
          const num = parseInt(acc.accountNumber, 10)

          if (num >= 1000 && num <= 1999) {
            expect(acc.accountType).toBe("Asset")
          } else if (num >= 2000 && num <= 2999) {
            expect(acc.accountType).toBe("Liability")
          } else if (num >= 3000 && num <= 3999) {
            expect(acc.accountType).toBe("Equity")
          } else if (num >= 4000 && num <= 4999) {
            expect(acc.accountType).toBe("Revenue")
          } else if (num >= 5000 && num <= 7999) {
            expect(acc.accountType).toBe("Expense")
          } else if (num >= 8000 && num <= 8999) {
            // Other income/expense can be either Revenue or Expense
            expect(["Revenue", "Expense"]).toContain(acc.accountType)
          }
        }
      })
    }
  })
})
