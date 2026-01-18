import { createFileRoute, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { Plus, ClipboardList, Search } from "lucide-react"
import { createServerApi } from "@/api/server"
import {
  AccountFormModal,
  formatAccountCategory,
  type Account,
  type AccountType
} from "@/components/forms/AccountForm"
import { ApplyTemplateModal } from "@/components/accounts/ApplyTemplateModal"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Tooltip } from "@/components/ui/Tooltip"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { usePermissions } from "@/hooks/usePermissions"

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
          params: { query: { organizationId: data.organizationId, companyId: data.companyId, limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: data.companyId } },
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
    <MinimalRouteError error={error} />
  ),
  component: ChartOfAccountsPage
})

// =============================================================================
// Chart of Accounts Page Component
// =============================================================================

function ChartOfAccountsPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const accounts = loaderData.accounts as readonly Account[]
  const total = loaderData.total as number
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  // UI State
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showApplyTemplate, setShowApplyTemplate] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [filterType, setFilterType] = useState<AccountType | "All">("All")
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Inactive">("All")
  const [filterPostable, setFilterPostable] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Permission checks for UI element visibility
  const { canPerform } = usePermissions()
  const canCreateAccount = canPerform("account:create")
  const canUpdateAccount = canPerform("account:update")

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

  // Pass current company to sidebar for quick actions
  const companiesForSidebar = useMemo(
    () => [{ id: company.id, name: company.name }],
    [company.id, company.name]
  )

  // Breadcrumb items for Chart of Accounts page
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
      label: "Chart of Accounts",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/accounts`
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
      <div data-testid="accounts-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Chart of Accounts
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {company.name} - {company.functionalCurrency}
              </p>
            </div>

            {canCreateAccount && accounts.length > 0 && (
              <Button
                onClick={() => setShowCreateForm(true)}
                icon={<Plus className="h-4 w-4" />}
                data-testid="create-account-button"
              >
                New Account
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4" data-testid="accounts-toolbar">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts..."
              id="accounts-search-input"
              inputPrefix={<Search className="h-4 w-4" />}
              className="w-64 text-sm"
            />

            {/* Filter by Type */}
            <Select
              value={filterType}
              onChange={(e) => {
                const value = e.target.value
                if (isAccountTypeFilter(value)) {
                  setFilterType(value)
                }
              }}
              id="accounts-filter-type"
              className="w-auto text-sm"
              options={[
                { value: "All", label: "All Types" },
                { value: "Asset", label: "Assets" },
                { value: "Liability", label: "Liabilities" },
                { value: "Equity", label: "Equity" },
                { value: "Revenue", label: "Revenue" },
                { value: "Expense", label: "Expenses" }
              ]}
            />

            {/* Filter by Status */}
            <Select
              value={filterStatus}
              onChange={(e) => {
                const value = e.target.value
                if (value === "All" || value === "Active" || value === "Inactive") {
                  setFilterStatus(value)
                }
              }}
              id="accounts-filter-status"
              className="w-auto text-sm"
              options={[
                { value: "All", label: "All Statuses" },
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" }
              ]}
            />

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

          <span className="text-sm text-gray-500" data-testid="accounts-count">
            {filteredAccounts.length} of {total} accounts
          </span>
        </div>

        {/* Create Account Modal */}
        {showCreateForm && (
          <AccountFormModal
            mode="create"
            organizationId={params.organizationId}
            companyId={params.companyId}
            accounts={accounts}
            onClose={() => setShowCreateForm(false)}
          />
        )}

        {/* Edit Account Modal */}
        {editingAccount && (
          <AccountFormModal
            mode="edit"
            organizationId={params.organizationId}
            companyId={params.companyId}
            accounts={accounts}
            initialData={editingAccount}
            onClose={() => setEditingAccount(null)}
          />
        )}

        {/* Apply Template Modal */}
        {showApplyTemplate && (
          <ApplyTemplateModal
            organizationId={params.organizationId}
            companyId={params.companyId}
            onClose={() => setShowApplyTemplate(false)}
          />
        )}

        {/* Accounts Tree */}
        {accounts.length === 0 ? (
          <AccountsEmptyState
            onCreateClick={() => setShowCreateForm(true)}
            onApplyTemplateClick={() => setShowApplyTemplate(true)}
            canCreateAccount={canCreateAccount}
          />
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">No accounts match your search criteria.</p>
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery("")
                setFilterType("All")
                setFilterStatus("All")
                setFilterPostable(false)
              }}
              data-testid="clear-filters-button"
              className="mt-4"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <AccountTreeView
            tree={accountTree}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onEditAccount={setEditingAccount}
            canEditAccount={canUpdateAccount}
          />
        )}
      </div>
    </AppLayout>
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
  onEditAccount,
  canEditAccount
}: {
  readonly tree: readonly AccountTreeNode[]
  readonly expandedIds: Set<string>
  readonly onToggleExpand: (id: string) => void
  readonly onEditAccount: (account: Account) => void
  readonly canEditAccount: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto" data-testid="accounts-tree">
      {/* Use table for proper column alignment */}
      <table className="w-full min-w-[800px]">
        {/* Header */}
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-sm font-medium uppercase tracking-wider text-gray-500" data-testid="accounts-tree-header">
            <th className="w-[33%] px-4 py-3 text-left" data-testid="header-account">
              <Tooltip content="Account number and name in the chart of accounts">
                <span className="cursor-help">Account</span>
              </Tooltip>
            </th>
            <th className="w-[14%] px-4 py-3 text-left" data-testid="header-type">
              <Tooltip content="Account classification: Asset, Liability, Equity, Revenue, or Expense">
                <span className="cursor-help">Type</span>
              </Tooltip>
            </th>
            <th className="w-[17%] px-4 py-3 text-left" data-testid="header-category">
              <Tooltip content="Specific category within the account type (e.g., Current Asset, Fixed Asset)">
                <span className="cursor-help">Category</span>
              </Tooltip>
            </th>
            <th className="w-[9%] px-4 py-3 text-center" data-testid="header-normal-balance">
              <Tooltip content="Normal balance side: Dr (Debit) for assets/expenses, Cr (Credit) for liabilities/equity/revenue">
                <span className="cursor-help">Normal</span>
              </Tooltip>
            </th>
            <th className="w-[9%] px-4 py-3 text-center" data-testid="header-postable">
              <Tooltip content="Whether journal entries can be posted directly to this account (non-postable accounts are summary/grouping accounts)">
                <span className="cursor-help">Postable</span>
              </Tooltip>
            </th>
            <th className="w-[9%] px-4 py-3 text-center" data-testid="header-status">
              <Tooltip content="Current state: Active accounts can receive transactions, Inactive accounts are disabled">
                <span className="cursor-help">Status</span>
              </Tooltip>
            </th>
            <th className="w-[9%] px-4 py-3"></th>
          </tr>
        </thead>

        {/* Tree Rows */}
        <tbody className="divide-y divide-gray-100">
          {tree.map((node) => (
            <AccountTreeRow
              key={node.account.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onEditAccount={onEditAccount}
              canEditAccount={canEditAccount}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AccountTreeRow({
  node,
  depth,
  expandedIds,
  onToggleExpand,
  onEditAccount,
  canEditAccount
}: {
  readonly node: AccountTreeNode
  readonly depth: number
  readonly expandedIds: Set<string>
  readonly onToggleExpand: (id: string) => void
  readonly onEditAccount: (account: Account) => void
  readonly canEditAccount: boolean
}) {
  const { account, children } = node
  const hasChildren = children.length > 0
  const isExpanded = expandedIds.has(account.id)

  return (
    <>
      <tr
        className="hover:bg-gray-50"
        data-testid={`account-row-${account.accountNumber}`}
      >
        {/* Account Name & Number */}
        <td className="px-4 py-3" data-testid={`account-name-${account.accountNumber}`}>
          <div
            className="flex items-center"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => onToggleExpand(account.id)}
                data-testid={`account-expand-${account.accountNumber}`}
                className="mr-1 flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                <svg
                  className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
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
            ) : depth === 0 ? (
              <span className="mr-1 w-4" />
            ) : null}
            <span className="mr-2 font-mono text-sm text-gray-500" data-testid={`account-number-${account.accountNumber}`}>
              {account.accountNumber}
            </span>
            <span className="font-medium text-gray-900">{account.name}</span>
          </div>
        </td>

        {/* Type */}
        <td className="px-4 py-3" data-testid={`account-type-${account.accountNumber}`}>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAccountTypeColor(account.accountType)}`}
          >
            {account.accountType}
          </span>
        </td>

        {/* Category */}
        <td className="px-4 py-3 text-sm text-gray-600" data-testid={`account-category-${account.accountNumber}`}>
          {formatAccountCategory(account.accountCategory)}
        </td>

        {/* Normal Balance */}
        <td className="px-4 py-3 text-center" data-testid={`account-normal-balance-${account.accountNumber}`}>
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
              account.normalBalance === "Debit"
                ? "bg-blue-50 text-blue-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {account.normalBalance === "Debit" ? "Dr" : "Cr"}
          </span>
        </td>

        {/* Postable */}
        <td className="px-4 py-3 text-center" data-testid={`account-postable-${account.accountNumber}`}>
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
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-center" data-testid={`account-status-${account.accountNumber}`}>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              account.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {account.isActive ? "Active" : "Inactive"}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          {canEditAccount && (
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
          )}
        </td>
      </tr>

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
            canEditAccount={canEditAccount}
          />
        ))}
    </>
  )
}

// =============================================================================
// Empty State Component
// =============================================================================

function AccountsEmptyState({
  onCreateClick,
  onApplyTemplateClick,
  canCreateAccount
}: {
  readonly onCreateClick: () => void
  readonly onApplyTemplateClick: () => void
  readonly canCreateAccount: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" data-testid="accounts-empty-state">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <ClipboardList className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        No accounts yet
      </h3>
      <p className="mb-6 text-gray-500">
        {canCreateAccount
          ? "Get started by applying a template or creating your first account manually."
          : "No accounts have been created for this company yet."}
      </p>
      {canCreateAccount && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={onApplyTemplateClick}
            icon={<ClipboardList className="h-5 w-5" />}
            data-testid="apply-template-button"
          >
            Apply Template
          </Button>
          <Button
            variant="secondary"
            onClick={onCreateClick}
            icon={<Plus className="h-5 w-5" />}
            data-testid="create-account-empty-button"
          >
            Create Account
          </Button>
        </div>
      )}
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
