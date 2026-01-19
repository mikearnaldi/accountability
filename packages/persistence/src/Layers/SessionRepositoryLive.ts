/**
 * SessionRepositoryLive - PostgreSQL implementation of SessionRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module SessionRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Session, UserAgent } from "@accountability/core/authentication/Session"
import { SessionId } from "@accountability/core/authentication/SessionId"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { AuthProviderType } from "@accountability/core/authentication/AuthProviderType"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { SessionRepository, type SessionRepositoryService } from "../Services/SessionRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from auth_sessions table
 */
const SessionRow = Schema.Struct({
  id: Schema.String,
  user_id: Schema.String,
  provider: AuthProviderType,
  expires_at: Schema.DateFromSelf,
  created_at: Schema.DateFromSelf,
  user_agent: Schema.NullOr(Schema.String)
})
type SessionRow = typeof SessionRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Schema for affected rows result
 */
const AffectedRow = Schema.Struct({
  affected: Schema.Number
})

/**
 * Convert database row to Session domain entity
 * Pure function - no Effect wrapping needed
 */
const rowToSession = (row: SessionRow): Session =>
  Session.make({
    id: SessionId.make(row.id),
    userId: AuthUserId.make(row.user_id),
    provider: row.provider,
    expiresAt: Timestamp.make({ epochMillis: row.expires_at.getTime() }),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    userAgent: Option.fromNullable(row.user_agent).pipe(
      Option.map((ua) => UserAgent.make(ua))
    )
  })

/**
 * Implementation of SessionRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findSessionById = SqlSchema.findOne({
    Request: Schema.String,
    Result: SessionRow,
    execute: (id) => sql`SELECT * FROM auth_sessions WHERE id = ${id}`
  })

  const findSessionsByUserId = SqlSchema.findAll({
    Request: Schema.String,
    Result: SessionRow,
    execute: (userId) => sql`SELECT * FROM auth_sessions WHERE user_id = ${userId}`
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM auth_sessions WHERE id = ${id}`
  })

  const findById: SessionRepositoryService["findById"] = (id) =>
    findSessionById(id).pipe(
      Effect.map(Option.map(rowToSession)),
      wrapSqlError("findById")
    )

  const findByUserId: SessionRepositoryService["findByUserId"] = (userId) =>
    findSessionsByUserId(userId).pipe(
      Effect.map((rows) => Chunk.fromIterable(rows.map(rowToSession))),
      wrapSqlError("findByUserId")
    )

  const create: SessionRepositoryService["create"] = (session) =>
    Effect.gen(function* () {
      const now = new Date()
      const expiresAtDate = session.expiresAt.toDate()
      const userAgentValue = Option.getOrNull(session.userAgent)

      yield* sql`
        INSERT INTO auth_sessions (
          id, user_id, provider, expires_at, created_at, user_agent
        ) VALUES (
          ${session.id},
          ${session.userId},
          ${session.provider},
          ${expiresAtDate},
          ${now},
          ${userAgentValue}
        )
      `.pipe(wrapSqlError("create"))

      // Return the created session
      return Session.make({
        id: session.id,
        userId: session.userId,
        provider: session.provider,
        expiresAt: session.expiresAt,
        createdAt: Timestamp.make({ epochMillis: now.getTime() }),
        userAgent: session.userAgent
      })
    })

  const deleteSession: SessionRepositoryService["delete"] = (id) =>
    sql`DELETE FROM auth_sessions WHERE id = ${id}`.pipe(
      Effect.map(() => undefined),
      wrapSqlError("delete")
    )

  const deleteExpired: SessionRepositoryService["deleteExpired"] = () =>
    Effect.gen(function* () {
      const now = new Date()
      const result = yield* sql`
        WITH deleted AS (
          DELETE FROM auth_sessions WHERE expires_at <= ${now} RETURNING *
        )
        SELECT COUNT(*)::int as affected FROM deleted
      `.pipe(wrapSqlError("deleteExpired"))

      // Extract count from result
      const decoded = yield* Schema.decodeUnknown(Schema.Array(AffectedRow))(result).pipe(
        wrapSqlError("deleteExpired")
      )
      return decoded.length > 0 ? decoded[0].affected : 0
    })

  const deleteByUserId: SessionRepositoryService["deleteByUserId"] = (userId) =>
    Effect.gen(function* () {
      const result = yield* sql`
        WITH deleted AS (
          DELETE FROM auth_sessions WHERE user_id = ${userId} RETURNING *
        )
        SELECT COUNT(*)::int as affected FROM deleted
      `.pipe(wrapSqlError("deleteByUserId"))

      // Extract count from result
      const decoded = yield* Schema.decodeUnknown(Schema.Array(AffectedRow))(result).pipe(
        wrapSqlError("deleteByUserId")
      )
      return decoded.length > 0 ? decoded[0].affected : 0
    })

  const updateExpiry: SessionRepositoryService["updateExpiry"] = (id, expiresAt) =>
    Effect.gen(function* () {
      // First check if session exists
      const existsResult = yield* countById(id).pipe(wrapSqlError("updateExpiry"))
      if (parseInt(existsResult.count, 10) === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "Session", entityId: id })
        )
      }

      const expiresAtDate = expiresAt.toDate()
      yield* sql`
        UPDATE auth_sessions
        SET expires_at = ${expiresAtDate}
        WHERE id = ${id}
      `.pipe(wrapSqlError("updateExpiry"))

      // Fetch and return the updated session
      const maybeSession = yield* findById(id)
      return yield* Option.match(maybeSession, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "Session", entityId: id })),
        onSome: Effect.succeed
      })
    })

  return {
    findById,
    findByUserId,
    create,
    delete: deleteSession,
    deleteExpired,
    deleteByUserId,
    updateExpiry
  } satisfies SessionRepositoryService
})

/**
 * SessionRepositoryLive - Layer providing SessionRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const SessionRepositoryLive = Layer.effect(SessionRepository, make)
