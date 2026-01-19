/**
 * AccountValidation - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: accounting/AccountValidation.ts
 *
 * @module Domains/AccountValidation
 * @deprecated Import from "@accountability/core/accounting/AccountValidation" instead
 */

export {
  // Error classes
  AccountNumberRangeError,
  isAccountNumberRangeError,
  NormalBalanceError,
  isNormalBalanceError,
  IntercompanyPartnerMissingError,
  isIntercompanyPartnerMissingError,
  UnexpectedIntercompanyPartnerError,
  isUnexpectedIntercompanyPartnerError,
  CashFlowCategoryOnIncomeStatementError,
  isCashFlowCategoryOnIncomeStatementError,

  // Validation functions
  validateAccountNumberRange,
  validateNormalBalance,
  validateIntercompanyConfiguration,
  validateCashFlowCategory,
  validateAccount,
  validateAccounts,
  isValidAccount,
  getValidationErrors
} from "../accounting/AccountValidation.ts"

export type { AccountValidationError } from "../accounting/AccountValidation.ts"
