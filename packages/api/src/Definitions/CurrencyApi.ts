/**
 * CurrencyApi - HTTP API group for currency and exchange rate management
 *
 * Provides endpoints for CRUD operations on exchange rates,
 * including rate queries by date, currency pair, and rate type.
 *
 * @module CurrencyApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  ExchangeRate,
  ExchangeRateId,
  Rate,
  RateType,
  RateSource
} from "@accountability/core/currency/ExchangeRate"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { LocalDateFromString } from "@accountability/core/shared/values/LocalDate"
import { OrganizationId } from "@accountability/core/organization/Organization"
import {
  AuditLogError,
  ForbiddenError,
  UserLookupError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import {
  ExchangeRateNotFoundError,
  SameCurrencyExchangeRateError
} from "@accountability/core/currency/CurrencyErrors"

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * CreateExchangeRateRequest - Request body for creating a new exchange rate
 */
export class CreateExchangeRateRequest extends Schema.Class<CreateExchangeRateRequest>("CreateExchangeRateRequest")({
  organizationId: OrganizationId,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rate: Rate,
  effectiveDate: LocalDateFromString,
  rateType: RateType,
  source: Schema.optionalWith(RateSource, { default: () => "Manual" as const })
}) {}

/**
 * BulkCreateExchangeRatesRequest - Request body for creating multiple exchange rates
 */
export class BulkCreateExchangeRatesRequest extends Schema.Class<BulkCreateExchangeRatesRequest>("BulkCreateExchangeRatesRequest")({
  rates: Schema.Array(CreateExchangeRateRequest)
}) {}

/**
 * BulkCreateExchangeRatesResponse - Response after creating multiple exchange rates
 */
export class BulkCreateExchangeRatesResponse extends Schema.Class<BulkCreateExchangeRatesResponse>("BulkCreateExchangeRatesResponse")({
  created: Schema.Array(ExchangeRate),
  count: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * ExchangeRateListResponse - Response containing a list of exchange rates
 */
export class ExchangeRateListResponse extends Schema.Class<ExchangeRateListResponse>("ExchangeRateListResponse")({
  rates: Schema.Array(ExchangeRate),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * GetRateResponse - Response containing a single exchange rate
 */
export class GetRateResponse extends Schema.Class<GetRateResponse>("GetRateResponse")({
  rate: Schema.OptionFromNullOr(ExchangeRate).annotations({
    title: "Exchange Rate",
    description: "The matching exchange rate, if found"
  })
}) {}

/**
 * Query parameters for listing exchange rates
 */
export const ExchangeRateListParams = Schema.Struct({
  organizationId: OrganizationId,
  fromCurrency: Schema.optional(CurrencyCode),
  toCurrency: Schema.optional(CurrencyCode),
  rateType: Schema.optional(RateType),
  startDate: Schema.optional(LocalDateFromString),
  endDate: Schema.optional(LocalDateFromString),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

export type ExchangeRateListParams = typeof ExchangeRateListParams.Type

/**
 * Query parameters for getting a specific rate
 */
export const GetRateParams = Schema.Struct({
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  effectiveDate: LocalDateFromString,
  rateType: RateType
})

export type GetRateParams = typeof GetRateParams.Type

/**
 * Query parameters for getting the latest rate
 */
export const GetLatestRateParams = Schema.Struct({
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rateType: RateType
})

export type GetLatestRateParams = typeof GetLatestRateParams.Type

/**
 * Query parameters for getting the closest rate
 */
export const GetClosestRateParams = Schema.Struct({
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  date: LocalDateFromString,
  rateType: RateType
})

export type GetClosestRateParams = typeof GetClosestRateParams.Type

/**
 * Query parameters for getting period average rate
 */
export const GetPeriodAverageRateParams = Schema.Struct({
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  year: Schema.NumberFromString.pipe(Schema.int()),
  period: Schema.NumberFromString.pipe(Schema.int())
})

export type GetPeriodAverageRateParams = typeof GetPeriodAverageRateParams.Type

/**
 * Query parameters for getting period closing rate
 */
export const GetPeriodClosingRateParams = Schema.Struct({
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  year: Schema.NumberFromString.pipe(Schema.int()),
  period: Schema.NumberFromString.pipe(Schema.int())
})

export type GetPeriodClosingRateParams = typeof GetPeriodClosingRateParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List all exchange rates with filtering
 */
const listExchangeRates = HttpApiEndpoint.get("listExchangeRates", "/")
  .setUrlParams(ExchangeRateListParams)
  .addSuccess(ExchangeRateListResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List exchange rates",
    description: "Retrieve a paginated list of exchange rates. Supports filtering by currency pair, rate type, and date range."
  }))

/**
 * Get a single exchange rate by ID
 */
const getExchangeRate = HttpApiEndpoint.get("getExchangeRate", "/:id")
  .setPath(Schema.Struct({ id: ExchangeRateId }))
  .addSuccess(ExchangeRate)
  .addError(ExchangeRateNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get exchange rate",
    description: "Retrieve a single exchange rate by its unique identifier."
  }))

/**
 * Create a new exchange rate
 */
const createExchangeRate = HttpApiEndpoint.post("createExchangeRate", "/")
  .setPayload(CreateExchangeRateRequest)
  .addSuccess(ExchangeRate, { status: 201 })
  .addError(SameCurrencyExchangeRateError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Create exchange rate",
    description: "Create a new exchange rate for a currency pair on a specific date."
  }))

/**
 * Bulk create exchange rates
 */
const bulkCreateExchangeRates = HttpApiEndpoint.post("bulkCreateExchangeRates", "/bulk")
  .setPayload(BulkCreateExchangeRatesRequest)
  .addSuccess(BulkCreateExchangeRatesResponse, { status: 201 })
  .addError(SameCurrencyExchangeRateError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Bulk create exchange rates",
    description: "Create multiple exchange rates in a single request. Useful for importing rates from external sources."
  }))

/**
 * Delete an exchange rate
 */
const deleteExchangeRate = HttpApiEndpoint.del("deleteExchangeRate", "/:id")
  .setPath(Schema.Struct({ id: ExchangeRateId }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(ExchangeRateNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete exchange rate",
    description: "Delete an exchange rate. Rates that have been used in transactions may not be deleted."
  }))

/**
 * Get the rate effective on a specific date
 */
const getRateForDate = HttpApiEndpoint.get("getRateForDate", "/rate")
  .setUrlParams(GetRateParams)
  .addSuccess(GetRateResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get rate for date",
    description: "Get the exchange rate effective on a specific date for a currency pair and rate type."
  }))

/**
 * Get the latest rate for a currency pair
 */
const getLatestRate = HttpApiEndpoint.get("getLatestRate", "/latest")
  .setUrlParams(GetLatestRateParams)
  .addSuccess(GetRateResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get latest rate",
    description: "Get the most recent exchange rate for a currency pair and rate type."
  }))

/**
 * Get the closest rate to a date
 */
const getClosestRate = HttpApiEndpoint.get("getClosestRate", "/closest")
  .setUrlParams(GetClosestRateParams)
  .addSuccess(GetRateResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get closest rate",
    description: "Get the exchange rate closest to a specific date for a currency pair and rate type."
  }))

/**
 * Get the average rate for a fiscal period
 */
const getPeriodAverageRate = HttpApiEndpoint.get("getPeriodAverageRate", "/period-average")
  .setUrlParams(GetPeriodAverageRateParams)
  .addSuccess(GetRateResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get period average rate",
    description: "Get the average exchange rate for a fiscal period. Used for translating income statement items per ASC 830."
  }))

/**
 * Get the closing rate for a fiscal period
 */
const getPeriodClosingRate = HttpApiEndpoint.get("getPeriodClosingRate", "/period-closing")
  .setUrlParams(GetPeriodClosingRateParams)
  .addSuccess(GetRateResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get period closing rate",
    description: "Get the closing exchange rate for a fiscal period. Used for translating balance sheet items per ASC 830."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * CurrencyApi - API group for currency and exchange rate management
 *
 * Base path: /api/v1/exchange-rates
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class CurrencyApi extends HttpApiGroup.make("currency")
  .add(listExchangeRates)
  .add(getExchangeRate)
  .add(createExchangeRate)
  .add(bulkCreateExchangeRates)
  .add(deleteExchangeRate)
  .add(getRateForDate)
  .add(getLatestRate)
  .add(getClosestRate)
  .add(getPeriodAverageRate)
  .add(getPeriodClosingRate)
  .middleware(AuthMiddleware)
  .prefix("/v1/exchange-rates")
  .annotateContext(OpenApi.annotations({
    title: "Currency & Exchange Rates",
    description: "Manage exchange rates for currency translation. Supports multiple rate types (Spot, Average, Historical) and queries by date, period, and currency pair."
  })) {}
