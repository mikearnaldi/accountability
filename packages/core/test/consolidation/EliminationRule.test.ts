import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option, Chunk, BigDecimal } from "effect"
import * as Schema from "effect/Schema"
import {
  EliminationType,
  isEliminationType,
  AccountSelectorById,
  isAccountSelectorById,
  AccountSelectorByRange,
  isAccountSelectorByRange,
  AccountSelectorByCategory,
  isAccountSelectorByCategory,
  AccountSelector,
  isAccountSelector,
  TriggerCondition,
  isTriggerCondition,
  EliminationRule,
  isEliminationRule
} from "../../src/consolidation/EliminationRule.ts"
import type { AccountCategory } from "../../src/accounting/Account.ts";
import { AccountId } from "../../src/accounting/Account.ts"
import { AccountNumber } from "../../src/accounting/AccountNumber.ts"
import { ConsolidationGroupId, EliminationRuleId } from "../../src/consolidation/ConsolidationGroup.ts"

describe("EliminationType", () => {
  const validTypes: Array<typeof EliminationType.Type> = [
    "IntercompanyReceivablePayable",
    "IntercompanyRevenueExpense",
    "IntercompanyDividend",
    "IntercompanyInvestment",
    "UnrealizedProfitInventory",
    "UnrealizedProfitFixedAssets"
  ]

  describe("validation", () => {
    it.effect("accepts all valid elimination types", () =>
      Effect.gen(function* () {
        for (const type of validTypes) {
          const decoded = yield* Schema.decodeUnknown(EliminationType)(type)
          expect(decoded).toBe(type)
        }
      })
    )

    it.effect("rejects invalid elimination type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationType)
        const result = yield* Effect.exit(decode("InvalidType"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationType)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationType)
        const result = yield* Effect.exit(decode(123))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isEliminationType returns true for valid types", () => {
      for (const type of validTypes) {
        expect(isEliminationType(type)).toBe(true)
      }
    })

    it("isEliminationType returns false for invalid values", () => {
      expect(isEliminationType("InvalidType")).toBe(false)
      expect(isEliminationType(null)).toBe(false)
      expect(isEliminationType(undefined)).toBe(false)
      expect(isEliminationType(123)).toBe(false)
    })
  })
})

describe("AccountSelectorById", () => {
  const validAccountUUID = "550e8400-e29b-41d4-a716-446655440000"

  describe("validation", () => {
    it.effect("accepts valid account ID", () =>
      Effect.gen(function* () {
        const selector = AccountSelectorById.make({
          accountId: AccountId.make(validAccountUUID)
        })
        expect(selector.accountId).toBe(validAccountUUID)
        expect(selector._tag).toBe("ById")
      })
    )

    it.effect("rejects invalid account ID", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountSelectorById)
        const result = yield* Effect.exit(decode({
          _tag: "ById",
          accountId: "invalid-id"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAccountSelectorById returns true for AccountSelectorById instances", () => {
      const selector = AccountSelectorById.make({
        accountId: AccountId.make(validAccountUUID)
      })
      expect(isAccountSelectorById(selector)).toBe(true)
    })

    it("isAccountSelectorById returns false for other selectors", () => {
      const rangeSelector = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("1000"),
        toAccountNumber: AccountNumber.make("1999")
      })
      expect(isAccountSelectorById(rangeSelector)).toBe(false)
    })

    it("isAccountSelectorById returns false for non-selector values", () => {
      expect(isAccountSelectorById(null)).toBe(false)
      expect(isAccountSelectorById(undefined)).toBe(false)
      expect(isAccountSelectorById({ accountId: validAccountUUID })).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for AccountSelectorById", () => {
      const selector1 = AccountSelectorById.make({
        accountId: AccountId.make(validAccountUUID)
      })
      const selector2 = AccountSelectorById.make({
        accountId: AccountId.make(validAccountUUID)
      })
      const anotherUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
      const selector3 = AccountSelectorById.make({
        accountId: AccountId.make(anotherUUID)
      })

      expect(Equal.equals(selector1, selector2)).toBe(true)
      expect(Equal.equals(selector1, selector3)).toBe(false)
    })
  })
})

describe("AccountSelectorByRange", () => {
  describe("validation", () => {
    it.effect("accepts valid account number range", () =>
      Effect.gen(function* () {
        const selector = AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("1000"),
          toAccountNumber: AccountNumber.make("1999")
        })
        expect(selector.fromAccountNumber).toBe("1000")
        expect(selector.toAccountNumber).toBe("1999")
        expect(selector._tag).toBe("ByRange")
      })
    )

    it.effect("accepts same from and to (single account)", () =>
      Effect.gen(function* () {
        const selector = AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("1000"),
          toAccountNumber: AccountNumber.make("1000")
        })
        expect(selector.fromAccountNumber).toBe("1000")
        expect(selector.toAccountNumber).toBe("1000")
      })
    )

    it.effect("accepts inverted range (from > to)", () =>
      Effect.gen(function* () {
        // The schema allows this - business logic may need to handle it
        const selector = AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("2000"),
          toAccountNumber: AccountNumber.make("1000")
        })
        expect(selector.fromAccountNumber).toBe("2000")
        expect(selector.toAccountNumber).toBe("1000")
      })
    )

    it.effect("rejects invalid from account number", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountSelectorByRange)
        const result = yield* Effect.exit(decode({
          _tag: "ByRange",
          fromAccountNumber: "invalid",
          toAccountNumber: "1999"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid to account number", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountSelectorByRange)
        const result = yield* Effect.exit(decode({
          _tag: "ByRange",
          fromAccountNumber: "1000",
          toAccountNumber: "invalid"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("isInRange", () => {
    it("returns true for account number within range", () => {
      const selector = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("1000"),
        toAccountNumber: AccountNumber.make("1999")
      })
      expect(selector.isInRange(AccountNumber.make("1000"))).toBe(true)
      expect(selector.isInRange(AccountNumber.make("1500"))).toBe(true)
      expect(selector.isInRange(AccountNumber.make("1999"))).toBe(true)
    })

    it("returns false for account number outside range", () => {
      const selector = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("2000"),
        toAccountNumber: AccountNumber.make("2999")
      })
      expect(selector.isInRange(AccountNumber.make("1999"))).toBe(false)
      expect(selector.isInRange(AccountNumber.make("3000"))).toBe(false)
    })

    it("works for single account range", () => {
      const selector = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("1000"),
        toAccountNumber: AccountNumber.make("1000")
      })
      expect(selector.isInRange(AccountNumber.make("1000"))).toBe(true)
      expect(selector.isInRange(AccountNumber.make("1001"))).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isAccountSelectorByRange returns true for AccountSelectorByRange instances", () => {
      const selector = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("1000"),
        toAccountNumber: AccountNumber.make("1999")
      })
      expect(isAccountSelectorByRange(selector)).toBe(true)
    })

    it("isAccountSelectorByRange returns false for other selectors", () => {
      const byIdSelector = AccountSelectorById.make({
        accountId: AccountId.make("550e8400-e29b-41d4-a716-446655440000")
      })
      expect(isAccountSelectorByRange(byIdSelector)).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for AccountSelectorByRange", () => {
      const selector1 = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("1000"),
        toAccountNumber: AccountNumber.make("1999")
      })
      const selector2 = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("1000"),
        toAccountNumber: AccountNumber.make("1999")
      })
      const selector3 = AccountSelectorByRange.make({
        fromAccountNumber: AccountNumber.make("2000"),
        toAccountNumber: AccountNumber.make("2999")
      })

      expect(Equal.equals(selector1, selector2)).toBe(true)
      expect(Equal.equals(selector1, selector3)).toBe(false)
    })
  })
})

describe("AccountSelectorByCategory", () => {
  const validCategories: Array<typeof AccountCategory.Type> = [
    "CurrentAsset",
    "NonCurrentAsset",
    "FixedAsset",
    "IntangibleAsset",
    "CurrentLiability",
    "NonCurrentLiability",
    "ContributedCapital",
    "RetainedEarnings",
    "OtherComprehensiveIncome",
    "TreasuryStock",
    "OperatingRevenue",
    "OtherRevenue",
    "CostOfGoodsSold",
    "OperatingExpense",
    "DepreciationAmortization",
    "InterestExpense",
    "TaxExpense",
    "OtherExpense"
  ]

  describe("validation", () => {
    it.effect("accepts all valid account categories", () =>
      Effect.gen(function* () {
        for (const category of validCategories) {
          const selector = AccountSelectorByCategory.make({ category })
          expect(selector.category).toBe(category)
          expect(selector._tag).toBe("ByCategory")
        }
      })
    )

    it.effect("rejects invalid category", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AccountSelectorByCategory)
        const result = yield* Effect.exit(decode({
          _tag: "ByCategory",
          category: "InvalidCategory"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAccountSelectorByCategory returns true for AccountSelectorByCategory instances", () => {
      const selector = AccountSelectorByCategory.make({
        category: "CurrentAsset"
      })
      expect(isAccountSelectorByCategory(selector)).toBe(true)
    })

    it("isAccountSelectorByCategory returns false for other selectors", () => {
      const byIdSelector = AccountSelectorById.make({
        accountId: AccountId.make("550e8400-e29b-41d4-a716-446655440000")
      })
      expect(isAccountSelectorByCategory(byIdSelector)).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for AccountSelectorByCategory", () => {
      const selector1 = AccountSelectorByCategory.make({ category: "CurrentAsset" })
      const selector2 = AccountSelectorByCategory.make({ category: "CurrentAsset" })
      const selector3 = AccountSelectorByCategory.make({ category: "CurrentLiability" })

      expect(Equal.equals(selector1, selector2)).toBe(true)
      expect(Equal.equals(selector1, selector3)).toBe(false)
    })
  })
})

describe("AccountSelector", () => {
  const validAccountUUID = "550e8400-e29b-41d4-a716-446655440000"

  describe("union behavior", () => {
    it.effect("accepts AccountSelectorById", () =>
      Effect.gen(function* () {
        const selector = AccountSelectorById.make({
          accountId: AccountId.make(validAccountUUID)
        })
        expect(isAccountSelector(selector)).toBe(true)
      })
    )

    it.effect("accepts AccountSelectorByRange", () =>
      Effect.gen(function* () {
        const selector = AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("1000"),
          toAccountNumber: AccountNumber.make("1999")
        })
        expect(isAccountSelector(selector)).toBe(true)
      })
    )

    it.effect("accepts AccountSelectorByCategory", () =>
      Effect.gen(function* () {
        const selector = AccountSelectorByCategory.make({
          category: "CurrentAsset"
        })
        expect(isAccountSelector(selector)).toBe(true)
      })
    )
  })

  describe("encoding and decoding", () => {
    it.effect("encodes and decodes ById selector", () =>
      Effect.gen(function* () {
        const original = AccountSelectorById.make({
          accountId: AccountId.make(validAccountUUID)
        })
        const encoded = yield* Schema.encode(AccountSelector)(original)
        const decoded = yield* Schema.decodeUnknown(AccountSelector)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
        expect(decoded._tag).toBe("ById")
      })
    )

    it.effect("encodes and decodes ByRange selector", () =>
      Effect.gen(function* () {
        const original = AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("1000"),
          toAccountNumber: AccountNumber.make("1999")
        })
        const encoded = yield* Schema.encode(AccountSelector)(original)
        const decoded = yield* Schema.decodeUnknown(AccountSelector)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
        expect(decoded._tag).toBe("ByRange")
      })
    )

    it.effect("encodes and decodes ByCategory selector", () =>
      Effect.gen(function* () {
        const original = AccountSelectorByCategory.make({
          category: "CurrentAsset"
        })
        const encoded = yield* Schema.encode(AccountSelector)(original)
        const decoded = yield* Schema.decodeUnknown(AccountSelector)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
        expect(decoded._tag).toBe("ByCategory")
      })
    )
  })
})

describe("TriggerCondition", () => {
  const validAccountUUID = "550e8400-e29b-41d4-a716-446655440000"

  const createTriggerWithSourceAccounts = () => {
    return TriggerCondition.make({
      description: "Match intercompany receivables",
      sourceAccounts: Chunk.make(
        AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("9000"),
          toAccountNumber: AccountNumber.make("9099")
        })
      ),
      minimumAmount: Option.none()
    })
  }

  const createTriggerWithMinAmount = () => {
    return TriggerCondition.make({
      description: "Match large transactions",
      sourceAccounts: Chunk.make(
        AccountSelectorById.make({
          accountId: AccountId.make(validAccountUUID)
        })
      ),
      minimumAmount: Option.some(BigDecimal.unsafeFromString("10000"))
    })
  }

  describe("validation", () => {
    it.effect("accepts valid trigger condition without minimum amount", () =>
      Effect.gen(function* () {
        const trigger = createTriggerWithSourceAccounts()
        expect(trigger.description).toBe("Match intercompany receivables")
        expect(Chunk.size(trigger.sourceAccounts)).toBe(1)
        expect(Option.isNone(trigger.minimumAmount)).toBe(true)
      })
    )

    it.effect("accepts valid trigger condition with minimum amount", () =>
      Effect.gen(function* () {
        const trigger = createTriggerWithMinAmount()
        expect(trigger.description).toBe("Match large transactions")
        expect(Option.isSome(trigger.minimumAmount)).toBe(true)
      })
    )

    it.effect("accepts trigger with empty source accounts", () =>
      Effect.gen(function* () {
        const trigger = TriggerCondition.make({
          description: "Manual trigger",
          sourceAccounts: Chunk.empty(),
          minimumAmount: Option.none()
        })
        expect(Chunk.isEmpty(trigger.sourceAccounts)).toBe(true)
      })
    )

    it.effect("accepts trigger with multiple source account selectors", () =>
      Effect.gen(function* () {
        const trigger = TriggerCondition.make({
          description: "Multiple account types",
          sourceAccounts: Chunk.make(
            AccountSelectorByRange.make({
              fromAccountNumber: AccountNumber.make("9000"),
              toAccountNumber: AccountNumber.make("9099")
            }),
            AccountSelectorByCategory.make({ category: "CurrentAsset" }),
            AccountSelectorById.make({
              accountId: AccountId.make(validAccountUUID)
            })
          ),
          minimumAmount: Option.none()
        })
        expect(Chunk.size(trigger.sourceAccounts)).toBe(3)
      })
    )

    it.effect("rejects empty description", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(TriggerCondition)
        const result = yield* Effect.exit(decode({
          description: "",
          sourceAccounts: [],
          minimumAmount: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties", () => {
    it("sourceAccountCount returns correct count", () => {
      const trigger = createTriggerWithSourceAccounts()
      expect(trigger.sourceAccountCount).toBe(1)
    })

    it("sourceAccountCount returns 0 for empty", () => {
      const trigger = TriggerCondition.make({
        description: "Empty",
        sourceAccounts: Chunk.empty(),
        minimumAmount: Option.none()
      })
      expect(trigger.sourceAccountCount).toBe(0)
    })

    it("hasSourceAccounts returns true when accounts exist", () => {
      const trigger = createTriggerWithSourceAccounts()
      expect(trigger.hasSourceAccounts).toBe(true)
    })

    it("hasSourceAccounts returns false when empty", () => {
      const trigger = TriggerCondition.make({
        description: "Empty",
        sourceAccounts: Chunk.empty(),
        minimumAmount: Option.none()
      })
      expect(trigger.hasSourceAccounts).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isTriggerCondition returns true for TriggerCondition instances", () => {
      const trigger = createTriggerWithSourceAccounts()
      expect(isTriggerCondition(trigger)).toBe(true)
    })

    it("isTriggerCondition returns false for plain objects", () => {
      expect(isTriggerCondition({
        description: "Test",
        sourceAccounts: [],
        minimumAmount: null
      })).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for TriggerCondition", () => {
      const trigger1 = createTriggerWithSourceAccounts()
      const trigger2 = createTriggerWithSourceAccounts()
      const trigger3 = createTriggerWithMinAmount()

      expect(Equal.equals(trigger1, trigger2)).toBe(true)
      expect(Equal.equals(trigger1, trigger3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes TriggerCondition", () =>
      Effect.gen(function* () {
        const original = createTriggerWithSourceAccounts()
        const encoded = yield* Schema.encode(TriggerCondition)(original)
        const decoded = yield* Schema.decodeUnknown(TriggerCondition)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes TriggerCondition with minimum amount", () =>
      Effect.gen(function* () {
        const original = createTriggerWithMinAmount()
        const encoded = yield* Schema.encode(TriggerCondition)(original)
        const decoded = yield* Schema.decodeUnknown(TriggerCondition)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )
  })
})

describe("EliminationRule", () => {
  const ruleUUID = "550e8400-e29b-41d4-a716-446655440000"
  const groupUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const debitAccountUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const creditAccountUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createReceivablePayableRule = () => {
    return EliminationRule.make({
      id: EliminationRuleId.make(ruleUUID),
      consolidationGroupId: ConsolidationGroupId.make(groupUUID),
      name: "Eliminate Intercompany Receivables/Payables",
      description: Option.some("Eliminates AR/AP balances between group companies"),
      eliminationType: "IntercompanyReceivablePayable",
      triggerConditions: Chunk.make(
        TriggerCondition.make({
          description: "Match intercompany accounts",
          sourceAccounts: Chunk.make(
            AccountSelectorByRange.make({
              fromAccountNumber: AccountNumber.make("9000"),
              toAccountNumber: AccountNumber.make("9099")
            })
          ),
          minimumAmount: Option.none()
        })
      ),
      sourceAccounts: Chunk.make(
        AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("9000"),
          toAccountNumber: AccountNumber.make("9099")
        })
      ),
      targetAccounts: Chunk.make(
        AccountSelectorByRange.make({
          fromAccountNumber: AccountNumber.make("9100"),
          toAccountNumber: AccountNumber.make("9199")
        })
      ),
      debitAccountId: AccountId.make(debitAccountUUID),
      creditAccountId: AccountId.make(creditAccountUUID),
      isAutomatic: true,
      priority: 10,
      isActive: true
    })
  }

  const createRevenueExpenseRule = () => {
    return EliminationRule.make({
      id: EliminationRuleId.make(ruleUUID),
      consolidationGroupId: ConsolidationGroupId.make(groupUUID),
      name: "Eliminate Intercompany Revenue/Expense",
      description: Option.none(),
      eliminationType: "IntercompanyRevenueExpense",
      triggerConditions: Chunk.empty(),
      sourceAccounts: Chunk.make(
        AccountSelectorByCategory.make({ category: "OperatingRevenue" })
      ),
      targetAccounts: Chunk.make(
        AccountSelectorByCategory.make({ category: "OperatingExpense" })
      ),
      debitAccountId: AccountId.make(debitAccountUUID),
      creditAccountId: AccountId.make(creditAccountUUID),
      isAutomatic: false,
      priority: 20,
      isActive: true
    })
  }

  const createDividendRule = () => {
    return EliminationRule.make({
      id: EliminationRuleId.make(ruleUUID),
      consolidationGroupId: ConsolidationGroupId.make(groupUUID),
      name: "Eliminate Intercompany Dividends",
      description: Option.some("Eliminates dividends paid within group"),
      eliminationType: "IntercompanyDividend",
      triggerConditions: Chunk.empty(),
      sourceAccounts: Chunk.empty(),
      targetAccounts: Chunk.empty(),
      debitAccountId: AccountId.make(debitAccountUUID),
      creditAccountId: AccountId.make(creditAccountUUID),
      isAutomatic: true,
      priority: 30,
      isActive: true
    })
  }

  const createInvestmentRule = () => {
    return EliminationRule.make({
      id: EliminationRuleId.make(ruleUUID),
      consolidationGroupId: ConsolidationGroupId.make(groupUUID),
      name: "Eliminate Investment in Subsidiary",
      description: Option.none(),
      eliminationType: "IntercompanyInvestment",
      triggerConditions: Chunk.empty(),
      sourceAccounts: Chunk.empty(),
      targetAccounts: Chunk.empty(),
      debitAccountId: AccountId.make(debitAccountUUID),
      creditAccountId: AccountId.make(creditAccountUUID),
      isAutomatic: false,
      priority: 5,
      isActive: true
    })
  }

  const createUnrealizedInventoryRule = () => {
    return EliminationRule.make({
      id: EliminationRuleId.make(ruleUUID),
      consolidationGroupId: ConsolidationGroupId.make(groupUUID),
      name: "Eliminate Unrealized Profit in Inventory",
      description: Option.none(),
      eliminationType: "UnrealizedProfitInventory",
      triggerConditions: Chunk.empty(),
      sourceAccounts: Chunk.empty(),
      targetAccounts: Chunk.empty(),
      debitAccountId: AccountId.make(debitAccountUUID),
      creditAccountId: AccountId.make(creditAccountUUID),
      isAutomatic: true,
      priority: 50,
      isActive: true
    })
  }

  const createUnrealizedFixedAssetRule = () => {
    return EliminationRule.make({
      id: EliminationRuleId.make(ruleUUID),
      consolidationGroupId: ConsolidationGroupId.make(groupUUID),
      name: "Eliminate Unrealized Profit in Fixed Assets",
      description: Option.none(),
      eliminationType: "UnrealizedProfitFixedAssets",
      triggerConditions: Chunk.empty(),
      sourceAccounts: Chunk.empty(),
      targetAccounts: Chunk.empty(),
      debitAccountId: AccountId.make(debitAccountUUID),
      creditAccountId: AccountId.make(creditAccountUUID),
      isAutomatic: false,
      priority: 150,
      isActive: false
    })
  }

  describe("validation", () => {
    it.effect("accepts valid elimination rule with all properties", () =>
      Effect.gen(function* () {
        const rule = createReceivablePayableRule()
        expect(rule.id).toBe(ruleUUID)
        expect(rule.consolidationGroupId).toBe(groupUUID)
        expect(rule.name).toBe("Eliminate Intercompany Receivables/Payables")
        expect(Option.isSome(rule.description)).toBe(true)
        expect(rule.eliminationType).toBe("IntercompanyReceivablePayable")
        expect(Chunk.size(rule.triggerConditions)).toBe(1)
        expect(Chunk.size(rule.sourceAccounts)).toBe(1)
        expect(Chunk.size(rule.targetAccounts)).toBe(1)
        expect(rule.debitAccountId).toBe(debitAccountUUID)
        expect(rule.creditAccountId).toBe(creditAccountUUID)
        expect(rule.isAutomatic).toBe(true)
        expect(rule.priority).toBe(10)
        expect(rule.isActive).toBe(true)
      })
    )

    it.effect("accepts rule without description", () =>
      Effect.gen(function* () {
        const rule = createRevenueExpenseRule()
        expect(Option.isNone(rule.description)).toBe(true)
      })
    )

    it.effect("accepts rule with empty trigger conditions and accounts", () =>
      Effect.gen(function* () {
        const rule = createDividendRule()
        expect(Chunk.isEmpty(rule.triggerConditions)).toBe(true)
        expect(Chunk.isEmpty(rule.sourceAccounts)).toBe(true)
        expect(Chunk.isEmpty(rule.targetAccounts)).toBe(true)
      })
    )

    it.effect("accepts rule with priority 0", () =>
      Effect.gen(function* () {
        const rule = EliminationRule.make({
          id: EliminationRuleId.make(ruleUUID),
          consolidationGroupId: ConsolidationGroupId.make(groupUUID),
          name: "Highest Priority Rule",
          description: Option.none(),
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: Chunk.empty(),
          sourceAccounts: Chunk.empty(),
          targetAccounts: Chunk.empty(),
          debitAccountId: AccountId.make(debitAccountUUID),
          creditAccountId: AccountId.make(creditAccountUUID),
          isAutomatic: true,
          priority: 0,
          isActive: true
        })
        expect(rule.priority).toBe(0)
      })
    )

    it.effect("accepts inactive rule", () =>
      Effect.gen(function* () {
        const rule = createUnrealizedFixedAssetRule()
        expect(rule.isActive).toBe(false)
      })
    )

    it.effect("rejects invalid rule id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: "invalid-id",
          consolidationGroupId: groupUUID,
          name: "Test Rule",
          description: null,
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: debitAccountUUID,
          creditAccountId: creditAccountUUID,
          isAutomatic: true,
          priority: 10,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid consolidation group id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: ruleUUID,
          consolidationGroupId: "invalid-id",
          name: "Test Rule",
          description: null,
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: debitAccountUUID,
          creditAccountId: creditAccountUUID,
          isAutomatic: true,
          priority: 10,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: ruleUUID,
          consolidationGroupId: groupUUID,
          name: "",
          description: null,
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: debitAccountUUID,
          creditAccountId: creditAccountUUID,
          isAutomatic: true,
          priority: 10,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid elimination type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: ruleUUID,
          consolidationGroupId: groupUUID,
          name: "Test Rule",
          description: null,
          eliminationType: "InvalidType",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: debitAccountUUID,
          creditAccountId: creditAccountUUID,
          isAutomatic: true,
          priority: 10,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid debit account id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: ruleUUID,
          consolidationGroupId: groupUUID,
          name: "Test Rule",
          description: null,
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: "invalid-id",
          creditAccountId: creditAccountUUID,
          isAutomatic: true,
          priority: 10,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid credit account id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: ruleUUID,
          consolidationGroupId: groupUUID,
          name: "Test Rule",
          description: null,
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: debitAccountUUID,
          creditAccountId: "invalid-id",
          isAutomatic: true,
          priority: 10,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects negative priority", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: ruleUUID,
          consolidationGroupId: groupUUID,
          name: "Test Rule",
          description: null,
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: debitAccountUUID,
          creditAccountId: creditAccountUUID,
          isAutomatic: true,
          priority: -1,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-integer priority", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EliminationRule)
        const result = yield* Effect.exit(decode({
          id: ruleUUID,
          consolidationGroupId: groupUUID,
          name: "Test Rule",
          description: null,
          eliminationType: "IntercompanyReceivablePayable",
          triggerConditions: [],
          sourceAccounts: [],
          targetAccounts: [],
          debitAccountId: debitAccountUUID,
          creditAccountId: creditAccountUUID,
          isAutomatic: true,
          priority: 10.5,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties - elimination type checks", () => {
    it("isReceivablePayableElimination returns true for IntercompanyReceivablePayable", () => {
      const rule = createReceivablePayableRule()
      expect(rule.isReceivablePayableElimination).toBe(true)
      expect(rule.isRevenueExpenseElimination).toBe(false)
      expect(rule.isDividendElimination).toBe(false)
      expect(rule.isInvestmentElimination).toBe(false)
      expect(rule.isUnrealizedInventoryElimination).toBe(false)
      expect(rule.isUnrealizedFixedAssetElimination).toBe(false)
    })

    it("isRevenueExpenseElimination returns true for IntercompanyRevenueExpense", () => {
      const rule = createRevenueExpenseRule()
      expect(rule.isRevenueExpenseElimination).toBe(true)
      expect(rule.isReceivablePayableElimination).toBe(false)
    })

    it("isDividendElimination returns true for IntercompanyDividend", () => {
      const rule = createDividendRule()
      expect(rule.isDividendElimination).toBe(true)
      expect(rule.isReceivablePayableElimination).toBe(false)
    })

    it("isInvestmentElimination returns true for IntercompanyInvestment", () => {
      const rule = createInvestmentRule()
      expect(rule.isInvestmentElimination).toBe(true)
      expect(rule.isReceivablePayableElimination).toBe(false)
    })

    it("isUnrealizedInventoryElimination returns true for UnrealizedProfitInventory", () => {
      const rule = createUnrealizedInventoryRule()
      expect(rule.isUnrealizedInventoryElimination).toBe(true)
      expect(rule.isReceivablePayableElimination).toBe(false)
    })

    it("isUnrealizedFixedAssetElimination returns true for UnrealizedProfitFixedAssets", () => {
      const rule = createUnrealizedFixedAssetRule()
      expect(rule.isUnrealizedFixedAssetElimination).toBe(true)
      expect(rule.isReceivablePayableElimination).toBe(false)
    })

    it("isUnrealizedProfitElimination returns true for unrealized profit types", () => {
      expect(createUnrealizedInventoryRule().isUnrealizedProfitElimination).toBe(true)
      expect(createUnrealizedFixedAssetRule().isUnrealizedProfitElimination).toBe(true)
      expect(createReceivablePayableRule().isUnrealizedProfitElimination).toBe(false)
    })

    it("isBalanceElimination returns true for receivable/payable", () => {
      expect(createReceivablePayableRule().isBalanceElimination).toBe(true)
      expect(createRevenueExpenseRule().isBalanceElimination).toBe(false)
    })

    it("isIncomeStatementElimination returns true for revenue/expense and dividend", () => {
      expect(createRevenueExpenseRule().isIncomeStatementElimination).toBe(true)
      expect(createDividendRule().isIncomeStatementElimination).toBe(true)
      expect(createReceivablePayableRule().isIncomeStatementElimination).toBe(false)
    })
  })

  describe("computed properties - processing checks", () => {
    it("requiresManualProcessing returns correct value", () => {
      expect(createReceivablePayableRule().requiresManualProcessing).toBe(false) // isAutomatic: true
      expect(createRevenueExpenseRule().requiresManualProcessing).toBe(true) // isAutomatic: false
    })

    it("isReadyForProcessing returns correct value", () => {
      expect(createReceivablePayableRule().isReadyForProcessing).toBe(true) // isActive: true
      expect(createUnrealizedFixedAssetRule().isReadyForProcessing).toBe(false) // isActive: false
    })
  })

  describe("computed properties - description checks", () => {
    it("hasDescription returns true when description exists", () => {
      expect(createReceivablePayableRule().hasDescription).toBe(true)
    })

    it("hasDescription returns false when description is none", () => {
      expect(createRevenueExpenseRule().hasDescription).toBe(false)
    })
  })

  describe("computed properties - trigger condition checks", () => {
    it("triggerConditionCount returns correct count", () => {
      expect(createReceivablePayableRule().triggerConditionCount).toBe(1)
      expect(createRevenueExpenseRule().triggerConditionCount).toBe(0)
    })

    it("hasTriggerConditions returns correct value", () => {
      expect(createReceivablePayableRule().hasTriggerConditions).toBe(true)
      expect(createRevenueExpenseRule().hasTriggerConditions).toBe(false)
    })
  })

  describe("computed properties - account selector checks", () => {
    it("sourceAccountCount returns correct count", () => {
      expect(createReceivablePayableRule().sourceAccountCount).toBe(1)
      expect(createDividendRule().sourceAccountCount).toBe(0)
    })

    it("hasSourceAccounts returns correct value", () => {
      expect(createReceivablePayableRule().hasSourceAccounts).toBe(true)
      expect(createDividendRule().hasSourceAccounts).toBe(false)
    })

    it("targetAccountCount returns correct count", () => {
      expect(createReceivablePayableRule().targetAccountCount).toBe(1)
      expect(createDividendRule().targetAccountCount).toBe(0)
    })

    it("hasTargetAccounts returns correct value", () => {
      expect(createReceivablePayableRule().hasTargetAccounts).toBe(true)
      expect(createDividendRule().hasTargetAccounts).toBe(false)
    })
  })

  describe("computed properties - priority checks", () => {
    it("isHighPriority returns true for priority <= 10", () => {
      expect(createReceivablePayableRule().isHighPriority).toBe(true) // priority: 10
      expect(createInvestmentRule().isHighPriority).toBe(true) // priority: 5
      expect(createRevenueExpenseRule().isHighPriority).toBe(false) // priority: 20
    })

    it("isLowPriority returns true for priority > 100", () => {
      expect(createUnrealizedFixedAssetRule().isLowPriority).toBe(true) // priority: 150
      expect(createReceivablePayableRule().isLowPriority).toBe(false) // priority: 10
    })
  })

  describe("type guard", () => {
    it("isEliminationRule returns true for EliminationRule instances", () => {
      const rule = createReceivablePayableRule()
      expect(isEliminationRule(rule)).toBe(true)
    })

    it("isEliminationRule returns false for plain objects", () => {
      expect(isEliminationRule({
        id: ruleUUID,
        consolidationGroupId: groupUUID,
        name: "Test Rule",
        eliminationType: "IntercompanyReceivablePayable"
      })).toBe(false)
    })

    it("isEliminationRule returns false for non-object values", () => {
      expect(isEliminationRule(null)).toBe(false)
      expect(isEliminationRule(undefined)).toBe(false)
      expect(isEliminationRule("rule")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for EliminationRule", () => {
      const rule1 = createReceivablePayableRule()
      const rule2 = createReceivablePayableRule()
      const rule3 = createRevenueExpenseRule()

      expect(Equal.equals(rule1, rule2)).toBe(true)
      expect(Equal.equals(rule1, rule3)).toBe(false)
    })

    it("Equal.equals is false for different priorities", () => {
      const rule1 = createReceivablePayableRule()
      const rule2 = EliminationRule.make({
        id: EliminationRuleId.make(ruleUUID),
        consolidationGroupId: ConsolidationGroupId.make(groupUUID),
        name: "Eliminate Intercompany Receivables/Payables",
        description: Option.some("Eliminates AR/AP balances between group companies"),
        eliminationType: "IntercompanyReceivablePayable",
        triggerConditions: Chunk.make(
          TriggerCondition.make({
            description: "Match intercompany accounts",
            sourceAccounts: Chunk.make(
              AccountSelectorByRange.make({
                fromAccountNumber: AccountNumber.make("9000"),
                toAccountNumber: AccountNumber.make("9099")
              })
            ),
            minimumAmount: Option.none()
          })
        ),
        sourceAccounts: Chunk.make(
          AccountSelectorByRange.make({
            fromAccountNumber: AccountNumber.make("9000"),
            toAccountNumber: AccountNumber.make("9099")
          })
        ),
        targetAccounts: Chunk.make(
          AccountSelectorByRange.make({
            fromAccountNumber: AccountNumber.make("9100"),
            toAccountNumber: AccountNumber.make("9199")
          })
        ),
        debitAccountId: AccountId.make(debitAccountUUID),
        creditAccountId: AccountId.make(creditAccountUUID),
        isAutomatic: true,
        priority: 99, // Different priority
        isActive: true
      })

      expect(Equal.equals(rule1, rule2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes EliminationRule with all properties", () =>
      Effect.gen(function* () {
        const original = createReceivablePayableRule()
        const encoded = yield* Schema.encode(EliminationRule)(original)
        const decoded = yield* Schema.decodeUnknown(EliminationRule)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes EliminationRule without description", () =>
      Effect.gen(function* () {
        const original = createRevenueExpenseRule()
        const encoded = yield* Schema.encode(EliminationRule)(original)
        const decoded = yield* Schema.decodeUnknown(EliminationRule)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes EliminationRule with empty collections", () =>
      Effect.gen(function* () {
        const original = createDividendRule()
        const encoded = yield* Schema.encode(EliminationRule)(original)
        const decoded = yield* Schema.decodeUnknown(EliminationRule)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const rule = createReceivablePayableRule()
        const encoded = yield* Schema.encode(EliminationRule)(rule)

        expect(encoded).toHaveProperty("id", ruleUUID)
        expect(encoded).toHaveProperty("consolidationGroupId", groupUUID)
        expect(encoded).toHaveProperty("name", "Eliminate Intercompany Receivables/Payables")
        expect(encoded).toHaveProperty("eliminationType", "IntercompanyReceivablePayable")
        expect(encoded).toHaveProperty("debitAccountId", debitAccountUUID)
        expect(encoded).toHaveProperty("creditAccountId", creditAccountUUID)
        expect(encoded).toHaveProperty("isAutomatic", true)
        expect(encoded).toHaveProperty("priority", 10)
        expect(encoded).toHaveProperty("isActive", true)
        expect(Array.isArray(encoded.triggerConditions)).toBe(true)
        expect(Array.isArray(encoded.sourceAccounts)).toBe(true)
        expect(Array.isArray(encoded.targetAccounts)).toBe(true)
      })
    )

    it.effect("encodes source accounts correctly", () =>
      Effect.gen(function* () {
        const rule = createReceivablePayableRule()
        const encoded = yield* Schema.encode(EliminationRule)(rule)

        expect(encoded.sourceAccounts).toHaveLength(1)
        expect(encoded.sourceAccounts[0]).toHaveProperty("_tag", "ByRange")
        expect(encoded.sourceAccounts[0]).toHaveProperty("fromAccountNumber", "9000")
        expect(encoded.sourceAccounts[0]).toHaveProperty("toAccountNumber", "9099")
      })
    )

    it.effect("encodes trigger conditions correctly", () =>
      Effect.gen(function* () {
        const rule = createReceivablePayableRule()
        const encoded = yield* Schema.encode(EliminationRule)(rule)

        expect(encoded.triggerConditions).toHaveLength(1)
        expect(encoded.triggerConditions[0]).toHaveProperty("description", "Match intercompany accounts")
        expect(Array.isArray(encoded.triggerConditions[0].sourceAccounts)).toBe(true)
      })
    )
  })

  describe("all elimination types", () => {
    it.effect("creates and validates all elimination types", () =>
      Effect.gen(function* () {
        const types: Array<typeof EliminationType.Type> = [
          "IntercompanyReceivablePayable",
          "IntercompanyRevenueExpense",
          "IntercompanyDividend",
          "IntercompanyInvestment",
          "UnrealizedProfitInventory",
          "UnrealizedProfitFixedAssets"
        ]

        for (const eliminationType of types) {
          const rule = EliminationRule.make({
            id: EliminationRuleId.make(ruleUUID),
            consolidationGroupId: ConsolidationGroupId.make(groupUUID),
            name: `${eliminationType} Rule`,
            description: Option.none(),
            eliminationType,
            triggerConditions: Chunk.empty(),
            sourceAccounts: Chunk.empty(),
            targetAccounts: Chunk.empty(),
            debitAccountId: AccountId.make(debitAccountUUID),
            creditAccountId: AccountId.make(creditAccountUUID),
            isAutomatic: true,
            priority: 10,
            isActive: true
          })
          expect(rule.eliminationType).toBe(eliminationType)
        }
      })
    )
  })

  describe("immutability", () => {
    it("EliminationRule properties are readonly at compile time", () => {
      const rule = createReceivablePayableRule()
      expect(rule.name).toBe("Eliminate Intercompany Receivables/Payables")
      expect(rule.isActive).toBe(true)
      expect(rule.priority).toBe(10)
    })
  })
})
