/**
 * OrganizationCard Component
 *
 * Displays an organization in a card format with:
 * - Organization name
 * - Reporting currency
 * - Company count
 * - Click to navigate to organization details
 */

import { Link } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import type { Organization } from "@accountability/core/Domains/Organization"
import { organizationCompanyCountFamily } from "../atoms/organizations.ts"

interface OrganizationCardProps {
  /**
   * The organization to display
   */
  readonly organization: Organization
}

/**
 * BuildingIcon - Simple building SVG icon
 */
function BuildingIcon({ className }: { className?: string }) {
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
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  )
}

/**
 * CompanyCountBadge - Shows the number of companies in an organization
 */
function CompanyCountBadge({ organizationId }: { organizationId: string }) {
  const count = useAtomValue(organizationCompanyCountFamily(organizationId))

  return (
    <span
      className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
      data-testid="organization-company-count"
    >
      {count} {count === 1 ? "company" : "companies"}
    </span>
  )
}

/**
 * OrganizationCard - Displays an organization in a card format
 *
 * Features:
 * - Shows organization name and reporting currency
 * - Displays company count badge
 * - Entire card is clickable to navigate to details
 * - Hover and focus states for accessibility
 *
 * Usage:
 * ```tsx
 * <OrganizationCard organization={org} />
 * ```
 */
export function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <Link
      to="/organizations/$id"
      params={{ id: organization.id }}
      className="block"
      data-testid={`organization-card-${organization.id}`}
    >
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <BuildingIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3
                className="text-lg font-semibold text-gray-900"
                data-testid={`organization-name-${organization.id}`}
              >
                {organization.name}
              </h3>
              <p
                className="text-sm text-gray-500"
                data-testid={`organization-currency-${organization.id}`}
              >
                {organization.reportingCurrency}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          <CompanyCountBadge organizationId={organization.id} />
          <span className="text-sm text-gray-400">
            Click to view details →
          </span>
        </div>
      </div>
    </Link>
  )
}
