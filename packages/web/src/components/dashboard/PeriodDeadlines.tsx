/**
 * PeriodDeadlines component
 *
 * Upcoming period close deadlines.
 * Features:
 * - Period name with company
 * - Days until deadline
 * - Status indicator (on track, approaching, overdue)
 * - Loading skeleton state
 * - Empty state
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { Calendar, Clock, AlertTriangle, CheckCircle } from "lucide-react"

interface PeriodDeadline {
  readonly id: string
  readonly periodName: string
  readonly companyName: string
  readonly companyId: string
  readonly organizationId: string
  readonly endDate: string
  readonly status: "on_track" | "approaching" | "overdue"
}

interface PeriodDeadlinesProps {
  /** List of upcoming period deadlines */
  readonly deadlines: readonly PeriodDeadline[]
  /** Whether the component is in loading state */
  readonly isLoading?: boolean
}

function getDaysUntil(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

const statusConfig = {
  on_track: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "On track"
  },
  approaching: {
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    label: "Approaching"
  },
  overdue: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Overdue"
  }
}

export function PeriodDeadlines({
  deadlines,
  isLoading = false
}: PeriodDeadlinesProps) {
  if (isLoading) {
    return <PeriodDeadlinesSkeleton />
  }

  if (deadlines.length === 0) {
    return <PeriodDeadlinesEmpty />
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid="period-deadlines"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Upcoming Period Closes
        </h3>
      </div>

      <div className="divide-y divide-gray-100">
        {deadlines.slice(0, 5).map((deadline) => {
          const daysUntil = getDaysUntil(deadline.endDate)
          const config = statusConfig[deadline.status]
          const StatusIcon = config.icon

          return (
            <div
              key={deadline.id}
              className="px-6 py-4"
              data-testid={`deadline-${deadline.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      config.bgColor,
                      config.color
                    )}
                  >
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {deadline.periodName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {deadline.companyName}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={clsx(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                      config.bgColor,
                      config.color
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Due: {formatDate(deadline.endDate)}
                </span>
                <span
                  className={clsx(
                    "font-medium",
                    daysUntil <= 0
                      ? "text-red-600"
                      : daysUntil <= 7
                        ? "text-orange-600"
                        : "text-gray-600"
                  )}
                >
                  {daysUntil <= 0
                    ? `${Math.abs(daysUntil)} days overdue`
                    : daysUntil === 1
                      ? "1 day left"
                      : `${daysUntil} days left`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {deadlines.length > 5 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
            data-testid="deadlines-view-all"
          >
            View all {deadlines.length} deadlines
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Loading skeleton for PeriodDeadlines
 */
export function PeriodDeadlinesSkeleton() {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse"
      data-testid="period-deadlines-skeleton"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="h-6 w-48 bg-gray-200 rounded" />
      </div>

      <div className="divide-y divide-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-gray-200 rounded-lg" />
                <div>
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="mt-1 h-3 w-32 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-full" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Empty state for PeriodDeadlines
 */
export function PeriodDeadlinesEmpty() {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid="period-deadlines-empty"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Upcoming Period Closes
        </h3>
      </div>

      <div className="px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Calendar className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-gray-500">No upcoming deadlines</p>
        <p className="mt-1 text-sm text-gray-400">
          Set up fiscal periods to track closing deadlines
        </p>
      </div>
    </div>
  )
}
