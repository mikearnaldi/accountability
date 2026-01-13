/**
 * Journal Entries List Page Route (Index)
 *
 * Route: /companies/:companyId/journal-entries (exact match)
 *
 * Displays a list of journal entries for a company with:
 * - Filtering by status, entry type, and date range
 * - Sorting by various fields
 * - Status workflow actions (submit, approve, reject, post)
 * - Navigation to create/edit/view entries
 *
 * @module routes/companies/$companyId.journal-entries.index
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import type { JournalEntry, JournalEntryStatus, JournalEntryType } from "@accountability/core/Domains/JournalEntry"
import { CompanyId as CompanyIdSchema } from "@accountability/core/Domains/Company"
import { JournalEntryId as JournalEntryIdSchema, UserId } from "@accountability/core/Domains/JournalEntry"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { ApiClient } from "../../atoms/ApiClient.ts"
import {
  createJournalEntriesQueryAtom,
  submitForApprovalMutation,
  approveJournalEntryMutation,
  rejectJournalEntryMutation,
  postJournalEntryMutation,
  deleteJournalEntryMutation
} from "../../atoms/journalEntries.ts"

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/companies/$companyId/journal-entries/")({
  component: JournalEntriesPage
})

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px"
}

const headerStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px"
}

const filtersStyles: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  marginBottom: "24px",
  flexWrap: "wrap",
  alignItems: "center"
}

const filterGroupStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px"
}

const selectStyles: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  fontSize: "14px"
}

const buttonStyles: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "4px",
  border: "none",
  backgroundColor: "#1890ff",
  color: "white",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "14px"
}

const secondaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#f5f5f5",
  color: "#333",
  border: "1px solid #ccc"
}

const successButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#52c41a"
}

const dangerButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#ff4d4f"
}

const smallButtonStyles: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "none",
  cursor: "pointer"
}

const tableStyles: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  backgroundColor: "#fff"
}

const thStyles: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  backgroundColor: "#fafafa",
  borderBottom: "2px solid #e8e8e8",
  fontWeight: 600,
  fontSize: "14px"
}

const tdStyles: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: "1px solid #e8e8e8",
  fontSize: "14px"
}

const statusBadgeStyles = (status: JournalEntryStatus): React.CSSProperties => {
  const colors: Record<JournalEntryStatus, { bg: string; text: string }> = {
    Draft: { bg: "#e6f7ff", text: "#1890ff" },
    PendingApproval: { bg: "#fffbe6", text: "#d46b08" },
    Approved: { bg: "#f6ffed", text: "#52c41a" },
    Posted: { bg: "#d9f7be", text: "#389e0d" },
    Reversed: { bg: "#fff1f0", text: "#cf1322" }
  }
  const color = colors[status]
  return {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: color.bg,
    color: color.text
  }
}

const emptyStateStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "48px",
  color: "#666"
}

const modalOverlayStyles: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000
}

const modalContentStyles: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "8px",
  padding: "24px",
  maxWidth: "500px",
  width: "100%"
}

const buttonGroupStyles: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
  marginTop: "16px"
}

// =============================================================================
// Types
// =============================================================================

const STATUS_OPTIONS: ReadonlyArray<JournalEntryStatus> = [
  "Draft",
  "PendingApproval",
  "Approved",
  "Posted",
  "Reversed"
]

const TYPE_OPTIONS: ReadonlyArray<JournalEntryType> = [
  "Standard",
  "Adjusting",
  "Closing",
  "Opening",
  "Reversing",
  "Recurring",
  "Intercompany",
  "Revaluation",
  "Elimination",
  "System"
]

/**
 * Type guard for JournalEntryStatus
 */
const isJournalEntryStatus = (value: string): value is JournalEntryStatus =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Widening array type for .includes() check
  (STATUS_OPTIONS as ReadonlyArray<string>).includes(value)

/**
 * Type guard for JournalEntryType
 */
const isJournalEntryType = (value: string): value is JournalEntryType =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Widening array type for .includes() check
  (TYPE_OPTIONS as ReadonlyArray<string>).includes(value)

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Delete Confirmation Modal
 */
function DeleteModal({
  isOpen,
  entryDescription,
  onConfirm,
  onCancel,
  isDeleting
}: {
  readonly isOpen: boolean
  readonly entryDescription: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly isDeleting: boolean
}): React.ReactElement | null {
  if (!isOpen) return null

  return (
    <div style={modalOverlayStyles} onClick={onCancel} data-testid="delete-entry-modal">
      <div style={modalContentStyles} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Delete Journal Entry</h2>
        <p data-testid="delete-entry-info">
          Are you sure you want to delete &quot;{entryDescription}&quot;? This action cannot be undone.
        </p>
        <div style={buttonGroupStyles}>
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyles}
            disabled={isDeleting}
            data-testid="cancel-delete-entry"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={dangerButtonStyles}
            disabled={isDeleting}
            data-testid="confirm-delete-entry"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Reject Modal with reason input
 */
function RejectModal({
  isOpen,
  onConfirm,
  onCancel,
  isRejecting
}: {
  readonly isOpen: boolean
  readonly onConfirm: (reason: string) => void
  readonly onCancel: () => void
  readonly isRejecting: boolean
}): React.ReactElement | null {
  const [reason, setReason] = React.useState("")

  if (!isOpen) return null

  return (
    <div style={modalOverlayStyles} onClick={onCancel} data-testid="reject-entry-modal">
      <div style={modalContentStyles} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Reject Journal Entry</h2>
        <p>This will return the entry to Draft status for corrections.</p>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
            Rejection Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              minHeight: "80px",
              resize: "vertical",
              boxSizing: "border-box"
            }}
            data-testid="reject-reason-input"
          />
        </div>
        <div style={buttonGroupStyles}>
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyles}
            disabled={isRejecting}
            data-testid="cancel-reject-entry"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            style={dangerButtonStyles}
            disabled={isRejecting}
            data-testid="confirm-reject-entry"
          >
            {isRejecting ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Post Modal with posting date
 */
function PostModal({
  isOpen,
  onConfirm,
  onCancel,
  isPosting
}: {
  readonly isOpen: boolean
  readonly onConfirm: (postingDate: string | null) => void
  readonly onCancel: () => void
  readonly isPosting: boolean
}): React.ReactElement | null {
  const [postingDate, setPostingDate] = React.useState("")

  if (!isOpen) return null

  return (
    <div style={modalOverlayStyles} onClick={onCancel} data-testid="post-entry-modal">
      <div style={modalContentStyles} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Post Journal Entry</h2>
        <p>This will post the entry to the general ledger and update account balances.</p>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
            Posting Date (optional, defaults to transaction date)
          </label>
          <input
            type="date"
            value={postingDate}
            onChange={(e) => setPostingDate(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              boxSizing: "border-box"
            }}
            data-testid="posting-date-input"
          />
        </div>
        <div style={buttonGroupStyles}>
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyles}
            disabled={isPosting}
            data-testid="cancel-post-entry"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(postingDate || null)}
            style={successButtonStyles}
            disabled={isPosting}
            data-testid="confirm-post-entry"
          >
            {isPosting ? "Posting..." : "Post Entry"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Format a LocalDate for display
 */
function formatDate(date: { year: number; month: number; day: number }): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`
}

// =============================================================================
// Main Page Component
// =============================================================================

function JournalEntriesPage(): React.ReactElement {
  const { companyId } = Route.useParams()
  const navigate = useNavigate()
  const typedCompanyId = CompanyIdSchema.make(companyId)

  // Filter state
  const [statusFilter, setStatusFilter] = React.useState<JournalEntryStatus | "">("")
  const [typeFilter, setTypeFilter] = React.useState<JournalEntryType | "">("")

  // Get company details
  const companyQueryAtom = React.useMemo(
    () => ApiClient.query("companies", "getCompany", {
      path: { id: typedCompanyId },
      timeToLive: Duration.minutes(5)
    }),
    [typedCompanyId]
  )
  const companyResult = useAtomValue(companyQueryAtom)

  // Query journal entries
  const entriesQueryAtom = React.useMemo(
    () => createJournalEntriesQueryAtom({
      companyId: typedCompanyId,
      status: statusFilter || undefined,
      entryType: typeFilter || undefined,
      limit: 50
    }),
    [typedCompanyId, statusFilter, typeFilter]
  )
  const entriesResult = useAtomValue(entriesQueryAtom)

  // Action state
  const [selectedEntry, setSelectedEntry] = React.useState<JournalEntry | null>(null)
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [showRejectModal, setShowRejectModal] = React.useState(false)
  const [showPostModal, setShowPostModal] = React.useState(false)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  // Mutations
  const submitForApproval = useAtomSet(submitForApprovalMutation)
  const approveMutation = useAtomSet(approveJournalEntryMutation)
  const rejectMutation = useAtomSet(rejectJournalEntryMutation)
  const postMutation = useAtomSet(postJournalEntryMutation)
  const deleteEntry = useAtomSet(deleteJournalEntryMutation)

  // Clear filters
  const handleClearFilters = () => {
    setStatusFilter("")
    setTypeFilter("")
  }

  // Navigate to new entry
  const handleNewEntry = () => {
    navigate({
      to: "/companies/$companyId/journal-entries/new",
      params: { companyId }
    })
  }

  // Navigate to edit entry
  const handleEditEntry = (entry: JournalEntry) => {
    navigate({
      to: "/companies/$companyId/journal-entries/$entryId/edit",
      params: { companyId, entryId: entry.id }
    })
  }

  // Helper to reload page after mutation
  const reloadAfterMutation = () => {
    // Small delay to ensure the mutation response is fully processed
    setTimeout(() => window.location.reload(), 50)
  }

  // Submit for approval
  const handleSubmitForApproval = async (entry: JournalEntry) => {
    setIsProcessing(true)
    setActionError(null)
    try {
      await submitForApproval({
        path: { id: JournalEntryIdSchema.make(entry.id) }
      })
      reloadAfterMutation()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to submit for approval")
      setIsProcessing(false)
    }
  }

  // Approve entry
  const handleApprove = async (entry: JournalEntry) => {
    setIsProcessing(true)
    setActionError(null)
    try {
      await approveMutation({
        path: { id: JournalEntryIdSchema.make(entry.id) }
      })
      reloadAfterMutation()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve entry")
      setIsProcessing(false)
    }
  }

  // Reject entry
  const handleReject = async (reason: string) => {
    if (!selectedEntry) return
    setIsProcessing(true)
    setActionError(null)
    try {
      await rejectMutation({
        path: { id: JournalEntryIdSchema.make(selectedEntry.id) },
        payload: { reason: reason ? Option.some(reason) : Option.none() }
      })
      setShowRejectModal(false)
      setSelectedEntry(null)
      reloadAfterMutation()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject entry")
      setIsProcessing(false)
    }
  }

  // Post entry
  const handlePost = async (postingDate: string | null) => {
    if (!selectedEntry) return
    setIsProcessing(true)
    setActionError(null)
    try {
      // Get current user ID from auth (simplified - in real app would come from auth context)
      const userId = UserId.make("00000000-0000-0000-0000-000000000001")

      await postMutation({
        path: { id: JournalEntryIdSchema.make(selectedEntry.id) },
        payload: {
          postedBy: userId,
          postingDate: postingDate
            ? Option.some(LocalDate.make({
                year: parseInt(postingDate.split("-")[0]),
                month: parseInt(postingDate.split("-")[1]),
                day: parseInt(postingDate.split("-")[2])
              }))
            : Option.none<LocalDate>()
        }
      })
      setShowPostModal(false)
      setSelectedEntry(null)
      reloadAfterMutation()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to post entry")
      setIsProcessing(false)
    }
  }

  // Delete entry
  const handleDelete = async () => {
    if (!selectedEntry) return
    setIsProcessing(true)
    setActionError(null)
    try {
      await deleteEntry({
        path: { id: JournalEntryIdSchema.make(selectedEntry.id) }
      })
      setShowDeleteModal(false)
      setSelectedEntry(null)
      reloadAfterMutation()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete entry")
      setIsProcessing(false)
    }
  }

  // Loading state
  const isLoading =
    Result.isInitial(entriesResult) ||
    Result.isWaiting(entriesResult) ||
    Result.isInitial(companyResult) ||
    Result.isWaiting(companyResult)

  // Get entries
  const entries = Result.isSuccess(entriesResult) ? entriesResult.value.entries : []
  const hasFilters = statusFilter !== "" || typeFilter !== ""

  return (
    <div style={pageStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div>
          <h1 style={{ margin: 0 }} data-testid="page-title">Journal Entries</h1>
          <p style={{ color: "#666", margin: "8px 0 0" }}>
            Company: {Result.isSuccess(companyResult) ? companyResult.value.name : companyId}
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewEntry}
          style={buttonStyles}
          data-testid="create-journal-entry-button"
        >
          + New Entry
        </button>
      </div>

      {/* Error display */}
      {actionError && (
        <div
          style={{
            backgroundColor: "#fff2f0",
            border: "1px solid #ffccc7",
            borderRadius: "4px",
            padding: "12px",
            marginBottom: "16px",
            color: "#ff4d4f"
          }}
          data-testid="action-error"
        >
          {actionError}
        </div>
      )}

      {/* Filters */}
      <div style={filtersStyles} data-testid="filters-section">
        <div style={filterGroupStyles}>
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value
              setStatusFilter(value === "" ? "" : (isJournalEntryStatus(value) ? value : ""))
            }}
            style={selectStyles}
            data-testid="status-filter"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div style={filterGroupStyles}>
          <label htmlFor="type-filter">Type:</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => {
              const value = e.target.value
              setTypeFilter(value === "" ? "" : (isJournalEntryType(value) ? value : ""))
            }}
            style={selectStyles}
            data-testid="type-filter"
          >
            <option value="">All</option>
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            style={secondaryButtonStyles}
            data-testid="clear-filters-button"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Entries count */}
      {Result.isSuccess(entriesResult) && (
        <p style={{ color: "#666", marginBottom: "16px" }} data-testid="entries-count">
          Showing {entries.length} of {entriesResult.value.total} entries
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div style={emptyStateStyles} data-testid="loading-state">
          Loading journal entries...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries.length === 0 && (
        <div style={emptyStateStyles} data-testid="entries-empty">
          {hasFilters
            ? "No journal entries match your filters"
            : "No journal entries found. Create your first entry to get started."}
        </div>
      )}

      {/* Entries table */}
      {!isLoading && entries.length > 0 && (
        <table style={tableStyles} data-testid="entries-list">
          <thead>
            <tr>
              <th style={thStyles}>Date</th>
              <th style={thStyles}>Description</th>
              <th style={thStyles}>Type</th>
              <th style={thStyles}>Status</th>
              <th style={thStyles}>Period</th>
              <th style={thStyles}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} data-testid={`entry-row-${entry.id}`}>
                <td style={tdStyles} data-testid={`entry-date-${entry.id}`}>
                  {formatDate(entry.transactionDate)}
                </td>
                <td style={tdStyles} data-testid={`entry-description-${entry.id}`}>
                  <Link
                    to="/companies/$companyId/journal-entries/$entryId/edit"
                    params={{ companyId, entryId: entry.id }}
                    style={{ color: "#1890ff", textDecoration: "none" }}
                    data-testid={`entry-link-${entry.id}`}
                  >
                    {entry.description}
                  </Link>
                  {Option.isSome(entry.referenceNumber) && (
                    <span style={{ color: "#999", marginLeft: "8px" }}>
                      ({Option.getOrElse(entry.referenceNumber, () => "")})
                    </span>
                  )}
                </td>
                <td style={tdStyles} data-testid={`entry-type-${entry.id}`}>
                  {entry.entryType}
                </td>
                <td style={tdStyles} data-testid={`entry-status-${entry.id}`}>
                  <span style={statusBadgeStyles(entry.status)}>{entry.status}</span>
                </td>
                <td style={tdStyles} data-testid={`entry-period-${entry.id}`}>
                  {entry.fiscalPeriod.year} P{entry.fiscalPeriod.period}
                </td>
                <td style={tdStyles}>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {/* Edit button - only for Draft entries */}
                    {entry.status === "Draft" && (
                      <button
                        type="button"
                        onClick={() => handleEditEntry(entry)}
                        style={{ ...smallButtonStyles, backgroundColor: "#f5f5f5", border: "1px solid #ccc" }}
                        data-testid={`edit-entry-${entry.id}`}
                        disabled={isProcessing}
                      >
                        Edit
                      </button>
                    )}

                    {/* Submit for Approval - only for Draft entries */}
                    {entry.status === "Draft" && (
                      <button
                        type="button"
                        onClick={() => handleSubmitForApproval(entry)}
                        style={{ ...smallButtonStyles, backgroundColor: "#1890ff", color: "white" }}
                        data-testid={`submit-for-approval-${entry.id}`}
                        disabled={isProcessing}
                      >
                        Submit
                      </button>
                    )}

                    {/* Approve button - only for PendingApproval entries */}
                    {entry.status === "PendingApproval" && (
                      <button
                        type="button"
                        onClick={() => handleApprove(entry)}
                        style={{ ...smallButtonStyles, backgroundColor: "#52c41a", color: "white" }}
                        data-testid={`approve-entry-${entry.id}`}
                        disabled={isProcessing}
                      >
                        Approve
                      </button>
                    )}

                    {/* Reject button - only for PendingApproval entries */}
                    {entry.status === "PendingApproval" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntry(entry)
                          setShowRejectModal(true)
                        }}
                        style={{ ...smallButtonStyles, backgroundColor: "#ff4d4f", color: "white" }}
                        data-testid={`reject-entry-${entry.id}`}
                        disabled={isProcessing}
                      >
                        Reject
                      </button>
                    )}

                    {/* Post button - only for Approved entries */}
                    {entry.status === "Approved" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntry(entry)
                          setShowPostModal(true)
                        }}
                        style={{ ...smallButtonStyles, backgroundColor: "#389e0d", color: "white" }}
                        data-testid={`post-entry-${entry.id}`}
                        disabled={isProcessing}
                      >
                        Post
                      </button>
                    )}

                    {/* Delete button - only for Draft entries */}
                    {entry.status === "Draft" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntry(entry)
                          setShowDeleteModal(true)
                        }}
                        style={{ ...smallButtonStyles, backgroundColor: "#fff", border: "1px solid #ff4d4f", color: "#ff4d4f" }}
                        data-testid={`delete-entry-${entry.id}`}
                        disabled={isProcessing}
                      >
                        Delete
                      </button>
                    )}

                    {/* View button - for Posted/Reversed entries */}
                    {(entry.status === "Posted" || entry.status === "Reversed") && (
                      <button
                        type="button"
                        onClick={() => handleEditEntry(entry)}
                        style={{ ...smallButtonStyles, backgroundColor: "#f5f5f5", border: "1px solid #ccc" }}
                        data-testid={`view-entry-${entry.id}`}
                        disabled={isProcessing}
                      >
                        View
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Delete Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        entryDescription={selectedEntry?.description ?? ""}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false)
          setSelectedEntry(null)
        }}
        isDeleting={isProcessing}
      />

      {/* Reject Modal */}
      <RejectModal
        isOpen={showRejectModal}
        onConfirm={handleReject}
        onCancel={() => {
          setShowRejectModal(false)
          setSelectedEntry(null)
        }}
        isRejecting={isProcessing}
      />

      {/* Post Modal */}
      <PostModal
        isOpen={showPostModal}
        onConfirm={handlePost}
        onCancel={() => {
          setShowPostModal(false)
          setSelectedEntry(null)
        }}
        isPosting={isProcessing}
      />
    </div>
  )
}
