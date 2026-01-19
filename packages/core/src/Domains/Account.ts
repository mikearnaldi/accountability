/**
 * Account - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: accounting/Account.ts
 *
 * @module Domains/Account
 * @deprecated Import from "@accountability/core/accounting/Account" instead
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
} from "../accounting/Account.ts"
