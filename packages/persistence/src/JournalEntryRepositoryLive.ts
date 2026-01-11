/**
 * JournalEntryRepositoryLive - PostgreSQL implementation of JournalEntryRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module JournalEntryRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CompanyId } from "@accountability/core/domain/Company"
import { FiscalPeriodRef } from "@accountability/core/domain/FiscalPeriodRef"
import {
  EntryNumber,
  JournalEntry,
  JournalEntryId,
  JournalEntryStatus,
  JournalEntryType,
  SourceModule,
  UserId
} from "@accountability/core/domain/JournalEntry"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { JournalEntryRepository, type JournalEntryRepositoryService } from "./JournalEntryRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "./RepositoryError.ts"

/**
 * Schema for database row from journal_entries table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const JournalEntryRow = Schema.Struct({
  id: Schema.String,
  company_id: Schema.String,
  entry_number: Schema.NullOr(Schema.String),
  reference_number: Schema.NullOr(Schema.String),
  description: Schema.String,
  transaction_date: Schema.DateFromSelf,
  posting_date: Schema.NullOr(Schema.DateFromSelf),
  document_date: Schema.NullOr(Schema.DateFromSelf),
  fiscal_year: Schema.Number,
  fiscal_period: Schema.Number,
  entry_type: JournalEntryType,
  source_module: SourceModule,
  source_document_ref: Schema.NullOr(Schema.String),
  is_multi_currency: Schema.Boolean,
  status: JournalEntryStatus,
  is_reversing: Schema.Boolean,
  reversed_entry_id: Schema.NullOr(Schema.String),
  reversing_entry_id: Schema.NullOr(Schema.String),
  created_by: Schema.String,
  created_at: Schema.DateFromSelf,
  posted_by: Schema.NullOr(Schema.String),
  posted_at: Schema.NullOr(Schema.DateFromSelf)
})
type JournalEntryRow = typeof JournalEntryRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Schema for max entry number query result
 */
const MaxNumRow = Schema.Struct({
  max_num: Schema.NullOr(Schema.String)
})

/**
 * Convert Date to LocalDate
 * Pure function - no validation needed, values come from database
 */
const dateToLocalDate = (date: Date): LocalDate =>
  LocalDate.make({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })

/**
 * Convert database row to JournalEntry domain entity
 * Pure function - no Effect wrapping needed
 * Since the row schema uses proper literal types, no type assertions needed
 */
const rowToJournalEntry = (row: JournalEntryRow): JournalEntry =>
  JournalEntry.make({
    id: JournalEntryId.make(row.id),
    companyId: CompanyId.make(row.company_id),
    entryNumber: Option.fromNullable(row.entry_number).pipe(
      Option.map(EntryNumber.make)
    ),
    referenceNumber: Option.fromNullable(row.reference_number),
    description: row.description,
    transactionDate: dateToLocalDate(row.transaction_date),
    postingDate: Option.fromNullable(row.posting_date).pipe(
      Option.map(dateToLocalDate)
    ),
    documentDate: Option.fromNullable(row.document_date).pipe(
      Option.map(dateToLocalDate)
    ),
    fiscalPeriod: FiscalPeriodRef.make({ year: row.fiscal_year, period: row.fiscal_period }),
    entryType: row.entry_type,
    sourceModule: row.source_module,
    sourceDocumentRef: Option.fromNullable(row.source_document_ref),
    isMultiCurrency: row.is_multi_currency,
    status: row.status,
    isReversing: row.is_reversing,
    reversedEntryId: Option.fromNullable(row.reversed_entry_id).pipe(
      Option.map(JournalEntryId.make)
    ),
    reversingEntryId: Option.fromNullable(row.reversing_entry_id).pipe(
      Option.map(JournalEntryId.make)
    ),
    createdBy: UserId.make(row.created_by),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    postedBy: Option.fromNullable(row.posted_by).pipe(
      Option.map(UserId.make)
    ),
    postedAt: Option.fromNullable(row.posted_at).pipe(
      Option.map((d) => Timestamp.make({ epochMillis: d.getTime() }))
    )
  })

/**
 * Implementation of JournalEntryRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findEntryById = SqlSchema.findOne({
    Request: Schema.String,
    Result: JournalEntryRow,
    execute: (id) => sql`SELECT * FROM journal_entries WHERE id = ${id}`
  })

  const findEntriesByCompany = SqlSchema.findAll({
    Request: Schema.String,
    Result: JournalEntryRow,
    execute: (companyId) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId}
      ORDER BY transaction_date DESC, created_at DESC
    `
  })

  const findEntriesByPeriod = SqlSchema.findAll({
    Request: Schema.Struct({
      companyId: Schema.String,
      year: Schema.Number,
      period: Schema.Number
    }),
    Result: JournalEntryRow,
    execute: ({ companyId, year, period }) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId}
        AND fiscal_year = ${year}
        AND fiscal_period = ${period}
      ORDER BY transaction_date DESC, created_at DESC
    `
  })

  const findEntriesByStatus = SqlSchema.findAll({
    Request: Schema.Struct({ companyId: Schema.String, status: Schema.String }),
    Result: JournalEntryRow,
    execute: ({ companyId, status }) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId} AND status = ${status}
      ORDER BY transaction_date DESC, created_at DESC
    `
  })

  const findEntriesByType = SqlSchema.findAll({
    Request: Schema.Struct({ companyId: Schema.String, entryType: Schema.String }),
    Result: JournalEntryRow,
    execute: ({ companyId, entryType }) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId} AND entry_type = ${entryType}
      ORDER BY transaction_date DESC, created_at DESC
    `
  })

  const findEntriesByPeriodRange = SqlSchema.findAll({
    Request: Schema.Struct({
      companyId: Schema.String,
      startYear: Schema.Number,
      startPeriod: Schema.Number,
      endYear: Schema.Number,
      endPeriod: Schema.Number
    }),
    Result: JournalEntryRow,
    execute: ({ companyId, startYear, startPeriod, endYear, endPeriod }) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId}
        AND (fiscal_year > ${startYear}
             OR (fiscal_year = ${startYear} AND fiscal_period >= ${startPeriod}))
        AND (fiscal_year < ${endYear}
             OR (fiscal_year = ${endYear} AND fiscal_period <= ${endPeriod}))
      ORDER BY fiscal_year, fiscal_period, transaction_date
    `
  })

  const findDraftEntriesQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: JournalEntryRow,
    execute: (companyId) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId} AND status = 'Draft'
      ORDER BY created_at DESC
    `
  })

  const findPostedByPeriodQuery = SqlSchema.findAll({
    Request: Schema.Struct({
      companyId: Schema.String,
      year: Schema.Number,
      period: Schema.Number
    }),
    Result: JournalEntryRow,
    execute: ({ companyId, year, period }) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId}
        AND status = 'Posted'
        AND fiscal_year = ${year}
        AND fiscal_period = ${period}
      ORDER BY posting_date, entry_number
    `
  })

  const findReversingEntryQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: JournalEntryRow,
    execute: (entryId) => sql`
      SELECT * FROM journal_entries
      WHERE reversed_entry_id = ${entryId}
    `
  })

  const countDraftEntriesQuery = SqlSchema.single({
    Request: Schema.Struct({
      companyId: Schema.String,
      year: Schema.Number,
      period: Schema.Number
    }),
    Result: CountRow,
    execute: ({ companyId, year, period }) => sql`
      SELECT COUNT(*) as count FROM journal_entries
      WHERE company_id = ${companyId}
        AND status = 'Draft'
        AND fiscal_year = ${year}
        AND fiscal_period = ${period}
    `
  })

  const findIntercompanyEntriesQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: JournalEntryRow,
    execute: (companyId) => sql`
      SELECT * FROM journal_entries
      WHERE company_id = ${companyId} AND entry_type = 'Intercompany'
      ORDER BY transaction_date DESC, created_at DESC
    `
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM journal_entries WHERE id = ${id}`
  })

  const getMaxEntryNumber = SqlSchema.single({
    Request: Schema.String,
    Result: MaxNumRow,
    execute: (companyId) => sql`
      SELECT MAX(entry_number) as max_num FROM journal_entries
      WHERE company_id = ${companyId} AND entry_number IS NOT NULL
    `
  })

  const findById: JournalEntryRepositoryService["findById"] = (id) =>
    findEntryById(id).pipe(
      Effect.map(Option.map(rowToJournalEntry)),
      wrapSqlError("findById")
    )

  const findByCompany: JournalEntryRepositoryService["findByCompany"] = (companyId) =>
    findEntriesByCompany(companyId).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByCompany")
    )

  const findByPeriod: JournalEntryRepositoryService["findByPeriod"] = (companyId, period) =>
    findEntriesByPeriod({ companyId, year: period.year, period: period.period }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByPeriod")
    )

  const create: JournalEntryRepositoryService["create"] = (entry) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO journal_entries (
          id, company_id, entry_number, reference_number, description,
          transaction_date, posting_date, document_date,
          fiscal_year, fiscal_period, entry_type, source_module, source_document_ref,
          is_multi_currency, status, is_reversing,
          reversed_entry_id, reversing_entry_id,
          created_by, created_at, posted_by, posted_at
        ) VALUES (
          ${entry.id},
          ${entry.companyId},
          ${Option.getOrNull(entry.entryNumber)},
          ${Option.getOrNull(entry.referenceNumber)},
          ${entry.description},
          ${entry.transactionDate.toDate()},
          ${Option.match(entry.postingDate, { onNone: () => null, onSome: (d) => d.toDate() })},
          ${Option.match(entry.documentDate, { onNone: () => null, onSome: (d) => d.toDate() })},
          ${entry.fiscalPeriod.year},
          ${entry.fiscalPeriod.period},
          ${entry.entryType},
          ${entry.sourceModule},
          ${Option.getOrNull(entry.sourceDocumentRef)},
          ${entry.isMultiCurrency},
          ${entry.status},
          ${entry.isReversing},
          ${Option.getOrNull(entry.reversedEntryId)},
          ${Option.getOrNull(entry.reversingEntryId)},
          ${entry.createdBy},
          ${entry.createdAt.toDate()},
          ${Option.getOrNull(entry.postedBy)},
          ${Option.match(entry.postedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        )
      `.pipe(wrapSqlError("create"))

      return entry
    })

  const update: JournalEntryRepositoryService["update"] = (entry) =>
    Effect.gen(function* () {
      const result = yield* sql`
        UPDATE journal_entries SET
          entry_number = ${Option.getOrNull(entry.entryNumber)},
          reference_number = ${Option.getOrNull(entry.referenceNumber)},
          description = ${entry.description},
          transaction_date = ${entry.transactionDate.toDate()},
          posting_date = ${Option.match(entry.postingDate, { onNone: () => null, onSome: (d) => d.toDate() })},
          document_date = ${Option.match(entry.documentDate, { onNone: () => null, onSome: (d) => d.toDate() })},
          fiscal_year = ${entry.fiscalPeriod.year},
          fiscal_period = ${entry.fiscalPeriod.period},
          entry_type = ${entry.entryType},
          source_module = ${entry.sourceModule},
          source_document_ref = ${Option.getOrNull(entry.sourceDocumentRef)},
          is_multi_currency = ${entry.isMultiCurrency},
          status = ${entry.status},
          is_reversing = ${entry.isReversing},
          reversed_entry_id = ${Option.getOrNull(entry.reversedEntryId)},
          reversing_entry_id = ${Option.getOrNull(entry.reversingEntryId)},
          posted_by = ${Option.getOrNull(entry.postedBy)},
          posted_at = ${Option.match(entry.postedAt, { onNone: () => null, onSome: (t) => t.toDate() })}
        WHERE id = ${entry.id}
      `.pipe(wrapSqlError("update"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "JournalEntry", entityId: entry.id })
        )
      }

      return entry
    })

  const getById: JournalEntryRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeEntry = yield* findById(id)
      return yield* Option.match(maybeEntry, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "JournalEntry", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findByStatus: JournalEntryRepositoryService["findByStatus"] = (companyId, status) =>
    findEntriesByStatus({ companyId, status }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByStatus")
    )

  const findByType: JournalEntryRepositoryService["findByType"] = (companyId, entryType) =>
    findEntriesByType({ companyId, entryType }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByType")
    )

  const findByPeriodRange: JournalEntryRepositoryService["findByPeriodRange"] = (
    companyId,
    startPeriod,
    endPeriod
  ) =>
    findEntriesByPeriodRange({
      companyId,
      startYear: startPeriod.year,
      startPeriod: startPeriod.period,
      endYear: endPeriod.year,
      endPeriod: endPeriod.period
    }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByPeriodRange")
    )

  const findDraftEntries: JournalEntryRepositoryService["findDraftEntries"] = (companyId) =>
    findDraftEntriesQuery(companyId).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findDraftEntries")
    )

  const findPostedByPeriod: JournalEntryRepositoryService["findPostedByPeriod"] = (companyId, period) =>
    findPostedByPeriodQuery({ companyId, year: period.year, period: period.period }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findPostedByPeriod")
    )

  const findReversingEntry: JournalEntryRepositoryService["findReversingEntry"] = (entryId) =>
    findReversingEntryQuery(entryId).pipe(
      Effect.map(Option.map(rowToJournalEntry)),
      wrapSqlError("findReversingEntry")
    )

  const countDraftEntriesInPeriod: JournalEntryRepositoryService["countDraftEntriesInPeriod"] = (
    companyId,
    period
  ) =>
    countDraftEntriesQuery({ companyId, year: period.year, period: period.period }).pipe(
      Effect.map((row) => parseInt(row.count, 10)),
      wrapSqlError("countDraftEntriesInPeriod")
    )

  const findIntercompanyEntries: JournalEntryRepositoryService["findIntercompanyEntries"] = (companyId) =>
    findIntercompanyEntriesQuery(companyId).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findIntercompanyEntries")
    )

  const exists: JournalEntryRepositoryService["exists"] = (id) =>
    countById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  const getNextEntryNumber: JournalEntryRepositoryService["getNextEntryNumber"] = (companyId) =>
    getMaxEntryNumber(companyId).pipe(
      Effect.map((row) => {
        const maxNum = row.max_num
        if (maxNum === null) {
          return "JE-0001"
        }

        // Parse number from pattern like "JE-0001" or just increment numeric part
        const match = maxNum.match(/(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10) + 1
          const prefix = maxNum.slice(0, maxNum.length - match[1].length)
          return `${prefix}${String(num).padStart(match[1].length, "0")}`
        }

        // Fallback: append "-0001"
        return `${maxNum}-0001`
      }),
      wrapSqlError("getNextEntryNumber")
    )

  return {
    findById,
    findByCompany,
    findByPeriod,
    create,
    update,
    getById,
    findByStatus,
    findByType,
    findByPeriodRange,
    findDraftEntries,
    findPostedByPeriod,
    findReversingEntry,
    countDraftEntriesInPeriod,
    findIntercompanyEntries,
    exists,
    getNextEntryNumber
  } satisfies JournalEntryRepositoryService
})

/**
 * JournalEntryRepositoryLive - Layer providing JournalEntryRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const JournalEntryRepositoryLive = Layer.effect(JournalEntryRepository, make)
