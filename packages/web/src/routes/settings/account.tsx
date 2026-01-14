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
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { AppShell } from "../../components/AppShell.tsx"
import { ProtectedRoute } from "../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../components/UserMenu.tsx"
import { Card, CardHeader, CardTitle, CardBody } from "../../components/ui/Card.tsx"
import { Button } from "../../components/ui/Button.tsx"
import { Input } from "../../components/ui/Input.tsx"
import { Alert } from "../../components/ui/Alert.tsx"
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

// =============================================================================
// Icons
// =============================================================================

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

/**
 * Change Password Form Component
 *
 * SECURITY: After successful password change, the server invalidates all sessions.
 * The user will be redirected to login with a message explaining they need to re-login.
 */
function ChangePasswordForm({
  onError,
  onSuccess
}: {
  onError: (message: string) => void
  onSuccess: () => void
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
        // SECURITY: Password changed successfully. Server has invalidated all sessions.
        // Call onSuccess to trigger navigation to login with message.
        onSuccess()
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
    [currentPassword, newPassword, confirmPassword, changePassword, onError, onSuccess]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="change-password-form">
      {validationError && (
        <Alert variant="error" data-testid="password-validation-error">
          {validationError}
        </Alert>
      )}

      <Input
        label="Current Password"
        type="password"
        id="currentPassword"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        placeholder="Enter your current password"
        disabled={isLoading}
        leftIcon={<LockIcon />}
        data-testid="current-password-input"
      />

      <Input
        label="New Password"
        type="password"
        id="newPassword"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Enter a new password"
        helperText="Minimum 8 characters"
        disabled={isLoading}
        leftIcon={<LockIcon />}
        data-testid="new-password-input"
      />

      <Input
        label="Confirm New Password"
        type="password"
        id="confirmPassword"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm your new password"
        disabled={isLoading}
        leftIcon={<LockIcon />}
        data-testid="confirm-password-input"
      />

      <Button
        type="submit"
        variant="primary"
        loading={isLoading}
        data-testid="change-password-submit"
      >
        Change Password
      </Button>
    </form>
  )
}

function AccountSettingsPage() {
  const navigate = useNavigate()
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

  // Watch for successful link provider response and redirect to OAuth provider
  React.useEffect(() => {
    if (Result.isSuccess(linkResult) && !Result.isWaiting(linkResult)) {
      // Extract the redirect URL from the successful response
      // This is an EXTERNAL OAuth provider URL (Google, WorkOS, etc.) - cannot use TanStack Router
      const response = linkResult.value
      if (response && "redirectUrl" in response) {
        // eslint-disable-next-line local/no-location-href-redirect -- External OAuth URL requires full page navigation
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

  // Handle successful password change - navigate to login with message
  // Use replace: true to ensure we don't add to history stack and the navigation "wins"
  const handlePasswordChangeSuccess = useCallback(() => {
    navigate({
      to: "/login",
      search: { message: "password_changed" },
      replace: true
    })
  }, [navigate])

  const isLinking = Result.isWaiting(linkResult)
  const isUnlinking = Result.isWaiting(unlinkResult)

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-8" data-testid="account-settings-page">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Account Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your account settings and linked identities.
            </p>
          </div>

          {/* Notification */}
          {notification && (
            <Alert
              variant={notification.type === "success" ? "success" : "error"}
              onDismiss={dismissNotification}
              data-testid={`notification-${notification.type}`}
            >
              {notification.message}
            </Alert>
          )}

          {/* User Profile Section */}
          <Card data-testid="profile-section">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
                  <UserIcon />
                </div>
                <CardTitle description="Your basic account information">
                  Profile
                </CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              {user ? (
                <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                    <dd
                      className="text-base font-medium text-gray-900"
                      data-testid="user-display-name"
                    >
                      {user.displayName || "Not set"}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd
                      className="text-base font-medium text-gray-900"
                      data-testid="user-email"
                    >
                      {user.email}
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="animate-pulse">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-gray-200" />
                      <div className="h-5 w-32 rounded bg-gray-200" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-gray-200" />
                      <div className="h-5 w-48 rounded bg-gray-200" />
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Linked Identities Section */}
          <Card data-testid="linked-accounts-section">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                  <LinkIcon />
                </div>
                <CardTitle description="Manage your authentication methods">
                  Linked Accounts
                </CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              {identities.length > 0 ? (
                <ul className="divide-y divide-gray-100" data-testid="identities-list">
                  {identities.map((identity) => (
                    <li
                      key={identity.id}
                      className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                      data-testid={`identity-${identity.provider}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                          {identity.provider === "local" ? (
                            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                          ) : identity.provider === "google" ? (
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                          ) : identity.provider === "github" ? (
                            <svg className="h-5 w-5 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {getProviderDisplayName(identity.provider)}
                          </p>
                          <p className="text-sm text-gray-500">{identity.providerId}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Linked on {formatDate(identity.createdAt)}
                          </p>
                        </div>
                      </div>
                      {identity.provider !== "local" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleUnlinkProvider(identity.id, identity.provider)
                          }
                          disabled={!canUnlink || isUnlinking}
                          className={!canUnlink ? "!text-gray-400" : "!text-red-600 hover:!text-red-700 hover:!bg-red-50"}
                          title={
                            canUnlink
                              ? `Unlink ${getProviderDisplayName(identity.provider)}`
                              : "Cannot unlink your only authentication method"
                          }
                          data-testid={`unlink-${identity.provider}-button`}
                        >
                          {isUnlinking ? "Unlinking..." : "Unlink"}
                        </Button>
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
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">
                    Link Additional Accounts
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {linkableProviders.map((provider) => (
                      <Button
                        key={provider.type}
                        variant="secondary"
                        onClick={() => handleLinkProvider(provider.type)}
                        disabled={isLinking}
                        loading={isLinking}
                        data-testid={`link-${provider.type}-button`}
                      >
                        Link {provider.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Change Password Section (only if local provider linked) */}
          {hasLocalIdentity && (
            <Card data-testid="change-password-section">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <ShieldCheckIcon />
                  </div>
                  <CardTitle description="Update your password for security">
                    Change Password
                  </CardTitle>
                </div>
              </CardHeader>
              <CardBody>
                <Alert variant="warning" className="mb-6" data-testid="password-change-warning">
                  Changing your password will log you out of all devices for security.
                </Alert>
                <ChangePasswordForm
                  onError={(message) => setNotification({ type: "error", message })}
                  onSuccess={handlePasswordChangeSuccess}
                />
              </CardBody>
            </Card>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
