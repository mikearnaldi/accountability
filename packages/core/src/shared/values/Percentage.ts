/**
 * Percentage - Re-export from canonical location
 *
 * This file provides the new import path for Percentage while maintaining
 * backward compatibility during the core package reorganization.
 *
 * @module shared/values/Percentage
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
} from "../../Domains/Percentage.ts"
