/**
 * IntercompanyTransactionRepositoryLive - PostgreSQL implementation of IntercompanyTransactionRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module IntercompanyTransactionRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CompanyId } from "@accountability/core/company/Company"
import {
  IntercompanyTransaction,
  IntercompanyTransactionId,
  IntercompanyTransactionType,
  MatchingStatus
} from "@accountability/core/consolidation/IntercompanyTransaction"
import { JournalEntryId } from "@accountability/core/journal/JournalEntry"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import {
  IntercompanyTransactionRepository,
  type IntercompanyTransactionRepositoryService
} from "../Services/IntercompanyTransactionRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for amount JSON stored in database
 */
const AmountJson = Schema.Struct({
  amount: Schema.String,
  currency: Schema.String
})

/**
 * Schema for database row from intercompany_transactions table
 */
const IntercompanyTransactionRow = Schema.Struct({
  id: Schema.String,
  from_company_id: Schema.String,
  to_company_id: Schema.String,
  transaction_type: IntercompanyTransactionType,
  transaction_date: Schema.DateFromSelf,
  amount: AmountJson,
  from_journal_entry_id: Schema.NullOr(Schema.String),
  to_journal_entry_id: Schema.NullOr(Schema.String),
  matching_status: MatchingStatus,
  variance_amount: Schema.NullOr(AmountJson),
  variance_explanation: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf
})
type IntercompanyTransactionRow = typeof IntercompanyTransactionRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
})

/**
 * Convert Date to LocalDate
 *
 * NOTE: The postgres driver returns DATE columns as Date objects at local midnight,
 * so we use local time methods (getFullYear, getMonth, getDate) not UTC methods.
 */
const dateToLocalDate = (date: Date): LocalDate =>
  LocalDate.make({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })

/**
 * Convert database row to IntercompanyTransaction domain entity
 */
const rowToIntercompanyTransaction = (row: IntercompanyTransactionRow): IntercompanyTransaction => {
  const amount = MonetaryAmount.make({
    amount: BigDecimal.unsafeFromString(row.amount.amount),
    currency: CurrencyCode.make(row.amount.currency)
  })

  const varianceAmount = Option.fromNullable(row.variance_amount).pipe(
    Option.map((va) => MonetaryAmount.make({
      amount: BigDecimal.unsafeFromString(va.amount),
      currency: CurrencyCode.make(va.currency)
    }))
  )

  return IntercompanyTransaction.make({
    id: IntercompanyTransactionId.make(row.id),
    fromCompanyId: CompanyId.make(row.from_company_id),
    toCompanyId: CompanyId.make(row.to_company_id),
    transactionType: row.transaction_type,
    transactionDate: dateToLocalDate(row.transaction_date),
    amount,
    fromJournalEntryId: Option.fromNullable(row.from_journal_entry_id).pipe(
      Option.map((id) => JournalEntryId.make(id))
    ),
    toJournalEntryId: Option.fromNullable(row.to_journal_entry_id).pipe(
      Option.map((id) => JournalEntryId.make(id))
    ),
    matchingStatus: row.matching_status,
    varianceAmount,
    varianceExplanation: Option.fromNullable(row.variance_explanation),
    description: Option.fromNullable(row.description),
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }),
    updatedAt: Timestamp.make({ epochMillis: row.updated_at.getTime() })
  })
}

/**
 * Convert MonetaryAmount to JSON for database storage
 */
const amountToJson = (amount: MonetaryAmount): object => ({
  amount: BigDecimal.format(amount.amount),
  currency: amount.currency
})

/**
 * Implementation of IntercompanyTransactionRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Query builders
  const findTransactionById = SqlSchema.findOne({
    Request: Schema.String,
    Result: IntercompanyTransactionRow,
    execute: (id) => sql`SELECT * FROM intercompany_transactions WHERE id = ${id}`
  })

  const findByFromCompanyQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: IntercompanyTransactionRow,
    execute: (companyId) => sql`
      SELECT * FROM intercompany_transactions
      WHERE from_company_id = ${companyId}
      ORDER BY transaction_date DESC
    `
  })

  const findByToCompanyQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: IntercompanyTransactionRow,
    execute: (companyId) => sql`
      SELECT * FROM intercompany_transactions
      WHERE to_company_id = ${companyId}
      ORDER BY transaction_date DESC
    `
  })

  const findByCompanyQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: IntercompanyTransactionRow,
    execute: (companyId) => sql`
      SELECT * FROM intercompany_transactions
      WHERE from_company_id = ${companyId} OR to_company_id = ${companyId}
      ORDER BY transaction_date DESC
    `
  })

  const findBetweenCompaniesQuery = SqlSchema.findAll({
    Request: Schema.Struct({ fromCompanyId: Schema.String, toCompanyId: Schema.String }),
    Result: IntercompanyTransactionRow,
    execute: ({ fromCompanyId, toCompanyId }) => sql`
      SELECT * FROM intercompany_transactions
      WHERE from_company_id = ${fromCompanyId} AND to_company_id = ${toCompanyId}
      ORDER BY transaction_date DESC
    `
  })

  const findByMatchingStatusQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: IntercompanyTransactionRow,
    execute: (status) => sql`
      SELECT * FROM intercompany_transactions
      WHERE matching_status = ${status}
      ORDER BY transaction_date DESC
    `
  })

  const findByTransactionTypeQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: IntercompanyTransactionRow,
    execute: (transactionType) => sql`
      SELECT * FROM intercompany_transactions
      WHERE transaction_type = ${transactionType}
      ORDER BY transaction_date DESC
    `
  })

  const findByDateRangeQuery = SqlSchema.findAll({
    Request: Schema.Struct({ startDate: Schema.DateFromSelf, endDate: Schema.DateFromSelf }),
    Result: IntercompanyTransactionRow,
    execute: ({ startDate, endDate }) => sql`
      SELECT * FROM intercompany_transactions
      WHERE transaction_date >= ${startDate} AND transaction_date <= ${endDate}
      ORDER BY transaction_date DESC
    `
  })

  const findUnmatchedQuery = SqlSchema.findAll({
    Request: Schema.Void,
    Result: IntercompanyTransactionRow,
    execute: () => sql`
      SELECT * FROM intercompany_transactions
      WHERE matching_status = 'Unmatched'
      ORDER BY transaction_date DESC
    `
  })

  const findByJournalEntryQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: IntercompanyTransactionRow,
    execute: (journalEntryId) => sql`
      SELECT * FROM intercompany_transactions
      WHERE from_journal_entry_id = ${journalEntryId} OR to_journal_entry_id = ${journalEntryId}
      ORDER BY transaction_date DESC
    `
  })

  const findRequiringEliminationQuery = SqlSchema.findAll({
    Request: Schema.Void,
    Result: IntercompanyTransactionRow,
    execute: () => sql`
      SELECT * FROM intercompany_transactions
      WHERE matching_status IN ('Matched', 'VarianceApproved')
      ORDER BY transaction_date DESC
    `
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM intercompany_transactions WHERE id = ${id}`
  })

  // Service methods
  const findById: IntercompanyTransactionRepositoryService["findById"] = (id) =>
    findTransactionById(id).pipe(
      Effect.map(Option.map(rowToIntercompanyTransaction)),
      wrapSqlError("findById")
    )

  const getById: IntercompanyTransactionRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeTransaction = yield* findById(id)
      return yield* Option.match(maybeTransaction, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "IntercompanyTransaction", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const create: IntercompanyTransactionRepositoryService["create"] = (transaction) =>
    Effect.gen(function* () {
      const varianceAmountJson = Option.match(transaction.varianceAmount, {
        onNone: () => null,
        onSome: (va) => amountToJson(va)
      })

      yield* sql`
        INSERT INTO intercompany_transactions (
          id, from_company_id, to_company_id, transaction_type, transaction_date,
          amount, from_journal_entry_id, to_journal_entry_id, matching_status,
          variance_amount, variance_explanation, description, created_at, updated_at
        ) VALUES (
          ${transaction.id},
          ${transaction.fromCompanyId},
          ${transaction.toCompanyId},
          ${transaction.transactionType},
          ${transaction.transactionDate.toString()}::date,
          ${amountToJson(transaction.amount)},
          ${Option.getOrNull(transaction.fromJournalEntryId)},
          ${Option.getOrNull(transaction.toJournalEntryId)},
          ${transaction.matchingStatus},
          ${varianceAmountJson},
          ${Option.getOrNull(transaction.varianceExplanation)},
          ${Option.getOrNull(transaction.description)},
          ${transaction.createdAt.toDate()},
          ${transaction.updatedAt.toDate()}
        )
      `.pipe(wrapSqlError("create"))

      return transaction
    })

  const update: IntercompanyTransactionRepositoryService["update"] = (transaction) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(transaction.id)
      if (!exists_) {
        return yield* Effect.fail(
          new EntityNotFoundError({ entityType: "IntercompanyTransaction", entityId: transaction.id })
        )
      }

      const varianceAmountJson = Option.match(transaction.varianceAmount, {
        onNone: () => null,
        onSome: (va) => amountToJson(va)
      })

      yield* sql`
        UPDATE intercompany_transactions SET
          from_company_id = ${transaction.fromCompanyId},
          to_company_id = ${transaction.toCompanyId},
          transaction_type = ${transaction.transactionType},
          transaction_date = ${transaction.transactionDate.toString()}::date,
          amount = ${amountToJson(transaction.amount)},
          from_journal_entry_id = ${Option.getOrNull(transaction.fromJournalEntryId)},
          to_journal_entry_id = ${Option.getOrNull(transaction.toJournalEntryId)},
          matching_status = ${transaction.matchingStatus},
          variance_amount = ${varianceAmountJson},
          variance_explanation = ${Option.getOrNull(transaction.varianceExplanation)},
          description = ${Option.getOrNull(transaction.description)},
          updated_at = NOW()
        WHERE id = ${transaction.id}
      `.pipe(wrapSqlError("update"))

      return transaction
    })

  const delete_: IntercompanyTransactionRepositoryService["delete"] = (id) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "IntercompanyTransaction", entityId: id }))
      }

      yield* sql`DELETE FROM intercompany_transactions WHERE id = ${id}`.pipe(wrapSqlError("delete"))
    })

  const findByFromCompany: IntercompanyTransactionRepositoryService["findByFromCompany"] = (companyId) =>
    findByFromCompanyQuery(companyId).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findByFromCompany")
    )

  const findByToCompany: IntercompanyTransactionRepositoryService["findByToCompany"] = (companyId) =>
    findByToCompanyQuery(companyId).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findByToCompany")
    )

  const findByCompany: IntercompanyTransactionRepositoryService["findByCompany"] = (companyId) =>
    findByCompanyQuery(companyId).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findByCompany")
    )

  const findBetweenCompanies: IntercompanyTransactionRepositoryService["findBetweenCompanies"] = (
    fromCompanyId,
    toCompanyId
  ) =>
    findBetweenCompaniesQuery({ fromCompanyId, toCompanyId }).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findBetweenCompanies")
    )

  const findByMatchingStatus: IntercompanyTransactionRepositoryService["findByMatchingStatus"] = (status) =>
    findByMatchingStatusQuery(status).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findByMatchingStatus")
    )

  const findByTransactionType: IntercompanyTransactionRepositoryService["findByTransactionType"] = (transactionType) =>
    findByTransactionTypeQuery(transactionType).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findByTransactionType")
    )

  const findByDateRange: IntercompanyTransactionRepositoryService["findByDateRange"] = (startDate, endDate) =>
    findByDateRangeQuery({
      startDate: startDate.toDate(),
      endDate: endDate.toDate()
    }).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findByDateRange")
    )

  const findUnmatched: IntercompanyTransactionRepositoryService["findUnmatched"] = () =>
    findUnmatchedQuery(undefined).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findUnmatched")
    )

  const findByJournalEntry: IntercompanyTransactionRepositoryService["findByJournalEntry"] = (journalEntryId) =>
    findByJournalEntryQuery(journalEntryId).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findByJournalEntry")
    )

  const findRequiringElimination: IntercompanyTransactionRepositoryService["findRequiringElimination"] = () =>
    findRequiringEliminationQuery(undefined).pipe(
      Effect.map((rows) => rows.map(rowToIntercompanyTransaction)),
      wrapSqlError("findRequiringElimination")
    )

  const exists: IntercompanyTransactionRepositoryService["exists"] = (id) =>
    countById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  const updateMatchingStatus: IntercompanyTransactionRepositoryService["updateMatchingStatus"] = (id, status) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "IntercompanyTransaction", entityId: id }))
      }

      yield* sql`
        UPDATE intercompany_transactions SET
          matching_status = ${status},
          updated_at = NOW()
        WHERE id = ${id}
      `.pipe(wrapSqlError("updateMatchingStatus"))

      return yield* getById(id)
    })

  const linkFromJournalEntry: IntercompanyTransactionRepositoryService["linkFromJournalEntry"] = (
    id,
    journalEntryId
  ) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "IntercompanyTransaction", entityId: id }))
      }

      yield* sql`
        UPDATE intercompany_transactions SET
          from_journal_entry_id = ${journalEntryId},
          updated_at = NOW()
        WHERE id = ${id}
      `.pipe(wrapSqlError("linkFromJournalEntry"))

      return yield* getById(id)
    })

  const linkToJournalEntry: IntercompanyTransactionRepositoryService["linkToJournalEntry"] = (id, journalEntryId) =>
    Effect.gen(function* () {
      const exists_ = yield* exists(id)
      if (!exists_) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "IntercompanyTransaction", entityId: id }))
      }

      yield* sql`
        UPDATE intercompany_transactions SET
          to_journal_entry_id = ${journalEntryId},
          updated_at = NOW()
        WHERE id = ${id}
      `.pipe(wrapSqlError("linkToJournalEntry"))

      return yield* getById(id)
    })

  return {
    findById,
    getById,
    create,
    update,
    delete: delete_,
    findByFromCompany,
    findByToCompany,
    findByCompany,
    findBetweenCompanies,
    findByMatchingStatus,
    findByTransactionType,
    findByDateRange,
    findUnmatched,
    findByJournalEntry,
    findRequiringElimination,
    exists,
    updateMatchingStatus,
    linkFromJournalEntry,
    linkToJournalEntry
  } satisfies IntercompanyTransactionRepositoryService
})

/**
 * IntercompanyTransactionRepositoryLive - Layer providing IntercompanyTransactionRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const IntercompanyTransactionRepositoryLive = Layer.effect(IntercompanyTransactionRepository, make)
