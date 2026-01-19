/**
 * AuditLogApi - HTTP API group for audit log queries
 *
 * Provides endpoint to query audit trail entries for compliance and SOX requirements.
 * Tracks changes to all entities with user, timestamp, and before/after values.
 *
 * Read-only endpoint - audit entries are system-generated.
 *
 * @module AuditLogApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  AuditLogEntryId,
  AuditAction,
  AuditEntityType,
  AuditChanges
} from "@accountability/core/audit/AuditLog"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { InternalServerError } from "./ApiErrors.ts"

// Re-export domain types for convenience
export { AuditLogEntryId, AuditAction, AuditEntityType, AuditChanges } from "@accountability/core/audit/AuditLog"

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * AuditLogEntry - Single audit log entry in the response
 */
export class AuditLogEntry extends Schema.Class<AuditLogEntry>("AuditLogEntry")({
  id: AuditLogEntryId,
  entityType: AuditEntityType,
  entityId: Schema.String,
  entityName: Schema.OptionFromNullOr(Schema.String),
  action: AuditAction,
  userId: Schema.OptionFromNullOr(Schema.UUID),
  /** Denormalized user display name at time of action */
  userDisplayName: Schema.OptionFromNullOr(Schema.String),
  /** Denormalized user email at time of action */
  userEmail: Schema.OptionFromNullOr(Schema.String),
  timestamp: Schema.DateTimeUtc,
  changes: Schema.OptionFromNullOr(AuditChanges)
}) {}

/**
 * AuditLogListResponse - Response containing paginated audit entries
 */
export class AuditLogListResponse extends Schema.Class<AuditLogListResponse>("AuditLogListResponse")({
  entries: Schema.Array(AuditLogEntry),
  total: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
}) {}

// =============================================================================
// Path Parameters
// =============================================================================

/**
 * Path parameters for audit log endpoints
 */
export const AuditLogPathParams = Schema.Struct({
  organizationId: Schema.UUID.annotations({
    description: "The organization ID to scope audit entries to"
  })
})

export type AuditLogPathParams = typeof AuditLogPathParams.Type

// =============================================================================
// Query Parameters
// =============================================================================

/**
 * Query parameters for listing audit log entries
 */
export const AuditLogListParams = Schema.Struct({
  entityType: Schema.optional(AuditEntityType),
  entityId: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.UUID),
  action: Schema.optional(AuditAction),
  fromDate: Schema.optional(Schema.DateTimeUtc),
  toDate: Schema.optional(Schema.DateTimeUtc),
  search: Schema.optional(Schema.String.annotations({
    description: "Search term for filtering by entity name or entity ID (case-insensitive)"
  })),
  limit: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.lessThanOrEqualTo(1000)
    )
  ),
  offset: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.nonNegative()
    )
  )
})

export type AuditLogListParams = typeof AuditLogListParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List audit log entries with filtering and pagination
 *
 * Returns paginated audit entries for compliance and SOX requirements.
 * Supports filtering by entity type, entity ID, user, action, and date range.
 * Entries are scoped to the specified organization for security.
 */
const listAuditLog = HttpApiEndpoint.get("listAuditLog", "/:organizationId")
  .setPath(AuditLogPathParams)
  .setUrlParams(AuditLogListParams)
  .addSuccess(AuditLogListResponse)
  .addError(InternalServerError)
  .annotateContext(OpenApi.annotations({
    summary: "List audit log entries",
    description: "Retrieve paginated audit trail entries for compliance and SOX requirements. Supports filtering by entity type, entity ID, user, action, and date range. Entries are scoped to the specified organization."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * AuditLogApi - API group for audit log queries
 *
 * Base path: /api/v1/audit-log
 * Protected by: AuthMiddleware (bearer token authentication)
 *
 * This is a read-only endpoint - audit entries are system-generated.
 */
export class AuditLogApi extends HttpApiGroup.make("auditLog")
  .add(listAuditLog)
  .middleware(AuthMiddleware)
  .prefix("/v1/audit-log")
  .annotateContext(OpenApi.annotations({
    title: "Audit Log",
    description: "Audit trail entries for compliance and SOX requirements. Tracks changes to all entities with user, timestamp, and before/after values. Read-only endpoint."
  })) {}
