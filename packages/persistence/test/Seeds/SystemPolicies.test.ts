/**
 * SystemPolicies.test.ts - Tests for system policies seeding
 *
 * Tests the generation and seeding of the 8 system policies:
 * 1. Platform Admin Full Access
 * 2. Organization Owner Full Access
 * 3. Viewer Read-Only Access
 * 4. Locked Period Protection
 * 5. Closed Period Protection
 * 6. Future Period Protection
 * 7. SoftClose Controller Access
 * 8. SoftClose Default Deny
 *
 * @module SystemPolicies.test
 */

import { describe, it, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { SYSTEM_POLICY_PRIORITIES } from "@accountability/core/authorization/AuthorizationPolicy"
import {
  createSystemPoliciesForOrganization,
  seedSystemPolicies,
  hasSystemPolicies
} from "../../src/Seeds/SystemPolicies.ts"
import type { CreatePolicyInput } from "../../src/Services/PolicyRepository.ts"

describe("SystemPolicies", () => {
  const testOrgId = OrganizationId.make("11111111-1111-1111-1111-111111111111")

  describe("createSystemPoliciesForOrganization", () => {
    it("should create exactly 8 system policies", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      expect(policies.length).toBe(8)
    })

    it("should set all policies as system policies", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      for (const policy of policies) {
        expect(policy.isSystemPolicy).toBe(true)
      }
    })

    it("should set all policies as active", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      for (const policy of policies) {
        expect(policy.isActive).toBe(true)
      }
    })

    it("should use the correct organization ID for all policies", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      for (const policy of policies) {
        expect(policy.organizationId).toBe(testOrgId)
      }
    })

    it("should create Platform Admin Full Access policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const platformAdminPolicy = policies.find(
        (p) => p.name === "Platform Admin Full Access"
      )

      expect(platformAdminPolicy).toBeDefined()
      expect(platformAdminPolicy!.priority).toBe(
        SYSTEM_POLICY_PRIORITIES.PLATFORM_ADMIN_OVERRIDE
      )
      expect(platformAdminPolicy!.effect).toBe("allow")
      expect(platformAdminPolicy!.subject.isPlatformAdmin).toBe(true)
      expect(platformAdminPolicy!.resource.type).toBe("*")
      expect(platformAdminPolicy!.action.actions).toEqual(["*"])
    })

    it("should create Organization Owner Full Access policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const ownerPolicy = policies.find(
        (p) => p.name === "Organization Owner Full Access"
      )

      expect(ownerPolicy).toBeDefined()
      expect(ownerPolicy!.priority).toBe(SYSTEM_POLICY_PRIORITIES.OWNER_FULL_ACCESS)
      expect(ownerPolicy!.effect).toBe("allow")
      expect(ownerPolicy!.subject.roles).toEqual(["owner"])
      expect(ownerPolicy!.resource.type).toBe("*")
      expect(ownerPolicy!.action.actions).toEqual(["*"])
    })

    it("should create Viewer Read-Only Access policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const viewerPolicy = policies.find(
        (p) => p.name === "Viewer Read-Only Access"
      )

      expect(viewerPolicy).toBeDefined()
      expect(viewerPolicy!.priority).toBe(SYSTEM_POLICY_PRIORITIES.VIEWER_READ_ONLY)
      expect(viewerPolicy!.effect).toBe("allow")
      expect(viewerPolicy!.subject.roles).toEqual(["viewer"])
      expect(viewerPolicy!.resource.type).toBe("*")
      expect(viewerPolicy!.action.actions).toContain("company:read")
      expect(viewerPolicy!.action.actions).toContain("account:read")
      expect(viewerPolicy!.action.actions).toContain("journal_entry:read")
      expect(viewerPolicy!.action.actions).toContain("report:read")
      expect(viewerPolicy!.action.actions).toContain("report:export")
    })

    it("should create Locked Period Protection deny policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const lockedPeriodPolicy = policies.find(
        (p) => p.name === "Prevent Modifications to Locked Periods"
      )

      expect(lockedPeriodPolicy).toBeDefined()
      expect(lockedPeriodPolicy!.priority).toBe(
        SYSTEM_POLICY_PRIORITIES.LOCKED_PERIOD_PROTECTION
      )
      expect(lockedPeriodPolicy!.effect).toBe("deny")
      expect(lockedPeriodPolicy!.subject.roles).toEqual([
        "owner",
        "admin",
        "member",
        "viewer"
      ])
      expect(lockedPeriodPolicy!.resource.type).toBe("journal_entry")
      expect(lockedPeriodPolicy!.resource.attributes?.periodStatus).toEqual([
        "Locked"
      ])
      expect(lockedPeriodPolicy!.action.actions).toContain("journal_entry:create")
      expect(lockedPeriodPolicy!.action.actions).toContain("journal_entry:update")
      expect(lockedPeriodPolicy!.action.actions).toContain("journal_entry:post")
      expect(lockedPeriodPolicy!.action.actions).toContain("journal_entry:reverse")
    })

    it("should create Closed Period Protection deny policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const closedPeriodPolicy = policies.find(
        (p) => p.name === "Prevent Modifications to Closed Periods"
      )

      expect(closedPeriodPolicy).toBeDefined()
      expect(closedPeriodPolicy!.priority).toBe(
        SYSTEM_POLICY_PRIORITIES.CLOSED_PERIOD_PROTECTION
      )
      expect(closedPeriodPolicy!.effect).toBe("deny")
      expect(closedPeriodPolicy!.resource.type).toBe("journal_entry")
      expect(closedPeriodPolicy!.resource.attributes?.periodStatus).toEqual([
        "Closed"
      ])
      expect(closedPeriodPolicy!.action.actions).toContain("journal_entry:create")
      expect(closedPeriodPolicy!.action.actions).toContain("journal_entry:update")
      expect(closedPeriodPolicy!.action.actions).toContain("journal_entry:post")
      expect(closedPeriodPolicy!.action.actions).toContain("journal_entry:reverse")
    })

    it("should create Future Period Protection deny policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const futurePeriodPolicy = policies.find(
        (p) => p.name === "Prevent Entries in Future Periods"
      )

      expect(futurePeriodPolicy).toBeDefined()
      expect(futurePeriodPolicy!.priority).toBe(
        SYSTEM_POLICY_PRIORITIES.FUTURE_PERIOD_PROTECTION
      )
      expect(futurePeriodPolicy!.effect).toBe("deny")
      expect(futurePeriodPolicy!.resource.type).toBe("journal_entry")
      expect(futurePeriodPolicy!.resource.attributes?.periodStatus).toEqual([
        "Future"
      ])
      expect(futurePeriodPolicy!.action.actions).toContain("journal_entry:create")
      expect(futurePeriodPolicy!.action.actions).toContain("journal_entry:update")
      expect(futurePeriodPolicy!.action.actions).toContain("journal_entry:post")
      // Future period protection should NOT include reverse - reversal is for posted entries
      expect(futurePeriodPolicy!.action.actions).not.toContain("journal_entry:reverse")
    })

    it("should create SoftClose Controller Access allow policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const controllerPolicy = policies.find(
        (p) => p.name === "Allow SoftClose Period Access for Controllers"
      )

      expect(controllerPolicy).toBeDefined()
      expect(controllerPolicy!.priority).toBe(
        SYSTEM_POLICY_PRIORITIES.SOFTCLOSE_CONTROLLER_ACCESS
      )
      expect(controllerPolicy!.effect).toBe("allow")
      expect(controllerPolicy!.subject.functionalRoles).toEqual([
        "controller",
        "period_admin"
      ])
      expect(controllerPolicy!.resource.type).toBe("journal_entry")
      expect(controllerPolicy!.resource.attributes?.periodStatus).toEqual([
        "SoftClose"
      ])
      expect(controllerPolicy!.action.actions).toContain("journal_entry:create")
      expect(controllerPolicy!.action.actions).toContain("journal_entry:update")
      expect(controllerPolicy!.action.actions).toContain("journal_entry:post")
    })

    it("should create SoftClose Default Deny policy with correct settings", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const softClosePolicy = policies.find(
        (p) => p.name === "Restrict SoftClose Period Access"
      )

      expect(softClosePolicy).toBeDefined()
      expect(softClosePolicy!.priority).toBe(
        SYSTEM_POLICY_PRIORITIES.SOFTCLOSE_DEFAULT_DENY
      )
      expect(softClosePolicy!.effect).toBe("deny")
      expect(softClosePolicy!.resource.type).toBe("journal_entry")
      expect(softClosePolicy!.resource.attributes?.periodStatus).toEqual([
        "SoftClose"
      ])
      expect(softClosePolicy!.action.actions).toContain("journal_entry:create")
      expect(softClosePolicy!.action.actions).toContain("journal_entry:update")
      expect(softClosePolicy!.action.actions).toContain("journal_entry:post")
    })

    it("should have SoftClose Controller Access at higher priority than SoftClose Default Deny", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const controllerPolicy = policies.find(
        (p) => p.name === "Allow SoftClose Period Access for Controllers"
      )
      const defaultDenyPolicy = policies.find(
        (p) => p.name === "Restrict SoftClose Period Access"
      )

      expect(controllerPolicy).toBeDefined()
      expect(defaultDenyPolicy).toBeDefined()
      // Higher priority = evaluated first, so controller allow should win
      expect(controllerPolicy!.priority).toBeGreaterThan(defaultDenyPolicy!.priority)
    })

    it("should generate unique policy IDs", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const ids = policies.map((p) => p.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(policies.length)
    })

    it("should have Platform Admin policy at highest priority (1000)", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const maxPriority = Math.max(...policies.map((p) => p.priority))
      const platformAdminPolicy = policies.find(
        (p) => p.name === "Platform Admin Full Access"
      )
      expect(platformAdminPolicy!.priority).toBe(maxPriority)
      expect(maxPriority).toBe(1000)
    })

    it("should have Locked Period Protection at priority 999 (below Platform Admin)", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      const lockedPeriodPolicy = policies.find(
        (p) => p.name === "Prevent Modifications to Locked Periods"
      )
      expect(lockedPeriodPolicy!.priority).toBe(999)
    })
  })

  describe("seedSystemPolicies", () => {
    it.effect("should call create for each policy", () =>
      Effect.gen(function* () {
        const createdPolicies: CreatePolicyInput[] = []
        const mockRepo = {
          create: (input: CreatePolicyInput) => {
            createdPolicies.push(input)
            return Effect.succeed(input)
          }
        }

        yield* seedSystemPolicies(testOrgId, mockRepo)

        expect(createdPolicies.length).toBe(8)
        expect(createdPolicies.every((p) => p.isSystemPolicy)).toBe(true)
      })
    )
  })

  describe("hasSystemPolicies", () => {
    it("should return false when no policies exist", () => {
      const result = hasSystemPolicies([])
      expect(result).toBe(false)
    })

    it("should return false when fewer than 8 system policies exist", () => {
      const result = hasSystemPolicies([
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true }
      ])
      expect(result).toBe(false)
    })

    it("should return true when exactly 8 system policies exist", () => {
      const result = hasSystemPolicies([
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true }
      ])
      expect(result).toBe(true)
    })

    it("should return true when more than 8 system policies exist", () => {
      const result = hasSystemPolicies([
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true }
      ])
      expect(result).toBe(true)
    })

    it("should not count non-system policies", () => {
      const result = hasSystemPolicies([
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: false },
        { isSystemPolicy: false },
        { isSystemPolicy: false }
      ])
      expect(result).toBe(false)
    })
  })
})
