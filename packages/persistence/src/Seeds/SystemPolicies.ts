/**
 * SystemPolicies - Default ABAC policies seeded for new organizations
 *
 * These policies implement the built-in authorization rules that cannot be
 * modified or deleted by users. They are created automatically when a new
 * organization is created.
 *
 * System Policies:
 * 1. Platform Admin Full Access - Platform admins can do anything
 * 2. Organization Owner Full Access - Org owners have full access
 * 3. Viewer Read-Only Access - Viewers can only read data
 * 4. Locked Period Protection - No one can modify locked periods (except platform admin)
 *
 * @module SystemPolicies
 */

import * as Effect from "effect/Effect"
import type { OrganizationId } from "@accountability/core/Domains/Organization"
import { PolicyId } from "@accountability/core/Auth/PolicyId"
import { SYSTEM_POLICY_PRIORITIES } from "@accountability/core/Auth/AuthorizationPolicy"
import type { CreatePolicyInput } from "../Services/PolicyRepository.ts"

/**
 * Creates a system policy input with standard defaults
 */
function createSystemPolicy(
  organizationId: OrganizationId,
  config: {
    name: string
    description: string
    subject: CreatePolicyInput["subject"]
    resource: CreatePolicyInput["resource"]
    action: CreatePolicyInput["action"]
    effect: CreatePolicyInput["effect"]
    priority: number
  }
): CreatePolicyInput {
  return {
    id: PolicyId.make(crypto.randomUUID()),
    organizationId,
    name: config.name,
    description: config.description,
    subject: config.subject,
    resource: config.resource,
    action: config.action,
    effect: config.effect,
    priority: config.priority,
    isSystemPolicy: true,
    isActive: true
  }
}

/**
 * Generates the 4 system policies for a new organization
 *
 * @param organizationId - The ID of the organization to create policies for
 * @returns Array of policy creation inputs
 */
export function createSystemPoliciesForOrganization(
  organizationId: OrganizationId
): ReadonlyArray<CreatePolicyInput> {
  return [
    // 1. Platform Admin Override - Platform admins can do anything
    createSystemPolicy(organizationId, {
      name: "Platform Admin Full Access",
      description: "Platform administrators have unrestricted access to all resources and actions",
      subject: {
        isPlatformAdmin: true
      },
      resource: {
        type: "*"
      },
      action: {
        actions: ["*"]
      },
      effect: "allow",
      priority: SYSTEM_POLICY_PRIORITIES.PLATFORM_ADMIN_OVERRIDE
    }),

    // 2. Organization Owner Full Access - Owners can do anything in their org
    createSystemPolicy(organizationId, {
      name: "Organization Owner Full Access",
      description: "Organization owners have full access to all resources within their organization",
      subject: {
        roles: ["owner"]
      },
      resource: {
        type: "*"
      },
      action: {
        actions: ["*"]
      },
      effect: "allow",
      priority: SYSTEM_POLICY_PRIORITIES.OWNER_FULL_ACCESS
    }),

    // 3. Viewer Read-Only Access - Viewers can only read and view reports
    createSystemPolicy(organizationId, {
      name: "Viewer Read-Only Access",
      description: "Viewers can only read data and view/export reports",
      subject: {
        roles: ["viewer"]
      },
      resource: {
        type: "*"
      },
      action: {
        actions: [
          "company:read",
          "account:read",
          "journal_entry:read",
          "fiscal_period:read",
          "consolidation_group:read",
          "report:read",
          "report:export",
          "exchange_rate:read"
        ]
      },
      effect: "allow",
      priority: SYSTEM_POLICY_PRIORITIES.VIEWER_READ_ONLY
    }),

    // 4. Locked Period Protection - No modifications to locked periods
    // This is a deny policy that prevents any write operations on locked periods
    // Note: Platform Admin policy (priority 1000) can override this (priority 999)
    createSystemPolicy(organizationId, {
      name: "Prevent Modifications to Locked Periods",
      description: "Prevents creating, updating, posting, or reversing journal entries in locked fiscal periods",
      subject: {
        // Applies to all users (including owners) - only platform admin overrides via priority
        roles: ["owner", "admin", "member", "viewer"]
      },
      resource: {
        type: "journal_entry",
        attributes: {
          periodStatus: ["Locked"]
        }
      },
      action: {
        actions: [
          "journal_entry:create",
          "journal_entry:update",
          "journal_entry:post",
          "journal_entry:reverse"
        ]
      },
      effect: "deny",
      priority: SYSTEM_POLICY_PRIORITIES.LOCKED_PERIOD_PROTECTION
    })
  ]
}

/**
 * Seeds system policies for an organization
 *
 * This function creates the 4 system policies for a new organization.
 * It is designed to be called after organization creation.
 *
 * @param organizationId - The ID of the organization to seed policies for
 * @param policyRepository - The policy repository service
 * @returns Effect that completes when all policies are created
 */
export function seedSystemPolicies(
  organizationId: OrganizationId,
  policyRepository: {
    create: (
      input: CreatePolicyInput
    ) => Effect.Effect<unknown, unknown>
  }
): Effect.Effect<void, unknown> {
  const policies = createSystemPoliciesForOrganization(organizationId)

  return Effect.gen(function* () {
    for (const policy of policies) {
      yield* policyRepository.create(policy)
    }
  })
}

/**
 * Check if system policies exist for an organization
 *
 * This can be used to determine if policies need to be seeded
 * (e.g., for migration purposes)
 *
 * @param policies - Array of policies to check
 * @returns true if all 4 system policies exist
 */
export function hasSystemPolicies(
  policies: ReadonlyArray<{ isSystemPolicy: boolean }>
): boolean {
  const systemPolicyCount = policies.filter((p) => p.isSystemPolicy).length
  return systemPolicyCount >= 4
}
