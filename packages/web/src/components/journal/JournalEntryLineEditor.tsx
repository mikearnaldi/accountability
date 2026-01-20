/**
 * JournalEntryLineEditor Component
 *
 * A component for editing a single journal entry line item.
 * Supports account selection via searchable dropdown, debit/credit amounts,
 * memo field, and delete functionality.
 */

import { useMemo } from "react"
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox"
import { Input } from "@/components/ui/Input"

// =============================================================================
// Types
// =============================================================================

export interface Account {
  readonly id: string
  readonly accountNumber: string
  readonly name: string
  readonly accountType: string
  readonly isPostable: boolean
}

export interface JournalEntryLine {
  readonly id: string
  readonly accountId: string
  readonly debitAmount: string
  readonly creditAmount: string
  readonly memo: string
  readonly currency: string
}

interface JournalEntryLineEditorProps {
  readonly line: JournalEntryLine
  readonly lineIndex: number
  readonly accounts: readonly Account[]
  readonly currency: string
  readonly onUpdate: (lineId: string, field: keyof JournalEntryLine, value: string) => void
  readonly onDelete: (lineId: string) => void
  readonly canDelete: boolean
  readonly disabled?: boolean
}

// =============================================================================
// JournalEntryLineEditor Component
// =============================================================================

export function JournalEntryLineEditor({
  line,
  lineIndex,
  accounts,
  currency,
  onUpdate,
  onDelete,
  canDelete,
  disabled = false
}: JournalEntryLineEditorProps) {
  // Filter to only postable accounts
  const postableAccounts = useMemo(
    () => accounts.filter((acc) => acc.isPostable),
    [accounts]
  )

  // Get selected account for display
  const selectedAccount = useMemo(
    () => postableAccounts.find((acc) => acc.id === line.accountId),
    [postableAccounts, line.accountId]
  )

  // Convert accounts to combobox options
  const accountOptions: ComboboxOption[] = useMemo(
    () =>
      postableAccounts
        .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
        .map((acc) => ({
          value: acc.id,
          label: `${acc.accountNumber} - ${acc.name}`,
          searchText: `${acc.accountType}` // Also search by account type
        })),
    [postableAccounts]
  )

  // Handle debit/credit input - clear the other field if entering a value
  const handleDebitChange = (value: string) => {
    onUpdate(line.id, "debitAmount", value)
    if (value && value !== "0" && value !== "0.00") {
      onUpdate(line.id, "creditAmount", "")
    }
  }

  const handleCreditChange = (value: string) => {
    onUpdate(line.id, "creditAmount", value)
    if (value && value !== "0" && value !== "0.00") {
      onUpdate(line.id, "debitAmount", "")
    }
  }

  return (
    <div
      className="grid grid-cols-[2.5rem_1fr_1fr_8rem_8rem_2.5rem] items-start gap-2 border-b border-gray-100 px-2 py-2 hover:bg-gray-50"
      data-testid={`journal-entry-line-${lineIndex}`}
    >
      {/* Line Number */}
      <div className="flex h-9 items-center justify-center text-sm font-medium text-gray-500">
        {lineIndex + 1}
      </div>

      {/* Account Selector */}
      <div>
        <Combobox
          value={line.accountId}
          onChange={(value) => onUpdate(line.id, "accountId", value)}
          options={accountOptions}
          disabled={disabled}
          placeholder="Search accounts..."
          data-testid={`journal-entry-line-account-${lineIndex}`}
          className="text-sm"
        />
        {/* Account type shown below select */}
        {selectedAccount && (
          <span className="mt-0.5 block text-xs text-gray-500">
            {selectedAccount.accountType}
          </span>
        )}
      </div>

      {/* Memo */}
      <div>
        <Input
          type="text"
          value={line.memo}
          onChange={(e) => onUpdate(line.id, "memo", e.target.value)}
          disabled={disabled}
          placeholder="Memo"
          data-testid={`journal-entry-line-memo-${lineIndex}`}
          className="py-1.5 text-sm"
        />
      </div>

      {/* Debit Amount */}
      <div>
        <Input
          type="text"
          inputMode="decimal"
          value={line.debitAmount}
          onChange={(e) => handleDebitChange(e.target.value)}
          disabled={disabled}
          placeholder="0.00"
          data-testid={`journal-entry-line-debit-${lineIndex}`}
          inputPrefix={<span className="text-sm text-gray-500">{currency}</span>}
          className="py-1.5 pr-2 text-right text-sm"
        />
      </div>

      {/* Credit Amount */}
      <div>
        <Input
          type="text"
          inputMode="decimal"
          value={line.creditAmount}
          onChange={(e) => handleCreditChange(e.target.value)}
          disabled={disabled}
          placeholder="0.00"
          data-testid={`journal-entry-line-credit-${lineIndex}`}
          inputPrefix={<span className="text-sm text-gray-500">{currency}</span>}
          className="py-1.5 pr-2 text-right text-sm"
        />
      </div>

      {/* Delete Button */}
      <div className="flex h-9 items-center justify-center">
        <button
          type="button"
          onClick={() => onDelete(line.id)}
          disabled={!canDelete || disabled}
          data-testid={`journal-entry-line-delete-${lineIndex}`}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          title={canDelete ? "Remove line" : "Minimum 2 lines required"}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
