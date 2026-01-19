/**
 * LocalCredentials - Credentials for local authentication
 *
 * Schema for username/password authentication using the 'local' provider.
 * The password is wrapped in Effect's Redacted type to prevent accidental
 * exposure in logs or error messages.
 *
 * @module LocalCredentials
 */

import * as Schema from "effect/Schema"
import { Email } from "./Email.ts"

/**
 * Password - Schema for password values wrapped in Redacted
 *
 * Minimum password length of 8 characters is enforced.
 * The password is automatically wrapped in Redacted to prevent
 * accidental exposure in logs, console output, or error messages.
 */
export const Password = Schema.String.pipe(
  Schema.minLength(8),
  Schema.annotations({
    identifier: "Password",
    title: "Password",
    description: "A password with minimum 8 characters"
  })
)

/**
 * The Password type (plain string before redaction)
 */
export type Password = typeof Password.Type

/**
 * RedactedPassword - Password wrapped in Redacted for secure handling
 *
 * Use Schema.Redacted to wrap the password, preventing it from being
 * accidentally logged or serialized.
 */
export const RedactedPassword = Schema.Redacted(Password).annotations({
  identifier: "RedactedPassword",
  title: "Redacted Password",
  description: "A password wrapped in Redacted for secure handling"
})

/**
 * The RedactedPassword type (Redacted<string>)
 */
export type RedactedPassword = typeof RedactedPassword.Type

/**
 * LocalCredentials - Email and password for local authentication
 *
 * Used for the 'local' auth provider. The password is stored as
 * Redacted<string> to prevent accidental exposure.
 */
export class LocalCredentials extends Schema.Class<LocalCredentials>("LocalCredentials")({
  /**
   * User's email address for identification
   */
  email: Email,

  /**
   * User's password wrapped in Redacted
   */
  password: RedactedPassword
}) {}

/**
 * Type guard for LocalCredentials using Schema.is
 */
export const isLocalCredentials = Schema.is(LocalCredentials)
