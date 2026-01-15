/**
 * TransactionTypeBadge component
 *
 * Displays a styled badge for intercompany transaction types with icons.
 */

import {
  ShoppingCart,
  Banknote,
  Briefcase,
  TrendingUp,
  Building,
  Calculator,
  Star
} from "lucide-react"
import { Tooltip } from "@/components/ui/Tooltip"

type IntercompanyTransactionType =
  | "SalePurchase"
  | "Loan"
  | "ManagementFee"
  | "Dividend"
  | "CapitalContribution"
  | "CostAllocation"
  | "Royalty"

interface TransactionTypeBadgeProps {
  readonly type: IntercompanyTransactionType
  readonly showTooltip?: boolean
}

const TYPE_CONFIG: Record<
  IntercompanyTransactionType,
  {
    label: string
    description: string
    icon: typeof ShoppingCart
    bgColor: string
    textColor: string
  }
> = {
  SalePurchase: {
    label: "Sale/Purchase",
    description: "Sale or purchase of goods/services between companies",
    icon: ShoppingCart,
    bgColor: "bg-blue-100",
    textColor: "text-blue-800"
  },
  Loan: {
    label: "Loan",
    description: "Intercompany loan (principal or interest)",
    icon: Banknote,
    bgColor: "bg-green-100",
    textColor: "text-green-800"
  },
  ManagementFee: {
    label: "Management Fee",
    description: "Management or administrative fee charges",
    icon: Briefcase,
    bgColor: "bg-purple-100",
    textColor: "text-purple-800"
  },
  Dividend: {
    label: "Dividend",
    description: "Dividend distribution from subsidiary to parent",
    icon: TrendingUp,
    bgColor: "bg-amber-100",
    textColor: "text-amber-800"
  },
  CapitalContribution: {
    label: "Capital",
    description: "Capital contribution from parent to subsidiary",
    icon: Building,
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800"
  },
  CostAllocation: {
    label: "Cost Allocation",
    description: "Shared cost allocation between entities",
    icon: Calculator,
    bgColor: "bg-orange-100",
    textColor: "text-orange-800"
  },
  Royalty: {
    label: "Royalty",
    description: "Royalty payments for intellectual property",
    icon: Star,
    bgColor: "bg-pink-100",
    textColor: "text-pink-800"
  }
}

export function TransactionTypeBadge({
  type,
  showTooltip = true
}: TransactionTypeBadgeProps) {
  const config = TYPE_CONFIG[type]
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
 * Helper to get transaction type display label
 */
export function getTransactionTypeLabel(type: IntercompanyTransactionType): string {
  return TYPE_CONFIG[type]?.label ?? type
}
