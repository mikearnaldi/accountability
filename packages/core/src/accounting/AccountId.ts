/**
 * AccountId - Branded UUID string for account identification
 *
 * Extracted to separate file to break circular dependency between
 * Account.ts and Company.ts.
 *
 * @module accounting/AccountId
 */

import * as Schema from "effect/Schema"

/**
 * AccountId - Branded UUID string for account identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const AccountId = Schema.UUID.pipe(
  Schema.brand("AccountId"),
  Schema.annotations({
    identifier: "AccountId",
    title: "Account ID",
    description: "A unique identifier for an account (UUID format)"
  })
)

/**
 * The branded AccountId type
 */
export type AccountId = typeof AccountId.Type

/**
 * Type guard for AccountId using Schema.is
 */
export const isAccountId = Schema.is(AccountId)
