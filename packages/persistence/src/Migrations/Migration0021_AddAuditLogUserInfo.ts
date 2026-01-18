/**
 * Migration0021_AddAuditLogUserInfo
 *
 * Adds user_display_name and user_email columns to audit_log table for
 * denormalizing user information at audit time. This allows displaying
 * meaningful user names/emails in the audit log without requiring joins,
 * and preserves the historical user information at the time of the action.
 *
 * @module Migration0021_AddAuditLogUserInfo
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add user info columns to audit_log table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Add user_display_name column (nullable - system actions have no user)
  yield* sql`
    ALTER TABLE audit_log
    ADD COLUMN user_display_name VARCHAR(255) NULL
  `

  // Add user_email column (nullable - system actions have no user)
  yield* sql`
    ALTER TABLE audit_log
    ADD COLUMN user_email VARCHAR(255) NULL
  `
})
