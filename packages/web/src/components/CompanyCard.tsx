/**
 * CompanyCard Component
 *
 * Displays a company in a card format with:
 * - Company name and legal name
 * - Functional currency
 * - Jurisdiction
 * - Active/inactive status
 * - Click to navigate to company details
 */

import { Link } from "@tanstack/react-router"
import type { Company } from "@accountability/core/Domains/Company"

interface CompanyCardProps {
  /**
   * The company to display
   */
  readonly company: Company
  /**
   * The organization ID this company belongs to (for navigation)
   */
  readonly organizationId: string
}

/**
 * BuildingOfficeIcon - Building office SVG icon
 */
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

/**
 * CompanyCard - Displays a company in a card format
 *
 * Features:
 * - Shows company name, legal name, currency, and jurisdiction
 * - Displays active/inactive status badge
 * - Entire card is clickable to navigate to details
 * - Hover and focus states for accessibility
 *
 * Usage:
 * ```tsx
 * <CompanyCard company={company} organizationId={orgId} />
 * ```
 */
export function CompanyCard({ company, organizationId }: CompanyCardProps) {
  return (
    <Link
      to="/organizations/$organizationId/companies/$companyId"
      params={{ organizationId, companyId: company.id }}
      className="block"
      data-testid={`company-card-${company.id}`}
    >
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-green-300 hover:shadow-md focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <BuildingOfficeIcon className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <h3
                className="truncate text-lg font-semibold text-gray-900"
                data-testid={`company-name-${company.id}`}
              >
                {company.name}
              </h3>
              <p
                className="truncate text-sm text-gray-500"
                data-testid={`company-legal-name-${company.id}`}
              >
                {company.legalName}
              </p>
            </div>
          </div>
          {/* Status badge */}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              company.isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
            data-testid={`company-status-${company.id}`}
          >
            {company.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span
              className="inline-flex items-center gap-1"
              data-testid={`company-currency-${company.id}`}
            >
              <span className="font-medium">{company.functionalCurrency}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span data-testid={`company-jurisdiction-${company.id}`}>
              {company.jurisdiction}
            </span>
          </div>
          <span className="text-sm text-gray-400">
            View details →
          </span>
        </div>
      </div>
    </Link>
  )
}
