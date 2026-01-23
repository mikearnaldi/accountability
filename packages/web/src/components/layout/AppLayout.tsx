/**
 * AppLayout component
 *
 * Main application layout with sidebar, header, and organization context.
 * Used for authenticated pages to provide consistent navigation.
 * Features:
 * - Collapsible sidebar with organization-scoped navigation
 * - Keyboard shortcut to toggle sidebar: Ctrl+B (Windows/Linux) or Cmd+B (Mac)
 * - Header with organization selector and user profile
 * - Breadcrumbs with organization context
 * - Responsive design for mobile
 * - Data-testid attributes for E2E testing
 */

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "./Sidebar.tsx"
import { Header } from "./Header.tsx"
import { Breadcrumbs } from "./Breadcrumbs.tsx"
import type { Organization } from "./OrganizationSelector.tsx"
import type { BreadcrumbItem } from "./Breadcrumbs.tsx"

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

interface AppLayoutProps {
  /** User info from route context */
  readonly user: UserInfo | null
  /** Page content */
  readonly children: React.ReactNode
  /** List of organizations for selector */
  readonly organizations?: readonly Organization[]
  /** Currently selected organization */
  readonly currentOrganization?: Organization | null
  /** Whether organizations are loading */
  readonly organizationsLoading?: boolean
  /** Whether to show breadcrumbs */
  readonly showBreadcrumbs?: boolean
  /** Custom breadcrumb items (optional) */
  readonly breadcrumbItems?: readonly BreadcrumbItem[]
  /** Companies in the current organization (for sidebar quick actions) */
  readonly companies?: readonly { readonly id: string; readonly name: string }[]
}

// =============================================================================
// AppLayout Component
// =============================================================================

export function AppLayout({
  user,
  children,
  organizations = [],
  currentOrganization = null,
  organizationsLoading = false,
  showBreadcrumbs = true,
  breadcrumbItems,
  companies = []
}: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Keyboard shortcut handler for toggling sidebar (Ctrl+B / Cmd+B)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check for Ctrl+B (Windows/Linux) or Cmd+B (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === "b") {
      // Prevent browser default behavior (e.g., bookmarks dialog)
      event.preventDefault()
      setSidebarCollapsed((prev) => !prev)
    }
  }, [])

  // Register keyboard shortcut
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  // Normalize undefined to null for exactOptionalPropertyTypes
  const normalizedOrg = currentOrganization ?? null

  return (
    <div
      className="flex h-screen bg-gray-50 overflow-hidden"
      data-testid="app-layout"
    >
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        data-testid="skip-to-main-content"
      >
        Skip to main content
      </a>

      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentOrganization={normalizedOrg}
        companies={companies}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <Header
          user={user}
          organizations={organizations}
          currentOrganization={normalizedOrg}
          organizationsLoading={organizationsLoading}
        />

        {/* Page Content */}
        <main
          id="main-content"
          className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6"
          data-testid="app-main-content"
          tabIndex={-1}
        >
          {/* Breadcrumbs */}
          {showBreadcrumbs && (
            breadcrumbItems ? (
              <Breadcrumbs
                items={breadcrumbItems}
                organization={normalizedOrg}
              />
            ) : (
              <Breadcrumbs
                organization={normalizedOrg}
              />
            )
          )}

          {children}
        </main>
      </div>
    </div>
  )
}

// =============================================================================
// Re-exports
// =============================================================================

export { type Organization } from "./OrganizationSelector.tsx"
export { type BreadcrumbItem } from "./Breadcrumbs.tsx"
