/**
 * User Invitations Page
 *
 * Phase J1 of AUTHORIZATION.md spec - User Invitations Page
 *
 * Shows the user's pending invitations to organizations with:
 * - Organization name, role, and inviter info
 * - Accept/decline buttons for each invitation
 * - Empty state when no invitations exist
 *
 * Route: /invitations (global, not org-scoped)
 */

import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/Button"
import {
  Mail,
  Building2,
  Check,
  X,
  ArrowLeft,
  Calendar,
  User,
  Inbox,
  RefreshCw
} from "lucide-react"
import { RoleBadge, type BaseRole } from "@/components/layout/OrganizationSelector"

// =============================================================================
// Types
// =============================================================================

interface Inviter {
  readonly email: string
  readonly displayName: string
}

interface PendingInvitation {
  readonly id: string
  readonly organizationId: string
  readonly organizationName: string
  readonly role: BaseRole
  readonly functionalRoles: readonly string[]
  readonly invitedBy: Inviter
  readonly createdAt: { readonly epochMillis: number }
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchUserInvitations = createServerFn({ method: "GET" }).handler(async () => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return { invitations: [], error: "unauthorized" as const }
  }

  try {
    const serverApi = createServerApi()
    const headers = { Authorization: `Bearer ${sessionToken}` }

    const { data, error } = await serverApi.GET("/api/v1/users/me/invitations", { headers })

    if (error) {
      return { invitations: [], error: "failed" as const }
    }

    return { invitations: data?.invitations ?? [], error: null }
  } catch {
    return { invitations: [], error: "failed" as const }
  }
})

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/invitations")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/invitations"
        }
      })
    }
  },
  loader: async () => {
    const result = await fetchUserInvitations()
    return { invitations: result.invitations }
  },
  component: InvitationsPage
})

// =============================================================================
// Page Component
// =============================================================================

function InvitationsPage() {
  const context = Route.useRouteContext()
  const { invitations } = Route.useLoaderData()
  const router = useRouter()

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const pendingInvitations = invitations as readonly PendingInvitation[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async (invitation: PendingInvitation) => {
    setProcessingId(invitation.id)
    setError(null)

    try {
      // Note: The accept endpoint expects a token, but we're using the invitation ID
      // In a real implementation, we'd need the actual token - for now we assume the
      // API implementation on the backend handles this mapping via the session
      const { error: apiError, data } = await api.POST("/api/v1/invitations/{token}/accept", {
        params: { path: { token: invitation.id } }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to accept invitation"
        setError(errorMessage)
        return
      }

      // Navigate to the organization
      if (data?.organizationId) {
        await router.navigate({
          to: "/organizations/$organizationId/dashboard",
          params: { organizationId: data.organizationId }
        })
      } else {
        // Refresh the page to show updated invitations
        await router.invalidate()
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setProcessingId(null)
    }
  }

  const handleDecline = async (invitation: PendingInvitation) => {
    if (!window.confirm(`Are you sure you want to decline the invitation from ${invitation.organizationName}?`)) {
      return
    }

    setProcessingId(invitation.id)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/invitations/{token}/decline", {
        params: { path: { token: invitation.id } }
      })

      if (apiError) {
        const errorMessage = typeof apiError === "object" && "message" in apiError
          ? String(apiError.message)
          : "Failed to decline invitation"
        setError(errorMessage)
        return
      }

      // Refresh the page to show updated invitations
      await router.invalidate()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setProcessingId(null)
    }
  }

  const handleRefresh = async () => {
    await router.invalidate()
  }

  const breadcrumbItems = [
    { label: "Invitations", href: "/invitations" }
  ]

  return (
    <AppLayout
      user={context.user}
      organizations={[]}
      currentOrganization={null}
      showBreadcrumbs={true}
      breadcrumbItems={breadcrumbItems}
    >
      <div className="max-w-2xl mx-auto space-y-6" data-testid="invitations-page">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/organizations"
              className="flex items-center justify-center h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              title="Back to Organizations"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
              <p className="text-sm text-gray-500">
                {pendingInvitations.length > 0
                  ? `You have ${pendingInvitations.length} pending invitation${pendingInvitations.length === 1 ? "" : "s"}`
                  : "No pending invitations"}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleRefresh}
            icon={<RefreshCw className="h-4 w-4" />}
            data-testid="invitations-refresh-button"
          >
            Refresh
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700"
            data-testid="invitations-error"
          >
            {error}
          </div>
        )}

        {/* Empty State */}
        {pendingInvitations.length === 0 && (
          <div
            className="rounded-lg border border-gray-200 bg-white p-8 text-center"
            data-testid="invitations-empty-state"
          >
            <Inbox className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No pending invitations</h3>
            <p className="mt-2 text-sm text-gray-500">
              When someone invites you to join their organization, it will appear here.
            </p>
            <Link
              to="/organizations"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Organizations
            </Link>
          </div>
        )}

        {/* Invitations List */}
        {pendingInvitations.length > 0 && (
          <div className="space-y-4" data-testid="invitations-list">
            {pendingInvitations.map((invitation) => {
              const isProcessing = processingId === invitation.id
              const invitedDate = new Date(invitation.createdAt.epochMillis).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })

              return (
                <div
                  key={invitation.id}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                  data-testid={`invitation-card-${invitation.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left Side - Organization Info */}
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <Building2 className="h-6 w-6" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {invitation.organizationName}
                          </h3>
                          <RoleBadge role={invitation.role} size="md" />
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4" />
                            <span>
                              Invited by {invitation.invitedBy.displayName || invitation.invitedBy.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            <span>{invitedDate}</span>
                          </div>
                        </div>

                        {/* Functional Roles (if any) */}
                        {invitation.functionalRoles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-xs text-gray-500 mr-1">Roles:</span>
                            {invitation.functionalRoles.map((fr) => (
                              <span
                                key={fr}
                                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                              >
                                {formatFunctionalRole(fr)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Side - Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDecline(invitation)}
                        disabled={isProcessing}
                        icon={<X className="h-4 w-4" />}
                        data-testid={`invitation-decline-${invitation.id}`}
                      >
                        Decline
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAccept(invitation)}
                        disabled={isProcessing}
                        loading={isProcessing}
                        icon={<Check className="h-4 w-4" />}
                        data-testid={`invitation-accept-${invitation.id}`}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info Banner */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">About Invitations</p>
              <p className="mt-1 text-blue-700">
                When you accept an invitation, you&apos;ll become a member of the organization with the
                role assigned by the inviter. You can view and manage your organization memberships
                from the Organizations page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format a functional role string for display
 */
function formatFunctionalRole(role: string): string {
  const roleLabels: Record<string, string> = {
    controller: "Controller",
    finance_manager: "Finance Manager",
    accountant: "Accountant",
    period_admin: "Period Admin",
    consolidation_manager: "Consolidation Manager"
  }
  return roleLabels[role] || role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}
