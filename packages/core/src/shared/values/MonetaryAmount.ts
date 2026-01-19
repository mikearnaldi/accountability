/**
 * MonetaryAmount - Composite value object for monetary values
 *
 * Combines a high-precision decimal amount (BigDecimal) with a currency code.
 * All monetary calculations use BigDecimal to avoid floating-point errors.
 * Minimum 4 decimal places precision is ensured for all operations.
 *
 * @module shared/values/MonetaryAmount
 */

import { HttpApiSchema } from "@effect/platform"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import { CurrencyCode, isCurrencyCode } from "../../currency/CurrencyCode.ts"

/**
 * Minimum decimal precision for monetary amounts
 */
const MIN_PRECISION = 4

/**
 * Error for currency mismatch in arithmetic operations
 */
export class CurrencyMismatchError extends Schema.TaggedError<CurrencyMismatchError>()(
  "CurrencyMismatchError",
  {
    expected: CurrencyCode,
    actual: CurrencyCode
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Currency mismatch: expected ${this.expected}, got ${this.actual}`
  }
}

/**
 * Error for division by zero
 */
export class DivisionByZeroError extends Schema.TaggedError<DivisionByZeroError>()(
  "DivisionByZeroError",
  {},
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return "Division by zero"
  }
}

/**
 * Type guards for error types using Schema.is()
 */
export const isCurrencyMismatchError = Schema.is(CurrencyMismatchError)
export const isDivisionByZeroError = Schema.is(DivisionByZeroError)

/**
 * Union type for all MonetaryAmount errors
 */
export type MonetaryAmountError = CurrencyMismatchError | DivisionByZeroError

/**
 * MonetaryAmount Schema - composite value object with BigDecimal amount and CurrencyCode
 *
 * The encoded form uses a string for the amount to preserve precision.
 */
export class MonetaryAmount extends Schema.Class<MonetaryAmount>("MonetaryAmount")({
  amount: Schema.BigDecimal,
  currency: CurrencyCode
}) {
  /**
   * Ensure minimum precision by scaling to at least 4 decimal places
   */
  private static ensureMinPrecision(bd: BigDecimal.BigDecimal): BigDecimal.BigDecimal {
    if (bd.scale < MIN_PRECISION) {
      return BigDecimal.scale(bd, MIN_PRECISION)
    }
    return bd
  }

  /**
   * Create a MonetaryAmount from a BigDecimal and CurrencyCode
   */
  static fromBigDecimal(amount: BigDecimal.BigDecimal, currency: CurrencyCode): MonetaryAmount {
    return MonetaryAmount.make({ amount: MonetaryAmount.ensureMinPrecision(amount), currency })
  }

  /**
   * Create a MonetaryAmount from a string amount and CurrencyCode.
   * Returns an Effect that may fail with a ParseError if the string is invalid.
   */
  static fromString(
    amountStr: string,
    currency: CurrencyCode
  ): Effect.Effect<MonetaryAmount, ParseResult.ParseError> {
    return Effect.gen(function* () {
      const bd = yield* Schema.decodeUnknown(Schema.BigDecimal)(amountStr)
      return MonetaryAmount.fromBigDecimal(bd, currency)
    })
  }

  /**
   * Create a MonetaryAmount from a string amount and currency code string.
   * This is an unsafe operation that throws if the inputs are invalid.
   */
  static unsafeFromString(amountStr: string, currencyStr: string): MonetaryAmount {
    const amount = BigDecimal.unsafeFromString(amountStr)
    if (!isCurrencyCode(currencyStr)) {
      throw new Error(`Invalid currency code: ${currencyStr}`)
    }
    return MonetaryAmount.fromBigDecimal(amount, currencyStr)
  }

  /**
   * Create a zero MonetaryAmount for a given currency
   */
  static zero(currency: CurrencyCode): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(BigDecimal.fromBigInt(0n), currency)
  }

  /**
   * Check if this monetary amount is zero
   */
  get isZero(): boolean {
    return BigDecimal.isZero(this.amount)
  }

  /**
   * Check if this monetary amount is positive
   */
  get isPositive(): boolean {
    return BigDecimal.isPositive(this.amount)
  }

  /**
   * Check if this monetary amount is negative
   */
  get isNegative(): boolean {
    return BigDecimal.isNegative(this.amount)
  }

  /**
   * Get the absolute value of this monetary amount
   */
  abs(): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(BigDecimal.abs(this.amount), this.currency)
  }

  /**
   * Negate this monetary amount
   */
  negate(): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(BigDecimal.negate(this.amount), this.currency)
  }

  /**
   * Format the amount as a string
   */
  format(): string {
    return BigDecimal.format(this.amount)
  }

  /**
   * Convert to a display string with currency
   */
  toString(): string {
    return `${BigDecimal.format(this.amount)} ${this.currency}`
  }
}

/**
 * Type guard for MonetaryAmount using Schema.is()
 */
export const isMonetaryAmount = Schema.is(MonetaryAmount)

// =============================================================================
// Arithmetic Operations
// =============================================================================

/**
 * Add two monetary amounts.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const add = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<MonetaryAmount, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(
    MonetaryAmount.fromBigDecimal(BigDecimal.sum(a.amount, b.amount), a.currency)
  )
}

/**
 * Subtract the second monetary amount from the first.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const subtract = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<MonetaryAmount, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(
    MonetaryAmount.fromBigDecimal(BigDecimal.subtract(a.amount, b.amount), a.currency)
  )
}

/**
 * Multiply a monetary amount by a scalar (BigDecimal).
 * The result maintains the original currency.
 */
export const multiply = (
  amount: MonetaryAmount,
  multiplier: BigDecimal.BigDecimal
): MonetaryAmount => {
  return MonetaryAmount.fromBigDecimal(
    BigDecimal.multiply(amount.amount, multiplier),
    amount.currency
  )
}

/**
 * Multiply a monetary amount by a number.
 * The result maintains the original currency.
 */
export const multiplyByNumber = (
  amount: MonetaryAmount,
  multiplier: number
): MonetaryAmount => {
  return multiply(amount, BigDecimal.unsafeFromNumber(multiplier))
}

/**
 * Divide a monetary amount by a scalar (BigDecimal).
 * Returns an Effect that fails with DivisionByZeroError if divisor is zero.
 */
export const divide = (
  amount: MonetaryAmount,
  divisor: BigDecimal.BigDecimal
): Effect.Effect<MonetaryAmount, DivisionByZeroError> => {
  const result = BigDecimal.divide(amount.amount, divisor)
  return Option.match(result, {
    onNone: () => Effect.fail(new DivisionByZeroError()),
    onSome: (bd) => Effect.succeed(MonetaryAmount.fromBigDecimal(bd, amount.currency))
  })
}

/**
 * Divide a monetary amount by a number.
 * Returns an Effect that fails with DivisionByZeroError if divisor is zero.
 */
export const divideByNumber = (
  amount: MonetaryAmount,
  divisor: number
): Effect.Effect<MonetaryAmount, DivisionByZeroError> => {
  if (divisor === 0) {
    return Effect.fail(new DivisionByZeroError())
  }
  return divide(amount, BigDecimal.unsafeFromNumber(divisor))
}

/**
 * Unsafe divide that throws on division by zero.
 */
export const unsafeDivide = (
  amount: MonetaryAmount,
  divisor: BigDecimal.BigDecimal
): MonetaryAmount => {
  return MonetaryAmount.fromBigDecimal(
    BigDecimal.unsafeDivide(amount.amount, divisor),
    amount.currency
  )
}

// =============================================================================
// Comparison Operations
// =============================================================================

/**
 * Compare two monetary amounts.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export const compare = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<-1 | 0 | 1, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(BigDecimal.Order(a.amount, b.amount))
}

/**
 * Check if first amount is greater than second.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const greaterThan = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<boolean, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(BigDecimal.greaterThan(a.amount, b.amount))
}

/**
 * Check if first amount is less than second.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const lessThan = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<boolean, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(BigDecimal.lessThan(a.amount, b.amount))
}

/**
 * Check if first amount is greater than or equal to second.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const greaterThanOrEqualTo = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<boolean, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(BigDecimal.greaterThanOrEqualTo(a.amount, b.amount))
}

/**
 * Check if first amount is less than or equal to second.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const lessThanOrEqualTo = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<boolean, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(BigDecimal.lessThanOrEqualTo(a.amount, b.amount))
}

/**
 * Check if two monetary amounts are equal.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const equals = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<boolean, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(BigDecimal.equals(a.amount, b.amount))
}

// =============================================================================
// Utility Operations
// =============================================================================

/**
 * Sum an array of monetary amounts.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 * Returns zero for the given currency if the array is empty.
 */
export const sum = (
  amounts: ReadonlyArray<MonetaryAmount>,
  currency: CurrencyCode
): Effect.Effect<MonetaryAmount, CurrencyMismatchError> => {
  return Effect.gen(function* () {
    let total = MonetaryAmount.zero(currency)
    for (const amount of amounts) {
      total = yield* add(total, amount)
    }
    return total
  })
}

/**
 * Round a monetary amount to the specified number of decimal places.
 * Default is 2 decimal places (cents).
 */
export const round = (
  amount: MonetaryAmount,
  scale: number = 2
): MonetaryAmount => {
  return MonetaryAmount.fromBigDecimal(
    BigDecimal.round(amount.amount, { scale, mode: "half-from-zero" }),
    amount.currency
  )
}

/**
 * Get the maximum of two monetary amounts.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const max = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<MonetaryAmount, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(
    MonetaryAmount.fromBigDecimal(BigDecimal.max(a.amount, b.amount), a.currency)
  )
}

/**
 * Get the minimum of two monetary amounts.
 * Returns an Effect that fails with CurrencyMismatchError if currencies differ.
 */
export const min = (
  a: MonetaryAmount,
  b: MonetaryAmount
): Effect.Effect<MonetaryAmount, CurrencyMismatchError> => {
  if (a.currency !== b.currency) {
    return Effect.fail(new CurrencyMismatchError({ expected: a.currency, actual: b.currency }))
  }
  return Effect.succeed(
    MonetaryAmount.fromBigDecimal(BigDecimal.min(a.amount, b.amount), a.currency)
  )
}
