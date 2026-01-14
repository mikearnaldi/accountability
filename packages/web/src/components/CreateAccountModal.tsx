/**
 * CreateAccountModal - Modal component for creating new accounts
 *
 * Form fields:
 * - Account Number
 * - Name
 * - Description (optional)
 * - Account Type
 * - Account Category (filtered by type)
 * - Normal Balance
 * - Parent Account (optional, for hierarchy)
 * - Is Postable
 * - Cash Flow settings
 * - Intercompany settings
 */

import * as React from "react"
import { useState, useCallback, useEffect, useMemo } from "react"
import { useAtom, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import {
  createAccountMutation,
  accountsByCompanyFamily,
  type CreateAccountInput
} from "../atoms/accounts.ts"
import type {
  AccountType,
  AccountCategory,
  NormalBalance,
  CashFlowCategory
} from "@accountability/core/Domains/Account"
import {
  getCategoriesForType,
  getNormalBalanceForType
} from "@accountability/core/Domains/Account"

// =============================================================================
// Constants
// =============================================================================

const ACCOUNT_TYPES: ReadonlyArray<AccountType> = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense"
]

const CASH_FLOW_CATEGORIES: ReadonlyArray<CashFlowCategory> = [
  "Operating",
  "Investing",
  "Financing",
  "NonCash"
]

const CATEGORY_LABELS: Record<AccountCategory, string> = {
  // Asset categories
  CurrentAsset: "Current Asset",
  NonCurrentAsset: "Non-Current Asset",
  FixedAsset: "Fixed Asset",
  IntangibleAsset: "Intangible Asset",
  // Liability categories
  CurrentLiability: "Current Liability",
  NonCurrentLiability: "Non-Current Liability",
  // Equity categories
  ContributedCapital: "Contributed Capital",
  RetainedEarnings: "Retained Earnings",
  OtherComprehensiveIncome: "Other Comprehensive Income",
  TreasuryStock: "Treasury Stock",
  // Revenue categories
  OperatingRevenue: "Operating Revenue",
  OtherRevenue: "Other Revenue",
  // Expense categories
  CostOfGoodsSold: "Cost of Goods Sold",
  OperatingExpense: "Operating Expense",
  DepreciationAmortization: "Depreciation & Amortization",
  InterestExpense: "Interest Expense",
  TaxExpense: "Tax Expense",
  OtherExpense: "Other Expense"
}

// =============================================================================
// Type Guards
// =============================================================================

const isAccountType = (value: string): value is AccountType =>
  value === "Asset" ||
  value === "Liability" ||
  value === "Equity" ||
  value === "Revenue" ||
  value === "Expense"

const isAccountCategory = (value: string): value is AccountCategory =>
  Object.keys(CATEGORY_LABELS).includes(value)

const isNormalBalance = (value: string): value is NormalBalance =>
  value === "Debit" || value === "Credit"

const isCashFlowCategory = (value: string): value is CashFlowCategory =>
  value === "Operating" ||
  value === "Investing" ||
  value === "Financing" ||
  value === "NonCash"

// =============================================================================
// Modal Component
// =============================================================================

interface CreateAccountModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly companyId: string
}

export function CreateAccountModal({
  isOpen,
  onClose,
  companyId
}: CreateAccountModalProps) {
  // Form state
  const [accountNumber, setAccountNumber] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [accountType, setAccountType] = useState<AccountType>("Asset")
  const [accountCategory, setAccountCategory] = useState<AccountCategory>("CurrentAsset")
  const [normalBalance, setNormalBalance] = useState<NormalBalance>("Debit")
  const [parentAccountId, setParentAccountId] = useState("")
  const [isPostable, setIsPostable] = useState(true)
  const [isCashFlowRelevant, setIsCashFlowRelevant] = useState(false)
  const [cashFlowCategory, setCashFlowCategory] = useState<CashFlowCategory | "">("")
  const [isIntercompany, setIsIntercompany] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mutation state
  const [mutationResult, createAccount] = useAtom(createAccountMutation, { mode: "promise" })

  // Fetch existing accounts for parent selection
  const accountsAtom = useMemo(() => accountsByCompanyFamily(companyId), [companyId])
  const accountsResult = useAtomValue(accountsAtom)

  const availableParentAccounts = useMemo(() => {
    if (!Result.isSuccess(accountsResult)) return []
    // Only non-postable (summary) accounts can be parents
    return accountsResult.value.accounts.filter((a) => !a.isPostable && a.isActive)
  }, [accountsResult])

  // Get available categories based on selected type
  const availableCategories = useMemo(() => {
    return getCategoriesForType(accountType)
  }, [accountType])

  // Update category when type changes
  useEffect(() => {
    const categories = getCategoriesForType(accountType)
    if (categories.length > 0 && !categories.includes(accountCategory)) {
      setAccountCategory(categories[0])
    }
    // Also update normal balance to match type
    setNormalBalance(getNormalBalanceForType(accountType))
  }, [accountType])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAccountNumber("")
      setName("")
      setDescription("")
      setAccountType("Asset")
      setAccountCategory("CurrentAsset")
      setNormalBalance("Debit")
      setParentAccountId("")
      setIsPostable(true)
      setIsCashFlowRelevant(false)
      setCashFlowCategory("")
      setIsIntercompany(false)
      setError(null)
    }
  }, [isOpen])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      // Validate required fields
      if (!accountNumber.trim()) {
        setError("Account number is required")
        return
      }

      if (!name.trim()) {
        setError("Account name is required")
        return
      }

      // Build input
      const input: CreateAccountInput = {
        companyId,
        accountNumber: accountNumber.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        accountType,
        accountCategory,
        normalBalance,
        parentAccountId: parentAccountId || undefined,
        isPostable,
        isCashFlowRelevant,
        cashFlowCategory: isCashFlowRelevant && cashFlowCategory ? cashFlowCategory : undefined,
        isIntercompany,
        intercompanyPartnerId: undefined, // Not implemented in form yet
        currencyRestriction: undefined // Not implemented in form yet
      }

      try {
        await createAccount(input)
        onClose()
      } catch (err) {
        // Error is handled via mutationResult
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Failed to create account")
        }
      }
    },
    [
      accountNumber,
      name,
      description,
      accountType,
      accountCategory,
      normalBalance,
      parentAccountId,
      isPostable,
      isCashFlowRelevant,
      cashFlowCategory,
      isIntercompany,
      companyId,
      createAccount,
      onClose
    ]
  )

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isSubmitting = Result.isWaiting(mutationResult)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="create-account-modal"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-gray-900">Create Account</h2>
        <p className="mt-1 text-sm text-gray-600">
          Add a new account to your Chart of Accounts.
        </p>

        {error && (
          <div
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            data-testid="create-account-error"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Account Number and Name */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="account-number"
                className="block text-sm font-medium text-gray-700"
              >
                Account Number *
              </label>
              <input
                id="account-number"
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="1000"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="account-number-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="account-name"
                className="block text-sm font-medium text-gray-700"
              >
                Account Name *
              </label>
              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cash and Cash Equivalents"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="account-name-input"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description of the account purpose"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="account-description-input"
            />
          </div>

          {/* Type, Category, Normal Balance */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="account-type"
                className="block text-sm font-medium text-gray-700"
              >
                Account Type *
              </label>
              <select
                id="account-type"
                value={accountType}
                onChange={(e) => {
                  const value = e.target.value
                  if (isAccountType(value)) {
                    setAccountType(value)
                  }
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="account-type-select"
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="account-category"
                className="block text-sm font-medium text-gray-700"
              >
                Category *
              </label>
              <select
                id="account-category"
                value={accountCategory}
                onChange={(e) => {
                  const value = e.target.value
                  if (isAccountCategory(value)) {
                    setAccountCategory(value)
                  }
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="account-category-select"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="normal-balance"
                className="block text-sm font-medium text-gray-700"
              >
                Normal Balance *
              </label>
              <select
                id="normal-balance"
                value={normalBalance}
                onChange={(e) => {
                  const value = e.target.value
                  if (isNormalBalance(value)) {
                    setNormalBalance(value)
                  }
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="normal-balance-select"
              >
                <option value="Debit">Debit</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
          </div>

          {/* Parent Account */}
          <div>
            <label
              htmlFor="parent-account"
              className="block text-sm font-medium text-gray-700"
            >
              Parent Account
            </label>
            <select
              id="parent-account"
              value={parentAccountId}
              onChange={(e) => setParentAccountId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="parent-account-select"
            >
              <option value="">No parent (top-level account)</option>
              {availableParentAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountNumber} - {account.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Only summary (non-postable) accounts can be parents.
            </p>
          </div>

          {/* Account Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Account Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isPostable}
                  onChange={(e) => setIsPostable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="is-postable-checkbox"
                />
                <span className="text-sm text-gray-700">
                  Postable (can receive journal entries)
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isCashFlowRelevant}
                  onChange={(e) => setIsCashFlowRelevant(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="is-cash-flow-checkbox"
                />
                <span className="text-sm text-gray-700">
                  Cash flow relevant
                </span>
              </label>
              {isCashFlowRelevant && (
                <div className="ml-7">
                  <label
                    htmlFor="cash-flow-category"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Cash Flow Category
                  </label>
                  <select
                    id="cash-flow-category"
                    value={cashFlowCategory}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === "" || isCashFlowCategory(value)) {
                        setCashFlowCategory(value)
                      }
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    data-testid="cash-flow-category-select"
                  >
                    <option value="">Select category...</option>
                    {CASH_FLOW_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isIntercompany}
                  onChange={(e) => setIsIntercompany(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="is-intercompany-checkbox"
                />
                <span className="text-sm text-gray-700">
                  Intercompany account
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="create-account-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="create-account-submit"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
