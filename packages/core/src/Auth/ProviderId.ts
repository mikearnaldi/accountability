/**
 * ProviderId - Branded type for external provider user identifiers
 *
 * A branded string type for identifying users within external auth providers.
 * Each provider has its own ID format (e.g., Google sub, GitHub user ID, WorkOS user ID).
 *
 * @module ProviderId
 */

import * as Schema from "effect/Schema"

/**
 * ProviderId - Branded string for external provider user identification
 *
 * Validates as a non-empty trimmed string to accommodate various provider ID formats.
 * Different providers use different ID formats:
 * - Google: sub claim (string)
 * - GitHub: user ID (numeric string)
 * - WorkOS: user ID (string)
 * - SAML: NameID (string)
 */
export const ProviderId = Schema.NonEmptyTrimmedString.pipe(
  Schema.brand("ProviderId"),
  Schema.annotations({
    identifier: "ProviderId",
    title: "Provider ID",
    description: "A unique identifier for a user within an external auth provider"
  })
)

/**
 * The branded ProviderId type
 */
export type ProviderId = typeof ProviderId.Type

/**
 * Type guard for ProviderId using Schema.is
 */
export const isProviderId = Schema.is(ProviderId)
