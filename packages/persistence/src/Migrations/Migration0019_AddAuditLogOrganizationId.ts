/**
 * Migration0019_AddAuditLogOrganizationId
 *
 * Adds organization_id column to audit_log table to scope audit entries
 * by organization for proper data isolation and security.
 *
 * This is a CRITICAL security fix - without organization scoping, users
 * can see audit entries from all organizations.
 *
 * @module Migration0019_AddAuditLogOrganizationId
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add organization_id to audit_log table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Add organization_id column (nullable initially for existing data)
  // Note: No foreign key constraint - audit logs should persist even if orgs are deleted,
  // and we may log events that don't have organization context (e.g., system-level events)
  yield* sql`
    ALTER TABLE audit_log
    ADD COLUMN organization_id UUID NULL
  `

  // Create index on (organization_id, timestamp DESC) for common query pattern
  yield* sql`
    CREATE INDEX idx_audit_log_org_timestamp
    ON audit_log (organization_id, timestamp DESC)
    WHERE organization_id IS NOT NULL
  `

  // Add OrganizationMember to the audit_entity_type enum
  yield* sql`
    ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'OrganizationMember'
  `
})
