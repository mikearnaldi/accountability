import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
// eslint-disable-next-line local/no-server-functions -- Required for SSR: need server-side access to httpOnly cookies
import { createServerFn } from "@tanstack/react-start"
import { getCookie, getRequestUrl } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { api } from "@/api/interceptor"

// =============================================================================
// Types (extracted from API response schema)
// =============================================================================

type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
type AccountCategory =
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
type NormalBalance = "Debit" | "Credit"
type CashFlowCategory = "Operating" | "Investing" | "Financing" | "NonCash"

// Type guards for validating select values
const ACCOUNT_TYPES: readonly AccountType[] = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense"
]
const ACCOUNT_TYPE_FILTERS: readonly (AccountType | "All")[] = [
  "All",
  ...ACCOUNT_TYPES
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

function isAccountTypeFilter(value: string): value is AccountType | "All" {
  return ACCOUNT_TYPE_FILTERS.some((t) => t === value)
}

function isNormalBalance(value: string): value is NormalBalance {
  return NORMAL_BALANCES.some((t) => t === value)
}

function isCashFlowCategory(value: string): value is CashFlowCategory {
  return CASH_FLOW_CATEGORIES.some((t) => t === value)
}

interface Account {
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

// =============================================================================
// Server Functions: Fetch accounts, company, and organization from API with cookie auth
// =============================================================================

// eslint-disable-next-line local/no-server-functions -- Required for SSR: TanStack Start server functions are the only way to access httpOnly cookies during SSR
const fetchAccountsData = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { companyId: string; organizationId: string }) => data
  )
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        accounts: [],
        total: 0,
        company: null,
        organization: null,
        error: "unauthorized" as const
      }
    }

    try {
      const requestUrl = getRequestUrl()
      const apiBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`

      /* eslint-disable local/no-direct-fetch -- Required for SSR: must use native fetch with dynamic baseUrl from request context */
      const [accountsResponse, companyResponse, orgResponse] = await Promise.all(
        [
          fetch(
            `${apiBaseUrl}/api/v1/accounts?companyId=${encodeURIComponent(data.companyId)}&limit=1000`,
            { headers: { Authorization: `Bearer ${sessionToken}` } }
          ),
          fetch(`${apiBaseUrl}/api/v1/companies/${data.companyId}`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
          }),
          fetch(`${apiBaseUrl}/api/v1/organizations/${data.organizationId}`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
          })
        ]
      )
      /* eslint-enable local/no-direct-fetch */

      if (!companyResponse.ok) {
        if (companyResponse.status === 404) {
          return {
            accounts: [],
            total: 0,
            company: null,
            organization: null,
            error: "not_found" as const
          }
        }
        return {
          accounts: [],
          total: 0,
          company: null,
          organization: null,
          error: "failed" as const
        }
      }

      if (!orgResponse.ok || !accountsResponse.ok) {
        return {
          accounts: [],
          total: 0,
          company: null,
          organization: null,
          error: "failed" as const
        }
      }

      const accountsData = await accountsResponse.json()
      const company = await companyResponse.json()
      const organization = await orgResponse.json()

      return {
        accounts: accountsData?.accounts ?? [],
        total: accountsData?.total ?? 0,
        company,
        organization,
        error: null
      }
    } catch {
      return {
        accounts: [],
        total: 0,
        company: null,
        organization: null,
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Chart of Accounts Route
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/accounts/"
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
    const result = await fetchAccountsData({
      data: {
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Company not found")
    }

    return {
      accounts: result.accounts,
      total: result.total,
      company: result.company,
      organization: result.organization
    }
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Accountability
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to="/organizations"
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              Organizations
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-medium text-red-800">Error</h2>
          <p className="mt-2 text-red-700">{error.message}</p>
          <Link
            to="/organizations"
            className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            Back to Organizations
          </Link>
        </div>
      </main>
    </div>
  ),
  component: ChartOfAccountsPage
})

// =============================================================================
// Chart of Accounts Page Component
// =============================================================================

function ChartOfAccountsPage() {
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const accounts = loaderData.accounts as readonly Account[]
  const total = loaderData.total as number
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()

  // UI State
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [filterType, setFilterType] = useState<AccountType | "All">("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Filter and search accounts
  const filteredAccounts = useMemo(() => {
    let result = [...accounts]

    // Filter by account type
    if (filterType !== "All") {
      result = result.filter((acc) => acc.accountType === filterType)
    }

    // Search by name or account number
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(
        (acc) =>
          acc.name.toLowerCase().includes(query) ||
          acc.accountNumber.toLowerCase().includes(query)
      )
    }

    return result
  }, [accounts, filterType, searchQuery])

  // Build tree structure
  const accountTree = useMemo(() => {
    return buildAccountTree(filteredAccounts)
  }, [filteredAccounts])

  // Toggle expand/collapse
  const toggleExpand = (accountId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  // Expand all
  const expandAll = () => {
    const allParentIds = accounts
      .filter((acc) => accounts.some((child) => child.parentAccountId === acc.id))
      .map((acc) => acc.id)
    setExpandedIds(new Set(allParentIds))
  }

  // Collapse all
  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  if (!company || !organization) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Accountability
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to="/organizations"
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              Organizations
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to="/organizations/$organizationId"
              params={{ organizationId: params.organizationId }}
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              {organization.name}
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to="/organizations/$organizationId/companies"
              params={{ organizationId: params.organizationId }}
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              Companies
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to="/organizations/$organizationId/companies/$companyId"
              params={{
                organizationId: params.organizationId,
                companyId: params.companyId
              }}
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              {company.name}
            </Link>
            <span className="text-gray-400">/</span>
            <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Filter by Type */}
            <select
              value={filterType}
              onChange={(e) => {
                const value = e.target.value
                if (isAccountTypeFilter(value)) {
                  setFilterType(value)
                }
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Asset">Assets</option>
              <option value="Liability">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expenses</option>
            </select>

            {/* Expand/Collapse buttons */}
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {filteredAccounts.length} of {total} accounts
            </span>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Account
            </button>
          </div>
        </div>

        {/* Create Account Modal */}
        {showCreateForm && (
          <CreateAccountModal
            companyId={params.companyId}
            accounts={accounts}
            onClose={() => setShowCreateForm(false)}
          />
        )}

        {/* Edit Account Modal */}
        {editingAccount && (
          <EditAccountModal
            account={editingAccount}
            accounts={accounts}
            onClose={() => setEditingAccount(null)}
          />
        )}

        {/* Accounts Tree */}
        {accounts.length === 0 ? (
          <AccountsEmptyState onCreateClick={() => setShowCreateForm(true)} />
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">No accounts match your search criteria.</p>
            <button
              onClick={() => {
                setSearchQuery("")
                setFilterType("All")
              }}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <AccountTreeView
            tree={accountTree}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onEditAccount={setEditingAccount}
          />
        )}
      </main>
    </div>
  )
}

// =============================================================================
// Account Tree Building
// =============================================================================

interface AccountTreeNode {
  readonly account: Account
  readonly children: readonly AccountTreeNode[]
}

function buildAccountTree(accounts: readonly Account[]): readonly AccountTreeNode[] {
  const accountMap = new Map<string, Account>()
  for (const account of accounts) {
    accountMap.set(account.id, account)
  }

  const childrenMap = new Map<string | null, Account[]>()
  for (const account of accounts) {
    const parentId = account.parentAccountId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(account)
  }

  function buildNode(account: Account): AccountTreeNode {
    const children = childrenMap.get(account.id) ?? []
    return {
      account,
      children: children
        .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
        .map(buildNode)
    }
  }

  const rootAccounts = childrenMap.get(null) ?? []
  return rootAccounts
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
    .map(buildNode)
}

// =============================================================================
// Account Tree View Component
// =============================================================================

function AccountTreeView({
  tree,
  expandedIds,
  onToggleExpand,
  onEditAccount
}: {
  readonly tree: readonly AccountTreeNode[]
  readonly expandedIds: Set<string>
  readonly onToggleExpand: (id: string) => void
  readonly onEditAccount: (account: Account) => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500">
        <div className="col-span-5">Account</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-1 text-center">Postable</div>
        <div className="col-span-1 text-center">Status</div>
        <div className="col-span-1"></div>
      </div>

      {/* Tree Rows */}
      <div className="divide-y divide-gray-100">
        {tree.map((node) => (
          <AccountTreeRow
            key={node.account.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            onEditAccount={onEditAccount}
          />
        ))}
      </div>
    </div>
  )
}

function AccountTreeRow({
  node,
  depth,
  expandedIds,
  onToggleExpand,
  onEditAccount
}: {
  readonly node: AccountTreeNode
  readonly depth: number
  readonly expandedIds: Set<string>
  readonly onToggleExpand: (id: string) => void
  readonly onEditAccount: (account: Account) => void
}) {
  const { account, children } = node
  const hasChildren = children.length > 0
  const isExpanded = expandedIds.has(account.id)

  return (
    <>
      <div className="grid grid-cols-12 items-center gap-4 px-4 py-3 hover:bg-gray-50">
        {/* Account Name & Number */}
        <div className="col-span-5 flex items-center gap-2">
          <div
            className="flex items-center"
            style={{ paddingLeft: `${depth * 24}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => onToggleExpand(account.id)}
                className="mr-2 flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ) : (
              <span className="mr-2 w-5" />
            )}
            <span className="mr-2 font-mono text-sm text-gray-500">
              {account.accountNumber}
            </span>
            <span className="font-medium text-gray-900">{account.name}</span>
          </div>
        </div>

        {/* Type */}
        <div className="col-span-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAccountTypeColor(account.accountType)}`}
          >
            {account.accountType}
          </span>
        </div>

        {/* Category */}
        <div className="col-span-2 text-sm text-gray-600">
          {formatAccountCategory(account.accountCategory)}
        </div>

        {/* Postable */}
        <div className="col-span-1 text-center">
          {account.isPostable ? (
            <span className="text-green-600">
              <svg
                className="inline h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        {/* Status */}
        <div className="col-span-1 text-center">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              account.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {account.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Actions */}
        <div className="col-span-1 text-right">
          <button
            onClick={() => onEditAccount(account)}
            data-testid={`edit-account-${account.accountNumber}`}
            data-account-id={account.id}
            aria-label={`Edit ${account.name}`}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
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
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren &&
        isExpanded &&
        children.map((child) => (
          <AccountTreeRow
            key={child.account.id}
            node={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            onEditAccount={onEditAccount}
          />
        ))}
    </>
  )
}

// =============================================================================
// Empty State Component
// =============================================================================

function AccountsEmptyState({
  onCreateClick
}: {
  readonly onCreateClick: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <svg
          className="h-6 w-6 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        No accounts yet
      </h3>
      <p className="mb-6 text-gray-500">
        Get started by creating your first account in the chart of accounts.
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create Account
      </button>
    </div>
  )
}

// =============================================================================
// Create Account Modal
// =============================================================================

function CreateAccountModal({
  companyId,
  accounts,
  onClose
}: {
  readonly companyId: string
  readonly accounts: readonly Account[]
  readonly onClose: () => void
}) {
  const router = useRouter()

  const [accountNumber, setAccountNumber] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [accountType, setAccountType] = useState<AccountType>("Asset")
  const [accountCategory, setAccountCategory] =
    useState<AccountCategory>("CurrentAsset")
  const [normalBalance, setNormalBalance] = useState<NormalBalance>("Debit")
  const [parentAccountId, setParentAccountId] = useState<string>("")
  const [isPostable, setIsPostable] = useState(true)
  const [isCashFlowRelevant, setIsCashFlowRelevant] = useState(false)
  const [cashFlowCategory, setCashFlowCategory] = useState<
    CashFlowCategory | ""
  >("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update categories when type changes
  const availableCategories = getCategoriesForType(accountType)

  // Update normal balance default when type changes
  const handleTypeChange = (newType: AccountType) => {
    setAccountType(newType)
    setAccountCategory(getCategoriesForType(newType)[0])
    setNormalBalance(getDefaultNormalBalance(newType))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    const trimmedNumber = accountNumber.trim()
    const trimmedName = name.trim()

    if (!trimmedNumber) {
      setError("Account number is required")
      return
    }
    if (!trimmedName) {
      setError("Account name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/accounts", {
        body: {
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
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null
        }
      })

      if (apiError) {
        let errorMessage = "Failed to create account"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      await router.invalidate()
      onClose()
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Create Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Account Number & Name */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="account-number"
                className="block text-sm font-medium text-gray-700"
              >
                Account Number
              </label>
              <input
                id="account-number"
                type="text"
                autoFocus
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                disabled={isSubmitting}
                placeholder="1000"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div className="col-span-2">
              <label
                htmlFor="account-name"
                className="block text-sm font-medium text-gray-700"
              >
                Account Name
              </label>
              <input
                id="account-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                placeholder="Cash and Cash Equivalents"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="account-description"
              className="block text-sm font-medium text-gray-700"
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
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Type, Category, Normal Balance */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="account-type"
                className="block text-sm font-medium text-gray-700"
              >
                Account Type
              </label>
              <select
                id="account-type"
                value={accountType}
                onChange={(e) => {
                  const value = e.target.value
                  if (isAccountType(value)) {
                    handleTypeChange(value)
                  }
                }}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="account-category"
                className="block text-sm font-medium text-gray-700"
              >
                Category
              </label>
              <select
                id="account-category"
                value={accountCategory}
                onChange={(e) => {
                  const value = e.target.value
                  const found = availableCategories.find((cat) => cat === value)
                  if (found) {
                    setAccountCategory(found)
                  }
                }}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatAccountCategory(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="normal-balance"
                className="block text-sm font-medium text-gray-700"
              >
                Normal Balance
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
                disabled={isSubmitting}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
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
              Parent Account (optional)
            </label>
            <select
              id="parent-account"
              value={parentAccountId}
              onChange={(e) => setParentAccountId(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">None (Top-level account)</option>
              {accounts
                .filter((acc) => acc.isActive)
                .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} - {acc.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                id="is-postable"
                type="checkbox"
                checked={isPostable}
                onChange={(e) => setIsPostable(e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is-postable" className="text-sm text-gray-700">
                Postable (can receive journal entries)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is-cash-flow-relevant"
                type="checkbox"
                checked={isCashFlowRelevant}
                onChange={(e) => setIsCashFlowRelevant(e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="is-cash-flow-relevant"
                className="text-sm text-gray-700"
              >
                Cash flow relevant
              </label>
            </div>
          </div>

          {/* Cash Flow Category (conditional) */}
          {isCashFlowRelevant && (
            <div>
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
                disabled={isSubmitting}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Select category...</option>
                <option value="Operating">Operating</option>
                <option value="Investing">Investing</option>
                <option value="Financing">Financing</option>
                <option value="NonCash">Non-Cash</option>
              </select>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      opacity="0.25"
                    />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </span>
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

// =============================================================================
// Edit Account Modal
// =============================================================================

function EditAccountModal({
  account,
  accounts,
  onClose
}: {
  readonly account: Account
  readonly accounts: readonly Account[]
  readonly onClose: () => void
}) {
  const router = useRouter()

  const [name, setName] = useState(account.name)
  const [description, setDescription] = useState(account.description ?? "")
  const [parentAccountId, setParentAccountId] = useState(
    account.parentAccountId ?? ""
  )
  const [isPostable, setIsPostable] = useState(account.isPostable)
  const [isCashFlowRelevant, setIsCashFlowRelevant] = useState(
    account.isCashFlowRelevant
  )
  const [cashFlowCategory, setCashFlowCategory] = useState<
    CashFlowCategory | ""
  >(account.cashFlowCategory ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter out current account and its descendants from parent options
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

  const descendantIds = getDescendantIds(account.id)
  const availableParents = accounts.filter(
    (acc) => acc.isActive && !descendantIds.has(acc.id)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError("Account name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.PUT("/api/v1/accounts/{id}", {
        params: { path: { id: account.id } },
        body: {
          name: trimmedName,
          description: description.trim() || null,
          parentAccountId: parentAccountId || null,
          isPostable,
          isCashFlowRelevant,
          cashFlowCategory:
            isCashFlowRelevant && cashFlowCategory ? cashFlowCategory : null,
          isIntercompany: null,
          intercompanyPartnerId: null,
          currencyRestriction: null,
          isActive: null
        }
      })

      if (apiError) {
        let errorMessage = "Failed to update account"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      await router.invalidate()
      onClose()
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Edit Account
        </h2>

        {/* Read-only info */}
        <div className="mb-4 rounded-lg bg-gray-50 p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Account Number:</span>
              <span className="ml-2 font-mono font-medium text-gray-900">
                {account.accountNumber}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 font-medium text-gray-900">
                {account.accountType}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Category:</span>
              <span className="ml-2 font-medium text-gray-900">
                {formatAccountCategory(account.accountCategory)}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label
              htmlFor="edit-account-name"
              className="block text-sm font-medium text-gray-700"
            >
              Account Name
            </label>
            <input
              id="edit-account-name"
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="edit-account-description"
              className="block text-sm font-medium text-gray-700"
            >
              Description (optional)
            </label>
            <textarea
              id="edit-account-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={2}
              placeholder="Describe the purpose of this account..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Parent Account */}
          <div>
            <label
              htmlFor="edit-parent-account"
              className="block text-sm font-medium text-gray-700"
            >
              Parent Account (optional)
            </label>
            <select
              id="edit-parent-account"
              value={parentAccountId}
              onChange={(e) => setParentAccountId(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">None (Top-level account)</option>
              {availableParents
                .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} - {acc.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                id="edit-is-postable"
                type="checkbox"
                checked={isPostable}
                onChange={(e) => setIsPostable(e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="edit-is-postable"
                className="text-sm text-gray-700"
              >
                Postable (can receive journal entries)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="edit-is-cash-flow-relevant"
                type="checkbox"
                checked={isCashFlowRelevant}
                onChange={(e) => setIsCashFlowRelevant(e.target.checked)}
                disabled={isSubmitting}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="edit-is-cash-flow-relevant"
                className="text-sm text-gray-700"
              >
                Cash flow relevant
              </label>
            </div>
          </div>

          {/* Cash Flow Category (conditional) */}
          {isCashFlowRelevant && (
            <div>
              <label
                htmlFor="edit-cash-flow-category"
                className="block text-sm font-medium text-gray-700"
              >
                Cash Flow Category
              </label>
              <select
                id="edit-cash-flow-category"
                value={cashFlowCategory}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === "" || isCashFlowCategory(value)) {
                    setCashFlowCategory(value)
                  }
                }}
                disabled={isSubmitting}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Select category...</option>
                <option value="Operating">Operating</option>
                <option value="Investing">Investing</option>
                <option value="Financing">Financing</option>
                <option value="NonCash">Non-Cash</option>
              </select>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      opacity="0.25"
                    />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function getAccountTypeColor(type: AccountType): string {
  const colors: Record<AccountType, string> = {
    Asset: "bg-blue-100 text-blue-800",
    Liability: "bg-red-100 text-red-800",
    Equity: "bg-purple-100 text-purple-800",
    Revenue: "bg-green-100 text-green-800",
    Expense: "bg-orange-100 text-orange-800"
  }
  return colors[type]
}

function formatAccountCategory(category: AccountCategory): string {
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

function getCategoriesForType(type: AccountType): AccountCategory[] {
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

function getDefaultNormalBalance(type: AccountType): NormalBalance {
  const defaults: Record<AccountType, NormalBalance> = {
    Asset: "Debit",
    Liability: "Credit",
    Equity: "Credit",
    Revenue: "Credit",
    Expense: "Debit"
  }
  return defaults[type]
}
