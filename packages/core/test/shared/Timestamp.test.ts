import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, TestClock, Duration } from "effect"
import * as Schema from "effect/Schema"
import * as DateTime from "effect/DateTime"
import {
  Timestamp,
  isTimestamp,
  fromDateTime,
  fromDate,
  fromString,
  now,
  nowEffect,
  Order_,
  isBefore,
  isAfter,
  equals,
  addMillis,
  addSeconds,
  addMinutes,
  addHours,
  addDays,
  diffInMillis,
  diffInSeconds,
  min,
  max,
  EPOCH
} from "../../src/shared/values/Timestamp.ts"

describe("Timestamp", () => {
  describe("validation", () => {
    it.effect("accepts valid epoch millis", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Timestamp)

        const ts = yield* decode({ epochMillis: 1718409600000 })
        expect(ts.epochMillis).toBe(1718409600000)
      })
    )

    it.effect("rejects non-integer epoch millis", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Timestamp)
        const result = yield* Effect.exit(decode({ epochMillis: 1718409600000.5 }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isTimestamp returns true for Timestamp instances", () => {
      const ts = Timestamp.make({ epochMillis: 1718409600000 })
      expect(isTimestamp(ts)).toBe(true)
    })

    it("isTimestamp returns false for non-Timestamp values", () => {
      expect(isTimestamp({ epochMillis: 1718409600000 })).toBe(false)
      expect(isTimestamp("2024-06-15T00:00:00.000Z")).toBe(false)
      expect(isTimestamp(1718409600000)).toBe(false)
      expect(isTimestamp(null)).toBe(false)
      expect(isTimestamp(undefined)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates Timestamp using Schema's .make()", () => {
      const timestamp = Timestamp.make({ epochMillis: 1718409600000 })
      expect(timestamp.epochMillis).toBe(1718409600000)
    })
  })

  describe("EPOCH", () => {
    it("is Unix epoch (0 milliseconds)", () => {
      expect(EPOCH.epochMillis).toBe(0)
      expect(EPOCH.toISOString()).toBe("1970-01-01T00:00:00.000Z")
    })
  })

  describe("fromDateTime", () => {
    it("creates Timestamp from DateTime.Utc", () => {
      const dt = DateTime.unsafeMake({ year: 2024, month: 6, day: 15 })
      const ts = fromDateTime(dt)
      expect(ts.epochMillis).toBe(dt.epochMillis)
    })
  })

  describe("fromDate", () => {
    it("creates Timestamp from JavaScript Date", () => {
      const date = new Date("2024-06-15T12:30:45.123Z")
      const ts = fromDate(date)
      expect(ts.epochMillis).toBe(date.getTime())
    })
  })

  describe("fromString", () => {
    it.effect("parses valid ISO datetime strings", () =>
      Effect.gen(function* () {
        const ts = yield* fromString("2024-06-15T12:30:45.123Z")
        expect(ts.epochMillis).toBe(new Date("2024-06-15T12:30:45.123Z").getTime())
      })
    )

    it.effect("rejects invalid datetime strings", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(fromString("invalid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("now", () => {
    it("returns current timestamp", () => {
      const before = Date.now()
      const ts = now()
      const after = Date.now()
      expect(ts.epochMillis).toBeGreaterThanOrEqual(before)
      expect(ts.epochMillis).toBeLessThanOrEqual(after)
    })
  })

  describe("nowEffect", () => {
    it.effect("returns timestamp from TestClock", () =>
      Effect.gen(function* () {
        // Set TestClock to epoch (0 ms) for this test
        yield* TestClock.setTime(0)
        const ts = yield* nowEffect
        expect(ts.epochMillis).toBe(0)
        expect(ts.toISOString()).toBe("1970-01-01T00:00:00.000Z")
      })
    )

    it.effect("advances with TestClock.adjust", () =>
      Effect.gen(function* () {
        // Set TestClock to epoch (0 ms) for this test
        yield* TestClock.setTime(0)
        const initial = yield* nowEffect
        expect(initial.epochMillis).toBe(0)

        // Advance 1 hour
        yield* TestClock.adjust(Duration.hours(1))

        const afterHour = yield* nowEffect
        expect(afterHour.epochMillis).toBe(3600000) // 1 hour in ms
      })
    )

    it.effect("handles TestClock.setTime for specific timestamp", () =>
      Effect.gen(function* () {
        // Set clock to a specific date/time (2024-06-15T12:30:45.123Z)
        const targetTime = new Date("2024-06-15T12:30:45.123Z").getTime()
        yield* TestClock.setTime(targetTime)

        const ts = yield* nowEffect
        expect(ts.epochMillis).toBe(targetTime)
        expect(ts.toISOString()).toBe("2024-06-15T12:30:45.123Z")
      })
    )

    it.effect("demonstrates time-based logic testing with TestClock", () =>
      Effect.gen(function* () {
        // Set a starting time
        yield* TestClock.setTime(1000000)
        const start = yield* nowEffect

        // Advance by 5 seconds
        yield* TestClock.adjust(Duration.seconds(5))
        const end = yield* nowEffect

        // Verify the difference
        expect(diffInMillis(end, start)).toBe(5000)
        expect(diffInSeconds(end, start)).toBe(5)
      })
    )

    it.live("returns real current timestamp with live effect", () =>
      Effect.gen(function* () {
        const before = Date.now()
        const ts = yield* nowEffect
        const after = Date.now()

        // Should be within the time window
        expect(ts.epochMillis).toBeGreaterThanOrEqual(before)
        expect(ts.epochMillis).toBeLessThanOrEqual(after)
      })
    )
  })

  describe("toDateTime", () => {
    it("converts to DateTime.Utc", () => {
      const ts = Timestamp.make({ epochMillis: 1718409600000 })
      const dt = ts.toDateTime()
      expect(dt.epochMillis).toBe(1718409600000)
    })
  })

  describe("toDate", () => {
    it("converts to JavaScript Date", () => {
      const ts = Timestamp.make({ epochMillis: 1718409600000 })
      const date = ts.toDate()
      expect(date.getTime()).toBe(1718409600000)
    })
  })

  describe("toISOString", () => {
    it("formats as ISO 8601 string", () => {
      const ts = Timestamp.make({ epochMillis: 0 }) // Unix epoch
      expect(ts.toISOString()).toBe("1970-01-01T00:00:00.000Z")
    })
  })

  describe("toString", () => {
    it("returns ISO string", () => {
      const ts = Timestamp.make({ epochMillis: 0 })
      expect(ts.toString()).toBe("1970-01-01T00:00:00.000Z")
    })
  })

  describe("toLocalDate", () => {
    it("extracts LocalDate portion", () => {
      const ts = Timestamp.make({ epochMillis: new Date("2024-06-15T12:30:45.123Z").getTime() })
      const date = ts.toLocalDate()
      expect(date.year).toBe(2024)
      expect(date.month).toBe(6)
      expect(date.day).toBe(15)
    })
  })

  describe("Order", () => {
    it("compares timestamps correctly", () => {
      const ts1 = Timestamp.make({ epochMillis: 1000 })
      const ts2 = Timestamp.make({ epochMillis: 2000 })
      const ts3 = Timestamp.make({ epochMillis: 1000 })

      expect(Order_(ts1, ts2)).toBe(-1)
      expect(Order_(ts2, ts1)).toBe(1)
      expect(Order_(ts1, ts3)).toBe(0)
    })
  })

  describe("isBefore", () => {
    it("returns true when first timestamp is before second", () => {
      expect(isBefore(Timestamp.make({ epochMillis: 1000 }), Timestamp.make({ epochMillis: 2000 }))).toBe(true)
    })

    it("returns false when first timestamp is not before second", () => {
      expect(isBefore(Timestamp.make({ epochMillis: 2000 }), Timestamp.make({ epochMillis: 1000 }))).toBe(false)
      expect(isBefore(Timestamp.make({ epochMillis: 1000 }), Timestamp.make({ epochMillis: 1000 }))).toBe(false)
    })
  })

  describe("isAfter", () => {
    it("returns true when first timestamp is after second", () => {
      expect(isAfter(Timestamp.make({ epochMillis: 2000 }), Timestamp.make({ epochMillis: 1000 }))).toBe(true)
    })

    it("returns false when first timestamp is not after second", () => {
      expect(isAfter(Timestamp.make({ epochMillis: 1000 }), Timestamp.make({ epochMillis: 2000 }))).toBe(false)
      expect(isAfter(Timestamp.make({ epochMillis: 1000 }), Timestamp.make({ epochMillis: 1000 }))).toBe(false)
    })
  })

  describe("equals", () => {
    it("returns true for equal timestamps", () => {
      expect(equals(Timestamp.make({ epochMillis: 1000 }), Timestamp.make({ epochMillis: 1000 }))).toBe(true)
    })

    it("returns false for different timestamps", () => {
      expect(equals(Timestamp.make({ epochMillis: 1000 }), Timestamp.make({ epochMillis: 2000 }))).toBe(false)
    })
  })

  describe("addMillis", () => {
    it("adds milliseconds", () => {
      const ts = Timestamp.make({ epochMillis: 1000 })
      expect(addMillis(ts, 500).epochMillis).toBe(1500)
    })

    it("handles negative values", () => {
      const ts = Timestamp.make({ epochMillis: 1000 })
      expect(addMillis(ts, -500).epochMillis).toBe(500)
    })
  })

  describe("addSeconds", () => {
    it("adds seconds", () => {
      const ts = Timestamp.make({ epochMillis: 0 })
      expect(addSeconds(ts, 5).epochMillis).toBe(5000)
    })
  })

  describe("addMinutes", () => {
    it("adds minutes", () => {
      const ts = Timestamp.make({ epochMillis: 0 })
      expect(addMinutes(ts, 2).epochMillis).toBe(120000)
    })
  })

  describe("addHours", () => {
    it("adds hours", () => {
      const ts = Timestamp.make({ epochMillis: 0 })
      expect(addHours(ts, 1).epochMillis).toBe(3600000)
    })
  })

  describe("addDays", () => {
    it("adds days", () => {
      const ts = Timestamp.make({ epochMillis: 0 })
      expect(addDays(ts, 1).epochMillis).toBe(86400000)
    })
  })

  describe("diffInMillis", () => {
    it("calculates difference in milliseconds", () => {
      const ts1 = Timestamp.make({ epochMillis: 1000 })
      const ts2 = Timestamp.make({ epochMillis: 2500 })
      expect(diffInMillis(ts2, ts1)).toBe(1500)
      expect(diffInMillis(ts1, ts2)).toBe(-1500)
    })
  })

  describe("diffInSeconds", () => {
    it("calculates difference in seconds", () => {
      const ts1 = Timestamp.make({ epochMillis: 0 })
      const ts2 = Timestamp.make({ epochMillis: 5500 })
      expect(diffInSeconds(ts2, ts1)).toBe(5)
    })
  })

  describe("min", () => {
    it("returns the earlier timestamp", () => {
      const ts1 = Timestamp.make({ epochMillis: 1000 })
      const ts2 = Timestamp.make({ epochMillis: 2000 })
      expect(min(ts1, ts2).epochMillis).toBe(1000)
      expect(min(ts2, ts1).epochMillis).toBe(1000)
    })

    it("returns first when equal", () => {
      const ts1 = Timestamp.make({ epochMillis: 1000 })
      const ts2 = Timestamp.make({ epochMillis: 1000 })
      expect(min(ts1, ts2)).toBe(ts1)
    })
  })

  describe("max", () => {
    it("returns the later timestamp", () => {
      const ts1 = Timestamp.make({ epochMillis: 1000 })
      const ts2 = Timestamp.make({ epochMillis: 2000 })
      expect(max(ts1, ts2).epochMillis).toBe(2000)
      expect(max(ts2, ts1).epochMillis).toBe(2000)
    })

    it("returns first when equal", () => {
      const ts1 = Timestamp.make({ epochMillis: 1000 })
      const ts2 = Timestamp.make({ epochMillis: 1000 })
      expect(max(ts1, ts2)).toBe(ts1)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for Timestamp", () => {
      const ts1 = Timestamp.make({ epochMillis: 1000 })
      const ts2 = Timestamp.make({ epochMillis: 1000 })
      const ts3 = Timestamp.make({ epochMillis: 2000 })

      expect(Equal.equals(ts1, ts2)).toBe(true)
      expect(Equal.equals(ts1, ts3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes Timestamp", () =>
      Effect.gen(function* () {
        const original = Timestamp.make({ epochMillis: 1718409600000 })
        const encoded = yield* Schema.encode(Timestamp)(original)
        const decoded = yield* Schema.decodeUnknown(Timestamp)(encoded)

        expect(decoded.epochMillis).toBe(original.epochMillis)
      })
    )
  })
})
