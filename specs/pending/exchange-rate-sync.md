# Exchange Rate Sync Specification

This specification defines the integration with the Frankfurter API for automatic exchange rate synchronization.

---

## Implementation Phases

This section provides a granular, step-by-step implementation plan for auto-implementing agents. Each phase builds on the previous one. Complete all tasks in order.

### Phase 1: Domain Model

**Goal**: Create the `SystemExchangeRate` domain entity and related types.

**Files to create/modify**:
- `packages/core/src/Domains/SystemExchangeRate.ts` (new)

**Tasks**:
- [ ] **1.1** Create `SystemExchangeRateId` branded type using `Schema.UUID.pipe(Schema.brand("SystemExchangeRateId"))`
- [ ] **1.2** Create `SystemRateSource` literal type: `Schema.Literal("frankfurter", "manual")`
- [ ] **1.3** Create `SystemExchangeRate` class extending `Schema.Class` with fields:
  - `id: SystemExchangeRateId`
  - `currency: CurrencyCode` (import from existing `CurrencyCode.ts`)
  - `rate: Schema.BigDecimal`
  - `effectiveDate: Schema.DateFromString`
  - `source: SystemRateSource`
  - `fetchedAt: Schema.OptionFromNullOr(Schema.DateTimeUtc)`
  - `createdAt: Schema.DateTimeUtc`
  - `updatedAt: Schema.DateTimeUtc`
- [ ] **1.4** Export type guard: `export const isSystemExchangeRate = Schema.is(SystemExchangeRate)`
- [ ] **1.5** Export type guard: `export const isSystemRateSource = Schema.is(SystemRateSource)`
- [ ] **1.6** Run `pnpm typecheck` in `packages/core` to verify no type errors

**Verification**: `pnpm typecheck` passes in `packages/core`

---

### Phase 2: Database Migration

**Goal**: Create the `system_exchange_rates` table with enum, indexes, constraints, and trigger.

**Files to create/modify**:
- `packages/persistence/src/Migrations/Migration00XX_CreateSystemExchangeRates.ts` (new - use next migration number)

**Tasks**:
- [ ] **2.1** Determine the next migration number by checking existing migrations in `packages/persistence/src/Migrations/`
- [ ] **2.2** Create new migration file with `Effect.gen()` pattern using `SqlClient.SqlClient`
- [ ] **2.3** Create enum type: `CREATE TYPE system_rate_source AS ENUM ('frankfurter', 'manual')`
- [ ] **2.4** Create table `system_exchange_rates` with columns:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `currency VARCHAR(3) NOT NULL`
  - `rate NUMERIC(19,10) NOT NULL`
  - `effective_date DATE NOT NULL`
  - `source system_rate_source NOT NULL`
  - `fetched_at TIMESTAMPTZ` (nullable for manual entries)
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] **2.5** Add unique constraint: `UNIQUE(currency, effective_date)`
- [ ] **2.6** Add check constraint: `CHECK(rate > 0)`
- [ ] **2.7** Create index on `effective_date DESC`
- [ ] **2.8** Create index on `currency`
- [ ] **2.9** Create update trigger for `updated_at` (follow existing migration patterns)
- [ ] **2.10** Export migration as default

**Verification**: Migration file compiles without type errors

---

### Phase 3: Repository Interface

**Goal**: Define the `SystemExchangeRateRepository` service interface.

**Files to create/modify**:
- `packages/persistence/src/Services/SystemExchangeRateRepository.ts` (new)

**Tasks**:
- [ ] **3.1** Import required types: `Context`, `Effect`, `Option` from `effect`, domain types from `@accountability/core`
- [ ] **3.2** Import `PersistenceError` from existing `../Errors/RepositoryError`
- [ ] **3.3** Define `SystemExchangeRateRepositoryService` interface with methods:
  - `findRate(currency: CurrencyCode, date: string): Effect<Option<SystemExchangeRate>, PersistenceError>`
  - `findLatestRate(currency: CurrencyCode): Effect<Option<SystemExchangeRate>, PersistenceError>`
  - `findClosestRate(currency: CurrencyCode, date: string): Effect<Option<SystemExchangeRate>, PersistenceError>`
  - `findByDate(date: string): Effect<ReadonlyArray<SystemExchangeRate>, PersistenceError>`
  - `findByDateRange(startDate: string, endDate: string): Effect<ReadonlyArray<SystemExchangeRate>, PersistenceError>`
  - `upsert(rate: Omit<SystemExchangeRate, "id" | "createdAt" | "updatedAt">): Effect<SystemExchangeRate, PersistenceError>`
  - `bulkUpsert(rates: ReadonlyArray<...>): Effect<number, PersistenceError>`
  - `getAvailableCurrencies: Effect<ReadonlyArray<CurrencyCode>, PersistenceError>`
  - `getDateRange: Effect<Option<{ minDate: string; maxDate: string }>, PersistenceError>`
- [ ] **3.4** Create `SystemExchangeRateRepository` Context.Tag class
- [ ] **3.5** Run `pnpm typecheck` in `packages/persistence`

**Verification**: `pnpm typecheck` passes in `packages/persistence`

---

### Phase 4: Repository Implementation

**Goal**: Implement `SystemExchangeRateRepositoryLive` with all repository methods.

**Files to create/modify**:
- `packages/persistence/src/Layers/SystemExchangeRateRepositoryLive.ts` (new)

**Tasks**:
- [ ] **4.1** Create `SystemExchangeRateRow` schema matching database columns (snake_case):
  - `id: Schema.String`
  - `currency: Schema.String`
  - `rate: Schema.String` (NUMERIC comes as string from pg)
  - `effective_date: Schema.DateFromSelf`
  - `source: Schema.String`
  - `fetched_at: Schema.NullOr(Schema.DateFromSelf)`
  - `created_at: Schema.DateFromSelf`
  - `updated_at: Schema.DateFromSelf`
- [ ] **4.2** Create `rowToSystemExchangeRate` pure function to convert row to domain entity
- [ ] **4.3** Create `CountRow` schema: `{ count: Schema.NumberFromString }`
- [ ] **4.4** Create `DateRangeRow` schema: `{ min_date: Schema.NullOr(...), max_date: Schema.NullOr(...) }`
- [ ] **4.5** Implement `make` using `Effect.gen()`:
  - Get `SqlClient.SqlClient`
  - Create `SqlSchema.findOne` for `findRate` query
  - Create `SqlSchema.findOne` for `findLatestRate` query (ORDER BY effective_date DESC LIMIT 1)
  - Create `SqlSchema.findOne` for `findClosestRate` query (uses ABS date difference, ORDER BY, LIMIT 1)
  - Create `SqlSchema.findAll` for `findByDate` query
  - Create `SqlSchema.findAll` for `findByDateRange` query
- [ ] **4.6** Implement `upsert` using `INSERT ... ON CONFLICT (currency, effective_date) DO UPDATE`
- [ ] **4.7** Implement `bulkUpsert` using `UNNEST` arrays for batch insert with ON CONFLICT
- [ ] **4.8** Implement `getAvailableCurrencies` with `SELECT DISTINCT currency`
- [ ] **4.9** Implement `getDateRange` with `SELECT MIN(effective_date), MAX(effective_date)`
- [ ] **4.10** Use `wrapSqlError()` pattern for all queries
- [ ] **4.11** Export as `Layer.effect(SystemExchangeRateRepository, make)`
- [ ] **4.12** Run `pnpm typecheck` in `packages/persistence`

**Verification**: `pnpm typecheck` passes in `packages/persistence`

---

### Phase 5: Frankfurter HTTP Client

**Goal**: Create HTTP client for Frankfurter API with typed responses.

**Files to create/modify**:
- `packages/core/src/Clients/FrankfurterClient.ts` (new)
- `packages/core/src/Clients/index.ts` (create if needed, or add export)

**Tasks**:
- [ ] **5.1** Define `BASE_URL = "https://api.frankfurter.dev/v1"`
- [ ] **5.2** Create `CurrenciesResponse` schema: `Schema.Record({ key: Schema.String, value: Schema.String })`
- [ ] **5.3** Create `RatesResponse` schema:
  ```typescript
  Schema.Struct({
    base: Schema.String,
    date: Schema.String,
    rates: Schema.Record({ key: Schema.String, value: Schema.Number })
  })
  ```
- [ ] **5.4** Create `TimeSeriesResponse` schema for date range responses (nested records)
- [ ] **5.5** Create `FrankfurterError` extending `Schema.TaggedError` with `message` and optional `cause`
- [ ] **5.6** Define `FrankfurterClientService` interface with methods:
  - `fetchCurrencies: Effect<Record<string, string>, FrankfurterError>`
  - `fetchLatest: Effect<RatesResponse.Type, FrankfurterError>`
  - `fetchHistorical(date: string): Effect<RatesResponse.Type, FrankfurterError>`
  - `fetchRange(startDate: string, endDate: string): Effect<TimeSeriesResponse.Type, FrankfurterError>`
- [ ] **5.7** Create `FrankfurterClient` Context.Tag class
- [ ] **5.8** Implement `FrankfurterClientLive` Layer:
  - Get `HttpClient.HttpClient` from context
  - Create generic `fetch` helper that does GET request and parses response with schema
  - Map errors to `FrankfurterError`
  - Use `Effect.scoped` for request lifecycle
- [ ] **5.9** Add retry logic with exponential backoff (3 attempts) using `Effect.retry`
- [ ] **5.10** Run `pnpm typecheck` in `packages/core`

**Verification**: `pnpm typecheck` passes in `packages/core`

---

### Phase 6: Exchange Rate Sync Service

**Goal**: Create service that orchestrates fetching from Frankfurter and storing in database.

**Files to create/modify**:
- `packages/core/src/Services/ExchangeRateSyncService.ts` (new)

**Tasks**:
- [ ] **6.1** Define result types as `Schema.Class`:
  - `SyncResult`: `{ date, currenciesCount, upsertedCount, duration }`
  - `SyncRangeResult`: `{ startDate, endDate, daysProcessed, totalRatesUpserted, duration }`
- [ ] **6.2** Create `SyncError` extending `Schema.TaggedError` with `message` and optional `cause`
- [ ] **6.3** Define `ExchangeRateSyncServiceShape` interface:
  - `syncLatest: Effect<SyncResult, SyncError>`
  - `syncDate(date: string): Effect<SyncResult, SyncError>`
  - `syncRange(startDate: string, endDate: string): Effect<SyncRangeResult, SyncError>`
  - `getSupportedCurrencies: Effect<Array<{ code: string; name: string }>, SyncError>`
- [ ] **6.4** Create `ExchangeRateSyncService` Context.Tag class
- [ ] **6.5** Implement `ExchangeRateSyncServiceLive` Layer:
  - Depend on `FrankfurterClient` and `SystemExchangeRateRepository`
  - Create `syncFromResponse` helper that converts API response to domain entities and calls `bulkUpsert`
  - Implement `syncLatest`: fetch latest, transform, upsert, track duration
  - Implement `syncDate`: fetch historical date, transform, upsert
  - Implement `syncRange`: fetch range, iterate dates, batch upsert
  - Implement `getSupportedCurrencies`: fetch currencies, transform to array of {code, name}
- [ ] **6.6** Map `FrankfurterError` and `PersistenceError` to `SyncError`
- [ ] **6.7** Run `pnpm typecheck` in `packages/core`

**Verification**: `pnpm typecheck` passes in `packages/core`

---

### Phase 7: Cross Rate Service

**Goal**: Create service for rate lookups with triangulation logic.

**Files to create/modify**:
- `packages/core/src/Services/CrossRateService.ts` (new)

**Tasks**:
- [ ] **7.1** Define `RateResult` as `Schema.Class`:
  - `from: CurrencyCode`
  - `to: CurrencyCode`
  - `rate: Schema.BigDecimal`
  - `effectiveDate: Schema.String`
  - `source: Schema.Literal("direct", "triangulated", "organization")`
  - `intermediateRates: Schema.OptionFromNullOr(Schema.Struct({ eurToFrom: Schema.BigDecimal, eurToTo: Schema.BigDecimal }))`
- [ ] **7.2** Create `RateNotFoundError` extending `Schema.TaggedError` with `from`, `to`, `date`, `message`
- [ ] **7.3** Define `CrossRateServiceShape` interface:
  - `getRate(params: { from, to, date, organizationId? }): Effect<RateResult, RateNotFoundError>`
  - `getLatestRate(params: { from, to, organizationId? }): Effect<RateResult, RateNotFoundError>`
  - `getClosestRate(params: { from, to, date, organizationId? }): Effect<RateResult, RateNotFoundError>`
- [ ] **7.4** Create `CrossRateService` Context.Tag class
- [ ] **7.5** Implement `triangulate` helper function:
  - Same currency → return rate 1
  - EUR → XXX → direct lookup from system repo
  - XXX → EUR → inverse (1 / system rate)
  - XXX → YYY → fetch both EUR rates, compute `eurToTo / eurToFrom`
- [ ] **7.6** Implement `CrossRateServiceLive` Layer:
  - Depend on `SystemExchangeRateRepository` and `ExchangeRateRepository` (existing org rates)
  - Implement `getRate`: check org rate first (if orgId provided), then triangulate
  - Implement `getLatestRate`: get date range, call getRate with max date
  - Implement `getClosestRate`: try exact date, fallback to closest rate from repo
- [ ] **7.7** Use `BigDecimal.divide` for rate calculations (handle division properly)
- [ ] **7.8** Run `pnpm typecheck` in `packages/core`

**Verification**: `pnpm typecheck` passes in `packages/core`

---

### Phase 8: API Definition

**Goal**: Define HTTP API endpoints for system exchange rates.

**Files to create/modify**:
- `packages/api/src/Definitions/SystemExchangeRateApi.ts` (new)

**Tasks**:
- [ ] **8.1** Create request/response schemas as `Schema.Class`:
  - `SyncRequest`: `{ date?: string }`
  - `SyncRangeRequest`: `{ startDate: string, endDate: string }`
  - `SyncResponse`: `{ date, currenciesCount, upsertedCount, duration }`
  - `SyncRangeResponse`: `{ startDate, endDate, daysProcessed, totalRatesUpserted, duration }`
  - `RateRequest`: `{ from: CurrencyCode, to: CurrencyCode, date?: string }`
  - `RateResponse`: `{ from, to, rate: string, effectiveDate, source }`
  - `CurrencyInfo`: `{ code: string, name: string }`
  - `SystemExchangeRateStatusResponse`: `{ availableCurrencies, dateRange?, totalRates }`
- [ ] **8.2** Create `SystemExchangeRateListParams` query schema with pagination and filters
- [ ] **8.3** Define endpoints using `HttpApiEndpoint`:
  - `GET /system/exchange-rates` - list with pagination
  - `GET /system/exchange-rates/rate` - get rate with triangulation
  - `POST /system/exchange-rates/sync` - trigger sync (cron)
  - `POST /system/exchange-rates/sync/range` - backfill range (admin)
  - `GET /system/exchange-rates/currencies` - supported currencies
  - `GET /system/exchange-rates/status` - sync status
- [ ] **8.4** Add appropriate error types to each endpoint (NotFoundError, ValidationError, etc.)
- [ ] **8.5** Add OpenAPI annotations with descriptions
- [ ] **8.6** Create `SystemExchangeRateApi` class extending `HttpApiGroup.make()` with prefix `/v1`
- [ ] **8.7** Run `pnpm typecheck` in `packages/api`

**Verification**: `pnpm typecheck` passes in `packages/api`

---

### Phase 9: API Implementation

**Goal**: Implement HTTP API handlers.

**Files to create/modify**:
- `packages/api/src/Layers/SystemExchangeRateApiLive.ts` (new)
- `packages/api/src/AppApi.ts` (add new API group)
- `packages/api/src/Layers/AppApiLive.ts` (add new handler layer)

**Tasks**:
- [ ] **9.1** Create error mapping helpers:
  - `mapSyncErrorToApiError`
  - `mapRateNotFoundToApiError`
  - `mapPersistenceErrorToApiError`
- [ ] **9.2** Implement handlers using `HttpApiBuilder.group()`:
  - `list` handler: call repository `findByDate` or `findByDateRange` with pagination
  - `getRate` handler: call `CrossRateService.getRate` or `getLatestRate`
  - `sync` handler: call `ExchangeRateSyncService.syncLatest` or `syncDate`
  - `syncRange` handler: call `ExchangeRateSyncService.syncRange`
  - `currencies` handler: call `ExchangeRateSyncService.getSupportedCurrencies`
  - `status` handler: call repository methods for stats
- [ ] **9.3** Add `SystemExchangeRateApi` to `AppApi` definition in `AppApi.ts`
- [ ] **9.4** Add `SystemExchangeRateApiLive` to the API layer composition in `AppApiLive.ts`
- [ ] **9.5** Wire up dependencies (repositories, services) in layer composition
- [ ] **9.6** Run `pnpm typecheck` in `packages/api`

**Verification**: `pnpm typecheck` passes in `packages/api`

---

### Phase 10: Layer Wiring & Integration

**Goal**: Wire all layers together and ensure services are available in the runtime.

**Files to create/modify**:
- `packages/persistence/src/Layers/index.ts` (add new export)
- `packages/core/src/Services/index.ts` (add new exports)
- `packages/core/src/Clients/index.ts` (add new export if needed)
- `packages/api/src/Layers/index.ts` (add new export)

**Tasks**:
- [ ] **10.1** Export `SystemExchangeRateRepositoryLive` from persistence package
- [ ] **10.2** Export `FrankfurterClientLive` from core package
- [ ] **10.3** Export `ExchangeRateSyncServiceLive` from core package
- [ ] **10.4** Export `CrossRateServiceLive` from core package
- [ ] **10.5** Create composed layer that provides all dependencies:
  ```typescript
  const SystemExchangeRateLive = Layer.mergeAll(
    SystemExchangeRateRepositoryLive,
    FrankfurterClientLive.pipe(Layer.provide(HttpClientLive)),
    ExchangeRateSyncServiceLive,
    CrossRateServiceLive
  )
  ```
- [ ] **10.6** Add layers to main API runtime composition
- [ ] **10.7** Run `pnpm typecheck` across all packages
- [ ] **10.8** Run `pnpm test` to ensure no regressions

**Verification**: `pnpm typecheck && pnpm test` passes

---

### Phase 11: Unit Tests

**Goal**: Write unit tests for all new services.

**Files to create**:
- `packages/core/src/Clients/FrankfurterClient.test.ts`
- `packages/core/src/Services/ExchangeRateSyncService.test.ts`
- `packages/core/src/Services/CrossRateService.test.ts`
- `packages/persistence/src/Layers/SystemExchangeRateRepositoryLive.test.ts`

**Tasks**:
- [ ] **11.1** Create `FrankfurterClient` tests:
  - Mock HTTP responses using `@effect/platform` test utilities
  - Test `fetchCurrencies` returns parsed record
  - Test `fetchLatest` returns parsed rates
  - Test `fetchHistorical` returns rates for specific date
  - Test `fetchRange` returns time series data
  - Test error handling for network failures
- [ ] **11.2** Create `CrossRateService` tests:
  - Test same currency returns rate 1.0
  - Test EUR → XXX direct lookup
  - Test XXX → EUR inverse calculation
  - Test XXX → YYY triangulation
  - Test triangulation: `A → B → A ≈ 1.0`
  - Test inverse: `rate(A, B) * rate(B, A) ≈ 1.0`
  - Test org rate priority over system rate
  - Test error when rates not found
- [ ] **11.3** Create `ExchangeRateSyncService` tests:
  - Mock FrankfurterClient and repository
  - Test `syncLatest` calls API and upserts
  - Test `syncDate` with specific date
  - Test `syncRange` processes multiple dates
  - Test error propagation from API failures
- [ ] **11.4** Create repository integration tests (using testcontainers):
  - Test `upsert` creates new rate
  - Test `upsert` updates existing rate on conflict
  - Test `bulkUpsert` with multiple rates
  - Test `findRate` returns correct rate
  - Test `findClosestRate` finds nearest date
  - Test `getDateRange` returns min/max
- [ ] **11.5** Run `pnpm test` to verify all tests pass

**Verification**: `pnpm test` passes with new tests

---

### Phase 12: Integration Tests

**Goal**: Write API integration tests.

**Files to create**:
- `packages/api/src/Layers/SystemExchangeRateApiLive.test.ts`

**Tasks**:
- [ ] **12.1** Create API integration tests:
  - Test `GET /system/exchange-rates` returns list
  - Test `GET /system/exchange-rates/rate` returns triangulated rate
  - Test `POST /system/exchange-rates/sync` triggers sync
  - Test `POST /system/exchange-rates/sync/range` backfills
  - Test `GET /system/exchange-rates/currencies` returns list
  - Test `GET /system/exchange-rates/status` returns status
- [ ] **12.2** Test error responses:
  - Test 404 for rate not found
  - Test validation errors for invalid currency codes
- [ ] **12.3** Run `pnpm test` to verify all tests pass

**Verification**: `pnpm test` passes

---

### Phase 13: OpenAPI Client Generation

**Goal**: Regenerate typed API client for frontend.

**Tasks**:
- [ ] **13.1** Run `pnpm generate:api` in `packages/web` to regenerate OpenAPI client
- [ ] **13.2** Verify new endpoints are available in generated types
- [ ] **13.3** Run `pnpm typecheck` in `packages/web`

**Verification**: `pnpm typecheck` passes in `packages/web`

---

### Phase 14: Frontend Admin UI (Optional)

**Goal**: Create admin page for exchange rate sync management.

**Files to create**:
- `packages/web/app/routes/admin/exchange-rates.tsx` (new)

**Tasks**:
- [ ] **14.1** Create route file with loader:
  - Fetch status from `/api/v1/system/exchange-rates/status`
  - Fetch supported currencies
- [ ] **14.2** Create page component with:
  - Status display (last sync date, available date range, total rates)
  - "Sync Latest" button calling POST `/sync`
  - Date range picker for backfill with "Backfill" button calling POST `/sync/range`
  - Supported currencies list
  - System rates table with date/currency filters
- [ ] **14.3** Add page to admin navigation
- [ ] **14.4** Run `pnpm typecheck` and `pnpm dev` to test

**Verification**: Page renders correctly, sync operations work

---

### Phase 15: Final Verification

**Goal**: Ensure everything works end-to-end.

**Tasks**:
- [ ] **15.1** Run full test suite: `pnpm test`
- [ ] **15.2** Run type check: `pnpm typecheck`
- [ ] **15.3** Run linter: `pnpm lint`
- [ ] **15.4** Start dev server and test API endpoints manually
- [ ] **15.5** Test sync operation with real Frankfurter API
- [ ] **15.6** Verify triangulation works correctly for various currency pairs

**Verification**: All checks pass, manual testing confirms functionality

---

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
