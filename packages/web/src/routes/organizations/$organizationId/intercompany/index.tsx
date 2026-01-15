/**
 * Intercompany Transactions Route
 *
 * Manages intercompany transactions and reconciliation between related companies.
 *
 * Route: /organizations/:organizationId/intercompany
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/Button"
import { ArrowLeftRight, Plus, Building2, CheckCircle, AlertCircle } from "lucide-react"

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

const fetchIntercompanyData = createServerFn({ method: "GET" })
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

export const Route = createFileRoute("/organizations/$organizationId/intercompany/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/intercompany`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchIntercompanyData({ data: params.organizationId })

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
  component: IntercompanyPage
})

// =============================================================================
// Page Component
// =============================================================================

function IntercompanyPage() {
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
      label: "Intercompany",
      href: `/organizations/${params.organizationId}/intercompany`
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
      <div data-testid="intercompany-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Intercompany Transactions
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track and reconcile transactions between related companies
              </p>
            </div>

            <Button disabled data-testid="create-transaction-button">
              <Plus className="mr-2 h-4 w-4" />
              New Transaction
            </Button>
          </div>
        </div>

        {/* Coming Soon / Empty State */}
        <div
          className="rounded-lg border border-gray-200 bg-white p-12 text-center"
          data-testid="empty-state"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <ArrowLeftRight className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No intercompany transactions</h3>
          <p className="mt-2 max-w-md mx-auto text-gray-500">
            Intercompany transactions track financial activity between related companies within your organization.
            This helps ensure proper elimination during consolidation and maintains accurate financial records.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto text-left">
            <FeatureCard
              icon={Building2}
              title="Cross-Company"
              description="Record transactions between any companies in your organization"
            />
            <FeatureCard
              icon={CheckCircle}
              title="Auto-Reconciliation"
              description="Automatic matching of intercompany receivables and payables"
            />
            <FeatureCard
              icon={AlertCircle}
              title="Discrepancy Alerts"
              description="Notifications when intercompany balances don't match"
            />
          </div>

          <p className="mt-8 text-sm text-gray-400">
            Intercompany functionality coming soon
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
  readonly icon: typeof ArrowLeftRight
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
