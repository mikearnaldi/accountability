/**
 * AppShell Component
 *
 * The foundational app layout that composes:
 * - Sidebar navigation (left)
 * - Header with user menu (top)
 * - Main content area (center)
 *
 * Features:
 * - Responsive layout with collapsible sidebar
 * - Flexible header with user menu slot
 * - Full-height layout that fills the viewport
 * - Beautiful gradient background for content area
 */

import * as React from "react"
import { Sidebar } from "./Sidebar.tsx"
import { Header } from "./Header.tsx"

interface AppShellProps {
  /**
   * User menu component to display in the header.
   * Should include user avatar/name and dropdown with profile/logout options.
   */
  readonly userMenu?: React.ReactNode
  /**
   * Main content to display in the content area.
   */
  readonly children: React.ReactNode
}

/**
 * AppShell - Main application layout wrapper
 *
 * Provides the foundational layout structure with sidebar navigation,
 * header with user menu, and main content area.
 *
 * Usage:
 * ```tsx
 * <AppShell userMenu={<UserMenu />}>
 *   <YourContent />
 * </AppShell>
 * ```
 */
export function AppShell({ userMenu, children }: AppShellProps) {
  return (
    <div
      className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100"
      data-testid="app-shell"
    >
      {/* Sidebar - fixed left navigation */}
      <Sidebar />

      {/* Main content wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header - top bar with user menu */}
        <Header userMenu={userMenu} />

        {/* Main content area - scrollable */}
        <main
          className="flex-1 overflow-auto p-6 lg:p-8"
          data-testid="main-content"
        >
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
