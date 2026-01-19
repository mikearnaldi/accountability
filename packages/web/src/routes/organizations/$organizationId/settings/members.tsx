/**
 * Organization Members Page
 *
 * Phase H1 of AUTHORIZATION.md spec - Members Page Route
 *
 * Lists organization members with:
 * - Member table with name, email, role badges, functional roles
 * - Actions dropdown for member management
 * - Invite new member modal
 * - Pending invitations section
 *
 * Route: /organizations/:organizationId/settings/members
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { Users, Mail, MoreVertical, UserPlus, Shield, RefreshCw, UserMinus, Clock, X, Copy, Check, Link, Crown, ArrowRightLeft, AlertTriangle, Eye, Pause, Play } from "lucide-react"
import { clsx } from "clsx"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { RoleBadge, type BaseRole } from "@/components/layout/OrganizationSelector"
import { usePermissions } from "@/hooks/usePermissions"
import { EffectivePermissionsView } from "@/components/members/EffectivePermissionsView"

// =============================================================================
// Types
// =============================================================================

type FunctionalRole = "controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager"
type MembershipStatus = "active" | "suspended" | "removed"
type InvitationStatus = "pending" | "accepted" | "revoked"

interface Member {
  readonly userId: string
  readonly email: string
  readonly displayName: string
  readonly role: BaseRole
  readonly functionalRoles: readonly FunctionalRole[]
  readonly status: MembershipStatus
  readonly joinedAt: { readonly epochMillis: number }
}

interface Invitation {
  readonly id: string
  readonly email: string
  readonly role: BaseRole
  readonly functionalRoles: readonly FunctionalRole[]
  readonly status: InvitationStatus
  readonly invitedBy: {
    readonly email: string
    readonly displayName: string
  }
  readonly createdAt: { readonly epochMillis: number }
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

// =============================================================================
// Server Functions
// =============================================================================

const fetchMembersData = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, members: [], invitations: [], companies: [], error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, membersResult, invitationsResult, companiesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{orgId}/members", {
          params: { path: { orgId: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{orgId}/invitations", {
          params: { path: { orgId: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, members: [], invitations: [], companies: [], error: "not_found" as const }
        }
        return { organization: null, members: [], invitations: [], companies: [], error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        members: membersResult.data?.members ?? [],
        invitations: invitationsResult.data?.invitations ?? [],
        companies: companiesResult.data?.companies ?? [],
        error: null
      }
    } catch {
      return { organization: null, members: [], invitations: [], companies: [], error: "failed" as const }
    }
  })

// =============================================================================
// Constants
// =============================================================================

const FUNCTIONAL_ROLE_LABELS: Record<FunctionalRole, string> = {
  controller: "Controller",
  finance_manager: "Finance Manager",
  accountant: "Accountant",
  period_admin: "Period Admin",
  consolidation_manager: "Consolidation Manager"
}

const FUNCTIONAL_ROLE_DESCRIPTIONS: Record<FunctionalRole, string> = {
  controller: "Full financial oversight, period lock/unlock, consolidation run/approval",
  finance_manager: "Account management, exchange rates, period soft close, elimination rules",
  accountant: "Create, edit, and post journal entries, reconciliation",
  period_admin: "Open/close fiscal periods, create adjustment periods",
  consolidation_manager: "Manage consolidation groups, elimination rules"
}

const STATUS_STYLES: Record<MembershipStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
  suspended: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Suspended" },
  removed: { bg: "bg-red-100", text: "text-red-700", label: "Removed" }
}

/** Valid invite roles (owner cannot be invited, must transfer ownership) */
const INVITE_ROLES = {
  admin: "admin",
  member: "member",
  viewer: "viewer"
} as const

type InviteRole = (typeof INVITE_ROLES)[keyof typeof INVITE_ROLES]

function isInviteRole(value: string): value is InviteRole {
  return value in INVITE_ROLES
}

/** Valid edit roles (owner role cannot be set via edit, only via transfer) */
const EDIT_ROLES = {
  admin: "admin",
  member: "member",
  viewer: "viewer"
} as const

type EditRole = (typeof EDIT_ROLES)[keyof typeof EDIT_ROLES]

function isEditRole(value: string): value is EditRole {
  return value in EDIT_ROLES
}

/** Functional role keys for type-safe iteration */
const FUNCTIONAL_ROLE_KEYS: readonly FunctionalRole[] = [
  "controller",
  "finance_manager",
  "accountant",
  "period_admin",
  "consolidation_manager"
]

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/settings/members")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/settings/members`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchMembersData({ data: params.organizationId })
    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }
    return {
      organization: result.organization,
      members: result.members,
      invitations: result.invitations,
      companies: result.companies
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: MembersPage
})

// =============================================================================
// Page Component
// =============================================================================

function MembersPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []
  const { canPerform, currentOrganization: permissionsOrg } = usePermissions()

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const members = loaderData.members as readonly Member[]
  const invitations = loaderData.invitations as readonly Invitation[]
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)

  const canManageMembers = canPerform("organization:manage_members")

  // Find the current owner
  const owner = members.find((m) => m.role === "owner")
  const isCurrentUserOwner = owner?.userId === user?.id

  if (!organization) {
    return null
  }

  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  // Separate active members from removed/suspended
  const activeMembers = members.filter((m) => m.status === "active")
  const inactiveMembers = members.filter((m) => m.status !== "active")
  const pendingInvitations = invitations.filter((i) => i.status === "pending")

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
      <div className="space-y-6" data-testid="members-page">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="members-page-title">
              Organization Members
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage members and their roles in {organization.name}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowPermissionsModal(true)}
              icon={<Eye className="h-4 w-4" />}
              data-testid="members-view-permissions-button"
            >
              My Permissions
            </Button>

            <Button
              variant="secondary"
              onClick={handleRefresh}
              icon={<RefreshCw className="h-4 w-4" />}
              data-testid="members-refresh-button"
            >
              Refresh
            </Button>

            {canManageMembers && (
              <Button
                variant="primary"
                onClick={() => setShowInviteModal(true)}
                icon={<UserPlus className="h-4 w-4" />}
                data-testid="members-invite-button"
              >
                Invite Member
              </Button>
            )}
          </div>
        </div>

        {/* Active Members Section */}
        <MembersTable
          title="Active Members"
          icon={<Users className="h-5 w-5 text-gray-500" />}
          members={activeMembers}
          canManage={canManageMembers}
          actionMenuOpen={actionMenuOpen}
          onActionMenuToggle={setActionMenuOpen}
          onSelectMember={setSelectedMember}
          organizationId={organization.id}
          onRefresh={handleRefresh}
          currentUserId={user?.id}
          isCurrentUserOwner={isCurrentUserOwner}
          onTransferOwnership={() => setShowTransferModal(true)}
          data-testid="active-members-section"
        />

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <PendingInvitationsSection
            invitations={pendingInvitations}
            organizationId={organization.id}
            canManage={canManageMembers}
            onRefresh={handleRefresh}
          />
        )}

        {/* Inactive Members Section (if any) */}
        {inactiveMembers.length > 0 && (
          <MembersTable
            title="Inactive Members"
            icon={<UserMinus className="h-5 w-5 text-gray-400" />}
            members={inactiveMembers}
            canManage={canManageMembers}
            actionMenuOpen={actionMenuOpen}
            onActionMenuToggle={setActionMenuOpen}
            onSelectMember={setSelectedMember}
            organizationId={organization.id}
            onRefresh={handleRefresh}
            currentUserId={user?.id}
            showStatus
            data-testid="inactive-members-section"
          />
        )}

        {/* Empty State */}
        {activeMembers.length === 0 && pendingInvitations.length === 0 && (
          <div
            className="rounded-lg border border-gray-200 bg-white p-8 text-center"
            data-testid="members-empty-state"
          >
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No members yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              Invite team members to collaborate on this organization.
            </p>
            {canManageMembers && (
              <Button
                variant="primary"
                onClick={() => setShowInviteModal(true)}
                icon={<UserPlus className="h-4 w-4" />}
                className="mt-4"
                data-testid="members-empty-invite-button"
              >
                Invite Member
              </Button>
            )}
          </div>
        )}

        {/* Invite Member Modal */}
        {showInviteModal && (
          <InviteMemberModal
            organizationId={organization.id}
            onClose={() => setShowInviteModal(false)}
            onSuccess={handleRefresh}
          />
        )}

        {/* Edit Member Modal */}
        {selectedMember && (
          <EditMemberModal
            member={selectedMember}
            organizationId={organization.id}
            onClose={() => setSelectedMember(null)}
            onSuccess={handleRefresh}
          />
        )}

        {/* Transfer Ownership Modal */}
        {showTransferModal && (
          <TransferOwnershipModal
            organizationId={organization.id}
            adminMembers={activeMembers.filter((m) => m.role === "admin")}
            onClose={() => setShowTransferModal(false)}
            onSuccess={handleRefresh}
          />
        )}

        {/* View My Permissions Modal */}
        {showPermissionsModal && permissionsOrg && (
          <EffectivePermissionsModal
            memberName={user?.displayName ?? "You"}
            memberEmail={user?.email ?? ""}
            effectivePermissions={permissionsOrg.effectivePermissions}
            role={permissionsOrg.role}
            functionalRoles={permissionsOrg.functionalRoles}
            onClose={() => setShowPermissionsModal(false)}
          />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Members Table Component
// =============================================================================

interface MembersTableProps {
  readonly title: string
  readonly icon: React.ReactNode
  readonly members: readonly Member[]
  readonly canManage: boolean
  readonly actionMenuOpen: string | null
  readonly onActionMenuToggle: (id: string | null) => void
  readonly onSelectMember: (member: Member) => void
  readonly organizationId: string
  readonly onRefresh: () => void
  readonly currentUserId?: string | undefined
  readonly isCurrentUserOwner?: boolean
  readonly onTransferOwnership?: () => void
  readonly showStatus?: boolean
  readonly "data-testid"?: string
}

function MembersTable({
  title,
  icon,
  members,
  canManage,
  actionMenuOpen,
  onActionMenuToggle,
  onSelectMember,
  organizationId,
  onRefresh,
  currentUserId,
  isCurrentUserOwner = false,
  onTransferOwnership,
  showStatus = false,
  "data-testid": testId
}: MembersTableProps) {
  if (members.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid={testId}>
      <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
        {icon}
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span className="text-sm text-gray-500">({members.length})</span>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="px-6 py-3">Member</th>
            <th className="px-6 py-3">Role</th>
            <th className="px-6 py-3">Functional Roles</th>
            {showStatus && <th className="px-6 py-3">Status</th>}
            <th className="px-6 py-3">Joined</th>
            {canManage && <th className="px-6 py-3 w-12"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId
            const isMenuOpen = actionMenuOpen === member.userId
            const joinedDate = new Date(member.joinedAt.epochMillis).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            })

            return (
              <tr
                key={member.userId}
                className={clsx(
                  "hover:bg-gray-50",
                  isCurrentUser && "bg-blue-50/50"
                )}
                data-testid={`member-row-${member.userId}`}
              >
                {/* Member Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-medium">
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {member.displayName}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs text-blue-600">(You)</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{member.email}</span>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-6 py-4">
                  <RoleBadge role={member.role} size="md" />
                </td>

                {/* Functional Roles */}
                <td className="px-6 py-4">
                  {member.functionalRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {member.functionalRoles.map((fr) => (
                        <span
                          key={fr}
                          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                        >
                          {FUNCTIONAL_ROLE_LABELS[fr]}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">None</span>
                  )}
                </td>

                {/* Status (if shown) */}
                {showStatus && (
                  <td className="px-6 py-4">
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLES[member.status].bg,
                        STATUS_STYLES[member.status].text
                      )}
                    >
                      {STATUS_STYLES[member.status].label}
                    </span>
                  </td>
                )}

                {/* Joined Date */}
                <td className="px-6 py-4 text-sm text-gray-500">
                  {joinedDate}
                </td>

                {/* Actions */}
                {canManage && (
                  <td className="px-6 py-4">
                    <div className="relative">
                      <button
                        onClick={() => onActionMenuToggle(isMenuOpen ? null : member.userId)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        data-testid={`member-actions-${member.userId}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {isMenuOpen && (
                        <MemberActionsMenu
                          member={member}
                          isCurrentUser={isCurrentUser}
                          isCurrentUserOwner={isCurrentUserOwner}
                          organizationId={organizationId}
                          onClose={() => onActionMenuToggle(null)}
                          onEdit={() => {
                            onActionMenuToggle(null)
                            onSelectMember(member)
                          }}
                          onRefresh={onRefresh}
                          onTransferOwnership={onTransferOwnership}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Member Actions Menu
// =============================================================================

interface MemberActionsMenuProps {
  readonly member: Member
  readonly isCurrentUser: boolean
  readonly isCurrentUserOwner: boolean
  readonly organizationId: string
  readonly onClose: () => void
  readonly onEdit: () => void
  readonly onRefresh: () => void
  readonly onTransferOwnership: (() => void) | undefined
}

function MemberActionsMenu({ member, isCurrentUser, isCurrentUserOwner, organizationId, onClose, onEdit, onRefresh, onTransferOwnership }: MemberActionsMenuProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [isReinstating, setIsReinstating] = useState(false)
  const [isSuspending, setIsSuspending] = useState(false)
  const [isUnsuspending, setIsUnsuspending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRemove = async () => {
    if (!window.confirm(`Are you sure you want to remove ${member.displayName} from this organization?`)) {
      return
    }

    setIsRemoving(true)
    setError(null)
    try {
      const { error: apiError } = await api.DELETE("/api/v1/organizations/{orgId}/members/{userId}", {
        params: { path: { orgId: organizationId, userId: member.userId } },
        body: { reason: null }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to remove member"
        setError(errorMessage)
        return
      }

      onRefresh()
      onClose()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsRemoving(false)
    }
  }

  const handleReinstate = async () => {
    setIsReinstating(true)
    setError(null)
    try {
      const { error: apiError } = await api.POST("/api/v1/organizations/{orgId}/members/{userId}/reinstate", {
        params: { path: { orgId: organizationId, userId: member.userId } }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to reinstate member"
        setError(errorMessage)
        return
      }

      onRefresh()
      onClose()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsReinstating(false)
    }
  }

  const handleSuspend = async () => {
    if (!window.confirm(`Are you sure you want to suspend ${member.displayName}? They will temporarily lose access to this organization.`)) {
      return
    }

    setIsSuspending(true)
    setError(null)
    try {
      const { error: apiError } = await api.POST("/api/v1/organizations/{orgId}/members/{userId}/suspend", {
        params: { path: { orgId: organizationId, userId: member.userId } },
        body: { reason: null }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to suspend member"
        setError(errorMessage)
        return
      }

      onRefresh()
      onClose()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsSuspending(false)
    }
  }

  const handleUnsuspend = async () => {
    setIsUnsuspending(true)
    setError(null)
    try {
      const { error: apiError } = await api.POST("/api/v1/organizations/{orgId}/members/{userId}/unsuspend", {
        params: { path: { orgId: organizationId, userId: member.userId } }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to unsuspend member"
        setError(errorMessage)
        return
      }

      onRefresh()
      onClose()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsUnsuspending(false)
    }
  }

  const isOwner = member.role === "owner"
  const canRemove = !isCurrentUser && !isOwner && member.status === "active"
  const canSuspend = !isCurrentUser && !isOwner && member.status === "active"
  const canUnsuspend = member.status === "suspended"
  const canReinstate = member.status === "removed"
  const canEdit = !isOwner && member.status === "active"

  return (
    <div
      className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      data-testid={`member-actions-menu-${member.userId}`}
    >
      {error && (
        <div className="px-4 py-2 text-xs text-red-600 border-b border-gray-200">
          {error}
        </div>
      )}

      {canEdit && (
        <button
          onClick={onEdit}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          data-testid="member-edit-role"
        >
          <Shield className="h-4 w-4" />
          Edit Role
        </button>
      )}

      {canSuspend && (
        <button
          onClick={handleSuspend}
          disabled={isSuspending}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"
          data-testid="member-suspend"
        >
          <Pause className={clsx("h-4 w-4", isSuspending && "animate-pulse")} />
          Suspend
        </button>
      )}

      {canUnsuspend && (
        <button
          onClick={handleUnsuspend}
          disabled={isUnsuspending}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
          data-testid="member-unsuspend"
        >
          <Play className={clsx("h-4 w-4", isUnsuspending && "animate-spin")} />
          Unsuspend
        </button>
      )}

      {canReinstate && (
        <button
          onClick={handleReinstate}
          disabled={isReinstating}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
          data-testid="member-reinstate"
        >
          <RefreshCw className={clsx("h-4 w-4", isReinstating && "animate-spin")} />
          Reinstate
        </button>
      )}

      {canRemove && (
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          data-testid="member-remove"
        >
          <UserMinus className="h-4 w-4" />
          Remove
        </button>
      )}

      {isOwner && !isCurrentUserOwner && (
        <div className="px-4 py-2 text-xs text-gray-500">
          Owner cannot be modified
        </div>
      )}

      {/* Show transfer ownership option for the current owner viewing their own menu */}
      {isOwner && isCurrentUserOwner && isCurrentUser && onTransferOwnership && (
        <button
          onClick={() => {
            onClose()
            onTransferOwnership()
          }}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
          data-testid="member-transfer-ownership"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transfer Ownership
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Pending Invitations Section
// =============================================================================

interface PendingInvitationsSectionProps {
  readonly invitations: readonly Invitation[]
  readonly organizationId: string
  readonly canManage: boolean
  readonly onRefresh: () => void
}

function PendingInvitationsSection({
  invitations,
  organizationId,
  canManage,
  onRefresh
}: PendingInvitationsSectionProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const handleRevoke = async (invitationId: string) => {
    if (!window.confirm("Are you sure you want to revoke this invitation?")) {
      return
    }

    setRevokingId(invitationId)
    try {
      await api.DELETE("/api/v1/organizations/{orgId}/invitations/{invitationId}", {
        params: { path: { orgId: organizationId, invitationId } }
      })
      onRefresh()
    } catch {
      // Error handling
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div
      className="rounded-lg border border-yellow-200 bg-yellow-50"
      data-testid="pending-invitations-section"
    >
      <div className="flex items-center gap-2 border-b border-yellow-200 px-6 py-4">
        <Clock className="h-5 w-5 text-yellow-600" />
        <h2 className="text-lg font-semibold text-yellow-800">Pending Invitations</h2>
        <span className="text-sm text-yellow-700">({invitations.length})</span>
      </div>

      <div className="p-4 space-y-3">
        {invitations.map((invitation) => {
          const sentDate = new Date(invitation.createdAt.epochMillis).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })
          const isRevoking = revokingId === invitation.id

          return (
            <div
              key={invitation.id}
              className="flex items-center justify-between rounded-lg bg-white p-4 border border-yellow-200"
              data-testid={`invitation-row-${invitation.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{invitation.email}</span>
                    <RoleBadge role={invitation.role} size="sm" />
                  </div>
                  <span className="text-sm text-gray-500">
                    Invited by {invitation.invitedBy.displayName} on {sentDate}
                  </span>
                </div>
              </div>

              {canManage && (
                <button
                  onClick={() => handleRevoke(invitation.id)}
                  disabled={isRevoking}
                  className={clsx(
                    "p-2 rounded-lg text-red-600 hover:bg-red-50",
                    isRevoking && "opacity-50 cursor-not-allowed"
                  )}
                  title="Revoke invitation"
                  data-testid={`revoke-invitation-${invitation.id}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Invite Member Modal (Placeholder - Will be expanded in H3)
// =============================================================================

interface InviteMemberModalProps {
  readonly organizationId: string
  readonly onClose: () => void
  readonly onSuccess: () => void
}

function InviteMemberModal({ organizationId, onClose, onSuccess }: InviteMemberModalProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InviteRole>("member")
  const [functionalRoles, setFunctionalRoles] = useState<FunctionalRole[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDuplicateError, setIsDuplicateError] = useState(false)
  // Success state - stores the invitation link after successful creation
  const [invitationLink, setInvitationLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const toggleFunctionalRole = (fr: FunctionalRole) => {
    setFunctionalRoles((prev) =>
      prev.includes(fr) ? prev.filter((r) => r !== fr) : [...prev, fr]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setError("Email is required")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setIsDuplicateError(false)

    try {
      const { data, error: apiError } = await api.POST("/api/v1/organizations/{orgId}/members/invite", {
        params: { path: { orgId: organizationId } },
        body: {
          email: email.trim(),
          role,
          functionalRoles
        }
      })

      if (apiError) {
        // Check for duplicate invitation error by _tag (Effect HttpApi uses _tag as discriminator)
        const isDuplicate = typeof apiError === "object" && "_tag" in apiError &&
          apiError._tag === "InvitationAlreadyExistsError"
        setIsDuplicateError(isDuplicate)

        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to send invitation"
        setError(errorMessage)
        return
      }

      // Build the invitation link using the returned token
      // The link format is /invitations/{token}/accept
      if (data?.invitationToken) {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
        setInvitationLink(`${baseUrl}/invitations/${data.invitationToken}/accept`)
      }

      // Refresh the members list to show the pending invitation
      onSuccess()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyLink = async () => {
    if (!invitationLink) return

    try {
      await navigator.clipboard.writeText(invitationLink)
      setCopied(true)
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = invitationLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDone = () => {
    onClose()
  }

  // Show functional roles for member role
  const showFunctionalRoles = role === "member"

  // Success view - show invitation link
  if (invitationLink) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        data-testid="invite-member-modal"
      >
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Invitation Created</h2>
            <button
              onClick={handleDone}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              data-testid="invite-modal-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto">
              <Check className="h-6 w-6 text-green-600" />
            </div>

            <div className="text-center">
              <p className="text-gray-700">
                Invitation created for <span className="font-medium">{email}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Share this link with them to join the organization
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Link className="h-4 w-4 inline-block mr-1" />
                Invitation Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invitationLink}
                  readOnly
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-700"
                  data-testid="invitation-link-input"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCopyLink}
                  icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  className={clsx(copied && "text-green-600 border-green-300")}
                  data-testid="copy-invitation-link-button"
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 mt-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> This link can only be viewed once. Make sure to copy it now before closing this dialog.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="button"
                variant="primary"
                onClick={handleDone}
                data-testid="invite-done-button"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Form view - create invitation
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="invite-member-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Invite Member</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            data-testid="invite-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className={clsx(
                "rounded-lg border p-3 text-sm",
                isDuplicateError
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-red-50 border-red-200 text-red-700"
              )}
              data-testid="invite-error-message"
            >
              <p className="font-medium">{isDuplicateError ? "Invitation already exists" : error}</p>
              {isDuplicateError && (
                <p className="mt-1 text-yellow-700">
                  A pending invitation for <strong>{email}</strong> already exists. You can view it in the &quot;Pending Invitations&quot; section below, or revoke it and create a new one.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="invite-email-input"
            />
          </div>

          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700">
              Base Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => {
                const value = e.target.value
                if (isInviteRole(value)) {
                  setRole(value)
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="invite-role-select"
            >
              <option value="admin">Admin - Full organization management</option>
              <option value="member">Member - Access based on functional roles</option>
              <option value="viewer">Viewer - Read-only access</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {role === "admin" && "Admins have full access to manage the organization."}
              {role === "member" && "Members need functional roles to access features."}
              {role === "viewer" && "Viewers can only view data, not make changes."}
            </p>
          </div>

          {showFunctionalRoles && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Functional Roles
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Assign specific capabilities. Members without functional roles have very limited access.
              </p>
              <div className="space-y-2">
                {FUNCTIONAL_ROLE_KEYS.map((fr) => (
                  <label
                    key={fr}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={functionalRoles.includes(fr)}
                      onChange={() => toggleFunctionalRole(fr)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      data-testid={`invite-functional-role-${fr}`}
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{FUNCTIONAL_ROLE_LABELS[fr]}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{FUNCTIONAL_ROLE_DESCRIPTIONS[fr]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="invite-cancel-button"
            >
              Cancel
            </Button>
            {isDuplicateError ? (
              <Button
                type="button"
                variant="primary"
                onClick={onClose}
                data-testid="invite-view-pending-button"
              >
                View Pending Invitations
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting}
                data-testid="invite-submit-button"
              >
                Create Invitation
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// Edit Member Modal (Placeholder - Will be expanded in H4)
// =============================================================================

interface EditMemberModalProps {
  readonly member: Member
  readonly organizationId: string
  readonly onClose: () => void
  readonly onSuccess: () => void
}

function EditMemberModal({ member, organizationId, onClose, onSuccess }: EditMemberModalProps) {
  // If member is admin/member/viewer, use that, otherwise default to member
  const initialRole: EditRole = member.role === "owner" ? "admin" : member.role
  const [role, setRole] = useState<EditRole>(initialRole)
  const [functionalRoles, setFunctionalRoles] = useState<FunctionalRole[]>([...member.functionalRoles])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleFunctionalRole = (fr: FunctionalRole) => {
    setFunctionalRoles((prev) =>
      prev.includes(fr) ? prev.filter((r) => r !== fr) : [...prev, fr]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.PATCH("/api/v1/organizations/{orgId}/members/{userId}", {
        params: { path: { orgId: organizationId, userId: member.userId } },
        body: {
          role,
          functionalRoles
        }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to update member"
        setError(errorMessage)
        return
      }

      onSuccess()
      onClose()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show functional roles for member role
  const showFunctionalRoles = role === "member"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="edit-member-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Member Role</h2>
            <p className="text-sm text-gray-500">{member.displayName} ({member.email})</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            data-testid="edit-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700">
              Base Role
            </label>
            <select
              id="edit-role"
              value={role}
              onChange={(e) => {
                const value = e.target.value
                if (isEditRole(value)) {
                  setRole(value)
                }
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="edit-role-select"
            >
              <option value="admin">Admin - Full organization management</option>
              <option value="member">Member - Access based on functional roles</option>
              <option value="viewer">Viewer - Read-only access</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {role === "admin" && "Admins have full access to manage the organization."}
              {role === "member" && "Members need functional roles to access features."}
              {role === "viewer" && "Viewers can only view data, not make changes."}
            </p>
          </div>

          {showFunctionalRoles && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Functional Roles
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Assign specific capabilities. Members without functional roles have very limited access.
              </p>
              <div className="space-y-2">
                {FUNCTIONAL_ROLE_KEYS.map((fr) => (
                  <label
                    key={fr}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={functionalRoles.includes(fr)}
                      onChange={() => toggleFunctionalRole(fr)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      data-testid={`functional-role-${fr}`}
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{FUNCTIONAL_ROLE_LABELS[fr]}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{FUNCTIONAL_ROLE_DESCRIPTIONS[fr]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!showFunctionalRoles && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-700">
                {role === "admin"
                  ? "Admins have all permissions and don't need functional roles."
                  : "Viewers have read-only access and don't need functional roles."}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="edit-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
              data-testid="edit-submit-button"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// Transfer Ownership Modal
// =============================================================================

interface TransferOwnershipModalProps {
  readonly organizationId: string
  readonly adminMembers: readonly Member[]
  readonly onClose: () => void
  readonly onSuccess: () => void
}

type MyNewRole = "admin" | "member" | "viewer"

const MY_NEW_ROLE_OPTIONS: readonly { readonly value: MyNewRole; readonly label: string; readonly description: string }[] = [
  { value: "admin", label: "Admin", description: "Full organization management" },
  { value: "member", label: "Member", description: "Access based on functional roles" },
  { value: "viewer", label: "Viewer", description: "Read-only access" }
]

function isMyNewRole(value: string): value is MyNewRole {
  return value === "admin" || value === "member" || value === "viewer"
}

function TransferOwnershipModal({ organizationId, adminMembers, onClose, onSuccess }: TransferOwnershipModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [myNewRole, setMyNewRole] = useState<MyNewRole>("admin")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const selectedMember = adminMembers.find((m) => m.userId === selectedUserId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      setError("Please select a new owner")
      return
    }

    // First step: show confirmation
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    // Second step: actually transfer
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/organizations/{orgId}/transfer-ownership", {
        params: { path: { orgId: organizationId } },
        body: {
          toUserId: selectedUserId,
          myNewRole
        }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to transfer ownership"
        setError(errorMessage)
        setShowConfirm(false)
        return
      }

      onSuccess()
      onClose()
    } catch {
      setError("An unexpected error occurred")
      setShowConfirm(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirmation view
  if (showConfirm && selectedMember) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        data-testid="transfer-ownership-modal"
      >
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Confirm Ownership Transfer</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              data-testid="transfer-modal-close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-amber-800">This action cannot be undone</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    You are about to transfer organization ownership to <strong>{selectedMember.displayName}</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>After transfer:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>{selectedMember.displayName}</strong> will become the new owner</li>
                <li>Your role will change to <strong>{MY_NEW_ROLE_OPTIONS.find(r => r.value === myNewRole)?.label}</strong></li>
                <li>Only the new owner can transfer ownership again</li>
              </ul>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                data-testid="transfer-back-button"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={isSubmitting}
                disabled={isSubmitting}
                onClick={handleSubmit}
                data-testid="transfer-confirm-button"
              >
                Transfer Ownership
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Selection form view
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="transfer-ownership-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Transfer Ownership</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            data-testid="transfer-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {adminMembers.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
              <p className="text-sm text-yellow-800">
                <strong>No eligible members.</strong> Ownership can only be transferred to admin members.
                First promote a member to admin, then you can transfer ownership to them.
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                data-testid="transfer-close-button"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="transfer-target" className="block text-sm font-medium text-gray-700">
                New Owner
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Select an admin member to become the new organization owner.
              </p>
              <select
                id="transfer-target"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="transfer-target-select"
              >
                <option value="">Select a member...</option>
                {adminMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName} ({member.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="my-new-role" className="block text-sm font-medium text-gray-700">
                Your New Role
              </label>
              <p className="text-xs text-gray-500 mb-2">
                What role do you want after transferring ownership?
              </p>
              <select
                id="my-new-role"
                value={myNewRole}
                onChange={(e) => {
                  const value = e.target.value
                  if (isMyNewRole(value)) {
                    setMyNewRole(value)
                  }
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="my-new-role-select"
              >
                {MY_NEW_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Ownership can only be transferred to admin members.
                If you don&apos;t see the member you want, promote them to admin first.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                data-testid="transfer-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedUserId}
                data-testid="transfer-continue-button"
              >
                Continue
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Effective Permissions Modal
// =============================================================================

interface EffectivePermissionsModalProps {
  readonly memberName: string
  readonly memberEmail: string
  readonly effectivePermissions: readonly string[]
  readonly role: BaseRole
  readonly functionalRoles: readonly string[]
  readonly onClose: () => void
}

function EffectivePermissionsModal({
  memberName,
  memberEmail,
  effectivePermissions,
  role,
  functionalRoles,
  onClose
}: EffectivePermissionsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="effective-permissions-modal"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Effective Permissions</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {memberName} ({memberEmail})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            data-testid="permissions-modal-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role Info */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Base Role:</span>
              <RoleBadge role={role} size="md" />
            </div>
            {functionalRoles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Functional Roles:</span>
                <div className="flex flex-wrap gap-1">
                  {functionalRoles.map((fr) => {
                    const labelLookup: Record<string, string> = FUNCTIONAL_ROLE_LABELS
                    const label = labelLookup[fr]
                    return (
                      <span
                        key={fr}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                      >
                        {label ?? fr}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Permissions View */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <EffectivePermissionsView effectivePermissions={effectivePermissions} />
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={onClose}
            data-testid="permissions-modal-done"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
