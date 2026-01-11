/**
 * ExchangeRateRepositoryLive - PostgreSQL implementation of ExchangeRateRepository
 *
 * Uses @effect/sql-pg for database operations with proper error handling
 * and Schema decoding for type-safe query results.
 *
 * @module ExchangeRateRepositoryLive
 */

import { SqlClient } from "@effect/sql"
import * as BigDecimal from "effect/BigDecimal"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import {
  ExchangeRate,
  ExchangeRateId,
  Rate,
  type RateSource,
  type RateType
} from "@accountability/core/domain/ExchangeRate"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { ExchangeRateRepository, type ExchangeRateRepositoryService } from "./ExchangeRateRepository.ts"
import { EntityNotFoundError, PersistenceError } from "./RepositoryError.ts"

/**
 * Database row type for exchange_rates table
 */
interface ExchangeRateRow {
  readonly id: string
  readonly from_currency: string
  readonly to_currency: string
  readonly rate: string
  readonly effective_date: Date
  readonly rate_type: string
  readonly source: string
  readonly created_at: Date
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
 * Convert database row to ExchangeRate domain entity
 */
const rowToExchangeRate = (row: ExchangeRateRow): Effect.Effect<ExchangeRate, PersistenceError> =>
  Effect.try({
    try: () => {
      const rateDecimal = BigDecimal.unsafeFromString(row.rate)
      return ExchangeRate.make(
        {
          id: ExchangeRateId.make(row.id, { disableValidation: true }),
          fromCurrency: row.from_currency as CurrencyCode,
          toCurrency: row.to_currency as CurrencyCode,
          rate: Rate.make(rateDecimal, { disableValidation: true }),
          effectiveDate: dateToLocalDate(row.effective_date),
          rateType: row.rate_type as RateType,
          source: row.source as RateSource,
          createdAt: Timestamp.make({ epochMillis: row.created_at.getTime() }, { disableValidation: true })
        },
        { disableValidation: true }
      )
    },
    catch: (cause) => new PersistenceError({ operation: "rowToExchangeRate", cause })
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
 * Implementation of ExchangeRateRepositoryService using PostgreSQL
 */
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findRate: ExchangeRateRepositoryService["findRate"] = (
    fromCurrency,
    toCurrency,
    effectiveDate,
    rateType
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates
        WHERE from_currency = ${fromCurrency}
          AND to_currency = ${toCurrency}
          AND effective_date = ${effectiveDate.toDate()}
          AND rate_type = ${rateType}
        LIMIT 1
      `.pipe(wrapSqlError("findRate"))

      if (rows.length === 0) {
        return Option.none()
      }

      const rate = yield* rowToExchangeRate(rows[0])
      return Option.some(rate)
    })

  const findLatestRate: ExchangeRateRepositoryService["findLatestRate"] = (
    fromCurrency,
    toCurrency,
    rateType
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates
        WHERE from_currency = ${fromCurrency}
          AND to_currency = ${toCurrency}
          AND rate_type = ${rateType}
        ORDER BY effective_date DESC
        LIMIT 1
      `.pipe(wrapSqlError("findLatestRate"))

      if (rows.length === 0) {
        return Option.none()
      }

      const rate = yield* rowToExchangeRate(rows[0])
      return Option.some(rate)
    })

  const create: ExchangeRateRepositoryService["create"] = (rate) =>
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO exchange_rates (
          id, from_currency, to_currency, rate, effective_date,
          rate_type, source, created_at
        ) VALUES (
          ${rate.id},
          ${rate.fromCurrency},
          ${rate.toCurrency},
          ${BigDecimal.format(rate.rate)},
          ${rate.effectiveDate.toDate()},
          ${rate.rateType},
          ${rate.source},
          ${rate.createdAt.toDate()}
        )
      `.pipe(wrapSqlError("create"))

      return rate
    })

  const findById: ExchangeRateRepositoryService["findById"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates WHERE id = ${id}
      `.pipe(wrapSqlError("findById"))

      if (rows.length === 0) {
        return Option.none()
      }

      const rate = yield* rowToExchangeRate(rows[0])
      return Option.some(rate)
    })

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
    Effect.gen(function* () {
      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates
        WHERE from_currency = ${fromCurrency}
          AND to_currency = ${toCurrency}
        ORDER BY effective_date DESC, rate_type
      `.pipe(wrapSqlError("findByCurrencyPair"))

      return yield* Effect.forEach(rows, rowToExchangeRate)
    })

  const findByDateRange: ExchangeRateRepositoryService["findByDateRange"] = (
    fromCurrency,
    toCurrency,
    startDate,
    endDate
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates
        WHERE from_currency = ${fromCurrency}
          AND to_currency = ${toCurrency}
          AND effective_date >= ${startDate.toDate()}
          AND effective_date <= ${endDate.toDate()}
        ORDER BY effective_date DESC
      `.pipe(wrapSqlError("findByDateRange"))

      return yield* Effect.forEach(rows, rowToExchangeRate)
    })

  const findClosestRate: ExchangeRateRepositoryService["findClosestRate"] = (
    fromCurrency,
    toCurrency,
    date,
    rateType
  ) =>
    Effect.gen(function* () {
      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates
        WHERE from_currency = ${fromCurrency}
          AND to_currency = ${toCurrency}
          AND rate_type = ${rateType}
          AND effective_date <= ${date.toDate()}
        ORDER BY effective_date DESC
        LIMIT 1
      `.pipe(wrapSqlError("findClosestRate"))

      if (rows.length === 0) {
        return Option.none()
      }

      const rate = yield* rowToExchangeRate(rows[0])
      return Option.some(rate)
    })

  const findAverageRateForPeriod: ExchangeRateRepositoryService["findAverageRateForPeriod"] = (
    fromCurrency,
    toCurrency,
    year,
    period
  ) =>
    Effect.gen(function* () {
      // Calculate the period's date range based on year and period
      const startMonth = period
      const startDate = LocalDate.make({ year, month: startMonth, day: 1 }, { disableValidation: true })
      const nextMonth = startMonth === 12 ? 1 : startMonth + 1
      const nextYear = startMonth === 12 ? year + 1 : year
      const endDate = LocalDate.make({ year: nextYear, month: nextMonth, day: 1 }, { disableValidation: true })

      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates
        WHERE from_currency = ${fromCurrency}
          AND to_currency = ${toCurrency}
          AND rate_type = 'Average'
          AND effective_date >= ${startDate.toDate()}
          AND effective_date < ${endDate.toDate()}
        ORDER BY effective_date DESC
        LIMIT 1
      `.pipe(wrapSqlError("findAverageRateForPeriod"))

      if (rows.length === 0) {
        return Option.none()
      }

      const rate = yield* rowToExchangeRate(rows[0])
      return Option.some(rate)
    })

  const findClosingRateForPeriod: ExchangeRateRepositoryService["findClosingRateForPeriod"] = (
    fromCurrency,
    toCurrency,
    year,
    period
  ) =>
    Effect.gen(function* () {
      // Get the last day of the period
      const nextMonth = period === 12 ? 1 : period + 1
      const nextYear = period === 12 ? year + 1 : year
      // Get last day by creating first day of next month and subtracting 1 day
      const firstOfNext = new Date(Date.UTC(nextYear, nextMonth - 1, 1))
      const lastDay = new Date(firstOfNext.getTime() - 24 * 60 * 60 * 1000)
      const endDate = LocalDate.make(
        { year: lastDay.getUTCFullYear(), month: lastDay.getUTCMonth() + 1, day: lastDay.getUTCDate() },
        { disableValidation: true }
      )

      const rows = yield* sql<ExchangeRateRow>`
        SELECT * FROM exchange_rates
        WHERE from_currency = ${fromCurrency}
          AND to_currency = ${toCurrency}
          AND rate_type = 'Closing'
          AND effective_date = ${endDate.toDate()}
        LIMIT 1
      `.pipe(wrapSqlError("findClosingRateForPeriod"))

      if (rows.length === 0) {
        return Option.none()
      }

      const rate = yield* rowToExchangeRate(rows[0])
      return Option.some(rate)
    })

  const createMany: ExchangeRateRepositoryService["createMany"] = (rates) =>
    Effect.gen(function* () {
      for (const rate of rates) {
        yield* create(rate)
      }
      return rates
    })

  const exists: ExchangeRateRepositoryService["exists"] = (id) =>
    Effect.gen(function* () {
      const rows = yield* sql<{ count: string }>`
        SELECT COUNT(*) as count FROM exchange_rates WHERE id = ${id}
      `.pipe(wrapSqlError("exists"))

      return parseInt(rows[0].count, 10) > 0
    })

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
