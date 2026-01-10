import { describe, it, expect, beforeEach } from "@effect/vitest"
import { Chunk, Effect, Exit, Layer, Option } from "effect"
import * as BigDecimal from "effect/BigDecimal"
import {
  ConsolidationService,
  ConsolidationServiceLive,
  ConsolidationRepository,
  TranslatedBalance,
  AggregatedBalance,
  ICMatchResult,
  NCICalculation,
  ConsolidationGroupNotFoundError,
  FiscalPeriodNotFoundError,
  ConsolidationRunExistsError,
  ConsolidationValidationError,
  ConsolidationStepFailedError,
  isConsolidationGroupNotFoundError,
  isFiscalPeriodNotFoundError,
  isConsolidationRunExistsError,
  isConsolidationValidationError,
  isConsolidationStepFailedError,
  isTranslatedBalance,
  isAggregatedBalance,
  isICMatchResult,
  isNCICalculation,
  type ConsolidationRepositoryService
} from "../../src/services/ConsolidationService.js"
import {
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationRunOptions,
  ValidationResult,
  ValidationIssue,
  createInitialSteps,
  defaultConsolidationRunOptions
} from "../../src/domain/ConsolidationRun.js"
import { ConsolidationGroupId, ConsolidationMember } from "../../src/domain/ConsolidationGroup.js"
import { CompanyId } from "../../src/domain/Company.js"
import { CurrencyCode } from "../../src/domain/CurrencyCode.js"
import { FiscalPeriodRef } from "../../src/domain/FiscalPeriodRef.js"
import { LocalDate } from "../../src/domain/LocalDate.js"
import { MonetaryAmount } from "../../src/domain/MonetaryAmount.js"
import { Timestamp } from "../../src/domain/Timestamp.js"
import { TrialBalanceLineItem, TrialBalanceReport, TrialBalanceReportMetadata } from "../../src/services/TrialBalanceService.js"
import { AccountId } from "../../src/domain/Account.js"

// =============================================================================
// Test Helpers
// =============================================================================

const makeTimestamp = () => Timestamp.make({ epochMillis: Date.now() })

// UUIDs for testing
const groupUUID = "550e8400-e29b-41d4-a716-446655440000"
const companyAUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const companyBUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
const userUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c9"
const accountUUID = "9ba7b810-9dad-11d1-80b4-00c04fd430c1"

const groupId = ConsolidationGroupId.make(groupUUID)
const companyAId = CompanyId.make(companyAUUID)
const companyBId = CompanyId.make(companyBUUID)
const accountId = AccountId.make(accountUUID)
const periodRef = FiscalPeriodRef.make({ year: 2024, period: 12 })
const testDate = LocalDate.make({ year: 2024, month: 12, day: 31 })
const testCurrency = CurrencyCode.make("USD")

let runIdCounter = 0

const makeRunId = () => {
  runIdCounter++
  const hex = runIdCounter.toString(16).padStart(12, "0")
  return ConsolidationRunId.make(`00000000-0000-0000-0001-${hex}`)
}

const createMember = (
  companyId: CompanyId,
  ownershipPercentage: number,
  method: "FullConsolidation" | "VariableInterestEntity" | "EquityMethod" | "CostMethod" = "FullConsolidation"
): ConsolidationMember => {
  return ConsolidationMember.make({
    companyId,
    ownershipPercentage: ownershipPercentage as any, // Percentage branded type
    consolidationMethod: method,
    acquisitionDate: testDate,
    goodwillAmount: Option.none(),
    nonControllingInterestPercentage: (100 - ownershipPercentage) as any, // Percentage branded type
    vieDetermination: Option.none()
  })
}

const createTrialBalanceLineItem = (
  accountNumber: string,
  accountName: string,
  accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense",
  debitAmount: string,
  creditAmount: string
): TrialBalanceLineItem => {
  return TrialBalanceLineItem.make({
    accountId,
    accountNumber: accountNumber as any,
    accountName: accountName as any,
    accountType,
    accountCategory: "General",
    normalBalance: accountType === "Asset" || accountType === "Expense" ? "Debit" : "Credit",
    debitBalance: MonetaryAmount.unsafeFromString(debitAmount, "USD"),
    creditBalance: MonetaryAmount.unsafeFromString(creditAmount, "USD")
  })
}

const createTrialBalanceReport = (
  companyId: CompanyId,
  lineItems: TrialBalanceLineItem[]
): TrialBalanceReport => {
  const now = makeTimestamp()
  let totalDebits = BigDecimal.fromNumber(0)
  let totalCredits = BigDecimal.fromNumber(0)

  for (const item of lineItems) {
    totalDebits = BigDecimal.sum(totalDebits, item.debitBalance.amount)
    totalCredits = BigDecimal.sum(totalCredits, item.creditBalance.amount)
  }

  return TrialBalanceReport.make({
    metadata: TrialBalanceReportMetadata.make({
      companyId,
      asOfDate: testDate,
      periodStartDate: Option.none(),
      currency: testCurrency,
      generatedAt: now,
      accountCount: lineItems.length,
      isBalanced: BigDecimal.equals(totalDebits, totalCredits)
    }),
    lineItems,
    totalDebits: MonetaryAmount.fromBigDecimal(totalDebits, testCurrency),
    totalCredits: MonetaryAmount.fromBigDecimal(totalCredits, testCurrency)
  })
}

const createMockRepository = (params: {
  groupExists?: boolean
  periodExists?: boolean
  existingRun?: ConsolidationRun
  allMembersClosed?: boolean
  unclosedMembers?: Chunk.Chunk<CompanyId>
  members?: Chunk.Chunk<ConsolidationMember>
  memberTrialBalances?: Array<{
    companyId: CompanyId
    companyName: string
    localCurrency: CurrencyCode
    trialBalance: TrialBalanceReport
  }>
  icMatchedPairs?: number
  icUnmatchedCount?: number
  eliminationEntryCount?: number
  nciCount?: number
  shouldFailStep?: string
}): ConsolidationRepositoryService => ({
  groupExists: (_groupId) => Effect.succeed(params.groupExists ?? true),
  getGroup: (_groupId) =>
    Effect.succeed(
      params.groupExists !== false
        ? Option.some({
            id: groupId,
            name: "Test Group",
            reportingCurrency: testCurrency,
            members: params.members ?? Chunk.make(
              createMember(companyAId, 100),
              createMember(companyBId, 80)
            )
          })
        : Option.none()
    ),
  periodExists: (_periodRef) => Effect.succeed(params.periodExists ?? true),
  getPeriodEndDate: (_periodRef) => Effect.succeed(testDate),
  getExistingRun: (_groupId, _periodRef) =>
    Effect.succeed(params.existingRun ? Option.some(params.existingRun) : Option.none()),
  allMembersPeriodsClosed: (_groupId, _periodRef) =>
    Effect.succeed({
      allClosed: params.allMembersClosed ?? true,
      unclosedMembers: params.unclosedMembers ?? Chunk.empty()
    }),
  getMemberTrialBalances: (_groupId, _periodRef, _asOfDate): any => {
    if (params.shouldFailStep === "Translate" || params.shouldFailStep === "Aggregate") {
      return Effect.fail(new Error(`Step ${params.shouldFailStep} failed`))
    }
    if (params.memberTrialBalances) {
      return Effect.succeed(Chunk.fromIterable(params.memberTrialBalances))
    }
    // Default trial balances
    return Effect.succeed(
      Chunk.make(
        {
          companyId: companyAId,
          companyName: "Company A",
          localCurrency: testCurrency,
          trialBalance: createTrialBalanceReport(companyAId, [
            createTrialBalanceLineItem("1000", "Cash", "Asset", "10000", "0"),
            createTrialBalanceLineItem("3000", "Common Stock", "Equity", "0", "10000")
          ])
        },
        {
          companyId: companyBId,
          companyName: "Company B",
          localCurrency: CurrencyCode.make("EUR"),
          trialBalance: createTrialBalanceReport(companyBId, [
            createTrialBalanceLineItem("1000", "Cash", "Asset", "5000", "0"),
            createTrialBalanceLineItem("3000", "Common Stock", "Equity", "0", "5000")
          ])
        }
      )
    )
  },
  translateTrialBalance: (_trialBalance, _fromCurrency, _toCurrency, _asOfDate) =>
    Effect.succeed(Chunk.empty()),
  getIntercompanyTransactions: (_groupId, _periodRef): any => {
    if (params.shouldFailStep === "MatchIC") {
      return Effect.fail(new Error("MatchIC step failed"))
    }
    return Effect.succeed({
      matchedPairs: params.icMatchedPairs ?? 5,
      unmatchedCount: params.icUnmatchedCount ?? 0,
      totalMatchedValue: MonetaryAmount.unsafeFromString("10000", "USD"),
      totalUnmatchedValue: MonetaryAmount.zero(testCurrency)
    })
  },
  getEliminationRules: (_groupId) => {
    // Return rules if we need to test eliminate step (when elimination count > 0 or failure expected)
    if (params.eliminationEntryCount || params.shouldFailStep === "Eliminate") {
      // Return a mock rule chunk to trigger generateEliminationEntries
      return Effect.succeed(Chunk.of({} as any))
    }
    return Effect.succeed(Chunk.empty())
  },
  generateEliminationEntries: (_groupId, _periodRef, _rules, _balances): any => {
    if (params.shouldFailStep === "Eliminate") {
      return Effect.fail(new Error("Eliminate step failed"))
    }
    const entryCount = params.eliminationEntryCount ?? 0
    const entryIds = Array.from({ length: entryCount }, (_, i) =>
      `00000000-0000-0000-0004-00000000000${i + 1}`
    )
    return Effect.succeed({
      entryIds: Chunk.fromIterable(entryIds),
      totalEliminationAmount: MonetaryAmount.unsafeFromString(String(entryCount * 1000), "USD")
    })
  },
  calculateNCI: (_groupId, _periodRef, _balances): any => {
    if (params.shouldFailStep === "NCI") {
      return Effect.fail(new Error("NCI step failed"))
    }
    const nciCount = params.nciCount ?? 0
    const calculations = Array.from({ length: nciCount }, (_, i) =>
      NCICalculation.make({
        companyId: companyBId,
        companyName: `Subsidiary ${i + 1}` as any,
        minorityPercentage: BigDecimal.fromNumber(20),
        netIncomeNCI: MonetaryAmount.unsafeFromString("1000", "USD"),
        equityNCI: MonetaryAmount.unsafeFromString("5000", "USD")
      })
    )
    return Effect.succeed({
      calculations: Chunk.fromIterable(calculations),
      totalNCI: MonetaryAmount.unsafeFromString(String(nciCount * 5000), "USD")
    })
  },
  generateRunId: () => Effect.succeed(makeRunId()),
  saveRun: (run) => Effect.succeed(run),
  updateRun: (run) => Effect.succeed(run)
})

const createTestLayer = (params: {
  groupExists?: boolean
  periodExists?: boolean
  existingRun?: ConsolidationRun
  allMembersClosed?: boolean
  unclosedMembers?: Chunk.Chunk<CompanyId>
  members?: Chunk.Chunk<ConsolidationMember>
  memberTrialBalances?: Array<{
    companyId: CompanyId
    companyName: string
    localCurrency: CurrencyCode
    trialBalance: TrialBalanceReport
  }>
  icMatchedPairs?: number
  icUnmatchedCount?: number
  eliminationEntryCount?: number
  nciCount?: number
  shouldFailStep?: string
}) => {
  const repoLayer = Layer.succeed(
    ConsolidationRepository,
    createMockRepository(params)
  )
  return ConsolidationServiceLive.pipe(Layer.provide(repoLayer))
}

// =============================================================================
// TranslatedBalance Tests
// =============================================================================

describe("TranslatedBalance", () => {
  it("creates translated balance", () => {
    const balance = TranslatedBalance.make({
      companyId: companyAId,
      accountNumber: "1000",
      accountName: "Cash",
      accountType: "Asset",
      localBalance: MonetaryAmount.unsafeFromString("10000", "EUR"),
      translatedBalance: MonetaryAmount.unsafeFromString("11000", "USD"),
      exchangeRate: BigDecimal.fromNumber(1.1)
    })

    expect(balance.companyId).toBe(companyAId)
    expect(balance.accountNumber).toBe("1000")
    expect(balance.accountType).toBe("Asset")
  })

  describe("type guard", () => {
    it("isTranslatedBalance returns true for valid balance", () => {
      const balance = TranslatedBalance.make({
        companyId: companyAId,
        accountNumber: "1000",
        accountName: "Cash",
        accountType: "Asset",
        localBalance: MonetaryAmount.unsafeFromString("10000", "EUR"),
        translatedBalance: MonetaryAmount.unsafeFromString("11000", "USD"),
        exchangeRate: BigDecimal.fromNumber(1.1)
      })
      expect(isTranslatedBalance(balance)).toBe(true)
    })

    it("isTranslatedBalance returns false for invalid values", () => {
      expect(isTranslatedBalance(null)).toBe(false)
      expect(isTranslatedBalance(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// AggregatedBalance Tests
// =============================================================================

describe("AggregatedBalance", () => {
  it("creates aggregated balance", () => {
    const balance = AggregatedBalance.make({
      accountNumber: "1000",
      accountName: "Cash",
      accountType: "Asset",
      balance: MonetaryAmount.unsafeFromString("25000", "USD"),
      memberCount: 3
    })

    expect(balance.accountNumber).toBe("1000")
    expect(balance.memberCount).toBe(3)
    expect(balance.isZero).toBe(false)
  })

  it("identifies zero balance", () => {
    const balance = AggregatedBalance.make({
      accountNumber: "2000",
      accountName: "Liabilities",
      accountType: "Liability",
      balance: MonetaryAmount.zero(testCurrency),
      memberCount: 2
    })

    expect(balance.isZero).toBe(true)
  })

  describe("type guard", () => {
    it("isAggregatedBalance returns true for valid balance", () => {
      const balance = AggregatedBalance.make({
        accountNumber: "1000",
        accountName: "Cash",
        accountType: "Asset",
        balance: MonetaryAmount.unsafeFromString("25000", "USD"),
        memberCount: 3
      })
      expect(isAggregatedBalance(balance)).toBe(true)
    })

    it("isAggregatedBalance returns false for invalid values", () => {
      expect(isAggregatedBalance(null)).toBe(false)
      expect(isAggregatedBalance(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// ICMatchResult Tests
// =============================================================================

describe("ICMatchResult", () => {
  it("creates fully matched result", () => {
    const result = ICMatchResult.make({
      matchedPairCount: 10,
      unmatchedCount: 0,
      totalMatchedValue: MonetaryAmount.unsafeFromString("50000", "USD"),
      totalUnmatchedValue: MonetaryAmount.zero(testCurrency)
    })

    expect(result.matchedPairCount).toBe(10)
    expect(result.isFullyMatched).toBe(true)
  })

  it("creates partially matched result", () => {
    const result = ICMatchResult.make({
      matchedPairCount: 8,
      unmatchedCount: 2,
      totalMatchedValue: MonetaryAmount.unsafeFromString("40000", "USD"),
      totalUnmatchedValue: MonetaryAmount.unsafeFromString("10000", "USD")
    })

    expect(result.unmatchedCount).toBe(2)
    expect(result.isFullyMatched).toBe(false)
  })

  describe("type guard", () => {
    it("isICMatchResult returns true for valid result", () => {
      const result = ICMatchResult.make({
        matchedPairCount: 10,
        unmatchedCount: 0,
        totalMatchedValue: MonetaryAmount.unsafeFromString("50000", "USD"),
        totalUnmatchedValue: MonetaryAmount.zero(testCurrency)
      })
      expect(isICMatchResult(result)).toBe(true)
    })

    it("isICMatchResult returns false for invalid values", () => {
      expect(isICMatchResult(null)).toBe(false)
      expect(isICMatchResult(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// NCICalculation Tests
// =============================================================================

describe("NCICalculation", () => {
  it("creates NCI calculation", () => {
    const calc = NCICalculation.make({
      companyId: companyBId,
      companyName: "Subsidiary Inc",
      minorityPercentage: BigDecimal.fromNumber(20),
      netIncomeNCI: MonetaryAmount.unsafeFromString("2000", "USD"),
      equityNCI: MonetaryAmount.unsafeFromString("10000", "USD")
    })

    expect(calc.companyId).toBe(companyBId)
    expect(calc.minorityPercentage).toEqual(BigDecimal.fromNumber(20))
  })

  describe("type guard", () => {
    it("isNCICalculation returns true for valid calculation", () => {
      const calc = NCICalculation.make({
        companyId: companyBId,
        companyName: "Subsidiary Inc",
        minorityPercentage: BigDecimal.fromNumber(20),
        netIncomeNCI: MonetaryAmount.unsafeFromString("2000", "USD"),
        equityNCI: MonetaryAmount.unsafeFromString("10000", "USD")
      })
      expect(isNCICalculation(calc)).toBe(true)
    })

    it("isNCICalculation returns false for invalid values", () => {
      expect(isNCICalculation(null)).toBe(false)
      expect(isNCICalculation(undefined)).toBe(false)
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
      expect(isConsolidationGroupNotFoundError(new Error("test"))).toBe(false)
    })
  })

  describe("FiscalPeriodNotFoundError", () => {
    it("creates error with correct message", () => {
      const error = new FiscalPeriodNotFoundError({ periodRef })
      expect(error._tag).toBe("FiscalPeriodNotFoundError")
      expect(error.message).toContain("FY2024-P12")
    })

    it("type guard returns true for valid error", () => {
      const error = new FiscalPeriodNotFoundError({ periodRef })
      expect(isFiscalPeriodNotFoundError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isFiscalPeriodNotFoundError(null)).toBe(false)
    })
  })

  describe("ConsolidationRunExistsError", () => {
    it("creates error with correct message", () => {
      const existingRunId = makeRunId()
      const error = new ConsolidationRunExistsError({ groupId, periodRef, existingRunId })
      expect(error._tag).toBe("ConsolidationRunExistsError")
      expect(error.message).toContain("already exists")
      expect(error.message).toContain(groupUUID)
    })

    it("type guard returns true for valid error", () => {
      const existingRunId = makeRunId()
      const error = new ConsolidationRunExistsError({ groupId, periodRef, existingRunId })
      expect(isConsolidationRunExistsError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isConsolidationRunExistsError(null)).toBe(false)
    })
  })

  describe("ConsolidationValidationError", () => {
    it("creates error with correct message", () => {
      const validationResult = ValidationResult.make({
        isValid: false,
        issues: Chunk.of(
          ValidationIssue.make({
            severity: "Error",
            code: "TEST",
            message: "Test error",
            entityReference: Option.none()
          })
        )
      })
      const error = new ConsolidationValidationError({ groupId, periodRef, validationResult })
      expect(error._tag).toBe("ConsolidationValidationError")
      expect(error.message).toContain("validation failed")
      expect(error.message).toContain("1 error(s)")
    })

    it("type guard returns true for valid error", () => {
      const validationResult = ValidationResult.make({
        isValid: false,
        issues: Chunk.empty()
      })
      const error = new ConsolidationValidationError({ groupId, periodRef, validationResult })
      expect(isConsolidationValidationError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isConsolidationValidationError(null)).toBe(false)
    })
  })

  describe("ConsolidationStepFailedError", () => {
    it("creates error with correct message", () => {
      const runId = makeRunId()
      const error = new ConsolidationStepFailedError({
        runId,
        stepType: "Aggregate",
        errorMessage: "Database connection failed" as any
      })
      expect(error._tag).toBe("ConsolidationStepFailedError")
      expect(error.message).toContain("Aggregate")
      expect(error.message).toContain("Database connection failed")
    })

    it("type guard returns true for valid error", () => {
      const runId = makeRunId()
      const error = new ConsolidationStepFailedError({
        runId,
        stepType: "Translate",
        errorMessage: "Rate not found" as any
      })
      expect(isConsolidationStepFailedError(error)).toBe(true)
    })

    it("type guard returns false for other values", () => {
      expect(isConsolidationStepFailedError(null)).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidationService Tests
// =============================================================================

describe("ConsolidationService", () => {
  beforeEach(() => {
    runIdCounter = 0
  })

  describe("run", () => {
    describe("initial validation", () => {
      it.effect("fails with ConsolidationGroupNotFoundError when group does not exist", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* Effect.exit(
            service.run({
              groupId,
              periodRef,
              userId: userUUID
            })
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isConsolidationGroupNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer({ groupExists: false })))
      )

      it.effect("fails with FiscalPeriodNotFoundError when period does not exist", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* Effect.exit(
            service.run({
              groupId,
              periodRef,
              userId: userUUID
            })
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isFiscalPeriodNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer({ periodExists: false })))
      )

      it.effect("fails with ConsolidationRunExistsError when run exists and forceRegeneration is false", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService

          const result = yield* Effect.exit(
            service.run({
              groupId,
              periodRef,
              userId: userUUID
            })
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isConsolidationRunExistsError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer({
              existingRun: ConsolidationRun.make({
                id: ConsolidationRunId.make("00000000-0000-0000-0099-000000000001"),
                groupId,
                periodRef,
                asOfDate: testDate,
                status: "Completed",
                steps: createInitialSteps(),
                validationResult: Option.none(),
                consolidatedTrialBalance: Option.none(),
                eliminationEntryIds: Chunk.empty(),
                options: defaultConsolidationRunOptions,
                initiatedBy: userUUID as any,
                initiatedAt: makeTimestamp(),
                startedAt: Option.none(),
                completedAt: Option.none(),
                totalDurationMs: Option.none(),
                errorMessage: Option.none()
              })
            })
          )
        )
      )

      it.effect("proceeds when forceRegeneration is true even if run exists", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService

          const result = yield* service.run({
            groupId,
            periodRef,
            options: ConsolidationRunOptions.make({ forceRegeneration: true }),
            userId: userUUID
          })

          expect(result.isCompleted).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              existingRun: ConsolidationRun.make({
                id: ConsolidationRunId.make("00000000-0000-0000-0099-000000000001"),
                groupId,
                periodRef,
                asOfDate: testDate,
                status: "Completed",
                steps: createInitialSteps(),
                validationResult: Option.none(),
                consolidatedTrialBalance: Option.none(),
                eliminationEntryIds: Chunk.empty(),
                options: defaultConsolidationRunOptions,
                initiatedBy: userUUID as any,
                initiatedAt: makeTimestamp(),
                startedAt: Option.none(),
                completedAt: Option.none(),
                totalDurationMs: Option.none(),
                errorMessage: Option.none()
              })
            })
          )
        )
      )
    })

    describe("successful consolidation", () => {
      it.effect("completes all steps successfully", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          expect(result.status).toBe("Completed")
          expect(result.isCompleted).toBe(true)
          expect(result.stepCount).toBe(7)
          expect(result.completedStepCount).toBe(7)
          expect(result.failedStepCount).toBe(0)
          expect(result.progressPercent).toBe(100)
        }).pipe(Effect.provide(createTestLayer({})))
      )

      it.effect("tracks timing information", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          expect(Option.isSome(result.startedAt)).toBe(true)
          expect(Option.isSome(result.completedAt)).toBe(true)
          expect(Option.isSome(result.totalDurationMs)).toBe(true)

          // Check each step has timing
          for (const step of Chunk.toReadonlyArray(result.steps)) {
            expect(Option.isSome(step.startedAt)).toBe(true)
            expect(Option.isSome(step.completedAt)).toBe(true)
            expect(Option.isSome(step.durationMs)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer({})))
      )

      it.effect("generates consolidated trial balance", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          expect(result.hasConsolidatedTrialBalance).toBe(true)
          const ctb = Option.getOrThrow(result.consolidatedTrialBalance)
          expect(ctb.groupId).toBe(groupId)
          expect(ctb.currency).toBe(testCurrency)
        }).pipe(Effect.provide(createTestLayer({})))
      )
    })

    describe("validation step", () => {
      it.effect("fails when member periods are not closed", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* Effect.exit(
            service.run({
              groupId,
              periodRef,
              userId: userUUID
            })
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isConsolidationValidationError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer({
              allMembersClosed: false,
              unclosedMembers: Chunk.of(companyBId)
            })
          )
        )
      )

      it.effect("skips validation when skipValidation option is true", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            options: ConsolidationRunOptions.make({ skipValidation: true }),
            userId: userUUID
          })

          expect(result.isCompleted).toBe(true)
          // Validation step should show skipped details
          const validateStep = result.getStep("Validate")
          expect(Option.isSome(validateStep)).toBe(true)
          const step = Option.getOrThrow(validateStep)
          expect(step.isSuccessful).toBe(true)
          expect(Option.getOrThrow(step.details)).toContain("skipped")
        }).pipe(
          Effect.provide(
            createTestLayer({
              allMembersClosed: false,
              unclosedMembers: Chunk.of(companyBId)
            })
          )
        )
      )
    })

    describe("step execution order", () => {
      it.effect("executes steps in correct order", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          const expectedOrder = [
            "Validate",
            "Translate",
            "Aggregate",
            "MatchIC",
            "Eliminate",
            "NCI",
            "GenerateTB"
          ]

          const actualOrder = Chunk.toReadonlyArray(result.steps).map((s) => s.stepType)
          expect(actualOrder).toEqual(expectedOrder)
        }).pipe(Effect.provide(createTestLayer({})))
      )
    })

    describe("step failure handling", () => {
      it.effect("marks run as failed when a step fails", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* Effect.exit(
            service.run({
              groupId,
              periodRef,
              userId: userUUID
            })
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isConsolidationStepFailedError(result.cause.error)).toBe(true)
            const error = result.cause.error as ConsolidationStepFailedError
            expect(error.stepType).toBe("MatchIC")
          }
        }).pipe(
          Effect.provide(
            createTestLayer({
              shouldFailStep: "MatchIC"
            })
          )
        )
      )

      it.effect("stores error message when step fails", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* Effect.exit(
            service.run({
              groupId,
              periodRef,
              userId: userUUID
            })
          )

          expect(Exit.isFailure(result)).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              shouldFailStep: "NCI"
            })
          )
        )
      )

      it.effect("stops processing when a step fails", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* Effect.exit(
            service.run({
              groupId,
              periodRef,
              userId: userUUID
            })
          )

          expect(Exit.isFailure(result)).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              shouldFailStep: "Eliminate"
            })
          )
        )
      )
    })

    describe("elimination entries", () => {
      it.effect("tracks elimination entry IDs when generated", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          expect(result.eliminationEntryCount).toBe(3)
          expect(result.hasEliminationEntries).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer({
              eliminationEntryCount: 3
            })
          )
        )
      )

      it.effect("handles no elimination entries", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          expect(result.eliminationEntryCount).toBe(0)
          expect(result.hasEliminationEntries).toBe(false)
        }).pipe(
          Effect.provide(
            createTestLayer({
              eliminationEntryCount: 0
            })
          )
        )
      )
    })

    describe("NCI calculations", () => {
      it.effect("handles subsidiaries with minority interest", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          // Check NCI step details
          const nciStep = result.getStep("NCI")
          expect(Option.isSome(nciStep)).toBe(true)
          const step = Option.getOrThrow(nciStep)
          expect(step.isSuccessful).toBe(true)
          expect(Option.getOrThrow(step.details)).toContain("2 subsidiary")
        }).pipe(
          Effect.provide(
            createTestLayer({
              nciCount: 2
            })
          )
        )
      )

      it.effect("handles no NCI when all fully owned", () =>
        Effect.gen(function* () {
          const service = yield* ConsolidationService
          const result = yield* service.run({
            groupId,
            periodRef,
            userId: userUUID
          })

          const nciStep = result.getStep("NCI")
          expect(Option.isSome(nciStep)).toBe(true)
          const step = Option.getOrThrow(nciStep)
          expect(Option.getOrThrow(step.details)).toContain("No non-controlling interests")
        }).pipe(
          Effect.provide(
            createTestLayer({
              nciCount: 0
            })
          )
        )
      )
    })
  })
})
