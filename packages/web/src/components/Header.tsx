/**
 * Header Component
 *
 * Top navigation bar with app logo/title area and user menu slot.
 * Responsive design that works with the sidebar and main content.
 */

import * as React from "react"

interface HeaderProps {
  /**
   * User menu content to display on the right side of the header.
   * Typically contains user avatar, name, and dropdown menu.
   */
  readonly userMenu?: React.ReactNode
}

export function Header({ userMenu }: HeaderProps) {
  return (
    <header
      className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6"
      data-testid="header"
    >
      {/* Left side - page title area (can be used by child routes) */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button is handled by sidebar */}
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
