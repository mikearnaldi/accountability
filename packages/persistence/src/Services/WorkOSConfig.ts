/**
 * WorkOSConfig - Configuration schema for WorkOS SSO integration
 *
 * Defines the environment configuration required to connect to WorkOS
 * for enterprise SSO authentication.
 *
 * @module WorkOSConfig
 */

import * as Context from "effect/Context"
import * as Schema from "effect/Schema"

/**
 * WorkOSConfig - Configuration for WorkOS SSO provider
 *
 * All values are typically loaded from environment variables:
 * - WORKOS_API_KEY: The WorkOS API key (starts with sk_)
 * - WORKOS_CLIENT_ID: The WorkOS client ID (starts with client_)
 * - WORKOS_REDIRECT_URI: The callback URL for OAuth flow
 */
export class WorkOSConfig extends Schema.Class<WorkOSConfig>("WorkOSConfig")({
  /**
   * WorkOS API key (starts with sk_)
   *
   * Used for server-side API calls to WorkOS
   */
  apiKey: Schema.Redacted(Schema.NonEmptyTrimmedString).annotations({
    title: "API Key",
    description: "WorkOS API key for server-side authentication"
  }),

  /**
   * WorkOS Client ID (starts with client_)
   *
   * Used to identify your application in OAuth flows
   */
  clientId: Schema.NonEmptyTrimmedString.annotations({
    title: "Client ID",
    description: "WorkOS client ID for OAuth flows"
  }),

  /**
   * OAuth redirect URI
   *
   * The URL where WorkOS redirects after authentication.
   * Must be registered in your WorkOS dashboard.
   */
  redirectUri: Schema.NonEmptyTrimmedString.annotations({
    title: "Redirect URI",
    description: "OAuth callback URL registered in WorkOS"
  }),

  /**
   * Optional WorkOS organization ID for connection routing
   *
   * If specified, users are routed to the SSO connection
   * for this organization.
   */
  organizationId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Organization ID",
    description: "Optional WorkOS organization ID for SSO routing"
  }),

  /**
   * Optional WorkOS connection ID for direct SSO connection
   *
   * If specified, bypasses organization routing and connects
   * directly to a specific SSO connection.
   */
  connectionId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Connection ID",
    description: "Optional WorkOS connection ID for direct SSO"
  })
}) {}

/**
 * WorkOSConfig - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { WorkOSConfig } from "@accountability/persistence/Services/WorkOSConfig"
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* WorkOSConfig
 *   console.log(config.clientId)
 * })
 * ```
 */
export class WorkOSConfigTag extends Context.Tag("WorkOSConfig")<
  WorkOSConfigTag,
  WorkOSConfig
>() {}
