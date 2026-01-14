/**
 * Header component
 *
 * Top header with user profile, notifications, and search.
 * Features:
 * - Search input (placeholder for future functionality)
 * - Notifications bell icon
 * - User profile dropdown with logout
 * - Data-testid attributes for E2E testing
 */

import { useRouter } from "@tanstack/react-router"
import { clsx } from "clsx"
import { useState, useRef, useEffect } from "react"
import { Search, Bell, ChevronDown, LogOut, User, Settings } from "lucide-react"
import { api } from "@/api/client"
import { MobileSidebar } from "./Sidebar.tsx"

interface UserInfo {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: string
  readonly primaryProvider: string
}

interface HeaderProps {
  readonly user: UserInfo | null
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const userMenuRef = useRef<HTMLDivElement>(null)

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
        {/* Left: Mobile menu + Search */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Toggle */}
          <MobileSidebar />

          {/* Search (hidden on small screens) */}
          <div className="hidden sm:flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="header-search"
                className="w-64 lg:w-80 pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Right: Notifications + User Profile */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            data-testid="notifications-button"
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {/* Notification badge placeholder */}
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </button>

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
                    <button
                      data-testid="user-menu-profile"
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setShowUserMenu(false)
                        // Settings page not implemented yet, navigate to home
                        router.navigate({ to: "/" })
                      }}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      data-testid="user-menu-settings"
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setShowUserMenu(false)
                        // Settings page not implemented yet, navigate to home
                        router.navigate({ to: "/" })
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
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
