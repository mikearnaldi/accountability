/**
 * New Account Page
 *
 * Dedicated page for creating a new GL account.
 * Provides a full-page form experience with navigation breadcrumbs.
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useMemo } from "react"
import { createServerApi } from "@/api/server"
import { AccountForm, type Account } from "@/components/forms/AccountForm"
import { AppLayout } from "@/components/layout/AppLayout"

// =============================================================================
// Types
// =============================================================================

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
// Server Functions
// =============================================================================

const fetchNewAccountData = createServerFn({ method: "GET" })
  .inputValidator((data: { companyId: string; organizationId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        accounts: [],
        company: null,
        organization: null,
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

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
        if (
          typeof companyResult.error === "object" &&
          "status" in companyResult.error &&
          companyResult.error.status === 404
        ) {
          return {
            accounts: [],
            company: null,
            organization: null,
            error: "not_found" as const
          }
        }
        return {
          accounts: [],
          company: null,
          organization: null,
          error: "failed" as const
        }
      }

      if (orgResult.error || accountsResult.error) {
        return {
          accounts: [],
          company: null,
          organization: null,
          error: "failed" as const
        }
      }

      return {
        accounts: accountsResult.data?.accounts ?? [],
        company: companyResult.data,
        organization: orgResult.data,
        error: null
      }
    } catch {
      return {
        accounts: [],
        company: null,
        organization: null,
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Route
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/accounts/new"
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
    const result = await fetchNewAccountData({
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
  component: NewAccountPage
})

// =============================================================================
// Page Component
// =============================================================================

function NewAccountPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const router = useRouter()
  const params = Route.useParams()
  const user = context.user

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const accounts = loaderData.accounts as readonly Account[]
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Pass current company to sidebar for quick actions
  const companiesForSidebar = useMemo(
    () => company ? [{ id: company.id, name: company.name }] : [],
    [company?.id, company?.name]
  )

  // Breadcrumb items for New Account page
  const breadcrumbItems = useMemo(
    () =>
      company
        ? [
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
            },
            {
              label: "New Account",
              href: `/organizations/${params.organizationId}/companies/${params.companyId}/accounts/new`
            }
          ]
        : [],
    [company?.name, params.organizationId, params.companyId]
  )

  if (!company || !organization) {
    return null
  }

  const handleSuccess = () => {
    router.navigate({
      to: "/organizations/$organizationId/companies/$companyId/accounts",
      params: {
        organizationId: params.organizationId,
        companyId: params.companyId
      }
    })
  }

  const handleCancel = () => {
    router.navigate({
      to: "/organizations/$organizationId/companies/$companyId/accounts",
      params: {
        organizationId: params.organizationId,
        companyId: params.companyId
      }
    })
  }

  return (
    <AppLayout
      user={user}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
      currentCompany={{ id: company.id, name: company.name }}
    >
      <div data-testid="new-account-page">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Create New Account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Add a new account to the {company.name} chart of accounts
          </p>
        </div>

        {/* Form */}
        <div className="max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <AccountForm
            mode="create"
            companyId={params.companyId}
            accounts={accounts}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </AppLayout>
  )
}
