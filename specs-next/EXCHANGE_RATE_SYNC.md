# Exchange Rate Sync Specification

This specification defines the integration with the Frankfurter API for automatic exchange rate synchronization.

## Overview

Integrate the [Frankfurter API](https://frankfurter.dev) to provide automatic exchange rate data from the European Central Bank (ECB). Rates are stored globally (not per-organization) and support on-demand cross-rate calculation to minimize storage.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Sync Strategy** | Hybrid | Scheduled daily sync + manual backfill + on-demand fallback |
| **Cross-rates** | Calculate on-demand | Store only EUR pairs, compute XXX→YYY via triangulation |
| **Data Scope** | Global shared | Single set of rates shared across all organizations |
| **Storage** | Separate table | New `system_exchange_rates` table, clean separation from org rates |
| **Scheduler** | External cron | API endpoint called by external scheduler (Vercel cron, GitHub Actions) |
| **Currencies** | All available | Sync all ~30 currencies supported by Frankfurter/ECB |

## Data Model

### New Table: `system_exchange_rates`

Stores EUR-based exchange rates from Frankfurter API.

```sql
CREATE TYPE system_rate_source AS ENUM ('frankfurter', 'manual');

CREATE TABLE system_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency VARCHAR(3) NOT NULL,           -- Target currency (EUR is always implicit base)
  rate NUMERIC(19,10) NOT NULL,           -- EUR → currency rate
  effective_date DATE NOT NULL,           -- Date the rate is effective for
  source system_rate_source NOT NULL,     -- 'frankfurter' or 'manual'
  fetched_at TIMESTAMPTZ,                 -- When fetched from API (null for manual)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT system_exchange_rates_currency_date_unique
    UNIQUE(currency, effective_date),
  CONSTRAINT system_exchange_rates_rate_positive
    CHECK(rate > 0)
);

-- Index for date-based lookups
CREATE INDEX system_exchange_rates_effective_date_idx
  ON system_exchange_rates(effective_date DESC);

-- Index for currency lookups
CREATE INDEX system_exchange_rates_currency_idx
  ON system_exchange_rates(currency);
```

### Domain Model

```typescript
// packages/core/src/Domains/SystemExchangeRate.ts

import { Schema } from "effect"
import { CurrencyCode } from "./CurrencyCode"

export const SystemRateSource = Schema.Literal("frankfurter", "manual")
export type SystemRateSource = typeof SystemRateSource.Type

export const SystemExchangeRateId = Schema.String.pipe(
  Schema.brand("SystemExchangeRateId")
)
export type SystemExchangeRateId = typeof SystemExchangeRateId.Type

export class SystemExchangeRate extends Schema.Class<SystemExchangeRate>(
  "SystemExchangeRate"
)({
  id: SystemExchangeRateId,
  currency: CurrencyCode,              // Target currency (EUR is base)
  rate: Schema.BigDecimal,             // EUR → currency rate
  effectiveDate: Schema.DateFromString,
  source: SystemRateSource,
  fetchedAt: Schema.OptionFromNullable(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}
```

## Service Architecture

### File Structure

```
packages/core/src/
├── Domains/
│   └── SystemExchangeRate.ts          # Domain model
├── Clients/
│   └── FrankfurterClient.ts           # HTTP client for Frankfurter API
├── Services/
│   ├── ExchangeRateSyncService.ts     # Sync orchestration
│   └── CrossRateService.ts            # Rate lookup with triangulation

packages/persistence/src/
├── Migrations/
│   └── Migration00XX_CreateSystemExchangeRates.ts
├── Services/
│   └── SystemExchangeRateRepository.ts    # Interface
├── Layers/
│   └── SystemExchangeRateRepositoryLive.ts

packages/api/src/
├── Definitions/
│   └── SystemExchangeRateApi.ts       # API definition
├── Layers/
│   └── SystemExchangeRateApiLive.ts   # Implementation
```

### FrankfurterClient

HTTP client for the Frankfurter API.

```typescript
// packages/core/src/Clients/FrankfurterClient.ts

import { Context, Effect, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"

const BASE_URL = "https://api.frankfurter.dev/v1"

// Response schemas
export const CurrenciesResponse = Schema.Record({
  key: Schema.String,
  value: Schema.String,
})

export const RatesResponse = Schema.Struct({
  base: Schema.String,
  date: Schema.String,
  rates: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }),
})

export const TimeSeriesResponse = Schema.Struct({
  base: Schema.String,
  start_date: Schema.String,
  end_date: Schema.String,
  rates: Schema.Record({
    key: Schema.String,  // date
    value: Schema.Record({
      key: Schema.String,  // currency
      value: Schema.Number,
    }),
  }),
})

export class FrankfurterClient extends Context.Tag("FrankfurterClient")<
  FrankfurterClient,
  {
    /** Fetch all supported currencies */
    readonly fetchCurrencies: Effect.Effect<
      Record<string, string>,
      FrankfurterError
    >

    /** Fetch latest rates for all currencies */
    readonly fetchLatest: Effect.Effect<
      typeof RatesResponse.Type,
      FrankfurterError
    >

    /** Fetch rates for a specific date */
    readonly fetchHistorical: (
      date: string  // YYYY-MM-DD
    ) => Effect.Effect<typeof RatesResponse.Type, FrankfurterError>

    /** Fetch rates for a date range */
    readonly fetchRange: (
      startDate: string,
      endDate: string
    ) => Effect.Effect<typeof TimeSeriesResponse.Type, FrankfurterError>
  }
>() {}

export class FrankfurterError extends Schema.TaggedError<FrankfurterError>()(
  "FrankfurterError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export const FrankfurterClientLive = Layer.effect(
  FrankfurterClient,
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient

    const fetch = <A>(
      path: string,
      schema: Schema.Schema<A>
    ): Effect.Effect<A, FrankfurterError> =>
      httpClient.get(`${BASE_URL}${path}`).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
        Effect.mapError((e) => new FrankfurterError({
          message: `Failed to fetch ${path}`,
          cause: e,
        })),
        Effect.scoped
      )

    return {
      fetchCurrencies: fetch("/currencies", CurrenciesResponse),
      fetchLatest: fetch("/latest", RatesResponse),
      fetchHistorical: (date) => fetch(`/${date}`, RatesResponse),
      fetchRange: (start, end) => fetch(`/${start}..${end}`, TimeSeriesResponse),
    }
  })
)
```

### SystemExchangeRateRepository

Repository interface for system exchange rates.

```typescript
// packages/persistence/src/Services/SystemExchangeRateRepository.ts

import { Context, Effect, Option } from "effect"
import { SystemExchangeRate, SystemExchangeRateId } from "@accountability/core"
import { SqlError } from "@effect/sql"

export interface SystemExchangeRateRepository {
  /** Find rate for a currency on a specific date */
  readonly findRate: (
    currency: CurrencyCode,
    date: string
  ) => Effect.Effect<Option.Option<SystemExchangeRate>, SqlError>

  /** Find the latest rate for a currency */
  readonly findLatestRate: (
    currency: CurrencyCode
  ) => Effect.Effect<Option.Option<SystemExchangeRate>, SqlError>

  /** Find the closest rate to a given date */
  readonly findClosestRate: (
    currency: CurrencyCode,
    date: string
  ) => Effect.Effect<Option.Option<SystemExchangeRate>, SqlError>

  /** Find all rates for a specific date */
  readonly findByDate: (
    date: string
  ) => Effect.Effect<ReadonlyArray<SystemExchangeRate>, SqlError>

  /** Find rates for a date range */
  readonly findByDateRange: (
    startDate: string,
    endDate: string
  ) => Effect.Effect<ReadonlyArray<SystemExchangeRate>, SqlError>

  /** Upsert a rate (insert or update on conflict) */
  readonly upsert: (
    rate: Omit<SystemExchangeRate, "id" | "createdAt" | "updatedAt">
  ) => Effect.Effect<SystemExchangeRate, SqlError>

  /** Bulk upsert rates */
  readonly bulkUpsert: (
    rates: ReadonlyArray<Omit<SystemExchangeRate, "id" | "createdAt" | "updatedAt">>
  ) => Effect.Effect<number, SqlError>  // Returns count of upserted rows

  /** Get all available currencies in the system */
  readonly getAvailableCurrencies: Effect.Effect<
    ReadonlyArray<CurrencyCode>,
    SqlError
  >

  /** Get the date range of available rates */
  readonly getDateRange: Effect.Effect<
    Option.Option<{ minDate: string; maxDate: string }>,
    SqlError
  >
}

export const SystemExchangeRateRepository = Context.Tag<SystemExchangeRateRepository>(
  "SystemExchangeRateRepository"
)
```

### ExchangeRateSyncService

Orchestrates synchronization with Frankfurter API.

```typescript
// packages/core/src/Services/ExchangeRateSyncService.ts

import { Context, Effect, Layer } from "effect"
import { FrankfurterClient } from "../Clients/FrankfurterClient"
import { SystemExchangeRateRepository } from "@accountability/persistence"

export interface SyncResult {
  readonly date: string
  readonly currenciesCount: number
  readonly upsertedCount: number
  readonly duration: number  // milliseconds
}

export interface SyncRangeResult {
  readonly startDate: string
  readonly endDate: string
  readonly daysProcessed: number
  readonly totalRatesUpserted: number
  readonly duration: number
}

export class ExchangeRateSyncService extends Context.Tag("ExchangeRateSyncService")<
  ExchangeRateSyncService,
  {
    /** Sync latest rates from Frankfurter */
    readonly syncLatest: Effect.Effect<SyncResult, SyncError>

    /** Sync rates for a specific date */
    readonly syncDate: (date: string) => Effect.Effect<SyncResult, SyncError>

    /** Sync rates for a date range (for backfill) */
    readonly syncRange: (
      startDate: string,
      endDate: string
    ) => Effect.Effect<SyncRangeResult, SyncError>

    /** Get supported currencies from Frankfurter */
    readonly getSupportedCurrencies: Effect.Effect<
      ReadonlyArray<{ code: string; name: string }>,
      SyncError
    >
  }
>() {}

export class SyncError extends Schema.TaggedError<SyncError>()("SyncError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export const ExchangeRateSyncServiceLive = Layer.effect(
  ExchangeRateSyncService,
  Effect.gen(function* () {
    const frankfurter = yield* FrankfurterClient
    const repository = yield* SystemExchangeRateRepository

    const syncFromResponse = (response: RatesResponse) =>
      Effect.gen(function* () {
        const rates = Object.entries(response.rates).map(([currency, rate]) => ({
          currency: currency as CurrencyCode,
          rate: BigDecimal.fromNumber(rate),
          effectiveDate: response.date,
          source: "frankfurter" as const,
          fetchedAt: Option.some(DateTime.unsafeNow()),
        }))

        const count = yield* repository.bulkUpsert(rates)
        return { date: response.date, count, currencies: rates.length }
      })

    return {
      syncLatest: Effect.gen(function* () {
        const start = Date.now()
        const response = yield* frankfurter.fetchLatest
        const result = yield* syncFromResponse(response)
        return {
          date: result.date,
          currenciesCount: result.currencies,
          upsertedCount: result.count,
          duration: Date.now() - start,
        }
      }),

      syncDate: (date) => Effect.gen(function* () {
        const start = Date.now()
        const response = yield* frankfurter.fetchHistorical(date)
        const result = yield* syncFromResponse(response)
        return {
          date: result.date,
          currenciesCount: result.currencies,
          upsertedCount: result.count,
          duration: Date.now() - start,
        }
      }),

      syncRange: (startDate, endDate) => Effect.gen(function* () {
        const start = Date.now()
        const response = yield* frankfurter.fetchRange(startDate, endDate)

        let totalUpserted = 0
        const dates = Object.keys(response.rates)

        for (const date of dates) {
          const dayRates = response.rates[date]
          const rates = Object.entries(dayRates).map(([currency, rate]) => ({
            currency: currency as CurrencyCode,
            rate: BigDecimal.fromNumber(rate),
            effectiveDate: date,
            source: "frankfurter" as const,
            fetchedAt: Option.some(DateTime.unsafeNow()),
          }))
          totalUpserted += yield* repository.bulkUpsert(rates)
        }

        return {
          startDate,
          endDate,
          daysProcessed: dates.length,
          totalRatesUpserted: totalUpserted,
          duration: Date.now() - start,
        }
      }),

      getSupportedCurrencies: Effect.gen(function* () {
        const currencies = yield* frankfurter.fetchCurrencies
        return Object.entries(currencies).map(([code, name]) => ({ code, name }))
      }),
    }
  })
)
```

### CrossRateService

Handles rate lookups with automatic triangulation for non-EUR pairs.

```typescript
// packages/core/src/Services/CrossRateService.ts

import { Context, Effect, Layer, Option, BigDecimal } from "effect"
import { SystemExchangeRateRepository } from "@accountability/persistence"
import { ExchangeRateRepository } from "@accountability/persistence"
import { CurrencyCode } from "../Domains/CurrencyCode"

export interface RateResult {
  readonly from: CurrencyCode
  readonly to: CurrencyCode
  readonly rate: BigDecimal
  readonly effectiveDate: string
  readonly source: "direct" | "triangulated" | "organization"
  readonly intermediateRates?: {
    eurToFrom: BigDecimal
    eurToTo: BigDecimal
  }
}

export class CrossRateService extends Context.Tag("CrossRateService")<
  CrossRateService,
  {
    /**
     * Get exchange rate between any two currencies.
     *
     * Resolution order:
     * 1. Organization-specific rate (if orgId provided)
     * 2. Direct system rate (EUR pairs)
     * 3. Triangulated rate via EUR
     */
    readonly getRate: (params: {
      from: CurrencyCode
      to: CurrencyCode
      date: string
      organizationId?: OrganizationId
    }) => Effect.Effect<RateResult, RateNotFoundError>

    /**
     * Get the latest available rate between two currencies.
     */
    readonly getLatestRate: (params: {
      from: CurrencyCode
      to: CurrencyCode
      organizationId?: OrganizationId
    }) => Effect.Effect<RateResult, RateNotFoundError>

    /**
     * Get the closest rate to a given date.
     */
    readonly getClosestRate: (params: {
      from: CurrencyCode
      to: CurrencyCode
      date: string
      organizationId?: OrganizationId
    }) => Effect.Effect<RateResult, RateNotFoundError>
  }
>() {}

export class RateNotFoundError extends Schema.TaggedError<RateNotFoundError>()(
  "RateNotFoundError",
  {
    from: CurrencyCode,
    to: CurrencyCode,
    date: Schema.String,
    message: Schema.String,
  }
) {}

export const CrossRateServiceLive = Layer.effect(
  CrossRateService,
  Effect.gen(function* () {
    const systemRepo = yield* SystemExchangeRateRepository
    const orgRepo = yield* ExchangeRateRepository

    const EUR = "EUR" as CurrencyCode

    const triangulate = (
      from: CurrencyCode,
      to: CurrencyCode,
      date: string
    ): Effect.Effect<RateResult, RateNotFoundError> =>
      Effect.gen(function* () {
        // Same currency = rate of 1
        if (from === to) {
          return {
            from,
            to,
            rate: BigDecimal.fromNumber(1),
            effectiveDate: date,
            source: "direct" as const,
          }
        }

        // EUR → XXX (direct lookup)
        if (from === EUR) {
          const rate = yield* systemRepo.findRate(to, date).pipe(
            Effect.flatMap(Option.match({
              onNone: () => Effect.fail(new RateNotFoundError({
                from, to, date,
                message: `No rate found for EUR → ${to} on ${date}`,
              })),
              onSome: Effect.succeed,
            }))
          )
          return {
            from,
            to,
            rate: rate.rate,
            effectiveDate: date,
            source: "direct" as const,
          }
        }

        // XXX → EUR (inverse lookup)
        if (to === EUR) {
          const rate = yield* systemRepo.findRate(from, date).pipe(
            Effect.flatMap(Option.match({
              onNone: () => Effect.fail(new RateNotFoundError({
                from, to, date,
                message: `No rate found for EUR → ${from} on ${date}`,
              })),
              onSome: Effect.succeed,
            }))
          )
          return {
            from,
            to,
            rate: BigDecimal.divide(BigDecimal.fromNumber(1), rate.rate),
            effectiveDate: date,
            source: "direct" as const,
          }
        }

        // XXX → YYY (triangulation via EUR)
        const [eurToFrom, eurToTo] = yield* Effect.all([
          systemRepo.findRate(from, date),
          systemRepo.findRate(to, date),
        ])

        if (Option.isNone(eurToFrom) || Option.isNone(eurToTo)) {
          return yield* Effect.fail(new RateNotFoundError({
            from, to, date,
            message: `Cannot triangulate ${from} → ${to} on ${date}: missing EUR rates`,
          }))
        }

        // Formula: from → to = (EUR → to) / (EUR → from)
        const rate = BigDecimal.divide(eurToTo.value.rate, eurToFrom.value.rate)

        return {
          from,
          to,
          rate,
          effectiveDate: date,
          source: "triangulated" as const,
          intermediateRates: {
            eurToFrom: eurToFrom.value.rate,
            eurToTo: eurToTo.value.rate,
          },
        }
      })

    return {
      getRate: ({ from, to, date, organizationId }) =>
        Effect.gen(function* () {
          // 1. Check organization-specific rate first
          if (organizationId) {
            const orgRate = yield* orgRepo.findRate(
              organizationId,
              from,
              to,
              date,
              "Closing"  // Default to closing rate
            )
            if (Option.isSome(orgRate)) {
              return {
                from,
                to,
                rate: orgRate.value.rate,
                effectiveDate: date,
                source: "organization" as const,
              }
            }
          }

          // 2. Fall back to system rates with triangulation
          return yield* triangulate(from, to, date)
        }),

      getLatestRate: ({ from, to, organizationId }) =>
        Effect.gen(function* () {
          // Get the latest date we have rates for
          const dateRange = yield* systemRepo.getDateRange
          if (Option.isNone(dateRange)) {
            return yield* Effect.fail(new RateNotFoundError({
              from, to,
              date: "latest",
              message: "No exchange rates available in the system",
            }))
          }

          const latestDate = dateRange.value.maxDate
          return yield* CrossRateService.getRate({
            from, to,
            date: latestDate,
            organizationId,
          })
        }),

      getClosestRate: ({ from, to, date, organizationId }) =>
        Effect.gen(function* () {
          // Try exact date first
          const exactResult = yield* CrossRateService.getRate({
            from, to, date, organizationId,
          }).pipe(Effect.option)

          if (Option.isSome(exactResult)) {
            return exactResult.value
          }

          // Find closest available date
          const closestRate = yield* systemRepo.findClosestRate(
            from === EUR ? to : from,
            date
          )

          if (Option.isNone(closestRate)) {
            return yield* Effect.fail(new RateNotFoundError({
              from, to, date,
              message: `No rate found close to ${date}`,
            }))
          }

          return yield* triangulate(from, to, closestRate.value.effectiveDate)
        }),
    }
  })
)
```

## API Endpoints

### Definition

```typescript
// packages/api/src/Definitions/SystemExchangeRateApi.ts

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { Schema } from "effect"

// Request/Response schemas
export class SyncRequest extends Schema.Class<SyncRequest>("SyncRequest")({
  date: Schema.optional(Schema.String),  // YYYY-MM-DD, defaults to today
}) {}

export class SyncRangeRequest extends Schema.Class<SyncRangeRequest>("SyncRangeRequest")({
  startDate: Schema.String,
  endDate: Schema.String,
}) {}

export class SyncResponse extends Schema.Class<SyncResponse>("SyncResponse")({
  date: Schema.String,
  currenciesCount: Schema.Number,
  upsertedCount: Schema.Number,
  duration: Schema.Number,
}) {}

export class SyncRangeResponse extends Schema.Class<SyncRangeResponse>("SyncRangeResponse")({
  startDate: Schema.String,
  endDate: Schema.String,
  daysProcessed: Schema.Number,
  totalRatesUpserted: Schema.Number,
  duration: Schema.Number,
}) {}

export class RateRequest extends Schema.Class<RateRequest>("RateRequest")({
  from: CurrencyCode,
  to: CurrencyCode,
  date: Schema.optional(Schema.String),  // Defaults to latest
}) {}

export class RateResponse extends Schema.Class<RateResponse>("RateResponse")({
  from: CurrencyCode,
  to: CurrencyCode,
  rate: Schema.String,  // BigDecimal as string
  effectiveDate: Schema.String,
  source: Schema.Literal("direct", "triangulated", "organization"),
}) {}

export class CurrencyInfo extends Schema.Class<CurrencyInfo>("CurrencyInfo")({
  code: Schema.String,
  name: Schema.String,
}) {}

// API Group
export const SystemExchangeRateApi = HttpApiGroup.make("system-exchange-rates")
  .pipe(
    OpenApi.annotate({ title: "System Exchange Rates" }),

    // List all system rates
    HttpApiGroup.add(
      HttpApiEndpoint.get("list", "/system/exchange-rates")
        .pipe(
          HttpApiEndpoint.setQuery(Schema.Struct({
            date: Schema.optional(Schema.String),
            currency: Schema.optional(CurrencyCode),
            limit: Schema.optional(Schema.NumberFromString),
            offset: Schema.optional(Schema.NumberFromString),
          })),
          HttpApiEndpoint.setSuccess(Schema.Array(SystemExchangeRate)),
          OpenApi.annotate({ description: "List system exchange rates" })
        )
    ),

    // Get rate with triangulation
    HttpApiGroup.add(
      HttpApiEndpoint.get("getRate", "/system/exchange-rates/rate")
        .pipe(
          HttpApiEndpoint.setQuery(RateRequest),
          HttpApiEndpoint.setSuccess(RateResponse),
          HttpApiEndpoint.addError(NotFoundError),
          OpenApi.annotate({
            description: "Get exchange rate between any two currencies (supports triangulation)"
          })
        )
    ),

    // Trigger sync (for cron)
    HttpApiGroup.add(
      HttpApiEndpoint.post("sync", "/system/exchange-rates/sync")
        .pipe(
          HttpApiEndpoint.setBody(SyncRequest),
          HttpApiEndpoint.setSuccess(SyncResponse),
          OpenApi.annotate({
            description: "Sync rates from Frankfurter API (call from cron)"
          })
        )
    ),

    // Sync date range (manual backfill)
    HttpApiGroup.add(
      HttpApiEndpoint.post("syncRange", "/system/exchange-rates/sync/range")
        .pipe(
          HttpApiEndpoint.setBody(SyncRangeRequest),
          HttpApiEndpoint.setSuccess(SyncRangeResponse),
          OpenApi.annotate({
            description: "Sync rates for a date range (for backfilling historical data)"
          })
        )
    ),

    // Get supported currencies
    HttpApiGroup.add(
      HttpApiEndpoint.get("currencies", "/system/exchange-rates/currencies")
        .pipe(
          HttpApiEndpoint.setSuccess(Schema.Array(CurrencyInfo)),
          OpenApi.annotate({
            description: "Get list of supported currencies from Frankfurter"
          })
        )
    ),

    // Get sync status / date range
    HttpApiGroup.add(
      HttpApiEndpoint.get("status", "/system/exchange-rates/status")
        .pipe(
          HttpApiEndpoint.setSuccess(Schema.Struct({
            availableCurrencies: Schema.Number,
            dateRange: Schema.OptionFromNullable(Schema.Struct({
              minDate: Schema.String,
              maxDate: Schema.String,
            })),
            totalRates: Schema.Number,
          })),
          OpenApi.annotate({
            description: "Get sync status and available date range"
          })
        )
    ),
  )
```

### Endpoint Summary

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/v1/system/exchange-rates` | List all system rates | Required |
| `GET` | `/api/v1/system/exchange-rates/rate` | Get rate with triangulation | Required |
| `POST` | `/api/v1/system/exchange-rates/sync` | Trigger sync (cron) | API Key |
| `POST` | `/api/v1/system/exchange-rates/sync/range` | Backfill date range | Admin |
| `GET` | `/api/v1/system/exchange-rates/currencies` | Supported currencies | Required |
| `GET` | `/api/v1/system/exchange-rates/status` | Sync status | Required |

## Cross-Rate Calculation

### Algorithm

```
Given: from_currency, to_currency, date

1. If from === to:
   return rate = 1.0

2. If from === EUR:
   return system_rate(to, date)

3. If to === EUR:
   return 1 / system_rate(from, date)

4. Otherwise (triangulation):
   eur_to_from = system_rate(from, date)
   eur_to_to = system_rate(to, date)
   return eur_to_to / eur_to_from
```

### Example

```
Request: USD → GBP on 2024-01-15

System rates on 2024-01-15:
  EUR → USD = 1.0873
  EUR → GBP = 0.8612

Calculation:
  USD → GBP = (EUR → GBP) / (EUR → USD)
            = 0.8612 / 1.0873
            = 0.7921

Response:
{
  "from": "USD",
  "to": "GBP",
  "rate": "0.7921",
  "effectiveDate": "2024-01-15",
  "source": "triangulated"
}
```

## Rate Resolution Priority

When looking up a rate, the system checks sources in this order:

1. **Organization-specific rate** (if org context provided)
   - Manual rates entered by the organization
   - Allows orgs to override system rates for their specific needs

2. **Direct system rate** (EUR pairs)
   - Exact EUR → currency or currency → EUR lookup

3. **Triangulated system rate**
   - Computed from two EUR-based rates

## Cron Configuration

### External Cron Setup

The sync endpoint should be called daily after ECB publishes rates (~16:00 CET).

**Recommended schedule**: `0 17 * * 1-5` (17:00 UTC, Monday-Friday)

#### Vercel Cron Example

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/v1/system/exchange-rates/sync",
      "schedule": "0 17 * * 1-5"
    }
  ]
}
```

#### GitHub Actions Example

```yaml
# .github/workflows/sync-rates.yml
name: Sync Exchange Rates
on:
  schedule:
    - cron: '0 17 * * 1-5'
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -X POST "${{ secrets.API_URL }}/api/v1/system/exchange-rates/sync" \
            -H "Authorization: Bearer ${{ secrets.CRON_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

## Frontend Integration

### Admin UI for Exchange Rate Management

Add a system admin page for managing exchange rate sync:

**Route**: `/admin/exchange-rates`

**Features**:
- View sync status (last sync date, available date range)
- Trigger manual sync for latest rates
- Backfill historical rates (date range picker)
- View supported currencies
- Browse system rates with filtering

### Rate Lookup in Existing UI

The existing exchange rate UI at `/organizations/:orgId/exchange-rates` should:

1. Show organization-specific rates (existing behavior)
2. Add "System Rate" badge for triangulated lookups
3. Allow creating org-specific overrides

## Error Handling

### Frankfurter API Errors

| Scenario | Handling |
|----------|----------|
| API unreachable | Retry with exponential backoff (3 attempts) |
| Rate limit (unlikely) | Log warning, retry after delay |
| Invalid date | Return user-friendly error |
| Weekend/holiday (no data) | Use closest available date |

### Rate Lookup Errors

| Scenario | Error Type |
|----------|------------|
| Currency not supported | `ValidationError` |
| No rate for date | `RateNotFoundError` (try closest) |
| Both triangulation rates missing | `RateNotFoundError` |

## Testing Requirements

### Unit Tests

- [ ] `FrankfurterClient` - mock HTTP responses
- [ ] `CrossRateService` - triangulation logic
- [ ] `ExchangeRateSyncService` - sync orchestration

### Integration Tests

- [ ] Repository operations with test database
- [ ] API endpoints with full stack
- [ ] Rate resolution priority (org vs system)

### Property-Based Tests

- [ ] Triangulation: `A → B → A` should equal ~1.0 (within precision)
- [ ] Inverse: `rate(A, B) * rate(B, A)` should equal ~1.0

## Implementation Order

1. **Database Migration** - Create `system_exchange_rates` table
2. **Domain Model** - `SystemExchangeRate` schema
3. **Repository** - `SystemExchangeRateRepository` + Live implementation
4. **Frankfurter Client** - HTTP client with response schemas
5. **Sync Service** - `ExchangeRateSyncService`
6. **Cross-Rate Service** - `CrossRateService` with triangulation
7. **API Endpoints** - Definition + handlers
8. **Tests** - Unit + integration
9. **Frontend** - Admin UI for sync management
10. **Cron Setup** - External scheduler configuration

## Open Questions

- [ ] Should we cache triangulated rates for performance?
- [ ] Rate precision: 10 decimal places sufficient?
- [ ] Should sync failures trigger alerts?
- [ ] Retention policy for old rates?
