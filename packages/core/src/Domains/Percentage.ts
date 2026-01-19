/**
 * Percentage - Re-export for backward compatibility
 *
 * This file re-exports from the new canonical location in shared/values.
 * Use '@accountability/core/shared/values/Percentage' for new imports.
 *
 * @deprecated Import from '@accountability/core/shared/values/Percentage' instead
 * @module Domains/Percentage
 */

export {
  Percentage,
  isPercentage,
  ZERO,
  TWENTY,
  FIFTY,
  HUNDRED,
  toDecimal,
  fromDecimal,
  isZero,
  isFull,
  complement,
  format
} from "../shared/values/Percentage.ts"
