/**
 * FunctionalRole - Additive roles for organization members
 *
 * Users with the 'member' base role can be assigned functional roles
 * that grant specific capabilities:
 *
 * - 'controller': Period lock/unlock, consolidation run/approval, full financial oversight
 * - 'finance_manager': Period soft close, account management, exchange rates, elimination rules
 * - 'accountant': Create/edit/post journal entries, reconciliation
 * - 'period_admin': Open/close periods, create adjustment periods
 * - 'consolidation_manager': Manage consolidation groups, elimination rules
 *
 * @module authorization/FunctionalRole
 */

import * as Schema from "effect/Schema"

/**
 * FunctionalRole - Additive role that grants specific capabilities
 *
 * These roles are independent of the base role and can be combined.
 * A user can have multiple functional roles simultaneously.
 */
export const FunctionalRole = Schema.Literal(
  "controller",
  "finance_manager",
  "accountant",
  "period_admin",
  "consolidation_manager"
).annotations({
  identifier: "FunctionalRole",
  title: "Functional Role",
  description:
    "A functional role that grants specific capabilities within an organization"
})

/**
 * The FunctionalRole type
 */
export type FunctionalRole = typeof FunctionalRole.Type

/**
 * Type guard for FunctionalRole using Schema.is
 */
export const isFunctionalRole = Schema.is(FunctionalRole)

/**
 * All valid FunctionalRole values
 */
export const FunctionalRoleValues: readonly FunctionalRole[] = [
  "controller",
  "finance_manager",
  "accountant",
  "period_admin",
  "consolidation_manager"
] as const

/**
 * Schema for an array of FunctionalRoles
 */
export const FunctionalRoles = Schema.Array(FunctionalRole).annotations({
  identifier: "FunctionalRoles",
  title: "Functional Roles",
  description: "An array of functional roles assigned to a user"
})

/**
 * The FunctionalRoles type (array of functional roles)
 */
export type FunctionalRoles = typeof FunctionalRoles.Type
