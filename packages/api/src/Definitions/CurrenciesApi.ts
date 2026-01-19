/**
 * CurrenciesApi - HTTP API group for currency master data
 *
 * Provides endpoint to list available currencies for UI dropdowns.
 * Returns predefined COMMON_CURRENCIES from the core package.
 *
 * @module CurrenciesApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import type { Currency } from "@accountability/core/currency/Currency"
import { DecimalPlaces } from "@accountability/core/currency/Currency"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { AuthMiddleware } from "./AuthMiddleware.ts"

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * CurrencyItem - Single currency item in the response
 *
 * This is the response shape for API consumers, derived from Currency entity.
 */
export class CurrencyItem extends Schema.Class<CurrencyItem>("CurrencyItem")({
  code: CurrencyCode,
  name: Schema.NonEmptyTrimmedString,
  symbol: Schema.NonEmptyTrimmedString,
  decimalPlaces: DecimalPlaces,
  isActive: Schema.Boolean
}) {
  /**
   * Create a CurrencyItem from a Currency entity
   */
  static fromCurrency(currency: Currency): CurrencyItem {
    return CurrencyItem.make({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
      isActive: currency.isActive
    })
  }
}

/**
 * CurrencyListResponse - Response containing a list of currencies
 */
export class CurrencyListResponse extends Schema.Class<CurrencyListResponse>("CurrencyListResponse")({
  currencies: Schema.Array(CurrencyItem)
}) {}

/**
 * Query parameters for listing currencies
 */
export const CurrencyListParams = Schema.Struct({
  isActive: Schema.optional(Schema.BooleanFromString)
})

export type CurrencyListParams = typeof CurrencyListParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List all available currencies
 *
 * Returns predefined currencies for use in UI dropdowns.
 * By default, only active currencies are returned.
 */
const listCurrencies = HttpApiEndpoint.get("listCurrencies", "/")
  .setUrlParams(CurrencyListParams)
  .addSuccess(CurrencyListResponse)
  .annotateContext(OpenApi.annotations({
    summary: "List currencies",
    description: "Retrieve a list of available currencies for UI dropdowns. Returns predefined currencies with ISO 4217 codes. By default, only active currencies are returned."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * CurrenciesApi - API group for currency master data
 *
 * Base path: /api/v1/currencies
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class CurrenciesApi extends HttpApiGroup.make("currencies")
  .add(listCurrencies)
  .middleware(AuthMiddleware)
  .prefix("/v1/currencies")
  .annotateContext(OpenApi.annotations({
    title: "Currencies",
    description: "Currency master data for UI dropdowns. Returns predefined currencies with ISO 4217 codes, symbols, and decimal precision."
  })) {}
