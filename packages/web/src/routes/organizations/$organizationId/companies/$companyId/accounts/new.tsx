/**
 * New Account Page
 *
 * Dedicated page for creating a new GL account.
 * Provides a full-page form experience with navigation breadcrumbs.
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useMemo } from "react"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { createServerApi } from "@/api/server"
import { AccountForm, type Account } from "@/components/forms/AccountForm"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { usePermissions } from "@/hooks/usePermissions"

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
    <MinimalRouteError error={error} />
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
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  // Permission checks
  const { canPerform } = usePermissions()
  const canCreateAccount = canPerform("account:create")

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

  // Permission denied UI
  if (!canCreateAccount) {
    return (
      <AppLayout
        user={user}
        organizations={organizations}
        currentOrganization={organization}
        breadcrumbItems={breadcrumbItems}
        companies={companiesForSidebar}
      >
        <div data-testid="new-account-page">
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <ShieldAlert className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="mb-2 text-lg font-medium text-gray-900">
              Permission Denied
            </h2>
            <p className="mb-6 text-gray-500">
              You don&apos;t have permission to create accounts. Contact your organization administrator for access.
            </p>
            <Button
              variant="secondary"
              onClick={handleCancel}
              icon={<ArrowLeft className="h-4 w-4" />}
              data-testid="back-to-accounts-button"
            >
              Back to Chart of Accounts
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
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
            organizationId={params.organizationId}
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
