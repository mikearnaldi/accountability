/**
 * AccountBalance - Pure functions for calculating account balances
 *
 * Provides functions to calculate account balances from posted journal entries.
 * Uses BigDecimal for all calculations to ensure precision.
 *
 * Per specs/ACCOUNTING_RESEARCH.md Phase 3.1:
 * - Account balance calculation
 * - Period-to-date balances
 * - Year-to-date balances
 * - Beginning balances
 *
 * Balance Calculation Rules:
 * - For accounts with normal debit balance (Assets, Expenses):
 *   Balance = Sum of Debits - Sum of Credits
 * - For accounts with normal credit balance (Liabilities, Equity, Revenue):
 *   Balance = Sum of Credits - Sum of Debits
 *
 * This module ensures consistent handling of debit/credit normal balances
 * across all balance calculation functions.
 *
 * @module AccountBalance
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import type { AccountId, NormalBalance } from "./Account.ts"
import type { CurrencyCode } from "../currency/CurrencyCode.ts"
import type { JournalEntry } from "../journal/JournalEntry.ts"
import type { JournalEntryLine } from "../journal/JournalEntryLine.ts"
import type { LocalDate} from "../shared/values/LocalDate.ts";
import { isBefore, isAfter, equals as dateEquals } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"

/**
 * Input data for balance calculations.
 * Contains both journal entry header and its lines.
 */
export interface JournalEntryWithLines {
  readonly entry: JournalEntry
  readonly lines: ReadonlyArray<JournalEntryLine>
}

/**
 * Filter journal entry lines for a specific account.
 *
 * @param lines - Array of journal entry lines
 * @param accountId - The account ID to filter by
 * @returns Lines that belong to the specified account
 */
const filterByAccount = (
  lines: ReadonlyArray<JournalEntryLine>,
  accountId: AccountId
): ReadonlyArray<JournalEntryLine> =>
  ReadonlyArray.filter(lines, (line) => line.accountId === accountId)

/**
 * Filter entries by posted status and posting date criteria.
 *
 * Only posted entries affect account balances. We use the posting date
 * for filtering because that's when the entry officially affects the GL.
 *
 * @param entries - Array of journal entries with lines
 * @param datePredicate - Function to test if the posting date meets criteria
 * @returns Filtered entries that are posted and meet date criteria
 */
const filterPostedEntries = (
  entries: ReadonlyArray<JournalEntryWithLines>,
  datePredicate: (postingDate: LocalDate) => boolean
): ReadonlyArray<JournalEntryWithLines> =>
  ReadonlyArray.filter(entries, (e) => {
    if (!e.entry.isPosted) {
      return false
    }
    return Option.match(e.entry.postingDate, {
      onNone: () => false,
      onSome: datePredicate
    })
  })

/**
 * Sum debits for a specific account from journal entry lines.
 *
 * @param lines - Journal entry lines (already filtered for account)
 * @param currency - The functional currency for the result
 * @returns Sum of debit amounts in functional currency
 */
const sumAccountDebits = (
  lines: ReadonlyArray<JournalEntryLine>,
  _currency: CurrencyCode
): BigDecimal.BigDecimal =>
  ReadonlyArray.reduce(lines, BigDecimal.fromBigInt(0n), (total, line) =>
    Option.match(line.functionalCurrencyDebitAmount, {
      onNone: () => total,
      onSome: (amount) => BigDecimal.sum(total, amount.amount)
    })
  )

/**
 * Sum credits for a specific account from journal entry lines.
 *
 * @param lines - Journal entry lines (already filtered for account)
 * @param currency - The functional currency for the result
 * @returns Sum of credit amounts in functional currency
 */
const sumAccountCredits = (
  lines: ReadonlyArray<JournalEntryLine>,
  _currency: CurrencyCode
): BigDecimal.BigDecimal =>
  ReadonlyArray.reduce(lines, BigDecimal.fromBigInt(0n), (total, line) =>
    Option.match(line.functionalCurrencyCreditAmount, {
      onNone: () => total,
      onSome: (amount) => BigDecimal.sum(total, amount.amount)
    })
  )

/**
 * Calculate raw balance (debits - credits or credits - debits) based on normal balance.
 *
 * For normal debit accounts: balance = debits - credits
 * For normal credit accounts: balance = credits - debits
 *
 * @param debits - Total debit amount
 * @param credits - Total credit amount
 * @param normalBalance - The account's normal balance direction
 * @returns The calculated balance
 */
const computeBalance = (
  debits: BigDecimal.BigDecimal,
  credits: BigDecimal.BigDecimal,
  normalBalance: NormalBalance
): BigDecimal.BigDecimal => {
  if (normalBalance === "Debit") {
    // Assets and Expenses: debits increase, credits decrease
    return BigDecimal.subtract(debits, credits)
  } else {
    // Liabilities, Equity, Revenue: credits increase, debits decrease
    return BigDecimal.subtract(credits, debits)
  }
}

/**
 * Calculate account balance as of a specific date.
 *
 * Returns the cumulative balance from all posted journal entries
 * with a posting date on or before the specified date.
 *
 * @param accountId - The account to calculate balance for
 * @param normalBalance - The account's normal balance direction (Debit or Credit)
 * @param entries - All journal entries with their lines
 * @param asOfDate - Calculate balance as of this date (inclusive)
 * @param functionalCurrency - The functional currency for calculations
 * @returns The account balance as a MonetaryAmount
 */
export const calculateBalance = (
  accountId: AccountId,
  normalBalance: NormalBalance,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  // Filter to posted entries on or before asOfDate
  const filteredEntries = filterPostedEntries(entries, (postingDate) =>
    isBefore(postingDate, asOfDate) || dateEquals(postingDate, asOfDate)
  )

  // Collect all lines for the account
  const accountLines = ReadonlyArray.flatMap(filteredEntries, (e) =>
    filterByAccount(e.lines, accountId)
  )

  // Sum debits and credits
  const totalDebits = sumAccountDebits(accountLines, functionalCurrency)
  const totalCredits = sumAccountCredits(accountLines, functionalCurrency)

  // Calculate balance based on normal balance direction
  const balance = computeBalance(totalDebits, totalCredits, normalBalance)

  return MonetaryAmount.fromBigDecimal(balance, functionalCurrency)
}

/**
 * Calculate account balance for a specific date range (period).
 *
 * Returns the net change in balance during the period, from entries
 * with posting dates within the range [periodStart, periodEnd] inclusive.
 *
 * @param accountId - The account to calculate balance for
 * @param normalBalance - The account's normal balance direction (Debit or Credit)
 * @param entries - All journal entries with their lines
 * @param periodStart - Start of the period (inclusive)
 * @param periodEnd - End of the period (inclusive)
 * @param functionalCurrency - The functional currency for calculations
 * @returns The account balance for the period as a MonetaryAmount
 */
export const calculatePeriodBalance = (
  accountId: AccountId,
  normalBalance: NormalBalance,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  // Filter to posted entries within the period
  const filteredEntries = filterPostedEntries(entries, (postingDate) => {
    const onOrAfterStart = isAfter(postingDate, periodStart) || dateEquals(postingDate, periodStart)
    const onOrBeforeEnd = isBefore(postingDate, periodEnd) || dateEquals(postingDate, periodEnd)
    return onOrAfterStart && onOrBeforeEnd
  })

  // Collect all lines for the account
  const accountLines = ReadonlyArray.flatMap(filteredEntries, (e) =>
    filterByAccount(e.lines, accountId)
  )

  // Sum debits and credits
  const totalDebits = sumAccountDebits(accountLines, functionalCurrency)
  const totalCredits = sumAccountCredits(accountLines, functionalCurrency)

  // Calculate balance based on normal balance direction
  const balance = computeBalance(totalDebits, totalCredits, normalBalance)

  return MonetaryAmount.fromBigDecimal(balance, functionalCurrency)
}

/**
 * Calculate year-to-date (YTD) balance for an account.
 *
 * Returns the cumulative balance from the fiscal year start date up to
 * and including the asOfDate.
 *
 * @param accountId - The account to calculate balance for
 * @param normalBalance - The account's normal balance direction (Debit or Credit)
 * @param entries - All journal entries with their lines
 * @param fiscalYearStart - Start of the fiscal year
 * @param asOfDate - Calculate YTD balance up to this date (inclusive)
 * @param functionalCurrency - The functional currency for calculations
 * @returns The YTD account balance as a MonetaryAmount
 */
export const calculateYTDBalance = (
  accountId: AccountId,
  normalBalance: NormalBalance,
  entries: ReadonlyArray<JournalEntryWithLines>,
  fiscalYearStart: LocalDate,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  // YTD balance is the period balance from fiscal year start to asOfDate
  return calculatePeriodBalance(
    accountId,
    normalBalance,
    entries,
    fiscalYearStart,
    asOfDate,
    functionalCurrency
  )
}

/**
 * Calculate beginning balance for an account as of a period start.
 *
 * Returns the cumulative balance from all posted entries with posting
 * dates strictly before the periodStart date. This represents the
 * balance carried forward into the period.
 *
 * @param accountId - The account to calculate balance for
 * @param normalBalance - The account's normal balance direction (Debit or Credit)
 * @param entries - All journal entries with their lines
 * @param periodStart - The start of the period (balance is calculated before this date)
 * @param functionalCurrency - The functional currency for calculations
 * @returns The beginning balance as a MonetaryAmount
 */
export const calculateBeginningBalance = (
  accountId: AccountId,
  normalBalance: NormalBalance,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  // Filter to posted entries strictly before periodStart
  const filteredEntries = filterPostedEntries(entries, (postingDate) =>
    isBefore(postingDate, periodStart)
  )

  // Collect all lines for the account
  const accountLines = ReadonlyArray.flatMap(filteredEntries, (e) =>
    filterByAccount(e.lines, accountId)
  )

  // Sum debits and credits
  const totalDebits = sumAccountDebits(accountLines, functionalCurrency)
  const totalCredits = sumAccountCredits(accountLines, functionalCurrency)

  // Calculate balance based on normal balance direction
  const balance = computeBalance(totalDebits, totalCredits, normalBalance)

  return MonetaryAmount.fromBigDecimal(balance, functionalCurrency)
}

/**
 * Helper function to calculate debit and credit totals separately.
 *
 * Useful for trial balance reports that show separate debit/credit columns.
 *
 * @param accountId - The account to calculate totals for
 * @param entries - All journal entries with their lines
 * @param asOfDate - Calculate totals as of this date (inclusive)
 * @param functionalCurrency - The functional currency for calculations
 * @returns Object with totalDebits and totalCredits as MonetaryAmounts
 */
export const calculateDebitCreditTotals = (
  accountId: AccountId,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode
): { totalDebits: MonetaryAmount; totalCredits: MonetaryAmount } => {
  // Filter to posted entries on or before asOfDate
  const filteredEntries = filterPostedEntries(entries, (postingDate) =>
    isBefore(postingDate, asOfDate) || dateEquals(postingDate, asOfDate)
  )

  // Collect all lines for the account
  const accountLines = ReadonlyArray.flatMap(filteredEntries, (e) =>
    filterByAccount(e.lines, accountId)
  )

  // Sum debits and credits
  const totalDebits = sumAccountDebits(accountLines, functionalCurrency)
  const totalCredits = sumAccountCredits(accountLines, functionalCurrency)

  return {
    totalDebits: MonetaryAmount.fromBigDecimal(totalDebits, functionalCurrency),
    totalCredits: MonetaryAmount.fromBigDecimal(totalCredits, functionalCurrency)
  }
}

/**
 * Calculate period debit and credit totals separately.
 *
 * Useful for trial balance reports showing activity during a period.
 *
 * @param accountId - The account to calculate totals for
 * @param entries - All journal entries with their lines
 * @param periodStart - Start of the period (inclusive)
 * @param periodEnd - End of the period (inclusive)
 * @param functionalCurrency - The functional currency for calculations
 * @returns Object with totalDebits and totalCredits as MonetaryAmounts
 */
export const calculatePeriodDebitCreditTotals = (
  accountId: AccountId,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): { totalDebits: MonetaryAmount; totalCredits: MonetaryAmount } => {
  // Filter to posted entries within the period
  const filteredEntries = filterPostedEntries(entries, (postingDate) => {
    const onOrAfterStart = isAfter(postingDate, periodStart) || dateEquals(postingDate, periodStart)
    const onOrBeforeEnd = isBefore(postingDate, periodEnd) || dateEquals(postingDate, periodEnd)
    return onOrAfterStart && onOrBeforeEnd
  })

  // Collect all lines for the account
  const accountLines = ReadonlyArray.flatMap(filteredEntries, (e) =>
    filterByAccount(e.lines, accountId)
  )

  // Sum debits and credits
  const totalDebits = sumAccountDebits(accountLines, functionalCurrency)
  const totalCredits = sumAccountCredits(accountLines, functionalCurrency)

  return {
    totalDebits: MonetaryAmount.fromBigDecimal(totalDebits, functionalCurrency),
    totalCredits: MonetaryAmount.fromBigDecimal(totalCredits, functionalCurrency)
  }
}
