/**
 * ConsolidationMethodDetermination - Logic to determine consolidation method
 *
 * Per ASC 810, the consolidation method is determined based on ownership percentage
 * and Variable Interest Entity (VIE) status. This module provides a pure function
 * to determine the appropriate consolidation method.
 *
 * ASC 810 Rules:
 * - >50% ownership → FullConsolidation (control through majority voting interest)
 * - 20-50% ownership → EquityMethod (significant influence)
 * - <20% ownership → CostMethod (no significant influence)
 * - VIE primary beneficiary → FullConsolidation (regardless of ownership)
 *
 * @module ConsolidationMethodDetermination
 */

import type { ConsolidationMethod } from "../company/Company.ts"
import type { Percentage } from "../shared/values/Percentage.ts"

/**
 * Threshold for full consolidation (majority ownership)
 * Per ASC 810, >50% voting interest requires full consolidation
 */
export const FULL_CONSOLIDATION_THRESHOLD = 50

/**
 * Threshold for equity method (significant influence)
 * Per ASC 810, 20-50% ownership indicates significant influence
 */
export const EQUITY_METHOD_THRESHOLD = 20

/**
 * Determines the consolidation method based on ownership percentage and VIE status.
 *
 * Per ASC 810 (Consolidation):
 * 1. VIE primary beneficiary → FullConsolidation regardless of ownership
 * 2. >50% ownership → FullConsolidation
 * 3. 20-50% ownership → EquityMethod
 * 4. <20% ownership → CostMethod
 *
 * @param ownershipPct - Ownership percentage (0-100)
 * @param isVIEPrimaryBeneficiary - Whether the entity is the primary beneficiary of a VIE
 * @returns The appropriate ConsolidationMethod based on ASC 810
 *
 * @example
 * ```typescript
 * // VIE primary beneficiary always gets full consolidation
 * determineMethod(Percentage.make(10), true)  // → "FullConsolidation"
 *
 * // >50% ownership → Full consolidation
 * determineMethod(Percentage.make(80), false) // → "FullConsolidation"
 *
 * // 20-50% ownership → Equity method
 * determineMethod(Percentage.make(35), false) // → "EquityMethod"
 *
 * // <20% ownership → Cost method
 * determineMethod(Percentage.make(15), false) // → "CostMethod"
 * ```
 */
export const determineMethod = (
  ownershipPct: Percentage,
  isVIEPrimaryBeneficiary: boolean
): ConsolidationMethod => {
  // VIE primary beneficiary takes precedence over ownership percentage
  // Per ASC 810, if the entity is the primary beneficiary of a VIE,
  // it must consolidate the VIE regardless of voting interest
  if (isVIEPrimaryBeneficiary) {
    return "FullConsolidation"
  }

  // >50% ownership → Full consolidation (voting interest model)
  // Per ASC 810, controlling financial interest through majority voting
  // interest requires full consolidation
  if (ownershipPct > FULL_CONSOLIDATION_THRESHOLD) {
    return "FullConsolidation"
  }

  // 20-50% ownership → Equity method
  // Per ASC 810, significant influence (typically 20-50% ownership)
  // requires equity method accounting
  if (ownershipPct >= EQUITY_METHOD_THRESHOLD) {
    return "EquityMethod"
  }

  // <20% ownership → Cost method
  // Per ASC 810, investments without significant influence
  // are accounted for at cost
  return "CostMethod"
}

/**
 * Checks if the ownership percentage qualifies for full consolidation
 * (without considering VIE status).
 *
 * @param ownershipPct - Ownership percentage (0-100)
 * @returns true if >50% ownership
 */
export const isMajorityOwnership = (ownershipPct: Percentage): boolean =>
  ownershipPct > FULL_CONSOLIDATION_THRESHOLD

/**
 * Checks if the ownership percentage qualifies for significant influence
 * (equity method range).
 *
 * @param ownershipPct - Ownership percentage (0-100)
 * @returns true if 20-50% ownership (inclusive of 20%, exclusive of >50%)
 */
export const hasSignificantInfluence = (ownershipPct: Percentage): boolean =>
  ownershipPct >= EQUITY_METHOD_THRESHOLD && ownershipPct <= FULL_CONSOLIDATION_THRESHOLD

/**
 * Checks if the ownership percentage is below the significant influence threshold.
 *
 * @param ownershipPct - Ownership percentage (0-100)
 * @returns true if <20% ownership
 */
export const hasNoSignificantInfluence = (ownershipPct: Percentage): boolean =>
  ownershipPct < EQUITY_METHOD_THRESHOLD

/**
 * Returns the consolidation method for a VIE primary beneficiary.
 * This is always FullConsolidation per ASC 810.
 *
 * @returns "FullConsolidation"
 */
export const getVIEConsolidationMethod = (): ConsolidationMethod => "FullConsolidation"

/**
 * Determines if consolidation method should be VariableInterestEntity
 * based on VIE status. Use this when you want to track that the entity
 * is consolidated due to VIE status rather than voting interest.
 *
 * Note: The accounting treatment is the same as FullConsolidation,
 * but tracking as VariableInterestEntity provides disclosure information.
 *
 * @param ownershipPct - Ownership percentage (0-100)
 * @param isVIEPrimaryBeneficiary - Whether the entity is the primary beneficiary of a VIE
 * @returns The appropriate ConsolidationMethod, using "VariableInterestEntity"
 *          when the entity is a VIE primary beneficiary
 */
export const determineMethodWithVIETracking = (
  ownershipPct: Percentage,
  isVIEPrimaryBeneficiary: boolean
): ConsolidationMethod => {
  // VIE primary beneficiary → track as VariableInterestEntity for disclosure
  if (isVIEPrimaryBeneficiary) {
    return "VariableInterestEntity"
  }

  // Standard ownership-based determination
  if (ownershipPct > FULL_CONSOLIDATION_THRESHOLD) {
    return "FullConsolidation"
  }

  if (ownershipPct >= EQUITY_METHOD_THRESHOLD) {
    return "EquityMethod"
  }

  return "CostMethod"
}
