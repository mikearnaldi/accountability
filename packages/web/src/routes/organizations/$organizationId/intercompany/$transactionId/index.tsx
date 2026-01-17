/**
 * Intercompany Transaction Detail Route
 *
 * Displays details of a single intercompany transaction with reconciliation status
 * and journal entry linking.
 *
 * Route: /organizations/:organizationId/intercompany/:transactionId
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { TransactionTypeBadge } from "@/components/intercompany/TransactionTypeBadge"
import { MatchingStatusBadge } from "@/components/intercompany/MatchingStatusBadge"
import { MatchingStatusModal } from "@/components/intercompany/MatchingStatusModal"
import { LinkJournalEntryModal } from "@/components/intercompany/LinkJournalEntryModal"
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Edit,
  Trash2,
  ArrowRight,
  RefreshCw,
  AlertTriangle
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

type MatchingStatus = IntercompanyTransaction["matchingStatus"]

// =============================================================================
// Server Functions
// =============================================================================

const fetchTransactionData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; transactionId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], transaction: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, transactionResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/intercompany-transactions/{id}", {
          params: { path: { id: data.transactionId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], transaction: null, error: "org_not_found" as const }
        }
        return { organization: null, companies: [], transaction: null, error: "failed" as const }
      }

      if (transactionResult.error) {
        if (typeof transactionResult.error === "object" && "status" in transactionResult.error && transactionResult.error.status === 404) {
          return { organization: orgResult.data, companies: companiesResult.data?.companies ?? [], transaction: null, error: "transaction_not_found" as const }
        }
        return { organization: orgResult.data, companies: companiesResult.data?.companies ?? [], transaction: null, error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        transaction: transactionResult.data,
        error: null
      }
    } catch {
      return { organization: null, companies: [], transaction: null, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/intercompany/$transactionId/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/intercompany/${params.transactionId}`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchTransactionData({
      data: { organizationId: params.organizationId, transactionId: params.transactionId }
    })

    if (result.error === "org_not_found") {
      throw new Error("Organization not found")
    }

    if (result.error === "transaction_not_found") {
      throw new Error("Transaction not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      transaction: result.transaction
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: IntercompanyTransactionDetailPage
})

// =============================================================================
// Page Component
// =============================================================================

function IntercompanyTransactionDetailPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const transaction = loaderData.transaction as IntercompanyTransaction | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Modal state
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showLinkFromModal, setShowLinkFromModal] = useState(false)
  const [showLinkToModal, setShowLinkToModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Company lookup
  const companyMap = useMemo(() => {
    const map = new Map<string, Company>()
    for (const company of companies) {
      map.set(company.id, company)
    }
    return map
  }, [companies])

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  if (!organization || !transaction) {
    return null
  }

  const fromCompany = companyMap.get(transaction.fromCompanyId)
  const toCompany = companyMap.get(transaction.toCompanyId)

  const breadcrumbItems = [
    {
      label: "Intercompany",
      href: `/organizations/${params.organizationId}/intercompany`
    },
    {
      label: `Transaction`,
      href: `/organizations/${params.organizationId}/intercompany/${transaction.id}`
    }
  ]

  // Format helpers
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const formatAmount = (amount: { value: string; currency: string }) => {
    const value = parseFloat(amount.value)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: amount.currency,
      minimumFractionDigits: 2
    }).format(value)
  }

  // Update matching status
  const handleUpdateStatus = async (status: MatchingStatus, explanation: string | null) => {
    setIsSubmitting(true)
    try {
      await api.POST("/api/v1/intercompany-transactions/{id}/matching-status", {
        params: { path: { id: transaction.id } },
        body: {
          matchingStatus: status,
          varianceExplanation: explanation
        }
      })
      await router.invalidate()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Link journal entries
  const handleLinkFromJournalEntry = async (journalEntryId: string) => {
    setIsSubmitting(true)
    try {
      await api.POST("/api/v1/intercompany-transactions/{id}/link-from-journal-entry", {
        params: { path: { id: transaction.id } },
        body: { journalEntryId }
      })
      await router.invalidate()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLinkToJournalEntry = async (journalEntryId: string) => {
    setIsSubmitting(true)
    try {
      await api.POST("/api/v1/intercompany-transactions/{id}/link-to-journal-entry", {
        params: { path: { id: transaction.id } },
        body: { journalEntryId }
      })
      await router.invalidate()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete transaction
  const handleDelete = async () => {
    setIsSubmitting(true)
    setDeleteError(null)
    try {
      const { error } = await api.DELETE("/api/v1/intercompany-transactions/{id}", {
        params: { path: { id: transaction.id } }
      })

      if (error) {
        let errorMessage = "Failed to delete transaction"
        if (typeof error === "object" && error !== null) {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
        }
        setDeleteError(errorMessage)
        return
      }

      await router.navigate({
        to: `/organizations/${params.organizationId}/intercompany`
      })
    } catch {
      setDeleteError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if transaction can be deleted
  const canDelete = transaction.matchingStatus !== "Matched"

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="intercompany-transaction-detail-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/intercompany"
            params={{ organizationId: params.organizationId }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Intercompany Transactions
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                  Intercompany Transaction
                </h1>
                <MatchingStatusBadge status={transaction.matchingStatus} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(transaction.transactionDate)}
                </span>
                <TransactionTypeBadge type={transaction.transactionType} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/organizations/$organizationId/intercompany/$transactionId/edit"
                params={{
                  organizationId: params.organizationId,
                  transactionId: transaction.id
                }}
              >
                <Button variant="secondary" icon={<Edit className="h-4 w-4" />}>
                  Edit
                </Button>
              </Link>
              <Button
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!canDelete}
                title={canDelete ? "Delete transaction" : "Cannot delete matched transactions"}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Transaction Details Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h2>

            {/* Companies */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between gap-4">
                <div className="text-center flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">From</p>
                  <div className="flex items-center justify-center gap-2">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {fromCompany?.name ?? "Unknown"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Seller / Lender</p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
                <div className="text-center flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">To</p>
                  <div className="flex items-center justify-center gap-2">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {toCompany?.name ?? "Unknown"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Buyer / Borrower</p>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="text-xl font-semibold text-gray-900">
                  {formatAmount(transaction.amount)}
                </p>
              </div>
            </div>

            {/* Description */}
            {transaction.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-gray-900">{transaction.description}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="pt-4 border-t border-gray-200 text-sm text-gray-500">
              <p>Created: {formatDateTime(transaction.createdAt)}</p>
              <p>Updated: {formatDateTime(transaction.updatedAt)}</p>
            </div>
          </div>

          {/* Reconciliation Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Reconciliation</h2>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={() => setShowStatusModal(true)}
              >
                Update Status
              </Button>
            </div>

            {/* Current Status */}
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">Current Status</p>
              <MatchingStatusBadge status={transaction.matchingStatus} />

              {/* Variance Info */}
              {transaction.varianceAmount && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Variance</span>
                  </div>
                  <p className="text-lg font-semibold text-yellow-900 mt-1">
                    {formatAmount(transaction.varianceAmount)}
                  </p>
                  {transaction.varianceExplanation && (
                    <p className="text-sm text-yellow-700 mt-2">
                      {transaction.varianceExplanation}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Journal Entries */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Journal Entries</h3>

              {/* From Side */}
              <div className="mb-4 p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">From Side ({fromCompany?.name})</p>
                    {transaction.fromJournalEntryId ? (
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <FileText className="h-4 w-4" />
                        Linked
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1">Not linked</p>
                    )}
                  </div>
                  {transaction.fromJournalEntryId ? (
                    <Link
                      to="/organizations/$organizationId/companies/$companyId/journal-entries/$entryId"
                      params={{
                        organizationId: params.organizationId,
                        companyId: transaction.fromCompanyId,
                        entryId: transaction.fromJournalEntryId
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      View Entry
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<LinkIcon className="h-4 w-4" />}
                      onClick={() => setShowLinkFromModal(true)}
                    >
                      Link Entry
                    </Button>
                  )}
                </div>
              </div>

              {/* To Side */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">To Side ({toCompany?.name})</p>
                    {transaction.toJournalEntryId ? (
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <FileText className="h-4 w-4" />
                        Linked
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1">Not linked</p>
                    )}
                  </div>
                  {transaction.toJournalEntryId ? (
                    <Link
                      to="/organizations/$organizationId/companies/$companyId/journal-entries/$entryId"
                      params={{
                        organizationId: params.organizationId,
                        companyId: transaction.toCompanyId,
                        entryId: transaction.toJournalEntryId
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      View Entry
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<LinkIcon className="h-4 w-4" />}
                      onClick={() => setShowLinkToModal(true)}
                    >
                      Link Entry
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <MatchingStatusModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          onSubmit={handleUpdateStatus}
          currentStatus={transaction.matchingStatus}
          isSubmitting={isSubmitting}
        />

        {fromCompany && (
          <LinkJournalEntryModal
            isOpen={showLinkFromModal}
            onClose={() => setShowLinkFromModal(false)}
            onSubmit={handleLinkFromJournalEntry}
            organizationId={params.organizationId}
            companyId={transaction.fromCompanyId}
            companyName={fromCompany.name}
            side="from"
            isSubmitting={isSubmitting}
          />
        )}

        {toCompany && (
          <LinkJournalEntryModal
            isOpen={showLinkToModal}
            onClose={() => setShowLinkToModal(false)}
            onSubmit={handleLinkToJournalEntry}
            organizationId={params.organizationId}
            companyId={transaction.toCompanyId}
            companyName={toCompany.name}
            side="to"
            isSubmitting={isSubmitting}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
            <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Delete Transaction</h3>
              <p className="mt-2 text-gray-600">
                Are you sure you want to delete this intercompany transaction? This action cannot be undone.
              </p>

              {deleteError && (
                <p className="mt-4 text-sm text-red-600">{deleteError}</p>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
