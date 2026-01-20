/**
 * Action - Authorization action types
 *
 * Defines all the actions that can be performed in the system,
 * used for permission checking and ABAC policy evaluation.
 *
 * @module authorization/Action
 */

import * as Schema from "effect/Schema"

/**
 * Action - An authorization action that can be performed
 *
 * Actions follow the pattern "{resource}:{verb}" where:
 * - resource: The type of entity being acted upon
 * - verb: The operation being performed (create, read, update, delete, etc.)
 *
 * The wildcard "*" matches any action.
 */
export const Action = Schema.Literal(
  // Organization actions
  "organization:manage_settings",
  "organization:manage_members",
  "organization:delete",
  "organization:transfer_ownership",

  // Company actions
  "company:create",
  "company:read",
  "company:update",
  "company:delete",

  // Account actions
  "account:create",
  "account:read",
  "account:update",
  "account:deactivate",

  // Journal entry actions
  "journal_entry:create",
  "journal_entry:read",
  "journal_entry:update",
  "journal_entry:post",
  "journal_entry:reverse",

  // Fiscal period actions
  "fiscal_period:read",
  "fiscal_period:manage",

  // Consolidation actions
  "consolidation_group:create",
  "consolidation_group:read",
  "consolidation_group:update",
  "consolidation_group:delete",
  "consolidation_group:run",
  "elimination:create",

  // Report actions
  "report:read",
  "report:export",

  // Exchange rate actions
  "exchange_rate:read",
  "exchange_rate:manage",

  // Audit log actions
  "audit_log:read",

  // Wildcard (matches any action)
  "*"
).annotations({
  identifier: "Action",
  title: "Authorization Action",
  description: "An authorization action that can be performed in the system"
})

/**
 * The Action type
 */
export type Action = typeof Action.Type

/**
 * Type guard for Action using Schema.is
 */
export const isAction = Schema.is(Action)

/**
 * All valid Action values (excluding wildcard)
 */
export const ActionValues: readonly Action[] = [
  // Organization actions
  "organization:manage_settings",
  "organization:manage_members",
  "organization:delete",
  "organization:transfer_ownership",

  // Company actions
  "company:create",
  "company:read",
  "company:update",
  "company:delete",

  // Account actions
  "account:create",
  "account:read",
  "account:update",
  "account:deactivate",

  // Journal entry actions
  "journal_entry:create",
  "journal_entry:read",
  "journal_entry:update",
  "journal_entry:post",
  "journal_entry:reverse",

  // Fiscal period actions
  "fiscal_period:read",
  "fiscal_period:manage",

  // Consolidation actions
  "consolidation_group:create",
  "consolidation_group:read",
  "consolidation_group:update",
  "consolidation_group:delete",
  "consolidation_group:run",
  "elimination:create",

  // Report actions
  "report:read",
  "report:export",

  // Exchange rate actions
  "exchange_rate:read",
  "exchange_rate:manage",

  // Audit log actions
  "audit_log:read",

  // Wildcard
  "*"
] as const

/**
 * Resource types derived from action prefixes
 */
export const ResourceType = Schema.Literal(
  "organization",
  "company",
  "account",
  "journal_entry",
  "fiscal_period",
  "consolidation_group",
  "elimination",
  "report",
  "exchange_rate",
  "audit_log",
  "*"
).annotations({
  identifier: "ResourceType",
  title: "Resource Type",
  description: "The type of resource being accessed"
})

/**
 * The ResourceType type
 */
export type ResourceType = typeof ResourceType.Type

/**
 * Type guard for ResourceType using Schema.is
 */
export const isResourceType = Schema.is(ResourceType)
