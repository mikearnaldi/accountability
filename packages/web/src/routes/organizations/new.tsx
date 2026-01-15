/**
 * Create Organization Page
 *
 * Full-page form to create a new organization with all API-supported fields.
 *
 * Features:
 * - Form fields:
 *   - Name (required)
 *   - Reporting Currency (dropdown from /api/v1/currencies)
 *   - Settings (collapsible):
 *     - Default Locale
 *     - Default Timezone
 *     - Use Fiscal Year (checkbox)
 *     - Default Decimal Places (0-4)
 * - Client-side validation
 * - Submit via api.POST('/api/v1/organizations')
 * - Success: Navigate to organization detail
 * - Error: Show inline validation errors
 *
 * Route: /organizations/new
 */

import { createFileRoute, redirect, useRouter, useNavigate, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { OrganizationForm } from "@/components/forms/OrganizationForm"

// =============================================================================
// Types
// =============================================================================

export interface CurrencyOption {
  readonly code: string
  readonly name: string
  readonly symbol: string
  readonly decimalPlaces: number
  readonly isActive: boolean
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchCurrencies = createServerFn({ method: "GET" }).handler(async (): Promise<{
  currencies: CurrencyOption[]
  error: string | null
}> => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return { currencies: [], error: "unauthorized" }
  }

  try {
    const serverApi = createServerApi()
    const { data, error } = await serverApi.GET("/api/v1/currencies", {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (error || !data) {
      return { currencies: [], error: "Failed to load currencies" }
    }

    return { currencies: data.currencies, error: null }
  } catch {
    return { currencies: [], error: "Failed to load currencies" }
  }
})

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/new")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/organizations/new"
        }
      })
    }
  },
  loader: async () => {
    const result = await fetchCurrencies()
    return result
  },
  component: CreateOrganizationPage
})

// =============================================================================
// Page Component
// =============================================================================

function CreateOrganizationPage() {
  const { currencies, error: loadError } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(loadError)

  const handleSubmit = async (formData: {
    name: string
    reportingCurrency: string
    settings: {
      defaultLocale: string
      defaultTimezone: string
      useFiscalYear: boolean
      defaultDecimalPlaces: number
    }
  }) => {
    setIsSubmitting(true)
    setApiError(null)

    try {
      const { data, error } = await api.POST("/api/v1/organizations", {
        body: {
          name: formData.name,
          reportingCurrency: formData.reportingCurrency,
          settings: formData.settings
        }
      })

      if (error) {
        // Extract error message
        let errorMessage = "Failed to create organization"
        if (typeof error === "object" && error !== null) {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
        }
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Navigate to the new organization's detail page
      if (data?.id) {
        // Invalidate to refresh any cached data
        await router.invalidate()
        await navigate({
          to: "/organizations/$organizationId",
          params: { organizationId: data.id }
        })
      } else {
        // Fallback: navigate to organizations list
        await router.invalidate()
        await navigate({ to: "/organizations" })
      }
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="create-organization-page">
      {/* Header */}
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
            <span className="text-gray-400">/</span>
            <span className="text-xl font-semibold text-gray-900">New</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          to="/organizations"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-6"
          data-testid="back-to-organizations"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Organizations
        </Link>

        {/* Form Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create Organization</h1>
            <p className="mt-1 text-sm text-gray-500">
              Set up a new organization to manage companies, accounts, and financial data.
            </p>
          </div>

          <OrganizationForm
            currencies={currencies}
            isCurrenciesLoading={false}
            onSubmit={handleSubmit}
            cancelHref="/organizations"
            apiError={apiError}
            isSubmitting={isSubmitting}
          />
        </div>
      </main>
    </div>
  )
}
