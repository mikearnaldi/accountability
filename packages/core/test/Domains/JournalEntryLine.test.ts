import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  JournalEntryLineId,
  isJournalEntryLineId,
  Dimensions,
  isDimensions,
  JournalEntryLine,
  JournalEntryLineSchema,
  isJournalEntryLine,
  InvalidDebitCreditError,
  isInvalidDebitCreditError
} from "../../src/journal/JournalEntryLine.ts"
import { AccountId } from "../../src/accounting/Account.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { JournalEntryId } from "../../src/journal/JournalEntry.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"

describe("JournalEntryLineId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = JournalEntryLineId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = JournalEntryLineId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineId)
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isJournalEntryLineId returns true for valid JournalEntryLineId", () => {
      const id = JournalEntryLineId.make(validUUID)
      expect(isJournalEntryLineId(id)).toBe(true)
    })

    it("isJournalEntryLineId returns true for plain UUID string (validates pattern)", () => {
      expect(isJournalEntryLineId(validUUID)).toBe(true)
    })

    it("isJournalEntryLineId returns false for non-string values", () => {
      expect(isJournalEntryLineId(null)).toBe(false)
      expect(isJournalEntryLineId(undefined)).toBe(false)
      expect(isJournalEntryLineId(123)).toBe(false)
      expect(isJournalEntryLineId({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates JournalEntryLineId using Schema's .make()", () => {
      const id = JournalEntryLineId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isJournalEntryLineId(id)).toBe(true)
    })
  })
})

describe("Dimensions", () => {
  describe("validation", () => {
    it.effect("accepts valid dimension records", () =>
      Effect.gen(function* () {
        const dimensions = yield* Schema.decodeUnknown(Dimensions)({
          department: "Engineering",
          project: "Accountability",
          costCenter: "CC001"
        })
        expect(dimensions["department"]).toBe("Engineering")
        expect(dimensions["project"]).toBe("Accountability")
        expect(dimensions["costCenter"]).toBe("CC001")
      })
    )

    it.effect("accepts empty dimension records", () =>
      Effect.gen(function* () {
        const dimensions = yield* Schema.decodeUnknown(Dimensions)({})
        expect(Object.keys(dimensions).length).toBe(0)
      })
    )

    it.effect("accepts single dimension", () =>
      Effect.gen(function* () {
        const dimensions = yield* Schema.decodeUnknown(Dimensions)({
          department: "Finance"
        })
        expect(dimensions["department"]).toBe("Finance")
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Dimensions)
        const result = yield* Effect.exit(decode({
          department: 123
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-object values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Dimensions)
        const result = yield* Effect.exit(decode("not an object"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isDimensions returns true for valid dimension objects", () => {
      expect(isDimensions({ department: "Engineering" })).toBe(true)
      expect(isDimensions({})).toBe(true)
    })

    it("isDimensions returns false for invalid values", () => {
      expect(isDimensions(null)).toBe(false)
      expect(isDimensions(undefined)).toBe(false)
      expect(isDimensions("not an object")).toBe(false)
      expect(isDimensions({ department: 123 })).toBe(false)
    })
  })
})

describe("JournalEntryLine", () => {
  const lineUUID = "550e8400-e29b-41d4-a716-446655440000"
  const journalEntryUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const accountUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const partnerCompanyUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const matchingLineUUID = "9ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createDebitLine = () => {
    const debitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
    const functionalDebitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")

    return JournalEntryLine.make({
      id: JournalEntryLineId.make(lineUUID),
      journalEntryId: JournalEntryId.make(journalEntryUUID),
      lineNumber: 1,
      accountId: AccountId.make(accountUUID),
      debitAmount: Option.some(debitAmount),
      creditAmount: Option.none(),
      functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
      functionalCurrencyCreditAmount: Option.none(),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.some("Rent expense debit"),
      dimensions: Option.some({ department: "Operations", costCenter: "CC001" }),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  const createCreditLine = () => {
    const creditAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
    const functionalCreditAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")

    return JournalEntryLine.make({
      id: JournalEntryLineId.make(lineUUID),
      journalEntryId: JournalEntryId.make(journalEntryUUID),
      lineNumber: 2,
      accountId: AccountId.make(accountUUID),
      debitAmount: Option.none(),
      creditAmount: Option.some(creditAmount),
      functionalCurrencyDebitAmount: Option.none(),
      functionalCurrencyCreditAmount: Option.some(functionalCreditAmount),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.none(),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  const createMultiCurrencyDebitLine = () => {
    const debitAmount = MonetaryAmount.unsafeFromString("800.00", "GBP")
    const functionalDebitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
    // Exchange rate 1.25 USD per GBP

    return JournalEntryLine.make({
      id: JournalEntryLineId.make(lineUUID),
      journalEntryId: JournalEntryId.make(journalEntryUUID),
      lineNumber: 1,
      accountId: AccountId.make(accountUUID),
      debitAmount: Option.some(debitAmount),
      creditAmount: Option.none(),
      functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
      functionalCurrencyCreditAmount: Option.none(),
      exchangeRate: BigDecimal.unsafeFromString("1.25"),
      memo: Option.some("Multi-currency transaction"),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  const createIntercompanyDebitLine = () => {
    const debitAmount = MonetaryAmount.unsafeFromString("5000.00", "USD")
    const functionalDebitAmount = MonetaryAmount.unsafeFromString("5000.00", "USD")

    return JournalEntryLine.make({
      id: JournalEntryLineId.make(lineUUID),
      journalEntryId: JournalEntryId.make(journalEntryUUID),
      lineNumber: 1,
      accountId: AccountId.make(accountUUID),
      debitAmount: Option.some(debitAmount),
      creditAmount: Option.none(),
      functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
      functionalCurrencyCreditAmount: Option.none(),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.some("Intercompany receivable"),
      dimensions: Option.some({ intercompanyType: "Sales" }),
      intercompanyPartnerId: Option.some(CompanyId.make(partnerCompanyUUID)),
      matchingLineId: Option.some(JournalEntryLineId.make(matchingLineUUID))
    })
  }

  const createLineWithDimensions = () => {
    const debitAmount = MonetaryAmount.unsafeFromString("2500.00", "USD")
    const functionalDebitAmount = MonetaryAmount.unsafeFromString("2500.00", "USD")

    return JournalEntryLine.make({
      id: JournalEntryLineId.make(lineUUID),
      journalEntryId: JournalEntryId.make(journalEntryUUID),
      lineNumber: 1,
      accountId: AccountId.make(accountUUID),
      debitAmount: Option.some(debitAmount),
      creditAmount: Option.none(),
      functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
      functionalCurrencyCreditAmount: Option.none(),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.some("Project expense"),
      dimensions: Option.some({
        department: "Engineering",
        project: "ProjectX",
        costCenter: "CC100",
        region: "AMER"
      }),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  describe("validation - debit/credit rule", () => {
    it.effect("accepts line with only debit amount", () =>
      Effect.gen(function* () {
        const line = createDebitLine()
        expect(line.isDebit).toBe(true)
        expect(line.isCredit).toBe(false)
      })
    )

    it.effect("accepts line with only credit amount", () =>
      Effect.gen(function* () {
        const line = createCreditLine()
        expect(line.isDebit).toBe(false)
        expect(line.isCredit).toBe(true)
      })
    )

    it.effect("rejects line with both debit and credit amounts", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineSchema)
        const result = yield* Effect.exit(decode({
          id: lineUUID,
          journalEntryId: journalEntryUUID,
          lineNumber: 1,
          accountId: accountUUID,
          debitAmount: { amount: "1000.00", currency: "USD" },
          creditAmount: { amount: "1000.00", currency: "USD" },
          functionalCurrencyDebitAmount: { amount: "1000.00", currency: "USD" },
          functionalCurrencyCreditAmount: { amount: "1000.00", currency: "USD" },
          exchangeRate: "1",
          memo: null,
          dimensions: null,
          intercompanyPartnerId: null,
          matchingLineId: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects line with neither debit nor credit amount", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineSchema)
        const result = yield* Effect.exit(decode({
          id: lineUUID,
          journalEntryId: journalEntryUUID,
          lineNumber: 1,
          accountId: accountUUID,
          debitAmount: null,
          creditAmount: null,
          functionalCurrencyDebitAmount: null,
          functionalCurrencyCreditAmount: null,
          exchangeRate: "1",
          memo: null,
          dimensions: null,
          intercompanyPartnerId: null,
          matchingLineId: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("validation - basic fields", () => {
    it.effect("accepts valid debit line data", () =>
      Effect.gen(function* () {
        const line = createDebitLine()
        expect(line.id).toBe(lineUUID)
        expect(line.journalEntryId).toBe(journalEntryUUID)
        expect(line.lineNumber).toBe(1)
        expect(line.accountId).toBe(accountUUID)
        expect(Option.isSome(line.debitAmount)).toBe(true)
        expect(Option.isNone(line.creditAmount)).toBe(true)
      })
    )

    it.effect("accepts valid credit line data", () =>
      Effect.gen(function* () {
        const line = createCreditLine()
        expect(line.lineNumber).toBe(2)
        expect(Option.isNone(line.debitAmount)).toBe(true)
        expect(Option.isSome(line.creditAmount)).toBe(true)
      })
    )

    it.effect("rejects invalid line UUID", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineSchema)
        const result = yield* Effect.exit(decode({
          id: "not-a-uuid",
          journalEntryId: journalEntryUUID,
          lineNumber: 1,
          accountId: accountUUID,
          debitAmount: { amount: "1000.00", currency: "USD" },
          creditAmount: null,
          functionalCurrencyDebitAmount: { amount: "1000.00", currency: "USD" },
          functionalCurrencyCreditAmount: null,
          exchangeRate: "1",
          memo: null,
          dimensions: null,
          intercompanyPartnerId: null,
          matchingLineId: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid journal entry UUID", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineSchema)
        const result = yield* Effect.exit(decode({
          id: lineUUID,
          journalEntryId: "not-a-uuid",
          lineNumber: 1,
          accountId: accountUUID,
          debitAmount: { amount: "1000.00", currency: "USD" },
          creditAmount: null,
          functionalCurrencyDebitAmount: { amount: "1000.00", currency: "USD" },
          functionalCurrencyCreditAmount: null,
          exchangeRate: "1",
          memo: null,
          dimensions: null,
          intercompanyPartnerId: null,
          matchingLineId: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid account UUID", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineSchema)
        const result = yield* Effect.exit(decode({
          id: lineUUID,
          journalEntryId: journalEntryUUID,
          lineNumber: 1,
          accountId: "not-a-uuid",
          debitAmount: { amount: "1000.00", currency: "USD" },
          creditAmount: null,
          functionalCurrencyDebitAmount: { amount: "1000.00", currency: "USD" },
          functionalCurrencyCreditAmount: null,
          exchangeRate: "1",
          memo: null,
          dimensions: null,
          intercompanyPartnerId: null,
          matchingLineId: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects zero line number", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineSchema)
        const result = yield* Effect.exit(decode({
          id: lineUUID,
          journalEntryId: journalEntryUUID,
          lineNumber: 0,
          accountId: accountUUID,
          debitAmount: { amount: "1000.00", currency: "USD" },
          creditAmount: null,
          functionalCurrencyDebitAmount: { amount: "1000.00", currency: "USD" },
          functionalCurrencyCreditAmount: null,
          exchangeRate: "1",
          memo: null,
          dimensions: null,
          intercompanyPartnerId: null,
          matchingLineId: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects negative line number", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryLineSchema)
        const result = yield* Effect.exit(decode({
          id: lineUUID,
          journalEntryId: journalEntryUUID,
          lineNumber: -1,
          accountId: accountUUID,
          debitAmount: { amount: "1000.00", currency: "USD" },
          creditAmount: null,
          functionalCurrencyDebitAmount: { amount: "1000.00", currency: "USD" },
          functionalCurrencyCreditAmount: null,
          exchangeRate: "1",
          memo: null,
          dimensions: null,
          intercompanyPartnerId: null,
          matchingLineId: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("accepts high line numbers", () =>
      Effect.gen(function* () {
        const debitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
        const functionalDebitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")

        const line = JournalEntryLine.make({
          id: JournalEntryLineId.make(lineUUID),
          journalEntryId: JournalEntryId.make(journalEntryUUID),
          lineNumber: 999,
          accountId: AccountId.make(accountUUID),
          debitAmount: Option.some(debitAmount),
          creditAmount: Option.none(),
          functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
          functionalCurrencyCreditAmount: Option.none(),
          exchangeRate: BigDecimal.fromBigInt(1n),
          memo: Option.none(),
          dimensions: Option.none(),
          intercompanyPartnerId: Option.none(),
          matchingLineId: Option.none()
        })
        expect(line.lineNumber).toBe(999)
      })
    )
  })

  describe("computed properties - debit/credit", () => {
    it("isDebit returns true for debit line", () => {
      const line = createDebitLine()
      expect(line.isDebit).toBe(true)
      expect(line.isCredit).toBe(false)
    })

    it("isCredit returns true for credit line", () => {
      const line = createCreditLine()
      expect(line.isDebit).toBe(false)
      expect(line.isCredit).toBe(true)
    })

    it("transactionAmount returns the correct amount for debit line", () => {
      const line = createDebitLine()
      expect(BigDecimal.equals(line.transactionAmount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(line.transactionAmount.currency).toBe("USD")
    })

    it("transactionAmount returns the correct amount for credit line", () => {
      const line = createCreditLine()
      expect(BigDecimal.equals(line.transactionAmount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(line.transactionAmount.currency).toBe("USD")
    })

    it("functionalCurrencyAmount returns the correct amount", () => {
      const line = createDebitLine()
      expect(BigDecimal.equals(line.functionalCurrencyAmount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(line.functionalCurrencyAmount.currency).toBe("USD")
    })
  })

  describe("computed properties - currency", () => {
    it("transactionCurrency returns the transaction currency", () => {
      const line = createDebitLine()
      expect(line.transactionCurrency).toBe("USD")
    })

    it("functionalCurrency returns the functional currency", () => {
      const line = createDebitLine()
      expect(line.functionalCurrency).toBe("USD")
    })

    it("isSameCurrency returns true when currencies match", () => {
      const line = createDebitLine()
      expect(line.isSameCurrency).toBe(true)
    })

    it("isSameCurrency returns false when currencies differ", () => {
      const line = createMultiCurrencyDebitLine()
      expect(line.isSameCurrency).toBe(false)
      expect(line.transactionCurrency).toBe("GBP")
      expect(line.functionalCurrency).toBe("USD")
    })

    it("hasUnityExchangeRate returns true for rate of 1", () => {
      const line = createDebitLine()
      expect(line.hasUnityExchangeRate).toBe(true)
    })

    it("hasUnityExchangeRate returns false for non-unity rate", () => {
      const line = createMultiCurrencyDebitLine()
      expect(line.hasUnityExchangeRate).toBe(false)
    })
  })

  describe("computed properties - intercompany", () => {
    it("isIntercompany returns false for non-intercompany line", () => {
      const line = createDebitLine()
      expect(line.isIntercompany).toBe(false)
    })

    it("isIntercompany returns true for intercompany line", () => {
      const line = createIntercompanyDebitLine()
      expect(line.isIntercompany).toBe(true)
    })

    it("hasMatchingLine returns false for non-intercompany line", () => {
      const line = createDebitLine()
      expect(line.hasMatchingLine).toBe(false)
    })

    it("hasMatchingLine returns true for line with matching line ID", () => {
      const line = createIntercompanyDebitLine()
      expect(line.hasMatchingLine).toBe(true)
    })
  })

  describe("computed properties - memo and dimensions", () => {
    it("hasMemo returns true when memo is set", () => {
      const line = createDebitLine()
      expect(line.hasMemo).toBe(true)
    })

    it("hasMemo returns false when memo is not set", () => {
      const line = createCreditLine()
      expect(line.hasMemo).toBe(false)
    })

    it("hasDimensions returns true when dimensions are set", () => {
      const line = createDebitLine()
      expect(line.hasDimensions).toBe(true)
    })

    it("hasDimensions returns false when dimensions are not set", () => {
      const line = createCreditLine()
      expect(line.hasDimensions).toBe(false)
    })

    it("dimensions contain correct values", () => {
      const line = createLineWithDimensions()
      expect(line.hasDimensions).toBe(true)
      const dims = Option.getOrThrow(line.dimensions)
      expect(dims["department"]).toBe("Engineering")
      expect(dims["project"]).toBe("ProjectX")
      expect(dims["costCenter"]).toBe("CC100")
      expect(dims["region"]).toBe("AMER")
    })
  })

  describe("helper methods - getDebitOrZero and getCreditOrZero", () => {
    it("getDebitOrZero returns debit amount for debit line", () => {
      const line = createDebitLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getDebitOrZero(usdCurrency)
      expect(BigDecimal.equals(amount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("getDebitOrZero returns zero for credit line", () => {
      const line = createCreditLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getDebitOrZero(usdCurrency)
      expect(amount.isZero).toBe(true)
      expect(amount.currency).toBe("USD")
    })

    it("getCreditOrZero returns credit amount for credit line", () => {
      const line = createCreditLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getCreditOrZero(usdCurrency)
      expect(BigDecimal.equals(amount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("getCreditOrZero returns zero for debit line", () => {
      const line = createDebitLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getCreditOrZero(usdCurrency)
      expect(amount.isZero).toBe(true)
      expect(amount.currency).toBe("USD")
    })

    it("getFunctionalDebitOrZero returns functional debit for debit line", () => {
      const line = createDebitLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getFunctionalDebitOrZero(usdCurrency)
      expect(BigDecimal.equals(amount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("getFunctionalDebitOrZero returns zero for credit line", () => {
      const line = createCreditLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getFunctionalDebitOrZero(usdCurrency)
      expect(amount.isZero).toBe(true)
    })

    it("getFunctionalCreditOrZero returns functional credit for credit line", () => {
      const line = createCreditLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getFunctionalCreditOrZero(usdCurrency)
      expect(BigDecimal.equals(amount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("getFunctionalCreditOrZero returns zero for debit line", () => {
      const line = createDebitLine()
      const usdCurrency = CurrencyCode.make("USD")
      const amount = line.getFunctionalCreditOrZero(usdCurrency)
      expect(amount.isZero).toBe(true)
    })
  })

  describe("multi-currency lines", () => {
    it("handles different transaction and functional currencies", () => {
      const line = createMultiCurrencyDebitLine()
      expect(line.transactionCurrency).toBe("GBP")
      expect(line.functionalCurrency).toBe("USD")
      expect(line.isSameCurrency).toBe(false)
      expect(BigDecimal.format(line.exchangeRate)).toBe("1.25")
    })

    it("stores exchange rate with correct precision", () => {
      const debitAmount = MonetaryAmount.unsafeFromString("100.00", "GBP")
      const functionalDebitAmount = MonetaryAmount.unsafeFromString("123.456789", "USD")

      const line = JournalEntryLine.make({
        id: JournalEntryLineId.make(lineUUID),
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        lineNumber: 1,
        accountId: AccountId.make(accountUUID),
        debitAmount: Option.some(debitAmount),
        creditAmount: Option.none(),
        functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
        functionalCurrencyCreditAmount: Option.none(),
        exchangeRate: BigDecimal.unsafeFromString("1.23456789"),
        memo: Option.none(),
        dimensions: Option.none(),
        intercompanyPartnerId: Option.none(),
        matchingLineId: Option.none()
      })

      expect(BigDecimal.format(line.exchangeRate)).toBe("1.23456789")
    })
  })

  describe("type guard", () => {
    it("isJournalEntryLine returns true for JournalEntryLine instances", () => {
      const line = createDebitLine()
      expect(isJournalEntryLine(line)).toBe(true)
    })

    it("isJournalEntryLine returns false for plain objects", () => {
      expect(isJournalEntryLine({
        id: lineUUID,
        lineNumber: 1
      })).toBe(false)
    })

    it("isJournalEntryLine returns false for non-object values", () => {
      expect(isJournalEntryLine(null)).toBe(false)
      expect(isJournalEntryLine(undefined)).toBe(false)
      expect(isJournalEntryLine("line")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for JournalEntryLine without dimensions", () => {
      // Create lines without dimensions for cleaner equality test
      const debitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
      const functionalDebitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")

      const line1 = JournalEntryLine.make({
        id: JournalEntryLineId.make(lineUUID),
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        lineNumber: 1,
        accountId: AccountId.make(accountUUID),
        debitAmount: Option.some(debitAmount),
        creditAmount: Option.none(),
        functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
        functionalCurrencyCreditAmount: Option.none(),
        exchangeRate: BigDecimal.fromBigInt(1n),
        memo: Option.none(),
        dimensions: Option.none(),
        intercompanyPartnerId: Option.none(),
        matchingLineId: Option.none()
      })

      const line2 = JournalEntryLine.make({
        id: JournalEntryLineId.make(lineUUID),
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        lineNumber: 1,
        accountId: AccountId.make(accountUUID),
        debitAmount: Option.some(debitAmount),
        creditAmount: Option.none(),
        functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
        functionalCurrencyCreditAmount: Option.none(),
        exchangeRate: BigDecimal.fromBigInt(1n),
        memo: Option.none(),
        dimensions: Option.none(),
        intercompanyPartnerId: Option.none(),
        matchingLineId: Option.none()
      })

      const line3 = createCreditLine()

      expect(Equal.equals(line1, line2)).toBe(true)
      expect(Equal.equals(line1, line3)).toBe(false)
    })

    it("Equal.equals is false for different line numbers", () => {
      const line1 = createDebitLine()
      const debitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
      const functionalDebitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")

      const line2 = JournalEntryLine.make({
        id: JournalEntryLineId.make(lineUUID),
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        lineNumber: 5,
        accountId: AccountId.make(accountUUID),
        debitAmount: Option.some(debitAmount),
        creditAmount: Option.none(),
        functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
        functionalCurrencyCreditAmount: Option.none(),
        exchangeRate: BigDecimal.fromBigInt(1n),
        memo: Option.some("Rent expense debit"),
        dimensions: Option.some({ department: "Operations", costCenter: "CC001" }),
        intercompanyPartnerId: Option.none(),
        matchingLineId: Option.none()
      })

      expect(Equal.equals(line1, line2)).toBe(false)
    })

    it("Equal.equals is false for different amounts", () => {
      const line1 = createDebitLine()
      const debitAmount = MonetaryAmount.unsafeFromString("2000.00", "USD")
      const functionalDebitAmount = MonetaryAmount.unsafeFromString("2000.00", "USD")

      const line2 = JournalEntryLine.make({
        id: JournalEntryLineId.make(lineUUID),
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        lineNumber: 1,
        accountId: AccountId.make(accountUUID),
        debitAmount: Option.some(debitAmount),
        creditAmount: Option.none(),
        functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
        functionalCurrencyCreditAmount: Option.none(),
        exchangeRate: BigDecimal.fromBigInt(1n),
        memo: Option.some("Rent expense debit"),
        dimensions: Option.some({ department: "Operations", costCenter: "CC001" }),
        intercompanyPartnerId: Option.none(),
        matchingLineId: Option.none()
      })

      expect(Equal.equals(line1, line2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes debit JournalEntryLine", () =>
      Effect.gen(function* () {
        // Create a line without dimensions for cleaner equality check
        const debitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
        const functionalDebitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")

        const original = JournalEntryLine.make({
          id: JournalEntryLineId.make(lineUUID),
          journalEntryId: JournalEntryId.make(journalEntryUUID),
          lineNumber: 1,
          accountId: AccountId.make(accountUUID),
          debitAmount: Option.some(debitAmount),
          creditAmount: Option.none(),
          functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
          functionalCurrencyCreditAmount: Option.none(),
          exchangeRate: BigDecimal.fromBigInt(1n),
          memo: Option.none(),
          dimensions: Option.none(),
          intercompanyPartnerId: Option.none(),
          matchingLineId: Option.none()
        })

        const encoded = yield* Schema.encode(JournalEntryLineSchema)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntryLineSchema)(encoded)

        expect(decoded.id).toBe(original.id)
        expect(decoded.lineNumber).toBe(original.lineNumber)
        expect(decoded.isDebit).toBe(original.isDebit)
        expect(decoded.isCredit).toBe(original.isCredit)
        expect(BigDecimal.equals(decoded.exchangeRate, original.exchangeRate)).toBe(true)
      })
    )

    it.effect("encodes and decodes credit JournalEntryLine", () =>
      Effect.gen(function* () {
        const original = createCreditLine()
        const encoded = yield* Schema.encode(JournalEntryLineSchema)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntryLineSchema)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes multi-currency JournalEntryLine", () =>
      Effect.gen(function* () {
        const original = createMultiCurrencyDebitLine()
        const encoded = yield* Schema.encode(JournalEntryLineSchema)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntryLineSchema)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes intercompany JournalEntryLine", () =>
      Effect.gen(function* () {
        const original = createIntercompanyDebitLine()
        const encoded = yield* Schema.encode(JournalEntryLineSchema)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntryLineSchema)(encoded)

        expect(decoded.id).toBe(original.id)
        expect(decoded.isIntercompany).toBe(true)
        expect(decoded.hasMatchingLine).toBe(true)
        expect(Option.getOrNull(decoded.intercompanyPartnerId)).toBe(Option.getOrNull(original.intercompanyPartnerId))
        expect(Option.getOrNull(decoded.matchingLineId)).toBe(Option.getOrNull(original.matchingLineId))
      })
    )

    it.effect("encodes and decodes JournalEntryLine with dimensions", () =>
      Effect.gen(function* () {
        const original = createLineWithDimensions()
        const encoded = yield* Schema.encode(JournalEntryLineSchema)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntryLineSchema)(encoded)

        expect(decoded.id).toBe(original.id)
        expect(decoded.hasDimensions).toBe(true)
        const originalDims = Option.getOrThrow(original.dimensions)
        const decodedDims = Option.getOrThrow(decoded.dimensions)
        expect(decodedDims["department"]).toBe(originalDims["department"])
        expect(decodedDims["project"]).toBe(originalDims["project"])
        expect(decodedDims["costCenter"]).toBe(originalDims["costCenter"])
      })
    )

    it.effect("encodes to expected JSON structure for debit line", () =>
      Effect.gen(function* () {
        const line = createDebitLine()
        const encoded = yield* Schema.encode(JournalEntryLineSchema)(line)

        expect(encoded).toHaveProperty("id", lineUUID)
        expect(encoded).toHaveProperty("journalEntryId", journalEntryUUID)
        expect(encoded).toHaveProperty("lineNumber", 1)
        expect(encoded).toHaveProperty("accountId", accountUUID)
        expect(encoded).toHaveProperty("debitAmount")
        expect(encoded.debitAmount).not.toBeNull()
        expect(encoded).toHaveProperty("creditAmount", null)
        expect(encoded).toHaveProperty("functionalCurrencyDebitAmount")
        expect(encoded.functionalCurrencyDebitAmount).not.toBeNull()
        expect(encoded).toHaveProperty("functionalCurrencyCreditAmount", null)
        expect(encoded).toHaveProperty("exchangeRate", "1")
        expect(encoded).toHaveProperty("memo", "Rent expense debit")
        expect(encoded).toHaveProperty("dimensions")
        expect(encoded.dimensions).toEqual({ department: "Operations", costCenter: "CC001" })
        expect(encoded).toHaveProperty("intercompanyPartnerId", null)
        expect(encoded).toHaveProperty("matchingLineId", null)
      })
    )

    it.effect("encodes to expected JSON structure for credit line", () =>
      Effect.gen(function* () {
        const line = createCreditLine()
        const encoded = yield* Schema.encode(JournalEntryLineSchema)(line)

        expect(encoded).toHaveProperty("debitAmount", null)
        expect(encoded).toHaveProperty("creditAmount")
        expect(encoded.creditAmount).not.toBeNull()
        expect(encoded).toHaveProperty("functionalCurrencyDebitAmount", null)
        expect(encoded).toHaveProperty("functionalCurrencyCreditAmount")
        expect(encoded.functionalCurrencyCreditAmount).not.toBeNull()
        expect(encoded).toHaveProperty("memo", null)
        expect(encoded).toHaveProperty("dimensions", null)
      })
    )

    it.effect("encodes intercompany fields correctly", () =>
      Effect.gen(function* () {
        const line = createIntercompanyDebitLine()
        const encoded = yield* Schema.encode(JournalEntryLineSchema)(line)

        expect(encoded).toHaveProperty("intercompanyPartnerId", partnerCompanyUUID)
        expect(encoded).toHaveProperty("matchingLineId", matchingLineUUID)
      })
    )
  })

  describe("immutability", () => {
    it("JournalEntryLine properties are readonly at compile time", () => {
      const line = createDebitLine()
      expect(line.lineNumber).toBe(1)
      expect(line.isDebit).toBe(true)
    })
  })
})

describe("InvalidDebitCreditError", () => {
  const lineUUID = "550e8400-e29b-41d4-a716-446655440000"

  describe("error creation", () => {
    it("creates error for both debit and credit set", () => {
      const error = new InvalidDebitCreditError({
        lineId: JournalEntryLineId.make(lineUUID),
        hasDebit: true,
        hasCredit: true
      })
      expect(error.message).toContain("cannot have both")
      expect(error._tag).toBe("InvalidDebitCreditError")
    })

    it("creates error for neither debit nor credit set", () => {
      const error = new InvalidDebitCreditError({
        lineId: JournalEntryLineId.make(lineUUID),
        hasDebit: false,
        hasCredit: false
      })
      expect(error.message).toContain("must have either")
      expect(error._tag).toBe("InvalidDebitCreditError")
    })
  })

  describe("type guard", () => {
    it("isInvalidDebitCreditError returns true for error instances", () => {
      const error = new InvalidDebitCreditError({
        lineId: JournalEntryLineId.make(lineUUID),
        hasDebit: true,
        hasCredit: true
      })
      expect(isInvalidDebitCreditError(error)).toBe(true)
    })

    it("isInvalidDebitCreditError returns false for other values", () => {
      expect(isInvalidDebitCreditError(null)).toBe(false)
      expect(isInvalidDebitCreditError(new Error("test"))).toBe(false)
      expect(isInvalidDebitCreditError({ _tag: "InvalidDebitCreditError" })).toBe(false)
    })
  })
})
