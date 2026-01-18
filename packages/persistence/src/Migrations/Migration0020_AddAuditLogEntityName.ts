/**
 * Migration0020_AddAuditLogEntityName
 *
 * Adds entity_name column to audit_log table to store human-readable names
 * for audited entities (e.g., account name, company name, journal entry reference).
 *
 * This enables the audit log to display meaningful entity names instead of
 * just UUIDs, improving usability and compliance reporting.
 *
 * @module Migration0020_AddAuditLogEntityName
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add entity_name to audit_log table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Add entity_name column (nullable - may not always have a name)
  yield* sql`
    ALTER TABLE audit_log
    ADD COLUMN entity_name VARCHAR(255) NULL
  `
})
