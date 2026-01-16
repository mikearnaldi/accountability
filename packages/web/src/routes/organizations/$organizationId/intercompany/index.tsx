/**
 * Intercompany Transactions Route
 *
 * Displays a list of intercompany transactions with filtering and reconciliation status.
 *
 * Route: /organizations/:organizationId/intercompany
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { Tooltip } from "@/components/ui/Tooltip"
import { TransactionTypeBadge } from "@/components/intercompany/TransactionTypeBadge"
import { MatchingStatusBadge } from "@/components/intercompany/MatchingStatusBadge"
import {
  ArrowLeftRight,
  Plus,
  Building2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  FileText,
  ArrowRight,
  Filter,
  X
} from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface Company {
  readonly id: string
  readonly name: string
  readonly functionalCurrency: string
}

interface IntercompanyTransaction {
  readonly id: string
  readonly fromCompanyId: string
  readonly toCompanyId: string
  readonly transactionType: "SalePurchase" | "Loan" | "ManagementFee" | "Dividend" | "CapitalContribution" | "CostAllocation" | "Royalty"
  readonly transactionDate: string
  readonly amount: {
    readonly value: string
    readonly currency: string
  }
  readonly matchingStatus: "Matched" | "Unmatched" | "PartiallyMatched" | "VarianceApproved"
  readonly fromJournalEntryId: string | null
  readonly toJournalEntryId: string | null
  readonly description: string | null
  readonly varianceAmount: { readonly value: string; readonly currency: string } | null
  readonly varianceExplanation: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

type TransactionType = IntercompanyTransaction["transactionType"]
type MatchingStatus = IntercompanyTransaction["matchingStatus"]

// =============================================================================
// Server Functions
// =============================================================================

const fetchIntercompanyData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], transactions: [], total: 0, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId: data.organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], transactions: [], total: 0, error: "not_found" as const }
        }
        return { organization: null, companies: [], transactions: [], total: 0, error: "failed" as const }
      }

      // Only fetch transactions if we have companies
      const companies = companiesResult.data?.companies ?? []
      if (companies.length === 0) {
        return {
          organization: orgResult.data,
          companies: [],
          transactions: [],
          total: 0,
          error: null
        }
      }

      // Fetch transactions for all companies in this organization
      // We'll filter by any company that belongs to this org
      const firstCompany = companies[0]
      const transactionsResult = await serverApi.GET("/api/v1/intercompany-transactions", {
        params: { query: { companyId: firstCompany.id, limit: "100" } },
        headers: { Authorization }
      })

      return {
        organization: orgResult.data,
        companies,
        transactions: transactionsResult.data?.transactions ?? [],
        total: transactionsResult.data?.total ?? 0,
        error: null
      }
    } catch {
      return { organization: null, companies: [], transactions: [], total: 0, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/intercompany/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/intercompany`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchIntercompanyData({ data: { organizationId: params.organizationId } })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      transactions: result.transactions,
      total: result.total
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: IntercompanyPage
})

// =============================================================================
// Page Component
// =============================================================================

function IntercompanyPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const transactions = loaderData.transactions as readonly IntercompanyTransaction[]
  const total = loaderData.total as number
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Filter state
  const [fromCompanyFilter, setFromCompanyFilter] = useState("")
  const [toCompanyFilter, setToCompanyFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState<TransactionType | "">("")
  const [statusFilter, setStatusFilter] = useState<MatchingStatus | "">("")
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false)

  // Create company lookup map
  const companyMap = useMemo(() => {
    const map = new Map<string, Company>()
    for (const company of companies) {
      map.set(company.id, company)
    }
    return map
  }, [companies])

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (fromCompanyFilter && tx.fromCompanyId !== fromCompanyFilter) return false
      if (toCompanyFilter && tx.toCompanyId !== toCompanyFilter) return false
      if (typeFilter && tx.transactionType !== typeFilter) return false
      if (statusFilter && tx.matchingStatus !== statusFilter) return false
      if (showUnmatchedOnly && tx.matchingStatus !== "Unmatched" && tx.matchingStatus !== "PartiallyMatched") return false
      return true
    })
  }, [transactions, fromCompanyFilter, toCompanyFilter, typeFilter, statusFilter, showUnmatchedOnly])

  // Clear filters
  const hasFilters = fromCompanyFilter || toCompanyFilter || typeFilter || statusFilter || showUnmatchedOnly
  const clearFilters = () => {
    setFromCompanyFilter("")
    setToCompanyFilter("")
    setTypeFilter("")
    setStatusFilter("")
    setShowUnmatchedOnly(false)
  }

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Intercompany",
      href: `/organizations/${params.organizationId}/intercompany`
    }
  ]

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  // Format currency amount
  const formatAmount = (amount: { value: string; currency: string }) => {
    const value = parseFloat(amount.value)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: amount.currency,
      minimumFractionDigits: 2
    }).format(value)
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }

  // Transaction type options
  const transactionTypeOptions = [
    { value: "", label: "All Types" },
    { value: "SalePurchase", label: "Sale/Purchase" },
    { value: "Loan", label: "Loan" },
    { value: "ManagementFee", label: "Management Fee" },
    { value: "Dividend", label: "Dividend" },
    { value: "CapitalContribution", label: "Capital Contribution" },
    { value: "CostAllocation", label: "Cost Allocation" },
    { value: "Royalty", label: "Royalty" }
  ]

  // Matching status options
  const matchingStatusOptions = [
    { value: "", label: "All Statuses" },
    { value: "Matched", label: "Matched" },
    { value: "Unmatched", label: "Unmatched" },
    { value: "PartiallyMatched", label: "Partial Match" },
    { value: "VarianceApproved", label: "Variance Approved" }
  ]

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="intercompany-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Intercompany Transactions
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {total > 0
                  ? `${total} transaction${total !== 1 ? "s" : ""} between companies`
                  : "Track and reconcile transactions between related companies"}
              </p>
            </div>

            {companies.length > 1 && transactions.length > 0 && (
              <Link
                to="/organizations/$organizationId/intercompany/new"
                params={{ organizationId: params.organizationId }}
              >
                <Button icon={<Plus className="h-4 w-4" />} data-testid="create-transaction-button">
                  New Transaction
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Need at least 2 companies for intercompany transactions */}
        {companies.length < 2 ? (
          <div
            className="rounded-lg border border-gray-200 bg-white p-12 text-center"
            data-testid="no-companies-state"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Building2 className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              At least 2 companies required
            </h3>
            <p className="mt-2 max-w-md mx-auto text-gray-500">
              Intercompany transactions track financial activity between related companies.
              You need at least 2 companies in your organization to create intercompany transactions.
            </p>
            <div className="mt-6">
              <Link
                to="/organizations/$organizationId/companies/new"
                params={{ organizationId: params.organizationId }}
              >
                <Button icon={<Plus className="h-4 w-4" />}>
                  Add Company
                </Button>
              </Link>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState organizationId={params.organizationId} />
        ) : (
          <>
            {/* Filters */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Filter className="h-4 w-4" />
                  Filters
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Select
                    value={fromCompanyFilter}
                    onChange={(e) => setFromCompanyFilter(e.target.value)}
                    data-testid="filter-from-company"
                  >
                    <option value="">From Company (All)</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={toCompanyFilter}
                    onChange={(e) => setToCompanyFilter(e.target.value)}
                    data-testid="filter-to-company"
                  >
                    <option value="">To Company (All)</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={typeFilter}
                    onChange={(e) => {
                      const typeFilterLookup: Record<string, TransactionType | ""> = {
                        "": "",
                        SalePurchase: "SalePurchase",
                        Loan: "Loan",
                        ManagementFee: "ManagementFee",
                        Dividend: "Dividend",
                        CapitalContribution: "CapitalContribution",
                        CostAllocation: "CostAllocation",
                        Royalty: "Royalty"
                      }
                      const value = typeFilterLookup[e.target.value]
                      if (value !== undefined) {
                        setTypeFilter(value)
                      }
                    }}
                    data-testid="filter-type"
                  >
                    {transactionTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      const statusFilterLookup: Record<string, MatchingStatus | ""> = {
                        "": "",
                        Matched: "Matched",
                        Unmatched: "Unmatched",
                        PartiallyMatched: "PartiallyMatched",
                        VarianceApproved: "VarianceApproved"
                      }
                      const value = statusFilterLookup[e.target.value]
                      if (value !== undefined) {
                        setStatusFilter(value)
                      }
                    }}
                    data-testid="filter-status"
                  >
                    {matchingStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={showUnmatchedOnly}
                    onChange={(e) => setShowUnmatchedOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-testid="filter-unmatched-only"
                  />
                  Needs attention
                </label>

                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                    data-testid="clear-filters"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Results count */}
            {hasFilters && (
              <p className="mb-4 text-sm text-gray-500">
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </p>
            )}

            {/* Transactions Table */}
            {filteredTransactions.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" data-testid="no-filtered-results">
                <p className="text-gray-500">No transactions match your filters.</p>
                <button
                  onClick={clearFilters}
                  className="mt-2 text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden" data-testid="transactions-table">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          <Tooltip content="Date when the transaction occurred">
                            <span className="cursor-help border-b border-dotted border-gray-400">Date</span>
                          </Tooltip>
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          <Tooltip content="Classification of the intercompany transaction">
                            <span className="cursor-help border-b border-dotted border-gray-400">Type</span>
                          </Tooltip>
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          <Tooltip content="Companies involved in the transaction (seller/lender → buyer/borrower)">
                            <span className="cursor-help border-b border-dotted border-gray-400">Companies</span>
                          </Tooltip>
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                          <Tooltip content="Transaction amount with currency">
                            <span className="cursor-help border-b border-dotted border-gray-400">Amount</span>
                          </Tooltip>
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          <Tooltip content="Reconciliation status between the two companies">
                            <span className="cursor-help border-b border-dotted border-gray-400">Status</span>
                          </Tooltip>
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                          <Tooltip content="Whether journal entries are linked on each side">
                            <span className="cursor-help border-b border-dotted border-gray-400">JEs</span>
                          </Tooltip>
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredTransactions.map((tx) => {
                        const fromCompany = companyMap.get(tx.fromCompanyId)
                        const toCompany = companyMap.get(tx.toCompanyId)

                        return (
                          <tr
                            key={tx.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => router.navigate({
                              to: `/organizations/${params.organizationId}/intercompany/${tx.id}`
                            })}
                            data-testid={`transaction-row-${tx.id}`}
                          >
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                              {formatDate(tx.transactionDate)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <TransactionTypeBadge type={tx.transactionType} />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-gray-900 truncate max-w-[120px]" title={fromCompany?.name}>
                                  {fromCompany?.name ?? "Unknown"}
                                </span>
                                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate max-w-[120px]" title={toCompany?.name}>
                                  {toCompany?.name ?? "Unknown"}
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                              {formatAmount(tx.amount)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <MatchingStatusBadge status={tx.matchingStatus} />
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Tooltip content={tx.fromJournalEntryId ? "From JE linked" : "From JE not linked"}>
                                  <FileText
                                    className={`h-4 w-4 ${
                                      tx.fromJournalEntryId ? "text-green-500" : "text-gray-300"
                                    }`}
                                  />
                                </Tooltip>
                                <Tooltip content={tx.toJournalEntryId ? "To JE linked" : "To JE not linked"}>
                                  <FileText
                                    className={`h-4 w-4 ${
                                      tx.toJournalEntryId ? "text-green-500" : "text-gray-300"
                                    }`}
                                  />
                                </Tooltip>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

interface FeatureCardProps {
  readonly icon: typeof ArrowLeftRight
  readonly title: string
  readonly description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <Icon className="h-5 w-5 text-gray-600" />
      <h4 className="mt-2 font-medium text-gray-900">{title}</h4>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}

interface EmptyStateProps {
  readonly organizationId: string
}

function EmptyState({ organizationId }: EmptyStateProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-12 text-center"
      data-testid="empty-state"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
        <ArrowLeftRight className="h-8 w-8 text-orange-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">No intercompany transactions</h3>
      <p className="mt-2 max-w-md mx-auto text-gray-500">
        Intercompany transactions track financial activity between related companies within your organization.
        This helps ensure proper elimination during consolidation and maintains accurate financial records.
      </p>

      <div className="mt-6">
        <Link
          to="/organizations/$organizationId/intercompany/new"
          params={{ organizationId }}
        >
          <Button icon={<Plus className="h-4 w-4" />} data-testid="create-first-transaction-button">
            Create First Transaction
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto text-left">
        <FeatureCard
          icon={Building2}
          title="Cross-Company"
          description="Record transactions between any companies in your organization"
        />
        <FeatureCard
          icon={CheckCircle}
          title="Auto-Reconciliation"
          description="Automatic matching of intercompany receivables and payables"
        />
        <FeatureCard
          icon={AlertCircle}
          title="Discrepancy Alerts"
          description="Notifications when intercompany balances don't match"
        />
      </div>
    </div>
  )
}
