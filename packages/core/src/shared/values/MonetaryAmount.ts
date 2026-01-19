/**
 * MonetaryAmount - Re-export from canonical location
 *
 * This file provides the new import path for MonetaryAmount while maintaining
 * backward compatibility during the core package reorganization.
 *
 * @module shared/values/MonetaryAmount
 */

export {
  CurrencyMismatchError,
  DivisionByZeroError,
  isCurrencyMismatchError,
  isDivisionByZeroError,
  type MonetaryAmountError,
  MonetaryAmount,
  isMonetaryAmount,
  add,
  subtract,
  multiply,
  multiplyByNumber,
  divide,
  divideByNumber,
  unsafeDivide,
  compare,
  greaterThan,
  lessThan,
  greaterThanOrEqualTo,
  lessThanOrEqualTo,
  equals,
  sum,
  round,
  max,
  min
} from "../../Domains/MonetaryAmount.ts"
