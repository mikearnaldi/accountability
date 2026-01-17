/**
 * Consolidation Run Detail Route
 *
 * Shows details of a consolidation run including progress, validation results, and trial balance.
 *
 * Route: /organizations/:organizationId/consolidation/:groupId/runs/:runId
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Tooltip } from "@/components/ui/Tooltip"
import {
  ArrowLeft,
  Trash2,
  XCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  AlertTriangle,
  FileSpreadsheet,
  User,
  Calendar,
  BarChart3
} from "lucide-react"

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

interface ConsolidationGroup {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface ConsolidationStep {
  readonly stepType: "Validate" | "Translate" | "Aggregate" | "MatchIC" | "Eliminate" | "NCI" | "GenerateTB"
  readonly status: "Pending" | "InProgress" | "Completed" | "Failed" | "Skipped"
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly durationMs: number | null
  readonly errorMessage: string | null
  readonly details: string | null
}

interface ValidationIssue {
  readonly severity: "Error" | "Warning"
  readonly code: string
  readonly message: string
  readonly entityReference: string | null
}

interface ValidationResult {
  readonly isValid: boolean
  readonly issues: readonly ValidationIssue[]
}

interface TrialBalanceLine {
  readonly accountNumber: string
  readonly accountName: string
  readonly accountType: string
  readonly aggregatedAmount: string
  readonly eliminationAmount: string
  readonly nciAmount: string
  readonly consolidatedAmount: string
}

interface ConsolidatedTrialBalance {
  readonly lines: readonly TrialBalanceLine[]
  readonly totalDebits: string
  readonly totalCredits: string
  readonly totalEliminations: string
  readonly totalNCI: string
}

interface ConsolidationRun {
  readonly id: string
  readonly groupId: string
  readonly periodRef: { year: number; period: number }
  readonly asOfDate: string
  readonly status: "Pending" | "InProgress" | "Completed" | "Failed" | "Cancelled"
  readonly steps: readonly ConsolidationStep[]
  readonly validationResult: ValidationResult | null
  readonly consolidatedTrialBalance: ConsolidatedTrialBalance | null
  readonly eliminationEntryIds: readonly string[]
  readonly options: {
    skipValidation: boolean
    continueOnWarnings: boolean
    includeEquityMethodInvestments: boolean
    forceRegeneration: boolean
  }
  readonly initiatedBy: string
  readonly initiatedAt: string
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly totalDurationMs: number | null
  readonly errorMessage: string | null
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchRunData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; groupId: string; runId: string }) => data)
  .handler(async ({ data: { organizationId, groupId, runId } }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], group: null, run: null, trialBalance: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, groupResult, runResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/consolidation/groups/{id}", {
          params: { path: { id: groupId }, query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/consolidation/runs/{id}", {
          params: { path: { id: runId }, query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        return { organization: null, companies: [], group: null, run: null, trialBalance: null, error: "not_found" as const }
      }

      if (groupResult.error) {
        return { organization: null, companies: [], group: null, run: null, trialBalance: null, error: "group_not_found" as const }
      }

      if (runResult.error) {
        return { organization: null, companies: [], group: null, run: null, trialBalance: null, error: "run_not_found" as const }
      }

      // Fetch trial balance if run is completed
      let trialBalance = null
      if (runResult.data?.status === "Completed") {
        const tbResult = await serverApi.GET("/api/v1/consolidation/runs/{id}/trial-balance", {
          params: { path: { id: runId }, query: { organizationId } },
          headers: { Authorization }
        })
        if (!tbResult.error) {
          trialBalance = tbResult.data
        }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        group: groupResult.data?.group ?? null,
        run: runResult.data,
        trialBalance,
        error: null
      }
    } catch {
      return { organization: null, companies: [], group: null, run: null, trialBalance: null, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/consolidation/$groupId/runs/$runId")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchRunData({
      data: {
        organizationId: params.organizationId,
        groupId: params.groupId,
        runId: params.runId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    if (result.error === "group_not_found") {
      throw new Error("Consolidation group not found")
    }

    if (result.error === "run_not_found") {
      throw new Error("Consolidation run not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      group: result.group,
      run: result.run,
      trialBalance: result.trialBalance
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: ConsolidationRunDetailPage
})

// =============================================================================
// Page Component
// =============================================================================

function ConsolidationRunDetailPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const group = loaderData.group as ConsolidationGroup | null
  const run = loaderData.run as ConsolidationRun | null
  const trialBalance = loaderData.trialBalance as ConsolidatedTrialBalance | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  if (!organization || !group || !run) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Consolidation",
      href: `/organizations/${params.organizationId}/consolidation`
    },
    {
      label: group.name,
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}`
    },
    {
      label: `${run.periodRef.year} P${run.periodRef.period}`,
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}`
    }
  ]

  // Format duration
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "-"
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  // Step name mapping
  const stepNames: Record<ConsolidationStep["stepType"], string> = {
    Validate: "Validate Member Data",
    Translate: "Currency Translation",
    Aggregate: "Aggregate Balances",
    MatchIC: "Intercompany Matching",
    Eliminate: "Generate Eliminations",
    NCI: "Calculate Minority Interest",
    GenerateTB: "Generate Consolidated TB"
  }

  // Status badge
  const getStatusBadge = (status: ConsolidationRun["status"]) => {
    const config = {
      Pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock, label: "Pending" },
      InProgress: { bg: "bg-blue-100", text: "text-blue-800", icon: Loader2, label: "In Progress" },
      Completed: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle2, label: "Completed" },
      Failed: { bg: "bg-red-100", text: "text-red-800", icon: XCircle, label: "Failed" },
      Cancelled: { bg: "bg-gray-100", text: "text-gray-800", icon: Pause, label: "Cancelled" }
    }
    const { bg, text, icon: Icon, label } = config[status]
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${bg} ${text}`}>
        <Icon className={`h-4 w-4 ${status === "InProgress" ? "animate-spin" : ""}`} />
        {label}
      </span>
    )
  }

  // Step status icon
  const getStepStatusIcon = (status: ConsolidationStep["status"]) => {
    const config = {
      Pending: { icon: Clock, className: "text-gray-400" },
      InProgress: { icon: Loader2, className: "text-blue-500 animate-spin" },
      Completed: { icon: CheckCircle2, className: "text-green-500" },
      Failed: { icon: XCircle, className: "text-red-500" },
      Skipped: { icon: Pause, className: "text-gray-400" }
    }
    const { icon: Icon, className } = config[status]
    return <Icon className={`h-5 w-5 ${className}`} />
  }

  // Handle cancel
  const handleCancel = async () => {
    setIsCancelling(true)
    setActionError(null)

    try {
      const { error } = await api.POST("/api/v1/consolidation/runs/{id}/cancel", {
        params: { path: { id: run.id }, query: { organizationId: params.organizationId } }
      })

      if (error) {
        setActionError("Failed to cancel run")
        return
      }

      await router.invalidate()
    } catch {
      setActionError("An error occurred")
    } finally {
      setIsCancelling(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true)
    setActionError(null)

    try {
      const { error } = await api.DELETE("/api/v1/consolidation/runs/{id}", {
        params: { path: { id: run.id }, query: { organizationId: params.organizationId } }
      })

      if (error) {
        let errorMessage = "Failed to delete run"
        if (typeof error === "object" && error !== null && "message" in error) {
          errorMessage = String(error.message)
        }
        setActionError(errorMessage)
        setIsDeleting(false)
        return
      }

      await router.navigate({
        to: `/organizations/${params.organizationId}/consolidation/${params.groupId}`
      })
    } catch {
      setActionError("An error occurred")
      setIsDeleting(false)
    }
  }

  // Can cancel or delete
  const canCancel = run.status === "Pending" || run.status === "InProgress"
  const canDelete = run.status === "Pending" || run.status === "Failed"

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="consolidation-run-detail-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/consolidation/$groupId"
            params={{ organizationId: params.organizationId, groupId: params.groupId }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {group.name}
          </Link>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                  {run.periodRef.year} Period {run.periodRef.period}
                </h1>
                {getStatusBadge(run.status)}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                As of {run.asOfDate}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {run.status === "Completed" && (
                <Link
                  to="/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports"
                  params={{
                    organizationId: params.organizationId,
                    groupId: params.groupId,
                    runId: params.runId
                  }}
                  data-testid="view-reports-link"
                >
                  <Button
                    variant="primary"
                    icon={<BarChart3 className="h-4 w-4" />}
                  >
                    View Reports
                  </Button>
                </Link>
              )}
              {canCancel && (
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  icon={<XCircle className="h-4 w-4" />}
                  data-testid="cancel-run-button"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Run"}
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteModal(true)}
                  icon={<Trash2 className="h-4 w-4" />}
                  data-testid="delete-run-button"
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {actionError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{actionError}</p>
            </div>
          )}
        </div>

        {/* Run Info */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Run Information</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Period</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {run.periodRef.year} P{run.periodRef.period}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">As-of Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{run.asOfDate}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Initiated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(run.initiatedAt).toLocaleString()}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <dt className="text-sm font-medium text-gray-500">Duration</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDuration(run.totalDurationMs)}</dd>
              </div>
            </div>
          </dl>

          {run.errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="mt-1 text-sm text-red-700">{run.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Progress Stepper */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Progress</h2>
          <div className="space-y-4">
            {run.steps.map((step, index) => (
              <div
                key={step.stepType}
                className={`flex items-start gap-4 ${index > 0 ? "border-t border-gray-100 pt-4" : ""}`}
                data-testid={`step-${step.stepType}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getStepStatusIcon(step.status)}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {stepNames[step.stepType]}
                    </p>
                    <span className="text-xs text-gray-500">
                      {step.status === "Completed" || step.status === "Failed"
                        ? formatDuration(step.durationMs)
                        : step.status}
                    </span>
                  </div>
                  {step.errorMessage && (
                    <p className="mt-1 text-sm text-red-600">{step.errorMessage}</p>
                  )}
                  {step.details && (
                    <p className="mt-1 text-sm text-gray-500">{step.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Validation Results */}
        {run.validationResult && run.validationResult.issues.length > 0 && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Validation Results</h2>
            <div className="space-y-3">
              {run.validationResult.issues.map((issue, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 rounded-lg p-3 ${
                    issue.severity === "Error"
                      ? "bg-red-50 border border-red-200"
                      : "bg-yellow-50 border border-yellow-200"
                  }`}
                >
                  {issue.severity === "Error" ? (
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      issue.severity === "Error" ? "text-red-800" : "text-yellow-800"
                    }`}>
                      {issue.code}
                    </p>
                    <p className={`mt-0.5 text-sm ${
                      issue.severity === "Error" ? "text-red-700" : "text-yellow-700"
                    }`}>
                      {issue.message}
                    </p>
                    {issue.entityReference && (
                      <p className={`mt-1 text-xs ${
                        issue.severity === "Error" ? "text-red-600" : "text-yellow-600"
                      }`}>
                        Reference: {issue.entityReference}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Consolidated Trial Balance */}
        {run.status === "Completed" && trialBalance && (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Consolidated Trial Balance</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${
                  trialBalance.totalDebits === trialBalance.totalCredits
                    ? "text-green-600"
                    : "text-red-600"
                }`}>
                  {trialBalance.totalDebits === trialBalance.totalCredits
                    ? "✓ Balanced"
                    : "✗ Out of Balance"}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The account number from the chart of accounts">
                        <span className="cursor-help border-b border-dotted border-gray-400">Account #</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The account name/description">
                        <span className="cursor-help border-b border-dotted border-gray-400">Account Name</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The type of account (Asset, Liability, Equity, Revenue, Expense)">
                        <span className="cursor-help border-b border-dotted border-gray-400">Type</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Sum of balances from all subsidiaries before adjustments">
                        <span className="cursor-help border-b border-dotted border-gray-400">Aggregated</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Elimination entries to remove intercompany transactions">
                        <span className="cursor-help border-b border-dotted border-gray-400">Eliminations</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Non-Controlling Interest (minority) adjustments">
                        <span className="cursor-help border-b border-dotted border-gray-400">NCI</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Final consolidated balance (Aggregated + Eliminations + NCI)">
                        <span className="cursor-help border-b border-dotted border-gray-400">Consolidated</span>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {trialBalance.lines.map((line, index) => (
                    <tr key={`${line.accountNumber}-${index}`}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-900">
                        {line.accountNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {line.accountName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {line.accountType}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 text-right font-mono">
                        {formatAmount(line.aggregatedAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 text-right font-mono">
                        {formatAmount(line.eliminationAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 text-right font-mono">
                        {formatAmount(line.nciAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 text-right font-mono">
                        {formatAmount(line.consolidatedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr className="font-medium">
                    <td colSpan={3} className="px-6 py-3 text-sm text-gray-900">
                      Totals
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-900 text-right font-mono">
                      {/* Aggregated total - would need to calculate from lines */}
                      -
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-900 text-right font-mono">
                      {formatAmount(trialBalance.totalEliminations)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-900 text-right font-mono">
                      {formatAmount(trialBalance.totalNCI)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-900 text-right font-mono">
                      -
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="px-6 py-2 text-sm text-gray-600">
                      Total Debits
                    </td>
                    <td colSpan={4} className="whitespace-nowrap px-6 py-2 text-sm text-gray-900 text-right font-mono">
                      {formatAmount(trialBalance.totalDebits)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-6 py-2 text-sm text-gray-600">
                      Total Credits
                    </td>
                    <td colSpan={4} className="whitespace-nowrap px-6 py-2 text-sm text-gray-900 text-right font-mono">
                      {formatAmount(trialBalance.totalCredits)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="text-lg font-semibold">Delete Consolidation Run</h3>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                Are you sure you want to delete this consolidation run? This action cannot be undone.
              </p>
              {actionError && (
                <p className="mt-2 text-sm text-red-600">{actionError}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setActionError(null)
                  }}
                  data-testid="cancel-delete-button"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  data-testid="confirm-delete-button"
                >
                  {isDeleting ? "Deleting..." : "Delete Run"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatAmount(amount: string): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}
