/**
 * PolicyEngine - Re-export from canonical location
 *
 * This file re-exports PolicyEngine from the authorization domain
 * for backward compatibility. Import from @accountability/core/authorization/PolicyEngine
 * for new code.
 *
 * @deprecated Import from @accountability/core/authorization/PolicyEngine instead
 * @module Auth/PolicyEngine
 */

export {
  type PolicyMatchResult,
  type PolicyDecision,
  type PolicyEvaluationResult,
  type PolicyEvaluationContext,
  type PolicyEngineShape,
  PolicyEngine
} from "../authorization/PolicyEngine.ts"
