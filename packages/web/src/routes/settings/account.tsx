/**
 * Account Settings Route
 *
 * Protected route for managing account settings.
 * Uses AppShell for consistent navigation.
 */

import { createFileRoute } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { AppShell } from "../../components/AppShell.tsx"
import { ProtectedRoute } from "../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../components/UserMenu.tsx"
import { currentUserAtom } from "../../atoms/auth.ts"

export const Route = createFileRoute("/settings/account")({
  component: AccountSettingsPage
})

function AccountSettingsPage() {
  const userResult = useAtomValue(currentUserAtom)

  // Extract user info
  const user = Result.isSuccess(userResult) ? userResult.value.user : null
  const identities = Result.isSuccess(userResult) ? userResult.value.identities : []

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600">
            Manage your account settings and linked identities.
          </p>

          {/* User Profile Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
            {user ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{user.displayName || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">Loading user information...</p>
            )}
          </div>

          {/* Linked Identities Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Accounts</h2>
            {identities.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {identities.map((identity) => (
                  <li key={identity.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {identity.provider}
                      </p>
                      <p className="text-sm text-gray-500">
                        {identity.providerId}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No linked accounts. You can link OAuth providers to your account.
              </p>
            )}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
