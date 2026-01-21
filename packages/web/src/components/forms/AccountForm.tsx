/**
 * AccountForm Component
 *
 * A reusable form for creating and editing GL accounts with all API fields.
 * Includes account number validation for type range (1xxx=Asset, 2xxx=Liability, etc.)
 */

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "@tanstack/react-router"
import { api } from "@/api/client"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox"
import { Button } from "@/components/ui/Button"

// =============================================================================
// Types
// =============================================================================

export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
export type AccountCategory =
  | "CurrentAsset"
  | "NonCurrentAsset"
  | "FixedAsset"
  | "IntangibleAsset"
  | "CurrentLiability"
  | "NonCurrentLiability"
  | "ContributedCapital"
  | "RetainedEarnings"
  | "OtherComprehensiveIncome"
  | "TreasuryStock"
  | "OperatingRevenue"
  | "OtherRevenue"
  | "CostOfGoodsSold"
  | "OperatingExpense"
  | "DepreciationAmortization"
  | "InterestExpense"
  | "TaxExpense"
  | "OtherExpense"
export type NormalBalance = "Debit" | "Credit"
export type CashFlowCategory = "Operating" | "Investing" | "Financing" | "NonCash"

export interface Account {
  readonly id: string
  readonly companyId: string
  readonly accountNumber: string
  readonly name: string
  readonly description: string | null
  readonly accountType: AccountType
  readonly accountCategory: AccountCategory
  readonly normalBalance: NormalBalance
  readonly parentAccountId: string | null
  readonly hierarchyLevel: number
  readonly isPostable: boolean
  readonly isCashFlowRelevant: boolean
  readonly cashFlowCategory: CashFlowCategory | null
  readonly isIntercompany: boolean
  readonly intercompanyPartnerId: string | null
  readonly currencyRestriction: string | null
  readonly isActive: boolean
  readonly createdAt: {
    readonly epochMillis: number
  }
}

interface AccountFormProps {
  readonly mode: "create" | "edit"
  readonly organizationId: string
  readonly companyId: string
  readonly accounts: readonly Account[]
  readonly initialData?: Account
  readonly onSuccess: () => void
  readonly onCancel: () => void
}

// =============================================================================
// Type Guards
// =============================================================================

const ACCOUNT_TYPES: readonly AccountType[] = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense"
]
const NORMAL_BALANCES: readonly NormalBalance[] = ["Debit", "Credit"]
const CASH_FLOW_CATEGORIES: readonly CashFlowCategory[] = [
  "Operating",
  "Investing",
  "Financing",
  "NonCash"
]

function isAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPES.some((t) => t === value)
}

function isNormalBalance(value: string): value is NormalBalance {
  return NORMAL_BALANCES.some((t) => t === value)
}

function isCashFlowCategory(value: string): value is CashFlowCategory {
  return CASH_FLOW_CATEGORIES.some((t) => t === value)
}

// =============================================================================
// Account Number Validation
// =============================================================================

/**
 * Account number ranges by account type:
 * - 1xxx = Asset
 * - 2xxx = Liability
 * - 3xxx = Equity
 * - 4xxx = Revenue
 * - 5xxx-9xxx = Expense
 */
export function getExpectedAccountNumberRange(type: AccountType): { min: number; max: number } {
  switch (type) {
    case "Asset":
      return { min: 1000, max: 1999 }
    case "Liability":
      return { min: 2000, max: 2999 }
    case "Equity":
      return { min: 3000, max: 3999 }
    case "Revenue":
      return { min: 4000, max: 4999 }
    case "Expense":
      return { min: 5000, max: 9999 }
  }
}

export function validateAccountNumber(
  accountNumber: string,
  accountType: AccountType
): { isValid: boolean; error?: string } {
  const trimmed = accountNumber.trim()

  // Check if it's a 4-digit number
  if (!/^\d{4}$/.test(trimmed)) {
    return { isValid: false, error: "Account number must be exactly 4 digits" }
  }

  const numValue = parseInt(trimmed, 10)
  const { min, max } = getExpectedAccountNumberRange(accountType)

  if (numValue < min || numValue > max) {
    return {
      isValid: false,
      error: `${accountType} accounts must have numbers between ${min} and ${max}`
    }
  }

  return { isValid: true }
}

export function suggestAccountTypeFromNumber(accountNumber: string): AccountType | null {
  const trimmed = accountNumber.trim()
  if (!/^\d{4}$/.test(trimmed)) return null

  const numValue = parseInt(trimmed, 10)

  if (numValue >= 1000 && numValue <= 1999) return "Asset"
  if (numValue >= 2000 && numValue <= 2999) return "Liability"
  if (numValue >= 3000 && numValue <= 3999) return "Equity"
  if (numValue >= 4000 && numValue <= 4999) return "Revenue"
  if (numValue >= 5000 && numValue <= 9999) return "Expense"

  return null
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getCategoriesForType(type: AccountType): AccountCategory[] {
  const typeCategories: Record<AccountType, AccountCategory[]> = {
    Asset: ["CurrentAsset", "NonCurrentAsset", "FixedAsset", "IntangibleAsset"],
    Liability: ["CurrentLiability", "NonCurrentLiability"],
    Equity: [
      "ContributedCapital",
      "RetainedEarnings",
      "OtherComprehensiveIncome",
      "TreasuryStock"
    ],
    Revenue: ["OperatingRevenue", "OtherRevenue"],
    Expense: [
      "CostOfGoodsSold",
      "OperatingExpense",
      "DepreciationAmortization",
      "InterestExpense",
      "TaxExpense",
      "OtherExpense"
    ]
  }
  return typeCategories[type]
}

export function getDefaultNormalBalance(type: AccountType): NormalBalance {
  const defaults: Record<AccountType, NormalBalance> = {
    Asset: "Debit",
    Liability: "Credit",
    Equity: "Credit",
    Revenue: "Credit",
    Expense: "Debit"
  }
  return defaults[type]
}

export function formatAccountCategory(category: AccountCategory): string {
  const names: Record<AccountCategory, string> = {
    CurrentAsset: "Current Asset",
    NonCurrentAsset: "Non-Current Asset",
    FixedAsset: "Fixed Asset",
    IntangibleAsset: "Intangible Asset",
    CurrentLiability: "Current Liability",
    NonCurrentLiability: "Non-Current Liability",
    ContributedCapital: "Contributed Capital",
    RetainedEarnings: "Retained Earnings",
    OtherComprehensiveIncome: "Other Comprehensive Income",
    TreasuryStock: "Treasury Stock",
    OperatingRevenue: "Operating Revenue",
    OtherRevenue: "Other Revenue",
    CostOfGoodsSold: "Cost of Goods Sold",
    OperatingExpense: "Operating Expense",
    DepreciationAmortization: "Depreciation & Amortization",
    InterestExpense: "Interest Expense",
    TaxExpense: "Tax Expense",
    OtherExpense: "Other Expense"
  }
  return names[category]
}

// =============================================================================
// AccountForm Component
// =============================================================================

export function AccountForm({
  mode,
  organizationId,
  companyId,
  accounts,
  initialData,
  onSuccess,
  onCancel
}: AccountFormProps) {
  const router = useRouter()

  // Form state
  const [accountNumber, setAccountNumber] = useState(initialData?.accountNumber ?? "")
  const [name, setName] = useState(initialData?.name ?? "")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [accountType, setAccountType] = useState<AccountType>(
    initialData?.accountType ?? "Asset"
  )
  const [accountCategory, setAccountCategory] = useState<AccountCategory>(
    initialData?.accountCategory ?? "CurrentAsset"
  )
  const [normalBalance, setNormalBalance] = useState<NormalBalance>(
    initialData?.normalBalance ?? "Debit"
  )
  const [parentAccountId, setParentAccountId] = useState(
    initialData?.parentAccountId ?? ""
  )
  const [isPostable, setIsPostable] = useState(initialData?.isPostable ?? true)
  const [isCashFlowRelevant, setIsCashFlowRelevant] = useState(
    initialData?.isCashFlowRelevant ?? false
  )
  const [cashFlowCategory, setCashFlowCategory] = useState<CashFlowCategory | "">(
    initialData?.cashFlowCategory ?? ""
  )
  const [isIntercompany, setIsIntercompany] = useState(
    initialData?.isIntercompany ?? false
  )

  // Validation state
  const [accountNumberError, setAccountNumberError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Available categories based on account type
  const availableCategories = getCategoriesForType(accountType)

  // Handle account type change - update category and normal balance defaults
  const handleTypeChange = (newType: AccountType) => {
    setAccountType(newType)
    setAccountCategory(getCategoriesForType(newType)[0])
    setNormalBalance(getDefaultNormalBalance(newType))

    // Re-validate account number for new type
    if (accountNumber) {
      const validation = validateAccountNumber(accountNumber, newType)
      setAccountNumberError(validation.isValid ? null : validation.error ?? null)
    }
  }

  // Handle account number change - validate and suggest type
  const handleAccountNumberChange = (value: string) => {
    setAccountNumber(value)

    // Clear error while typing
    if (value.length < 4) {
      setAccountNumberError(null)
      return
    }

    // Validate when 4 digits entered
    if (value.length === 4 && /^\d{4}$/.test(value)) {
      // In create mode, suggest type based on number
      if (mode === "create") {
        const suggestedType = suggestAccountTypeFromNumber(value)
        if (suggestedType && suggestedType !== accountType) {
          handleTypeChange(suggestedType)
          setAccountNumberError(null)
          return
        }
      }

      // Validate against current type
      const validation = validateAccountNumber(value, accountType)
      setAccountNumberError(validation.isValid ? null : validation.error ?? null)
    }
  }

  // Validate account number when type changes
  useEffect(() => {
    if (accountNumber && accountNumber.length === 4) {
      const validation = validateAccountNumber(accountNumber, accountType)
      setAccountNumberError(validation.isValid ? null : validation.error ?? null)
    }
  }, [accountType, accountNumber])

  // Get available parent accounts (filter out current account and its descendants in edit mode)
  const availableParents = useMemo(() => {
    if (mode === "create") {
      return accounts.filter((acc) => acc.isActive)
    }

    // In edit mode, filter out current account and its descendants
    const getDescendantIds = (accountId: string): Set<string> => {
      const descendants = new Set<string>()
      const stack = [accountId]
      while (stack.length > 0) {
        const currentId = stack.pop()!
        descendants.add(currentId)
        for (const acc of accounts) {
          if (acc.parentAccountId === currentId && !descendants.has(acc.id)) {
            stack.push(acc.id)
          }
        }
      }
      return descendants
    }

    const descendantIds = initialData ? getDescendantIds(initialData.id) : new Set<string>()
    return accounts.filter((acc) => acc.isActive && !descendantIds.has(acc.id))
  }, [accounts, mode, initialData])

  // Convert available parents to Combobox options
  const parentAccountOptions: ComboboxOption[] = useMemo(() => {
    const sorted = [...availableParents].sort((a, b) =>
      a.accountNumber.localeCompare(b.accountNumber)
    )
    return [
      { value: "", label: "None (Top-level account)" },
      ...sorted.map((acc) => ({
        value: acc.id,
        label: `${acc.accountNumber} - ${acc.name}`,
        searchText: `${acc.accountNumber} ${acc.name} ${acc.description ?? ""}`
      }))
    ]
  }, [availableParents])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    const trimmedNumber = accountNumber.trim()
    const trimmedName = name.trim()

    // Validate required fields
    if (mode === "create" && !trimmedNumber) {
      setError("Account number is required")
      return
    }

    if (!trimmedName) {
      setError("Account name is required")
      return
    }

    // Validate account number format and range (create mode only)
    if (mode === "create") {
      const validation = validateAccountNumber(trimmedNumber, accountType)
      if (!validation.isValid) {
        setAccountNumberError(validation.error ?? null)
        setError(validation.error ?? "Invalid account number")
        return
      }
    }

    // Validate cash flow category if relevant
    if (isCashFlowRelevant && !cashFlowCategory) {
      setError("Cash flow category is required when account is cash flow relevant")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (mode === "create") {
        const { error: apiError } = await api.POST("/api/v1/accounts", {
          body: {
            organizationId,
            companyId,
            accountNumber: trimmedNumber,
            name: trimmedName,
            description: description.trim() || null,
            accountType,
            accountCategory,
            normalBalance,
            parentAccountId: parentAccountId || null,
            isPostable,
            isCashFlowRelevant,
            cashFlowCategory: isCashFlowRelevant && cashFlowCategory ? cashFlowCategory : null,
            isIntercompany,
            intercompanyPartnerId: null,
            currencyRestriction: null
          }
        })

        if (apiError) {
          handleApiError(apiError)
          return
        }
      } else if (initialData) {
        const { error: apiError } = await api.PUT("/api/v1/accounts/organizations/{organizationId}/accounts/{id}", {
          params: { path: { organizationId, id: initialData.id } },
          body: {
            name: trimmedName,
            description: description.trim() || null,
            parentAccountId: parentAccountId || null,
            isPostable,
            isCashFlowRelevant,
            cashFlowCategory:
              isCashFlowRelevant && cashFlowCategory ? cashFlowCategory : null,
            isIntercompany,
            intercompanyPartnerId: null,
            currencyRestriction: null,
            isActive: null,
            isRetainedEarnings: null
          }
        })

        if (apiError) {
          handleApiError(apiError)
          return
        }
      }

      await router.invalidate()
      onSuccess()
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleApiError = (apiError: unknown) => {
    let errorMessage = mode === "create" ? "Failed to create account" : "Failed to update account"
    if (typeof apiError === "object" && apiError !== null) {
      if ("message" in apiError && typeof apiError.message === "string") {
        errorMessage = apiError.message
      }
    }
    setError(errorMessage)
    setIsSubmitting(false)
  }

  const isCreateMode = mode === "create"
  const submitLabel = isCreateMode ? "Create Account" : "Save Changes"

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="account-form">
      {/* Error Message */}
      {error && (
        <div
          role="alert"
          data-testid="account-form-error"
          className="rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Read-only info for edit mode */}
      {!isCreateMode && initialData && (
        <div className="rounded-lg bg-gray-50 p-4" data-testid="account-readonly-info">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Account Number:</span>
              <span className="ml-2 font-mono font-medium text-gray-900">
                {initialData.accountNumber}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 font-medium text-gray-900">
                {initialData.accountType}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Category:</span>
              <span className="ml-2 font-medium text-gray-900">
                {formatAccountCategory(initialData.accountCategory)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Account Number & Name (create mode) */}
      {isCreateMode && (
        <div className="grid grid-cols-3 gap-4">
          <Input
            id="account-number"
            label="Account Number"
            type="text"
            autoFocus
            required
            maxLength={4}
            value={accountNumber}
            onChange={(e) => handleAccountNumberChange(e.target.value)}
            disabled={isSubmitting}
            placeholder="1000"
            helperText="1xxx=Asset, 2xxx=Liability, 3xxx=Equity, 4xxx=Revenue, 5xxx-9xxx=Expense"
            data-testid="account-number-input"
            {...(accountNumberError ? { error: accountNumberError } : {})}
          />
          <Input
            id="account-name"
            label="Account Name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="Cash and Cash Equivalents"
            containerClassName="col-span-2"
            data-testid="account-name-input"
          />
        </div>
      )}

      {/* Name field (edit mode only) */}
      {!isCreateMode && (
        <Input
          id="account-name"
          label="Account Name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
          data-testid="account-name-input"
        />
      )}

      {/* Description */}
      <div>
        <label
          htmlFor="account-description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description (optional)
        </label>
        <textarea
          id="account-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
          rows={2}
          placeholder="Describe the purpose of this account..."
          data-testid="account-description-input"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
        />
      </div>

      {/* Type, Category, Normal Balance (create mode only) */}
      {isCreateMode && (
        <div className="grid grid-cols-3 gap-4">
          <Select
            id="account-type"
            label="Account Type"
            value={accountType}
            onChange={(e) => {
              const value = e.target.value
              if (isAccountType(value)) {
                handleTypeChange(value)
              }
            }}
            disabled={isSubmitting}
            data-testid="account-type-select"
          >
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Equity">Equity</option>
            <option value="Revenue">Revenue</option>
            <option value="Expense">Expense</option>
          </Select>
          <Select
            id="account-category"
            label="Category"
            value={accountCategory}
            onChange={(e) => {
              const value = e.target.value
              const found = availableCategories.find((cat) => cat === value)
              if (found) {
                setAccountCategory(found)
              }
            }}
            disabled={isSubmitting}
            data-testid="account-category-select"
          >
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {formatAccountCategory(cat)}
              </option>
            ))}
          </Select>
          <Select
            id="account-normal-balance"
            label="Normal Balance"
            value={normalBalance}
            onChange={(e) => {
              const value = e.target.value
              if (isNormalBalance(value)) {
                setNormalBalance(value)
              }
            }}
            disabled={isSubmitting}
            helperText="Can override for contra accounts"
            data-testid="account-normal-balance-select"
          >
            <option value="Debit">Debit</option>
            <option value="Credit">Credit</option>
          </Select>
        </div>
      )}

      {/* Parent Account */}
      <div>
        <label
          htmlFor="account-parent"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Parent Account (optional)
        </label>
        <Combobox
          value={parentAccountId}
          onChange={setParentAccountId}
          options={parentAccountOptions}
          placeholder="Search accounts..."
          disabled={isSubmitting}
          data-testid="account-parent-select"
        />
      </div>

      {/* Checkboxes Row 1 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <input
            id="account-is-postable"
            type="checkbox"
            checked={isPostable}
            onChange={(e) => setIsPostable(e.target.checked)}
            disabled={isSubmitting}
            data-testid="account-is-postable-checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="account-is-postable" className="text-sm text-gray-700">
            Postable (can receive journal entries)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="account-is-intercompany"
            type="checkbox"
            checked={isIntercompany}
            onChange={(e) => setIsIntercompany(e.target.checked)}
            disabled={isSubmitting}
            data-testid="account-is-intercompany-checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="account-is-intercompany" className="text-sm text-gray-700">
            Intercompany account
          </label>
        </div>
      </div>

      {/* Checkboxes Row 2 - Cash Flow */}
      <div className="flex items-center gap-2">
        <input
          id="account-is-cash-flow-relevant"
          type="checkbox"
          checked={isCashFlowRelevant}
          onChange={(e) => setIsCashFlowRelevant(e.target.checked)}
          disabled={isSubmitting}
          data-testid="account-is-cash-flow-relevant-checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label
          htmlFor="account-is-cash-flow-relevant"
          className="text-sm text-gray-700"
        >
          Cash flow relevant
        </label>
      </div>

      {/* Cash Flow Category (conditional) */}
      {isCashFlowRelevant && (
        <Select
          id="account-cash-flow-category"
          label="Cash Flow Category"
          value={cashFlowCategory}
          onChange={(e) => {
            const value = e.target.value
            if (value === "" || isCashFlowCategory(value)) {
              setCashFlowCategory(value)
            }
          }}
          disabled={isSubmitting}
          placeholder="Select category..."
          data-testid="account-cash-flow-category-select"
        >
          <option value="">Select category...</option>
          <option value="Operating">Operating</option>
          <option value="Investing">Investing</option>
          <option value="Financing">Financing</option>
          <option value="NonCash">Non-Cash</option>
        </Select>
      )}

      {/* Form Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
          data-testid="account-form-cancel-button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting || (isCreateMode && !!accountNumberError)}
          className="flex-1"
          data-testid="account-form-submit-button"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

// =============================================================================
// Modal Wrapper Components
// =============================================================================

interface AccountFormModalProps {
  readonly mode: "create" | "edit"
  readonly organizationId: string
  readonly companyId: string
  readonly accounts: readonly Account[]
  readonly initialData?: Account
  readonly onClose: () => void
}

export function AccountFormModal({
  mode,
  organizationId,
  companyId,
  accounts,
  initialData,
  onClose
}: AccountFormModalProps) {
  const title = mode === "create" ? "Create Account" : "Edit Account"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        data-testid="account-form-modal"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
        <AccountForm
          mode={mode}
          organizationId={organizationId}
          companyId={companyId}
          accounts={accounts}
          {...(initialData !== undefined ? { initialData } : {})}
          onSuccess={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
