/**
 * PolicyBuilderModal Component
 *
 * Modal for creating and editing ABAC authorization policies.
 *
 * Phase I2: Basic form (name, description, effect, priority)
 * Phase I3: Subject conditions (roles, functional roles, user selector)
 * Phase I4: Resource conditions (type, attributes)
 * Phase I5: Action selection (multi-select with search)
 * Phase I6: Environment conditions (time, days, IP)
 *
 * @module PolicyBuilderModal
 */

import { useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { X, AlertCircle, Shield, ShieldCheck, ShieldX, Info } from "lucide-react"
import { clsx } from "clsx"
import { api } from "@/api/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"

// =============================================================================
// Types
// =============================================================================

type PolicyEffect = "allow" | "deny"
type BaseRole = "owner" | "admin" | "member" | "viewer"
type SubjectConditionRole = BaseRole | "*"
type FunctionalRole = "controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager"
type ResourceType = "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*"
type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
type EntryType = "Standard" | "Adjusting" | "Closing" | "Reversing" | "Elimination" | "Consolidation" | "Intercompany"
type PeriodStatus = "Open" | "SoftClose" | "Closed" | "Locked"

// All valid actions as a union type
type ActionType =
  | "organization:manage_settings"
  | "organization:manage_members"
  | "organization:delete"
  | "organization:transfer_ownership"
  | "company:create"
  | "company:read"
  | "company:update"
  | "company:delete"
  | "account:create"
  | "account:read"
  | "account:update"
  | "account:deactivate"
  | "journal_entry:create"
  | "journal_entry:read"
  | "journal_entry:update"
  | "journal_entry:post"
  | "journal_entry:reverse"
  | "fiscal_period:read"
  | "fiscal_period:manage"
  | "consolidation_group:create"
  | "consolidation_group:read"
  | "consolidation_group:update"
  | "consolidation_group:delete"
  | "consolidation_group:run"
  | "elimination:create"
  | "report:read"
  | "report:export"
  | "exchange_rate:read"
  | "exchange_rate:manage"
  | "audit_log:read"
  | "*"

// Lookup table for action validation
const ACTION_TYPE_MAP: Record<string, ActionType> = {
  "organization:manage_settings": "organization:manage_settings",
  "organization:manage_members": "organization:manage_members",
  "organization:delete": "organization:delete",
  "organization:transfer_ownership": "organization:transfer_ownership",
  "company:create": "company:create",
  "company:read": "company:read",
  "company:update": "company:update",
  "company:delete": "company:delete",
  "account:create": "account:create",
  "account:read": "account:read",
  "account:update": "account:update",
  "account:deactivate": "account:deactivate",
  "journal_entry:create": "journal_entry:create",
  "journal_entry:read": "journal_entry:read",
  "journal_entry:update": "journal_entry:update",
  "journal_entry:post": "journal_entry:post",
  "journal_entry:reverse": "journal_entry:reverse",
  "fiscal_period:read": "fiscal_period:read",
  "fiscal_period:manage": "fiscal_period:manage",
  "consolidation_group:create": "consolidation_group:create",
  "consolidation_group:read": "consolidation_group:read",
  "consolidation_group:update": "consolidation_group:update",
  "consolidation_group:delete": "consolidation_group:delete",
  "consolidation_group:run": "consolidation_group:run",
  "elimination:create": "elimination:create",
  "report:read": "report:read",
  "report:export": "report:export",
  "exchange_rate:read": "exchange_rate:read",
  "exchange_rate:manage": "exchange_rate:manage",
  "audit_log:read": "audit_log:read",
  "*": "*"
}

interface SubjectCondition {
  readonly roles?: readonly SubjectConditionRole[]
  readonly functionalRoles?: readonly FunctionalRole[]
  readonly userIds?: readonly string[]
  readonly isPlatformAdmin?: boolean
}

interface ResourceAttributes {
  readonly accountNumber?: {
    readonly range?: readonly [number, number]
    readonly in?: readonly number[]
  }
  readonly accountType?: readonly AccountType[]
  readonly isIntercompany?: boolean
  readonly entryType?: readonly EntryType[]
  readonly isOwnEntry?: boolean
  readonly periodStatus?: readonly PeriodStatus[]
  readonly isAdjustmentPeriod?: boolean
}

interface ResourceCondition {
  readonly type: ResourceType
  readonly attributes?: ResourceAttributes
}

interface ActionCondition {
  readonly actions: readonly string[]
}

interface TimeRange {
  readonly start: string
  readonly end: string
}

interface EnvironmentCondition {
  readonly timeOfDay?: TimeRange
  readonly daysOfWeek?: readonly number[]
  readonly ipAllowList?: readonly string[]
  readonly ipDenyList?: readonly string[]
}

interface Policy {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly subject: SubjectCondition
  readonly resource: ResourceCondition
  readonly action: ActionCondition
  readonly environment: EnvironmentCondition | null
  readonly effect: PolicyEffect
  readonly priority: number
  readonly isSystemPolicy: boolean
  readonly isActive: boolean
}

// Helper to check if a role is a base role (not wildcard)
function isBaseRole(role: SubjectConditionRole): role is BaseRole {
  return role !== "*"
}

interface PolicyBuilderModalProps {
  readonly organizationId: string
  readonly mode: "create" | "edit"
  readonly existingPolicy?: Policy
  readonly onClose: () => void
  readonly onSuccess?: () => void
}

// =============================================================================
// Constants
// =============================================================================

const BASE_ROLES: readonly { value: BaseRole; label: string; description: string }[] = [
  { value: "owner", label: "Owner", description: "Organization creator/owner with full access" },
  { value: "admin", label: "Admin", description: "Organization administrator" },
  { value: "member", label: "Member", description: "Standard user with assigned functional roles" },
  { value: "viewer", label: "Viewer", description: "Read-only access to view data" }
]

const FUNCTIONAL_ROLES: readonly { value: FunctionalRole; label: string; description: string }[] = [
  { value: "controller", label: "Controller", description: "Full financial oversight, period lock/unlock" },
  { value: "finance_manager", label: "Finance Manager", description: "Account management, exchange rates" },
  { value: "accountant", label: "Accountant", description: "Create and post journal entries" },
  { value: "period_admin", label: "Period Admin", description: "Open/close fiscal periods" },
  { value: "consolidation_manager", label: "Consolidation Manager", description: "Manage consolidation groups" }
]

const RESOURCE_TYPES: readonly { value: ResourceType; label: string }[] = [
  { value: "*", label: "All Resources" },
  { value: "organization", label: "Organization" },
  { value: "company", label: "Company" },
  { value: "account", label: "Account" },
  { value: "journal_entry", label: "Journal Entry" },
  { value: "fiscal_period", label: "Fiscal Period" },
  { value: "consolidation_group", label: "Consolidation Group" },
  { value: "report", label: "Report" }
]

// All available actions grouped by resource type
const ACTION_GROUPS: readonly { resource: string; actions: readonly { value: string; label: string }[] }[] = [
  {
    resource: "Organization",
    actions: [
      { value: "organization:manage_settings", label: "Manage Settings" },
      { value: "organization:manage_members", label: "Manage Members" },
      { value: "organization:delete", label: "Delete Organization" },
      { value: "organization:transfer_ownership", label: "Transfer Ownership" }
    ]
  },
  {
    resource: "Company",
    actions: [
      { value: "company:create", label: "Create" },
      { value: "company:read", label: "Read" },
      { value: "company:update", label: "Update" },
      { value: "company:delete", label: "Delete" }
    ]
  },
  {
    resource: "Account",
    actions: [
      { value: "account:create", label: "Create" },
      { value: "account:read", label: "Read" },
      { value: "account:update", label: "Update" },
      { value: "account:deactivate", label: "Deactivate" }
    ]
  },
  {
    resource: "Journal Entry",
    actions: [
      { value: "journal_entry:create", label: "Create" },
      { value: "journal_entry:read", label: "Read" },
      { value: "journal_entry:update", label: "Update" },
      { value: "journal_entry:post", label: "Post" },
      { value: "journal_entry:reverse", label: "Reverse" }
    ]
  },
  {
    resource: "Fiscal Period",
    actions: [
      { value: "fiscal_period:read", label: "Read" },
      { value: "fiscal_period:manage", label: "Manage" }
    ]
  },
  {
    resource: "Consolidation",
    actions: [
      { value: "consolidation_group:create", label: "Create Group" },
      { value: "consolidation_group:read", label: "Read Group" },
      { value: "consolidation_group:update", label: "Update Group" },
      { value: "consolidation_group:delete", label: "Delete Group" },
      { value: "consolidation_group:run", label: "Run Consolidation" },
      { value: "elimination:create", label: "Create Elimination" }
    ]
  },
  {
    resource: "Report",
    actions: [
      { value: "report:read", label: "View Reports" },
      { value: "report:export", label: "Export Reports" }
    ]
  },
  {
    resource: "Exchange Rate",
    actions: [
      { value: "exchange_rate:read", label: "View Rates" },
      { value: "exchange_rate:manage", label: "Manage Rates" }
    ]
  },
  {
    resource: "Audit Log",
    actions: [
      { value: "audit_log:read", label: "View Audit Log" }
    ]
  }
]

const DAYS_OF_WEEK: readonly { value: number; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "Su" },
  { value: 1, label: "Monday", short: "Mo" },
  { value: 2, label: "Tuesday", short: "Tu" },
  { value: 3, label: "Wednesday", short: "We" },
  { value: 4, label: "Thursday", short: "Th" },
  { value: 5, label: "Friday", short: "Fr" },
  { value: 6, label: "Saturday", short: "Sa" }
]

// =============================================================================
// Component
// =============================================================================

export function PolicyBuilderModal({
  organizationId,
  mode,
  existingPolicy,
  onClose,
  onSuccess
}: PolicyBuilderModalProps) {
  const router = useRouter()

  // Phase I2: Basic form state
  const [name, setName] = useState(existingPolicy?.name ?? "")
  const [description, setDescription] = useState(existingPolicy?.description ?? "")
  const [effect, setEffect] = useState<PolicyEffect>(existingPolicy?.effect ?? "allow")
  const [priority, setPriority] = useState(existingPolicy?.priority ?? 500)
  const [isActive, setIsActive] = useState(existingPolicy?.isActive ?? true)

  // Phase I3: Subject conditions
  const [selectedRoles, setSelectedRoles] = useState<BaseRole[]>(
    existingPolicy?.subject.roles?.filter(isBaseRole) ?? []
  )
  const [selectedFunctionalRoles, setSelectedFunctionalRoles] = useState<FunctionalRole[]>(
    [...(existingPolicy?.subject.functionalRoles ?? [])]
  )

  // Phase I4: Resource conditions
  const [resourceType, setResourceType] = useState<ResourceType>(
    existingPolicy?.resource.type ?? "*"
  )
  const [resourceAttributes, setResourceAttributes] = useState<ResourceAttributes>(
    existingPolicy?.resource.attributes ?? {}
  )

  // Phase I5: Action conditions
  const [selectedActions, setSelectedActions] = useState<string[]>(
    existingPolicy?.action.actions.map(String) ?? []
  )
  const [actionSearch, setActionSearch] = useState("")

  // Phase I6: Environment conditions (now evaluated at runtime)
  const [hasTimeRestriction, setHasTimeRestriction] = useState(
    Boolean(existingPolicy?.environment?.timeOfDay)
  )
  const [timeStart, setTimeStart] = useState(existingPolicy?.environment?.timeOfDay?.start ?? "09:00")
  const [timeEnd, setTimeEnd] = useState(existingPolicy?.environment?.timeOfDay?.end ?? "17:00")
  const [selectedDays, setSelectedDays] = useState<number[]>(
    [...(existingPolicy?.environment?.daysOfWeek ?? [])]
  )
  // IP restrictions
  const [ipAllowListText, setIpAllowListText] = useState(
    existingPolicy?.environment?.ipAllowList?.join(", ") ?? ""
  )
  const [ipDenyListText, setIpDenyListText] = useState(
    existingPolicy?.environment?.ipDenyList?.join(", ") ?? ""
  )

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter actions based on search
  const filteredActionGroups = actionSearch
    ? ACTION_GROUPS.map((group) => ({
        ...group,
        actions: group.actions.filter(
          (action) =>
            action.label.toLowerCase().includes(actionSearch.toLowerCase()) ||
            action.value.toLowerCase().includes(actionSearch.toLowerCase())
        )
      })).filter((group) => group.actions.length > 0)
    : ACTION_GROUPS

  // Toggle handlers
  const toggleRole = (role: BaseRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const toggleFunctionalRole = (role: FunctionalRole) => {
    setSelectedFunctionalRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const toggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    )
  }

  const toggleAllActions = () => {
    if (selectedActions.includes("*")) {
      setSelectedActions([])
    } else {
      setSelectedActions(["*"])
    }
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  // Build policy object for API submission
  // Note: API expects mutable arrays, so we spread to create mutable copies
  const buildPolicy = () => {
    // Build subject condition with mutable arrays
    const subject: {
      roles?: BaseRole[]
      functionalRoles?: FunctionalRole[]
      userIds?: string[]
      isPlatformAdmin?: boolean
    } = {}
    if (selectedRoles.length > 0) {
      subject.roles = [...selectedRoles]
    }
    if (selectedFunctionalRoles.length > 0) {
      subject.functionalRoles = [...selectedFunctionalRoles]
    }

    // Build resource condition with mutable copies
    type MutableResourceAttributes = {
      accountNumber?: { range?: [number, number]; in?: number[] }
      accountType?: AccountType[]
      isIntercompany?: boolean
      entryType?: EntryType[]
      isOwnEntry?: boolean
      periodStatus?: PeriodStatus[]
      isAdjustmentPeriod?: boolean
    }
    const resource: {
      type: ResourceType
      attributes?: MutableResourceAttributes
    } = { type: resourceType }
    if (Object.keys(resourceAttributes).length > 0) {
      // Create deep mutable copy of attributes
      const attrs: MutableResourceAttributes = {}
      if (resourceAttributes.accountNumber) {
        const acctNum: { range?: [number, number]; in?: number[] } = {}
        if (resourceAttributes.accountNumber.range) {
          const [a, b] = resourceAttributes.accountNumber.range
          acctNum.range = [a, b]
        }
        if (resourceAttributes.accountNumber.in) {
          acctNum.in = [...resourceAttributes.accountNumber.in]
        }
        attrs.accountNumber = acctNum
      }
      if (resourceAttributes.accountType) {
        attrs.accountType = [...resourceAttributes.accountType]
      }
      if (resourceAttributes.isIntercompany !== undefined) {
        attrs.isIntercompany = resourceAttributes.isIntercompany
      }
      if (resourceAttributes.entryType) {
        attrs.entryType = [...resourceAttributes.entryType]
      }
      if (resourceAttributes.isOwnEntry !== undefined) {
        attrs.isOwnEntry = resourceAttributes.isOwnEntry
      }
      if (resourceAttributes.periodStatus) {
        attrs.periodStatus = [...resourceAttributes.periodStatus]
      }
      if (resourceAttributes.isAdjustmentPeriod !== undefined) {
        attrs.isAdjustmentPeriod = resourceAttributes.isAdjustmentPeriod
      }
      resource.attributes = attrs
    }

    // Build action condition - validate and convert selectedActions to ActionType[]
    const validatedActions: ActionType[] = selectedActions
      .map((a) => ACTION_TYPE_MAP[a])
      .filter((a): a is ActionType => a !== undefined)
    const actionsArray: ActionType[] = validatedActions.length > 0 ? validatedActions : ["*"]
    const action = { actions: actionsArray }

    // Build environment condition (now evaluated at runtime)
    // Parse IP lists from comma-separated text
    const ipAllowList = ipAllowListText
      .split(",")
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0)
    const ipDenyList = ipDenyListText
      .split(",")
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0)

    let environment: {
      timeOfDay?: { start: string; end: string }
      daysOfWeek?: number[]
      ipAllowList?: string[]
      ipDenyList?: string[]
    } | null = null
    if (hasTimeRestriction || selectedDays.length > 0 || ipAllowList.length > 0 || ipDenyList.length > 0) {
      environment = {}
      if (hasTimeRestriction) {
        environment.timeOfDay = { start: timeStart, end: timeEnd }
      }
      if (selectedDays.length > 0) {
        environment.daysOfWeek = [...selectedDays]
      }
      if (ipAllowList.length > 0) {
        environment.ipAllowList = ipAllowList
      }
      if (ipDenyList.length > 0) {
        environment.ipDenyList = ipDenyList
      }
    }

    return {
      name: name.trim(),
      description: description.trim() || null,
      subject,
      resource,
      action,
      environment,
      effect,
      priority,
      isActive
    }
  }

  // Validation
  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "Policy name is required"
    }
    if (name.trim().length < 3) {
      return "Policy name must be at least 3 characters"
    }
    if (selectedActions.length === 0) {
      return "At least one action must be selected"
    }
    if (selectedRoles.length === 0 && selectedFunctionalRoles.length === 0) {
      return "At least one role or functional role must be selected"
    }
    return null
  }

  // Submit handler
  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const policyData = buildPolicy()

      if (mode === "create") {
        const { error: apiError } = await api.POST("/api/v1/organizations/{orgId}/policies", {
          params: { path: { orgId: organizationId } },
          body: policyData
        })

        if (apiError) {
          const errorMessage =
            typeof apiError === "object" && apiError !== null && "message" in apiError
              ? String(apiError.message)
              : "Failed to create policy"
          setError(errorMessage)
          return
        }
      } else if (existingPolicy) {
        const { error: apiError } = await api.PATCH("/api/v1/organizations/{orgId}/policies/{policyId}", {
          params: { path: { orgId: organizationId, policyId: existingPolicy.id } },
          body: policyData
        })

        if (apiError) {
          const errorMessage =
            typeof apiError === "object" && apiError !== null && "message" in apiError
              ? String(apiError.message)
              : "Failed to update policy"
          setError(errorMessage)
          return
        }
      }

      await router.invalidate()
      onSuccess?.()
      onClose()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
        data-testid="policy-builder-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "rounded-lg p-2",
              effect === "allow" ? "bg-green-100" : "bg-red-100"
            )}>
              {effect === "allow" ? (
                <ShieldCheck className="h-5 w-5 text-green-600" />
              ) : (
                <ShieldX className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {mode === "create" ? "Create Policy" : "Edit Policy"}
              </h2>
              <p className="text-sm text-gray-500">
                Define who can perform what actions on which resources
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            data-testid="policy-builder-close"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              data-testid="policy-builder-error"
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
            >
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Phase I2: Basic Fields */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              Basic Information
            </h3>
            <div className="space-y-4">
              <Input
                label="Policy Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Finance Team Account Access"
                data-testid="policy-name-input"
              />
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this policy does..."
                data-testid="policy-description-input"
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Effect"
                  value={effect}
                  onChange={(e) => {
                    const val = e.target.value
                    const effectMap: Record<string, PolicyEffect> = { allow: "allow", deny: "deny" }
                    const mapped = effectMap[val]
                    if (mapped) setEffect(mapped)
                  }}
                  options={[
                    { value: "allow", label: "Allow - Grant permission" },
                    { value: "deny", label: "Deny - Block permission" }
                  ]}
                  data-testid="policy-effect-select"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (0-899)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="899"
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      className="flex-1"
                      data-testid="policy-priority-slider"
                    />
                    <input
                      type="number"
                      min="0"
                      max="899"
                      value={priority}
                      onChange={(e) => setPriority(Math.min(899, Math.max(0, Number(e.target.value))))}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm text-center"
                      data-testid="policy-priority-input"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Higher priority policies are evaluated first. System policies use 900-1000.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="policy-active-checkbox"
                />
                <span className="text-sm text-gray-700">Policy is active</span>
              </label>
            </div>
          </section>

          {/* Phase I3: Subject Conditions */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              Who (Subject Conditions)
            </h3>
            <div className="space-y-4">
              {/* Base Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {BASE_ROLES.map((role) => (
                    <label
                      key={role.value}
                      className={clsx(
                        "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
                        selectedRoles.includes(role.value)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        data-testid={`policy-role-${role.value}`}
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{role.label}</span>
                        <p className="text-xs text-gray-500">{role.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Functional Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Functional Roles</label>
                <div className="flex flex-wrap gap-2">
                  {FUNCTIONAL_ROLES.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => toggleFunctionalRole(role.value)}
                      title={role.description}
                      className={clsx(
                        "rounded-full px-3 py-1 text-sm transition-colors",
                        selectedFunctionalRoles.includes(role.value)
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                          : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"
                      )}
                      data-testid={`policy-functional-role-${role.value}`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Phase I4: Resource Conditions */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              What (Resource Conditions)
            </h3>
            <div className="space-y-4">
              <Select
                label="Resource Type"
                value={resourceType}
                onChange={(e) => {
                  const val = e.target.value
                  const rtMap: Record<string, ResourceType> = {
                    "*": "*", organization: "organization", company: "company", account: "account",
                    journal_entry: "journal_entry", fiscal_period: "fiscal_period",
                    consolidation_group: "consolidation_group", report: "report"
                  }
                  const mapped = rtMap[val]
                  if (mapped) setResourceType(mapped)
                }}
                options={RESOURCE_TYPES.map((rt) => ({ value: rt.value, label: rt.label }))}
                data-testid="policy-resource-type"
              />

              {/* Resource-specific attribute editors */}
              {resourceType === "account" && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Account Attributes</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Account Type"
                      value={resourceAttributes.accountType?.[0] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value
                        const atMap: Record<string, AccountType> = {
                          Asset: "Asset", Liability: "Liability", Equity: "Equity",
                          Revenue: "Revenue", Expense: "Expense"
                        }
                        setResourceAttributes((prev) => {
                          const mapped = atMap[value]
                          if (mapped) {
                            return { ...prev, accountType: [mapped] }
                          }
                          const { accountType: _, ...rest } = prev
                          return rest
                        })
                      }}
                      options={[
                        { value: "", label: "Any" },
                        { value: "Asset", label: "Asset" },
                        { value: "Liability", label: "Liability" },
                        { value: "Equity", label: "Equity" },
                        { value: "Revenue", label: "Revenue" },
                        { value: "Expense", label: "Expense" }
                      ]}
                      data-testid="policy-account-type"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={resourceAttributes.isIntercompany ?? false}
                        onChange={(e) => setResourceAttributes((prev) => {
                          if (e.target.checked) {
                            return { ...prev, isIntercompany: true }
                          }
                          const { isIntercompany: _, ...rest } = prev
                          return rest
                        })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        data-testid="policy-is-intercompany"
                      />
                      <span className="text-sm text-gray-700">Intercompany accounts only</span>
                    </label>
                  </div>
                </div>
              )}

              {resourceType === "journal_entry" && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Journal Entry Attributes</p>
                  <Select
                    label="Entry Type"
                    value={resourceAttributes.entryType?.[0] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value
                      const etMap: Record<string, EntryType> = {
                        Standard: "Standard", Adjusting: "Adjusting", Closing: "Closing",
                        Reversing: "Reversing", Elimination: "Elimination",
                        Consolidation: "Consolidation", Intercompany: "Intercompany"
                      }
                      setResourceAttributes((prev) => {
                        const mapped = etMap[value]
                        if (mapped) {
                          return { ...prev, entryType: [mapped] }
                        }
                        const { entryType: _, ...rest } = prev
                        return rest
                      })
                    }}
                    options={[
                      { value: "", label: "Any" },
                      { value: "Standard", label: "Standard" },
                      { value: "Adjusting", label: "Adjusting" },
                      { value: "Closing", label: "Closing" },
                      { value: "Reversing", label: "Reversing" },
                      { value: "Elimination", label: "Elimination" },
                      { value: "Consolidation", label: "Consolidation" },
                      { value: "Intercompany", label: "Intercompany" }
                    ]}
                    data-testid="policy-entry-type"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={resourceAttributes.isOwnEntry ?? false}
                      onChange={(e) => setResourceAttributes((prev) => {
                        if (e.target.checked) {
                          return { ...prev, isOwnEntry: true }
                        }
                        const { isOwnEntry: _, ...rest } = prev
                        return rest
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      data-testid="policy-is-own-entry"
                    />
                    <span className="text-sm text-gray-700">Only entries created by the user</span>
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* Phase I5: Action Selection */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              Can (Actions)
            </h3>
            <div className="space-y-4">
              {/* All Actions Toggle */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedActions.includes("*")}
                  onChange={toggleAllActions}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  data-testid="policy-all-actions"
                />
                <span className="text-sm font-medium text-gray-900">All Actions (*)</span>
              </label>

              {!selectedActions.includes("*") && (
                <>
                  {/* Search */}
                  <Input
                    placeholder="Search actions..."
                    value={actionSearch}
                    onChange={(e) => setActionSearch(e.target.value)}
                    data-testid="policy-action-search"
                  />

                  {/* Action Groups */}
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredActionGroups.map((group) => (
                      <div key={group.resource} className="border-b border-gray-200 last:border-b-0">
                        <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                          {group.resource}
                        </div>
                        <div className="p-2 space-y-1">
                          {group.actions.map((action) => (
                            <label
                              key={action.value}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedActions.includes(action.value)}
                                onChange={() => toggleAction(action.value)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                data-testid={`policy-action-${action.value.replace(":", "-")}`}
                              />
                              <span className="text-sm text-gray-700">{action.label}</span>
                              <span className="text-xs text-gray-400 font-mono">{action.value}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selected Actions Summary */}
                  {selectedActions.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {selectedActions.length} action{selectedActions.length !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Phase I6: Environment Conditions */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-gray-400" />
              When &amp; Where (Environment Conditions)
              <span className="text-xs text-gray-400 font-normal">(Optional)</span>
            </h3>
            <div className="space-y-4">
              {/* Info Banner */}
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  <strong>Environment conditions</strong> are evaluated at runtime.
                  Time, day of week, and IP restrictions are enforced when checking permissions.
                </p>
              </div>

              {/* Time of Day */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={hasTimeRestriction}
                    onChange={(e) => setHasTimeRestriction(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-testid="policy-time-restriction"
                  />
                  <span className="text-sm font-medium text-gray-700">Restrict by time of day</span>
                </label>
                {hasTimeRestriction && (
                  <div className="ml-6 grid grid-cols-2 gap-4">
                    <Input
                      type="time"
                      label="Start Time"
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                      data-testid="policy-time-start"
                    />
                    <Input
                      type="time"
                      label="End Time"
                      value={timeEnd}
                      onChange={(e) => setTimeEnd(e.target.value)}
                      data-testid="policy-time-end"
                    />
                  </div>
                )}
              </div>

              {/* Days of Week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      title={day.label}
                      className={clsx(
                        "w-10 h-10 rounded-lg text-sm font-medium transition-colors",
                        selectedDays.includes(day.value)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                      data-testid={`policy-day-${day.value}`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                {selectedDays.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No restriction (all days)</p>
                )}
              </div>

              {/* IP Restrictions */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <p className="text-sm font-medium text-gray-700">IP Address Restrictions</p>
                <Input
                  label="IP Allow List"
                  value={ipAllowListText}
                  onChange={(e) => setIpAllowListText(e.target.value)}
                  placeholder="e.g., 192.168.1.0/24, 10.0.0.1"
                  helperText="Comma-separated IP addresses or CIDR ranges. If specified, only these IPs can access."
                  data-testid="policy-ip-allow-list"
                />
                <Input
                  label="IP Deny List"
                  value={ipDenyListText}
                  onChange={(e) => setIpDenyListText(e.target.value)}
                  placeholder="e.g., 192.168.1.100, 10.0.0.0/8"
                  helperText="Comma-separated IP addresses or CIDR ranges. These IPs will be blocked."
                  data-testid="policy-ip-deny-list"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="policy-builder-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            data-testid="policy-builder-submit"
          >
            {mode === "create" ? "Create Policy" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
