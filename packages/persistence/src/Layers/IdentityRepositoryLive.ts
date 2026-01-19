/**
 * IdentityRepositoryLive - PostgreSQL implementation of IdentityRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module IdentityRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { UserIdentity, UserIdentityId, ProviderData } from "@accountability/core/authentication/UserIdentity"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { AuthProviderType } from "@accountability/core/authentication/AuthProviderType"
import { ProviderId } from "@accountability/core/authentication/ProviderId"
import { HashedPassword } from "@accountability/core/authentication/HashedPassword"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { IdentityRepository, type IdentityRepositoryService } from "../Services/IdentityRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from auth_identities table
 */
const UserIdentityRow = Schema.Struct({
  id: Schema.String,
  user_id: Schema.String,
  provider: AuthProviderType,
  provider_id: Schema.String,
  provider_data: Schema.NullOr(Schema.Unknown),
  created_at: Schema.DateFromSelf
})
type UserIdentityRow = typeof UserIdentityRow.Type

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
 * Schema for password hash query result
 */
const PasswordHashRow = Schema.Struct({
  password_hash: Schema.NullOr(Schema.String)
})

/**
 * Convert database row to UserIdentity domain entity
 * Pure function - no Effect wrapping needed
 */
const rowToUserIdentity = (row: UserIdentityRow): UserIdentity =>
  UserIdentity.make({
    id: UserIdentityId.make(row.id),
    userId: AuthUserId.make(row.user_id),
    provider: row.provider,
    providerId: ProviderId.make(row.provider_id),
    providerData: Option.fromNullable(row.provider_data).pipe(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSONB from DB is typed as unknown but validated on write
      Option.map((data) => ProviderData.make(data as typeof ProviderData.Type))
    ),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() })
  })

/**
 * Implementation of IdentityRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findIdentityById = SqlSchema.findOne({
    Request: Schema.String,
    Result: UserIdentityRow,
    execute: (id) => sql`SELECT * FROM auth_identities WHERE id = ${id}`
  })

  const findIdentitiesByUserId = SqlSchema.findAll({
    Request: Schema.String,
    Result: UserIdentityRow,
    execute: (userId) => sql`SELECT * FROM auth_identities WHERE user_id = ${userId}`
  })

  const findIdentityByProvider = SqlSchema.findOne({
    Request: Schema.Struct({ provider: Schema.String, providerId: Schema.String }),
    Result: UserIdentityRow,
    execute: (req) => sql`
      SELECT * FROM auth_identities
      WHERE provider = ${req.provider} AND provider_id = ${req.providerId}
    `
  })

  const findIdentityByUserAndProvider = SqlSchema.findOne({
    Request: Schema.Struct({ userId: Schema.String, provider: Schema.String }),
    Result: UserIdentityRow,
    execute: (req) => sql`
      SELECT * FROM auth_identities
      WHERE user_id = ${req.userId} AND provider = ${req.provider}
    `
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM auth_identities WHERE id = ${id}`
  })

  const findById: IdentityRepositoryService["findById"] = (id) =>
    findIdentityById(id).pipe(
      Effect.map(Option.map(rowToUserIdentity)),
      wrapSqlError("findById")
    )

  const findByUserId: IdentityRepositoryService["findByUserId"] = (userId) =>
    findIdentitiesByUserId(userId).pipe(
      Effect.map((rows) => Chunk.fromIterable(rows.map(rowToUserIdentity))),
      wrapSqlError("findByUserId")
    )

  const findByProvider: IdentityRepositoryService["findByProvider"] = (provider, providerId) =>
    findIdentityByProvider({ provider, providerId }).pipe(
      Effect.map(Option.map(rowToUserIdentity)),
      wrapSqlError("findByProvider")
    )

  const findByUserAndProvider: IdentityRepositoryService["findByUserAndProvider"] = (userId, provider) =>
    findIdentityByUserAndProvider({ userId, provider }).pipe(
      Effect.map(Option.map(rowToUserIdentity)),
      wrapSqlError("findByUserAndProvider")
    )

  const create: IdentityRepositoryService["create"] = (identity) =>
    Effect.gen(function* () {
      const now = new Date()
      const providerDataJson = Option.match(identity.providerData, {
        onNone: () => null,
        onSome: (data) => JSON.stringify(data)
      })
      // passwordHash is optional (only for local provider)
      const passwordHash = identity.passwordHash ?? null

      yield* sql`
        INSERT INTO auth_identities (
          id, user_id, provider, provider_id, password_hash, provider_data, created_at
        ) VALUES (
          ${identity.id},
          ${identity.userId},
          ${identity.provider},
          ${identity.providerId},
          ${passwordHash},
          ${providerDataJson},
          ${now}
        )
      `.pipe(wrapSqlError("create"))

      // Return the created identity
      return UserIdentity.make({
        id: identity.id,
        userId: identity.userId,
        provider: identity.provider,
        providerId: identity.providerId,
        providerData: identity.providerData,
        createdAt: Timestamp.make({ epochMillis: now.getTime() })
      })
    })

  const update: IdentityRepositoryService["update"] = (id, data) =>
    Effect.gen(function* () {
      // First check if identity exists
      const existsResult = yield* countById(id).pipe(wrapSqlError("update"))
      if (parseInt(existsResult.count, 10) === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "UserIdentity", entityId: id })
        )
      }

      // Only providerData can be updated
      if (data.providerData !== undefined) {
        const providerDataJson = Option.match(data.providerData, {
          onNone: () => null,
          onSome: (pd) => JSON.stringify(pd)
        })
        yield* sql`
          UPDATE auth_identities
          SET provider_data = ${providerDataJson}
          WHERE id = ${id}
        `.pipe(wrapSqlError("update"))
      }

      // Fetch and return the updated identity
      const maybeIdentity = yield* findById(id)
      return yield* Option.match(maybeIdentity, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "UserIdentity", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const deleteIdentity: IdentityRepositoryService["delete"] = (id) =>
    sql`DELETE FROM auth_identities WHERE id = ${id}`.pipe(
      Effect.map(() => undefined),
      wrapSqlError("delete")
    )

  const deleteByUserId: IdentityRepositoryService["deleteByUserId"] = (userId) =>
    Effect.gen(function* () {
      // Use a raw query to get affected row count
      const result = yield* sql`
        WITH deleted AS (
          DELETE FROM auth_identities WHERE user_id = ${userId} RETURNING *
        )
        SELECT COUNT(*)::int as affected FROM deleted
      `.pipe(wrapSqlError("deleteByUserId"))

      // Extract count from result
      const decoded = yield* Schema.decodeUnknown(Schema.Array(AffectedRow))(result).pipe(
        wrapSqlError("deleteByUserId")
      )
      return decoded.length > 0 ? decoded[0].affected : 0
    })

  // Query builder for password hash lookup
  const findPasswordHashByProvider = SqlSchema.findOne({
    Request: Schema.Struct({ provider: Schema.String, providerId: Schema.String }),
    Result: PasswordHashRow,
    execute: (req) => sql`
      SELECT password_hash FROM auth_identities
      WHERE provider = ${req.provider} AND provider_id = ${req.providerId}
    `
  })

  const getPasswordHash: IdentityRepositoryService["getPasswordHash"] = (provider, providerId) =>
    findPasswordHashByProvider({ provider, providerId }).pipe(
      Effect.map((maybeRow) =>
        Option.flatMap(maybeRow, (row) =>
          Option.fromNullable(row.password_hash).pipe(
            Option.map((hash) => HashedPassword.make(hash))
          )
        )
      ),
      wrapSqlError("getPasswordHash")
    )

  const updatePasswordHash: IdentityRepositoryService["updatePasswordHash"] = (provider, providerId, newPasswordHash) =>
    Effect.gen(function* () {
      // First check if identity exists
      const maybeIdentity = yield* findByProvider(provider, providerId)
      if (Option.isNone(maybeIdentity)) {
        return yield* Effect.fail(
          new EntityNotFoundError({
            entityType: "UserIdentity",
            entityId: `${provider}:${providerId}`
          })
        )
      }

      // Update the password hash
      yield* sql`
        UPDATE auth_identities
        SET password_hash = ${newPasswordHash}
        WHERE provider = ${provider} AND provider_id = ${providerId}
      `.pipe(wrapSqlError("updatePasswordHash"))
    })

  return {
    findById,
    findByUserId,
    findByProvider,
    findByUserAndProvider,
    create,
    update,
    delete: deleteIdentity,
    deleteByUserId,
    getPasswordHash,
    updatePasswordHash
  } satisfies IdentityRepositoryService
})

/**
 * IdentityRepositoryLive - Layer providing IdentityRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const IdentityRepositoryLive = Layer.effect(IdentityRepository, make)
