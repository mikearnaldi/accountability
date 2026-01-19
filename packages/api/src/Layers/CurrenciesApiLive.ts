/**
 * CurrenciesApiLive - Live implementation of currencies API handlers
 *
 * Implements the CurrenciesApi endpoints by returning the predefined
 * COMMON_CURRENCIES from the core package.
 *
 * @module CurrenciesApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import { COMMON_CURRENCIES } from "@accountability/core/currency/Currency"
import { AppApi } from "../Definitions/AppApi.ts"
import { CurrencyItem } from "../Definitions/CurrenciesApi.ts"

/**
 * CurrenciesApiLive - Layer providing CurrenciesApi handlers
 *
 * No external dependencies - uses predefined currencies from core package.
 */
export const CurrenciesApiLive = HttpApiBuilder.group(AppApi, "currencies", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle("listCurrencies", (_) =>
        Effect.gen(function* () {
          // Get isActive filter, default to true
          const isActiveFilter = _.urlParams.isActive ?? true

          // Filter currencies based on isActive parameter
          const filteredCurrencies = COMMON_CURRENCIES.filter(
            (currency) => currency.isActive === isActiveFilter
          )

          // Convert Currency entities to CurrencyItem response objects
          const currencyItems = filteredCurrencies.map(CurrencyItem.fromCurrency)

          return { currencies: currencyItems }
        })
      )
  })
)
