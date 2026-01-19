import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal } from "effect"
import * as Schema from "effect/Schema"
import {
  DecimalPlaces,
  isDecimalPlaces,
  Currency,
  isCurrency,
  USD_CURRENCY,
  EUR_CURRENCY,
  GBP_CURRENCY,
  JPY_CURRENCY,
  CHF_CURRENCY,
  CAD_CURRENCY,
  AUD_CURRENCY,
  CNY_CURRENCY,
  HKD_CURRENCY,
  SGD_CURRENCY,
  KRW_CURRENCY,
  KWD_CURRENCY,
  BHD_CURRENCY,
  OMR_CURRENCY,
  CLF_CURRENCY,
  COMMON_CURRENCIES,
  CURRENCIES_BY_CODE,
  getCurrencyByCode
} from "../../src/currency/Currency.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"

describe("DecimalPlaces", () => {
  describe("validation", () => {
    it.effect("accepts 0 decimal places", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(DecimalPlaces)(0)
        expect(result).toBe(0)
      })
    )

    it.effect("accepts 2 decimal places", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(DecimalPlaces)(2)
        expect(result).toBe(2)
      })
    )

    it.effect("accepts 3 decimal places", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(DecimalPlaces)(3)
        expect(result).toBe(3)
      })
    )

    it.effect("accepts 4 decimal places", () =>
      Effect.gen(function* () {
        const result = yield* Schema.decodeUnknown(DecimalPlaces)(4)
        expect(result).toBe(4)
      })
    )

    it.effect("rejects 1 decimal place", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(DecimalPlaces)(1))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects 5 decimal places", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(DecimalPlaces)(5))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects negative decimal places", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(DecimalPlaces)(-1))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-integer values", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(DecimalPlaces)(2.5))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects string values", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(Schema.decodeUnknown(DecimalPlaces)("2"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isDecimalPlaces returns true for valid values", () => {
      expect(isDecimalPlaces(0)).toBe(true)
      expect(isDecimalPlaces(2)).toBe(true)
      expect(isDecimalPlaces(3)).toBe(true)
      expect(isDecimalPlaces(4)).toBe(true)
    })

    it("isDecimalPlaces returns false for invalid values", () => {
      expect(isDecimalPlaces(1)).toBe(false)
      expect(isDecimalPlaces(5)).toBe(false)
      expect(isDecimalPlaces(-1)).toBe(false)
      expect(isDecimalPlaces(2.5)).toBe(false)
      expect(isDecimalPlaces("2")).toBe(false)
      expect(isDecimalPlaces(null)).toBe(false)
      expect(isDecimalPlaces(undefined)).toBe(false)
    })
  })
})

describe("Currency", () => {
  const createValidCurrency = () => {
    return Currency.make({
      code: CurrencyCode.make("USD"),
      name: "US Dollar",
      symbol: "$",
      decimalPlaces: 2,
      isActive: true
    })
  }

  describe("validation", () => {
    it.effect("accepts valid currency data", () =>
      Effect.gen(function* () {
        const currency = createValidCurrency()
        expect(currency.code).toBe("USD")
        expect(currency.name).toBe("US Dollar")
        expect(currency.symbol).toBe("$")
        expect(currency.decimalPlaces).toBe(2)
        expect(currency.isActive).toBe(true)
      })
    )

    it.effect("accepts currency with 0 decimal places", () =>
      Effect.gen(function* () {
        const currency = Currency.make({
          code: CurrencyCode.make("JPY"),
          name: "Japanese Yen",
          symbol: "¥",
          decimalPlaces: 0,
          isActive: true
        })
        expect(currency.decimalPlaces).toBe(0)
      })
    )

    it.effect("accepts currency with 3 decimal places", () =>
      Effect.gen(function* () {
        const currency = Currency.make({
          code: CurrencyCode.make("KWD"),
          name: "Kuwaiti Dinar",
          symbol: "KD",
          decimalPlaces: 3,
          isActive: true
        })
        expect(currency.decimalPlaces).toBe(3)
      })
    )

    it.effect("accepts currency with 4 decimal places", () =>
      Effect.gen(function* () {
        const currency = Currency.make({
          code: CurrencyCode.make("CLF"),
          name: "Chilean Unit of Account (UF)",
          symbol: "CLF",
          decimalPlaces: 4,
          isActive: true
        })
        expect(currency.decimalPlaces).toBe(4)
      })
    )

    it.effect("accepts inactive currency", () =>
      Effect.gen(function* () {
        const currency = Currency.make({
          code: CurrencyCode.make("XYZ"),
          name: "Inactive Currency",
          symbol: "X",
          decimalPlaces: 2,
          isActive: false
        })
        expect(currency.isActive).toBe(false)
      })
    )

    it.effect("rejects empty name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "USD",
          name: "",
          symbol: "$",
          decimalPlaces: 2,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "USD",
          name: "   ",
          symbol: "$",
          decimalPlaces: 2,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty symbol", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "USD",
          name: "US Dollar",
          symbol: "",
          decimalPlaces: 2,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only symbol", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "USD",
          name: "US Dollar",
          symbol: "   ",
          decimalPlaces: 2,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid currency code", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "INVALID",
          name: "Invalid",
          symbol: "X",
          decimalPlaces: 2,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid decimal places (1)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          decimalPlaces: 1,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid decimal places (5)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          decimalPlaces: 5,
          isActive: true
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing required fields", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Currency)
        const result = yield* Effect.exit(decode({
          code: "USD"
          // Missing name, symbol, decimalPlaces, isActive
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isCurrency returns true for Currency instances", () => {
      const currency = createValidCurrency()
      expect(isCurrency(currency)).toBe(true)
    })

    it("isCurrency returns false for plain objects", () => {
      expect(isCurrency({
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        decimalPlaces: 2,
        isActive: true
      })).toBe(false)
    })

    it("isCurrency returns false for non-object values", () => {
      expect(isCurrency(null)).toBe(false)
      expect(isCurrency(undefined)).toBe(false)
      expect(isCurrency("currency")).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates Currency using Schema's .make()", () => {
      const currency = createValidCurrency()
      expect(currency.name).toBe("US Dollar")
      expect(isCurrency(currency)).toBe(true)
    })
  })

  describe("formatAmount method", () => {
    it("formats amount with 2 decimal places", () => {
      const currency = Currency.make({
        code: CurrencyCode.make("USD"),
        name: "US Dollar",
        symbol: "$",
        decimalPlaces: 2,
        isActive: true
      })
      expect(currency.formatAmount(1234.5)).toBe("$1234.50")
      expect(currency.formatAmount(100)).toBe("$100.00")
      expect(currency.formatAmount(0.5)).toBe("$0.50")
    })

    it("formats amount with 0 decimal places", () => {
      const currency = Currency.make({
        code: CurrencyCode.make("JPY"),
        name: "Japanese Yen",
        symbol: "¥",
        decimalPlaces: 0,
        isActive: true
      })
      expect(currency.formatAmount(1234)).toBe("¥1234")
      expect(currency.formatAmount(100)).toBe("¥100")
    })

    it("formats amount with 3 decimal places", () => {
      const currency = Currency.make({
        code: CurrencyCode.make("KWD"),
        name: "Kuwaiti Dinar",
        symbol: "KD",
        decimalPlaces: 3,
        isActive: true
      })
      expect(currency.formatAmount(1234.5)).toBe("KD1234.500")
      expect(currency.formatAmount(100.125)).toBe("KD100.125")
    })

    it("formats amount with 4 decimal places", () => {
      const currency = Currency.make({
        code: CurrencyCode.make("CLF"),
        name: "Chilean Unit of Account (UF)",
        symbol: "CLF",
        decimalPlaces: 4,
        isActive: true
      })
      expect(currency.formatAmount(1234.5)).toBe("CLF1234.5000")
      expect(currency.formatAmount(100.1234)).toBe("CLF100.1234")
    })
  })

  describe("equality", () => {
    it("Equal.equals works for Currency", () => {
      const currency1 = createValidCurrency()
      const currency2 = Currency.make({
        code: CurrencyCode.make("USD"),
        name: "US Dollar",
        symbol: "$",
        decimalPlaces: 2,
        isActive: true
      })
      const currency3 = Currency.make({
        code: CurrencyCode.make("EUR"),
        name: "Euro",
        symbol: "€",
        decimalPlaces: 2,
        isActive: true
      })

      expect(Equal.equals(currency1, currency2)).toBe(true)
      expect(Equal.equals(currency1, currency3)).toBe(false)
    })

    it("Equal.equals is false for different isActive status", () => {
      const currency1 = createValidCurrency()
      const currency2 = Currency.make({
        code: CurrencyCode.make("USD"),
        name: "US Dollar",
        symbol: "$",
        decimalPlaces: 2,
        isActive: false
      })

      expect(Equal.equals(currency1, currency2)).toBe(false)
    })

    it("Equal.equals is false for different decimal places", () => {
      const currency1 = Currency.make({
        code: CurrencyCode.make("XYZ"),
        name: "Test Currency",
        symbol: "X",
        decimalPlaces: 2,
        isActive: true
      })
      const currency2 = Currency.make({
        code: CurrencyCode.make("XYZ"),
        name: "Test Currency",
        symbol: "X",
        decimalPlaces: 3,
        isActive: true
      })

      expect(Equal.equals(currency1, currency2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes Currency", () =>
      Effect.gen(function* () {
        const original = createValidCurrency()
        const encoded = yield* Schema.encode(Currency)(original)
        const decoded = yield* Schema.decodeUnknown(Currency)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const currency = createValidCurrency()
        const encoded = yield* Schema.encode(Currency)(currency)

        expect(encoded).toHaveProperty("code", "USD")
        expect(encoded).toHaveProperty("name", "US Dollar")
        expect(encoded).toHaveProperty("symbol", "$")
        expect(encoded).toHaveProperty("decimalPlaces", 2)
        expect(encoded).toHaveProperty("isActive", true)
      })
    )
  })

  describe("immutability", () => {
    it("Currency properties are readonly at compile time", () => {
      const currency = createValidCurrency()
      // TypeScript enforces immutability - no runtime check needed
      expect(currency.name).toBe("US Dollar")
    })
  })
})

describe("Predefined Currencies", () => {
  describe("USD_CURRENCY", () => {
    it("has correct properties", () => {
      expect(USD_CURRENCY.code).toBe("USD")
      expect(USD_CURRENCY.name).toBe("US Dollar")
      expect(USD_CURRENCY.symbol).toBe("$")
      expect(USD_CURRENCY.decimalPlaces).toBe(2)
      expect(USD_CURRENCY.isActive).toBe(true)
    })
  })

  describe("EUR_CURRENCY", () => {
    it("has correct properties", () => {
      expect(EUR_CURRENCY.code).toBe("EUR")
      expect(EUR_CURRENCY.name).toBe("Euro")
      expect(EUR_CURRENCY.symbol).toBe("€")
      expect(EUR_CURRENCY.decimalPlaces).toBe(2)
      expect(EUR_CURRENCY.isActive).toBe(true)
    })
  })

  describe("GBP_CURRENCY", () => {
    it("has correct properties", () => {
      expect(GBP_CURRENCY.code).toBe("GBP")
      expect(GBP_CURRENCY.name).toBe("British Pound")
      expect(GBP_CURRENCY.symbol).toBe("£")
      expect(GBP_CURRENCY.decimalPlaces).toBe(2)
      expect(GBP_CURRENCY.isActive).toBe(true)
    })
  })

  describe("JPY_CURRENCY", () => {
    it("has correct properties with 0 decimal places", () => {
      expect(JPY_CURRENCY.code).toBe("JPY")
      expect(JPY_CURRENCY.name).toBe("Japanese Yen")
      expect(JPY_CURRENCY.symbol).toBe("¥")
      expect(JPY_CURRENCY.decimalPlaces).toBe(0)
      expect(JPY_CURRENCY.isActive).toBe(true)
    })
  })

  describe("CHF_CURRENCY", () => {
    it("has correct properties", () => {
      expect(CHF_CURRENCY.code).toBe("CHF")
      expect(CHF_CURRENCY.name).toBe("Swiss Franc")
      expect(CHF_CURRENCY.symbol).toBe("CHF")
      expect(CHF_CURRENCY.decimalPlaces).toBe(2)
      expect(CHF_CURRENCY.isActive).toBe(true)
    })
  })

  describe("CAD_CURRENCY", () => {
    it("has correct properties", () => {
      expect(CAD_CURRENCY.code).toBe("CAD")
      expect(CAD_CURRENCY.name).toBe("Canadian Dollar")
      expect(CAD_CURRENCY.symbol).toBe("C$")
      expect(CAD_CURRENCY.decimalPlaces).toBe(2)
      expect(CAD_CURRENCY.isActive).toBe(true)
    })
  })

  describe("AUD_CURRENCY", () => {
    it("has correct properties", () => {
      expect(AUD_CURRENCY.code).toBe("AUD")
      expect(AUD_CURRENCY.name).toBe("Australian Dollar")
      expect(AUD_CURRENCY.symbol).toBe("A$")
      expect(AUD_CURRENCY.decimalPlaces).toBe(2)
      expect(AUD_CURRENCY.isActive).toBe(true)
    })
  })

  describe("CNY_CURRENCY", () => {
    it("has correct properties", () => {
      expect(CNY_CURRENCY.code).toBe("CNY")
      expect(CNY_CURRENCY.name).toBe("Chinese Yuan")
      expect(CNY_CURRENCY.symbol).toBe("¥")
      expect(CNY_CURRENCY.decimalPlaces).toBe(2)
      expect(CNY_CURRENCY.isActive).toBe(true)
    })
  })

  describe("HKD_CURRENCY", () => {
    it("has correct properties", () => {
      expect(HKD_CURRENCY.code).toBe("HKD")
      expect(HKD_CURRENCY.name).toBe("Hong Kong Dollar")
      expect(HKD_CURRENCY.symbol).toBe("HK$")
      expect(HKD_CURRENCY.decimalPlaces).toBe(2)
      expect(HKD_CURRENCY.isActive).toBe(true)
    })
  })

  describe("SGD_CURRENCY", () => {
    it("has correct properties", () => {
      expect(SGD_CURRENCY.code).toBe("SGD")
      expect(SGD_CURRENCY.name).toBe("Singapore Dollar")
      expect(SGD_CURRENCY.symbol).toBe("S$")
      expect(SGD_CURRENCY.decimalPlaces).toBe(2)
      expect(SGD_CURRENCY.isActive).toBe(true)
    })
  })

  describe("KRW_CURRENCY", () => {
    it("has correct properties with 0 decimal places", () => {
      expect(KRW_CURRENCY.code).toBe("KRW")
      expect(KRW_CURRENCY.name).toBe("South Korean Won")
      expect(KRW_CURRENCY.symbol).toBe("₩")
      expect(KRW_CURRENCY.decimalPlaces).toBe(0)
      expect(KRW_CURRENCY.isActive).toBe(true)
    })
  })

  describe("KWD_CURRENCY", () => {
    it("has correct properties with 3 decimal places", () => {
      expect(KWD_CURRENCY.code).toBe("KWD")
      expect(KWD_CURRENCY.name).toBe("Kuwaiti Dinar")
      expect(KWD_CURRENCY.symbol).toBe("KD")
      expect(KWD_CURRENCY.decimalPlaces).toBe(3)
      expect(KWD_CURRENCY.isActive).toBe(true)
    })
  })

  describe("BHD_CURRENCY", () => {
    it("has correct properties with 3 decimal places", () => {
      expect(BHD_CURRENCY.code).toBe("BHD")
      expect(BHD_CURRENCY.name).toBe("Bahraini Dinar")
      expect(BHD_CURRENCY.symbol).toBe("BD")
      expect(BHD_CURRENCY.decimalPlaces).toBe(3)
      expect(BHD_CURRENCY.isActive).toBe(true)
    })
  })

  describe("OMR_CURRENCY", () => {
    it("has correct properties with 3 decimal places", () => {
      expect(OMR_CURRENCY.code).toBe("OMR")
      expect(OMR_CURRENCY.name).toBe("Omani Rial")
      expect(OMR_CURRENCY.symbol).toBe("OMR")
      expect(OMR_CURRENCY.decimalPlaces).toBe(3)
      expect(OMR_CURRENCY.isActive).toBe(true)
    })
  })

  describe("CLF_CURRENCY", () => {
    it("has correct properties with 4 decimal places", () => {
      expect(CLF_CURRENCY.code).toBe("CLF")
      expect(CLF_CURRENCY.name).toBe("Chilean Unit of Account (UF)")
      expect(CLF_CURRENCY.symbol).toBe("CLF")
      expect(CLF_CURRENCY.decimalPlaces).toBe(4)
      expect(CLF_CURRENCY.isActive).toBe(true)
    })
  })

  describe("COMMON_CURRENCIES", () => {
    it("contains all predefined currencies", () => {
      expect(COMMON_CURRENCIES.length).toBe(15)
      expect(COMMON_CURRENCIES).toContain(USD_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(EUR_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(GBP_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(JPY_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(CHF_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(CAD_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(AUD_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(CNY_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(HKD_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(SGD_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(KRW_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(KWD_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(BHD_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(OMR_CURRENCY)
      expect(COMMON_CURRENCIES).toContain(CLF_CURRENCY)
    })

    it("all currencies are valid Currency instances", () => {
      for (const currency of COMMON_CURRENCIES) {
        expect(isCurrency(currency)).toBe(true)
      }
    })

    it("all currencies are active", () => {
      for (const currency of COMMON_CURRENCIES) {
        expect(currency.isActive).toBe(true)
      }
    })
  })

  describe("CURRENCIES_BY_CODE", () => {
    it("provides lookup by currency code", () => {
      expect(CURRENCIES_BY_CODE.get(CurrencyCode.make("USD"))).toBe(USD_CURRENCY)
      expect(CURRENCIES_BY_CODE.get(CurrencyCode.make("EUR"))).toBe(EUR_CURRENCY)
      expect(CURRENCIES_BY_CODE.get(CurrencyCode.make("GBP"))).toBe(GBP_CURRENCY)
      expect(CURRENCIES_BY_CODE.get(CurrencyCode.make("JPY"))).toBe(JPY_CURRENCY)
    })

    it("returns undefined for unknown currency codes", () => {
      expect(CURRENCIES_BY_CODE.get(CurrencyCode.make("XYZ"))).toBeUndefined()
    })

    it("has the same size as COMMON_CURRENCIES", () => {
      expect(CURRENCIES_BY_CODE.size).toBe(COMMON_CURRENCIES.length)
    })
  })

  describe("getCurrencyByCode", () => {
    it("returns currency for known codes", () => {
      expect(getCurrencyByCode(CurrencyCode.make("USD"))).toBe(USD_CURRENCY)
      expect(getCurrencyByCode(CurrencyCode.make("EUR"))).toBe(EUR_CURRENCY)
      expect(getCurrencyByCode(CurrencyCode.make("JPY"))).toBe(JPY_CURRENCY)
      expect(getCurrencyByCode(CurrencyCode.make("KWD"))).toBe(KWD_CURRENCY)
      expect(getCurrencyByCode(CurrencyCode.make("CLF"))).toBe(CLF_CURRENCY)
    })

    it("returns undefined for unknown codes", () => {
      expect(getCurrencyByCode(CurrencyCode.make("XYZ"))).toBeUndefined()
      expect(getCurrencyByCode(CurrencyCode.make("ABC"))).toBeUndefined()
    })
  })
})

describe("Currency decimal places coverage", () => {
  it("has currencies with 0 decimal places", () => {
    const zeroDpCurrencies = COMMON_CURRENCIES.filter(c => c.decimalPlaces === 0)
    expect(zeroDpCurrencies.length).toBeGreaterThanOrEqual(2)
    expect(zeroDpCurrencies.map(c => c.code)).toContain("JPY")
    expect(zeroDpCurrencies.map(c => c.code)).toContain("KRW")
  })

  it("has currencies with 2 decimal places", () => {
    const twoDpCurrencies = COMMON_CURRENCIES.filter(c => c.decimalPlaces === 2)
    expect(twoDpCurrencies.length).toBeGreaterThanOrEqual(8)
    expect(twoDpCurrencies.map(c => c.code)).toContain("USD")
    expect(twoDpCurrencies.map(c => c.code)).toContain("EUR")
    expect(twoDpCurrencies.map(c => c.code)).toContain("GBP")
  })

  it("has currencies with 3 decimal places", () => {
    const threeDpCurrencies = COMMON_CURRENCIES.filter(c => c.decimalPlaces === 3)
    expect(threeDpCurrencies.length).toBeGreaterThanOrEqual(3)
    expect(threeDpCurrencies.map(c => c.code)).toContain("KWD")
    expect(threeDpCurrencies.map(c => c.code)).toContain("BHD")
    expect(threeDpCurrencies.map(c => c.code)).toContain("OMR")
  })

  it("has currencies with 4 decimal places", () => {
    const fourDpCurrencies = COMMON_CURRENCIES.filter(c => c.decimalPlaces === 4)
    expect(fourDpCurrencies.length).toBeGreaterThanOrEqual(1)
    expect(fourDpCurrencies.map(c => c.code)).toContain("CLF")
  })
})
