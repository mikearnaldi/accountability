/**
 * Account - Re-export from canonical location
 *
 * This file provides the new import path for Account domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module accounting/Account
 */

export {
  // AccountId
  AccountId,
  isAccountId,

  // AccountType
  AccountType,
  isAccountType,

  // AccountCategory
  AccountCategory,
  isAccountCategory,

  // NormalBalance
  NormalBalance,
  isNormalBalance,

  // CashFlowCategory
  CashFlowCategory,
  isCashFlowCategory,

  // Helper functions
  getAccountTypeForCategory,
  getCategoriesForType,
  getNormalBalanceForType,

  // Account class
  Account,
  isAccount
} from "../Domains/Account.ts"
