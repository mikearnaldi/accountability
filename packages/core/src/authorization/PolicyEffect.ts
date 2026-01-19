/**
 * PolicyEffect - Effect of an authorization policy
 *
 * Defines what happens when a policy matches:
 * - 'allow': Grant access if this policy matches
 * - 'deny': Deny access if this policy matches (takes precedence)
 *
 * @module authorization/PolicyEffect
 */

import * as Schema from "effect/Schema"

/**
 * PolicyEffect - The effect of a policy when it matches
 */
export const PolicyEffect = Schema.Literal("allow", "deny").annotations({
  identifier: "PolicyEffect",
  title: "Policy Effect",
  description: "The effect when an authorization policy matches"
})

/**
 * The PolicyEffect type
 */
export type PolicyEffect = typeof PolicyEffect.Type

/**
 * Type guard for PolicyEffect using Schema.is
 */
export const isPolicyEffect = Schema.is(PolicyEffect)

/**
 * All valid PolicyEffect values
 */
export const PolicyEffectValues: readonly PolicyEffect[] = [
  "allow",
  "deny"
] as const
