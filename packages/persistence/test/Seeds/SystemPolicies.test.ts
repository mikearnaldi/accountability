/**
 * SystemPolicies.test.ts - Tests for system policies seeding
 *
 * Tests the generation and seeding of the 4 system policies:
 * 1. Platform Admin Full Access
 * 2. Organization Owner Full Access
 * 3. Viewer Read-Only Access
 * 4. Locked Period Protection
 *
 * @module SystemPolicies.test
 */

import { describe, it, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { SYSTEM_POLICY_PRIORITIES } from "@accountability/core/Auth/AuthorizationPolicy"
import {
  createSystemPoliciesForOrganization,
  seedSystemPolicies,
  hasSystemPolicies
} from "../../src/Seeds/SystemPolicies.ts"
import type { CreatePolicyInput } from "../../src/Services/PolicyRepository.ts"

describe("SystemPolicies", () => {
  const testOrgId = OrganizationId.make("11111111-1111-1111-1111-111111111111")

  describe("createSystemPoliciesForOrganization", () => {
    it("should create exactly 4 system policies", () => {
      const policies = createSystemPoliciesForOrganization(testOrgId)
      expect(policies.length).toBe(4)
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

        expect(createdPolicies.length).toBe(4)
        expect(createdPolicies.every((p) => p.isSystemPolicy)).toBe(true)
      })
    )
  })

  describe("hasSystemPolicies", () => {
    it("should return false when no policies exist", () => {
      const result = hasSystemPolicies([])
      expect(result).toBe(false)
    })

    it("should return false when fewer than 4 system policies exist", () => {
      const result = hasSystemPolicies([
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true }
      ])
      expect(result).toBe(false)
    })

    it("should return true when exactly 4 system policies exist", () => {
      const result = hasSystemPolicies([
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true },
        { isSystemPolicy: true }
      ])
      expect(result).toBe(true)
    })

    it("should return true when more than 4 system policies exist", () => {
      const result = hasSystemPolicies([
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
        { isSystemPolicy: false },
        { isSystemPolicy: false },
        { isSystemPolicy: false }
      ])
      expect(result).toBe(false)
    })
  })
})
