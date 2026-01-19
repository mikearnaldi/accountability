/**
 * PolicyEngine Unit Tests
 *
 * Tests for the ABAC Policy Engine, covering:
 * - Single policy evaluation
 * - Multiple policy evaluation with priority
 * - Deny policy precedence
 * - Default deny behavior
 * - Environment condition handling
 */

import { describe, it, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { PolicyEngineLive } from "../src/Layers/PolicyEngineLive.ts"
import {
  PolicyEngine,
  type PolicyEvaluationContext
} from "@accountability/core/authorization/PolicyEngine"
import { AuthorizationPolicy } from "@accountability/core/authorization/AuthorizationPolicy"
import type { SubjectContext } from "@accountability/core/authorization/matchers/SubjectMatcher"
import type { ResourceContext } from "@accountability/core/authorization/matchers/ResourceMatcher"
import type { EnvironmentContext } from "@accountability/core/authorization/matchers/EnvironmentMatcher"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { PolicyId } from "@accountability/core/authorization/PolicyId"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import type { EnvironmentCondition } from "@accountability/core/authorization/PolicyConditions"

// =============================================================================
// Test Helpers
// =============================================================================

const makeUserId = (): AuthUserId => AuthUserId.make(crypto.randomUUID())
const makeOrgId = (): OrganizationId => OrganizationId.make(crypto.randomUUID())
const makePolicyId = (): PolicyId => PolicyId.make(crypto.randomUUID())

const makePolicy = (
  overrides: Partial<{
    name: string
    effect: "allow" | "deny"
    priority: number
    isActive: boolean
    isSystemPolicy: boolean
    subject: AuthorizationPolicy["subject"]
    resource: AuthorizationPolicy["resource"]
    action: AuthorizationPolicy["action"]
    environment: EnvironmentCondition
  }> = {}
): AuthorizationPolicy => {
  const now = Timestamp.now()
  return AuthorizationPolicy.make({
    id: makePolicyId(),
    organizationId: makeOrgId(),
    name: overrides.name ?? "Test Policy",
    description: Option.none(),
    subject: overrides.subject ?? {},
    resource: overrides.resource ?? { type: "*" },
    action: overrides.action ?? { actions: ["*"] },
    environment: overrides.environment !== undefined
      ? Option.some(overrides.environment)
      : Option.none(),
    effect: overrides.effect ?? "allow",
    priority: overrides.priority ?? 500,
    isSystemPolicy: overrides.isSystemPolicy ?? false,
    isActive: overrides.isActive ?? true,
    createdAt: now,
    updatedAt: now,
    createdBy: Option.none()
  })
}

const makeSubjectContext = (
  overrides: Partial<SubjectContext> = {}
): SubjectContext => ({
  userId: overrides.userId ?? makeUserId(),
  role: overrides.role ?? "member",
  functionalRoles: overrides.functionalRoles ?? [],
  isPlatformAdmin: overrides.isPlatformAdmin ?? false
})

const makeResourceContext = (
  overrides: Partial<ResourceContext> = {}
): ResourceContext => ({
  type: overrides.type ?? "company",
  ...overrides
})

const makeEnvironmentContext = (
  overrides: Partial<EnvironmentContext> = {}
): EnvironmentContext => ({
  currentTime: overrides.currentTime ?? "12:00",
  currentDayOfWeek: overrides.currentDayOfWeek ?? 3, // Wednesday
  ...(overrides.ipAddress !== undefined ? { ipAddress: overrides.ipAddress } : {})
})

const makeContext = (
  overrides: Partial<{
    subject: Partial<SubjectContext>
    resource: Partial<ResourceContext>
    action: PolicyEvaluationContext["action"]
    environment: Partial<EnvironmentContext>
  }> = {}
): PolicyEvaluationContext => ({
  subject: makeSubjectContext(overrides.subject),
  resource: makeResourceContext(overrides.resource),
  action: overrides.action ?? "company:read",
  ...(overrides.environment !== undefined
    ? { environment: makeEnvironmentContext(overrides.environment) }
    : {})
})

// =============================================================================
// Tests
// =============================================================================

describe("PolicyEngine", () => {
  describe("evaluatePolicy", () => {
    it.effect("should match a wildcard allow policy", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Allow All",
          effect: "allow",
          subject: {},
          resource: { type: "*" },
          action: { actions: ["*"] }
        })
        const context = makeContext()

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
        expect(result.mismatchReason).toBeUndefined()
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when subject role doesn't match", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Admin Only",
          subject: { roles: ["admin", "owner"] },
          resource: { type: "*" },
          action: { actions: ["*"] }
        })
        const context = makeContext({
          subject: { role: "member" }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("role")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should match when subject role matches", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Admin Only",
          subject: { roles: ["admin", "owner"] },
          resource: { type: "*" },
          action: { actions: ["*"] }
        })
        const context = makeContext({
          subject: { role: "admin" }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when resource type doesn't match", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Journal Entry Only",
          resource: { type: "journal_entry" },
          action: { actions: ["*"] }
        })
        const context = makeContext({
          resource: { type: "company" }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("Resource type")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should match when resource type matches", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Journal Entry Only",
          resource: { type: "journal_entry" },
          action: { actions: ["*"] }
        })
        const context = makeContext({
          resource: { type: "journal_entry" }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when action doesn't match", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Read Only",
          action: { actions: ["company:read", "account:read"] }
        })
        const context = makeContext({
          action: "company:create"
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("Action")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should match when action matches", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Read Only",
          action: { actions: ["company:read", "account:read"] }
        })
        const context = makeContext({
          action: "company:read"
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when environment condition fails", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Weekday Only",
          environment: { daysOfWeek: [1, 2, 3, 4, 5] } // Monday-Friday
        })
        const context = makeContext({
          environment: { currentDayOfWeek: 0 } // Sunday
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("day")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should match when environment condition passes", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Weekday Only",
          environment: { daysOfWeek: [1, 2, 3, 4, 5] } // Monday-Friday
        })
        const context = makeContext({
          environment: { currentDayOfWeek: 3 } // Wednesday
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when policy has environment but context doesn't", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Weekday Only",
          environment: { daysOfWeek: [1, 2, 3, 4, 5] }
        })
        const context = makeContext() // No environment context

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("environment")
      }).pipe(Effect.provide(PolicyEngineLive))
    )
  })

  describe("evaluatePolicies", () => {
    it.effect("should return default deny when no policies", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const context = makeContext()

        const result = yield* engine.evaluatePolicies([], context)

        expect(result.decision).toBe("deny")
        expect(result.defaultDeny).toBe(true)
        expect(result.deniedByPolicy).toBe(false)
        expect(result.matchedPolicies).toHaveLength(0)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should return default deny when only inactive policies", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Inactive Allow", isActive: false })
        ]
        const context = makeContext()

        const result = yield* engine.evaluatePolicies(policies, context)

        expect(result.decision).toBe("deny")
        expect(result.defaultDeny).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should allow when a matching allow policy exists", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Allow All", effect: "allow" })
        ]
        const context = makeContext()

        const result = yield* engine.evaluatePolicies(policies, context)

        expect(result.decision).toBe("allow")
        expect(result.deniedByPolicy).toBe(false)
        expect(result.defaultDeny).toBe(false)
        expect(result.matchedPolicies).toHaveLength(1)
        expect(result.matchedPolicies[0]?.name).toBe("Allow All")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should deny when a matching deny policy exists", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Allow All", effect: "allow", priority: 500 }),
          makePolicy({ name: "Deny Members", effect: "deny", priority: 600, subject: { roles: ["member"] } })
        ]
        const context = makeContext({ subject: { role: "member" } })

        const result = yield* engine.evaluatePolicies(policies, context)

        expect(result.decision).toBe("deny")
        expect(result.deniedByPolicy).toBe(true)
        expect(result.defaultDeny).toBe(false)
        expect(result.matchedPolicies).toHaveLength(1)
        expect(result.matchedPolicies[0]?.name).toBe("Deny Members")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should respect policy priority - higher priority first", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Low Priority Allow", effect: "allow", priority: 100, subject: { roles: ["admin"] } }),
          makePolicy({ name: "High Priority Allow", effect: "allow", priority: 900, subject: { roles: ["admin"] } })
        ]
        const context = makeContext({ subject: { role: "admin" } })

        const result = yield* engine.evaluatePolicies(policies, context)

        expect(result.decision).toBe("allow")
        expect(result.matchedPolicies[0]?.name).toBe("High Priority Allow")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should evaluate deny policies before allow policies at same priority", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Allow", effect: "allow", priority: 500 }),
          makePolicy({ name: "Deny", effect: "deny", priority: 500 })
        ]
        const context = makeContext()

        const result = yield* engine.evaluatePolicies(policies, context)

        expect(result.decision).toBe("deny")
        expect(result.deniedByPolicy).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should return default deny when no allow policy matches", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({
            name: "Admin Only",
            effect: "allow",
            subject: { roles: ["admin"] }
          })
        ]
        const context = makeContext({ subject: { role: "member" } })

        const result = yield* engine.evaluatePolicies(policies, context)

        expect(result.decision).toBe("deny")
        expect(result.defaultDeny).toBe(true)
        expect(result.deniedByPolicy).toBe(false)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should allow when deny policy doesn't match but allow policy does", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({
            name: "Deny Viewers",
            effect: "deny",
            priority: 600,
            subject: { roles: ["viewer"] }
          }),
          makePolicy({
            name: "Allow Members",
            effect: "allow",
            priority: 500,
            subject: { roles: ["member"] }
          })
        ]
        const context = makeContext({ subject: { role: "member" } })

        const result = yield* engine.evaluatePolicies(policies, context)

        expect(result.decision).toBe("allow")
        expect(result.matchedPolicies[0]?.name).toBe("Allow Members")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should handle complex policy combinations - deny policies always evaluated first", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          // Deny locked period modifications - this will block even platform admins
          // because deny policies are evaluated first regardless of priority
          makePolicy({
            name: "Locked Period Deny",
            effect: "deny",
            priority: 100, // Lower priority but still blocks because deny is first
            resource: { type: "journal_entry", attributes: { periodStatus: ["Locked"] } },
            action: { actions: ["journal_entry:create", "journal_entry:update"] }
          }),
          // Owner full access
          makePolicy({
            name: "Owner Full Access",
            effect: "allow",
            priority: 900,
            subject: { roles: ["owner"] }
          }),
          // Admin full access
          makePolicy({
            name: "Admin Full Access",
            effect: "allow",
            priority: 800,
            subject: { roles: ["admin"] }
          }),
          // Accountant journal entry access
          makePolicy({
            name: "Accountant JE Access",
            effect: "allow",
            priority: 500,
            subject: { functionalRoles: ["accountant"] },
            resource: { type: "journal_entry" },
            action: { actions: ["journal_entry:create", "journal_entry:update", "journal_entry:read"] }
          })
        ]

        // Test 1: Even owner should be denied in locked period (deny policies evaluated first)
        const ownerLockedContext = makeContext({
          subject: { role: "owner" },
          resource: { type: "journal_entry", periodStatus: "Locked" },
          action: "journal_entry:create"
        })
        const result1 = yield* engine.evaluatePolicies(policies, ownerLockedContext)
        expect(result1.decision).toBe("deny")
        expect(result1.deniedByPolicy).toBe(true)
        expect(result1.matchedPolicies[0]?.name).toBe("Locked Period Deny")

        // Test 2: Regular accountant should be denied in locked period
        const accountantLockedContext = makeContext({
          subject: { role: "member", functionalRoles: ["accountant"] },
          resource: { type: "journal_entry", periodStatus: "Locked" },
          action: "journal_entry:create"
        })
        const result2 = yield* engine.evaluatePolicies(policies, accountantLockedContext)
        expect(result2.decision).toBe("deny")
        expect(result2.deniedByPolicy).toBe(true)

        // Test 3: Accountant should be allowed in open period (deny doesn't match)
        const accountantOpenContext = makeContext({
          subject: { role: "member", functionalRoles: ["accountant"] },
          resource: { type: "journal_entry", periodStatus: "Open" },
          action: "journal_entry:create"
        })
        const result3 = yield* engine.evaluatePolicies(policies, accountantOpenContext)
        expect(result3.decision).toBe("allow")
        expect(result3.matchedPolicies[0]?.name).toBe("Accountant JE Access")

        // Test 4: Owner should have full access for non-locked resources
        const ownerContext = makeContext({
          subject: { role: "owner" },
          resource: { type: "company" },
          action: "company:delete"
        })
        const result4 = yield* engine.evaluatePolicies(policies, ownerContext)
        expect(result4.decision).toBe("allow")
        expect(result4.matchedPolicies[0]?.name).toBe("Owner Full Access")

        // Test 5: Owner can read locked periods (deny only blocks create/update)
        const ownerReadLockedContext = makeContext({
          subject: { role: "owner" },
          resource: { type: "journal_entry", periodStatus: "Locked" },
          action: "journal_entry:read"
        })
        const result5 = yield* engine.evaluatePolicies(policies, ownerReadLockedContext)
        expect(result5.decision).toBe("allow")
        expect(result5.matchedPolicies[0]?.name).toBe("Owner Full Access")
      }).pipe(Effect.provide(PolicyEngineLive))
    )
  })

  describe("wouldDeny", () => {
    it.effect("should return false when no deny policies match", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Allow All", effect: "allow" })
        ]
        const context = makeContext()

        const wouldBeDenied = yield* engine.wouldDeny(policies, context)

        expect(wouldBeDenied).toBe(false)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should return true when a deny policy matches", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Allow All", effect: "allow" }),
          makePolicy({ name: "Deny Members", effect: "deny", subject: { roles: ["member"] } })
        ]
        const context = makeContext({ subject: { role: "member" } })

        const wouldBeDenied = yield* engine.wouldDeny(policies, context)

        expect(wouldBeDenied).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should return false when deny policy doesn't match", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Deny Viewers", effect: "deny", subject: { roles: ["viewer"] } })
        ]
        const context = makeContext({ subject: { role: "member" } })

        const wouldBeDenied = yield* engine.wouldDeny(policies, context)

        expect(wouldBeDenied).toBe(false)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should ignore inactive deny policies", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Inactive Deny", effect: "deny", isActive: false })
        ]
        const context = makeContext()

        const wouldBeDenied = yield* engine.wouldDeny(policies, context)

        expect(wouldBeDenied).toBe(false)
      }).pipe(Effect.provide(PolicyEngineLive))
    )
  })

  describe("findMatchingPolicies", () => {
    it.effect("should return empty array when no policies match", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({
            name: "Admin Only",
            subject: { roles: ["admin"] }
          })
        ]
        const context = makeContext({ subject: { role: "member" } })

        const results = yield* engine.findMatchingPolicies(policies, context)

        expect(results).toHaveLength(0)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should return all matching policies", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({
            name: "Allow All Read",
            action: { actions: ["company:read", "account:read"] }
          }),
          makePolicy({
            name: "Allow Company Access",
            resource: { type: "company" }
          }),
          makePolicy({
            name: "Admin Only",
            subject: { roles: ["admin"] }
          })
        ]
        const context = makeContext({
          subject: { role: "member" },
          resource: { type: "company" },
          action: "company:read"
        })

        const results = yield* engine.findMatchingPolicies(policies, context)

        expect(results).toHaveLength(2)
        const policyNames = results.map((r) => r.policy.name)
        expect(policyNames).toContain("Allow All Read")
        expect(policyNames).toContain("Allow Company Access")
        expect(policyNames).not.toContain("Admin Only")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should return both allow and deny matching policies", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({
            name: "Allow Access",
            effect: "allow"
          }),
          makePolicy({
            name: "Deny Access",
            effect: "deny"
          })
        ]
        const context = makeContext()

        const results = yield* engine.findMatchingPolicies(policies, context)

        expect(results).toHaveLength(2)
        const effects = results.map((r) => r.policy.effect)
        expect(effects).toContain("allow")
        expect(effects).toContain("deny")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should ignore inactive policies", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policies = [
          makePolicy({ name: "Active Policy", isActive: true }),
          makePolicy({ name: "Inactive Policy", isActive: false })
        ]
        const context = makeContext()

        const results = yield* engine.findMatchingPolicies(policies, context)

        expect(results).toHaveLength(1)
        expect(results[0]?.policy.name).toBe("Active Policy")
      }).pipe(Effect.provide(PolicyEngineLive))
    )
  })

  describe("functional role matching", () => {
    it.effect("should match when user has required functional role", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Accountant JE Access",
          subject: { functionalRoles: ["accountant", "controller"] },
          resource: { type: "journal_entry" },
          action: { actions: ["journal_entry:create"] }
        })
        const context = makeContext({
          subject: { role: "member", functionalRoles: ["accountant"] },
          resource: { type: "journal_entry" },
          action: "journal_entry:create"
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when user lacks required functional role", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Controller Only",
          subject: { functionalRoles: ["controller"] }
        })
        const context = makeContext({
          subject: { role: "member", functionalRoles: ["accountant"] }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("functional role")
      }).pipe(Effect.provide(PolicyEngineLive))
    )
  })

  describe("resource attribute matching", () => {
    it.effect("should match when account number is in range", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Asset Accounts Only",
          resource: {
            type: "account",
            attributes: { accountNumber: { range: [1000, 1999] } }
          }
        })
        const context = makeContext({
          resource: { type: "account", accountNumber: 1500 }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when account number is outside range", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Asset Accounts Only",
          resource: {
            type: "account",
            attributes: { accountNumber: { range: [1000, 1999] } }
          }
        })
        const context = makeContext({
          resource: { type: "account", accountNumber: 2500 }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("Account number")
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should match when account type is in allowed list", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Balance Sheet Accounts",
          resource: {
            type: "account",
            attributes: { accountType: ["Asset", "Liability", "Equity"] }
          }
        })
        const context = makeContext({
          resource: { type: "account", accountType: "Asset" }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )

    it.effect("should not match when account type is not in allowed list", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Balance Sheet Accounts",
          resource: {
            type: "account",
            attributes: { accountType: ["Asset", "Liability", "Equity"] }
          }
        })
        const context = makeContext({
          resource: { type: "account", accountType: "Revenue" }
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(false)
        expect(result.mismatchReason).toContain("Account type")
      }).pipe(Effect.provide(PolicyEngineLive))
    )
  })

  describe("action wildcard matching", () => {
    it.effect("should match global wildcard", () =>
      Effect.gen(function* () {
        const engine = yield* PolicyEngine
        const policy = makePolicy({
          name: "Full Access",
          action: { actions: ["*"] }
        })
        const context = makeContext({
          action: "journal_entry:post"
        })

        const result = yield* engine.evaluatePolicy(policy, context)

        expect(result.matched).toBe(true)
      }).pipe(Effect.provide(PolicyEngineLive))
    )
  })
})
