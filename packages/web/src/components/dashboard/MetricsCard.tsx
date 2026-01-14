/**
 * MetricsCard component
 *
 * Dashboard widget showing key metrics.
 * Features:
 * - Icon with colored background
 * - Metric value with label
 * - Optional trend indicator
 * - Loading skeleton state
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface MetricsCardProps {
  /** Card title/label */
  readonly label: string
  /** Metric value to display */
  readonly value: string | number
  /** Icon to display */
  readonly icon: LucideIcon
  /** Icon background color */
  readonly iconColor: "blue" | "green" | "purple" | "orange" | "red"
  /** Optional trend percentage (positive = up, negative = down) */
  readonly trend?: number
  /** Optional trend label */
  readonly trendLabel?: string
  /** Data test ID for E2E testing */
  readonly testId: string
  /** Whether the card is in loading state */
  readonly isLoading?: boolean
}

const iconColorClasses = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
  red: "bg-red-100 text-red-600"
}

export function MetricsCard({
  label,
  value,
  icon: Icon,
  iconColor,
  trend,
  trendLabel,
  testId,
  isLoading = false
}: MetricsCardProps) {
  if (isLoading) {
    return <MetricsCardSkeleton />
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
      data-testid={testId}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p
            className="mt-2 text-3xl font-bold text-gray-900"
            data-testid={`${testId}-value`}
          >
            {value}
          </p>

          {/* Trend indicator */}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {trend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span
                className={clsx(
                  "text-sm font-medium",
                  trend >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {trend >= 0 ? "+" : ""}
                {trend}%
              </span>
              {trendLabel && (
                <span className="text-sm text-gray-500">{trendLabel}</span>
              )}
            </div>
          )}
        </div>

        {/* Icon */}
        <div
          className={clsx(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            iconColorClasses[iconColor]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

/**
 * Loading skeleton for MetricsCard
 */
export function MetricsCardSkeleton() {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm animate-pulse"
      data-testid="metrics-card-skeleton"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="mt-3 h-8 w-16 bg-gray-200 rounded" />
          <div className="mt-3 h-4 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-12 w-12 bg-gray-200 rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Grid container for metrics cards
 */
export function MetricsGrid({
  children
}: {
  readonly children: React.ReactNode
}) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="metrics-grid"
    >
      {children}
    </div>
  )
}
