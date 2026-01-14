/**
 * UserMenu Component
 *
 * Displays user information and provides account management options.
 * Features:
 * - Shows user avatar/initials and name when authenticated
 * - Dropdown menu with: user email, account settings link, logout button
 * - Shows Login button when not authenticated
 */

import { Link, useNavigate } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import {
  currentUserAtom,
  hasTokenAtom,
  logoutMutation
} from "../atoms/auth.ts"
import * as React from "react"

// =============================================================================
// Icons
// =============================================================================

const CogIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
)

const LogoutIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
)

const ChevronDownIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get user initials from display name or email
 */
function getInitials(displayName: string | null | undefined, email: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  // Fall back to email
  return email.slice(0, 2).toUpperCase()
}

// =============================================================================
// UserMenu Component
// =============================================================================

export function UserMenu() {
  const hasToken = useAtomValue(hasTokenAtom)
  const userResult = useAtomValue(currentUserAtom)
  const navigate = useNavigate()
  const [logoutResult, logout] = useAtom(logoutMutation, { mode: "promise" })

  // Dropdown state - local state is fine for ephemeral UI
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target
      if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Close dropdown on escape key
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  // Handle logout
  const handleLogout = async () => {
    setIsOpen(false)
    try {
      await logout(undefined)
      navigate({ to: "/login" })
    } catch {
      // Error is captured in logoutResult - redirect anyway since token is cleared
      navigate({ to: "/login" })
    }
  }

  const isLoggingOut = Result.isWaiting(logoutResult)

  // If no token, show Login button
  if (!hasToken) {
    return (
      <Link
        to="/login"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        data-testid="user-menu-login"
      >
        Login
      </Link>
    )
  }

  // Determine loading state - user data is being fetched
  const isLoading = Result.isWaiting(userResult) || Result.isInitial(userResult)

  // Extract user info from result
  const user = Result.isSuccess(userResult) ? userResult.value.user : null
  const displayName = user?.displayName ?? null
  const email = user?.email ?? ""
  const initials = isLoading ? "..." : getInitials(displayName, email)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Menu Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={[
          "flex items-center gap-2 rounded-lg px-3 py-2",
          "text-gray-700 hover:bg-gray-100",
          "transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        ].join(" ")}
        aria-expanded={isOpen}
        aria-haspopup="true"
        data-testid="user-menu"
      >
        {/* Avatar/Initials */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
          {initials}
        </div>

        {/* Name (hidden on small screens) */}
        <span className="hidden md:block text-sm font-medium">
          {displayName || email}
        </span>

        {/* Dropdown indicator */}
        <ChevronDownIcon />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={[
            "absolute right-0 mt-2 w-64",
            "rounded-lg bg-white shadow-lg",
            "border border-gray-200",
            "py-1 z-50"
          ].join(" ")}
          role="menu"
          aria-orientation="vertical"
          data-testid="user-menu-dropdown"
        >
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                {displayName && (
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName}
                  </p>
                )}
                <p className="text-sm text-gray-500 truncate" data-testid="user-menu-email">
                  {email}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Account Settings Link */}
            <Link
              to="/settings/account"
              className={[
                "flex items-center gap-3 px-4 py-2",
                "text-sm text-gray-700",
                "hover:bg-gray-100",
                "transition-colors duration-200"
              ].join(" ")}
              onClick={() => setIsOpen(false)}
              role="menuitem"
              data-testid="user-menu-settings"
            >
              <CogIcon />
              <span>Account Settings</span>
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={[
                "flex w-full items-center gap-3 px-4 py-2",
                "text-sm text-red-600",
                "hover:bg-red-50",
                "transition-colors duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              ].join(" ")}
              role="menuitem"
              data-testid="user-menu-logout"
            >
              <LogoutIcon />
              <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
