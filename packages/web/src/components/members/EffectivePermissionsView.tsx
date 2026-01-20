/**
 * Effective Permissions View Component
 *
 * Displays a user's effective permissions in a categorized matrix view.
 * Shows which actions are allowed/denied based on role and functional roles.
 *
 * Phase 4 of AUTHORIZATION_MISSING.md - Effective Permissions Display
 */

import { Check, X, Shield, ChevronRight, ChevronDown } from "lucide-react"
import { clsx } from "clsx"
import { useState } from "react"

// =============================================================================
// Types
// =============================================================================

interface EffectivePermissionsViewProps {
  /**
   * The list of allowed actions (effective permissions) as strings
   */
  readonly effectivePermissions: readonly string[]

  /**
   * Optional class name for styling
   */
  readonly className?: string
}

// =============================================================================
// Permission Categories and Labels
// =============================================================================

/**
 * Human-readable labels for actions
 */
const ACTION_LABELS: Record<string, string> = {
  // Organization
  "organization:manage_settings": "Manage Settings",
  "organization:manage_members": "Manage Members",
  "organization:delete": "Delete Organization",
  "organization:transfer_ownership": "Transfer Ownership",

  // Company
  "company:create": "Create Company",
  "company:read": "View Companies",
  "company:update": "Update Company",
  "company:delete": "Delete Company",

  // Account
  "account:create": "Create Account",
  "account:read": "View Accounts",
  "account:update": "Update Account",
  "account:deactivate": "Deactivate Account",

  // Journal Entry
  "journal_entry:create": "Create Entry",
  "journal_entry:read": "View Entries",
  "journal_entry:update": "Update Entry",
  "journal_entry:post": "Post Entry",
  "journal_entry:reverse": "Reverse Entry",

  // Fiscal Period
  "fiscal_period:read": "View Periods",
  "fiscal_period:manage": "Manage Periods",

  // Consolidation
  "consolidation_group:create": "Create Group",
  "consolidation_group:read": "View Groups",
  "consolidation_group:update": "Update Group",
  "consolidation_group:delete": "Delete Group",
  "consolidation_group:run": "Run Consolidation",
  "elimination:create": "Create Elimination",

  // Reports
  "report:read": "View Reports",
  "report:export": "Export Reports",

  // Exchange Rates
  "exchange_rate:read": "View Rates",
  "exchange_rate:manage": "Manage Rates",

  // Audit Log
  "audit_log:read": "View Audit Log"
}

/**
 * Categorized actions for organized display
 */
interface PermissionCategory {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly actions: readonly string[]
}

const PERMISSION_CATEGORIES: readonly PermissionCategory[] = [
  {
    id: "organization",
    label: "Organization",
    icon: "🏢",
    actions: [
      "organization:manage_settings",
      "organization:manage_members",
      "organization:delete",
      "organization:transfer_ownership"
    ]
  },
  {
    id: "company",
    label: "Companies",
    icon: "🏬",
    actions: ["company:create", "company:read", "company:update", "company:delete"]
  },
  {
    id: "account",
    label: "Chart of Accounts",
    icon: "📋",
    actions: ["account:create", "account:read", "account:update", "account:deactivate"]
  },
  {
    id: "journal_entry",
    label: "Journal Entries",
    icon: "📝",
    actions: [
      "journal_entry:create",
      "journal_entry:read",
      "journal_entry:update",
      "journal_entry:post",
      "journal_entry:reverse"
    ]
  },
  {
    id: "fiscal_period",
    label: "Fiscal Periods",
    icon: "📅",
    actions: [
      "fiscal_period:read",
      "fiscal_period:manage"
    ]
  },
  {
    id: "consolidation",
    label: "Consolidation",
    icon: "🔗",
    actions: [
      "consolidation_group:create",
      "consolidation_group:read",
      "consolidation_group:update",
      "consolidation_group:delete",
      "consolidation_group:run",
      "elimination:create"
    ]
  },
  {
    id: "reports",
    label: "Reports",
    icon: "📊",
    actions: ["report:read", "report:export"]
  },
  {
    id: "exchange_rates",
    label: "Exchange Rates",
    icon: "💱",
    actions: ["exchange_rate:read", "exchange_rate:manage"]
  },
  {
    id: "audit",
    label: "Audit Log",
    icon: "🔍",
    actions: ["audit_log:read"]
  }
]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an action is allowed given the effective permissions
 */
function isActionAllowed(action: string, effectivePermissions: readonly string[]): boolean {
  // Wildcard grants all permissions
  if (effectivePermissions.includes("*")) return true
  return effectivePermissions.includes(action)
}

/**
 * Count allowed actions in a category
 */
function countAllowedInCategory(
  category: PermissionCategory,
  effectivePermissions: readonly string[]
): number {
  return category.actions.filter((action) => isActionAllowed(action, effectivePermissions)).length
}

// =============================================================================
// Sub-Components
// =============================================================================

interface PermissionRowProps {
  readonly action: string
  readonly isAllowed: boolean
}

function PermissionRow({ action, isAllowed }: PermissionRowProps) {
  const label = ACTION_LABELS[action] || action

  return (
    <div
      className={clsx(
        "flex items-center justify-between py-1.5 px-3",
        isAllowed ? "bg-green-50" : "bg-gray-50"
      )}
    >
      <span className={clsx("text-sm", isAllowed ? "text-gray-900" : "text-gray-500")}>
        {label}
      </span>
      {isAllowed ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-gray-400" />
      )}
    </div>
  )
}

interface PermissionCategorySectionProps {
  readonly category: PermissionCategory
  readonly effectivePermissions: readonly string[]
  readonly defaultExpanded?: boolean
}

function PermissionCategorySection({
  category,
  effectivePermissions,
  defaultExpanded = false
}: PermissionCategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const allowedCount = countAllowedInCategory(category, effectivePermissions)
  const totalCount = category.actions.length
  const allAllowed = allowedCount === totalCount
  const someAllowed = allowedCount > 0 && allowedCount < totalCount
  const noneAllowed = allowedCount === 0

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          "flex items-center justify-between w-full px-4 py-3 text-left",
          "hover:bg-gray-50 transition-colors",
          allAllowed && "bg-green-50",
          noneAllowed && "bg-gray-50"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{category.icon}</span>
          <span className="font-medium text-gray-900">{category.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              "text-sm px-2 py-0.5 rounded-full",
              allAllowed && "bg-green-100 text-green-700",
              someAllowed && "bg-yellow-100 text-yellow-700",
              noneAllowed && "bg-gray-100 text-gray-600"
            )}
          >
            {allowedCount}/{totalCount}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Action List */}
      {isExpanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {category.actions.map((action) => (
            <PermissionRow
              key={action}
              action={action}
              isAllowed={isActionAllowed(action, effectivePermissions)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Displays effective permissions in a categorized, expandable view
 *
 * Shows all permission categories with visual indicators for:
 * - Full access (all actions allowed)
 * - Partial access (some actions allowed)
 * - No access (no actions allowed)
 *
 * @example
 * ```tsx
 * <EffectivePermissionsView
 *   effectivePermissions={["company:read", "journal_entry:read", "report:read"]}
 * />
 * ```
 */
export function EffectivePermissionsView({
  effectivePermissions,
  className
}: EffectivePermissionsViewProps) {
  // Check for wildcard (full access)
  const hasWildcard = effectivePermissions.includes("*")

  // Count totals
  const totalActions = PERMISSION_CATEGORIES.reduce((sum, cat) => sum + cat.actions.length, 0)
  const totalAllowed = hasWildcard
    ? totalActions
    : PERMISSION_CATEGORIES.reduce(
        (sum, cat) => sum + countAllowedInCategory(cat, effectivePermissions),
        0
      )

  return (
    <div className={clsx("space-y-4", className)} data-testid="effective-permissions-view">
      {/* Summary */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 rounded-lg">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-900">Effective Permissions</span>
        </div>
        <div className="flex items-center gap-2">
          {hasWildcard ? (
            <span className="text-sm px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Full Access
            </span>
          ) : (
            <span className="text-sm text-gray-600">
              {totalAllowed} of {totalActions} actions allowed
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Check className="h-3 w-3 text-green-600" />
          <span>Allowed</span>
        </div>
        <div className="flex items-center gap-1">
          <X className="h-3 w-3 text-gray-400" />
          <span>Denied</span>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {PERMISSION_CATEGORIES.map((category, index) => (
          <PermissionCategorySection
            key={category.id}
            category={category}
            effectivePermissions={effectivePermissions}
            defaultExpanded={index === 0} // Expand first category by default
          />
        ))}
      </div>

      {/* Note about policies */}
      <div className="text-xs text-gray-500 px-2">
        <p>
          Permissions are determined by the user&apos;s base role, functional roles, and any custom
          policies applied to the organization.
        </p>
      </div>
    </div>
  )
}
