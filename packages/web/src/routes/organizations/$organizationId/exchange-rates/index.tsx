/**
 * Exchange Rates List Route
 *
 * Displays and manages exchange rates for an organization.
 * Supports filtering by currency pair, rate type, and date range.
 *
 * Route: /organizations/:organizationId/exchange-rates
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { TrendingUp, Plus, Trash2, Calendar, ArrowRightLeft } from "lucide-react"
import { Tooltip } from "@/components/ui/Tooltip"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface ExchangeRate {
  readonly id: string
  readonly fromCurrency: string
  readonly toCurrency: string
  readonly rate: string
  readonly effectiveDate: string
  readonly rateType: "Spot" | "Average" | "Historical"
  readonly source: "Manual" | "API" | "Import"
  readonly createdAt: { readonly epochMillis: number }
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

const fetchOrganization = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const { data, error } = await serverApi.GET("/api/v1/organizations/{id}", {
        params: { path: { id: organizationId } },
        headers: { Authorization: `Bearer ${sessionToken}` }
      })

      if (error) {
        if (typeof error === "object" && "status" in error && error.status === 404) {
          return { organization: null, error: "not_found" as const }
        }
        return { organization: null, error: "failed" as const }
      }

      return { organization: data, error: null }
    } catch {
      return { organization: null, error: "failed" as const }
    }
  })

const fetchExchangeRates = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; limit?: number; offset?: number }) => data)
  .handler(async ({ data: { organizationId, limit = 50, offset = 0 } }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { rates: [], total: 0, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const { data, error } = await serverApi.GET("/api/v1/exchange-rates", {
        params: { query: { organizationId, limit: String(limit), offset: String(offset) } },
        headers: { Authorization: `Bearer ${sessionToken}` }
      })

      if (error) {
        return { rates: [], total: 0, error: "failed" as const }
      }

      return {
        rates: data?.rates ?? [],
        total: data?.total ?? 0,
        error: null
      }
    } catch {
      return { rates: [], total: 0, error: "failed" as const }
    }
  })

const fetchCurrencies = createServerFn({ method: "GET" }).handler(async () => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return { currencies: [], error: "unauthorized" as const }
  }

  try {
    const serverApi = createServerApi()
    const { data, error } = await serverApi.GET("/api/v1/currencies", {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (error || !data) {
      return { currencies: [], error: "failed" as const }
    }

    return { currencies: data.currencies, error: null }
  } catch {
    return { currencies: [], error: "failed" as const }
  }
})

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/exchange-rates/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/exchange-rates`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const [orgResult, ratesResult, currenciesResult] = await Promise.all([
      fetchOrganization({ data: params.organizationId }),
      fetchExchangeRates({ data: { organizationId: params.organizationId, limit: 50, offset: 0 } }),
      fetchCurrencies()
    ])

    if (orgResult.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: orgResult.organization,
      rates: ratesResult.rates,
      ratesTotal: ratesResult.total,
      currencies: currenciesResult.currencies
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: ExchangeRatesPage
})

// =============================================================================
// Page Component
// =============================================================================

function ExchangeRatesPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const rates = loaderData.rates as readonly ExchangeRate[]
  const currencies = loaderData.currencies as readonly Currency[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [rateTypeFilter, setRateTypeFilter] = useState<string>("all")
  const [fromCurrencyFilter, setFromCurrencyFilter] = useState<string>("all")
  const [toCurrencyFilter, setToCurrencyFilter] = useState<string>("all")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<{
    fromCurrency: string
    toCurrency: string
    rate: string
    effectiveDate: string
    rateType: RateTypeValue
  }>({
    fromCurrency: "",
    toCurrency: "",
    rate: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    rateType: "Spot"
  })

  // Filter rates
  const filteredRates = useMemo(() => {
    return rates.filter((rate) => {
      if (rateTypeFilter !== "all" && rate.rateType !== rateTypeFilter) return false
      if (fromCurrencyFilter !== "all" && rate.fromCurrency !== fromCurrencyFilter) return false
      if (toCurrencyFilter !== "all" && rate.toCurrency !== toCurrencyFilter) return false
      return true
    })
  }, [rates, rateTypeFilter, fromCurrencyFilter, toCurrencyFilter])

  // Get unique currencies from rates for filter options
  const usedCurrencies = useMemo(() => {
    const fromSet = new Set(rates.map((r) => r.fromCurrency))
    const toSet = new Set(rates.map((r) => r.toCurrency))
    return Array.from(new Set([...fromSet, ...toSet])).sort()
  }, [rates])

  const handleCreateRate = async () => {
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

      await router.invalidate()
      setShowCreateForm(false)
      setFormData({
        fromCurrency: "",
        toCurrency: "",
        rate: "",
        effectiveDate: new Date().toISOString().split("T")[0],
        rateType: "Spot"
      })
      setIsSubmitting(false)
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm("Are you sure you want to delete this exchange rate?")) {
      return
    }

    setDeletingId(rateId)

    try {
      const { error } = await api.DELETE("/api/v1/exchange-rates/{id}", {
        params: { path: { id: rateId } }
      })

      if (error) {
        alert("Failed to delete exchange rate")
        setDeletingId(null)
        return
      }

      await router.invalidate()
      setDeletingId(null)
    } catch {
      alert("An unexpected error occurred")
      setDeletingId(null)
    }
  }

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Exchange Rates",
      href: `/organizations/${params.organizationId}/exchange-rates`
    }
  ]

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
    >
      <div data-testid="exchange-rates-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Exchange Rates
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage currency exchange rates for multi-currency transactions
              </p>
            </div>

            {/* Only show header button when rates exist - empty state has its own CTA */}
            {rates.length > 0 && (
              <Button
                onClick={() => setShowCreateForm(true)}
                icon={<Plus className="h-4 w-4" />}
                data-testid="create-rate-button"
              >
                Add Rate
              </Button>
            )}
          </div>

          {/* Filters */}
          {rates.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="rate-filters">
              <Select
                value={rateTypeFilter}
                onChange={(e) => setRateTypeFilter(e.target.value)}
                className="w-36"
                data-testid="filter-rate-type"
              >
                <option value="all">All Types</option>
                <option value="Spot">Spot</option>
                <option value="Average">Average</option>
                <option value="Historical">Historical</option>
              </Select>

              <Select
                value={fromCurrencyFilter}
                onChange={(e) => setFromCurrencyFilter(e.target.value)}
                className="w-36"
                data-testid="filter-from-currency"
              >
                <option value="all">From: All</option>
                {usedCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>

              <Select
                value={toCurrencyFilter}
                onChange={(e) => setToCurrencyFilter(e.target.value)}
                className="w-36"
                data-testid="filter-to-currency"
              >
                <option value="all">To: All</option>
                {usedCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>

              {(rateTypeFilter !== "all" || fromCurrencyFilter !== "all" || toCurrencyFilter !== "all") && (
                <button
                  onClick={() => {
                    setRateTypeFilter("all")
                    setFromCurrencyFilter("all")
                    setToCurrencyFilter("all")
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Create Rate Modal */}
        {showCreateForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            data-testid="create-rate-modal"
          >
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Add Exchange Rate
              </h2>

              {apiError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {apiError}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Currency *
                    </label>
                    <Select
                      value={formData.fromCurrency}
                      onChange={(e) => setFormData({ ...formData, fromCurrency: e.target.value })}
                      data-testid="form-from-currency"
                    >
                      <option value="">Select...</option>
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      To Currency *
                    </label>
                    <Select
                      value={formData.toCurrency}
                      onChange={(e) => setFormData({ ...formData, toCurrency: e.target.value })}
                      data-testid="form-to-currency"
                    >
                      <option value="">Select...</option>
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exchange Rate *
                  </label>
                  <Input
                    type="text"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="1.0850"
                    data-testid="form-rate"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    1 {formData.fromCurrency || "FROM"} = {formData.rate || "?"} {formData.toCurrency || "TO"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective Date *
                    </label>
                    <Input
                      type="date"
                      value={formData.effectiveDate}
                      onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                      data-testid="form-effective-date"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rate Type *
                    </label>
                    <Select
                      value={formData.rateType}
                      onChange={(e) => {
                        const value = e.target.value
                        if (isValidRateType(value)) {
                          setFormData({ ...formData, rateType: value })
                        }
                      }}
                      data-testid="form-rate-type"
                    >
                      <option value="Spot">Spot</option>
                      <option value="Average">Average</option>
                      <option value="Historical">Historical</option>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateForm(false)
                    setApiError(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateRate}
                  disabled={isSubmitting}
                  data-testid="submit-rate-button"
                >
                  {isSubmitting ? "Creating..." : "Create Rate"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Rates Table or Empty State */}
        {rates.length === 0 ? (
          <EmptyRatesState onCreateClick={() => setShowCreateForm(true)} />
        ) : filteredRates.length === 0 ? (
          <div
            className="rounded-lg border border-gray-200 bg-white p-8 text-center"
            data-testid="no-filtered-results"
          >
            <p className="text-gray-500">No rates match the selected filters.</p>
            <button
              onClick={() => {
                setRateTypeFilter("all")
                setFromCurrencyFilter("all")
                setToCurrencyFilter("all")
              }}
              className="mt-2 text-blue-600 hover:text-blue-700"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200" data-testid="rates-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="The source and target currencies for the exchange rate (e.g., USD to EUR)">
                      <span className="cursor-help">Currency Pair</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Exchange rate value: how many units of the target currency equal one unit of the source currency">
                      <span className="cursor-help">Rate</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Date from which this exchange rate is applicable for transactions">
                      <span className="cursor-help">Effective Date</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Rate type: Spot (current market rate), Average (period average), or Historical (past rate)">
                      <span className="cursor-help">Type</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="How the rate was obtained: Manual entry, API feed, or file Import">
                      <span className="cursor-help">Source</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredRates.map((rate) => (
                  <tr
                    key={rate.id}
                    className="hover:bg-gray-50"
                    data-testid={`rate-row-${rate.id}`}
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{rate.fromCurrency}</span>
                        <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{rate.toCurrency}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-900 font-mono">
                      {rate.rate}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {rate.effectiveDate}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <RateTypeBadge type={rate.rateType} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500 text-sm">
                      {rate.source}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteRate(rate.id)}
                        disabled={deletingId === rate.id}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50"
                        title="Delete rate"
                        data-testid={`delete-rate-${rate.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function RateTypeBadge({ type }: { readonly type: "Spot" | "Average" | "Historical" }) {
  const colors = {
    Spot: "bg-blue-100 text-blue-800",
    Average: "bg-green-100 text-green-800",
    Historical: "bg-gray-100 text-gray-800"
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type]}`}>
      {type}
    </span>
  )
}

function EmptyRatesState({ onCreateClick }: { readonly onCreateClick: () => void }) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-12 text-center"
      data-testid="empty-state"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <TrendingUp className="h-8 w-8 text-blue-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">No exchange rates yet</h3>
      <p className="mt-2 max-w-sm mx-auto text-gray-500">
        Exchange rates are used to convert transactions between different currencies.
        Add your first rate to enable multi-currency accounting.
      </p>
      <Button
        onClick={onCreateClick}
        icon={<Plus className="h-4 w-4" />}
        className="mt-6"
        data-testid="empty-state-create-button"
      >
        Add First Exchange Rate
      </Button>
    </div>
  )
}
