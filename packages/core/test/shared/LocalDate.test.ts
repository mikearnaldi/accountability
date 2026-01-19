import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, TestClock, Duration } from "effect"
import * as Schema from "effect/Schema"
import {
  LocalDate,
  LocalDateFromString,
  isLocalDate,
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
} from "../../src/shared/values/LocalDate.ts"
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

    it.effect("accepts dates from previous years (historical data entry)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalDate)

        // 2024 - previous year relative to current date (2026)
        const pastDate2024 = yield* decode({ year: 2024, month: 1, day: 15 })
        expect(pastDate2024.year).toBe(2024)
        expect(pastDate2024.month).toBe(1)
        expect(pastDate2024.day).toBe(15)

        // 2020 - 6 years ago
        const pastDate2020 = yield* decode({ year: 2020, month: 6, day: 30 })
        expect(pastDate2020.year).toBe(2020)
        expect(pastDate2020.month).toBe(6)
        expect(pastDate2020.day).toBe(30)
      })
    )

    it.effect("accepts dates far in the past (year 2000, 1900)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalDate)

        // Y2K date
        const y2k = yield* decode({ year: 2000, month: 1, day: 1 })
        expect(y2k.year).toBe(2000)
        expect(y2k.month).toBe(1)
        expect(y2k.day).toBe(1)

        // Very old date (1900)
        const old1900 = yield* decode({ year: 1900, month: 12, day: 31 })
        expect(old1900.year).toBe(1900)
        expect(old1900.month).toBe(12)
        expect(old1900.day).toBe(31)

        // Minimum allowed year (1)
        const minYear = yield* decode({ year: 1, month: 1, day: 1 })
        expect(minYear.year).toBe(1)
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
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      expect(isLocalDate(date)).toBe(true)
    })

    it("isLocalDate returns false for non-LocalDate values", () => {
      expect(isLocalDate({ year: 2024, month: 6, day: 15 })).toBe(false)
      expect(isLocalDate("2024-06-15")).toBe(false)
      expect(isLocalDate(null)).toBe(false)
      expect(isLocalDate(undefined)).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates LocalDate using Schema's .make()", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      expect(date.year).toBe(2024)
      expect(date.month).toBe(6)
      expect(date.day).toBe(15)
    })
  })

  describe("toISOString", () => {
    it("formats date as ISO string", () => {
      expect(LocalDate.make({ year: 2024, month: 6, day: 15 }).toISOString()).toBe("2024-06-15")
      expect(LocalDate.make({ year: 2024, month: 1, day: 1 }).toISOString()).toBe("2024-01-01")
      expect(LocalDate.make({ year: 2024, month: 12, day: 31 }).toISOString()).toBe("2024-12-31")
    })

    it("pads year, month, and day correctly", () => {
      expect(LocalDate.make({ year: 999, month: 1, day: 1 }).toISOString()).toBe("0999-01-01")
      expect(LocalDate.make({ year: 99, month: 1, day: 1 }).toISOString()).toBe("0099-01-01")
    })
  })

  describe("toString", () => {
    it("returns ISO string", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
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
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
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
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
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
      const date1 = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const date2 = LocalDate.make({ year: 2024, month: 6, day: 16 })
      const date3 = LocalDate.make({ year: 2024, month: 7, day: 1 })
      const date4 = LocalDate.make({ year: 2025, month: 1, day: 1 })

      expect(Order_(date1, date2)).toBe(-1)
      expect(Order_(date2, date1)).toBe(1)
      expect(Order_(date1, date1)).toBe(0)
      expect(Order_(date1, date3)).toBe(-1)
      expect(Order_(date1, date4)).toBe(-1)
    })
  })

  describe("isBefore", () => {
    it("returns true when first date is before second", () => {
      expect(isBefore(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 6, day: 16 }))).toBe(true)
      expect(isBefore(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 7, day: 1 }))).toBe(true)
      expect(isBefore(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2025, month: 1, day: 1 }))).toBe(true)
    })

    it("returns false when first date is not before second", () => {
      expect(isBefore(LocalDate.make({ year: 2024, month: 6, day: 16 }), LocalDate.make({ year: 2024, month: 6, day: 15 }))).toBe(false)
      expect(isBefore(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 6, day: 15 }))).toBe(false)
    })
  })

  describe("isAfter", () => {
    it("returns true when first date is after second", () => {
      expect(isAfter(LocalDate.make({ year: 2024, month: 6, day: 16 }), LocalDate.make({ year: 2024, month: 6, day: 15 }))).toBe(true)
      expect(isAfter(LocalDate.make({ year: 2024, month: 7, day: 1 }), LocalDate.make({ year: 2024, month: 6, day: 15 }))).toBe(true)
      expect(isAfter(LocalDate.make({ year: 2025, month: 1, day: 1 }), LocalDate.make({ year: 2024, month: 6, day: 15 }))).toBe(true)
    })

    it("returns false when first date is not after second", () => {
      expect(isAfter(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 6, day: 16 }))).toBe(false)
      expect(isAfter(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 6, day: 15 }))).toBe(false)
    })
  })

  describe("equals", () => {
    it("returns true for equal dates", () => {
      expect(equals(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 6, day: 15 }))).toBe(true)
    })

    it("returns false for different dates", () => {
      expect(equals(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 6, day: 16 }))).toBe(false)
      expect(equals(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2024, month: 7, day: 15 }))).toBe(false)
      expect(equals(LocalDate.make({ year: 2024, month: 6, day: 15 }), LocalDate.make({ year: 2025, month: 6, day: 15 }))).toBe(false)
    })
  })

  describe("addDays", () => {
    it("adds days correctly", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const result = addDays(date, 5)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(6)
      expect(result.day).toBe(20)
    })

    it("handles month overflow", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 30 })
      const result = addDays(date, 5)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(7)
      expect(result.day).toBe(5)
    })

    it("handles negative days", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const result = addDays(date, -5)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(6)
      expect(result.day).toBe(10)
    })
  })

  describe("addMonths", () => {
    it("adds months correctly", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const result = addMonths(date, 3)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(9)
      expect(result.day).toBe(15)
    })

    it("handles year overflow", () => {
      const date = LocalDate.make({ year: 2024, month: 11, day: 15 })
      const result = addMonths(date, 3)
      expect(result.year).toBe(2025)
      expect(result.month).toBe(2)
      expect(result.day).toBe(15)
    })
  })

  describe("addYears", () => {
    it("adds years correctly", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const result = addYears(date, 2)
      expect(result.year).toBe(2026)
      expect(result.month).toBe(6)
      expect(result.day).toBe(15)
    })
  })

  describe("diffInDays", () => {
    it("calculates difference in days", () => {
      const date1 = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const date2 = LocalDate.make({ year: 2024, month: 6, day: 20 })
      expect(diffInDays(date2, date1)).toBe(5)
      expect(diffInDays(date1, date2)).toBe(-5)
    })
  })

  describe("startOfMonth", () => {
    it("returns first day of month", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const result = startOfMonth(date)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(6)
      expect(result.day).toBe(1)
    })
  })

  describe("endOfMonth", () => {
    it("returns last day of month", () => {
      const june = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const juneEnd = endOfMonth(june)
      expect(juneEnd.day).toBe(30)

      const july = LocalDate.make({ year: 2024, month: 7, day: 15 })
      const julyEnd = endOfMonth(july)
      expect(julyEnd.day).toBe(31)

      const feb = LocalDate.make({ year: 2024, month: 2, day: 15 })
      const febEnd = endOfMonth(feb)
      expect(febEnd.day).toBe(29) // 2024 is a leap year
    })
  })

  describe("startOfYear", () => {
    it("returns January 1st", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const result = startOfYear(date)
      expect(result.year).toBe(2024)
      expect(result.month).toBe(1)
      expect(result.day).toBe(1)
    })
  })

  describe("endOfYear", () => {
    it("returns December 31st", () => {
      const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
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
      const date1 = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const date2 = LocalDate.make({ year: 2024, month: 6, day: 15 })
      const date3 = LocalDate.make({ year: 2024, month: 6, day: 16 })

      expect(Equal.equals(date1, date2)).toBe(true)
      expect(Equal.equals(date1, date3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes LocalDate", () =>
      Effect.gen(function* () {
        const original = LocalDate.make({ year: 2024, month: 6, day: 15 })
        const encoded = yield* Schema.encode(LocalDate)(original)
        const decoded = yield* Schema.decodeUnknown(LocalDate)(encoded)

        expect(decoded.year).toBe(original.year)
        expect(decoded.month).toBe(original.month)
        expect(decoded.day).toBe(original.day)
      })
    )
  })

  describe("LocalDateFromString", () => {
    describe("decoding", () => {
      it.effect("parses valid ISO date strings", () =>
        Effect.gen(function* () {
          const date = yield* Schema.decodeUnknown(LocalDateFromString)("2024-06-15")
          expect(date.year).toBe(2024)
          expect(date.month).toBe(6)
          expect(date.day).toBe(15)
        })
      )

      it.effect("parses edge case dates", () =>
        Effect.gen(function* () {
          // First day of year
          const jan1 = yield* Schema.decodeUnknown(LocalDateFromString)("2024-01-01")
          expect(jan1.year).toBe(2024)
          expect(jan1.month).toBe(1)
          expect(jan1.day).toBe(1)

          // Last day of year
          const dec31 = yield* Schema.decodeUnknown(LocalDateFromString)("2024-12-31")
          expect(dec31.year).toBe(2024)
          expect(dec31.month).toBe(12)
          expect(dec31.day).toBe(31)
        })
      )

      it.effect("parses past dates from previous years (historical data entry)", () =>
        Effect.gen(function* () {
          // 2024 - 2 years ago relative to current date (2026)
          const date2024 = yield* Schema.decodeUnknown(LocalDateFromString)("2024-01-15")
          expect(date2024.year).toBe(2024)
          expect(date2024.month).toBe(1)
          expect(date2024.day).toBe(15)

          // 2020 - 6 years ago
          const date2020 = yield* Schema.decodeUnknown(LocalDateFromString)("2020-06-30")
          expect(date2020.year).toBe(2020)
          expect(date2020.month).toBe(6)
          expect(date2020.day).toBe(30)

          // Y2K date (2000)
          const y2k = yield* Schema.decodeUnknown(LocalDateFromString)("2000-01-01")
          expect(y2k.year).toBe(2000)
          expect(y2k.month).toBe(1)
          expect(y2k.day).toBe(1)

          // Very old date (1900)
          const date1900 = yield* Schema.decodeUnknown(LocalDateFromString)("1900-12-31")
          expect(date1900.year).toBe(1900)
          expect(date1900.month).toBe(12)
          expect(date1900.day).toBe(31)
        })
      )

      it.effect("parses leap year February 29", () =>
        Effect.gen(function* () {
          const feb29 = yield* Schema.decodeUnknown(LocalDateFromString)("2024-02-29")
          expect(feb29.year).toBe(2024)
          expect(feb29.month).toBe(2)
          expect(feb29.day).toBe(29)
        })
      )

      it.effect("rejects invalid format - wrong separator", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2024/06/15"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid format - US format", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("06-15-2024"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid format - no separators", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("20240615"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid format - random string", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("invalid"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid format - empty string", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)(""))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid month - 0", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2024-00-15"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid month - 13", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2024-13-15"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid day - 0", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2024-06-00"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid day - 32 for month with 31 days", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2024-07-32"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects invalid day - 31 for month with 30 days", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2024-06-31"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects February 29 in non-leap year", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2023-02-29"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )

      it.effect("rejects February 30", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(Schema.decodeUnknown(LocalDateFromString)("2024-02-30"))
          expect(Exit.isFailure(result)).toBe(true)
        })
      )
    })

    describe("encoding", () => {
      it.effect("encodes LocalDate to ISO string", () =>
        Effect.gen(function* () {
          const date = LocalDate.make({ year: 2024, month: 6, day: 15 })
          const encoded = yield* Schema.encode(LocalDateFromString)(date)
          expect(encoded).toBe("2024-06-15")
        })
      )

      it.effect("pads year, month, and day correctly", () =>
        Effect.gen(function* () {
          const date1 = LocalDate.make({ year: 999, month: 1, day: 1 })
          const encoded1 = yield* Schema.encode(LocalDateFromString)(date1)
          expect(encoded1).toBe("0999-01-01")

          const date2 = LocalDate.make({ year: 99, month: 2, day: 5 })
          const encoded2 = yield* Schema.encode(LocalDateFromString)(date2)
          expect(encoded2).toBe("0099-02-05")
        })
      )
    })

    describe("round-trip", () => {
      it.effect("decode then encode returns original string", () =>
        Effect.gen(function* () {
          const original = "2024-06-15"
          const decoded = yield* Schema.decodeUnknown(LocalDateFromString)(original)
          const encoded = yield* Schema.encode(LocalDateFromString)(decoded)
          expect(encoded).toBe(original)
        })
      )

      it.effect("encode then decode returns equal LocalDate", () =>
        Effect.gen(function* () {
          const original = LocalDate.make({ year: 2024, month: 6, day: 15 })
          const encoded = yield* Schema.encode(LocalDateFromString)(original)
          const decoded = yield* Schema.decodeUnknown(LocalDateFromString)(encoded)
          expect(Equal.equals(original, decoded)).toBe(true)
        })
      )
    })

    describe("use in Schema.Struct", () => {
      const TestParams = Schema.Struct({
        startDate: LocalDateFromString,
        endDate: LocalDateFromString
      })

      it.effect("decodes struct with date string fields", () =>
        Effect.gen(function* () {
          const params = yield* Schema.decodeUnknown(TestParams)({
            startDate: "2024-01-01",
            endDate: "2024-12-31"
          })
          expect(params.startDate.year).toBe(2024)
          expect(params.startDate.month).toBe(1)
          expect(params.endDate.month).toBe(12)
        })
      )

      it.effect("encodes struct back to string fields", () =>
        Effect.gen(function* () {
          const params = {
            startDate: LocalDate.make({ year: 2024, month: 1, day: 1 }),
            endDate: LocalDate.make({ year: 2024, month: 12, day: 31 })
          }
          const encoded = yield* Schema.encode(TestParams)(params)
          expect(encoded.startDate).toBe("2024-01-01")
          expect(encoded.endDate).toBe("2024-12-31")
        })
      )
    })

    describe("use with Schema.optional", () => {
      const OptionalDateParams = Schema.Struct({
        requiredDate: LocalDateFromString,
        optionalDate: Schema.optional(LocalDateFromString)
      })

      it.effect("decodes with optional date present", () =>
        Effect.gen(function* () {
          const params = yield* Schema.decodeUnknown(OptionalDateParams)({
            requiredDate: "2024-06-15",
            optionalDate: "2024-12-31"
          })
          expect(params.requiredDate.month).toBe(6)
          expect(params.optionalDate?.month).toBe(12)
        })
      )

      it.effect("decodes with optional date absent", () =>
        Effect.gen(function* () {
          const params = yield* Schema.decodeUnknown(OptionalDateParams)({
            requiredDate: "2024-06-15"
          })
          expect(params.requiredDate.month).toBe(6)
          expect(params.optionalDate).toBeUndefined()
        })
      )
    })
  })
})
