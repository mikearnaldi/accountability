/**
 * Profile Page
 *
 * User profile management page. Allows users to view and edit their profile.
 *
 * Features:
 * - View account information (email, provider)
 * - Edit display name
 * - View linked authentication providers
 * - View all organization memberships with roles
 * - Member since date
 *
 * Route: /profile (global, not org-scoped)
 * NOTE: Organization context is preserved - the organization selector remains populated
 */

import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useEffect, type FormEvent } from "react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/Button"
import {
  User,
  Mail,
  Key,
  Calendar,
  Save,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Building2,
  Crown,
  Shield,
  Eye,
  UserCircle
} from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface UserProfile {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly primaryProvider: string
  readonly createdAt: {
    readonly epochMillis: number
  }
}

interface Identity {
  readonly id: string
  readonly provider: string
  readonly providerId: string
  readonly createdAt: {
    readonly epochMillis: number
  }
}

interface OrganizationMembership {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly functionalRoles: readonly string[]
}

interface OrganizationForSelector {
  readonly id: string
  readonly name: string
}

export interface ProfileSearchParams {
  readonly org?: string | undefined
}

export interface ProfileLoaderResult {
  readonly user: UserProfile
  readonly identities: readonly Identity[]
  readonly memberships: readonly OrganizationMembership[]
  readonly organizations: readonly OrganizationForSelector[]
  readonly currentOrgId?: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchUserProfile = createServerFn({ method: "GET" }).handler(async (): Promise<ProfileLoaderResult | null> => {
  const sessionToken = getCookie("accountability_session")

  if (sessionToken === undefined || sessionToken === null || sessionToken === "") {
    return null
  }

  try {
    const serverApi = createServerApi()
    const headers = { Authorization: `Bearer ${sessionToken}` }

    // Fetch user profile and organizations in parallel
    const [userResult, orgsResult] = await Promise.all([
      serverApi.GET("/api/auth/me", { headers }),
      serverApi.GET("/api/v1/users/me/organizations", { headers })
    ])

    if (userResult.error !== undefined || userResult.data === undefined) {
      return null
    }

    // Map API response to our expected structure without type assertions
    // The API returns typed data, we just need to ensure the shape matches
    const user: UserProfile = {
      id: userResult.data.user.id,
      email: userResult.data.user.email,
      displayName: userResult.data.user.displayName ?? "",
      primaryProvider: userResult.data.user.primaryProvider,
      createdAt: userResult.data.user.createdAt
    }

    const identities: readonly Identity[] = userResult.data.identities.map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      providerId: identity.providerId,
      createdAt: identity.createdAt
    }))

    // Map organizations with membership info
    const memberships: readonly OrganizationMembership[] = orgsResult.data?.organizations?.map((org) => ({
      id: org.id,
      name: org.name,
      role: org.role,
      functionalRoles: org.functionalRoles
    })) ?? []

    // Also map to simple org format for the selector
    const organizations: readonly OrganizationForSelector[] = memberships.map((m) => ({
      id: m.id,
      name: m.name
    }))

    return {
      user,
      identities,
      memberships,
      organizations
    }
  } catch {
    return null
  }
})

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>): ProfileSearchParams => {
    return {
      org: typeof search.org === "string" ? search.org : undefined
    }
  },
  beforeLoad: async ({ context }) => {
    if (context.user === null) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/profile"
        }
      })
    }
  },
  loader: async () => {
    const result = await fetchUserProfile()
    if (result === null) {
      throw redirect({ to: "/login" })
    }
    return result
  },
  component: ProfilePage
})

// =============================================================================
// Profile Page Component
// =============================================================================

function ProfilePage() {
  const { user, identities, memberships, organizations } = Route.useLoaderData()
  const { org: currentOrgId } = Route.useSearch()
  const context = Route.useRouteContext()
  const router = useRouter()

  // Find the current organization from the search param, or default to first org
  const currentOrganization = currentOrgId !== undefined
    ? organizations.find((o) => o.id === currentOrgId) ?? organizations[0] ?? null
    : organizations[0] ?? null

  const [displayName, setDisplayName] = useState(user.displayName)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Reset success message after delay
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()

    if (displayName === user.displayName) {
      return // No changes
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const { error } = await api.PUT("/api/auth/me", {
        body: {
          displayName: displayName.trim() || null
        }
      })

      if (error !== undefined) {
        setSaveError("Failed to update profile. Please try again.")
      } else {
        setSaveSuccess(true)
        // Refresh data to get updated user info
        await router.invalidate()
      }
    } catch {
      setSaveError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  // Go back to previous page, or organizations list if no history
  // Note: history.length > 2 because the browser always starts with 1 entry (current page)
  // and we need at least one more entry to go back to
  const handleGoBack = () => {
    if (window.history.length > 2) {
      window.history.back()
    } else {
      router.navigate({ to: "/organizations" })
    }
  }

  const hasChanges = displayName !== user.displayName

  // Format dates
  const memberSince = new Date(user.createdAt.epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  // Get provider display name
  const getProviderName = (provider: string): string => {
    const providers: Record<string, string> = {
      local: "Email & Password",
      google: "Google",
      github: "GitHub",
      workos: "WorkOS SSO",
      saml: "SAML SSO"
    }
    return providers[provider] || provider
  }

  // Get role display info with icon
  const getRoleInfo = (role: string): { label: string; icon: React.ReactNode; color: string } => {
    const roleMap: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
      owner: { label: "Owner", icon: <Crown className="h-4 w-4" />, color: "text-amber-600 bg-amber-50" },
      admin: { label: "Administrator", icon: <Shield className="h-4 w-4" />, color: "text-purple-600 bg-purple-50" },
      member: { label: "Member", icon: <UserCircle className="h-4 w-4" />, color: "text-blue-600 bg-blue-50" },
      viewer: { label: "Viewer", icon: <Eye className="h-4 w-4" />, color: "text-gray-600 bg-gray-50" }
    }
    return roleMap[role] || { label: role, icon: <UserCircle className="h-4 w-4" />, color: "text-gray-600 bg-gray-50" }
  }

  // Format functional roles for display
  const formatFunctionalRoles = (roles: readonly string[]): string => {
    if (roles.length === 0) return ""
    return roles.map(r => r.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())).join(", ")
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Profile", href: "/profile" }
  ]

  return (
    <AppLayout
      user={context.user}
      organizations={organizations}
      currentOrganization={currentOrganization}
      showBreadcrumbs={true}
      breadcrumbItems={breadcrumbItems}
    >
      <div className="max-w-2xl mx-auto space-y-6" data-testid="profile-page">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleGoBack}
            type="button"
            className="flex items-center justify-center h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <p className="text-sm text-gray-500">Manage your account settings</p>
          </div>
        </div>

        {/* Account Information Card */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Display Name (Editable) */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    data-testid="profile-display-name-input"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter your display name"
                  />
                </div>
                <Button
                  type="submit"
                  icon={<Save className="h-4 w-4" />}
                  disabled={!hasChanges || isSaving}
                  loading={isSaving}
                  data-testid="profile-save-button"
                >
                  Save
                </Button>
              </div>

              {/* Success/Error Messages */}
              {saveSuccess && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600" data-testid="profile-save-success">
                  <CheckCircle className="h-4 w-4" />
                  Profile updated successfully
                </div>
              )}
              {saveError && (
                <div className="mt-2 flex items-center gap-2 text-sm text-red-600" data-testid="profile-save-error">
                  <AlertCircle className="h-4 w-4" />
                  {saveError}
                </div>
              )}
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-gray-900" data-testid="profile-email">{user.email}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>
          </form>
        </div>

        {/* Organization Memberships Card */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Your Organizations</h2>
            <p className="text-sm text-gray-500 mt-1">Organizations you are a member of and your roles</p>
          </div>

          <div className="p-6">
            {memberships.length === 0 ? (
              <div className="text-center py-6">
                <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">You are not a member of any organization yet.</p>
                <Link
                  to="/organizations/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Organization
                </Link>
              </div>
            ) : (
              <div className="space-y-3" data-testid="profile-memberships">
                {memberships.map((membership) => {
                  const roleInfo = getRoleInfo(membership.role)
                  const functionalRolesText = formatFunctionalRoles(membership.functionalRoles)
                  return (
                    <Link
                      key={membership.id}
                      to="/organizations/$organizationId/dashboard"
                      params={{ organizationId: membership.id }}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                      data-testid={`profile-membership-${membership.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <div>
                          <span className="font-medium text-gray-900 group-hover:text-blue-600">
                            {membership.name}
                          </span>
                          {functionalRolesText && (
                            <p className="text-xs text-gray-500 mt-0.5">{functionalRolesText}</p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                        {roleInfo.icon}
                        {roleInfo.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Authentication Card */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Authentication</h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Primary Sign-in Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Sign-in Method
              </label>
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-gray-400" />
                <span className="text-gray-900" data-testid="profile-provider">
                  {getProviderName(user.primaryProvider)}
                </span>
              </div>
            </div>

            {/* Linked Accounts */}
            {identities.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Linked Accounts
                </label>
                <div className="space-y-2">
                  {identities.map((identity) => (
                    <div
                      key={identity.id}
                      className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg"
                      data-testid={`profile-identity-${identity.provider}`}
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {getProviderName(identity.provider)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Member Since */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Member Since
              </label>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-gray-900" data-testid="profile-member-since">{memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone (Placeholder for future) */}
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50">
            <h2 className="text-lg font-semibold text-red-800">Danger Zone</h2>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Delete Account</p>
                <p className="text-sm text-gray-500">
                  Permanently delete your account and all associated data.
                </p>
              </div>
              <Button
                variant="danger"
                disabled
                title="Account deletion coming soon"
                data-testid="profile-delete-button"
              >
                Delete Account
              </Button>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Account deletion is not yet available. Contact support if you need to delete your account.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
