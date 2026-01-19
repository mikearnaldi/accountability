/**
 * PolicyEngine - ABAC Policy Evaluation Engine
 *
 * Provides functions to evaluate authorization policies against request contexts.
 * The engine evaluates policies using the following logic:
 *
 * 1. Filter to active policies only
 * 2. Evaluate deny policies first (any match = immediate deny)
 * 3. Evaluate allow policies by priority (highest first)
 * 4. Default deny if no policies match
 *
 * @module authorization/PolicyEngine
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { AuthorizationPolicy } from "./AuthorizationPolicy.ts"
import type { SubjectContext } from "./matchers/SubjectMatcher.ts"
import type { ResourceContext } from "./matchers/ResourceMatcher.ts"
import type { EnvironmentContext } from "./matchers/EnvironmentMatcher.ts"
import type { Action } from "./Action.ts"

// =============================================================================
// Types
// =============================================================================

/**
 * The result of evaluating a single policy
 */
export interface PolicyMatchResult {
  /**
   * The policy that was evaluated
   */
  readonly policy: AuthorizationPolicy

  /**
   * Whether the policy matched all conditions
   */
  readonly matched: boolean

  /**
   * Reason for match failure (if not matched)
   */
  readonly mismatchReason?: string
}

/**
 * The decision from evaluating all policies
 */
export type PolicyDecision = "allow" | "deny"

/**
 * The result of evaluating policies for an authorization request
 */
export interface PolicyEvaluationResult {
  /**
   * The final decision (allow or deny)
   */
  readonly decision: PolicyDecision

  /**
   * Policies that matched and influenced the decision
   */
  readonly matchedPolicies: readonly AuthorizationPolicy[]

  /**
   * Human-readable reason for the decision
   */
  readonly reason: string

  /**
   * Whether the decision was made by a deny policy
   */
  readonly deniedByPolicy: boolean

  /**
   * Whether the decision defaulted to deny (no matching allow policies)
   */
  readonly defaultDeny: boolean
}

/**
 * Context for policy evaluation
 */
export interface PolicyEvaluationContext {
  /**
   * The subject (user) context
   */
  readonly subject: SubjectContext

  /**
   * The resource being accessed
   */
  readonly resource: ResourceContext

  /**
   * The action being performed
   */
  readonly action: Action

  /**
   * Optional environment context
   */
  readonly environment?: EnvironmentContext
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * PolicyEngineShape - The shape of the policy engine service
 *
 * Provides functions for evaluating ABAC policies against request contexts.
 */
export interface PolicyEngineShape {
  /**
   * Evaluate a single policy against a context
   *
   * @param policy - The policy to evaluate
   * @param context - The evaluation context
   * @returns PolicyMatchResult indicating if the policy matched
   */
  readonly evaluatePolicy: (
    policy: AuthorizationPolicy,
    context: PolicyEvaluationContext
  ) => Effect.Effect<PolicyMatchResult>

  /**
   * Evaluate multiple policies against a context
   *
   * Logic:
   * 1. Filter to active policies only
   * 2. Sort by priority (highest first)
   * 3. Evaluate deny policies first - any match = immediate deny
   * 4. Evaluate allow policies - first match wins
   * 5. Default deny if no allow policies match
   *
   * @param policies - The policies to evaluate
   * @param context - The evaluation context
   * @returns PolicyEvaluationResult with decision and matched policies
   */
  readonly evaluatePolicies: (
    policies: readonly AuthorizationPolicy[],
    context: PolicyEvaluationContext
  ) => Effect.Effect<PolicyEvaluationResult>

  /**
   * Check if any of the given policies would deny the request
   *
   * Useful for quickly checking if a deny policy would block access
   * without full evaluation.
   *
   * @param policies - The policies to check
   * @param context - The evaluation context
   * @returns true if any deny policy matches
   */
  readonly wouldDeny: (
    policies: readonly AuthorizationPolicy[],
    context: PolicyEvaluationContext
  ) => Effect.Effect<boolean>

  /**
   * Find all policies that match a given context
   *
   * Returns all matching policies regardless of effect (allow/deny).
   * Useful for debugging and policy testing.
   *
   * @param policies - The policies to check
   * @param context - The evaluation context
   * @returns Array of matching policies with their results
   */
  readonly findMatchingPolicies: (
    policies: readonly AuthorizationPolicy[],
    context: PolicyEvaluationContext
  ) => Effect.Effect<readonly PolicyMatchResult[]>
}

/**
 * PolicyEngine - Context.Tag for the policy engine service
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const policyEngine = yield* PolicyEngine
 *
 *   const context: PolicyEvaluationContext = {
 *     subject: { userId, role: "member", functionalRoles: ["accountant"], isPlatformAdmin: false },
 *     resource: { type: "journal_entry" },
 *     action: "journal_entry:create"
 *   }
 *
 *   const result = yield* policyEngine.evaluatePolicies(policies, context)
 *   if (result.decision === "deny") {
 *     // Access denied
 *   }
 * })
 * ```
 */
export class PolicyEngine extends Context.Tag("PolicyEngine")<
  PolicyEngine,
  PolicyEngineShape
>() {}
