/**
 * PolicyTestModal - Modal for testing authorization policy evaluation
 *
 * Phase I7 of AUTHORIZATION.md spec - Policy Testing Tool
 *
 * Allows admins to simulate authorization requests to see:
 * - Which policies would match
 * - What the final decision would be
 * - Human-readable explanations for the decision
 *
 * @module PolicyTestModal
 */

import { useState } from "react"
import { X, Play, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react"
import { clsx } from "clsx"
import { api } from "@/api/client"
import { Button } from "@/components/ui/Button"

// =============================================================================
// Types
// =============================================================================

type BaseRole = "owner" | "admin" | "member" | "viewer"
type FunctionalRole = "controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager"
type PolicyEffect = "allow" | "deny"
type ResourceType = "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*"

type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
type EntryType = "Standard" | "Adjusting" | "Closing" | "Reversing" | "Elimination" | "Consolidation" | "Intercompany"
type PeriodStatus = "Open" | "SoftClose" | "Closed" | "Locked"

// Action type matching the API schema
type Action =
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
const ACTION_MAP: Record<string, Action> = {
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

interface Member {
  readonly userId: string
  readonly email: string
  readonly displayName: string
  readonly role: BaseRole
  readonly functionalRoles: readonly FunctionalRole[]
}

interface MatchedPolicy {
  readonly id: string
  readonly name: string
  readonly effect: PolicyEffect
  readonly priority: number
  readonly isSystemPolicy: boolean
}

interface TestResult {
  readonly decision: "allow" | "deny"
  readonly matchedPolicies: readonly MatchedPolicy[]
  readonly reason: string
}

// =============================================================================
// Constants
// =============================================================================

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "organization", label: "Organization" },
  { value: "company", label: "Company" },
  { value: "account", label: "Account" },
  { value: "journal_entry", label: "Journal Entry" },
  { value: "fiscal_period", label: "Fiscal Period" },
  { value: "consolidation_group", label: "Consolidation Group" },
  { value: "report", label: "Report" }
]

// Actions organized by resource type
const ACTIONS_BY_RESOURCE: Record<string, { value: string; label: string }[]> = {
  organization: [
    { value: "organization:manage_settings", label: "Manage Settings" },
    { value: "organization:manage_members", label: "Manage Members" },
    { value: "organization:delete", label: "Delete" },
    { value: "organization:transfer_ownership", label: "Transfer Ownership" }
  ],
  company: [
    { value: "company:create", label: "Create" },
    { value: "company:read", label: "Read" },
    { value: "company:update", label: "Update" },
    { value: "company:delete", label: "Delete" }
  ],
  account: [
    { value: "account:create", label: "Create" },
    { value: "account:read", label: "Read" },
    { value: "account:update", label: "Update" },
    { value: "account:deactivate", label: "Deactivate" }
  ],
  journal_entry: [
    { value: "journal_entry:create", label: "Create" },
    { value: "journal_entry:read", label: "Read" },
    { value: "journal_entry:update", label: "Update" },
    { value: "journal_entry:post", label: "Post" },
    { value: "journal_entry:reverse", label: "Reverse" }
  ],
  fiscal_period: [
    { value: "fiscal_period:read", label: "Read" },
    { value: "fiscal_period:manage", label: "Manage" }
  ],
  consolidation_group: [
    { value: "consolidation_group:create", label: "Create" },
    { value: "consolidation_group:read", label: "Read" },
    { value: "consolidation_group:update", label: "Update" },
    { value: "consolidation_group:delete", label: "Delete" },
    { value: "consolidation_group:run", label: "Run" }
  ],
  report: [
    { value: "report:read", label: "Read" },
    { value: "report:export", label: "Export" }
  ]
}

const ACCOUNT_TYPES: AccountType[] = ["Asset", "Liability", "Equity", "Revenue", "Expense"]
const ENTRY_TYPES: EntryType[] = ["Standard", "Adjusting", "Closing", "Reversing", "Elimination", "Consolidation", "Intercompany"]
const PERIOD_STATUSES: PeriodStatus[] = ["Open", "SoftClose", "Closed", "Locked"]

// =============================================================================
// Component
// =============================================================================

interface PolicyTestModalProps {
  readonly organizationId: string
  readonly members: readonly Member[]
  readonly onClose: () => void
}

export function PolicyTestModal({ organizationId, members, onClose }: PolicyTestModalProps) {
  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [resourceType, setResourceType] = useState<ResourceType>("company")
  const [action, setAction] = useState<string>("")
  const [resourceId, setResourceId] = useState<string>("")

  // Account attributes
  const [accountType, setAccountType] = useState<AccountType | "">("")
  const [isIntercompany, setIsIntercompany] = useState<boolean | null>(null)

  // Journal entry attributes
  const [entryType, setEntryType] = useState<EntryType | "">("")
  const [periodStatus, setPeriodStatus] = useState<PeriodStatus | "">("")
  const [isOwnEntry, setIsOwnEntry] = useState<boolean | null>(null)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)

  // Reset action when resource type changes
  const handleResourceTypeChange = (newType: ResourceType) => {
    setResourceType(newType)
    setAction("")
    // Reset all resource-specific attributes
    setAccountType("")
    setIsIntercompany(null)
    setEntryType("")
    setPeriodStatus("")
    setIsOwnEntry(null)
  }

  // Get available actions for current resource type
  const availableActions = ACTIONS_BY_RESOURCE[resourceType] ?? []

  // Build resource attributes based on current selections
  const buildResourceAttributes = (): Record<string, unknown> | undefined => {
    const attrs: Record<string, unknown> = {}

    if (resourceType === "account") {
      if (accountType) {
        attrs.accountType = [accountType]
      }
      if (isIntercompany !== null) {
        attrs.isIntercompany = isIntercompany
      }
    }

    if (resourceType === "journal_entry") {
      if (entryType) {
        attrs.entryType = [entryType]
      }
      if (periodStatus) {
        attrs.periodStatus = [periodStatus]
      }
      if (isOwnEntry !== null) {
        attrs.isOwnEntry = isOwnEntry
      }
    }

    return Object.keys(attrs).length > 0 ? attrs : undefined
  }

  const handleTest = async () => {
    if (!selectedUserId || !action) {
      setError("Please select a user and an action to test")
      return
    }

    // Validate action using lookup table
    const validatedAction = ACTION_MAP[action]
    if (!validatedAction) {
      setError("Invalid action selected")
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const resourceAttributes = buildResourceAttributes()

      const { data, error: apiError } = await api.POST("/api/v1/organizations/{orgId}/policies/test", {
        params: { path: { orgId: organizationId } },
        body: {
          userId: selectedUserId,
          action: validatedAction,
          resourceType,
          resourceId: resourceId || null,
          resourceAttributes: resourceAttributes ?? null
        }
      })

      if (apiError) {
        const errorMessage =
          typeof apiError === "object" && apiError !== null && "message" in apiError
            ? String(apiError.message)
            : "Failed to test policy"
        setError(errorMessage)
        return
      }

      if (data) {
        /* eslint-disable @typescript-eslint/consistent-type-assertions -- API response typing */
        setResult({
          decision: data.decision,
          matchedPolicies: data.matchedPolicies as readonly MatchedPolicy[],
          reason: data.reason
        })
        /* eslint-enable @typescript-eslint/consistent-type-assertions */
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Get selected member info for display
  const selectedMember = members.find((m) => m.userId === selectedUserId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="policy-test-modal">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Test Policy Evaluation</h2>
            <p className="text-sm text-gray-500">Simulate an authorization request to see the result</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            data-testid="policy-test-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-6 p-6">
          {/* Info Banner */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p>
                  This tool simulates how the authorization system would evaluate a request.
                  Select a user, resource type, action, and optional attributes to see which
                  policies would match and what decision would be made.
                </p>
              </div>
            </div>
          </div>

          {/* User Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="policy-test-user-select"
            >
              <option value="">Choose a member...</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName} ({member.email}) - {member.role}
                </option>
              ))}
            </select>
            {selectedMember && (
              <p className="mt-1 text-sm text-gray-500">
                Role: {selectedMember.role}
                {selectedMember.functionalRoles.length > 0 && (
                  <> | Functional roles: {selectedMember.functionalRoles.join(", ")}</>
                )}
              </p>
            )}
          </div>

          {/* Resource Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resource Type <span className="text-red-500">*</span>
            </label>
            <select
              value={resourceType}
              onChange={(e) => {
                const rtMap: Record<string, ResourceType> = {
                  organization: "organization",
                  company: "company",
                  account: "account",
                  journal_entry: "journal_entry",
                  fiscal_period: "fiscal_period",
                  consolidation_group: "consolidation_group",
                  report: "report",
                  "*": "*"
                }
                const mapped = rtMap[e.target.value]
                if (mapped) {
                  handleResourceTypeChange(mapped)
                }
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="policy-test-resource-type"
            >
              {RESOURCE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action <span className="text-red-500">*</span>
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="policy-test-action"
            >
              <option value="">Choose an action...</option>
              {availableActions.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resource ID (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resource ID <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="policy-test-resource-id"
            />
            <p className="mt-1 text-xs text-gray-500">
              Specify a particular resource ID if your policy uses resource-specific conditions
            </p>
          </div>

          {/* Account Attributes */}
          {resourceType === "account" && (
            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Account Attributes</h3>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Account Type</label>
                <select
                  value={accountType}
                  onChange={(e) => {
                    const atMap: Record<string, AccountType> = {
                      Asset: "Asset",
                      Liability: "Liability",
                      Equity: "Equity",
                      Revenue: "Revenue",
                      Expense: "Expense"
                    }
                    const mapped = atMap[e.target.value]
                    if (mapped) {
                      setAccountType(mapped)
                    } else {
                      setAccountType("")
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  {ACCOUNT_TYPES.map((at) => (
                    <option key={at} value={at}>{at}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Intercompany Account</label>
                <select
                  value={isIntercompany === null ? "" : isIntercompany.toString()}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setIsIntercompany(null)
                    } else {
                      setIsIntercompany(e.target.value === "true")
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          )}

          {/* Journal Entry Attributes */}
          {resourceType === "journal_entry" && (
            <div className="rounded-lg border border-gray-200 p-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Journal Entry Attributes</h3>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Entry Type</label>
                <select
                  value={entryType}
                  onChange={(e) => {
                    const etMap: Record<string, EntryType> = {
                      Standard: "Standard",
                      Adjusting: "Adjusting",
                      Closing: "Closing",
                      Reversing: "Reversing",
                      Elimination: "Elimination",
                      Consolidation: "Consolidation",
                      Intercompany: "Intercompany"
                    }
                    const mapped = etMap[e.target.value]
                    if (mapped) {
                      setEntryType(mapped)
                    } else {
                      setEntryType("")
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  {ENTRY_TYPES.map((et) => (
                    <option key={et} value={et}>{et}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Period Status</label>
                <select
                  value={periodStatus}
                  onChange={(e) => {
                    const psMap: Record<string, PeriodStatus> = {
                      Open: "Open",
                      SoftClose: "SoftClose",
                      Closed: "Closed",
                      Locked: "Locked"
                    }
                    const mapped = psMap[e.target.value]
                    if (mapped) {
                      setPeriodStatus(mapped)
                    } else {
                      setPeriodStatus("")
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  {PERIOD_STATUSES.map((ps) => (
                    <option key={ps} value={ps}>{ps}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Is Own Entry</label>
                <select
                  value={isOwnEntry === null ? "" : isOwnEntry.toString()}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      setIsOwnEntry(null)
                    } else {
                      setIsOwnEntry(e.target.value === "true")
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={clsx(
                "rounded-lg border p-4",
                result.decision === "allow"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              )}
              data-testid="policy-test-result"
            >
              <div className="flex items-start gap-3">
                {result.decision === "allow" ? (
                  <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3
                    className={clsx(
                      "text-lg font-semibold",
                      result.decision === "allow" ? "text-green-800" : "text-red-800"
                    )}
                  >
                    {result.decision === "allow" ? "Access Allowed" : "Access Denied"}
                  </h3>
                  <p
                    className={clsx(
                      "mt-1 text-sm",
                      result.decision === "allow" ? "text-green-700" : "text-red-700"
                    )}
                  >
                    {result.reason}
                  </p>

                  {result.matchedPolicies.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Matched Policies:</h4>
                      <ul className="space-y-2">
                        {result.matchedPolicies.map((policy) => (
                          <li
                            key={policy.id}
                            className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {policy.isSystemPolicy && (
                                <span className="text-xs text-gray-500">[System]</span>
                              )}
                              <span className="font-medium text-gray-900">{policy.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={clsx(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  policy.effect === "allow"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                )}
                              >
                                {policy.effect}
                              </span>
                              <span className="text-xs text-gray-500">
                                Priority: {policy.priority}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Button variant="secondary" onClick={onClose} data-testid="policy-test-cancel">
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleTest}
            disabled={isLoading || !selectedUserId || !action}
            icon={<Play className="h-4 w-4" />}
            data-testid="policy-test-run"
          >
            {isLoading ? "Testing..." : "Test Policy"}
          </Button>
        </div>
      </div>
    </div>
  )
}
