/**
 * UserMenu Component
 *
 * User avatar dropdown menu component for the application header. Provides:
 * - User avatar with initials when authenticated
 * - Dropdown menu with user info, email, and provider badge
 * - Link to account settings page
 * - Logout button that clears session and redirects to /login
 * - Login button when not authenticated
 *
 * @module components/UserMenu
 */

import * as React from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Option from "effect/Option"
import {
  authTokenAtom,
  currentUserAtom,
  logoutMutation
} from "../atoms/auth.ts"
import type { AuthProviderType } from "@accountability/core/Auth/AuthProviderType"
import type { UserIdentity } from "@accountability/core/Auth/UserIdentity"

// =============================================================================
// Types
// =============================================================================

interface UserMenuProps {
  /** Custom class name for styling */
  readonly className?: string
}

// =============================================================================
// Styles
// =============================================================================

const containerStyles: React.CSSProperties = {
  position: "relative",
  display: "inline-block"
}

const avatarButtonStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.25rem 0.5rem",
  border: "1px solid transparent",
  borderRadius: "4px",
  backgroundColor: "transparent",
  cursor: "pointer",
  fontSize: "14px",
  color: "#333"
}

const avatarButtonHoverStyles: React.CSSProperties = {
  ...avatarButtonStyles,
  backgroundColor: "#f5f5f5",
  borderColor: "#e8e8e8"
}

const avatarStyles: React.CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  backgroundColor: "#1890ff",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: "14px",
  textTransform: "uppercase"
}

const dropdownStyles: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: "0.5rem",
  minWidth: "240px",
  backgroundColor: "#fff",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
  zIndex: 1000,
  overflow: "hidden"
}

const dropdownHeaderStyles: React.CSSProperties = {
  padding: "1rem",
  borderBottom: "1px solid #f0f0f0",
  backgroundColor: "#fafafa"
}

const userNameStyles: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 600,
  color: "#333"
}

const userEmailStyles: React.CSSProperties = {
  margin: "0.25rem 0 0 0",
  fontSize: "12px",
  color: "#666",
  wordBreak: "break-all"
}

const providerBadgeStyles = (provider: AuthProviderType): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    marginTop: "0.5rem",
    padding: "0.125rem 0.5rem",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 500
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
    default:
      return {
        ...baseStyles,
        backgroundColor: "#f0f0f0",
        color: "#666"
      }
  }
}

const dropdownMenuStyles: React.CSSProperties = {
  padding: "0.5rem 0"
}

const menuItemStyles: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.75rem 1rem",
  border: "none",
  backgroundColor: "transparent",
  textAlign: "left",
  fontSize: "14px",
  color: "#333",
  cursor: "pointer",
  textDecoration: "none"
}

const menuItemHoverStyles: React.CSSProperties = {
  ...menuItemStyles,
  backgroundColor: "#f5f5f5"
}

const menuDividerStyles: React.CSSProperties = {
  height: "1px",
  backgroundColor: "#f0f0f0",
  margin: "0.25rem 0"
}

const logoutButtonStyles: React.CSSProperties = {
  ...menuItemStyles,
  color: "#ff4d4f"
}

const logoutButtonHoverStyles: React.CSSProperties = {
  ...logoutButtonStyles,
  backgroundColor: "#fff2f0"
}

const loginButtonStyles: React.CSSProperties = {
  padding: "0.5rem 1rem",
  border: "1px solid #d9d9d9",
  borderRadius: "6px",
  backgroundColor: "#fff",
  color: "#333",
  fontSize: "14px",
  cursor: "pointer",
  textDecoration: "none"
}

const loginButtonHoverStyles: React.CSSProperties = {
  ...loginButtonStyles,
  backgroundColor: "#f5f5f5",
  borderColor: "#1890ff",
  color: "#1890ff"
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get initials from display name (up to 2 characters)
 */
function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

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
      return "Email"
  }
}

/**
 * Get provider icon (simple text representation)
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
 * Get the primary provider from identities
 */
function getPrimaryProvider(identities: ReadonlyArray<UserIdentity>, primaryProvider: AuthProviderType): AuthProviderType {
  // Return the primary provider from user record
  return primaryProvider
}

// =============================================================================
// UserMenu Component
// =============================================================================

/**
 * UserMenu - User avatar dropdown for navigation
 *
 * Displays:
 * - When authenticated: Avatar with initials, dropdown with user info and logout
 * - When not authenticated: Login button
 */
export function UserMenu({ className }: UserMenuProps): React.ReactElement {
  const navigate = useNavigate()
  const tokenOption = useAtomValue(authTokenAtom)
  const userResult = useAtomValue(currentUserAtom)
  const executeLogout = useAtomSet(logoutMutation)

  const [isOpen, setIsOpen] = React.useState(false)
  const [isAvatarHovered, setIsAvatarHovered] = React.useState(false)
  const [isLoginHovered, setIsLoginHovered] = React.useState(false)
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Determine auth state
  const hasToken = Option.isSome(tokenOption)
  const isAuthenticated = hasToken && Result.isSuccess(userResult)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target
      if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [isOpen])

  // Close dropdown on escape key
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      return () => {
        document.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [isOpen])

  // Handle logout
  const handleLogout = async (): Promise<void> => {
    setIsOpen(false)
    executeLogout()
    // Redirect to login after logout
    navigate({ to: "/login", replace: true })
  }

  // Not authenticated - show login button
  if (!isAuthenticated) {
    return (
      <div style={containerStyles} className={className}>
        <Link
          to="/login"
          style={isLoginHovered ? loginButtonHoverStyles : loginButtonStyles}
          onMouseEnter={() => setIsLoginHovered(true)}
          onMouseLeave={() => setIsLoginHovered(false)}
        >
          Sign in
        </Link>
      </div>
    )
  }

  // Get user data
  const { user, identities } = userResult.value
  const initials = getInitials(user.displayName)
  const provider = getPrimaryProvider(identities, user.primaryProvider)

  return (
    <div style={containerStyles} className={className} ref={dropdownRef} data-testid="user-menu">
      {/* Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsAvatarHovered(true)}
        onMouseLeave={() => setIsAvatarHovered(false)}
        style={isAvatarHovered ? avatarButtonHoverStyles : avatarButtonStyles}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`User menu for ${user.displayName}`}
      >
        <span style={avatarStyles} aria-hidden="true">
          {initials}
        </span>
        <span style={{ color: "#666" }}>
          {user.displayName}
        </span>
        {/* Dropdown arrow */}
        <span style={{ marginLeft: "0.25rem", fontSize: "10px", color: "#999" }}>
          {isOpen ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={dropdownStyles} role="menu" aria-label="User menu">
          {/* User Info Header */}
          <div style={dropdownHeaderStyles}>
            <p style={userNameStyles}>{user.displayName}</p>
            <p style={userEmailStyles}>{user.email}</p>
            <span style={providerBadgeStyles(provider)}>
              <span aria-hidden="true">{getProviderIcon(provider)}</span>
              <span>Signed in with {getProviderName(provider)}</span>
            </span>
          </div>

          {/* Menu Items */}
          <div style={dropdownMenuStyles}>
            {/* Account Settings Link */}
            <Link
              to="/account"
              style={hoveredItem === "settings" ? menuItemHoverStyles : menuItemStyles}
              onMouseEnter={() => setHoveredItem("settings")}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              Account settings
            </Link>

            <div style={menuDividerStyles} role="separator" />

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              style={hoveredItem === "logout" ? logoutButtonHoverStyles : logoutButtonStyles}
              onMouseEnter={() => setHoveredItem("logout")}
              onMouseLeave={() => setHoveredItem(null)}
              role="menuitem"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
