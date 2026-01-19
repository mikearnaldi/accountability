/**
 * AuthorizationAuditRepositoryLive - PostgreSQL implementation of AuthorizationAuditRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module AuthorizationAuditRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { PolicyId } from "@accountability/core/authorization/PolicyId"
import { OrganizationId } from "@accountability/core/organization/Organization"
import {
  AuthorizationAuditRepository,
  AuthorizationDenialEntry,
  type AuthorizationAuditRepositoryService
} from "../Services/AuthorizationAuditRepository.ts"
import { wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from authorization_audit_log table
 */
const AuditRow = Schema.Struct({
  id: Schema.String,
  user_id: Schema.String,
  organization_id: Schema.String,
  action: Schema.String,
  resource_type: Schema.String,
  resource_id: Schema.NullOr(Schema.String),
  denial_reason: Schema.String,
  matched_policy_ids: Schema.NullOr(Schema.Unknown), // UUID[] from postgres
  ip_address: Schema.NullOr(Schema.String),
  user_agent: Schema.NullOr(Schema.String),
  created_at: Schema.DateFromSelf
})
type AuditRow = typeof AuditRow.Type

/**
 * Parse matched_policy_ids from postgres UUID[]
 */
const parsePolicyIds = (value: unknown): PolicyId[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => PolicyId.make(v))
}

/**
 * Convert database row to AuthorizationDenialEntry domain entity
 */
const rowToEntry = (row: AuditRow): AuthorizationDenialEntry =>
  AuthorizationDenialEntry.make({
    id: Schema.decodeSync(Schema.UUID.pipe(Schema.brand("AuthorizationAuditId")))(row.id),
    userId: AuthUserId.make(row.user_id),
    organizationId: OrganizationId.make(row.organization_id),
    action: row.action,
    resourceType: row.resource_type,
    resourceId: Option.fromNullable(row.resource_id).pipe(Option.map(Schema.decodeSync(Schema.UUID))),
    denialReason: row.denial_reason,
    matchedPolicyIds: parsePolicyIds(row.matched_policy_ids),
    ipAddress: Option.fromNullable(row.ip_address),
    userAgent: Option.fromNullable(row.user_agent),
    createdAt: DateTime.unsafeMake(row.created_at.getTime())
  })

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Implementation of AuthorizationAuditRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const logDenial: AuthorizationAuditRepositoryService["logDenial"] = (entry) =>
    Effect.gen(function* () {
      const now = new Date()
      const policyIdsArray = entry.matchedPolicyIds?.length
        ? entry.matchedPolicyIds
        : null

      yield* sql`
        INSERT INTO authorization_audit_log (
          user_id, organization_id, action, resource_type, resource_id,
          denial_reason, matched_policy_ids, ip_address, user_agent, created_at
        ) VALUES (
          ${entry.userId},
          ${entry.organizationId},
          ${entry.action},
          ${entry.resourceType},
          ${entry.resourceId ?? null},
          ${entry.denialReason},
          ${policyIdsArray}::uuid[],
          ${entry.ipAddress ?? null},
          ${entry.userAgent ?? null},
          ${now}
        )
      `.pipe(wrapSqlError("logDenial"))
    })

  const findByOrganization: AuthorizationAuditRepositoryService["findByOrganization"] = (
    organizationId,
    options = {}
  ) =>
    Effect.gen(function* () {
      const limit = options.limit ?? 100
      const offset = options.offset ?? 0

      // Build a simple query with optional filters
      // For now, using a basic query - can be enhanced with date/action filters
      const findAuditEntries = SqlSchema.findAll({
        Request: Schema.Struct({
          organizationId: Schema.String,
          limit: Schema.Number,
          offset: Schema.Number
        }),
        Result: AuditRow,
        execute: (input) => sql`
          SELECT * FROM authorization_audit_log
          WHERE organization_id = ${input.organizationId}
          ORDER BY created_at DESC
          LIMIT ${input.limit} OFFSET ${input.offset}
        `
      })

      const rows = yield* findAuditEntries({ organizationId, limit, offset }).pipe(
        wrapSqlError("findByOrganization")
      )
      return rows.map(rowToEntry)
    })

  const findByUser: AuthorizationAuditRepositoryService["findByUser"] = (
    userId,
    options = {}
  ) =>
    Effect.gen(function* () {
      const limit = options.limit ?? 100
      const offset = options.offset ?? 0

      const findAuditEntries = SqlSchema.findAll({
        Request: Schema.Struct({
          userId: Schema.String,
          limit: Schema.Number,
          offset: Schema.Number
        }),
        Result: AuditRow,
        execute: (input) => sql`
          SELECT * FROM authorization_audit_log
          WHERE user_id = ${input.userId}
          ORDER BY created_at DESC
          LIMIT ${input.limit} OFFSET ${input.offset}
        `
      })

      const rows = yield* findAuditEntries({ userId, limit, offset }).pipe(
        wrapSqlError("findByUser")
      )
      return rows.map(rowToEntry)
    })

  const countByOrganization: AuthorizationAuditRepositoryService["countByOrganization"] = (
    organizationId,
    _options = {}
  ) =>
    Effect.gen(function* () {
      const countEntries = SqlSchema.single({
        Request: Schema.String,
        Result: CountRow,
        execute: (orgId) => sql`
          SELECT COUNT(*) as count FROM authorization_audit_log
          WHERE organization_id = ${orgId}
        `
      })

      const result = yield* countEntries(organizationId).pipe(wrapSqlError("countByOrganization"))
      return parseInt(result.count, 10)
    })

  return {
    logDenial,
    findByOrganization,
    findByUser,
    countByOrganization
  } satisfies AuthorizationAuditRepositoryService
})

/**
 * AuthorizationAuditRepositoryLive - Layer providing AuthorizationAuditRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const AuthorizationAuditRepositoryLive = Layer.effect(AuthorizationAuditRepository, make)
