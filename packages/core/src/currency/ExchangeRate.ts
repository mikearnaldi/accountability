/**
 * ExchangeRate - Entity representing currency exchange rates
 *
 * Records currency exchange rates for conversion with from/to currencies,
 * rate, effective date, rate type, and source.
 *
 * @module currency/ExchangeRate
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Schema from "effect/Schema"
import { CurrencyCode } from "./CurrencyCode.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { OrganizationId } from "../organization/Organization.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * ExchangeRateId - Branded UUID string for exchange rate identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const ExchangeRateId = Schema.UUID.pipe(
  Schema.brand("ExchangeRateId"),
  Schema.annotations({
    identifier: "ExchangeRateId",
    title: "Exchange Rate ID",
    description: "A unique identifier for an exchange rate (UUID format)"
  })
)

/**
 * The branded ExchangeRateId type
 */
export type ExchangeRateId = typeof ExchangeRateId.Type

/**
 * Type guard for ExchangeRateId using Schema.is
 */
export const isExchangeRateId = Schema.is(ExchangeRateId)

/**
 * RateType - Type of exchange rate
 *
 * - Spot: Current market rate at a point in time
 * - Average: Period average rate (e.g., monthly average)
 * - Historical: Rate at original transaction date
 * - Closing: End of period rate (e.g., month-end, year-end)
 */
export const RateType = Schema.Literal("Spot", "Average", "Historical", "Closing").annotations({
  identifier: "RateType",
  title: "Rate Type",
  description: "The type of exchange rate: Spot, Average, Historical, or Closing"
})

/**
 * The RateType type
 */
export type RateType = typeof RateType.Type

/**
 * Type guard for RateType using Schema.is
 */
export const isRateType = Schema.is(RateType)

/**
 * RateSource - Source of the exchange rate
 *
 * - Manual: Manually entered by a user
 * - Import: Imported from a file or external system
 * - API: Retrieved from an API feed
 */
export const RateSource = Schema.Literal("Manual", "Import", "API").annotations({
  identifier: "RateSource",
  title: "Rate Source",
  description: "The source of the exchange rate: Manual, Import, or API"
})

/**
 * The RateSource type
 */
export type RateSource = typeof RateSource.Type

/**
 * Type guard for RateSource using Schema.is
 */
export const isRateSource = Schema.is(RateSource)

/**
 * Rate - A positive BigDecimal representing an exchange rate
 *
 * Exchange rates must be positive (greater than 0).
 * Uses BigDecimal for high precision decimal arithmetic.
 */
export const Rate = Schema.BigDecimal.pipe(
  Schema.positiveBigDecimal(),
  Schema.brand("Rate"),
  Schema.annotations({
    identifier: "Rate",
    title: "Exchange Rate",
    description: "A positive decimal value representing the exchange rate"
  })
)

/**
 * The branded Rate type
 */
export type Rate = typeof Rate.Type

/**
 * Type guard for Rate using Schema.is
 */
export const isRate = Schema.is(Rate)

/**
 * ExchangeRate - Entity representing a currency exchange rate
 *
 * Records the conversion rate between two currencies at a specific date,
 * with metadata about the rate type and source.
 */
export class ExchangeRate extends Schema.Class<ExchangeRate>("ExchangeRate")({
  /**
   * Unique identifier for the exchange rate
   */
  id: ExchangeRateId,

  /**
   * The organization this exchange rate belongs to
   */
  organizationId: OrganizationId,

  /**
   * Source currency code (the currency being converted from)
   */
  fromCurrency: CurrencyCode,

  /**
   * Target currency code (the currency being converted to)
   */
  toCurrency: CurrencyCode,

  /**
   * The exchange rate value (how many units of toCurrency per 1 unit of fromCurrency)
   */
  rate: Rate,

  /**
   * The date this rate is effective for
   */
  effectiveDate: LocalDate,

  /**
   * The type of exchange rate (Spot, Average, Historical, Closing)
   */
  rateType: RateType,

  /**
   * The source of this exchange rate (Manual, Import, API)
   */
  source: RateSource,

  /**
   * When this exchange rate record was created
   */
  createdAt: Timestamp
}) {
  /**
   * Convert an amount from the source currency to the target currency
   */
  convert(amount: BigDecimal.BigDecimal): BigDecimal.BigDecimal {
    return BigDecimal.multiply(amount, this.rate)
  }

  /**
   * Get a human-readable string representation of the exchange rate
   */
  toString(): string {
    return `${this.fromCurrency}/${this.toCurrency} = ${BigDecimal.format(this.rate)} (${this.rateType}, ${this.source})`
  }
}

/**
 * Type guard for ExchangeRate using Schema.is
 */
export const isExchangeRate = Schema.is(ExchangeRate)

/**
 * Convert an amount using the given exchange rate
 */
export const convertAmount = (
  amount: BigDecimal.BigDecimal,
  exchangeRate: ExchangeRate
): BigDecimal.BigDecimal => {
  return BigDecimal.multiply(amount, exchangeRate.rate)
}

/**
 * Get the inverse rate for a given exchange rate
 * Returns None if the rate would result in division by zero
 */
export const getInverseRate = (
  exchangeRate: ExchangeRate
): BigDecimal.BigDecimal | undefined => {
  const result = BigDecimal.divide(BigDecimal.fromNumber(1), exchangeRate.rate)
  return result._tag === "Some" ? result.value : undefined
}

/**
 * Create an inverse exchange rate (swap from/to currencies)
 * Returns undefined if the inverse rate cannot be calculated
 */
export const createInverse = (exchangeRate: ExchangeRate): ExchangeRate | undefined => {
  const inverseRate = getInverseRate(exchangeRate)
  if (inverseRate === undefined) return undefined

  const rate = Rate.make(inverseRate)
  return ExchangeRate.make({
    id: exchangeRate.id, // Note: Would typically need a new ID in practice
    organizationId: exchangeRate.organizationId,
    fromCurrency: exchangeRate.toCurrency,
    toCurrency: exchangeRate.fromCurrency,
    rate,
    effectiveDate: exchangeRate.effectiveDate,
    rateType: exchangeRate.rateType,
    source: exchangeRate.source,
    createdAt: exchangeRate.createdAt
  })
}
