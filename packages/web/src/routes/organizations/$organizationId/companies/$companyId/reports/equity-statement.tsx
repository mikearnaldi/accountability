/**
 * Statement of Changes in Equity Report Route
 *
 * Displays changes in equity components including common stock, retained earnings,
 * treasury stock, and other comprehensive income.
 *
 * Route: /organizations/:organizationId/companies/:companyId/reports/equity-statement
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import {
  ReportParameterForm,
  FormSection,
  FormRow,
  FormField,
  DateInput
} from "@/components/reports/ReportParameterForm"
import { Tooltip } from "@/components/ui/Tooltip"
import { ArrowLeft, Download, Printer } from "lucide-react"

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

interface LocalDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface MonetaryAmount {
  readonly amount: string
  readonly currency: string
}

type EquityMovementType =
  | "NetIncome"
  | "OtherComprehensiveIncome"
  | "DividendsDeclared"
  | "StockIssuance"
  | "StockRepurchase"
  | "StockBasedCompensation"
  | "PriorPeriodAdjustment"
  | "Other"

interface EquityMovement {
  readonly movementType: EquityMovementType
  readonly description: string
  readonly commonStock: MonetaryAmount
  readonly preferredStock: MonetaryAmount
  readonly additionalPaidInCapital: MonetaryAmount
  readonly retainedEarnings: MonetaryAmount
  readonly treasuryStock: MonetaryAmount
  readonly accumulatedOCI: MonetaryAmount
  readonly nonControllingInterest: MonetaryAmount
  readonly total: MonetaryAmount
}

interface Timestamp {
  readonly epochMillis: number
}

interface EquityStatementReport {
  readonly companyId: string
  readonly periodStartDate: LocalDate
  readonly periodEndDate: LocalDate
  readonly currency: string
  readonly generatedAt: Timestamp
  readonly openingBalances: EquityMovement
  readonly movements: readonly EquityMovement[]
  readonly closingBalances: EquityMovement
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchEquityStatementData = createServerFn({ method: "GET" })
  .inputValidator((data: { companyId: string; organizationId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        organization: null,
        company: null,
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companyResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: data.companyId } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        if (typeof companyResult.error === "object" && "status" in companyResult.error && companyResult.error.status === 404) {
          return {
            organization: null,
            company: null,
            error: "not_found" as const
          }
        }
        return {
          organization: null,
          company: null,
          error: "failed" as const
        }
      }

      if (orgResult.error) {
        return {
          organization: null,
          company: null,
          error: "failed" as const
        }
      }

      return {
        organization: orgResult.data,
        company: companyResult.data,
        error: null
      }
    } catch {
      return {
        organization: null,
        company: null,
        error: "failed" as const
      }
    }
  })

const fetchEquityStatement = createServerFn({ method: "GET" })
  .inputValidator((data: {
    organizationId: string
    companyId: string
    periodStartDate: string
    periodEndDate: string
  }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { report: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const result = await serverApi.GET("/api/v1/reports/equity-statement", {
        params: {
          query: {
            organizationId: data.organizationId,
            companyId: data.companyId,
            periodStartDate: data.periodStartDate,
            periodEndDate: data.periodEndDate
          }
        },
        headers: { Authorization }
      })

      if (result.error) {
        return { report: null, error: "failed" as const }
      }

      return { report: result.data, error: null }
    } catch {
      return { report: null, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/reports/equity-statement"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/equity-statement`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchEquityStatementData({
      data: {
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Company not found")
    }

    return {
      organization: result.organization,
      company: result.company
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: EquityStatementPage
})

// =============================================================================
// Equity Statement Page Component
// =============================================================================

function EquityStatementPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as Organization | null
  const company = loaderData.company as Company | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  const organizations = context.organizations ?? []

  // Default to current year period
  const currentYear = new Date().getFullYear()
  const [periodStartDate, setPeriodStartDate] = useState<string>(`${currentYear}-01-01`)
  const [periodEndDate, setPeriodEndDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [report, setReport] = useState<EquityStatementReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateReport = async () => {
    if (!periodStartDate || !periodEndDate || !company) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchEquityStatement({
        data: {
          organizationId: params.organizationId,
          companyId: company.id,
          periodStartDate,
          periodEndDate
        }
      })

      if (result.error || !result.report) {
        setError("Failed to generate equity statement. Please try again.")
      } else {
        setReport(result.report)
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!organization || !company) {
    return null
  }

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
      label: "Reports",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/reports`
    },
    {
      label: "Statement of Changes in Equity",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/equity-statement`
    }
  ]

  const companiesForSidebar = useMemo(
    () => [{ id: company.id, name: company.name }],
    [company.id, company.name]
  )

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="equity-statement-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/companies/$companyId/reports"
            params={{ organizationId: params.organizationId, companyId: params.companyId }}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Statement of Changes in Equity
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {company.name} - {company.functionalCurrency}
          </p>
        </div>

        {/* Parameter Form */}
        <ReportParameterForm
          onSubmit={handleGenerateReport}
          isLoading={isLoading}
          isValid={Boolean(periodStartDate && periodEndDate)}
          error={error}
        >
          <FormSection title="Report Period" description="Date range for equity movements">
            <FormRow>
              <FormField label="Period Start Date" required hint="Beginning of reporting period">
                <DateInput
                  value={periodStartDate}
                  onChange={(value) => {
                    setPeriodStartDate(value)
                    setReport(null)
                  }}
                  data-testid="equity-statement-start-date"
                />
              </FormField>
              <FormField label="Period End Date" required hint="End of reporting period">
                <DateInput
                  value={periodEndDate}
                  onChange={(value) => {
                    setPeriodEndDate(value)
                    setReport(null)
                  }}
                  data-testid="equity-statement-end-date"
                />
              </FormField>
            </FormRow>
          </FormSection>
        </ReportParameterForm>

        {/* Equity Statement Report */}
        {report && (
          <EquityStatementReportDisplay report={report} company={company} />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Equity Statement Report Display Component
// =============================================================================

function EquityStatementReportDisplay({
  report,
  company
}: {
  readonly report: EquityStatementReport
  readonly company: Company
}) {
  const formatMonetaryAmount = (amount: MonetaryAmount) => {
    const num = parseFloat(amount.amount)
    if (num === 0) return "—"
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num)
  }

  const formatDate = (date: LocalDate) => {
    return new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      }
    )
  }

  const getMovementTypeLabel = (type: EquityMovementType): string => {
    const labels: Record<EquityMovementType, string> = {
      NetIncome: "Net Income",
      OtherComprehensiveIncome: "Other Comprehensive Income",
      DividendsDeclared: "Dividends Declared",
      StockIssuance: "Stock Issuance",
      StockRepurchase: "Stock Repurchase",
      StockBasedCompensation: "Stock-Based Compensation",
      PriorPeriodAdjustment: "Prior Period Adjustment",
      Other: "Other"
    }
    return labels[type]
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="equity-statement-report">
      {/* Report Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Statement of Changes in Equity</h2>
            <p className="text-sm text-gray-500">
              {company.name} - {formatDate(report.periodStartDate)} to {formatDate(report.periodEndDate)}
            </p>
            <p className="text-sm text-gray-500">Currency: {report.currency}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="equity-statement-print"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="equity-statement-export"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Type of equity movement or transaction">
                  <span>Description</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Par value of common shares outstanding">
                  <span>Common Stock</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Par value of preferred shares outstanding">
                  <span>Preferred Stock</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Amount received above par value of shares issued">
                  <span>APIC</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Cumulative net income minus dividends declared">
                  <span>Retained Earnings</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Cost of company's own shares repurchased and held">
                  <span>Treasury Stock</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Unrealized gains/losses on available-for-sale securities, foreign currency translation, etc.">
                  <span>AOCI</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Equity attributable to non-controlling shareholders in subsidiaries">
                  <span>NCI</span>
                </Tooltip>
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Sum of all equity components">
                  <span>Total</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {/* Opening Balances */}
            <MovementRow
              movement={report.openingBalances}
              label="Opening Balance"
              isHeader
              formatAmount={formatMonetaryAmount}
              getLabel={getMovementTypeLabel}
            />

            {/* Movements */}
            {report.movements.map((movement, idx) => (
              <MovementRow
                key={`movement-${idx}`}
                movement={movement}
                formatAmount={formatMonetaryAmount}
                getLabel={getMovementTypeLabel}
              />
            ))}

            {/* Closing Balances */}
            <MovementRow
              movement={report.closingBalances}
              label="Closing Balance"
              isFooter
              formatAmount={formatMonetaryAmount}
              getLabel={getMovementTypeLabel}
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function MovementRow({
  movement,
  label,
  isHeader = false,
  isFooter = false,
  formatAmount,
  getLabel
}: {
  readonly movement: EquityMovement
  readonly label?: string
  readonly isHeader?: boolean
  readonly isFooter?: boolean
  readonly formatAmount: (amount: MonetaryAmount) => string
  readonly getLabel: (type: EquityMovementType) => string
}) {
  const rowClass = isHeader
    ? "bg-gray-100 font-semibold"
    : isFooter
      ? "bg-blue-50 font-bold border-t-2 border-gray-300"
      : "hover:bg-gray-50"

  const displayLabel = label ?? (movement.description || getLabel(movement.movementType))

  return (
    <tr className={rowClass}>
      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-900">
        {displayLabel}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.commonStock)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.preferredStock)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.additionalPaidInCapital)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.retainedEarnings)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.treasuryStock)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.accumulatedOCI)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.nonControllingInterest)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(movement.total)}
      </td>
    </tr>
  )
}
