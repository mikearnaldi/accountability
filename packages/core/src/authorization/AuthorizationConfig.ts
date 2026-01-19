/**
 * AuthorizationConfig - Configuration for authorization behavior
 *
 * Controls authorization enforcement mode and grace period settings
 * during migration to the new membership-based authorization system.
 *
 * Configuration is loaded from environment variables:
 * - AUTHORIZATION_ENFORCEMENT: "true" to enforce, "false" for grace period (default: true)
 *
 * @module authorization/AuthorizationConfig
 */

import * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

// =============================================================================
// Configuration Data Interface
// =============================================================================

/**
 * AuthorizationConfigData - Authorization configuration settings
 */
export interface AuthorizationConfigData {
  /**
   * Whether to strictly enforce membership checks.
   *
   * - When `true`: Users must be active members of an organization to access it
   * - When `false`: Skip membership checks during grace period (all authenticated users can access)
   *
   * Use `false` during migration to allow existing users continued access
   * while membership records are being populated.
   */
  readonly enforcementEnabled: boolean
}

// =============================================================================
// Context Tag
// =============================================================================

/**
 * AuthorizationConfig - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { AuthorizationConfig } from "@accountability/core/authorization/AuthorizationConfig"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* AuthorizationConfig
 *   if (config.enforcementEnabled) {
 *     // Check membership strictly
 *   } else {
 *     // Grace period: allow access
 *   }
 * })
 * ```
 */
export class AuthorizationConfig extends Context.Tag("AuthorizationConfig")<
  AuthorizationConfig,
  AuthorizationConfigData
>() {}

// =============================================================================
// Configuration Loading from Environment
// =============================================================================

/**
 * Default configuration values
 */
export const authorizationConfigDefaults: AuthorizationConfigData = {
  enforcementEnabled: true
}

/**
 * Full AuthorizationConfig from environment variables
 */
export const authorizationConfig: Config.Config<AuthorizationConfigData> = Config.all({
  enforcementEnabled: Config.boolean("AUTHORIZATION_ENFORCEMENT").pipe(
    Config.withDefault(authorizationConfigDefaults.enforcementEnabled)
  )
})

/**
 * AuthorizationConfig loaded from environment
 */
export const authorizationConfigFromEnv: Effect.Effect<AuthorizationConfigData, ConfigError> =
  Effect.gen(function* () {
    return yield* authorizationConfig
  })

// =============================================================================
// Layer
// =============================================================================

/**
 * AuthorizationConfigLive - Layer providing AuthorizationConfig from environment variables
 *
 * Reads configuration from:
 * - AUTHORIZATION_ENFORCEMENT: "true" or "false" (default: "true")
 *
 * Set AUTHORIZATION_ENFORCEMENT=false during migration grace period to allow
 * all authenticated users access while membership records are populated.
 *
 * Note: This layer uses defaults when env var is not set, so it never fails
 * in practice. ConfigError is typed out for callers' convenience.
 */
export const AuthorizationConfigLive: Layer.Layer<AuthorizationConfig> = Layer.effect(
  AuthorizationConfig,
  Effect.catchAll(authorizationConfigFromEnv, () =>
    Effect.succeed(authorizationConfigDefaults)
  )
)

// =============================================================================
// Helper Layers
// =============================================================================

/**
 * Create an AuthorizationConfig layer with specific settings
 *
 * Useful for tests or specific configurations.
 */
export const makeAuthorizationConfigLayer = (
  config: AuthorizationConfigData
): Layer.Layer<AuthorizationConfig> => Layer.succeed(AuthorizationConfig, config)

/**
 * AuthorizationConfigEnforced - Layer with enforcement enabled
 *
 * Use this in production after the migration grace period.
 */
export const AuthorizationConfigEnforced: Layer.Layer<AuthorizationConfig> =
  makeAuthorizationConfigLayer({ enforcementEnabled: true })

/**
 * AuthorizationConfigGracePeriod - Layer with enforcement disabled
 *
 * Use this during migration while membership records are being populated.
 */
export const AuthorizationConfigGracePeriod: Layer.Layer<AuthorizationConfig> =
  makeAuthorizationConfigLayer({ enforcementEnabled: false })
