/**
 * UserIdentity - Links a user to an external auth provider
 *
 * Represents the connection between an AuthUser and an external authentication
 * provider. A single user can have multiple identities (e.g., local + Google).
 *
 * @module UserIdentity
 */

import * as Schema from "effect/Schema"
import { AuthUserId } from "./AuthUserId.ts"
import { AuthProviderType } from "./AuthProviderType.ts"
import { ProviderId } from "./ProviderId.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * UserIdentityId - Branded UUID string for identity record identification
 */
export const UserIdentityId = Schema.UUID.pipe(
  Schema.brand("UserIdentityId"),
  Schema.annotations({
    identifier: "UserIdentityId",
    title: "User Identity ID",
    description: "A unique identifier for a user identity record (UUID format)"
  })
)

/**
 * The branded UserIdentityId type
 */
export type UserIdentityId = typeof UserIdentityId.Type

/**
 * Type guard for UserIdentityId using Schema.is
 */
export const isUserIdentityId = Schema.is(UserIdentityId)

/**
 * ProviderData - Optional JSON data from the auth provider
 *
 * Stores additional data returned by the provider that may be useful,
 * such as profile information, tokens, or provider-specific metadata.
 */
export const ProviderData = Schema.Struct({
  /**
   * Raw profile data from the provider
   */
  profile: Schema.optional(Schema.Unknown),

  /**
   * Additional metadata as key-value pairs
   */
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}).annotations({
  identifier: "ProviderData",
  title: "Provider Data",
  description: "Optional JSON data from the authentication provider"
})

/**
 * The ProviderData type
 */
export type ProviderData = typeof ProviderData.Type

/**
 * UserIdentity - Links a user to an authentication provider
 *
 * Each record represents a unique provider connection for a user.
 * The combination of (provider, providerId) must be unique system-wide.
 */
export class UserIdentity extends Schema.Class<UserIdentity>("UserIdentity")({
  /**
   * Unique identifier for this identity record
   */
  id: UserIdentityId,

  /**
   * Reference to the AuthUser this identity belongs to
   */
  userId: AuthUserId,

  /**
   * The authentication provider type
   */
  provider: AuthProviderType,

  /**
   * The user's ID within the external provider
   */
  providerId: ProviderId,

  /**
   * Optional data from the provider (profile, tokens, metadata)
   */
  providerData: Schema.Option(ProviderData),

  /**
   * When this identity was linked
   */
  createdAt: Timestamp
}) {}

/**
 * Type guard for UserIdentity using Schema.is
 */
export const isUserIdentity = Schema.is(UserIdentity)
