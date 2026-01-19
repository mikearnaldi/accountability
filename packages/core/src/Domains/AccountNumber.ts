/**
 * AccountNumber - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: accounting/AccountNumber.ts
 *
 * @module Domains/AccountNumber
 * @deprecated Import from "@accountability/core/accounting/AccountNumber" instead
 */

export {
  // AccountType and AccountCategory from AccountNumber module
  AccountType,
  isAccountType,
  AccountCategory,
  isAccountCategory,

  // AccountNumber
  AccountNumber,
  isAccountNumber,

  // Helper functions
  getAccountType,
  getAccountCategory,
  isAssetAccount,
  isLiabilityAccount,
  isEquityAccount,
  isRevenueAccount,
  isExpenseAccount,
  isOtherAccount,
  isSpecialAccount,
  isBalanceSheetAccount,
  isIncomeStatementAccount,
  hasNormalDebitBalance,
  hasNormalCreditBalance,
  getSubcategory
} from "../accounting/AccountNumber.ts"
