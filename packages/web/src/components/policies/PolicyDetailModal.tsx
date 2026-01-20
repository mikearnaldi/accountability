/**
 * PolicyDetailModal Component
 *
 * Read-only modal for viewing policy details.
 * Shows complete policy information including:
 * - Basic info (name, description, effect, priority, status)
 * - Subject conditions (roles, functional roles, user IDs)
 * - Resource conditions (type, attributes)
 * - Action list (full list, not just counts)
 * - Environment conditions (time, days, IP)
 *
 * Used for both system policies (always read-only) and custom policies
 * (with option to switch to edit mode).
 *
 * @module PolicyDetailModal
 */

import { X, Shield, ShieldCheck, ShieldX, Lock, CheckCircle, XCircle, Clock, Calendar, Globe, Pencil } from "lucide-react"
import { clsx } from "clsx"
import { Button } from "@/components/ui/Button"

// =============================================================================
// Types
// =============================================================================

type PolicyEffect = "allow" | "deny"
type BaseRole = "owner" | "admin" | "member" | "viewer"
type SubjectConditionRole = BaseRole | "*"
type FunctionalRole = "controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager"
type ResourceType = "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*"

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
  readonly accountType?: readonly ("Asset" | "Liability" | "Equity" | "Revenue" | "Expense")[]
  readonly isIntercompany?: boolean
  readonly entryType?: readonly ("Standard" | "Adjusting" | "Closing" | "Reversing" | "Elimination" | "Consolidation" | "Intercompany")[]
  readonly isOwnEntry?: boolean
  readonly periodStatus?: readonly ("Open" | "SoftClose" | "Closed" | "Locked")[]
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
  readonly createdAt: { readonly epochMillis: number }
  readonly updatedAt: { readonly epochMillis: number }
  readonly createdBy: string | null
}

interface PolicyDetailModalProps {
  readonly policy: Policy
  readonly onClose: () => void
  readonly onEdit?: () => void
  readonly canEdit?: boolean
}

// =============================================================================
// Constants
// =============================================================================

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  organization: "Organization",
  company: "Company",
  account: "Account",
  journal_entry: "Journal Entry",
  fiscal_period: "Fiscal Period",
  consolidation_group: "Consolidation Group",
  report: "Report",
  "*": "All Resources"
}

const ROLE_LABELS: Record<BaseRole | "*", string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  "*": "All Roles"
}

const FUNCTIONAL_ROLE_LABELS: Record<FunctionalRole, string> = {
  controller: "Controller",
  finance_manager: "Finance Manager",
  accountant: "Accountant",
  period_admin: "Period Admin",
  consolidation_manager: "Consolidation Manager"
}

const ACTION_LABELS: Record<string, string> = {
  "organization:manage_settings": "Organization: Manage Settings",
  "organization:manage_members": "Organization: Manage Members",
  "organization:delete": "Organization: Delete",
  "organization:transfer_ownership": "Organization: Transfer Ownership",
  "company:create": "Company: Create",
  "company:read": "Company: Read",
  "company:update": "Company: Update",
  "company:delete": "Company: Delete",
  "account:create": "Account: Create",
  "account:read": "Account: Read",
  "account:update": "Account: Update",
  "account:deactivate": "Account: Deactivate",
  "journal_entry:create": "Journal Entry: Create",
  "journal_entry:read": "Journal Entry: Read",
  "journal_entry:update": "Journal Entry: Update",
  "journal_entry:post": "Journal Entry: Post",
  "journal_entry:reverse": "Journal Entry: Reverse",
  "fiscal_period:read": "Fiscal Period: Read",
  "fiscal_period:manage": "Fiscal Period: Manage",
  "consolidation_group:create": "Consolidation: Create Group",
  "consolidation_group:read": "Consolidation: Read Group",
  "consolidation_group:update": "Consolidation: Update Group",
  "consolidation_group:delete": "Consolidation: Delete Group",
  "consolidation_group:run": "Consolidation: Run",
  "elimination:create": "Elimination: Create",
  "report:read": "Report: View",
  "report:export": "Report: Export",
  "exchange_rate:read": "Exchange Rate: View",
  "exchange_rate:manage": "Exchange Rate: Manage",
  "audit_log:read": "Audit Log: View",
  "*": "All Actions"
}

const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday"
}

// =============================================================================
// Component
// =============================================================================

export function PolicyDetailModal({
  policy,
  onClose,
  onEdit,
  canEdit = false
}: PolicyDetailModalProps) {
  const formatDate = (timestamp: { readonly epochMillis: number }) => {
    return new Date(timestamp.epochMillis).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        data-testid="policy-detail-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "rounded-lg p-2",
              policy.effect === "allow" ? "bg-green-100" : "bg-red-100"
            )}>
              {policy.effect === "allow" ? (
                <ShieldCheck className="h-5 w-5 text-green-600" />
              ) : (
                <ShieldX className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {policy.name}
                </h2>
                {policy.isSystemPolicy && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    <Lock className="h-3 w-3" />
                    System
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Policy Details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            data-testid="policy-detail-close"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <DetailSection title="Basic Information" icon={<Shield className="h-4 w-4" />}>
            {policy.description && (
              <DetailRow label="Description">
                <p className="text-gray-700">{policy.description}</p>
              </DetailRow>
            )}
            <DetailRow label="Effect">
              <span
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  policy.effect === "allow"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                )}
              >
                {policy.effect === "allow" ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {policy.effect.charAt(0).toUpperCase() + policy.effect.slice(1)}
              </span>
            </DetailRow>
            <DetailRow label="Priority">
              <span className="font-mono text-gray-700">{policy.priority}</span>
              <span className="text-xs text-gray-500 ml-2">
                (Higher = evaluated first)
              </span>
            </DetailRow>
            <DetailRow label="Status">
              <span
                className={clsx(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  policy.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {policy.isActive ? "Active" : "Disabled"}
              </span>
            </DetailRow>
          </DetailSection>

          {/* Subject Conditions (Who) */}
          <DetailSection title="Who (Subject Conditions)" icon={<Shield className="h-4 w-4" />}>
            {policy.subject.isPlatformAdmin && (
              <DetailRow label="Platform Admin">
                <span className="text-gray-700">Yes (Platform administrators only)</span>
              </DetailRow>
            )}
            {policy.subject.roles && policy.subject.roles.length > 0 && (
              <DetailRow label="Base Roles">
                <div className="flex flex-wrap gap-1">
                  {policy.subject.roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                    >
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              </DetailRow>
            )}
            {policy.subject.functionalRoles && policy.subject.functionalRoles.length > 0 && (
              <DetailRow label="Functional Roles">
                <div className="flex flex-wrap gap-1">
                  {policy.subject.functionalRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
                    >
                      {FUNCTIONAL_ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              </DetailRow>
            )}
            {policy.subject.userIds && policy.subject.userIds.length > 0 && (
              <DetailRow label="Specific Users">
                <span className="text-gray-700">{policy.subject.userIds.length} user(s)</span>
              </DetailRow>
            )}
            {!policy.subject.isPlatformAdmin &&
              (!policy.subject.roles || policy.subject.roles.length === 0) &&
              (!policy.subject.functionalRoles || policy.subject.functionalRoles.length === 0) &&
              (!policy.subject.userIds || policy.subject.userIds.length === 0) && (
              <DetailRow label="">
                <span className="text-gray-500 italic">No subject conditions (applies to all users)</span>
              </DetailRow>
            )}
          </DetailSection>

          {/* Resource Conditions (What) */}
          <DetailSection title="What (Resource Conditions)" icon={<Shield className="h-4 w-4" />}>
            <DetailRow label="Resource Type">
              <span className="text-gray-700">{RESOURCE_TYPE_LABELS[policy.resource.type]}</span>
            </DetailRow>
            {policy.resource.attributes && Object.keys(policy.resource.attributes).length > 0 && (
              <DetailRow label="Attributes">
                <div className="space-y-1">
                  {policy.resource.attributes.accountType && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Account Type:</span>{" "}
                      {policy.resource.attributes.accountType.join(", ")}
                    </div>
                  )}
                  {policy.resource.attributes.entryType && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Entry Type:</span>{" "}
                      {policy.resource.attributes.entryType.join(", ")}
                    </div>
                  )}
                  {policy.resource.attributes.periodStatus && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Period Status:</span>{" "}
                      {policy.resource.attributes.periodStatus.join(", ")}
                    </div>
                  )}
                  {policy.resource.attributes.isIntercompany !== undefined && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Intercompany:</span>{" "}
                      {policy.resource.attributes.isIntercompany ? "Yes" : "No"}
                    </div>
                  )}
                  {policy.resource.attributes.isOwnEntry !== undefined && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Own Entry Only:</span>{" "}
                      {policy.resource.attributes.isOwnEntry ? "Yes" : "No"}
                    </div>
                  )}
                  {policy.resource.attributes.isAdjustmentPeriod !== undefined && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Adjustment Period:</span>{" "}
                      {policy.resource.attributes.isAdjustmentPeriod ? "Yes" : "No"}
                    </div>
                  )}
                  {policy.resource.attributes.accountNumber?.range && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Account Number Range:</span>{" "}
                      {policy.resource.attributes.accountNumber.range[0]} - {policy.resource.attributes.accountNumber.range[1]}
                    </div>
                  )}
                  {policy.resource.attributes.accountNumber?.in && (
                    <div className="text-sm text-gray-700">
                      <span className="text-gray-500">Account Numbers:</span>{" "}
                      {policy.resource.attributes.accountNumber.in.join(", ")}
                    </div>
                  )}
                </div>
              </DetailRow>
            )}
          </DetailSection>

          {/* Actions (Can) */}
          <DetailSection title="Can (Actions)" icon={<Shield className="h-4 w-4" />}>
            <DetailRow label="">
              {policy.action.actions.includes("*") ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  All Actions (*)
                </span>
              ) : (
                <div className="space-y-1">
                  {policy.action.actions.map((action) => (
                    <div
                      key={action}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{ACTION_LABELS[action] ?? action}</span>
                      <span className="text-xs text-gray-400 font-mono">{action}</span>
                    </div>
                  ))}
                </div>
              )}
            </DetailRow>
          </DetailSection>

          {/* Environment Conditions (When & Where) */}
          {policy.environment && (
            <DetailSection title="When & Where (Environment)" icon={<Globe className="h-4 w-4" />}>
              {policy.environment.timeOfDay && (
                <DetailRow label="Time of Day">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {policy.environment.timeOfDay.start} - {policy.environment.timeOfDay.end}
                  </div>
                </DetailRow>
              )}
              {policy.environment.daysOfWeek && policy.environment.daysOfWeek.length > 0 && (
                <DetailRow label="Days of Week">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div className="flex flex-wrap gap-1">
                      {policy.environment.daysOfWeek.map((day) => (
                        <span
                          key={day}
                          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                        >
                          {DAY_LABELS[day] ?? day}
                        </span>
                      ))}
                    </div>
                  </div>
                </DetailRow>
              )}
              {policy.environment.ipAllowList && policy.environment.ipAllowList.length > 0 && (
                <DetailRow label="IP Allow List">
                  <div className="space-y-1">
                    {policy.environment.ipAllowList.map((ip) => (
                      <div key={ip} className="text-sm font-mono text-gray-700">{ip}</div>
                    ))}
                  </div>
                </DetailRow>
              )}
              {policy.environment.ipDenyList && policy.environment.ipDenyList.length > 0 && (
                <DetailRow label="IP Deny List">
                  <div className="space-y-1">
                    {policy.environment.ipDenyList.map((ip) => (
                      <div key={ip} className="text-sm font-mono text-red-600">{ip}</div>
                    ))}
                  </div>
                </DetailRow>
              )}
            </DetailSection>
          )}

          {/* Metadata */}
          <DetailSection title="Metadata" icon={<Shield className="h-4 w-4" />}>
            <DetailRow label="Created">
              <span className="text-sm text-gray-600">{formatDate(policy.createdAt)}</span>
            </DetailRow>
            <DetailRow label="Last Updated">
              <span className="text-sm text-gray-600">{formatDate(policy.updatedAt)}</span>
            </DetailRow>
            <DetailRow label="Policy ID">
              <span className="text-xs font-mono text-gray-500">{policy.id}</span>
            </DetailRow>
          </DetailSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          {policy.isSystemPolicy && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              System policies cannot be edited
            </p>
          )}
          {!policy.isSystemPolicy && <div />}

          <div className="flex items-center gap-3">
            {canEdit && !policy.isSystemPolicy && onEdit && (
              <Button
                variant="secondary"
                onClick={onEdit}
                icon={<Pencil className="h-4 w-4" />}
                data-testid="policy-detail-edit"
              >
                Edit Policy
              </Button>
            )}
            <Button
              variant="primary"
              onClick={onClose}
              data-testid="policy-detail-close-button"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

interface DetailSectionProps {
  readonly title: string
  readonly icon: React.ReactNode
  readonly children: React.ReactNode
}

function DetailSection({ title, icon, children }: DetailSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        {title}
      </h3>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        {children}
      </div>
    </section>
  )
}

interface DetailRowProps {
  readonly label: string
  readonly children: React.ReactNode
}

function DetailRow({ label, children }: DetailRowProps) {
  if (!label) {
    return <div>{children}</div>
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
      <span className="text-sm font-medium text-gray-500 sm:w-32 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
