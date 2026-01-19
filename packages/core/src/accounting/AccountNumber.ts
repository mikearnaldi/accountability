/**
 * AccountNumber - Re-export from canonical location
 *
 * This file provides the new import path for AccountNumber value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module accounting/AccountNumber
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
} from "../Domains/AccountNumber.ts"
