/**
 * PolicyEffect - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location for this module is now: authorization/PolicyEffect.ts
 *
 * @module Auth/PolicyEffect
 * @deprecated Import from "@accountability/core/authorization/PolicyEffect" instead
 */

export {
  PolicyEffect,
  type PolicyEffect as PolicyEffectType,
  isPolicyEffect,
  PolicyEffectValues
} from "../authorization/PolicyEffect.ts"
