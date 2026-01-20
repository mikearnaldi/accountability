/**
 * ExchangeRateRepositoryLive - PostgreSQL implementation of ExchangeRateRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module ExchangeRateRepositoryLive
 */

import { SqlClient, SqlSchema } from "@effect/sql"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import {
  ExchangeRate,
  ExchangeRateId,
  Rate,
  RateSource,
  RateType
} from "@accountability/core/currency/ExchangeRate"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { ExchangeRateRepository, type ExchangeRateRepositoryService } from "../Services/ExchangeRateRepository.ts"
import { EntityNotFoundError, wrapSqlError } from "../Errors/RepositoryError.ts"

/**
 * Schema for database row from exchange_rates table
 * Uses proper literal types for enum fields to avoid type assertions
 */
const ExchangeRateRow = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  from_currency: CurrencyCode,
  to_currency: CurrencyCode,
  rate: Schema.String,
  effective_date: Schema.DateFromSelf,
  rate_type: RateType,
  source: RateSource,
  created_at: Schema.DateFromSelf
})
type ExchangeRateRow = typeof ExchangeRateRow.Type

/**
 * Schema for count query result
 */
const CountRow = Schema.Struct({
  count: Schema.String
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
 * Convert database row to ExchangeRate domain entity
 * Pure function - no Effect wrapping needed
 * Note: BigDecimal.unsafeFromString can throw, but database values are trusted to be valid
 * Since the row schema uses proper literal types, no type assertions needed
 */
const rowToExchangeRate = (row: ExchangeRateRow): ExchangeRate => {
  const rateDecimal = BigDecimal.unsafeFromString(row.rate)
  return ExchangeRate.make({
    id: ExchangeRateId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    fromCurrency: row.from_currency,
    toCurrency: row.to_currency,
    rate: Rate.make(rateDecimal),
    effectiveDate: dateToLocalDate(row.effective_date),
    rateType: row.rate_type,
    source: row.source,
    createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() })
  })
}

/**
 * Implementation of ExchangeRateRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // SqlSchema query builders for type-safe queries
  const findRateQuery = SqlSchema.findOne({
    Request: Schema.Struct({
      fromCurrency: Schema.String,
      toCurrency: Schema.String,
      effectiveDate: Schema.DateFromSelf,
      rateType: Schema.String
    }),
    Result: ExchangeRateRow,
    execute: ({ fromCurrency, toCurrency, effectiveDate, rateType }) => sql`
      SELECT * FROM exchange_rates
      WHERE from_currency = ${fromCurrency}
        AND to_currency = ${toCurrency}
        AND effective_date = ${effectiveDate}
        AND rate_type = ${rateType}
      LIMIT 1
    `
  })

  const findLatestRateQuery = SqlSchema.findOne({
    Request: Schema.Struct({
      fromCurrency: Schema.String,
      toCurrency: Schema.String,
      rateType: Schema.String
    }),
    Result: ExchangeRateRow,
    execute: ({ fromCurrency, toCurrency, rateType }) => sql`
      SELECT * FROM exchange_rates
      WHERE from_currency = ${fromCurrency}
        AND to_currency = ${toCurrency}
        AND rate_type = ${rateType}
      ORDER BY effective_date DESC
      LIMIT 1
    `
  })

  const findExchangeRateById = SqlSchema.findOne({
    Request: Schema.String,
    Result: ExchangeRateRow,
    execute: (id) => sql`SELECT * FROM exchange_rates WHERE id = ${id}`
  })

  const findRatesByCurrencyPair = SqlSchema.findAll({
    Request: Schema.Struct({ fromCurrency: Schema.String, toCurrency: Schema.String }),
    Result: ExchangeRateRow,
    execute: ({ fromCurrency, toCurrency }) => sql`
      SELECT * FROM exchange_rates
      WHERE from_currency = ${fromCurrency}
        AND to_currency = ${toCurrency}
      ORDER BY effective_date DESC, rate_type
    `
  })

  const findRatesByDateRange = SqlSchema.findAll({
    Request: Schema.Struct({
      fromCurrency: Schema.String,
      toCurrency: Schema.String,
      startDate: Schema.DateFromSelf,
      endDate: Schema.DateFromSelf
    }),
    Result: ExchangeRateRow,
    execute: ({ fromCurrency, toCurrency, startDate, endDate }) => sql`
      SELECT * FROM exchange_rates
      WHERE from_currency = ${fromCurrency}
        AND to_currency = ${toCurrency}
        AND effective_date >= ${startDate}
        AND effective_date <= ${endDate}
      ORDER BY effective_date DESC
    `
  })

  const findClosestRateQuery = SqlSchema.findOne({
    Request: Schema.Struct({
      fromCurrency: Schema.String,
      toCurrency: Schema.String,
      date: Schema.DateFromSelf,
      rateType: Schema.String
    }),
    Result: ExchangeRateRow,
    execute: ({ fromCurrency, toCurrency, date, rateType }) => sql`
      SELECT * FROM exchange_rates
      WHERE from_currency = ${fromCurrency}
        AND to_currency = ${toCurrency}
        AND rate_type = ${rateType}
        AND effective_date <= ${date}
      ORDER BY effective_date DESC
      LIMIT 1
    `
  })

  const findAverageRateQuery = SqlSchema.findOne({
    Request: Schema.Struct({
      fromCurrency: Schema.String,
      toCurrency: Schema.String,
      startDate: Schema.DateFromSelf,
      endDate: Schema.DateFromSelf
    }),
    Result: ExchangeRateRow,
    execute: ({ fromCurrency, toCurrency, startDate, endDate }) => sql`
      SELECT * FROM exchange_rates
      WHERE from_currency = ${fromCurrency}
        AND to_currency = ${toCurrency}
        AND rate_type = 'Average'
        AND effective_date >= ${startDate}
        AND effective_date < ${endDate}
      ORDER BY effective_date DESC
      LIMIT 1
    `
  })

  const findClosingRateQuery = SqlSchema.findOne({
    Request: Schema.Struct({
      fromCurrency: Schema.String,
      toCurrency: Schema.String,
      endDate: Schema.DateFromSelf
    }),
    Result: ExchangeRateRow,
    execute: ({ fromCurrency, toCurrency, endDate }) => sql`
      SELECT * FROM exchange_rates
      WHERE from_currency = ${fromCurrency}
        AND to_currency = ${toCurrency}
        AND rate_type = 'Closing'
        AND effective_date = ${endDate}
      LIMIT 1
    `
  })

  const countById = SqlSchema.single({
    Request: Schema.String,
    Result: CountRow,
    execute: (id) => sql`SELECT COUNT(*) as count FROM exchange_rates WHERE id = ${id}`
  })

  const findRate: ExchangeRateRepositoryService["findRate"] = (
    fromCurrency,
    toCurrency,
    effectiveDate,
    rateType
  ) =>
    findRateQuery({
      fromCurrency,
      toCurrency,
      effectiveDate: effectiveDate.toDate(),
      rateType
    }).pipe(
      Effect.map(Option.map(rowToExchangeRate)),
      wrapSqlError("findRate")
    )

  const findLatestRate: ExchangeRateRepositoryService["findLatestRate"] = (
    fromCurrency,
    toCurrency,
    rateType
  ) =>
    findLatestRateQuery({ fromCurrency, toCurrency, rateType }).pipe(
      Effect.map(Option.map(rowToExchangeRate)),
      wrapSqlError("findLatestRate")
    )

  const create: ExchangeRateRepositoryService["create"] = (rate) =>
    Effect.gen(function* () {
      // Use ISO strings for DATE columns to avoid timezone conversion issues
      yield* sql`
        INSERT INTO exchange_rates (
          id, organization_id, from_currency, to_currency, rate, effective_date,
          rate_type, source, created_at
        ) VALUES (
          ${rate.id},
          ${rate.organizationId},
          ${rate.fromCurrency},
          ${rate.toCurrency},
          ${BigDecimal.format(rate.rate)},
          ${rate.effectiveDate.toString()}::date,
          ${rate.rateType},
          ${rate.source},
          ${rate.createdAt.toDate()}
        )
      `.pipe(wrapSqlError("create"))

      return rate
    })

  const findById: ExchangeRateRepositoryService["findById"] = (id) =>
    findExchangeRateById(id).pipe(
      Effect.map(Option.map(rowToExchangeRate)),
      wrapSqlError("findById")
    )

  const getById: ExchangeRateRepositoryService["getById"] = (id) =>
    Effect.gen(function* () {
      const maybeRate = yield* findById(id)
      return yield* Option.match(maybeRate, {
        onNone: () => Effect.fail(new EntityNotFoundError({ entityType: "ExchangeRate", entityId: id })),
        onSome: Effect.succeed
      })
    })

  const findByCurrencyPair: ExchangeRateRepositoryService["findByCurrencyPair"] = (
    fromCurrency,
    toCurrency
  ) =>
    findRatesByCurrencyPair({ fromCurrency, toCurrency }).pipe(
      Effect.map((rows) => rows.map(rowToExchangeRate)),
      wrapSqlError("findByCurrencyPair")
    )

  const findByDateRange: ExchangeRateRepositoryService["findByDateRange"] = (
    fromCurrency,
    toCurrency,
    startDate,
    endDate
  ) =>
    findRatesByDateRange({
      fromCurrency,
      toCurrency,
      startDate: startDate.toDate(),
      endDate: endDate.toDate()
    }).pipe(
      Effect.map((rows) => rows.map(rowToExchangeRate)),
      wrapSqlError("findByDateRange")
    )

  const findClosestRate: ExchangeRateRepositoryService["findClosestRate"] = (
    fromCurrency,
    toCurrency,
    date,
    rateType
  ) =>
    findClosestRateQuery({
      fromCurrency,
      toCurrency,
      date: date.toDate(),
      rateType
    }).pipe(
      Effect.map(Option.map(rowToExchangeRate)),
      wrapSqlError("findClosestRate")
    )

  const findAverageRateForPeriod: ExchangeRateRepositoryService["findAverageRateForPeriod"] = (
    fromCurrency,
    toCurrency,
    year,
    period
  ) => {
    // Calculate the period's date range based on year and period
    const startMonth = period
    const startDate = new Date(Date.UTC(year, startMonth - 1, 1))
    const nextMonth = startMonth === 12 ? 1 : startMonth + 1
    const nextYear = startMonth === 12 ? year + 1 : year
    const endDate = new Date(Date.UTC(nextYear, nextMonth - 1, 1))

    return findAverageRateQuery({
      fromCurrency,
      toCurrency,
      startDate,
      endDate
    }).pipe(
      Effect.map(Option.map(rowToExchangeRate)),
      wrapSqlError("findAverageRateForPeriod")
    )
  }

  const findClosingRateForPeriod: ExchangeRateRepositoryService["findClosingRateForPeriod"] = (
    fromCurrency,
    toCurrency,
    year,
    period
  ) => {
    // Get the last day of the period
    const nextMonth = period === 12 ? 1 : period + 1
    const nextYear = period === 12 ? year + 1 : year
    // Get last day by creating first day of next month and subtracting 1 day
    const firstOfNext = new Date(Date.UTC(nextYear, nextMonth - 1, 1))
    const lastDay = new Date(firstOfNext.getTime() - 24 * 60 * 60 * 1000)

    return findClosingRateQuery({
      fromCurrency,
      toCurrency,
      endDate: lastDay
    }).pipe(
      Effect.map(Option.map(rowToExchangeRate)),
      wrapSqlError("findClosingRateForPeriod")
    )
  }

  const createMany: ExchangeRateRepositoryService["createMany"] = (rates) =>
    Effect.gen(function* () {
      for (const rate of rates) {
        yield* create(rate)
      }
      return rates
    })

  const exists: ExchangeRateRepositoryService["exists"] = (id) =>
    countById(id).pipe(
      Effect.map((row) => parseInt(row.count, 10) > 0),
      wrapSqlError("exists")
    )

  const deleteRate: ExchangeRateRepositoryService["delete"] = (id) =>
    Effect.gen(function* () {
      const rateExists = yield* exists(id)
      if (!rateExists) {
        return yield* Effect.fail(new EntityNotFoundError({ entityType: "ExchangeRate", entityId: id }))
      }

      yield* sql`
        DELETE FROM exchange_rates WHERE id = ${id}
      `.pipe(wrapSqlError("delete"))
    })

  return {
    findRate,
    findLatestRate,
    create,
    findById,
    getById,
    findByCurrencyPair,
    findByDateRange,
    findClosestRate,
    findAverageRateForPeriod,
    findClosingRateForPeriod,
    createMany,
    exists,
    delete: deleteRate
  } satisfies ExchangeRateRepositoryService
})

/**
 * ExchangeRateRepositoryLive - Layer providing ExchangeRateRepository implementation
 *
 * Requires PgClient.PgClient (or SqlClient.SqlClient) in context.
 */
export const ExchangeRateRepositoryLive = Layer.effect(ExchangeRateRepository, make)
