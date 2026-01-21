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
import { CompanyId } from "@accountability/core/company/Company"
import { FiscalYear, FiscalYearId } from "@accountability/core/fiscal/FiscalYear"
import { FiscalPeriod, FiscalPeriodId, FiscalPeriodUserId, PeriodReopenAuditEntry, PeriodReopenAuditEntryId } from "@accountability/core/fiscal/FiscalPeriod"
import type { FiscalYearStatus } from "@accountability/core/fiscal/FiscalYearStatus"
import type { FiscalPeriodStatus } from "@accountability/core/fiscal/FiscalPeriodStatus"
import type { FiscalPeriodType } from "@accountability/core/fiscal/FiscalPeriodType"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { FiscalPeriodRepository, type FiscalPeriodRepositoryService } from "../Services/FiscalPeriodRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from fiscal_years table
 */
const FiscalYearRow = Schema.Struct({
  id: Schema.String,
  company_id: Schema.String,
  name: Schema.String,
  year: Schema.Number,
  start_date: Schema.DateFromSelf,
  end_date: Schema.DateFromSelf,
  status: Schema.String,
  includes_adjustment_period: Schema.Boolean,
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf
})
type FiscalYearRow = typeof FiscalYearRow.Type

/**
 * Schema for database row from fiscal_periods table
 */
const FiscalPeriodRow = Schema.Struct({
  id: Schema.String,
  fiscal_year_id: Schema.String,
  period_number: Schema.Number,
  name: Schema.String,
  period_type: Schema.String,
  start_date: Schema.DateFromSelf,
  end_date: Schema.DateFromSelf,
  status: Schema.String,
  closed_by: Schema.NullOr(Schema.String),
  closed_at: Schema.NullOr(Schema.DateFromSelf),
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf
})
type FiscalPeriodRow = typeof FiscalPeriodRow.Type

/**
 * Schema for database row from period_reopen_audit_entries table
 */
const ReopenAuditRow = Schema.Struct({
  id: Schema.String,
  period_id: Schema.String,
  reason: Schema.String,
  reopened_by: Schema.String,
  reopened_at: Schema.DateFromSelf,
  previous_status: Schema.String
})
type ReopenAuditRow = typeof ReopenAuditRow.Type

/**
 * Map fiscal year status string to FiscalYearStatus literal
 * Simplified 2-state model: Open and Closed
 * Legacy "Closing" value maps to "Open" (year needs to be re-closed)
 */
const FISCAL_YEAR_STATUS_MAP: Record<string, FiscalYearStatus> = {
  Open: "Open",
  Closed: "Closed",
  // Legacy value maps to Open (year was in intermediate state)
  Closing: "Open"
}

/**
 * Map fiscal period status string to FiscalPeriodStatus literal
 * Simplified 2-state model: Open and Closed
 * Legacy values (Future, SoftClose, Locked) map to Closed
 */
const FISCAL_PERIOD_STATUS_MAP: Record<string, FiscalPeriodStatus> = {
  Open: "Open",
  Closed: "Closed",
  // Legacy values map to Closed
  Future: "Closed",
  SoftClose: "Closed",
  Locked: "Closed"
}

/**
 * Map fiscal period type string to FiscalPeriodType literal
 */
const FISCAL_PERIOD_TYPE_MAP: Record<string, FiscalPeriodType> = {
  Regular: "Regular",
  Adjustment: "Adjustment",
  Closing: "Closing"
}

/**
 * Convert Date to LocalDate
 * Uses local date methods because pg driver returns DATE columns as local midnight
 */
const dateToLocalDate = (d: Date): LocalDate =>
  LocalDate.make({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate()
  })

/**
 * Convert database row to FiscalYear domain entity
 */
const rowToFiscalYear = (row: FiscalYearRow): FiscalYear =>
  FiscalYear.make({
    id: FiscalYearId.make(row.id),
    companyId: CompanyId.make(row.company_id),
    name: row.name,
    year: row.year,
    startDate: dateToLocalDate(row.start_date),
    endDate: dateToLocalDate(row.end_date),
    status: FISCAL_YEAR_STATUS_MAP[row.status] ?? "Open",
    includesAdjustmentPeriod: row.includes_adjustment_period,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    updatedAt: Timestamp.make({ epochMillis: row.updated_at.getTime() })
  })

/**
 * Convert database row to FiscalPeriod domain entity
 */
const rowToFiscalPeriod = (row: FiscalPeriodRow): FiscalPeriod =>
  FiscalPeriod.make({
    id: FiscalPeriodId.make(row.id),
    fiscalYearId: FiscalYearId.make(row.fiscal_year_id),
    periodNumber: row.period_number,
    name: row.name,
    periodType: FISCAL_PERIOD_TYPE_MAP[row.period_type] ?? "Regular",
    startDate: dateToLocalDate(row.start_date),
    endDate: dateToLocalDate(row.end_date),
    status: FISCAL_PERIOD_STATUS_MAP[row.status] ?? "Future",
    closedBy: Option.fromNullable(row.closed_by).pipe(
      Option.map((id) => FiscalPeriodUserId.make(id))
    ),
    closedAt: Option.fromNullable(row.closed_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    ),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    updatedAt: Timestamp.make({ epochMillis: row.updated_at.getTime() })
  })

/**
 * Convert database row to PeriodReopenAuditEntry domain entity
 */
const rowToReopenAuditEntry = (row: ReopenAuditRow): PeriodReopenAuditEntry =>
  PeriodReopenAuditEntry.make({
    id: PeriodReopenAuditEntryId.make(row.id),
    periodId: FiscalPeriodId.make(row.period_id),
    reason: row.reason,
    reopenedBy: FiscalPeriodUserId.make(row.reopened_by),
    reopenedAt: Timestamp.make({ epochMillis: row.reopened_at.getTime() }),
    previousStatus: FISCAL_PERIOD_STATUS_MAP[row.previous_status] ?? "Closed"
  })

/**
 * Implementation of FiscalPeriodRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // ==================== FiscalYear Query Builders ====================

  const FindFiscalYearByIdRequest = Schema.Struct({
    companyId: Schema.String,
    id: Schema.String
  })

  const findFiscalYearByIdQuery = SqlSchema.findOne({
    Request: FindFiscalYearByIdRequest,
    Result: FiscalYearRow,
    execute: ({ companyId, id }) => sql`
      SELECT * FROM fiscal_years
      WHERE id = ${id} AND company_id = ${companyId}
    `
  })

  const FindFiscalYearByNumberRequest = Schema.Struct({
    companyId: Schema.String,
    year: Schema.Number
  })

  const findFiscalYearByNumberQuery = SqlSchema.findOne({
    Request: FindFiscalYearByNumberRequest,
    Result: FiscalYearRow,
    execute: ({ companyId, year }) => sql`
      SELECT * FROM fiscal_years
      WHERE company_id = ${companyId} AND year = ${year}
    `
  })

  const findFiscalYearsByCompanyQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: FiscalYearRow,
    execute: (companyId) => sql`
      SELECT * FROM fiscal_years
      WHERE company_id = ${companyId}
      ORDER BY year DESC
    `
  })

  // ==================== FiscalPeriod Query Builders ====================

  const FindPeriodByIdRequest = Schema.Struct({
    fiscalYearId: Schema.String,
    id: Schema.String
  })

  const findPeriodByIdQuery = SqlSchema.findOne({
    Request: FindPeriodByIdRequest,
    Result: FiscalPeriodRow,
    execute: ({ fiscalYearId, id }) => sql`
      SELECT * FROM fiscal_periods
      WHERE id = ${id} AND fiscal_year_id = ${fiscalYearId}
    `
  })

  const FindPeriodByNumberRequest = Schema.Struct({
    fiscalYearId: Schema.String,
    periodNumber: Schema.Number
  })

  const findPeriodByNumberQuery = SqlSchema.findOne({
    Request: FindPeriodByNumberRequest,
    Result: FiscalPeriodRow,
    execute: ({ fiscalYearId, periodNumber }) => sql`
      SELECT * FROM fiscal_periods
      WHERE fiscal_year_id = ${fiscalYearId} AND period_number = ${periodNumber}
    `
  })

  const findPeriodsByFiscalYearQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: FiscalPeriodRow,
    execute: (fiscalYearId) => sql`
      SELECT * FROM fiscal_periods
      WHERE fiscal_year_id = ${fiscalYearId}
      ORDER BY period_number
    `
  })

  const FindPeriodByDateRequest = Schema.Struct({
    companyId: Schema.String,
    date: Schema.String
  })

  const findPeriodByDateQuery = SqlSchema.findOne({
    Request: FindPeriodByDateRequest,
    Result: FiscalPeriodRow,
    execute: ({ companyId, date }) => sql`
      SELECT fp.* FROM fiscal_periods fp
      JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
      WHERE fy.company_id = ${companyId}
        AND ${date}::date >= fp.start_date
        AND ${date}::date <= fp.end_date
      ORDER BY fp.period_number ASC
      LIMIT 1
    `
  })

  const FindPeriodsByStatusRequest = Schema.Struct({
    companyId: Schema.String,
    status: Schema.String
  })

  const findPeriodsByStatusQuery = SqlSchema.findAll({
    Request: FindPeriodsByStatusRequest,
    Result: FiscalPeriodRow,
    execute: ({ companyId, status }) => sql`
      SELECT fp.* FROM fiscal_periods fp
      JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
      WHERE fy.company_id = ${companyId} AND fp.status = ${status}::fiscal_period_status
      ORDER BY fy.year DESC, fp.period_number
    `
  })

  // ==================== Audit Query Builders ====================

  const findReopenAuditEntriesQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: ReopenAuditRow,
    execute: (periodId) => sql`
      SELECT * FROM period_reopen_audit_entries
      WHERE period_id = ${periodId}
      ORDER BY reopened_at DESC
    `
  })

  // ==================== FiscalYear Operations ====================

  const findFiscalYearById: FiscalPeriodRepositoryService["findFiscalYearById"] = (companyId, id) =>
    findFiscalYearByIdQuery({ companyId, id }).pipe(
      Effect.map(Option.map(rowToFiscalYear)),
      wrapSqlError("findFiscalYearById")
    )

  const getFiscalYearById: FiscalPeriodRepositoryService["getFiscalYearById"] = (companyId, id) =>
    Effect.gen(function* () {
      const maybeFiscalYear = yield* findFiscalYearById(companyId, id)
      return yield* Option.match(maybeFiscalYear, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "FiscalYear", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findFiscalYearByNumber: FiscalPeriodRepositoryService["findFiscalYearByNumber"] = (companyId, year) =>
    findFiscalYearByNumberQuery({ companyId, year }).pipe(
      Effect.map(Option.map(rowToFiscalYear)),
      wrapSqlError("findFiscalYearByNumber")
    )

  const findFiscalYearsByCompany: FiscalPeriodRepositoryService["findFiscalYearsByCompany"] = (companyId) =>
    findFiscalYearsByCompanyQuery(companyId).pipe(
      Effect.map((rows) => rows.map(rowToFiscalYear)),
      wrapSqlError("findFiscalYearsByCompany")
    )

  const createFiscalYear: FiscalPeriodRepositoryService["createFiscalYear"] = (fiscalYear) =>
    Effect.gen(function* () {
      // Use ISO strings for DATE columns to avoid timezone conversion issues
      // The pg driver can shift dates by a day when converting Date objects to local time
      yield* sql`
        INSERT INTO fiscal_years (
          id, company_id, name, year, start_date, end_date,
          status, includes_adjustment_period, created_at, updated_at
        ) VALUES (
          ${fiscalYear.id},
          ${fiscalYear.companyId},
          ${fiscalYear.name},
          ${fiscalYear.year},
          ${fiscalYear.startDate.toString()}::date,
          ${fiscalYear.endDate.toString()}::date,
          ${fiscalYear.status}::fiscal_year_status,
          ${fiscalYear.includesAdjustmentPeriod},
          ${fiscalYear.createdAt.toDate()},
          ${fiscalYear.updatedAt.toDate()}
        )
      `.pipe(wrapSqlError("createFiscalYear"))

      return fiscalYear
    })

  const updateFiscalYear: FiscalPeriodRepositoryService["updateFiscalYear"] = (companyId, fiscalYear) =>
    Effect.gen(function* () {
      // Check if fiscal year exists first (with company filter for security)
      const existing = yield* findFiscalYearById(companyId, fiscalYear.id)
      if (Option.isNone(existing)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "FiscalYear", entityId: fiscalYear.id })
        )
      }

      yield* sql`
        UPDATE fiscal_years SET
          name = ${fiscalYear.name},
          status = ${fiscalYear.status}::fiscal_year_status,
          includes_adjustment_period = ${fiscalYear.includesAdjustmentPeriod},
          updated_at = NOW()
        WHERE id = ${fiscalYear.id} AND company_id = ${companyId}
      `.pipe(wrapSqlError("updateFiscalYear"))

      return fiscalYear
    })

  // ==================== FiscalPeriod Operations ====================

  const findPeriodById: FiscalPeriodRepositoryService["findPeriodById"] = (fiscalYearId, id) =>
    findPeriodByIdQuery({ fiscalYearId, id }).pipe(
      Effect.map(Option.map(rowToFiscalPeriod)),
      wrapSqlError("findPeriodById")
    )

  const getPeriodById: FiscalPeriodRepositoryService["getPeriodById"] = (fiscalYearId, id) =>
    Effect.gen(function* () {
      const maybePeriod = yield* findPeriodById(fiscalYearId, id)
      return yield* Option.match(maybePeriod, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "FiscalPeriod", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findPeriodByNumber: FiscalPeriodRepositoryService["findPeriodByNumber"] = (fiscalYearId, periodNumber) =>
    findPeriodByNumberQuery({ fiscalYearId, periodNumber }).pipe(
      Effect.map(Option.map(rowToFiscalPeriod)),
      wrapSqlError("findPeriodByNumber")
    )

  const findPeriodsByFiscalYear: FiscalPeriodRepositoryService["findPeriodsByFiscalYear"] = (fiscalYearId) =>
    findPeriodsByFiscalYearQuery(fiscalYearId).pipe(
      Effect.map((rows) => rows.map(rowToFiscalPeriod)),
      wrapSqlError("findPeriodsByFiscalYear")
    )

  const findPeriodByDate: FiscalPeriodRepositoryService["findPeriodByDate"] = (companyId, date) =>
    findPeriodByDateQuery({ companyId, date }).pipe(
      Effect.map(Option.map(rowToFiscalPeriod)),
      wrapSqlError("findPeriodByDate")
    )

  const findPeriodsByStatus: FiscalPeriodRepositoryService["findPeriodsByStatus"] = (companyId, status) =>
    findPeriodsByStatusQuery({ companyId, status }).pipe(
      Effect.map((rows) => rows.map(rowToFiscalPeriod)),
      wrapSqlError("findPeriodsByStatus")
    )

  const createPeriod: FiscalPeriodRepositoryService["createPeriod"] = (period) =>
    Effect.gen(function* () {
      // Use ISO strings for DATE columns to avoid timezone conversion issues
      yield* sql`
        INSERT INTO fiscal_periods (
          id, fiscal_year_id, period_number, name, period_type,
          start_date, end_date, status, closed_by, closed_at,
          created_at, updated_at
        ) VALUES (
          ${period.id},
          ${period.fiscalYearId},
          ${period.periodNumber},
          ${period.name},
          ${period.periodType}::fiscal_period_type,
          ${period.startDate.toString()}::date,
          ${period.endDate.toString()}::date,
          ${period.status}::fiscal_period_status,
          ${Option.getOrNull(period.closedBy)},
          ${Option.getOrNull(Option.map(period.closedAt, (t) => t.toDate()))},
          ${period.createdAt.toDate()},
          ${period.updatedAt.toDate()}
        )
      `.pipe(wrapSqlError("createPeriod"))

      return period
    })

  const updatePeriod: FiscalPeriodRepositoryService["updatePeriod"] = (fiscalYearId, period) =>
    Effect.gen(function* () {
      // Check if period exists first (with fiscal year filter for security)
      const existing = yield* findPeriodById(fiscalYearId, period.id)
      if (Option.isNone(existing)) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "FiscalPeriod", entityId: period.id })
        )
      }

      yield* sql`
        UPDATE fiscal_periods SET
          name = ${period.name},
          status = ${period.status}::fiscal_period_status,
          closed_by = ${Option.getOrNull(period.closedBy)},
          closed_at = ${Option.getOrNull(Option.map(period.closedAt, (t) => t.toDate()))},
          updated_at = NOW()
        WHERE id = ${period.id} AND fiscal_year_id = ${fiscalYearId}
      `.pipe(wrapSqlError("updatePeriod"))

      return period
    })

  const createPeriods: FiscalPeriodRepositoryService["createPeriods"] = (periods) =>
    Effect.gen(function* () {
      // Insert all periods in sequence
      for (const period of periods) {
        yield* createPeriod(period)
      }
      return periods
    })

  // ==================== Audit Operations ====================

  const createReopenAuditEntry: FiscalPeriodRepositoryService["createReopenAuditEntry"] = (entry) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO period_reopen_audit_entries (
          id, period_id, reason, reopened_by, reopened_at, previous_status
        ) VALUES (
          ${entry.id},
          ${entry.periodId},
          ${entry.reason},
          ${entry.reopenedBy},
          ${entry.reopenedAt.toDate()},
          ${entry.previousStatus}::fiscal_period_status
        )
      `.pipe(wrapSqlError("createReopenAuditEntry"))

      return entry
    })

  const findReopenAuditEntriesByPeriod: FiscalPeriodRepositoryService["findReopenAuditEntriesByPeriod"] = (periodId) =>
    findReopenAuditEntriesQuery(periodId).pipe(
      Effect.map((rows) => rows.map(rowToReopenAuditEntry)),
      wrapSqlError("findReopenAuditEntriesByPeriod")
    )

  return {
    // Fiscal Year operations
    findFiscalYearById,
    getFiscalYearById,
    findFiscalYearByNumber,
    findFiscalYearsByCompany,
    createFiscalYear,
    updateFiscalYear,

    // Fiscal Period operations
    findPeriodById,
    getPeriodById,
    findPeriodByNumber,
    findPeriodsByFiscalYear,
    findPeriodByDate,
    findPeriodsByStatus,
    createPeriod,
    updatePeriod,
    createPeriods,

    // Audit operations
    createReopenAuditEntry,
    findReopenAuditEntriesByPeriod
  } satisfies FiscalPeriodRepositoryService
})

/**
 * FiscalPeriodRepositoryLive - Layer providing FiscalPeriodRepository implementation
 *
 * Requires SqlClient.SqlClient in context.
 */
export const FiscalPeriodRepositoryLive = Layer.effect(FiscalPeriodRepository, make)
