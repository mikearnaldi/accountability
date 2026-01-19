/**
 * GoogleAuthProviderLive - Google OAuth implementation of AuthProvider
 *
 * Implements the AuthProvider interface for Google OAuth2 authentication.
 * Uses Google OAuth REST API directly with HttpClient (no SDK dependency).
 *
 * Google OAuth2 Flow:
 * 1. Generate authorization URL with email/profile scopes
 * 2. User redirects to Google and authenticates
 * 3. Google redirects back with authorization code
 * 4. Exchange code for tokens via oauth2.googleapis.com/token endpoint
 * 5. Fetch user profile from googleapis.com/oauth2/v2/userinfo
 *
 * @module GoogleAuthProviderLive
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
import { GoogleAuthProvider } from "../Services/GoogleAuthProvider.ts"
import { GoogleConfigTag } from "../Services/GoogleConfig.ts"

// =============================================================================
// Google OAuth2 URLs
// =============================================================================

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

/**
 * Google OAuth scopes for email and profile access
 */
const GOOGLE_SCOPES = ["openid", "email", "profile"]

// =============================================================================
// Google API Response Schemas
// =============================================================================

/**
 * Google Token Response schema - Response from token exchange endpoint
 */
const GoogleTokenResponse = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Number,
  token_type: Schema.String,
  scope: Schema.String,
  id_token: Schema.optional(Schema.String)
})

/**
 * Google UserInfo schema - User profile returned by Google userinfo endpoint
 */
const GoogleUserInfo = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  verified_email: Schema.Boolean,
  name: Schema.optional(Schema.String),
  given_name: Schema.optional(Schema.String),
  family_name: Schema.optional(Schema.String),
  picture: Schema.optional(Schema.String)
})

type GoogleUserInfo = typeof GoogleUserInfo.Type

// =============================================================================
// Implementation
// =============================================================================

/**
 * Implementation of AuthProvider for Google OAuth authentication
 */
const make = Effect.gen(function* () {
  const config = yield* GoogleConfigTag
  const httpClient = yield* HttpClient.HttpClient

  /**
   * Build the display name from Google userinfo
   */
  const buildDisplayName = (userInfo: GoogleUserInfo): string => {
    // Prefer full name, then given + family, then email
    if (userInfo.name) {
      return userInfo.name
    }
    const givenName = userInfo.given_name ?? ""
    const familyName = userInfo.family_name ?? ""
    const fullName = `${givenName} ${familyName}`.trim()
    return fullName || userInfo.email
  }

  /**
   * Map Google userinfo to AuthResult
   */
  const mapToAuthResult = (userInfo: GoogleUserInfo): AuthResult =>
    AuthResult.make({
      provider: "google",
      providerId: ProviderId.make(userInfo.id),
      email: Email.make(userInfo.email),
      displayName: buildDisplayName(userInfo),
      emailVerified: userInfo.verified_email,
      providerData: Option.some({
        profile: {
          picture: userInfo.picture,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name
        }
      })
    })

  const provider: AuthProvider = {
    /**
     * Provider type identifier
     */
    type: "google",

    /**
     * Google OAuth does NOT support registration - users are auto-provisioned on first login
     */
    supportsRegistration: false,

    /**
     * Authenticate a user with Google credentials
     *
     * For Google, authenticate() is not used directly - use the OAuth flow instead.
     * This method will always fail as Google requires redirect-based flow.
     */
    authenticate: () =>
      Effect.fail(
        new ProviderAuthFailedError({
          provider: "google",
          reason: "Google requires OAuth redirect flow. Use getAuthorizationUrl() and handleCallback() instead."
        })
      ),

    /**
     * Generate the Google OAuth authorization URL
     *
     * Returns the URL to redirect users to for authentication.
     * The URL includes:
     * - client_id: Your Google OAuth client ID
     * - redirect_uri: Where to redirect after auth
     * - response_type: Always "code" for OAuth authorization code flow
     * - scope: openid, email, profile
     * - state: CSRF protection token
     * - access_type: offline for refresh token (optional)
     *
     * @param state - CSRF protection state parameter
     * @param redirectUri - Optional custom redirect URI (defaults to config)
     */
    getAuthorizationUrl: (state: string, redirectUri?: string) => {
      const params = new URLSearchParams()
      params.set("client_id", config.clientId)
      params.set("redirect_uri", redirectUri ?? config.redirectUri)
      params.set("response_type", "code")
      params.set("scope", GOOGLE_SCOPES.join(" "))
      params.set("state", state)
      params.set("access_type", "offline")
      params.set("prompt", "select_account")

      return Option.some(`${GOOGLE_AUTH_URL}?${params.toString()}`)
    },

    /**
     * Handle the OAuth callback from Google
     *
     * Exchanges the authorization code for tokens via Google OAuth API,
     * then fetches the user profile from the userinfo endpoint.
     *
     * @param code - The authorization code from Google callback
     * @param _state - The state parameter (validated by caller before this point)
     */
    handleCallback: (code: string, _state: string) =>
      Effect.gen(function* () {
        // Step 1: Exchange code for tokens
        const tokenRequest = HttpClientRequest.post(GOOGLE_TOKEN_URL).pipe(
          HttpClientRequest.setHeader("Content-Type", "application/x-www-form-urlencoded"),
          HttpClientRequest.bodyText(
            new URLSearchParams({
              client_id: config.clientId,
              client_secret: Redacted.value(config.clientSecret),
              code,
              grant_type: "authorization_code",
              redirect_uri: config.redirectUri
            }).toString()
          )
        )

        const tokenResponse = yield* httpClient.execute(tokenRequest).pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "google",
              reason: `HTTP request to token endpoint failed: ${error.message}`
            })
          )
        )

        // Check for successful token response
        if (tokenResponse.status !== 200) {
          const errorBody = yield* tokenResponse.text.pipe(
            Effect.mapError((readError) =>
              new ProviderAuthFailedError({
                provider: "google",
                reason: `Token exchange failed (${tokenResponse.status}), error body unreadable: ${String(readError)}`
              })
            )
          )
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: "google",
              reason: `Token exchange failed (${tokenResponse.status}): ${errorBody}`
            })
          )
        }

        // Parse the token response
        const tokenJson = yield* tokenResponse.json.pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "google",
              reason: `Failed to parse Google token response: ${String(error)}`
            })
          )
        )

        // Decode the token response using Schema
        const tokens = yield* Schema.decodeUnknown(GoogleTokenResponse)(tokenJson).pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "google",
              reason: `Invalid Google token response: ${error.message}`
            })
          )
        )

        // Step 2: Fetch user profile from userinfo endpoint
        const userInfoRequest = HttpClientRequest.get(GOOGLE_USERINFO_URL).pipe(
          HttpClientRequest.setHeader("Authorization", `Bearer ${tokens.access_token}`)
        )

        const userInfoResponse = yield* httpClient.execute(userInfoRequest).pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "google",
              reason: `HTTP request to userinfo endpoint failed: ${error.message}`
            })
          )
        )

        // Check for successful userinfo response
        if (userInfoResponse.status !== 200) {
          const errorBody = yield* userInfoResponse.text.pipe(
            Effect.mapError((readError) =>
              new ProviderAuthFailedError({
                provider: "google",
                reason: `Userinfo request failed (${userInfoResponse.status}), error body unreadable: ${String(readError)}`
              })
            )
          )
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: "google",
              reason: `Userinfo request failed (${userInfoResponse.status}): ${errorBody}`
            })
          )
        }

        // Parse the userinfo response
        const userInfoJson = yield* userInfoResponse.json.pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "google",
              reason: `Failed to parse Google userinfo response: ${String(error)}`
            })
          )
        )

        // Decode the userinfo response using Schema
        const userInfo = yield* Schema.decodeUnknown(GoogleUserInfo)(userInfoJson).pipe(
          Effect.mapError((error) =>
            new ProviderAuthFailedError({
              provider: "google",
              reason: `Invalid Google userinfo response: ${error.message}`
            })
          )
        )

        // Map to AuthResult
        return mapToAuthResult(userInfo)
      })
  }

  return provider
})

/**
 * GoogleAuthProviderLive - Layer providing GoogleAuthProvider implementation
 *
 * Requires:
 * - GoogleConfigTag: Google OAuth configuration (client ID, client secret, redirect URI)
 * - HttpClient: For making HTTP requests to Google OAuth API
 */
export const GoogleAuthProviderLive: Layer.Layer<
  GoogleAuthProvider,
  never,
  GoogleConfigTag | HttpClient.HttpClient
> = Layer.effect(GoogleAuthProvider, make)
