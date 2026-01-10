import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, TestClock, Duration } from "effect"
import * as Schema from "effect/Schema"
import {
  LocalDate,
  isLocalDate,
  make,
  fromString,
  fromDate,
  fromDateTime,
  today,
  todayEffect,
  Order_,
  isBefore,
  isAfter,
  equals,
  addDays,
  addMonths,
  addYears,
  diffInDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isLeapYear,
  daysInMonth
} from "../src/LocalDate.js"
import * as DateTime from "effect/DateTime"

describe("LocalDate", () => {
  describe("validation", () => {
    it.effect("accepts valid dates", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalDate)

        const date = yield* decode({ year: 2024, month: 6, day: 15 })
        expect(date.year).toBe(2024)
        expect(date.month).toBe(6)
        expect(date.day).toBe(15)
      })
    )

    it.effect("accepts edge case dates", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalDate)

        const jan1 = yield* decode({ year: 2024, month: 1, day: 1 })
        expect(jan1.month).toBe(1)
        expect(jan1.day).toBe(1)

        const dec31 = yield* decode({ year: 2024, month: 12, day: 31 })
        expect(dec31.month).toBe(12)
        expect(dec31.day).toBe(31)
      })
    )

    it.effect("rejects invalid month", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalDate)

        const result0 = yield* Effect.exit(decode({ year: 2024, month: 0, day: 15 }))
        expect(Exit.isFailure(result0)).toBe(true)

        const result13 = yield* Effect.exit(decode({ year: 2024, month: 13, day: 15 }))
        expect(Exit.isFailure(result13)).toBe(true)
      })
    )

    it.effect("rejects invalid day", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalDate)

        const result0 = yield* Effect.exit(decode({ year: 2024, month: 6, day: 0 }))
        expect(Exit.isFailure(result0)).toBe(true)

        const result32 = yield* Effect.exit(decode({ year: 2024, month: 6, day: 32 }))
        expect(Exit.isFailure(result32)).toBe(true)
      })
    )

    it.effect("rejects invalid year", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalDate)

        const result0 = yield* Effect.exit(decode({ year: 0, month: 6, day: 15 }))
        expect(Exit.isFailure(result0)).toBe(true)

        const result10000 = yield* Effect.exit(decode({ year: 10000, month: 6, day: 15 }))
        expect(Exit.isFailure(result10000)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isLocalDate returns true for LocalDate instances", () => {
      const date = make(2024, 6, 15)
      expect(isLocalDate(date)).toBe(true)
    })

    it("isLocalDate returns false for non-LocalDate values", () => {
      expect(isLocalDate({ year: 2024, month: 6, day: 15 })).toBe(false)
      expect(isLocalDate("2024-06-15")).toBe(false)
      expect(isLocalDate(null)).toBe(false)
      expect(isLocalDate(undefined)).toBe(false)
    })
  })

  describe("make constructor", () => {
    it("creates LocalDate without validation", () => {
      const date = make(2024, 6, 15)
      expect(date.year).toBe(2024)
      expect(date.month).toBe(6)
      expect(date.day).toBe(15)
    })
  })

  describe("toISOString", () => {
    it("formats date as ISO string", () => {
      expect(make(2024, 6, 15).toISOString()).toBe("2024-06-15")
      expect(make(2024, 1, 1).toISOString()).toBe("2024-01-01")
      expect(make(2024, 12, 31).toISOString()).toBe("2024-12-31")
    })

    it("pads year, month, and day correctly", () => {
      expect(make(999, 1, 1).toISOString()).toBe("0999-01-01")
      expect(make(99, 1, 1).toISOString()).toBe("0099-01-01")
    })
  })

  describe("toString", () => {
    it("returns ISO string", () => {
      const date = make(2024, 6, 15)
      expect(date.toString()).toBe("2024-06-15")
    })
  })

  describe("fromString", () => {
    it.effect("parses valid ISO date strings", () =>
      Effect.gen(function* () {
        const date = yield* fromString("2024-06-15")
        expect(date.year).toBe(2024)
        expect(date.month).toBe(6)
        expect(date.day).toBe(15)
      })
    )

    it.effect("rejects invalid date strings", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(fromString("invalid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects dates with invalid format", () =>
      Effect.gen(function* () {
        const result1 = yield* Effect.exit(fromString("2024/06/15"))
        expect(Exit.isFailure(result1)).toBe(true)

        const result2 = yield* Effect.exit(fromString("06-15-2024"))
        expect(Exit.isFailure(result2)).toBe(true)
      })
    )
  })

  describe("fromDate", () => {
    it("creates LocalDate from JavaScript Date", () => {
      const jsDate = new Date(Date.UTC(2024, 5, 15)) // June is month 5 in JS
      const date = fromDate(jsDate)
      expect(date.year).toBe(2024)
      expect(date.month).toBe(6)
      expect(date.day).toBe(15)
    })
  })

  describe("fromDateTime", () => {
    it("creates LocalDate from DateTime", () => {
      const dt = DateTime.unsafeMake({ year: 2024, month: 6, day: 15 })
      const date = fromDateTime(dt)
      expect(date.year).toBe(2024)
      expect(date.month).toBe(6)
      expect(date.day).toBe(15)
    })
  })

  describe("toDateTime", () => {
    it("converts LocalDate to DateTime at midnight UTC", () => {
      const date = make(2024, 6, 15)
      const dt = date.toDateTime()
      const parts = DateTime.toPartsUtc(dt)
      expect(parts.year).toBe(2024)
      expect(parts.month).toBe(6)
      expect(parts.day).toBe(15)
      expect(parts.hours).toBe(0)
      expect(parts.minutes).toBe(0)
      expect(parts.seconds).toBe(0)
    })
  })

  describe("toDate", () => {
    it("converts LocalDate to JavaScript Date at midnight UTC", () => {
      const date = make(2024, 6, 15)
      const jsDate = date.toDate()
      expect(jsDate.getUTCFullYear()).toBe(2024)
      expect(jsDate.getUTCMonth()).toBe(5) // June is month 5 in JS
      expect(jsDate.getUTCDate()).toBe(15)
      expect(jsDate.getUTCHours()).toBe(0)
    })
  })

  describe("today", () => {
    it("returns current date", () => {
      const t = today()
      const now = new Date()
      expect(t.year).toBe(now.getUTCFullYear())
      expect(t.month).toBe(now.getUTCMonth() + 1)
      expect(t.day).toBe(now.getUTCDate())
    })
  })

  describe("todayEffect", () => {
    it.effect("returns the date from TestClock (starts at epoch)", () =>
      Effect.gen(function* () {
        // TestClock starts at epoch (1970-01-01)
        const date = yield* todayEffect
        expect(date.year).toBe(1970)
        expect(date.month).toBe(1)
        expect(date.day).toBe(1)
      })
    )

    it.effect("advances with TestClock.adjust", () =>
      Effect.gen(function* () {
        // Start at epoch (1970-01-01)
        const initial = yield* todayEffect
        expect(initial.toISOString()).toBe("1970-01-01")

        // Advance 365 days
        yield* TestClock.adjust(Duration.days(365))

        const afterYear = yield* todayEffect
        expect(afterYear.year).toBe(1971)
        expect(afterYear.month).toBe(1)
        expect(afterYear.day).toBe(1)
      })
    )

    it.effect("handles specific date via TestClock.setTime", () =>
      Effect.gen(function* () {
        // Set clock to 2024-06-15 midnight UTC
        const targetDate = new Date(Date.UTC(2024, 5, 15, 0, 0, 0, 0))
        yield* TestClock.setTime(targetDate.getTime())

        const date = yield* todayEffect
        expect(date.year).toBe(2024)
        expect(date.month).toBe(6)
        expect(date.day).toBe(15)
      })
    )

    it.live("returns real current date with live effect", () =>
      Effect.gen(function* () {
        const date = yield* todayEffect
        const now = new Date()
        // Should be today's date (UTC)
        expect(date.year).toBe(now.getUTCFullYear())
        expect(date.month).toBe(now.getUTCMonth() + 1)
        expect(date.day).toBe(now.getUTCDate())
      })
    )
  })

  describe("Order", () => {
    it("compares dates correctly", () => {
      const date1 = make(2024, 6, 15)
      const date2 = make(2024, 6, 16)
      const date3 = make(2024, 7, 1)
      const date4 = make(2025, 1, 1)

      expect(Order_(date1, date2)).toBe(-1)
      expect(Order_(date2, date1)).toBe(1)
      expect(Order_(date1, date1)).toBe(0)
      expect(Order_(date1, date3)).toBe(-1)
      expect(Order_(date1, date4)).toBe(-1)
    })
  })

  describe("isBefore", () => {
    it("returns true when first date is before second", () => {
      expect(isBefore(make(2024, 6, 15), make(2024, 6, 16))).toBe(true)
      expect(isBefore(make(2024, 6, 15), make(2024, 7, 1))).toBe(true)
      expect(isBefore(make(2024, 6, 15), make(2025, 1, 1))).toBe(true)
    })

    it("returns false when first date is not before second", () => {
      expect(isBefore(make(2024, 6, 16), make(2024, 6, 15))).toBe(false)
      expect(isBefore(make(2024, 6, 15), make(2024, 6, 15))).toBe(false)
    })
  })

  describe("isAfter", () => {
    it("returns true when first date is after second", () => {
      expect(isAfter(make(2024, 6, 16), make(2024, 6, 15))).toBe(true)
      expect(isAfter(make(2024, 7, 1), make(2024, 6, 15))).toBe(true)
      expect(isAfter(make(2025, 1, 1), make(2024, 6, 15))).toBe(true)
    })

    it("returns false when first date is not after second", () => {
      expect(isAfter(make(2024, 6, 15), make(2024, 6, 16))).toBe(false)
      expect(isAfter(make(2024, 6, 15), make(2024, 6, 15))).toBe(false)
    })
  })

  describe("equals", () => {
    it("returns true for equal dates", () => {
      expect(equals(make(2024, 6, 15), make(2024, 6, 15))).toBe(true)
    })

    it("returns false for different dates", () => {
      expect(equals(make(2024, 6, 15), make(2024, 6, 16))).toBe(false)
      expect(equals(make(2024, 6, 15), make(2024, 7, 15))).toBe(false)
      expect(equals(make(2024, 6, 15), make(2025, 6, 15))).toBe(false)
    })
  })

  describe("addDays", () => {
    it("adds days correctly", () => {
      const date = make(2024, 6, 15)
      const result = addDays(date, 5)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(6)
      expect(result.day).toBe(20)
    })

    it("handles month overflow", () => {
      const date = make(2024, 6, 30)
      const result = addDays(date, 5)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(7)
      expect(result.day).toBe(5)
    })

    it("handles negative days", () => {
      const date = make(2024, 6, 15)
      const result = addDays(date, -5)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(6)
      expect(result.day).toBe(10)
    })
  })

  describe("addMonths", () => {
    it("adds months correctly", () => {
      const date = make(2024, 6, 15)
      const result = addMonths(date, 3)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(9)
      expect(result.day).toBe(15)
    })

    it("handles year overflow", () => {
      const date = make(2024, 11, 15)
      const result = addMonths(date, 3)
      expect(result.year).toBe(2025)
      expect(result.month).toBe(2)
      expect(result.day).toBe(15)
    })
  })

  describe("addYears", () => {
    it("adds years correctly", () => {
      const date = make(2024, 6, 15)
      const result = addYears(date, 2)
      expect(result.year).toBe(2026)
      expect(result.month).toBe(6)
      expect(result.day).toBe(15)
    })
  })

  describe("diffInDays", () => {
    it("calculates difference in days", () => {
      const date1 = make(2024, 6, 15)
      const date2 = make(2024, 6, 20)
      expect(diffInDays(date2, date1)).toBe(5)
      expect(diffInDays(date1, date2)).toBe(-5)
    })
  })

  describe("startOfMonth", () => {
    it("returns first day of month", () => {
      const date = make(2024, 6, 15)
      const result = startOfMonth(date)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(6)
      expect(result.day).toBe(1)
    })
  })

  describe("endOfMonth", () => {
    it("returns last day of month", () => {
      const june = make(2024, 6, 15)
      const juneEnd = endOfMonth(june)
      expect(juneEnd.day).toBe(30)

      const july = make(2024, 7, 15)
      const julyEnd = endOfMonth(july)
      expect(julyEnd.day).toBe(31)

      const feb = make(2024, 2, 15)
      const febEnd = endOfMonth(feb)
      expect(febEnd.day).toBe(29) // 2024 is a leap year
    })
  })

  describe("startOfYear", () => {
    it("returns January 1st", () => {
      const date = make(2024, 6, 15)
      const result = startOfYear(date)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(1)
      expect(result.day).toBe(1)
    })
  })

  describe("endOfYear", () => {
    it("returns December 31st", () => {
      const date = make(2024, 6, 15)
      const result = endOfYear(date)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(12)
      expect(result.day).toBe(31)
    })
  })

  describe("isLeapYear", () => {
    it("correctly identifies leap years", () => {
      expect(isLeapYear(2024)).toBe(true)
      expect(isLeapYear(2000)).toBe(true)
      expect(isLeapYear(2023)).toBe(false)
      expect(isLeapYear(1900)).toBe(false) // divisible by 100 but not 400
    })
  })

  describe("daysInMonth", () => {
    it("returns correct days for each month", () => {
      expect(daysInMonth(2024, 1)).toBe(31) // January
      expect(daysInMonth(2024, 2)).toBe(29) // February (leap year)
      expect(daysInMonth(2023, 2)).toBe(28) // February (non-leap year)
      expect(daysInMonth(2024, 4)).toBe(30) // April
      expect(daysInMonth(2024, 6)).toBe(30) // June
      expect(daysInMonth(2024, 7)).toBe(31) // July
    })
  })

  describe("equality", () => {
    it("Equal.equals works for LocalDate", () => {
      const date1 = make(2024, 6, 15)
      const date2 = make(2024, 6, 15)
      const date3 = make(2024, 6, 16)

      expect(Equal.equals(date1, date2)).toBe(true)
      expect(Equal.equals(date1, date3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes LocalDate", () =>
      Effect.gen(function* () {
        const original = make(2024, 6, 15)
        const encoded = yield* Schema.encode(LocalDate)(original)
        const decoded = yield* Schema.decodeUnknown(LocalDate)(encoded)

        expect(decoded.year).toBe(original.year)
        expect(decoded.month).toBe(original.month)
        expect(decoded.day).toBe(original.day)
      })
    )
  })
})
