/**
 * PolicyEffect - Re-export from canonical location
 *
 * This file provides the new import path for PolicyEffect value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/PolicyEffect
 */

export {
  PolicyEffect,
  type PolicyEffect as PolicyEffectType,
  isPolicyEffect,
  PolicyEffectValues
} from "../Auth/PolicyEffect.ts"
