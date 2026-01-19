/**
 * AccountBalance - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: accounting/AccountBalance.ts
 *
 * @module Domains/AccountBalance
 * @deprecated Import from "@accountability/core/accounting/AccountBalance" instead
 */

export {
  calculateBalance,
  calculatePeriodBalance,
  calculateYTDBalance,
  calculateBeginningBalance,
  calculateDebitCreditTotals,
  calculatePeriodDebitCreditTotals
} from "../accounting/AccountBalance.ts"

export type { JournalEntryWithLines } from "../accounting/AccountBalance.ts"
