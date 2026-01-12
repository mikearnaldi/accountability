/**
 * HashedPassword - Branded type for securely hashed passwords
 *
 * Represents a password that has been cryptographically hashed using
 * a secure algorithm (e.g., bcrypt, argon2). The branding ensures
 * that plain text passwords cannot be accidentally used where a
 * hashed password is expected.
 *
 * The hash string format depends on the algorithm used:
 * - bcrypt: $2a$10$... or $2b$10$... (60 characters)
 * - argon2: $argon2id$v=19$... (variable length)
 *
 * @module HashedPassword
 */

import * as Schema from "effect/Schema"

/**
 * HashedPassword - A branded string representing a hashed password
 *
 * This type provides type safety to ensure that:
 * - Plain text passwords are not stored directly
 * - Hashed passwords are not accidentally treated as plain text
 * - The hash has been produced by a proper hashing service
 */
export const HashedPassword = Schema.NonEmptyTrimmedString.pipe(
  Schema.brand("HashedPassword"),
  Schema.annotations({
    identifier: "HashedPassword",
    title: "Hashed Password",
    description: "A password that has been securely hashed using bcrypt or similar algorithm"
  })
)

/**
 * The HashedPassword type
 */
export type HashedPassword = typeof HashedPassword.Type
