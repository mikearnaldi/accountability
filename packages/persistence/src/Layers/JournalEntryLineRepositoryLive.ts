/**
 * JournalEntryLineRepositoryLive - PostgreSQL implementation of JournalEntryLineRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module JournalEntryLineRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AccountId } from "@accountability/core/accounting/Account"
import { CompanyId } from "@accountability/core/company/Company"
import { JournalEntryId } from "@accountability/core/journal/JournalEntry"
import {
  Dimensions,
  JournalEntryLine,
  JournalEntryLineId
} from "@accountability/core/journal/JournalEntryLine"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import {
  JournalEntryLineRepository,
  type JournalEntryLineRepositoryService
} from "../Services/JournalEntryLineRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from journal_entry_lines table
 */
const JournalEntryLineRow = Schema.Struct({
  id: Schema.String,
  journal_entry_id: Schema.String,
  line_number: Schema.Number,
  account_id: Schema.String,
  debit_amount: Schema.NullOr(Schema.String),
  debit_currency: Schema.NullOr(Schema.String),
  credit_amount: Schema.NullOr(Schema.String),
  credit_currency: Schema.NullOr(Schema.String),
  functional_debit_amount: Schema.NullOr(Schema.String),
  functional_debit_currency: Schema.NullOr(Schema.String),
  functional_credit_amount: Schema.NullOr(Schema.String),
  functional_credit_currency: Schema.NullOr(Schema.String),
  exchange_rate: Schema.String,
  memo: Schema.NullOr(Schema.String),
  dimensions: Schema.NullOr(Schema.Unknown),
  intercompany_partner_id: Schema.NullOr(Schema.String),
  matching_line_id: Schema.NullOr(Schema.String)
})
type JournalEntryLineRow = typeof JournalEntryLineRow.Type

/**
 * Convert a nullable amount and currency to an Option<MonetaryAmount>
 */
const toOptionalMonetaryAmount = (
  amount: string | null,
  currency: string | null
): Option.Option<MonetaryAmount> => {
  if (amount === null || currency === null) {
    return Option.none()
  }
  return Option.some(
    MonetaryAmount.make({
      amount: BigDecimal.unsafeFromString(amount),
      currency: CurrencyCode.make(currency)
    })
  )
}

/**
 * Decode dimensions from unknown JSON value
 */
const decodeDimensions = (value: unknown): Option.Option<Dimensions> => {
  if (value === null || value === undefined) {
    return Option.none()
  }
  // Parse JSON if it's a string (from PostgreSQL JSONB column)
  const parsed = typeof value === "string" ? JSON.parse(value) : value
  return Option.some(Schema.decodeUnknownSync(Dimensions)(parsed))
}

/**
 * Convert database row to JournalEntryLine domain entity
 */
const rowToJournalEntryLine = (row: JournalEntryLineRow): JournalEntryLine =>
  JournalEntryLine.make({
    id: JournalEntryLineId.make(row.id),
    journalEntryId: JournalEntryId.make(row.journal_entry_id),
    lineNumber: row.line_number,
    accountId: AccountId.make(row.account_id),
    debitAmount: toOptionalMonetaryAmount(row.debit_amount, row.debit_currency),
    creditAmount: toOptionalMonetaryAmount(row.credit_amount, row.credit_currency),
    functionalCurrencyDebitAmount: toOptionalMonetaryAmount(
      row.functional_debit_amount,
      row.functional_debit_currency
    ),
    functionalCurrencyCreditAmount: toOptionalMonetaryAmount(
      row.functional_credit_amount,
      row.functional_credit_currency
    ),
    exchangeRate: BigDecimal.unsafeFromString(row.exchange_rate),
    memo: Option.fromNullable(row.memo),
    dimensions: decodeDimensions(row.dimensions),
    intercompanyPartnerId: Option.fromNullable(row.intercompany_partner_id).pipe(
      Option.map(CompanyId.make)
    ),
    matchingLineId: Option.fromNullable(row.matching_line_id).pipe(
      Option.map(JournalEntryLineId.make)
    )
  })

/**
 * Implementation of JournalEntryLineRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findByJournalEntryQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: JournalEntryLineRow,
    execute: (journalEntryId) => sql`
      SELECT * FROM journal_entry_lines
      WHERE journal_entry_id = ${journalEntryId}
      ORDER BY line_number
    `
  })

  const findByAccountQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: JournalEntryLineRow,
    execute: (accountId) => sql`
      SELECT * FROM journal_entry_lines
      WHERE account_id = ${accountId}
      ORDER BY journal_entry_id, line_number
    `
  })

  const findByIdQuery = SqlSchema.findOne({
    Request: Schema.String,
    Result: JournalEntryLineRow,
    execute: (id) => sql`SELECT * FROM journal_entry_lines WHERE id = ${id}`
  })

  const findByJournalEntry: JournalEntryLineRepositoryService["findByJournalEntry"] = (
    journalEntryId
  ) =>
    findByJournalEntryQuery(journalEntryId).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntryLine)),
      wrapSqlError("findByJournalEntry")
    )

  const findByJournalEntries: JournalEntryLineRepositoryService["findByJournalEntries"] = (
    journalEntryIds
  ) =>
    Effect.gen(function* () {
      if (journalEntryIds.length === 0) {
        return new Map<JournalEntryId, ReadonlyArray<JournalEntryLine>>()
      }

      const rows = yield* sql`
        SELECT * FROM journal_entry_lines
        WHERE journal_entry_id IN ${sql.in(journalEntryIds)}
        ORDER BY journal_entry_id, line_number
      `.pipe(wrapSqlError("findByJournalEntries"))

      // Decode rows using Schema and convert to domain entities
      const decodedRows = rows.map((row) => {
        const typedRow = Schema.decodeUnknownSync(JournalEntryLineRow)(row)
        return rowToJournalEntryLine(typedRow)
      })

      // Group by journal entry ID
      const result = new Map<JournalEntryId, JournalEntryLine[]>()
      for (const line of decodedRows) {
        const existing = result.get(line.journalEntryId) ?? []
        existing.push(line)
        result.set(line.journalEntryId, existing)
      }

      return result
    })

  const createMany: JournalEntryLineRepositoryService["createMany"] = (lines) =>
    Effect.gen(function* () {
      if (lines.length === 0) {
        return []
      }

      const values = lines.map((line) => ({
        id: line.id,
        journal_entry_id: line.journalEntryId,
        line_number: line.lineNumber,
        account_id: line.accountId,
        debit_amount: Option.match(line.debitAmount, {
          onNone: () => null,
          onSome: (m) => BigDecimal.format(m.amount)
        }),
        debit_currency: Option.match(line.debitAmount, {
          onNone: () => null,
          onSome: (m) => m.currency
        }),
        credit_amount: Option.match(line.creditAmount, {
          onNone: () => null,
          onSome: (m) => BigDecimal.format(m.amount)
        }),
        credit_currency: Option.match(line.creditAmount, {
          onNone: () => null,
          onSome: (m) => m.currency
        }),
        functional_debit_amount: Option.match(line.functionalCurrencyDebitAmount, {
          onNone: () => null,
          onSome: (m) => BigDecimal.format(m.amount)
        }),
        functional_debit_currency: Option.match(line.functionalCurrencyDebitAmount, {
          onNone: () => null,
          onSome: (m) => m.currency
        }),
        functional_credit_amount: Option.match(line.functionalCurrencyCreditAmount, {
          onNone: () => null,
          onSome: (m) => BigDecimal.format(m.amount)
        }),
        functional_credit_currency: Option.match(line.functionalCurrencyCreditAmount, {
          onNone: () => null,
          onSome: (m) => m.currency
        }),
        exchange_rate: BigDecimal.format(line.exchangeRate),
        memo: Option.getOrNull(line.memo),
        dimensions: Option.match(line.dimensions, {
          onNone: () => null,
          onSome: (d) => JSON.stringify(d)
        }),
        intercompany_partner_id: Option.getOrNull(line.intercompanyPartnerId),
        matching_line_id: Option.getOrNull(line.matchingLineId)
      }))

      yield* sql`INSERT INTO journal_entry_lines ${sql.insert(values)}`.pipe(
        wrapSqlError("createMany")
      )

      return lines
    })

  const deleteByJournalEntry: JournalEntryLineRepositoryService["deleteByJournalEntry"] = (
    journalEntryId
  ) =>
    sql`DELETE FROM journal_entry_lines WHERE journal_entry_id = ${journalEntryId}`.pipe(
      Effect.map(() => undefined),
      wrapSqlError("deleteByJournalEntry")
    )

  const findByAccount: JournalEntryLineRepositoryService["findByAccount"] = (accountId) =>
    findByAccountQuery(accountId).pipe(
      Effect.map((rows) => rows.map(rowToJournalEntryLine)),
      wrapSqlError("findByAccount")
    )

  const getById: JournalEntryLineRepositoryService["getById"] = (lineId) =>
    Effect.gen(function* () {
      const maybeLine = yield* findByIdQuery(lineId).pipe(
        Effect.map(Option.map(rowToJournalEntryLine)),
        wrapSqlError("getById")
      )

      return yield* Option.match(maybeLine, {
        onNone: () =>
          Effect.fail(new EntityNotFoundError({ entityType: "JournalEntryLine", entityId: lineId })),
        onSome: Effect.succeed
      })
    })

  const updateMany: JournalEntryLineRepositoryService["updateMany"] = (lines) =>
    Effect.gen(function* () {
      if (lines.length === 0) {
        return []
      }

      for (const line of lines) {
        yield* sql`
          UPDATE journal_entry_lines SET
            line_number = ${line.lineNumber},
            account_id = ${line.accountId},
            debit_amount = ${Option.match(line.debitAmount, {
              onNone: () => null,
              onSome: (m) => BigDecimal.format(m.amount)
            })},
            debit_currency = ${Option.match(line.debitAmount, {
              onNone: () => null,
              onSome: (m) => m.currency
            })},
            credit_amount = ${Option.match(line.creditAmount, {
              onNone: () => null,
              onSome: (m) => BigDecimal.format(m.amount)
            })},
            credit_currency = ${Option.match(line.creditAmount, {
              onNone: () => null,
              onSome: (m) => m.currency
            })},
            functional_debit_amount = ${Option.match(line.functionalCurrencyDebitAmount, {
              onNone: () => null,
              onSome: (m) => BigDecimal.format(m.amount)
            })},
            functional_debit_currency = ${Option.match(line.functionalCurrencyDebitAmount, {
              onNone: () => null,
              onSome: (m) => m.currency
            })},
            functional_credit_amount = ${Option.match(line.functionalCurrencyCreditAmount, {
              onNone: () => null,
              onSome: (m) => BigDecimal.format(m.amount)
            })},
            functional_credit_currency = ${Option.match(line.functionalCurrencyCreditAmount, {
              onNone: () => null,
              onSome: (m) => m.currency
            })},
            exchange_rate = ${BigDecimal.format(line.exchangeRate)},
            memo = ${Option.getOrNull(line.memo)},
            dimensions = ${Option.match(line.dimensions, {
              onNone: () => null,
              onSome: (d) => JSON.stringify(d)
            })},
            intercompany_partner_id = ${Option.getOrNull(line.intercompanyPartnerId)},
            matching_line_id = ${Option.getOrNull(line.matchingLineId)}
          WHERE id = ${line.id}
        `.pipe(wrapSqlError("updateMany"))
      }

      return lines
    })

  return {
    findByJournalEntry,
    findByJournalEntries,
    createMany,
    deleteByJournalEntry,
    findByAccount,
    getById,
    updateMany
  } satisfies JournalEntryLineRepositoryService
})

/**
 * JournalEntryLineRepositoryLive - Layer providing JournalEntryLineRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const JournalEntryLineRepositoryLive = Layer.effect(JournalEntryLineRepository, make)
