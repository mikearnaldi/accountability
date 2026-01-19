import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal } from "effect"
import * as Schema from "effect/Schema"
import {
  FiscalPeriodRef,
  isFiscalPeriodRef,
  Order_,
  isBefore,
  isAfter,
  equals,
  nextPeriod,
  previousPeriod,
  startOfYear,
  endOfYear,
  adjustmentPeriod,
  allRegularPeriods,
  allPeriods,
  isWithinRange,
  periodsBetween
} from "../../src/fiscal/FiscalPeriodRef.ts"

describe("FiscalPeriodRef", () => {
  describe("validation", () => {
    it.effect("accepts valid fiscal period refs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalPeriodRef)

        const ref = yield* decode({ year: 2024, period: 6 })
        expect(ref.year).toBe(2024)
        expect(ref.period).toBe(6)
      })
    )

    it.effect("accepts period 1 through 13", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalPeriodRef)

        const p1 = yield* decode({ year: 2024, period: 1 })
        expect(p1.period).toBe(1)

        const p12 = yield* decode({ year: 2024, period: 12 })
        expect(p12.period).toBe(12)

        const p13 = yield* decode({ year: 2024, period: 13 })
        expect(p13.period).toBe(13)
      })
    )

    it.effect("rejects period 0", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalPeriodRef)
        const result = yield* Effect.exit(decode({ year: 2024, period: 0 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects period 14", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalPeriodRef)
        const result = yield* Effect.exit(decode({ year: 2024, period: 14 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects year before 1900", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalPeriodRef)
        const result = yield* Effect.exit(decode({ year: 1899, period: 1 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects year after 2999", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(FiscalPeriodRef)
        const result = yield* Effect.exit(decode({ year: 3000, period: 1 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isFiscalPeriodRef returns true for FiscalPeriodRef instances", () => {
      const ref = FiscalPeriodRef.make({ year: 2024, period: 6 })
      expect(isFiscalPeriodRef(ref)).toBe(true)
    })

    it("isFiscalPeriodRef returns false for non-FiscalPeriodRef values", () => {
      expect(isFiscalPeriodRef({ year: 2024, period: 6 })).toBe(false)
      expect(isFiscalPeriodRef("FY2024-P06")).toBe(false)
      expect(isFiscalPeriodRef(null)).toBe(false)
      expect(isFiscalPeriodRef(undefined)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates FiscalPeriodRef using Schema's .make()", () => {
      const ref = FiscalPeriodRef.make({ year: 2024, period: 6 })
      expect(ref.year).toBe(2024)
      expect(ref.period).toBe(6)
    })
  })

  describe("isRegularPeriod", () => {
    it("returns true for periods 1-12", () => {
      for (let i = 1; i <= 12; i++) {
        expect(FiscalPeriodRef.make({ year: 2024, period: i }).isRegularPeriod).toBe(true)
      }
    })

    it("returns false for period 13", () => {
      expect(FiscalPeriodRef.make({ year: 2024, period: 13 }).isRegularPeriod).toBe(false)
    })
  })

  describe("isAdjustmentPeriod", () => {
    it("returns true for period 13", () => {
      expect(FiscalPeriodRef.make({ year: 2024, period: 13 }).isAdjustmentPeriod).toBe(true)
    })

    it("returns false for periods 1-12", () => {
      for (let i = 1; i <= 12; i++) {
        expect(FiscalPeriodRef.make({ year: 2024, period: i }).isAdjustmentPeriod).toBe(false)
      }
    })
  })

  describe("toString", () => {
    it("formats as FY{year}-P{period}", () => {
      expect(FiscalPeriodRef.make({ year: 2024, period: 1 }).toString()).toBe("FY2024-P01")
      expect(FiscalPeriodRef.make({ year: 2024, period: 6 }).toString()).toBe("FY2024-P06")
      expect(FiscalPeriodRef.make({ year: 2024, period: 12 }).toString()).toBe("FY2024-P12")
      expect(FiscalPeriodRef.make({ year: 2024, period: 13 }).toString()).toBe("FY2024-P13")
    })
  })

  describe("toShortString", () => {
    it("formats as {year}.{period}", () => {
      expect(FiscalPeriodRef.make({ year: 2024, period: 1 }).toShortString()).toBe("2024.01")
      expect(FiscalPeriodRef.make({ year: 2024, period: 6 }).toShortString()).toBe("2024.06")
      expect(FiscalPeriodRef.make({ year: 2024, period: 12 }).toShortString()).toBe("2024.12")
      expect(FiscalPeriodRef.make({ year: 2024, period: 13 }).toShortString()).toBe("2024.13")
    })
  })

  describe("Order", () => {
    it("compares by year first, then period", () => {
      const ref1 = FiscalPeriodRef.make({ year: 2024, period: 6 })
      const ref2 = FiscalPeriodRef.make({ year: 2024, period: 7 })
      const ref3 = FiscalPeriodRef.make({ year: 2025, period: 1 })
      const ref4 = FiscalPeriodRef.make({ year: 2024, period: 6 })

      expect(Order_(ref1, ref2)).toBe(-1)
      expect(Order_(ref2, ref1)).toBe(1)
      expect(Order_(ref1, ref3)).toBe(-1)
      expect(Order_(ref1, ref4)).toBe(0)
    })
  })

  describe("isBefore", () => {
    it("returns true when first is before second", () => {
      expect(isBefore(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 7 }))).toBe(true)
      expect(isBefore(FiscalPeriodRef.make({ year: 2024, period: 12 }), FiscalPeriodRef.make({ year: 2025, period: 1 }))).toBe(true)
    })

    it("returns false when first is not before second", () => {
      expect(isBefore(FiscalPeriodRef.make({ year: 2024, period: 7 }), FiscalPeriodRef.make({ year: 2024, period: 6 }))).toBe(false)
      expect(isBefore(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 6 }))).toBe(false)
    })
  })

  describe("isAfter", () => {
    it("returns true when first is after second", () => {
      expect(isAfter(FiscalPeriodRef.make({ year: 2024, period: 7 }), FiscalPeriodRef.make({ year: 2024, period: 6 }))).toBe(true)
      expect(isAfter(FiscalPeriodRef.make({ year: 2025, period: 1 }), FiscalPeriodRef.make({ year: 2024, period: 12 }))).toBe(true)
    })

    it("returns false when first is not after second", () => {
      expect(isAfter(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 7 }))).toBe(false)
      expect(isAfter(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 6 }))).toBe(false)
    })
  })

  describe("equals", () => {
    it("returns true for equal refs", () => {
      expect(equals(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 6 }))).toBe(true)
    })

    it("returns false for different refs", () => {
      expect(equals(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 7 }))).toBe(false)
      expect(equals(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2025, period: 6 }))).toBe(false)
    })
  })

  describe("nextPeriod", () => {
    it("advances to next period within year", () => {
      const ref = nextPeriod(FiscalPeriodRef.make({ year: 2024, period: 6 }))
      expect(ref.year).toBe(2024)
      expect(ref.period).toBe(7)
    })

    it("advances from period 12 to period 1 of next year", () => {
      const ref = nextPeriod(FiscalPeriodRef.make({ year: 2024, period: 12 }))
      expect(ref.year).toBe(2025)
      expect(ref.period).toBe(1)
    })

    it("advances from period 13 to period 1 of next year", () => {
      const ref = nextPeriod(FiscalPeriodRef.make({ year: 2024, period: 13 }))
      expect(ref.year).toBe(2025)
      expect(ref.period).toBe(1)
    })
  })

  describe("previousPeriod", () => {
    it("goes back to previous period within year", () => {
      const ref = previousPeriod(FiscalPeriodRef.make({ year: 2024, period: 6 }))
      expect(ref.year).toBe(2024)
      expect(ref.period).toBe(5)
    })

    it("goes from period 1 to period 12 of previous year", () => {
      const ref = previousPeriod(FiscalPeriodRef.make({ year: 2024, period: 1 }))
      expect(ref.year).toBe(2023)
      expect(ref.period).toBe(12)
    })

    it("goes from period 13 to period 12 of same year", () => {
      const ref = previousPeriod(FiscalPeriodRef.make({ year: 2024, period: 13 }))
      expect(ref.year).toBe(2024)
      expect(ref.period).toBe(12)
    })
  })

  describe("startOfYear", () => {
    it("returns period 1 of given year", () => {
      const ref = startOfYear(2024)
      expect(ref.year).toBe(2024)
      expect(ref.period).toBe(1)
    })
  })

  describe("endOfYear", () => {
    it("returns period 12 of given year", () => {
      const ref = endOfYear(2024)
      expect(ref.year).toBe(2024)
      expect(ref.period).toBe(12)
    })
  })

  describe("adjustmentPeriod", () => {
    it("returns period 13 of given year", () => {
      const ref = adjustmentPeriod(2024)
      expect(ref.year).toBe(2024)
      expect(ref.period).toBe(13)
    })
  })

  describe("allRegularPeriods", () => {
    it("returns periods 1-12 for given year", () => {
      const periods = allRegularPeriods(2024)
      expect(periods).toHaveLength(12)
      for (let i = 0; i < 12; i++) {
        expect(periods[i].year).toBe(2024)
        expect(periods[i].period).toBe(i + 1)
      }
    })
  })

  describe("allPeriods", () => {
    it("returns periods 1-13 for given year", () => {
      const periods = allPeriods(2024)
      expect(periods).toHaveLength(13)
      for (let i = 0; i < 13; i++) {
        expect(periods[i].year).toBe(2024)
        expect(periods[i].period).toBe(i + 1)
      }
    })
  })

  describe("isWithinRange", () => {
    it("returns true when ref is within range", () => {
      const start = FiscalPeriodRef.make({ year: 2024, period: 3 })
      const end = FiscalPeriodRef.make({ year: 2024, period: 9 })
      expect(isWithinRange(FiscalPeriodRef.make({ year: 2024, period: 6 }), start, end)).toBe(true)
      expect(isWithinRange(FiscalPeriodRef.make({ year: 2024, period: 3 }), start, end)).toBe(true)
      expect(isWithinRange(FiscalPeriodRef.make({ year: 2024, period: 9 }), start, end)).toBe(true)
    })

    it("returns false when ref is outside range", () => {
      const start = FiscalPeriodRef.make({ year: 2024, period: 3 })
      const end = FiscalPeriodRef.make({ year: 2024, period: 9 })
      expect(isWithinRange(FiscalPeriodRef.make({ year: 2024, period: 2 }), start, end)).toBe(false)
      expect(isWithinRange(FiscalPeriodRef.make({ year: 2024, period: 10 }), start, end)).toBe(false)
      expect(isWithinRange(FiscalPeriodRef.make({ year: 2023, period: 6 }), start, end)).toBe(false)
    })
  })

  describe("periodsBetween", () => {
    it("counts periods within same year", () => {
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 1 }), FiscalPeriodRef.make({ year: 2024, period: 12 }))).toBe(12)
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 3 }), FiscalPeriodRef.make({ year: 2024, period: 6 }))).toBe(4)
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 6 }))).toBe(1)
    })

    it("counts periods across years", () => {
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 1 }), FiscalPeriodRef.make({ year: 2025, period: 12 }))).toBe(24)
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 10 }), FiscalPeriodRef.make({ year: 2025, period: 3 }))).toBe(6)
    })

    it("returns 0 when start is after end", () => {
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 6 }), FiscalPeriodRef.make({ year: 2024, period: 3 }))).toBe(0)
    })

    it("treats period 13 as period 12", () => {
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 1 }), FiscalPeriodRef.make({ year: 2024, period: 13 }))).toBe(12)
      expect(periodsBetween(FiscalPeriodRef.make({ year: 2024, period: 13 }), FiscalPeriodRef.make({ year: 2024, period: 13 }))).toBe(1)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for FiscalPeriodRef", () => {
      const ref1 = FiscalPeriodRef.make({ year: 2024, period: 6 })
      const ref2 = FiscalPeriodRef.make({ year: 2024, period: 6 })
      const ref3 = FiscalPeriodRef.make({ year: 2024, period: 7 })

      expect(Equal.equals(ref1, ref2)).toBe(true)
      expect(Equal.equals(ref1, ref3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes FiscalPeriodRef", () =>
      Effect.gen(function* () {
        const original = FiscalPeriodRef.make({ year: 2024, period: 6 })
        const encoded = yield* Schema.encode(FiscalPeriodRef)(original)
        const decoded = yield* Schema.decodeUnknown(FiscalPeriodRef)(encoded)

        expect(decoded.year).toBe(original.year)
        expect(decoded.period).toBe(original.period)
      })
    )
  })
})
