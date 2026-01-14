/**
 * Header Component
 *
 * Professional top navigation bar with:
 * - Company selector for global context switching
 * - Page title slot for dynamic titles
 * - User menu slot for authentication UI
 * - Clean, elevated design with subtle shadow
 */

import * as React from "react"
import { CompanySelector } from "./CompanySelector.tsx"

interface HeaderProps {
  /**
   * User menu content to display on the right side of the header.
   * Typically contains user avatar, name, and dropdown menu.
   */
  readonly userMenu?: React.ReactNode
  /**
   * Whether to show the company selector.
   * Defaults to true for authenticated views.
   */
  readonly showCompanySelector?: boolean
}

export function Header({ userMenu, showCompanySelector = true }: HeaderProps) {
  return (
    <header
      className="
        flex h-16 items-center justify-between
        border-b border-gray-100 bg-white
        px-6
        shadow-sm
      "
      data-testid="header"
    >
      {/* Left side - company selector and page title area */}
      <div className="flex items-center gap-6">
        {/* Company selector for global context switching */}
        {showCompanySelector && <CompanySelector />}

        {/* Divider when company selector is shown */}
        {showCompanySelector && (
          <div className="h-6 w-px bg-gray-200" aria-hidden="true" />
        )}

        {/* Page title slot (can be used by child routes) */}
        <div id="header-title-slot" data-testid="header-title-slot">
          {/* Page titles can be portaled here if needed */}
        </div>
      </div>

      {/* Right side - user menu slot */}
      <div className="flex items-center gap-3" data-testid="header-user-slot">
        {userMenu}
      </div>
    </header>
  )
}
