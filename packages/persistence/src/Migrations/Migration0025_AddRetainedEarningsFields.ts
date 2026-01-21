/**
 * Migration0025_AddRetainedEarningsFields
 *
 * Adds fields required for year-end closing workflow:
 * 1. retained_earnings_account_id to companies table
 * 2. is_retained_earnings flag to accounts table
 *
 * These fields support:
 * - Configuring which account receives net income during year-end close
 * - Marking an account as the retained earnings account in CoA templates
 *
 * @module Migration0025_AddRetainedEarningsFields
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add retained earnings support for year-end closing
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Add retained_earnings_account_id column to companies table
  // This references the account that will receive net income during year-end close
  yield* sql`
    ALTER TABLE companies
    ADD COLUMN retained_earnings_account_id UUID REFERENCES accounts(id)
  `

  // Add is_retained_earnings flag to accounts table
  // This is used by CoA templates to mark the retained earnings account
  yield* sql`
    ALTER TABLE accounts
    ADD COLUMN is_retained_earnings BOOLEAN NOT NULL DEFAULT FALSE
  `
})
