/**
 * OrganizationRepositoryLive - PostgreSQL implementation of OrganizationRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module OrganizationRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  Organization,
  OrganizationId,
  OrganizationSettings
} from "@accountability/core/organization/Organization"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { OrganizationRepository, type OrganizationRepositoryService } from "../Services/OrganizationRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from organizations table
 */
const OrganizationRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  reporting_currency: Schema.String,
  created_at: Schema.DateFromSelf,
  settings: Schema.Struct({
    defaultLocale: Schema.optional(Schema.String),
    defaultTimezone: Schema.optional(Schema.String),
    defaultDecimalPlaces: Schema.optional(Schema.Number)
  })
})
type OrganizationRow = typeof OrganizationRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Convert database row to Organization domain entity
 * Pure function - no Effect wrapping needed
 */
const rowToOrganization = (row: OrganizationRow): Organization => {
  // Build settings object only with defined properties to satisfy exactOptionalPropertyTypes
  const settingsInput: {
    defaultLocale?: string
    defaultTimezone?: string
    defaultDecimalPlaces?: number
  } = {}

  if (row.settings.defaultLocale !== undefined) {
    settingsInput.defaultLocale = row.settings.defaultLocale
  }
  if (row.settings.defaultTimezone !== undefined) {
    settingsInput.defaultTimezone = row.settings.defaultTimezone
  }
  if (row.settings.defaultDecimalPlaces !== undefined) {
    settingsInput.defaultDecimalPlaces = row.settings.defaultDecimalPlaces
  }

  return Organization.make({
    id: OrganizationId.make(row.id),
    name: row.name,
    reportingCurrency: CurrencyCode.make(row.reporting_currency),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    settings: OrganizationSettings.make(settingsInput)
  })
}

/**
 * Implementation of OrganizationRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findOrganizationById = SqlSchema.findOne({
    Request: Schema.String,
    Result: OrganizationRow,
    execute: (id) => sql`SELECT * FROM organizations WHERE id = ${id}`
  })

  const findAllOrganizations = SqlSchema.findAll({
    Request: Schema.Void,
    Result: OrganizationRow,
    execute: () => sql`SELECT * FROM organizations ORDER BY name`
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM organizations WHERE id = ${id}`
  })

  const findById: OrganizationRepositoryService["findById"] = (id) =>
    findOrganizationById(id).pipe(
      Effect.map(Option.map(rowToOrganization)),
      wrapSqlError("findById")
    )

  const findAll: OrganizationRepositoryService["findAll"] = () =>
    findAllOrganizations(undefined).pipe(
      Effect.map((rows) => rows.map(rowToOrganization)),
      wrapSqlError("findAll")
    )

  const create: OrganizationRepositoryService["create"] = (organization) =>
    Effect.gen(function* () {
      const settingsJson = JSON.stringify({
        defaultLocale: organization.settings.defaultLocale,
        defaultTimezone: organization.settings.defaultTimezone,
        defaultDecimalPlaces: organization.settings.defaultDecimalPlaces
      })

      yield* sql`
        INSERT INTO organizations (id, name, reporting_currency, created_at, settings)
        VALUES (
          ${organization.id},
          ${organization.name},
          ${organization.reportingCurrency},
          ${organization.createdAt.toDate()},
          ${settingsJson}::jsonb
        )
      `.pipe(wrapSqlError("create"))

      return organization
    })

  const update: OrganizationRepositoryService["update"] = (organization) =>
    Effect.gen(function* () {
      // Check if organization exists first
      const existsResult = yield* exists(organization.id)
      if (!existsResult) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "Organization", entityId: organization.id })
        )
      }

      const settingsJson = JSON.stringify({
        defaultLocale: organization.settings.defaultLocale,
        defaultTimezone: organization.settings.defaultTimezone,
        defaultDecimalPlaces: organization.settings.defaultDecimalPlaces
      })

      yield* sql`
        UPDATE organizations SET
          name = ${organization.name},
          reporting_currency = ${organization.reportingCurrency},
          settings = ${settingsJson}::jsonb
        WHERE id = ${organization.id}
      `.pipe(wrapSqlError("update"))

      return organization
    })

  const delete_: OrganizationRepositoryService["delete"] = (id) =>
    Effect.gen(function* () {
      // Check if organization exists first
      const existsResult = yield* exists(id)
      if (!existsResult) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "Organization", entityId: id })
        )
      }

      yield* sql`
        DELETE FROM organizations WHERE id = ${id}
      `.pipe(wrapSqlError("delete"))
    })

  const getById: OrganizationRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeOrganization = yield* findById(id)
      return yield* Option.match(maybeOrganization, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "Organization", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const exists: OrganizationRepositoryService["exists"] = (id) =>
    countById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  return {
    findById,
    findAll,
    create,
    update,
    delete: delete_,
    getById,
    exists
  } satisfies OrganizationRepositoryService
})

/**
 * OrganizationRepositoryLive - Layer providing OrganizationRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const OrganizationRepositoryLive = Layer.effect(OrganizationRepository, make)
