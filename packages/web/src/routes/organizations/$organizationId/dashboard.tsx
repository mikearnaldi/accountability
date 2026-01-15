/**
 * Organization-Scoped Dashboard Route
 *
 * Dashboard showing overview of selected organization with:
 * - Organization header: Name, reporting currency, settings summary
 * - Summary cards (all scoped to current org):
 *   - Companies count in this org
 *   - Total accounts across all companies
 *   - Journal entries pending approval
 *   - Open fiscal periods
 * - Quick actions:
 *   - Create Company
 *   - View Companies
 *   - View Exchange Rates
 *   - Run Consolidation
 * - Recent activity section (placeholder until audit log API ready)
 *
 * Route: /organizations/:organizationId/dashboard
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MetricsCard, MetricsGrid } from "@/components/dashboard/MetricsCard"
import { ActivityFeed, type ActivityType } from "@/components/dashboard/ActivityFeed"
import {
  Building,
  CreditCard,
  FileText,
  Calendar,
  Plus,
  ArrowRight,
  TrendingUp,
  Globe2,
  Settings
} from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
  readonly settings: {
    readonly defaultLocale: string
    readonly defaultTimezone: string
    readonly useFiscalYear: boolean
    readonly defaultDecimalPlaces: number
  }
  readonly createdAt: {
    readonly epochMillis: number
  }
}

export interface DashboardData {
  readonly organization: Organization | null
  readonly companiesCount: number
  readonly accountsCount: number
  readonly pendingEntriesCount: number
  readonly openPeriodsCount: number
  readonly recentActivity: readonly {
    readonly id: string
    readonly type: ActivityType
    readonly description: string
    readonly timestamp: string
    readonly user?: string
  }[]
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchOrganizationDashboard = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }): Promise<DashboardData> => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        organization: null,
        companiesCount: 0,
        accountsCount: 0,
        pendingEntriesCount: 0,
        openPeriodsCount: 0,
        recentActivity: []
      }
    }

    try {
      const serverApi = createServerApi()
      const headers = { Authorization: `Bearer ${sessionToken}` }

      // Fetch organization details
      const orgResult = await serverApi.GET("/api/v1/organizations/{id}", {
        params: { path: { id: organizationId } },
        headers
      })

      if (orgResult.error || !orgResult.data) {
        return {
          organization: null,
          companiesCount: 0,
          accountsCount: 0,
          pendingEntriesCount: 0,
          openPeriodsCount: 0,
          recentActivity: []
        }
      }

      const organization = orgResult.data

      // Fetch companies for this organization
      const companiesResult = await serverApi.GET("/api/v1/companies", {
        params: { query: { organizationId } },
        headers
      })
      const companies = companiesResult.data?.companies ?? []
      const companiesCount = companies.length

      // Count total accounts across all companies
      let accountsCount = 0
      for (const company of companies.slice(0, 10)) {
        try {
          const accountsResult = await serverApi.GET("/api/v1/accounts", {
            params: { query: { companyId: company.id } },
            headers
          })
          accountsCount += accountsResult.data?.total ?? 0
        } catch {
          // Skip failed account fetches
        }
      }

      // Fetch pending journal entries count
      let pendingEntriesCount = 0
      for (const company of companies.slice(0, 10)) {
        try {
          const entriesResult = await serverApi.GET("/api/v1/journal-entries", {
            params: { query: { companyId: company.id, status: "PendingApproval", limit: "1" } },
            headers
          })
          pendingEntriesCount += entriesResult.data?.total ?? 0
        } catch {
          // Skip failed entries fetches
        }
      }

      // Fetch open fiscal periods count
      let openPeriodsCount = 0
      for (const company of companies.slice(0, 10)) {
        try {
          const periodsResult = await serverApi.GET("/api/v1/fiscal/fiscal-periods", {
            params: { query: { companyId: company.id, status: "Open", limit: "1" } },
            headers
          })
          openPeriodsCount += periodsResult.data?.total ?? 0
        } catch {
          // Skip failed periods fetches
        }
      }

      // Recent activity placeholder (until audit log API is ready)
      const recentActivity: DashboardData["recentActivity"] = []

      return {
        organization,
        companiesCount,
        accountsCount,
        pendingEntriesCount,
        openPeriodsCount,
        recentActivity
      }
    } catch {
      return {
        organization: null,
        companiesCount: 0,
        accountsCount: 0,
        pendingEntriesCount: 0,
        openPeriodsCount: 0,
        recentActivity: []
      }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/dashboard")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/dashboard`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const dashboardData = await fetchOrganizationDashboard({ data: params.organizationId })
    return { dashboardData }
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
            <Link to="/organizations" className="text-xl text-gray-600 hover:text-gray-900">
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
  component: OrganizationDashboardPage
})

// =============================================================================
// Dashboard Page Component
// =============================================================================

function OrganizationDashboardPage() {
  const context = Route.useRouteContext()
  const { dashboardData } = Route.useLoaderData()
  const params = Route.useParams()
  const user = context.user

  // Redirect if organization not found
  if (!dashboardData.organization) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-xl font-bold text-gray-900">
                Accountability
              </Link>
              <span className="text-gray-400">/</span>
              <Link to="/organizations" className="text-xl text-gray-600 hover:text-gray-900">
                Organizations
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-medium text-red-800">Organization Not Found</h2>
            <p className="mt-2 text-red-700">The requested organization could not be found.</p>
            <Link
              to="/organizations"
              className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              Back to Organizations
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const organization = dashboardData.organization

  return (
    <AppLayout
      user={user}
      currentOrganization={organization}
    >
      <div className="space-y-6" data-testid="org-dashboard">
        {/* Organization Header */}
        <OrganizationHeader organization={organization} />

        {/* Metrics Cards */}
        <MetricsGrid>
          <MetricsCard
            label="Companies"
            value={dashboardData.companiesCount}
            icon={Building}
            iconColor="blue"
            testId="metric-org-companies"
          />
          <MetricsCard
            label="Total Accounts"
            value={dashboardData.accountsCount}
            icon={CreditCard}
            iconColor="green"
            testId="metric-org-accounts"
          />
          <MetricsCard
            label="Pending Approval"
            value={dashboardData.pendingEntriesCount}
            icon={FileText}
            iconColor="orange"
            testId="metric-org-pending-entries"
          />
          <MetricsCard
            label="Open Periods"
            value={dashboardData.openPeriodsCount}
            icon={Calendar}
            iconColor="purple"
            testId="metric-org-open-periods"
          />
        </MetricsGrid>

        {/* Quick Actions */}
        <OrgQuickActions organizationId={params.organizationId} />

        {/* Recent Activity */}
        <ActivityFeed activities={dashboardData.recentActivity} />
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Organization Header Component
// =============================================================================

interface OrganizationHeaderProps {
  readonly organization: Organization
}

function OrganizationHeader({ organization }: OrganizationHeaderProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-6"
      data-testid="org-dashboard-header"
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="org-dashboard-name">
            {organization.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Organization Dashboard</p>
        </div>
        <Link
          to="/organizations/$organizationId"
          params={{ organizationId: organization.id }}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          data-testid="org-dashboard-settings-link"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-medium text-gray-500">Reporting Currency</dt>
          <dd
            className="mt-1 text-lg font-medium text-gray-900"
            data-testid="org-dashboard-currency"
          >
            {organization.reportingCurrency}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Timezone</dt>
          <dd className="mt-1 text-lg font-medium text-gray-900">
            {organization.settings?.defaultTimezone ?? "UTC"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Decimal Places</dt>
          <dd className="mt-1 text-lg font-medium text-gray-900">
            {organization.settings?.defaultDecimalPlaces ?? 2}
          </dd>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Organization Quick Actions Component
// =============================================================================

interface QuickActionProps {
  readonly label: string
  readonly description: string
  readonly icon: typeof Plus
  readonly href: string
  readonly iconColor: "blue" | "green" | "purple" | "orange"
  readonly testId: string
}

const iconColorClasses = {
  blue: "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
  green: "bg-green-100 text-green-600 group-hover:bg-green-200",
  purple: "bg-purple-100 text-purple-600 group-hover:bg-purple-200",
  orange: "bg-orange-100 text-orange-600 group-hover:bg-orange-200"
}

function QuickActionCard({
  label,
  description,
  icon: Icon,
  href,
  iconColor,
  testId
}: QuickActionProps) {
  return (
    <Link
      to={href}
      data-testid={testId}
      className="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${iconColorClasses[iconColor]}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4">
        <h3 className="text-base font-semibold text-gray-900">{label}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
        Go
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

function OrgQuickActions({ organizationId }: { readonly organizationId: string }) {
  const actions: QuickActionProps[] = [
    {
      label: "Create Company",
      description: "Add a new company to this organization",
      icon: Plus,
      href: `/organizations/${organizationId}/companies`,
      iconColor: "blue",
      testId: "org-quick-action-create-company"
    },
    {
      label: "View Companies",
      description: "Manage companies in this organization",
      icon: Building,
      href: `/organizations/${organizationId}/companies`,
      iconColor: "green",
      testId: "org-quick-action-view-companies"
    },
    {
      label: "Exchange Rates",
      description: "Manage currency exchange rates",
      icon: TrendingUp,
      href: `/organizations/${organizationId}/exchange-rates`,
      iconColor: "orange",
      testId: "org-quick-action-exchange-rates"
    },
    {
      label: "Run Consolidation",
      description: "Consolidate financial statements",
      icon: Globe2,
      href: `/organizations/${organizationId}/consolidation`,
      iconColor: "purple",
      testId: "org-quick-action-consolidation"
    }
  ]

  return (
    <div data-testid="org-quick-actions">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <QuickActionCard key={action.testId} {...action} />
        ))}
      </div>
    </div>
  )
}
