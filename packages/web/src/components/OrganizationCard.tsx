/**
 * OrganizationCard Component
 *
 * A polished organization card with:
 * - Elegant gradient icon background
 * - Hover effects with shadow and border
 * - Company count badge
 * - Smooth transitions
 */

import { Link } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import type { Organization } from "@accountability/core/Domains/Organization"
import { organizationCompanyCountFamily } from "../atoms/organizations.ts"
import { Badge } from "./ui/Badge.tsx"

interface OrganizationCardProps {
  readonly organization: Organization
}

function BuildingIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5V21m3-18h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75" />
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

function CompanyCountBadge({ organizationId }: { readonly organizationId: string }) {
  const count = useAtomValue(organizationCompanyCountFamily(organizationId))

  return (
    <Badge variant="indigo" data-testid="organization-company-count">
      {count} {count === 1 ? "company" : "companies"}
    </Badge>
  )
}

export function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <Link
      to="/organizations/$id"
      params={{ id: organization.id }}
      className="group block"
      data-testid={`organization-card-${organization.id}`}
    >
      <div className="
        relative overflow-hidden
        rounded-xl border border-gray-200 bg-white
        p-6 shadow-sm
        transition-all duration-300 ease-out
        hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50
        focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2
      ">
        {/* Subtle gradient decoration */}
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-50 to-transparent opacity-80" />

        {/* Header */}
        <div className="relative flex items-start gap-4">
          <div className="
            flex h-12 w-12 flex-shrink-0 items-center justify-center
            rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600
            text-white shadow-lg shadow-indigo-200
            transition-transform duration-300 group-hover:scale-105
          ">
            <BuildingIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="text-lg font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate"
              data-testid={`organization-name-${organization.id}`}
            >
              {organization.name}
            </h3>
            <p
              className="mt-0.5 text-sm text-gray-500"
              data-testid={`organization-currency-${organization.id}`}
            >
              {organization.reportingCurrency}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
          <CompanyCountBadge organizationId={organization.id} />
          <span className="
            flex items-center gap-1.5 text-sm text-gray-400
            transition-all duration-300
            group-hover:text-indigo-600 group-hover:gap-2
          ">
            View details
            <ArrowRightIcon />
          </span>
        </div>
      </div>
    </Link>
  )
}
