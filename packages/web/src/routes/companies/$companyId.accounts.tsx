/**
 * Chart of Accounts Page Route
 *
 * Route: /companies/:companyId/accounts
 *
 * Displays the Chart of Accounts for a specific company with:
 * - Tree view of accounts with hierarchy
 * - Filtering by account type
 * - Add, edit, and deactivate account functionality
 * - Uses Effect Atom for state management
 *
 * @module routes/companies/$companyId.accounts
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtomSet, useAtom, useAtomRefresh } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import type {
  Account,
  AccountId,
  AccountType,
  AccountCategory,
  NormalBalance,
  CashFlowCategory
} from "@accountability/core/Domains/Account"
import {
  AccountId as AccountIdSchema
} from "@accountability/core/Domains/Account"
import type { CompanyId } from "@accountability/core/Domains/Company"
import { CompanyId as CompanyIdSchema } from "@accountability/core/Domains/Company"
import { CurrencyCode as CurrencyCodeSchema } from "@accountability/core/Domains/CurrencyCode"
import { AccountNumber as AccountNumberSchema } from "@accountability/core/Domains/AccountNumber"
import { ApiClient } from "../../atoms/ApiClient.ts"
import {
  buildHierarchicalList,
  filterBySearch,
  type AccountWithDepth
} from "../../components/AccountSelectorUtils.ts"
import { AuthGuard } from "../../components/AuthGuard.tsx"

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/companies/$companyId/accounts")({
  component: ChartOfAccountsPageWithAuth,
  beforeLoad: async ({ params }) => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: `/companies/${params.companyId}/accounts` },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function ChartOfAccountsPageWithAuth(): React.ReactElement {
  const { companyId } = Route.useParams()
  return (
    <AuthGuard redirectTo={`/companies/${companyId}/accounts`}>
      <ChartOfAccountsPage />
    </AuthGuard>
  )
}

// =============================================================================
// Atoms for this page
// =============================================================================

/**
 * Account type filter atom
 *
 * Controls filtering of accounts by account type.
 * null means show all account types.
 */
const accountTypeFilterAtom = Atom.make<AccountType | null>(null)

/**
 * Search query atom for filtering accounts
 */
const searchQueryAtom = Atom.make("")

/**
 * Create parameterized accounts query atom with reactivity keys for automatic refresh
 */
const createAccountsQueryAtom = (companyId: CompanyId, accountType?: AccountType | null) => {
  const urlParams: {
    companyId: CompanyId
    accountType?: AccountType
    limit: number
    offset: number
  } = {
    companyId,
    limit: 1000,
    offset: 0
  }

  if (accountType !== null && accountType !== undefined) {
    urlParams.accountType = accountType
  }

  return ApiClient.query("accounts", "listAccounts", {
    urlParams,
    timeToLive: Duration.minutes(5),
    reactivityKeys: ["accounts", companyId]  // Will be invalidated by mutations with matching keys
  })
}

// =============================================================================
// Modal State Types
// =============================================================================

interface AddAccountModalState {
  readonly isOpen: boolean
  readonly parentAccountId: AccountId | null
}

interface EditAccountModalState {
  readonly isOpen: boolean
  readonly account: Account | null
}

// =============================================================================
// Form Data Types
// =============================================================================

interface CreateAccountFormData {
  accountNumber: string
  name: string
  description: string
  accountType: AccountType
  accountCategory: AccountCategory
  normalBalance: NormalBalance
  parentAccountId: string | null
  isPostable: boolean
  isCashFlowRelevant: boolean
  cashFlowCategory: CashFlowCategory | null
  isIntercompany: boolean
  intercompanyPartnerId: string | null
  currencyRestriction: string | null
}

interface UpdateAccountFormData {
  name: string
  description: string
  parentAccountId: string | null
  isPostable: boolean
  isCashFlowRelevant: boolean
  cashFlowCategory: CashFlowCategory | null
  isIntercompany: boolean
  intercompanyPartnerId: string | null
  currencyRestriction: string | null
  isActive: boolean
}

// =============================================================================
// Helper Functions
// =============================================================================

const ACCOUNT_TYPES: ReadonlyArray<AccountType> = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense"
]

const ACCOUNT_CATEGORIES: Record<AccountType, ReadonlyArray<AccountCategory>> = {
  Asset: ["CurrentAsset", "NonCurrentAsset", "FixedAsset", "IntangibleAsset"],
  Liability: ["CurrentLiability", "NonCurrentLiability"],
  Equity: ["ContributedCapital", "RetainedEarnings", "OtherComprehensiveIncome", "TreasuryStock"],
  Revenue: ["OperatingRevenue", "OtherRevenue"],
  Expense: ["CostOfGoodsSold", "OperatingExpense", "DepreciationAmortization", "InterestExpense", "TaxExpense", "OtherExpense"]
}

const NORMAL_BALANCE_BY_TYPE: Record<AccountType, NormalBalance> = {
  Asset: "Debit",
  Liability: "Credit",
  Equity: "Credit",
  Revenue: "Credit",
  Expense: "Debit"
}

const CASH_FLOW_CATEGORIES: ReadonlyArray<CashFlowCategory> = [
  "Operating",
  "Investing",
  "Financing",
  "NonCash"
]

const formatCategoryLabel = (category: AccountCategory): string => {
  // Convert camelCase to Title Case with spaces
  return category.replace(/([A-Z])/g, " $1").trim()
}

/**
 * Type guard for AccountType
 * Cast to ReadonlyArray<string> needed because TypeScript's .includes() doesn't accept supertype
 */
const isAccountType = (value: string): value is AccountType =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Widening array type for .includes() check
  (ACCOUNT_TYPES as ReadonlyArray<string>).includes(value)

/**
 * Type guard for AccountCategory
 */
const isAccountCategory = (value: string, accountType: AccountType): value is AccountCategory =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Widening array type for .includes() check
  (ACCOUNT_CATEGORIES[accountType] as ReadonlyArray<string>).includes(value)

/**
 * Type guard for CashFlowCategory
 */
const isCashFlowCategory = (value: string): value is CashFlowCategory =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Widening array type for .includes() check
  (CASH_FLOW_CATEGORIES as ReadonlyArray<string>).includes(value)

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto"
}

const headerStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1.5rem"
}

const filtersStyles: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  marginBottom: "1rem",
  alignItems: "center"
}

const filterSelectStyles: React.CSSProperties = {
  padding: "0.5rem",
  borderRadius: "4px",
  border: "1px solid #ccc",
  minWidth: "150px"
}

const searchInputStyles: React.CSSProperties = {
  padding: "0.5rem",
  borderRadius: "4px",
  border: "1px solid #ccc",
  minWidth: "250px"
}

const buttonStyles: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "4px",
  border: "none",
  backgroundColor: "#1890ff",
  color: "white",
  cursor: "pointer",
  fontWeight: 500
}

const secondaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#f5f5f5",
  color: "#333",
  border: "1px solid #ccc"
}

const dangerButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#ff4d4f",
  color: "white"
}

const tableStyles: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #e8e8e8"
}

const thStyles: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  backgroundColor: "#fafafa",
  borderBottom: "1px solid #e8e8e8",
  fontWeight: 600
}

const tdStyles: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: "1px solid #e8e8e8"
}

const accountRowStyles = (depth: number, isActive: boolean): React.CSSProperties => ({
  paddingLeft: `${depth * 20}px`,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: isActive ? "inherit" : "#999"
})

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
  maxWidth: "600px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto"
}

const formGroupStyles: React.CSSProperties = {
  marginBottom: "1rem"
}

const labelStyles: React.CSSProperties = {
  display: "block",
  marginBottom: "0.25rem",
  fontWeight: 500
}

const inputStyles: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: "4px",
  border: "1px solid #ccc",
  boxSizing: "border-box"
}

const selectStyles: React.CSSProperties = {
  ...inputStyles
}

const checkboxGroupStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem"
}

const buttonGroupStyles: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  justifyContent: "flex-end",
  marginTop: "1.5rem"
}

const statusBadgeStyles = (isActive: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "12px",
  backgroundColor: isActive ? "#e6fffb" : "#fff1f0",
  color: isActive ? "#13c2c2" : "#ff4d4f"
})

const accountNumberStyles: React.CSSProperties = {
  fontFamily: "monospace",
  color: "#666"
}

const accountTypeStyles: React.CSSProperties = {
  fontSize: "12px",
  color: "#666",
  textTransform: "uppercase"
}

const actionsStyles: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem"
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
 * Add Account Modal Component
 */
function AddAccountModal({
  isOpen,
  parentAccountId,
  companyId,
  accounts,
  onClose,
  onSuccess
}: {
  readonly isOpen: boolean
  readonly parentAccountId: AccountId | null
  readonly companyId: CompanyId
  readonly accounts: ReadonlyArray<AccountWithDepth>
  readonly onClose: () => void
  readonly onSuccess: () => void
}): React.ReactElement | null {
  const createAccount = useAtomSet(ApiClient.mutation("accounts", "createAccount"))
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Find parent account to suggest defaults
  const parentAccount = parentAccountId
    ? accounts.find(a => a.account.id === parentAccountId)?.account
    : null

  const [formData, setFormData] = React.useState<CreateAccountFormData>({
    accountNumber: "",
    name: "",
    description: "",
    accountType: parentAccount?.accountType ?? "Asset",
    accountCategory: parentAccount?.accountCategory ?? "CurrentAsset",
    normalBalance: parentAccount?.normalBalance ?? "Debit",
    parentAccountId,
    isPostable: true,
    isCashFlowRelevant: false,
    cashFlowCategory: null,
    isIntercompany: false,
    intercompanyPartnerId: null,
    currencyRestriction: null
  })

  // Update categories when account type changes
  React.useEffect(() => {
    const validCategories = ACCOUNT_CATEGORIES[formData.accountType]
    if (!validCategories.includes(formData.accountCategory)) {
      setFormData(prev => ({
        ...prev,
        accountCategory: validCategories[0],
        normalBalance: NORMAL_BALANCE_BY_TYPE[formData.accountType]
      }))
    }
  }, [formData.accountType, formData.accountCategory])

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        accountNumber: "",
        name: "",
        description: "",
        accountType: parentAccount?.accountType ?? "Asset",
        accountCategory: parentAccount?.accountCategory ?? "CurrentAsset",
        normalBalance: parentAccount?.normalBalance ?? "Debit",
        parentAccountId,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      })
      setError(null)
    }
  }, [isOpen, parentAccountId, parentAccount])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await createAccount({
        payload: {
          companyId,
          accountNumber: AccountNumberSchema.make(formData.accountNumber),
          name: formData.name,
          description: formData.description
            ? Option.some(formData.description)
            : Option.none(),
          accountType: formData.accountType,
          accountCategory: formData.accountCategory,
          normalBalance: formData.normalBalance,
          parentAccountId: formData.parentAccountId
            ? Option.some(AccountIdSchema.make(formData.parentAccountId))
            : Option.none(),
          isPostable: formData.isPostable,
          isCashFlowRelevant: formData.isCashFlowRelevant,
          cashFlowCategory: formData.cashFlowCategory
            ? Option.some(formData.cashFlowCategory)
            : Option.none(),
          isIntercompany: formData.isIntercompany,
          intercompanyPartnerId: formData.intercompanyPartnerId
            ? Option.some(CompanyIdSchema.make(formData.intercompanyPartnerId))
            : Option.none(),
          currencyRestriction: formData.currencyRestriction
            ? Option.some(CurrencyCodeSchema.make(formData.currencyRestriction))
            : Option.none()
        },
        reactivityKeys: ["accounts", companyId]  // Invalidate accounts queries for this company
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={modalOverlayStyles} onClick={onClose}>
      <div style={modalContentStyles} onClick={e => e.stopPropagation()} data-testid="create-account-form">
        <h2 style={{ marginTop: 0 }}>Add New Account</h2>
        {error && (
          <div style={{ color: "#ff4d4f", marginBottom: "1rem" }} data-testid="form-error">{error}</div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={formGroupStyles}>
            <label style={labelStyles}>Account Number *</label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={e => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
              style={inputStyles}
              placeholder="e.g., 1000"
              required
              data-testid="account-number-input"
            />
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              style={inputStyles}
              placeholder="e.g., Cash"
              required
              data-testid="account-name-input"
            />
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              style={{ ...inputStyles, minHeight: "60px" }}
              placeholder="Optional description"
              data-testid="account-description-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={formGroupStyles}>
              <label style={labelStyles}>Account Type *</label>
              <select
                value={formData.accountType}
                onChange={e => {
                  const value = e.target.value
                  if (isAccountType(value)) {
                    setFormData(prev => ({ ...prev, accountType: value }))
                  }
                }}
                style={selectStyles}
                disabled={parentAccount !== null}
                data-testid="account-type-select"
              >
                {ACCOUNT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div style={formGroupStyles}>
              <label style={labelStyles}>Category *</label>
              <select
                value={formData.accountCategory}
                onChange={e => {
                  const value = e.target.value
                  if (isAccountCategory(value, formData.accountType)) {
                    setFormData(prev => ({ ...prev, accountCategory: value }))
                  }
                }}
                style={selectStyles}
                data-testid="account-category-select"
              >
                {ACCOUNT_CATEGORIES[formData.accountType].map(cat => (
                  <option key={cat} value={cat}>{formatCategoryLabel(cat)}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Parent Account</label>
            <select
              value={formData.parentAccountId ?? ""}
              onChange={e => setFormData(prev => ({
                ...prev,
                parentAccountId: e.target.value || null
              }))}
              style={selectStyles}
              data-testid="parent-account-select"
            >
              <option value="">None (Top-level account)</option>
              {accounts
                .filter(a => a.account.accountType === formData.accountType)
                .map(({ account, depth }) => (
                  <option key={account.id} value={account.id}>
                    {"  ".repeat(depth)}{account.accountNumber} - {account.name}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ ...formGroupStyles, ...checkboxGroupStyles }}>
              <input
                type="checkbox"
                id="isPostable"
                checked={formData.isPostable}
                onChange={e => setFormData(prev => ({ ...prev, isPostable: e.target.checked }))}
                data-testid="is-postable-checkbox"
              />
              <label htmlFor="isPostable">Allow posting journal entries</label>
            </div>

            <div style={{ ...formGroupStyles, ...checkboxGroupStyles }}>
              <input
                type="checkbox"
                id="isCashFlowRelevant"
                checked={formData.isCashFlowRelevant}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  isCashFlowRelevant: e.target.checked,
                  cashFlowCategory: e.target.checked ? "Operating" : null
                }))}
                data-testid="is-cash-flow-checkbox"
              />
              <label htmlFor="isCashFlowRelevant">Cash flow relevant</label>
            </div>
          </div>

          {formData.isCashFlowRelevant && (
            <div style={formGroupStyles}>
              <label style={labelStyles}>Cash Flow Category</label>
              <select
                value={formData.cashFlowCategory ?? ""}
                onChange={e => {
                  const value = e.target.value
                  setFormData(prev => ({
                    ...prev,
                    cashFlowCategory: isCashFlowCategory(value) ? value : null
                  }))
                }}
                style={selectStyles}
                data-testid="cash-flow-category-select"
              >
                {CASH_FLOW_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ ...formGroupStyles, ...checkboxGroupStyles }}>
            <input
              type="checkbox"
              id="isIntercompany"
              checked={formData.isIntercompany}
              onChange={e => setFormData(prev => ({
                ...prev,
                isIntercompany: e.target.checked,
                intercompanyPartnerId: e.target.checked ? prev.intercompanyPartnerId : null
              }))}
              data-testid="is-intercompany-checkbox"
            />
            <label htmlFor="isIntercompany">Intercompany account</label>
          </div>

          <div style={buttonGroupStyles}>
            <button
              type="button"
              onClick={onClose}
              style={secondaryButtonStyles}
              disabled={isSubmitting}
              data-testid="cancel-create-account"
            >
              Cancel
            </button>
            <button type="submit" style={buttonStyles} disabled={isSubmitting} data-testid="submit-create-account">
              {isSubmitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Edit Account Modal Component
 */
function EditAccountModal({
  isOpen,
  account,
  accounts,
  onClose,
  onSuccess
}: {
  readonly isOpen: boolean
  readonly account: Account | null
  readonly accounts: ReadonlyArray<AccountWithDepth>
  readonly onClose: () => void
  readonly onSuccess: () => void
}): React.ReactElement | null {
  const updateAccount = useAtomSet(ApiClient.mutation("accounts", "updateAccount"))
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState<UpdateAccountFormData>({
    name: "",
    description: "",
    parentAccountId: null,
    isPostable: true,
    isCashFlowRelevant: false,
    cashFlowCategory: null,
    isIntercompany: false,
    intercompanyPartnerId: null,
    currencyRestriction: null,
    isActive: true
  })

  // Update form data when account changes
  React.useEffect(() => {
    if (account && isOpen) {
      setFormData({
        name: account.name,
        description: account.description._tag === "Some" ? account.description.value : "",
        parentAccountId: account.parentAccountId._tag === "Some" ? account.parentAccountId.value : null,
        isPostable: account.isPostable,
        isCashFlowRelevant: account.isCashFlowRelevant,
        cashFlowCategory: account.cashFlowCategory._tag === "Some" ? account.cashFlowCategory.value : null,
        isIntercompany: account.isIntercompany,
        intercompanyPartnerId: account.intercompanyPartnerId._tag === "Some" ? account.intercompanyPartnerId.value : null,
        currencyRestriction: account.currencyRestriction._tag === "Some" ? account.currencyRestriction.value : null,
        isActive: account.isActive
      })
      setError(null)
    }
  }, [account, isOpen])

  if (!isOpen || !account) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await updateAccount({
        path: { id: account.id },
        payload: {
          name: Option.some(formData.name),
          description: formData.description
            ? Option.some(formData.description)
            : Option.none(),
          parentAccountId: formData.parentAccountId
            ? Option.some(AccountIdSchema.make(formData.parentAccountId))
            : Option.none(),
          isPostable: Option.some(formData.isPostable),
          isCashFlowRelevant: Option.some(formData.isCashFlowRelevant),
          cashFlowCategory: formData.cashFlowCategory
            ? Option.some(formData.cashFlowCategory)
            : Option.none(),
          isIntercompany: Option.some(formData.isIntercompany),
          intercompanyPartnerId: formData.intercompanyPartnerId
            ? Option.some(CompanyIdSchema.make(formData.intercompanyPartnerId))
            : Option.none(),
          currencyRestriction: formData.currencyRestriction
            ? Option.some(CurrencyCodeSchema.make(formData.currencyRestriction))
            : Option.none(),
          isActive: Option.some(formData.isActive)
        },
        reactivityKeys: ["accounts", account.companyId]  // Invalidate accounts queries for this company
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={modalOverlayStyles} onClick={onClose}>
      <div style={modalContentStyles} onClick={e => e.stopPropagation()} data-testid="edit-account-form">
        <h2 style={{ marginTop: 0 }}>Edit Account</h2>
        <p style={{ color: "#666" }}>
          <span style={accountNumberStyles} data-testid="edit-account-number">{account.accountNumber}</span>
          {" - "}
          <span style={accountTypeStyles} data-testid="edit-account-type">{account.accountType}</span>
        </p>
        {error && (
          <div style={{ color: "#ff4d4f", marginBottom: "1rem" }} data-testid="edit-form-error">{error}</div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={formGroupStyles}>
            <label style={labelStyles}>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              style={inputStyles}
              required
              data-testid="edit-account-name-input"
            />
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              style={{ ...inputStyles, minHeight: "60px" }}
              data-testid="edit-account-description-input"
            />
          </div>

          <div style={formGroupStyles}>
            <label style={labelStyles}>Parent Account</label>
            <select
              value={formData.parentAccountId ?? ""}
              onChange={e => setFormData(prev => ({
                ...prev,
                parentAccountId: e.target.value || null
              }))}
              style={selectStyles}
              data-testid="edit-parent-account-select"
            >
              <option value="">None (Top-level account)</option>
              {accounts
                .filter(a => a.account.accountType === account.accountType && a.account.id !== account.id)
                .map(({ account: acc, depth }) => (
                  <option key={acc.id} value={acc.id}>
                    {"  ".repeat(depth)}{acc.accountNumber} - {acc.name}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ ...formGroupStyles, ...checkboxGroupStyles }}>
              <input
                type="checkbox"
                id="editIsPostable"
                checked={formData.isPostable}
                onChange={e => setFormData(prev => ({ ...prev, isPostable: e.target.checked }))}
                data-testid="edit-is-postable-checkbox"
              />
              <label htmlFor="editIsPostable">Allow posting journal entries</label>
            </div>

            <div style={{ ...formGroupStyles, ...checkboxGroupStyles }}>
              <input
                type="checkbox"
                id="editIsCashFlowRelevant"
                checked={formData.isCashFlowRelevant}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  isCashFlowRelevant: e.target.checked,
                  cashFlowCategory: e.target.checked ? (prev.cashFlowCategory ?? "Operating") : null
                }))}
                data-testid="edit-is-cash-flow-checkbox"
              />
              <label htmlFor="editIsCashFlowRelevant">Cash flow relevant</label>
            </div>
          </div>

          {formData.isCashFlowRelevant && (
            <div style={formGroupStyles}>
              <label style={labelStyles}>Cash Flow Category</label>
              <select
                value={formData.cashFlowCategory ?? ""}
                onChange={e => {
                  const value = e.target.value
                  setFormData(prev => ({
                    ...prev,
                    cashFlowCategory: isCashFlowCategory(value) ? value : null
                  }))
                }}
                style={selectStyles}
                data-testid="edit-cash-flow-category-select"
              >
                {CASH_FLOW_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ ...formGroupStyles, ...checkboxGroupStyles }}>
            <input
              type="checkbox"
              id="editIsIntercompany"
              checked={formData.isIntercompany}
              onChange={e => setFormData(prev => ({
                ...prev,
                isIntercompany: e.target.checked
              }))}
              data-testid="edit-is-intercompany-checkbox"
            />
            <label htmlFor="editIsIntercompany">Intercompany account</label>
          </div>

          <div style={{ ...formGroupStyles, ...checkboxGroupStyles }}>
            <input
              type="checkbox"
              id="editIsActive"
              checked={formData.isActive}
              onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              data-testid="edit-is-active-checkbox"
            />
            <label htmlFor="editIsActive">Active</label>
          </div>

          <div style={buttonGroupStyles}>
            <button
              type="button"
              onClick={onClose}
              style={secondaryButtonStyles}
              disabled={isSubmitting}
              data-testid="cancel-edit-account"
            >
              Cancel
            </button>
            <button type="submit" style={buttonStyles} disabled={isSubmitting} data-testid="submit-edit-account">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Deactivate Account Confirmation Modal
 */
function DeactivateAccountModal({
  isOpen,
  account,
  onClose,
  onSuccess
}: {
  readonly isOpen: boolean
  readonly account: Account | null
  readonly onClose: () => void
  readonly onSuccess: () => void
}): React.ReactElement | null {
  const deactivateAccount = useAtomSet(ApiClient.mutation("accounts", "deactivateAccount"))
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!isOpen || !account) return null

  const handleDeactivate = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      await deactivateAccount({
        path: { id: account.id }
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate account")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={modalOverlayStyles} onClick={onClose}>
      <div style={modalContentStyles} onClick={e => e.stopPropagation()} data-testid="deactivate-account-modal">
        <h2 style={{ marginTop: 0 }}>Deactivate Account</h2>
        {error && (
          <div style={{ color: "#ff4d4f", marginBottom: "1rem" }} data-testid="deactivate-error">{error}</div>
        )}
        <p>
          Are you sure you want to deactivate account{" "}
          <strong data-testid="deactivate-account-info">{account.accountNumber} - {account.name}</strong>?
        </p>
        <p style={{ color: "#666" }}>
          This will prevent any new journal entries from being posted to this account.
          The account and its history will be preserved.
        </p>
        <div style={buttonGroupStyles}>
          <button
            type="button"
            onClick={onClose}
            style={secondaryButtonStyles}
            disabled={isSubmitting}
            data-testid="cancel-deactivate-account"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            style={dangerButtonStyles}
            disabled={isSubmitting}
            data-testid="confirm-deactivate-account"
          >
            {isSubmitting ? "Deactivating..." : "Deactivate Account"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Account Row Component
 */
function AccountRow({
  account,
  depth,
  onEdit,
  onDeactivate,
  onAddChild
}: {
  readonly account: Account
  readonly depth: number
  readonly onEdit: (account: Account) => void
  readonly onDeactivate: (account: Account) => void
  readonly onAddChild: (parentId: AccountId) => void
}): React.ReactElement {
  return (
    <tr style={{ opacity: account.isActive ? 1 : 0.6 }} data-testid={`account-row-${account.id}`}>
      <td style={tdStyles}>
        <div style={accountRowStyles(depth, account.isActive)} data-testid={`account-cell-${account.id}`}>
          {depth > 0 && (
            <span style={{ color: "#ccc" }} data-testid={`account-indent-${account.id}`}>{"└"}</span>
          )}
          <span style={accountNumberStyles} data-testid={`account-number-${account.id}`}>{account.accountNumber}</span>
          <span data-testid={`account-name-${account.id}`}>{account.name}</span>
        </div>
      </td>
      <td style={tdStyles}>
        <span style={accountTypeStyles} data-testid={`account-type-${account.id}`}>{account.accountType}</span>
      </td>
      <td style={tdStyles}>
        <span style={{ fontSize: "12px" }} data-testid={`account-category-${account.id}`}>{formatCategoryLabel(account.accountCategory)}</span>
      </td>
      <td style={tdStyles}>
        <span style={{ fontSize: "12px" }} data-testid={`account-normal-balance-${account.id}`}>{account.normalBalance}</span>
      </td>
      <td style={tdStyles}>
        <span style={statusBadgeStyles(account.isActive)} data-testid={`account-status-${account.id}`}>
          {account.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td style={tdStyles} data-testid={`account-postable-${account.id}`}>
        {account.isPostable ? "Yes" : "No"}
      </td>
      <td style={tdStyles}>
        <div style={actionsStyles}>
          <button
            style={smallButtonStyles}
            onClick={() => onEdit(account)}
            title="Edit account"
            data-testid={`edit-account-${account.id}`}
          >
            Edit
          </button>
          {account.isActive && (
            <>
              <button
                style={smallButtonStyles}
                onClick={() => onAddChild(account.id)}
                title="Add sub-account"
                data-testid={`add-sub-account-${account.id}`}
              >
                + Sub
              </button>
              <button
                style={{ ...smallButtonStyles, color: "#ff4d4f", borderColor: "#ff4d4f" }}
                onClick={() => onDeactivate(account)}
                title="Deactivate account"
                data-testid={`deactivate-account-${account.id}`}
              >
                Deactivate
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function ChartOfAccountsPage(): React.ReactElement {
  const { companyId } = Route.useParams()
  const typedCompanyId = CompanyIdSchema.make(companyId)

  // Atom state
  const [accountTypeFilter, setAccountTypeFilter] = useAtom(accountTypeFilterAtom)
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom)

  // Modal state
  const [addModalState, setAddModalState] = React.useState<AddAccountModalState>({
    isOpen: false,
    parentAccountId: null
  })
  const [editModalState, setEditModalState] = React.useState<EditAccountModalState>({
    isOpen: false,
    account: null
  })
  const [deactivateModalState, setDeactivateModalState] = React.useState<EditAccountModalState>({
    isOpen: false,
    account: null
  })

  // Create accounts query atom
  const accountsQueryAtom = React.useMemo(
    () => createAccountsQueryAtom(typedCompanyId, accountTypeFilter),
    [typedCompanyId, accountTypeFilter]
  )

  // Fetch accounts
  const accountsResult = useAtomValue(accountsQueryAtom)

  // Refresh function to refetch accounts after mutations
  const refreshAccounts = useAtomRefresh(accountsQueryAtom)

  // Process accounts into hierarchical list
  const hierarchicalAccounts = React.useMemo(() => {
    if (!Result.isSuccess(accountsResult)) {
      return []
    }
    return buildHierarchicalList(accountsResult.value.accounts)
  }, [accountsResult])

  // Filter accounts by search
  const filteredAccounts = React.useMemo(
    () => filterBySearch(hierarchicalAccounts, searchQuery),
    [hierarchicalAccounts, searchQuery]
  )

  // Event handlers
  const handleOpenAddModal = (parentAccountId: AccountId | null = null) => {
    setAddModalState({ isOpen: true, parentAccountId })
  }

  const handleCloseAddModal = () => {
    setAddModalState({ isOpen: false, parentAccountId: null })
  }

  const handleOpenEditModal = (account: Account) => {
    setEditModalState({ isOpen: true, account })
  }

  const handleCloseEditModal = () => {
    setEditModalState({ isOpen: false, account: null })
  }

  const handleOpenDeactivateModal = (account: Account) => {
    setDeactivateModalState({ isOpen: true, account })
  }

  const handleCloseDeactivateModal = () => {
    setDeactivateModalState({ isOpen: false, account: null })
  }

  const handleSuccess = () => {
    // Trigger refetch using the atom refresh function
    refreshAccounts()
  }

  // Loading state
  const isLoading = Result.isInitial(accountsResult) || Result.isWaiting(accountsResult)
  const hasError = Result.isFailure(accountsResult)

  return (
    <div style={pageStyles} data-testid="accounts-page">
      <div style={headerStyles}>
        <div>
          <h1 style={{ margin: 0 }} data-testid="page-title">Chart of Accounts</h1>
          <p style={{ color: "#666", margin: "0.5rem 0 0" }} data-testid="page-subtitle">
            Company ID: {companyId}
          </p>
        </div>
        <button style={buttonStyles} onClick={() => handleOpenAddModal()} data-testid="create-account-button">
          + Add Account
        </button>
      </div>

      <div style={filtersStyles} data-testid="accounts-filters">
        <select
          value={accountTypeFilter ?? ""}
          onChange={e => {
            const value = e.target.value
            setAccountTypeFilter(isAccountType(value) ? value : null)
          }}
          style={filterSelectStyles}
          data-testid="account-type-filter"
        >
          <option value="">All Account Types</option>
          {ACCOUNT_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search accounts..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={searchInputStyles}
          data-testid="search-accounts-input"
        />

        {(accountTypeFilter || searchQuery) && (
          <button
            style={secondaryButtonStyles}
            onClick={() => {
              setAccountTypeFilter(null)
              setSearchQuery("")
            }}
            data-testid="clear-filters-button"
          >
            Clear Filters
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }} data-testid="accounts-loading">
          Loading accounts...
        </div>
      )}

      {hasError && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#ff4d4f" }} data-testid="accounts-error">
          Error loading accounts. Please try again.
        </div>
      )}

      {!isLoading && !hasError && (
        <>
          {filteredAccounts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#666" }} data-testid="accounts-empty">
              {searchQuery
                ? "No accounts match your search"
                : "No accounts found. Create your first account to get started."}
            </div>
          ) : (
            <table style={tableStyles} data-testid="accounts-table">
              <thead>
                <tr>
                  <th style={thStyles}>Account</th>
                  <th style={thStyles}>Type</th>
                  <th style={thStyles}>Category</th>
                  <th style={thStyles}>Normal Balance</th>
                  <th style={thStyles}>Status</th>
                  <th style={thStyles}>Postable</th>
                  <th style={thStyles}>Actions</th>
                </tr>
              </thead>
              <tbody data-testid="accounts-list">
                {filteredAccounts.map(({ account, depth }) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    depth={depth}
                    onEdit={handleOpenEditModal}
                    onDeactivate={handleOpenDeactivateModal}
                    onAddChild={handleOpenAddModal}
                  />
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: "1rem", color: "#666", fontSize: "14px" }} data-testid="accounts-count">
            Showing {filteredAccounts.length} of {hierarchicalAccounts.length} accounts
          </div>
        </>
      )}

      <AddAccountModal
        isOpen={addModalState.isOpen}
        parentAccountId={addModalState.parentAccountId}
        companyId={typedCompanyId}
        accounts={hierarchicalAccounts}
        onClose={handleCloseAddModal}
        onSuccess={handleSuccess}
      />

      <EditAccountModal
        isOpen={editModalState.isOpen}
        account={editModalState.account}
        accounts={hierarchicalAccounts}
        onClose={handleCloseEditModal}
        onSuccess={handleSuccess}
      />

      <DeactivateAccountModal
        isOpen={deactivateModalState.isOpen}
        account={deactivateModalState.account}
        onClose={handleCloseDeactivateModal}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
