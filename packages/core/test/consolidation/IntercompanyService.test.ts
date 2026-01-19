import { describe, it, expect, beforeEach } from "@effect/vitest"
import { BigDecimal, Chunk, Effect, Exit, Layer, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  IntercompanyService,
  IntercompanyServiceLive,
  IntercompanyTransactionRepository,
  MatchingConfig,
  MatchedPair,
  UnmatchedTransaction,
  DiscrepancyDetail,
  MatchingReport,
  MatchingResult,
  ConsolidationGroupNotFoundError,
  FiscalPeriodNotFoundError,
  isConsolidationGroupNotFoundError,
  isFiscalPeriodNotFoundError,
  isMatchingConfig,
  isMatchedPair,
  isUnmatchedTransaction,
  isDiscrepancyDetail,
  isMatchingReport,
  isMatchingResult,
  defaultMatchingConfig,
  type IntercompanyTransactionRepositoryService
} from "../../src/consolidation/IntercompanyService.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { ConsolidationGroupId } from "../../src/consolidation/ConsolidationGroup.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import {
  IntercompanyTransaction,
  IntercompanyTransactionId,
  type IntercompanyTransactionType,
  type MatchingStatus
} from "../../src/consolidation/IntercompanyTransaction.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

// =============================================================================
// Test Helpers
// =============================================================================

const makeTimestamp = () => Timestamp.make({ epochMillis: Date.now() })

const groupUUID = "550e8400-e29b-41d4-a716-446655440000"
const companyAUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const companyBUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
const companyCUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c9"

const groupId = ConsolidationGroupId.make(groupUUID)
const companyAId = CompanyId.make(companyAUUID)
const companyBId = CompanyId.make(companyBUUID)
const companyCId = CompanyId.make(companyCUUID)
const periodRef = FiscalPeriodRef.make({ year: 2024, period: 6 })

let transactionIdCounter = 0
const makeTransactionId = () => {
  transactionIdCounter++
  const hex = transactionIdCounter.toString(16).padStart(12, "0")
  return IntercompanyTransactionId.make(`00000000-0000-0000-0000-${hex}`)
}

const createTransaction = (params: {
  fromCompanyId: CompanyId
  toCompanyId: CompanyId
  transactionType: IntercompanyTransactionType
  transactionDate: LocalDate
  amount: MonetaryAmount
  matchingStatus?: MatchingStatus
}): IntercompanyTransaction => {
  const now = makeTimestamp()
  return IntercompanyTransaction.make({
    id: makeTransactionId(),
    fromCompanyId: params.fromCompanyId,
    toCompanyId: params.toCompanyId,
    transactionType: params.transactionType,
    transactionDate: params.transactionDate,
    amount: params.amount,
    fromJournalEntryId: Option.none(),
    toJournalEntryId: Option.none(),
    matchingStatus: params.matchingStatus ?? "Unmatched",
    varianceAmount: Option.none(),
    varianceExplanation: Option.none(),
    description: Option.none(),
    createdAt: now,
    updatedAt: now
  })
}

const createMockRepository = (
  transactions: Chunk.Chunk<IntercompanyTransaction>,
  groupExists = true,
  periodExists = true
): IntercompanyTransactionRepositoryService => ({
  findByGroupAndPeriod: (_groupId, _periodRef) => Effect.succeed(transactions),
  groupExists: (_groupId) => Effect.succeed(groupExists),
  periodExists: (_periodRef) => Effect.succeed(periodExists),
  updateMatchingStatus: (_ids, _status, _variance, _explanation) => Effect.void
})

const createTestLayer = (
  transactions: Chunk.Chunk<IntercompanyTransaction>,
  groupExists = true,
  periodExists = true
) => {
  const repoLayer = Layer.succeed(
    IntercompanyTransactionRepository,
    createMockRepository(transactions, groupExists, periodExists)
  )
  return IntercompanyServiceLive.pipe(Layer.provide(repoLayer))
}

// =============================================================================
// MatchingConfig Tests
// =============================================================================

describe("MatchingConfig", () => {
  describe("creation", () => {
    it("creates with default values", () => {
      const config = MatchingConfig.make({})
      expect(config.dateTolerance).toBe(3)
      expect(config.amountTolerancePercent).toBe(0)
    })

    it("creates with custom date tolerance", () => {
      const config = MatchingConfig.make({ dateTolerance: 5 })
      expect(config.dateTolerance).toBe(5)
      expect(config.amountTolerancePercent).toBe(0)
    })

    it("creates with custom amount tolerance", () => {
      const config = MatchingConfig.make({ amountTolerancePercent: 1.5 })
      expect(config.dateTolerance).toBe(3)
      expect(config.amountTolerancePercent).toBe(1.5)
    })

    it("creates with both custom tolerances", () => {
      const config = MatchingConfig.make({ dateTolerance: 7, amountTolerancePercent: 2 })
      expect(config.dateTolerance).toBe(7)
      expect(config.amountTolerancePercent).toBe(2)
    })
  })

  describe("validation", () => {
    it.effect("rejects negative date tolerance", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(MatchingConfig)({ dateTolerance: -1 })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects negative amount tolerance", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(MatchingConfig)({ amountTolerancePercent: -1 })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects amount tolerance over 100", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(MatchingConfig)({ amountTolerancePercent: 101 })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("accepts edge case tolerances", () =>
      Effect.gen(function* () {
        const config = yield* Schema.decodeUnknown(MatchingConfig)({
          dateTolerance: 0,
          amountTolerancePercent: 100
        })
        expect(config.dateTolerance).toBe(0)
        expect(config.amountTolerancePercent).toBe(100)
      })
    )
  })

  describe("type guard", () => {
    it("isMatchingConfig returns true for valid config", () => {
      const config = MatchingConfig.make({})
      expect(isMatchingConfig(config)).toBe(true)
    })

    it("isMatchingConfig returns false for invalid values", () => {
      expect(isMatchingConfig(null)).toBe(false)
      expect(isMatchingConfig(undefined)).toBe(false)
      expect(isMatchingConfig({})).toBe(false)
    })
  })

  describe("default config", () => {
    it("defaultMatchingConfig has expected values", () => {
      expect(defaultMatchingConfig.dateTolerance).toBe(3)
      expect(defaultMatchingConfig.amountTolerancePercent).toBe(0)
    })
  })
})

// =============================================================================
// MatchedPair Tests
// =============================================================================

describe("MatchedPair", () => {
  const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
  const amount = MonetaryAmount.unsafeFromString("1000", "USD")

  it("creates exact match pair", () => {
    const from = createTransaction({
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount
    })
    const to = createTransaction({
      fromCompanyId: companyBId,
      toCompanyId: companyAId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount
    })

    const pair = MatchedPair.make({
      fromTransaction: from,
      toTransaction: to,
      varianceAmount: Option.none(),
      isExactMatch: true
    })

    expect(pair.isExactMatch).toBe(true)
    expect(Option.isNone(pair.varianceAmount)).toBe(true)
    expect(Option.isNone(pair.variancePercentage)).toBe(true)
  })

  it("creates partial match pair with variance", () => {
    const fromAmount = MonetaryAmount.unsafeFromString("1000", "USD")
    const toAmount = MonetaryAmount.unsafeFromString("990", "USD")
    const variance = MonetaryAmount.unsafeFromString("10", "USD")

    const from = createTransaction({
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount: fromAmount
    })
    const to = createTransaction({
      fromCompanyId: companyBId,
      toCompanyId: companyAId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount: toAmount
    })

    const pair = MatchedPair.make({
      fromTransaction: from,
      toTransaction: to,
      varianceAmount: Option.some(variance),
      isExactMatch: false
    })

    expect(pair.isExactMatch).toBe(false)
    expect(Option.isSome(pair.varianceAmount)).toBe(true)
    expect(Option.isSome(pair.variancePercentage)).toBe(true)

    const variancePercent = Option.getOrThrow(pair.variancePercentage)
    expect(variancePercent).toBeCloseTo(1, 2) // 1%
  })

  it("variance percentage is none for zero from amount", () => {
    const zeroAmount = MonetaryAmount.unsafeFromString("0", "USD")
    const variance = MonetaryAmount.unsafeFromString("10", "USD")

    const from = createTransaction({
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount: zeroAmount
    })
    const to = createTransaction({
      fromCompanyId: companyBId,
      toCompanyId: companyAId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount: zeroAmount
    })

    const pair = MatchedPair.make({
      fromTransaction: from,
      toTransaction: to,
      varianceAmount: Option.some(variance),
      isExactMatch: false
    })

    expect(Option.isNone(pair.variancePercentage)).toBe(true)
  })

  describe("type guard", () => {
    it("isMatchedPair returns true for valid pair", () => {
      const tx = createTransaction({
        fromCompanyId: companyAId,
        toCompanyId: companyBId,
        transactionType: "SalePurchase",
        transactionDate: date,
        amount
      })
      const pair = MatchedPair.make({
        fromTransaction: tx,
        toTransaction: tx,
        varianceAmount: Option.none(),
        isExactMatch: true
      })
      expect(isMatchedPair(pair)).toBe(true)
    })

    it("isMatchedPair returns false for invalid values", () => {
      expect(isMatchedPair(null)).toBe(false)
      expect(isMatchedPair(undefined)).toBe(false)
      expect(isMatchedPair({})).toBe(false)
    })
  })
})

// =============================================================================
// UnmatchedTransaction Tests
// =============================================================================

describe("UnmatchedTransaction", () => {
  const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
  const amount = MonetaryAmount.unsafeFromString("1000", "USD")

  it("creates unmatched transaction missing to side", () => {
    const tx = createTransaction({
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount
    })

    const unmatched = UnmatchedTransaction.make({
      transaction: tx,
      missingSide: "to",
      reason: Option.some("No counterpart found")
    })

    expect(unmatched.missingSide).toBe("to")
    expect(Option.isSome(unmatched.reason)).toBe(true)
  })

  it("creates unmatched transaction missing from side", () => {
    const tx = createTransaction({
      fromCompanyId: companyBId,
      toCompanyId: companyAId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount
    })

    const unmatched = UnmatchedTransaction.make({
      transaction: tx,
      missingSide: "from",
      reason: Option.none()
    })

    expect(unmatched.missingSide).toBe("from")
    expect(Option.isNone(unmatched.reason)).toBe(true)
  })

  describe("type guard", () => {
    it("isUnmatchedTransaction returns true for valid unmatched", () => {
      const tx = createTransaction({
        fromCompanyId: companyAId,
        toCompanyId: companyBId,
        transactionType: "SalePurchase",
        transactionDate: date,
        amount
      })
      const unmatched = UnmatchedTransaction.make({
        transaction: tx,
        missingSide: "to",
        reason: Option.none()
      })
      expect(isUnmatchedTransaction(unmatched)).toBe(true)
    })

    it("isUnmatchedTransaction returns false for invalid values", () => {
      expect(isUnmatchedTransaction(null)).toBe(false)
      expect(isUnmatchedTransaction(undefined)).toBe(false)
      expect(isUnmatchedTransaction({})).toBe(false)
    })
  })
})

// =============================================================================
// DiscrepancyDetail Tests
// =============================================================================

describe("DiscrepancyDetail", () => {
  const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
  const amount = MonetaryAmount.unsafeFromString("1000", "USD")

  it("creates missing counterpart discrepancy", () => {
    const discrepancy = DiscrepancyDetail.make({
      discrepancyType: "MissingCounterpart",
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "SalePurchase",
      expectedAmount: amount,
      actualAmount: Option.none(),
      varianceAmount: Option.some(amount),
      expectedDate: date,
      actualDate: Option.none(),
      dateDifference: Option.none(),
      description: "Missing counterpart transaction",
      relatedTransactionIds: Chunk.of(makeTransactionId())
    })

    expect(discrepancy.discrepancyType).toBe("MissingCounterpart")
    expect(Option.isNone(discrepancy.actualAmount)).toBe(true)
    expect(Option.isNone(discrepancy.actualDate)).toBe(true)
  })

  it("creates amount mismatch discrepancy", () => {
    const actualAmount = MonetaryAmount.unsafeFromString("990", "USD")
    const variance = MonetaryAmount.unsafeFromString("10", "USD")
    const actualDate = LocalDate.make({ year: 2024, month: 6, day: 16 })

    const discrepancy = DiscrepancyDetail.make({
      discrepancyType: "AmountMismatch",
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "Loan",
      expectedAmount: amount,
      actualAmount: Option.some(actualAmount),
      varianceAmount: Option.some(variance),
      expectedDate: date,
      actualDate: Option.some(actualDate),
      dateDifference: Option.some(1),
      description: "Amount variance between companies",
      relatedTransactionIds: Chunk.make(makeTransactionId(), makeTransactionId())
    })

    expect(discrepancy.discrepancyType).toBe("AmountMismatch")
    expect(Option.isSome(discrepancy.actualAmount)).toBe(true)
    expect(Option.isSome(discrepancy.dateDifference)).toBe(true)
    expect(Chunk.size(discrepancy.relatedTransactionIds)).toBe(2)
  })

  describe("type guard", () => {
    it("isDiscrepancyDetail returns true for valid discrepancy", () => {
      const discrepancy = DiscrepancyDetail.make({
        discrepancyType: "MissingCounterpart",
        fromCompanyId: companyAId,
        toCompanyId: companyBId,
        transactionType: "SalePurchase",
        expectedAmount: amount,
        actualAmount: Option.none(),
        varianceAmount: Option.none(),
        expectedDate: date,
        actualDate: Option.none(),
        dateDifference: Option.none(),
        description: "Test",
        relatedTransactionIds: Chunk.empty()
      })
      expect(isDiscrepancyDetail(discrepancy)).toBe(true)
    })

    it("isDiscrepancyDetail returns false for invalid values", () => {
      expect(isDiscrepancyDetail(null)).toBe(false)
      expect(isDiscrepancyDetail(undefined)).toBe(false)
      expect(isDiscrepancyDetail({})).toBe(false)
    })
  })
})

// =============================================================================
// MatchingReport Tests
// =============================================================================

describe("MatchingReport", () => {
  const now = makeTimestamp()

  it("creates report with computed properties", () => {
    const report = MatchingReport.make({
      groupId,
      periodRef,
      matchedAt: now,
      config: defaultMatchingConfig,
      totalTransactions: 10,
      matchedCount: 4,
      unmatchedCount: 2,
      partialMatchCount: 0,
      totalVarianceAmount: Option.none(),
      discrepancies: Chunk.empty()
    })

    expect(report.matchRate).toBe(80) // 4 * 2 / 10 = 80%
    expect(report.isFullyMatched).toBe(false)
    expect(report.hasDiscrepancies).toBe(false)
    expect(report.discrepancyCount).toBe(0)
  })

  it("calculates 100% match rate when all matched", () => {
    const report = MatchingReport.make({
      groupId,
      periodRef,
      matchedAt: now,
      config: defaultMatchingConfig,
      totalTransactions: 10,
      matchedCount: 5,
      unmatchedCount: 0,
      partialMatchCount: 0,
      totalVarianceAmount: Option.none(),
      discrepancies: Chunk.empty()
    })

    expect(report.matchRate).toBe(100)
    expect(report.isFullyMatched).toBe(true)
  })

  it("calculates 100% match rate when no transactions", () => {
    const report = MatchingReport.make({
      groupId,
      periodRef,
      matchedAt: now,
      config: defaultMatchingConfig,
      totalTransactions: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      partialMatchCount: 0,
      totalVarianceAmount: Option.none(),
      discrepancies: Chunk.empty()
    })

    expect(report.matchRate).toBe(100)
    expect(report.isFullyMatched).toBe(true)
  })

  it("identifies partial matches as not fully matched", () => {
    const report = MatchingReport.make({
      groupId,
      periodRef,
      matchedAt: now,
      config: defaultMatchingConfig,
      totalTransactions: 10,
      matchedCount: 5,
      unmatchedCount: 0,
      partialMatchCount: 2,
      totalVarianceAmount: Option.some(MonetaryAmount.unsafeFromString("100", "USD")),
      discrepancies: Chunk.empty()
    })

    expect(report.isFullyMatched).toBe(false)
  })

  it("tracks discrepancy count", () => {
    const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
    const amount = MonetaryAmount.unsafeFromString("1000", "USD")

    const discrepancy = DiscrepancyDetail.make({
      discrepancyType: "MissingCounterpart",
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "SalePurchase",
      expectedAmount: amount,
      actualAmount: Option.none(),
      varianceAmount: Option.none(),
      expectedDate: date,
      actualDate: Option.none(),
      dateDifference: Option.none(),
      description: "Test",
      relatedTransactionIds: Chunk.empty()
    })

    const report = MatchingReport.make({
      groupId,
      periodRef,
      matchedAt: now,
      config: defaultMatchingConfig,
      totalTransactions: 10,
      matchedCount: 4,
      unmatchedCount: 2,
      partialMatchCount: 0,
      totalVarianceAmount: Option.none(),
      discrepancies: Chunk.of(discrepancy)
    })

    expect(report.hasDiscrepancies).toBe(true)
    expect(report.discrepancyCount).toBe(1)
  })

  describe("type guard", () => {
    it("isMatchingReport returns true for valid report", () => {
      const report = MatchingReport.make({
        groupId,
        periodRef,
        matchedAt: now,
        config: defaultMatchingConfig,
        totalTransactions: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        partialMatchCount: 0,
        totalVarianceAmount: Option.none(),
        discrepancies: Chunk.empty()
      })
      expect(isMatchingReport(report)).toBe(true)
    })

    it("isMatchingReport returns false for invalid values", () => {
      expect(isMatchingReport(null)).toBe(false)
      expect(isMatchingReport(undefined)).toBe(false)
      expect(isMatchingReport({})).toBe(false)
    })
  })
})

// =============================================================================
// MatchingResult Tests
// =============================================================================

describe("MatchingResult", () => {
  const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
  const amount = MonetaryAmount.unsafeFromString("1000", "USD")
  const now = makeTimestamp()

  const createMinimalReport = () =>
    MatchingReport.make({
      groupId,
      periodRef,
      matchedAt: now,
      config: defaultMatchingConfig,
      totalTransactions: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      partialMatchCount: 0,
      totalVarianceAmount: Option.none(),
      discrepancies: Chunk.empty()
    })

  it("creates result with computed properties", () => {
    const tx1 = createTransaction({
      fromCompanyId: companyAId,
      toCompanyId: companyBId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount
    })
    const tx2 = createTransaction({
      fromCompanyId: companyBId,
      toCompanyId: companyAId,
      transactionType: "SalePurchase",
      transactionDate: date,
      amount
    })
    const tx3 = createTransaction({
      fromCompanyId: companyAId,
      toCompanyId: companyCId,
      transactionType: "Loan",
      transactionDate: date,
      amount
    })

    const exactPair = MatchedPair.make({
      fromTransaction: tx1,
      toTransaction: tx2,
      varianceAmount: Option.none(),
      isExactMatch: true
    })

    const partialPair = MatchedPair.make({
      fromTransaction: tx1,
      toTransaction: tx2,
      varianceAmount: Option.some(MonetaryAmount.unsafeFromString("10", "USD")),
      isExactMatch: false
    })

    const unmatchedFrom = UnmatchedTransaction.make({
      transaction: tx3,
      missingSide: "to",
      reason: Option.none()
    })

    const unmatchedTo = UnmatchedTransaction.make({
      transaction: tx3,
      missingSide: "from",
      reason: Option.none()
    })

    const result = MatchingResult.make({
      matchedPairs: Chunk.make(exactPair, partialPair),
      unmatchedTransactions: Chunk.make(unmatchedFrom, unmatchedTo),
      report: createMinimalReport()
    })

    expect(result.matchedCount).toBe(2)
    expect(result.unmatchedCount).toBe(2)
    expect(Chunk.size(result.exactMatches)).toBe(1)
    expect(Chunk.size(result.partialMatches)).toBe(1)
    expect(Chunk.size(result.unmatchedFromSide)).toBe(1)
    expect(Chunk.size(result.unmatchedToSide)).toBe(1)
  })

  describe("type guard", () => {
    it("isMatchingResult returns true for valid result", () => {
      const result = MatchingResult.make({
        matchedPairs: Chunk.empty(),
        unmatchedTransactions: Chunk.empty(),
        report: createMinimalReport()
      })
      expect(isMatchingResult(result)).toBe(true)
    })

    it("isMatchingResult returns false for invalid values", () => {
      expect(isMatchingResult(null)).toBe(false)
      expect(isMatchingResult(undefined)).toBe(false)
      expect(isMatchingResult({})).toBe(false)
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

    it("isConsolidationGroupNotFoundError returns true for valid error", () => {
      const error = new ConsolidationGroupNotFoundError({ groupId })
      expect(isConsolidationGroupNotFoundError(error)).toBe(true)
    })

    it("isConsolidationGroupNotFoundError returns false for other values", () => {
      expect(isConsolidationGroupNotFoundError(null)).toBe(false)
      expect(isConsolidationGroupNotFoundError(undefined)).toBe(false)
      expect(isConsolidationGroupNotFoundError(new Error("test"))).toBe(false)
      expect(isConsolidationGroupNotFoundError({ _tag: "ConsolidationGroupNotFoundError" })).toBe(false)
    })
  })

  describe("FiscalPeriodNotFoundError", () => {
    it("creates error with correct message", () => {
      const error = new FiscalPeriodNotFoundError({ periodRef })
      expect(error._tag).toBe("FiscalPeriodNotFoundError")
      expect(error.message).toContain("FY2024-P06")
      expect(error.message).toContain("Fiscal period not found")
    })

    it("isFiscalPeriodNotFoundError returns true for valid error", () => {
      const error = new FiscalPeriodNotFoundError({ periodRef })
      expect(isFiscalPeriodNotFoundError(error)).toBe(true)
    })

    it("isFiscalPeriodNotFoundError returns false for other values", () => {
      expect(isFiscalPeriodNotFoundError(null)).toBe(false)
      expect(isFiscalPeriodNotFoundError(undefined)).toBe(false)
      expect(isFiscalPeriodNotFoundError(new Error("test"))).toBe(false)
      expect(isFiscalPeriodNotFoundError({ _tag: "FiscalPeriodNotFoundError" })).toBe(false)
    })
  })
})

// =============================================================================
// IntercompanyService Tests
// =============================================================================

describe("IntercompanyService", () => {
  beforeEach(() => {
    transactionIdCounter = 0
  })

  describe("matchTransactions", () => {
    describe("validation", () => {
      it.effect("fails with ConsolidationGroupNotFoundError when group does not exist", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* Effect.exit(
            service.matchTransactions(groupId, periodRef)
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isConsolidationGroupNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(createTestLayer(Chunk.empty(), false, true))
        )
      )

      it.effect("fails with FiscalPeriodNotFoundError when period does not exist", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* Effect.exit(
            service.matchTransactions(groupId, periodRef)
          )

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isFiscalPeriodNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(createTestLayer(Chunk.empty(), true, false))
        )
      )
    })

    describe("empty transactions", () => {
      it.effect("returns empty result when no transactions", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(0)
          expect(result.unmatchedCount).toBe(0)
          expect(result.report.totalTransactions).toBe(0)
          expect(result.report.matchRate).toBe(100)
          expect(result.report.isFullyMatched).toBe(true)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.empty()))
        )
      )
    })

    describe("exact matching", () => {
      it.effect("matches transactions with same type, date, amount, and reversed companies", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(1)
          expect(result.unmatchedCount).toBe(0)
          expect(Chunk.size(result.exactMatches)).toBe(1)
          expect(Chunk.size(result.partialMatches)).toBe(0)
          expect(result.report.isFullyMatched).toBe(true)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )

      it.effect("matches multiple pairs correctly", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(2)
          expect(result.unmatchedCount).toBe(0)
          expect(result.report.matchedCount).toBe(2)
          expect(result.report.isFullyMatched).toBe(true)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyCId,
              transactionType: "Loan",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("2000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyCId,
              toCompanyId: companyAId,
              transactionType: "Loan",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("2000", "USD")
            })
          )))
        )
      )
    })

    describe("date tolerance matching", () => {
      it.effect("matches transactions within date tolerance", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(1)
          expect(result.unmatchedCount).toBe(0)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 17 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )

      it.effect("does not match transactions outside date tolerance", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(0)
          expect(result.unmatchedCount).toBe(2)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 20 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )

      it.effect("uses custom date tolerance", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const customConfig = MatchingConfig.make({ dateTolerance: 7 })
          const result = yield* service.matchTransactions(groupId, periodRef, customConfig)

          expect(result.matchedCount).toBe(1)
          expect(result.unmatchedCount).toBe(0)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 20 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )
    })

    describe("variance handling", () => {
      it.effect("creates partial match when amounts differ", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(1)
          expect(Chunk.size(result.partialMatches)).toBe(1)
          expect(Chunk.size(result.exactMatches)).toBe(0)
          expect(result.report.partialMatchCount).toBe(1)

          const partialMatch = Chunk.unsafeHead(result.partialMatches)
          expect(partialMatch.isExactMatch).toBe(false)
          expect(Option.isSome(partialMatch.varianceAmount)).toBe(true)

          const variance = Option.getOrThrow(partialMatch.varianceAmount)
          expect(BigDecimal.equals(variance.amount, BigDecimal.unsafeFromString("10"))).toBe(true)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("990", "USD")
            })
          )))
        )
      )

      it.effect("reports variance discrepancy for partial matches", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.report.hasDiscrepancies).toBe(true)

          const discrepancy = Chunk.unsafeHead(result.report.discrepancies)
          expect(discrepancy.discrepancyType).toBe("AmountMismatch")
          expect(Option.isSome(discrepancy.varianceAmount)).toBe(true)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("980", "USD")
            })
          )))
        )
      )
    })

    describe("unmatched transactions", () => {
      it.effect("identifies transactions without counterpart", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(0)
          expect(result.unmatchedCount).toBe(1)
          expect(Chunk.size(result.unmatchedToSide)).toBe(1)

          const unmatched = Chunk.unsafeHead(result.unmatchedTransactions)
          expect(unmatched.missingSide).toBe("to")
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )

      it.effect("creates missing counterpart discrepancy for unmatched", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.report.hasDiscrepancies).toBe(true)

          const discrepancy = Chunk.unsafeHead(result.report.discrepancies)
          expect(discrepancy.discrepancyType).toBe("MissingCounterpart")
          expect(discrepancy.description).toContain("Missing counterpart")
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )
    })

    describe("transaction type matching", () => {
      it.effect("does not match transactions with different types", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(0)
          expect(result.unmatchedCount).toBe(2)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "Loan",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )
    })

    describe("currency matching", () => {
      it.effect("does not match transactions with different currencies", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(0)
          expect(result.unmatchedCount).toBe(2)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "EUR")
            })
          )))
        )
      )
    })

    describe("company pair matching", () => {
      it.effect("only matches transactions between the same company pair (reversed)", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(0)
          expect(result.unmatchedCount).toBe(2)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyCId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            })
          )))
        )
      )
    })

    describe("all transaction types", () => {
      const allTypes: IntercompanyTransactionType[] = [
        "SalePurchase",
        "Loan",
        "ManagementFee",
        "Dividend",
        "CapitalContribution",
        "CostAllocation",
        "Royalty"
      ]

      for (const txType of allTypes) {
        it.effect(`matches ${txType} transactions correctly`, () =>
          Effect.gen(function* () {
            const service = yield* IntercompanyService
            const result = yield* service.matchTransactions(groupId, periodRef)

            expect(result.matchedCount).toBe(1)
            expect(result.unmatchedCount).toBe(0)
          }).pipe(
            Effect.provide(createTestLayer(Chunk.make(
              createTransaction({
                fromCompanyId: companyAId,
                toCompanyId: companyBId,
                transactionType: txType,
                transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
                amount: MonetaryAmount.unsafeFromString("1000", "USD")
              }),
              createTransaction({
                fromCompanyId: companyBId,
                toCompanyId: companyAId,
                transactionType: txType,
                transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
                amount: MonetaryAmount.unsafeFromString("1000", "USD")
              })
            )))
          )
        )
      }
    })

    describe("amount tolerance", () => {
      it.effect("matches within amount tolerance percentage", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const customConfig = MatchingConfig.make({ amountTolerancePercent: 2 })
          const result = yield* service.matchTransactions(groupId, periodRef, customConfig)

          expect(result.matchedCount).toBe(1)
          // Still creates a partial match since there's variance
          expect(Chunk.size(result.partialMatches)).toBe(1)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("985", "USD")
            })
          )))
        )
      )
    })

    describe("complex scenarios", () => {
      it.effect("handles mixed matched, unmatched, and partial matches", () =>
        Effect.gen(function* () {
          const service = yield* IntercompanyService
          const result = yield* service.matchTransactions(groupId, periodRef)

          expect(result.matchedCount).toBe(2) // 1 exact + 1 partial
          expect(Chunk.size(result.exactMatches)).toBe(1)
          expect(Chunk.size(result.partialMatches)).toBe(1)
          expect(result.unmatchedCount).toBe(1)
          expect(result.report.partialMatchCount).toBe(1)
          expect(result.report.isFullyMatched).toBe(false)
        }).pipe(
          Effect.provide(createTestLayer(Chunk.make(
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyBId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyAId,
              transactionType: "SalePurchase",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyAId,
              toCompanyId: companyCId,
              transactionType: "Loan",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("1000", "USD")
            }),
            createTransaction({
              fromCompanyId: companyCId,
              toCompanyId: companyAId,
              transactionType: "Loan",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("990", "USD")
            }),
            createTransaction({
              fromCompanyId: companyBId,
              toCompanyId: companyCId,
              transactionType: "ManagementFee",
              transactionDate: LocalDate.make({ year: 2024, month: 6, day: 15 }),
              amount: MonetaryAmount.unsafeFromString("500", "USD")
            })
          )))
        )
      )
    })
  })
})
