/**
 * AuthConfig - Configuration system for authentication providers
 *
 * Provides runtime configuration for enabling/disabling auth providers,
 * per-provider settings, and global auth behavior options.
 *
 * Configuration is loaded from environment variables:
 * - AUTH_ENABLED_PROVIDERS: Comma-separated list of enabled providers
 * - AUTH_DEFAULT_ROLE: Default role for new users
 * - AUTH_SESSION_DURATION: Session duration (e.g., "24 hours")
 * - AUTH_AUTO_LINK_BY_EMAIL: Auto-link identities by email match
 * - AUTH_REQUIRE_EMAIL_VERIFICATION: For local provider
 *
 * @module AuthConfig
 */

import * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import type { DurationInput } from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { AuthProviderType } from "./AuthProviderType.ts"
import { isAuthProviderType } from "./AuthProviderType.ts"
import type { UserRole } from "./AuthUser.ts"
import { isUserRole } from "./AuthUser.ts"

// =============================================================================
// Provider-specific Configuration Schemas
// =============================================================================

/**
 * LocalAuthConfig - Configuration for local (email/password) authentication
 */
export class LocalAuthConfig extends Schema.Class<LocalAuthConfig>("LocalAuthConfig")({
  /**
   * Whether email verification is required for local registration
   */
  requireEmailVerification: Schema.Boolean.annotations({
    title: "Require Email Verification",
    description: "Whether new users must verify their email before login"
  }),

  /**
   * Minimum password length
   */
  minPasswordLength: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThan(0)
  ).annotations({
    title: "Minimum Password Length",
    description: "Minimum required password length"
  }),

  /**
   * Whether to require uppercase characters in passwords
   */
  requireUppercase: Schema.Boolean.annotations({
    title: "Require Uppercase",
    description: "Whether passwords must contain uppercase characters"
  }),

  /**
   * Whether to require numbers in passwords
   */
  requireNumbers: Schema.Boolean.annotations({
    title: "Require Numbers",
    description: "Whether passwords must contain numbers"
  }),

  /**
   * Whether to require special characters in passwords
   */
  requireSpecialChars: Schema.Boolean.annotations({
    title: "Require Special Characters",
    description: "Whether passwords must contain special characters"
  })
}) {}

/**
 * WorkOSAuthConfig - Configuration for WorkOS SSO provider
 */
export class WorkOSAuthConfig extends Schema.Class<WorkOSAuthConfig>("WorkOSAuthConfig")({
  /**
   * WorkOS API key (starts with sk_)
   */
  apiKey: Schema.Redacted(Schema.NonEmptyTrimmedString).annotations({
    title: "API Key",
    description: "WorkOS API key for server-side authentication"
  }),

  /**
   * WorkOS Client ID (starts with client_)
   */
  clientId: Schema.NonEmptyTrimmedString.annotations({
    title: "Client ID",
    description: "WorkOS client ID for OAuth flows"
  }),

  /**
   * OAuth redirect URI
   */
  redirectUri: Schema.NonEmptyTrimmedString.annotations({
    title: "Redirect URI",
    description: "OAuth callback URL registered in WorkOS"
  }),

  /**
   * Optional WorkOS organization ID for connection routing
   */
  organizationId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Organization ID",
    description: "Optional WorkOS organization ID for SSO routing"
  }),

  /**
   * Optional WorkOS connection ID for direct SSO connection
   */
  connectionId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Connection ID",
    description: "Optional WorkOS connection ID for direct SSO"
  })
}) {}

/**
 * GoogleAuthConfig - Configuration for Google OAuth provider
 */
export class GoogleAuthConfig extends Schema.Class<GoogleAuthConfig>("GoogleAuthConfig")({
  /**
   * Google OAuth Client ID
   */
  clientId: Schema.NonEmptyTrimmedString.annotations({
    title: "Client ID",
    description: "Google OAuth client ID from Google Cloud Console"
  }),

  /**
   * Google OAuth Client Secret
   */
  clientSecret: Schema.Redacted(Schema.NonEmptyTrimmedString).annotations({
    title: "Client Secret",
    description: "Google OAuth client secret for server-side authentication"
  }),

  /**
   * OAuth redirect URI
   */
  redirectUri: Schema.NonEmptyTrimmedString.annotations({
    title: "Redirect URI",
    description: "OAuth callback URL registered in Google Cloud Console"
  })
}) {}

/**
 * GitHubAuthConfig - Configuration for GitHub OAuth provider
 */
export class GitHubAuthConfig extends Schema.Class<GitHubAuthConfig>("GitHubAuthConfig")({
  /**
   * GitHub OAuth Client ID
   */
  clientId: Schema.NonEmptyTrimmedString.annotations({
    title: "Client ID",
    description: "GitHub OAuth client ID"
  }),

  /**
   * GitHub OAuth Client Secret
   */
  clientSecret: Schema.Redacted(Schema.NonEmptyTrimmedString).annotations({
    title: "Client Secret",
    description: "GitHub OAuth client secret"
  }),

  /**
   * OAuth redirect URI
   */
  redirectUri: Schema.NonEmptyTrimmedString.annotations({
    title: "Redirect URI",
    description: "OAuth callback URL registered in GitHub"
  })
}) {}

/**
 * SAMLAuthConfig - Configuration for SAML-based enterprise SSO
 */
export class SAMLAuthConfig extends Schema.Class<SAMLAuthConfig>("SAMLAuthConfig")({
  /**
   * SAML Identity Provider Entity ID
   */
  idpEntityId: Schema.NonEmptyTrimmedString.annotations({
    title: "IdP Entity ID",
    description: "SAML Identity Provider Entity ID"
  }),

  /**
   * SAML Identity Provider SSO URL
   */
  idpSsoUrl: Schema.NonEmptyTrimmedString.annotations({
    title: "IdP SSO URL",
    description: "SAML Identity Provider Single Sign-On URL"
  }),

  /**
   * SAML Identity Provider Certificate (PEM format)
   */
  idpCertificate: Schema.NonEmptyTrimmedString.annotations({
    title: "IdP Certificate",
    description: "SAML Identity Provider X.509 certificate in PEM format"
  }),

  /**
   * Service Provider Entity ID (your app)
   */
  spEntityId: Schema.NonEmptyTrimmedString.annotations({
    title: "SP Entity ID",
    description: "SAML Service Provider Entity ID"
  }),

  /**
   * Service Provider Assertion Consumer Service URL
   */
  spAcsUrl: Schema.NonEmptyTrimmedString.annotations({
    title: "SP ACS URL",
    description: "SAML Service Provider Assertion Consumer Service URL"
  })
}) {}

/**
 * ProviderConfigs - Union type for all provider configurations
 */
export type ProviderConfig =
  | LocalAuthConfig
  | WorkOSAuthConfig
  | GoogleAuthConfig
  | GitHubAuthConfig
  | SAMLAuthConfig

// =============================================================================
// Provider Configs Interface
// =============================================================================

/**
 * ProviderConfigs - Per-provider configuration settings
 */
export interface ProviderConfigs {
  readonly local: Option.Option<LocalAuthConfig>
  readonly workos: Option.Option<WorkOSAuthConfig>
  readonly google: Option.Option<GoogleAuthConfig>
  readonly github: Option.Option<GitHubAuthConfig>
  readonly saml: Option.Option<SAMLAuthConfig>
}

// =============================================================================
// Global Auth Configuration
// =============================================================================

/**
 * AuthConfigData - Global authentication configuration data
 *
 * Controls which providers are enabled, their configurations,
 * and global authentication behavior.
 */
export interface AuthConfigData {
  /**
   * Which auth providers are currently active
   */
  readonly enabledProviders: ReadonlyArray<AuthProviderType>

  /**
   * Per-provider configuration settings
   */
  readonly providerConfigs: ProviderConfigs

  /**
   * Default role assigned to newly registered users
   */
  readonly defaultRole: UserRole

  /**
   * Default session duration for new sessions
   */
  readonly sessionDuration: DurationInput

  /**
   * Whether to automatically link identities by email match
   *
   * When true, if a user authenticates with a new provider but
   * the email matches an existing user, the identity is linked
   * to the existing account.
   */
  readonly autoLinkByEmail: boolean

  /**
   * Whether email verification is required for local provider
   *
   * When true, local registration requires email verification
   * before the user can log in.
   */
  readonly requireEmailVerification: boolean
}

/**
 * AuthConfig - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { AuthConfig } from "@accountability/core/authentication/AuthConfig"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* AuthConfig
 *   if (config.enabledProviders.includes("google")) {
 *     // Google auth is enabled
 *   }
 * })
 * ```
 */
export class AuthConfig extends Context.Tag("AuthConfig")<AuthConfig, AuthConfigData>() {}

// =============================================================================
// Configuration Defaults
// =============================================================================

/**
 * Default LocalAuthConfig values
 */
export const localAuthDefaults: LocalAuthConfig = LocalAuthConfig.make({
  requireEmailVerification: false,
  minPasswordLength: 8,
  requireUppercase: false,
  requireNumbers: false,
  requireSpecialChars: false
})

/**
 * Default AuthConfig values
 */
export const authConfigDefaults: {
  readonly enabledProviders: ReadonlyArray<AuthProviderType>
  readonly defaultRole: UserRole
  readonly sessionDuration: Duration.Duration
  readonly autoLinkByEmail: boolean
  readonly requireEmailVerification: boolean
} = {
  enabledProviders: ["local"],
  defaultRole: "member",
  sessionDuration: Duration.hours(24),
  autoLinkByEmail: true,
  requireEmailVerification: false
}

// =============================================================================
// Configuration Loading from Environment
// =============================================================================

/**
 * Parse a comma-separated list of provider types
 */
const parseProviders = (value: string): ReadonlyArray<AuthProviderType> => {
  const providers = value.split(",").map((s) => s.trim().toLowerCase())
  return providers.filter(isAuthProviderType)
}

/**
 * Parse a UserRole from string
 */
const parseUserRole = (value: string): UserRole => {
  const role = value.trim().toLowerCase()
  if (isUserRole(role)) {
    return role
  }
  return "member"
}

/**
 * Config for local auth provider settings
 */
const localAuthConfig: Config.Config<Option.Option<LocalAuthConfig>> = Config.all({
  requireEmailVerification: Config.boolean("REQUIRE_EMAIL_VERIFICATION").pipe(
    Config.withDefault(localAuthDefaults.requireEmailVerification)
  ),
  minPasswordLength: Config.integer("MIN_PASSWORD_LENGTH").pipe(
    Config.withDefault(localAuthDefaults.minPasswordLength)
  ),
  requireUppercase: Config.boolean("REQUIRE_UPPERCASE").pipe(
    Config.withDefault(localAuthDefaults.requireUppercase)
  ),
  requireNumbers: Config.boolean("REQUIRE_NUMBERS").pipe(
    Config.withDefault(localAuthDefaults.requireNumbers)
  ),
  requireSpecialChars: Config.boolean("REQUIRE_SPECIAL_CHARS").pipe(
    Config.withDefault(localAuthDefaults.requireSpecialChars)
  )
}).pipe(
  Config.nested("AUTH_LOCAL"),
  Config.map((c) => Option.some(LocalAuthConfig.make(c))),
  Config.withDefault(Option.some(localAuthDefaults))
)

/**
 * Config for WorkOS auth provider settings
 */
const workosAuthConfig: Config.Config<Option.Option<WorkOSAuthConfig>> = Config.all({
  apiKey: Config.redacted("API_KEY"),
  clientId: Config.string("CLIENT_ID"),
  redirectUri: Config.string("REDIRECT_URI"),
  organizationId: Config.string("ORGANIZATION_ID").pipe(
    Config.option,
    Config.map(Option.flatMap((s) => s.trim() !== "" ? Option.some(s) : Option.none()))
  ),
  connectionId: Config.string("CONNECTION_ID").pipe(
    Config.option,
    Config.map(Option.flatMap((s) => s.trim() !== "" ? Option.some(s) : Option.none()))
  )
}).pipe(
  Config.nested("AUTH_WORKOS"),
  Config.map((c) =>
    Option.some(
      WorkOSAuthConfig.make({
        apiKey: c.apiKey,
        clientId: c.clientId,
        redirectUri: c.redirectUri,
        organizationId: c.organizationId,
        connectionId: c.connectionId
      })
    )
  ),
  Config.orElse(() => Config.succeed(Option.none()))
)

/**
 * Config for Google auth provider settings
 */
const googleAuthConfig: Config.Config<Option.Option<GoogleAuthConfig>> = Config.all({
  clientId: Config.string("CLIENT_ID"),
  clientSecret: Config.redacted("CLIENT_SECRET"),
  redirectUri: Config.string("REDIRECT_URI")
}).pipe(
  Config.nested("AUTH_GOOGLE"),
  Config.map((c) =>
    Option.some(
      GoogleAuthConfig.make({
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        redirectUri: c.redirectUri
      })
    )
  ),
  Config.orElse(() => Config.succeed(Option.none()))
)

/**
 * Config for GitHub auth provider settings
 */
const githubAuthConfig: Config.Config<Option.Option<GitHubAuthConfig>> = Config.all({
  clientId: Config.string("CLIENT_ID"),
  clientSecret: Config.redacted("CLIENT_SECRET"),
  redirectUri: Config.string("REDIRECT_URI")
}).pipe(
  Config.nested("AUTH_GITHUB"),
  Config.map((c) =>
    Option.some(
      GitHubAuthConfig.make({
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        redirectUri: c.redirectUri
      })
    )
  ),
  Config.orElse(() => Config.succeed(Option.none()))
)

/**
 * Config for SAML auth provider settings
 */
const samlAuthConfig: Config.Config<Option.Option<SAMLAuthConfig>> = Config.all({
  idpEntityId: Config.string("IDP_ENTITY_ID"),
  idpSsoUrl: Config.string("IDP_SSO_URL"),
  idpCertificate: Config.string("IDP_CERTIFICATE"),
  spEntityId: Config.string("SP_ENTITY_ID"),
  spAcsUrl: Config.string("SP_ACS_URL")
}).pipe(
  Config.nested("AUTH_SAML"),
  Config.map((c) =>
    Option.some(
      SAMLAuthConfig.make({
        idpEntityId: c.idpEntityId,
        idpSsoUrl: c.idpSsoUrl,
        idpCertificate: c.idpCertificate,
        spEntityId: c.spEntityId,
        spAcsUrl: c.spAcsUrl
      })
    )
  ),
  Config.orElse(() => Config.succeed(Option.none()))
)

/**
 * Full AuthConfig from environment variables
 */
export const authConfig: Config.Config<AuthConfigData> = Config.all({
  enabledProviders: Config.string("AUTH_ENABLED_PROVIDERS").pipe(
    Config.map(parseProviders),
    Config.withDefault(authConfigDefaults.enabledProviders)
  ),
  defaultRole: Config.string("AUTH_DEFAULT_ROLE").pipe(
    Config.map(parseUserRole),
    Config.withDefault(authConfigDefaults.defaultRole)
  ),
  sessionDuration: Config.duration("AUTH_SESSION_DURATION").pipe(
    Config.withDefault(authConfigDefaults.sessionDuration)
  ),
  autoLinkByEmail: Config.boolean("AUTH_AUTO_LINK_BY_EMAIL").pipe(
    Config.withDefault(authConfigDefaults.autoLinkByEmail)
  ),
  requireEmailVerification: Config.boolean("AUTH_REQUIRE_EMAIL_VERIFICATION").pipe(
    Config.withDefault(authConfigDefaults.requireEmailVerification)
  ),
  local: localAuthConfig,
  workos: workosAuthConfig,
  google: googleAuthConfig,
  github: githubAuthConfig,
  saml: samlAuthConfig
}).pipe(
  Config.map((c): AuthConfigData => ({
    enabledProviders: c.enabledProviders,
    defaultRole: c.defaultRole,
    sessionDuration: c.sessionDuration,
    autoLinkByEmail: c.autoLinkByEmail,
    requireEmailVerification: c.requireEmailVerification,
    providerConfigs: {
      local: c.local,
      workos: c.workos,
      google: c.google,
      github: c.github,
      saml: c.saml
    }
  }))
)

/**
 * AuthConfig loaded from environment
 */
export const authConfigFromEnv: Effect.Effect<AuthConfigData, ConfigError> = Effect.gen(
  function* () {
    return yield* authConfig
  }
)

// =============================================================================
// Layer
// =============================================================================

/**
 * AuthConfigLive - Layer providing AuthConfig from environment variables
 *
 * Reads configuration from:
 * - AUTH_ENABLED_PROVIDERS: Comma-separated list (default: "local")
 * - AUTH_DEFAULT_ROLE: Default user role (default: "member")
 * - AUTH_SESSION_DURATION: Session duration (default: "24 hours")
 * - AUTH_AUTO_LINK_BY_EMAIL: Auto-link by email (default: true)
 * - AUTH_REQUIRE_EMAIL_VERIFICATION: Require verification (default: false)
 *
 * Provider-specific configs (nested):
 * - AUTH_LOCAL_*: Local auth settings
 * - AUTH_WORKOS_*: WorkOS settings (API_KEY, CLIENT_ID, REDIRECT_URI, etc.)
 * - AUTH_GOOGLE_*: Google settings (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
 * - AUTH_GITHUB_*: GitHub settings (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
 * - AUTH_SAML_*: SAML settings (IDP_ENTITY_ID, IDP_SSO_URL, etc.)
 */
export const AuthConfigLive: Layer.Layer<AuthConfig, ConfigError> = Layer.effect(
  AuthConfig,
  authConfigFromEnv
)

/**
 * Create an AuthConfig layer with partial overrides
 *
 * Useful for tests or specific configurations where you want to
 * use defaults but override specific values.
 */
export const makeAuthConfigLayer = (
  overrides?: Partial<AuthConfigData>
): Layer.Layer<AuthConfig, ConfigError> =>
  Layer.effect(
    AuthConfig,
    Effect.map(authConfigFromEnv, (config): AuthConfigData => ({
      ...config,
      ...overrides,
      providerConfigs: {
        ...config.providerConfigs,
        ...overrides?.providerConfigs
      }
    }))
  )

/**
 * Create an AuthConfig layer with all values specified directly
 * (no environment loading)
 *
 * Useful for tests where you want full control over the configuration.
 */
export const makeAuthConfig = (config: AuthConfigData): Layer.Layer<AuthConfig> =>
  Layer.succeed(AuthConfig, config)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a provider is enabled in the config
 */
export const isProviderEnabled = (
  config: AuthConfigData,
  provider: AuthProviderType
): boolean => config.enabledProviders.includes(provider)

/**
 * Get the local auth provider config
 */
export const getLocalConfig = (
  config: AuthConfigData
): Option.Option<LocalAuthConfig> => config.providerConfigs.local

/**
 * Get the WorkOS auth provider config
 */
export const getWorkOSConfig = (
  config: AuthConfigData
): Option.Option<WorkOSAuthConfig> => config.providerConfigs.workos

/**
 * Get the Google auth provider config
 */
export const getGoogleConfig = (
  config: AuthConfigData
): Option.Option<GoogleAuthConfig> => config.providerConfigs.google

/**
 * Get the GitHub auth provider config
 */
export const getGitHubConfig = (
  config: AuthConfigData
): Option.Option<GitHubAuthConfig> => config.providerConfigs.github

/**
 * Get the SAML auth provider config
 */
export const getSAMLConfig = (
  config: AuthConfigData
): Option.Option<SAMLAuthConfig> => config.providerConfigs.saml

/**
 * Get the configuration for a specific provider
 */
export const getProviderConfig = (
  config: AuthConfigData,
  provider: AuthProviderType
): Option.Option<ProviderConfig> => {
  switch (provider) {
    case "local":
      return config.providerConfigs.local
    case "workos":
      return config.providerConfigs.workos
    case "google":
      return config.providerConfigs.google
    case "github":
      return config.providerConfigs.github
    case "saml":
      return config.providerConfigs.saml
  }
}

/**
 * Check if a provider is both enabled and configured
 */
export const isProviderAvailable = (
  config: AuthConfigData,
  provider: AuthProviderType
): boolean =>
  isProviderEnabled(config, provider) && Option.isSome(getProviderConfig(config, provider))
