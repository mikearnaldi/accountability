import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  IntercompanyTransactionId,
  isIntercompanyTransactionId,
  IntercompanyTransactionType,
  isIntercompanyTransactionType,
  MatchingStatus,
  isMatchingStatus,
  IntercompanyTransaction,
  isIntercompanyTransaction
} from "../../src/consolidation/IntercompanyTransaction.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { JournalEntryId } from "../../src/journal/JournalEntry.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

const makeTimestamp = () => Timestamp.make({ epochMillis: Date.now() })

describe("IntercompanyTransactionId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = IntercompanyTransactionId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = IntercompanyTransactionId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransactionId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransactionId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransactionId)
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isIntercompanyTransactionId returns true for valid IntercompanyTransactionId", () => {
      const id = IntercompanyTransactionId.make(validUUID)
      expect(isIntercompanyTransactionId(id)).toBe(true)
    })

    it("isIntercompanyTransactionId returns true for plain UUID string (validates pattern)", () => {
      expect(isIntercompanyTransactionId(validUUID)).toBe(true)
    })

    it("isIntercompanyTransactionId returns false for non-string values", () => {
      expect(isIntercompanyTransactionId(null)).toBe(false)
      expect(isIntercompanyTransactionId(undefined)).toBe(false)
      expect(isIntercompanyTransactionId(123)).toBe(false)
      expect(isIntercompanyTransactionId({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates IntercompanyTransactionId using Schema's .make()", () => {
      const id = IntercompanyTransactionId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isIntercompanyTransactionId(id)).toBe(true)
    })
  })
})

describe("IntercompanyTransactionType", () => {
  describe("validation", () => {
    it.effect("accepts all valid transaction types", () =>
      Effect.gen(function* () {
        const types: IntercompanyTransactionType[] = [
          "SalePurchase",
          "Loan",
          "ManagementFee",
          "Dividend",
          "CapitalContribution",
          "CostAllocation",
          "Royalty"
        ]

        for (const type of types) {
          const decoded = yield* Schema.decodeUnknown(IntercompanyTransactionType)(type)
          expect(decoded).toBe(type)
        }
      })
    )

    it.effect("rejects invalid transaction type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransactionType)
        const result = yield* Effect.exit(decode("InvalidType"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransactionType)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransactionType)
        const result = yield* Effect.exit(decode(123))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isIntercompanyTransactionType returns true for valid types", () => {
      expect(isIntercompanyTransactionType("SalePurchase")).toBe(true)
      expect(isIntercompanyTransactionType("Loan")).toBe(true)
      expect(isIntercompanyTransactionType("ManagementFee")).toBe(true)
      expect(isIntercompanyTransactionType("Dividend")).toBe(true)
      expect(isIntercompanyTransactionType("CapitalContribution")).toBe(true)
      expect(isIntercompanyTransactionType("CostAllocation")).toBe(true)
      expect(isIntercompanyTransactionType("Royalty")).toBe(true)
    })

    it("isIntercompanyTransactionType returns false for invalid types", () => {
      expect(isIntercompanyTransactionType("InvalidType")).toBe(false)
      expect(isIntercompanyTransactionType(null)).toBe(false)
      expect(isIntercompanyTransactionType(undefined)).toBe(false)
      expect(isIntercompanyTransactionType(123)).toBe(false)
    })
  })
})

describe("MatchingStatus", () => {
  describe("validation", () => {
    it.effect("accepts all valid matching statuses", () =>
      Effect.gen(function* () {
        const statuses: MatchingStatus[] = [
          "Matched",
          "Unmatched",
          "PartiallyMatched",
          "VarianceApproved"
        ]

        for (const status of statuses) {
          const decoded = yield* Schema.decodeUnknown(MatchingStatus)(status)
          expect(decoded).toBe(status)
        }
      })
    )

    it.effect("rejects invalid matching status", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(MatchingStatus)
        const result = yield* Effect.exit(decode("InvalidStatus"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(MatchingStatus)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(MatchingStatus)
        const result = yield* Effect.exit(decode(123))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isMatchingStatus returns true for valid statuses", () => {
      expect(isMatchingStatus("Matched")).toBe(true)
      expect(isMatchingStatus("Unmatched")).toBe(true)
      expect(isMatchingStatus("PartiallyMatched")).toBe(true)
      expect(isMatchingStatus("VarianceApproved")).toBe(true)
    })

    it("isMatchingStatus returns false for invalid statuses", () => {
      expect(isMatchingStatus("InvalidStatus")).toBe(false)
      expect(isMatchingStatus(null)).toBe(false)
      expect(isMatchingStatus(undefined)).toBe(false)
      expect(isMatchingStatus(123)).toBe(false)
    })
  })
})

describe("IntercompanyTransaction", () => {
  const transactionUUID = "550e8400-e29b-41d4-a716-446655440000"
  const fromCompanyUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const toCompanyUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const fromJournalEntryUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const toJournalEntryUUID = "9ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const transactionDate = LocalDate.make({ year: 2024, month: 6, day: 15 })
  const amount = MonetaryAmount.unsafeFromString("100000", "USD")
  const varianceAmount = MonetaryAmount.unsafeFromString("500", "USD")
  const now = makeTimestamp()

  const createMatchedTransaction = () => {
    return IntercompanyTransaction.make({
      id: IntercompanyTransactionId.make(transactionUUID),
      fromCompanyId: CompanyId.make(fromCompanyUUID),
      toCompanyId: CompanyId.make(toCompanyUUID),
      transactionType: "SalePurchase",
      transactionDate,
      amount,
      fromJournalEntryId: Option.some(JournalEntryId.make(fromJournalEntryUUID)),
      toJournalEntryId: Option.some(JournalEntryId.make(toJournalEntryUUID)),
      matchingStatus: "Matched",
      varianceAmount: Option.none(),
      varianceExplanation: Option.none(),
      description: Option.some("Intercompany sale of goods"),
      createdAt: now,
      updatedAt: now
    })
  }

  const createUnmatchedTransaction = () => {
    return IntercompanyTransaction.make({
      id: IntercompanyTransactionId.make(transactionUUID),
      fromCompanyId: CompanyId.make(fromCompanyUUID),
      toCompanyId: CompanyId.make(toCompanyUUID),
      transactionType: "Loan",
      transactionDate,
      amount,
      fromJournalEntryId: Option.some(JournalEntryId.make(fromJournalEntryUUID)),
      toJournalEntryId: Option.none(),
      matchingStatus: "Unmatched",
      varianceAmount: Option.none(),
      varianceExplanation: Option.none(),
      description: Option.none(),
      createdAt: now,
      updatedAt: now
    })
  }

  const createPartiallyMatchedTransaction = () => {
    return IntercompanyTransaction.make({
      id: IntercompanyTransactionId.make(transactionUUID),
      fromCompanyId: CompanyId.make(fromCompanyUUID),
      toCompanyId: CompanyId.make(toCompanyUUID),
      transactionType: "ManagementFee",
      transactionDate,
      amount,
      fromJournalEntryId: Option.some(JournalEntryId.make(fromJournalEntryUUID)),
      toJournalEntryId: Option.some(JournalEntryId.make(toJournalEntryUUID)),
      matchingStatus: "PartiallyMatched",
      varianceAmount: Option.some(varianceAmount),
      varianceExplanation: Option.none(),
      description: Option.some("Monthly management fee"),
      createdAt: now,
      updatedAt: now
    })
  }

  const createVarianceApprovedTransaction = () => {
    return IntercompanyTransaction.make({
      id: IntercompanyTransactionId.make(transactionUUID),
      fromCompanyId: CompanyId.make(fromCompanyUUID),
      toCompanyId: CompanyId.make(toCompanyUUID),
      transactionType: "Dividend",
      transactionDate,
      amount,
      fromJournalEntryId: Option.some(JournalEntryId.make(fromJournalEntryUUID)),
      toJournalEntryId: Option.some(JournalEntryId.make(toJournalEntryUUID)),
      matchingStatus: "VarianceApproved",
      varianceAmount: Option.some(varianceAmount),
      varianceExplanation: Option.some("Timing difference - approved by CFO"),
      description: Option.some("Q2 dividend distribution"),
      createdAt: now,
      updatedAt: now
    })
  }

  const createTransactionWithNoEntries = () => {
    return IntercompanyTransaction.make({
      id: IntercompanyTransactionId.make(transactionUUID),
      fromCompanyId: CompanyId.make(fromCompanyUUID),
      toCompanyId: CompanyId.make(toCompanyUUID),
      transactionType: "CapitalContribution",
      transactionDate,
      amount,
      fromJournalEntryId: Option.none(),
      toJournalEntryId: Option.none(),
      matchingStatus: "Unmatched",
      varianceAmount: Option.none(),
      varianceExplanation: Option.none(),
      description: Option.none(),
      createdAt: now,
      updatedAt: now
    })
  }

  describe("validation", () => {
    it.effect("accepts valid matched transaction", () =>
      Effect.gen(function* () {
        const tx = createMatchedTransaction()
        expect(tx.id).toBe(transactionUUID)
        expect(tx.fromCompanyId).toBe(fromCompanyUUID)
        expect(tx.toCompanyId).toBe(toCompanyUUID)
        expect(tx.transactionType).toBe("SalePurchase")
        expect(tx.matchingStatus).toBe("Matched")
        expect(Option.isSome(tx.fromJournalEntryId)).toBe(true)
        expect(Option.isSome(tx.toJournalEntryId)).toBe(true)
        expect(Option.isNone(tx.varianceAmount)).toBe(true)
        expect(Option.isSome(tx.description)).toBe(true)
      })
    )

    it.effect("accepts valid unmatched transaction", () =>
      Effect.gen(function* () {
        const tx = createUnmatchedTransaction()
        expect(tx.matchingStatus).toBe("Unmatched")
        expect(Option.isSome(tx.fromJournalEntryId)).toBe(true)
        expect(Option.isNone(tx.toJournalEntryId)).toBe(true)
      })
    )

    it.effect("accepts valid partially matched transaction with variance", () =>
      Effect.gen(function* () {
        const tx = createPartiallyMatchedTransaction()
        expect(tx.matchingStatus).toBe("PartiallyMatched")
        expect(Option.isSome(tx.varianceAmount)).toBe(true)
      })
    )

    it.effect("accepts valid variance approved transaction with explanation", () =>
      Effect.gen(function* () {
        const tx = createVarianceApprovedTransaction()
        expect(tx.matchingStatus).toBe("VarianceApproved")
        expect(Option.isSome(tx.varianceAmount)).toBe(true)
        expect(Option.isSome(tx.varianceExplanation)).toBe(true)
      })
    )

    it.effect("accepts transaction with no journal entries", () =>
      Effect.gen(function* () {
        const tx = createTransactionWithNoEntries()
        expect(Option.isNone(tx.fromJournalEntryId)).toBe(true)
        expect(Option.isNone(tx.toJournalEntryId)).toBe(true)
      })
    )

    it.effect("accepts all transaction types", () =>
      Effect.gen(function* () {
        const types: IntercompanyTransactionType[] = [
          "SalePurchase",
          "Loan",
          "ManagementFee",
          "Dividend",
          "CapitalContribution",
          "CostAllocation",
          "Royalty"
        ]

        for (const type of types) {
          const tx = IntercompanyTransaction.make({
            id: IntercompanyTransactionId.make(transactionUUID),
            fromCompanyId: CompanyId.make(fromCompanyUUID),
            toCompanyId: CompanyId.make(toCompanyUUID),
            transactionType: type,
            transactionDate,
            amount,
            fromJournalEntryId: Option.none(),
            toJournalEntryId: Option.none(),
            matchingStatus: "Unmatched",
            varianceAmount: Option.none(),
            varianceExplanation: Option.none(),
            description: Option.none(),
            createdAt: now,
            updatedAt: now
          })
          expect(tx.transactionType).toBe(type)
        }
      })
    )

    it.effect("accepts all matching statuses", () =>
      Effect.gen(function* () {
        const statuses: MatchingStatus[] = [
          "Matched",
          "Unmatched",
          "PartiallyMatched",
          "VarianceApproved"
        ]

        for (const status of statuses) {
          const tx = IntercompanyTransaction.make({
            id: IntercompanyTransactionId.make(transactionUUID),
            fromCompanyId: CompanyId.make(fromCompanyUUID),
            toCompanyId: CompanyId.make(toCompanyUUID),
            transactionType: "SalePurchase",
            transactionDate,
            amount,
            fromJournalEntryId: Option.none(),
            toJournalEntryId: Option.none(),
            matchingStatus: status,
            varianceAmount: Option.none(),
            varianceExplanation: Option.none(),
            description: Option.none(),
            createdAt: now,
            updatedAt: now
          })
          expect(tx.matchingStatus).toBe(status)
        }
      })
    )

    it.effect("rejects invalid transaction id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: "invalid-id",
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid fromCompanyId", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: "invalid-id",
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid toCompanyId", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: "invalid-id",
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid transaction type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "InvalidType",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid matching status", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "InvalidStatus",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid transaction date", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 13, day: 15 }, // Invalid month
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid journal entry id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: "invalid-id", // Invalid UUID
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid currency in amount", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "INVALID" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty description string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "Matched",
          varianceAmount: null,
          varianceExplanation: null,
          description: "", // Empty string not allowed (NonEmptyTrimmedString)
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only variance explanation", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(IntercompanyTransaction)
        const result = yield* Effect.exit(decode({
          id: transactionUUID,
          fromCompanyId: fromCompanyUUID,
          toCompanyId: toCompanyUUID,
          transactionType: "SalePurchase",
          transactionDate: { year: 2024, month: 6, day: 15 },
          amount: { amount: "100000", currency: "USD" },
          fromJournalEntryId: null,
          toJournalEntryId: null,
          matchingStatus: "VarianceApproved",
          varianceAmount: { amount: "500", currency: "USD" },
          varianceExplanation: "   ", // Whitespace only
          description: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties - matching status", () => {
    it("isMatched returns true for Matched status", () => {
      const tx = createMatchedTransaction()
      expect(tx.isMatched).toBe(true)
    })

    it("isMatched returns false for other statuses", () => {
      expect(createUnmatchedTransaction().isMatched).toBe(false)
      expect(createPartiallyMatchedTransaction().isMatched).toBe(false)
      expect(createVarianceApprovedTransaction().isMatched).toBe(false)
    })

    it("isUnmatched returns true for Unmatched status", () => {
      const tx = createUnmatchedTransaction()
      expect(tx.isUnmatched).toBe(true)
    })

    it("isUnmatched returns false for other statuses", () => {
      expect(createMatchedTransaction().isUnmatched).toBe(false)
      expect(createPartiallyMatchedTransaction().isUnmatched).toBe(false)
      expect(createVarianceApprovedTransaction().isUnmatched).toBe(false)
    })

    it("isPartiallyMatched returns true for PartiallyMatched status", () => {
      const tx = createPartiallyMatchedTransaction()
      expect(tx.isPartiallyMatched).toBe(true)
    })

    it("isPartiallyMatched returns false for other statuses", () => {
      expect(createMatchedTransaction().isPartiallyMatched).toBe(false)
      expect(createUnmatchedTransaction().isPartiallyMatched).toBe(false)
      expect(createVarianceApprovedTransaction().isPartiallyMatched).toBe(false)
    })

    it("isVarianceApproved returns true for VarianceApproved status", () => {
      const tx = createVarianceApprovedTransaction()
      expect(tx.isVarianceApproved).toBe(true)
    })

    it("isVarianceApproved returns false for other statuses", () => {
      expect(createMatchedTransaction().isVarianceApproved).toBe(false)
      expect(createUnmatchedTransaction().isVarianceApproved).toBe(false)
      expect(createPartiallyMatchedTransaction().isVarianceApproved).toBe(false)
    })
  })

  describe("computed properties - variance", () => {
    it("hasVariance returns true when variance amount exists", () => {
      const tx = createPartiallyMatchedTransaction()
      expect(tx.hasVariance).toBe(true)
    })

    it("hasVariance returns false when no variance amount", () => {
      const tx = createMatchedTransaction()
      expect(tx.hasVariance).toBe(false)
    })

    it("hasVarianceExplanation returns true when explanation exists", () => {
      const tx = createVarianceApprovedTransaction()
      expect(tx.hasVarianceExplanation).toBe(true)
    })

    it("hasVarianceExplanation returns false when no explanation", () => {
      const tx = createPartiallyMatchedTransaction()
      expect(tx.hasVarianceExplanation).toBe(false)
    })
  })

  describe("computed properties - journal entries", () => {
    it("hasFromEntry returns true when from entry exists", () => {
      const tx = createMatchedTransaction()
      expect(tx.hasFromEntry).toBe(true)
    })

    it("hasFromEntry returns false when no from entry", () => {
      const tx = createTransactionWithNoEntries()
      expect(tx.hasFromEntry).toBe(false)
    })

    it("hasToEntry returns true when to entry exists", () => {
      const tx = createMatchedTransaction()
      expect(tx.hasToEntry).toBe(true)
    })

    it("hasToEntry returns false when no to entry", () => {
      const tx = createUnmatchedTransaction()
      expect(tx.hasToEntry).toBe(false)
    })

    it("hasBothEntries returns true when both entries exist", () => {
      const tx = createMatchedTransaction()
      expect(tx.hasBothEntries).toBe(true)
    })

    it("hasBothEntries returns false when only one entry exists", () => {
      const tx = createUnmatchedTransaction()
      expect(tx.hasBothEntries).toBe(false)
    })

    it("hasBothEntries returns false when no entries exist", () => {
      const tx = createTransactionWithNoEntries()
      expect(tx.hasBothEntries).toBe(false)
    })

    it("hasOnlyOneEntry returns true when exactly one entry exists", () => {
      const tx = createUnmatchedTransaction()
      expect(tx.hasOnlyOneEntry).toBe(true)
    })

    it("hasOnlyOneEntry returns false when both entries exist", () => {
      const tx = createMatchedTransaction()
      expect(tx.hasOnlyOneEntry).toBe(false)
    })

    it("hasOnlyOneEntry returns false when no entries exist", () => {
      const tx = createTransactionWithNoEntries()
      expect(tx.hasOnlyOneEntry).toBe(false)
    })

    it("hasNoEntries returns true when no entries exist", () => {
      const tx = createTransactionWithNoEntries()
      expect(tx.hasNoEntries).toBe(true)
    })

    it("hasNoEntries returns false when entries exist", () => {
      const tx = createMatchedTransaction()
      expect(tx.hasNoEntries).toBe(false)
    })
  })

  describe("computed properties - transaction types", () => {
    it("isSalePurchase returns true for SalePurchase type", () => {
      const tx = createMatchedTransaction()
      expect(tx.isSalePurchase).toBe(true)
    })

    it("isLoan returns true for Loan type", () => {
      const tx = createUnmatchedTransaction()
      expect(tx.isLoan).toBe(true)
    })

    it("isManagementFee returns true for ManagementFee type", () => {
      const tx = createPartiallyMatchedTransaction()
      expect(tx.isManagementFee).toBe(true)
    })

    it("isDividend returns true for Dividend type", () => {
      const tx = createVarianceApprovedTransaction()
      expect(tx.isDividend).toBe(true)
    })

    it("isCapitalContribution returns true for CapitalContribution type", () => {
      const tx = createTransactionWithNoEntries()
      expect(tx.isCapitalContribution).toBe(true)
    })

    it("isCostAllocation returns true for CostAllocation type", () => {
      const tx = IntercompanyTransaction.make({
        id: IntercompanyTransactionId.make(transactionUUID),
        fromCompanyId: CompanyId.make(fromCompanyUUID),
        toCompanyId: CompanyId.make(toCompanyUUID),
        transactionType: "CostAllocation",
        transactionDate,
        amount,
        fromJournalEntryId: Option.none(),
        toJournalEntryId: Option.none(),
        matchingStatus: "Unmatched",
        varianceAmount: Option.none(),
        varianceExplanation: Option.none(),
        description: Option.none(),
        createdAt: now,
        updatedAt: now
      })
      expect(tx.isCostAllocation).toBe(true)
    })

    it("isRoyalty returns true for Royalty type", () => {
      const tx = IntercompanyTransaction.make({
        id: IntercompanyTransactionId.make(transactionUUID),
        fromCompanyId: CompanyId.make(fromCompanyUUID),
        toCompanyId: CompanyId.make(toCompanyUUID),
        transactionType: "Royalty",
        transactionDate,
        amount,
        fromJournalEntryId: Option.none(),
        toJournalEntryId: Option.none(),
        matchingStatus: "Unmatched",
        varianceAmount: Option.none(),
        varianceExplanation: Option.none(),
        description: Option.none(),
        createdAt: now,
        updatedAt: now
      })
      expect(tx.isRoyalty).toBe(true)
    })

    it("transaction type booleans return false for other types", () => {
      const tx = createMatchedTransaction() // SalePurchase
      expect(tx.isLoan).toBe(false)
      expect(tx.isManagementFee).toBe(false)
      expect(tx.isDividend).toBe(false)
      expect(tx.isCapitalContribution).toBe(false)
      expect(tx.isCostAllocation).toBe(false)
      expect(tx.isRoyalty).toBe(false)
    })
  })

  describe("computed properties - elimination", () => {
    it("requiresElimination returns true for Matched status", () => {
      const tx = createMatchedTransaction()
      expect(tx.requiresElimination).toBe(true)
    })

    it("requiresElimination returns true for VarianceApproved status", () => {
      const tx = createVarianceApprovedTransaction()
      expect(tx.requiresElimination).toBe(true)
    })

    it("requiresElimination returns false for Unmatched status", () => {
      const tx = createUnmatchedTransaction()
      expect(tx.requiresElimination).toBe(false)
    })

    it("requiresElimination returns false for PartiallyMatched status", () => {
      const tx = createPartiallyMatchedTransaction()
      expect(tx.requiresElimination).toBe(false)
    })
  })

  describe("computed properties - description", () => {
    it("hasDescription returns true when description exists", () => {
      const tx = createMatchedTransaction()
      expect(tx.hasDescription).toBe(true)
    })

    it("hasDescription returns false when no description", () => {
      const tx = createUnmatchedTransaction()
      expect(tx.hasDescription).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isIntercompanyTransaction returns true for IntercompanyTransaction instances", () => {
      const tx = createMatchedTransaction()
      expect(isIntercompanyTransaction(tx)).toBe(true)
    })

    it("isIntercompanyTransaction returns false for plain objects", () => {
      expect(isIntercompanyTransaction({
        id: transactionUUID,
        fromCompanyId: fromCompanyUUID,
        toCompanyId: toCompanyUUID,
        transactionType: "SalePurchase",
        matchingStatus: "Matched"
      })).toBe(false)
    })

    it("isIntercompanyTransaction returns false for non-object values", () => {
      expect(isIntercompanyTransaction(null)).toBe(false)
      expect(isIntercompanyTransaction(undefined)).toBe(false)
      expect(isIntercompanyTransaction("transaction")).toBe(false)
      expect(isIntercompanyTransaction(123)).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for IntercompanyTransaction", () => {
      const tx1 = createMatchedTransaction()
      const tx2 = createMatchedTransaction()
      const tx3 = createUnmatchedTransaction()

      expect(Equal.equals(tx1, tx2)).toBe(true)
      expect(Equal.equals(tx1, tx3)).toBe(false)
    })

    it("Equal.equals is false for different transaction types", () => {
      const tx1 = createMatchedTransaction()
      const tx2 = IntercompanyTransaction.make({
        ...tx1,
        transactionType: "Loan"
      })

      expect(Equal.equals(tx1, tx2)).toBe(false)
    })

    it("Equal.equals is false for different matching statuses", () => {
      const tx1 = createMatchedTransaction()
      const tx2 = IntercompanyTransaction.make({
        ...tx1,
        matchingStatus: "Unmatched"
      })

      expect(Equal.equals(tx1, tx2)).toBe(false)
    })

    it("Equal.equals is false for different variance amounts", () => {
      const tx1 = createPartiallyMatchedTransaction()
      const differentVariance = MonetaryAmount.unsafeFromString("1000", "USD")
      const tx2 = IntercompanyTransaction.make({
        ...tx1,
        varianceAmount: Option.some(differentVariance)
      })

      expect(Equal.equals(tx1, tx2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes matched transaction", () =>
      Effect.gen(function* () {
        const original = createMatchedTransaction()
        const encoded = yield* Schema.encode(IntercompanyTransaction)(original)
        const decoded = yield* Schema.decodeUnknown(IntercompanyTransaction)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes unmatched transaction", () =>
      Effect.gen(function* () {
        const original = createUnmatchedTransaction()
        const encoded = yield* Schema.encode(IntercompanyTransaction)(original)
        const decoded = yield* Schema.decodeUnknown(IntercompanyTransaction)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes partially matched transaction", () =>
      Effect.gen(function* () {
        const original = createPartiallyMatchedTransaction()
        const encoded = yield* Schema.encode(IntercompanyTransaction)(original)
        const decoded = yield* Schema.decodeUnknown(IntercompanyTransaction)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes variance approved transaction", () =>
      Effect.gen(function* () {
        const original = createVarianceApprovedTransaction()
        const encoded = yield* Schema.encode(IntercompanyTransaction)(original)
        const decoded = yield* Schema.decodeUnknown(IntercompanyTransaction)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const tx = createMatchedTransaction()
        const encoded = yield* Schema.encode(IntercompanyTransaction)(tx)

        expect(encoded).toHaveProperty("id", transactionUUID)
        expect(encoded).toHaveProperty("fromCompanyId", fromCompanyUUID)
        expect(encoded).toHaveProperty("toCompanyId", toCompanyUUID)
        expect(encoded).toHaveProperty("transactionType", "SalePurchase")
        expect(encoded).toHaveProperty("matchingStatus", "Matched")
        expect(encoded.fromJournalEntryId).toBe(fromJournalEntryUUID)
        expect(encoded.toJournalEntryId).toBe(toJournalEntryUUID)
        expect(encoded.varianceAmount).toBeNull()
        expect(encoded.varianceExplanation).toBeNull()
        expect(encoded.description).toBe("Intercompany sale of goods")
      })
    )

    it.effect("encodes optional fields as null when empty", () =>
      Effect.gen(function* () {
        const tx = createTransactionWithNoEntries()
        const encoded = yield* Schema.encode(IntercompanyTransaction)(tx)

        expect(encoded.fromJournalEntryId).toBeNull()
        expect(encoded.toJournalEntryId).toBeNull()
        expect(encoded.varianceAmount).toBeNull()
        expect(encoded.varianceExplanation).toBeNull()
        expect(encoded.description).toBeNull()
      })
    )

    it.effect("encodes variance amount correctly", () =>
      Effect.gen(function* () {
        const tx = createPartiallyMatchedTransaction()
        const encoded = yield* Schema.encode(IntercompanyTransaction)(tx)

        expect(encoded.varianceAmount).not.toBeNull()
        expect(encoded.varianceAmount).toHaveProperty("currency", "USD")
      })
    )
  })

  describe("immutability", () => {
    it("IntercompanyTransaction properties are readonly at compile time", () => {
      const tx = createMatchedTransaction()
      expect(tx.transactionType).toBe("SalePurchase")
      expect(tx.matchingStatus).toBe("Matched")
    })
  })

  describe("edge cases", () => {
    it("handles transaction with same from and to company", () => {
      // While this might be a business rule violation, the schema allows it
      const tx = IntercompanyTransaction.make({
        id: IntercompanyTransactionId.make(transactionUUID),
        fromCompanyId: CompanyId.make(fromCompanyUUID),
        toCompanyId: CompanyId.make(fromCompanyUUID), // Same company
        transactionType: "SalePurchase",
        transactionDate,
        amount,
        fromJournalEntryId: Option.none(),
        toJournalEntryId: Option.none(),
        matchingStatus: "Unmatched",
        varianceAmount: Option.none(),
        varianceExplanation: Option.none(),
        description: Option.none(),
        createdAt: now,
        updatedAt: now
      })
      expect(tx.fromCompanyId).toBe(tx.toCompanyId)
    })

    it("handles zero variance amount", () => {
      const zeroVariance = MonetaryAmount.unsafeFromString("0", "USD")
      const tx = IntercompanyTransaction.make({
        id: IntercompanyTransactionId.make(transactionUUID),
        fromCompanyId: CompanyId.make(fromCompanyUUID),
        toCompanyId: CompanyId.make(toCompanyUUID),
        transactionType: "SalePurchase",
        transactionDate,
        amount,
        fromJournalEntryId: Option.none(),
        toJournalEntryId: Option.none(),
        matchingStatus: "Matched",
        varianceAmount: Option.some(zeroVariance),
        varianceExplanation: Option.none(),
        description: Option.none(),
        createdAt: now,
        updatedAt: now
      })
      expect(tx.hasVariance).toBe(true)
      expect(Option.getOrThrow(tx.varianceAmount).isZero).toBe(true)
    })

    it("handles negative variance amount", () => {
      const negativeVariance = MonetaryAmount.unsafeFromString("-500", "USD")
      const tx = IntercompanyTransaction.make({
        id: IntercompanyTransactionId.make(transactionUUID),
        fromCompanyId: CompanyId.make(fromCompanyUUID),
        toCompanyId: CompanyId.make(toCompanyUUID),
        transactionType: "SalePurchase",
        transactionDate,
        amount,
        fromJournalEntryId: Option.none(),
        toJournalEntryId: Option.none(),
        matchingStatus: "PartiallyMatched",
        varianceAmount: Option.some(negativeVariance),
        varianceExplanation: Option.none(),
        description: Option.none(),
        createdAt: now,
        updatedAt: now
      })
      expect(tx.hasVariance).toBe(true)
      expect(Option.getOrThrow(tx.varianceAmount).isNegative).toBe(true)
    })

    it("handles different currencies for amount and variance", () => {
      const eurVariance = MonetaryAmount.unsafeFromString("500", "EUR")
      const tx = IntercompanyTransaction.make({
        id: IntercompanyTransactionId.make(transactionUUID),
        fromCompanyId: CompanyId.make(fromCompanyUUID),
        toCompanyId: CompanyId.make(toCompanyUUID),
        transactionType: "SalePurchase",
        transactionDate,
        amount, // USD
        fromJournalEntryId: Option.none(),
        toJournalEntryId: Option.none(),
        matchingStatus: "PartiallyMatched",
        varianceAmount: Option.some(eurVariance), // EUR
        varianceExplanation: Option.none(),
        description: Option.none(),
        createdAt: now,
        updatedAt: now
      })
      expect(tx.amount.currency).toBe("USD")
      expect(Option.getOrThrow(tx.varianceAmount).currency).toBe("EUR")
    })

    it("handles very long description", () => {
      const longDescription = "A".repeat(1000)
      const tx = IntercompanyTransaction.make({
        id: IntercompanyTransactionId.make(transactionUUID),
        fromCompanyId: CompanyId.make(fromCompanyUUID),
        toCompanyId: CompanyId.make(toCompanyUUID),
        transactionType: "SalePurchase",
        transactionDate,
        amount,
        fromJournalEntryId: Option.none(),
        toJournalEntryId: Option.none(),
        matchingStatus: "Unmatched",
        varianceAmount: Option.none(),
        varianceExplanation: Option.none(),
        description: Option.some(longDescription),
        createdAt: now,
        updatedAt: now
      })
      expect(Option.getOrThrow(tx.description).length).toBe(1000)
    })
  })
})
