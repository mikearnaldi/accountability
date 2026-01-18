/**
 * Header component
 *
 * Top header with organization selector, user profile, and logout.
 * Features:
 * - Organization selector dropdown (switch between orgs)
 * - Current org name shown prominently
 * - User profile dropdown with logout
 * - NO search/notifications (no API)
 * - Data-testid attributes for E2E testing
 */

import { useRouter, Link } from "@tanstack/react-router"
import { clsx } from "clsx"
import { useState, useRef, useEffect } from "react"
import { ChevronDown, LogOut, User } from "lucide-react"
import { api } from "@/api/client"
import { MobileSidebar } from "./Sidebar.tsx"
import { OrganizationSelector, type Organization } from "./OrganizationSelector.tsx"

// =============================================================================
// Types
// =============================================================================

interface UserInfo {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: string
  readonly primaryProvider: string
}

interface HeaderProps {
  /** User info from route context */
  readonly user: UserInfo | null
  /** List of organizations user has access to */
  readonly organizations?: readonly Organization[]
  /** Currently selected organization */
  readonly currentOrganization?: Organization | null
  /** Whether organizations are loading */
  readonly organizationsLoading?: boolean
}

// =============================================================================
// Header Component
// =============================================================================

export function Header({
  user,
  organizations = [],
  currentOrganization = null,
  organizationsLoading = false
}: HeaderProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Normalize undefined to null for exactOptionalPropertyTypes
  const normalizedOrg = currentOrganization ?? null

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target
      if (
        userMenuRef.current &&
        target instanceof Node &&
        !userMenuRef.current.contains(target)
      ) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)

    try {
      await api.POST("/api/auth/logout")
      // Cookie will be cleared by the server
      // Invalidate router to clear user context and redirect
      await router.invalidate()
      router.navigate({ to: "/" })
    } catch {
      setIsLoggingOut(false)
    }
  }

  const displayName = user?.displayName || user?.email || "User"
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header
      className="h-16 border-b border-gray-200 bg-white px-4 lg:px-6"
      data-testid="header"
    >
      <div className="flex items-center justify-between h-full">
        {/* Left: Mobile menu + Organization Selector */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Toggle */}
          <MobileSidebar
            organizations={organizations}
            currentOrganization={normalizedOrg}
          />

          {/* Organization Selector (hidden on mobile, shown in mobile sidebar) */}
          <div className="hidden sm:block">
            <OrganizationSelector
              organizations={organizations}
              currentOrganization={normalizedOrg}
              loading={organizationsLoading}
            />
          </div>
        </div>

        {/* Right: User Profile */}
        <div className="flex items-center gap-3">
          {/* User Profile Dropdown */}
          {user && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                data-testid="user-menu-button"
                className={clsx(
                  "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-colors",
                  showUserMenu
                    ? "bg-gray-100"
                    : "hover:bg-gray-100"
                )}
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-medium">
                  {initials}
                </div>
                {/* Name (hidden on small screens) */}
                <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                  {displayName}
                </span>
                <ChevronDown
                  className={clsx(
                    "h-4 w-4 text-gray-500 transition-transform",
                    showUserMenu && "rotate-180"
                  )}
                />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                  data-testid="user-menu-dropdown"
                >
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      to="/profile"
                      search={normalizedOrg ? { org: normalizedOrg.id } : {}}
                      data-testid="user-menu-profile"
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      data-testid="user-menu-logout"
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {isLoggingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
