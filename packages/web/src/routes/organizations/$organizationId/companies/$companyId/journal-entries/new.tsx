/**
 * New Journal Entry Page
 *
 * SSR page for creating new journal entries with:
 * - Multi-line entry form with real-time balance validation
 * - Account dropdown searching postable accounts
 * - Multi-currency support with exchange rate field
 * - Save as Draft and Submit for Approval actions
 * - Computed fiscal period based on transaction date and company's fiscal year end
 */

import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useMemo } from "react"
import { Plus, ArrowLeft } from "lucide-react"
import { createServerApi } from "@/api/server"
import { JournalEntryForm } from "@/components/forms/JournalEntryForm"
import type { PeriodsSummary } from "@/components/forms/PeriodDatePicker"
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
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
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
        periodsSummary: null,
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      // Fetch company, organization, accounts, currencies, and periods summary in parallel
      const [companyResult, orgResult, accountsResult, currenciesResult, periodsResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/accounts", {
          params: { query: { organizationId: data.organizationId, companyId: data.companyId, isPostable: "true", limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/currencies", {
          params: { query: { isActive: "true" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-periods/summary", {
          params: { path: { organizationId: data.organizationId, companyId: data.companyId } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        // Check for domain-specific NotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error &&
            companyResult.error._tag === "CompanyNotFoundError") {
          return {
            company: null,
            organization: null,
            accounts: [],
            currencies: [],
            periodsSummary: null,
            error: "not_found" as const
          }
        }
        return {
          company: null,
          organization: null,
          accounts: [],
          currencies: [],
          periodsSummary: null,
          error: "failed" as const
        }
      }

      if (orgResult.error) {
        return {
          company: null,
          organization: null,
          accounts: [],
          currencies: [],
          periodsSummary: null,
          error: "failed" as const
        }
      }

      // Map periods summary to the expected format (handle API response typing)
      // Type-safe lookup for period type conversion
      const PERIOD_TYPE_MAP: Record<string, "Regular" | "Adjustment" | "Closing"> = {
        Regular: "Regular",
        Adjustment: "Adjustment",
        Closing: "Closing"
      }

      let periodsSummary: PeriodsSummary | null = null
      if (periodsResult.data) {
        periodsSummary = {
          periods: periodsResult.data.periods.map((p) => ({
            fiscalYearId: p.fiscalYearId,
            fiscalYear: p.fiscalYear,
            periodId: p.periodId,
            periodNumber: p.periodNumber,
            periodName: p.periodName,
            periodType: PERIOD_TYPE_MAP[p.periodType] ?? "Regular",
            startDate: p.startDate,
            endDate: p.endDate,
            status: p.status
          })),
          openDateRanges: periodsResult.data.openDateRanges.map((r) => ({
            startDate: r.startDate,
            endDate: r.endDate
          })),
          closedDateRanges: periodsResult.data.closedDateRanges.map((r) => ({
            startDate: r.startDate,
            endDate: r.endDate
          }))
        }
      }

      return {
        company: companyResult.data,
        organization: orgResult.data,
        accounts: accountsResult.data?.accounts ?? [],
        currencies: currenciesResult.data?.currencies ?? [],
        periodsSummary,
        error: null
      }
    } catch {
      return {
        company: null,
        organization: null,
        accounts: [],
        currencies: [],
        periodsSummary: null,
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
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: NewJournalEntryPage
})

// =============================================================================
// Page Component
// =============================================================================

function NewJournalEntryPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const { canPerform } = usePermissions()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  const accounts = loaderData.accounts as readonly Account[]
  const currencies = loaderData.currencies as readonly CurrencyInfo[]
  const periodsSummary = loaderData.periodsSummary as PeriodsSummary | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const navigate = useNavigate()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  // Permission check
  const canCreateEntry = canPerform("journal_entry:create")

  // Check fiscal period status
  const hasPeriods = periodsSummary !== null && periodsSummary.periods.length > 0
  const hasOpenPeriods = periodsSummary !== null &&
    periodsSummary.periods.some((p) => p.status === "Open" && p.periodType === "Regular")

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

  // Permission denied check
  if (!canCreateEntry) {
    return (
      <AppLayout
        user={user}
        organizations={organizations}
        currentOrganization={organization}
        breadcrumbItems={[
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
          }
        ]}
        companies={[{ id: company.id, name: company.name }]}
      >
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" data-testid="permission-denied">
          <h2 className="text-lg font-medium text-red-800">Permission Denied</h2>
          <p className="mt-2 text-red-700">
            You do not have permission to create journal entries.
          </p>
          <Button
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mt-4"
            onClick={() => {
              navigate({
                to: "/organizations/$organizationId/companies/$companyId/journal-entries",
                params: { organizationId: params.organizationId, companyId: params.companyId }
              })
            }}
          >
            Back to Journal Entries
          </Button>
        </div>
      </AppLayout>
    )
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
      organizations={organizations}
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

        {/* No Fiscal Periods Warning */}
        {!hasPeriods && (
          <div
            className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-6"
            data-testid="no-periods-warning"
          >
            <h2 className="text-lg font-medium text-yellow-800">
              Cannot Create Journal Entry
            </h2>
            <p className="mt-2 text-yellow-700">
              No fiscal periods defined for this company. Create a fiscal year first.
            </p>
            <Link
              to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
              params={{
                organizationId: params.organizationId,
                companyId: params.companyId
              }}
              className="mt-4 inline-block text-yellow-800 underline hover:text-yellow-900"
            >
              Go to Fiscal Periods
            </Link>
          </div>
        )}

        {/* All Periods Closed Warning */}
        {hasPeriods && !hasOpenPeriods && (
          <div
            className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-6"
            data-testid="no-open-periods-warning"
          >
            <h2 className="text-lg font-medium text-yellow-800">
              Cannot Create Journal Entry
            </h2>
            <p className="mt-2 text-yellow-700">
              All fiscal periods are closed. Open a period to post entries.
            </p>
            <Link
              to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
              params={{
                organizationId: params.organizationId,
                companyId: params.companyId
              }}
              className="mt-4 inline-block text-yellow-800 underline hover:text-yellow-900"
            >
              Go to Fiscal Periods
            </Link>
          </div>
        )}

        {/* No Accounts Warning */}
        {hasOpenPeriods && !hasAccounts && (
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

        {/* Journal Entry Form - only show when we have open periods and accounts */}
        {hasOpenPeriods && hasAccounts ? (
          <JournalEntryForm
            organizationId={params.organizationId}
            companyId={params.companyId}
            functionalCurrency={company.functionalCurrency}
            accounts={accounts}
            currencies={currencies}
            fiscalYearEnd={company.fiscalYearEnd}
            periodsSummary={periodsSummary ?? undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        ) : hasOpenPeriods && !hasAccounts ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">
              Create accounts in your Chart of Accounts to start recording journal entries.
            </p>
            <Button
              icon={<Plus className="h-5 w-5" />}
              className="mt-4"
              onClick={() => {
                navigate({
                  to: "/organizations/$organizationId/companies/$companyId/accounts",
                  params: { organizationId: params.organizationId, companyId: params.companyId }
                })
              }}
            >
              Create Accounts
            </Button>
          </div>
        ) : null}
      </div>
    </AppLayout>
  )
}
