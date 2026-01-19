import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, Exit, Equal, FastCheck, Schema } from "effect"
import {
  MissingExchangeRateError,
  isMissingExchangeRateError,
  MultiCurrencyConversionResult,
  isMultiCurrencyConversionResult,
  convertToFunctional,
  validateAndConvertToFunctional,
  isExchangeRateRequired,
  createSameCurrencyResult,
  createMultiCurrencyResult,
  validateExchangeRate
} from "../../src/journal/MultiCurrencyLineHandling.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"

describe("MultiCurrencyLineHandling", () => {
  const usdCurrency = CurrencyCode.make("USD")
  const gbpCurrency = CurrencyCode.make("GBP")
  const eurCurrency = CurrencyCode.make("EUR")
  const jpyCurrency = CurrencyCode.make("JPY")

  describe("MissingExchangeRateError", () => {
    it("creates error with correct properties", () => {
      const error = new MissingExchangeRateError({
        transactionCurrency: gbpCurrency,
        functionalCurrency: usdCurrency
      })

      expect(error._tag).toBe("MissingExchangeRateError")
      expect(error.transactionCurrency).toBe("GBP")
      expect(error.functionalCurrency).toBe("USD")
    })

    it("generates correct message", () => {
      const error = new MissingExchangeRateError({
        transactionCurrency: eurCurrency,
        functionalCurrency: usdCurrency
      })

      expect(error.message).toContain("Missing exchange rate")
      expect(error.message).toContain("EUR")
      expect(error.message).toContain("USD")
    })

    describe("type guard", () => {
      it("isMissingExchangeRateError returns true for error instances", () => {
        const error = new MissingExchangeRateError({
          transactionCurrency: gbpCurrency,
          functionalCurrency: usdCurrency
        })
        expect(isMissingExchangeRateError(error)).toBe(true)
      })

      it("isMissingExchangeRateError returns false for other values", () => {
        expect(isMissingExchangeRateError(null)).toBe(false)
        expect(isMissingExchangeRateError(undefined)).toBe(false)
        expect(isMissingExchangeRateError(new Error("test"))).toBe(false)
        expect(isMissingExchangeRateError({ _tag: "MissingExchangeRateError" })).toBe(false)
      })
    })

    it.effect("error can be encoded and decoded", () =>
      Effect.gen(function* () {
        const original = new MissingExchangeRateError({
          transactionCurrency: gbpCurrency,
          functionalCurrency: usdCurrency
        })

        const encoded = yield* Schema.encode(MissingExchangeRateError)(original)
        const decoded = yield* Schema.decodeUnknown(MissingExchangeRateError)(encoded)

        expect(decoded._tag).toBe("MissingExchangeRateError")
        expect(decoded.transactionCurrency).toBe(original.transactionCurrency)
        expect(decoded.functionalCurrency).toBe(original.functionalCurrency)
      })
    )
  })

  describe("MultiCurrencyConversionResult", () => {
    it("creates result with correct properties", () => {
      const original = MonetaryAmount.unsafeFromString("800.00", "GBP")
      const functional = MonetaryAmount.unsafeFromString("1000.00", "USD")
      const rate = BigDecimal.unsafeFromString("1.25")

      const result = MultiCurrencyConversionResult.make({
        originalAmount: original,
        functionalAmount: functional,
        exchangeRate: rate
      })

      expect(result.originalAmount.currency).toBe("GBP")
      expect(result.functionalAmount.currency).toBe("USD")
      expect(BigDecimal.equals(result.exchangeRate, BigDecimal.unsafeFromString("1.25"))).toBe(true)
    })

    describe("type guard", () => {
      it("isMultiCurrencyConversionResult returns true for instances", () => {
        const original = MonetaryAmount.unsafeFromString("100.00", "USD")
        const result = MultiCurrencyConversionResult.make({
          originalAmount: original,
          functionalAmount: original,
          exchangeRate: BigDecimal.fromBigInt(1n)
        })
        expect(isMultiCurrencyConversionResult(result)).toBe(true)
      })

      it("isMultiCurrencyConversionResult returns false for other values", () => {
        expect(isMultiCurrencyConversionResult(null)).toBe(false)
        expect(isMultiCurrencyConversionResult(undefined)).toBe(false)
        expect(isMultiCurrencyConversionResult({})).toBe(false)
      })
    })

    it.effect("can be encoded and decoded", () =>
      Effect.gen(function* () {
        const original = MonetaryAmount.unsafeFromString("800.00", "GBP")
        const functional = MonetaryAmount.unsafeFromString("1000.00", "USD")
        const rate = BigDecimal.unsafeFromString("1.25")

        const result = MultiCurrencyConversionResult.make({
          originalAmount: original,
          functionalAmount: functional,
          exchangeRate: rate
        })

        const encoded = yield* Schema.encode(MultiCurrencyConversionResult)(result)
        const decoded = yield* Schema.decodeUnknown(MultiCurrencyConversionResult)(encoded)

        expect(decoded.originalAmount.currency).toBe("GBP")
        expect(decoded.functionalAmount.currency).toBe("USD")
        expect(BigDecimal.equals(decoded.exchangeRate, rate)).toBe(true)
      })
    )
  })

  describe("convertToFunctional", () => {
    it("converts amount using exchange rate", () => {
      const amount = MonetaryAmount.unsafeFromString("800.00", "GBP")
      const rate = BigDecimal.unsafeFromString("1.25") // 1 GBP = 1.25 USD

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("handles rate of 1 (same currency)", () => {
      const amount = MonetaryAmount.unsafeFromString("1000.00", "USD")
      const rate = BigDecimal.fromBigInt(1n)

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("handles fractional exchange rates", () => {
      const amount = MonetaryAmount.unsafeFromString("100.00", "EUR")
      const rate = BigDecimal.unsafeFromString("1.0876") // 1 EUR = 1.0876 USD

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("108.76"))).toBe(true)
    })

    it("handles high-precision amounts", () => {
      const amount = MonetaryAmount.unsafeFromString("123.456789", "EUR")
      const rate = BigDecimal.unsafeFromString("1.123456")

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      // 123.456789 * 1.123456 = 138.711920546784
      // Verify the result is the expected product
      const expectedAmount = BigDecimal.multiply(
        BigDecimal.unsafeFromString("123.456789"),
        BigDecimal.unsafeFromString("1.123456")
      )
      expect(BigDecimal.equals(result.amount, expectedAmount)).toBe(true)
    })

    it("handles very small amounts", () => {
      const amount = MonetaryAmount.unsafeFromString("0.01", "GBP")
      const rate = BigDecimal.unsafeFromString("1.25")

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("0.0125"))).toBe(true)
    })

    it("handles large amounts", () => {
      const amount = MonetaryAmount.unsafeFromString("1000000.00", "GBP")
      const rate = BigDecimal.unsafeFromString("1.25")

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1250000"))).toBe(true)
    })

    it("handles zero amount", () => {
      const amount = MonetaryAmount.zero(gbpCurrency)
      const rate = BigDecimal.unsafeFromString("1.25")

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      expect(result.isZero).toBe(true)
    })

    it("handles rates less than 1", () => {
      const amount = MonetaryAmount.unsafeFromString("100.00", "USD")
      const rate = BigDecimal.unsafeFromString("0.80") // 1 USD = 0.80 GBP

      const result = convertToFunctional(amount, rate, gbpCurrency)

      expect(result.currency).toBe("GBP")
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("80"))).toBe(true)
    })

    it("handles JPY with no decimal places correctly", () => {
      const amount = MonetaryAmount.unsafeFromString("10000", "JPY")
      const rate = BigDecimal.unsafeFromString("0.0091") // 1 JPY = 0.0091 USD

      const result = convertToFunctional(amount, rate, usdCurrency)

      expect(result.currency).toBe("USD")
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("91"))).toBe(true)
    })
  })

  describe("validateAndConvertToFunctional", () => {
    it.effect("succeeds for same currency transaction (no rate provided)", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.unsafeFromString("1000.00", "USD")

        const result = yield* validateAndConvertToFunctional(amount, undefined, usdCurrency)

        expect(result.originalAmount.currency).toBe("USD")
        expect(result.functionalAmount.currency).toBe("USD")
        expect(BigDecimal.equals(result.originalAmount.amount, result.functionalAmount.amount)).toBe(true)
        expect(BigDecimal.equals(result.exchangeRate, BigDecimal.fromBigInt(1n))).toBe(true)
      })
    )

    it.effect("succeeds for same currency transaction (rate provided)", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.unsafeFromString("1000.00", "USD")
        const rate = BigDecimal.unsafeFromString("1.5") // Should be ignored for same currency

        const result = yield* validateAndConvertToFunctional(amount, rate, usdCurrency)

        expect(result.originalAmount.currency).toBe("USD")
        expect(result.functionalAmount.currency).toBe("USD")
        expect(BigDecimal.equals(result.exchangeRate, BigDecimal.fromBigInt(1n))).toBe(true)
      })
    )

    it.effect("succeeds for different currency with rate provided", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.unsafeFromString("800.00", "GBP")
        const rate = BigDecimal.unsafeFromString("1.25")

        const result = yield* validateAndConvertToFunctional(amount, rate, usdCurrency)

        expect(result.originalAmount.currency).toBe("GBP")
        expect(result.functionalAmount.currency).toBe("USD")
        expect(BigDecimal.equals(result.functionalAmount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
        expect(BigDecimal.equals(result.exchangeRate, BigDecimal.unsafeFromString("1.25"))).toBe(true)
      })
    )

    it.effect("fails for different currency without rate", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.unsafeFromString("800.00", "GBP")

        const result = yield* Effect.exit(validateAndConvertToFunctional(amount, undefined, usdCurrency))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          const error = result.cause.error
          expect(isMissingExchangeRateError(error)).toBe(true)
          if (isMissingExchangeRateError(error)) {
            expect(error.transactionCurrency).toBe("GBP")
            expect(error.functionalCurrency).toBe("USD")
          }
        }
      })
    )

    it.effect("handles EUR to USD conversion", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.unsafeFromString("500.00", "EUR")
        const rate = BigDecimal.unsafeFromString("1.10")

        const result = yield* validateAndConvertToFunctional(amount, rate, usdCurrency)

        expect(result.originalAmount.currency).toBe("EUR")
        expect(result.functionalAmount.currency).toBe("USD")
        expect(BigDecimal.equals(result.functionalAmount.amount, BigDecimal.unsafeFromString("550"))).toBe(true)
      })
    )

    it.effect("handles JPY to USD conversion", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.unsafeFromString("15000", "JPY")
        const rate = BigDecimal.unsafeFromString("0.0067")

        const result = yield* validateAndConvertToFunctional(amount, rate, usdCurrency)

        expect(result.originalAmount.currency).toBe("JPY")
        expect(result.functionalAmount.currency).toBe("USD")
        // 15000 * 0.0067 = 100.5
        expect(BigDecimal.equals(result.functionalAmount.amount, BigDecimal.unsafeFromString("100.5"))).toBe(true)
      })
    )
  })

  describe("isExchangeRateRequired", () => {
    it("returns false for same currency", () => {
      expect(isExchangeRateRequired(usdCurrency, usdCurrency)).toBe(false)
      expect(isExchangeRateRequired(gbpCurrency, gbpCurrency)).toBe(false)
      expect(isExchangeRateRequired(eurCurrency, eurCurrency)).toBe(false)
    })

    it("returns true for different currencies", () => {
      expect(isExchangeRateRequired(gbpCurrency, usdCurrency)).toBe(true)
      expect(isExchangeRateRequired(usdCurrency, gbpCurrency)).toBe(true)
      expect(isExchangeRateRequired(eurCurrency, usdCurrency)).toBe(true)
      expect(isExchangeRateRequired(jpyCurrency, usdCurrency)).toBe(true)
    })
  })

  describe("createSameCurrencyResult", () => {
    it("creates result with same original and functional amount", () => {
      const amount = MonetaryAmount.unsafeFromString("1000.00", "USD")

      const result = createSameCurrencyResult(amount)

      expect(Equal.equals(result.originalAmount, result.functionalAmount)).toBe(true)
      expect(result.originalAmount.currency).toBe("USD")
      expect(result.functionalAmount.currency).toBe("USD")
      expect(BigDecimal.equals(result.exchangeRate, BigDecimal.fromBigInt(1n))).toBe(true)
    })

    it("works with different currencies", () => {
      const amount = MonetaryAmount.unsafeFromString("500.00", "GBP")

      const result = createSameCurrencyResult(amount)

      expect(result.originalAmount.currency).toBe("GBP")
      expect(result.functionalAmount.currency).toBe("GBP")
    })

    it("works with zero amount", () => {
      const amount = MonetaryAmount.zero(eurCurrency)

      const result = createSameCurrencyResult(amount)

      expect(result.originalAmount.isZero).toBe(true)
      expect(result.functionalAmount.isZero).toBe(true)
    })
  })

  describe("createMultiCurrencyResult", () => {
    it("creates result with converted functional amount", () => {
      const amount = MonetaryAmount.unsafeFromString("800.00", "GBP")
      const rate = BigDecimal.unsafeFromString("1.25")

      const result = createMultiCurrencyResult(amount, rate, usdCurrency)

      expect(result.originalAmount.currency).toBe("GBP")
      expect(result.functionalAmount.currency).toBe("USD")
      expect(BigDecimal.equals(result.originalAmount.amount, BigDecimal.unsafeFromString("800"))).toBe(true)
      expect(BigDecimal.equals(result.functionalAmount.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(BigDecimal.equals(result.exchangeRate, BigDecimal.unsafeFromString("1.25"))).toBe(true)
    })

    it("handles fractional rates", () => {
      const amount = MonetaryAmount.unsafeFromString("100.00", "EUR")
      const rate = BigDecimal.unsafeFromString("1.0876")

      const result = createMultiCurrencyResult(amount, rate, usdCurrency)

      expect(BigDecimal.equals(result.functionalAmount.amount, BigDecimal.unsafeFromString("108.76"))).toBe(true)
    })

    it("handles zero amount", () => {
      const amount = MonetaryAmount.zero(gbpCurrency)
      const rate = BigDecimal.unsafeFromString("1.25")

      const result = createMultiCurrencyResult(amount, rate, usdCurrency)

      expect(result.originalAmount.isZero).toBe(true)
      expect(result.functionalAmount.isZero).toBe(true)
    })
  })

  describe("validateExchangeRate", () => {
    it.effect("succeeds with unity rate for same currency when rate is undefined", () =>
      Effect.gen(function* () {
        const rate = yield* validateExchangeRate(usdCurrency, usdCurrency, undefined)
        expect(BigDecimal.equals(rate, BigDecimal.fromBigInt(1n))).toBe(true)
      })
    )

    it.effect("succeeds with provided rate for same currency", () =>
      Effect.gen(function* () {
        const providedRate = BigDecimal.unsafeFromString("1.5")
        const rate = yield* validateExchangeRate(usdCurrency, usdCurrency, providedRate)
        expect(BigDecimal.equals(rate, providedRate)).toBe(true)
      })
    )

    it.effect("succeeds with provided rate for different currencies", () =>
      Effect.gen(function* () {
        const providedRate = BigDecimal.unsafeFromString("1.25")
        const rate = yield* validateExchangeRate(gbpCurrency, usdCurrency, providedRate)
        expect(BigDecimal.equals(rate, providedRate)).toBe(true)
      })
    )

    it.effect("fails for different currencies when rate is undefined", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateExchangeRate(gbpCurrency, usdCurrency, undefined))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          const error = result.cause.error
          expect(isMissingExchangeRateError(error)).toBe(true)
        }
      })
    )

    it.effect("fails for EUR to USD without rate", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(validateExchangeRate(eurCurrency, usdCurrency, undefined))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          const error = result.cause.error
          expect(isMissingExchangeRateError(error)).toBe(true)
          if (isMissingExchangeRateError(error)) {
            expect(error.transactionCurrency).toBe("EUR")
            expect(error.functionalCurrency).toBe("USD")
          }
        }
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

    // Generate a positive exchange rate string
    const positiveRateString = FastCheck.integer({ min: 1, max: 999 })
      .chain((int) =>
        FastCheck.integer({ min: 0, max: 9999 })
          .map((decimal) => `${int}.${String(decimal).padStart(4, "0")}`)
      )

    it.prop(
      "convertToFunctional preserves zero",
      [positiveRateString],
      ([rateStr]) => {
        const zero = MonetaryAmount.zero(gbpCurrency)
        const rate = BigDecimal.unsafeFromString(rateStr)

        const result = convertToFunctional(zero, rate, usdCurrency)

        return result.isZero && result.currency === "USD"
      }
    )

    it.prop(
      "convertToFunctional with rate 1 preserves amount value",
      [positiveBigDecimalString],
      ([amountStr]) => {
        const amount = MonetaryAmount.unsafeFromString(amountStr, "GBP")
        const rate = BigDecimal.fromBigInt(1n)

        const result = convertToFunctional(amount, rate, usdCurrency)

        return (
          BigDecimal.equals(result.amount, amount.amount) &&
          result.currency === "USD"
        )
      }
    )

    it.prop(
      "convertToFunctional is positive for positive amounts and positive rates",
      [positiveBigDecimalString, positiveRateString],
      ([amountStr, rateStr]) => {
        const amount = MonetaryAmount.unsafeFromString(amountStr, "GBP")
        const rate = BigDecimal.unsafeFromString(rateStr)

        const result = convertToFunctional(amount, rate, usdCurrency)

        return result.isPositive
      }
    )

    it.prop(
      "isExchangeRateRequired is symmetric for same currency",
      [FastCheck.constantFrom("USD", "GBP", "EUR", "JPY")],
      ([currencyStr]) => {
        const currency = CurrencyCode.make(currencyStr)
        return isExchangeRateRequired(currency, currency) === false
      }
    )

    it.prop(
      "createSameCurrencyResult always has rate of 1",
      [positiveBigDecimalString, FastCheck.constantFrom("USD", "GBP", "EUR")],
      ([amountStr, currencyStr]) => {
        const currency = CurrencyCode.make(currencyStr)
        const amount = MonetaryAmount.unsafeFromString(amountStr, currencyStr)

        const result = createSameCurrencyResult(amount)

        return (
          BigDecimal.equals(result.exchangeRate, BigDecimal.fromBigInt(1n)) &&
          result.originalAmount.currency === currency &&
          result.functionalAmount.currency === currency
        )
      }
    )

    it.effect.prop(
      "validateAndConvertToFunctional succeeds for same currency without rate",
      [positiveBigDecimalString, FastCheck.constantFrom("USD", "GBP", "EUR")],
      ([amountStr, currencyStr]) =>
        Effect.gen(function* () {
          const currency = CurrencyCode.make(currencyStr)
          const amount = MonetaryAmount.unsafeFromString(amountStr, currencyStr)

          const result = yield* validateAndConvertToFunctional(amount, undefined, currency)

          return (
            Equal.equals(result.originalAmount, result.functionalAmount) &&
            BigDecimal.equals(result.exchangeRate, BigDecimal.fromBigInt(1n))
          )
        })
    )

    it.effect.prop(
      "validateAndConvertToFunctional fails for different currency without rate",
      [positiveBigDecimalString],
      ([amountStr]) =>
        Effect.gen(function* () {
          const amount = MonetaryAmount.unsafeFromString(amountStr, "GBP")

          const result = yield* Effect.exit(validateAndConvertToFunctional(amount, undefined, usdCurrency))

          return Exit.isFailure(result)
        })
    )

    it.effect.prop(
      "validateAndConvertToFunctional result amount matches direct conversion",
      [positiveBigDecimalString, positiveRateString],
      ([amountStr, rateStr]) =>
        Effect.gen(function* () {
          const amount = MonetaryAmount.unsafeFromString(amountStr, "GBP")
          const rate = BigDecimal.unsafeFromString(rateStr)

          const result = yield* validateAndConvertToFunctional(amount, rate, usdCurrency)
          const directConversion = convertToFunctional(amount, rate, usdCurrency)

          return BigDecimal.equals(result.functionalAmount.amount, directConversion.amount)
        })
    )
  })

  describe("integration scenarios", () => {
    it.effect("handles typical multi-currency journal entry scenario", () =>
      Effect.gen(function* () {
        // Scenario: Company in US (USD functional) receives payment in GBP
        const paymentAmount = MonetaryAmount.unsafeFromString("10000.00", "GBP")
        const spotRate = BigDecimal.unsafeFromString("1.27") // 1 GBP = 1.27 USD on transaction date

        const result = yield* validateAndConvertToFunctional(paymentAmount, spotRate, usdCurrency)

        // Original amount should be preserved
        expect(result.originalAmount.currency).toBe("GBP")
        expect(BigDecimal.equals(result.originalAmount.amount, BigDecimal.unsafeFromString("10000"))).toBe(true)

        // Functional amount should be converted
        expect(result.functionalAmount.currency).toBe("USD")
        expect(BigDecimal.equals(result.functionalAmount.amount, BigDecimal.unsafeFromString("12700"))).toBe(true)

        // Exchange rate should be stored
        expect(BigDecimal.equals(result.exchangeRate, spotRate)).toBe(true)
      })
    )

    it.effect("handles domestic transaction (same currency)", () =>
      Effect.gen(function* () {
        // Scenario: Company in US (USD functional) makes USD payment
        const paymentAmount = MonetaryAmount.unsafeFromString("5000.00", "USD")

        const result = yield* validateAndConvertToFunctional(paymentAmount, undefined, usdCurrency)

        // Original and functional amounts should be the same
        expect(Equal.equals(result.originalAmount, result.functionalAmount)).toBe(true)
        expect(BigDecimal.equals(result.exchangeRate, BigDecimal.fromBigInt(1n))).toBe(true)
      })
    )

    it.effect("handles high-precision currency conversion", () =>
      Effect.gen(function* () {
        // Scenario: Small transaction with precise exchange rate
        const amount = MonetaryAmount.unsafeFromString("123.4567", "EUR")
        const rate = BigDecimal.unsafeFromString("1.08765432")

        const result = yield* validateAndConvertToFunctional(amount, rate, usdCurrency)

        expect(result.originalAmount.currency).toBe("EUR")
        expect(result.functionalAmount.currency).toBe("USD")
        // Verify the multiplication is correct
        const expectedAmount = BigDecimal.multiply(
          BigDecimal.unsafeFromString("123.4567"),
          BigDecimal.unsafeFromString("1.08765432")
        )
        expect(BigDecimal.equals(result.functionalAmount.amount, expectedAmount)).toBe(true)
      })
    )

    it.effect("validates rate requirement for cross-currency invoice", () =>
      Effect.gen(function* () {
        // Scenario: Invoice in EUR but no exchange rate provided
        const invoiceAmount = MonetaryAmount.unsafeFromString("2500.00", "EUR")

        const checkResult = isExchangeRateRequired(eurCurrency, usdCurrency)
        expect(checkResult).toBe(true)

        const result = yield* Effect.exit(
          validateAndConvertToFunctional(invoiceAmount, undefined, usdCurrency)
        )

        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })
})
