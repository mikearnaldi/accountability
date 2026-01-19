/**
 * BaseRole - Base role for organization membership
 *
 * Defines the hierarchical access levels within an organization:
 * - 'owner': Organization creator/owner with full access, can delete org and transfer ownership
 * - 'admin': Organization administrator with full data operations and member management
 * - 'member': Standard user with access based on functional roles assigned
 * - 'viewer': Read-only access to view data and reports only
 *
 * @module authorization/BaseRole
 */

import * as Schema from "effect/Schema"

/**
 * BaseRole - The base role assigned to a user within an organization
 *
 * This determines the user's default permission set in that organization.
 * Functional roles can then be added to grant additional capabilities.
 */
export const BaseRole = Schema.Literal(
  "owner",
  "admin",
  "member",
  "viewer"
).annotations({
  identifier: "BaseRole",
  title: "Base Role",
  description:
    "The base role assigned to a user within an organization, determining their default permissions"
})

/**
 * The BaseRole type
 */
export type BaseRole = typeof BaseRole.Type

/**
 * Type guard for BaseRole using Schema.is
 */
export const isBaseRole = Schema.is(BaseRole)

/**
 * All valid BaseRole values
 */
export const BaseRoleValues: readonly BaseRole[] = [
  "owner",
  "admin",
  "member",
  "viewer"
] as const
