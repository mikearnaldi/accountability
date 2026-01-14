/**
 * CompanySelector Component
 *
 * A dropdown component for global company context switching.
 * Features:
 * - Shows currently selected company name
 * - Dropdown lists all companies grouped by organization
 * - Selection updates selectedCompanyAtom
 * - Persisted to localStorage for session continuity
 * - Updates URL context when switching
 */

import { useNavigate } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Option from "effect/Option"
import * as React from "react"
import {
  allCompaniesGroupedAtom,
  selectedCompanyIdAtom,
  selectedCompanyAtom,
  getCompanyContextPath
} from "../atoms/companies.ts"

// =============================================================================
// Icons
// =============================================================================

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  )
}

function BuildingOfficeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5V21m3-18h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  )
}

// =============================================================================
// CompanySelector Component
// =============================================================================

interface CompanySelectorProps {
  /**
   * Whether to navigate to the company page on selection.
   * Defaults to true.
   */
  readonly navigateOnSelect?: boolean
}

export function CompanySelector({ navigateOnSelect = true }: CompanySelectorProps) {
  const navigate = useNavigate()
  const groupedResult = useAtomValue(allCompaniesGroupedAtom)
  const selectedCompany = useAtomValue(selectedCompanyAtom)
  const [, setSelectedCompanyId] = useAtom(selectedCompanyIdAtom)

  // Dropdown state
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target
      if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Close dropdown on escape key
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  // Handle company selection
  const handleSelectCompany = React.useCallback(
    (companyId: string, organizationId: string) => {
      setSelectedCompanyId(companyId)
      setIsOpen(false)

      if (navigateOnSelect) {
        const path = getCompanyContextPath(companyId, organizationId)
        navigate({ to: path })
      }
    },
    [setSelectedCompanyId, navigateOnSelect, navigate]
  )

  // Loading state
  const isLoading = Result.isInitial(groupedResult) || Result.isWaiting(groupedResult)

  // Get grouped companies from result
  const groupedCompanies = Result.isSuccess(groupedResult) ? groupedResult.value : []

  // Check if there are any companies at all
  const hasCompanies = groupedCompanies.some((group) => group.companies.length > 0)

  // Get current selection info
  const currentCompany = Option.isSome(selectedCompany) ? selectedCompany.value : null
  const buttonLabel = currentCompany
    ? currentCompany.company.name
    : "Select Company"

  // Don't render if there are no companies
  if (!isLoading && !hasCompanies) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef} data-testid="company-selector">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={[
          "flex items-center gap-2 rounded-lg px-3 py-2",
          "bg-white border border-gray-200",
          "text-gray-700 hover:bg-gray-50",
          "transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "min-w-[180px] max-w-[280px]"
        ].join(" ")}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid="company-selector-button"
      >
        {/* Company Icon */}
        <BuildingOfficeIcon className="h-5 w-5 flex-shrink-0 text-gray-400" />

        {/* Company Name */}
        <span className="flex-1 truncate text-sm font-medium text-left">
          {isLoading ? "Loading..." : buttonLabel}
        </span>

        {/* Dropdown Indicator */}
        <ChevronDownIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isLoading && (
        <div
          className={[
            "absolute left-0 mt-2 w-72",
            "rounded-lg bg-white shadow-lg",
            "border border-gray-200",
            "py-1 z-50",
            "max-h-96 overflow-auto"
          ].join(" ")}
          role="listbox"
          aria-label="Select a company"
          data-testid="company-selector-dropdown"
        >
          {groupedCompanies.map((group) => {
            if (group.companies.length === 0) {
              return null
            }

            return (
              <div key={group.organization.id}>
                {/* Organization Header */}
                <div
                  className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100"
                  data-testid={`company-selector-org-${group.organization.id}`}
                >
                  {group.organization.name}
                </div>

                {/* Companies in this Organization */}
                {group.companies.map((company) => {
                  const isSelected = currentCompany?.company.id === company.id

                  return (
                    <button
                      key={company.id}
                      onClick={() => handleSelectCompany(company.id, group.organization.id)}
                      className={[
                        "flex w-full items-center gap-3 px-3 py-2",
                        "text-sm text-left",
                        "hover:bg-blue-50",
                        "transition-colors duration-200",
                        isSelected ? "bg-blue-50 text-blue-700" : "text-gray-700"
                      ].join(" ")}
                      role="option"
                      aria-selected={isSelected}
                      data-testid={`company-selector-option-${company.id}`}
                    >
                      {/* Company Icon */}
                      <BuildingOfficeIcon
                        className={[
                          "h-5 w-5 flex-shrink-0",
                          isSelected ? "text-blue-600" : "text-gray-400"
                        ].join(" ")}
                      />

                      {/* Company Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{company.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {company.legalName} - {company.functionalCurrency}
                        </div>
                      </div>

                      {/* Selected Indicator */}
                      {isSelected && (
                        <CheckIcon className="h-5 w-5 flex-shrink-0 text-blue-600" />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Empty state - all orgs but no companies */}
          {!hasCompanies && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No companies available
            </div>
          )}
        </div>
      )}
    </div>
  )
}
