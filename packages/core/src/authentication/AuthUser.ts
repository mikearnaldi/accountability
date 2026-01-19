/**
 * AuthUser - Core user entity for authentication
 *
 * Represents an authenticated user in the system. A single AuthUser can have
 * multiple UserIdentity records linking them to different auth providers.
 *
 * @module AuthUser
 */

import * as Schema from "effect/Schema"
import { AuthUserId } from "./AuthUserId.ts"
import { AuthProviderType } from "./AuthProviderType.ts"
import { Email } from "./Email.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * UserRole - The role assigned to a user
 *
 * Defines access levels within the application:
 * - 'admin': Full system access
 * - 'owner': Organization owner with full org access
 * - 'member': Standard user access
 * - 'viewer': Read-only access
 */
export const UserRole = Schema.Literal(
  "admin",
  "owner",
  "member",
  "viewer"
).annotations({
  identifier: "UserRole",
  title: "User Role",
  description: "The role assigned to a user determining their access level"
})

/**
 * The UserRole type
 */
export type UserRole = typeof UserRole.Type

/**
 * Type guard for UserRole using Schema.is
 */
export const isUserRole = Schema.is(UserRole)

/**
 * AuthUser - The main user entity for authentication
 *
 * Contains core user information and tracks which auth provider was
 * used for the primary/initial registration. Users can link additional
 * providers via UserIdentity records.
 */
export class AuthUser extends Schema.Class<AuthUser>("AuthUser")({
  /**
   * Unique identifier for the user
   */
  id: AuthUserId,

  /**
   * User's email address (used for identification and communication)
   */
  email: Email,

  /**
   * User's display name
   */
  displayName: Schema.NonEmptyTrimmedString.annotations({
    title: "Display Name",
    description: "The user's display name"
  }),

  /**
   * User's role determining access level
   */
  role: UserRole,

  /**
   * The primary auth provider used for initial registration
   */
  primaryProvider: AuthProviderType,

  /**
   * When the user account was created
   */
  createdAt: Timestamp,

  /**
   * When the user account was last updated
   */
  updatedAt: Timestamp
}) {}

/**
 * Type guard for AuthUser using Schema.is
 */
export const isAuthUser = Schema.is(AuthUser)
