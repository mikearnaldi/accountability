/**
 * Create Intercompany Transaction Route
 *
 * Form for creating a new intercompany transaction.
 *
 * Route: /organizations/:organizationId/intercompany/new
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
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox"
import { ArrowLeft, ChevronDown, FileText, Loader2 } from "lucide-react"

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
  readonly isActive: boolean
}

interface JournalEntry {
  readonly id: string
  readonly referenceNumber: string | null
  readonly entryNumber: string | null
  readonly transactionDate: { year: number; month: number; day: number }
  readonly description: string
  readonly status: string
}

type TransactionType = "SalePurchase" | "Loan" | "ManagementFee" | "Dividend" | "CapitalContribution" | "CostAllocation" | "Royalty"

// Transaction type options
const TRANSACTION_TYPES: Array<{ value: TransactionType; label: string; description: string }> = [
  { value: "SalePurchase", label: "Sale/Purchase", description: "Sale or purchase of goods/services" },
  { value: "Loan", label: "Loan", description: "Intercompany loan (principal or interest)" },
  { value: "ManagementFee", label: "Management Fee", description: "Management or administrative fee" },
  { value: "Dividend", label: "Dividend", description: "Dividend distribution" },
  { value: "CapitalContribution", label: "Capital Contribution", description: "Capital contribution" },
  { value: "CostAllocation", label: "Cost Allocation", description: "Shared cost allocation" },
  { value: "Royalty", label: "Royalty", description: "Royalty payment" }
]

// =============================================================================
// Server Functions
// =============================================================================

const fetchFormData = createServerFn({ method: "GET" })
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

export const Route = createFileRoute("/organizations/$organizationId/intercompany/new")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/intercompany/new`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchFormData({ data: params.organizationId })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: result.organization,
      companies: result.companies
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: CreateIntercompanyTransactionPage
})

// =============================================================================
// Page Component
// =============================================================================

function CreateIntercompanyTransactionPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Form state
  const [fromCompanyId, setFromCompanyId] = useState("")
  const [toCompanyId, setToCompanyId] = useState("")
  const [transactionType, setTransactionType] = useState<TransactionType>("SalePurchase")
  const [transactionDate, setTransactionDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Journal Entry linking state (per Issue 36)
  const [fromJournalEntries, setFromJournalEntries] = useState<readonly JournalEntry[]>([])
  const [toJournalEntries, setToJournalEntries] = useState<readonly JournalEntry[]>([])
  const [fromJournalEntryId, setFromJournalEntryId] = useState<string | null>(null)
  const [toJournalEntryId, setToJournalEntryId] = useState<string | null>(null)
  const [isLoadingFromJEs, setIsLoadingFromJEs] = useState(false)
  const [isLoadingToJEs, setIsLoadingToJEs] = useState(false)
  const [showFromJESection, setShowFromJESection] = useState(false)
  const [showToJESection, setShowToJESection] = useState(false)

  // Validation state
  const [errors, setErrors] = useState<{
    fromCompanyId?: string
    toCompanyId?: string
    transactionDate?: string
    amount?: string
    currency?: string
  }>({})

  // Get active companies only
  const activeCompanies = useMemo(
    () => companies.filter((c) => c.isActive),
    [companies]
  )

  // Convert active companies to Combobox options for "From Company"
  const fromCompanyOptions: ComboboxOption[] = useMemo(() => {
    return activeCompanies.map((company) => ({
      value: company.id,
      label: `${company.name} (${company.functionalCurrency})`,
      searchText: `${company.name} ${company.functionalCurrency}`
    }))
  }, [activeCompanies])

  // Convert active companies to Combobox options for "To Company" (excluding the "from" company)
  const toCompanyOptions: ComboboxOption[] = useMemo(() => {
    return activeCompanies
      .filter((c) => c.id !== fromCompanyId)
      .map((company) => ({
        value: company.id,
        label: `${company.name} (${company.functionalCurrency})`,
        searchText: `${company.name} ${company.functionalCurrency}`
      }))
  }, [activeCompanies, fromCompanyId])

  // Set default currency based on selected from company
  useMemo(() => {
    if (fromCompanyId && !currency) {
      const selectedCompany = activeCompanies.find((c) => c.id === fromCompanyId)
      if (selectedCompany) {
        setCurrency(selectedCompany.functionalCurrency)
      }
    }
  }, [fromCompanyId, activeCompanies, currency])

  // Get unique currencies from companies
  const availableCurrencies = useMemo(() => {
    const currencies = new Set<string>()
    for (const company of activeCompanies) {
      currencies.add(company.functionalCurrency)
    }
    if (organization?.reportingCurrency) {
      currencies.add(organization.reportingCurrency)
    }
    return Array.from(currencies).sort()
  }, [activeCompanies, organization])

  // Fetch journal entries for "From" company when selected (per Issue 36)
  useEffect(() => {
    if (!fromCompanyId) {
      setFromJournalEntries([])
      setFromJournalEntryId(null)
      return
    }

    const fetchFromJEs = async () => {
      setIsLoadingFromJEs(true)
      try {
        const { data } = await api.GET("/api/v1/journal-entries", {
          params: { query: { organizationId: params.organizationId, companyId: fromCompanyId } }
        })
        if (data?.entries) {
          // Filter to only include approved/posted entries (not drafts) and map to local interface
          const filteredEntries: JournalEntry[] = data.entries
            .filter((je) => je.status === "Approved" || je.status === "Posted")
            .map((je) => ({
              id: je.id,
              referenceNumber: je.referenceNumber,
              entryNumber: je.entryNumber,
              transactionDate: je.transactionDate,
              description: je.description,
              status: je.status
            }))
          setFromJournalEntries(filteredEntries)
        }
      } catch {
        // Silently fail - JE linking is optional
        setFromJournalEntries([])
      } finally {
        setIsLoadingFromJEs(false)
      }
    }

    fetchFromJEs()
  }, [fromCompanyId])

  // Fetch journal entries for "To" company when selected (per Issue 36)
  useEffect(() => {
    if (!toCompanyId) {
      setToJournalEntries([])
      setToJournalEntryId(null)
      return
    }

    const fetchToJEs = async () => {
      setIsLoadingToJEs(true)
      try {
        const { data } = await api.GET("/api/v1/journal-entries", {
          params: { query: { organizationId: params.organizationId, companyId: toCompanyId } }
        })
        if (data?.entries) {
          // Filter to only include approved/posted entries (not drafts) and map to local interface
          const filteredEntries: JournalEntry[] = data.entries
            .filter((je) => je.status === "Approved" || je.status === "Posted")
            .map((je) => ({
              id: je.id,
              referenceNumber: je.referenceNumber,
              entryNumber: je.entryNumber,
              transactionDate: je.transactionDate,
              description: je.description,
              status: je.status
            }))
          setToJournalEntries(filteredEntries)
        }
      } catch {
        // Silently fail - JE linking is optional
        setToJournalEntries([])
      } finally {
        setIsLoadingToJEs(false)
      }
    }

    fetchToJEs()
  }, [toCompanyId])

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Intercompany",
      href: `/organizations/${params.organizationId}/intercompany`
    },
    {
      label: "New Transaction",
      href: `/organizations/${params.organizationId}/intercompany/new`
    }
  ]

  // Validation
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    if (!fromCompanyId) {
      newErrors.fromCompanyId = "From company is required"
    }

    if (!toCompanyId) {
      newErrors.toCompanyId = "To company is required"
    }

    if (fromCompanyId && toCompanyId && fromCompanyId === toCompanyId) {
      newErrors.toCompanyId = "From and To companies must be different"
    }

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
      const { data, error } = await api.POST("/api/v1/intercompany-transactions", {
        body: {
          organizationId: params.organizationId,
          fromCompanyId,
          toCompanyId,
          transactionType,
          transactionDate,
          amount: {
            amount,
            currency
          },
          description: description.trim() || null,
          // Include optional JE links (per Issue 36)
          fromJournalEntryId: fromJournalEntryId || null,
          toJournalEntryId: toJournalEntryId || null
        }
      })

      if (error) {
        let errorMessage = "Failed to create transaction"
        if (typeof error === "object" && error !== null) {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
        }
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Navigate to the transaction detail page
      if (data?.id) {
        await router.navigate({
          to: `/organizations/${params.organizationId}/intercompany/${data.id}`
        })
      } else {
        await router.navigate({
          to: `/organizations/${params.organizationId}/intercompany`
        })
      }
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    router.navigate({
      to: `/organizations/${params.organizationId}/intercompany`
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
      <div data-testid="create-intercompany-transaction-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/intercompany"
            params={{ organizationId: params.organizationId }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Intercompany Transactions
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900" data-testid="page-title">
            New Intercompany Transaction
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Record a transaction between two companies in your organization.
          </p>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Companies Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Parties</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* From Company */}
              <div>
                <label htmlFor="fromCompanyId" className="block text-sm font-medium text-gray-700">
                  From Company <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={fromCompanyId}
                  onChange={(value) => {
                    setFromCompanyId(value)
                    // Reset currency to the new company's currency
                    const company = activeCompanies.find((c) => c.id === value)
                    if (company) {
                      setCurrency(company.functionalCurrency)
                    }
                  }}
                  options={fromCompanyOptions}
                  placeholder="Search companies..."
                  className="mt-1"
                  data-testid="from-company-select"
                />
                {errors.fromCompanyId && (
                  <p className="mt-1 text-sm text-red-600">{errors.fromCompanyId}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  The seller, lender, or payer in this transaction.
                </p>
              </div>

              {/* To Company */}
              <div>
                <label htmlFor="toCompanyId" className="block text-sm font-medium text-gray-700">
                  To Company <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={toCompanyId}
                  onChange={setToCompanyId}
                  options={toCompanyOptions}
                  placeholder="Search companies..."
                  className="mt-1"
                  data-testid="to-company-select"
                />
                {errors.toCompanyId && (
                  <p className="mt-1 text-sm text-red-600">{errors.toCompanyId}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  The buyer, borrower, or recipient in this transaction.
                </p>
              </div>
            </div>
          </div>

          {/* Journal Entry Linking Section (per Issue 36) */}
          {(fromCompanyId || toCompanyId) && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Link Journal Entries
                <span className="ml-2 text-sm font-normal text-gray-500">(Optional)</span>
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Optionally link existing journal entries from each company to this intercompany transaction.
              </p>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* From Company JE */}
                {fromCompanyId && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowFromJESection(!showFromJESection)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      data-testid="from-je-toggle"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showFromJESection ? "rotate-180" : ""}`}
                      />
                      <FileText className="h-4 w-4" />
                      From Company Journal Entry
                    </button>

                    {showFromJESection && (
                      <div className="mt-3">
                        {isLoadingFromJEs ? (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading journal entries...
                          </div>
                        ) : fromJournalEntries.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">
                            No approved journal entries found for this company.
                          </p>
                        ) : (
                          <>
                            <Select
                              id="fromJournalEntryId"
                              value={fromJournalEntryId ?? ""}
                              onChange={(e) => setFromJournalEntryId(e.target.value || null)}
                              className="w-full"
                              data-testid="from-je-select"
                            >
                              <option value="">Select journal entry...</option>
                              {fromJournalEntries.map((je) => {
                                const dateStr = `${je.transactionDate.year}-${String(je.transactionDate.month).padStart(2, "0")}-${String(je.transactionDate.day).padStart(2, "0")}`
                                const ref = je.referenceNumber ?? je.entryNumber ?? "—"
                                const desc = je.description.substring(0, 30) || "No description"
                                return (
                                  <option key={je.id} value={je.id}>
                                    {dateStr} | {ref} | {desc}
                                  </option>
                                )
                              })}
                            </Select>
                            <p className="mt-1 text-xs text-gray-500">
                              Select a journal entry from the "From" company to link.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* To Company JE */}
                {toCompanyId && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowToJESection(!showToJESection)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      data-testid="to-je-toggle"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showToJESection ? "rotate-180" : ""}`}
                      />
                      <FileText className="h-4 w-4" />
                      To Company Journal Entry
                    </button>

                    {showToJESection && (
                      <div className="mt-3">
                        {isLoadingToJEs ? (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading journal entries...
                          </div>
                        ) : toJournalEntries.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">
                            No approved journal entries found for this company.
                          </p>
                        ) : (
                          <>
                            <Select
                              id="toJournalEntryId"
                              value={toJournalEntryId ?? ""}
                              onChange={(e) => setToJournalEntryId(e.target.value || null)}
                              className="w-full"
                              data-testid="to-je-select"
                            >
                              <option value="">Select journal entry...</option>
                              {toJournalEntries.map((je) => {
                                const dateStr = `${je.transactionDate.year}-${String(je.transactionDate.month).padStart(2, "0")}-${String(je.transactionDate.day).padStart(2, "0")}`
                                const ref = je.referenceNumber ?? je.entryNumber ?? "—"
                                const desc = je.description.substring(0, 30) || "No description"
                                return (
                                  <option key={je.id} value={je.id}>
                                    {dateStr} | {ref} | {desc}
                                  </option>
                                )
                              })}
                            </Select>
                            <p className="mt-1 text-xs text-gray-500">
                              Select a journal entry from the "To" company to link.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transaction Details Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Transaction Type */}
              <div>
                <label htmlFor="transactionType" className="block text-sm font-medium text-gray-700">
                  Transaction Type <span className="text-red-500">*</span>
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
                <p className="mt-1 text-xs text-gray-500">
                  {TRANSACTION_TYPES.find((t) => t.value === transactionType)?.description}
                </p>
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
                  placeholder="Optional description or reference for this transaction..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="description-input"
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
              {isSubmitting ? "Creating..." : "Create Transaction"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
