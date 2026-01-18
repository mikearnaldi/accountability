/**
 * OrganizationSelector component
 *
 * Dropdown to select the current organization context.
 * Features:
 * - Shows current organization name prominently
 * - Dropdown list of user's organizations
 * - Navigation to organization on selection
 * - Option to create new organization
 * - Data-testid attributes for E2E testing
 *
 * Note: Role badges are intentionally NOT shown in the selector dropdown
 * to keep the component focused on its primary purpose of switching organizations.
 * Role information is displayed on the Members page where it's contextually relevant.
 */

import { useNavigate, Link } from "@tanstack/react-router"
import { clsx } from "clsx"
import { useState, useRef, useEffect } from "react"
import { Building2, ChevronDown, Check, Plus, Crown, Shield, Users, Eye } from "lucide-react"

// =============================================================================
// Types
// =============================================================================

/** Base role from authorization system */
export type BaseRole = "owner" | "admin" | "member" | "viewer"

/** Organization with optional role info */
export interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency?: string
  /** User's role in this organization (from permissions API) */
  readonly role?: BaseRole
}

interface OrganizationSelectorProps {
  /** List of organizations the user has access to */
  readonly organizations: readonly Organization[]
  /** Currently selected organization */
  readonly currentOrganization?: Organization | null
  /** Whether selector is loading organizations */
  readonly loading?: boolean
  /** Compact mode for smaller displays */
  readonly compact?: boolean
}

// =============================================================================
// Role Badge Component
// =============================================================================

interface RoleBadgeProps {
  readonly role: BaseRole
  readonly size?: "sm" | "md"
}

const roleConfig: Record<BaseRole, { label: string; icon: typeof Crown; bgColor: string; textColor: string }> = {
  owner: { label: "Owner", icon: Crown, bgColor: "bg-amber-100", textColor: "text-amber-700" },
  admin: { label: "Admin", icon: Shield, bgColor: "bg-purple-100", textColor: "text-purple-700" },
  member: { label: "Member", icon: Users, bgColor: "bg-blue-100", textColor: "text-blue-700" },
  viewer: { label: "Viewer", icon: Eye, bgColor: "bg-gray-100", textColor: "text-gray-700" }
}

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const config = roleConfig[role]
  const Icon = config.icon

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.bgColor,
        config.textColor,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      )}
      data-testid={`role-badge-${role}`}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {config.label}
    </span>
  )
}

// =============================================================================
// OrganizationSelector Component
// =============================================================================

export function OrganizationSelector({
  organizations,
  currentOrganization,
  loading = false,
  compact = false
}: OrganizationSelectorProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target
      if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  const handleSelectOrganization = (org: Organization) => {
    setIsOpen(false)
    navigate({
      to: "/organizations/$organizationId",
      params: { organizationId: org.id }
    })
  }

  // Determine display text based on state
  const displayText = loading
    ? "Loading..."
    : currentOrganization?.name ?? "Select Organization"

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={clsx(
          "flex items-center gap-2 rounded-lg transition-colors",
          compact ? "px-2 py-1.5" : "px-3 py-2",
          isOpen ? "bg-gray-100" : "hover:bg-gray-100",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        data-testid="org-selector-button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Organization Icon */}
        <div
          className={clsx(
            "flex items-center justify-center rounded-lg bg-blue-100 text-blue-600",
            compact ? "h-6 w-6" : "h-8 w-8"
          )}
        >
          <Building2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </div>

        {/* Organization Name */}
        {!compact && (
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs text-gray-500 leading-none">Organization</span>
            <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
              {displayText}
            </span>
          </div>
        )}

        {/* Dropdown Arrow */}
        <ChevronDown
          className={clsx(
            "text-gray-500 transition-transform",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          role="listbox"
          data-testid="org-selector-dropdown"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Switch Organization
            </p>
          </div>

          {/* Organization List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {organizations.length === 0 ? (
              <div className="px-3 py-4 text-center" data-testid="org-selector-empty-list">
                <p className="text-sm text-gray-500">No organizations yet</p>
                <p className="mt-1 text-xs text-gray-400">
                  Create your first organization to get started
                </p>
              </div>
            ) : (
              organizations.map((org) => {
                const isSelected = currentOrganization?.id === org.id

                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrganization(org)}
                    className={clsx(
                      "flex items-center gap-3 w-full px-3 py-2 text-left transition-colors",
                      isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                    )}
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`org-selector-option-${org.id}`}
                  >
                    {/* Organization Icon */}
                    <div
                      className={clsx(
                        "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
                        isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                    </div>

                    {/* Organization Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          "text-sm font-medium truncate",
                          isSelected ? "text-blue-700" : "text-gray-900"
                        )}
                      >
                        {org.name}
                      </p>
                      {org.reportingCurrency && (
                        <p className="text-xs text-gray-500">{org.reportingCurrency}</p>
                      )}
                    </div>

                    {/* Selected Check */}
                    {isSelected && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer - Create New Organization */}
          <div className="border-t border-gray-100 px-1 py-1">
            <Link
              to="/organizations/new"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              data-testid="org-selector-create-new"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Organization</span>
            </Link>
          </div>

        </div>
      )}
    </div>
  )
}

// =============================================================================
// OrganizationBadge Component
// =============================================================================

interface OrganizationBadgeProps {
  /** Organization to display */
  readonly organization: Organization
  /** Whether to show currency */
  readonly showCurrency?: boolean
  /** Size variant */
  readonly size?: "sm" | "md"
}

export function OrganizationBadge({
  organization,
  showCurrency = false,
  size = "md"
}: OrganizationBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm"
  }

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-lg font-medium",
        sizeClasses[size]
      )}
      data-testid="org-badge"
    >
      <Building2 className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      <span className="truncate max-w-[200px]">{organization.name}</span>
      {showCurrency && organization.reportingCurrency && (
        <span className="text-blue-500">({organization.reportingCurrency})</span>
      )}
    </div>
  )
}
