import { describe, it, expect } from "@effect/vitest"
import { Cause, Chunk, Effect, Exit, Equal } from "effect"
import * as BigDecimal from "effect/BigDecimal"
import * as Schema from "effect/Schema"
import { USD, EUR } from "../../src/currency/CurrencyCode.ts"
import {
  MonetaryAmount,
  isMonetaryAmount,
  add,
  subtract,
  multiply,
  multiplyByNumber,
  divide,
  divideByNumber,
  unsafeDivide,
  compare,
  greaterThan,
  lessThan,
  greaterThanOrEqualTo,
  lessThanOrEqualTo,
  equals,
  sum,
  round,
  max,
  min,
  CurrencyMismatchError,
  DivisionByZeroError,
  isCurrencyMismatchError,
  isDivisionByZeroError
} from "../../src/shared/values/MonetaryAmount.ts"

describe("MonetaryAmount", () => {
  describe("creation", () => {
    it("creates from BigDecimal and CurrencyCode", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.50"), USD)

      expect(amount.currency).toBe("USD")
      // BigDecimal.format normalizes trailing zeros
      expect(BigDecimal.format(amount.amount)).toBe("100.5")
    })

    it("ensures minimum 4 decimal places in internal representation", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)

      // Should have at least 4 decimal places internally for precision
      expect(amount.amount.scale).toBeGreaterThanOrEqual(4)
    })

    it("preserves precision beyond 4 decimal places", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.123456"), USD)

      expect(BigDecimal.format(amount.amount)).toBe("100.123456")
    })

    it.effect("creates from string and CurrencyCode", () =>
      Effect.gen(function* () {
        const amount = yield* MonetaryAmount.fromString("250.75", USD)

        expect(amount.currency).toBe("USD")
        expect(BigDecimal.format(amount.amount)).toBe("250.75")
      })
    )

    it.effect("fails on invalid string amount", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(MonetaryAmount.fromString("not-a-number", USD))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it("creates using unsafeFromString", () => {
      const amount = MonetaryAmount.unsafeFromString("500.00", "USD")

      expect(amount.currency).toBe("USD")
      // BigDecimal.format normalizes trailing zeros
      expect(BigDecimal.format(amount.amount)).toBe("500")
    })

    it("unsafeFromString throws on invalid currency", () => {
      expect(() => MonetaryAmount.unsafeFromString("100", "usd")).toThrow()
    })

    it("creates zero amount", () => {
      const zero = MonetaryAmount.zero(USD)

      expect(zero.isZero).toBe(true)
      expect(zero.currency).toBe("USD")
    })
  })

  describe("predicates", () => {
    it("isZero returns true for zero amount", () => {
      const zero = MonetaryAmount.zero(USD)
      expect(zero.isZero).toBe(true)
    })

    it("isZero returns false for non-zero amount", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      expect(amount.isZero).toBe(false)
    })

    it("isPositive returns true for positive amount", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      expect(amount.isPositive).toBe(true)
    })

    it("isPositive returns false for zero", () => {
      const zero = MonetaryAmount.zero(USD)
      expect(zero.isPositive).toBe(false)
    })

    it("isPositive returns false for negative amount", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("-100"), USD)
      expect(amount.isPositive).toBe(false)
    })

    it("isNegative returns true for negative amount", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("-100"), USD)
      expect(amount.isNegative).toBe(true)
    })

    it("isNegative returns false for zero", () => {
      const zero = MonetaryAmount.zero(USD)
      expect(zero.isNegative).toBe(false)
    })

    it("isNegative returns false for positive amount", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      expect(amount.isNegative).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isMonetaryAmount returns true for MonetaryAmount instances", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      expect(isMonetaryAmount(amount)).toBe(true)
    })

    it("isMonetaryAmount returns false for plain objects", () => {
      expect(isMonetaryAmount({ amount: "100", currency: "USD" })).toBe(false)
    })

    it("isMonetaryAmount returns false for primitives", () => {
      expect(isMonetaryAmount(100)).toBe(false)
      expect(isMonetaryAmount("100 USD")).toBe(false)
      expect(isMonetaryAmount(null)).toBe(false)
      expect(isMonetaryAmount(undefined)).toBe(false)
    })
  })

  describe("transformations", () => {
    it("abs returns absolute value", () => {
      const negative = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("-100"), USD)
      const positive = negative.abs()

      expect(positive.isPositive).toBe(true)
      expect(BigDecimal.format(positive.amount)).toBe("100")
    })

    it("abs returns same value for positive", () => {
      const positive = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const result = positive.abs()

      expect(BigDecimal.format(result.amount)).toBe("100")
    })

    it("negate returns negated value", () => {
      const positive = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const negated = positive.negate()

      expect(negated.isNegative).toBe(true)
      expect(BigDecimal.format(negated.amount)).toBe("-100")
    })

    it("double negate returns original", () => {
      const original = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const doubleNegated = original.negate().negate()

      expect(BigDecimal.equals(original.amount, doubleNegated.amount)).toBe(true)
    })
  })

  describe("formatting", () => {
    it("format returns amount as string", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("1234.56"), USD)
      expect(amount.format()).toBe("1234.56")
    })

    it("toString includes currency", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("1234.56"), USD)
      expect(amount.toString()).toBe("1234.56 USD")
    })
  })

  describe("equality", () => {
    it("equal amounts are equal", () => {
      const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)

      expect(Equal.equals(a, b)).toBe(true)
    })

    it("different amounts are not equal", () => {
      const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)

      expect(Equal.equals(a, b)).toBe(false)
    })

    it("same amount different currency are not equal", () => {
      const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), EUR)

      expect(Equal.equals(a, b)).toBe(false)
    })

    it("amounts with different precision but same value are equal", () => {
      const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.0000"), USD)

      expect(Equal.equals(a, b)).toBe(true)
    })

    it("MonetaryAmount is not equal to non-MonetaryAmount objects", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)

      expect(Equal.equals(amount, { amount: BigDecimal.unsafeFromString("100"), currency: "USD" })).toBe(false)
      expect(Equal.equals(amount, "100 USD")).toBe(false)
      expect(Equal.equals(amount, 100)).toBe(false)
    })

    it("Schema.Class uses value-based equality via Data.Class", () => {
      // Schema.Class extends Data.Class which provides value-based equality
      // Two MonetaryAmount instances with same values are equal
      const amount1 = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const amount2 = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)

      // Value-based equality means separate instances with same values are equal
      expect(Equal.equals(amount1, amount2)).toBe(true)
      expect(amount1 === amount2).toBe(false) // But they're not the same reference
    })
  })

  describe("arithmetic - add", () => {
    it.effect("adds two amounts with same currency", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.50"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("50.25"), USD)
        const result = yield* add(a, b)

        expect(result.currency).toBe("USD")
        expect(BigDecimal.format(result.amount)).toBe("150.75")
      })
    )

    it.effect("fails with CurrencyMismatchError for different currencies", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), EUR)
        const result = yield* Effect.exit(add(a, b))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const failures = Cause.failures(result.cause)
          const hasError = Chunk.some(failures, isCurrencyMismatchError)
          expect(hasError).toBe(true)
        }
      })
    )

    it.effect("handles negative amounts", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("-30"), USD)
        const result = yield* add(a, b)

        expect(BigDecimal.format(result.amount)).toBe("70")
      })
    )
  })

  describe("arithmetic - subtract", () => {
    it.effect("subtracts two amounts with same currency", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.50"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("50.25"), USD)
        const result = yield* subtract(a, b)

        expect(result.currency).toBe("USD")
        expect(BigDecimal.format(result.amount)).toBe("50.25")
      })
    )

    it.effect("fails with CurrencyMismatchError for different currencies", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), EUR)
        const result = yield* Effect.exit(subtract(a, b))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("can result in negative amount", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("50"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const result = yield* subtract(a, b)

        expect(result.isNegative).toBe(true)
        expect(BigDecimal.format(result.amount)).toBe("-50")
      })
    )
  })

  describe("arithmetic - multiply", () => {
    it("multiplies by BigDecimal scalar", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const result = multiply(amount, BigDecimal.unsafeFromString("2.5"))

      expect(result.currency).toBe("USD")
      expect(BigDecimal.format(result.amount)).toBe("250")
    })

    it("multiplies by number", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const result = multiplyByNumber(amount, 3)

      expect(BigDecimal.format(result.amount)).toBe("300")
    })

    it("handles fractional multiplier", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const result = multiply(amount, BigDecimal.unsafeFromString("0.1"))

      expect(BigDecimal.format(result.amount)).toBe("10")
    })

    it("multiplying by zero gives zero", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      const result = multiply(amount, BigDecimal.unsafeFromString("0"))

      expect(result.isZero).toBe(true)
    })
  })

  describe("arithmetic - divide", () => {
    it.effect("divides by BigDecimal scalar", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const result = yield* divide(amount, BigDecimal.unsafeFromString("4"))

        expect(result.currency).toBe("USD")
        expect(BigDecimal.format(result.amount)).toBe("25")
      })
    )

    it.effect("divides by number", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const result = yield* divideByNumber(amount, 4)

        expect(BigDecimal.format(result.amount)).toBe("25")
      })
    )

    it.effect("handles non-exact division with precision", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const result = yield* divide(amount, BigDecimal.unsafeFromString("3"))

        // Should have high precision
        expect(result.amount.scale).toBeGreaterThanOrEqual(4)
      })
    )

    it.effect("fails with DivisionByZeroError when dividing by zero BigDecimal", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const result = yield* Effect.exit(divide(amount, BigDecimal.unsafeFromString("0")))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result)) {
          const failures = Cause.failures(result.cause)
          const hasError = Chunk.some(failures, isDivisionByZeroError)
          expect(hasError).toBe(true)
        }
      })
    )

    it.effect("fails with DivisionByZeroError when dividing by zero number", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const result = yield* Effect.exit(divideByNumber(amount, 0))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it("unsafeDivide throws on division by zero", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
      expect(() => unsafeDivide(amount, BigDecimal.unsafeFromString("0"))).toThrow()
    })
  })

  describe("comparison", () => {
    it.effect("compare returns correct ordering", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)
        const c = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)

        expect(yield* compare(a, b)).toBe(-1)
        expect(yield* compare(b, a)).toBe(1)
        expect(yield* compare(a, c)).toBe(0)
      })
    )

    it.effect("greaterThan works correctly", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)

        expect(yield* greaterThan(a, b)).toBe(true)
        expect(yield* greaterThan(b, a)).toBe(false)
        expect(yield* greaterThan(a, a)).toBe(false)
      })
    )

    it.effect("lessThan works correctly", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)

        expect(yield* lessThan(a, b)).toBe(true)
        expect(yield* lessThan(b, a)).toBe(false)
        expect(yield* lessThan(a, a)).toBe(false)
      })
    )

    it.effect("greaterThanOrEqualTo works correctly", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const c = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)

        expect(yield* greaterThanOrEqualTo(a, b)).toBe(true)
        expect(yield* greaterThanOrEqualTo(a, c)).toBe(true)
        expect(yield* greaterThanOrEqualTo(b, a)).toBe(false)
      })
    )

    it.effect("lessThanOrEqualTo works correctly", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)
        const c = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)

        expect(yield* lessThanOrEqualTo(a, b)).toBe(true)
        expect(yield* lessThanOrEqualTo(a, c)).toBe(true)
        expect(yield* lessThanOrEqualTo(b, a)).toBe(false)
      })
    )

    it.effect("equals works correctly", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const c = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)

        expect(yield* equals(a, b)).toBe(true)
        expect(yield* equals(a, c)).toBe(false)
      })
    )

    it.effect("comparison fails for different currencies", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), EUR)

        expect(Exit.isFailure(yield* Effect.exit(compare(a, b)))).toBe(true)
        expect(Exit.isFailure(yield* Effect.exit(greaterThan(a, b)))).toBe(true)
        expect(Exit.isFailure(yield* Effect.exit(lessThan(a, b)))).toBe(true)
        expect(Exit.isFailure(yield* Effect.exit(greaterThanOrEqualTo(a, b)))).toBe(true)
        expect(Exit.isFailure(yield* Effect.exit(lessThanOrEqualTo(a, b)))).toBe(true)
        expect(Exit.isFailure(yield* Effect.exit(equals(a, b)))).toBe(true)
      })
    )
  })

  describe("utility operations", () => {
    it.effect("sum adds multiple amounts", () =>
      Effect.gen(function* () {
        const amounts = [
          MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD),
          MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD),
          MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("300"), USD)
        ]

        const result = yield* sum(amounts, USD)

        expect(result.currency).toBe("USD")
        expect(BigDecimal.format(result.amount)).toBe("600")
      })
    )

    it.effect("sum returns zero for empty array", () =>
      Effect.gen(function* () {
        const result = yield* sum([], USD)

        expect(result.isZero).toBe(true)
        expect(result.currency).toBe("USD")
      })
    )

    it.effect("sum fails for mixed currencies", () =>
      Effect.gen(function* () {
        const amounts = [
          MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD),
          MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), EUR)
        ]

        const result = yield* Effect.exit(sum(amounts, USD))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it("round rounds to specified decimal places", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.4567"), USD)
      const rounded = round(amount, 2)

      expect(BigDecimal.format(rounded.amount)).toBe("100.46")
    })

    it("round defaults to 2 decimal places", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.4567"), USD)
      const rounded = round(amount)

      expect(BigDecimal.format(rounded.amount)).toBe("100.46")
    })

    it("round uses half-from-zero rounding", () => {
      // 100.455 should round to 100.46 (round away from zero)
      const amount1 = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.455"), USD)
      const rounded1 = round(amount1, 2)
      expect(BigDecimal.format(rounded1.amount)).toBe("100.46")

      // 100.444 should round to 100.44
      const amount2 = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.444"), USD)
      const rounded2 = round(amount2, 2)
      expect(BigDecimal.format(rounded2.amount)).toBe("100.44")
    })

    it.effect("max returns the larger amount", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)

        const result = yield* max(a, b)

        expect(BigDecimal.format(result.amount)).toBe("200")
      })
    )

    it.effect("max fails for different currencies", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), EUR)

        const result = yield* Effect.exit(max(a, b))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("min returns the smaller amount", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), USD)

        const result = yield* min(a, b)

        expect(BigDecimal.format(result.amount)).toBe("100")
      })
    )

    it.effect("min fails for different currencies", () =>
      Effect.gen(function* () {
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("200"), EUR)

        const result = yield* Effect.exit(min(a, b))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("error types", () => {
    it("CurrencyMismatchError has correct message", () => {
      const error = new CurrencyMismatchError({ expected: USD, actual: EUR })
      expect(error.message).toBe("Currency mismatch: expected USD, got EUR")
      expect(error._tag).toBe("CurrencyMismatchError")
    })

    it("DivisionByZeroError has correct message", () => {
      const error = new DivisionByZeroError()
      expect(error.message).toBe("Division by zero")
      expect(error._tag).toBe("DivisionByZeroError")
    })

    it("isCurrencyMismatchError type guard works", () => {
      const error = new CurrencyMismatchError({ expected: USD, actual: EUR })
      expect(isCurrencyMismatchError(error)).toBe(true)
      expect(isCurrencyMismatchError(new DivisionByZeroError())).toBe(false)
      expect(isCurrencyMismatchError("error")).toBe(false)
    })

    it("isDivisionByZeroError type guard works", () => {
      const error = new DivisionByZeroError()
      expect(isDivisionByZeroError(error)).toBe(true)
      expect(isDivisionByZeroError(new CurrencyMismatchError({ expected: USD, actual: EUR }))).toBe(false)
      expect(isDivisionByZeroError("error")).toBe(false)
    })
  })

  describe("Schema encoding/decoding", () => {
    it.effect("decodes from encoded form", () =>
      Effect.gen(function* () {
        const encoded = {
          amount: "100.50",
          currency: "USD"
        }

        const decoded = yield* Schema.decodeUnknown(MonetaryAmount)(encoded)

        expect(decoded.currency).toBe("USD")
        expect(decoded.isPositive).toBe(true)
      })
    )

    it.effect("encodes to JSON-serializable form", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("100.50"), USD)
        const encoded = yield* Schema.encode(MonetaryAmount)(amount)

        expect(encoded.currency).toBe("USD")
        expect(typeof encoded.amount).toBe("string")
      })
    )

    it.effect("rejects invalid currency in encoded form", () =>
      Effect.gen(function* () {
        const encoded = {
          amount: "100.50",
          currency: "invalid"
        }

        const result = yield* Effect.exit(Schema.decodeUnknown(MonetaryAmount)(encoded))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid amount in encoded form", () =>
      Effect.gen(function* () {
        const encoded = {
          amount: "not-a-number",
          currency: "USD"
        }

        const result = yield* Effect.exit(Schema.decodeUnknown(MonetaryAmount)(encoded))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("precision preservation", () => {
    it.effect("maintains precision through arithmetic operations", () =>
      Effect.gen(function* () {
        // Classic floating point issue: 0.1 + 0.2 = 0.30000000000000004
        const a = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("0.1"), USD)
        const b = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("0.2"), USD)
        const result = yield* add(a, b)

        expect(BigDecimal.format(result.amount)).toBe("0.3")
      })
    )

    it("handles very small amounts", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("0.0001"), USD)
      expect(BigDecimal.format(amount.amount)).toBe("0.0001")
    })

    it("handles very large amounts", () => {
      const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("999999999999.9999"), USD)
      expect(BigDecimal.format(amount.amount)).toBe("999999999999.9999")
    })

    it.effect("division maintains precision for repeating decimals", () =>
      Effect.gen(function* () {
        const amount = MonetaryAmount.fromBigDecimal(BigDecimal.unsafeFromString("10"), USD)
        const result = yield* divide(amount, BigDecimal.unsafeFromString("3"))

        // Should have many decimal places for precision
        expect(result.amount.scale).toBeGreaterThanOrEqual(4)
      })
    )
  })
})
