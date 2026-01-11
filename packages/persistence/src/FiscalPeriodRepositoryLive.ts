/**
 * FiscalPeriodRepositoryLive - PostgreSQL implementation of FiscalPeriodRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module FiscalPeriodRepositoryLive
 */

import { SqlClient } from "@effect/sql"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { CompanyId } from "@accountability/core/domain/Company"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { UserId } from "@accountability/core/domain/JournalEntry"
import {
  FiscalPeriod,
  FiscalPeriodId,
  type FiscalPeriodStatus,
  type FiscalPeriodType,
  FiscalYear,
  FiscalYearId,
  type FiscalYearStatus
} from "@accountability/core/services/PeriodService"
import { FiscalPeriodRepository, type FiscalPeriodRepositoryService } from "./FiscalPeriodRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Database row type for fiscal_years table
 */
interface FiscalYearRow {
  readonly id: string
  readonly company_id: string
  readonly name: string
  readonly year: number
  readonly start_date: Date
  readonly end_date: Date
  readonly status: string
  readonly includes_adjustment_period: boolean
  readonly created_at: Date
}

/**
 * Database row type for fiscal_periods table
 */
interface FiscalPeriodRow {
  readonly id: string
  readonly fiscal_year_id: string
  readonly period_number: number
  readonly name: string
  readonly period_type: string
  readonly start_date: Date
  readonly end_date: Date
  readonly status: string
  readonly closed_by: string | null
  readonly closed_at: Date | null
}

/**
 * Convert Date to LocalDate
 */
const dateToLocalDate = (date: Date): LocalDate =>
  LocalDate.make(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
    { disableValidation: true }
  )

/**
 * Convert database row to FiscalYear domain entity
 */
const rowToFiscalYear = (row: FiscalYearRow): Effect.Effect<FiscalYear, PersistenceError> =>
  Effect.try({
    try: () =>
      FiscalYear.make(
        {
          id: FiscalYearId.make(row.id, { disableValidation: true }),
          companyId: CompanyId.make(row.company_id, { disableValidation: true }),
          name: row.name,
          year: row.year,
          startDate: dateToLocalDate(row.start_date),
          endDate: dateToLocalDate(row.end_date),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          status: row.status as FiscalYearStatus,
          includesAdjustmentPeriod: row.includes_adjustment_period,
          createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }, { disableValidation: true })
        },
        { disableValidation: true }
      ),
    catch: (cause) => new PersistenceError({ operation: "rowToFiscalYear", cause })
  })

/**
 * Convert database row to FiscalPeriod domain entity
 */
const rowToFiscalPeriod = (row: FiscalPeriodRow): Effect.Effect<FiscalPeriod, PersistenceError> =>
  Effect.try({
    try: () =>
      FiscalPeriod.make(
        {
          id: FiscalPeriodId.make(row.id, { disableValidation: true }),
          fiscalYearId: FiscalYearId.make(row.fiscal_year_id, { disableValidation: true }),
          periodNumber: row.period_number,
          name: row.name,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          periodType: row.period_type as FiscalPeriodType,
          startDate: dateToLocalDate(row.start_date),
          endDate: dateToLocalDate(row.end_date),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          status: row.status as FiscalPeriodStatus,
          closedBy: row.closed_by !== null
            ? Option.some(UserId.make(row.closed_by, { disableValidation: true }))
            : Option.none<typeof UserId.Type>(),
          closedAt: row.closed_at !== null
            ? Option.some(Timestamp.make({ epochMillis: row.closed_at.getTime() }, { disableValidation: true }))
            : Option.none<Timestamp>()
        },
        { disableValidation: true }
      ),
    catch: (cause) => new PersistenceError({ operation: "rowToFiscalPeriod", cause })
  })

/**
 * Wrap SQL errors in PersistenceError
 */
const wrapSqlError =
  (operation: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> =>
    Effect.catchAllCause(effect, (cause) =>
      Effect.fail(new PersistenceError({ operation, cause: Cause.squash(cause) }))
    )

/**
 * Implementation of FiscalPeriodRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // FiscalPeriod operations
  const findById: FiscalPeriodRepositoryService["findById"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalPeriodRow>`
        SELECT * FROM fiscal_periods WHERE id = ${id}
      `.pipe(wrapSqlError("findById"))

      if (rows.length === 0) {
        return Option.none()
      }

      const period = yield* rowToFiscalPeriod(rows[0])
      return Option.some(period)
    })

  const findByCompany: FiscalPeriodRepositoryService["findByCompany"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalPeriodRow>`
        SELECT fp.* FROM fiscal_periods fp
        JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
        WHERE fy.company_id = ${companyId}
        ORDER BY fy.year DESC, fp.period_number
      `.pipe(wrapSqlError("findByCompany"))

      return yield* Effect.forEach(rows, rowToFiscalPeriod)
    })

  const findOpen: FiscalPeriodRepositoryService["findOpen"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalPeriodRow>`
        SELECT fp.* FROM fiscal_periods fp
        JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
        WHERE fy.company_id = ${companyId} AND fp.status = 'Open'
        ORDER BY fy.year, fp.period_number
      `.pipe(wrapSqlError("findOpen"))

      return yield* Effect.forEach(rows, rowToFiscalPeriod)
    })

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
    Effect.gen(function* () {
      const rows = yield* sql<FiscalPeriodRow>`
        SELECT * FROM fiscal_periods
        WHERE fiscal_year_id = ${fiscalYearId}
        ORDER BY period_number
      `.pipe(wrapSqlError("findByFiscalYear"))

      return yield* Effect.forEach(rows, rowToFiscalPeriod)
    })

  const findByStatus: FiscalPeriodRepositoryService["findByStatus"] = (companyId, status) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalPeriodRow>`
        SELECT fp.* FROM fiscal_periods fp
        JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
        WHERE fy.company_id = ${companyId} AND fp.status = ${status}
        ORDER BY fy.year, fp.period_number
      `.pipe(wrapSqlError("findByStatus"))

      return yield* Effect.forEach(rows, rowToFiscalPeriod)
    })

  const findCurrentPeriod: FiscalPeriodRepositoryService["findCurrentPeriod"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalPeriodRow>`
        SELECT fp.* FROM fiscal_periods fp
        JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
        WHERE fy.company_id = ${companyId}
          AND fp.status = 'Open'
          AND fp.start_date <= CURRENT_DATE
          AND fp.end_date >= CURRENT_DATE
        ORDER BY fp.period_number
        LIMIT 1
      `.pipe(wrapSqlError("findCurrentPeriod"))

      if (rows.length === 0) {
        return Option.none()
      }

      const period = yield* rowToFiscalPeriod(rows[0])
      return Option.some(period)
    })

  const createMany: FiscalPeriodRepositoryService["createMany"] = (periods) =>
    Effect.gen(function* () {
      for (const period of periods) {
        yield* create(period)
      }
      return periods
    })

  const exists: FiscalPeriodRepositoryService["exists"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM fiscal_periods WHERE id = ${id}
      `.pipe(wrapSqlError("exists"))

      return parseInt(rows[0].count, 10) > 0
    })

  // FiscalYear operations
  const findFiscalYearById: FiscalPeriodRepositoryService["findFiscalYearById"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalYearRow>`
        SELECT * FROM fiscal_years WHERE id = ${id}
      `.pipe(wrapSqlError("findFiscalYearById"))

      if (rows.length === 0) {
        return Option.none()
      }

      const year = yield* rowToFiscalYear(rows[0])
      return Option.some(year)
    })

  const getFiscalYearById: FiscalPeriodRepositoryService["getFiscalYearById"] = (id) =>
    Effect.gen(function* () {
      const maybeYear = yield* findFiscalYearById(id)
      return yield* Option.match(maybeYear, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "FiscalYear", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findFiscalYearsByCompany: FiscalPeriodRepositoryService["findFiscalYearsByCompany"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalYearRow>`
        SELECT * FROM fiscal_years
        WHERE company_id = ${companyId}
        ORDER BY year DESC
      `.pipe(wrapSqlError("findFiscalYearsByCompany"))

      return yield* Effect.forEach(rows, rowToFiscalYear)
    })

  const findFiscalYearByCompanyAndYear: FiscalPeriodRepositoryService["findFiscalYearByCompanyAndYear"] = (
    companyId,
    year
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalYearRow>`
        SELECT * FROM fiscal_years
        WHERE company_id = ${companyId} AND year = ${year}
      `.pipe(wrapSqlError("findFiscalYearByCompanyAndYear"))

      if (rows.length === 0) {
        return Option.none()
      }

      const fiscalYear = yield* rowToFiscalYear(rows[0])
      return Option.some(fiscalYear)
    })

  const findOpenFiscalYears: FiscalPeriodRepositoryService["findOpenFiscalYears"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<FiscalYearRow>`
        SELECT * FROM fiscal_years
        WHERE company_id = ${companyId} AND status = 'Open'
        ORDER BY year DESC
      `.pipe(wrapSqlError("findOpenFiscalYears"))

      return yield* Effect.forEach(rows, rowToFiscalYear)
    })

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
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM fiscal_years WHERE id = ${id}
      `.pipe(wrapSqlError("fiscalYearExists"))

      return parseInt(rows[0].count, 10) > 0
    })

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
    createMany,
    exists,
    findFiscalYearById,
    getFiscalYearById,
    findFiscalYearsByCompany,
    findFiscalYearByCompanyAndYear,
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
