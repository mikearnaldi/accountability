/**
 * PolicyEngine - Re-export from canonical location
 *
 * This file provides the new import path for PolicyEngine
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/PolicyEngine
 */

export {
  type PolicyMatchResult,
  type PolicyDecision,
  type PolicyEvaluationResult,
  type PolicyEvaluationContext,
  type PolicyEngineShape,
  PolicyEngine
} from "../Auth/PolicyEngine.ts"
