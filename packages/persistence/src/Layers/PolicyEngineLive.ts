/**
 * PolicyEngineLive - Live implementation of the ABAC Policy Engine
 *
 * Provides policy evaluation using the matcher modules to check
 * subject, resource, action, and environment conditions.
 *
 * Evaluation logic:
 * 1. Filter to active policies only
 * 2. Sort by priority (highest first)
 * 3. Evaluate deny policies first - any match = immediate deny
 * 4. Evaluate allow policies - first match = allow
 * 5. Default deny if no allow policies match
 *
 * @module PolicyEngineLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import {
  PolicyEngine,
  type PolicyEngineShape,
  type PolicyEvaluationContext,
  type PolicyEvaluationResult,
  type PolicyMatchResult
} from "@accountability/core/authorization/PolicyEngine"
import type { AuthorizationPolicy } from "@accountability/core/authorization/AuthorizationPolicy"
import {
  matchesSubjectCondition,
  getSubjectMismatchReason
} from "@accountability/core/authorization/matchers/SubjectMatcher"
import {
  matchesResourceCondition,
  getResourceMismatchReason
} from "@accountability/core/authorization/matchers/ResourceMatcher"
import {
  matchesActionCondition
} from "@accountability/core/authorization/matchers/ActionMatcher"
import {
  matchesEnvironmentCondition,
  getEnvironmentMismatchReason
} from "@accountability/core/authorization/matchers/EnvironmentMatcher"

// =============================================================================
// Policy Evaluation Helpers
// =============================================================================

/**
 * Evaluate a single policy against a context
 *
 * A policy matches if ALL of its conditions match:
 * - Subject condition matches (if specified)
 * - Resource condition matches
 * - Action condition matches
 * - Environment condition matches (if specified)
 */
const evaluateSinglePolicy = (
  policy: AuthorizationPolicy,
  context: PolicyEvaluationContext
): PolicyMatchResult => {
  // Check subject condition
  const subjectMatches = matchesSubjectCondition(policy.subject, context.subject)
  if (!subjectMatches) {
    const reason = getSubjectMismatchReason(policy.subject, context.subject)
    return {
      policy,
      matched: false,
      mismatchReason: reason ?? "Subject condition did not match"
    }
  }

  // Check resource condition
  const resourceMatches = matchesResourceCondition(policy.resource, context.resource)
  if (!resourceMatches) {
    const reason = getResourceMismatchReason(policy.resource, context.resource)
    return {
      policy,
      matched: false,
      mismatchReason: reason ?? "Resource condition did not match"
    }
  }

  // Check action condition
  const actionMatches = matchesActionCondition(policy.action, context.action)
  if (!actionMatches) {
    return {
      policy,
      matched: false,
      mismatchReason: `Action '${context.action}' does not match condition actions: [${policy.action.actions.join(", ")}]`
    }
  }

  // Check environment condition (if specified)
  const maybeEnvironment = policy.environment
  if (Option.isSome(maybeEnvironment) && context.environment !== undefined) {
    const envMatches = matchesEnvironmentCondition(maybeEnvironment.value, context.environment)
    if (!envMatches) {
      const reason = getEnvironmentMismatchReason(maybeEnvironment.value, context.environment)
      return {
        policy,
        matched: false,
        mismatchReason: reason ?? "Environment condition did not match"
      }
    }
  } else if (Option.isSome(maybeEnvironment) && context.environment === undefined) {
    // Policy requires environment but none provided
    return {
      policy,
      matched: false,
      mismatchReason: "Policy has environment conditions but no environment context provided"
    }
  }

  // All conditions matched
  return {
    policy,
    matched: true
  }
}

/**
 * Sort policies by priority (highest first)
 * Deny policies with the same priority come before allow policies
 */
const sortPoliciesByPriority = (
  policies: readonly AuthorizationPolicy[]
): AuthorizationPolicy[] => {
  return [...policies].sort((a, b) => {
    // First sort by priority (descending)
    if (b.priority !== a.priority) {
      return b.priority - a.priority
    }
    // If same priority, deny policies come first
    if (a.effect !== b.effect) {
      return a.effect === "deny" ? -1 : 1
    }
    return 0
  })
}

/**
 * Filter to active policies only
 */
const filterActivePolicies = (
  policies: readonly AuthorizationPolicy[]
): AuthorizationPolicy[] => {
  return policies.filter((p) => p.isActive)
}

/**
 * Separate policies into deny and allow groups
 */
const separatePolicies = (
  policies: readonly AuthorizationPolicy[]
): { deny: AuthorizationPolicy[]; allow: AuthorizationPolicy[] } => {
  const deny: AuthorizationPolicy[] = []
  const allow: AuthorizationPolicy[] = []

  for (const policy of policies) {
    if (policy.effect === "deny") {
      deny.push(policy)
    } else {
      allow.push(policy)
    }
  }

  return { deny, allow }
}

// =============================================================================
// Service Implementation
// =============================================================================

const makePolicyEngine = (): PolicyEngineShape => {
  const evaluatePolicy = (
    policy: AuthorizationPolicy,
    context: PolicyEvaluationContext
  ): Effect.Effect<PolicyMatchResult> => {
    return Effect.succeed(evaluateSinglePolicy(policy, context))
  }

  const evaluatePolicies = (
    policies: readonly AuthorizationPolicy[],
    context: PolicyEvaluationContext
  ): Effect.Effect<PolicyEvaluationResult> => {
    return Effect.sync(() => {
      // Step 1: Filter to active policies
      const activePolicies = filterActivePolicies(policies)

      // If no active policies, default deny
      if (activePolicies.length === 0) {
        return {
          decision: "deny" as const,
          matchedPolicies: [],
          reason: "No active policies found - default deny",
          deniedByPolicy: false,
          defaultDeny: true
        }
      }

      // Step 2: Sort by priority
      const sortedPolicies = sortPoliciesByPriority(activePolicies)

      // Step 3: Separate into deny and allow
      const { deny: denyPolicies, allow: allowPolicies } = separatePolicies(sortedPolicies)

      // Step 4: Evaluate deny policies first
      // Any matching deny policy results in immediate denial
      for (const policy of denyPolicies) {
        const result = evaluateSinglePolicy(policy, context)
        if (result.matched) {
          return {
            decision: "deny" as const,
            matchedPolicies: [policy],
            reason: `Denied by policy: ${policy.name}`,
            deniedByPolicy: true,
            defaultDeny: false
          }
        }
      }

      // Step 5: Evaluate allow policies
      // First matching allow policy results in allow
      const matchedAllowPolicies: AuthorizationPolicy[] = []
      for (const policy of allowPolicies) {
        const result = evaluateSinglePolicy(policy, context)
        if (result.matched) {
          matchedAllowPolicies.push(policy)
          // Return on first match (already sorted by priority)
          return {
            decision: "allow" as const,
            matchedPolicies: matchedAllowPolicies,
            reason: `Allowed by policy: ${policy.name}`,
            deniedByPolicy: false,
            defaultDeny: false
          }
        }
      }

      // Step 6: Default deny if no allow policies matched
      return {
        decision: "deny" as const,
        matchedPolicies: [],
        reason: "No matching allow policy found - default deny",
        deniedByPolicy: false,
        defaultDeny: true
      }
    })
  }

  const wouldDeny = (
    policies: readonly AuthorizationPolicy[],
    context: PolicyEvaluationContext
  ): Effect.Effect<boolean> => {
    return Effect.sync(() => {
      const activePolicies = filterActivePolicies(policies)
      const { deny: denyPolicies } = separatePolicies(activePolicies)

      for (const policy of denyPolicies) {
        const result = evaluateSinglePolicy(policy, context)
        if (result.matched) {
          return true
        }
      }

      return false
    })
  }

  const findMatchingPolicies = (
    policies: readonly AuthorizationPolicy[],
    context: PolicyEvaluationContext
  ): Effect.Effect<readonly PolicyMatchResult[]> => {
    return Effect.sync(() => {
      const activePolicies = filterActivePolicies(policies)
      const results: PolicyMatchResult[] = []

      for (const policy of activePolicies) {
        const result = evaluateSinglePolicy(policy, context)
        if (result.matched) {
          results.push(result)
        }
      }

      return results
    })
  }

  return {
    evaluatePolicy,
    evaluatePolicies,
    wouldDeny,
    findMatchingPolicies
  }
}

// =============================================================================
// Layer
// =============================================================================

/**
 * PolicyEngineLive - Live layer for the policy engine service
 *
 * This layer has no dependencies - it uses pure functions from the matchers.
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const policyEngine = yield* PolicyEngine
 *   const result = yield* policyEngine.evaluatePolicies(policies, context)
 * })
 *
 * program.pipe(Effect.provide(PolicyEngineLive))
 * ```
 */
export const PolicyEngineLive: Layer.Layer<PolicyEngine> = Layer.succeed(
  PolicyEngine,
  makePolicyEngine()
)
