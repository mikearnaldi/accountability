/**
 * LocalDate - Date without timezone value object
 *
 * Represents a calendar date (year, month, day) without time or timezone information.
 * Uses Effect's DateTime.Utc internally but only represents the date portion.
 * Encodes to/from ISO 8601 date strings (YYYY-MM-DD format).
 *
 * @module shared/values/LocalDate
 */

import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"

/**
 * LocalDate - A Schema.Class representing a calendar date without time
 *
 * Stores year, month (1-12), and day (1-31) as numbers.
 * Encoded as ISO 8601 date string (YYYY-MM-DD).
 */
export class LocalDate extends Schema.Class<LocalDate>("LocalDate")({
  year: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(9999)),
  month: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(12)),
  day: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(31))
}) {
  /**
   * Format as ISO 8601 date string (YYYY-MM-DD)
   */
  toISOString(): string {
    const y = String(this.year).padStart(4, "0")
    const m = String(this.month).padStart(2, "0")
    const d = String(this.day).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return this.toISOString()
  }

  /**
   * Convert to Effect DateTime.Utc at midnight UTC
   */
  toDateTime(): DateTime.Utc {
    return DateTime.unsafeMake({ year: this.year, month: this.month, day: this.day })
  }

  /**
   * Convert to JavaScript Date at midnight UTC
   */
  toDate(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, this.day))
  }
}

/**
 * Type guard for LocalDate using Schema.is
 */
export const isLocalDate = Schema.is(LocalDate)

/**
 * Create a LocalDate from an ISO 8601 date string (YYYY-MM-DD)
 * Returns an Effect that may fail with ParseError
 */
export const fromString = (
  dateString: string
): Effect.Effect<LocalDate, ParseResult.ParseError> => {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return Effect.fail(
      new ParseResult.ParseError({
        issue: new ParseResult.Type(
          Schema.String.ast,
          dateString,
          `Invalid date format: expected YYYY-MM-DD, got "${dateString}"`
        )
      })
    )
  }
  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  return Schema.decodeUnknown(LocalDate)({ year, month, day })
}

/**
 * Create a LocalDate from a JavaScript Date
 * Uses the UTC date components
 */
export const fromDate = (date: Date): LocalDate => {
  return LocalDate.make({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  })
}

/**
 * Create a LocalDate from an Effect DateTime
 * Uses the UTC date components
 */
export const fromDateTime = (dateTime: DateTime.DateTime): LocalDate => {
  const parts = DateTime.toPartsUtc(dateTime)
  return LocalDate.make({ year: parts.year, month: parts.month, day: parts.day })
}

/**
 * Get the current date (UTC)
 */
export const today = (): LocalDate => {
  const now = new Date()
  return fromDate(now)
}

/**
 * Get the current date (UTC) as an Effect using the Clock service
 * This is testable with TestClock
 */
export const todayEffect: Effect.Effect<LocalDate> = Effect.map(
  Effect.clockWith((clock) => clock.currentTimeMillis),
  (millis) => fromDate(new Date(Number(millis)))
)

/**
 * Order for LocalDate - compares chronologically
 */
export const Order_: Order.Order<LocalDate> = Order.make((a, b) => {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1
  if (a.month !== b.month) return a.month < b.month ? -1 : 1
  if (a.day !== b.day) return a.day < b.day ? -1 : 1
  return 0
})

/**
 * Check if first date is before second
 */
export const isBefore = (a: LocalDate, b: LocalDate): boolean => {
  return Order_(a, b) === -1
}

/**
 * Check if first date is after second
 */
export const isAfter = (a: LocalDate, b: LocalDate): boolean => {
  return Order_(a, b) === 1
}

/**
 * Check if two dates are equal
 */
export const equals = (a: LocalDate, b: LocalDate): boolean => {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/**
 * Add days to a LocalDate
 */
export const addDays = (date: LocalDate, days: number): LocalDate => {
  const d = date.toDate()
  d.setUTCDate(d.getUTCDate() + days)
  return fromDate(d)
}

/**
 * Add months to a LocalDate
 */
export const addMonths = (date: LocalDate, months: number): LocalDate => {
  const d = date.toDate()
  d.setUTCMonth(d.getUTCMonth() + months)
  return fromDate(d)
}

/**
 * Add years to a LocalDate
 */
export const addYears = (date: LocalDate, years: number): LocalDate => {
  const d = date.toDate()
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return fromDate(d)
}

/**
 * Get the difference in days between two dates
 */
export const diffInDays = (a: LocalDate, b: LocalDate): number => {
  const msPerDay = 24 * 60 * 60 * 1000
  const dateA = a.toDate()
  const dateB = b.toDate()
  return Math.round((dateA.getTime() - dateB.getTime()) / msPerDay)
}

/**
 * Get the start of the month for a LocalDate
 */
export const startOfMonth = (date: LocalDate): LocalDate => {
  return LocalDate.make({ year: date.year, month: date.month, day: 1 })
}

/**
 * Get the end of the month for a LocalDate
 */
export const endOfMonth = (date: LocalDate): LocalDate => {
  const d = new Date(Date.UTC(date.year, date.month, 0))
  return fromDate(d)
}

/**
 * Get the start of the year for a LocalDate
 */
export const startOfYear = (date: LocalDate): LocalDate => {
  return LocalDate.make({ year: date.year, month: 1, day: 1 })
}

/**
 * Get the end of the year for a LocalDate
 */
export const endOfYear = (date: LocalDate): LocalDate => {
  return LocalDate.make({ year: date.year, month: 12, day: 31 })
}

/**
 * Check if a year is a leap year
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Get the number of days in a month
 */
export const daysInMonth = (year: number, month: number): number => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Regular expression for ISO 8601 date format (YYYY-MM-DD)
 */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * LocalDateFromString - Schema that transforms ISO date strings (YYYY-MM-DD) to LocalDate
 *
 * This schema can be used directly in API URL params, request bodies, and database columns
 * to automatically parse date strings into LocalDate instances.
 *
 * @example
 * ```ts
 * // In API URL params
 * const params = Schema.Struct({
 *   asOfDate: LocalDateFromString
 * })
 *
 * // Decoding
 * const date = yield* Schema.decodeUnknown(LocalDateFromString)("2024-06-15")
 * // date is now LocalDate { year: 2024, month: 6, day: 15 }
 *
 * // Encoding
 * const str = yield* Schema.encode(LocalDateFromString)(date)
 * // str is "2024-06-15"
 * ```
 */
export const LocalDateFromString: Schema.Schema<LocalDate, string> = Schema.transformOrFail(
  Schema.String.annotations({
    description: "ISO 8601 date string in YYYY-MM-DD format",
    examples: ["2024-06-15", "2024-01-01", "2024-12-31"]
  }),
  LocalDate,
  {
    strict: true,
    decode: (dateString, _, ast) => {
      const match = dateString.match(ISO_DATE_PATTERN)
      if (!match) {
        return Effect.fail(
          new ParseResult.Type(
            ast,
            dateString,
            `Expected ISO date format YYYY-MM-DD, but received "${dateString}"`
          )
        )
      }
      const [, yearStr, monthStr, dayStr] = match
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const day = parseInt(dayStr, 10)

      // Validate month range
      if (month < 1 || month > 12) {
        return Effect.fail(
          new ParseResult.Type(
            ast,
            dateString,
            `Invalid month ${month} in date "${dateString}". Month must be between 1 and 12.`
          )
        )
      }

      // Validate day range for the given month
      const maxDays = daysInMonth(year, month)
      if (day < 1 || day > maxDays) {
        return Effect.fail(
          new ParseResult.Type(
            ast,
            dateString,
            `Invalid day ${day} in date "${dateString}". Day must be between 1 and ${maxDays} for ${year}-${String(month).padStart(2, "0")}.`
          )
        )
      }

      return Effect.succeed(LocalDate.make({ year, month, day }))
    },
    encode: (localDate) => {
      // Format as ISO 8601 date string (YYYY-MM-DD)
      const y = String(localDate.year).padStart(4, "0")
      const m = String(localDate.month).padStart(2, "0")
      const d = String(localDate.day).padStart(2, "0")
      return Effect.succeed(`${y}-${m}-${d}`)
    }
  }
).annotations({
  identifier: "LocalDateFromString",
  title: "Local Date from String",
  description: "ISO 8601 date (YYYY-MM-DD) that transforms to/from LocalDate"
})
