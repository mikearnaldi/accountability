/**
 * Profile Page
 *
 * User profile management page. Allows users to view and edit their profile.
 *
 * Features:
 * - View account information (email, role, provider)
 * - Edit display name
 * - View linked authentication providers
 * - Member since date
 *
 * Route: /profile (global, not org-scoped)
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
  Shield,
  Key,
  Calendar,
  Save,
  AlertCircle,
  CheckCircle,
  ArrowLeft
} from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface UserProfile {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: string
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

export interface ProfileLoaderResult {
  readonly user: UserProfile
  readonly identities: readonly Identity[]
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchUserProfile = createServerFn({ method: "GET" }).handler(async (): Promise<ProfileLoaderResult | null> => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return null
  }

  try {
    const serverApi = createServerApi()
    const headers = { Authorization: `Bearer ${sessionToken}` }

    const { data, error } = await serverApi.GET("/api/auth/me", { headers })

    if (error || !data) {
      return null
    }

    // Map API response to our expected structure without type assertions
    // The API returns typed data, we just need to ensure the shape matches
    const user: UserProfile = {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.displayName ?? "",
      role: data.user.role,
      primaryProvider: data.user.primaryProvider,
      createdAt: data.user.createdAt
    }

    const identities: readonly Identity[] = data.identities.map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      providerId: identity.providerId,
      createdAt: identity.createdAt
    }))

    return {
      user,
      identities
    }
  } catch {
    return null
  }
})

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/profile")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
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
    if (!result) {
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
  const { user, identities } = Route.useLoaderData()
  const context = Route.useRouteContext()
  const router = useRouter()

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

      if (error) {
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

  // Get role display name
  const getRoleDisplayName = (role: string): string => {
    const roles: Record<string, string> = {
      admin: "Administrator",
      owner: "Owner",
      member: "Member",
      viewer: "Viewer"
    }
    return roles[role] || role
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Profile", href: "/profile" }
  ]

  return (
    <AppLayout
      user={context.user}
      organizations={[]}
      currentOrganization={null}
      showBreadcrumbs={true}
      breadcrumbItems={breadcrumbItems}
    >
      <div className="max-w-2xl mx-auto space-y-6" data-testid="profile-page">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/organizations"
            className="flex items-center justify-center h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            title="Back to Organizations"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
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

            {/* Role (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-gray-400" />
                <span className="text-gray-900" data-testid="profile-role">{getRoleDisplayName(user.role)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Managed by organization administrators</p>
            </div>
          </form>
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
