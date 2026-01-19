/**
 * BalanceValidation - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: accounting/BalanceValidation.ts
 *
 * @module Domains/BalanceValidation
 * @deprecated Import from "@accountability/core/accounting/BalanceValidation" instead
 */

export {
  // Error classes
  UnbalancedEntryError,
  isUnbalancedEntryError,

  // Validation functions
  sumDebits,
  sumCredits,
  validateBalance,
  isBalanced,
  calculateDifference
} from "../accounting/BalanceValidation.ts"
