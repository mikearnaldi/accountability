/**
 * AppLayout component
 *
 * Main application layout with sidebar and header.
 * Used for authenticated pages to provide consistent navigation.
 * Features:
 * - Collapsible sidebar
 * - Header with user profile and search
 * - Responsive design for mobile
 * - Data-testid attributes for E2E testing
 */

import { useState } from "react"
import { Sidebar } from "./Sidebar.tsx"
import { Header } from "./Header.tsx"

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
}

export function AppLayout({ user, children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div
      className="flex h-screen bg-gray-50 overflow-hidden"
      data-testid="app-layout"
    >
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header user={user} />

        {/* Page Content */}
        <main
          className="flex-1 overflow-y-auto p-4 lg:p-6"
          data-testid="app-main-content"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
