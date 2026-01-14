/**
 * Sidebar Component
 *
 * Professional sidebar navigation with:
 * - Smooth expand/collapse animation
 * - Active state indicators with colored accent
 * - Hover effects and focus states
 * - Icons-only mode when collapsed
 * - Elegant branding area
 */

import { Link, useMatchRoute } from "@tanstack/react-router"
import { useAtom } from "@effect-atom/atom-react"
import { sidebarOpenAtom } from "../atoms/ui.ts"
import * as React from "react"

interface NavItem {
  readonly label: string
  readonly to: string
  readonly icon: React.ReactNode
  readonly color: string
}

// =============================================================================
// Icons
// =============================================================================

function OrganizationsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5V21m3-18h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75" />
    </svg>
  )
}

function CompaniesIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function JournalIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function LogoIcon() {
  return (
    <svg className="h-8 w-8" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="6" className="fill-indigo-600" />
      <path d="M9 22V10h4l3 8 3-8h4v12h-3v-8l-3 8h-2l-3-8v8H9z" className="fill-white" />
    </svg>
  )
}

// =============================================================================
// Navigation Items
// =============================================================================

const navItems: ReadonlyArray<NavItem> = [
  { label: "Organizations", to: "/organizations", icon: <OrganizationsIcon />, color: "indigo" },
  { label: "Companies", to: "/companies", icon: <CompaniesIcon />, color: "emerald" },
  { label: "Journal Entries", to: "/journal-entries", icon: <JournalIcon />, color: "amber" },
  { label: "Reports", to: "/reports", icon: <ReportsIcon />, color: "blue" }
]

// =============================================================================
// NavLink Component
// =============================================================================

const colorClasses: Record<string, { active: string; icon: string }> = {
  indigo: { active: "bg-indigo-50 text-indigo-700 border-indigo-600", icon: "text-indigo-600" },
  emerald: { active: "bg-emerald-50 text-emerald-700 border-emerald-600", icon: "text-emerald-600" },
  amber: { active: "bg-amber-50 text-amber-700 border-amber-600", icon: "text-amber-600" },
  blue: { active: "bg-blue-50 text-blue-700 border-blue-600", icon: "text-blue-600" }
}

function NavLink({
  item,
  isOpen,
  isActive
}: {
  readonly item: NavItem
  readonly isOpen: boolean
  readonly isActive: boolean
}) {
  const colors = colorClasses[item.color] ?? colorClasses.indigo

  return (
    <Link
      to={item.to}
      className={`
        group relative flex items-center gap-3 rounded-lg px-3 py-2.5
        transition-all duration-200 ease-out
        ${isActive
          ? `${colors.active} border-l-2 font-medium`
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent"
        }
        ${!isOpen ? "justify-center" : ""}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
      `}
      title={!isOpen ? item.label : undefined}
      data-testid={`sidebar-${item.to.replace("/", "")}`}
    >
      <span className={`flex-shrink-0 transition-colors ${isActive ? colors.icon : "text-gray-400 group-hover:text-gray-600"}`}>
        {item.icon}
      </span>
      {isOpen && (
        <span className="truncate text-sm">{item.label}</span>
      )}
      {!isOpen && (
        <span className="
          absolute left-full ml-2 px-2 py-1
          rounded bg-gray-900 text-xs text-white
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none whitespace-nowrap z-50
          shadow-lg
        ">
          {item.label}
        </span>
      )}
    </Link>
  )
}

// =============================================================================
// Sidebar Component
// =============================================================================

export function Sidebar() {
  const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom)
  const matchRoute = useMatchRoute()

  const toggleSidebar = () => {
    setIsOpen((open) => !open)
  }

  return (
    <aside
      className={`
        flex flex-col
        bg-white border-r border-gray-200
        h-screen
        transition-all duration-300 ease-out
        ${isOpen ? "w-64" : "w-[68px]"}
        shadow-sm
      `}
      data-testid="sidebar"
    >
      {/* Logo/Brand Area - Clickable to return home */}
      <div className={`
        flex h-16 items-center border-b border-gray-100
        ${isOpen ? "justify-between px-4" : "justify-center px-2"}
      `}>
        <Link
          to="/"
          className={`
            flex items-center gap-3 rounded-lg
            transition-transform hover:scale-[1.02] active:scale-[0.98]
            focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
            ${!isOpen ? "p-1" : ""}
          `}
          title="Go to Dashboard"
          data-testid="sidebar-logo-link"
        >
          <LogoIcon />
          {isOpen && (
            <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
              Accountability
            </span>
          )}
        </Link>
        <button
          onClick={toggleSidebar}
          className={`
            rounded-lg p-2
            text-gray-400 hover:text-gray-600 hover:bg-gray-100
            transition-colors duration-200
            focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
            ${!isOpen ? "hidden" : ""}
          `}
          aria-label="Collapse sidebar"
          data-testid="sidebar-toggle"
        >
          <CollapseIcon />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-3" data-testid="sidebar-nav">
        {navItems.map((item) => {
          const isActive = matchRoute({ to: item.to, fuzzy: true }) !== false
          return (
            <NavLink
              key={item.to}
              item={item}
              isOpen={isOpen}
              isActive={isActive}
            />
          )
        })}
      </nav>

      {/* Footer with expand button when collapsed */}
      <div className={`
        border-t border-gray-100 p-3
        ${isOpen ? "hidden" : ""}
      `}>
        <button
          onClick={toggleSidebar}
          className="
            flex w-full items-center justify-center rounded-lg p-2.5
            text-gray-400 hover:text-gray-600 hover:bg-gray-100
            transition-colors duration-200
            focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
          "
          aria-label="Expand sidebar"
          data-testid="sidebar-expand"
        >
          <ExpandIcon />
        </button>
      </div>
    </aside>
  )
}
