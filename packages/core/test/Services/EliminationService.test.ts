import { describe, it, expect, beforeEach } from "@effect/vitest"
import { Chunk, Effect, Exit, Layer, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  EliminationService,
  EliminationServiceLive,
  EliminationRepository,
  EliminationEntry,
  EliminationEntryLine,
  EliminationEntryId,
  AccountBalance,
  GenerationResult,
  ConsolidationGroupNotFoundError,
  FiscalPeriodNotFoundError,
  EliminationRuleNotFoundError,
  NoBalancesForEliminationError,
  isConsolidationGroupNotFoundError,
  isFiscalPeriodNotFoundError,
  isEliminationRuleNotFoundError,
  isNoBalancesForEliminationError,
  isEliminationEntryId,
  isEliminationEntry,
  isEliminationEntryLine,
  isAccountBalance,
  isGenerationResult,
  type EliminationRepositoryService
} from "../../src/consolidation/EliminationService.ts"
import { AccountId } from "../../src/accounting/Account.ts"
import { CompanyId } from "../../src/company/Company.ts"
import {
  ConsolidationGroupId,
  EliminationRuleId
} from "../../src/consolidation/ConsolidationGroup.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import {
  EliminationRule,
  type EliminationType,
  AccountSelectorById,
  TriggerCondition
} from "../../src/consolidation/EliminationRule.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import { JournalEntryLineId } from "../../src/journal/JournalEntryLine.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

// =============================================================================
// Test Helpers
// =============================================================================

const makeTimestamp = () => Timestamp.make({ epochMillis: Date.now() })

// UUIDs for testing
const groupUUID = "550e8400-e29b-41d4-a716-446655440000"
const companyAUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const companyBUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
const accountDebitUUID = "9ba7b810-9dad-11d1-80b4-00c04fd430c1"
const accountCreditUUID = "aba7b810-9dad-11d1-80b4-00c04fd430c2"
const accountSourceUUID = "bba7b810-9dad-11d1-80b4-00c04fd430c3"

const groupId = ConsolidationGroupId.make(groupUUID)
const companyAId = CompanyId.make(companyAUUID)
const companyBId = CompanyId.make(companyBUUID)
const accountDebitId = AccountId.make(accountDebitUUID)
const accountCreditId = AccountId.make(accountCreditUUID)
const accountSourceId = AccountId.make(accountSourceUUID)
const periodRef = FiscalPeriodRef.make({ year: 2024, period: 12 })
const testDate = LocalDate.make({ year: 2024, month: 12, day: 31 })
const testCurrency = CurrencyCode.make("USD")

let ruleIdCounter = 0
let entryIdCounter = 0
let lineIdCounter = 0

const makeRuleId = () => {
  ruleIdCounter++
  const hex = ruleIdCounter.toString(16).padStart(12, "0")
  return EliminationRuleId.make(`00000000-0000-0000-0001-${hex}`)
}

const makeEntryId = () => {
  entryIdCounter++
  const hex = entryIdCounter.toString(16).padStart(12, "0")
  return EliminationEntryId.make(`00000000-0000-0000-0002-${hex}`)
}

const makeLineId = () => {
  lineIdCounter++
  const hex = lineIdCounter.toString(16).padStart(12, "0")
  return JournalEntryLineId.make(`00000000-0000-0000-0003-${hex}`)
}

const createEliminationRule = (params: {
  eliminationType: EliminationType
  priority?: number
  isActive?: boolean
  isAutomatic?: boolean
}): EliminationRule => {
  const ruleId = makeRuleId()
  return EliminationRule.make({
    id: ruleId,
    consolidationGroupId: groupId,
    name: `Test Rule ${params.eliminationType}`,
    description: Option.some(`Test elimination rule for ${params.eliminationType}`),
    eliminationType: params.eliminationType,
    triggerConditions: Chunk.of(
      TriggerCondition.make({
        description: "Default trigger",
        sourceAccounts: Chunk.of(
          AccountSelectorById.make({ accountId: accountSourceId })
        ),
        minimumAmount: Option.none()
      })
    ),
    sourceAccounts: Chunk.of(
      AccountSelectorById.make({ accountId: accountSourceId })
    ),
    targetAccounts: Chunk.empty(),
    debitAccountId: accountDebitId,
    creditAccountId: accountCreditId,
    isAutomatic: params.isAutomatic ?? true,
    priority: params.priority ?? 10,
    isActive: params.isActive ?? true
  })
}

const createAccountBalance = (params: {
  accountId?: AccountId
  companyId: CompanyId
  balance: MonetaryAmount
  intercompanyPartnerId?: CompanyId
}): AccountBalance => {
  return AccountBalance.make({
    accountId: params.accountId ?? accountSourceId,
    companyId: params.companyId,
    balance: params.balance,
    intercompanyPartnerId: params.intercompanyPartnerId
      ? Option.some(params.intercompanyPartnerId)
      : Option.none()
  })
}

const createMockRepository = (params: {
  groupExists?: boolean
  periodExists?: boolean
  rules?: Chunk.Chunk<EliminationRule>
  balancesForRule?: (rule: EliminationRule) => Chunk.Chunk<AccountBalance>
  currency?: CurrencyCode
}): EliminationRepositoryService => ({
  groupExists: (_groupId) => Effect.succeed(params.groupExists ?? true),
  periodExists: (_periodRef) => Effect.succeed(params.periodExists ?? true),
  getRulesByGroup: (_groupId) => Effect.succeed(params.rules ?? Chunk.empty()),
  getBalancesForRule: (rule, _periodRef) =>
    Effect.succeed(params.balancesForRule ? params.balancesForRule(rule) : Chunk.empty()),
  getGroupCurrency: (_groupId) => Effect.succeed(params.currency ?? testCurrency),
  getPeriodEndDate: (_periodRef) => Effect.succeed(testDate),
  generateEntryId: () => Effect.succeed(makeEntryId()),
  generateLineId: () => Effect.succeed(makeLineId())
})

const createTestLayer = (params: {
  groupExists?: boolean
  periodExists?: boolean
  rules?: Chunk.Chunk<EliminationRule>
  balancesForRule?: (rule: EliminationRule) => Chunk.Chunk<AccountBalance>
  currency?: CurrencyCode
}) => {
  const repoLayer = Layer.succeed(
    EliminationRepository,
    createMockRepository(params)
  )
  return EliminationServiceLive.pipe(Layer.provide(repoLayer))
}

// =============================================================================
// EliminationEntryId Tests
// =============================================================================

describe("EliminationEntryId", () => {
  it("creates valid entry ID", () => {
    const id = EliminationEntryId.make("550e8400-e29b-41d4-a716-446655440000")
    expect(id).toBeDefined()
  })

  it.effect("rejects invalid UUID format", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        Schema.decodeUnknown(EliminationEntryId)("invalid-uuid")
      )
      expect(Exit.isFailure(result)).toBe(true)
    })
  )

  describe("type guard", () => {
    it("isEliminationEntryId returns true for valid ID", () => {
      const id = EliminationEntryId.make("550e8400-e29b-41d4-a716-446655440000")
      expect(isEliminationEntryId(id)).toBe(true)
    })

    it("isEliminationEntryId returns false for invalid values", () => {
      expect(isEliminationEntryId(null)).toBe(false)
      expect(isEliminationEntryId(undefined)).toBe(false)
      expect(isEliminationEntryId("not-a-uuid")).toBe(false)
    })
  })
})

// =============================================================================
// EliminationEntryLine Tests
// =============================================================================

describe("EliminationEntryLine", () => {
  const amount = MonetaryAmount.unsafeFromString("1000", "USD")

  it("creates debit line", () => {
    const line = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 1,
      accountId: accountDebitId,
      debitAmount: Option.some(amount),
      creditAmount: Option.none(),
      memo: Option.some("Test debit")
    })

    expect(line.isDebit).toBe(true)
    expect(line.isCredit).toBe(false)
    expect(line.amount).toEqual(amount)
  })

  it("creates credit line", () => {
    const line = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 2,
      accountId: accountCreditId,
      debitAmount: Option.none(),
      creditAmount: Option.some(amount),
      memo: Option.none()
    })

    expect(line.isDebit).toBe(false)
    expect(line.isCredit).toBe(true)
    expect(line.amount).toEqual(amount)
  })

  describe("type guard", () => {
    it("isEliminationEntryLine returns true for valid line", () => {
      const line = EliminationEntryLine.make({
        id: makeLineId(),
        lineNumber: 1,
        accountId: accountDebitId,
        debitAmount: Option.some(amount),
        creditAmount: Option.none(),
        memo: Option.none()
      })
      expect(isEliminationEntryLine(line)).toBe(true)
    })

    it("isEliminationEntryLine returns false for invalid values", () => {
      expect(isEliminationEntryLine(null)).toBe(false)
      expect(isEliminationEntryLine(undefined)).toBe(false)
      expect(isEliminationEntryLine({})).toBe(false)
    })
  })
})

// =============================================================================
// AccountBalance Tests
// =============================================================================

describe("AccountBalance", () => {
  const balance = MonetaryAmount.unsafeFromString("5000", "USD")

  it("creates balance without intercompany partner", () => {
    const accountBalance = createAccountBalance({
      companyId: companyAId,
      balance
    })

    expect(accountBalance.accountId).toBe(accountSourceId)
    expect(accountBalance.companyId).toBe(companyAId)
    expect(accountBalance.balance).toEqual(balance)
    expect(Option.isNone(accountBalance.intercompanyPartnerId)).toBe(true)
  })

  it("creates balance with intercompany partner", () => {
    const accountBalance = createAccountBalance({
      companyId: companyAId,
      balance,
      intercompanyPartnerId: companyBId
    })

    expect(Option.isSome(accountBalance.intercompanyPartnerId)).toBe(true)
    expect(Option.getOrThrow(accountBalance.intercompanyPartnerId)).toBe(companyBId)
  })

  describe("type guard", () => {
    it("isAccountBalance returns true for valid balance", () => {
      const accountBalance = createAccountBalance({
        companyId: companyAId,
        balance
      })
      expect(isAccountBalance(accountBalance)).toBe(true)
    })

    it("isAccountBalance returns false for invalid values", () => {
      expect(isAccountBalance(null)).toBe(false)
      expect(isAccountBalance(undefined)).toBe(false)
      expect(isAccountBalance({})).toBe(false)
    })
  })
})

// =============================================================================
// EliminationEntry Tests
// =============================================================================

describe("EliminationEntry", () => {
  const amount = MonetaryAmount.unsafeFromString("1000", "USD")
  const now = makeTimestamp()

  const createTestEntry = (): EliminationEntry => {
    const debitLine = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 1,
      accountId: accountDebitId,
      debitAmount: Option.some(amount),
      creditAmount: Option.none(),
      memo: Option.some("Test debit")
    })

    const creditLine = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 2,
      accountId: accountCreditId,
      debitAmount: Option.none(),
      creditAmount: Option.some(amount),
      memo: Option.some("Test credit")
    })

    return EliminationEntry.make({
      id: makeEntryId(),
      groupId,
      ruleId: makeRuleId(),
      eliminationType: "IntercompanyReceivablePayable",
      periodRef,
      transactionDate: testDate,
      description: "Test elimination entry",
      currency: testCurrency,
      amount,
      lines: Chunk.make(debitLine, creditLine),
      journalEntryId: Option.none(),
      isPosted: false,
      generatedAt: now,
      fromCompanyId: Option.some(companyAId),
      toCompanyId: Option.some(companyBId)
    })
  }

  it("creates entry with correct properties", () => {
    const entry = createTestEntry()

    expect(entry.lineCount).toBe(2)
    expect(entry.hasJournalEntry).toBe(false)
    expect(entry.isIntercompanyElimination).toBe(true)
    expect(entry.isPosted).toBe(false)
    expect(entry.isBalanced).toBe(true)
  })

  it("calculates total debits correctly", () => {
    const entry = createTestEntry()
    expect(entry.totalDebits.format()).toBe("1000")
  })

  it("calculates total credits correctly", () => {
    const entry = createTestEntry()
    expect(entry.totalCredits.format()).toBe("1000")
  })

  it("identifies as balanced when debits equal credits", () => {
    const entry = createTestEntry()
    expect(entry.isBalanced).toBe(true)
  })

  it("identifies entry without intercompany info", () => {
    const debitLine = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 1,
      accountId: accountDebitId,
      debitAmount: Option.some(amount),
      creditAmount: Option.none(),
      memo: Option.none()
    })

    const creditLine = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 2,
      accountId: accountCreditId,
      debitAmount: Option.none(),
      creditAmount: Option.some(amount),
      memo: Option.none()
    })

    const entry = EliminationEntry.make({
      id: makeEntryId(),
      groupId,
      ruleId: makeRuleId(),
      eliminationType: "UnrealizedProfitInventory",
      periodRef,
      transactionDate: testDate,
      description: "Test unrealized profit",
      currency: testCurrency,
      amount,
      lines: Chunk.make(debitLine, creditLine),
      journalEntryId: Option.none(),
      isPosted: false,
      generatedAt: now,
      fromCompanyId: Option.none(),
      toCompanyId: Option.none()
    })

    expect(entry.isIntercompanyElimination).toBe(false)
  })

  describe("type guard", () => {
    it("isEliminationEntry returns true for valid entry", () => {
      const entry = createTestEntry()
      expect(isEliminationEntry(entry)).toBe(true)
    })

    it("isEliminationEntry returns false for invalid values", () => {
      expect(isEliminationEntry(null)).toBe(false)
      expect(isEliminationEntry(undefined)).toBe(false)
      expect(isEliminationEntry({})).toBe(false)
    })
  })
})

// =============================================================================
// GenerationResult Tests
// =============================================================================

describe("GenerationResult", () => {
  const now = makeTimestamp()
  const zeroAmount = MonetaryAmount.zero(testCurrency)

  it("creates empty result", () => {
    const result = GenerationResult.make({
      entries: Chunk.empty(),
      processedRuleIds: Chunk.empty(),
      skippedRuleIds: Chunk.empty(),
      totalAmount: zeroAmount,
      generatedAt: now
    })

    expect(result.entryCount).toBe(0)
    expect(result.processedRuleCount).toBe(0)
    expect(result.skippedRuleCount).toBe(0)
    expect(result.hasEntries).toBe(false)
  })

  it("creates result with entries", () => {
    const amount = MonetaryAmount.unsafeFromString("1000", "USD")
    const ruleId = makeRuleId()

    const debitLine = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 1,
      accountId: accountDebitId,
      debitAmount: Option.some(amount),
      creditAmount: Option.none(),
      memo: Option.none()
    })

    const creditLine = EliminationEntryLine.make({
      id: makeLineId(),
      lineNumber: 2,
      accountId: accountCreditId,
      debitAmount: Option.none(),
      creditAmount: Option.some(amount),
      memo: Option.none()
    })

    const entry = EliminationEntry.make({
      id: makeEntryId(),
      groupId,
      ruleId,
      eliminationType: "IntercompanyReceivablePayable",
      periodRef,
      transactionDate: testDate,
      description: "Test entry",
      currency: testCurrency,
      amount,
      lines: Chunk.make(debitLine, creditLine),
      journalEntryId: Option.none(),
      isPosted: false,
      generatedAt: now,
      fromCompanyId: Option.some(companyAId),
      toCompanyId: Option.some(companyBId)
    })

    const result = GenerationResult.make({
      entries: Chunk.of(entry),
      processedRuleIds: Chunk.of(ruleId),
      skippedRuleIds: Chunk.of(makeRuleId()),
      totalAmount: amount,
      generatedAt: now
    })

    expect(result.entryCount).toBe(1)
    expect(result.processedRuleCount).toBe(1)
    expect(result.skippedRuleCount).toBe(1)
    expect(result.hasEntries).toBe(true)
  })

  describe("type guard", () => {
    it("isGenerationResult returns true for valid result", () => {
      const result = GenerationResult.make({
        entries: Chunk.empty(),
        processedRuleIds: Chunk.empty(),
        skippedRuleIds: Chunk.empty(),
        totalAmount: zeroAmount,
        generatedAt: now
      })
      expect(isGenerationResult(result)).toBe(true)
    })

    it("isGenerationResult returns false for invalid values", () => {
      expect(isGenerationResult(null)).toBe(false)
      expect(isGenerationResult(undefined)).toBe(false)
      expect(isGenerationResult({})).toBe(false)
    })
  })
})

// =============================================================================
// Error Type Tests
// =============================================================================

describe("Error Types", () => {
  describe("ConsolidationGroupNotFoundError", () => {
    it("creates error with correct message", () => {
      const error = new ConsolidationGroupNotFoundError({ groupId })
      expect(error._tag).toBe("ConsolidationGroupNotFoundError")
      expect(error.message).toContain(groupUUID)
      expect(error.message).toContain("Consolidation group not found")
    })

    it("type guard returns true for valid error", () => {
      const error = new ConsolidationGroupNotFoundError({ groupId })
      expect(isConsolidationGroupNotFoundError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isConsolidationGroupNotFoundError(null)).toBe(false)
      expect(isConsolidationGroupNotFoundError(undefined)).toBe(false)
      expect(isConsolidationGroupNotFoundError(new Error("test"))).toBe(false)
    })
  })

  describe("FiscalPeriodNotFoundError", () => {
    it("creates error with correct message", () => {
      const error = new FiscalPeriodNotFoundError({ periodRef })
      expect(error._tag).toBe("FiscalPeriodNotFoundError")
      expect(error.message).toContain("FY2024-P12")
      expect(error.message).toContain("Fiscal period not found")
    })

    it("type guard returns true for valid error", () => {
      const error = new FiscalPeriodNotFoundError({ periodRef })
      expect(isFiscalPeriodNotFoundError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isFiscalPeriodNotFoundError(null)).toBe(false)
      expect(isFiscalPeriodNotFoundError(undefined)).toBe(false)
      expect(isFiscalPeriodNotFoundError(new Error("test"))).toBe(false)
    })
  })

  describe("EliminationRuleNotFoundError", () => {
    it("creates error with correct message", () => {
      const ruleId = makeRuleId()
      const error = new EliminationRuleNotFoundError({ ruleId })
      expect(error._tag).toBe("EliminationRuleNotFoundError")
      expect(error.message).toContain("Elimination rule not found")
    })

    it("type guard returns true for valid error", () => {
      const ruleId = makeRuleId()
      const error = new EliminationRuleNotFoundError({ ruleId })
      expect(isEliminationRuleNotFoundError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isEliminationRuleNotFoundError(null)).toBe(false)
      expect(isEliminationRuleNotFoundError(undefined)).toBe(false)
    })
  })

  describe("NoBalancesForEliminationError", () => {
    it("creates error with correct message", () => {
      const ruleId = makeRuleId()
      const error = new NoBalancesForEliminationError({ ruleId, reason: "No matching accounts" })
      expect(error._tag).toBe("NoBalancesForEliminationError")
      expect(error.message).toContain("No balances found")
      expect(error.message).toContain("No matching accounts")
    })

    it("type guard returns true for valid error", () => {
      const ruleId = makeRuleId()
      const error = new NoBalancesForEliminationError({ ruleId, reason: "test" })
      expect(isNoBalancesForEliminationError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isNoBalancesForEliminationError(null)).toBe(false)
      expect(isNoBalancesForEliminationError(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// EliminationService Tests
// =============================================================================

describe("EliminationService", () => {
  beforeEach(() => {
    ruleIdCounter = 0
    entryIdCounter = 0
    lineIdCounter = 0
  })

  describe("generateEliminations", () => {
    describe("validation", () => {
      it.effect("fails with ConsolidationGroupNotFoundError when group does not exist", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const result = yield* Effect.exit(
            service.generateEliminations(groupId, periodRef)
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isConsolidationGroupNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer({ groupExists: false })))
      )

      it.effect("fails with FiscalPeriodNotFoundError when period does not exist", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const result = yield* Effect.exit(
            service.generateEliminations(groupId, periodRef)
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isFiscalPeriodNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer({ periodExists: false })))
      )
    })

    describe("empty results", () => {
      it.effect("returns empty result when no rules exist", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const result = yield* service.generateEliminations(groupId, periodRef)

          expect(result.entryCount).toBe(0)
          expect(result.processedRuleCount).toBe(0)
          expect(result.skippedRuleCount).toBe(0)
          expect(result.hasEntries).toBe(false)
        }).pipe(Effect.provide(createTestLayer({ rules: Chunk.empty() })))
      )

      it.effect("skips inactive rules", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const inactiveRule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable",
            isActive: false
          })
          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(inactiveRule)
          )

          expect(result.entryCount).toBe(0)
          expect(result.processedRuleCount).toBe(0)
          expect(result.skippedRuleCount).toBe(0)
        }).pipe(Effect.provide(createTestLayer({})))
      )

      it.effect("skips non-automatic rules", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const manualRule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable",
            isAutomatic: false
          })
          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(manualRule)
          )

          expect(result.entryCount).toBe(0)
          expect(result.processedRuleCount).toBe(0)
        }).pipe(Effect.provide(createTestLayer({})))
      )

      it.effect("skips rules with no matching balances", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable"
          })
          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(0)
          expect(result.skippedRuleCount).toBe(1)
          expect(Chunk.head(result.skippedRuleIds)).toEqual(Option.some(rule.id))
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () => Chunk.empty()
            })
          )
        )
      )
    })

    describe("priority ordering", () => {
      it.effect("processes rules in priority order (lower first)", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule1 = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable",
            priority: 20
          })
          const rule2 = createEliminationRule({
            eliminationType: "IntercompanyRevenueExpense",
            priority: 10
          })
          const rule3 = createEliminationRule({
            eliminationType: "IntercompanyDividend",
            priority: 30
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.make(rule1, rule2, rule3)
          )

          // Should process rule2 (priority 10), then rule1 (priority 20), then rule3 (priority 30)
          expect(result.processedRuleCount).toBe(3)
          const processedIds = Chunk.toReadonlyArray(result.processedRuleIds)
          expect(processedIds[0]).toBe(rule2.id)
          expect(processedIds[1]).toBe(rule1.id)
          expect(processedIds[2]).toBe(rule3.id)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )
    })

    describe("IntercompanyReceivablePayable eliminations", () => {
      it.effect("generates elimination entry for intercompany AR/AP", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(1)
          expect(result.processedRuleCount).toBe(1)

          const entry = Chunk.unsafeHead(result.entries)
          expect(entry.eliminationType).toBe("IntercompanyReceivablePayable")
          expect(entry.ruleId).toBe(rule.id)
          expect(entry.lineCount).toBe(2)
          expect(entry.isBalanced).toBe(true)
          expect(entry.isIntercompanyElimination).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("5000", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("5000", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )

      it.effect("skips if only one side has balance", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(0)
          expect(result.skippedRuleCount).toBe(1)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("5000", "USD"),
                    intercompanyPartnerId: companyBId
                  })
                )
            })
          )
        )
      )

      it.effect("skips zero balance eliminations", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(0)
          expect(result.skippedRuleCount).toBe(1)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("0", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("0", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )
    })

    describe("IntercompanyRevenueExpense eliminations", () => {
      it.effect("generates elimination entry for intercompany revenue/expense", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyRevenueExpense"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(1)
          const entry = Chunk.unsafeHead(result.entries)
          expect(entry.eliminationType).toBe("IntercompanyRevenueExpense")
          expect(entry.isBalanced).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("10000", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("10000", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )
    })

    describe("IntercompanyDividend eliminations", () => {
      it.effect("generates elimination entry for intercompany dividends", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyDividend"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(1)
          const entry = Chunk.unsafeHead(result.entries)
          expect(entry.eliminationType).toBe("IntercompanyDividend")
          expect(entry.description).toContain("dividend")
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("2500", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("2500", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )
    })

    describe("IntercompanyInvestment eliminations", () => {
      it.effect("generates elimination entry for investment vs equity", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyInvestment"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(1)
          const entry = Chunk.unsafeHead(result.entries)
          expect(entry.eliminationType).toBe("IntercompanyInvestment")
          expect(entry.description.toLowerCase()).toContain("investment")
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("100000", "USD"),
                    intercompanyPartnerId: companyBId
                  })
                )
            })
          )
        )
      )

      it.effect("skips zero investment balance", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyInvestment"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(0)
          expect(result.skippedRuleCount).toBe(1)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("0", "USD")
                  })
                )
            })
          )
        )
      )
    })

    describe("UnrealizedProfitInventory eliminations", () => {
      it.effect("generates elimination entry for unrealized profit in inventory", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "UnrealizedProfitInventory"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(1)
          const entry = Chunk.unsafeHead(result.entries)
          expect(entry.eliminationType).toBe("UnrealizedProfitInventory")
          expect(entry.description.toLowerCase()).toContain("unrealized")
          expect(entry.description.toLowerCase()).toContain("inventory")
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("1500", "USD")
                  })
                )
            })
          )
        )
      )
    })

    describe("UnrealizedProfitFixedAssets eliminations", () => {
      it.effect("generates elimination entry for unrealized profit in fixed assets", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "UnrealizedProfitFixedAssets"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(1)
          const entry = Chunk.unsafeHead(result.entries)
          expect(entry.eliminationType).toBe("UnrealizedProfitFixedAssets")
          expect(entry.description.toLowerCase()).toContain("unrealized")
          expect(entry.description.toLowerCase()).toContain("fixed assets")
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("8000", "USD")
                  })
                )
            })
          )
        )
      )
    })

    describe("multiple rules", () => {
      it.effect("processes multiple rules and generates multiple entries", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule1 = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable",
            priority: 1
          })
          const rule2 = createEliminationRule({
            eliminationType: "IntercompanyRevenueExpense",
            priority: 2
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.make(rule1, rule2)
          )

          expect(result.processedRuleCount).toBe(2)
          expect(result.entryCount).toBe(2)

          const entries = Chunk.toReadonlyArray(result.entries)
          expect(entries[0].eliminationType).toBe("IntercompanyReceivablePayable")
          expect(entries[1].eliminationType).toBe("IntercompanyRevenueExpense")
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )

      it.effect("accumulates total amount across all entries", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule1 = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable",
            priority: 1
          })
          const rule2 = createEliminationRule({
            eliminationType: "UnrealizedProfitInventory",
            priority: 2
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.make(rule1, rule2)
          )

          // 4000 from IC AR/AP (2000 + 2000 summed from both sides) + 500 from unrealized = 4500
          expect(result.totalAmount.format()).toBe("4500")
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: (rule) => {
                if (rule.eliminationType === "IntercompanyReceivablePayable") {
                  return Chunk.make(
                    createAccountBalance({
                      companyId: companyAId,
                      balance: MonetaryAmount.unsafeFromString("2000", "USD"),
                      intercompanyPartnerId: companyBId
                    }),
                    createAccountBalance({
                      companyId: companyBId,
                      balance: MonetaryAmount.unsafeFromString("2000", "USD"),
                      intercompanyPartnerId: companyAId
                    })
                  )
                }
                return Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("500", "USD")
                  })
                )
              }
            })
          )
        )
      )
    })

    describe("entry structure", () => {
      it.effect("creates entries with correct debit and credit accounts", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          const entry = Chunk.unsafeHead(result.entries)
          const lines = Chunk.toReadonlyArray(entry.lines)

          const debitLine = lines.find((l) => Option.isSome(l.debitAmount))
          const creditLine = lines.find((l) => Option.isSome(l.creditAmount))

          expect(debitLine).toBeDefined()
          expect(creditLine).toBeDefined()
          expect(debitLine!.accountId).toBe(rule.debitAccountId)
          expect(creditLine!.accountId).toBe(rule.creditAccountId)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )

      it.effect("sets correct line numbers", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          const entry = Chunk.unsafeHead(result.entries)
          const lines = Chunk.toReadonlyArray(entry.lines)

          expect(lines[0].lineNumber).toBe(1)
          expect(lines[1].lineNumber).toBe(2)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )

      it.effect("includes memos on lines", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "IntercompanyReceivablePayable"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          const entry = Chunk.unsafeHead(result.entries)
          const lines = Chunk.toReadonlyArray(entry.lines)

          expect(Option.isSome(lines[0].memo)).toBe(true)
          expect(Option.isSome(lines[1].memo)).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.make(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyBId
                  }),
                  createAccountBalance({
                    companyId: companyBId,
                    balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                    intercompanyPartnerId: companyAId
                  })
                )
            })
          )
        )
      )
    })

    describe("all elimination types", () => {
      const eliminationTypes: EliminationType[] = [
        "IntercompanyReceivablePayable",
        "IntercompanyRevenueExpense",
        "IntercompanyDividend",
        "IntercompanyInvestment",
        "UnrealizedProfitInventory",
        "UnrealizedProfitFixedAssets"
      ]

      for (const eliminationType of eliminationTypes) {
        it.effect(`generates entry for ${eliminationType}`, () =>
          Effect.gen(function* () {
            const service = yield* EliminationService
            const rule = createEliminationRule({ eliminationType })

            const result = yield* service.generateEliminations(
              groupId,
              periodRef,
              Chunk.of(rule)
            )

            expect(result.entryCount).toBeGreaterThanOrEqual(1)
            const entry = Chunk.unsafeHead(result.entries)
            expect(entry.eliminationType).toBe(eliminationType)
            expect(entry.ruleId).toBe(rule.id)
            expect(entry.groupId).toBe(groupId)
            expect(entry.periodRef).toEqual(periodRef)
            expect(entry.isPosted).toBe(false)
            expect(Option.isNone(entry.journalEntryId)).toBe(true)
          }).pipe(
            Effect.provide(
              createTestLayer({
                balancesForRule: () => {
                  // IC types need paired balances
                  if (
                    eliminationType === "IntercompanyReceivablePayable" ||
                    eliminationType === "IntercompanyRevenueExpense" ||
                    eliminationType === "IntercompanyDividend"
                  ) {
                    return Chunk.make(
                      createAccountBalance({
                        companyId: companyAId,
                        balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                        intercompanyPartnerId: companyBId
                      }),
                      createAccountBalance({
                        companyId: companyBId,
                        balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                        intercompanyPartnerId: companyAId
                      })
                    )
                  }
                  // Other types need single balance
                  return Chunk.of(
                    createAccountBalance({
                      companyId: companyAId,
                      balance: MonetaryAmount.unsafeFromString("1000", "USD")
                    })
                  )
                }
              })
            )
          )
        )
      }
    })

    describe("using repository rules", () => {
      it.effect("fetches and processes rules from repository when not provided", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const result = yield* service.generateEliminations(groupId, periodRef)

          expect(result.processedRuleCount).toBe(2)
          expect(result.entryCount).toBe(2)
        }).pipe(
          Effect.provide(
            createTestLayer({
              rules: Chunk.make(
                createEliminationRule({
                  eliminationType: "IntercompanyReceivablePayable",
                  priority: 1
                }),
                createEliminationRule({
                  eliminationType: "UnrealizedProfitInventory",
                  priority: 2
                })
              ),
              balancesForRule: (rule) => {
                if (rule.eliminationType === "IntercompanyReceivablePayable") {
                  return Chunk.make(
                    createAccountBalance({
                      companyId: companyAId,
                      balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                      intercompanyPartnerId: companyBId
                    }),
                    createAccountBalance({
                      companyId: companyBId,
                      balance: MonetaryAmount.unsafeFromString("1000", "USD"),
                      intercompanyPartnerId: companyAId
                    })
                  )
                }
                return Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("500", "USD")
                  })
                )
              }
            })
          )
        )
      )
    })

    describe("negative balances", () => {
      it.effect("handles negative balances correctly using absolute value", () =>
        Effect.gen(function* () {
          const service = yield* EliminationService
          const rule = createEliminationRule({
            eliminationType: "UnrealizedProfitInventory"
          })

          const result = yield* service.generateEliminations(
            groupId,
            periodRef,
            Chunk.of(rule)
          )

          expect(result.entryCount).toBe(1)
          const entry = Chunk.unsafeHead(result.entries)
          // Amount should be absolute value
          expect(entry.amount.format()).toBe("500")
          expect(entry.isBalanced).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              balancesForRule: () =>
                Chunk.of(
                  createAccountBalance({
                    companyId: companyAId,
                    balance: MonetaryAmount.unsafeFromString("-500", "USD")
                  })
                )
            })
          )
        )
      )
    })
  })
})
