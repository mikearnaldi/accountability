/**
 * Platform Administrators Page
 *
 * Read-only list of platform administrators.
 * Only accessible to platform administrators.
 *
 * Features:
 * - View all platform administrators
 * - Display email, name, and creation date
 *
 * Route: /platform-admins (global, not org-scoped)
 * Access: Platform administrators only
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  Shield,
  ArrowLeft,
  Mail,
  Calendar,
  User
} from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface PlatformAdmin {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly createdAt: string
}

export interface LoaderResult {
  readonly admins: readonly PlatformAdmin[]
  readonly count: number
}

// =============================================================================
// Server Functions
// =============================================================================

/**
 * Loader: Fetch platform administrators
 */
const getPlatformAdmins = createServerFn({ method: "GET" }).handler(
  async (): Promise<LoaderResult> => {
    const sessionToken = getCookie("accountability_session")

    if (sessionToken === undefined || sessionToken === null || sessionToken === "") {
      return { admins: [], count: 0 }
    }

    try {
      const serverApi = createServerApi()
      const headers = { Authorization: `Bearer ${sessionToken}` }

      const { data, error } = await serverApi.GET("/api/v1/platform-admins", { headers })

      if (error !== undefined) {
        // If 403 Forbidden, user is not a platform admin - return empty
        return { admins: [], count: 0 }
      }

      return {
        admins: data?.admins ?? [],
        count: data?.count ?? 0
      }
    } catch {
      return { admins: [], count: 0 }
    }
  }
)

// =============================================================================
// Route
// =============================================================================

export const Route = createFileRoute("/platform-admins")({
  beforeLoad: async ({ context }) => {
    // Require authentication
    if (context.user === null) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/platform-admins"
        }
      })
    }
  },
  loader: () => getPlatformAdmins(),
  component: PlatformAdminsPage
})

// =============================================================================
// Component
// =============================================================================

function PlatformAdminsPage() {
  const context = Route.useRouteContext()
  const { admins, count } = Route.useLoaderData()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  // If no admins returned, user likely doesn't have permission
  const hasAccess = count > 0 || admins.length > 0

  const breadcrumbItems = [
    { label: "Platform Administrators", href: "/platform-admins" }
  ]

  return (
    <AppLayout
      user={context.user}
      organizations={[]}
      currentOrganization={null}
      showBreadcrumbs={true}
      breadcrumbItems={breadcrumbItems}
    >
      <div className="max-w-4xl mx-auto space-y-6" data-testid="platform-admins-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center justify-center h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              title="Back to home"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Platform Administrators
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {hasAccess
                  ? `${count} administrator${count !== 1 ? "s" : ""} with full system access`
                  : "Access restricted"}
              </p>
            </div>
          </div>
        </div>

        {/* Access Denied State */}
        {!hasAccess && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
            <p className="mt-2 text-sm text-gray-500">
              Only platform administrators can view this page.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Return to home
            </Link>
          </div>
        )}

        {/* Info Banner */}
        {hasAccess && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">
                    Platform Admin Access
                  </h3>
                  <p className="mt-1 text-sm text-amber-700">
                    Platform administrators have unrestricted access to all organizations and data.
                    This status can only be granted or revoked via database migration for security purposes.
                  </p>
                </div>
              </div>
            </div>

            {/* Admin List */}
            {admins.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Platform Administrators</h3>
                <p className="mt-2 text-sm text-gray-500">
                  There are no platform administrators configured in the system.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Administrator
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Member Since
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {admins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {admin.displayName}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Shield className="w-3.5 h-3.5 text-purple-500" />
                                <span className="text-xs text-purple-600 font-medium">
                                  Platform Admin
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {admin.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(admin.createdAt)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
