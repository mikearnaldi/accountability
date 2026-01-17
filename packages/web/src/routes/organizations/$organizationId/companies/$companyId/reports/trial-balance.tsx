/**
 * Trial Balance Report Route
 *
 * Displays the trial balance report for a specific company and fiscal period.
 * Shows all account balances with debit and credit totals.
 *
 * Route: /organizations/:organizationId/companies/:companyId/reports/trial-balance
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
import { ArrowLeft, FileSpreadsheet, FileText, Printer } from "lucide-react"
import {
  exportToExcel,
  exportToPdf,
  printReport,
  generateFilename,
  type TableExportConfig,
  type ReportMetadata
} from "@/utils/report-export"

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

interface TrialBalanceLineItem {
  readonly accountId: string
  readonly accountNumber: string
  readonly accountName: string
  readonly accountType: string
  readonly debitBalance: MonetaryAmount
  readonly creditBalance: MonetaryAmount
}

interface TrialBalance {
  readonly companyId: string
  readonly asOfDate: LocalDate
  readonly currency: string
  readonly lineItems: readonly TrialBalanceLineItem[]
  readonly totalDebits: MonetaryAmount
  readonly totalCredits: MonetaryAmount
  readonly isBalanced: boolean
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchTrialBalanceData = createServerFn({ method: "GET" })
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

// Server function to fetch trial balance for a specific date
const fetchTrialBalance = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; companyId: string; asOfDate: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { trialBalance: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const result = await serverApi.GET("/api/v1/reports/trial-balance", {
        params: {
          query: {
            organizationId: data.organizationId,
            companyId: data.companyId,
            asOfDate: data.asOfDate
          }
        },
        headers: { Authorization }
      })

      if (result.error) {
        return { trialBalance: null, error: "failed" as const }
      }

      return { trialBalance: result.data, error: null }
    } catch {
      return { trialBalance: null, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/reports/trial-balance"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/trial-balance`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchTrialBalanceData({
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
  component: TrialBalancePage
})

// =============================================================================
// Trial Balance Page Component
// =============================================================================

function TrialBalancePage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as Organization | null
  const company = loaderData.company as Company | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  // State for selected date
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle generating the report
  const handleGenerateReport = async () => {
    if (!asOfDate || !company) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchTrialBalance({
        data: {
          organizationId: params.organizationId,
          companyId: company.id,
          asOfDate
        }
      })

      if (result.error || !result.trialBalance) {
        setError("Failed to generate trial balance. Please try again.")
      } else {
        setTrialBalance(result.trialBalance)
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

  // Breadcrumb items
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
      label: "Trial Balance",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/trial-balance`
    }
  ]

  // Map companies for sidebar
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
      <div data-testid="trial-balance-page">
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
            Trial Balance
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {company.name} - {company.functionalCurrency}
          </p>
        </div>

        {/* Parameter Form */}
        <ReportParameterForm
          onSubmit={handleGenerateReport}
          isLoading={isLoading}
          isValid={Boolean(asOfDate)}
          error={error}
        >
          <FormSection title="Report Date" description="Select the date for the trial balance">
            <FormRow>
              <FormField label="As of Date" required hint="Account balances as of this date">
                <DateInput
                  value={asOfDate}
                  onChange={(value) => {
                    setAsOfDate(value)
                    setTrialBalance(null)
                  }}
                  data-testid="trial-balance-as-of-date"
                />
              </FormField>
            </FormRow>
          </FormSection>
        </ReportParameterForm>

        {/* Trial Balance Results */}
        {trialBalance && (
          <TrialBalanceReport trialBalance={trialBalance} company={company} />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Trial Balance Report Component
// =============================================================================

function TrialBalanceReport({
  trialBalance,
  company
}: {
  readonly trialBalance: TrialBalance
  readonly company: Company
}) {
  const formatMonetaryAmount = (monetaryAmount: MonetaryAmount) => {
    const num = parseFloat(monetaryAmount.amount)
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
        month: "long",
        day: "numeric",
        timeZone: "UTC"
      }
    )
  }

  const asOfDateStr = formatDate(trialBalance.asOfDate)

  // Export handlers
  const handlePrint = () => {
    printReport()
  }

  const handleExportExcel = () => {
    const metadata: ReportMetadata = {
      title: "Trial Balance",
      company: company.name,
      asOfDate: asOfDateStr,
      currency: trialBalance.currency,
      generatedAt: new Date().toISOString()
    }

    const config: TableExportConfig = {
      headers: ["Account Number", "Account Name", "Type", "Debit", "Credit"],
      rows: [
        ...trialBalance.lineItems.map((item) => [
          item.accountNumber,
          item.accountName,
          item.accountType,
          parseFloat(item.debitBalance.amount) || "",
          parseFloat(item.creditBalance.amount) || ""
        ]),
        // Total row
        ["", "Total", "", parseFloat(trialBalance.totalDebits.amount), parseFloat(trialBalance.totalCredits.amount)]
      ],
      metadata
    }

    const filename = generateFilename(
      `${company.name}-trial-balance`,
      `${trialBalance.asOfDate.year}-${trialBalance.asOfDate.month}-${trialBalance.asOfDate.day}`
    )
    exportToExcel(config, filename)
  }

  const handleExportPdf = () => {
    const metadata: ReportMetadata = {
      title: "Trial Balance",
      company: company.name,
      asOfDate: asOfDateStr,
      currency: trialBalance.currency,
      generatedAt: new Date().toISOString()
    }

    const config: TableExportConfig = {
      headers: ["Account Number", "Account Name", "Type", "Debit", "Credit"],
      rows: [
        ...trialBalance.lineItems.map((item) => [
          item.accountNumber,
          item.accountName,
          item.accountType,
          parseFloat(item.debitBalance.amount) || "—",
          parseFloat(item.creditBalance.amount) || "—"
        ]),
        // Total row
        ["", "Total", "", parseFloat(trialBalance.totalDebits.amount), parseFloat(trialBalance.totalCredits.amount)]
      ],
      metadata
    }

    const filename = generateFilename(
      `${company.name}-trial-balance`,
      `${trialBalance.asOfDate.year}-${trialBalance.asOfDate.month}-${trialBalance.asOfDate.day}`
    )
    exportToPdf(config, filename)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="trial-balance-report">
      {/* Report Header */}
      <div className="border-b border-gray-200 px-6 py-4 print-hide">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Trial Balance
            </h2>
            <p className="text-sm text-gray-500">
              {company.name} - As of {asOfDateStr}
            </p>
            <p className="text-sm text-gray-500">
              Currency: {trialBalance.currency}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="trial-balance-print"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="trial-balance-export-excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="trial-balance-export-pdf"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Balance Status */}
      {!trialBalance.isBalanced && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3">
          <p className="text-sm font-medium text-red-800">
            Warning: Trial balance is not balanced. Total debits do not equal total credits.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Account number and name from the chart of accounts">
                  <span>Account</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Account classification: Asset, Liability, Equity, Revenue, or Expense">
                  <span>Type</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Total debit balance for this account as of the report date">
                  <span>Debit</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Total credit balance for this account as of the report date">
                  <span>Credit</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {trialBalance.lineItems.map((item) => (
              <tr key={item.accountId} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-3">
                  <span className="font-mono text-sm text-gray-500">
                    {item.accountNumber}
                  </span>
                  <span className="ml-2 text-sm text-gray-900">
                    {item.accountName}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAccountTypeColor(item.accountType)}`}>
                    {item.accountType}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-3 text-right font-mono text-sm text-gray-900">
                  {formatMonetaryAmount(item.debitBalance)}
                </td>
                <td className="whitespace-nowrap px-6 py-3 text-right font-mono text-sm text-gray-900">
                  {formatMonetaryAmount(item.creditBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr className="font-semibold">
              <td className="px-6 py-3 text-gray-900" colSpan={2}>
                Total
              </td>
              <td className="px-6 py-3 text-right font-mono text-gray-900">
                {formatMonetaryAmount(trialBalance.totalDebits)}
              </td>
              <td className="px-6 py-3 text-right font-mono text-gray-900">
                {formatMonetaryAmount(trialBalance.totalCredits)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Empty State */}
      {trialBalance.lineItems.length === 0 && (
        <div className="px-6 py-8 text-center">
          <p className="text-gray-500">No account balances found for this date.</p>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function getAccountTypeColor(type: string): string {
  const colors: Record<string, string> = {
    Asset: "bg-blue-100 text-blue-800",
    Liability: "bg-red-100 text-red-800",
    Equity: "bg-purple-100 text-purple-800",
    Revenue: "bg-green-100 text-green-800",
    Expense: "bg-orange-100 text-orange-800"
  }
  return colors[type] ?? "bg-gray-100 text-gray-800"
}
