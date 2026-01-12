/**
 * New Journal Entry Page Route
 *
 * Route: /companies/:companyId/journal-entries/new
 *
 * Form for creating new journal entries with:
 * - Dynamic line add/remove
 * - Account selector for each line
 * - Debit/credit currency inputs
 * - Running balance display
 * - Save as draft and submit for approval actions
 *
 * @module routes/companies/$companyId.journal-entries.new
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import type { AccountId } from "@accountability/core/Domains/Account"
import type { CompanyId } from "@accountability/core/Domains/Company"
import { CompanyId as CompanyIdSchema } from "@accountability/core/Domains/Company"
import { CurrencyCode as CurrencyCodeSchema } from "@accountability/core/Domains/CurrencyCode"
import type { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import type {
  JournalEntryType,
  SourceModule
} from "@accountability/core/Domains/JournalEntry"
import { AccountSelector } from "../../components/AccountSelector.ts"
import { CurrencyInput } from "../../components/CurrencyInput.ts"
import { ApiClient } from "../../atoms/ApiClient.ts"
import {
  createInitialFormState,
  createEmptyLine,
  calculateRunningBalance,
  validateForm,
  hasValidationErrors,
  formStateToCreateRequest,
  createJournalEntryMutation,
  type JournalEntryFormState,
  type JournalEntryFormLine,
  type JournalEntryFormErrors
} from "../../atoms/journalEntries.ts"

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/companies/$companyId/journal-entries/new")({
  component: NewJournalEntryPage
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

const smallButtonStyles: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "12px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  backgroundColor: "#fff",
  cursor: "pointer"
}

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
  canRemove
}: {
  readonly line: JournalEntryFormLine
  readonly companyId: CompanyId
  readonly lineError?: { accountId?: string | undefined; amount?: string | undefined } | undefined
  readonly onUpdate: (lineId: string, updates: Partial<JournalEntryFormLine>) => void
  readonly onRemove: (lineId: string) => void
  readonly canRemove: boolean
}): React.ReactElement {
  const handleAccountChange = (accountId: AccountId | null) => {
    onUpdate(line.id, { accountId })
  }

  const handleDebitChange = (value: string) => {
    // Clear credit if debit is being entered
    onUpdate(line.id, {
      debitAmount: value,
      creditAmount: value.trim() ? "" : line.creditAmount
    })
  }

  const handleCreditChange = (value: string) => {
    // Clear debit if credit is being entered
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
          disabled={!!line.creditAmount.trim()}
        />
      </td>
      <td style={{ ...tdStyles, width: "180px" }}>
        <CurrencyInput
          value={line.creditAmount}
          onChange={handleCreditChange}
          currencyCode={line.currencyCode}
          placeholder="0.00"
          aria-label={`Credit amount for line ${line.lineNumber}`}
          disabled={!!line.debitAmount.trim()}
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
        />
      </td>
      <td style={{ ...tdStyles, width: "60px", textAlign: "center" }}>
        {canRemove && (
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

// =============================================================================
// Main Page Component
// =============================================================================

function NewJournalEntryPage(): React.ReactElement {
  const { companyId } = Route.useParams()
  const navigate = useNavigate()
  const typedCompanyId = CompanyIdSchema.make(companyId)

  // Get company details to determine default currency
  const companyQueryAtom = React.useMemo(
    () => ApiClient.query("companies", "getCompany", {
      path: { id: typedCompanyId },
      timeToLive: Duration.minutes(5)
    }),
    [typedCompanyId]
  )
  const companyResult = useAtomValue(companyQueryAtom)

  // Determine default currency
  const defaultCurrency: CurrencyCode = React.useMemo(() => {
    if (Result.isSuccess(companyResult)) {
      return companyResult.value.functionalCurrency
    }
    return CurrencyCodeSchema.make("USD")
  }, [companyResult])

  // Form state
  const [formState, setFormState] = React.useState<JournalEntryFormState>(() =>
    createInitialFormState(typedCompanyId, defaultCurrency)
  )

  // Validation state
  const [validationErrors, setValidationErrors] = React.useState<JournalEntryFormErrors>({
    lineErrors: []
  })
  const [showValidation, setShowValidation] = React.useState(false)

  // Mutations
  const createEntry = useAtomSet(createJournalEntryMutation)

  // Update company ID when it changes
  React.useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      companyId: typedCompanyId
    }))
  }, [typedCompanyId])

  // Update currency when company data loads
  React.useEffect(() => {
    if (Result.isSuccess(companyResult)) {
      const currency = companyResult.value.functionalCurrency
      setFormState((prev) => ({
        ...prev,
        lines: prev.lines.map((line) => ({
          ...line,
          currencyCode: currency
        }))
      }))
    }
  }, [companyResult])

  // Form update handlers
  const updateField = <K extends keyof JournalEntryFormState>(
    field: K,
    value: JournalEntryFormState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const updateLine = (lineId: string, updates: Partial<JournalEntryFormLine>) => {
    setFormState((prev) => ({
      ...prev,
      lines: prev.lines.map((line) =>
        line.id === lineId ? { ...line, ...updates } : line
      )
    }))
  }

  const addLine = () => {
    setFormState((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        createEmptyLine(prev.lines.length + 1, defaultCurrency)
      ]
    }))
  }

  const removeLine = (lineId: string) => {
    setFormState((prev) => {
      const newLines = prev.lines.filter((line) => line.id !== lineId)
      // Re-number lines
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
    const errors = validateForm(formState)
    setValidationErrors(errors)
    setShowValidation(true)
    return !hasValidationErrors(errors)
  }

  // Save as draft
  const handleSaveAsDraft = async () => {
    if (!runValidation()) {
      return
    }

    setFormState((prev) => ({ ...prev, isSubmitting: true, error: null }))

    try {
      const request = formStateToCreateRequest(formState)
      await createEntry({ payload: request })
      navigate({
        to: "/companies/$companyId/accounts",
        params: { companyId }
      })
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err instanceof Error ? err.message : "Failed to save journal entry"
      }))
    }
  }

  // Submit for approval
  // Note: The submit for approval workflow requires first creating the entry then submitting
  // For now we just create as draft - the user can submit for approval from the list view
  const handleSubmitForApproval = async () => {
    if (!runValidation()) {
      return
    }

    setFormState((prev) => ({ ...prev, isSubmitting: true, error: null }))

    try {
      // Create the entry as draft
      const request = formStateToCreateRequest(formState)
      await createEntry({ payload: request })

      // Navigate back - user can submit for approval from the entry list/detail view
      navigate({
        to: "/companies/$companyId/accounts",
        params: { companyId }
      })
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err instanceof Error ? err.message : "Failed to create journal entry"
      }))
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

  // Loading state for company
  const isLoadingCompany = Result.isInitial(companyResult) || Result.isWaiting(companyResult)

  if (isLoadingCompany) {
    return (
      <div style={pageStyles}>
        <div style={{ textAlign: "center", padding: "48px", color: "#666" }}>
          Loading company details...
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div>
          <h1 style={{ margin: 0 }}>New Journal Entry</h1>
          <p style={{ color: "#666", margin: "8px 0 0" }}>
            Company: {Result.isSuccess(companyResult) ? companyResult.value.name : companyId}
          </p>
        </div>
        <div style={buttonGroupStyles}>
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
            onClick={handleSaveAsDraft}
            style={secondaryButtonStyles}
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting ? "Saving..." : "Save as Draft"}
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
      </div>

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
            />
          </div>
        </div>
      </div>

      {/* Journal Lines Section */}
      <div style={formSectionStyles}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>Journal Lines</h2>
          <button
            type="button"
            onClick={addLine}
            style={secondaryButtonStyles}
          >
            + Add Line
          </button>
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
              />
            ))}
          </tbody>
        </table>

        {/* Running Balance */}
        <RunningBalanceDisplay lines={formState.lines} />
      </div>

      {/* Bottom Actions */}
      <div style={{ ...buttonGroupStyles, marginTop: "24px" }}>
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
          onClick={handleSaveAsDraft}
          style={secondaryButtonStyles}
          disabled={formState.isSubmitting}
        >
          {formState.isSubmitting ? "Saving..." : "Save as Draft"}
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
    </div>
  )
}
