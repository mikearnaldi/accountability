/**
 * Account Settings Page Route
 *
 * Route: /settings/account
 *
 * User account settings page that displays:
 * - User profile information (email, display name)
 * - Linked authentication providers with connection dates
 * - Button to link additional providers
 * - Button to unlink providers (disabled if only one identity remains)
 * - Change password section (only if local provider linked)
 * - Delete account option with confirmation
 * - Success/error notifications for all actions
 *
 * @module routes/settings/account
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtomSet, useAtom } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Option from "effect/Option"
import {
  authTokenAtom,
  currentUserAtom,
  enabledProvidersAtom,
  linkProviderMutation,
  unlinkProviderMutation,
  setLinkFlowFlag,
  type ProviderMetadata
} from "../../atoms/auth.ts"
import { AuthGuard } from "../../components/AuthGuard.tsx"
import type { AuthProviderType } from "@accountability/core/Auth/AuthProviderType"
import type { UserIdentity, UserIdentityId } from "@accountability/core/Auth/UserIdentity"

// =============================================================================
// Route Configuration
// =============================================================================

export const Route = createFileRoute("/settings/account")({
  component: AccountSettingsPage
})

// =============================================================================
// Notification State
// =============================================================================

interface NotificationState {
  type: "success" | "error" | null
  message: string | null
}

const notificationAtom = Atom.make<NotificationState>({
  type: null,
  message: null
})

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "800px",
  margin: "2rem auto",
  padding: "0 1rem"
}

const titleStyles: React.CSSProperties = {
  margin: "0 0 0.5rem 0",
  fontSize: "28px",
  fontWeight: 600,
  color: "#333"
}

const subtitleStyles: React.CSSProperties = {
  color: "#666",
  marginBottom: "2rem"
}

const sectionStyles: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "1.5rem",
  marginBottom: "1.5rem",
  backgroundColor: "#fff"
}

const sectionTitleStyles: React.CSSProperties = {
  margin: "0 0 1rem 0",
  fontSize: "18px",
  fontWeight: 600,
  color: "#333"
}

const sectionDescriptionStyles: React.CSSProperties = {
  color: "#666",
  fontSize: "14px",
  marginBottom: "1rem"
}

const fieldRowStyles: React.CSSProperties = {
  display: "flex",
  marginBottom: "0.75rem",
  paddingBottom: "0.75rem",
  borderBottom: "1px solid #f0f0f0"
}

const fieldLabelStyles: React.CSSProperties = {
  width: "120px",
  fontWeight: 500,
  color: "#666",
  fontSize: "14px"
}

const fieldValueStyles: React.CSSProperties = {
  flex: 1,
  color: "#333",
  fontSize: "14px"
}

const identitiesListStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem"
}

const identityItemStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem",
  border: "1px solid #e8e8e8",
  borderRadius: "6px",
  backgroundColor: "#fafafa"
}

const providerBadgeStyles = (provider: AuthProviderType): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600
  }

  switch (provider) {
    case "google":
      return {
        ...baseStyles,
        backgroundColor: "#e8f4fd",
        color: "#1a73e8"
      }
    case "github":
      return {
        ...baseStyles,
        backgroundColor: "#f6f8fa",
        color: "#24292e"
      }
    case "workos":
      return {
        ...baseStyles,
        backgroundColor: "#eef2ff",
        color: "#6366f1"
      }
    case "saml":
      return {
        ...baseStyles,
        backgroundColor: "#e7f3ff",
        color: "#0d6efd"
      }
    case "local":
      return {
        ...baseStyles,
        backgroundColor: "#f0f0f0",
        color: "#666"
      }
  }
}

const identityInfoStyles: React.CSSProperties = {
  flex: 1
}

const identityProviderStyles: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: "#333"
}

const identityDateStyles: React.CSSProperties = {
  fontSize: "12px",
  color: "#666"
}

const primaryBadgeStyles: React.CSSProperties = {
  padding: "0.125rem 0.5rem",
  backgroundColor: "#e6f7ff",
  color: "#1890ff",
  fontSize: "11px",
  fontWeight: 500,
  borderRadius: "4px"
}

const buttonStyles: React.CSSProperties = {
  padding: "0.5rem 1rem",
  border: "1px solid #d9d9d9",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  backgroundColor: "#fff",
  color: "#333",
  transition: "all 0.2s"
}

const buttonDisabledStyles: React.CSSProperties = {
  ...buttonStyles,
  opacity: 0.5,
  cursor: "not-allowed"
}

const primaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#1890ff",
  color: "#fff",
  borderColor: "#1890ff"
}

const primaryButtonDisabledStyles: React.CSSProperties = {
  ...primaryButtonStyles,
  backgroundColor: "#bae7ff",
  borderColor: "#bae7ff",
  cursor: "not-allowed"
}

const dangerButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#fff",
  color: "#ff4d4f",
  borderColor: "#ff4d4f"
}

const dangerButtonHoverStyles: React.CSSProperties = {
  ...dangerButtonStyles,
  backgroundColor: "#fff2f0"
}

const unlinkButtonStyles: React.CSSProperties = {
  padding: "0.25rem 0.75rem",
  border: "1px solid #d9d9d9",
  borderRadius: "4px",
  fontSize: "12px",
  cursor: "pointer",
  backgroundColor: "#fff",
  color: "#666"
}

const unlinkButtonDisabledStyles: React.CSSProperties = {
  ...unlinkButtonStyles,
  opacity: 0.5,
  cursor: "not-allowed"
}

const loadingStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#666"
}

const backLinkStyles: React.CSSProperties = {
  marginBottom: "1rem",
  display: "inline-block",
  color: "#1890ff",
  textDecoration: "none"
}

const notificationStyles = (type: "success" | "error"): React.CSSProperties => ({
  padding: "0.75rem 1rem",
  borderRadius: "6px",
  marginBottom: "1rem",
  fontSize: "14px",
  backgroundColor: type === "success" ? "#f6ffed" : "#fff2f0",
  border: `1px solid ${type === "success" ? "#b7eb8f" : "#ffccc7"}`,
  color: type === "success" ? "#52c41a" : "#ff4d4f"
})

const inputStyles: React.CSSProperties = {
  width: "100%",
  maxWidth: "300px",
  padding: "0.5rem 0.75rem",
  border: "1px solid #d9d9d9",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box"
}

const inputErrorStyles: React.CSSProperties = {
  ...inputStyles,
  borderColor: "#ff4d4f"
}

const labelStyles: React.CSSProperties = {
  display: "block",
  marginBottom: "0.5rem",
  fontWeight: 500,
  fontSize: "14px",
  color: "#333"
}

const formGroupStyles: React.CSSProperties = {
  marginBottom: "1rem"
}

const fieldErrorStyles: React.CSSProperties = {
  color: "#ff4d4f",
  fontSize: "12px",
  marginTop: "0.25rem"
}

const linkProvidersContainerStyles: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  marginTop: "1rem"
}

const linkProviderButtonStyles = (provider: AuthProviderType): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    border: "1px solid #d9d9d9",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: "#fff",
    color: "#333"
  }

  switch (provider) {
    case "google":
      return {
        ...baseStyles,
        borderColor: "#ddd"
      }
    case "github":
      return {
        ...baseStyles,
        backgroundColor: "#24292e",
        color: "#fff",
        borderColor: "#24292e"
      }
    case "workos":
      return {
        ...baseStyles,
        backgroundColor: "#6366f1",
        color: "#fff",
        borderColor: "#6366f1"
      }
    case "saml":
      return {
        ...baseStyles,
        backgroundColor: "#0d6efd",
        color: "#fff",
        borderColor: "#0d6efd"
      }
    default:
      return baseStyles
  }
}

const modalOverlayStyles: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000
}

const modalContentStyles: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "8px",
  padding: "1.5rem",
  maxWidth: "400px",
  width: "90%",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
}

const modalTitleStyles: React.CSSProperties = {
  margin: "0 0 1rem 0",
  fontSize: "18px",
  fontWeight: 600,
  color: "#333"
}

const modalDescriptionStyles: React.CSSProperties = {
  color: "#666",
  marginBottom: "1.5rem",
  fontSize: "14px",
  lineHeight: "1.5"
}

const modalButtonsStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem"
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get provider display name
 */
function getProviderName(provider: AuthProviderType): string {
  switch (provider) {
    case "google":
      return "Google"
    case "github":
      return "GitHub"
    case "workos":
      return "WorkOS"
    case "saml":
      return "SSO"
    case "local":
      return "Email & Password"
  }
}

/**
 * Get provider icon
 */
function getProviderIcon(provider: AuthProviderType): string {
  switch (provider) {
    case "google":
      return "G"
    case "github":
      return "GH"
    case "workos":
      return "W"
    case "saml":
      return "SSO"
    case "local":
      return "@"
  }
}

/**
 * Format date for display
 */
function formatDate(epochMillis: number): string {
  return new Date(epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
}

// =============================================================================
// Notification Component
// =============================================================================

function Notification(): React.ReactElement | null {
  const [notification, setNotification] = useAtom(notificationAtom)

  // Auto-dismiss notification after 5 seconds
  React.useEffect(() => {
    if (notification.type !== null) {
      const timer = setTimeout(() => {
        setNotification({ type: null, message: null })
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification.type, setNotification])

  if (notification.type === null || notification.message === null) {
    return null
  }

  return (
    <div style={notificationStyles(notification.type)} role="alert" aria-live="polite">
      {notification.message}
      <button
        type="button"
        onClick={() => setNotification({ type: null, message: null })}
        style={{
          float: "right",
          border: "none",
          background: "none",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          color: "inherit"
        }}
        aria-label="Dismiss notification"
      >
        x
      </button>
    </div>
  )
}

// =============================================================================
// Delete Account Confirmation Modal
// =============================================================================

interface DeleteAccountModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onConfirm: () => void
  readonly isDeleting: boolean
}

function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting
}: DeleteAccountModalProps): React.ReactElement | null {
  const [confirmText, setConfirmText] = React.useState("")

  // Reset on close
  React.useEffect(() => {
    if (!isOpen) {
      setConfirmText("")
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const canConfirm = confirmText === "DELETE"

  return (
    <div style={modalOverlayStyles} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div style={modalContentStyles} onClick={e => e.stopPropagation()}>
        <h3 id="delete-modal-title" style={modalTitleStyles}>Delete Account</h3>
        <p style={modalDescriptionStyles}>
          This action is <strong>permanent and cannot be undone</strong>. All your data,
          including linked accounts, settings, and history will be deleted.
        </p>
        <div style={formGroupStyles}>
          <label htmlFor="delete-confirm" style={labelStyles}>
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            style={inputStyles}
            placeholder="DELETE"
            autoComplete="off"
            disabled={isDeleting}
          />
        </div>
        <div style={modalButtonsStyles}>
          <button
            type="button"
            onClick={onClose}
            style={buttonStyles}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={canConfirm && !isDeleting ? dangerButtonStyles : buttonDisabledStyles}
            disabled={!canConfirm || isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Identity Item Component
// =============================================================================

interface IdentityItemProps {
  readonly identity: UserIdentity
  readonly isPrimary: boolean
  readonly canUnlink: boolean
  readonly onUnlink: (identityId: UserIdentityId) => void
  readonly isUnlinking: boolean
}

function IdentityItem({
  identity,
  isPrimary,
  canUnlink,
  onUnlink,
  isUnlinking
}: IdentityItemProps): React.ReactElement {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <div style={identityItemStyles}>
      <div style={providerBadgeStyles(identity.provider)}>
        {getProviderIcon(identity.provider)}
      </div>
      <div style={identityInfoStyles}>
        <div style={identityProviderStyles}>
          {getProviderName(identity.provider)}
        </div>
        <div style={identityDateStyles}>
          Connected {formatDate(identity.createdAt.epochMillis)}
        </div>
      </div>
      {isPrimary && (
        <span style={primaryBadgeStyles}>Primary</span>
      )}
      <button
        type="button"
        onClick={() => onUnlink(identity.id)}
        style={canUnlink && !isUnlinking ? (isHovered ? { ...unlinkButtonStyles, backgroundColor: "#f5f5f5" } : unlinkButtonStyles) : unlinkButtonDisabledStyles}
        disabled={!canUnlink || isUnlinking}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={!canUnlink ? "Cannot unlink the last authentication method" : "Remove this authentication method"}
        aria-label={`Unlink ${getProviderName(identity.provider)}`}
      >
        {isUnlinking ? "..." : "Unlink"}
      </button>
    </div>
  )
}

// =============================================================================
// Link Provider Button
// =============================================================================

interface LinkProviderButtonProps {
  readonly provider: ProviderMetadata
  readonly onLink: (provider: AuthProviderType) => void
  readonly isLinking: boolean
}

function LinkProviderButton({
  provider,
  onLink,
  isLinking
}: LinkProviderButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onLink(provider.type)}
      style={isLinking ? { ...linkProviderButtonStyles(provider.type), opacity: 0.7, cursor: "wait" } : linkProviderButtonStyles(provider.type)}
      disabled={isLinking}
      aria-label={`Link ${provider.name}`}
    >
      <span style={{ fontWeight: "bold" }}>{getProviderIcon(provider.type)}</span>
      <span>{isLinking ? "Linking..." : `Link ${provider.name}`}</span>
    </button>
  )
}

// =============================================================================
// Change Password Section
// =============================================================================

interface ChangePasswordSectionProps {
  readonly onSuccess: () => void
  readonly onError: (message: string) => void
}

function ChangePasswordSection({
  onSuccess: _onSuccess,
  onError
}: ChangePasswordSectionProps): React.ReactElement {
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [errors, setErrors] = React.useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    if (!currentPassword) {
      newErrors.currentPassword = "Current password is required"
    }

    if (!newPassword) {
      newErrors.newPassword = "New password is required"
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters"
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password"
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    // Note: Change password API is not yet implemented in the backend
    // For now, we show a message indicating this feature is coming soon
    setTimeout(() => {
      setIsSubmitting(false)
      onError("Password change is not yet available. This feature will be implemented soon.")
    }, 500)
  }

  return (
    <div style={sectionStyles}>
      <h2 style={sectionTitleStyles}>Change Password</h2>
      <p style={sectionDescriptionStyles}>
        Update your password for email/password login.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={formGroupStyles}>
          <label htmlFor="current-password" style={labelStyles}>
            Current Password
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            style={errors.currentPassword ? inputErrorStyles : inputStyles}
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          {errors.currentPassword && (
            <div style={fieldErrorStyles}>{errors.currentPassword}</div>
          )}
        </div>

        <div style={formGroupStyles}>
          <label htmlFor="new-password" style={labelStyles}>
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            style={errors.newPassword ? inputErrorStyles : inputStyles}
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {errors.newPassword && (
            <div style={fieldErrorStyles}>{errors.newPassword}</div>
          )}
        </div>

        <div style={formGroupStyles}>
          <label htmlFor="confirm-password" style={labelStyles}>
            Confirm New Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={errors.confirmPassword ? inputErrorStyles : inputStyles}
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {errors.confirmPassword && (
            <div style={fieldErrorStyles}>{errors.confirmPassword}</div>
          )}
        </div>

        <button
          type="submit"
          style={isSubmitting ? primaryButtonDisabledStyles : primaryButtonStyles}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  )
}

// =============================================================================
// Account Content Component
// =============================================================================

function AccountContent(): React.ReactElement {
  const tokenOption = useAtomValue(authTokenAtom)
  const userResult = useAtomValue(currentUserAtom)
  const providersResult = useAtomValue(enabledProvidersAtom)
  const executeLink = useAtomSet(linkProviderMutation)
  const linkResult = useAtomValue(linkProviderMutation)
  const executeUnlink = useAtomSet(unlinkProviderMutation)
  const unlinkResult = useAtomValue(unlinkProviderMutation)
  const setNotification = useAtomSet(notificationAtom)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [linkingProvider, setLinkingProvider] = React.useState<AuthProviderType | null>(null)
  const [unlinkingIdentityId, setUnlinkingIdentityId] = React.useState<UserIdentityId | null>(null)
  const [dangerHovered, setDangerHovered] = React.useState(false)

  const hasToken = Option.isSome(tokenOption)
  const isAuthenticated = hasToken && Result.isSuccess(userResult)

  // Handle link provider redirect
  React.useEffect(() => {
    if (Result.isSuccess(linkResult) && linkingProvider !== null) {
      // Set link flow flag before redirect
      setLinkFlowFlag()
      // Redirect to OAuth provider
      window.location.href = linkResult.value.redirectUrl
    }
  }, [linkResult, linkingProvider])

  // Handle link provider error
  React.useEffect(() => {
    if (Result.isFailure(linkResult) && linkingProvider !== null) {
      setLinkingProvider(null)
      let message = "Failed to initiate provider linking"

      const errorOption = Cause.failureOption(linkResult.cause)
      Option.match(errorOption, {
        onNone: () => {},
        onSome: (error) => {
          const isTaggedError = (e: unknown): e is { _tag: string; message?: string } =>
            e !== null && typeof e === "object" && "_tag" in e
          if (isTaggedError(error) && error.message) {
            message = error.message
          }
        }
      })

      setNotification({ type: "error", message })
    }
  }, [linkResult, linkingProvider, setNotification])

  // Handle unlink success
  React.useEffect(() => {
    if (Result.isSuccess(unlinkResult) && unlinkingIdentityId !== null) {
      setUnlinkingIdentityId(null)
      setNotification({ type: "success", message: "Authentication method unlinked successfully" })
    }
  }, [unlinkResult, unlinkingIdentityId, setNotification])

  // Handle unlink error
  React.useEffect(() => {
    if (Result.isFailure(unlinkResult) && unlinkingIdentityId !== null) {
      setUnlinkingIdentityId(null)
      let message = "Failed to unlink authentication method"

      const errorOption = Cause.failureOption(unlinkResult.cause)
      Option.match(errorOption, {
        onNone: () => {},
        onSome: (error) => {
          const isTaggedError = (e: unknown): e is { _tag: string; message?: string } =>
            e !== null && typeof e === "object" && "_tag" in e
          if (isTaggedError(error)) {
            if (error._tag === "CannotUnlinkLastIdentityError") {
              message = "Cannot unlink the last authentication method"
            } else if (error.message) {
              message = error.message
            }
          }
        }
      })

      setNotification({ type: "error", message })
    }
  }, [unlinkResult, unlinkingIdentityId, setNotification])

  // Loading state
  if (Result.isInitial(userResult) || Result.isWaiting(userResult)) {
    return (
      <div style={pageStyles}>
        <div style={loadingStyles}>Loading account information...</div>
      </div>
    )
  }

  // Error state
  if (Result.isFailure(userResult)) {
    return (
      <div style={pageStyles}>
        <div style={loadingStyles}>
          Unable to load account information. Please try again.
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={pageStyles}>
        <div style={loadingStyles}>Redirecting to login...</div>
      </div>
    )
  }

  const { user, identities } = userResult.value

  // Get unlinked providers that can be linked
  const enabledProviders = Result.isSuccess(providersResult) ? providersResult.value : []
  const linkedProviderTypes = identities.map(i => i.provider)
  const unlinkedOAuthProviders = enabledProviders.filter(
    p => p.oauthEnabled && !linkedProviderTypes.includes(p.type)
  )

  // Check if local provider is linked (for password change section)
  const hasLocalProvider = linkedProviderTypes.includes("local")

  // Can only unlink if more than one identity
  const canUnlink = identities.length > 1

  const handleLinkProvider = (provider: AuthProviderType): void => {
    setLinkingProvider(provider)
    executeLink(provider)
  }

  const handleUnlinkProvider = (identityId: UserIdentityId): void => {
    setUnlinkingIdentityId(identityId)
    executeUnlink(identityId)
  }

  const handleDeleteAccount = async (): Promise<void> => {
    setIsDeleting(true)

    // Note: Delete account API is not yet implemented in the backend
    // For now, we show a message indicating this feature is coming soon
    setTimeout(() => {
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
      setNotification({ type: "error", message: "Account deletion is not yet available. This feature will be implemented soon." })
    }, 500)
  }

  return (
    <div style={pageStyles}>
      <Link to="/" style={backLinkStyles}>
        &larr; Back to Home
      </Link>

      <h1 style={titleStyles}>Account Settings</h1>
      <p style={subtitleStyles}>Manage your account information and connected authentication providers.</p>

      <Notification />

      {/* Profile Section */}
      <div style={sectionStyles}>
        <h2 style={sectionTitleStyles}>Profile Information</h2>

        <div style={fieldRowStyles}>
          <span style={fieldLabelStyles}>Name</span>
          <span style={fieldValueStyles}>{user.displayName}</span>
        </div>

        <div style={fieldRowStyles}>
          <span style={fieldLabelStyles}>Email</span>
          <span style={fieldValueStyles}>{user.email}</span>
        </div>

        <div style={fieldRowStyles}>
          <span style={fieldLabelStyles}>Role</span>
          <span style={fieldValueStyles}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
        </div>

        <div style={{ ...fieldRowStyles, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
          <span style={fieldLabelStyles}>Member since</span>
          <span style={fieldValueStyles}>{formatDate(user.createdAt.epochMillis)}</span>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div style={sectionStyles}>
        <h2 style={sectionTitleStyles}>Connected Accounts</h2>
        <p style={sectionDescriptionStyles}>
          These are the authentication methods linked to your account.
        </p>

        <div style={identitiesListStyles}>
          {identities.map((identity: UserIdentity) => (
            <IdentityItem
              key={identity.id}
              identity={identity}
              isPrimary={identity.provider === user.primaryProvider}
              canUnlink={canUnlink}
              onUnlink={handleUnlinkProvider}
              isUnlinking={unlinkingIdentityId === identity.id}
            />
          ))}
        </div>

        {/* Link Additional Providers */}
        {unlinkedOAuthProviders.length > 0 && (
          <>
            <h3 style={{ ...sectionTitleStyles, fontSize: "16px", marginTop: "1.5rem" }}>
              Link Additional Accounts
            </h3>
            <p style={sectionDescriptionStyles}>
              Connect more authentication methods to your account.
            </p>
            <div style={linkProvidersContainerStyles}>
              {unlinkedOAuthProviders.map(provider => (
                <LinkProviderButton
                  key={provider.type}
                  provider={provider}
                  onLink={handleLinkProvider}
                  isLinking={linkingProvider === provider.type}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Change Password Section (only if local provider linked) */}
      {hasLocalProvider && (
        <ChangePasswordSection
          onSuccess={() => setNotification({ type: "success", message: "Password updated successfully" })}
          onError={(message) => setNotification({ type: "error", message })}
        />
      )}

      {/* Danger Zone - Delete Account */}
      <div style={{ ...sectionStyles, borderColor: "#ffccc7" }}>
        <h2 style={{ ...sectionTitleStyles, color: "#ff4d4f" }}>Danger Zone</h2>
        <p style={sectionDescriptionStyles}>
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          style={dangerHovered ? dangerButtonHoverStyles : dangerButtonStyles}
          onMouseEnter={() => setDangerHovered(true)}
          onMouseLeave={() => setDangerHovered(false)}
        >
          Delete Account
        </button>
      </div>

      {/* Delete Account Confirmation Modal */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
      />
    </div>
  )
}

// =============================================================================
// Main Account Settings Page Component
// =============================================================================

function AccountSettingsPage(): React.ReactElement {
  return (
    <AuthGuard>
      <AccountContent />
    </AuthGuard>
  )
}
