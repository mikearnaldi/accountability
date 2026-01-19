/**
 * MonetaryAmount - Re-export for backward compatibility
 *
 * This file re-exports from the new canonical location in shared/values.
 * Use '@accountability/core/shared/values/MonetaryAmount' for new imports.
 *
 * @deprecated Import from '@accountability/core/shared/values/MonetaryAmount' instead
 * @module Domains/MonetaryAmount
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
} from "../shared/values/MonetaryAmount.ts"
