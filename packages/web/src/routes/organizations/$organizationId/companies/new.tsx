/**
 * New Company Page
 *
 * Dedicated page for creating a new company within an organization.
 * Provides a full-page form experience with navigation breadcrumbs.
 * Per UI_ARCHITECTURE.md spec, this page uses AppLayout with sidebar visible.
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useMemo, useState } from "react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { CompanyForm, type CompanyFormData, type CurrencyOption } from "@/components/forms/CompanyForm"
import type { JurisdictionOption } from "@/components/ui/JurisdictionSelect"
import { AppLayout } from "@/components/layout/AppLayout"
import { usePermissions } from "@/hooks/usePermissions"

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

const fetchNewCompanyData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        organization: null,
        companies: [],
        currencies: [],
        jurisdictions: [],
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, currenciesResult, jurisdictionsResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/currencies", {
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/jurisdictions", {
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (
          typeof orgResult.error === "object" &&
          "status" in orgResult.error &&
          orgResult.error.status === 404
        ) {
          return {
            organization: null,
            companies: [],
            currencies: [],
            jurisdictions: [],
            error: "not_found" as const
          }
        }
        return {
          organization: null,
          companies: [],
          currencies: [],
          jurisdictions: [],
          error: "failed" as const
        }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        currencies: currenciesResult.data?.currencies ?? [],
        jurisdictions: jurisdictionsResult.data?.jurisdictions ?? [],
        error: null
      }
    } catch {
      return {
        organization: null,
        companies: [],
        currencies: [],
        jurisdictions: [],
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Route
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/new"
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
    const result = await fetchNewCompanyData({
      data: {
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      currencies: result.currencies,
      jurisdictions: result.jurisdictions
    }
  },
  component: NewCompanyPage
})

// =============================================================================
// Page Component
// =============================================================================

function NewCompanyPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const router = useRouter()
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const currencies = loaderData.currencies as readonly CurrencyOption[]
  const jurisdictions = loaderData.jurisdictions as readonly JurisdictionOption[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Permission check
  const { canPerform } = usePermissions()
  const canCreateCompany = canPerform("company:create")

  // Map companies for sidebar quick actions
  const companiesForSidebar = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies]
  )

  // Breadcrumb items for New Company page
  const breadcrumbItems = useMemo(
    () => [
      {
        label: "Companies",
        href: `/organizations/${params.organizationId}/companies`
      },
      {
        label: "New Company",
        href: `/organizations/${params.organizationId}/companies/new`
      }
    ],
    [params.organizationId]
  )

  if (!organization) {
    return null
  }

  // Show permission denied if user cannot create companies
  if (!canCreateCompany) {
    return (
      <AppLayout
        user={user}
        organizations={organizations}
        currentOrganization={organization}
        breadcrumbItems={breadcrumbItems}
        companies={companiesForSidebar}
      >
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center" data-testid="permission-denied">
          <h2 className="text-lg font-semibold text-red-800">Permission Denied</h2>
          <p className="mt-2 text-sm text-red-600">
            You don&apos;t have permission to create companies in this organization.
          </p>
          <button
            onClick={() => router.navigate({
              to: "/organizations/$organizationId/companies",
              params: { organizationId: params.organizationId }
            })}
            className="mt-4 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
          >
            Back to Companies
          </button>
        </div>
      </AppLayout>
    )
  }

  const handleSubmit = async (formData: CompanyFormData) => {
    setIsSubmitting(true)
    setApiError(null)

    // Convert ISO date string to LocalDate object for API
    let incorporationDate: { year: number; month: number; day: number } | null = null
    if (formData.incorporationDate) {
      const [year, month, day] = formData.incorporationDate.split("-").map(Number)
      incorporationDate = { year, month, day }
    }

    try {
      const { error } = await api.POST("/api/v1/companies", {
        body: {
          organizationId: params.organizationId,
          name: formData.name,
          legalName: formData.legalName,
          jurisdiction: formData.jurisdiction,
          taxId: formData.taxId,
          incorporationDate,
          registrationNumber: formData.registrationNumber,
          registeredAddress: null,
          industryCode: null,
          companyType: null,
          incorporationJurisdiction: null,
          functionalCurrency: formData.functionalCurrency,
          reportingCurrency: formData.reportingCurrency,
          fiscalYearEnd: formData.fiscalYearEnd
        }
      })

      if (error) {
        let errorMessage = "Failed to create company"
        if (typeof error === "object" && error !== null) {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
        }
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Note: Fiscal periods are now computed automatically from transaction dates (Issue 33/34)
      // No need to create fiscal years/periods explicitly

      // Navigate to companies list after successful creation
      router.navigate({
        to: "/organizations/$organizationId/companies",
        params: {
          organizationId: params.organizationId
        }
      })
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.navigate({
      to: "/organizations/$organizationId/companies",
      params: {
        organizationId: params.organizationId
      }
    })
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="new-company-page">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Create New Company
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Add a new company to {organization.name}
          </p>
        </div>

        {/* Form */}
        <div className="max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <CompanyForm
            currencies={currencies}
            jurisdictions={jurisdictions}
            defaultCurrency={organization.reportingCurrency}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            apiError={apiError}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </AppLayout>
  )
}
