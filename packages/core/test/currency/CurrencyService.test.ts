import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, Exit, Layer, Option } from "effect"
import {
  CurrencyService,
  CurrencyServiceLive,
  ExchangeRateRepository,
  RateNotFoundError,
  RateAlreadyExistsError,
  ExchangeRateIdNotFoundError,
  InverseRateCalculationError,
  TranslationResult,
  isRateNotFoundError,
  isRateAlreadyExistsError,
  isExchangeRateIdNotFoundError,
  isInverseRateCalculationError,
  isTranslationResult,
  type CreateExchangeRateInput,
  type UpdateExchangeRateInput,
  type ExchangeRateRepositoryService
} from "../../src/currency/CurrencyService.ts"
import { ExchangeRate, ExchangeRateId, Rate, type RateType } from "../../src/currency/ExchangeRate.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { OrganizationId } from "../../src/organization/Organization.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"

describe("CurrencyService", () => {
  // Test data constants
  const rateUUID1 = "550e8400-e29b-41d4-a716-446655440000"
  const rateUUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const rateUUID3 = "7ba7b810-9dad-11d1-80b4-00c04fd430c9"
  const nonExistentUUID = "9ba7b810-9dad-11d1-80b4-00c04fd430ca"

  // Test organization ID for all exchange rate tests
  const testOrganizationId = OrganizationId.make("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

  const usd = CurrencyCode.make("USD")
  const eur = CurrencyCode.make("EUR")
  const gbp = CurrencyCode.make("GBP")
  const jpy = CurrencyCode.make("JPY")

  const date20250115 = LocalDate.make({ year: 2025, month: 1, day: 15 })
  const date20250116 = LocalDate.make({ year: 2025, month: 1, day: 16 })
  const date20250117 = LocalDate.make({ year: 2025, month: 1, day: 17 })

  // Helper to create test exchange rates
  const createExchangeRate = (
    id: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rate: string,
    effectiveDate: LocalDate,
    rateType: RateType = "Spot"
  ): ExchangeRate => {
    return ExchangeRate.make({
      id: ExchangeRateId.make(id),
      organizationId: testOrganizationId,
      fromCurrency,
      toCurrency,
      rate: Rate.make(BigDecimal.unsafeFromString(rate)),
      effectiveDate,
      rateType,
      source: "Manual",
      createdAt: Timestamp.make({ epochMillis: Date.now() })
    })
  }

  // Helper to create CreateExchangeRateInput with organizationId
  const createRateInput = (
    id: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rate: string,
    effectiveDate: LocalDate,
    rateType: RateType = "Spot",
    source: "Manual" | "API" | "Import" = "Manual"
  ): CreateExchangeRateInput => ({
    id: ExchangeRateId.make(id),
    organizationId: testOrganizationId,
    fromCurrency,
    toCurrency,
    rate: Rate.make(BigDecimal.unsafeFromString(rate)),
    effectiveDate,
    rateType,
    source
  })

  // Mock repository implementation
  const createMockRepository = (
    initialRates: ReadonlyArray<ExchangeRate> = []
  ): ExchangeRateRepositoryService => {
    const rates = new Map<string, ExchangeRate>(
      initialRates.map((r) => [r.id, r])
    )

    const makePairKey = (
      from: CurrencyCode,
      to: CurrencyCode,
      date: LocalDate,
      type: RateType
    ): string => `${from}/${to}/${date.toISOString()}/${type}`

    return {
      findById: (id) =>
        Effect.succeed(Option.fromNullable(rates.get(id))),

      findByPairDateAndType: (fromCurrency, toCurrency, effectiveDate, rateType) => {
        const key = makePairKey(fromCurrency, toCurrency, effectiveDate, rateType)
        for (const rate of rates.values()) {
          const rateKey = makePairKey(
            rate.fromCurrency,
            rate.toCurrency,
            rate.effectiveDate,
            rate.rateType
          )
          if (rateKey === key) {
            return Effect.succeed(Option.some(rate))
          }
        }
        return Effect.succeed(Option.none())
      },

      findLatestByPair: (fromCurrency, toCurrency) => {
        let latestRate: ExchangeRate | undefined
        let latestDate: LocalDate | undefined

        for (const rate of rates.values()) {
          if (rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency) {
            if (!latestDate || isDateAfter(rate.effectiveDate, latestDate)) {
              latestRate = rate
              latestDate = rate.effectiveDate
            }
          }
        }

        return Effect.succeed(Option.fromNullable(latestRate))
      },

      save: (exchangeRate) => {
        rates.set(exchangeRate.id, exchangeRate)
        return Effect.succeed(exchangeRate)
      },

      update: (exchangeRate) => {
        rates.set(exchangeRate.id, exchangeRate)
        return Effect.succeed(exchangeRate)
      },

      exists: (fromCurrency, toCurrency, effectiveDate, rateType) => {
        const key = makePairKey(fromCurrency, toCurrency, effectiveDate, rateType)
        for (const rate of rates.values()) {
          const rateKey = makePairKey(
            rate.fromCurrency,
            rate.toCurrency,
            rate.effectiveDate,
            rate.rateType
          )
          if (rateKey === key) {
            return Effect.succeed(true)
          }
        }
        return Effect.succeed(false)
      }
    }
  }

  // Helper to compare dates
  const isDateAfter = (a: LocalDate, b: LocalDate): boolean => {
    if (a.year !== b.year) return a.year > b.year
    if (a.month !== b.month) return a.month > b.month
    return a.day > b.day
  }

  // Create test layer
  const createTestLayer = (initialRates: ReadonlyArray<ExchangeRate> = []) => {
    const repoLayer = Layer.succeed(
      ExchangeRateRepository,
      createMockRepository(initialRates)
    )

    return CurrencyServiceLive.pipe(Layer.provide(repoLayer))
  }

  describe("createRate", () => {
    describe("successful creation", () => {
      it.effect("creates a new exchange rate successfully", () =>
        Effect.gen(function* () {
          const input: CreateExchangeRateInput = {
            id: ExchangeRateId.make(rateUUID1),
            organizationId: testOrganizationId,
            fromCurrency: usd,
            toCurrency: eur,
            rate: Rate.make(BigDecimal.unsafeFromString("0.85")),
            effectiveDate: date20250115,
            rateType: "Spot",
            source: "Manual"
          }

          const service = yield* CurrencyService
          const result = yield* service.createRate(input)

          expect(result.id).toBe(input.id)
          expect(result.fromCurrency).toBe(usd)
          expect(result.toCurrency).toBe(eur)
          expect(BigDecimal.equals(result.rate, BigDecimal.unsafeFromString("0.85"))).toBe(true)
          expect(result.effectiveDate.year).toBe(2025)
          expect(result.effectiveDate.month).toBe(1)
          expect(result.effectiveDate.day).toBe(15)
          expect(result.rateType).toBe("Spot")
          expect(result.source).toBe("Manual")
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("creates rates with different rate types for same pair/date", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService

          // Create Spot rate
          const spotRate = yield* service.createRate(
            createRateInput(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
          )

          // Create Average rate for same pair/date
          const averageRate = yield* service.createRate(
            createRateInput(rateUUID2, usd, eur, "0.84", date20250115, "Average")
          )

          expect(spotRate.rateType).toBe("Spot")
          expect(averageRate.rateType).toBe("Average")
          expect(spotRate.id).not.toBe(averageRate.id)
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("creates rates with different currencies", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService

          // Create USD/EUR rate
          const usdEurRate = yield* service.createRate(
            createRateInput(rateUUID1, usd, eur, "0.85", date20250115)
          )

          // Create USD/GBP rate
          const usdGbpRate = yield* service.createRate(
            createRateInput(rateUUID2, usd, gbp, "0.78", date20250115, "Spot", "API")
          )

          expect(usdEurRate.toCurrency).toBe(eur)
          expect(usdGbpRate.toCurrency).toBe(gbp)
          expect(usdGbpRate.source).toBe("API")
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("creates rates with all rate types", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const rateTypes: RateType[] = ["Spot", "Average", "Historical", "Closing"]
          const rateIds = [rateUUID1, rateUUID2, rateUUID3, nonExistentUUID]

          for (let i = 0; i < rateTypes.length; i++) {
            const result = yield* service.createRate(
              createRateInput(rateIds[i], usd, eur, "0.85", date20250115, rateTypes[i])
            )

            expect(result.rateType).toBe(rateTypes[i])
          }
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("creates rate with Import source", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.createRate(
            createRateInput(rateUUID1, usd, eur, "0.85", date20250115, "Spot", "Import")
          )

          expect(result.source).toBe("Import")
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("creates rate with high precision decimal", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const preciseRate = BigDecimal.unsafeFromString("0.85123456789")
          const result = yield* service.createRate({
            id: ExchangeRateId.make(rateUUID1),
            organizationId: testOrganizationId,
            fromCurrency: usd,
            toCurrency: eur,
            rate: Rate.make(preciseRate),
            effectiveDate: date20250115,
            rateType: "Spot",
            source: "Manual"
          })

          expect(BigDecimal.equals(result.rate, preciseRate)).toBe(true)
        }).pipe(Effect.provide(createTestLayer()))
      )
    })

    describe("validation errors", () => {
      it.effect("fails with RateAlreadyExistsError when duplicate rate exists", () =>
        Effect.gen(function* () {
          const input = createRateInput(rateUUID2, usd, eur, "0.86", date20250115)

          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.createRate(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateAlreadyExistsError(result.cause.error)).toBe(true)
            if (isRateAlreadyExistsError(result.cause.error)) {
              expect(result.cause.error.fromCurrency).toBe(usd)
              expect(result.cause.error.toCurrency).toBe(eur)
              expect(result.cause.error.rateType).toBe("Spot")
            }
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("allows creating rate with same pair but different date", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService

          // This should succeed because date is different
          const result = yield* service.createRate(
            createRateInput(rateUUID2, usd, eur, "0.86", date20250116)
          )

          expect(result.effectiveDate.day).toBe(16)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )
    })
  })

  describe("updateRate", () => {
    describe("successful update", () => {
      it.effect("updates the rate value successfully", () =>
        Effect.gen(function* () {
          const input: UpdateExchangeRateInput = {
            id: ExchangeRateId.make(rateUUID1),
            rate: Rate.make(BigDecimal.unsafeFromString("0.87"))
          }

          const service = yield* CurrencyService
          const result = yield* service.updateRate(input)

          expect(BigDecimal.equals(result.rate, BigDecimal.unsafeFromString("0.87"))).toBe(true)
          // Other properties should remain unchanged
          expect(result.fromCurrency).toBe(usd)
          expect(result.toCurrency).toBe(eur)
          expect(result.effectiveDate.year).toBe(2025)
          expect(result.rateType).toBe("Spot")
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("updates the source when provided", () =>
        Effect.gen(function* () {
          const input: UpdateExchangeRateInput = {
            id: ExchangeRateId.make(rateUUID1),
            rate: Rate.make(BigDecimal.unsafeFromString("0.87")),
            source: "API"
          }

          const service = yield* CurrencyService
          const result = yield* service.updateRate(input)

          expect(result.source).toBe("API")
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("keeps original source when not provided in update", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.updateRate({
            id: ExchangeRateId.make(rateUUID1),
            rate: Rate.make(BigDecimal.unsafeFromString("0.87"))
          })

          expect(result.source).toBe("Manual") // Original source preserved
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )
    })

    describe("validation errors", () => {
      it.effect("fails with ExchangeRateIdNotFoundError when rate doesn't exist", () =>
        Effect.gen(function* () {
          const input: UpdateExchangeRateInput = {
            id: ExchangeRateId.make(nonExistentUUID),
            rate: Rate.make(BigDecimal.unsafeFromString("0.87"))
          }

          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.updateRate(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isExchangeRateIdNotFoundError(result.cause.error)).toBe(true)
            if (isExchangeRateIdNotFoundError(result.cause.error)) {
              expect(result.cause.error.exchangeRateId).toBe(ExchangeRateId.make(nonExistentUUID))
            }
          }
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("fails when updating with wrong ID", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.updateRate({
            id: ExchangeRateId.make(rateUUID2), // Wrong ID
            rate: Rate.make(BigDecimal.unsafeFromString("0.87"))
          }))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isExchangeRateIdNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )
    })
  })

  describe("getRate", () => {
    describe("successful retrieval", () => {
      it.effect("retrieves an existing rate by pair, date, and type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.getRate(usd, eur, date20250115, "Spot")

          expect(result.fromCurrency).toBe(usd)
          expect(result.toCurrency).toBe(eur)
          expect(result.effectiveDate.day).toBe(15)
          expect(result.rateType).toBe("Spot")
          expect(BigDecimal.equals(result.rate, BigDecimal.unsafeFromString("0.85"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("retrieves correct rate when multiple rates exist", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService

          // Get Spot rate
          const spotRate = yield* service.getRate(usd, eur, date20250115, "Spot")
          expect(BigDecimal.equals(spotRate.rate, BigDecimal.unsafeFromString("0.85"))).toBe(true)

          // Get Average rate
          const avgRate = yield* service.getRate(usd, eur, date20250115, "Average")
          expect(BigDecimal.equals(avgRate.rate, BigDecimal.unsafeFromString("0.84"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, usd, eur, "0.84", date20250115, "Average")
        ])))
      )

      it.effect("retrieves Historical rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.getRate(usd, eur, date20250115, "Historical")

          expect(result.rateType).toBe("Historical")
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Historical")
        ])))
      )

      it.effect("retrieves Closing rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.getRate(usd, eur, date20250115, "Closing")

          expect(result.rateType).toBe("Closing")
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Closing")
        ])))
      )
    })

    describe("not found errors", () => {
      it.effect("fails with RateNotFoundError when rate doesn't exist", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.getRate(usd, eur, date20250115, "Spot"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
            if (isRateNotFoundError(result.cause.error)) {
              expect(result.cause.error.fromCurrency).toBe(usd)
              expect(result.cause.error.toCurrency).toBe(eur)
              expect(result.cause.error.effectiveDate?.year).toBe(2025)
              expect(result.cause.error.effectiveDate?.month).toBe(1)
              expect(result.cause.error.effectiveDate?.day).toBe(15)
              expect(result.cause.error.rateType).toBe("Spot")
            }
          }
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("fails when rate exists but for different date", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.getRate(usd, eur, date20250116, "Spot"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("fails when rate exists but for different type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.getRate(usd, eur, date20250115, "Average"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("fails when rate exists but for different currency pair", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.getRate(usd, gbp, date20250115, "Spot"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("fails when currencies are reversed", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          // Rate exists for USD/EUR, not EUR/USD
          const result = yield* Effect.exit(service.getRate(eur, usd, date20250115, "Spot"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )
    })
  })

  describe("getLatestRate", () => {
    describe("successful retrieval", () => {
      it.effect("retrieves the latest rate for a currency pair", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.getLatestRate(usd, eur)

          expect(result.fromCurrency).toBe(usd)
          expect(result.toCurrency).toBe(eur)
          expect(result.effectiveDate.day).toBe(17) // Latest date
          expect(BigDecimal.equals(result.rate, BigDecimal.unsafeFromString("0.87"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, usd, eur, "0.86", date20250116, "Spot"),
          createExchangeRate(rateUUID3, usd, eur, "0.87", date20250117, "Spot")
        ])))
      )

      it.effect("returns latest rate regardless of rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.getLatestRate(usd, eur)

          // Latest rate by date, regardless of type
          expect(result.effectiveDate.day).toBe(17)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, usd, eur, "0.86", date20250116, "Average"),
          createExchangeRate(rateUUID3, usd, eur, "0.87", date20250117, "Closing")
        ])))
      )

      it.effect("returns correct rate when only one exists", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.getLatestRate(usd, eur)

          expect(result.effectiveDate.day).toBe(15)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("handles rates with same date correctly", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* service.getLatestRate(usd, eur)

          // Both have same date, either is acceptable
          expect(result.effectiveDate.day).toBe(15)
          expect(result.fromCurrency).toBe(usd)
          expect(result.toCurrency).toBe(eur)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, usd, eur, "0.84", date20250115, "Average")
        ])))
      )
    })

    describe("not found errors", () => {
      it.effect("fails with RateNotFoundError when no rates exist for pair", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.getLatestRate(usd, eur))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
            if (isRateNotFoundError(result.cause.error)) {
              expect(result.cause.error.fromCurrency).toBe(usd)
              expect(result.cause.error.toCurrency).toBe(eur)
              expect(result.cause.error.effectiveDate).toBeUndefined()
              expect(result.cause.error.rateType).toBeUndefined()
            }
          }
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("fails when rates exist only for different pairs", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.getLatestRate(usd, gbp))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("fails when currencies are reversed", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const result = yield* Effect.exit(service.getLatestRate(eur, usd))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )
    })
  })

  describe("error type guards", () => {
    it("isRateNotFoundError returns true for RateNotFoundError", () => {
      const error = new RateNotFoundError({
        fromCurrency: usd,
        toCurrency: eur,
        effectiveDate: { year: 2025, month: 1, day: 15 },
        rateType: "Spot"
      })
      expect(isRateNotFoundError(error)).toBe(true)
      expect(error._tag).toBe("RateNotFoundError")
    })

    it("isRateNotFoundError returns true without optional fields", () => {
      const error = new RateNotFoundError({
        fromCurrency: usd,
        toCurrency: eur
      })
      expect(isRateNotFoundError(error)).toBe(true)
    })

    it("isRateAlreadyExistsError returns true for RateAlreadyExistsError", () => {
      const error = new RateAlreadyExistsError({
        fromCurrency: usd,
        toCurrency: eur,
        effectiveDate: { year: 2025, month: 1, day: 15 },
        rateType: "Spot"
      })
      expect(isRateAlreadyExistsError(error)).toBe(true)
      expect(error._tag).toBe("RateAlreadyExistsError")
    })

    it("isExchangeRateIdNotFoundError returns true for ExchangeRateIdNotFoundError", () => {
      const error = new ExchangeRateIdNotFoundError({
        exchangeRateId: ExchangeRateId.make(rateUUID1)
      })
      expect(isExchangeRateIdNotFoundError(error)).toBe(true)
      expect(error._tag).toBe("ExchangeRateIdNotFoundError")
    })

    it("type guards return false for other values", () => {
      expect(isRateNotFoundError(null)).toBe(false)
      expect(isRateNotFoundError(undefined)).toBe(false)
      expect(isRateNotFoundError(new Error("test"))).toBe(false)
      expect(isRateNotFoundError({ _tag: "RateNotFoundError" })).toBe(false)

      expect(isRateAlreadyExistsError(null)).toBe(false)
      expect(isRateAlreadyExistsError(undefined)).toBe(false)

      expect(isExchangeRateIdNotFoundError(null)).toBe(false)
      expect(isExchangeRateIdNotFoundError(undefined)).toBe(false)
    })
  })

  describe("error messages", () => {
    it("RateNotFoundError has correct message with all fields", () => {
      const error = new RateNotFoundError({
        fromCurrency: usd,
        toCurrency: eur,
        effectiveDate: { year: 2025, month: 1, day: 15 },
        rateType: "Spot"
      })
      expect(error.message).toContain("USD/EUR")
      expect(error.message).toContain("2025-01-15")
      expect(error.message).toContain("Spot")
    })

    it("RateNotFoundError has correct message without optional fields", () => {
      const error = new RateNotFoundError({
        fromCurrency: usd,
        toCurrency: eur
      })
      expect(error.message).toContain("USD/EUR")
      expect(error.message).not.toContain("for date")
    })

    it("RateAlreadyExistsError has correct message", () => {
      const error = new RateAlreadyExistsError({
        fromCurrency: usd,
        toCurrency: eur,
        effectiveDate: { year: 2025, month: 1, day: 15 },
        rateType: "Average"
      })
      expect(error.message).toContain("USD/EUR")
      expect(error.message).toContain("2025-01-15")
      expect(error.message).toContain("Average")
      expect(error.message).toContain("already exists")
    })

    it("ExchangeRateIdNotFoundError has correct message", () => {
      const error = new ExchangeRateIdNotFoundError({
        exchangeRateId: ExchangeRateId.make(rateUUID1)
      })
      expect(error.message).toContain(rateUUID1)
      expect(error.message).toContain("not found")
    })
  })

  describe("integration scenarios", () => {
    it.effect("create then retrieve rate", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService

        // Create a rate
        const created = yield* service.createRate(
          createRateInput(rateUUID1, usd, jpy, "150.25", date20250115, "Spot", "API")
        )

        // Retrieve the same rate
        const retrieved = yield* service.getRate(usd, jpy, date20250115, "Spot")

        expect(created.id).toBe(retrieved.id)
        expect(BigDecimal.equals(created.rate, retrieved.rate)).toBe(true)
      }).pipe(Effect.provide(createTestLayer()))
    )

    it.effect("create then update then retrieve rate", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService

        // Create a rate
        yield* service.createRate(
          createRateInput(rateUUID1, usd, jpy, "150.25", date20250115, "Spot", "API")
        )

        // Update the rate
        yield* service.updateRate({
          id: ExchangeRateId.make(rateUUID1),
          rate: Rate.make(BigDecimal.unsafeFromString("151.50")),
          source: "Manual"
        })

        // Retrieve and verify
        const retrieved = yield* service.getRate(usd, jpy, date20250115, "Spot")

        expect(BigDecimal.equals(retrieved.rate, BigDecimal.unsafeFromString("151.50"))).toBe(true)
        expect(retrieved.source).toBe("Manual")
      }).pipe(Effect.provide(createTestLayer()))
    )

    it.effect("create multiple rates then get latest", () =>
      Effect.gen(function* () {
        const service = yield* CurrencyService

        // Create rates for different dates
        yield* service.createRate(
          createRateInput(rateUUID1, gbp, usd, "1.25", date20250115, "Spot", "API")
        )

        yield* service.createRate(
          createRateInput(rateUUID2, gbp, usd, "1.27", date20250117, "Spot", "API")
        )

        // Get latest
        const latest = yield* service.getLatestRate(gbp, usd)

        expect(latest.effectiveDate.day).toBe(17)
        expect(BigDecimal.equals(latest.rate, BigDecimal.unsafeFromString("1.27"))).toBe(true)
      }).pipe(Effect.provide(createTestLayer()))
    )
  })

  describe("translate", () => {
    describe("same currency translation", () => {
      it.effect("returns identity translation for same currency", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, usd, date20250115, "Spot")

          expect(isTranslationResult(result)).toBe(true)
          expect(result.originalAmount.currency).toBe(usd)
          expect(result.translatedAmount.currency).toBe(usd)
          expect(BigDecimal.equals(result.originalAmount.amount, result.translatedAmount.amount)).toBe(true)
          expect(BigDecimal.equals(result.rateUsed, BigDecimal.fromNumber(1))).toBe(true)
          expect(result.wasInverted).toBe(false)
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("preserves the exact amount for same currency", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("123.4567", "EUR")

          const result = yield* service.translate(amount, eur, date20250115, "Average")

          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("123.4567"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer()))
      )
    })

    describe("direct rate translation", () => {
      it.effect("translates using direct rate (USD to EUR)", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Spot")

          expect(result.originalAmount.currency).toBe(usd)
          expect(result.translatedAmount.currency).toBe(eur)
          // 100 * 0.85 = 85
          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("85.00"))).toBe(true)
          expect(BigDecimal.equals(result.rateUsed, BigDecimal.unsafeFromString("0.85"))).toBe(true)
          expect(result.wasInverted).toBe(false)
          expect(result.rateDate.day).toBe(15)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("translates using direct rate with high precision", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("1000.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Spot")

          // 1000 * 0.85123456 = 851.23456
          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("851.23456"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85123456", date20250115, "Spot")
        ])))
      )

      it.effect("uses correct rate type for translation", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          // Use Average rate
          const avgResult = yield* service.translate(amount, eur, date20250115, "Average")
          expect(BigDecimal.equals(avgResult.translatedAmount.amount, BigDecimal.unsafeFromString("84.00"))).toBe(true)

          // Use Spot rate
          const spotResult = yield* service.translate(amount, eur, date20250115, "Spot")
          expect(BigDecimal.equals(spotResult.translatedAmount.amount, BigDecimal.unsafeFromString("85.00"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, usd, eur, "0.84", date20250115, "Average")
        ])))
      )
    })

    describe("inverse rate translation", () => {
      it.effect("translates using inverse rate (EUR to USD when only USD/EUR exists)", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("85.00", "EUR")

          // We have USD/EUR = 0.85, so EUR/USD should be 1/0.85 ≈ 1.176470588...
          const result = yield* service.translate(amount, usd, date20250115, "Spot")

          expect(result.originalAmount.currency).toBe(eur)
          expect(result.translatedAmount.currency).toBe(usd)
          expect(result.wasInverted).toBe(true)

          // 85 * (1/0.85) ≈ 100 (with some precision loss due to inverse rate calculation)
          // The inverse rate is ~1.176470588... and 85 * 1.176470588... ≈ 99.9999999...
          // So we check it's approximately 100 within a small tolerance
          const translatedValue = result.translatedAmount.amount
          const difference = BigDecimal.abs(
            BigDecimal.subtract(translatedValue, BigDecimal.unsafeFromString("100"))
          )
          // Allow for small precision difference (less than 0.000001)
          expect(BigDecimal.lessThan(difference, BigDecimal.unsafeFromString("0.000001"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("marks result as inverted when using inverse rate", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "EUR")

          const result = yield* service.translate(amount, usd, date20250115, "Spot")

          expect(result.wasInverted).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("uses inverse rate for all rate types", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "EUR")

          const spotResult = yield* service.translate(amount, usd, date20250115, "Spot")
          expect(spotResult.wasInverted).toBe(true)

          const avgResult = yield* service.translate(amount, usd, date20250115, "Average")
          expect(avgResult.wasInverted).toBe(true)

          const historicalResult = yield* service.translate(amount, usd, date20250115, "Historical")
          expect(historicalResult.wasInverted).toBe(true)

          const closingResult = yield* service.translate(amount, usd, date20250115, "Closing")
          expect(closingResult.wasInverted).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, usd, eur, "0.84", date20250115, "Average"),
          createExchangeRate(rateUUID3, usd, eur, "0.83", date20250115, "Historical"),
          createExchangeRate(nonExistentUUID, usd, eur, "0.82", date20250115, "Closing")
        ])))
      )

      it.effect("prefers direct rate over inverse rate when both exist", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Spot")

          expect(result.wasInverted).toBe(false)
          expect(BigDecimal.equals(result.rateUsed, BigDecimal.unsafeFromString("0.85"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, eur, usd, "1.18", date20250115, "Spot")
        ])))
      )
    })

    describe("rate type support", () => {
      it.effect("supports Spot rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Spot")

          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("85.00"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("supports Average rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Average")

          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("84.00"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.84", date20250115, "Average")
        ])))
      )

      it.effect("supports Historical rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Historical")

          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("83.00"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.83", date20250115, "Historical")
        ])))
      )

      it.effect("supports Closing rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Closing")

          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("82.00"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.82", date20250115, "Closing")
        ])))
      )
    })

    describe("TranslationResult properties", () => {
      it.effect("includes correct rateDate from used rate", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Spot")

          expect(result.rateDate.year).toBe(2025)
          expect(result.rateDate.month).toBe(1)
          expect(result.rateDate.day).toBe(15)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("toString produces readable format", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* service.translate(amount, eur, date20250115, "Spot")
          const str = result.toString()

          expect(str).toContain("USD")
          expect(str).toContain("EUR")
          expect(str).toContain("→")
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("toString includes (inverted) when using inverse rate", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "EUR")

          const result = yield* service.translate(amount, usd, date20250115, "Spot")
          const str = result.toString()

          expect(str).toContain("(inverted)")
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )
    })

    describe("error scenarios", () => {
      it.effect("fails with RateNotFoundError when no rate exists in either direction", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* Effect.exit(service.translate(amount, eur, date20250115, "Spot"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
            if (isRateNotFoundError(result.cause.error)) {
              expect(result.cause.error.fromCurrency).toBe(usd)
              expect(result.cause.error.toCurrency).toBe(eur)
              expect(result.cause.error.rateType).toBe("Spot")
            }
          }
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("fails when rate exists for different date", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* Effect.exit(service.translate(amount, eur, date20250116, "Spot"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("fails when rate exists for different rate type", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* Effect.exit(service.translate(amount, eur, date20250115, "Closing"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )

      it.effect("fails when only unrelated currency pairs exist", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")

          const result = yield* Effect.exit(service.translate(amount, jpy, date20250115, "Spot"))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isRateNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot")
        ])))
      )
    })

    describe("integration scenarios", () => {
      it.effect("translate multiple currencies in sequence", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService

          // USD -> EUR
          const usdAmount = MonetaryAmount.unsafeFromString("100.00", "USD")
          const eurResult = yield* service.translate(usdAmount, eur, date20250115, "Spot")
          expect(eurResult.translatedAmount.currency).toBe(eur)

          // EUR -> GBP
          const gbpResult = yield* service.translate(eurResult.translatedAmount, gbp, date20250115, "Spot")
          expect(gbpResult.translatedAmount.currency).toBe(gbp)
        }).pipe(Effect.provide(createTestLayer([
          createExchangeRate(rateUUID1, usd, eur, "0.85", date20250115, "Spot"),
          createExchangeRate(rateUUID2, eur, gbp, "0.86", date20250115, "Spot")
        ])))
      )

      it.effect("translate after creating a rate", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService

          // Create a rate
          yield* service.createRate(
            createRateInput(rateUUID1, usd, jpy, "150.25", date20250115, "Spot", "API")
          )

          // Translate using the newly created rate
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")
          const result = yield* service.translate(amount, jpy, date20250115, "Spot")

          expect(result.translatedAmount.currency).toBe(jpy)
          expect(BigDecimal.equals(result.translatedAmount.amount, BigDecimal.unsafeFromString("15025.00"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer()))
      )

      it.effect("translate with updated rate", () =>
        Effect.gen(function* () {
          const service = yield* CurrencyService

          // Create initial rate
          yield* service.createRate(
            createRateInput(rateUUID1, usd, eur, "0.85", date20250115)
          )

          // First translation
          const amount = MonetaryAmount.unsafeFromString("100.00", "USD")
          const firstResult = yield* service.translate(amount, eur, date20250115, "Spot")
          expect(BigDecimal.equals(firstResult.translatedAmount.amount, BigDecimal.unsafeFromString("85.00"))).toBe(true)

          // Update the rate
          yield* service.updateRate({
            id: ExchangeRateId.make(rateUUID1),
            rate: Rate.make(BigDecimal.unsafeFromString("0.90")),
            source: "API"
          })

          // Second translation should use updated rate
          const secondResult = yield* service.translate(amount, eur, date20250115, "Spot")
          expect(BigDecimal.equals(secondResult.translatedAmount.amount, BigDecimal.unsafeFromString("90.00"))).toBe(true)
        }).pipe(Effect.provide(createTestLayer()))
      )
    })
  })

  describe("TranslationResult type", () => {
    it("isTranslationResult returns true for TranslationResult", () => {
      const result = TranslationResult.make({
        originalAmount: MonetaryAmount.unsafeFromString("100.00", "USD"),
        translatedAmount: MonetaryAmount.unsafeFromString("85.00", "EUR"),
        rateUsed: BigDecimal.unsafeFromString("0.85"),
        rateDate: date20250115,
        wasInverted: false
      })

      expect(isTranslationResult(result)).toBe(true)
    })

    it("isTranslationResult returns false for other values", () => {
      expect(isTranslationResult(null)).toBe(false)
      expect(isTranslationResult(undefined)).toBe(false)
      expect(isTranslationResult({ _tag: "TranslationResult" })).toBe(false)
    })
  })

  describe("InverseRateCalculationError", () => {
    it("isInverseRateCalculationError returns true for InverseRateCalculationError", () => {
      const error = new InverseRateCalculationError({
        fromCurrency: usd,
        toCurrency: eur,
        effectiveDate: { year: 2025, month: 1, day: 15 },
        rateType: "Spot"
      })
      expect(isInverseRateCalculationError(error)).toBe(true)
      expect(error._tag).toBe("InverseRateCalculationError")
    })

    it("isInverseRateCalculationError returns false for other values", () => {
      expect(isInverseRateCalculationError(null)).toBe(false)
      expect(isInverseRateCalculationError(undefined)).toBe(false)
      expect(isInverseRateCalculationError(new Error("test"))).toBe(false)
    })

    it("InverseRateCalculationError has correct message", () => {
      const error = new InverseRateCalculationError({
        fromCurrency: usd,
        toCurrency: eur,
        effectiveDate: { year: 2025, month: 1, day: 15 },
        rateType: "Spot"
      })
      expect(error.message).toContain("USD")
      expect(error.message).toContain("EUR")
      expect(error.message).toContain("2025-01-15")
      expect(error.message).toContain("Spot")
      expect(error.message).toContain("inverse rate")
    })
  })
})
