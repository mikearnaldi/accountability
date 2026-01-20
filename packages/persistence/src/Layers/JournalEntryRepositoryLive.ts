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
import { CompanyId } from "@accountability/core/company/Company"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import {
  EntryNumber,
  JournalEntry,
  JournalEntryId,
  JournalEntryStatus,
  JournalEntryType,
  SourceModule,
  UserId
} from "@accountability/core/journal/JournalEntry"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { JournalEntryRepository, type JournalEntryRepositoryService } from "../Services/JournalEntryRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

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
 *
 * NOTE: The postgres driver returns DATE columns as Date objects at local midnight,
 * so we use local time methods (getFullYear, getMonth, getDate) not UTC methods.
 */
const dateToLocalDate = (date: Date): LocalDate =>
  LocalDate.make({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })

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

  // Request schemas for queries with organizationId
  const OrgAndIdRequest = Schema.Struct({
    organizationId: Schema.String,
    id: Schema.String
  })

  const OrgAndCompanyRequest = Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String
  })

  const OrgCompanyPeriodRequest = Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    year: Schema.Number,
    period: Schema.Number
  })

  const OrgCompanyStatusRequest = Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    status: Schema.String
  })

  const OrgCompanyTypeRequest = Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    entryType: Schema.String
  })

  const OrgCompanyPeriodRangeRequest = Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    startYear: Schema.Number,
    startPeriod: Schema.Number,
    endYear: Schema.Number,
    endPeriod: Schema.Number
  })

  // SqlSchema query builders for type-safe queries
  const findEntryById = SqlSchema.findOne({
    Request: OrgAndIdRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, id }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.id = ${id} AND c.organization_id = ${organizationId}
    `
  })

  const findEntriesByCompany = SqlSchema.findAll({
    Request: OrgAndCompanyRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId} AND c.organization_id = ${organizationId}
      ORDER BY je.transaction_date DESC, je.created_at DESC
    `
  })

  const findEntriesByPeriod = SqlSchema.findAll({
    Request: OrgCompanyPeriodRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId, year, period }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.fiscal_year = ${year}
        AND je.fiscal_period = ${period}
      ORDER BY je.transaction_date DESC, je.created_at DESC
    `
  })

  const findEntriesByStatus = SqlSchema.findAll({
    Request: OrgCompanyStatusRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId, status }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.status = ${status}
      ORDER BY je.transaction_date DESC, je.created_at DESC
    `
  })

  const findEntriesByType = SqlSchema.findAll({
    Request: OrgCompanyTypeRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId, entryType }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.entry_type = ${entryType}
      ORDER BY je.transaction_date DESC, je.created_at DESC
    `
  })

  const findEntriesByPeriodRange = SqlSchema.findAll({
    Request: OrgCompanyPeriodRangeRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId, startYear, startPeriod, endYear, endPeriod }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND (je.fiscal_year > ${startYear}
             OR (je.fiscal_year = ${startYear} AND je.fiscal_period >= ${startPeriod}))
        AND (je.fiscal_year < ${endYear}
             OR (je.fiscal_year = ${endYear} AND je.fiscal_period <= ${endPeriod}))
      ORDER BY je.fiscal_year, je.fiscal_period, je.transaction_date
    `
  })

  const findDraftEntriesQuery = SqlSchema.findAll({
    Request: OrgAndCompanyRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.status = 'Draft'
      ORDER BY je.created_at DESC
    `
  })

  const findPostedByPeriodQuery = SqlSchema.findAll({
    Request: OrgCompanyPeriodRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId, year, period }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.status = 'Posted'
        AND je.fiscal_year = ${year}
        AND je.fiscal_period = ${period}
      ORDER BY je.posting_date, je.entry_number
    `
  })

  const findReversingEntryQuery = SqlSchema.findOne({
    Request: OrgAndIdRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, id }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.reversed_entry_id = ${id}
        AND c.organization_id = ${organizationId}
    `
  })

  const countDraftEntriesQuery = SqlSchema.single({
    Request: OrgCompanyPeriodRequest,
    Result: CountRow,
    execute: ({ organizationId, companyId, year, period }) => sql`
      SELECT COUNT(*) as count FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.status = 'Draft'
        AND je.fiscal_year = ${year}
        AND je.fiscal_period = ${period}
    `
  })

  const findIntercompanyEntriesQuery = SqlSchema.findAll({
    Request: OrgAndCompanyRequest,
    Result: JournalEntryRow,
    execute: ({ organizationId, companyId }) => sql`
      SELECT je.* FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.entry_type = 'Intercompany'
      ORDER BY je.transaction_date DESC, je.created_at DESC
    `
  })

  const countById = SqlSchema.single({
    Request: OrgAndIdRequest,
    Result: CountRow,
    execute: ({ organizationId, id }) => sql`
      SELECT COUNT(*) as count FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.id = ${id} AND c.organization_id = ${organizationId}
    `
  })

  const getMaxEntryNumber = SqlSchema.single({
    Request: OrgAndCompanyRequest,
    Result: MaxNumRow,
    execute: ({ organizationId, companyId }) => sql`
      SELECT MAX(je.entry_number) as max_num FROM journal_entries je
      INNER JOIN companies c ON je.company_id = c.id
      WHERE je.company_id = ${companyId}
        AND c.organization_id = ${organizationId}
        AND je.entry_number IS NOT NULL
    `
  })

  const findById: JournalEntryRepositoryService["findById"] = (organizationId, id) =>
    findEntryById({ organizationId, id }).pipe(
      Effect.map(Option.map(rowToJournalEntry)),
      wrapSqlError("findById")
    )

  const findByCompany: JournalEntryRepositoryService["findByCompany"] = (organizationId, companyId) =>
    findEntriesByCompany({ organizationId, companyId }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByCompany")
    )

  const findByPeriod: JournalEntryRepositoryService["findByPeriod"] = (organizationId, companyId, period) =>
    findEntriesByPeriod({ organizationId, companyId, year: period.year, period: period.period }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByPeriod")
    )

  const create: JournalEntryRepositoryService["create"] = (entry) =>
    Effect.gen(function* () {
      // Use ISO strings for DATE columns to avoid timezone conversion issues
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
          ${entry.transactionDate.toString()}::date,
          ${Option.match(entry.postingDate, { onNone: () => null, onSome: (d) => d.toString() })}::date,
          ${Option.match(entry.documentDate, { onNone: () => null, onSome: (d) => d.toString() })}::date,
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

  const update: JournalEntryRepositoryService["update"] = (organizationId, entry) =>
    Effect.gen(function* () {
      // Use ISO strings for DATE columns to avoid timezone conversion issues
      const result = yield* sql`
        UPDATE journal_entries je SET
          entry_number = ${Option.getOrNull(entry.entryNumber)},
          reference_number = ${Option.getOrNull(entry.referenceNumber)},
          description = ${entry.description},
          transaction_date = ${entry.transactionDate.toString()}::date,
          posting_date = ${Option.match(entry.postingDate, { onNone: () => null, onSome: (d) => d.toString() })}::date,
          document_date = ${Option.match(entry.documentDate, { onNone: () => null, onSome: (d) => d.toString() })}::date,
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
        FROM companies c
        WHERE je.id = ${entry.id}
          AND je.company_id = c.id
          AND c.organization_id = ${organizationId}
        RETURNING je.id
      `.pipe(wrapSqlError("update"))

      if (result.length === 0) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "JournalEntry", entityId: entry.id })
        )
      }

      return entry
    })

  const getById: JournalEntryRepositoryService["getById"] = (organizationId, id) =>
    Effect.gen(function* () {
      const maybeEntry = yield* findById(organizationId, id)
      return yield* Option.match(maybeEntry, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "JournalEntry", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findByStatus: JournalEntryRepositoryService["findByStatus"] = (organizationId, companyId, status) =>
    findEntriesByStatus({ organizationId, companyId, status }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByStatus")
    )

  const findByType: JournalEntryRepositoryService["findByType"] = (organizationId, companyId, entryType) =>
    findEntriesByType({ organizationId, companyId, entryType }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByType")
    )

  const findByPeriodRange: JournalEntryRepositoryService["findByPeriodRange"] = (
    organizationId,
    companyId,
    startPeriod,
    endPeriod
  ) =>
    findEntriesByPeriodRange({
      organizationId,
      companyId,
      startYear: startPeriod.year,
      startPeriod: startPeriod.period,
      endYear: endPeriod.year,
      endPeriod: endPeriod.period
    }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findByPeriodRange")
    )

  const findDraftEntries: JournalEntryRepositoryService["findDraftEntries"] = (organizationId, companyId) =>
    findDraftEntriesQuery({ organizationId, companyId }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findDraftEntries")
    )

  const findPostedByPeriod: JournalEntryRepositoryService["findPostedByPeriod"] = (organizationId, companyId, period) =>
    findPostedByPeriodQuery({ organizationId, companyId, year: period.year, period: period.period }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findPostedByPeriod")
    )

  const findReversingEntry: JournalEntryRepositoryService["findReversingEntry"] = (organizationId, entryId) =>
    findReversingEntryQuery({ organizationId, id: entryId }).pipe(
      Effect.map(Option.map(rowToJournalEntry)),
      wrapSqlError("findReversingEntry")
    )

  const countDraftEntriesInPeriod: JournalEntryRepositoryService["countDraftEntriesInPeriod"] = (
    organizationId,
    companyId,
    period
  ) =>
    countDraftEntriesQuery({ organizationId, companyId, year: period.year, period: period.period }).pipe(
      Effect.map((row) => parseInt(row.count, 10)),
      wrapSqlError("countDraftEntriesInPeriod")
    )

  const findIntercompanyEntries: JournalEntryRepositoryService["findIntercompanyEntries"] = (organizationId, companyId) =>
    findIntercompanyEntriesQuery({ organizationId, companyId }).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntry)),
      wrapSqlError("findIntercompanyEntries")
    )

  const exists: JournalEntryRepositoryService["exists"] = (organizationId, id) =>
    countById({ organizationId, id }).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  const getNextEntryNumber: JournalEntryRepositoryService["getNextEntryNumber"] = (organizationId, companyId) =>
    getMaxEntryNumber({ organizationId, companyId }).pipe(
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
