/**
 * Sidebar Component
 *
 * Responsive sidebar navigation that collapses to icons on mobile.
 * Features:
 * - Navigation links with active route highlighting
 * - Expandable/collapsible state controlled by sidebarOpenAtom
 * - Icons-only mode on collapse
 */

import { Link, useMatchRoute } from "@tanstack/react-router"
import { useAtom } from "@effect-atom/atom-react"
import { sidebarOpenAtom } from "../atoms/ui.ts"
import * as React from "react"

interface NavItem {
  readonly label: string
  readonly to: string
  readonly icon: React.ReactNode
}

// SVG icons for navigation
const BuildingIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
)

const OfficeBuildingIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
)

const DocumentTextIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
)

const ChartBarIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
)

const MenuIcon = () => (
  <svg
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  </svg>
)

const ChevronRightIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
)

const navItems: ReadonlyArray<NavItem> = [
  { label: "Organizations", to: "/organizations", icon: <BuildingIcon /> },
  { label: "Companies", to: "/companies", icon: <OfficeBuildingIcon /> },
  { label: "Journal Entries", to: "/journal-entries", icon: <DocumentTextIcon /> },
  { label: "Reports", to: "/reports", icon: <ChartBarIcon /> }
]

function NavLink({
  item,
  isOpen,
  isActive
}: {
  readonly item: NavItem
  readonly isOpen: boolean
  readonly isActive: boolean
}) {
  const baseClasses = [
    "flex items-center gap-3 rounded-lg px-3 py-2",
    "transition-colors duration-200",
    "hover:bg-gray-100"
  ].join(" ")

  const activeClasses = isActive
    ? "bg-blue-50 text-blue-700 font-medium"
    : "text-gray-700"

  return (
    <Link
      to={item.to}
      className={`${baseClasses} ${activeClasses}`}
      title={item.label}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {isOpen && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom)
  const matchRoute = useMatchRoute()

  const toggleSidebar = () => {
    setIsOpen((open) => !open)
  }

  const sidebarClasses = [
    "flex flex-col",
    "bg-white border-r border-gray-200",
    "h-screen",
    "transition-all duration-300",
    isOpen ? "w-64" : "w-16"
  ].join(" ")

  return (
    <aside className={sidebarClasses} data-testid="sidebar">
      {/* Logo/Brand Area */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        {isOpen && (
          <span className="text-lg font-semibold text-gray-900">
            Accountability
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          data-testid="sidebar-toggle"
        >
          {isOpen ? <ChevronLeftIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-2" data-testid="sidebar-nav">
        {navItems.map((item) => {
          // Check if the current route matches this nav item
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

      {/* Collapse indicator at bottom */}
      {!isOpen && (
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Expand sidebar"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </aside>
  )
}
