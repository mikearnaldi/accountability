/**
 * AuthServiceConfig - Configuration for AuthService
 *
 * Provides configuration options for the AuthService including:
 * - Registered authentication providers
 * - Session duration settings per provider
 * - Email linking behavior
 *
 * @module AuthServiceConfig
 */

import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type { Chunk } from "effect"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"
import type { AuthProviderType } from "@accountability/core/authentication/AuthProviderType"

/**
 * Default session durations in milliseconds
 */
export const DEFAULT_SESSION_DURATIONS = {
  local: 7 * 24 * 60 * 60 * 1000, // 7 days
  google: 24 * 60 * 60 * 1000, // 24 hours
  github: 24 * 60 * 60 * 1000, // 24 hours
  workos: 8 * 60 * 60 * 1000, // 8 hours (enterprise)
  saml: 8 * 60 * 60 * 1000 // 8 hours (enterprise)
} as const

/**
 * SessionDurationConfig - Session duration settings per provider
 *
 * Maps provider types to session duration in milliseconds.
 */
export class SessionDurationConfig extends Schema.Class<SessionDurationConfig>("SessionDurationConfig")({
  /**
   * Session duration for local provider in milliseconds
   */
  local: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.propertySignature,
    Schema.withConstructorDefault(() => DEFAULT_SESSION_DURATIONS.local)
  ),

  /**
   * Session duration for Google OAuth in milliseconds
   */
  google: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.propertySignature,
    Schema.withConstructorDefault(() => DEFAULT_SESSION_DURATIONS.google)
  ),

  /**
   * Session duration for GitHub OAuth in milliseconds
   */
  github: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.propertySignature,
    Schema.withConstructorDefault(() => DEFAULT_SESSION_DURATIONS.github)
  ),

  /**
   * Session duration for WorkOS SSO in milliseconds
   */
  workos: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.propertySignature,
    Schema.withConstructorDefault(() => DEFAULT_SESSION_DURATIONS.workos)
  ),

  /**
   * Session duration for SAML SSO in milliseconds
   */
  saml: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.propertySignature,
    Schema.withConstructorDefault(() => DEFAULT_SESSION_DURATIONS.saml)
  )
}) {
  /**
   * Get session duration for a specific provider
   */
  getForProvider(provider: AuthProviderType): number {
    return this[provider]
  }

  /**
   * Default configuration with standard durations
   */
  static readonly Default = SessionDurationConfig.make({})
}

/**
 * AuthServiceConfigShape - Configuration options for AuthService
 */
export interface AuthServiceConfigShape {
  /**
   * Registered authentication providers
   *
   * The providers that are available for authentication.
   * Each provider must implement the AuthProvider interface.
   */
  readonly providers: Chunk.Chunk<AuthProvider>

  /**
   * Session duration configuration per provider
   */
  readonly sessionDurations: SessionDurationConfig

  /**
   * Auto-provision users for external providers
   *
   * When true, users authenticating through external providers (OAuth, SAML)
   * will automatically have accounts created if they don't exist.
   *
   * Default: true
   */
  readonly autoProvisionUsers: boolean

  /**
   * Link identities by email
   *
   * When true, if a user authenticates via an external provider and their
   * email matches an existing user, the identity will be linked to the
   * existing user instead of creating a new account.
   *
   * This is useful for allowing users to add multiple login methods.
   * Be aware of security implications - email verification should be trusted
   * from the provider.
   *
   * Default: true
   */
  readonly linkIdentitiesByEmail: boolean
}

/**
 * AuthServiceConfig - Context.Tag for AuthService configuration
 *
 * Usage:
 * ```typescript
 * const config: AuthServiceConfigShape = {
 *   providers: Chunk.make(localProvider, googleProvider),
 *   sessionDurations: SessionDurationConfig.Default,
 *   autoProvisionUsers: true,
 *   linkIdentitiesByEmail: true
 * }
 *
 * const ConfigLayer = Layer.succeed(AuthServiceConfig, config)
 * ```
 */
export class AuthServiceConfig extends Context.Tag("AuthServiceConfig")<
  AuthServiceConfig,
  AuthServiceConfigShape
>() {
  /**
   * Create a layer with default configuration
   *
   * Uses default session durations, auto-provisioning enabled,
   * and email linking enabled.
   *
   * @param providers - The authentication providers to register
   */
  static layer(providers: Chunk.Chunk<AuthProvider>): Layer.Layer<AuthServiceConfig> {
    return Layer.succeed(AuthServiceConfig, {
      providers,
      sessionDurations: SessionDurationConfig.Default,
      autoProvisionUsers: true,
      linkIdentitiesByEmail: true
    })
  }
}
