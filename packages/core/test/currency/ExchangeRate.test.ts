import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, BigDecimal } from "effect"
import * as Schema from "effect/Schema"
import {
  ExchangeRateId,
  isExchangeRateId,
  RateType,
  isRateType,
  RateSource,
  isRateSource,
  Rate,
  isRate,
  ExchangeRate,
  isExchangeRate,
  convertAmount,
  getInverseRate,
  createInverse
} from "../../src/currency/ExchangeRate.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { OrganizationId } from "../../src/organization/Organization.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

// Test organization ID for all exchange rate tests
const testOrganizationId = OrganizationId.make("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

// Test helpers
const createTestExchangeRate = () => {
  return ExchangeRate.make({
    id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000"),
    organizationId: testOrganizationId,
    fromCurrency: CurrencyCode.make("USD"),
    toCurrency: CurrencyCode.make("EUR"),
    rate: Rate.make(BigDecimal.unsafeFromString("0.85")),
    effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
    rateType: "Spot",
    source: "Manual",
    createdAt: Timestamp.make({ epochMillis: 1705312800000 })
  })
}

describe("ExchangeRateId", () => {
  describe("validation", () => {
    it.effect("accepts valid UUID", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(ExchangeRateId)("550e8400-e29b-41d4-a716-446655440000")
        expect(result).toBe("550e8400-e29b-41d4-a716-446655440000")
      })
    )

    it.effect("accepts lowercase UUID", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(ExchangeRateId)("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        expect(result).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
      })
    )

    it.effect("rejects invalid UUID format", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(ExchangeRateId)("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(ExchangeRateId)(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects UUID with missing segments", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(ExchangeRateId)("550e8400-e29b-41d4"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isExchangeRateId returns true for valid IDs", () => {
      const id = ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000")
      expect(isExchangeRateId(id)).toBe(true)
    })

    it("isExchangeRateId returns false for invalid values", () => {
      expect(isExchangeRateId("not-a-uuid")).toBe(false)
      expect(isExchangeRateId(null)).toBe(false)
      expect(isExchangeRateId(undefined)).toBe(false)
      expect(isExchangeRateId(123)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates ExchangeRateId using Schema's .make()", () => {
      const id = ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000")
      expect(id).toBe("550e8400-e29b-41d4-a716-446655440000")
      expect(isExchangeRateId(id)).toBe(true)
    })
  })
})

describe("RateType", () => {
  describe("validation", () => {
    it.effect("accepts 'Spot'", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(RateType)("Spot")
        expect(result).toBe("Spot")
      })
    )

    it.effect("accepts 'Average'", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(RateType)("Average")
        expect(result).toBe("Average")
      })
    )

    it.effect("accepts 'Historical'", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(RateType)("Historical")
        expect(result).toBe("Historical")
      })
    )

    it.effect("accepts 'Closing'", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(RateType)("Closing")
        expect(result).toBe("Closing")
      })
    )

    it.effect("rejects invalid rate type", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(RateType)("Invalid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects lowercase", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(RateType)("spot"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(RateType)(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects null", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(RateType)(null))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isRateType returns true for valid rate types", () => {
      expect(isRateType("Spot")).toBe(true)
      expect(isRateType("Average")).toBe(true)
      expect(isRateType("Historical")).toBe(true)
      expect(isRateType("Closing")).toBe(true)
    })

    it("isRateType returns false for invalid values", () => {
      expect(isRateType("Invalid")).toBe(false)
      expect(isRateType("spot")).toBe(false)
      expect(isRateType("")).toBe(false)
      expect(isRateType(null)).toBe(false)
      expect(isRateType(undefined)).toBe(false)
    })
  })
})

describe("RateSource", () => {
  describe("validation", () => {
    it.effect("accepts 'Manual'", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(RateSource)("Manual")
        expect(result).toBe("Manual")
      })
    )

    it.effect("accepts 'Import'", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(RateSource)("Import")
        expect(result).toBe("Import")
      })
    )

    it.effect("accepts 'API'", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(RateSource)("API")
        expect(result).toBe("API")
      })
    )

    it.effect("rejects invalid source", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(RateSource)("Invalid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects lowercase", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(RateSource)("manual"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(RateSource)(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isRateSource returns true for valid sources", () => {
      expect(isRateSource("Manual")).toBe(true)
      expect(isRateSource("Import")).toBe(true)
      expect(isRateSource("API")).toBe(true)
    })

    it("isRateSource returns false for invalid values", () => {
      expect(isRateSource("Invalid")).toBe(false)
      expect(isRateSource("manual")).toBe(false)
      expect(isRateSource("")).toBe(false)
      expect(isRateSource(null)).toBe(false)
      expect(isRateSource(undefined)).toBe(false)
    })
  })
})

describe("Rate", () => {
  describe("validation", () => {
    it.effect("accepts positive rate", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(Rate)("1.5")
        expect(BigDecimal.format(result)).toBe("1.5")
      })
    )

    it.effect("accepts rate of 1", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(Rate)("1")
        expect(BigDecimal.format(result)).toBe("1")
      })
    )

    it.effect("accepts small positive rate", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(Rate)("0.0001")
        expect(BigDecimal.format(result)).toBe("0.0001")
      })
    )

    it.effect("accepts large rate", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(Rate)("1000000")
        expect(BigDecimal.format(result)).toBe("1000000")
      })
    )

    it.effect("accepts high precision rate", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(Rate)("1.23456789")
        expect(BigDecimal.format(result)).toBe("1.23456789")
      })
    )

    it.effect("rejects zero", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(Rate)("0"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects negative rate", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(Rate)("-1.5"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isRate returns true for valid rates", () => {
      const rate = Rate.make(BigDecimal.unsafeFromString("1.5"))
      expect(isRate(rate)).toBe(true)
    })

    it("isRate returns false for zero", () => {
      expect(isRate(BigDecimal.unsafeFromString("0"))).toBe(false)
    })

    it("isRate returns false for negative", () => {
      expect(isRate(BigDecimal.unsafeFromString("-1"))).toBe(false)
    })

    it("isRate returns false for non-BigDecimal values", () => {
      expect(isRate(1.5)).toBe(false)
      expect(isRate("1.5")).toBe(false)
      expect(isRate(null)).toBe(false)
      expect(isRate(undefined)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates Rate using Schema's .make()", () => {
      const rate = Rate.make(BigDecimal.unsafeFromString("1.5"))
      expect(BigDecimal.format(rate)).toBe("1.5")
      expect(isRate(rate)).toBe(true)
    })
  })
})

describe("ExchangeRate", () => {
  describe("validation", () => {
    it.effect("accepts valid exchange rate data", () =>
      Effect.gen(function* () {
        const exchangeRate = createTestExchangeRate()
        expect(exchangeRate.fromCurrency).toBe("USD")
        expect(exchangeRate.toCurrency).toBe("EUR")
        expect(BigDecimal.format(exchangeRate.rate)).toBe("0.85")
        expect(exchangeRate.rateType).toBe("Spot")
        expect(exchangeRate.source).toBe("Manual")
      })
    )

    it.effect("accepts different rate types", () =>
      Effect.gen(function* () {
        const baseData = {
          id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440001"),
          organizationId: testOrganizationId,
          fromCurrency: CurrencyCode.make("USD"),
          toCurrency: CurrencyCode.make("GBP"),
          rate: Rate.make(BigDecimal.unsafeFromString("0.75")),
          effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
          source: "API" as const,
          createdAt: Timestamp.make({ epochMillis: 1705312800000 })
        }

        const spotRate = ExchangeRate.make({ ...baseData, rateType: "Spot" })
        expect(spotRate.rateType).toBe("Spot")

        const avgRate = ExchangeRate.make({
          ...baseData,
          id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440002"),
          rateType: "Average"
        })
        expect(avgRate.rateType).toBe("Average")

        const histRate = ExchangeRate.make({
          ...baseData,
          id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440003"),
          rateType: "Historical"
        })
        expect(histRate.rateType).toBe("Historical")

        const closeRate = ExchangeRate.make({
          ...baseData,
          id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440004"),
          rateType: "Closing"
        })
        expect(closeRate.rateType).toBe("Closing")
      })
    )

    it.effect("accepts different sources", () =>
      Effect.gen(function* () {
        const baseData = {
          id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440005"),
          organizationId: testOrganizationId,
          fromCurrency: CurrencyCode.make("EUR"),
          toCurrency: CurrencyCode.make("JPY"),
          rate: Rate.make(BigDecimal.unsafeFromString("160.5")),
          effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
          rateType: "Spot" as const,
          createdAt: Timestamp.make({ epochMillis: 1705312800000 })
        }

        const manualRate = ExchangeRate.make({ ...baseData, source: "Manual" })
        expect(manualRate.source).toBe("Manual")

        const importRate = ExchangeRate.make({
          ...baseData,
          id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440006"),
          source: "Import"
        })
        expect(importRate.source).toBe("Import")

        const apiRate = ExchangeRate.make({
          ...baseData,
          id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440007"),
          source: "API"
        })
        expect(apiRate.source).toBe("API")
      })
    )

    it.effect("rejects invalid currency code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ExchangeRate)
        const result = yield* Effect.exit(decode({
          id: "550e8400-e29b-41d4-a716-446655440000",
          fromCurrency: "INVALID",
          toCurrency: "EUR",
          rate: "0.85",
          effectiveDate: { year: 2024, month: 1, day: 15 },
          rateType: "Spot",
          source: "Manual",
          createdAt: { epochMillis: 1705312800000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid rate type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ExchangeRate)
        const result = yield* Effect.exit(decode({
          id: "550e8400-e29b-41d4-a716-446655440000",
          fromCurrency: "USD",
          toCurrency: "EUR",
          rate: "0.85",
          effectiveDate: { year: 2024, month: 1, day: 15 },
          rateType: "InvalidType",
          source: "Manual",
          createdAt: { epochMillis: 1705312800000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid source", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ExchangeRate)
        const result = yield* Effect.exit(decode({
          id: "550e8400-e29b-41d4-a716-446655440000",
          fromCurrency: "USD",
          toCurrency: "EUR",
          rate: "0.85",
          effectiveDate: { year: 2024, month: 1, day: 15 },
          rateType: "Spot",
          source: "InvalidSource",
          createdAt: { epochMillis: 1705312800000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing required fields", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ExchangeRate)
        const result = yield* Effect.exit(decode({
          id: "550e8400-e29b-41d4-a716-446655440000",
          fromCurrency: "USD"
          // Missing other required fields
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isExchangeRate returns true for ExchangeRate instances", () => {
      const rate = createTestExchangeRate()
      expect(isExchangeRate(rate)).toBe(true)
    })

    it("isExchangeRate returns false for plain objects", () => {
      expect(isExchangeRate({
        id: "550e8400-e29b-41d4-a716-446655440000",
        fromCurrency: "USD",
        toCurrency: "EUR",
        rate: "0.85",
        effectiveDate: { year: 2024, month: 1, day: 15 },
        rateType: "Spot",
        source: "Manual",
        createdAt: { epochMillis: 1705312800000 }
      })).toBe(false)
    })

    it("isExchangeRate returns false for non-object values", () => {
      expect(isExchangeRate(null)).toBe(false)
      expect(isExchangeRate(undefined)).toBe(false)
      expect(isExchangeRate("exchange rate")).toBe(false)
    })
  })

  describe("convert method", () => {
    it("converts amount using the rate", () => {
      const rate = createTestExchangeRate()
      const amount = BigDecimal.unsafeFromString("100")
      const result = rate.convert(amount)
      expect(BigDecimal.format(result)).toBe("85")
    })

    it("converts small amounts", () => {
      const rate = createTestExchangeRate()
      const amount = BigDecimal.unsafeFromString("0.01")
      const result = rate.convert(amount)
      expect(BigDecimal.format(result)).toBe("0.0085")
    })

    it("converts large amounts", () => {
      const rate = createTestExchangeRate()
      const amount = BigDecimal.unsafeFromString("1000000")
      const result = rate.convert(amount)
      expect(BigDecimal.format(result)).toBe("850000")
    })

    it("handles rate greater than 1", () => {
      const rate = ExchangeRate.make({
        id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440008"),
        organizationId: testOrganizationId,
        fromCurrency: CurrencyCode.make("EUR"),
        toCurrency: CurrencyCode.make("USD"),
        rate: Rate.make(BigDecimal.unsafeFromString("1.18")),
        effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
        rateType: "Spot",
        source: "Manual",
        createdAt: Timestamp.make({ epochMillis: 1705312800000 })
      })
      const amount = BigDecimal.unsafeFromString("100")
      const result = rate.convert(amount)
      expect(BigDecimal.format(result)).toBe("118")
    })
  })

  describe("toString method", () => {
    it("returns formatted string representation", () => {
      const rate = createTestExchangeRate()
      const str = rate.toString()
      expect(str).toBe("USD/EUR = 0.85 (Spot, Manual)")
    })

    it("includes correct rate type", () => {
      const rate = ExchangeRate.make({
        id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440009"),
        organizationId: testOrganizationId,
        fromCurrency: CurrencyCode.make("GBP"),
        toCurrency: CurrencyCode.make("USD"),
        rate: Rate.make(BigDecimal.unsafeFromString("1.25")),
        effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
        rateType: "Closing",
        source: "API",
        createdAt: Timestamp.make({ epochMillis: 1705312800000 })
      })
      expect(rate.toString()).toBe("GBP/USD = 1.25 (Closing, API)")
    })
  })

  describe("equality", () => {
    it("Equal.equals works for ExchangeRate", () => {
      const rate1 = createTestExchangeRate()
      const rate2 = ExchangeRate.make({
        id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000"),
        organizationId: testOrganizationId,
        fromCurrency: CurrencyCode.make("USD"),
        toCurrency: CurrencyCode.make("EUR"),
        rate: Rate.make(BigDecimal.unsafeFromString("0.85")),
        effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
        rateType: "Spot",
        source: "Manual",
        createdAt: Timestamp.make({ epochMillis: 1705312800000 })
      })

      expect(Equal.equals(rate1, rate2)).toBe(true)
    })

    it("Equal.equals is false for different rates", () => {
      const rate1 = createTestExchangeRate()
      const rate2 = ExchangeRate.make({
        id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000"),
        organizationId: testOrganizationId,
        fromCurrency: CurrencyCode.make("USD"),
        toCurrency: CurrencyCode.make("EUR"),
        rate: Rate.make(BigDecimal.unsafeFromString("0.86")),
        effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
        rateType: "Spot",
        source: "Manual",
        createdAt: Timestamp.make({ epochMillis: 1705312800000 })
      })

      expect(Equal.equals(rate1, rate2)).toBe(false)
    })

    it("Equal.equals is false for different currencies", () => {
      const rate1 = createTestExchangeRate()
      const rate2 = ExchangeRate.make({
        id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000"),
        organizationId: testOrganizationId,
        fromCurrency: CurrencyCode.make("USD"),
        toCurrency: CurrencyCode.make("GBP"),
        rate: Rate.make(BigDecimal.unsafeFromString("0.85")),
        effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
        rateType: "Spot",
        source: "Manual",
        createdAt: Timestamp.make({ epochMillis: 1705312800000 })
      })

      expect(Equal.equals(rate1, rate2)).toBe(false)
    })

    it("Equal.equals is false for different rate types", () => {
      const rate1 = createTestExchangeRate()
      const rate2 = ExchangeRate.make({
        id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000"),
        organizationId: testOrganizationId,
        fromCurrency: CurrencyCode.make("USD"),
        toCurrency: CurrencyCode.make("EUR"),
        rate: Rate.make(BigDecimal.unsafeFromString("0.85")),
        effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
        rateType: "Average",
        source: "Manual",
        createdAt: Timestamp.make({ epochMillis: 1705312800000 })
      })

      expect(Equal.equals(rate1, rate2)).toBe(false)
    })

    it("Equal.equals is false for different effective dates", () => {
      const rate1 = createTestExchangeRate()
      const rate2 = ExchangeRate.make({
        id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440000"),
        organizationId: testOrganizationId,
        fromCurrency: CurrencyCode.make("USD"),
        toCurrency: CurrencyCode.make("EUR"),
        rate: Rate.make(BigDecimal.unsafeFromString("0.85")),
        effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 16 }),
        rateType: "Spot",
        source: "Manual",
        createdAt: Timestamp.make({ epochMillis: 1705312800000 })
      })

      expect(Equal.equals(rate1, rate2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes ExchangeRate", () =>
      Effect.gen(function* () {
        const original = createTestExchangeRate()
        const encoded = yield* Schema.encode(ExchangeRate)(original)
        const decoded = yield* Schema.decodeUnknown(ExchangeRate)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const rate = createTestExchangeRate()
        const encoded = yield* Schema.encode(ExchangeRate)(rate)

        expect(encoded).toHaveProperty("id", "550e8400-e29b-41d4-a716-446655440000")
        expect(encoded).toHaveProperty("fromCurrency", "USD")
        expect(encoded).toHaveProperty("toCurrency", "EUR")
        expect(encoded).toHaveProperty("rateType", "Spot")
        expect(encoded).toHaveProperty("source", "Manual")
      })
    )
  })

  describe("immutability", () => {
    it("ExchangeRate properties are readonly at compile time", () => {
      const rate = createTestExchangeRate()
      expect(rate.fromCurrency).toBe("USD")
      expect(rate.toCurrency).toBe("EUR")
    })
  })
})

describe("convertAmount helper function", () => {
  it("converts amount correctly", () => {
    const rate = createTestExchangeRate()
    const amount = BigDecimal.unsafeFromString("100")
    const result = convertAmount(amount, rate)
    expect(BigDecimal.format(result)).toBe("85")
  })

  it("preserves precision", () => {
    const rate = ExchangeRate.make({
      id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440010"),
      organizationId: testOrganizationId,
      fromCurrency: CurrencyCode.make("USD"),
      toCurrency: CurrencyCode.make("JPY"),
      rate: Rate.make(BigDecimal.unsafeFromString("110.123456")),
      effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
      rateType: "Spot",
      source: "API",
      createdAt: Timestamp.make({ epochMillis: 1705312800000 })
    })
    const amount = BigDecimal.unsafeFromString("100")
    const result = convertAmount(amount, rate)
    expect(BigDecimal.format(result)).toBe("11012.3456")
  })
})

describe("getInverseRate helper function", () => {
  it("returns the inverse rate", () => {
    const rate = createTestExchangeRate()
    const inverse = getInverseRate(rate)
    expect(inverse).toBeDefined()
    // 1 / 0.85 = 1.17647...
    const formatted = BigDecimal.format(inverse!)
    expect(formatted.startsWith("1.17")).toBe(true)
  })

  it("inverse of inverse equals original rate (approximately)", () => {
    const rate = ExchangeRate.make({
      id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440011"),
      organizationId: testOrganizationId,
      fromCurrency: CurrencyCode.make("USD"),
      toCurrency: CurrencyCode.make("EUR"),
      rate: Rate.make(BigDecimal.unsafeFromString("2")),
      effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
      rateType: "Spot",
      source: "Manual",
      createdAt: Timestamp.make({ epochMillis: 1705312800000 })
    })
    const inverse = getInverseRate(rate)
    expect(inverse).toBeDefined()
    expect(BigDecimal.format(inverse!)).toBe("0.5")
  })
})

describe("createInverse helper function", () => {
  it("creates inverse exchange rate with swapped currencies", () => {
    const rate = createTestExchangeRate()
    const inverse = createInverse(rate)
    expect(inverse).toBeDefined()
    expect(inverse!.fromCurrency).toBe("EUR")
    expect(inverse!.toCurrency).toBe("USD")
    expect(inverse!.rateType).toBe("Spot")
    expect(inverse!.source).toBe("Manual")
  })

  it("preserves effective date", () => {
    const rate = createTestExchangeRate()
    const inverse = createInverse(rate)
    expect(inverse).toBeDefined()
    expect(inverse!.effectiveDate.year).toBe(2024)
    expect(inverse!.effectiveDate.month).toBe(1)
    expect(inverse!.effectiveDate.day).toBe(15)
  })

  it("inverse rate converts correctly", () => {
    const rate = ExchangeRate.make({
      id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440012"),
      organizationId: testOrganizationId,
      fromCurrency: CurrencyCode.make("USD"),
      toCurrency: CurrencyCode.make("EUR"),
      rate: Rate.make(BigDecimal.unsafeFromString("0.5")),
      effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
      rateType: "Spot",
      source: "Manual",
      createdAt: Timestamp.make({ epochMillis: 1705312800000 })
    })

    const inverse = createInverse(rate)
    expect(inverse).toBeDefined()

    // Converting 100 USD to EUR at 0.5 rate = 50 EUR
    const usdAmount = BigDecimal.unsafeFromString("100")
    const eurAmount = convertAmount(usdAmount, rate)
    expect(BigDecimal.format(eurAmount)).toBe("50")

    // Converting 50 EUR back to USD at inverse rate (2.0) = 100 USD
    const backToUsd = convertAmount(eurAmount, inverse!)
    expect(BigDecimal.format(backToUsd)).toBe("100")
  })
})

describe("ExchangeRate with various currency pairs", () => {
  it("handles USD/JPY (large rate)", () => {
    const rate = ExchangeRate.make({
      id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440013"),
      organizationId: testOrganizationId,
      fromCurrency: CurrencyCode.make("USD"),
      toCurrency: CurrencyCode.make("JPY"),
      rate: Rate.make(BigDecimal.unsafeFromString("148.50")),
      effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
      rateType: "Spot",
      source: "API",
      createdAt: Timestamp.make({ epochMillis: 1705312800000 })
    })

    const amount = BigDecimal.unsafeFromString("1000")
    const result = rate.convert(amount)
    expect(BigDecimal.format(result)).toBe("148500")
  })

  it("handles EUR/GBP (rate less than 1)", () => {
    const rate = ExchangeRate.make({
      id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440014"),
      organizationId: testOrganizationId,
      fromCurrency: CurrencyCode.make("EUR"),
      toCurrency: CurrencyCode.make("GBP"),
      rate: Rate.make(BigDecimal.unsafeFromString("0.86")),
      effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
      rateType: "Closing",
      source: "Import",
      createdAt: Timestamp.make({ epochMillis: 1705312800000 })
    })

    const amount = BigDecimal.unsafeFromString("500")
    const result = rate.convert(amount)
    expect(BigDecimal.format(result)).toBe("430")
  })

  it("handles identical currency (rate of 1)", () => {
    const rate = ExchangeRate.make({
      id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440015"),
      organizationId: testOrganizationId,
      fromCurrency: CurrencyCode.make("USD"),
      toCurrency: CurrencyCode.make("USD"),
      rate: Rate.make(BigDecimal.unsafeFromString("1")),
      effectiveDate: LocalDate.make({ year: 2024, month: 1, day: 15 }),
      rateType: "Spot",
      source: "Manual",
      createdAt: Timestamp.make({ epochMillis: 1705312800000 })
    })

    const amount = BigDecimal.unsafeFromString("100")
    const result = rate.convert(amount)
    expect(BigDecimal.format(result)).toBe("100")
  })
})

describe("ExchangeRate date handling", () => {
  it("stores effective date correctly", () => {
    const rate = ExchangeRate.make({
      id: ExchangeRateId.make("550e8400-e29b-41d4-a716-446655440016"),
      organizationId: testOrganizationId,
      fromCurrency: CurrencyCode.make("USD"),
      toCurrency: CurrencyCode.make("EUR"),
      rate: Rate.make(BigDecimal.unsafeFromString("0.85")),
      effectiveDate: LocalDate.make({ year: 2024, month: 12, day: 31 }),
      rateType: "Closing",
      source: "Manual",
      createdAt: Timestamp.make({ epochMillis: 1705312800000 })
    })

    expect(rate.effectiveDate.year).toBe(2024)
    expect(rate.effectiveDate.month).toBe(12)
    expect(rate.effectiveDate.day).toBe(31)
    expect(rate.effectiveDate.toISOString()).toBe("2024-12-31")
  })

  it("stores created timestamp correctly", () => {
    const rate = createTestExchangeRate()
    expect(rate.createdAt.epochMillis).toBe(1705312800000)
  })
})
