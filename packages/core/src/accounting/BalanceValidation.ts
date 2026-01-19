/**
 * BalanceValidation - Journal entry balance validation functions
 *
 * Implements the fundamental double-entry bookkeeping rule that total debits
 * must equal total credits for every journal entry. Uses BigDecimal for
 * precise monetary calculations.
 *
 * Per specs/ACCOUNTING_RESEARCH.md:
 * - Balance Check: Sum of all debit amounts must exactly equal sum of all credit amounts
 * - Multi-currency support: Compare in functional currency
 *
 * @module BalanceValidation
 */

import { HttpApiSchema } from "@effect/platform"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import * as Schema from "effect/Schema"
import type { CurrencyCode } from "../currency/CurrencyCode.ts"
import type { JournalEntryLine } from "../journal/JournalEntryLine.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"

/**
 * UnbalancedEntryError - Error when journal entry debits do not equal credits
 *
 * Contains the total debits and credits for debugging purposes.
 */
export class UnbalancedEntryError extends Schema.TaggedError<UnbalancedEntryError>()(
  "UnbalancedEntryError",
  {
    totalDebits: MonetaryAmount,
    totalCredits: MonetaryAmount,
    difference: MonetaryAmount
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Journal entry is unbalanced: debits ${this.totalDebits.toString()} != credits ${this.totalCredits.toString()} (difference: ${this.difference.toString()})`
  }
}

/**
 * Type guard for UnbalancedEntryError using Schema.is
 */
export const isUnbalancedEntryError = Schema.is(UnbalancedEntryError)

/**
 * Sum all debit amounts from journal entry lines in functional currency.
 *
 * For multi-currency entries, this sums the functional currency debit amounts
 * which have already been converted using the appropriate exchange rates.
 *
 * @param lines - Array of journal entry lines
 * @param functionalCurrency - The functional currency to use for summing
 * @returns The total debit amount in functional currency
 */
export const sumDebits = (
  lines: ReadonlyArray<JournalEntryLine>,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  return ReadonlyArray.reduce(
    lines,
    MonetaryAmount.zero(functionalCurrency),
    (total, line) => {
      const debit = Option.match(line.functionalCurrencyDebitAmount, {
        onNone: () => BigDecimal.fromBigInt(0n),
        onSome: (amount) => amount.amount
      })
      return MonetaryAmount.fromBigDecimal(
        BigDecimal.sum(total.amount, debit),
        functionalCurrency
      )
    }
  )
}

/**
 * Sum all credit amounts from journal entry lines in functional currency.
 *
 * For multi-currency entries, this sums the functional currency credit amounts
 * which have already been converted using the appropriate exchange rates.
 *
 * @param lines - Array of journal entry lines
 * @param functionalCurrency - The functional currency to use for summing
 * @returns The total credit amount in functional currency
 */
export const sumCredits = (
  lines: ReadonlyArray<JournalEntryLine>,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  return ReadonlyArray.reduce(
    lines,
    MonetaryAmount.zero(functionalCurrency),
    (total, line) => {
      const credit = Option.match(line.functionalCurrencyCreditAmount, {
        onNone: () => BigDecimal.fromBigInt(0n),
        onSome: (amount) => amount.amount
      })
      return MonetaryAmount.fromBigDecimal(
        BigDecimal.sum(total.amount, credit),
        functionalCurrency
      )
    }
  )
}

/**
 * Validate that a journal entry's lines are balanced (debits = credits).
 *
 * Per specs/ACCOUNTING_RESEARCH.md, this implements the fundamental rule of double-entry
 * bookkeeping: "Total Debits must equal Total Credits for every journal entry"
 *
 * For multi-currency entries, comparison is done in functional currency.
 *
 * @param lines - Array of journal entry lines to validate
 * @param functionalCurrency - The functional currency for comparison
 * @returns Effect<void, UnbalancedEntryError> - succeeds if balanced, fails with UnbalancedEntryError if not
 */
export const validateBalance = (
  lines: ReadonlyArray<JournalEntryLine>,
  functionalCurrency: CurrencyCode
): Effect.Effect<void, UnbalancedEntryError> => {
  const totalDebits = sumDebits(lines, functionalCurrency)
  const totalCredits = sumCredits(lines, functionalCurrency)

  if (BigDecimal.equals(totalDebits.amount, totalCredits.amount)) {
    return Effect.void
  }

  const difference = MonetaryAmount.fromBigDecimal(
    BigDecimal.abs(BigDecimal.subtract(totalDebits.amount, totalCredits.amount)),
    functionalCurrency
  )

  return Effect.fail(
    new UnbalancedEntryError({
      totalDebits,
      totalCredits,
      difference
    })
  )
}

/**
 * Check if journal entry lines are balanced without returning an error.
 *
 * @param lines - Array of journal entry lines to check
 * @param functionalCurrency - The functional currency for comparison
 * @returns true if balanced, false otherwise
 */
export const isBalanced = (
  lines: ReadonlyArray<JournalEntryLine>,
  functionalCurrency: CurrencyCode
): boolean => {
  const totalDebits = sumDebits(lines, functionalCurrency)
  const totalCredits = sumCredits(lines, functionalCurrency)
  return BigDecimal.equals(totalDebits.amount, totalCredits.amount)
}

/**
 * Calculate the difference between debits and credits.
 *
 * A positive result means debits > credits.
 * A negative result means credits > debits.
 * Zero means the entry is balanced.
 *
 * @param lines - Array of journal entry lines
 * @param functionalCurrency - The functional currency for calculation
 * @returns The difference (debits - credits) as a MonetaryAmount
 */
export const calculateDifference = (
  lines: ReadonlyArray<JournalEntryLine>,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  const totalDebits = sumDebits(lines, functionalCurrency)
  const totalCredits = sumCredits(lines, functionalCurrency)
  return MonetaryAmount.fromBigDecimal(
    BigDecimal.subtract(totalDebits.amount, totalCredits.amount),
    functionalCurrency
  )
}
