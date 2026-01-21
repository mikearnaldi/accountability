/**
 * AccountTemplate - Standard account templates for different business types
 *
 * Provides predefined account templates for:
 * - General Business: Standard commercial entities (~50 accounts)
 * - Manufacturing: Includes inventory and COGS detail accounts
 * - Service Business: Service revenue focused
 * - Holding Company: Investment and intercompany focused
 *
 * Templates are pure data structures that can be instantiated for a specific company.
 *
 * @module AccountTemplate
 */

import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import {
  Account,
  AccountId,
  AccountType,
  AccountCategory,
  NormalBalance,
  CashFlowCategory,
  getNormalBalanceForType
} from "./Account.ts"
import { AccountNumber } from "./AccountNumber.ts"
import type { CompanyId } from "../company/Company.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * TemplateAccountDefinition - Definition for an account within a template
 *
 * This is a pure data structure that defines the properties of an account
 * without any company-specific information like IDs.
 */
export class TemplateAccountDefinition extends Schema.Class<TemplateAccountDefinition>("TemplateAccountDefinition")({
  /**
   * Account number following numbering convention (e.g., "1000")
   */
  accountNumber: AccountNumber,

  /**
   * Display name of the account
   */
  name: Schema.NonEmptyTrimmedString,

  /**
   * Optional detailed description of the account
   */
  description: Schema.OptionFromNullOr(Schema.String),

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
   * If not specified, will use the standard normal balance for the account type
   */
  normalBalance: Schema.OptionFromNullOr(NormalBalance),

  /**
   * Parent account number reference (for sub-accounts)
   * References another account number in the same template
   */
  parentAccountNumber: Schema.OptionFromNullOr(AccountNumber),

  /**
   * Whether journal entries can be posted directly to this account
   */
  isPostable: Schema.Boolean,

  /**
   * Whether this account affects the cash flow statement
   */
  isCashFlowRelevant: Schema.Boolean,

  /**
   * Cash flow category (only applicable if isCashFlowRelevant is true)
   */
  cashFlowCategory: Schema.OptionFromNullOr(CashFlowCategory),

  /**
   * Flag indicating this is an intercompany account
   */
  isIntercompany: Schema.Boolean,

  /**
   * Flag indicating this is the retained earnings account for year-end close
   * Used to automatically set company.retainedEarningsAccountId when applying template
   */
  isRetainedEarnings: Schema.optionalWith(Schema.Boolean, { default: () => false })
}) {
  /**
   * Get the effective normal balance (specified or derived from account type)
   */
  get effectiveNormalBalance(): NormalBalance {
    return Option.getOrElse(
      this.normalBalance,
      () => getNormalBalanceForType(this.accountType)
    )
  }
}

/**
 * Type guard for TemplateAccountDefinition
 */
export const isTemplateAccountDefinition = Schema.is(TemplateAccountDefinition)

/**
 * TemplateType - The type of business the template is designed for
 */
export const TemplateType = Schema.Literal(
  "GeneralBusiness",
  "Manufacturing",
  "ServiceBusiness",
  "HoldingCompany"
).annotations({
  identifier: "TemplateType",
  title: "Template Type",
  description: "The type of business the template is designed for"
})

export type TemplateType = typeof TemplateType.Type

/**
 * Type guard for TemplateType
 */
export const isTemplateType = Schema.is(TemplateType)

/**
 * AccountTemplate - A collection of account definitions for a business type
 */
export class AccountTemplate extends Schema.Class<AccountTemplate>("AccountTemplate")({
  /**
   * Template type identifier
   */
  templateType: TemplateType,

  /**
   * Human-readable name of the template
   */
  name: Schema.NonEmptyTrimmedString,

  /**
   * Description of the template and its intended use
   */
  description: Schema.String,

  /**
   * The account definitions in this template
   * Uses Chunk for proper structural equality with Equal.equals
   */
  accounts: Schema.Chunk(TemplateAccountDefinition)
}) {
  /**
   * Get the number of accounts in this template
   */
  get accountCount(): number {
    return Chunk.size(this.accounts)
  }

  /**
   * Get accounts by type
   */
  getAccountsByType(accountType: AccountType): Chunk.Chunk<TemplateAccountDefinition> {
    return Chunk.filter(this.accounts, (acc) => acc.accountType === accountType)
  }

  /**
   * Find an account definition by account number
   */
  findByAccountNumber(accountNumber: AccountNumber): Option.Option<TemplateAccountDefinition> {
    return Chunk.findFirst(this.accounts, (acc) => acc.accountNumber === accountNumber)
  }
}

/**
 * Type guard for AccountTemplate
 */
export const isAccountTemplate = Schema.is(AccountTemplate)

/**
 * Helper function to create a TemplateAccountDefinition with common defaults
 */
const makeAccountDef = (params: {
  accountNumber: string
  name: string
  description?: string
  accountType: AccountType
  accountCategory: AccountCategory
  normalBalance?: NormalBalance
  parentAccountNumber?: string
  isPostable?: boolean
  isCashFlowRelevant?: boolean
  cashFlowCategory?: CashFlowCategory
  isIntercompany?: boolean
  isRetainedEarnings?: boolean
}): TemplateAccountDefinition => {
  return TemplateAccountDefinition.make({
    accountNumber: AccountNumber.make(params.accountNumber),
    name: params.name,
    description: params.description !== undefined ? Option.some(params.description) : Option.none(),
    accountType: params.accountType,
    accountCategory: params.accountCategory,
    normalBalance: params.normalBalance !== undefined ? Option.some(params.normalBalance) : Option.none(),
    parentAccountNumber: params.parentAccountNumber !== undefined
      ? Option.some(AccountNumber.make(params.parentAccountNumber))
      : Option.none(),
    isPostable: params.isPostable ?? true,
    isCashFlowRelevant: params.isCashFlowRelevant ?? false,
    cashFlowCategory: params.cashFlowCategory !== undefined ? Option.some(params.cashFlowCategory) : Option.none(),
    isIntercompany: params.isIntercompany ?? false,
    isRetainedEarnings: params.isRetainedEarnings ?? false
  })
}

/**
 * General Business Template Accounts
 *
 * A comprehensive chart of accounts for standard commercial entities.
 * Covers all five account types with common sub-categories.
 */
const generalBusinessAccounts: TemplateAccountDefinition[] = [
  // ========== CURRENT ASSETS (1000-1499) ==========
  makeAccountDef({
    accountNumber: "1000",
    name: "Cash and Cash Equivalents",
    description: "Summary of all cash accounts",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1010",
    name: "Cash - Operating Account",
    description: "Primary operating bank account",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1020",
    name: "Cash - Payroll Account",
    description: "Bank account for payroll disbursements",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1030",
    name: "Petty Cash",
    description: "Petty cash fund",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1100",
    name: "Accounts Receivable",
    description: "Amounts due from customers",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1110",
    name: "Allowance for Doubtful Accounts",
    description: "Reserve for uncollectible receivables",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1100"
  }),
  makeAccountDef({
    accountNumber: "1200",
    name: "Inventory",
    description: "Merchandise and goods for sale",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1300",
    name: "Prepaid Expenses",
    description: "Expenses paid in advance",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1310",
    name: "Prepaid Insurance",
    description: "Insurance premiums paid in advance",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1300"
  }),
  makeAccountDef({
    accountNumber: "1320",
    name: "Prepaid Rent",
    description: "Rent paid in advance",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1300"
  }),
  makeAccountDef({
    accountNumber: "1400",
    name: "Other Current Assets",
    description: "Other short-term assets",
    accountType: "Asset",
    accountCategory: "CurrentAsset"
  }),

  // ========== NON-CURRENT ASSETS (1500-1999) ==========
  makeAccountDef({
    accountNumber: "1500",
    name: "Property, Plant and Equipment",
    description: "Summary of fixed assets",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1510",
    name: "Land",
    description: "Land owned by the company",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1520",
    name: "Buildings",
    description: "Buildings owned by the company",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1530",
    name: "Furniture and Fixtures",
    description: "Office furniture and fixtures",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1540",
    name: "Computer Equipment",
    description: "Computers and related equipment",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1550",
    name: "Vehicles",
    description: "Company vehicles",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1600",
    name: "Accumulated Depreciation",
    description: "Summary of accumulated depreciation",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    isPostable: false
  }),
  makeAccountDef({
    accountNumber: "1610",
    name: "Accumulated Depreciation - Buildings",
    description: "Accumulated depreciation on buildings",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1620",
    name: "Accumulated Depreciation - Furniture",
    description: "Accumulated depreciation on furniture and fixtures",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1630",
    name: "Accumulated Depreciation - Equipment",
    description: "Accumulated depreciation on computer equipment",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1640",
    name: "Accumulated Depreciation - Vehicles",
    description: "Accumulated depreciation on vehicles",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1700",
    name: "Intangible Assets",
    description: "Summary of intangible assets",
    accountType: "Asset",
    accountCategory: "IntangibleAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1710",
    name: "Goodwill",
    description: "Goodwill from business acquisitions",
    accountType: "Asset",
    accountCategory: "IntangibleAsset",
    parentAccountNumber: "1700"
  }),
  makeAccountDef({
    accountNumber: "1720",
    name: "Patents and Trademarks",
    description: "Intellectual property rights",
    accountType: "Asset",
    accountCategory: "IntangibleAsset",
    parentAccountNumber: "1700"
  }),
  makeAccountDef({
    accountNumber: "1800",
    name: "Other Non-Current Assets",
    description: "Other long-term assets",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset"
  }),

  // ========== CURRENT LIABILITIES (2000-2499) ==========
  makeAccountDef({
    accountNumber: "2000",
    name: "Accounts Payable",
    description: "Amounts owed to vendors",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2100",
    name: "Accrued Liabilities",
    description: "Summary of accrued expenses",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2110",
    name: "Accrued Salaries and Wages",
    description: "Salaries and wages owed but not yet paid",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2100"
  }),
  makeAccountDef({
    accountNumber: "2120",
    name: "Accrued Interest",
    description: "Interest expense owed but not yet paid",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2100"
  }),
  makeAccountDef({
    accountNumber: "2130",
    name: "Accrued Taxes",
    description: "Taxes owed but not yet paid",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2100"
  }),
  makeAccountDef({
    accountNumber: "2200",
    name: "Payroll Liabilities",
    description: "Summary of payroll-related liabilities",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isPostable: false
  }),
  makeAccountDef({
    accountNumber: "2210",
    name: "Federal Income Tax Withheld",
    description: "Federal income tax withheld from employees",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200"
  }),
  makeAccountDef({
    accountNumber: "2220",
    name: "State Income Tax Withheld",
    description: "State income tax withheld from employees",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200"
  }),
  makeAccountDef({
    accountNumber: "2230",
    name: "Social Security Tax Payable",
    description: "Employee and employer FICA taxes",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200"
  }),
  makeAccountDef({
    accountNumber: "2300",
    name: "Unearned Revenue",
    description: "Payments received for services not yet rendered",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2400",
    name: "Short-Term Notes Payable",
    description: "Notes due within one year",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2450",
    name: "Current Portion of Long-Term Debt",
    description: "Portion of long-term debt due within one year",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),

  // ========== NON-CURRENT LIABILITIES (2500-2999) ==========
  makeAccountDef({
    accountNumber: "2500",
    name: "Long-Term Notes Payable",
    description: "Notes due after one year",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2600",
    name: "Mortgage Payable",
    description: "Mortgage loans on real property",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2700",
    name: "Deferred Tax Liabilities",
    description: "Taxes deferred to future periods",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability"
  }),
  makeAccountDef({
    accountNumber: "2800",
    name: "Other Long-Term Liabilities",
    description: "Other non-current obligations",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability"
  }),

  // ========== EQUITY (3000-3999) ==========
  makeAccountDef({
    accountNumber: "3000",
    name: "Common Stock",
    description: "Par value of common shares issued",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3100",
    name: "Preferred Stock",
    description: "Par value of preferred shares issued",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3200",
    name: "Additional Paid-In Capital",
    description: "Amount received in excess of par value",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3300",
    name: "Retained Earnings",
    description: "Accumulated profits not distributed to shareholders",
    accountType: "Equity",
    accountCategory: "RetainedEarnings",
    isRetainedEarnings: true
  }),
  makeAccountDef({
    accountNumber: "3400",
    name: "Treasury Stock",
    description: "Stock repurchased by the company",
    accountType: "Equity",
    accountCategory: "TreasuryStock",
    normalBalance: "Debit",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3500",
    name: "Accumulated Other Comprehensive Income",
    description: "Cumulative unrealized gains and losses",
    accountType: "Equity",
    accountCategory: "OtherComprehensiveIncome"
  }),
  makeAccountDef({
    accountNumber: "3600",
    name: "Dividends",
    description: "Dividends declared during the period",
    accountType: "Equity",
    accountCategory: "RetainedEarnings",
    normalBalance: "Debit",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),

  // ========== REVENUE (4000-4999) ==========
  makeAccountDef({
    accountNumber: "4000",
    name: "Sales Revenue",
    description: "Revenue from sale of goods and services",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4100",
    name: "Service Revenue",
    description: "Revenue from services rendered",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4200",
    name: "Sales Returns and Allowances",
    description: "Contra revenue for returns and discounts",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    normalBalance: "Debit"
  }),
  makeAccountDef({
    accountNumber: "4300",
    name: "Sales Discounts",
    description: "Contra revenue for early payment discounts",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    normalBalance: "Debit"
  }),

  // ========== COST OF SALES (5000-5999) ==========
  makeAccountDef({
    accountNumber: "5000",
    name: "Cost of Goods Sold",
    description: "Direct costs of products sold",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5100",
    name: "Cost of Services",
    description: "Direct costs of services rendered",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),

  // ========== OPERATING EXPENSES (6000-7999) ==========
  makeAccountDef({
    accountNumber: "6000",
    name: "Salaries and Wages",
    description: "Employee compensation",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6100",
    name: "Employee Benefits",
    description: "Health insurance, retirement contributions, etc.",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6200",
    name: "Payroll Taxes",
    description: "Employer portion of payroll taxes",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6300",
    name: "Rent Expense",
    description: "Office and facility rent",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6400",
    name: "Utilities Expense",
    description: "Electricity, gas, water, etc.",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6500",
    name: "Insurance Expense",
    description: "Business insurance premiums",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6600",
    name: "Professional Fees",
    description: "Legal, accounting, and consulting fees",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6700",
    name: "Office Supplies",
    description: "Office supplies and materials",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6800",
    name: "Advertising and Marketing",
    description: "Marketing and promotional expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6900",
    name: "Travel and Entertainment",
    description: "Business travel and entertainment",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7000",
    name: "Depreciation Expense",
    description: "Depreciation of fixed assets",
    accountType: "Expense",
    accountCategory: "DepreciationAmortization"
  }),
  makeAccountDef({
    accountNumber: "7100",
    name: "Amortization Expense",
    description: "Amortization of intangible assets",
    accountType: "Expense",
    accountCategory: "DepreciationAmortization"
  }),
  makeAccountDef({
    accountNumber: "7200",
    name: "Bad Debt Expense",
    description: "Provision for uncollectible receivables",
    accountType: "Expense",
    accountCategory: "OperatingExpense"
  }),
  makeAccountDef({
    accountNumber: "7300",
    name: "Repairs and Maintenance",
    description: "Maintenance of property and equipment",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7400",
    name: "Telephone and Internet",
    description: "Communication expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7500",
    name: "Bank Charges",
    description: "Bank service fees",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7600",
    name: "Miscellaneous Expense",
    description: "Other operating expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),

  // ========== OTHER INCOME/EXPENSE (8000-8999) ==========
  makeAccountDef({
    accountNumber: "8000",
    name: "Interest Income",
    description: "Interest earned on investments and deposits",
    accountType: "Revenue",
    accountCategory: "OtherRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "8100",
    name: "Interest Expense",
    description: "Interest paid on debt",
    accountType: "Expense",
    accountCategory: "InterestExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "8200",
    name: "Gain on Sale of Assets",
    description: "Gains from disposal of assets",
    accountType: "Revenue",
    accountCategory: "OtherRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "8300",
    name: "Loss on Sale of Assets",
    description: "Losses from disposal of assets",
    accountType: "Expense",
    accountCategory: "OtherExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "8400",
    name: "Foreign Exchange Gain/Loss",
    description: "Gains and losses from currency translation",
    accountType: "Revenue",
    accountCategory: "OtherRevenue"
  }),
  makeAccountDef({
    accountNumber: "8500",
    name: "Income Tax Expense",
    description: "Federal and state income taxes",
    accountType: "Expense",
    accountCategory: "TaxExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  })
]

/**
 * GeneralBusinessTemplate - Standard template for commercial entities
 *
 * Contains approximately 50 accounts covering:
 * - Current and non-current assets
 * - Current and non-current liabilities
 * - Equity accounts
 * - Revenue accounts
 * - Cost of sales and operating expenses
 * - Other income and expenses
 */
export const GeneralBusinessTemplate: AccountTemplate = AccountTemplate.make({
  templateType: "GeneralBusiness",
  name: "General Business",
  description: "A comprehensive chart of accounts for standard commercial entities. Includes accounts for all five account types with common sub-categories suitable for most businesses.",
  accounts: Chunk.fromIterable(generalBusinessAccounts)
})

/**
 * Manufacturing Template Accounts
 *
 * Extends the general business template with additional accounts for:
 * - Raw materials, work-in-process, and finished goods inventory
 * - Manufacturing overhead
 * - Detailed COGS breakdown
 */
const manufacturingAccounts: TemplateAccountDefinition[] = [
  ...generalBusinessAccounts,

  // Additional inventory accounts
  makeAccountDef({
    accountNumber: "1210",
    name: "Raw Materials Inventory",
    description: "Inventory of raw materials for production",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1200",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1220",
    name: "Work-in-Process Inventory",
    description: "Inventory of partially completed goods",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1200",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1230",
    name: "Finished Goods Inventory",
    description: "Inventory of completed products ready for sale",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1200",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1240",
    name: "Manufacturing Supplies",
    description: "Supplies used in the manufacturing process",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1200"
  }),

  // Manufacturing equipment
  makeAccountDef({
    accountNumber: "1560",
    name: "Manufacturing Equipment",
    description: "Machinery used in production",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1650",
    name: "Accumulated Depreciation - Manufacturing Equipment",
    description: "Accumulated depreciation on manufacturing equipment",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),

  // Detailed COGS accounts
  makeAccountDef({
    accountNumber: "5010",
    name: "Raw Materials Used",
    description: "Cost of raw materials consumed in production",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5020",
    name: "Direct Labor",
    description: "Labor costs directly attributable to production",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5030",
    name: "Manufacturing Overhead",
    description: "Indirect manufacturing costs",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isPostable: false
  }),
  makeAccountDef({
    accountNumber: "5031",
    name: "Factory Rent",
    description: "Rent for manufacturing facilities",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5030",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5032",
    name: "Factory Utilities",
    description: "Utilities for manufacturing facilities",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5030",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5033",
    name: "Factory Insurance",
    description: "Insurance for manufacturing facilities and equipment",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5030",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5034",
    name: "Factory Depreciation",
    description: "Depreciation of manufacturing equipment",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5030"
  }),
  makeAccountDef({
    accountNumber: "5035",
    name: "Factory Supplies",
    description: "Consumable supplies used in manufacturing",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5030",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5036",
    name: "Indirect Labor",
    description: "Labor costs not directly attributable to production",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5030",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5040",
    name: "Freight-In",
    description: "Shipping costs for incoming raw materials",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5050",
    name: "Purchase Discounts",
    description: "Discounts received on inventory purchases",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    normalBalance: "Credit",
    parentAccountNumber: "5000"
  })
]

/**
 * ManufacturingTemplate - Template for manufacturing companies
 *
 * Extends the general business template with:
 * - Detailed inventory accounts (raw materials, WIP, finished goods)
 * - Manufacturing equipment and depreciation
 * - Comprehensive COGS breakdown including manufacturing overhead
 */
export const ManufacturingTemplate: AccountTemplate = AccountTemplate.make({
  templateType: "Manufacturing",
  name: "Manufacturing",
  description: "Extended chart of accounts for manufacturing companies. Includes detailed inventory tracking (raw materials, work-in-process, finished goods) and comprehensive cost of goods sold breakdown with manufacturing overhead accounts.",
  accounts: Chunk.fromIterable(manufacturingAccounts)
})

/**
 * Service Business Template Accounts
 *
 * Modified general business template with service revenue focus:
 * - Reduced inventory accounts
 * - Enhanced service revenue categories
 * - More detailed service cost accounts
 */
const serviceBusinessAccounts: TemplateAccountDefinition[] = [
  // ========== CURRENT ASSETS (1000-1499) - Reduced inventory ==========
  makeAccountDef({
    accountNumber: "1000",
    name: "Cash and Cash Equivalents",
    description: "Summary of all cash accounts",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1010",
    name: "Cash - Operating Account",
    description: "Primary operating bank account",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1020",
    name: "Cash - Payroll Account",
    description: "Bank account for payroll disbursements",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1030",
    name: "Petty Cash",
    description: "Petty cash fund",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1100",
    name: "Accounts Receivable",
    description: "Amounts due from clients",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1110",
    name: "Allowance for Doubtful Accounts",
    description: "Reserve for uncollectible receivables",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1100"
  }),
  makeAccountDef({
    accountNumber: "1120",
    name: "Unbilled Revenue",
    description: "Services rendered but not yet billed",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1100"
  }),
  makeAccountDef({
    accountNumber: "1300",
    name: "Prepaid Expenses",
    description: "Expenses paid in advance",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1310",
    name: "Prepaid Insurance",
    description: "Insurance premiums paid in advance",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1300"
  }),
  makeAccountDef({
    accountNumber: "1320",
    name: "Prepaid Rent",
    description: "Rent paid in advance",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1300"
  }),
  makeAccountDef({
    accountNumber: "1400",
    name: "Other Current Assets",
    description: "Other short-term assets",
    accountType: "Asset",
    accountCategory: "CurrentAsset"
  }),

  // ========== NON-CURRENT ASSETS (1500-1999) ==========
  makeAccountDef({
    accountNumber: "1500",
    name: "Property, Plant and Equipment",
    description: "Summary of fixed assets",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1530",
    name: "Furniture and Fixtures",
    description: "Office furniture and fixtures",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1540",
    name: "Computer Equipment",
    description: "Computers and related equipment",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1550",
    name: "Vehicles",
    description: "Company vehicles",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1570",
    name: "Leasehold Improvements",
    description: "Improvements to leased property",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1600",
    name: "Accumulated Depreciation",
    description: "Summary of accumulated depreciation",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    isPostable: false
  }),
  makeAccountDef({
    accountNumber: "1620",
    name: "Accumulated Depreciation - Furniture",
    description: "Accumulated depreciation on furniture and fixtures",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1630",
    name: "Accumulated Depreciation - Equipment",
    description: "Accumulated depreciation on computer equipment",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1640",
    name: "Accumulated Depreciation - Vehicles",
    description: "Accumulated depreciation on vehicles",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1660",
    name: "Accumulated Amortization - Leasehold Improvements",
    description: "Accumulated amortization on leasehold improvements",
    accountType: "Asset",
    accountCategory: "FixedAsset",
    normalBalance: "Credit",
    parentAccountNumber: "1600"
  }),
  makeAccountDef({
    accountNumber: "1800",
    name: "Other Non-Current Assets",
    description: "Other long-term assets",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset"
  }),

  // ========== CURRENT LIABILITIES (2000-2499) ==========
  makeAccountDef({
    accountNumber: "2000",
    name: "Accounts Payable",
    description: "Amounts owed to vendors",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2100",
    name: "Accrued Liabilities",
    description: "Summary of accrued expenses",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2110",
    name: "Accrued Salaries and Wages",
    description: "Salaries and wages owed but not yet paid",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2100"
  }),
  makeAccountDef({
    accountNumber: "2120",
    name: "Accrued Bonuses",
    description: "Bonuses owed but not yet paid",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2100"
  }),
  makeAccountDef({
    accountNumber: "2130",
    name: "Accrued Taxes",
    description: "Taxes owed but not yet paid",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2100"
  }),
  makeAccountDef({
    accountNumber: "2200",
    name: "Payroll Liabilities",
    description: "Summary of payroll-related liabilities",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isPostable: false
  }),
  makeAccountDef({
    accountNumber: "2210",
    name: "Federal Income Tax Withheld",
    description: "Federal income tax withheld from employees",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200"
  }),
  makeAccountDef({
    accountNumber: "2220",
    name: "State Income Tax Withheld",
    description: "State income tax withheld from employees",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200"
  }),
  makeAccountDef({
    accountNumber: "2230",
    name: "Social Security Tax Payable",
    description: "Employee and employer FICA taxes",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200"
  }),
  makeAccountDef({
    accountNumber: "2300",
    name: "Deferred Revenue",
    description: "Payments received for services not yet rendered",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2310",
    name: "Retainers Received",
    description: "Client retainer payments",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2300"
  }),
  makeAccountDef({
    accountNumber: "2400",
    name: "Short-Term Notes Payable",
    description: "Notes due within one year",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2450",
    name: "Credit Line Payable",
    description: "Amounts drawn on credit line",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),

  // ========== NON-CURRENT LIABILITIES (2500-2999) ==========
  makeAccountDef({
    accountNumber: "2500",
    name: "Long-Term Notes Payable",
    description: "Notes due after one year",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2700",
    name: "Deferred Tax Liabilities",
    description: "Taxes deferred to future periods",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability"
  }),
  makeAccountDef({
    accountNumber: "2800",
    name: "Other Long-Term Liabilities",
    description: "Other non-current obligations",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability"
  }),

  // ========== EQUITY (3000-3999) ==========
  makeAccountDef({
    accountNumber: "3000",
    name: "Common Stock",
    description: "Par value of common shares issued",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3100",
    name: "Member Capital",
    description: "Capital contributions from members (for LLCs)",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3200",
    name: "Additional Paid-In Capital",
    description: "Amount received in excess of par value",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3300",
    name: "Retained Earnings",
    description: "Accumulated profits not distributed",
    accountType: "Equity",
    accountCategory: "RetainedEarnings",
    isRetainedEarnings: true
  }),
  makeAccountDef({
    accountNumber: "3400",
    name: "Owner Draws",
    description: "Withdrawals by owners",
    accountType: "Equity",
    accountCategory: "RetainedEarnings",
    normalBalance: "Debit",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3600",
    name: "Dividends",
    description: "Dividends declared during the period",
    accountType: "Equity",
    accountCategory: "RetainedEarnings",
    normalBalance: "Debit",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),

  // ========== SERVICE REVENUE (4000-4999) - Enhanced ==========
  makeAccountDef({
    accountNumber: "4000",
    name: "Service Revenue",
    description: "Summary of all service revenue",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4010",
    name: "Consulting Revenue",
    description: "Revenue from consulting services",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4020",
    name: "Professional Services Revenue",
    description: "Revenue from professional services",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4030",
    name: "Project Revenue",
    description: "Revenue from project-based work",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4040",
    name: "Retainer Revenue",
    description: "Revenue from retainer agreements",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4050",
    name: "Training Revenue",
    description: "Revenue from training and workshops",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4100",
    name: "Subscription Revenue",
    description: "Revenue from recurring subscriptions",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4200",
    name: "Reimbursable Expenses",
    description: "Client-reimbursed expenses billed",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),

  // ========== COST OF SERVICES (5000-5999) ==========
  makeAccountDef({
    accountNumber: "5000",
    name: "Cost of Services",
    description: "Summary of direct service costs",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5010",
    name: "Direct Labor",
    description: "Labor costs for billable work",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5020",
    name: "Subcontractor Costs",
    description: "Payments to subcontractors for client work",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5030",
    name: "Project Materials",
    description: "Materials directly related to projects",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "5040",
    name: "Reimbursable Expenses - Cost",
    description: "Expenses to be reimbursed by clients",
    accountType: "Expense",
    accountCategory: "CostOfGoodsSold",
    parentAccountNumber: "5000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),

  // ========== OPERATING EXPENSES (6000-7999) ==========
  makeAccountDef({
    accountNumber: "6000",
    name: "Salaries and Wages",
    description: "Employee compensation",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6100",
    name: "Employee Benefits",
    description: "Health insurance, retirement contributions, etc.",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6200",
    name: "Payroll Taxes",
    description: "Employer portion of payroll taxes",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6250",
    name: "Professional Development",
    description: "Training and education for employees",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6300",
    name: "Rent Expense",
    description: "Office rent",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6400",
    name: "Utilities Expense",
    description: "Electricity, gas, water, etc.",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6500",
    name: "Insurance Expense",
    description: "Business insurance premiums",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6510",
    name: "Professional Liability Insurance",
    description: "Errors and omissions insurance",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    parentAccountNumber: "6500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6600",
    name: "Professional Fees",
    description: "Legal, accounting, and consulting fees",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6650",
    name: "Licenses and Permits",
    description: "Professional licenses and business permits",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6700",
    name: "Office Supplies",
    description: "Office supplies and materials",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6750",
    name: "Software and Subscriptions",
    description: "Software licenses and SaaS subscriptions",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6800",
    name: "Marketing and Business Development",
    description: "Marketing and client acquisition costs",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6900",
    name: "Travel and Entertainment",
    description: "Business travel and client entertainment",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7000",
    name: "Depreciation Expense",
    description: "Depreciation of fixed assets",
    accountType: "Expense",
    accountCategory: "DepreciationAmortization"
  }),
  makeAccountDef({
    accountNumber: "7100",
    name: "Amortization Expense",
    description: "Amortization of intangible assets",
    accountType: "Expense",
    accountCategory: "DepreciationAmortization"
  }),
  makeAccountDef({
    accountNumber: "7200",
    name: "Bad Debt Expense",
    description: "Provision for uncollectible receivables",
    accountType: "Expense",
    accountCategory: "OperatingExpense"
  }),
  makeAccountDef({
    accountNumber: "7400",
    name: "Telephone and Internet",
    description: "Communication expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7500",
    name: "Bank Charges",
    description: "Bank service fees",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7600",
    name: "Miscellaneous Expense",
    description: "Other operating expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),

  // ========== OTHER INCOME/EXPENSE (8000-8999) ==========
  makeAccountDef({
    accountNumber: "8000",
    name: "Interest Income",
    description: "Interest earned on investments and deposits",
    accountType: "Revenue",
    accountCategory: "OtherRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "8100",
    name: "Interest Expense",
    description: "Interest paid on debt",
    accountType: "Expense",
    accountCategory: "InterestExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "8500",
    name: "Income Tax Expense",
    description: "Federal and state income taxes",
    accountType: "Expense",
    accountCategory: "TaxExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  })
]

/**
 * ServiceBusinessTemplate - Template for service-based companies
 *
 * Optimized for professional services firms with:
 * - Minimal inventory accounts (services don't have inventory)
 * - Enhanced service revenue categorization
 * - Service-specific cost of services accounts
 * - Professional liability insurance
 */
export const ServiceBusinessTemplate: AccountTemplate = AccountTemplate.make({
  templateType: "ServiceBusiness",
  name: "Service Business",
  description: "Chart of accounts optimized for professional service firms. Features enhanced service revenue categorization, minimal inventory, and detailed cost of services tracking including direct labor and subcontractor costs.",
  accounts: Chunk.fromIterable(serviceBusinessAccounts)
})

/**
 * Holding Company Template Accounts
 *
 * Specialized template for holding/investment companies:
 * - Investment accounts
 * - Intercompany accounts
 * - Dividend income
 * - Limited operating accounts
 */
const holdingCompanyAccounts: TemplateAccountDefinition[] = [
  // ========== CURRENT ASSETS (1000-1499) ==========
  makeAccountDef({
    accountNumber: "1000",
    name: "Cash and Cash Equivalents",
    description: "Summary of all cash accounts",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1010",
    name: "Cash - Operating Account",
    description: "Primary operating bank account",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1000",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1100",
    name: "Accounts Receivable",
    description: "Amounts due from others",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1200",
    name: "Intercompany Receivables",
    description: "Summary of amounts due from subsidiaries",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isPostable: false,
    isIntercompany: true,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1210",
    name: "Due from Subsidiary A",
    description: "Amounts due from Subsidiary A",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1200",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "1220",
    name: "Due from Subsidiary B",
    description: "Amounts due from Subsidiary B",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1200",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "1230",
    name: "Due from Subsidiary C",
    description: "Amounts due from Subsidiary C",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    parentAccountNumber: "1200",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "1300",
    name: "Prepaid Expenses",
    description: "Expenses paid in advance",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "1400",
    name: "Other Current Assets",
    description: "Other short-term assets",
    accountType: "Asset",
    accountCategory: "CurrentAsset"
  }),

  // ========== INVESTMENTS (1500-1799) ==========
  makeAccountDef({
    accountNumber: "1500",
    name: "Investments in Subsidiaries",
    description: "Summary of investments in controlled companies",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1510",
    name: "Investment in Subsidiary A",
    description: "Equity investment in Subsidiary A",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1520",
    name: "Investment in Subsidiary B",
    description: "Equity investment in Subsidiary B",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1530",
    name: "Investment in Subsidiary C",
    description: "Equity investment in Subsidiary C",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    parentAccountNumber: "1500",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1600",
    name: "Investments in Associates",
    description: "Investments in affiliated companies (equity method)",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1700",
    name: "Marketable Securities",
    description: "Summary of marketable securities",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1710",
    name: "Available-for-Sale Securities",
    description: "Marketable securities available for sale",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    parentAccountNumber: "1700",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "1720",
    name: "Held-to-Maturity Securities",
    description: "Debt securities held to maturity",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    parentAccountNumber: "1700",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),

  // ========== OTHER NON-CURRENT ASSETS (1800-1999) ==========
  makeAccountDef({
    accountNumber: "1800",
    name: "Intangible Assets",
    description: "Summary of intangible assets",
    accountType: "Asset",
    accountCategory: "IntangibleAsset",
    isPostable: false
  }),
  makeAccountDef({
    accountNumber: "1810",
    name: "Goodwill",
    description: "Goodwill from acquisitions",
    accountType: "Asset",
    accountCategory: "IntangibleAsset",
    parentAccountNumber: "1800"
  }),
  makeAccountDef({
    accountNumber: "1900",
    name: "Loans to Subsidiaries",
    description: "Long-term loans to subsidiary companies",
    accountType: "Asset",
    accountCategory: "NonCurrentAsset",
    isIntercompany: true,
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),

  // ========== CURRENT LIABILITIES (2000-2499) ==========
  makeAccountDef({
    accountNumber: "2000",
    name: "Accounts Payable",
    description: "Amounts owed to vendors",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2100",
    name: "Accrued Liabilities",
    description: "Accrued expenses",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "2200",
    name: "Intercompany Payables",
    description: "Summary of amounts due to subsidiaries",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isPostable: false,
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "2210",
    name: "Due to Subsidiary A",
    description: "Amounts due to Subsidiary A",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "2220",
    name: "Due to Subsidiary B",
    description: "Amounts due to Subsidiary B",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "2230",
    name: "Due to Subsidiary C",
    description: "Amounts due to Subsidiary C",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    parentAccountNumber: "2200",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "2300",
    name: "Dividends Payable",
    description: "Declared but unpaid dividends",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2400",
    name: "Short-Term Borrowings",
    description: "Short-term debt obligations",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),

  // ========== NON-CURRENT LIABILITIES (2500-2999) ==========
  makeAccountDef({
    accountNumber: "2500",
    name: "Long-Term Debt",
    description: "Long-term borrowings",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2600",
    name: "Loans from Subsidiaries",
    description: "Long-term loans from subsidiary companies",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability",
    isIntercompany: true,
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "2700",
    name: "Deferred Tax Liabilities",
    description: "Taxes deferred to future periods",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability"
  }),
  makeAccountDef({
    accountNumber: "2800",
    name: "Other Long-Term Liabilities",
    description: "Other non-current obligations",
    accountType: "Liability",
    accountCategory: "NonCurrentLiability"
  }),

  // ========== EQUITY (3000-3999) ==========
  makeAccountDef({
    accountNumber: "3000",
    name: "Common Stock",
    description: "Par value of common shares issued",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3100",
    name: "Preferred Stock",
    description: "Par value of preferred shares issued",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3200",
    name: "Additional Paid-In Capital",
    description: "Amount received in excess of par value",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3300",
    name: "Retained Earnings",
    description: "Accumulated profits not distributed",
    accountType: "Equity",
    accountCategory: "RetainedEarnings",
    isRetainedEarnings: true
  }),
  makeAccountDef({
    accountNumber: "3400",
    name: "Treasury Stock",
    description: "Stock repurchased by the company",
    accountType: "Equity",
    accountCategory: "TreasuryStock",
    normalBalance: "Debit",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),
  makeAccountDef({
    accountNumber: "3500",
    name: "Accumulated Other Comprehensive Income",
    description: "Cumulative unrealized gains and losses",
    accountType: "Equity",
    accountCategory: "OtherComprehensiveIncome"
  }),
  makeAccountDef({
    accountNumber: "3510",
    name: "Unrealized Gain/Loss on Securities",
    description: "Unrealized gains and losses on available-for-sale securities",
    accountType: "Equity",
    accountCategory: "OtherComprehensiveIncome",
    parentAccountNumber: "3500"
  }),
  makeAccountDef({
    accountNumber: "3520",
    name: "Cumulative Translation Adjustment",
    description: "Foreign currency translation adjustments",
    accountType: "Equity",
    accountCategory: "OtherComprehensiveIncome",
    parentAccountNumber: "3500"
  }),
  makeAccountDef({
    accountNumber: "3600",
    name: "Dividends",
    description: "Dividends declared during the period",
    accountType: "Equity",
    accountCategory: "RetainedEarnings",
    normalBalance: "Debit",
    isCashFlowRelevant: true,
    cashFlowCategory: "Financing"
  }),

  // ========== REVENUE (4000-4999) ==========
  makeAccountDef({
    accountNumber: "4000",
    name: "Dividend Income",
    description: "Summary of dividend income",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isPostable: false,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4010",
    name: "Dividend Income - Subsidiary A",
    description: "Dividends received from Subsidiary A",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isIntercompany: true,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4020",
    name: "Dividend Income - Subsidiary B",
    description: "Dividends received from Subsidiary B",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isIntercompany: true,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4030",
    name: "Dividend Income - Subsidiary C",
    description: "Dividends received from Subsidiary C",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    parentAccountNumber: "4000",
    isIntercompany: true,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4100",
    name: "Dividend Income - Associates",
    description: "Dividends received from associates",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4200",
    name: "Management Fee Income",
    description: "Management fees charged to subsidiaries",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    isIntercompany: true,
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "4300",
    name: "Equity in Earnings of Subsidiaries",
    description: "Share of subsidiary net income (equity method)",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue"
  }),

  // ========== OTHER INCOME/EXPENSE (8000-8999) ==========
  makeAccountDef({
    accountNumber: "8000",
    name: "Interest Income",
    description: "Interest earned on loans and investments",
    accountType: "Revenue",
    accountCategory: "OtherRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "8010",
    name: "Interest Income - Intercompany",
    description: "Interest earned on loans to subsidiaries",
    accountType: "Revenue",
    accountCategory: "OtherRevenue",
    parentAccountNumber: "8000",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "8100",
    name: "Interest Expense",
    description: "Interest paid on debt",
    accountType: "Expense",
    accountCategory: "InterestExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "8110",
    name: "Interest Expense - Intercompany",
    description: "Interest paid on loans from subsidiaries",
    accountType: "Expense",
    accountCategory: "InterestExpense",
    parentAccountNumber: "8100",
    isIntercompany: true
  }),
  makeAccountDef({
    accountNumber: "8200",
    name: "Gain on Sale of Investments",
    description: "Gains from disposal of investments",
    accountType: "Revenue",
    accountCategory: "OtherRevenue",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "8300",
    name: "Loss on Sale of Investments",
    description: "Losses from disposal of investments",
    accountType: "Expense",
    accountCategory: "OtherExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Investing"
  }),
  makeAccountDef({
    accountNumber: "8400",
    name: "Impairment Loss",
    description: "Impairment losses on investments and goodwill",
    accountType: "Expense",
    accountCategory: "OtherExpense"
  }),
  makeAccountDef({
    accountNumber: "8500",
    name: "Income Tax Expense",
    description: "Federal and state income taxes",
    accountType: "Expense",
    accountCategory: "TaxExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),

  // ========== OPERATING EXPENSES (6000-7999) - Limited ==========
  makeAccountDef({
    accountNumber: "6000",
    name: "Salaries and Wages",
    description: "Employee compensation",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6100",
    name: "Professional Fees",
    description: "Legal, accounting, and advisory fees",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6200",
    name: "Board and Shareholder Expenses",
    description: "Expenses related to board meetings and shareholder relations",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6300",
    name: "Filing and Regulatory Fees",
    description: "SEC and regulatory compliance costs",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6400",
    name: "Insurance Expense",
    description: "Directors and officers liability insurance",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6500",
    name: "Office and Administrative",
    description: "General administrative expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "6600",
    name: "Travel Expense",
    description: "Business travel expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7000",
    name: "Amortization of Intangibles",
    description: "Amortization of goodwill and intangible assets",
    accountType: "Expense",
    accountCategory: "DepreciationAmortization"
  }),
  makeAccountDef({
    accountNumber: "7500",
    name: "Bank Charges",
    description: "Bank service fees",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  }),
  makeAccountDef({
    accountNumber: "7600",
    name: "Miscellaneous Expense",
    description: "Other operating expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    isCashFlowRelevant: true,
    cashFlowCategory: "Operating"
  })
]

/**
 * HoldingCompanyTemplate - Template for holding/investment companies
 *
 * Specialized for parent companies and investment holding structures:
 * - Investment accounts for subsidiaries and associates
 * - Intercompany accounts for intra-group transactions
 * - Dividend income tracking by subsidiary
 * - Equity method earnings accounts
 * - Minimal operating expenses
 */
export const HoldingCompanyTemplate: AccountTemplate = AccountTemplate.make({
  templateType: "HoldingCompany",
  name: "Holding Company",
  description: "Specialized chart of accounts for holding and investment companies. Includes investment tracking by subsidiary, intercompany accounts for intra-group transactions, dividend income tracking, and equity method accounting support.",
  accounts: Chunk.fromIterable(holdingCompanyAccounts)
})

/**
 * Get a template by its type
 */
export const getTemplateByType = (templateType: TemplateType): AccountTemplate => {
  switch (templateType) {
    case "GeneralBusiness":
      return GeneralBusinessTemplate
    case "Manufacturing":
      return ManufacturingTemplate
    case "ServiceBusiness":
      return ServiceBusinessTemplate
    case "HoldingCompany":
      return HoldingCompanyTemplate
  }
}

/**
 * Get all available templates
 */
export const getAllTemplates = (): ReadonlyArray<AccountTemplate> => [
  GeneralBusinessTemplate,
  ManufacturingTemplate,
  ServiceBusinessTemplate,
  HoldingCompanyTemplate
]

/**
 * Build a map of account numbers to generated account IDs
 * for resolving parent references
 */
const buildAccountIdMap = (
  accounts: Chunk.Chunk<TemplateAccountDefinition>,
  generateId: () => AccountId
): Map<string, AccountId> => {
  const map = new Map<string, AccountId>()
  for (const acc of accounts) {
    map.set(acc.accountNumber, generateId())
  }
  return map
}

/**
 * Calculate the hierarchy level for an account based on its parent chain
 */
const calculateHierarchyLevel = (
  accountNumber: AccountNumber,
  accounts: Chunk.Chunk<TemplateAccountDefinition>,
  visited: Set<string> = new Set()
): number => {
  // Prevent circular references
  if (visited.has(accountNumber)) {
    return 1
  }

  const account = Chunk.findFirst(accounts, (acc) => acc.accountNumber === accountNumber)

  return Option.match(account, {
    onNone: () => 1,
    onSome: (acc) =>
      Option.match(acc.parentAccountNumber, {
        onNone: () => 1,
        onSome: (parentNumber) => {
          visited.add(accountNumber)
          return 1 + calculateHierarchyLevel(parentNumber, accounts, visited)
        }
      })
  })
}

/**
 * Instantiate a template for a specific company
 *
 * Creates actual Account entities from a template, generating unique IDs
 * and resolving parent-child relationships.
 *
 * @param template The account template to instantiate
 * @param companyId The company ID to assign to all accounts
 * @param generateId Optional ID generator function (defaults to crypto.randomUUID)
 * @returns An array of Account entities ready to be persisted
 */
export const instantiateTemplate = (
  template: AccountTemplate,
  companyId: CompanyId,
  generateId: () => AccountId = () => AccountId.make(crypto.randomUUID())
): Chunk.Chunk<Account> => {
  const timestamp = Timestamp.make({ epochMillis: Date.now() })

  // Build a map of account numbers to IDs for parent resolution
  const accountIdMap = buildAccountIdMap(template.accounts, generateId)

  return Chunk.map(template.accounts, (def) => {
    const accountId = accountIdMap.get(def.accountNumber)!

    // Resolve parent account ID from parent account number
    const parentAccountId = Option.flatMap(
      def.parentAccountNumber,
      (parentNumber) => {
        const parentId = accountIdMap.get(parentNumber)
        return parentId !== undefined ? Option.some(parentId) : Option.none()
      }
    )

    // Calculate hierarchy level based on parent chain
    const hierarchyLevel = calculateHierarchyLevel(def.accountNumber, template.accounts)

    return Account.make({
      id: accountId,
      companyId,
      accountNumber: def.accountNumber,
      name: def.name,
      description: def.description,
      accountType: def.accountType,
      accountCategory: def.accountCategory,
      normalBalance: def.effectiveNormalBalance,
      parentAccountId,
      hierarchyLevel,
      isPostable: def.isPostable,
      isCashFlowRelevant: def.isCashFlowRelevant,
      cashFlowCategory: def.cashFlowCategory,
      isIntercompany: def.isIntercompany,
      isRetainedEarnings: def.isRetainedEarnings ?? false,
      intercompanyPartnerId: Option.none(), // Partner must be set separately
      currencyRestriction: Option.none(), // Currency restriction must be set separately
      isActive: true,
      createdAt: timestamp,
      deactivatedAt: Option.none()
    })
  })
}

/**
 * Instantiate a template using an Effect-based ID generator
 *
 * Useful when generating IDs requires an Effect (e.g., from a UUID service)
 *
 * @param template The account template to instantiate
 * @param companyId The company ID to assign to all accounts
 * @param generateIdEffect Effect that generates a unique AccountId
 * @returns Effect that produces an array of Account entities
 */
export const instantiateTemplateEffect = <E, R>(
  template: AccountTemplate,
  companyId: CompanyId,
  generateIdEffect: Effect.Effect<AccountId, E, R>
): Effect.Effect<Chunk.Chunk<Account>, E, R> => {
  return Effect.gen(function* () {
    const timestamp = Timestamp.make({ epochMillis: Date.now() })

    // Generate all IDs upfront
    const accountIdMap = new Map<string, AccountId>()
    for (const acc of template.accounts) {
      const id = yield* generateIdEffect
      accountIdMap.set(acc.accountNumber, id)
    }

    return Chunk.map(template.accounts, (def) => {
      const accountId = accountIdMap.get(def.accountNumber)!

      // Resolve parent account ID from parent account number
      const parentAccountId = Option.flatMap(
        def.parentAccountNumber,
        (parentNumber) => {
          const parentId = accountIdMap.get(parentNumber)
          return parentId !== undefined ? Option.some(parentId) : Option.none()
        }
      )

      // Calculate hierarchy level based on parent chain
      const hierarchyLevel = calculateHierarchyLevel(def.accountNumber, template.accounts)

      return Account.make({
        id: accountId,
        companyId,
        accountNumber: def.accountNumber,
        name: def.name,
        description: def.description,
        accountType: def.accountType,
        accountCategory: def.accountCategory,
        normalBalance: def.effectiveNormalBalance,
        parentAccountId,
        hierarchyLevel,
        isPostable: def.isPostable,
        isCashFlowRelevant: def.isCashFlowRelevant,
        cashFlowCategory: def.cashFlowCategory,
        isIntercompany: def.isIntercompany,
        isRetainedEarnings: def.isRetainedEarnings ?? false,
        intercompanyPartnerId: Option.none(),
        currencyRestriction: Option.none(),
        isActive: true,
        createdAt: timestamp,
        deactivatedAt: Option.none()
      })
    })
  })
}
