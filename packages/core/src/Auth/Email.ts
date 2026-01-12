/**
 * Email - Branded type for email addresses
 *
 * A branded string type for validated email addresses using RFC-compliant
 * pattern matching.
 *
 * @module Email
 */

import * as Schema from "effect/Schema"

/**
 * Email address validation pattern (simplified RFC 5322)
 *
 * This pattern covers most valid email addresses while being practical:
 * - Local part: alphanumeric, dots, hyphens, underscores, plus signs
 * - @ symbol
 * - Domain: alphanumeric and hyphens, with at least one dot for TLD
 */
const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/**
 * Email - Branded string for validated email addresses
 *
 * Validates format against a simplified RFC 5322 pattern.
 * Case-insensitive in practice but stored as provided.
 */
export const Email = Schema.String.pipe(
  Schema.pattern(EMAIL_PATTERN),
  Schema.brand("Email"),
  Schema.annotations({
    identifier: "Email",
    title: "Email Address",
    description: "A valid email address"
  })
)

/**
 * The branded Email type
 */
export type Email = typeof Email.Type

/**
 * Type guard for Email using Schema.is
 */
export const isEmail = Schema.is(Email)
