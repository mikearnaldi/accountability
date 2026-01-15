/**
 * ActivityFeed component
 *
 * Recent activity feed showing the last 10 actions.
 * Features:
 * - Activity item with icon, description, and timestamp
 * - Different icons for different activity types
 * - Loading skeleton state
 * - Empty state
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { Link } from "@tanstack/react-router"
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  ArrowLeftRight,
  Settings,
  TrendingUp
} from "lucide-react"

// Activity types cover all audit log entity types and actions
export type ActivityType =
  // Journal entries
  | "journal_created"
  | "journal_updated"
  | "journal_posted"
  | "journal_voided"
  | "journal_deleted"
  // Accounts
  | "account_created"
  | "account_updated"
  | "account_deleted"
  // Companies
  | "company_created"
  | "company_updated"
  | "company_deleted"
  // Organizations
  | "organization_created"
  | "organization_updated"
  | "organization_deleted"
  // Exchange rates
  | "exchangerate_created"
  | "exchangerate_updated"
  | "exchangerate_deleted"
  // Intercompany transactions
  | "intercompany_created"
  | "intercompany_updated"
  | "intercompany_deleted"
  // Consolidation
  | "consolidation_created"
  | "consolidation_updated"
  | "consolidation_deleted"
  // Generic/legacy types
  | "period_closed"
  | "report_generated"
  | "generic_created"
  | "generic_updated"
  | "generic_deleted"

interface ActivityItem {
  readonly id: string
  readonly type: ActivityType
  readonly description: string
  readonly timestamp: string
  readonly user?: string
}

interface ActivityFeedProps {
  /** List of activity items to display */
  readonly activities: readonly ActivityItem[]
  /** Whether the feed is in loading state */
  readonly isLoading?: boolean
  /** Organization ID for the View All link */
  readonly organizationId?: string
}

const activityIcons: Record<
  ActivityType,
  { icon: typeof FileText; color: string }
> = {
  // Journal entries
  journal_created: { icon: Plus, color: "text-blue-600 bg-blue-100" },
  journal_updated: { icon: Edit, color: "text-blue-600 bg-blue-100" },
  journal_posted: { icon: CheckCircle, color: "text-green-600 bg-green-100" },
  journal_voided: { icon: AlertCircle, color: "text-red-600 bg-red-100" },
  journal_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" },
  // Accounts
  account_created: { icon: Plus, color: "text-orange-600 bg-orange-100" },
  account_updated: { icon: Edit, color: "text-orange-600 bg-orange-100" },
  account_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" },
  // Companies
  company_created: { icon: Plus, color: "text-purple-600 bg-purple-100" },
  company_updated: { icon: Edit, color: "text-purple-600 bg-purple-100" },
  company_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" },
  // Organizations
  organization_created: { icon: Plus, color: "text-indigo-600 bg-indigo-100" },
  organization_updated: { icon: Settings, color: "text-indigo-600 bg-indigo-100" },
  organization_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" },
  // Exchange rates
  exchangerate_created: { icon: Plus, color: "text-green-600 bg-green-100" },
  exchangerate_updated: { icon: TrendingUp, color: "text-green-600 bg-green-100" },
  exchangerate_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" },
  // Intercompany
  intercompany_created: { icon: Plus, color: "text-cyan-600 bg-cyan-100" },
  intercompany_updated: { icon: ArrowLeftRight, color: "text-cyan-600 bg-cyan-100" },
  intercompany_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" },
  // Consolidation
  consolidation_created: { icon: Plus, color: "text-teal-600 bg-teal-100" },
  consolidation_updated: { icon: Edit, color: "text-teal-600 bg-teal-100" },
  consolidation_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" },
  // Legacy/generic
  period_closed: { icon: Clock, color: "text-gray-600 bg-gray-100" },
  report_generated: { icon: FileText, color: "text-blue-600 bg-blue-100" },
  generic_created: { icon: Plus, color: "text-gray-600 bg-gray-100" },
  generic_updated: { icon: Edit, color: "text-gray-600 bg-gray-100" },
  generic_deleted: { icon: Trash2, color: "text-red-600 bg-red-100" }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  })
}

export function ActivityFeed({ activities, isLoading = false, organizationId }: ActivityFeedProps) {
  if (isLoading) {
    return <ActivityFeedSkeleton />
  }

  if (activities.length === 0) {
    return <ActivityFeedEmpty />
  }

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid="activity-feed"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {activities.map((activity) => {
          const { icon: Icon, color } = activityIcons[activity.type] ?? {
            icon: FileText,
            color: "text-gray-600 bg-gray-100"
          }

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 px-6 py-4 hover:bg-gray-50 transition-colors"
              data-testid={`activity-item-${activity.id}`}
            >
              <div
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
                  color
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{activity.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatTimestamp(activity.timestamp)}</span>
                  {activity.user && (
                    <>
                      <span>·</span>
                      <span>{activity.user}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* View All Link */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        {organizationId ? (
          <Link
            to="/organizations/$organizationId/audit-log"
            params={{ organizationId }}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
            data-testid="activity-view-all"
          >
            View all activity
          </Link>
        ) : (
          <button
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
            data-testid="activity-view-all"
            disabled
          >
            View all activity
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for ActivityFeed
 */
export function ActivityFeedSkeleton() {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse"
      data-testid="activity-feed-skeleton"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="h-6 w-32 bg-gray-200 rounded" />
      </div>

      <div className="divide-y divide-gray-100">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 px-6 py-4">
            <div className="h-8 w-8 bg-gray-200 rounded-full" />
            <div className="flex-1">
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="mt-2 h-3 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

/**
 * Empty state for ActivityFeed
 */
export function ActivityFeedEmpty() {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid="activity-feed-empty"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
      </div>

      <div className="px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Clock className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-gray-500">No recent activity</p>
        <p className="mt-1 text-sm text-gray-400">
          Your recent actions will appear here
        </p>
      </div>
    </div>
  )
}
