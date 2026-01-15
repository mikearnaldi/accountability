/**
 * Migration0013_CreateAuditLog
 *
 * Creates the audit_log table for tracking changes to all entities
 * for compliance and SOX requirements. Tracks user, timestamp, and
 * before/after values for all entity modifications.
 *
 * @module Migration0013_CreateAuditLog
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create the audit_log table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for audit actions
  yield* sql`
    CREATE TYPE audit_action AS ENUM (
      'Create',
      'Update',
      'Delete',
      'StatusChange'
    )
  `

  // Create enum for audited entity types
  yield* sql`
    CREATE TYPE audit_entity_type AS ENUM (
      'Organization',
      'Company',
      'Account',
      'JournalEntry',
      'JournalEntryLine',
      'FiscalYear',
      'FiscalPeriod',
      'ExchangeRate',
      'ConsolidationGroup',
      'ConsolidationRun',
      'EliminationRule',
      'IntercompanyTransaction',
      'User',
      'Session'
    )
  `

  // Create audit_log table
  yield* sql`
    CREATE TABLE audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type audit_entity_type NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      action audit_action NOT NULL,
      user_id UUID NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      changes JSONB NULL
    )
  `

  // Create index on entity_type and entity_id for filtering by entity
  yield* sql`
    CREATE INDEX idx_audit_log_entity
      ON audit_log (entity_type, entity_id)
  `

  // Create index on user_id for filtering by user
  yield* sql`
    CREATE INDEX idx_audit_log_user_id
      ON audit_log (user_id)
      WHERE user_id IS NOT NULL
  `

  // Create index on action for filtering by action type
  yield* sql`
    CREATE INDEX idx_audit_log_action
      ON audit_log (action)
  `

  // Create index on timestamp for date range queries and ordering
  yield* sql`
    CREATE INDEX idx_audit_log_timestamp
      ON audit_log (timestamp DESC)
  `

  // Create composite index for common query patterns
  yield* sql`
    CREATE INDEX idx_audit_log_entity_timestamp
      ON audit_log (entity_type, timestamp DESC)
  `
})
