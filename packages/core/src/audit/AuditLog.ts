/**
 * AuditLog - Domain types for audit trail tracking
 *
 * Provides types for audit log entries that track changes to all entities
 * for compliance and SOX requirements.
 *
 * @module AuditLog
 */

import * as Schema from "effect/Schema"

// =============================================================================
// IDs
// =============================================================================

/**
 * AuditLogEntryId - Branded UUID string for audit log entry identification
 */
export const AuditLogEntryId = Schema.UUID.pipe(
  Schema.brand("AuditLogEntryId"),
  Schema.annotations({
    identifier: "AuditLogEntryId",
    title: "Audit Log Entry ID",
    description: "A unique identifier for an audit log entry (UUID format)"
  })
)

export type AuditLogEntryId = typeof AuditLogEntryId.Type

// =============================================================================
// Enums
// =============================================================================

/**
 * AuditAction - The type of action performed on an entity
 *
 * - Create: New entity was created
 * - Update: Existing entity was modified
 * - Delete: Entity was deleted
 * - StatusChange: Entity status changed (e.g., Draft → Posted)
 */
export const AuditAction = Schema.Literal(
  "Create",
  "Update",
  "Delete",
  "StatusChange"
).annotations({
  identifier: "AuditAction",
  title: "Audit Action",
  description: "The type of action performed on an entity"
})

export type AuditAction = typeof AuditAction.Type

/**
 * AuditEntityType - The type of entity being audited
 *
 * All major entities in the system are tracked for compliance.
 */
export const AuditEntityType = Schema.Literal(
  "Organization",
  "OrganizationMember",
  "Company",
  "Account",
  "JournalEntry",
  "JournalEntryLine",
  "FiscalYear",
  "FiscalPeriod",
  "ExchangeRate",
  "ConsolidationGroup",
  "ConsolidationRun",
  "EliminationRule",
  "IntercompanyTransaction",
  "User",
  "Session"
).annotations({
  identifier: "AuditEntityType",
  title: "Audit Entity Type",
  description: "The type of entity being audited"
})

export type AuditEntityType = typeof AuditEntityType.Type

// =============================================================================
// Value Objects
// =============================================================================

/**
 * AuditFieldChange - Before/after values for a single audited field
 */
export const AuditFieldChange = Schema.Struct({
  from: Schema.Unknown,
  to: Schema.Unknown
})

export type AuditFieldChange = typeof AuditFieldChange.Type

/**
 * AuditChanges - Before/after values for audited fields
 *
 * A record of field changes where each key is a field name
 * and the value contains from/to values.
 */
export const AuditChanges = Schema.Record({ key: Schema.String, value: AuditFieldChange })

export type AuditChanges = typeof AuditChanges.Type
