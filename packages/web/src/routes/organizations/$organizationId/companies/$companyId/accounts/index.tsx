import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import {
  AccountFormModal,
  formatAccountCategory,
  type Account,
  type AccountType
} from "@/components/forms/AccountForm"

// =============================================================================
// Types
// =============================================================================

// Type guards for filtering
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

function isAccountTypeFilter(value: string): value is AccountType | "All" {
  return ACCOUNT_TYPE_FILTERS.some((t) => t === value)
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

const fetchAccountsData = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { companyId: string; organizationId: string }) => data
  )
  .handler(async ({ data }) => {
    // Get the session cookie to forward to API
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
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`
      // Fetch accounts, company, and organization in parallel using api client with Bearer auth
      const [accountsResult, companyResult, orgResult] = await Promise.all([
        serverApi.GET("/api/v1/accounts", {
          params: { query: { companyId: data.companyId, limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies/{id}", {
          params: { path: { id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        if (typeof companyResult.error === "object" && "status" in companyResult.error && companyResult.error.status === 404) {
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

      if (orgResult.error || accountsResult.error) {
        return {
          accounts: [],
          total: 0,
          company: null,
          organization: null,
          error: "failed" as const
        }
      }

      return {
        accounts: accountsResult.data?.accounts ?? [],
        total: accountsResult.data?.total ?? 0,
        company: companyResult.data,
        organization: orgResult.data,
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
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Inactive">("All")
  const [filterPostable, setFilterPostable] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Filter and search accounts
  const filteredAccounts = useMemo(() => {
    let result = [...accounts]

    // Filter by account type
    if (filterType !== "All") {
      result = result.filter((acc) => acc.accountType === filterType)
    }

    // Filter by status (Active/Inactive)
    if (filterStatus !== "All") {
      const isActive = filterStatus === "Active"
      result = result.filter((acc) => acc.isActive === isActive)
    }

    // Filter by postable only
    if (filterPostable) {
      result = result.filter((acc) => acc.isPostable)
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
  }, [accounts, filterType, filterStatus, filterPostable, searchQuery])

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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4" data-testid="accounts-toolbar">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                data-testid="accounts-search-input"
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
              data-testid="accounts-filter-type"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Asset">Assets</option>
              <option value="Liability">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expenses</option>
            </select>

            {/* Filter by Status */}
            <select
              value={filterStatus}
              onChange={(e) => {
                const value = e.target.value
                if (value === "All" || value === "Active" || value === "Inactive") {
                  setFilterStatus(value)
                }
              }}
              data-testid="accounts-filter-status"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            {/* Filter by Postable */}
            <label className="flex items-center gap-2 text-sm text-gray-700" data-testid="accounts-filter-postable-label">
              <input
                type="checkbox"
                checked={filterPostable}
                onChange={(e) => setFilterPostable(e.target.checked)}
                data-testid="accounts-filter-postable"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Postable only
            </label>

            {/* Expand/Collapse buttons */}
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                data-testid="accounts-expand-all"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                data-testid="accounts-collapse-all"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500" data-testid="accounts-count">
              {filteredAccounts.length} of {total} accounts
            </span>
            <button
              onClick={() => setShowCreateForm(true)}
              data-testid="create-account-button"
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
          <AccountFormModal
            mode="create"
            companyId={params.companyId}
            accounts={accounts}
            onClose={() => setShowCreateForm(false)}
          />
        )}

        {/* Edit Account Modal */}
        {editingAccount && (
          <AccountFormModal
            mode="edit"
            companyId={params.companyId}
            accounts={accounts}
            initialData={editingAccount}
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
                setFilterStatus("All")
                setFilterPostable(false)
              }}
              data-testid="clear-filters-button"
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
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="accounts-tree">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500" data-testid="accounts-tree-header">
        <div className="col-span-4" data-testid="header-account">Account</div>
        <div className="col-span-2" data-testid="header-type">Type</div>
        <div className="col-span-2" data-testid="header-category">Category</div>
        <div className="col-span-1 text-center" data-testid="header-normal-balance">Normal</div>
        <div className="col-span-1 text-center" data-testid="header-postable">Postable</div>
        <div className="col-span-1 text-center" data-testid="header-status">Status</div>
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
      <div
        className="grid grid-cols-12 items-center gap-4 px-4 py-3 hover:bg-gray-50"
        data-testid={`account-row-${account.accountNumber}`}
      >
        {/* Account Name & Number */}
        <div className="col-span-4 flex items-center gap-2" data-testid={`account-name-${account.accountNumber}`}>
          <div
            className="flex items-center"
            style={{ paddingLeft: `${depth * 24}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => onToggleExpand(account.id)}
                data-testid={`account-expand-${account.accountNumber}`}
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
            <span className="mr-2 font-mono text-sm text-gray-500" data-testid={`account-number-${account.accountNumber}`}>
              {account.accountNumber}
            </span>
            <span className="font-medium text-gray-900">{account.name}</span>
          </div>
        </div>

        {/* Type */}
        <div className="col-span-2" data-testid={`account-type-${account.accountNumber}`}>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAccountTypeColor(account.accountType)}`}
          >
            {account.accountType}
          </span>
        </div>

        {/* Category */}
        <div className="col-span-2 text-sm text-gray-600" data-testid={`account-category-${account.accountNumber}`}>
          {formatAccountCategory(account.accountCategory)}
        </div>

        {/* Normal Balance */}
        <div className="col-span-1 text-center" data-testid={`account-normal-balance-${account.accountNumber}`}>
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
              account.normalBalance === "Debit"
                ? "bg-blue-50 text-blue-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {account.normalBalance === "Debit" ? "Dr" : "Cr"}
          </span>
        </div>

        {/* Postable */}
        <div className="col-span-1 text-center" data-testid={`account-postable-${account.accountNumber}`}>
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
        <div className="col-span-1 text-center" data-testid={`account-status-${account.accountNumber}`}>
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
