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
import { useState, useRef, useEffect } from "react"
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
  Check,
  Plus,
  FileText,
  CreditCard,
  ChevronDown,
  BarChart3,
  Users,
  Shield,
  ShieldAlert,
  SlidersHorizontal
} from "lucide-react"
import type { Organization } from "./OrganizationSelector.tsx"

// =============================================================================
// Types
// =============================================================================

interface NavSubItem {
  readonly label: string
  readonly href: string
  readonly icon: React.ComponentType<{ readonly className?: string }>
  readonly testId: string
  readonly available?: boolean
}

interface NavItem {
  readonly label: string
  readonly href: string
  readonly icon: React.ComponentType<{ readonly className?: string }>
  readonly testId: string
  /** Optional submenu items for collapsible sections */
  readonly subItems?: readonly NavSubItem[]
}

interface SidebarProps {
  readonly isCollapsed: boolean
  readonly onToggleCollapse: () => void
  /** Currently selected organization (for org-scoped navigation) */
  readonly currentOrganization?: Organization | null
  /** Companies in the current organization (for creating journal entries, accounts via quick actions) */
  readonly companies?: readonly { readonly id: string; readonly name: string }[]
}

interface QuickActionItem {
  readonly label: string
  readonly href: string
  readonly icon: React.ComponentType<{ readonly className?: string }>
  readonly testId: string
}

// =============================================================================
// Navigation Items
// =============================================================================

/**
 * Get navigation items based on whether an organization is selected
 *
 * Per Issue 35: When no organization is selected (on /organizations page),
 * only show "Organizations" link. Dashboard and other nav items don't make
 * sense without an organization context.
 */
function getNavItems(organizationId?: string): readonly NavItem[] {
  // If no organization selected, only show Organizations link
  if (!organizationId) {
    return [
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
      label: "Reports",
      href: `/organizations/${organizationId}/reports`,
      icon: BarChart3,
      testId: "nav-reports"
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
      testId: "nav-org-settings",
      subItems: [
        {
          label: "General",
          href: `/organizations/${organizationId}/settings`,
          icon: SlidersHorizontal,
          testId: "nav-settings-general"
        },
        {
          label: "Members",
          href: `/organizations/${organizationId}/settings/members`,
          icon: Users,
          testId: "nav-settings-members"
        },
        {
          label: "Policies",
          href: `/organizations/${organizationId}/settings/policies`,
          icon: Shield,
          testId: "nav-settings-policies"
        },
        {
          label: "Security Audit",
          href: `/organizations/${organizationId}/settings/authorization-audit`,
          icon: ShieldAlert,
          testId: "nav-settings-security-audit"
        }
      ]
    }
  ]
}

// =============================================================================
// Quick Action Menu Component
// =============================================================================

interface QuickActionMenuProps {
  /** Organization ID - optional, as Organization can always be created */
  readonly organizationId: string | undefined
  readonly companies?: readonly { readonly id: string; readonly name: string }[]
  readonly isCollapsed: boolean
}

function QuickActionMenu({ organizationId, companies = [], isCollapsed }: QuickActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Get the first company for journal entry and account actions
  const firstCompany = companies[0]

  // Build actions list - Organization is ALWAYS available per spec
  const actions: QuickActionItem[] = [
    // Organization - ALWAYS available (even when no org selected)
    {
      label: "Organization",
      href: "/organizations/new",
      icon: Building2,
      testId: "quick-action-organization"
    },
    // Journal Entry - needs an organization AND a company
    ...(organizationId && firstCompany
      ? [
          {
            label: "Journal Entry",
            href: `/organizations/${organizationId}/companies/${firstCompany.id}/journal-entries/new`,
            icon: FileText,
            testId: "quick-action-journal-entry"
          }
        ]
      : []),
    // Company - needs an organization
    ...(organizationId
      ? [
          {
            label: "Company",
            href: `/organizations/${organizationId}/companies/new`,
            icon: Building,
            testId: "quick-action-company"
          }
        ]
      : []),
    // Account - needs an organization AND a company
    ...(organizationId && firstCompany
      ? [
          {
            label: "Account",
            href: `/organizations/${organizationId}/companies/${firstCompany.id}/accounts/new`,
            icon: CreditCard,
            testId: "quick-action-account"
          }
        ]
      : []),
    // Exchange Rate - needs an organization
    ...(organizationId
      ? [
          {
            label: "Exchange Rate",
            href: `/organizations/${organizationId}/exchange-rates/new`,
            icon: TrendingUp,
            testId: "quick-action-exchange-rate"
          }
        ]
      : [])
  ]

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="quick-action-button"
        className={clsx(
          "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors",
          isCollapsed && "justify-center"
        )}
        title={isCollapsed ? "+ New" : undefined}
      >
        <Plus className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">New</span>
            <ChevronDown
              className={clsx("h-4 w-4 transition-transform", isOpen && "rotate-180")}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={clsx(
            "absolute z-50 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg py-1",
            isCollapsed ? "left-full ml-2 top-0 w-48" : "left-0 right-0"
          )}
          data-testid="quick-action-menu"
        >
          {actions.map((action) => (
            <Link
              key={action.testId}
              to={action.href}
              data-testid={action.testId}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <action.icon className="h-4 w-4 text-gray-500" />
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Nav Item Component (supports submenus)
// =============================================================================

interface NavItemComponentProps {
  readonly item: NavItem
  readonly isCollapsed: boolean
  readonly currentOrganization?: Organization | null | undefined
  readonly isMobile?: boolean
  readonly onNavigate?: () => void
}

function NavItemComponent({ item, isCollapsed, currentOrganization, isMobile, onNavigate }: NavItemComponentProps) {
  const location = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)

  // Determine if this item or any subitem is active
  let isActive = false
  if (item.href === "/" || item.href === `/organizations/${currentOrganization?.id}/dashboard`) {
    isActive = location.pathname === item.href
  } else {
    isActive = location.pathname.startsWith(item.href)
  }

  // Auto-expand if any subitem is active
  const hasSubItems = item.subItems && item.subItems.length > 0
  const isSubItemActive = hasSubItems && location.pathname.startsWith(item.href)

  // Auto-expand the section when on a subitem page
  useEffect(() => {
    if (isSubItemActive && !isCollapsed) {
      setIsExpanded(true)
    }
  }, [isSubItemActive, isCollapsed])

  // If no subitems, render a simple link
  if (!hasSubItems) {
    return (
      <Link
        to={item.href}
        data-testid={isMobile ? `mobile-${item.testId}` : item.testId}
        onClick={onNavigate}
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
  }

  // Render expandable section with subitems
  return (
    <div>
      {/* Parent item (clickable to expand/collapse) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={isMobile ? `mobile-${item.testId}` : item.testId}
        className={clsx(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full",
          isActive
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
          isCollapsed && "justify-center"
        )}
        title={isCollapsed ? item.label : undefined}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={clsx(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </>
        )}
      </button>

      {/* Subitems (expandable) */}
      {isExpanded && !isCollapsed && (
        <div className="mt-1 space-y-0.5">
          {item.subItems?.map((subItem) => {
            // Check if this sub-item's path matches the current location
            // For the "General" settings (which has the same href as the parent), check for exact match
            // For other sub-items, check if the pathname matches exactly or starts with the href
            const subIsActive = subItem.href === item.href
              ? location.pathname === subItem.href  // Exact match for parent-level items (like General)
              : location.pathname === subItem.href || location.pathname.startsWith(subItem.href + "/")

            // If not available, show as disabled
            if (subItem.available === false) {
              return (
                <div
                  key={subItem.testId}
                  data-testid={isMobile ? `mobile-${subItem.testId}` : subItem.testId}
                  className="flex items-center gap-3 px-3 py-2 text-gray-400 cursor-not-allowed rounded-lg"
                  title="Coming soon"
                >
                  <subItem.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{subItem.label}</span>
                  <span className="ml-auto text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">Soon</span>
                </div>
              )
            }

            return (
              <Link
                key={subItem.testId}
                to={subItem.href}
                data-testid={isMobile ? `mobile-${subItem.testId}` : subItem.testId}
                onClick={onNavigate}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  subIsActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <subItem.icon className="h-5 w-5 flex-shrink-0" />
                <span>{subItem.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}


// =============================================================================
// Sidebar Component
// =============================================================================

export function Sidebar({ isCollapsed, onToggleCollapse, currentOrganization, companies = [] }: SidebarProps) {
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

        {/* Quick Action Menu - ALWAYS visible per spec (Organization is always available) */}
        <div className="px-3 py-3 border-b border-gray-100">
          <QuickActionMenu
            organizationId={currentOrganization?.id}
            companies={companies}
            isCollapsed={isCollapsed}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              isCollapsed={isCollapsed}
              currentOrganization={currentOrganization}
            />
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onToggleCollapse}
            data-testid="sidebar-collapse-toggle"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
  /** Companies in the current organization (for quick actions) */
  readonly companies?: readonly { readonly id: string; readonly name: string }[]
}

export function MobileSidebar({ organizations = [], currentOrganization, companies = [] }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
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

            {/* Quick Action Menu (Mobile) - ALWAYS visible per spec */}
            <div className="px-3 py-3 border-b border-gray-200">
              <QuickActionMenu
                organizationId={currentOrganization?.id}
                companies={companies}
                isCollapsed={false}
              />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavItemComponent
                  key={item.href}
                  item={item}
                  isCollapsed={false}
                  currentOrganization={currentOrganization}
                  isMobile={true}
                  onNavigate={() => setIsOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
