/**
 * JournalEntryRepositoryLive - PostgreSQL implementation of JournalEntryRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module JournalEntryRepositoryLive
 */

import { SqlClient } from "@effect/sql"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { CompanyId } from "@accountability/core/domain/Company"
import { FiscalPeriodRef } from "@accountability/core/domain/FiscalPeriodRef"
import {
  EntryNumber,
  JournalEntry,
  JournalEntryId,
  type JournalEntryStatus,
  type JournalEntryType,
  type SourceModule,
  UserId
} from "@accountability/core/domain/JournalEntry"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { JournalEntryRepository, type JournalEntryRepositoryService } from "./JournalEntryRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Database row type for journal_entries table
 */
interface JournalEntryRow {
  readonly id: string
  readonly company_id: string
  readonly entry_number: string | null
  readonly reference_number: string | null
  readonly description: string
  readonly transaction_date: Date
  readonly posting_date: Date | null
  readonly document_date: Date | null
  readonly fiscal_year: number
  readonly fiscal_period: number
  readonly entry_type: string
  readonly source_module: string
  readonly source_document_ref: string | null
  readonly is_multi_currency: boolean
  readonly status: string
  readonly is_reversing: boolean
  readonly reversed_entry_id: string | null
  readonly reversing_entry_id: string | null
  readonly created_by: string
  readonly created_at: Date
  readonly posted_by: string | null
  readonly posted_at: Date | null
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
 * Convert database row to JournalEntry domain entity
 */
const rowToJournalEntry = (row: JournalEntryRow): Effect.Effect<JournalEntry, PersistenceError> =>
  Effect.try({
    try: () =>
      JournalEntry.make(
        {
          id: JournalEntryId.make(row.id, { disableValidation: true }),
          companyId: CompanyId.make(row.company_id, { disableValidation: true }),
          entryNumber: row.entry_number !== null
            ? Option.some(EntryNumber.make(row.entry_number, { disableValidation: true }))
            : Option.none<typeof EntryNumber.Type>(),
          referenceNumber: row.reference_number !== null
            ? Option.some(row.reference_number)
            : Option.none<string>(),
          description: row.description,
          transactionDate: dateToLocalDate(row.transaction_date),
          postingDate: row.posting_date !== null
            ? Option.some(dateToLocalDate(row.posting_date))
            : Option.none<LocalDate>(),
          documentDate: row.document_date !== null
            ? Option.some(dateToLocalDate(row.document_date))
            : Option.none<LocalDate>(),
          fiscalPeriod: FiscalPeriodRef.make(
            { year: row.fiscal_year, period: row.fiscal_period },
            { disableValidation: true }
          ),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          entryType: row.entry_type as JournalEntryType,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          sourceModule: row.source_module as SourceModule,
          sourceDocumentRef: row.source_document_ref !== null
            ? Option.some(row.source_document_ref)
            : Option.none<string>(),
          isMultiCurrency: row.is_multi_currency,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Database string to union type
          status: row.status as JournalEntryStatus,
          isReversing: row.is_reversing,
          reversedEntryId: row.reversed_entry_id !== null
            ? Option.some(JournalEntryId.make(row.reversed_entry_id, { disableValidation: true }))
            : Option.none<typeof JournalEntryId.Type>(),
          reversingEntryId: row.reversing_entry_id !== null
            ? Option.some(JournalEntryId.make(row.reversing_entry_id, { disableValidation: true }))
            : Option.none<typeof JournalEntryId.Type>(),
          createdBy: UserId.make(row.created_by, { disableValidation: true }),
          createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }, { disableValidation: true }),
          postedBy: row.posted_by !== null
            ? Option.some(UserId.make(row.posted_by, { disableValidation: true }))
            : Option.none<typeof UserId.Type>(),
          postedAt: row.posted_at !== null
            ? Option.some(Timestamp.make({ epochMillis: row.posted_at.getTime() }, { disableValidation: true }))
            : Option.none<Timestamp>()
        },
        { disableValidation: true }
      ),
    catch: (cause) => new PersistenceError({ operation: "rowToJournalEntry", cause })
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
 * Implementation of JournalEntryRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findById: JournalEntryRepositoryService["findById"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries WHERE id = ${id}
      `.pipe(wrapSqlError("findById"))

      if (rows.length === 0) {
        return Option.none()
      }

      const entry = yield* rowToJournalEntry(rows[0])
      return Option.some(entry)
    })

  const findByCompany: JournalEntryRepositoryService["findByCompany"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId}
        ORDER BY transaction_date DESC, created_at DESC
      `.pipe(wrapSqlError("findByCompany"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

  const findByPeriod: JournalEntryRepositoryService["findByPeriod"] = (companyId, period) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId}
          AND fiscal_year = ${period.year}
          AND fiscal_period = ${period.period}
        ORDER BY transaction_date DESC, created_at DESC
      `.pipe(wrapSqlError("findByPeriod"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

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
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId} AND status = ${status}
        ORDER BY transaction_date DESC, created_at DESC
      `.pipe(wrapSqlError("findByStatus"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

  const findByType: JournalEntryRepositoryService["findByType"] = (companyId, entryType) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId} AND entry_type = ${entryType}
        ORDER BY transaction_date DESC, created_at DESC
      `.pipe(wrapSqlError("findByType"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

  const findByPeriodRange: JournalEntryRepositoryService["findByPeriodRange"] = (
    companyId,
    startPeriod,
    endPeriod
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId}
          AND (fiscal_year > ${startPeriod.year}
               OR (fiscal_year = ${startPeriod.year} AND fiscal_period >= ${startPeriod.period}))
          AND (fiscal_year < ${endPeriod.year}
               OR (fiscal_year = ${endPeriod.year} AND fiscal_period <= ${endPeriod.period}))
        ORDER BY fiscal_year, fiscal_period, transaction_date
      `.pipe(wrapSqlError("findByPeriodRange"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

  const findDraftEntries: JournalEntryRepositoryService["findDraftEntries"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId} AND status = 'Draft'
        ORDER BY created_at DESC
      `.pipe(wrapSqlError("findDraftEntries"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

  const findPostedByPeriod: JournalEntryRepositoryService["findPostedByPeriod"] = (companyId, period) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId}
          AND status = 'Posted'
          AND fiscal_year = ${period.year}
          AND fiscal_period = ${period.period}
        ORDER BY posting_date, entry_number
      `.pipe(wrapSqlError("findPostedByPeriod"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

  const findReversingEntry: JournalEntryRepositoryService["findReversingEntry"] = (entryId) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE reversed_entry_id = ${entryId}
      `.pipe(wrapSqlError("findReversingEntry"))

      if (rows.length === 0) {
        return Option.none()
      }

      const entry = yield* rowToJournalEntry(rows[0])
      return Option.some(entry)
    })

  const countDraftEntriesInPeriod: JournalEntryRepositoryService["countDraftEntriesInPeriod"] = (
    companyId,
    period
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM journal_entries
        WHERE company_id = ${companyId}
          AND status = 'Draft'
          AND fiscal_year = ${period.year}
          AND fiscal_period = ${period.period}
      `.pipe(wrapSqlError("countDraftEntriesInPeriod"))

      return parseInt(rows[0].count, 10)
    })

  const findIntercompanyEntries: JournalEntryRepositoryService["findIntercompanyEntries"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<JournalEntryRow>`
        SELECT * FROM journal_entries
        WHERE company_id = ${companyId} AND entry_type = 'Intercompany'
        ORDER BY transaction_date DESC, created_at DESC
      `.pipe(wrapSqlError("findIntercompanyEntries"))

      return yield* Effect.forEach(rows, rowToJournalEntry)
    })

  const exists: JournalEntryRepositoryService["exists"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM journal_entries WHERE id = ${id}
      `.pipe(wrapSqlError("exists"))

      return parseInt(rows[0].count, 10) > 0
    })

  const getNextEntryNumber: JournalEntryRepositoryService["getNextEntryNumber"] = (companyId) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ max_num: string | null }>`
        SELECT MAX(entry_number) as max_num FROM journal_entries
        WHERE company_id = ${companyId} AND entry_number IS NOT NULL
      `.pipe(wrapSqlError("getNextEntryNumber"))

      const maxNum = rows[0].max_num
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
    })

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
