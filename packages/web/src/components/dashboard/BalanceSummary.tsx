/**
 * BalanceSummary component
 *
 * Quick balance summary per company.
 * Features:
 * - Company name with currency
 * - Total assets, liabilities, equity
 * - Loading skeleton state
 * - Empty state
 * - Data-testid attributes for E2E testing
 */

import { Link } from "@tanstack/react-router"
import { Building2, ArrowRight } from "lucide-react"

interface CompanyBalance {
  readonly id: string
  readonly name: string
  readonly currency: string
  readonly totalAssets: number
  readonly totalLiabilities: number
  readonly totalEquity: number
  readonly organizationId: string
}

interface BalanceSummaryProps {
  /** List of company balances */
  readonly companies: readonly CompanyBalance[]
  /** Whether the component is in loading state */
  readonly isLoading?: boolean
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function BalanceSummary({
  companies,
  isLoading = false
}: BalanceSummaryProps) {
  if (isLoading) {
    return <BalanceSummarySkeleton />
  }

  if (companies.length === 0) {
    return <BalanceSummaryEmpty />
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid="balance-summary"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Balance by Company
        </h3>
      </div>

      <div className="divide-y divide-gray-100">
        {companies.slice(0, 5).map((company) => (
          <Link
            key={company.id}
            to="/organizations/$organizationId/companies/$companyId"
            params={{
              organizationId: company.organizationId,
              companyId: company.id
            }}
            className="block px-6 py-4 hover:bg-gray-50 transition-colors group"
            data-testid={`balance-company-${company.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{company.name}</p>
                  <p className="text-sm text-gray-500">{company.currency}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Assets</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(company.totalAssets, company.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Liabilities</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(company.totalLiabilities, company.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Equity</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(company.totalEquity, company.currency)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {companies.length > 5 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <Link
            to="/organizations"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
            data-testid="balance-view-all"
          >
            View all {companies.length} companies
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * Loading skeleton for BalanceSummary
 */
export function BalanceSummarySkeleton() {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse"
      data-testid="balance-summary-skeleton"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="h-6 w-40 bg-gray-200 rounded" />
      </div>

      <div className="divide-y divide-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 rounded-lg" />
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="mt-1 h-3 w-12 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {[1, 2, 3].map((j) => (
                <div key={j}>
                  <div className="h-3 w-12 bg-gray-200 rounded" />
                  <div className="mt-1 h-4 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Empty state for BalanceSummary
 */
export function BalanceSummaryEmpty() {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid="balance-summary-empty"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Balance by Company
        </h3>
      </div>

      <div className="px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Building2 className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-gray-500">No companies yet</p>
        <p className="mt-1 text-sm text-gray-400">
          Create a company to see balance summaries
        </p>
        <Link
          to="/organizations"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          data-testid="balance-create-company"
        >
          Create your first company
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
