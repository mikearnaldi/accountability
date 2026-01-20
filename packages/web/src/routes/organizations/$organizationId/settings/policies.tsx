/**
 * Organization Policies Page
 *
 * Phase I1 of AUTHORIZATION.md spec - Policies Page Route
 *
 * Lists organization authorization policies with:
 * - Policy table with name, effect, priority, status
 * - System policy indicator (grayed out, cannot edit/delete)
 * - Custom policy management (create, edit, delete)
 *
 * Route: /organizations/:organizationId/settings/policies
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { Shield, Plus, RefreshCw, MoreVertical, Lock, Pencil, Trash2, CheckCircle, XCircle, Play, Eye } from "lucide-react"
import { clsx } from "clsx"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { usePermissions } from "@/hooks/usePermissions"
import { PolicyBuilderModal } from "@/components/policies/PolicyBuilderModal"
import { PolicyTestModal } from "@/components/policies/PolicyTestModal"
import { PolicyDetailModal } from "@/components/policies/PolicyDetailModal"

// =============================================================================
// Types
// =============================================================================

type PolicyEffect = "allow" | "deny"
type BaseRole = "owner" | "admin" | "member" | "viewer"
// SubjectConditionRole includes wildcard for policy conditions (e.g., "Prevent Modifications to Locked Periods" applies to all roles)
type SubjectConditionRole = BaseRole | "*"
type FunctionalRole = "controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager"
type ResourceType = "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*"

interface SubjectCondition {
  readonly roles?: readonly SubjectConditionRole[]
  readonly functionalRoles?: readonly FunctionalRole[]
  readonly userIds?: readonly string[]
  readonly isPlatformAdmin?: boolean
}

interface ResourceAttributes {
  readonly accountNumber?: {
    readonly range?: readonly [number, number]
    readonly in?: readonly number[]
  }
  readonly accountType?: readonly ("Asset" | "Liability" | "Equity" | "Revenue" | "Expense")[]
  readonly isIntercompany?: boolean
  readonly entryType?: readonly ("Standard" | "Adjusting" | "Closing" | "Reversing" | "Elimination" | "Consolidation" | "Intercompany")[]
  readonly isOwnEntry?: boolean
  readonly periodStatus?: readonly ("Open" | "SoftClose" | "Closed" | "Locked")[]
  readonly isAdjustmentPeriod?: boolean
}

interface ResourceCondition {
  readonly type: ResourceType
  readonly attributes?: ResourceAttributes
}

interface ActionCondition {
  readonly actions: readonly string[]
}

interface TimeRange {
  readonly start: string
  readonly end: string
}

interface EnvironmentCondition {
  readonly timeOfDay?: TimeRange
  readonly daysOfWeek?: readonly number[]
  readonly ipAllowList?: readonly string[]
  readonly ipDenyList?: readonly string[]
}

interface Policy {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly subject: SubjectCondition
  readonly resource: ResourceCondition
  readonly action: ActionCondition
  readonly environment: EnvironmentCondition | null
  readonly effect: PolicyEffect
  readonly priority: number
  readonly isSystemPolicy: boolean
  readonly isActive: boolean
  readonly createdAt: { readonly epochMillis: number }
  readonly updatedAt: { readonly epochMillis: number }
  readonly createdBy: string | null
}

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface Company {
  readonly id: string
  readonly name: string
}

interface Member {
  readonly userId: string
  readonly email: string
  readonly displayName: string
  readonly role: BaseRole
  readonly functionalRoles: readonly FunctionalRole[]
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchPoliciesData = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, policies: [], companies: [], members: [], error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, policiesResult, companiesResult, membersResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{orgId}/policies", {
          params: { path: { orgId: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{orgId}/members", {
          params: { path: { orgId: organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, policies: [], companies: [], members: [], error: "not_found" as const }
        }
        return { organization: null, policies: [], companies: [], members: [], error: "failed" as const }
      }

      // Filter to active members only for the test modal
      const allMembers = membersResult.data?.members ?? []
      const activeMembers = allMembers.filter((m: { status?: string }) => m.status === "active")

      return {
        organization: orgResult.data,
        policies: policiesResult.data?.policies ?? [],
        companies: companiesResult.data?.companies ?? [],
        members: activeMembers,
        error: null
      }
    } catch {
      return { organization: null, policies: [], companies: [], members: [], error: "failed" as const }
    }
  })

// =============================================================================
// Constants
// =============================================================================

const EFFECT_STYLES: Record<PolicyEffect, { bg: string; text: string; icon: React.ReactNode }> = {
  allow: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: <CheckCircle className="h-3.5 w-3.5" />
  },
  deny: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: <XCircle className="h-3.5 w-3.5" />
  }
}

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  organization: "Organization",
  company: "Company",
  account: "Account",
  journal_entry: "Journal Entry",
  fiscal_period: "Fiscal Period",
  consolidation_group: "Consolidation Group",
  report: "Report",
  "*": "All Resources"
}

// Short labels for actions in table summary
const ACTION_SHORT_LABELS: Record<string, string> = {
  "organization:manage_settings": "Manage Settings",
  "organization:manage_members": "Manage Members",
  "organization:delete": "Delete Org",
  "organization:transfer_ownership": "Transfer Ownership",
  "company:create": "Create",
  "company:read": "Read",
  "company:update": "Update",
  "company:delete": "Delete",
  "account:create": "Create",
  "account:read": "Read",
  "account:update": "Update",
  "account:deactivate": "Deactivate",
  "journal_entry:create": "Create",
  "journal_entry:read": "Read",
  "journal_entry:update": "Update",
  "journal_entry:post": "Post",
  "journal_entry:reverse": "Reverse",
  "fiscal_period:read": "Read",
  "fiscal_period:manage": "Manage",
  "consolidation_group:create": "Create",
  "consolidation_group:read": "Read",
  "consolidation_group:update": "Update",
  "consolidation_group:delete": "Delete",
  "consolidation_group:run": "Run",
  "elimination:create": "Create Elim",
  "report:read": "View",
  "report:export": "Export",
  "exchange_rate:read": "View",
  "exchange_rate:manage": "Manage",
  "audit_log:read": "View",
  "*": "All"
}

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/settings/policies")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/settings/policies`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchPoliciesData({ data: params.organizationId })
    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }
    return {
      organization: result.organization,
      policies: result.policies,
      companies: result.companies,
      members: result.members
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: PoliciesPage
})

// =============================================================================
// Page Component
// =============================================================================

function PoliciesPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []
  const { isAdminOrOwner } = usePermissions()

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const policies = loaderData.policies as readonly Policy[]
  const companies = loaderData.companies as readonly Company[]
  const members = loaderData.members as readonly Member[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [viewingPolicy, setViewingPolicy] = useState<Policy | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)

  if (!organization) {
    return null
  }

  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  // Separate system and custom policies
  const systemPolicies = policies.filter((p) => p.isSystemPolicy)
  const customPolicies = policies.filter((p) => !p.isSystemPolicy)

  // Sort by priority (descending - higher priority first)
  const sortedSystemPolicies = [...systemPolicies].sort((a, b) => b.priority - a.priority)
  const sortedCustomPolicies = [...customPolicies].sort((a, b) => b.priority - a.priority)

  const handleRefresh = async () => {
    await router.invalidate()
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      companies={companiesForSidebar}
    >
      <div className="space-y-6" data-testid="policies-page">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="policies-page-title">
              Authorization Policies
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage access control policies for {organization.name}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              icon={<RefreshCw className="h-4 w-4" />}
              data-testid="policies-refresh-button"
            >
              Refresh
            </Button>

            {isAdminOrOwner && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setShowTestModal(true)}
                  icon={<Play className="h-4 w-4" />}
                  data-testid="policies-test-button"
                >
                  Test Policies
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowCreateModal(true)}
                  icon={<Plus className="h-4 w-4" />}
                  data-testid="policies-create-button"
                >
                  Create Policy
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">About Authorization Policies</h3>
              <p className="mt-1 text-sm text-blue-700">
                Policies control what actions users can perform. System policies are created automatically
                and cannot be modified. Custom policies can override system policies for specific use cases.
                Policies are evaluated by priority (higher first), with deny policies taking precedence.
              </p>
            </div>
          </div>
        </div>

        {/* System Policies Section */}
        <PolicyTable
          title="System Policies"
          icon={<Lock className="h-5 w-5 text-gray-400" />}
          description="Built-in policies that define base permission levels. These cannot be modified."
          policies={sortedSystemPolicies}
          isSystemSection
          canManage={false}
          actionMenuOpen={actionMenuOpen}
          onActionMenuToggle={setActionMenuOpen}
          onViewPolicy={setViewingPolicy}
          data-testid="system-policies-section"
        />

        {/* Custom Policies Section */}
        <PolicyTable
          title="Custom Policies"
          icon={<Shield className="h-5 w-5 text-gray-500" />}
          description="Organization-specific policies that extend or restrict permissions."
          policies={sortedCustomPolicies}
          isSystemSection={false}
          canManage={isAdminOrOwner}
          actionMenuOpen={actionMenuOpen}
          onActionMenuToggle={setActionMenuOpen}
          onRefresh={handleRefresh}
          onEditPolicy={setEditingPolicy}
          onViewPolicy={setViewingPolicy}
          onTestPolicy={() => setShowTestModal(true)}
          organizationId={organization.id}
          data-testid="custom-policies-section"
        />

        {/* Empty Custom Policies State */}
        {customPolicies.length === 0 && (
          <div
            className="rounded-lg border border-gray-200 bg-white p-8 text-center"
            data-testid="policies-empty-state"
          >
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No custom policies</h3>
            <p className="mt-2 text-sm text-gray-500">
              Create custom policies to fine-tune access control for specific users, roles, or resources.
            </p>
            {isAdminOrOwner && (
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                icon={<Plus className="h-4 w-4" />}
                className="mt-4"
                data-testid="policies-empty-create-button"
              >
                Create Policy
              </Button>
            )}
          </div>
        )}

        {/* Create Policy Modal */}
        {showCreateModal && (
          <PolicyBuilderModal
            organizationId={organization.id}
            mode="create"
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleRefresh}
          />
        )}

        {/* Edit Policy Modal */}
        {editingPolicy && (
          <PolicyBuilderModal
            organizationId={organization.id}
            mode="edit"
            existingPolicy={editingPolicy}
            onClose={() => setEditingPolicy(null)}
            onSuccess={handleRefresh}
          />
        )}

        {/* Test Policy Modal */}
        {showTestModal && (
          <PolicyTestModal
            organizationId={organization.id}
            members={members}
            onClose={() => setShowTestModal(false)}
          />
        )}

        {/* View Policy Detail Modal */}
        {viewingPolicy && (
          <PolicyDetailModal
            policy={viewingPolicy}
            onClose={() => setViewingPolicy(null)}
            canEdit={isAdminOrOwner}
            onEdit={() => {
              const policyToEdit = viewingPolicy
              setViewingPolicy(null)
              setEditingPolicy(policyToEdit)
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Policy Table Component
// =============================================================================

interface PolicyTableProps {
  readonly title: string
  readonly icon: React.ReactNode
  readonly description: string
  readonly policies: readonly Policy[]
  readonly isSystemSection: boolean
  readonly canManage: boolean
  readonly actionMenuOpen: string | null
  readonly onActionMenuToggle: (id: string | null) => void
  readonly onRefresh?: () => void
  readonly onEditPolicy?: (policy: Policy) => void
  readonly onViewPolicy?: (policy: Policy) => void
  readonly onTestPolicy?: () => void
  readonly organizationId?: string
  readonly "data-testid"?: string
}

function PolicyTable({
  title,
  icon,
  description,
  policies,
  isSystemSection,
  canManage,
  actionMenuOpen,
  onActionMenuToggle,
  onRefresh,
  onEditPolicy,
  onViewPolicy,
  onTestPolicy,
  organizationId,
  "data-testid": testId
}: PolicyTableProps) {
  if (policies.length === 0 && isSystemSection) {
    return null
  }

  return (
    <div
      className={clsx(
        "rounded-lg border bg-white",
        isSystemSection ? "border-gray-200" : "border-gray-200"
      )}
      data-testid={testId}
    >
      {/* Section Header */}
      <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <span className="text-sm text-gray-500">({policies.length})</span>
      </div>

      {/* Table - Desktop */}
      {policies.length > 0 && (
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 min-w-[200px]">Policy Name</th>
                <th className="px-6 py-3 whitespace-nowrap">Effect</th>
                <th className="px-6 py-3 whitespace-nowrap">Priority</th>
                <th className="px-6 py-3 min-w-[200px]">Target</th>
                <th className="px-6 py-3 whitespace-nowrap">Status</th>
                <th className="px-6 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {policies.map((policy) => {
                const isMenuOpen = actionMenuOpen === policy.id
                const effectStyle = EFFECT_STYLES[policy.effect]

                return (
                  <tr
                    key={policy.id}
                    className={clsx(
                      "hover:bg-gray-50 cursor-pointer",
                      isSystemSection && "bg-gray-50/50"
                    )}
                    onClick={() => onViewPolicy?.(policy)}
                    data-testid={`policy-row-${policy.id}`}
                  >
                    {/* Policy Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        {isSystemSection && (
                          <span title="System policy" className="flex-shrink-0 mt-0.5">
                            <Lock className="h-4 w-4 text-gray-400" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className={clsx(
                            "font-medium block break-words",
                            isSystemSection ? "text-gray-600" : "text-gray-900"
                          )}>
                            {policy.name}
                          </span>
                          {policy.description && (
                            <p className="text-sm text-gray-500 mt-0.5 break-words">{policy.description}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Effect */}
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                          effectStyle.bg,
                          effectStyle.text
                        )}
                      >
                        {effectStyle.icon}
                        {policy.effect.charAt(0).toUpperCase() + policy.effect.slice(1)}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "text-sm font-mono whitespace-nowrap",
                        isSystemSection ? "text-gray-500" : "text-gray-700"
                      )}>
                        {policy.priority}
                      </span>
                    </td>

                    {/* Target Summary */}
                    <td className="px-6 py-4">
                      <PolicyTargetSummary policy={policy} isSystemSection={isSystemSection} />
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                          policy.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {policy.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {/* View button for all policies */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewPolicy?.(policy)
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="View policy details"
                          data-testid={`policy-view-${policy.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Action menu for custom policies only */}
                        {!isSystemSection && canManage && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onActionMenuToggle(isMenuOpen ? null : policy.id)
                              }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                              data-testid={`policy-actions-${policy.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {isMenuOpen && (
                              <PolicyActionsMenu
                                policy={policy}
                                organizationId={organizationId ?? ""}
                                onClose={() => onActionMenuToggle(null)}
                                onEdit={onEditPolicy ? () => onEditPolicy(policy) : undefined}
                                onTest={onTestPolicy}
                                {...(onRefresh ? { onRefresh } : {})}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Card layout - Mobile/Tablet */}
      {policies.length > 0 && (
        <div className="lg:hidden divide-y divide-gray-200">
          {policies.map((policy) => {
            const isMenuOpen = actionMenuOpen === policy.id
            const effectStyle = EFFECT_STYLES[policy.effect]

            return (
              <div
                key={policy.id}
                className={clsx(
                  "p-4 cursor-pointer hover:bg-gray-50",
                  isSystemSection && "bg-gray-50/50"
                )}
                onClick={() => onViewPolicy?.(policy)}
                data-testid={`policy-card-${policy.id}`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {isSystemSection && (
                      <span title="System policy" className="flex-shrink-0 mt-0.5">
                        <Lock className="h-4 w-4 text-gray-400" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className={clsx(
                        "font-medium block break-words",
                        isSystemSection ? "text-gray-600" : "text-gray-900"
                      )}>
                        {policy.name}
                      </span>
                      {policy.description && (
                        <p className="text-sm text-gray-500 mt-0.5 break-words">{policy.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* View button for all policies */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewPolicy?.(policy)
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="View policy details"
                      data-testid={`policy-view-mobile-${policy.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Action menu for custom policies only */}
                    {canManage && !isSystemSection && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onActionMenuToggle(isMenuOpen ? null : policy.id)
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          data-testid={`policy-actions-mobile-${policy.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {isMenuOpen && (
                          <PolicyActionsMenu
                            policy={policy}
                            organizationId={organizationId ?? ""}
                            onClose={() => onActionMenuToggle(null)}
                            onEdit={onEditPolicy ? () => onEditPolicy(policy) : undefined}
                            onTest={onTestPolicy}
                            {...(onRefresh ? { onRefresh } : {})}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      effectStyle.bg,
                      effectStyle.text
                    )}
                  >
                    {effectStyle.icon}
                    {policy.effect.charAt(0).toUpperCase() + policy.effect.slice(1)}
                  </span>
                  <span className={clsx(
                    "inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium",
                    isSystemSection ? "text-gray-500" : "text-gray-700"
                  )}>
                    Priority: {policy.priority}
                  </span>
                  <span
                    className={clsx(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      policy.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {policy.isActive ? "Active" : "Disabled"}
                  </span>
                </div>

                {/* Target summary */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <PolicyTargetSummary policy={policy} isSystemSection={isSystemSection} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Policy Target Summary Component
// =============================================================================

interface PolicyTargetSummaryProps {
  readonly policy: Policy
  readonly isSystemSection: boolean
}

function PolicyTargetSummary({ policy, isSystemSection }: PolicyTargetSummaryProps) {
  const { subject, resource, action } = policy

  // Build subject summary
  const subjectParts: string[] = []
  if (subject.isPlatformAdmin) {
    subjectParts.push("Platform Admins")
  }
  if (subject.roles && subject.roles.length > 0) {
    // Check for wildcard role using string comparison
    const hasWildcardRole = subject.roles.some((r) => r === "*")
    if (hasWildcardRole) {
      subjectParts.push("All Roles")
    } else {
      subjectParts.push(subject.roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(", "))
    }
  }
  if (subject.functionalRoles && subject.functionalRoles.length > 0) {
    subjectParts.push(`${subject.functionalRoles.length} functional role(s)`)
  }
  if (subject.userIds && subject.userIds.length > 0) {
    subjectParts.push(`${subject.userIds.length} specific user(s)`)
  }

  const subjectSummary = subjectParts.length > 0 ? subjectParts.join(", ") : "All users"

  // Build resource summary
  const resourceType = RESOURCE_TYPE_LABELS[resource.type] ?? resource.type
  const hasAttributes = resource.attributes && Object.keys(resource.attributes).length > 0
  const resourceSummary = hasAttributes ? `${resourceType} (with conditions)` : resourceType

  // Build action summary - show actual actions, not just count
  const hasWildcard = action.actions.includes("*")
  let actionDisplay: React.ReactNode

  if (hasWildcard) {
    actionDisplay = <span className="text-amber-600 font-medium">All actions (*)</span>
  } else {
    // Show up to 3 actions inline, then "+N more"
    const MAX_INLINE = 3
    const actionLabels = action.actions.map((a) => ACTION_SHORT_LABELS[a] ?? a)

    if (actionLabels.length <= MAX_INLINE) {
      actionDisplay = actionLabels.join(", ")
    } else {
      const shown = actionLabels.slice(0, MAX_INLINE).join(", ")
      const remaining = actionLabels.length - MAX_INLINE
      actionDisplay = (
        <>
          {shown}
          <span className="text-gray-400 ml-1">(+{remaining} more)</span>
        </>
      )
    }
  }

  return (
    <div className={clsx(
      "text-sm space-y-0.5",
      isSystemSection ? "text-gray-500" : "text-gray-700"
    )}>
      <div className="flex flex-wrap items-baseline gap-x-1">
        <span className="font-medium flex-shrink-0">Who:</span>
        <span className="break-words">{subjectSummary}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1">
        <span className="font-medium flex-shrink-0">What:</span>
        <span className="break-words">{resourceSummary}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1">
        <span className="font-medium flex-shrink-0">Can:</span>
        <span className="break-words">{actionDisplay}</span>
      </div>
    </div>
  )
}

// =============================================================================
// Policy Actions Menu Component
// =============================================================================

interface PolicyActionsMenuProps {
  readonly policy: Policy
  readonly organizationId: string
  readonly onClose: () => void
  readonly onRefresh?: (() => void) | undefined
  readonly onEdit?: (() => void) | undefined
  readonly onTest?: (() => void) | undefined
}

function PolicyActionsMenu({ policy, organizationId, onClose, onRefresh, onEdit, onTest }: PolicyActionsMenuProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleEdit = () => {
    onEdit?.()
    onClose()
  }

  const handleTest = () => {
    onTest?.()
    onClose()
  }

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the policy "${policy.name}"?`)) {
      return
    }

    setIsDeleting(true)
    try {
      const { error: apiError } = await api.DELETE("/api/v1/organizations/{orgId}/policies/{policyId}", {
        params: { path: { orgId: organizationId, policyId: policy.id } }
      })

      if (apiError) {
        const errorMessage =
          typeof apiError === "object" && apiError !== null && "message" in apiError
            ? String(apiError.message)
            : "Failed to delete policy"
        alert(errorMessage)
        return
      }

      onRefresh?.()
    } catch {
      alert("An unexpected error occurred")
    } finally {
      setIsDeleting(false)
      onClose()
    }
  }

  return (
    <div
      className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      data-testid={`policy-actions-menu-${policy.id}`}
    >
      <button
        onClick={handleEdit}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        data-testid="policy-edit"
      >
        <Pencil className="h-4 w-4" />
        Edit Policy
      </button>

      <button
        onClick={handleTest}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        data-testid="policy-test"
      >
        <Play className="h-4 w-4" />
        Test Policy
      </button>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="policy-delete"
      >
        <Trash2 className="h-4 w-4" />
        {isDeleting ? "Deleting..." : "Delete Policy"}
      </button>
    </div>
  )
}
