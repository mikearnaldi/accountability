/**
 * AuthProviderType - Literal union schema for authentication providers
 *
 * Defines the supported authentication provider types. The schema is extensible
 * by adding new literal values to support additional providers.
 *
 * @module AuthProviderType
 */

import * as Schema from "effect/Schema"

/**
 * AuthProviderType - Supported authentication providers
 *
 * Current providers:
 * - 'local': Username/password authentication
 * - 'workos': WorkOS SSO integration
 * - 'google': Google OAuth
 * - 'github': GitHub OAuth
 * - 'saml': SAML-based enterprise SSO
 *
 * Additional providers can be added as needed.
 */
export const AuthProviderType = Schema.Literal(
  "local",
  "workos",
  "google",
  "github",
  "saml"
).annotations({
  identifier: "AuthProviderType",
  title: "Auth Provider Type",
  description: "The type of authentication provider used"
})

/**
 * The AuthProviderType type
 */
export type AuthProviderType = typeof AuthProviderType.Type

/**
 * Type guard for AuthProviderType using Schema.is
 */
export const isAuthProviderType = Schema.is(AuthProviderType)

/**
 * All supported auth provider types as an array
 */
export const AUTH_PROVIDER_TYPES: readonly AuthProviderType[] = [
  "local",
  "workos",
  "google",
  "github",
  "saml"
] as const
