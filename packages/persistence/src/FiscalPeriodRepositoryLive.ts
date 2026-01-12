/**
 * FiscalPeriodRepositoryLive - PostgreSQL implementation of FiscalPeriodRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module FiscalPeriodRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CompanyId } from "@accountability/core/domain/Company"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { UserId } from "@accountability/core/domain/JournalEntry"
import {
  FiscalPeriod,
  FiscalPeriodId,
  FiscalPeriodStatus,
  FiscalPeriodType,
  FiscalYear,
  FiscalYearId,
  FiscalYearStatus
} from "@accountability/core/services/PeriodService"
import { FiscalPeriodRepository, type FiscalPeriodRepositoryService } from "./Services/FiscalPeriodRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "./RepositoryError.ts"

/**
 * Schema for database row from fiscal_years table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const FiscalYearRow = Schema.Struct({
  id: Schema.String,
  company_id: Schema.String,
  name: Schema.String,
  year: Schema.Number,
  start_date: Schema.DateFromSelf,
  end_date: Schema.DateFromSelf,
  status: FiscalYearStatus,
  includes_adjustment_period: Schema.Boolean,
  created_at: Schema.DateFromSelf
})
type FiscalYearRow = typeof FiscalYearRow.Type

/**
 * Schema for database row from fiscal_periods table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const FiscalPeriodRow = Schema.Struct({
  id: Schema.String,
  fiscal_year_id: Schema.String,
  period_number: Schema.Number,
  name: Schema.String,
  period_type: FiscalPeriodType,
  start_date: Schema.DateFromSelf,
  end_date: Schema.DateFromSelf,
  status: FiscalPeriodStatus,
  closed_by: Schema.NullOr(Schema.String),
  closed_at: Schema.NullOr(Schema.DateFromSelf)
})
type FiscalPeriodRow = typeof FiscalPeriodRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Convert Date to LocalDate
 * Pure function - no validation needed, values come from database
 */
const dateToLocalDate = (date: Date): LocalDate =>
  LocalDate.make({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })

/**
 * Convert database row to FiscalYear domain entity
 * Pure function - no Effect wrapping needed
 * Since the row schema uses proper literal types, no type assertions needed
 */
const rowToFiscalYear = (row: FiscalYearRow): FiscalYear =>
  FiscalYear.make({
    id: FiscalYearId.make(row.id),
    companyId: CompanyId.make(row.company_id),
    name: row.name,
    year: row.year,
    startDate: dateToLocalDate(row.start_date),
    endDate: dateToLocalDate(row.end_date),
    status: row.status,
    includesAdjustmentPeriod: row.includes_adjustment_period,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() })
  })

/**
 * Convert database row to FiscalPeriod domain entity
 * Pure function - no Effect wrapping needed
 * Since the row schema uses proper literal types, no type assertions needed
 */
const rowToFiscalPeriod = (row: FiscalPeriodRow): FiscalPeriod =>
  FiscalPeriod.make({
    id: FiscalPeriodId.make(row.id),
    fiscalYearId: FiscalYearId.make(row.fiscal_year_id),
    periodNumber: row.period_number,
    name: row.name,
    periodType: row.period_type,
    startDate: dateToLocalDate(row.start_date),
    endDate: dateToLocalDate(row.end_date),
    status: row.status,
    closedBy: Option.fromNullable(row.closed_by).pipe(
      Option.map(UserId.make)
    ),
    closedAt: Option.fromNullable(row.closed_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    )
  })

/**
 * Implementation of FiscalPeriodRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for FiscalPeriod
  const findPeriodById = SqlSchema.findOne({
    Request: Schema.String,
    Result: FiscalPeriodRow,
    execute: (id) => sql`SELECT * FROM fiscal_periods WHERE id = ${id}`
  })

  const findPeriodsByCompany = SqlSchema.findAll({
    Request: Schema.String,
    Result: FiscalPeriodRow,
    execute: (companyId) => sql`
      SELECT fp.* FROM fiscal_periods fp
      JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
      WHERE fy.company_id = ${companyId}
      ORDER BY fy.year DESC, fp.period_number
    `
  })

  const findOpenPeriodsByCompany = SqlSchema.findAll({
    Request: Schema.String,
    Result: FiscalPeriodRow,
    execute: (companyId) => sql`
      SELECT fp.* FROM fiscal_periods fp
      JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
      WHERE fy.company_id = ${companyId} AND fp.status = 'Open'
      ORDER BY fy.year, fp.period_number
    `
  })

  const findPeriodsByFiscalYear = SqlSchema.findAll({
    Request: Schema.String,
    Result: FiscalPeriodRow,
    execute: (fiscalYearId) => sql`
      SELECT * FROM fiscal_periods
      WHERE fiscal_year_id = ${fiscalYearId}
      ORDER BY period_number
    `
  })

  const findPeriodsByCompanyAndStatus = SqlSchema.findAll({
    Request: Schema.Struct({ companyId: Schema.String, status: Schema.String }),
    Result: FiscalPeriodRow,
    execute: ({ companyId, status }) => sql`
      SELECT fp.* FROM fiscal_periods fp
      JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
      WHERE fy.company_id = ${companyId} AND fp.status = ${status}
      ORDER BY fy.year, fp.period_number
    `
  })

  const findCurrentPeriodQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: FiscalPeriodRow,
    execute: (companyId) => sql`
      SELECT fp.* FROM fiscal_periods fp
      JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
      WHERE fy.company_id = ${companyId}
        AND fp.status = 'Open'
        AND fp.start_date <= CURRENT_DATE
        AND fp.end_date >= CURRENT_DATE
      ORDER BY fp.period_number
      LIMIT 1
    `
  })

  const findByCompanyAndPeriodQuery = SqlSchema.findOne({
    Request: Schema.Struct({
      companyId: Schema.String,
      year: Schema.Number,
      periodNumber: Schema.Number
    }),
    Result: FiscalPeriodRow,
    execute: ({ companyId, year, periodNumber }) => sql`
      SELECT fp.* FROM fiscal_periods fp
      JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
      WHERE fy.company_id = ${companyId}
        AND fy.year = ${year}
        AND fp.period_number = ${periodNumber}
    `
  })

  const countPeriodById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM fiscal_periods WHERE id = ${id}`
  })

  // SqlSchema query builders for FiscalYear
  const findFiscalYearById = SqlSchema.findOne({
    Request: Schema.String,
    Result: FiscalYearRow,
    execute: (id) => sql`SELECT * FROM fiscal_years WHERE id = ${id}`
  })

  const findFiscalYearsByCompany = SqlSchema.findAll({
    Request: Schema.String,
    Result: FiscalYearRow,
    execute: (companyId) => sql`
      SELECT * FROM fiscal_years
      WHERE company_id = ${companyId}
      ORDER BY year DESC
    `
  })

  const findFiscalYearByCompanyAndYear = SqlSchema.findOne({
    Request: Schema.Struct({ companyId: Schema.String, year: Schema.Number }),
    Result: FiscalYearRow,
    execute: ({ companyId, year }) => sql`
      SELECT * FROM fiscal_years
      WHERE company_id = ${companyId} AND year = ${year}
    `
  })

  const findOpenFiscalYearsQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: FiscalYearRow,
    execute: (companyId) => sql`
      SELECT * FROM fiscal_years
      WHERE company_id = ${companyId} AND status = 'Open'
      ORDER BY year DESC
    `
  })

  const countFiscalYearById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM fiscal_years WHERE id = ${id}`
  })

  // FiscalPeriod operations
  const findById: FiscalPeriodRepositoryService["findById"] = (id) =>
    findPeriodById(id).pipe(
      Effect.map(Option.map(rowToFiscalPeriod)),
      wrapSqlError("findById")
    )

  const findByCompany: FiscalPeriodRepositoryService["findByCompany"] = (companyId) =>
    findPeriodsByCompany(companyId).pipe(
      Effect.map((rows) => rows.map(rowToFiscalPeriod)),
      wrapSqlError("findByCompany")
    )

  const findOpen: FiscalPeriodRepositoryService["findOpen"] = (companyId) =>
    findOpenPeriodsByCompany(companyId).pipe(
      Effect.map((rows) => rows.map(rowToFiscalPeriod)),
      wrapSqlError("findOpen")
    )

  const create: FiscalPeriodRepositoryService["create"] = (period) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO fiscal_periods (
          id, fiscal_year_id, period_number, name, period_type,
          start_date, end_date, status, closed_by, closed_at
        ) VALUES (
          ${period.id},
          ${period.fiscalYearId},
          ${period.periodNumber},
          ${period.name},
          ${period.periodType},
          ${period.startDate.toDate()},
          ${period.endDate.toDate()},
          ${period.status},
          ${Option.getOrNull(period.closedBy)},
          ${Option.match(period.closedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        )
      `.pipe(wrapSqlError("create"))

      return period
    })

  const update: FiscalPeriodRepositoryService["update"] = (period) =>
    Effect.gen(function* () {
      const result = yield* sql`
        UPDATE fiscal_periods SET
          name = ${period.name},
          period_type = ${period.periodType},
          start_date = ${period.startDate.toDate()},
          end_date = ${period.endDate.toDate()},
          status = ${period.status},
          closed_by = ${Option.getOrNull(period.closedBy)},
          closed_at = ${Option.match(period.closedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        WHERE id = ${period.id}
      `.pipe(wrapSqlError("update"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "FiscalPeriod", entityId: period.id })
        )
      }

      return period
    })

  const getById: FiscalPeriodRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybePeriod = yield* findById(id)
      return yield* Option.match(maybePeriod, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "FiscalPeriod", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findByFiscalYear: FiscalPeriodRepositoryService["findByFiscalYear"] = (fiscalYearId) =>
    findPeriodsByFiscalYear(fiscalYearId).pipe(
      Effect.map((rows) => rows.map(rowToFiscalPeriod)),
      wrapSqlError("findByFiscalYear")
    )

  const findByStatus: FiscalPeriodRepositoryService["findByStatus"] = (companyId, status) =>
    findPeriodsByCompanyAndStatus({ companyId, status }).pipe(
      Effect.map((rows) => rows.map(rowToFiscalPeriod)),
      wrapSqlError("findByStatus")
    )

  const findCurrentPeriod: FiscalPeriodRepositoryService["findCurrentPeriod"] = (companyId) =>
    findCurrentPeriodQuery(companyId).pipe(
      Effect.map(Option.map(rowToFiscalPeriod)),
      wrapSqlError("findCurrentPeriod")
    )

  const findByCompanyAndPeriod: FiscalPeriodRepositoryService["findByCompanyAndPeriod"] = (
    companyId,
    year,
    periodNumber
  ) =>
    findByCompanyAndPeriodQuery({ companyId, year, periodNumber }).pipe(
      Effect.map(Option.map(rowToFiscalPeriod)),
      wrapSqlError("findByCompanyAndPeriod")
    )

  const createMany: FiscalPeriodRepositoryService["createMany"] = (periods) =>
    Effect.gen(function* () {
      for (const period of periods) {
        yield* create(period)
      }
      return periods
    })

  const exists: FiscalPeriodRepositoryService["exists"] = (id) =>
    countPeriodById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  // FiscalYear operations
  const findFiscalYearByIdOp: FiscalPeriodRepositoryService["findFiscalYearById"] = (id) =>
    findFiscalYearById(id).pipe(
      Effect.map(Option.map(rowToFiscalYear)),
      wrapSqlError("findFiscalYearById")
    )

  const getFiscalYearById: FiscalPeriodRepositoryService["getFiscalYearById"] = (id) =>
    Effect.gen(function* () {
      const maybeYear = yield* findFiscalYearByIdOp(id)
      return yield* Option.match(maybeYear, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "FiscalYear", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findFiscalYearsByCompanyOp: FiscalPeriodRepositoryService["findFiscalYearsByCompany"] = (companyId) =>
    findFiscalYearsByCompany(companyId).pipe(
      Effect.map((rows) => rows.map(rowToFiscalYear)),
      wrapSqlError("findFiscalYearsByCompany")
    )

  const findFiscalYearByCompanyAndYearOp: FiscalPeriodRepositoryService["findFiscalYearByCompanyAndYear"] = (
    companyId,
    year
  ) =>
    findFiscalYearByCompanyAndYear({ companyId, year }).pipe(
      Effect.map(Option.map(rowToFiscalYear)),
      wrapSqlError("findFiscalYearByCompanyAndYear")
    )

  const findOpenFiscalYears: FiscalPeriodRepositoryService["findOpenFiscalYears"] = (companyId) =>
    findOpenFiscalYearsQuery(companyId).pipe(
      Effect.map((rows) => rows.map(rowToFiscalYear)),
      wrapSqlError("findOpenFiscalYears")
    )

  const createFiscalYear: FiscalPeriodRepositoryService["createFiscalYear"] = (fiscalYear) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO fiscal_years (
          id, company_id, name, year, start_date, end_date,
          status, includes_adjustment_period, created_at
        ) VALUES (
          ${fiscalYear.id},
          ${fiscalYear.companyId},
          ${fiscalYear.name},
          ${fiscalYear.year},
          ${fiscalYear.startDate.toDate()},
          ${fiscalYear.endDate.toDate()},
          ${fiscalYear.status},
          ${fiscalYear.includesAdjustmentPeriod},
          ${fiscalYear.createdAt.toDate()}
        )
      `.pipe(wrapSqlError("createFiscalYear"))

      return fiscalYear
    })

  const updateFiscalYear: FiscalPeriodRepositoryService["updateFiscalYear"] = (fiscalYear) =>
    Effect.gen(function* () {
      const result = yield* sql`
        UPDATE fiscal_years SET
          name = ${fiscalYear.name},
          start_date = ${fiscalYear.startDate.toDate()},
          end_date = ${fiscalYear.endDate.toDate()},
          status = ${fiscalYear.status},
          includes_adjustment_period = ${fiscalYear.includesAdjustmentPeriod}
        WHERE id = ${fiscalYear.id}
      `.pipe(wrapSqlError("updateFiscalYear"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "FiscalYear", entityId: fiscalYear.id })
        )
      }

      return fiscalYear
    })

  const fiscalYearExists: FiscalPeriodRepositoryService["fiscalYearExists"] = (id) =>
    countFiscalYearById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("fiscalYearExists")
    )

  return {
    findById,
    findByCompany,
    findOpen,
    create,
    update,
    getById,
    findByFiscalYear,
    findByStatus,
    findCurrentPeriod,
    findByCompanyAndPeriod,
    createMany,
    exists,
    findFiscalYearById: findFiscalYearByIdOp,
    getFiscalYearById,
    findFiscalYearsByCompany: findFiscalYearsByCompanyOp,
    findFiscalYearByCompanyAndYear: findFiscalYearByCompanyAndYearOp,
    findOpenFiscalYears,
    createFiscalYear,
    updateFiscalYear,
    fiscalYearExists
  } satisfies FiscalPeriodRepositoryService
})

/**
 * FiscalPeriodRepositoryLive - Layer providing FiscalPeriodRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const FiscalPeriodRepositoryLive = Layer.effect(FiscalPeriodRepository, make)
