/**
 * Edit Journal Entry Page Route
 *
 * Route: /companies/:companyId/journal-entries/:entryId/edit
 *
 * Form for editing existing draft journal entries with:
 * - Dynamic line add/remove
 * - Account selector for each line
 * - Debit/credit currency inputs
 * - Running balance display
 * - Save as draft and submit for approval actions
 *
 * @module routes/companies/$companyId.journal-entries.$entryId.edit
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as BigDecimal from "effect/BigDecimal"
import type { AccountId } from "@accountability/core/Domains/Account"
import type { CompanyId } from "@accountability/core/Domains/Company"
import { CompanyId as CompanyIdSchema } from "@accountability/core/Domains/Company"
import { CurrencyCode as CurrencyCodeSchema } from "@accountability/core/Domains/CurrencyCode"
import type { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import {
  JournalEntryId as JournalEntryIdSchema,
  type JournalEntryType,
  type SourceModule
} from "@accountability/core/Domains/JournalEntry"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { FiscalPeriodRef } from "@accountability/core/Domains/FiscalPeriodRef"
import { MonetaryAmount } from "@accountability/core/Domains/MonetaryAmount"
import {
  UpdateJournalEntryRequest,
  CreateJournalEntryLineRequest
} from "@accountability/api/Definitions/JournalEntriesApi"
import { AccountSelector } from "../../components/AccountSelector.tsx"
import { CurrencyInput } from "../../components/CurrencyInput.tsx"
import { ApiClient } from "../../atoms/ApiClient.ts"
import {
  createEmptyLine,
  calculateRunningBalance,
  validateForm,
  hasValidationErrors,
  journalEntryByIdFamily,
  updateJournalEntryMutation,
  submitForApprovalMutation,
  deleteJournalEntryMutation,
  generateLineId,
  type JournalEntryFormState,
  type JournalEntryFormLine,
  type JournalEntryFormErrors
} from "../../atoms/journalEntries.ts"

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/companies/$companyId/journal-entries/$entryId/edit")({
  component: EditJournalEntryPage
})

// =============================================================================
// Types
// =============================================================================

const JOURNAL_ENTRY_TYPES: ReadonlyArray<JournalEntryType> = [
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

const SOURCE_MODULES: ReadonlyArray<SourceModule> = [
  "GeneralLedger",
  "AccountsPayable",
  "AccountsReceivable",
  "FixedAssets",
  "Inventory",
  "Payroll",
  "Consolidation"
]

/**
 * Type guard for JournalEntryType
 */
const isJournalEntryType = (value: string): value is JournalEntryType =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Widening array type for .includes() check
  (JOURNAL_ENTRY_TYPES as ReadonlyArray<string>).includes(value)

/**
 * Type guard for SourceModule
 */
const isSourceModule = (value: string): value is SourceModule =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Widening array type for .includes() check
  (SOURCE_MODULES as ReadonlyArray<string>).includes(value)

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

const formSectionStyles: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "24px",
  marginBottom: "24px"
}

const formRowStyles: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
  marginBottom: "16px"
}

const formGroupStyles: React.CSSProperties = {
  marginBottom: "16px"
}

const labelStyles: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontWeight: 500,
  fontSize: "14px"
}

const inputStyles: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  fontSize: "14px",
  boxSizing: "border-box"
}

const selectStyles: React.CSSProperties = {
  ...inputStyles
}

const textareaStyles: React.CSSProperties = {
  ...inputStyles,
  minHeight: "80px",
  resize: "vertical"
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

const dangerButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#ff4d4f"
}

const buttonGroupStyles: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end"
}

const linesTableStyles: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse"
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
  padding: "8px",
  borderBottom: "1px solid #e8e8e8",
  verticalAlign: "top"
}

const balanceDisplayStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "16px",
  backgroundColor: "#f5f5f5",
  borderRadius: "4px",
  marginTop: "16px"
}

const balanceItemStyles: React.CSSProperties = {
  textAlign: "center"
}

const balanceLabelStyles: React.CSSProperties = {
  fontSize: "12px",
  color: "#666",
  marginBottom: "4px"
}

const balanceValueStyles = (isBalanced: boolean, isNetBalance: boolean): React.CSSProperties => ({
  fontSize: "18px",
  fontWeight: 600,
  fontFamily: "monospace",
  color: isNetBalance ? (isBalanced ? "#52c41a" : "#ff4d4f") : "#333"
})

const errorStyles: React.CSSProperties = {
  color: "#ff4d4f",
  fontSize: "12px",
  marginTop: "4px"
}

const globalErrorStyles: React.CSSProperties = {
  backgroundColor: "#fff2f0",
  border: "1px solid #ffccc7",
  borderRadius: "4px",
  padding: "12px",
  marginBottom: "16px",
  color: "#ff4d4f"
}

const warningStyles: React.CSSProperties = {
  backgroundColor: "#fffbe6",
  border: "1px solid #ffe58f",
  borderRadius: "4px",
  padding: "12px",
  marginBottom: "16px",
  color: "#d46b08"
}

const smallButtonStyles: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  backgroundColor: "#fff",
  cursor: "pointer"
}

const statusBadgeStyles = (status: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: 500,
  backgroundColor: status === "Draft" ? "#e6f7ff" : status === "PendingApproval" ? "#fffbe6" : "#f6ffed",
  color: status === "Draft" ? "#1890ff" : status === "PendingApproval" ? "#d46b08" : "#52c41a"
})

// =============================================================================
// Components
// =============================================================================

/**
 * Journal Entry Line Row Component
 */
function JournalEntryLineRow({
  line,
  companyId,
  lineError,
  onUpdate,
  onRemove,
  canRemove,
  disabled
}: {
  readonly line: JournalEntryFormLine
  readonly companyId: CompanyId
  readonly lineError?: { accountId?: string | undefined; amount?: string | undefined } | undefined
  readonly onUpdate: (lineId: string, updates: Partial<JournalEntryFormLine>) => void
  readonly onRemove: (lineId: string) => void
  readonly canRemove: boolean
  readonly disabled: boolean
}): React.ReactElement {
  const handleAccountChange = (accountId: AccountId | null) => {
    onUpdate(line.id, { accountId })
  }

  const handleDebitChange = (value: string) => {
    onUpdate(line.id, {
      debitAmount: value,
      creditAmount: value.trim() ? "" : line.creditAmount
    })
  }

  const handleCreditChange = (value: string) => {
    onUpdate(line.id, {
      creditAmount: value,
      debitAmount: value.trim() ? "" : line.debitAmount
    })
  }

  const handleMemoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(line.id, { memo: e.target.value })
  }

  return (
    <tr>
      <td style={tdStyles}>
        <span style={{ color: "#999", fontFamily: "monospace" }}>{line.lineNumber}</span>
      </td>
      <td style={{ ...tdStyles, minWidth: "250px" }}>
        <AccountSelector
          value={line.accountId}
          onChange={handleAccountChange}
          companyId={companyId}
          isPostable={true}
          isActive={true}
          placeholder="Select account..."
          aria-label={`Account for line ${line.lineNumber}`}
          aria-invalid={!!lineError?.accountId}
          disabled={disabled}
        />
        {lineError?.accountId && (
          <div style={errorStyles}>{lineError.accountId}</div>
        )}
      </td>
      <td style={{ ...tdStyles, width: "180px" }}>
        <CurrencyInput
          value={line.debitAmount}
          onChange={handleDebitChange}
          currencyCode={line.currencyCode}
          placeholder="0.00"
          aria-label={`Debit amount for line ${line.lineNumber}`}
          disabled={disabled || !!line.creditAmount.trim()}
        />
      </td>
      <td style={{ ...tdStyles, width: "180px" }}>
        <CurrencyInput
          value={line.creditAmount}
          onChange={handleCreditChange}
          currencyCode={line.currencyCode}
          placeholder="0.00"
          aria-label={`Credit amount for line ${line.lineNumber}`}
          disabled={disabled || !!line.debitAmount.trim()}
        />
        {lineError?.amount && (
          <div style={errorStyles}>{lineError.amount}</div>
        )}
      </td>
      <td style={{ ...tdStyles, minWidth: "150px" }}>
        <input
          type="text"
          value={line.memo}
          onChange={handleMemoChange}
          placeholder="Optional memo"
          style={{ ...inputStyles, padding: "6px 8px" }}
          aria-label={`Memo for line ${line.lineNumber}`}
          disabled={disabled}
        />
      </td>
      <td style={{ ...tdStyles, width: "60px", textAlign: "center" }}>
        {canRemove && !disabled && (
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            style={{ ...smallButtonStyles, color: "#ff4d4f", borderColor: "#ff4d4f" }}
            title="Remove line"
            aria-label={`Remove line ${line.lineNumber}`}
          >
            x
          </button>
        )}
      </td>
    </tr>
  )
}

/**
 * Running Balance Display Component
 */
function RunningBalanceDisplay({
  lines
}: {
  readonly lines: ReadonlyArray<JournalEntryFormLine>
}): React.ReactElement {
  const balance = calculateRunningBalance(lines)

  return (
    <div style={balanceDisplayStyles}>
      <div style={balanceItemStyles}>
        <div style={balanceLabelStyles}>Total Debits</div>
        <div style={balanceValueStyles(balance.isBalanced, false)}>
          {balance.formattedDebits}
        </div>
      </div>
      <div style={balanceItemStyles}>
        <div style={balanceLabelStyles}>Total Credits</div>
        <div style={balanceValueStyles(balance.isBalanced, false)}>
          {balance.formattedCredits}
        </div>
      </div>
      <div style={balanceItemStyles}>
        <div style={balanceLabelStyles}>Difference</div>
        <div style={balanceValueStyles(balance.isBalanced, true)}>
          {balance.isBalanced ? "Balanced" : balance.formattedBalance}
        </div>
      </div>
    </div>
  )
}

/**
 * Delete Confirmation Modal
 */
function DeleteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  isDeleting
}: {
  readonly isOpen: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly isDeleting: boolean
}): React.ReactElement | null {
  if (!isOpen) return null

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
    maxWidth: "400px",
    width: "100%"
  }

  return (
    <div style={modalOverlayStyles} onClick={onCancel}>
      <div style={modalContentStyles} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Delete Journal Entry</h2>
        <p>
          Are you sure you want to delete this journal entry? This action cannot be undone.
        </p>
        <div style={buttonGroupStyles}>
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyles}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={dangerButtonStyles}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Entry"}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function EditJournalEntryPage(): React.ReactElement {
  const { companyId, entryId } = Route.useParams()
  const navigate = useNavigate()
  const typedCompanyId = CompanyIdSchema.make(companyId)
  const typedEntryId = JournalEntryIdSchema.make(entryId)

  // Get company details
  const companyQueryAtom = React.useMemo(
    () => ApiClient.query("companies", "getCompany", {
      path: { id: typedCompanyId },
      timeToLive: Duration.minutes(5)
    }),
    [typedCompanyId]
  )
  const companyResult = useAtomValue(companyQueryAtom)

  // Get journal entry
  const entryQueryAtom = React.useMemo(
    () => journalEntryByIdFamily(entryId),
    [entryId]
  )
  const entryResult = useAtomValue(entryQueryAtom)

  // Default currency
  const defaultCurrency: CurrencyCode = React.useMemo(() => {
    if (Result.isSuccess(companyResult)) {
      return companyResult.value.functionalCurrency
    }
    return CurrencyCodeSchema.make("USD")
  }, [companyResult])

  // Form state
  const [formState, setFormState] = React.useState<JournalEntryFormState | null>(null)

  // Validation state
  const [validationErrors, setValidationErrors] = React.useState<JournalEntryFormErrors>({
    lineErrors: []
  })
  const [showValidation, setShowValidation] = React.useState(false)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Mutations
  const updateEntry = useAtomSet(updateJournalEntryMutation)
  const submitForApproval = useAtomSet(submitForApprovalMutation)
  const deleteEntry = useAtomSet(deleteJournalEntryMutation)

  // Initialize form state from loaded entry
  React.useEffect(() => {
    if (Result.isSuccess(entryResult) && formState === null) {
      const { entry, lines } = entryResult.value

      // Convert lines to form format
      const formLines: JournalEntryFormLine[] = lines.map((line) => {
        const debitCurrency = Option.map(line.debitAmount, (d) => d.currency)
        const creditCurrency = Option.map(line.creditAmount, (c) => c.currency)
        const currency = Option.getOrElse(
          Option.orElse(debitCurrency, () => creditCurrency),
          () => defaultCurrency
        )

        return {
          id: generateLineId(),
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          debitAmount: Option.match(line.debitAmount, {
            onNone: () => "",
            onSome: (d) => BigDecimal.format(d.amount)
          }),
          creditAmount: Option.match(line.creditAmount, {
            onNone: () => "",
            onSome: (c) => BigDecimal.format(c.amount)
          }),
          currencyCode: currency,
          memo: Option.getOrElse(line.memo, () => "")
        }
      })

      // Extract dates
      const transactionDateStr = `${entry.transactionDate.year}-${String(entry.transactionDate.month).padStart(2, "0")}-${String(entry.transactionDate.day).padStart(2, "0")}`
      const documentDateStr = Option.match(entry.documentDate, {
        onNone: () => "",
        onSome: (d) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
      })

      setFormState({
        companyId: entry.companyId,
        description: entry.description,
        transactionDate: transactionDateStr,
        documentDate: documentDateStr,
        fiscalYear: entry.fiscalPeriod.year,
        fiscalPeriod: entry.fiscalPeriod.period,
        entryType: entry.entryType,
        sourceModule: entry.sourceModule,
        referenceNumber: Option.getOrElse(entry.referenceNumber, () => ""),
        sourceDocumentRef: Option.getOrElse(entry.sourceDocumentRef, () => ""),
        lines: formLines,
        isSubmitting: false,
        error: null,
        editingId: entry.id
      })
    }
  }, [entryResult, formState, defaultCurrency])

  // Form update handlers
  const updateField = <K extends keyof JournalEntryFormState>(
    field: K,
    value: JournalEntryFormState[K]
  ) => {
    setFormState((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  const updateLine = (lineId: string, updates: Partial<JournalEntryFormLine>) => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            lines: prev.lines.map((line) =>
              line.id === lineId ? { ...line, ...updates } : line
            )
          }
        : prev
    )
  }

  const addLine = () => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            lines: [
              ...prev.lines,
              createEmptyLine(prev.lines.length + 1, defaultCurrency)
            ]
          }
        : prev
    )
  }

  const removeLine = (lineId: string) => {
    setFormState((prev) => {
      if (!prev) return prev
      const newLines = prev.lines.filter((line) => line.id !== lineId)
      return {
        ...prev,
        lines: newLines.map((line, index) => ({
          ...line,
          lineNumber: index + 1
        }))
      }
    })
  }

  // Validate on demand
  const runValidation = (): boolean => {
    if (!formState) return false
    const errors = validateForm(formState)
    setValidationErrors(errors)
    setShowValidation(true)
    return !hasValidationErrors(errors)
  }

  // Build update request from form state
  const buildUpdateRequest = (): UpdateJournalEntryRequest => {
    if (!formState) {
      throw new Error("Form state is not loaded")
    }

    // Parse transaction date
    const [year, month, day] = formState.transactionDate.split("-").map(Number)
    const transactionDate = LocalDate.make({ year, month, day })

    // Parse document date if provided
    const documentDate = formState.documentDate
      ? Option.some((() => {
          const [docYear, docMonth, docDay] = formState.documentDate.split("-").map(Number)
          return LocalDate.make({ year: docYear, month: docMonth, day: docDay })
        })())
      : Option.none<LocalDate>()

    // Create fiscal period reference
    const fiscalPeriod = FiscalPeriodRef.make({
      year: formState.fiscalYear,
      period: formState.fiscalPeriod
    })

    // Create line requests
    const lineRequests = formState.lines
      .filter((line) => line.accountId !== null)
      .map((line) =>
        CreateJournalEntryLineRequest.make({
          accountId: line.accountId!,
          debitAmount: line.debitAmount.trim()
            ? Option.some(
                MonetaryAmount.fromBigDecimal(
                  BigDecimal.unsafeFromString(line.debitAmount),
                  line.currencyCode
                )
              )
            : Option.none<MonetaryAmount>(),
          creditAmount: line.creditAmount.trim()
            ? Option.some(
                MonetaryAmount.fromBigDecimal(
                  BigDecimal.unsafeFromString(line.creditAmount),
                  line.currencyCode
                )
              )
            : Option.none<MonetaryAmount>(),
          memo: line.memo
            ? Option.some(line.memo)
            : Option.none<string>(),
          dimensions: Option.none<Record<string, string>>(),
          intercompanyPartnerId: Option.none<CompanyId>()
        })
      )

    return UpdateJournalEntryRequest.make({
      description: Option.some(formState.description),
      transactionDate: Option.some(transactionDate),
      documentDate,
      fiscalPeriod: Option.some(fiscalPeriod),
      referenceNumber: formState.referenceNumber
        ? Option.some(formState.referenceNumber)
        : Option.none<string>(),
      sourceDocumentRef: formState.sourceDocumentRef
        ? Option.some(formState.sourceDocumentRef)
        : Option.none<string>(),
      lines: Option.some(lineRequests)
    })
  }

  // Save changes
  const handleSave = async () => {
    if (!runValidation() || !formState) {
      return
    }

    setFormState((prev) => prev ? { ...prev, isSubmitting: true, error: null } : prev)

    try {
      const request = buildUpdateRequest()
      await updateEntry({
        path: { id: typedEntryId },
        payload: request
      })
      navigate({
        to: "/companies/$companyId/accounts",
        params: { companyId }
      })
    } catch (err) {
      setFormState((prev) =>
        prev
          ? {
              ...prev,
              isSubmitting: false,
              error: err instanceof Error ? err.message : "Failed to save journal entry"
            }
          : prev
      )
    }
  }

  // Submit for approval
  const handleSubmitForApproval = async () => {
    if (!runValidation() || !formState) {
      return
    }

    setFormState((prev) => prev ? { ...prev, isSubmitting: true, error: null } : prev)

    try {
      // First save changes
      const request = buildUpdateRequest()
      await updateEntry({
        path: { id: typedEntryId },
        payload: request
      })

      // Then submit for approval
      await submitForApproval({ path: { id: typedEntryId } })

      navigate({
        to: "/companies/$companyId/accounts",
        params: { companyId }
      })
    } catch (err) {
      setFormState((prev) =>
        prev
          ? {
              ...prev,
              isSubmitting: false,
              error: err instanceof Error ? err.message : "Failed to submit journal entry"
            }
          : prev
      )
    }
  }

  // Delete entry
  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteEntry({ path: { id: typedEntryId } })
      navigate({
        to: "/companies/$companyId/accounts",
        params: { companyId }
      })
    } catch (err) {
      setIsDeleting(false)
      setShowDeleteModal(false)
      setFormState((prev) =>
        prev
          ? {
              ...prev,
              error: err instanceof Error ? err.message : "Failed to delete journal entry"
            }
          : prev
      )
    }
  }

  // Cancel and go back
  const handleCancel = () => {
    navigate({
      to: "/companies/$companyId/accounts",
      params: { companyId }
    })
  }

  // Get line error by line ID
  const getLineError = (lineId: string) => {
    return showValidation
      ? validationErrors.lineErrors.find((e) => e.lineId === lineId)
      : undefined
  }

  // Loading state
  const isLoadingCompany = Result.isInitial(companyResult) || Result.isWaiting(companyResult)
  const isLoadingEntry = Result.isInitial(entryResult) || Result.isWaiting(entryResult)
  const hasEntryError = Result.isFailure(entryResult)

  if (isLoadingCompany || isLoadingEntry) {
    return (
      <div style={pageStyles}>
        <div style={{ textAlign: "center", padding: "48px", color: "#666" }}>
          Loading journal entry...
        </div>
      </div>
    )
  }

  if (hasEntryError) {
    return (
      <div style={pageStyles}>
        <div style={globalErrorStyles}>
          Failed to load journal entry. The entry may not exist or you may not have permission to view it.
        </div>
        <button type="button" onClick={handleCancel} style={secondaryButtonStyles}>
          Go Back
        </button>
      </div>
    )
  }

  if (!formState) {
    return (
      <div style={pageStyles}>
        <div style={{ textAlign: "center", padding: "48px", color: "#666" }}>
          Initializing form...
        </div>
      </div>
    )
  }

  // Check if entry is editable
  const entry = Result.isSuccess(entryResult) ? entryResult.value.entry : null
  const isEditable = entry?.status === "Draft"

  return (
    <div style={pageStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div>
          <h1 style={{ margin: 0 }}>Edit Journal Entry</h1>
          <p style={{ color: "#666", margin: "8px 0 0" }}>
            Company: {Result.isSuccess(companyResult) ? companyResult.value.name : companyId}
            {entry && (
              <>
                <span style={{ margin: "0 8px" }}>|</span>
                <span style={statusBadgeStyles(entry.status)}>{entry.status}</span>
              </>
            )}
          </p>
        </div>
        <div style={buttonGroupStyles}>
          {isEditable && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              style={dangerButtonStyles}
              disabled={formState.isSubmitting}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            style={secondaryButtonStyles}
            disabled={formState.isSubmitting}
          >
            Cancel
          </button>
          {isEditable && (
            <>
              <button
                type="button"
                onClick={handleSave}
                style={secondaryButtonStyles}
                disabled={formState.isSubmitting}
              >
                {formState.isSubmitting ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleSubmitForApproval}
                style={buttonStyles}
                disabled={formState.isSubmitting}
              >
                {formState.isSubmitting ? "Submitting..." : "Submit for Approval"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Non-editable warning */}
      {!isEditable && (
        <div style={warningStyles}>
          This journal entry cannot be edited because it is no longer in draft status.
          Only draft entries can be modified.
        </div>
      )}

      {/* Error display */}
      {formState.error && (
        <div style={globalErrorStyles}>{formState.error}</div>
      )}

      {/* Balance error */}
      {showValidation && validationErrors.balance && (
        <div style={globalErrorStyles}>{validationErrors.balance}</div>
      )}

      {/* Entry Details Section */}
      <div style={formSectionStyles}>
        <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "16px" }}>
          Entry Details
        </h2>

        <div style={formGroupStyles}>
          <label style={labelStyles}>Description *</label>
          <textarea
            value={formState.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Enter a description for this journal entry"
            style={textareaStyles}
            aria-invalid={showValidation && !!validationErrors.description}
            disabled={!isEditable}
          />
          {showValidation && validationErrors.description && (
            <div style={errorStyles}>{validationErrors.description}</div>
          )}
        </div>

        <div style={formRowStyles}>
          <div style={formGroupStyles}>
            <label style={labelStyles}>Transaction Date *</label>
            <input
              type="date"
              value={formState.transactionDate}
              onChange={(e) => updateField("transactionDate", e.target.value)}
              style={inputStyles}
              aria-invalid={showValidation && !!validationErrors.transactionDate}
              disabled={!isEditable}
            />
            {showValidation && validationErrors.transactionDate && (
              <div style={errorStyles}>{validationErrors.transactionDate}</div>
            )}
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Document Date</label>
            <input
              type="date"
              value={formState.documentDate}
              onChange={(e) => updateField("documentDate", e.target.value)}
              style={inputStyles}
              disabled={!isEditable}
            />
          </div>
        </div>

        <div style={formRowStyles}>
          <div style={formGroupStyles}>
            <label style={labelStyles}>Fiscal Year *</label>
            <input
              type="number"
              value={formState.fiscalYear}
              onChange={(e) => updateField("fiscalYear", parseInt(e.target.value, 10) || 0)}
              min={1900}
              max={2999}
              style={inputStyles}
              aria-invalid={showValidation && !!validationErrors.fiscalYear}
              disabled={!isEditable}
            />
            {showValidation && validationErrors.fiscalYear && (
              <div style={errorStyles}>{validationErrors.fiscalYear}</div>
            )}
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Fiscal Period *</label>
            <select
              value={formState.fiscalPeriod}
              onChange={(e) => updateField("fiscalPeriod", parseInt(e.target.value, 10))}
              style={selectStyles}
              aria-invalid={showValidation && !!validationErrors.fiscalPeriod}
              disabled={!isEditable}
            >
              {Array.from({ length: 13 }, (_, i) => i + 1).map((period) => (
                <option key={period} value={period}>
                  Period {period}{period === 13 ? " (Adjusting)" : ""}
                </option>
              ))}
            </select>
            {showValidation && validationErrors.fiscalPeriod && (
              <div style={errorStyles}>{validationErrors.fiscalPeriod}</div>
            )}
          </div>
        </div>

        <div style={formRowStyles}>
          <div style={formGroupStyles}>
            <label style={labelStyles}>Entry Type</label>
            <select
              value={formState.entryType}
              onChange={(e) => {
                const value = e.target.value
                if (isJournalEntryType(value)) {
                  updateField("entryType", value)
                }
              }}
              style={selectStyles}
              disabled={!isEditable}
            >
              {JOURNAL_ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Source Module</label>
            <select
              value={formState.sourceModule}
              onChange={(e) => {
                const value = e.target.value
                if (isSourceModule(value)) {
                  updateField("sourceModule", value)
                }
              }}
              style={selectStyles}
              disabled={!isEditable}
            >
              {SOURCE_MODULES.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={formRowStyles}>
          <div style={formGroupStyles}>
            <label style={labelStyles}>Reference Number</label>
            <input
              type="text"
              value={formState.referenceNumber}
              onChange={(e) => updateField("referenceNumber", e.target.value)}
              placeholder="e.g., INV-2025-001"
              style={inputStyles}
              disabled={!isEditable}
            />
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Source Document Reference</label>
            <input
              type="text"
              value={formState.sourceDocumentRef}
              onChange={(e) => updateField("sourceDocumentRef", e.target.value)}
              placeholder="e.g., PO-12345"
              style={inputStyles}
              disabled={!isEditable}
            />
          </div>
        </div>
      </div>

      {/* Journal Lines Section */}
      <div style={formSectionStyles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>Journal Lines</h2>
          {isEditable && (
            <button
              type="button"
              onClick={addLine}
              style={secondaryButtonStyles}
            >
              + Add Line
            </button>
          )}
        </div>

        {showValidation && validationErrors.lines && (
          <div style={{ ...errorStyles, marginBottom: "16px" }}>{validationErrors.lines}</div>
        )}

        <table style={linesTableStyles}>
          <thead>
            <tr>
              <th style={{ ...thStyles, width: "50px" }}>#</th>
              <th style={thStyles}>Account</th>
              <th style={{ ...thStyles, width: "180px" }}>Debit</th>
              <th style={{ ...thStyles, width: "180px" }}>Credit</th>
              <th style={thStyles}>Memo</th>
              <th style={{ ...thStyles, width: "60px" }}></th>
            </tr>
          </thead>
          <tbody>
            {formState.lines.map((line) => (
              <JournalEntryLineRow
                key={line.id}
                line={line}
                companyId={typedCompanyId}
                lineError={getLineError(line.id)}
                onUpdate={updateLine}
                onRemove={removeLine}
                canRemove={formState.lines.length > 2}
                disabled={!isEditable}
              />
            ))}
          </tbody>
        </table>

        {/* Running Balance */}
        <RunningBalanceDisplay lines={formState.lines} />
      </div>

      {/* Bottom Actions */}
      {isEditable && (
        <div style={{ ...buttonGroupStyles, marginTop: "24px" }}>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            style={dangerButtonStyles}
            disabled={formState.isSubmitting}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleCancel}
            style={secondaryButtonStyles}
            disabled={formState.isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={secondaryButtonStyles}
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleSubmitForApproval}
            style={buttonStyles}
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={isDeleting}
      />
    </div>
  )
}
