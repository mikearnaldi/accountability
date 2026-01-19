/**
 * Journal Entry Detail Page
 *
 * SSR page displaying journal entry details with workflow actions:
 * - Header: Entry #, Date, Reference, Type, Status badge
 * - Metadata: Created by, Created at, Posted by, Posted at
 * - Line items table (read-only for non-draft)
 * - Workflow buttons by status:
 *   - Draft: Edit, Submit for Approval, Delete
 *   - PendingApproval: Approve, Reject (with reason)
 *   - Approved: Post
 *   - Posted: Reverse (creates reversing entry)
 *   - Reversed: View only, link to reversing entry
 */

import { createFileRoute, redirect, Link, useRouter, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { clsx } from "clsx"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Tooltip } from "@/components/ui/Tooltip"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { usePermissions } from "@/hooks/usePermissions"

// =============================================================================
// Types (extracted from API response schema)
// =============================================================================

type JournalEntryStatus = "Draft" | "PendingApproval" | "Approved" | "Posted" | "Reversed"
type JournalEntryType = "Standard" | "Adjusting" | "Closing" | "Opening" | "Reversing" | "Recurring" | "Intercompany" | "Revaluation" | "Elimination" | "System"

interface LocalDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface Timestamp {
  readonly epochMillis: number
}

interface FiscalPeriodRef {
  readonly year: number
  readonly period: number
}

interface MonetaryAmount {
  readonly amount: string
  readonly currency: string
}

interface JournalEntry {
  readonly id: string
  readonly companyId: string
  readonly entryNumber: string | null
  readonly referenceNumber: string | null
  readonly description: string
  readonly transactionDate: LocalDate
  readonly postingDate: LocalDate | null
  readonly documentDate: LocalDate | null
  readonly fiscalPeriod: FiscalPeriodRef
  readonly entryType: JournalEntryType
  readonly sourceModule: string
  readonly sourceDocumentRef: string | null
  readonly isMultiCurrency: boolean
  readonly status: JournalEntryStatus
  readonly isReversing: boolean
  readonly reversedEntryId: string | null
  readonly reversingEntryId: string | null
  readonly createdBy: string
  readonly createdAt: Timestamp
  readonly postedBy: string | null
  readonly postedAt: Timestamp | null
}

interface JournalEntryLine {
  readonly id: string
  readonly journalEntryId: string
  readonly lineNumber: number
  readonly accountId: string
  readonly debitAmount: MonetaryAmount | null
  readonly creditAmount: MonetaryAmount | null
  readonly functionalCurrencyDebitAmount: MonetaryAmount | null
  readonly functionalCurrencyCreditAmount: MonetaryAmount | null
  readonly exchangeRate: string
  readonly memo: string | null
  readonly dimensions: Record<string, string> | null
  readonly intercompanyPartnerId: string | null
  readonly matchingLineId: string | null
}

interface Company {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly legalName: string
  readonly functionalCurrency: string
}

interface Organization {
  readonly id: string
  readonly name: string
}

interface Account {
  readonly id: string
  readonly accountNumber: string
  readonly name: string
  readonly accountType: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchJournalEntryData = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { entryId: string; companyId: string; organizationId: string }) => data
  )
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        entry: null,
        lines: [],
        company: null,
        organization: null,
        accounts: [],
        companies: [],
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      // Fetch journal entry, company, organization, accounts, and companies in parallel
      const [entryResult, companyResult, orgResult, accountsResult, companiesResult] = await Promise.all([
        serverApi.GET("/api/v1/journal-entries/{id}", {
          params: { path: { id: data.entryId }, query: { organizationId: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/accounts", {
          params: { query: { organizationId: data.organizationId, companyId: data.companyId, limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId: data.organizationId } },
          headers: { Authorization }
        })
      ])

      if (entryResult.error) {
        // Check for domain-specific JournalEntryNotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof entryResult.error === "object" && "_tag" in entryResult.error &&
            entryResult.error._tag === "JournalEntryNotFoundError") {
          return {
            entry: null,
            lines: [],
            company: null,
            organization: null,
            accounts: [],
            companies: [],
            error: "not_found" as const
          }
        }
        return {
          entry: null,
          lines: [],
          company: null,
          organization: null,
          accounts: [],
          companies: [],
          error: "failed" as const
        }
      }

      if (companyResult.error || orgResult.error) {
        return {
          entry: null,
          lines: [],
          company: null,
          organization: null,
          accounts: [],
          companies: [],
          error: "failed" as const
        }
      }

      return {
        entry: entryResult.data?.entry ?? null,
        lines: entryResult.data?.lines ?? [],
        company: companyResult.data,
        organization: orgResult.data,
        accounts: accountsResult.data?.accounts ?? [],
        companies: companiesResult.data?.companies ?? [],
        error: null
      }
    } catch {
      return {
        entry: null,
        lines: [],
        company: null,
        organization: null,
        accounts: [],
        companies: [],
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/journal-entries/$entryId/"
)({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/organizations"
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchJournalEntryData({
      data: {
        entryId: params.entryId,
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Journal entry not found")
    }

    return {
      entry: result.entry,
      lines: result.lines,
      company: result.company,
      organization: result.organization,
      accounts: result.accounts,
      companies: result.companies
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: JournalEntryDetailPage
})

// =============================================================================
// Types for sidebar
// =============================================================================

interface CompanyForSidebar {
  readonly id: string
  readonly name: string
}

// =============================================================================
// Page Component
// =============================================================================

function JournalEntryDetailPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const { canPerform } = usePermissions()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const entry = loaderData.entry as JournalEntry | null
  const lines = loaderData.lines as readonly JournalEntryLine[]
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  const accounts = loaderData.accounts as readonly Account[]
  const companies = loaderData.companies as readonly CompanyForSidebar[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  // Permission checks
  const canUpdateEntry = canPerform("journal_entry:update")
  const canPostEntry = canPerform("journal_entry:post")
  const canReverseEntry = canPerform("journal_entry:reverse")

  // Build account lookup map
  const accountMap = new Map<string, Account>()
  for (const account of accounts) {
    accountMap.set(account.id, account)
  }

  // Companies list for sidebar
  const companiesForSidebar = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies]
  )

  if (!entry || !company || !organization) {
    return null
  }

  // Breadcrumb items for journal entry detail page
  const breadcrumbItems = [
    {
      label: "Companies",
      href: `/organizations/${params.organizationId}/companies`
    },
    {
      label: company.name,
      href: `/organizations/${params.organizationId}/companies/${params.companyId}`
    },
    {
      label: "Journal Entries",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries`
    },
    {
      label: entry.referenceNumber ?? entry.entryNumber ?? "Entry",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries/${params.entryId}`
    }
  ]

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="journal-entry-detail-page">
        {/* Entry Header */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6" data-testid="journal-entry-header">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900" data-testid="journal-entry-description">
                  {entry.description}
                </h2>
                <StatusBadge status={entry.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {entry.entryNumber && (
                  <span data-testid="journal-entry-number">
                    Entry #{entry.entryNumber}
                  </span>
                )}
                {entry.referenceNumber && (
                  <span data-testid="journal-entry-reference">
                    Ref: {entry.referenceNumber}
                  </span>
                )}
                <span data-testid="journal-entry-date">
                  Date: {formatLocalDate(entry.transactionDate)}
                </span>
                <span data-testid="journal-entry-type-display">
                  Type: {entry.entryType}
                </span>
                <span data-testid="journal-entry-period">
                  Period: {entry.fiscalPeriod.year} P{entry.fiscalPeriod.period}
                </span>
              </div>
            </div>
            <EntryTypeBadge type={entry.entryType} />
          </div>

          {/* Reversal info */}
          {entry.isReversing && entry.reversedEntryId && (
            <div className="mt-4 rounded-md bg-orange-50 p-3" data-testid="reversal-info">
              <p className="text-sm text-orange-800">
                This entry reverses entry{" "}
                <Link
                  to="/organizations/$organizationId/companies/$companyId/journal-entries/$entryId"
                  params={{
                    organizationId: params.organizationId,
                    companyId: params.companyId,
                    entryId: entry.reversedEntryId
                  }}
                  className="font-medium underline hover:text-orange-900"
                  data-testid="reversed-entry-link"
                >
                  {entry.reversedEntryId}
                </Link>
              </p>
            </div>
          )}

          {entry.reversingEntryId && (
            <div className="mt-4 rounded-md bg-red-50 p-3" data-testid="reversed-by-info">
              <p className="text-sm text-red-800">
                This entry was reversed by entry{" "}
                <Link
                  to="/organizations/$organizationId/companies/$companyId/journal-entries/$entryId"
                  params={{
                    organizationId: params.organizationId,
                    companyId: params.companyId,
                    entryId: entry.reversingEntryId
                  }}
                  className="font-medium underline hover:text-red-900"
                  data-testid="reversing-entry-link"
                >
                  {entry.reversingEntryId}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="journal-entry-metadata">
            <h3 className="mb-4 font-medium text-gray-900">Entry Information</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Created By</dt>
                <dd className="text-gray-900" data-testid="created-by">
                  {entry.createdBy}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created At</dt>
                <dd className="text-gray-900" data-testid="created-at">
                  {formatTimestamp(entry.createdAt)}
                </dd>
              </div>
              {entry.postedBy && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Posted By</dt>
                  <dd className="text-gray-900" data-testid="posted-by">
                    {entry.postedBy}
                  </dd>
                </div>
              )}
              {entry.postedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Posted At</dt>
                  <dd className="text-gray-900" data-testid="posted-at">
                    {formatTimestamp(entry.postedAt)}
                  </dd>
                </div>
              )}
              {entry.postingDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Posting Date</dt>
                  <dd className="text-gray-900" data-testid="posting-date">
                    {formatLocalDate(entry.postingDate)}
                  </dd>
                </div>
              )}
              {entry.documentDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Document Date</dt>
                  <dd className="text-gray-900" data-testid="document-date">
                    {formatLocalDate(entry.documentDate)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Source Module</dt>
                <dd className="text-gray-900" data-testid="source-module">
                  {entry.sourceModule}
                </dd>
              </div>
              {entry.sourceDocumentRef && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Source Document</dt>
                  <dd className="text-gray-900" data-testid="source-document-ref">
                    {entry.sourceDocumentRef}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Workflow Actions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="workflow-actions-card">
            <h3 className="mb-4 font-medium text-gray-900">Actions</h3>
            <WorkflowActions
              entry={entry}
              organizationId={params.organizationId}
              companyId={params.companyId}
              canUpdateEntry={canUpdateEntry}
              canPostEntry={canPostEntry}
              canReverseEntry={canReverseEntry}
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="rounded-lg border border-gray-200 bg-white" data-testid="journal-entry-lines">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="font-medium text-gray-900">Line Items</h3>
          </div>
          <LineItemsTable lines={lines} accountMap={accountMap} currency={company.functionalCurrency} />
        </div>
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Workflow Actions Component
// =============================================================================

function WorkflowActions({
  entry,
  organizationId,
  companyId,
  canUpdateEntry,
  canPostEntry,
  canReverseEntry
}: {
  readonly entry: JournalEntry
  readonly organizationId: string
  readonly companyId: string
  readonly canUpdateEntry: boolean
  readonly canPostEntry: boolean
  readonly canReverseEntry: boolean
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReverseConfirm, setShowReverseConfirm] = useState(false)

  const handleSubmitForApproval = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/journal-entries/{id}/submit", {
        params: { path: { id: entry.id }, query: { organizationId } }
      })

      if (apiError) {
        const errorMsg = getErrorMessage(apiError, "Failed to submit for approval")
        throw new Error(errorMsg)
      }

      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit for approval")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprove = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/journal-entries/{id}/approve", {
        params: { path: { id: entry.id }, query: { organizationId } }
      })

      if (apiError) {
        throw new Error("Failed to approve")
      }

      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async (reason: string) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/journal-entries/{id}/reject", {
        params: { path: { id: entry.id }, query: { organizationId } },
        body: { reason: reason || null }
      })

      if (apiError) {
        throw new Error("Failed to reject")
      }

      setShowRejectModal(false)
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePost = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/journal-entries/{id}/post", {
        params: { path: { id: entry.id } },
        body: {
          organizationId,
          postedBy: entry.createdBy,
          postingDate: null
        }
      })

      if (apiError) {
        throw new Error("Failed to post")
      }

      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReverse = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const today = new Date()
      const reversalDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

      const { data, error: apiError } = await api.POST("/api/v1/journal-entries/{id}/reverse", {
        params: { path: { id: entry.id } },
        body: {
          organizationId,
          reversalDate,
          reversalDescription: null,
          reversedBy: entry.createdBy
        }
      })

      if (apiError || !data) {
        const errorMsg = getErrorMessage(apiError, "Failed to reverse")
        throw new Error(errorMsg)
      }

      setShowReverseConfirm(false)

      // Navigate to the new reversing entry
      navigate({
        to: "/organizations/$organizationId/companies/$companyId/journal-entries/$entryId",
        params: {
          organizationId,
          companyId,
          entryId: data.entry.id
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reverse")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.DELETE("/api/v1/journal-entries/{id}", {
        params: { path: { id: entry.id }, query: { organizationId } }
      })

      if (apiError) {
        throw new Error("Failed to delete")
      }

      // Navigate back to list
      navigate({
        to: "/organizations/$organizationId/companies/$companyId/journal-entries",
        params: {
          organizationId,
          companyId
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <div className="rounded-md bg-red-50 p-3" data-testid="workflow-error">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Action buttons based on status */}
      <div className="flex flex-wrap gap-3">
        {/* Draft actions */}
        {entry.status === "Draft" && (
          <>
            {canUpdateEntry && (
              <Link
                to="/organizations/$organizationId/companies/$companyId/journal-entries/$entryId/edit"
                params={{
                  organizationId,
                  companyId,
                  entryId: entry.id
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="edit-button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            )}
            {canUpdateEntry && (
              <Button
                onClick={handleSubmitForApproval}
                loading={isSubmitting}
                disabled={isSubmitting}
                data-testid="submit-button"
              >
                Submit for Approval
              </Button>
            )}
            {canUpdateEntry && (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
                data-testid="delete-button"
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
                className="border border-red-300 bg-white text-red-700 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
          </>
        )}

        {/* PendingApproval actions */}
        {entry.status === "PendingApproval" && canPostEntry && (
          <>
            <Button
              onClick={handleApprove}
              loading={isSubmitting}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
              data-testid="approve-button"
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowRejectModal(true)}
              disabled={isSubmitting}
              className="border-red-300 text-red-700 hover:bg-red-50"
              data-testid="reject-button"
            >
              Reject
            </Button>
          </>
        )}

        {/* Approved actions */}
        {entry.status === "Approved" && canPostEntry && (
          <Button
            onClick={handlePost}
            loading={isSubmitting}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
            data-testid="post-button"
          >
            Post to Ledger
          </Button>
        )}

        {/* Posted actions */}
        {entry.status === "Posted" && canReverseEntry && (
          <Button
            variant="secondary"
            onClick={() => setShowReverseConfirm(true)}
            disabled={isSubmitting}
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            data-testid="reverse-button"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            }
          >
            Create Reversal
          </Button>
        )}

        {/* Reversed - view only */}
        {entry.status === "Reversed" && (
          <p className="text-sm text-gray-500" data-testid="reversed-status-message">
            This entry has been reversed and cannot be modified.
          </p>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <RejectModal
          onReject={handleReject}
          onCancel={() => setShowRejectModal(false)}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Journal Entry"
          message="Are you sure you want to delete this journal entry? This action cannot be undone."
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Reverse Confirmation */}
      {showReverseConfirm && (
        <ConfirmDialog
          title="Create Reversal Entry"
          message="This will create a new journal entry with opposite amounts to reverse this entry. Continue?"
          confirmLabel="Create Reversal"
          confirmVariant="warning"
          onConfirm={handleReverse}
          onCancel={() => setShowReverseConfirm(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}

// =============================================================================
// Reject Modal Component
// =============================================================================

function RejectModal({
  onReject,
  onCancel,
  isSubmitting
}: {
  readonly onReject: (reason: string) => void
  readonly onCancel: () => void
  readonly isSubmitting: boolean
}) {
  const [reason, setReason] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" data-testid="reject-modal">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Reject Journal Entry</h3>
        <p className="mb-4 text-sm text-gray-600">
          Please provide a reason for rejecting this entry. The entry will be returned to draft status.
        </p>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter rejection reason (optional)"
          data-testid="reject-reason-input"
          className="mb-4 text-sm"
        />
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="reject-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => onReject(reason)}
            loading={isSubmitting}
            disabled={isSubmitting}
            data-testid="reject-confirm-button"
          >
            Reject Entry
          </Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Confirm Dialog Component
// =============================================================================

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
  isSubmitting
}: {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly confirmVariant: "danger" | "warning"
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly isSubmitting: boolean
}) {
  const buttonClass = confirmVariant === "danger"
    ? "bg-red-600 hover:bg-red-700"
    : "bg-orange-600 hover:bg-orange-700"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" data-testid="confirm-dialog">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-medium text-gray-900">{title}</h3>
        <p className="mb-4 text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="confirm-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={isSubmitting}
            className={buttonClass}
            data-testid="confirm-button"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Line Items Table Component
// =============================================================================

function LineItemsTable({
  lines,
  accountMap,
  currency
}: {
  readonly lines: readonly JournalEntryLine[]
  readonly accountMap: Map<string, Account>
  readonly currency: string
}) {
  // Calculate totals
  let totalDebits = 0
  let totalCredits = 0

  for (const line of lines) {
    if (line.debitAmount) {
      totalDebits += parseFloat(line.debitAmount.amount)
    }
    if (line.creditAmount) {
      totalCredits += parseFloat(line.creditAmount.amount)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200" data-testid="line-items-table">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <Tooltip content="Line number within this journal entry">
                <span>#</span>
              </Tooltip>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <Tooltip content="Account number and name from the chart of accounts">
                <span>Account</span>
              </Tooltip>
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              <Tooltip content="Debit amount in the company's functional currency">
                <span>Debit</span>
              </Tooltip>
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              <Tooltip content="Credit amount in the company's functional currency">
                <span>Credit</span>
              </Tooltip>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <Tooltip content="Optional memo or description for this line item">
                <span>Memo</span>
              </Tooltip>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {lines.map((line) => {
            const account = accountMap.get(line.accountId)
            return (
              <tr key={line.id} data-testid={`line-row-${line.lineNumber}`}>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {line.lineNumber}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900" data-testid={`line-account-${line.lineNumber}`}>
                  {account ? `${account.accountNumber} - ${account.name}` : line.accountId}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900" data-testid={`line-debit-${line.lineNumber}`}>
                  {line.debitAmount ? formatAmount(line.debitAmount.amount, currency) : ""}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900" data-testid={`line-credit-${line.lineNumber}`}>
                  {line.creditAmount ? formatAmount(line.creditAmount.amount, currency) : ""}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500" data-testid={`line-memo-${line.lineNumber}`}>
                  {line.memo ?? ""}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td className="px-6 py-4 text-sm font-medium text-gray-900" colSpan={2}>
              Totals
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900" data-testid="total-debits">
              {formatAmount(totalDebits.toFixed(2), currency)}
            </td>
            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900" data-testid="total-credits">
              {formatAmount(totalCredits.toFixed(2), currency)}
            </td>
            <td className="px-6 py-4"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// =============================================================================
// Status Badge Component
// =============================================================================

function StatusBadge({ status }: { readonly status: JournalEntryStatus }) {
  const colors: Record<JournalEntryStatus, string> = {
    Draft: "bg-gray-100 text-gray-800",
    PendingApproval: "bg-yellow-100 text-yellow-800",
    Approved: "bg-blue-100 text-blue-800",
    Posted: "bg-green-100 text-green-800",
    Reversed: "bg-red-100 text-red-800"
  }

  const labels: Record<JournalEntryStatus, string> = {
    Draft: "Draft",
    PendingApproval: "Pending Approval",
    Approved: "Approved",
    Posted: "Posted",
    Reversed: "Reversed"
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        colors[status]
      )}
      data-testid="status-badge"
    >
      {labels[status]}
    </span>
  )
}

// =============================================================================
// Entry Type Badge Component
// =============================================================================

function EntryTypeBadge({ type }: { readonly type: JournalEntryType }) {
  const colors: Record<JournalEntryType, string> = {
    Standard: "bg-gray-100 text-gray-800",
    Adjusting: "bg-purple-100 text-purple-800",
    Closing: "bg-orange-100 text-orange-800",
    Opening: "bg-blue-100 text-blue-800",
    Reversing: "bg-red-100 text-red-800",
    Recurring: "bg-teal-100 text-teal-800",
    Intercompany: "bg-indigo-100 text-indigo-800",
    Revaluation: "bg-yellow-100 text-yellow-800",
    Elimination: "bg-pink-100 text-pink-800",
    System: "bg-gray-100 text-gray-800"
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        colors[type]
      )}
      data-testid="entry-type-badge"
    >
      {type}
    </span>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatLocalDate(date: LocalDate): string {
  // Use UTC date to avoid timezone shifts
  // LocalDate represents a calendar date, not a moment in time
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day))
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"  // Format in UTC to preserve the date
  })
}

function formatTimestamp(timestamp: Timestamp): string {
  const d = new Date(timestamp.epochMillis)
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })
}

function formatAmount(amount: string, currency: string): string {
  const num = parseFloat(amount)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(num)
}

function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (error === null || error === undefined) {
    return defaultMessage
  }
  if (typeof error === "object" && "message" in error) {
    const messageValue = error.message
    if (typeof messageValue === "string") {
      return messageValue
    }
  }
  return defaultMessage
}
