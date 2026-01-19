/**
 * PolicyConditions - ABAC policy condition schemas
 *
 * Defines the condition schemas used in ABAC (Attribute-Based Access Control) policies.
 * These conditions determine when a policy applies based on:
 * - Subject: Who is making the request (roles, users)
 * - Resource: What resource is being accessed (type, attributes)
 * - Action: What action is being performed
 * - Environment: Contextual conditions (time, IP)
 *
 * @module authorization/PolicyConditions
 */

import * as Schema from "effect/Schema"
import { BaseRole } from "./BaseRole.ts"
import { FunctionalRole } from "./FunctionalRole.ts"
import { Action } from "./Action.ts"
import { AuthUserId } from "../authentication/AuthUserId.ts"

// =============================================================================
// Subject Conditions
// =============================================================================

/**
 * SubjectCondition - Defines who a policy applies to
 *
 * All fields are optional and combined with AND logic:
 * - If roles is specified, the user must have one of the specified roles
 * - If functionalRoles is specified, the user must have one of the specified functional roles
 * - If userIds is specified, the user must be in the list
 * - If isPlatformAdmin is specified, the user must match that platform admin status
 */
export const SubjectCondition = Schema.Struct({
  /**
   * Match users with any of these base roles
   */
  roles: Schema.optional(Schema.Array(BaseRole)).annotations({
    title: "Roles",
    description: "Match users with any of these base roles"
  }),

  /**
   * Match users with any of these functional roles
   */
  functionalRoles: Schema.optional(Schema.Array(FunctionalRole)).annotations({
    title: "Functional Roles",
    description: "Match users with any of these functional roles"
  }),

  /**
   * Match specific users by ID
   */
  userIds: Schema.optional(Schema.Array(AuthUserId)).annotations({
    title: "User IDs",
    description: "Match specific users by their ID"
  }),

  /**
   * Match by platform admin status
   */
  isPlatformAdmin: Schema.optional(Schema.Boolean).annotations({
    title: "Is Platform Admin",
    description: "Match users by their platform admin status"
  })
}).annotations({
  identifier: "SubjectCondition",
  title: "Subject Condition",
  description: "Conditions that determine which users a policy applies to"
})

/**
 * The SubjectCondition type
 */
export type SubjectCondition = typeof SubjectCondition.Type

/**
 * Type guard for SubjectCondition using Schema.is
 */
export const isSubjectCondition = Schema.is(SubjectCondition)

// =============================================================================
// Resource Conditions
// =============================================================================

/**
 * AccountNumberCondition - Conditions based on account number
 */
export const AccountNumberCondition = Schema.Struct({
  /**
   * Account number must be within this range [min, max]
   */
  range: Schema.optional(
    Schema.Tuple(Schema.Number, Schema.Number)
  ).annotations({
    title: "Range",
    description: "Account number range [min, max]"
  }),

  /**
   * Account number must be one of these specific values
   */
  in: Schema.optional(Schema.Array(Schema.Number)).annotations({
    title: "In",
    description: "Specific account numbers to match"
  })
}).annotations({
  identifier: "AccountNumberCondition",
  title: "Account Number Condition",
  description: "Conditions based on account number"
})

/**
 * Account types for resource conditions
 */
export const AccountTypeCondition = Schema.Literal(
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense"
)

/**
 * Journal entry types for resource conditions
 */
export const JournalEntryTypeCondition = Schema.Literal(
  "Standard",
  "Adjusting",
  "Closing",
  "Reversing",
  "Elimination",
  "Consolidation",
  "Intercompany"
)

/**
 * Period status for resource conditions
 * Matches the FiscalPeriodStatus domain type
 */
export const PeriodStatusCondition = Schema.Literal(
  "Future",
  "Open",
  "SoftClose",
  "Closed",
  "Locked"
)

/**
 * ResourceAttributes - Additional attributes for resource matching
 */
export const ResourceAttributes = Schema.Struct({
  /**
   * Account number conditions
   */
  accountNumber: Schema.optional(AccountNumberCondition).annotations({
    title: "Account Number",
    description: "Conditions based on account number"
  }),

  /**
   * Match accounts of these types
   */
  accountType: Schema.optional(Schema.Array(AccountTypeCondition)).annotations({
    title: "Account Type",
    description: "Match accounts of these types"
  }),

  /**
   * Match intercompany-related resources
   */
  isIntercompany: Schema.optional(Schema.Boolean).annotations({
    title: "Is Intercompany",
    description: "Match intercompany-related resources"
  }),

  /**
   * Match journal entries of these types
   */
  entryType: Schema.optional(
    Schema.Array(JournalEntryTypeCondition)
  ).annotations({
    title: "Entry Type",
    description: "Match journal entries of these types"
  }),

  /**
   * Match journal entries created by the requesting user
   */
  isOwnEntry: Schema.optional(Schema.Boolean).annotations({
    title: "Is Own Entry",
    description: "Match journal entries created by the requesting user"
  }),

  /**
   * Match fiscal periods with these statuses
   */
  periodStatus: Schema.optional(Schema.Array(PeriodStatusCondition)).annotations(
    {
      title: "Period Status",
      description: "Match fiscal periods with these statuses"
    }
  ),

  /**
   * Match adjustment periods
   */
  isAdjustmentPeriod: Schema.optional(Schema.Boolean).annotations({
    title: "Is Adjustment Period",
    description: "Match adjustment periods"
  })
}).annotations({
  identifier: "ResourceAttributes",
  title: "Resource Attributes",
  description: "Attribute conditions for resource matching"
})

/**
 * The ResourceAttributes type
 */
export type ResourceAttributes = typeof ResourceAttributes.Type

/**
 * ResourceType for policy conditions
 */
export const PolicyResourceType = Schema.Literal(
  "organization",
  "company",
  "account",
  "journal_entry",
  "fiscal_period",
  "consolidation_group",
  "report",
  "*"
).annotations({
  identifier: "PolicyResourceType",
  title: "Policy Resource Type",
  description: "The type of resource in a policy condition"
})

/**
 * ResourceCondition - Defines what resources a policy applies to
 */
export const ResourceCondition = Schema.Struct({
  /**
   * The type of resource (use "*" to match all resource types)
   */
  type: PolicyResourceType.annotations({
    title: "Resource Type",
    description: "The type of resource this policy applies to"
  }),

  /**
   * Additional attribute conditions for finer-grained matching
   */
  attributes: Schema.optional(ResourceAttributes).annotations({
    title: "Attributes",
    description: "Additional attribute conditions for resource matching"
  })
}).annotations({
  identifier: "ResourceCondition",
  title: "Resource Condition",
  description: "Conditions that determine which resources a policy applies to"
})

/**
 * The ResourceCondition type
 */
export type ResourceCondition = typeof ResourceCondition.Type

/**
 * Type guard for ResourceCondition using Schema.is
 */
export const isResourceCondition = Schema.is(ResourceCondition)

// =============================================================================
// Action Conditions
// =============================================================================

/**
 * ActionCondition - Defines what actions a policy applies to
 *
 * The actions array supports:
 * - Exact match: "journal_entry:create" matches "journal_entry:create"
 * - Wildcard: "*" matches any action
 * - Prefix wildcard: "journal_entry:*" matches all journal_entry actions
 */
export const ActionCondition = Schema.Struct({
  /**
   * Actions this policy applies to
   */
  actions: Schema.Array(Action).annotations({
    title: "Actions",
    description: "The actions this policy applies to"
  })
}).annotations({
  identifier: "ActionCondition",
  title: "Action Condition",
  description: "Conditions that determine which actions a policy applies to"
})

/**
 * The ActionCondition type
 */
export type ActionCondition = typeof ActionCondition.Type

/**
 * Type guard for ActionCondition using Schema.is
 */
export const isActionCondition = Schema.is(ActionCondition)

// =============================================================================
// Environment Conditions
// =============================================================================

/**
 * TimeRange - A time of day range
 */
export const TimeRange = Schema.Struct({
  /**
   * Start time (HH:MM format, 24-hour)
   */
  start: Schema.String.pipe(Schema.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)).annotations({
    title: "Start Time",
    description: "Start time in HH:MM format (24-hour)"
  }),

  /**
   * End time (HH:MM format, 24-hour)
   */
  end: Schema.String.pipe(Schema.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)).annotations({
    title: "End Time",
    description: "End time in HH:MM format (24-hour)"
  })
}).annotations({
  identifier: "TimeRange",
  title: "Time Range",
  description: "A time of day range in HH:MM format"
})

/**
 * EnvironmentCondition - Contextual conditions for policy evaluation
 *
 * All fields are optional and combined with AND logic.
 */
export const EnvironmentCondition = Schema.Struct({
  /**
   * Time of day restriction
   */
  timeOfDay: Schema.optional(TimeRange).annotations({
    title: "Time of Day",
    description: "Restrict to certain hours of the day"
  }),

  /**
   * Days of week restriction (0=Sunday, 6=Saturday)
   */
  daysOfWeek: Schema.optional(
    Schema.Array(Schema.Number.pipe(Schema.int(), Schema.between(0, 6)))
  ).annotations({
    title: "Days of Week",
    description: "Restrict to certain days (0=Sunday, 6=Saturday)"
  }),

  /**
   * IP addresses or CIDR ranges to allow
   */
  ipAllowList: Schema.optional(Schema.Array(Schema.String)).annotations({
    title: "IP Allow List",
    description: "IP addresses or CIDR ranges to allow"
  }),

  /**
   * IP addresses or CIDR ranges to deny
   */
  ipDenyList: Schema.optional(Schema.Array(Schema.String)).annotations({
    title: "IP Deny List",
    description: "IP addresses or CIDR ranges to deny"
  })
}).annotations({
  identifier: "EnvironmentCondition",
  title: "Environment Condition",
  description: "Contextual conditions based on request environment"
})

/**
 * The EnvironmentCondition type
 */
export type EnvironmentCondition = typeof EnvironmentCondition.Type

/**
 * Type guard for EnvironmentCondition using Schema.is
 */
export const isEnvironmentCondition = Schema.is(EnvironmentCondition)
