/**
 * GoogleConfig - Configuration schema for Google OAuth integration
 *
 * Defines the environment configuration required to connect to Google
 * for OAuth2 authentication.
 *
 * @module GoogleConfig
 */

import * as Context from "effect/Context"
import * as Schema from "effect/Schema"

/**
 * GoogleConfig - Configuration for Google OAuth provider
 *
 * All values are typically loaded from environment variables:
 * - GOOGLE_CLIENT_ID: The Google OAuth client ID
 * - GOOGLE_CLIENT_SECRET: The Google OAuth client secret
 * - GOOGLE_REDIRECT_URI: The callback URL for OAuth flow
 */
export class GoogleConfig extends Schema.Class<GoogleConfig>("GoogleConfig")({
  /**
   * Google OAuth Client ID
   *
   * Used to identify your application in OAuth flows.
   * Obtained from the Google Cloud Console.
   */
  clientId: Schema.NonEmptyTrimmedString.annotations({
    title: "Client ID",
    description: "Google OAuth client ID from Google Cloud Console"
  }),

  /**
   * Google OAuth Client Secret
   *
   * Used for server-side token exchange.
   * Must be kept confidential.
   */
  clientSecret: Schema.Redacted(Schema.NonEmptyTrimmedString).annotations({
    title: "Client Secret",
    description: "Google OAuth client secret for server-side authentication"
  }),

  /**
   * OAuth redirect URI
   *
   * The URL where Google redirects after authentication.
   * Must be registered in your Google Cloud Console.
   */
  redirectUri: Schema.NonEmptyTrimmedString.annotations({
    title: "Redirect URI",
    description: "OAuth callback URL registered in Google Cloud Console"
  })
}) {}

/**
 * GoogleConfigTag - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { GoogleConfigTag } from "@accountability/persistence/Services/GoogleConfig"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* GoogleConfigTag
 *   console.log(config.clientId)
 * })
 * ```
 */
export class GoogleConfigTag extends Context.Tag("GoogleConfig")<
  GoogleConfigTag,
  GoogleConfig
>() {}
