import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import {
  CurrencyCode,
  isCurrencyCode,
  USD,
  EUR,
  GBP,
  JPY,
  CHF,
  CAD,
  AUD,
  CNY,
  HKD,
  SGD
} from "../../src/currency/CurrencyCode.ts"

describe("CurrencyCode", () => {
  describe("validation", () => {
    it.effect("accepts valid 3-letter uppercase currency codes", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)

        const usd = yield* decode("USD")
        expect(usd).toBe("USD")

        const eur = yield* decode("EUR")
        expect(eur).toBe("EUR")

        const gbp = yield* decode("GBP")
        expect(gbp).toBe("GBP")

        const jpy = yield* decode("JPY")
        expect(jpy).toBe("JPY")
      })
    )

    it.effect("rejects lowercase currency codes", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)
        const result = yield* Effect.exit(decode("usd"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects mixed case currency codes", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)
        const result = yield* Effect.exit(decode("Usd"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes that are too short", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)
        const result = yield* Effect.exit(decode("US"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes that are too long", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)
        const result = yield* Effect.exit(decode("USDT"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes with numbers", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)
        const result = yield* Effect.exit(decode("US1"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects codes with special characters", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)
        const result = yield* Effect.exit(decode("US$"))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(CurrencyCode)
        const result = yield* Effect.exit(decode(""))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isCurrencyCode returns true for valid codes", () => {
      expect(isCurrencyCode("USD")).toBe(true)
      expect(isCurrencyCode("EUR")).toBe(true)
      expect(isCurrencyCode("GBP")).toBe(true)
      expect(isCurrencyCode("JPY")).toBe(true)
      expect(isCurrencyCode("XYZ")).toBe(true)
    })

    it("isCurrencyCode returns false for invalid codes", () => {
      expect(isCurrencyCode("usd")).toBe(false)
      expect(isCurrencyCode("US")).toBe(false)
      expect(isCurrencyCode("USDT")).toBe(false)
      expect(isCurrencyCode("US1")).toBe(false)
      expect(isCurrencyCode("")).toBe(false)
      expect(isCurrencyCode(123)).toBe(false)
      expect(isCurrencyCode(null)).toBe(false)
      expect(isCurrencyCode(undefined)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates CurrencyCode using Schema's .make()", () => {
      const code = CurrencyCode.make("USD")
      expect(code).toBe("USD")
    })
  })

  describe("predefined currencies", () => {
    it("USD is defined correctly", () => {
      expect(USD).toBe("USD")
      expect(isCurrencyCode(USD)).toBe(true)
    })

    it("EUR is defined correctly", () => {
      expect(EUR).toBe("EUR")
      expect(isCurrencyCode(EUR)).toBe(true)
    })

    it("GBP is defined correctly", () => {
      expect(GBP).toBe("GBP")
      expect(isCurrencyCode(GBP)).toBe(true)
    })

    it("JPY is defined correctly", () => {
      expect(JPY).toBe("JPY")
      expect(isCurrencyCode(JPY)).toBe(true)
    })

    it("CHF is defined correctly", () => {
      expect(CHF).toBe("CHF")
      expect(isCurrencyCode(CHF)).toBe(true)
    })

    it("CAD is defined correctly", () => {
      expect(CAD).toBe("CAD")
      expect(isCurrencyCode(CAD)).toBe(true)
    })

    it("AUD is defined correctly", () => {
      expect(AUD).toBe("AUD")
      expect(isCurrencyCode(AUD)).toBe(true)
    })

    it("CNY is defined correctly", () => {
      expect(CNY).toBe("CNY")
      expect(isCurrencyCode(CNY)).toBe(true)
    })

    it("HKD is defined correctly", () => {
      expect(HKD).toBe("HKD")
      expect(isCurrencyCode(HKD)).toBe(true)
    })

    it("SGD is defined correctly", () => {
      expect(SGD).toBe("SGD")
      expect(isCurrencyCode(SGD)).toBe(true)
    })
  })

  describe("encoding", () => {
    it.effect("encodes CurrencyCode back to string", () =>
      Effect.gen(function* () {
        const encode = Schema.encodeSync(CurrencyCode)
        const decode = Schema.decodeUnknownSync(CurrencyCode)

        const usd = decode("USD")
        const encoded = encode(usd)

        expect(encoded).toBe("USD")
      })
    )
  })
})
