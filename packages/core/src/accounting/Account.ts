/**
 * Account - Chart of Accounts entity
 *
 * Represents an account in the Chart of Accounts with full classification
 * including type, category, normal balance, hierarchy, and behavior properties.
 *
 * Account Numbering Convention per specs/ACCOUNTING_RESEARCH.md:
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
 *
 * @module accounting/Account
 */

import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { AccountNumber } from "./AccountNumber.ts"
import { CompanyId } from "../company/Company.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

// Re-export AccountId from separate module to break circular dependency
export { AccountId, isAccountId, type AccountId as AccountIdType } from "./AccountId.ts"
import { AccountId } from "./AccountId.ts"

/**
 * AccountType - The five main account classifications per US GAAP
 *
 * - Asset: Resources owned by the entity
 * - Liability: Obligations owed by the entity
 * - Equity: Residual interest in assets after deducting liabilities
 * - Revenue: Income from primary business activities
 * - Expense: Costs incurred to generate revenue
 */
export const AccountType = Schema.Literal(
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense"
).annotations({
  identifier: "AccountType",
  title: "Account Type",
  description: "The main account classification per US GAAP"
})

/**
 * The AccountType type
 */
export type AccountType = typeof AccountType.Type

/**
 * Type guard for AccountType using Schema.is
 */
export const isAccountType = Schema.is(AccountType)

/**
 * AccountCategory - Detailed subcategory within each AccountType
 *
 * Per specs/ACCOUNTING_RESEARCH.md, Account Categories by Type:
 *
 * Assets: CurrentAsset, NonCurrentAsset, FixedAsset, IntangibleAsset
 * Liabilities: CurrentLiability, NonCurrentLiability
 * Equity: ContributedCapital, RetainedEarnings, OtherComprehensiveIncome, TreasuryStock
 * Revenue: OperatingRevenue, OtherRevenue
 * Expenses: CostOfGoodsSold, OperatingExpense, DepreciationAmortization, InterestExpense, TaxExpense, OtherExpense
 */
export const AccountCategory = Schema.Literal(
  // Asset categories
  "CurrentAsset",
  "NonCurrentAsset",
  "FixedAsset",
  "IntangibleAsset",
  // Liability categories
  "CurrentLiability",
  "NonCurrentLiability",
  // Equity categories
  "ContributedCapital",
  "RetainedEarnings",
  "OtherComprehensiveIncome",
  "TreasuryStock",
  // Revenue categories
  "OperatingRevenue",
  "OtherRevenue",
  // Expense categories
  "CostOfGoodsSold",
  "OperatingExpense",
  "DepreciationAmortization",
  "InterestExpense",
  "TaxExpense",
  "OtherExpense"
).annotations({
  identifier: "AccountCategory",
  title: "Account Category",
  description: "Detailed subcategory within each account type"
})

/**
 * The AccountCategory type
 */
export type AccountCategory = typeof AccountCategory.Type

/**
 * Type guard for AccountCategory using Schema.is
 */
export const isAccountCategory = Schema.is(AccountCategory)

/**
 * NormalBalance - The expected balance direction for an account
 *
 * Per double-entry bookkeeping:
 * - Debit: Assets and Expenses have normal debit balances
 * - Credit: Liabilities, Equity, and Revenue have normal credit balances
 */
export const NormalBalance = Schema.Literal(
  "Debit",
  "Credit"
).annotations({
  identifier: "NormalBalance",
  title: "Normal Balance",
  description: "The expected balance direction for the account (Debit or Credit)"
})

/**
 * The NormalBalance type
 */
export type NormalBalance = typeof NormalBalance.Type

/**
 * Type guard for NormalBalance using Schema.is
 */
export const isNormalBalance = Schema.is(NormalBalance)

/**
 * CashFlowCategory - Classification for cash flow statement
 *
 * Per ASC 230 - Statement of Cash Flows:
 * - Operating: Cash flows from principal revenue-producing activities
 * - Investing: Cash flows from acquiring/disposing of long-term assets
 * - Financing: Cash flows from debt, equity, and dividend transactions
 * - NonCash: Significant non-cash investing/financing activities (disclosed separately)
 */
export const CashFlowCategory = Schema.Literal(
  "Operating",
  "Investing",
  "Financing",
  "NonCash"
).annotations({
  identifier: "CashFlowCategory",
  title: "Cash Flow Category",
  description: "Classification for cash flow statement per ASC 230"
})

/**
 * The CashFlowCategory type
 */
export type CashFlowCategory = typeof CashFlowCategory.Type

/**
 * Type guard for CashFlowCategory using Schema.is
 */
export const isCashFlowCategory = Schema.is(CashFlowCategory)

/**
 * Helper to get the AccountType that corresponds to an AccountCategory
 */
export const getAccountTypeForCategory = (category: AccountCategory): AccountType => {
  switch (category) {
    case "CurrentAsset":
    case "NonCurrentAsset":
    case "FixedAsset":
    case "IntangibleAsset":
      return "Asset"
    case "CurrentLiability":
    case "NonCurrentLiability":
      return "Liability"
    case "ContributedCapital":
    case "RetainedEarnings":
    case "OtherComprehensiveIncome":
    case "TreasuryStock":
      return "Equity"
    case "OperatingRevenue":
    case "OtherRevenue":
      return "Revenue"
    case "CostOfGoodsSold":
    case "OperatingExpense":
    case "DepreciationAmortization":
    case "InterestExpense":
    case "TaxExpense":
    case "OtherExpense":
      return "Expense"
  }
}

/**
 * Get valid AccountCategories for a given AccountType
 */
export const getCategoriesForType = (type: AccountType): ReadonlyArray<AccountCategory> => {
  switch (type) {
    case "Asset":
      return ["CurrentAsset", "NonCurrentAsset", "FixedAsset", "IntangibleAsset"]
    case "Liability":
      return ["CurrentLiability", "NonCurrentLiability"]
    case "Equity":
      return ["ContributedCapital", "RetainedEarnings", "OtherComprehensiveIncome", "TreasuryStock"]
    case "Revenue":
      return ["OperatingRevenue", "OtherRevenue"]
    case "Expense":
      return ["CostOfGoodsSold", "OperatingExpense", "DepreciationAmortization", "InterestExpense", "TaxExpense", "OtherExpense"]
  }
}

/**
 * Get the expected NormalBalance for a given AccountType
 *
 * Per double-entry bookkeeping rules:
 * - Assets: Debit balance (debits increase, credits decrease)
 * - Expenses: Debit balance (debits increase, credits decrease)
 * - Liabilities: Credit balance (credits increase, debits decrease)
 * - Equity: Credit balance (credits increase, debits decrease)
 * - Revenue: Credit balance (credits increase, debits decrease)
 */
export const getNormalBalanceForType = (type: AccountType): NormalBalance => {
  switch (type) {
    case "Asset":
    case "Expense":
      return "Debit"
    case "Liability":
    case "Equity":
    case "Revenue":
      return "Credit"
  }
}

/**
 * Account - Chart of Accounts entity
 *
 * Represents an account in the Chart of Accounts with full classification,
 * hierarchy, behavior properties, and intercompany settings.
 */
export class Account extends Schema.Class<Account>("Account")({
  /**
   * Unique identifier for the account
   */
  id: AccountId,

  /**
   * Reference to the company that owns this account
   */
  companyId: CompanyId,

  /**
   * Account number following numbering convention (e.g., "1000")
   */
  accountNumber: AccountNumber,

  /**
   * Display name of the account
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Account Name",
    description: "The display name of the account"
  }),

  /**
   * Optional detailed description of the account
   */
  description: Schema.OptionFromNullOr(Schema.String).annotations({
    title: "Description",
    description: "Optional detailed description of the account's purpose"
  }),

  /**
   * Account type classification per US GAAP
   */
  accountType: AccountType,

  /**
   * Detailed subcategory within the account type
   */
  accountCategory: AccountCategory,

  /**
   * The expected balance direction (Debit or Credit)
   */
  normalBalance: NormalBalance,

  /**
   * Parent account reference for hierarchy (null if top-level)
   * Allows for sub-accounts and roll-up reporting
   */
  parentAccountId: Schema.OptionFromNullOr(AccountId).annotations({
    title: "Parent Account ID",
    description: "Reference to parent account for hierarchy (null if top-level)"
  }),

  /**
   * Hierarchy level (1 = top level, 2 = first sub-level, etc.)
   */
  hierarchyLevel: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
    Schema.annotations({
      title: "Hierarchy Level",
      description: "Level in account hierarchy (1 = top level)"
    })
  ),

  /**
   * Whether journal entries can be posted directly to this account
   * Summary/parent accounts are typically not postable
   */
  isPostable: Schema.Boolean.annotations({
    title: "Is Postable",
    description: "Whether journal entries can be posted directly to this account"
  }),

  /**
   * Whether this account affects the cash flow statement
   */
  isCashFlowRelevant: Schema.Boolean.annotations({
    title: "Is Cash Flow Relevant",
    description: "Whether the account affects the cash flow statement"
  }),

  /**
   * Cash flow category (only applicable if isCashFlowRelevant is true)
   */
  cashFlowCategory: Schema.OptionFromNullOr(CashFlowCategory).annotations({
    title: "Cash Flow Category",
    description: "Classification for cash flow statement (Operating, Investing, Financing, NonCash)"
  }),

  /**
   * Flag indicating this is an intercompany account
   * Used for tracking transactions between related companies
   */
  isIntercompany: Schema.Boolean.annotations({
    title: "Is Intercompany",
    description: "Whether this is an intercompany account for related party transactions"
  }),

  /**
   * Reference to the intercompany partner company
   * Only applicable when isIntercompany is true
   */
  intercompanyPartnerId: Schema.OptionFromNullOr(CompanyId).annotations({
    title: "Intercompany Partner ID",
    description: "Reference to the partner company for intercompany transactions"
  }),

  /**
   * Optional restriction to a specific currency
   * If set, only transactions in this currency can be posted
   * Null means any currency is allowed
   */
  currencyRestriction: Schema.OptionFromNullOr(CurrencyCode).annotations({
    title: "Currency Restriction",
    description: "Optional restriction to a specific currency (null allows any)"
  }),

  /**
   * Whether the account is active
   * Inactive accounts cannot receive new postings
   */
  isActive: Schema.Boolean.annotations({
    title: "Is Active",
    description: "Whether the account is currently active"
  }),

  /**
   * Whether this is the retained earnings account for year-end closing
   * Only one account per company should have this flag set to true.
   * Used for auto-configuration when applying Chart of Accounts templates.
   */
  isRetainedEarnings: Schema.optionalWith(Schema.Boolean, { default: () => false }).annotations({
    title: "Is Retained Earnings",
    description: "Whether this is the retained earnings account for year-end closing"
  }),

  /**
   * When the account was created
   */
  createdAt: Timestamp,

  /**
   * When the account was deactivated (if applicable)
   */
  deactivatedAt: Schema.OptionFromNullOr(Timestamp).annotations({
    title: "Deactivated At",
    description: "Timestamp when the account was deactivated (if applicable)"
  })
}) {
  /**
   * Check if this is a top-level account (no parent)
   */
  get isTopLevel(): boolean {
    return Option.isNone(this.parentAccountId)
  }

  /**
   * Check if this is a sub-account (has a parent)
   */
  get isSubAccount(): boolean {
    return Option.isSome(this.parentAccountId)
  }

  /**
   * Check if this is a balance sheet account (Asset, Liability, or Equity)
   */
  get isBalanceSheetAccount(): boolean {
    return this.accountType === "Asset" ||
           this.accountType === "Liability" ||
           this.accountType === "Equity"
  }

  /**
   * Check if this is an income statement account (Revenue or Expense)
   */
  get isIncomeStatementAccount(): boolean {
    return this.accountType === "Revenue" ||
           this.accountType === "Expense"
  }

  /**
   * Check if the account has a normal debit balance
   */
  get hasNormalDebitBalance(): boolean {
    return this.normalBalance === "Debit"
  }

  /**
   * Check if the account has a normal credit balance
   */
  get hasNormalCreditBalance(): boolean {
    return this.normalBalance === "Credit"
  }

  /**
   * Check if the account's normal balance matches the expected normal balance for its type
   */
  get hasStandardNormalBalance(): boolean {
    return this.normalBalance === getNormalBalanceForType(this.accountType)
  }

  /**
   * Check if the account category is valid for its account type
   */
  get hasCategoryMatchingType(): boolean {
    const validCategories = getCategoriesForType(this.accountType)
    return validCategories.includes(this.accountCategory)
  }

  /**
   * Check if currency is restricted
   */
  get hasCurrencyRestriction(): boolean {
    return Option.isSome(this.currencyRestriction)
  }

  /**
   * Check if the account is a summary account (not postable)
   */
  get isSummaryAccount(): boolean {
    return !this.isPostable
  }
}

/**
 * Type guard for Account using Schema.is
 */
export const isAccount = Schema.is(Account)
