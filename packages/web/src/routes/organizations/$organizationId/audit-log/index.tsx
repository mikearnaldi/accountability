/**
 * Audit Log Route
 *
 * Displays audit trail of all changes made within the organization.
 *
 * Route: /organizations/:organizationId/audit-log
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { Select } from "@/components/ui/Select"
import { ClipboardList, FileText, User, Calendar, Search } from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface Company {
  readonly id: string
  readonly name: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchAuditLogData = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], error: "not_found" as const }
        }
        return { organization: null, companies: [], error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        error: null
      }
    } catch {
      return { organization: null, companies: [], error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/audit-log/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/audit-log`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchAuditLogData({ data: params.organizationId })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: result.organization,
      companies: result.companies
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
  component: AuditLogPage
})

// =============================================================================
// Page Component
// =============================================================================

function AuditLogPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Audit Log",
      href: `/organizations/${params.organizationId}/audit-log`
    }
  ]

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="audit-log-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Audit Log
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track all changes made within your organization
              </p>
            </div>
          </div>

          {/* Filters (placeholder) */}
          <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="audit-filters">
            <Select disabled className="w-36">
              <option>All Actions</option>
            </Select>
            <Select disabled className="w-40">
              <option>All Entities</option>
            </Select>
            <Select disabled className="w-36">
              <option>All Users</option>
            </Select>
            <Select disabled className="w-36">
              <option>Last 30 days</option>
            </Select>
          </div>
        </div>

        {/* Coming Soon / Empty State */}
        <div
          className="rounded-lg border border-gray-200 bg-white p-12 text-center"
          data-testid="empty-state"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <ClipboardList className="h-8 w-8 text-gray-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No audit entries yet</h3>
          <p className="mt-2 max-w-md mx-auto text-gray-500">
            The audit log tracks all changes made to your accounting data,
            including who made changes and when. This helps maintain compliance
            and provides a complete history of your financial records.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-4 max-w-3xl mx-auto text-left">
            <FeatureCard
              icon={FileText}
              title="All Changes"
              description="Every create, update, and delete is recorded"
            />
            <FeatureCard
              icon={User}
              title="User Tracking"
              description="See who made each change"
            />
            <FeatureCard
              icon={Calendar}
              title="Timestamps"
              description="Exact date and time of each action"
            />
            <FeatureCard
              icon={Search}
              title="Searchable"
              description="Filter by action, entity, user, or date"
            />
          </div>

          {/* Example of what an audit entry would look like */}
          <div className="mt-8 max-w-lg mx-auto">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Example audit entries:</h4>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <ExampleAuditEntry
                action="Created"
                entity="Journal Entry"
                entityId="JE-2024-001"
                user="John Smith"
                time="2 minutes ago"
              />
              <ExampleAuditEntry
                action="Updated"
                entity="Account"
                entityId="1000 - Cash"
                user="Jane Doe"
                time="1 hour ago"
              />
              <ExampleAuditEntry
                action="Approved"
                entity="Journal Entry"
                entityId="JE-2024-047"
                user="Admin User"
                time="Yesterday"
              />
            </div>
          </div>

          <p className="mt-8 text-sm text-gray-400">
            Audit log functionality coming soon
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

interface FeatureCardProps {
  readonly icon: typeof ClipboardList
  readonly title: string
  readonly description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <Icon className="h-5 w-5 text-gray-600" />
      <h4 className="mt-2 font-medium text-gray-900">{title}</h4>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}

interface ExampleAuditEntryProps {
  readonly action: string
  readonly entity: string
  readonly entityId: string
  readonly user: string
  readonly time: string
}

function ExampleAuditEntry({ action, entity, entityId, user, time }: ExampleAuditEntryProps) {
  const actionColors: Record<string, string> = {
    Created: "text-green-600 bg-green-50",
    Updated: "text-blue-600 bg-blue-50",
    Deleted: "text-red-600 bg-red-50",
    Approved: "text-purple-600 bg-purple-50"
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0 bg-white text-left">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium px-2 py-1 rounded ${actionColors[action] ?? "text-gray-600 bg-gray-50"}`}>
          {action}
        </span>
        <div>
          <span className="text-sm font-medium text-gray-900">{entity}</span>
          <span className="text-sm text-gray-500 ml-1">{entityId}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-gray-900">{user}</div>
        <div className="text-xs text-gray-500">{time}</div>
      </div>
    </div>
  )
}
