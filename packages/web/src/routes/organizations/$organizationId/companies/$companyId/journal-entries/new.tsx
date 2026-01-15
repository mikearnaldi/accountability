/**
 * New Journal Entry Page
 *
 * SSR page for creating new journal entries with:
 * - Multi-line entry form with real-time balance validation
 * - Account dropdown searching postable accounts
 * - Multi-currency support with exchange rate field
 * - Save as Draft and Submit for Approval actions
 */

import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useMemo } from "react"
import { createServerApi } from "@/api/server"
import { JournalEntryForm } from "@/components/forms/JournalEntryForm"
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

interface Account {
  readonly id: string
  readonly accountNumber: string
  readonly name: string
  readonly accountType: string
  readonly isPostable: boolean
}

interface CurrencyInfo {
  readonly code: string
  readonly name: string
  readonly symbol: string
}

interface FiscalPeriod {
  readonly id: string
  readonly fiscalYearId: string
  readonly periodNumber: number
  readonly name: string
  readonly periodType: string
  readonly startDate: { year: number; month: number; day: number }
  readonly endDate: { year: number; month: number; day: number }
  readonly status: string
}

interface FiscalYear {
  readonly id: string
  readonly companyId: string
  readonly name: string
  readonly year: number
  readonly startDate: { year: number; month: number; day: number }
  readonly endDate: { year: number; month: number; day: number }
  readonly status: string
}

interface FiscalPeriodOption {
  readonly year: number
  readonly period: number
  readonly label: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchNewJournalEntryData = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { companyId: string; organizationId: string }) => data
  )
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        company: null,
        organization: null,
        accounts: [],
        currencies: [],
        fiscalYears: [],
        fiscalPeriods: [],
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      // Fetch company, organization, accounts, currencies, fiscal years, and fiscal periods in parallel
      const [companyResult, orgResult, accountsResult, currenciesResult, fiscalYearsResult, fiscalPeriodsResult] = await Promise.all([
        serverApi.GET("/api/v1/companies/{id}", {
          params: { path: { id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/accounts", {
          params: { query: { companyId: data.companyId, isPostable: "true", limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/currencies", {
          params: { query: { isActive: "true" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/fiscal/fiscal-years", {
          params: { query: { companyId: data.companyId, limit: "100" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/fiscal/fiscal-periods", {
          params: { query: { companyId: data.companyId, limit: "1000" } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error && companyResult.error._tag === "NotFoundError") {
          return {
            company: null,
            organization: null,
            accounts: [],
            currencies: [],
            fiscalYears: [],
            fiscalPeriods: [],
            error: "not_found" as const
          }
        }
        return {
          company: null,
          organization: null,
          accounts: [],
          currencies: [],
          fiscalYears: [],
          fiscalPeriods: [],
          error: "failed" as const
        }
      }

      if (orgResult.error) {
        return {
          company: null,
          organization: null,
          accounts: [],
          currencies: [],
          fiscalYears: [],
          fiscalPeriods: [],
          error: "failed" as const
        }
      }

      return {
        company: companyResult.data,
        organization: orgResult.data,
        accounts: accountsResult.data?.accounts ?? [],
        currencies: currenciesResult.data?.currencies ?? [],
        fiscalYears: fiscalYearsResult.data?.fiscalYears ?? [],
        fiscalPeriods: fiscalPeriodsResult.data?.periods ?? [],
        error: null
      }
    } catch {
      return {
        company: null,
        organization: null,
        accounts: [],
        currencies: [],
        fiscalYears: [],
        fiscalPeriods: [],
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/journal-entries/new"
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
    const result = await fetchNewJournalEntryData({
      data: {
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Company not found")
    }

    return result
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
  component: NewJournalEntryPage
})

// =============================================================================
// Page Component
// =============================================================================

function NewJournalEntryPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  const accounts = loaderData.accounts as readonly Account[]
  const currencies = loaderData.currencies as readonly CurrencyInfo[]
  const fiscalYears = loaderData.fiscalYears as readonly FiscalYear[]
  const fiscalPeriods = loaderData.fiscalPeriods as readonly FiscalPeriod[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const navigate = useNavigate()
  const user = context.user

  // Build a map of fiscal year ID to fiscal year for lookup
  const fiscalYearMap = new Map<string, FiscalYear>()
  for (const fy of fiscalYears) {
    fiscalYearMap.set(fy.id, fy)
  }

  // Build fiscal period options from fiscal periods and years
  const fiscalPeriodOptions: FiscalPeriodOption[] = []
  for (const period of fiscalPeriods) {
    const fy = fiscalYearMap.get(period.fiscalYearId)
    if (fy) {
      fiscalPeriodOptions.push({
        year: fy.year,
        period: period.periodNumber,
        label: `${fy.name} - ${period.name}`
      })
    }
  }

  // Get default fiscal period (current or most recent open period)
  const defaultFiscalPeriod = fiscalPeriodOptions.length > 0
    ? fiscalPeriodOptions[0]
    : { year: new Date().getFullYear(), period: 1, label: "P1" }

  // Handle success - navigate back to journal entries list
  const handleSuccess = () => {
    navigate({
      to: "/organizations/$organizationId/companies/$companyId/journal-entries",
      params: {
        organizationId: params.organizationId,
        companyId: params.companyId
      }
    })
  }

  // Handle cancel - navigate back to journal entries list
  const handleCancel = () => {
    navigate({
      to: "/organizations/$organizationId/companies/$companyId/journal-entries",
      params: {
        organizationId: params.organizationId,
        companyId: params.companyId
      }
    })
  }

  if (!company || !organization) {
    return null
  }

  // Check if company has any accounts
  const hasAccounts = accounts.length > 0

  // Pass current company to sidebar for quick actions
  const companiesForSidebar = useMemo(
    () => [{ id: company.id, name: company.name }],
    [company.id, company.name]
  )

  // Breadcrumb items for New Journal Entry page
  const breadcrumbItems = [
    {
      label: "Companies",
      href: `/organizations/${params.organizationId}/companies`
    },
    {
      label: company.name,
      href: `/organizations/${params.organizationId}/companies/${params.companyId}`
    },
    {
      label: "Journal Entries",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries`
    },
    {
      label: "New Entry",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries/new`
    }
  ]

  return (
    <AppLayout
      user={user}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="new-journal-entry-page">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Create Journal Entry
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Record a new journal entry for {company.name} ({company.functionalCurrency})
          </p>
        </div>

        {/* No Accounts Warning */}
        {!hasAccounts && (
          <div
            className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4"
            data-testid="no-accounts-warning"
          >
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-medium text-yellow-800">
                  No postable accounts available
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  You need to create accounts before you can create journal entries.
                </p>
                <Link
                  to="/organizations/$organizationId/companies/$companyId/accounts"
                  params={{
                    organizationId: params.organizationId,
                    companyId: params.companyId
                  }}
                  className="mt-2 inline-block text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
                >
                  Go to Chart of Accounts
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Journal Entry Form */}
        {hasAccounts ? (
          <JournalEntryForm
            companyId={params.companyId}
            functionalCurrency={company.functionalCurrency}
            accounts={accounts}
            currencies={currencies}
            fiscalPeriods={fiscalPeriodOptions}
            defaultFiscalPeriod={defaultFiscalPeriod}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">
              Create accounts in your Chart of Accounts to start recording journal entries.
            </p>
            <Link
              to="/organizations/$organizationId/companies/$companyId/accounts"
              params={{
                organizationId: params.organizationId,
                companyId: params.companyId
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Accounts
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
