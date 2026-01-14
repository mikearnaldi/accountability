/**
 * CompanyCard Component
 *
 * A polished company card with:
 * - Elegant gradient icon background
 * - Hover effects with shadow and border
 * - Status badge
 * - Smooth transitions
 */

import { Link } from "@tanstack/react-router"
import type { Company } from "@accountability/core/Domains/Company"
import { Badge } from "./ui/Badge.tsx"

interface CompanyCardProps {
  readonly company: Company
  readonly organizationId: string
}

function BuildingOfficeIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}

export function CompanyCard({ company, organizationId }: CompanyCardProps) {
  return (
    <Link
      to="/organizations/$organizationId/companies/$companyId"
      params={{ organizationId, companyId: company.id }}
      className="group block"
      data-testid={`company-card-${company.id}`}
    >
      <div className="
        relative overflow-hidden
        rounded-xl border border-gray-200 bg-white
        p-6 shadow-sm
        transition-all duration-300 ease-out
        hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50
        focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2
      ">
        {/* Subtle gradient decoration */}
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-50 to-transparent opacity-80" />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="
              flex h-12 w-12 flex-shrink-0 items-center justify-center
              rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600
              text-white shadow-lg shadow-emerald-200
              transition-transform duration-300 group-hover:scale-105
            ">
              <BuildingOfficeIcon />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="text-lg font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors truncate"
                data-testid={`company-name-${company.id}`}
              >
                {company.name}
              </h3>
              <p
                className="mt-0.5 text-sm text-gray-500 truncate"
                data-testid={`company-legal-name-${company.id}`}
              >
                {company.legalName}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <Badge
            variant={company.isActive ? "green" : "gray"}
            dot
            data-testid={`company-status-${company.id}`}
          >
            {company.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Footer */}
        <div className="relative mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span
              className="font-medium text-gray-700"
              data-testid={`company-currency-${company.id}`}
            >
              {company.functionalCurrency}
            </span>
            <span className="text-gray-300">|</span>
            <span data-testid={`company-jurisdiction-${company.id}`}>
              {company.jurisdiction}
            </span>
          </div>
          <span className="
            flex items-center gap-1.5 text-sm text-gray-400
            transition-all duration-300
            group-hover:text-emerald-600 group-hover:gap-2
          ">
            View details
            <ArrowRightIcon />
          </span>
        </div>
      </div>
    </Link>
  )
}
