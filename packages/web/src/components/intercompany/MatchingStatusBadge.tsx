/**
 * MatchingStatusBadge component
 *
 * Displays a styled badge for intercompany transaction matching statuses.
 */

import { CheckCircle, AlertCircle, AlertTriangle, ThumbsUp } from "lucide-react"
import { Tooltip } from "@/components/ui/Tooltip"

type MatchingStatus = "Matched" | "Unmatched" | "PartiallyMatched" | "VarianceApproved"

interface MatchingStatusBadgeProps {
  readonly status: MatchingStatus
  readonly showTooltip?: boolean
}

const STATUS_CONFIG: Record<
  MatchingStatus,
  {
    label: string
    description: string
    icon: typeof CheckCircle
    bgColor: string
    textColor: string
  }
> = {
  Matched: {
    label: "Matched",
    description: "Both sides agree on amount and details",
    icon: CheckCircle,
    bgColor: "bg-green-100",
    textColor: "text-green-800"
  },
  Unmatched: {
    label: "Unmatched",
    description: "Missing entry on one side",
    icon: AlertCircle,
    bgColor: "bg-red-100",
    textColor: "text-red-800"
  },
  PartiallyMatched: {
    label: "Partial Match",
    description: "Amounts differ between the two sides",
    icon: AlertTriangle,
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800"
  },
  VarianceApproved: {
    label: "Variance Approved",
    description: "Difference has been reviewed and accepted",
    icon: ThumbsUp,
    bgColor: "bg-blue-100",
    textColor: "text-blue-800"
  }
}

export function MatchingStatusBadge({
  status,
  showTooltip = true
}: MatchingStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )

  if (showTooltip) {
    return <Tooltip content={config.description}>{badge}</Tooltip>
  }

  return badge
}

/**
 * Helper to get matching status display label
 */
export function getMatchingStatusLabel(status: MatchingStatus): string {
  return STATUS_CONFIG[status]?.label ?? status
}
