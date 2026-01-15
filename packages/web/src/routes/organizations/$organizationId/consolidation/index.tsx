/**
 * Consolidation Route
 *
 * Manages consolidation groups for multi-company financial statement consolidation.
 *
 * Route: /organizations/:organizationId/consolidation
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/Button"
import { Globe2, Plus, Building, ArrowRight } from "lucide-react"

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

const fetchConsolidationData = createServerFn({ method: "GET" })
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

export const Route = createFileRoute("/organizations/$organizationId/consolidation/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchConsolidationData({ data: params.organizationId })

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
  component: ConsolidationPage
})

// =============================================================================
// Page Component
// =============================================================================

function ConsolidationPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const user = context.user

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Consolidation",
      href: `/organizations/${params.organizationId}/consolidation`
    }
  ]

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  return (
    <AppLayout
      user={user}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="consolidation-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Consolidation
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Consolidate financial statements across multiple companies
              </p>
            </div>

            <Button disabled data-testid="create-group-button">
              <Plus className="mr-2 h-4 w-4" />
              New Consolidation Group
            </Button>
          </div>
        </div>

        {/* Coming Soon / Empty State */}
        <div
          className="rounded-lg border border-gray-200 bg-white p-12 text-center"
          data-testid="empty-state"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
            <Globe2 className="h-8 w-8 text-purple-600" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No consolidation groups yet</h3>
          <p className="mt-2 max-w-md mx-auto text-gray-500">
            Consolidation groups allow you to combine financial statements from multiple companies
            into a single consolidated view. This feature supports elimination entries,
            currency translation, and minority interest calculations.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto text-left">
            <FeatureCard
              icon={Building}
              title="Multi-Company"
              description="Combine statements from parent and subsidiary companies"
            />
            <FeatureCard
              icon={Globe2}
              title="Currency Translation"
              description="Automatic translation using configured exchange rates"
            />
            <FeatureCard
              icon={ArrowRight}
              title="Eliminations"
              description="Automatic intercompany transaction elimination"
            />
          </div>

          <p className="mt-8 text-sm text-gray-400">
            Consolidation functionality coming soon
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
  readonly icon: typeof Globe2
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
