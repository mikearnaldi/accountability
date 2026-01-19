/**
 * UserRepositoryLive - PostgreSQL implementation of UserRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module UserRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AuthUser, UserRole } from "@accountability/core/authentication/AuthUser"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { AuthProviderType } from "@accountability/core/authentication/AuthProviderType"
import { Email } from "@accountability/core/authentication/Email"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { UserRepository, type UserRepositoryService } from "../Services/UserRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from auth_users table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const AuthUserRow = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  display_name: Schema.String,
  role: UserRole,
  primary_provider: AuthProviderType,
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf
})
type AuthUserRow = typeof AuthUserRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Schema for platform admin row from auth_users table
 * Includes is_platform_admin column
 */
const PlatformAdminRow = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  display_name: Schema.String,
  role: UserRole,
  primary_provider: AuthProviderType,
  is_platform_admin: Schema.Boolean,
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf
})

/**
 * Convert database row to AuthUser domain entity
 * Pure function - no Effect wrapping needed
 */
const rowToAuthUser = (row: AuthUserRow): AuthUser =>
  AuthUser.make({
    id: AuthUserId.make(row.id),
    email: Email.make(row.email),
    displayName: row.display_name,
    role: row.role,
    primaryProvider: row.primary_provider,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    updatedAt: Timestamp.make({ epochMillis: row.updated_at.getTime() })
  })

/**
 * Implementation of UserRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findUserById = SqlSchema.findOne({
    Request: Schema.String,
    Result: AuthUserRow,
    execute: (id) => sql`SELECT * FROM auth_users WHERE id = ${id}`
  })

  const findUserByEmail = SqlSchema.findOne({
    Request: Schema.String,
    Result: AuthUserRow,
    execute: (email) => sql`SELECT * FROM auth_users WHERE LOWER(email) = LOWER(${email})`
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM auth_users WHERE id = ${id}`
  })

  const findById: UserRepositoryService["findById"] = (id) =>
    findUserById(id).pipe(
      Effect.map(Option.map(rowToAuthUser)),
      wrapSqlError("findById")
    )

  const findByEmail: UserRepositoryService["findByEmail"] = (email) =>
    findUserByEmail(email).pipe(
      Effect.map(Option.map(rowToAuthUser)),
      wrapSqlError("findByEmail")
    )

  const create: UserRepositoryService["create"] = (user) =>
    Effect.gen(function* () {
      const now = new Date()
      yield* sql`
        INSERT INTO auth_users (
          id, email, display_name, role, primary_provider, created_at, updated_at
        ) VALUES (
          ${user.id},
          ${user.email},
          ${user.displayName},
          ${user.role},
          ${user.primaryProvider},
          ${now},
          ${now}
        )
      `.pipe(wrapSqlError("create"))

      // Return the created user
      return AuthUser.make({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        primaryProvider: user.primaryProvider,
        createdAt: Timestamp.make({ epochMillis: now.getTime() }),
        updatedAt: Timestamp.make({ epochMillis: now.getTime() })
      })
    })

  const update: UserRepositoryService["update"] = (id, data) =>
    Effect.gen(function* () {
      // First check if user exists
      const existsResult = yield* countById(id).pipe(wrapSqlError("update"))
      if (parseInt(existsResult.count, 10) === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "AuthUser", entityId: id })
        )
      }

      // Build dynamic update query based on provided fields
      const updates: string[] = []
      const values: unknown[] = []

      if (data.email !== undefined) {
        updates.push("email")
        values.push(data.email)
      }
      if (data.displayName !== undefined) {
        updates.push("display_name")
        values.push(data.displayName)
      }
      if (data.role !== undefined) {
        updates.push("role")
        values.push(data.role)
      }
      if (data.primaryProvider !== undefined) {
        updates.push("primary_provider")
        values.push(data.primaryProvider)
      }

      // If there are fields to update, execute the update
      if (updates.length > 0) {
        // Build SET clause dynamically
        if (data.email !== undefined && data.displayName !== undefined && data.role !== undefined && data.primaryProvider !== undefined) {
          yield* sql`
            UPDATE auth_users SET
              email = ${data.email},
              display_name = ${data.displayName},
              role = ${data.role},
              primary_provider = ${data.primaryProvider}
            WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.email !== undefined && data.displayName !== undefined && data.role !== undefined) {
          yield* sql`
            UPDATE auth_users SET
              email = ${data.email},
              display_name = ${data.displayName},
              role = ${data.role}
            WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.email !== undefined && data.displayName !== undefined) {
          yield* sql`
            UPDATE auth_users SET
              email = ${data.email},
              display_name = ${data.displayName}
            WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.email !== undefined && data.role !== undefined) {
          yield* sql`
            UPDATE auth_users SET
              email = ${data.email},
              role = ${data.role}
            WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.displayName !== undefined && data.role !== undefined) {
          yield* sql`
            UPDATE auth_users SET
              display_name = ${data.displayName},
              role = ${data.role}
            WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.email !== undefined) {
          yield* sql`
            UPDATE auth_users SET email = ${data.email} WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.displayName !== undefined) {
          yield* sql`
            UPDATE auth_users SET display_name = ${data.displayName} WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.role !== undefined) {
          yield* sql`
            UPDATE auth_users SET role = ${data.role} WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        } else if (data.primaryProvider !== undefined) {
          yield* sql`
            UPDATE auth_users SET primary_provider = ${data.primaryProvider} WHERE id = ${id}
          `.pipe(wrapSqlError("update"))
        }
      }

      // Fetch and return the updated user
      const maybeUser = yield* findById(id)
      return yield* Option.match(maybeUser, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "AuthUser", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const deleteUser: UserRepositoryService["delete"] = (id) =>
    Effect.gen(function* () {
      // First check if user exists
      const existsResult = yield* countById(id).pipe(wrapSqlError("delete"))
      if (parseInt(existsResult.count, 10) === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "AuthUser", entityId: id })
        )
      }

      yield* sql`DELETE FROM auth_users WHERE id = ${id}`.pipe(wrapSqlError("delete"))
    })

  const findPlatformAdminsQuery = SqlSchema.findAll({
    Request: Schema.Void,
    Result: PlatformAdminRow,
    execute: () => sql`
      SELECT id, email, display_name, role, primary_provider, is_platform_admin, created_at, updated_at
      FROM auth_users
      WHERE is_platform_admin = true
      ORDER BY email ASC
    `
  })

  const findPlatformAdmins: UserRepositoryService["findPlatformAdmins"] = () =>
    findPlatformAdminsQuery(undefined).pipe(
      Effect.map((rows) => rows.map(rowToAuthUser)),
      wrapSqlError("findPlatformAdmins")
    )

  const isPlatformAdminQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: Schema.Struct({ is_platform_admin: Schema.Boolean }),
    execute: (id) => sql`SELECT is_platform_admin FROM auth_users WHERE id = ${id}`
  })

  const isPlatformAdmin: UserRepositoryService["isPlatformAdmin"] = (id) =>
    isPlatformAdminQuery(id).pipe(
      Effect.map((maybeRow) =>
        Option.match(maybeRow, {
          onNone: () => false,
          onSome: (row) => row.is_platform_admin
        })
      ),
      wrapSqlError("isPlatformAdmin")
    )

  return {
    findById,
    findByEmail,
    create,
    update,
    delete: deleteUser,
    findPlatformAdmins,
    isPlatformAdmin
  } satisfies UserRepositoryService
})

/**
 * UserRepositoryLive - Layer providing UserRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const UserRepositoryLive = Layer.effect(UserRepository, make)
