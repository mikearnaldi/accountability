/**
 * AccountNumber - Account number value object
 *
 * A branded type representing a valid account number (4-digit numeric string).
 * Uses Schema.brand for compile-time type safety and includes helpers to
 * determine the AccountType from the number range.
 *
 * Account Numbering Convention:
 * - 1000-1999: Assets
 * - 2000-2999: Liabilities
 * - 3000-3999: Equity
 * - 4000-4999: Revenue
 * - 5000-7999: Expenses
 * - 8000-8999: Other Income/Expense
 * - 9000-9999: Special (Intercompany, Eliminations)
 *
 * @module accounting/AccountNumber
 */

import * as Schema from "effect/Schema"
import * as Option from "effect/Option"

/**
 * AccountType - The five main account classifications per US GAAP
 */
export const AccountType = Schema.Literal(
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense"
)

export type AccountType = typeof AccountType.Type

/**
 * Extended AccountCategory - More granular classification for account ranges
 * Includes special categories like "Other" and "Special" for non-standard accounts
 */
export const AccountCategory = Schema.Literal(
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense",
  "Other",
  "Special"
)

export type AccountCategory = typeof AccountCategory.Type

/**
 * Schema for a valid account number.
 * Must be exactly 4 numeric digits (1000-9999).
 */
export const AccountNumber = Schema.String.pipe(
  Schema.pattern(/^[1-9]\d{3}$/),
  Schema.brand("AccountNumber"),
  Schema.annotations({
    identifier: "AccountNumber",
    title: "Account Number",
    description: "A 4-digit account number (1000-9999)"
  })
)

/**
 * The branded AccountNumber type
 */
export type AccountNumber = typeof AccountNumber.Type

/**
 * Type guard for AccountNumber using Schema.is
 */
export const isAccountNumber = Schema.is(AccountNumber)

/**
 * Type guard for AccountType using Schema.is
 */
export const isAccountType = Schema.is(AccountType)

/**
 * Type guard for AccountCategory using Schema.is
 */
export const isAccountCategory = Schema.is(AccountCategory)

/**
 * Get the leading digit of an account number
 */
const getLeadingDigit = (accountNumber: AccountNumber): number => {
  return parseInt(accountNumber.charAt(0), 10)
}

/**
 * Get the numeric value of an account number
 */
const getNumericValue = (accountNumber: AccountNumber): number => {
  return parseInt(accountNumber, 10)
}

/**
 * Determine the AccountType from an account number based on its range.
 *
 * Ranges:
 * - 1xxx (1000-1999): Asset
 * - 2xxx (2000-2999): Liability
 * - 3xxx (3000-3999): Equity
 * - 4xxx (4000-4999): Revenue
 * - 5xxx-7xxx (5000-7999): Expense
 *
 * Returns None for account numbers outside these ranges (8xxx, 9xxx).
 */
export const getAccountType = (accountNumber: AccountNumber): Option.Option<AccountType> => {
  const leadingDigit = getLeadingDigit(accountNumber)

  switch (leadingDigit) {
    case 1:
      return Option.some<AccountType>("Asset")
    case 2:
      return Option.some<AccountType>("Liability")
    case 3:
      return Option.some<AccountType>("Equity")
    case 4:
      return Option.some<AccountType>("Revenue")
    case 5:
    case 6:
    case 7:
      return Option.some<AccountType>("Expense")
    default:
      return Option.none<AccountType>()
  }
}

/**
 * Determine the AccountCategory from an account number based on its range.
 *
 * This provides more granular classification including:
 * - 1xxx: Asset
 * - 2xxx: Liability
 * - 3xxx: Equity
 * - 4xxx: Revenue
 * - 5xxx-7xxx: Expense
 * - 8xxx: Other (Other Income/Expense)
 * - 9xxx: Special (Intercompany, Eliminations)
 */
export const getAccountCategory = (accountNumber: AccountNumber): AccountCategory => {
  const leadingDigit = getLeadingDigit(accountNumber)

  switch (leadingDigit) {
    case 1:
      return "Asset"
    case 2:
      return "Liability"
    case 3:
      return "Equity"
    case 4:
      return "Revenue"
    case 5:
    case 6:
    case 7:
      return "Expense"
    case 8:
      return "Other"
    case 9:
      return "Special"
    default:
      // This should never happen due to validation (1000-9999)
      return "Special"
  }
}

/**
 * Check if an account number is in the Asset range (1000-1999)
 */
export const isAssetAccount = (accountNumber: AccountNumber): boolean => {
  return getLeadingDigit(accountNumber) === 1
}

/**
 * Check if an account number is in the Liability range (2000-2999)
 */
export const isLiabilityAccount = (accountNumber: AccountNumber): boolean => {
  return getLeadingDigit(accountNumber) === 2
}

/**
 * Check if an account number is in the Equity range (3000-3999)
 */
export const isEquityAccount = (accountNumber: AccountNumber): boolean => {
  return getLeadingDigit(accountNumber) === 3
}

/**
 * Check if an account number is in the Revenue range (4000-4999)
 */
export const isRevenueAccount = (accountNumber: AccountNumber): boolean => {
  return getLeadingDigit(accountNumber) === 4
}

/**
 * Check if an account number is in the Expense range (5000-7999)
 */
export const isExpenseAccount = (accountNumber: AccountNumber): boolean => {
  const leadingDigit = getLeadingDigit(accountNumber)
  return leadingDigit >= 5 && leadingDigit <= 7
}

/**
 * Check if an account number is in the Other Income/Expense range (8000-8999)
 */
export const isOtherAccount = (accountNumber: AccountNumber): boolean => {
  return getLeadingDigit(accountNumber) === 8
}

/**
 * Check if an account number is in the Special range (9000-9999)
 * Used for intercompany accounts and eliminations
 */
export const isSpecialAccount = (accountNumber: AccountNumber): boolean => {
  return getLeadingDigit(accountNumber) === 9
}

/**
 * Check if an account number is a balance sheet account (Asset, Liability, or Equity)
 */
export const isBalanceSheetAccount = (accountNumber: AccountNumber): boolean => {
  const leadingDigit = getLeadingDigit(accountNumber)
  return leadingDigit >= 1 && leadingDigit <= 3
}

/**
 * Check if an account number is an income statement account (Revenue or Expense)
 */
export const isIncomeStatementAccount = (accountNumber: AccountNumber): boolean => {
  const leadingDigit = getLeadingDigit(accountNumber)
  return leadingDigit >= 4 && leadingDigit <= 7
}

/**
 * Check if an account has a normal debit balance.
 * Assets and Expenses have normal debit balances.
 */
export const hasNormalDebitBalance = (accountNumber: AccountNumber): boolean => {
  const leadingDigit = getLeadingDigit(accountNumber)
  // Assets (1xxx) and Expenses (5xxx-7xxx) have normal debit balance
  return leadingDigit === 1 || (leadingDigit >= 5 && leadingDigit <= 7)
}

/**
 * Check if an account has a normal credit balance.
 * Liabilities, Equity, and Revenue have normal credit balances.
 */
export const hasNormalCreditBalance = (accountNumber: AccountNumber): boolean => {
  const leadingDigit = getLeadingDigit(accountNumber)
  // Liabilities (2xxx), Equity (3xxx), and Revenue (4xxx) have normal credit balance
  return leadingDigit >= 2 && leadingDigit <= 4
}

/**
 * Get the subcategory based on detailed account ranges per specs/ACCOUNTING_RESEARCH.md
 *
 * - 1000-1499: Current Assets
 * - 1500-1999: Non-Current Assets
 * - 2000-2499: Current Liabilities
 * - 2500-2999: Non-Current Liabilities
 * - 3000-3999: Shareholders' Equity
 * - 4000-4999: Operating Revenue
 * - 5000-5999: Cost of Sales / Direct Costs
 * - 6000-7999: Operating Expenses
 * - 8000-8999: Other Income/Expense (Non-Operating)
 * - 9000-9999: Special (Intercompany, Eliminations)
 */
export const getSubcategory = (accountNumber: AccountNumber): string => {
  const numValue = getNumericValue(accountNumber)

  if (numValue >= 1000 && numValue <= 1499) return "Current Assets"
  if (numValue >= 1500 && numValue <= 1999) return "Non-Current Assets"
  if (numValue >= 2000 && numValue <= 2499) return "Current Liabilities"
  if (numValue >= 2500 && numValue <= 2999) return "Non-Current Liabilities"
  if (numValue >= 3000 && numValue <= 3999) return "Shareholders' Equity"
  if (numValue >= 4000 && numValue <= 4999) return "Operating Revenue"
  if (numValue >= 5000 && numValue <= 5999) return "Cost of Sales"
  if (numValue >= 6000 && numValue <= 7999) return "Operating Expenses"
  if (numValue >= 8000 && numValue <= 8999) return "Other Income/Expense"
  if (numValue >= 9000 && numValue <= 9999) return "Special"

  // This should never happen due to validation
  return "Unknown"
}
