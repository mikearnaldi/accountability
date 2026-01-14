/**
 * Account Settings Route
 *
 * Protected route for managing account settings:
 * - Display current user info (email, display name)
 * - List linked identity providers with dates
 * - Link/unlink providers
 * - Change password (if local provider linked)
 */

import * as React from "react"
import { useState, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { AppShell } from "../../components/AppShell.tsx"
import { ProtectedRoute } from "../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../components/UserMenu.tsx"
import {
  currentUserAtom,
  enabledProvidersAtom,
  linkProviderMutation,
  unlinkProviderMutation,
  changePasswordMutation
} from "../../atoms/auth.ts"

export const Route = createFileRoute("/settings/account")({
  component: AccountSettingsPage
})

/**
 * Type guard for objects with _tag property
 */
function hasTag(error: unknown): error is { _tag: string } {
  if (typeof error !== "object" || error === null) {
    return false
  }
  if (!("_tag" in error)) {
    return false
  }
  const tagValue = Reflect.get(error, "_tag")
  return typeof tagValue === "string"
}

/**
 * Type guard for objects with message property
 */
function hasMessage(error: unknown): error is { message: string } {
  if (typeof error !== "object" || error === null) {
    return false
  }
  if (!("message" in error)) {
    return false
  }
  const messageValue = Reflect.get(error, "message")
  return typeof messageValue === "string"
}

/**
 * Get error tag from an error object
 */
function getErrorTag(error: unknown): string | undefined {
  return hasTag(error) ? error._tag : undefined
}

/**
 * Get error message from an error object
 */
function getErrorMessage(error: unknown): string | undefined {
  return hasMessage(error) ? error.message : undefined
}

/**
 * Provider display names for UI
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  local: "Email & Password",
  google: "Google",
  github: "GitHub",
  workos: "WorkOS SSO",
  saml: "SAML SSO"
}

/**
 * Get display name for a provider
 */
function getProviderDisplayName(provider: string): string {
  return PROVIDER_DISPLAY_NAMES[provider] ?? provider
}

/**
 * Format a date/timestamp for display
 */
function formatDate(date: Date | string | { toDate: () => Date }): string {
  let d: Date
  if (typeof date === "string") {
    d = new Date(date)
  } else if (date instanceof Date) {
    d = date
  } else {
    // Timestamp object with toDate method
    d = date.toDate()
  }
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
}

/**
 * Notification component for success/error messages
 */
function Notification({
  type,
  message,
  onDismiss
}: {
  type: "success" | "error"
  message: string
  onDismiss: () => void
}) {
  const bgColor = type === "success" ? "bg-green-50" : "bg-red-50"
  const textColor = type === "success" ? "text-green-800" : "text-red-800"
  const borderColor = type === "success" ? "border-green-200" : "border-red-200"
  const iconColor = type === "success" ? "text-green-400" : "text-red-400"

  return (
    <div
      className={`rounded-md ${bgColor} p-4 border ${borderColor}`}
      data-testid={`notification-${type}`}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {type === "success" ? (
            <svg
              className={`h-5 w-5 ${iconColor}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className={`h-5 w-5 ${iconColor}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${textColor}`}>{message}</p>
        </div>
        <div className="ml-auto pl-3">
          <button
            type="button"
            onClick={onDismiss}
            className={`inline-flex rounded-md p-1.5 ${textColor} hover:bg-opacity-50 focus:outline-none`}
            data-testid="notification-dismiss"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Change Password Form Component
 */
function ChangePasswordForm({
  onSuccess,
  onError
}: {
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [changePasswordResult, changePassword] = useAtom(changePasswordMutation, { mode: "promise" })
  const isLoading = Result.isWaiting(changePasswordResult)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setValidationError(null)

      // Client-side validation
      if (!currentPassword) {
        setValidationError("Current password is required")
        return
      }
      if (!newPassword) {
        setValidationError("New password is required")
        return
      }
      if (newPassword.length < 8) {
        setValidationError("New password must be at least 8 characters")
        return
      }
      if (newPassword !== confirmPassword) {
        setValidationError("Passwords do not match")
        return
      }

      try {
        await changePassword({ currentPassword, newPassword })
        onSuccess("Password changed successfully")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } catch (error: unknown) {
        const tag = getErrorTag(error)
        if (tag === "ChangePasswordError") {
          onError("Current password is incorrect")
        } else if (tag === "NoLocalIdentityError") {
          onError("Password change is only available for accounts with local authentication")
        } else if (tag === "PasswordWeakError") {
          onError("New password does not meet requirements")
        } else {
          onError(getErrorMessage(error) ?? "Failed to change password")
        }
      }
    },
    [currentPassword, newPassword, confirmPassword, changePassword, onSuccess, onError]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {validationError && (
        <p className="text-sm text-red-600" data-testid="password-validation-error">
          {validationError}
        </p>
      )}
      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-gray-700"
        >
          Current Password
        </label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-testid="current-password-input"
          disabled={isLoading}
        />
      </div>
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-gray-700"
        >
          New Password
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-testid="new-password-input"
          disabled={isLoading}
        />
        <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
      </div>
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-gray-700"
        >
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-testid="confirm-password-input"
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
        data-testid="change-password-submit"
      >
        {isLoading ? "Changing..." : "Change Password"}
      </button>
    </form>
  )
}

function AccountSettingsPage() {
  const userResult = useAtomValue(currentUserAtom)
  const providersResult = useAtomValue(enabledProvidersAtom)
  const [linkResult, linkProvider] = useAtom(linkProviderMutation)
  const [unlinkResult, unlinkProvider] = useAtom(unlinkProviderMutation)
  const [notification, setNotification] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Extract user info
  const user = Result.isSuccess(userResult) ? userResult.value.user : null
  const identities = Result.isSuccess(userResult) ? userResult.value.identities : []
  const enabledProviders = Result.isSuccess(providersResult)
    ? providersResult.value.providers
    : []

  // Check if user has local identity (for password change)
  const hasLocalIdentity = identities.some((id) => id.provider === "local")

  // Get providers that can be linked (enabled but not already linked)
  const linkedProviderTypes = new Set(identities.map((id) => id.provider))
  const linkableProviders = enabledProviders.filter(
    (p) => p.oauthEnabled && !linkedProviderTypes.has(p.type)
  )

  // Check if unlink should be disabled (only one identity)
  const canUnlink = identities.length > 1

  const handleLinkProvider = useCallback(
    (provider: string) => {
      // Fire off the link request - we'll handle success in useEffect
      linkProvider({ provider })
    },
    [linkProvider]
  )

  // Watch for successful link provider response and redirect
  React.useEffect(() => {
    if (Result.isSuccess(linkResult) && !Result.isWaiting(linkResult)) {
      // Extract the redirect URL from the successful response
      const response = linkResult.value
      if (response && "redirectUrl" in response) {
        window.location.href = response.redirectUrl
      }
    } else if (Result.isFailure(linkResult)) {
      // Handle error
      setNotification({
        type: "error",
        message: `Failed to link provider`
      })
    }
  }, [linkResult])

  const handleUnlinkProvider = useCallback(
    async (identityId: string, provider: string) => {
      try {
        await unlinkProvider({ identityId })
        setNotification({
          type: "success",
          message: `${getProviderDisplayName(provider)} has been unlinked from your account`
        })
      } catch (error: unknown) {
        const tag = getErrorTag(error)
        if (tag === "CannotUnlinkLastIdentityError") {
          setNotification({
            type: "error",
            message: "Cannot unlink your last authentication method"
          })
        } else {
          setNotification({
            type: "error",
            message: getErrorMessage(error) ?? `Failed to unlink ${getProviderDisplayName(provider)}`
          })
        }
      }
    },
    [unlinkProvider]
  )

  const dismissNotification = useCallback(() => {
    setNotification(null)
  }, [])

  const isLinking = Result.isWaiting(linkResult)
  const isUnlinking = Result.isWaiting(unlinkResult)

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6" data-testid="account-settings-page">
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600">
            Manage your account settings and linked identities.
          </p>

          {/* Notification */}
          {notification && (
            <Notification
              type={notification.type}
              message={notification.message}
              onDismiss={dismissNotification}
            />
          )}

          {/* User Profile Section */}
          <div
            className="rounded-lg border border-gray-200 bg-white p-6"
            data-testid="profile-section"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
            {user ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                  <dd
                    className="mt-1 text-sm text-gray-900"
                    data-testid="user-display-name"
                  >
                    {user.displayName || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900" data-testid="user-email">
                    {user.email}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">Loading user information...</p>
            )}
          </div>

          {/* Linked Identities Section */}
          <div
            className="rounded-lg border border-gray-200 bg-white p-6"
            data-testid="linked-accounts-section"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Linked Accounts
            </h2>
            {identities.length > 0 ? (
              <ul className="divide-y divide-gray-100" data-testid="identities-list">
                {identities.map((identity) => (
                  <li
                    key={identity.id}
                    className="py-4 flex justify-between items-center"
                    data-testid={`identity-${identity.provider}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getProviderDisplayName(identity.provider)}
                      </p>
                      <p className="text-sm text-gray-500">{identity.providerId}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Linked on {formatDate(identity.createdAt)}
                      </p>
                    </div>
                    {identity.provider !== "local" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUnlinkProvider(identity.id, identity.provider)
                        }
                        disabled={!canUnlink || isUnlinking}
                        className={`text-sm font-medium ${
                          canUnlink
                            ? "text-red-600 hover:text-red-700"
                            : "text-gray-400 cursor-not-allowed"
                        }`}
                        title={
                          canUnlink
                            ? `Unlink ${getProviderDisplayName(identity.provider)}`
                            : "Cannot unlink your only authentication method"
                        }
                        data-testid={`unlink-${identity.provider}-button`}
                      >
                        {isUnlinking ? "Unlinking..." : "Unlink"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No linked accounts. You can link OAuth providers to your account.
              </p>
            )}

            {/* Link Additional Providers */}
            {linkableProviders.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Link Additional Accounts
                </h3>
                <div className="flex flex-wrap gap-2">
                  {linkableProviders.map((provider) => (
                    <button
                      key={provider.type}
                      type="button"
                      onClick={() => handleLinkProvider(provider.type)}
                      disabled={isLinking}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`link-${provider.type}-button`}
                    >
                      {isLinking ? "Redirecting..." : `Link ${provider.name}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Change Password Section (only if local provider linked) */}
          {hasLocalIdentity && (
            <div
              className="rounded-lg border border-gray-200 bg-white p-6"
              data-testid="change-password-section"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Change Password
              </h2>
              <ChangePasswordForm
                onSuccess={(message) =>
                  setNotification({ type: "success", message })
                }
                onError={(message) => setNotification({ type: "error", message })}
              />
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
