/**
 * Edit Intercompany Transaction Route
 *
 * Form for editing an existing intercompany transaction.
 *
 * Route: /organizations/:organizationId/intercompany/:transactionId/edit
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo, useEffect } from "react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { MatchingStatusBadge } from "@/components/intercompany/MatchingStatusBadge"
import { ArrowLeft, Building2, AlertTriangle } from "lucide-react"

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
  readonly functionalCurrency: string
}

interface IntercompanyTransaction {
  readonly id: string
  readonly fromCompanyId: string
  readonly toCompanyId: string
  readonly transactionType: "SalePurchase" | "Loan" | "ManagementFee" | "Dividend" | "CapitalContribution" | "CostAllocation" | "Royalty"
  readonly transactionDate: string
  readonly amount: {
    readonly value: string
    readonly currency: string
  }
  readonly matchingStatus: "Matched" | "Unmatched" | "PartiallyMatched" | "VarianceApproved"
  readonly fromJournalEntryId: string | null
  readonly toJournalEntryId: string | null
  readonly description: string | null
  readonly varianceAmount: { readonly value: string; readonly currency: string } | null
  readonly varianceExplanation: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

type TransactionType = IntercompanyTransaction["transactionType"]

// Transaction type options
const TRANSACTION_TYPES: Array<{ value: TransactionType; label: string }> = [
  { value: "SalePurchase", label: "Sale/Purchase" },
  { value: "Loan", label: "Loan" },
  { value: "ManagementFee", label: "Management Fee" },
  { value: "Dividend", label: "Dividend" },
  { value: "CapitalContribution", label: "Capital Contribution" },
  { value: "CostAllocation", label: "Cost Allocation" },
  { value: "Royalty", label: "Royalty" }
]

// =============================================================================
// Server Functions
// =============================================================================

const fetchTransactionData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; transactionId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], transaction: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, transactionResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/intercompany-transactions/{id}", {
          params: { path: { id: data.transactionId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], transaction: null, error: "org_not_found" as const }
        }
        return { organization: null, companies: [], transaction: null, error: "failed" as const }
      }

      if (transactionResult.error) {
        if (typeof transactionResult.error === "object" && "status" in transactionResult.error && transactionResult.error.status === 404) {
          return { organization: orgResult.data, companies: companiesResult.data?.companies ?? [], transaction: null, error: "transaction_not_found" as const }
        }
        return { organization: orgResult.data, companies: companiesResult.data?.companies ?? [], transaction: null, error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        transaction: transactionResult.data,
        error: null
      }
    } catch {
      return { organization: null, companies: [], transaction: null, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/intercompany/$transactionId/edit")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/intercompany/${params.transactionId}/edit`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchTransactionData({
      data: { organizationId: params.organizationId, transactionId: params.transactionId }
    })

    if (result.error === "org_not_found") {
      throw new Error("Organization not found")
    }

    if (result.error === "transaction_not_found") {
      throw new Error("Transaction not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      transaction: result.transaction
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: EditIntercompanyTransactionPage
})

// =============================================================================
// Page Component
// =============================================================================

function EditIntercompanyTransactionPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const transaction = loaderData.transaction as IntercompanyTransaction | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Form state - initialized from transaction
  const [transactionType, setTransactionType] = useState<TransactionType>("SalePurchase")
  const [transactionDate, setTransactionDate] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [description, setDescription] = useState("")
  const [varianceAmount, setVarianceAmount] = useState("")
  const [varianceExplanation, setVarianceExplanation] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Initialize form from transaction
  useEffect(() => {
    if (transaction) {
      setTransactionType(transaction.transactionType)
      setTransactionDate(transaction.transactionDate)
      setAmount(transaction.amount.value)
      setCurrency(transaction.amount.currency)
      setDescription(transaction.description ?? "")
      setVarianceAmount(transaction.varianceAmount?.value ?? "")
      setVarianceExplanation(transaction.varianceExplanation ?? "")
    }
  }, [transaction])

  // Validation state
  const [errors, setErrors] = useState<{
    transactionDate?: string
    amount?: string
    currency?: string
  }>({})

  // Company lookup
  const companyMap = useMemo(() => {
    const map = new Map<string, Company>()
    for (const company of companies) {
      map.set(company.id, company)
    }
    return map
  }, [companies])

  // Get unique currencies
  const availableCurrencies = useMemo(() => {
    const currencies = new Set<string>()
    for (const company of companies) {
      currencies.add(company.functionalCurrency)
    }
    if (organization?.reportingCurrency) {
      currencies.add(organization.reportingCurrency)
    }
    return Array.from(currencies).sort()
  }, [companies, organization])

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  if (!organization || !transaction) {
    return null
  }

  const fromCompany = companyMap.get(transaction.fromCompanyId)
  const toCompany = companyMap.get(transaction.toCompanyId)

  const breadcrumbItems = [
    {
      label: "Intercompany",
      href: `/organizations/${params.organizationId}/intercompany`
    },
    {
      label: "Transaction",
      href: `/organizations/${params.organizationId}/intercompany/${transaction.id}`
    },
    {
      label: "Edit",
      href: `/organizations/${params.organizationId}/intercompany/${transaction.id}/edit`
    }
  ]

  // Check if transaction is matched - warn user
  const isMatched = transaction.matchingStatus === "Matched"

  // Validation
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    if (!transactionDate) {
      newErrors.transactionDate = "Transaction date is required"
    }

    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum)) {
      newErrors.amount = "Amount is required"
    } else if (amountNum <= 0) {
      newErrors.amount = "Amount must be positive"
    }

    if (!currency) {
      newErrors.currency = "Currency is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setApiError(null)

    try {
      const { error } = await api.PUT("/api/v1/intercompany-transactions/{id}", {
        params: { path: { id: transaction.id } },
        body: {
          transactionType,
          transactionDate,
          amount: {
            amount,
            currency
          },
          description: description.trim() || null,
          varianceAmount: varianceAmount ? { amount: varianceAmount, currency } : null,
          varianceExplanation: varianceExplanation.trim() || null
        }
      })

      if (error) {
        let errorMessage = "Failed to update transaction"
        if (typeof error === "object" && error !== null) {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
        }
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      await router.navigate({
        to: `/organizations/${params.organizationId}/intercompany/${transaction.id}`
      })
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    router.navigate({
      to: `/organizations/${params.organizationId}/intercompany/${transaction.id}`
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
      <div data-testid="edit-intercompany-transaction-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/intercompany/$transactionId"
            params={{
              organizationId: params.organizationId,
              transactionId: transaction.id
            }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Transaction
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900" data-testid="page-title">
            Edit Transaction
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <MatchingStatusBadge status={transaction.matchingStatus} />
          </div>
        </div>

        {/* Warning if matched */}
        {isMatched && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Transaction is Matched</p>
                <p className="text-sm text-yellow-700 mt-1">
                  This transaction has been matched with entries on both sides. Editing may require re-matching
                  the transaction after changes are saved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API Error */}
        {apiError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Parties (Read-only) */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Parties</h2>
            <p className="text-sm text-gray-500 mb-4">
              The companies involved cannot be changed after creation.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-1">From Company</p>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {fromCompany?.name ?? "Unknown"}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-1">To Company</p>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {toCompany?.name ?? "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Details Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Transaction Type */}
              <div>
                <label htmlFor="transactionType" className="block text-sm font-medium text-gray-700">
                  Transaction Type
                </label>
                <Select
                  id="transactionType"
                  value={transactionType}
                  onChange={(e) => {
                    const transactionTypeLookup: Record<string, TransactionType> = {
                      SalePurchase: "SalePurchase",
                      Loan: "Loan",
                      ManagementFee: "ManagementFee",
                      Dividend: "Dividend",
                      CapitalContribution: "CapitalContribution",
                      CostAllocation: "CostAllocation",
                      Royalty: "Royalty"
                    }
                    const value = transactionTypeLookup[e.target.value]
                    if (value) {
                      setTransactionType(value)
                    }
                  }}
                  className="mt-1"
                  data-testid="transaction-type-select"
                >
                  {TRANSACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Transaction Date */}
              <div>
                <label htmlFor="transactionDate" className="block text-sm font-medium text-gray-700">
                  Transaction Date <span className="text-red-500">*</span>
                </label>
                <Input
                  id="transactionDate"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="mt-1"
                  data-testid="transaction-date-input"
                />
                {errors.transactionDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.transactionDate}</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Amount <span className="text-red-500">*</span>
                </label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                  data-testid="amount-input"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>

              {/* Currency */}
              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                  Currency <span className="text-red-500">*</span>
                </label>
                <Select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1"
                  data-testid="currency-select"
                >
                  <option value="">Select currency...</option>
                  {availableCurrencies.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </Select>
                {errors.currency && (
                  <p className="mt-1 text-sm text-red-600">{errors.currency}</p>
                )}
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional description or reference..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="description-input"
                />
              </div>
            </div>
          </div>

          {/* Variance Information Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Variance Information</h2>
            <p className="text-sm text-gray-500 mb-4">
              If there is a variance between the two sides, record the details here.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Variance Amount */}
              <div>
                <label htmlFor="varianceAmount" className="block text-sm font-medium text-gray-700">
                  Variance Amount
                </label>
                <Input
                  id="varianceAmount"
                  type="number"
                  step="0.01"
                  value={varianceAmount}
                  onChange={(e) => setVarianceAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                  data-testid="variance-amount-input"
                />
              </div>

              <div className="hidden sm:block" /> {/* Spacer */}

              {/* Variance Explanation */}
              <div className="sm:col-span-2">
                <label htmlFor="varianceExplanation" className="block text-sm font-medium text-gray-700">
                  Variance Explanation
                </label>
                <textarea
                  id="varianceExplanation"
                  value={varianceExplanation}
                  onChange={(e) => setVarianceExplanation(e.target.value)}
                  rows={2}
                  placeholder="Explanation for the variance..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="variance-explanation-input"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-button"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
