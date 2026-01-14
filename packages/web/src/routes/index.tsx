/**
 * Home Page / Dashboard Route
 *
 * For authenticated users:
 * - Full-featured dashboard with sidebar navigation
 * - Key metrics widgets (organizations, companies, pending entries)
 * - Recent activity feed
 * - Quick action buttons
 * - Balance summary per company
 * - Upcoming period close deadlines
 *
 * For unauthenticated users:
 * - Landing page with sign in/register options
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MetricsCard, MetricsGrid } from "@/components/dashboard/MetricsCard"
import { ActivityFeed, type ActivityType } from "@/components/dashboard/ActivityFeed"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { BalanceSummary } from "@/components/dashboard/BalanceSummary"
import { PeriodDeadlines } from "@/components/dashboard/PeriodDeadlines"
import {
  Building2,
  Building,
  FileText,
  Clock
} from "lucide-react"

// =============================================================================
// Server Function: Fetch dashboard data
// =============================================================================

export interface DashboardData {
  readonly organizationsCount: number
  readonly companiesCount: number
  readonly pendingEntriesCount: number
  readonly recentActivity: readonly {
    readonly id: string
    readonly type: ActivityType
    readonly description: string
    readonly timestamp: string
    readonly user?: string
  }[]
  readonly companyBalances: readonly {
    readonly id: string
    readonly name: string
    readonly currency: string
    readonly totalAssets: number
    readonly totalLiabilities: number
    readonly totalEquity: number
    readonly organizationId: string
  }[]
  readonly periodDeadlines: readonly {
    readonly id: string
    readonly periodName: string
    readonly companyName: string
    readonly companyId: string
    readonly organizationId: string
    readonly endDate: string
    readonly status: "on_track" | "approaching" | "overdue"
  }[]
}

const fetchDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData | null> => {
    // Get the session cookie to forward to API
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return null
    }

    try {
      const serverApi = createServerApi()
      const headers = { Authorization: `Bearer ${sessionToken}` }

      // Fetch organizations first
      const orgsResult = await serverApi.GET("/api/v1/organizations", { headers })
      const organizations = orgsResult.data?.organizations ?? []

      // Fetch companies for each organization
      const allCompanies: {
        id: string
        name: string
        currency: string
        organizationId: string
      }[] = []

      for (const org of organizations.slice(0, 5)) {
        try {
          const companiesRes = await serverApi.GET("/api/v1/companies", {
            headers,
            params: { query: { organizationId: org.id } }
          })
          const companies = companiesRes.data?.companies ?? []
          for (const company of companies) {
            allCompanies.push({
              id: company.id,
              name: company.name,
              currency: company.functionalCurrency,
              organizationId: org.id
            })
          }
        } catch {
          // Skip failed company fetches
        }
      }

      // Generate mock data for metrics that don't have real API endpoints yet
      // In a real implementation, these would come from actual API calls
      const pendingEntriesCount = 0 // Would come from journal entries API

      // Generate placeholder company balances (would come from reports API)
      const companyBalances = allCompanies.slice(0, 5).map((company) => ({
        ...company,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0
      }))

      // Placeholder for recent activity (would come from audit log API)
      const recentActivity: DashboardData["recentActivity"] = []

      // Placeholder for period deadlines (would come from fiscal periods API)
      const periodDeadlines: DashboardData["periodDeadlines"] = []

      return {
        organizationsCount: organizations.length,
        companiesCount: allCompanies.length,
        pendingEntriesCount,
        recentActivity,
        companyBalances,
        periodDeadlines
      }
    } catch {
      return null
    }
  }
)

// =============================================================================
// Home Page Route
// =============================================================================

export const Route = createFileRoute("/")({
  loader: async () => {
    const dashboardData = await fetchDashboardData()
    return { dashboardData }
  },
  component: HomePage
})

function HomePage() {
  const context = Route.useRouteContext()
  const { dashboardData } = Route.useLoaderData()
  const user = context.user

  if (user) {
    return (
      <AppLayout user={user}>
        <AuthenticatedDashboard user={user} data={dashboardData} />
      </AppLayout>
    )
  }

  return <UnauthenticatedHomePage />
}

// =============================================================================
// User Type (from route context)
// =============================================================================

interface User {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: string
  readonly primaryProvider: string
}

// =============================================================================
// Unauthenticated Home Page
// =============================================================================

function UnauthenticatedHomePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4"
      data-testid="unauthenticated-home"
    >
      <div className="w-full max-w-md text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Accountability</h1>
          <p className="mt-2 text-lg text-gray-600">
            Multi-company, multi-currency accounting
          </p>
        </div>

        {/* Welcome Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <svg
                className="h-8 w-8 text-blue-600"
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
          </div>

          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Welcome to Accountability
          </h2>
          <p className="mb-6 text-gray-500">
            Professional accounting software for managing multiple companies
            across currencies.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              data-testid="landing-sign-in"
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              data-testid="landing-register"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-2xl font-bold text-blue-600">Multi</div>
            <p className="text-xs text-gray-500">Company Support</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-2xl font-bold text-blue-600">Any</div>
            <p className="text-xs text-gray-500">Currency</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-2xl font-bold text-blue-600">Full</div>
            <p className="text-xs text-gray-500">Audit Trail</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Authenticated Dashboard
// =============================================================================

interface AuthenticatedDashboardProps {
  readonly user: User
  readonly data: DashboardData | null
}

function AuthenticatedDashboard({ user, data }: AuthenticatedDashboardProps) {
  const displayName = user.displayName || "there"

  return (
    <div className="space-y-6" data-testid="authenticated-dashboard">
      {/* Welcome Header */}
      <div data-testid="dashboard-welcome">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {displayName}!
        </h1>
        <p className="mt-1 text-gray-500">
          Here's an overview of your accounting data.
        </p>
      </div>

      {/* Metrics Cards */}
      <MetricsGrid>
        <MetricsCard
          label="Organizations"
          value={data?.organizationsCount ?? 0}
          icon={Building2}
          iconColor="blue"
          testId="metric-organizations"
        />
        <MetricsCard
          label="Companies"
          value={data?.companiesCount ?? 0}
          icon={Building}
          iconColor="green"
          testId="metric-companies"
        />
        <MetricsCard
          label="Pending Entries"
          value={data?.pendingEntriesCount ?? 0}
          icon={FileText}
          iconColor="orange"
          testId="metric-pending-entries"
        />
        <MetricsCard
          label="Open Periods"
          value={data?.periodDeadlines.length ?? 0}
          icon={Clock}
          iconColor="purple"
          testId="metric-open-periods"
        />
      </MetricsGrid>

      {/* Quick Actions */}
      <QuickActions />

      {/* Two-column layout for activity and balances */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <ActivityFeed activities={data?.recentActivity ?? []} />

        {/* Balance Summary */}
        <BalanceSummary companies={data?.companyBalances ?? []} />
      </div>

      {/* Period Deadlines */}
      <PeriodDeadlines deadlines={data?.periodDeadlines ?? []} />

      {/* Getting Started Section (shown when no data) */}
      {data && data.organizationsCount === 0 && (
        <GettingStartedSection />
      )}
    </div>
  )
}

// =============================================================================
// Getting Started Section
// =============================================================================

function GettingStartedSection() {
  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-6"
      data-testid="getting-started"
    >
      <h3 className="mb-2 text-lg font-semibold text-blue-900">
        Getting Started
      </h3>
      <p className="mb-4 text-sm text-blue-700">
        New to Accountability? Here's how to set up your accounting:
      </p>
      <ol className="space-y-2 text-sm text-blue-700">
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
            1
          </span>
          <span>Create an organization to group related companies</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
            2
          </span>
          <span>Add companies with their respective currencies</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
            3
          </span>
          <span>Set up your chart of accounts for each company</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
            4
          </span>
          <span>Start recording journal entries</span>
        </li>
      </ol>
      <Link
        to="/organizations"
        data-testid="getting-started-link"
        className="mt-4 inline-flex items-center text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        Get Started
        <svg
          className="ml-1 h-4 w-4"
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
      </Link>
    </div>
  )
}
