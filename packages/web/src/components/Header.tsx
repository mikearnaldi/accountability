/**
 * Header Component
 *
 * Top navigation bar with company selector, page title area, and user menu slot.
 * Responsive design that works with the sidebar and main content.
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
      className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6"
      data-testid="header"
    >
      {/* Left side - company selector and page title area */}
      <div className="flex items-center gap-4">
        {/* Company selector for global context switching */}
        {showCompanySelector && <CompanySelector />}

        {/* Page title slot (can be used by child routes) */}
        <div id="header-title-slot" data-testid="header-title-slot">
          {/* Page titles can be portaled here if needed */}
        </div>
      </div>

      {/* Right side - user menu slot */}
      <div className="flex items-center gap-4" data-testid="header-user-slot">
        {userMenu}
      </div>
    </header>
  )
}
