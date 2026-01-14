/**
 * UserMenu Component
 *
 * Professional user menu with:
 * - User avatar with initials
 * - Dropdown with account settings and logout
 * - Smooth animations and transitions
 * - Proper focus management
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

function CogIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function getInitials(displayName: string | null | undefined, email: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
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
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close dropdown on escape key
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  // Handle logout
  const handleLogout = async () => {
    setIsOpen(false)
    try {
      await logout(undefined)
      navigate({ to: "/login" })
    } catch {
      navigate({ to: "/login" })
    }
  }

  const isLoggingOut = Result.isWaiting(logoutResult)

  // If no token, show Login button
  if (!hasToken) {
    return (
      <Link
        to="/login"
        className="
          inline-flex items-center justify-center
          rounded-lg px-4 py-2
          bg-indigo-600 text-white text-sm font-medium
          hover:bg-indigo-700 active:bg-indigo-800
          transition-colors duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
        "
        data-testid="user-menu-login"
      >
        Sign in
      </Link>
    )
  }

  // Determine loading state
  const isLoading = Result.isWaiting(userResult) || Result.isInitial(userResult)
  const user = Result.isSuccess(userResult) ? userResult.value.user : null
  const displayName = user?.displayName ?? null
  const email = user?.email ?? ""
  const initials = isLoading ? "..." : getInitials(displayName, email)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Menu Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2.5 rounded-lg px-2 py-1.5
          text-gray-700 hover:bg-gray-100
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
          ${isOpen ? "bg-gray-100" : ""}
        `}
        aria-expanded={isOpen}
        aria-haspopup="true"
        data-testid="user-menu"
      >
        {/* Avatar */}
        <div className="
          flex h-8 w-8 items-center justify-center rounded-full
          bg-gradient-to-br from-indigo-500 to-indigo-700
          text-sm font-medium text-white
          shadow-sm
        ">
          {initials}
        </div>

        {/* Name (hidden on small screens) */}
        <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
          {displayName || email}
        </span>

        {/* Dropdown indicator */}
        <ChevronDownIcon />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute right-0 mt-2 w-72
            rounded-xl bg-white shadow-xl
            border border-gray-200
            py-1 z-50
          "
          role="menu"
          aria-orientation="vertical"
          data-testid="user-menu-dropdown"
        >
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="
                flex h-10 w-10 items-center justify-center rounded-full
                bg-gradient-to-br from-indigo-500 to-indigo-700
                text-sm font-medium text-white
                shadow-sm
              ">
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
              className="
                flex items-center gap-3 px-4 py-2.5
                text-sm text-gray-700
                hover:bg-gray-50 hover:text-gray-900
                transition-colors duration-200
              "
              onClick={() => setIsOpen(false)}
              role="menuitem"
              data-testid="user-menu-settings"
            >
              <span className="text-gray-400">
                <CogIcon />
              </span>
              <span>Account Settings</span>
            </Link>

            {/* Divider */}
            <div className="my-1 border-t border-gray-100" />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="
                flex w-full items-center gap-3 px-4 py-2.5
                text-sm text-red-600
                hover:bg-red-50
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              role="menuitem"
              data-testid="user-menu-logout"
            >
              <LogoutIcon />
              <span>{isLoggingOut ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
