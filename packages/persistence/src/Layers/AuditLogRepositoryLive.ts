/**
 * AuditLogRepositoryLive - PostgreSQL implementation of AuditLogRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module AuditLogRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Chunk from "effect/Chunk"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  AuditLogEntryId,
  AuditAction,
  AuditEntityType,
  AuditChanges
} from "@accountability/core/audit/AuditLog"
import { AuditDataCorruptionError } from "@accountability/core/audit/AuditLogErrors"
import {
  AuditLogRepository,
  type AuditLogRepositoryService,
  type AuditLogEntry
} from "../Services/AuditLogRepository.ts"
import { wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from audit_log table
 */
const AuditLogRow = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.NullOr(Schema.String),
  entity_type: AuditEntityType,
  entity_id: Schema.String,
  entity_name: Schema.NullOr(Schema.String),
  action: AuditAction,
  user_id: Schema.NullOr(Schema.String),
  user_display_name: Schema.NullOr(Schema.String),
  user_email: Schema.NullOr(Schema.String),
  timestamp: Schema.DateFromSelf,
  changes: Schema.NullOr(Schema.Unknown)
})
type AuditLogRow = typeof AuditLogRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Schema for parsing JSONB changes field to AuditChanges
 */
const AuditChangesFromUnknown = Schema.decodeUnknown(AuditChanges)

/**
 * Convert database row to AuditLogEntry domain entity
 *
 * Audit data integrity is critical for compliance. If we cannot parse
 * stored audit changes JSON, this indicates data corruption that must
 * be surfaced rather than silently ignored.
 */
const rowToAuditLogEntry = (row: AuditLogRow): Effect.Effect<AuditLogEntry, AuditDataCorruptionError, never> =>
  Effect.gen(function* () {
    // Parse changes from JSON - decode using schema for type safety
    // If the JSON is corrupted, fail with AuditDataCorruptionError
    const changesOption: Option.Option<AuditChanges> = row.changes !== null
      ? yield* AuditChangesFromUnknown(row.changes).pipe(
          Effect.map((c): Option.Option<AuditChanges> => Option.some(c)),
          Effect.mapError((cause) =>
            new AuditDataCorruptionError({
              entryId: row.id,
              field: "changes",
              cause
            })
          )
        )
      : Option.none<AuditChanges>()

    return {
      id: AuditLogEntryId.make(row.id),
      organizationId: row.organization_id ?? "",
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: Option.fromNullable(row.entity_name),
      action: row.action,
      userId: Option.fromNullable(row.user_id),
      userDisplayName: Option.fromNullable(row.user_display_name),
      userEmail: Option.fromNullable(row.user_email),
      timestamp: DateTime.unsafeMake(row.timestamp.getTime()),
      changes: changesOption
    }
  })

/**
 * Implementation of AuditLogRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findAll: AuditLogRepositoryService["findAll"] = (filter, pagination) =>
    Effect.gen(function* () {
      // Build dynamic WHERE conditions
      // Organization ID is REQUIRED for security - always first condition
      const conditions: string[] = [`organization_id = $1`]
      const values: unknown[] = [filter.organizationId]
      let paramIndex = 2

      if (Option.isSome(filter.entityType)) {
        conditions.push(`entity_type = $${paramIndex}`)
        values.push(filter.entityType.value)
        paramIndex++
      }

      if (Option.isSome(filter.entityId)) {
        conditions.push(`entity_id = $${paramIndex}`)
        values.push(filter.entityId.value)
        paramIndex++
      }

      if (Option.isSome(filter.userId)) {
        conditions.push(`user_id = $${paramIndex}`)
        values.push(filter.userId.value)
        paramIndex++
      }

      if (Option.isSome(filter.action)) {
        conditions.push(`action = $${paramIndex}`)
        values.push(filter.action.value)
        paramIndex++
      }

      if (Option.isSome(filter.fromDate)) {
        conditions.push(`timestamp >= $${paramIndex}`)
        values.push(new Date(filter.fromDate.value.epochMillis))
        paramIndex++
      }

      if (Option.isSome(filter.toDate)) {
        conditions.push(`timestamp <= $${paramIndex}`)
        values.push(new Date(filter.toDate.value.epochMillis))
        paramIndex++
      }

      if (Option.isSome(filter.search)) {
        const searchTerm = `%${filter.search.value}%`
        conditions.push(`(entity_name ILIKE $${paramIndex} OR entity_id ILIKE $${paramIndex})`)
        values.push(searchTerm)
        paramIndex++
      }

      const whereClause = `WHERE ${conditions.join(" AND ")}`

      // Use raw SQL with parameter substitution
      // Order by timestamp DESC and id DESC for deterministic ordering when timestamps are equal
      const query = sql.unsafe(
        `SELECT * FROM audit_log ${whereClause} ORDER BY timestamp DESC, id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, pagination.limit, pagination.offset]
      )

      const rows = yield* query.pipe(wrapSqlError("findAll"))
      const decoded = yield* Schema.decodeUnknown(Schema.Array(AuditLogRow))(rows).pipe(
        wrapSqlError("findAll")
      )

      const entries = yield* Effect.all(decoded.map(rowToAuditLogEntry))
      return Chunk.fromIterable(entries)
    })

  const count: AuditLogRepositoryService["count"] = (filter) =>
    Effect.gen(function* () {
      // Build dynamic WHERE conditions
      // Organization ID is REQUIRED for security - always first condition
      const conditions: string[] = [`organization_id = $1`]
      const values: unknown[] = [filter.organizationId]
      let paramIndex = 2

      if (Option.isSome(filter.entityType)) {
        conditions.push(`entity_type = $${paramIndex}`)
        values.push(filter.entityType.value)
        paramIndex++
      }

      if (Option.isSome(filter.entityId)) {
        conditions.push(`entity_id = $${paramIndex}`)
        values.push(filter.entityId.value)
        paramIndex++
      }

      if (Option.isSome(filter.userId)) {
        conditions.push(`user_id = $${paramIndex}`)
        values.push(filter.userId.value)
        paramIndex++
      }

      if (Option.isSome(filter.action)) {
        conditions.push(`action = $${paramIndex}`)
        values.push(filter.action.value)
        paramIndex++
      }

      if (Option.isSome(filter.fromDate)) {
        conditions.push(`timestamp >= $${paramIndex}`)
        values.push(new Date(filter.fromDate.value.epochMillis))
        paramIndex++
      }

      if (Option.isSome(filter.toDate)) {
        conditions.push(`timestamp <= $${paramIndex}`)
        values.push(new Date(filter.toDate.value.epochMillis))
        paramIndex++
      }

      if (Option.isSome(filter.search)) {
        const searchTerm = `%${filter.search.value}%`
        conditions.push(`(entity_name ILIKE $${paramIndex} OR entity_id ILIKE $${paramIndex})`)
        values.push(searchTerm)
        paramIndex++
      }

      const whereClause = `WHERE ${conditions.join(" AND ")}`

      const query = sql.unsafe(
        `SELECT COUNT(*) as count FROM audit_log ${whereClause}`,
        values
      )

      const result = yield* query.pipe(wrapSqlError("count"))
      const decoded = yield* Schema.decodeUnknown(Schema.Array(CountRow))(result).pipe(
        wrapSqlError("count")
      )

      return decoded.length > 0 ? parseInt(decoded[0].count, 10) : 0
    })

  // SqlSchema query builder for entity-specific queries
  // Order by timestamp DESC and id DESC for deterministic ordering when timestamps are equal
  const findByEntityQuery = SqlSchema.findAll({
    Request: Schema.Struct({ entityType: AuditEntityType, entityId: Schema.String }),
    Result: AuditLogRow,
    execute: (params) => sql`
      SELECT * FROM audit_log
      WHERE entity_type = ${params.entityType}
        AND entity_id = ${params.entityId}
      ORDER BY timestamp DESC, id DESC
    `
  })

  const findByEntity: AuditLogRepositoryService["findByEntity"] = (entityType, entityId) =>
    findByEntityQuery({ entityType, entityId }).pipe(
      Effect.flatMap((rows) => Effect.all(rows.map(rowToAuditLogEntry))),
      Effect.map((entries) => Chunk.fromIterable(entries)),
      wrapSqlError("findByEntity")
    )

  const create: AuditLogRepositoryService["create"] = (entry) =>
    Effect.gen(function* () {
      const now = new Date()
      const userIdValue = Option.getOrNull(entry.userId)
      const userDisplayNameValue = Option.getOrNull(entry.userDisplayName)
      const userEmailValue = Option.getOrNull(entry.userEmail)
      const entityNameValue = Option.getOrNull(entry.entityName)
      const changesValue = Option.match(entry.changes, {
        onNone: () => null,
        onSome: (c) => JSON.stringify(c)
      })

      const result = yield* sql`
        INSERT INTO audit_log (
          organization_id, entity_type, entity_id, entity_name, action, user_id, user_display_name, user_email, timestamp, changes
        ) VALUES (
          ${entry.organizationId},
          ${entry.entityType},
          ${entry.entityId},
          ${entityNameValue},
          ${entry.action},
          ${userIdValue},
          ${userDisplayNameValue},
          ${userEmailValue},
          ${now},
          ${changesValue}::jsonb
        )
        RETURNING *
      `.pipe(wrapSqlError("create"))

      const decoded = yield* Schema.decodeUnknown(Schema.Array(AuditLogRow))(result).pipe(
        wrapSqlError("create")
      )

      if (decoded.length === 0) {
        return yield* Effect.die(new Error("Failed to create audit log entry"))
      }

      return yield* rowToAuditLogEntry(decoded[0])
    })

  return {
    findAll,
    count,
    findByEntity,
    create
  } satisfies AuditLogRepositoryService
})

/**
 * AuditLogRepositoryLive - Layer providing AuditLogRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const AuditLogRepositoryLive = Layer.effect(AuditLogRepository, make)
