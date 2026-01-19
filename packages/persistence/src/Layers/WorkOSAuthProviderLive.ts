/**
 * WorkOSAuthProviderLive - WorkOS SSO implementation of AuthProvider
 *
 * Implements the AuthProvider interface for WorkOS-based enterprise SSO authentication.
 * Uses WorkOS REST API directly with HttpClient (no SDK dependency).
 *
 * WorkOS SSO Flow:
 * 1. Generate authorization URL with organization/connection context
 * 2. User redirects to WorkOS and authenticates via their IdP
 * 3. WorkOS redirects back with authorization code
 * 4. Exchange code for profile via /sso/token endpoint
 *
 * @module WorkOSAuthProviderLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { HttpClient, HttpClientRequest } from "@effect/platform"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"
import { ProviderId } from "@accountability/core/authentication/ProviderId"
import { Email } from "@accountability/core/authentication/Email"
import { AuthResult } from "@accountability/core/authentication/AuthResult"
import { ProviderAuthFailedError } from "@accountability/core/authentication/AuthErrors"
import { WorkOSAuthProvider } from "../Services/WorkOSAuthProvider.ts"
import { WorkOSConfigTag } from "../Services/WorkOSConfig.ts"

// =============================================================================
// WorkOS API URLs
// =============================================================================

const WORKOS_API_BASE = "https://api.workos.com"
const WORKOS_AUTH_URL = `${WORKOS_API_BASE}/sso/authorize`
const WORKOS_TOKEN_URL = `${WORKOS_API_BASE}/sso/token`

// =============================================================================
// WorkOS API Response Schemas
// =============================================================================

/**
 * WorkOS Profile schema - User profile returned by WorkOS SSO
 */
const WorkOSProfile = Schema.Struct({
  id: Schema.String,
  connection_id: Schema.String,
  connection_type: Schema.String,
  organization_id: Schema.OptionFromNullOr(Schema.String),
  email: Schema.String,
  first_name: Schema.OptionFromNullOr(Schema.String),
  last_name: Schema.OptionFromNullOr(Schema.String),
  idp_id: Schema.String,
  raw_attributes: Schema.OptionFromNullOr(Schema.Unknown)
})

type WorkOSProfile = typeof WorkOSProfile.Type

/**
 * WorkOS Token Response schema - Response from token exchange endpoint
 */
const WorkOSTokenResponse = Schema.Struct({
  access_token: Schema.String,
  profile: WorkOSProfile
})

// =============================================================================
// Implementation
// =============================================================================

/**
 * Implementation of AuthProvider for WorkOS SSO authentication
 */
const make = Effect.gen(function* () {
  const config = yield* WorkOSConfigTag
  const httpClient = yield* HttpClient.HttpClient

  /**
   * Build the display name from WorkOS profile
   */
  const buildDisplayName = (profile: WorkOSProfile): string => {
    const firstName = Option.getOrElse(profile.first_name, () => "")
    const lastName = Option.getOrElse(profile.last_name, () => "")
    const fullName = `${firstName} ${lastName}`.trim()
    return fullName || profile.email
  }

  /**
   * Map WorkOS profile to AuthResult
   */
  const mapToAuthResult = (profile: WorkOSProfile): AuthResult =>
    AuthResult.make({
      provider: "workos",
      providerId: ProviderId.make(profile.id),
      email: Email.make(profile.email),
      displayName: buildDisplayName(profile),
      emailVerified: true, // WorkOS SSO users have verified emails via IdP
      providerData: Option.some({
        // Store WorkOS profile in the standard ProviderData format
        profile: {
          connection_id: profile.connection_id,
          connection_type: profile.connection_type,
          organization_id: Option.getOrUndefined(profile.organization_id),
          idp_id: profile.idp_id,
          raw_attributes: Option.getOrUndefined(profile.raw_attributes)
        }
      })
    })

  const provider: AuthProvider = {
    /**
     * Provider type identifier
     */
    type: "workos",

    /**
     * WorkOS does NOT support registration - users are auto-provisioned via SSO
     */
    supportsRegistration: false,

    /**
     * Authenticate a user with WorkOS credentials
     *
     * For WorkOS, authenticate() is not used directly - use the OAuth flow instead.
     * This method will always fail as WorkOS requires redirect-based flow.
     */
    authenticate: () =>
      Effect.fail(
        new ProviderAuthFailedError({
          provider: "workos",
          reason: "WorkOS requires OAuth redirect flow. Use getAuthorizationUrl() and handleCallback() instead."
        })
      ),

    /**
     * Generate the WorkOS authorization URL for SSO
     *
     * Returns the URL to redirect users to for authentication.
     * The URL includes:
     * - client_id: Your WorkOS client ID
     * - redirect_uri: Where to redirect after auth
     * - response_type: Always "code" for OAuth
     * - state: CSRF protection token
     * - organization/connection: Optional routing parameters
     *
     * @param state - CSRF protection state parameter
     * @param redirectUri - Optional custom redirect URI (defaults to config)
     */
    getAuthorizationUrl: (state: string, redirectUri?: string) => {
      const params = new URLSearchParams()
      params.set("client_id", config.clientId)
      params.set("redirect_uri", redirectUri ?? config.redirectUri)
      params.set("response_type", "code")
      params.set("state", state)

      // Add organization or connection routing if configured
      if (Option.isSome(config.connectionId)) {
        params.set("connection", config.connectionId.value)
      } else if (Option.isSome(config.organizationId)) {
        params.set("organization", config.organizationId.value)
      }

      return Option.some(`${WORKOS_AUTH_URL}?${params.toString()}`)
    },

    /**
     * Handle the OAuth callback from WorkOS
     *
     * Exchanges the authorization code for user profile via WorkOS API.
     *
     * @param code - The authorization code from WorkOS callback
     * @param _state - The state parameter (validated by caller before this point)
     */
    handleCallback: (code: string, _state: string) =>
      Effect.gen(function* () {
        // Exchange code for tokens and profile
        const request = HttpClientRequest.post(WORKOS_TOKEN_URL).pipe(
          HttpClientRequest.setHeader("Content-Type", "application/x-www-form-urlencoded"),
          HttpClientRequest.bodyText(
            new URLSearchParams({
              client_id: config.clientId,
              client_secret: Redacted.value(config.apiKey),
              grant_type: "authorization_code",
              code
            }).toString()
          )
        )

        const response = yield* httpClient.execute(request).pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "workos",
              reason: `HTTP request failed: ${error.message}`
            })
          )
        )

        // Check for successful response
        if (response.status !== 200) {
          const errorBody = yield* response.text.pipe(
            Effect.mapError((readError) =>
              new ProviderAuthFailedError({
                provider: "workos",
                reason: `Token exchange failed (${response.status}), error body unreadable: ${String(readError)}`
              })
            )
          )
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: "workos",
              reason: `Token exchange failed (${response.status}): ${errorBody}`
            })
          )
        }

        // Parse the response
        const json = yield* response.json.pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "workos",
              reason: `Failed to parse WorkOS response: ${String(error)}`
            })
          )
        )

        // Decode the response using Schema
        const tokenResponse = yield* Schema.decodeUnknown(WorkOSTokenResponse)(json).pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "workos",
              reason: `Invalid WorkOS response: ${error.message}`
            })
          )
        )

        // Map to AuthResult
        return mapToAuthResult(tokenResponse.profile)
      })
  }

  return provider
})

/**
 * WorkOSAuthProviderLive - Layer providing WorkOSAuthProvider implementation
 *
 * Requires:
 * - WorkOSConfigTag: WorkOS configuration (API key, client ID, redirect URI)
 * - HttpClient: For making HTTP requests to WorkOS API
 */
export const WorkOSAuthProviderLive: Layer.Layer<
  WorkOSAuthProvider,
  never,
  WorkOSConfigTag | HttpClient.HttpClient
> = Layer.effect(WorkOSAuthProvider, make)
