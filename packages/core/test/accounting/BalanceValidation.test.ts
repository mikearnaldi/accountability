import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, Exit, FastCheck, Option, Schema } from "effect"
import {
  sumDebits,
  sumCredits,
  validateBalance,
  isBalanced,
  calculateDifference,
  UnbalancedEntryError,
  isUnbalancedEntryError
} from "../../src/accounting/BalanceValidation.ts"
import { JournalEntryLine, JournalEntryLineId } from "../../src/journal/JournalEntryLine.ts"
import { JournalEntryId } from "../../src/journal/JournalEntry.ts"
import { AccountId } from "../../src/accounting/Account.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"

describe("BalanceValidation", () => {
  const lineUUID1 = "550e8400-e29b-41d4-a716-446655440001"
  const lineUUID2 = "550e8400-e29b-41d4-a716-446655440002"
  const lineUUID3 = "550e8400-e29b-41d4-a716-446655440003"
  const lineUUID4 = "550e8400-e29b-41d4-a716-446655440004"
  const journalEntryUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const accountUUID1 = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const accountUUID2 = "8ba7b810-9dad-11d1-80b4-00c04fd430c9"
  const usdCurrency = CurrencyCode.make("USD")
  const gbpCurrency = CurrencyCode.make("GBP")
  const eurCurrency = CurrencyCode.make("EUR")

  const createDebitLine = (
    id: string,
    lineNumber: number,
    amount: string,
    currency: CurrencyCode,
    functionalAmount: string,
    functionalCurrency: CurrencyCode,
    exchangeRate: string = "1"
  ): JournalEntryLine => {
    const debitAmount = MonetaryAmount.unsafeFromString(amount, currency)
    const functionalDebitAmount = MonetaryAmount.unsafeFromString(functionalAmount, functionalCurrency)

    return JournalEntryLine.make({
      id: JournalEntryLineId.make(id),
      journalEntryId: JournalEntryId.make(journalEntryUUID),
      lineNumber,
      accountId: AccountId.make(accountUUID1),
      debitAmount: Option.some(debitAmount),
      creditAmount: Option.none(),
      functionalCurrencyDebitAmount: Option.some(functionalDebitAmount),
      functionalCurrencyCreditAmount: Option.none(),
      exchangeRate: BigDecimal.unsafeFromString(exchangeRate),
      memo: Option.none(),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  const createCreditLine = (
    id: string,
    lineNumber: number,
    amount: string,
    currency: CurrencyCode,
    functionalAmount: string,
    functionalCurrency: CurrencyCode,
    exchangeRate: string = "1"
  ): JournalEntryLine => {
    const creditAmount = MonetaryAmount.unsafeFromString(amount, currency)
    const functionalCreditAmount = MonetaryAmount.unsafeFromString(functionalAmount, functionalCurrency)

    return JournalEntryLine.make({
      id: JournalEntryLineId.make(id),
      journalEntryId: JournalEntryId.make(journalEntryUUID),
      lineNumber,
      accountId: AccountId.make(accountUUID2),
      debitAmount: Option.none(),
      creditAmount: Option.some(creditAmount),
      functionalCurrencyDebitAmount: Option.none(),
      functionalCurrencyCreditAmount: Option.some(functionalCreditAmount),
      exchangeRate: BigDecimal.unsafeFromString(exchangeRate),
      memo: Option.none(),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  describe("sumDebits", () => {
    it("returns zero for empty lines array", () => {
      const result = sumDebits([], usdCurrency)
      expect(result.isZero).toBe(true)
      expect(result.currency).toBe("USD")
    })

    it("returns zero when no debit lines exist", () => {
      const creditLine = createCreditLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const result = sumDebits([creditLine], usdCurrency)
      expect(result.isZero).toBe(true)
    })

    it("sums single debit line correctly", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const result = sumDebits([debitLine], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("sums multiple debit lines correctly", () => {
      const debitLine1 = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const debitLine2 = createDebitLine(lineUUID2, 2, "500.50", usdCurrency, "500.50", usdCurrency)
      const debitLine3 = createDebitLine(lineUUID3, 3, "250.25", usdCurrency, "250.25", usdCurrency)
      const result = sumDebits([debitLine1, debitLine2, debitLine3], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1750.75"))).toBe(true)
    })

    it("ignores credit lines when summing debits", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const result = sumDebits([debitLine, creditLine], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("sums functional currency amounts for multi-currency entries", () => {
      // GBP transaction converted to USD functional currency
      const debitLine1 = createDebitLine(lineUUID1, 1, "800.00", gbpCurrency, "1000.00", usdCurrency, "1.25")
      // EUR transaction converted to USD functional currency
      const debitLine2 = createDebitLine(lineUUID2, 2, "500.00", eurCurrency, "550.00", usdCurrency, "1.1")
      const result = sumDebits([debitLine1, debitLine2], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1550"))).toBe(true)
      expect(result.currency).toBe("USD")
    })

    it("handles high precision amounts", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.123456", usdCurrency, "1000.123456", usdCurrency)
      const result = sumDebits([debitLine], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000.123456"))).toBe(true)
    })
  })

  describe("sumCredits", () => {
    it("returns zero for empty lines array", () => {
      const result = sumCredits([], usdCurrency)
      expect(result.isZero).toBe(true)
      expect(result.currency).toBe("USD")
    })

    it("returns zero when no credit lines exist", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const result = sumCredits([debitLine], usdCurrency)
      expect(result.isZero).toBe(true)
    })

    it("sums single credit line correctly", () => {
      const creditLine = createCreditLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const result = sumCredits([creditLine], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("sums multiple credit lines correctly", () => {
      const creditLine1 = createCreditLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const creditLine2 = createCreditLine(lineUUID2, 2, "500.50", usdCurrency, "500.50", usdCurrency)
      const creditLine3 = createCreditLine(lineUUID3, 3, "250.25", usdCurrency, "250.25", usdCurrency)
      const result = sumCredits([creditLine1, creditLine2, creditLine3], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1750.75"))).toBe(true)
    })

    it("ignores debit lines when summing credits", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const result = sumCredits([debitLine, creditLine], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("sums functional currency amounts for multi-currency entries", () => {
      // GBP transaction converted to USD functional currency
      const creditLine1 = createCreditLine(lineUUID1, 1, "800.00", gbpCurrency, "1000.00", usdCurrency, "1.25")
      // EUR transaction converted to USD functional currency
      const creditLine2 = createCreditLine(lineUUID2, 2, "500.00", eurCurrency, "550.00", usdCurrency, "1.1")
      const result = sumCredits([creditLine1, creditLine2], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1550"))).toBe(true)
      expect(result.currency).toBe("USD")
    })

    it("handles high precision amounts", () => {
      const creditLine = createCreditLine(lineUUID1, 1, "1000.123456", usdCurrency, "1000.123456", usdCurrency)
      const result = sumCredits([creditLine], usdCurrency)
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000.123456"))).toBe(true)
    })
  })

  describe("validateBalance", () => {
    it.effect("succeeds for balanced entry with single debit and credit", () =>
      Effect.gen(function* () {
        const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
        const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)

        yield* validateBalance([debitLine, creditLine], usdCurrency)
        // If we get here, the entry is balanced
      })
    )

    it.effect("succeeds for balanced entry with multiple debits and credits", () =>
      Effect.gen(function* () {
        const debitLine1 = createDebitLine(lineUUID1, 1, "600.00", usdCurrency, "600.00", usdCurrency)
        const debitLine2 = createDebitLine(lineUUID2, 2, "400.00", usdCurrency, "400.00", usdCurrency)
        const creditLine1 = createCreditLine(lineUUID3, 3, "700.00", usdCurrency, "700.00", usdCurrency)
        const creditLine2 = createCreditLine(lineUUID4, 4, "300.00", usdCurrency, "300.00", usdCurrency)

        yield* validateBalance([debitLine1, debitLine2, creditLine1, creditLine2], usdCurrency)
      })
    )

    it.effect("succeeds for balanced multi-currency entry", () =>
      Effect.gen(function* () {
        // Debit in GBP converted to USD
        const debitLine = createDebitLine(lineUUID1, 1, "800.00", gbpCurrency, "1000.00", usdCurrency, "1.25")
        // Credit in USD
        const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)

        yield* validateBalance([debitLine, creditLine], usdCurrency)
      })
    )

    it.effect("succeeds for balanced entry with high precision amounts", () =>
      Effect.gen(function* () {
        const debitLine = createDebitLine(lineUUID1, 1, "1000.123456", usdCurrency, "1000.123456", usdCurrency)
        const creditLine = createCreditLine(lineUUID2, 2, "1000.123456", usdCurrency, "1000.123456", usdCurrency)

        yield* validateBalance([debitLine, creditLine], usdCurrency)
      })
    )

    it.effect("succeeds for empty lines array (trivially balanced)", () =>
      Effect.gen(function* () {
        yield* validateBalance([], usdCurrency)
      })
    )

    it.effect("fails for unbalanced entry (debits > credits)", () =>
      Effect.gen(function* () {
        const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
        const creditLine = createCreditLine(lineUUID2, 2, "900.00", usdCurrency, "900.00", usdCurrency)

        const result = yield* Effect.exit(validateBalance([debitLine, creditLine], usdCurrency))
        expect(Exit.isFailure(result)).toBe(true)

        if (Exit.isFailure(result)) {
          const error = result.cause._tag === "Fail" ? result.cause.error : null
          expect(error).not.toBeNull()
          expect(isUnbalancedEntryError(error)).toBe(true)
          if (isUnbalancedEntryError(error)) {
            expect(BigDecimal.equals(error.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
            expect(BigDecimal.equals(error.totalCredits.amount, BigDecimal.unsafeFromString("900"))).toBe(true)
            expect(BigDecimal.equals(error.difference.amount, BigDecimal.unsafeFromString("100"))).toBe(true)
          }
        }
      })
    )

    it.effect("fails for unbalanced entry (credits > debits)", () =>
      Effect.gen(function* () {
        const debitLine = createDebitLine(lineUUID1, 1, "900.00", usdCurrency, "900.00", usdCurrency)
        const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)

        const result = yield* Effect.exit(validateBalance([debitLine, creditLine], usdCurrency))
        expect(Exit.isFailure(result)).toBe(true)

        if (Exit.isFailure(result)) {
          const error = result.cause._tag === "Fail" ? result.cause.error : null
          expect(isUnbalancedEntryError(error)).toBe(true)
          if (isUnbalancedEntryError(error)) {
            expect(BigDecimal.equals(error.totalDebits.amount, BigDecimal.unsafeFromString("900"))).toBe(true)
            expect(BigDecimal.equals(error.totalCredits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
            expect(BigDecimal.equals(error.difference.amount, BigDecimal.unsafeFromString("100"))).toBe(true)
          }
        }
      })
    )

    it.effect("fails for debit-only entry", () =>
      Effect.gen(function* () {
        const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)

        const result = yield* Effect.exit(validateBalance([debitLine], usdCurrency))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for credit-only entry", () =>
      Effect.gen(function* () {
        const creditLine = createCreditLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)

        const result = yield* Effect.exit(validateBalance([creditLine], usdCurrency))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("fails for unbalanced multi-currency entry", () =>
      Effect.gen(function* () {
        // Debit in GBP converted to USD
        const debitLine = createDebitLine(lineUUID1, 1, "800.00", gbpCurrency, "1000.00", usdCurrency, "1.25")
        // Credit in USD but different amount
        const creditLine = createCreditLine(lineUUID2, 2, "950.00", usdCurrency, "950.00", usdCurrency)

        const result = yield* Effect.exit(validateBalance([debitLine, creditLine], usdCurrency))
        expect(Exit.isFailure(result)).toBe(true)

        if (Exit.isFailure(result)) {
          const error = result.cause._tag === "Fail" ? result.cause.error : null
          expect(isUnbalancedEntryError(error)).toBe(true)
          if (isUnbalancedEntryError(error)) {
            expect(BigDecimal.equals(error.difference.amount, BigDecimal.unsafeFromString("50"))).toBe(true)
          }
        }
      })
    )

    it.effect("handles very small differences", () =>
      Effect.gen(function* () {
        const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
        const creditLine = createCreditLine(lineUUID2, 2, "1000.0001", usdCurrency, "1000.0001", usdCurrency)

        const result = yield* Effect.exit(validateBalance([debitLine, creditLine], usdCurrency))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("isBalanced", () => {
    it("returns true for balanced entry", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)

      expect(isBalanced([debitLine, creditLine], usdCurrency)).toBe(true)
    })

    it("returns false for unbalanced entry", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const creditLine = createCreditLine(lineUUID2, 2, "900.00", usdCurrency, "900.00", usdCurrency)

      expect(isBalanced([debitLine, creditLine], usdCurrency)).toBe(false)
    })

    it("returns true for empty lines", () => {
      expect(isBalanced([], usdCurrency)).toBe(true)
    })

    it("returns true for balanced multi-currency entry", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "800.00", gbpCurrency, "1000.00", usdCurrency, "1.25")
      const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)

      expect(isBalanced([debitLine, creditLine], usdCurrency)).toBe(true)
    })
  })

  describe("calculateDifference", () => {
    it("returns zero for balanced entry", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)

      const diff = calculateDifference([debitLine, creditLine], usdCurrency)
      expect(diff.isZero).toBe(true)
    })

    it("returns positive when debits > credits", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "1000.00", usdCurrency, "1000.00", usdCurrency)
      const creditLine = createCreditLine(lineUUID2, 2, "900.00", usdCurrency, "900.00", usdCurrency)

      const diff = calculateDifference([debitLine, creditLine], usdCurrency)
      expect(diff.isPositive).toBe(true)
      expect(BigDecimal.equals(diff.amount, BigDecimal.unsafeFromString("100"))).toBe(true)
    })

    it("returns negative when credits > debits", () => {
      const debitLine = createDebitLine(lineUUID1, 1, "900.00", usdCurrency, "900.00", usdCurrency)
      const creditLine = createCreditLine(lineUUID2, 2, "1000.00", usdCurrency, "1000.00", usdCurrency)

      const diff = calculateDifference([debitLine, creditLine], usdCurrency)
      expect(diff.isNegative).toBe(true)
      expect(BigDecimal.equals(diff.amount, BigDecimal.unsafeFromString("-100"))).toBe(true)
    })

    it("returns zero for empty lines", () => {
      const diff = calculateDifference([], usdCurrency)
      expect(diff.isZero).toBe(true)
    })
  })

  describe("UnbalancedEntryError", () => {
    it("creates error with correct properties", () => {
      const totalDebits = MonetaryAmount.unsafeFromString("1000.00", "USD")
      const totalCredits = MonetaryAmount.unsafeFromString("900.00", "USD")
      const difference = MonetaryAmount.unsafeFromString("100.00", "USD")

      const error = new UnbalancedEntryError({
        totalDebits,
        totalCredits,
        difference
      })

      expect(error._tag).toBe("UnbalancedEntryError")
      expect(BigDecimal.equals(error.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(BigDecimal.equals(error.totalCredits.amount, BigDecimal.unsafeFromString("900"))).toBe(true)
      expect(BigDecimal.equals(error.difference.amount, BigDecimal.unsafeFromString("100"))).toBe(true)
    })

    it("generates correct message", () => {
      const totalDebits = MonetaryAmount.unsafeFromString("1000.00", "USD")
      const totalCredits = MonetaryAmount.unsafeFromString("900.00", "USD")
      const difference = MonetaryAmount.unsafeFromString("100.00", "USD")

      const error = new UnbalancedEntryError({
        totalDebits,
        totalCredits,
        difference
      })

      expect(error.message).toContain("unbalanced")
      expect(error.message).toContain("1000")
      expect(error.message).toContain("900")
      expect(error.message).toContain("100")
      expect(error.message).toContain("USD")
    })

    describe("type guard", () => {
      it("isUnbalancedEntryError returns true for error instances", () => {
        const totalDebits = MonetaryAmount.unsafeFromString("1000.00", "USD")
        const totalCredits = MonetaryAmount.unsafeFromString("900.00", "USD")
        const difference = MonetaryAmount.unsafeFromString("100.00", "USD")

        const error = new UnbalancedEntryError({
          totalDebits,
          totalCredits,
          difference
        })

        expect(isUnbalancedEntryError(error)).toBe(true)
      })

      it("isUnbalancedEntryError returns false for other values", () => {
        expect(isUnbalancedEntryError(null)).toBe(false)
        expect(isUnbalancedEntryError(undefined)).toBe(false)
        expect(isUnbalancedEntryError(new Error("test"))).toBe(false)
        expect(isUnbalancedEntryError({ _tag: "UnbalancedEntryError" })).toBe(false)
      })
    })

    it.effect("error can be encoded and decoded", () =>
      Effect.gen(function* () {
        const totalDebits = MonetaryAmount.unsafeFromString("1000.00", "USD")
        const totalCredits = MonetaryAmount.unsafeFromString("900.00", "USD")
        const difference = MonetaryAmount.unsafeFromString("100.00", "USD")

        const original = new UnbalancedEntryError({
          totalDebits,
          totalCredits,
          difference
        })

        const encoded = yield* Schema.encode(UnbalancedEntryError)(original)
        const decoded = yield* Schema.decodeUnknown(UnbalancedEntryError)(encoded)

        expect(decoded._tag).toBe("UnbalancedEntryError")
        expect(BigDecimal.equals(decoded.totalDebits.amount, original.totalDebits.amount)).toBe(true)
        expect(BigDecimal.equals(decoded.totalCredits.amount, original.totalCredits.amount)).toBe(true)
        expect(BigDecimal.equals(decoded.difference.amount, original.difference.amount)).toBe(true)
      })
    )
  })

  describe("property-based tests", () => {
    // Generate a positive BigDecimal string for amounts
    const positiveBigDecimalString = FastCheck.integer({ min: 1, max: 999999 })
      .chain((int) =>
        FastCheck.integer({ min: 0, max: 9999 })
          .map((decimal) => `${int}.${String(decimal).padStart(4, "0")}`)
      )

    // Generate a valid UUID
    const uuidArb = FastCheck.uuid()

    // Create a debit line with the given amount
    const createTestDebitLine = (uuid: string, amount: string, lineNum: number) =>
      createDebitLine(uuid, lineNum, amount, usdCurrency, amount, usdCurrency)

    // Create a credit line with the given amount
    const createTestCreditLine = (uuid: string, amount: string, lineNum: number) =>
      createCreditLine(uuid, lineNum, amount, usdCurrency, amount, usdCurrency)

    it.prop(
      "balanced entries always have equal debits and credits",
      [positiveBigDecimalString, uuidArb, uuidArb],
      ([amount, uuid1, uuid2]) => {
        const debitLine = createTestDebitLine(uuid1, amount, 1)
        const creditLine = createTestCreditLine(uuid2, amount, 2)

        const totalDebits = sumDebits([debitLine, creditLine], usdCurrency)
        const totalCredits = sumCredits([debitLine, creditLine], usdCurrency)

        return BigDecimal.equals(totalDebits.amount, totalCredits.amount)
      }
    )

    it.prop(
      "validateBalance succeeds for any entry where debits equal credits",
      [positiveBigDecimalString, uuidArb, uuidArb],
      ([amount, uuid1, uuid2]) => {
        const debitLine = createTestDebitLine(uuid1, amount, 1)
        const creditLine = createTestCreditLine(uuid2, amount, 2)

        return isBalanced([debitLine, creditLine], usdCurrency)
      }
    )

    it.prop(
      "sum of debits equals sum of credits implies isBalanced is true",
      [positiveBigDecimalString, uuidArb, uuidArb],
      ([amount, uuid1, uuid2]) => {
        const debitLine = createTestDebitLine(uuid1, amount, 1)
        const creditLine = createTestCreditLine(uuid2, amount, 2)
        const lines = [debitLine, creditLine]

        const debits = sumDebits(lines, usdCurrency)
        const credits = sumCredits(lines, usdCurrency)

        if (BigDecimal.equals(debits.amount, credits.amount)) {
          return isBalanced(lines, usdCurrency) === true
        }
        return true // Skip if not equal
      }
    )

    it.prop(
      "calculateDifference is zero when isBalanced is true",
      [positiveBigDecimalString, uuidArb, uuidArb],
      ([amount, uuid1, uuid2]) => {
        const debitLine = createTestDebitLine(uuid1, amount, 1)
        const creditLine = createTestCreditLine(uuid2, amount, 2)
        const lines = [debitLine, creditLine]

        if (isBalanced(lines, usdCurrency)) {
          const diff = calculateDifference(lines, usdCurrency)
          return diff.isZero
        }
        return true
      }
    )

    it.prop(
      "sumDebits + calculateDifference = sumCredits (algebraic identity)",
      [positiveBigDecimalString, positiveBigDecimalString, uuidArb, uuidArb],
      ([debitAmount, creditAmount, uuid1, uuid2]) => {
        const debitLine = createTestDebitLine(uuid1, debitAmount, 1)
        const creditLine = createTestCreditLine(uuid2, creditAmount, 2)
        const lines = [debitLine, creditLine]

        const debits = sumDebits(lines, usdCurrency)
        const credits = sumCredits(lines, usdCurrency)
        const diff = calculateDifference(lines, usdCurrency)

        // debits - credits = diff
        // Therefore: debits = credits + diff
        const expected = BigDecimal.sum(credits.amount, diff.amount)
        return BigDecimal.equals(debits.amount, expected)
      }
    )

    it.prop(
      "multiple debits and credits balance when totals match",
      [
        FastCheck.array(positiveBigDecimalString, { minLength: 1, maxLength: 5 }),
        FastCheck.array(uuidArb, { minLength: 10, maxLength: 10 })
      ],
      ([amounts, uuids]) => {
        // Calculate total amount
        let total = BigDecimal.fromBigInt(0n)
        for (const amount of amounts) {
          total = BigDecimal.sum(total, BigDecimal.unsafeFromString(amount))
        }
        const totalStr = BigDecimal.format(total)

        // Create multiple debit lines
        const debitLines = amounts.map((amount, i) =>
          createTestDebitLine(uuids[i] || uuids[0], amount, i + 1)
        )

        // Create a single credit line with the total
        const creditLine = createTestCreditLine(
          uuids[amounts.length] || uuids[0],
          totalStr,
          amounts.length + 1
        )

        const lines = [...debitLines, creditLine]
        return isBalanced(lines, usdCurrency)
      }
    )

    it.effect.prop(
      "validateBalance fails for unequal amounts",
      [positiveBigDecimalString, positiveBigDecimalString, uuidArb, uuidArb],
      ([debitAmount, creditAmount, uuid1, uuid2]) =>
        Effect.gen(function* () {
          // Only test when amounts are different
          if (debitAmount === creditAmount) {
            return true
          }

          const debitLine = createTestDebitLine(uuid1, debitAmount, 1)
          const creditLine = createTestCreditLine(uuid2, creditAmount, 2)

          const result = yield* Effect.exit(validateBalance([debitLine, creditLine], usdCurrency))
          return Exit.isFailure(result)
        })
    )
  })
})
