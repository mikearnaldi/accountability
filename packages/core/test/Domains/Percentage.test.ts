import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import {
  Percentage,
  isPercentage,
  ZERO,
  TWENTY,
  FIFTY,
  HUNDRED,
  toDecimal,
  fromDecimal,
  isZero,
  isFull,
  complement,
  format
} from "../../src/shared/values/Percentage.ts"

describe("Percentage", () => {
  describe("validation", () => {
    it.effect("accepts valid percentage values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Percentage)

        const zero = yield* decode(0)
        expect(zero).toBe(0)

        const fifty = yield* decode(50)
        expect(fifty).toBe(50)

        const hundred = yield* decode(100)
        expect(hundred).toBe(100)
      })
    )

    it.effect("accepts decimal percentage values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Percentage)

        const decimal1 = yield* decode(12.5)
        expect(decimal1).toBe(12.5)

        const decimal2 = yield* decode(99.99)
        expect(decimal2).toBe(99.99)

        const decimal3 = yield* decode(0.01)
        expect(decimal3).toBe(0.01)
      })
    )

    it.effect("rejects negative values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Percentage)
        const result = yield* Effect.exit(decode(-1))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects values greater than 100", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Percentage)
        const result = yield* Effect.exit(decode(100.01))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects large negative values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Percentage)
        const result = yield* Effect.exit(decode(-50))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects large positive values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Percentage)
        const result = yield* Effect.exit(decode(150))

        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isPercentage returns true for valid percentages", () => {
      expect(isPercentage(0)).toBe(true)
      expect(isPercentage(50)).toBe(true)
      expect(isPercentage(100)).toBe(true)
      expect(isPercentage(12.5)).toBe(true)
      expect(isPercentage(99.99)).toBe(true)
    })

    it("isPercentage returns false for invalid percentages", () => {
      expect(isPercentage(-1)).toBe(false)
      expect(isPercentage(101)).toBe(false)
      expect(isPercentage("50")).toBe(false)
      expect(isPercentage(null)).toBe(false)
      expect(isPercentage(undefined)).toBe(false)
    })
  })

  describe("make constructor", () => {
    it("creates Percentage without validation", () => {
      const pct = Percentage.make(50)
      expect(pct).toBe(50)
    })
  })

  describe("predefined percentages", () => {
    it("ZERO is 0", () => {
      expect(ZERO).toBe(0)
      expect(isPercentage(ZERO)).toBe(true)
    })

    it("TWENTY is 20", () => {
      expect(TWENTY).toBe(20)
      expect(isPercentage(TWENTY)).toBe(true)
    })

    it("FIFTY is 50", () => {
      expect(FIFTY).toBe(50)
      expect(isPercentage(FIFTY)).toBe(true)
    })

    it("HUNDRED is 100", () => {
      expect(HUNDRED).toBe(100)
      expect(isPercentage(HUNDRED)).toBe(true)
    })
  })

  describe("toDecimal", () => {
    it("converts percentage to decimal", () => {
      expect(toDecimal(Percentage.make(0))).toBe(0)
      expect(toDecimal(Percentage.make(50))).toBe(0.5)
      expect(toDecimal(Percentage.make(100))).toBe(1)
      expect(toDecimal(Percentage.make(25))).toBe(0.25)
      expect(toDecimal(Percentage.make(12.5))).toBe(0.125)
    })
  })

  describe("fromDecimal", () => {
    it("converts decimal to percentage", () => {
      expect(fromDecimal(0)).toBe(0)
      expect(fromDecimal(0.5)).toBe(50)
      expect(fromDecimal(1)).toBe(100)
      expect(fromDecimal(0.25)).toBe(25)
      expect(fromDecimal(0.125)).toBe(12.5)
    })
  })

  describe("isZero", () => {
    it("returns true for zero", () => {
      expect(isZero(Percentage.make(0))).toBe(true)
    })

    it("returns false for non-zero", () => {
      expect(isZero(Percentage.make(1))).toBe(false)
      expect(isZero(Percentage.make(50))).toBe(false)
      expect(isZero(Percentage.make(100))).toBe(false)
    })
  })

  describe("isFull", () => {
    it("returns true for 100%", () => {
      expect(isFull(Percentage.make(100))).toBe(true)
    })

    it("returns false for non-100%", () => {
      expect(isFull(Percentage.make(0))).toBe(false)
      expect(isFull(Percentage.make(50))).toBe(false)
      expect(isFull(Percentage.make(99.99))).toBe(false)
    })
  })

  describe("complement", () => {
    it("calculates complement correctly", () => {
      expect(complement(Percentage.make(0))).toBe(100)
      expect(complement(Percentage.make(30))).toBe(70)
      expect(complement(Percentage.make(50))).toBe(50)
      expect(complement(Percentage.make(100))).toBe(0)
      expect(complement(Percentage.make(25))).toBe(75)
    })
  })

  describe("format", () => {
    it("formats percentage with default decimal places", () => {
      expect(format(Percentage.make(50))).toBe("50.00%")
      expect(format(Percentage.make(12.5))).toBe("12.50%")
      expect(format(Percentage.make(99.99))).toBe("99.99%")
    })

    it("formats percentage with custom decimal places", () => {
      expect(format(Percentage.make(50), 0)).toBe("50%")
      expect(format(Percentage.make(12.5), 1)).toBe("12.5%")
      expect(format(Percentage.make(33.333), 3)).toBe("33.333%")
    })
  })

  describe("encoding", () => {
    it.effect("encodes Percentage back to number", () =>
      Effect.gen(function* () {
        const encode = Schema.encodeSync(Percentage)
        const decode = Schema.decodeUnknownSync(Percentage)

        const pct = decode(50)
        const encoded = encode(pct)

        expect(encoded).toBe(50)
      })
    )
  })
})
