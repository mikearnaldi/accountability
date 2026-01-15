/**
 * Sidebar navigation component
 *
 * Professional sidebar navigation with organization-scoped menu.
 * Features:
 * - Logo/brand link to home
 * - Organization-scoped navigation when org is selected
 * - Global navigation when no org selected
 * - Active route highlighting
 * - Collapsible menu for mobile
 * - Data-testid attributes for E2E testing
 */

import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { clsx } from "clsx"
import { useState } from "react"
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  Globe2,
  ArrowLeftRight,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Building,
  Check
} from "lucide-react"
import type { Organization } from "./OrganizationSelector.tsx"

// =============================================================================
// Types
// =============================================================================

interface NavItem {
  readonly label: string
  readonly href: string
  readonly icon: React.ComponentType<{ readonly className?: string }>
  readonly testId: string
}

interface SidebarProps {
  readonly isCollapsed: boolean
  readonly onToggleCollapse: () => void
  /** Currently selected organization (for org-scoped navigation) */
  readonly currentOrganization?: Organization | null
}

// =============================================================================
// Navigation Items
// =============================================================================

/**
 * Get navigation items based on whether an organization is selected
 */
function getNavItems(organizationId?: string): readonly NavItem[] {
  // If no organization selected, show global navigation
  if (!organizationId) {
    return [
      {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        testId: "nav-dashboard"
      },
      {
        label: "Organizations",
        href: "/organizations",
        icon: Building2,
        testId: "nav-organizations"
      }
    ]
  }

  // Organization-scoped navigation
  return [
    {
      label: "Dashboard",
      href: `/organizations/${organizationId}/dashboard`,
      icon: LayoutDashboard,
      testId: "nav-org-dashboard"
    },
    {
      label: "Companies",
      href: `/organizations/${organizationId}/companies`,
      icon: Building,
      testId: "nav-companies"
    },
    {
      label: "Exchange Rates",
      href: `/organizations/${organizationId}/exchange-rates`,
      icon: TrendingUp,
      testId: "nav-exchange-rates"
    },
    {
      label: "Consolidation",
      href: `/organizations/${organizationId}/consolidation`,
      icon: Globe2,
      testId: "nav-consolidation"
    },
    {
      label: "Intercompany",
      href: `/organizations/${organizationId}/intercompany`,
      icon: ArrowLeftRight,
      testId: "nav-intercompany"
    },
    {
      label: "Audit Log",
      href: `/organizations/${organizationId}/audit-log`,
      icon: ClipboardList,
      testId: "nav-audit-log"
    },
    {
      label: "Settings",
      href: `/organizations/${organizationId}/settings`,
      icon: Settings,
      testId: "nav-org-settings"
    }
  ]
}

// =============================================================================
// Sidebar Component
// =============================================================================

export function Sidebar({ isCollapsed, onToggleCollapse, currentOrganization }: SidebarProps) {
  const location = useLocation()
  const navItems = getNavItems(currentOrganization?.id)

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        data-testid="sidebar"
        className={clsx(
          "hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo/Brand */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link
            to="/"
            data-testid="sidebar-logo"
            className={clsx(
              "flex items-center gap-2 font-bold text-gray-900",
              isCollapsed && "justify-center w-full"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            {!isCollapsed && <span className="text-lg">Accountability</span>}
          </Link>
        </div>

        {/* Organization Context Indicator */}
        {currentOrganization && !isCollapsed && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Organization</p>
            <p className="text-sm font-medium text-gray-900 truncate" data-testid="sidebar-current-org">
              {currentOrganization.name}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            // Determine if this item is active
            let isActive = false
            if (item.href === "/" || item.href === `/organizations/${currentOrganization?.id}/dashboard`) {
              // Dashboard: exact match
              isActive = location.pathname === item.href
            } else {
              // Other items: prefix match
              isActive = location.pathname.startsWith(item.href)
            }

            return (
              <Link
                key={item.href}
                to={item.href}
                data-testid={item.testId}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onToggleCollapse}
            data-testid="sidebar-collapse-toggle"
            className={clsx(
              "flex items-center justify-center w-full px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors",
              isCollapsed && "px-0"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span className="ml-2 text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}

// =============================================================================
// Mobile Sidebar Component
// =============================================================================

interface MobileSidebarProps {
  /** List of organizations for org selector */
  readonly organizations?: readonly Organization[]
  /** Currently selected organization */
  readonly currentOrganization?: Organization | null
}

export function MobileSidebar({ organizations = [], currentOrganization }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const navItems = getNavItems(currentOrganization?.id)

  const handleSelectOrganization = (org: Organization) => {
    setIsOpen(false)
    navigate({
      to: "/organizations/$organizationId/dashboard",
      params: { organizationId: org.id }
    })
  }

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(true)}
        data-testid="mobile-menu-toggle"
        className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          data-testid="mobile-sidebar-overlay"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Sidebar Panel */}
          <aside
            className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col"
            data-testid="mobile-sidebar"
          >
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
              <Link
                to="/"
                className="flex items-center gap-2 font-bold text-gray-900"
                onClick={() => setIsOpen(false)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-lg">Accountability</span>
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                aria-label="Close menu"
                data-testid="mobile-sidebar-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Organization Selector (Mobile) */}
            {organizations.length > 0 && (
              <div className="px-3 py-3 border-b border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-1">
                  Organization
                </p>
                <div className="space-y-1">
                  {organizations.map((org) => {
                    const isSelected = currentOrganization?.id === org.id
                    return (
                      <button
                        key={org.id}
                        onClick={() => handleSelectOrganization(org)}
                        className={clsx(
                          "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors",
                          isSelected
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                        data-testid={`mobile-org-${org.id}`}
                      >
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{org.name}</span>
                        {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                let isActive = false
                if (item.href === "/" || item.href === `/organizations/${currentOrganization?.id}/dashboard`) {
                  isActive = location.pathname === item.href
                } else {
                  isActive = location.pathname.startsWith(item.href)
                }

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    data-testid={`mobile-${item.testId}`}
                    onClick={() => setIsOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
