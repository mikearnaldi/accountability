/**
 * New Exchange Rate Page
 *
 * Dedicated page for creating a new exchange rate within an organization.
 * Provides a full-page form experience with navigation breadcrumbs.
 * Per UI_ARCHITECTURE.md spec, this page uses AppLayout with sidebar visible.
 *
 * Route: /organizations/:organizationId/exchange-rates/new
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useMemo, useState } from "react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, ArrowRightLeft } from "lucide-react"

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

interface Currency {
  readonly code: string
  readonly name: string
  readonly symbol: string
}

type RateTypeValue = "Spot" | "Average" | "Historical"

function isValidRateType(value: string): value is RateTypeValue {
  return value === "Spot" || value === "Average" || value === "Historical"
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchNewExchangeRateData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        organization: null,
        companies: [],
        currencies: [],
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, currenciesResult] = await Promise.all([
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
            error: "not_found" as const
          }
        }
        return {
          organization: null,
          companies: [],
          currencies: [],
          error: "failed" as const
        }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        currencies: currenciesResult.data?.currencies ?? [],
        error: null
      }
    } catch {
      return {
        organization: null,
        companies: [],
        currencies: [],
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Route
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/exchange-rates/new"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/exchange-rates/new`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchNewExchangeRateData({
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
      currencies: result.currencies
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: NewExchangeRatePage
})

// =============================================================================
// Page Component
// =============================================================================

function NewExchangeRatePage() {
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
  const currencies = loaderData.currencies as readonly Currency[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<{
    fromCurrency: string
    toCurrency: string
    rate: string
    effectiveDate: string
    rateType: RateTypeValue
  }>({
    fromCurrency: "",
    toCurrency: organization?.reportingCurrency ?? "",
    rate: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    rateType: "Spot"
  })

  // Map companies for sidebar quick actions
  const companiesForSidebar = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies]
  )

  // Breadcrumb items for New Exchange Rate page
  const breadcrumbItems = useMemo(
    () => [
      {
        label: "Exchange Rates",
        href: `/organizations/${params.organizationId}/exchange-rates`
      },
      {
        label: "New Exchange Rate",
        href: `/organizations/${params.organizationId}/exchange-rates/new`
      }
    ],
    [params.organizationId]
  )

  if (!organization) {
    return null
  }

  const handleSubmit = async () => {
    if (!formData.fromCurrency || !formData.toCurrency || !formData.rate || !formData.effectiveDate) {
      setApiError("Please fill in all required fields")
      return
    }

    if (formData.fromCurrency === formData.toCurrency) {
      setApiError("From and To currencies must be different")
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    try {
      const { error } = await api.POST("/api/v1/exchange-rates", {
        body: {
          organizationId: params.organizationId,
          fromCurrency: formData.fromCurrency,
          toCurrency: formData.toCurrency,
          rate: formData.rate,
          effectiveDate: formData.effectiveDate,
          rateType: formData.rateType,
          source: "Manual"
        }
      })

      if (error) {
        let errorMessage = "Failed to create exchange rate"
        if (typeof error === "object" && error !== null && "message" in error) {
          errorMessage = String(error.message)
        }
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Navigate to exchange rates list after successful creation
      router.navigate({
        to: "/organizations/$organizationId/exchange-rates",
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
      to: "/organizations/$organizationId/exchange-rates",
      params: {
        organizationId: params.organizationId
      }
    })
  }

  // Check form validity
  const isFormValid =
    formData.fromCurrency !== "" &&
    formData.toCurrency !== "" &&
    formData.rate !== "" &&
    formData.effectiveDate !== "" &&
    formData.fromCurrency !== formData.toCurrency

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="new-exchange-rate-page">
        {/* Back Link and Page Title */}
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            data-testid="back-link"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Exchange Rates
          </button>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Add Exchange Rate
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new exchange rate for multi-currency transactions
          </p>
        </div>

        {/* Form */}
        <div className="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {apiError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="api-error">
              {apiError}
            </div>
          )}

          <div className="space-y-6">
            {/* Currency Pair Section */}
            <div>
              <h2 className="mb-4 text-lg font-medium text-gray-900">Currency Pair</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fromCurrency" className="block text-sm font-medium text-gray-700 mb-1">
                    From Currency *
                  </label>
                  <Select
                    id="fromCurrency"
                    value={formData.fromCurrency}
                    onChange={(e) => setFormData({ ...formData, fromCurrency: e.target.value })}
                    data-testid="form-from-currency"
                  >
                    <option value="">Select currency...</option>
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label htmlFor="toCurrency" className="block text-sm font-medium text-gray-700 mb-1">
                    To Currency *
                  </label>
                  <Select
                    id="toCurrency"
                    value={formData.toCurrency}
                    onChange={(e) => setFormData({ ...formData, toCurrency: e.target.value })}
                    data-testid="form-to-currency"
                  >
                    <option value="">Select currency...</option>
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Currency Preview */}
              {formData.fromCurrency && formData.toCurrency && (
                <div className="mt-4 flex items-center justify-center gap-3 rounded-lg bg-gray-50 p-4">
                  <span className="text-lg font-medium text-gray-900">{formData.fromCurrency}</span>
                  <ArrowRightLeft className="h-5 w-5 text-gray-400" />
                  <span className="text-lg font-medium text-gray-900">{formData.toCurrency}</span>
                </div>
              )}
            </div>

            {/* Rate Details Section */}
            <div>
              <h2 className="mb-4 text-lg font-medium text-gray-900">Rate Details</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">
                    Exchange Rate *
                  </label>
                  <Input
                    id="rate"
                    type="text"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="1.0850"
                    data-testid="form-rate"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    1 {formData.fromCurrency || "FROM"} = {formData.rate || "?"} {formData.toCurrency || "TO"}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="effectiveDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Effective Date *
                    </label>
                    <Input
                      id="effectiveDate"
                      type="date"
                      value={formData.effectiveDate}
                      onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                      data-testid="form-effective-date"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      The date from which this rate applies
                    </p>
                  </div>

                  <div>
                    <label htmlFor="rateType" className="block text-sm font-medium text-gray-700 mb-1">
                      Rate Type *
                    </label>
                    <Select
                      id="rateType"
                      value={formData.rateType}
                      onChange={(e) => {
                        const value = e.target.value
                        if (isValidRateType(value)) {
                          setFormData({ ...formData, rateType: value })
                        }
                      }}
                      data-testid="form-rate-type"
                    >
                      <option value="Spot">Spot Rate</option>
                      <option value="Average">Average Rate</option>
                      <option value="Historical">Historical Rate</option>
                    </Select>
                    <p className="mt-1 text-sm text-gray-500">
                      {formData.rateType === "Spot" && "Current market rate for immediate transactions"}
                      {formData.rateType === "Average" && "Averaged rate over a period for income statement items"}
                      {formData.rateType === "Historical" && "Rate at a specific historical date"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
              data-testid="submit-button"
            >
              {isSubmitting ? "Creating..." : "Create Exchange Rate"}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
