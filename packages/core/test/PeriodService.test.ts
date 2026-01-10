import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Layer, Option } from "effect"
import {
  PeriodService,
  PeriodServiceLive,
  FiscalYearRepository,
  FiscalYear,
  FiscalYearId,
  FiscalPeriod,
  FiscalPeriodId,
  FiscalYearOverlapError,
  CompanyNotFoundError,
  InvalidFiscalYearConfigError,
  PeriodNotFoundError,
  HasDraftEntriesError,
  AlreadyClosedError,
  PeriodNotFutureError,
  PeriodLockedError,
  PeriodNotClosedError,
  PeriodNotOpenError,
  ReopenReasonRequiredError,
  PeriodReopenAuditEntry,
  PeriodReopenAuditEntryId,
  isFiscalYearOverlapError,
  isCompanyNotFoundError,
  isInvalidFiscalYearConfigError,
  isPeriodNotFoundError,
  isHasDraftEntriesError,
  isAlreadyClosedError,
  isPeriodNotFutureError,
  isPeriodLockedError,
  isPeriodNotClosedError,
  isPeriodNotOpenError,
  isReopenReasonRequiredError,
  isPeriodReopenAuditEntry,
  isPeriodReopenAuditEntryId,
  isFiscalYear,
  isFiscalPeriod,
  isFiscalYearId,
  isFiscalPeriodId,
  isFiscalYearStatus,
  isFiscalPeriodStatus,
  isFiscalPeriodType,
  type CreateFiscalYearInput,
  type OpenPeriodInput,
  type ClosePeriodInput,
  type SoftClosePeriodInput,
  type ReopenPeriodInput,
  type FiscalYearRepositoryService,
  type CompanyFiscalSettings,
  type ExistingFiscalYearInfo
} from "../src/PeriodService.js"
import { CompanyId, FiscalYearEnd } from "../src/Company.js"
import { LocalDate } from "../src/LocalDate.js"
import { Timestamp } from "../src/Timestamp.js"
import { UserId } from "../src/JournalEntry.js"

describe("PeriodService", () => {
  // Test data constants
  const companyUUID = "550e8400-e29b-41d4-a716-446655440000"
  const fiscalYearUUID = "660e8400-e29b-41d4-a716-446655440001"
  const companyId = CompanyId.make(companyUUID)
  const fiscalYearId = FiscalYearId.make(fiscalYearUUID)

  // Generate period UUIDs
  const generatePeriodIds = (count: number): ReadonlyArray<FiscalPeriodId> => {
    return Array.from({ length: count }, (_, i) =>
      FiscalPeriodId.make(`770e8400-e29b-41d4-a716-44665544${String(i + 1).padStart(4, "0")}`)
    )
  }

  // Test user ID
  const userUUID = "990e8400-e29b-41d4-a716-446655440099"
  const userId = UserId.make(userUUID)

  // Mock repository factory
  const createMockRepository = (options: {
    companySettings?: CompanyFiscalSettings | null
    existingYears?: ReadonlyArray<ExistingFiscalYearInfo>
    periods?: Map<string, FiscalPeriod>
    draftEntryCounts?: Map<string, number>
    auditEntries?: Map<string, PeriodReopenAuditEntry>
  }): FiscalYearRepositoryService => {
    const {
      companySettings = null,
      existingYears = [],
      periods = new Map(),
      draftEntryCounts = new Map(),
      auditEntries = new Map()
    } = options

    return {
      getCompanyFiscalSettings: (_companyId) =>
        Effect.succeed(Option.fromNullable(companySettings)),

      getExistingFiscalYears: (_companyId) =>
        Effect.succeed(existingYears),

      findByCompanyAndYear: (_companyId, _year) =>
        Effect.succeed(Option.none()),

      saveFiscalYear: (fiscalYear) =>
        Effect.succeed(fiscalYear),

      saveFiscalPeriods: (ps) =>
        Effect.succeed(ps),

      findPeriodById: (periodId) =>
        Effect.succeed(Option.fromNullable(periods.get(periodId))),

      updatePeriod: (period) => {
        periods.set(period.id, period)
        return Effect.succeed(period)
      },

      countDraftEntriesInPeriod: (periodId) =>
        Effect.succeed(draftEntryCounts.get(periodId) ?? 0),

      saveReopenAuditEntry: (auditEntry) => {
        auditEntries.set(auditEntry.id, auditEntry)
        return Effect.succeed(auditEntry)
      }
    }
  }

  // Create test layer with mock repository
  const createTestLayer = (options: {
    companySettings?: CompanyFiscalSettings | null
    existingYears?: ReadonlyArray<ExistingFiscalYearInfo>
    periods?: Map<string, FiscalPeriod>
    draftEntryCounts?: Map<string, number>
    auditEntries?: Map<string, PeriodReopenAuditEntry>
  }) => {
    const repoLayer = Layer.succeed(
      FiscalYearRepository,
      createMockRepository(options)
    )

    return PeriodServiceLive.pipe(Layer.provide(repoLayer))
  }

  // Helper to create a test period
  const createTestPeriod = (
    id: string,
    status: "Future" | "Open" | "SoftClose" | "Closed" | "Locked"
  ): FiscalPeriod => {
    return FiscalPeriod.make({
      id: FiscalPeriodId.make(id),
      fiscalYearId,
      periodNumber: 1,
      name: "January 2025",
      periodType: "Regular",
      startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
      endDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
      status,
      closedBy: status === "Closed" || status === "SoftClose" ? Option.some(userId) : Option.none(),
      closedAt: status === "Closed" || status === "SoftClose" ? Option.some(Timestamp.make({ epochMillis: Date.now() })) : Option.none()
    })
  }

  // Default calendar year end settings
  const calendarYearEndSettings: CompanyFiscalSettings = {
    companyId,
    fiscalYearEnd: FiscalYearEnd.make({ month: 12, day: 31 })
  }

  // March fiscal year end settings
  const marchYearEndSettings: CompanyFiscalSettings = {
    companyId,
    fiscalYearEnd: FiscalYearEnd.make({ month: 3, day: 31 })
  }

  // June fiscal year end settings
  const juneYearEndSettings: CompanyFiscalSettings = {
    companyId,
    fiscalYearEnd: FiscalYearEnd.make({ month: 6, day: 30 })
  }

  describe("createFiscalYear", () => {
    describe("successful creation with calendar year end", () => {
      it.effect("creates a fiscal year with 12 periods for calendar year end company", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify fiscal year
          expect(result.fiscalYear.id).toBe(fiscalYearId)
          expect(result.fiscalYear.companyId).toBe(companyId)
          expect(result.fiscalYear.name).toBe("FY2025")
          expect(result.fiscalYear.year).toBe(2025)
          expect(result.fiscalYear.status).toBe("Open")
          expect(result.fiscalYear.includesAdjustmentPeriod).toBe(false)

          // Verify start and end dates
          expect(result.fiscalYear.startDate.year).toBe(2025)
          expect(result.fiscalYear.startDate.month).toBe(1)
          expect(result.fiscalYear.startDate.day).toBe(1)
          expect(result.fiscalYear.endDate.year).toBe(2025)
          expect(result.fiscalYear.endDate.month).toBe(12)
          expect(result.fiscalYear.endDate.day).toBe(31)

          // Verify periods count
          expect(result.periods.length).toBe(12)
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("creates periods with correct monthly dates", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify first period (January)
          const period1 = result.periods[0]
          expect(period1.periodNumber).toBe(1)
          expect(period1.name).toBe("January 2025")
          expect(period1.periodType).toBe("Regular")
          expect(period1.startDate.year).toBe(2025)
          expect(period1.startDate.month).toBe(1)
          expect(period1.startDate.day).toBe(1)
          expect(period1.endDate.year).toBe(2025)
          expect(period1.endDate.month).toBe(1)
          expect(period1.endDate.day).toBe(31)
          expect(period1.status).toBe("Open") // First period is Open

          // Verify February (leap year 2024 test would be different)
          const period2 = result.periods[1]
          expect(period2.periodNumber).toBe(2)
          expect(period2.name).toBe("February 2025")
          expect(period2.startDate.month).toBe(2)
          expect(period2.startDate.day).toBe(1)
          expect(period2.endDate.month).toBe(2)
          expect(period2.endDate.day).toBe(28) // 2025 is not a leap year
          expect(period2.status).toBe("Future") // Other periods are Future

          // Verify last period (December)
          const period12 = result.periods[11]
          expect(period12.periodNumber).toBe(12)
          expect(period12.name).toBe("December 2025")
          expect(period12.startDate.month).toBe(12)
          expect(period12.startDate.day).toBe(1)
          expect(period12.endDate.month).toBe(12)
          expect(period12.endDate.day).toBe(31)
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("creates fiscal year with adjustment period (13 periods)", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: true,
            periodIds: generatePeriodIds(13)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify 13 periods
          expect(result.periods.length).toBe(13)
          expect(result.fiscalYear.includesAdjustmentPeriod).toBe(true)

          // Verify adjustment period
          const period13 = result.periods[12]
          expect(period13.periodNumber).toBe(13)
          expect(period13.name).toBe("Adjustment Period FY2025")
          expect(period13.periodType).toBe("Adjustment")
          // Adjustment period spans entire fiscal year
          expect(period13.startDate.year).toBe(2025)
          expect(period13.startDate.month).toBe(1)
          expect(period13.startDate.day).toBe(1)
          expect(period13.endDate.year).toBe(2025)
          expect(period13.endDate.month).toBe(12)
          expect(period13.endDate.day).toBe(31)
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )
    })

    describe("successful creation with non-calendar year end", () => {
      it.effect("creates fiscal year for March year-end company", () =>
        Effect.gen(function* () {
          // Fiscal year starting April 1, 2024 ending March 31, 2025 = FY2025
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2024, month: 4, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify fiscal year
          expect(result.fiscalYear.name).toBe("FY2025")
          expect(result.fiscalYear.year).toBe(2025)
          expect(result.fiscalYear.startDate.year).toBe(2024)
          expect(result.fiscalYear.startDate.month).toBe(4)
          expect(result.fiscalYear.startDate.day).toBe(1)
          expect(result.fiscalYear.endDate.year).toBe(2025)
          expect(result.fiscalYear.endDate.month).toBe(3)
          expect(result.fiscalYear.endDate.day).toBe(31)

          // Verify first period (April)
          const period1 = result.periods[0]
          expect(period1.name).toBe("April 2024")
          expect(period1.startDate.month).toBe(4)

          // Verify last period (March)
          const period12 = result.periods[11]
          expect(period12.name).toBe("March 2025")
          expect(period12.endDate.year).toBe(2025)
          expect(period12.endDate.month).toBe(3)
          expect(period12.endDate.day).toBe(31)
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: marchYearEndSettings }))
        )
      )

      it.effect("creates fiscal year for June year-end company", () =>
        Effect.gen(function* () {
          // Fiscal year starting July 1, 2024 ending June 30, 2025 = FY2025
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2024, month: 7, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify fiscal year
          expect(result.fiscalYear.name).toBe("FY2025")
          expect(result.fiscalYear.year).toBe(2025)
          expect(result.fiscalYear.endDate.year).toBe(2025)
          expect(result.fiscalYear.endDate.month).toBe(6)
          expect(result.fiscalYear.endDate.day).toBe(30)
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: juneYearEndSettings }))
        )
      )
    })

    describe("validation errors", () => {
      it.effect("fails with CompanyNotFoundError when company doesn't exist", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* Effect.exit(service.createFiscalYear(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isCompanyNotFoundError(result.cause.error)).toBe(true)
            if (isCompanyNotFoundError(result.cause.error)) {
              expect(result.cause.error.companyId).toBe(companyId)
            }
          }
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: null }))
        )
      )

      it.effect("fails with InvalidFiscalYearConfigError when period IDs count is wrong (too few)", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(11) // Need 12, providing 11
          }

          const service = yield* PeriodService
          const result = yield* Effect.exit(service.createFiscalYear(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isInvalidFiscalYearConfigError(result.cause.error)).toBe(true)
            if (isInvalidFiscalYearConfigError(result.cause.error)) {
              expect(result.cause.error.reason).toContain("12")
              expect(result.cause.error.reason).toContain("11")
            }
          }
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("fails with InvalidFiscalYearConfigError when period IDs count is wrong (too many)", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(13) // Need 12, providing 13
          }

          const service = yield* PeriodService
          const result = yield* Effect.exit(service.createFiscalYear(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isInvalidFiscalYearConfigError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("fails with InvalidFiscalYearConfigError when adjustment period requested but wrong period count", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: true,
            periodIds: generatePeriodIds(12) // Need 13 for adjustment period, providing 12
          }

          const service = yield* PeriodService
          const result = yield* Effect.exit(service.createFiscalYear(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isInvalidFiscalYearConfigError(result.cause.error)).toBe(true)
            if (isInvalidFiscalYearConfigError(result.cause.error)) {
              expect(result.cause.error.reason).toContain("13")
              expect(result.cause.error.reason).toContain("12")
            }
          }
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("fails with FiscalYearOverlapError when year overlaps existing year", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 6, day: 1 }), // Overlaps with existing
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* Effect.exit(service.createFiscalYear(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isFiscalYearOverlapError(result.cause.error)).toBe(true)
            if (isFiscalYearOverlapError(result.cause.error)) {
              expect(result.cause.error.existingYearName).toBe("FY2025")
            }
          }
        }).pipe(
          Effect.provide(createTestLayer({
            companySettings: calendarYearEndSettings,
            existingYears: [{
              id: FiscalYearId.make("880e8400-e29b-41d4-a716-446655440002"),
              name: "FY2025",
              startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
              endDate: LocalDate.make({ year: 2025, month: 12, day: 31 })
            }]
          }))
        )
      )

      it.effect("succeeds when new year does not overlap existing years", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }), // Does not overlap
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          expect(result.fiscalYear.year).toBe(2025)
          expect(result.periods.length).toBe(12)
        }).pipe(
          Effect.provide(createTestLayer({
            companySettings: calendarYearEndSettings,
            existingYears: [{
              id: FiscalYearId.make("880e8400-e29b-41d4-a716-446655440002"),
              name: "FY2024",
              startDate: LocalDate.make({ year: 2024, month: 1, day: 1 }),
              endDate: LocalDate.make({ year: 2024, month: 12, day: 31 })
            }]
          }))
        )
      )
    })

    describe("edge cases", () => {
      it.effect("handles leap year correctly (February 29)", () =>
        Effect.gen(function* () {
          // 2024 is a leap year
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2024, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify February has 29 days in 2024
          const period2 = result.periods[1]
          expect(period2.endDate.month).toBe(2)
          expect(period2.endDate.day).toBe(29)
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("creates periods with correct sequential period numbers", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: true,
            periodIds: generatePeriodIds(13)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify all period numbers are sequential
          result.periods.forEach((period, index) => {
            expect(period.periodNumber).toBe(index + 1)
          })
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("assigns correct period IDs from input", () =>
        Effect.gen(function* () {
          const periodIds = generatePeriodIds(12)
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify each period has the correct ID
          result.periods.forEach((period, index) => {
            expect(period.id).toBe(periodIds[index])
          })
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("links all periods to the fiscal year ID", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            includeAdjustmentPeriod: false,
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          // Verify all periods reference the fiscal year
          result.periods.forEach((period) => {
            expect(period.fiscalYearId).toBe(fiscalYearId)
          })
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )

      it.effect("defaults includeAdjustmentPeriod to false", () =>
        Effect.gen(function* () {
          const input: CreateFiscalYearInput = {
            fiscalYearId,
            companyId,
            startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
            // Note: includeAdjustmentPeriod not specified
            periodIds: generatePeriodIds(12)
          }

          const service = yield* PeriodService
          const result = yield* service.createFiscalYear(input)

          expect(result.fiscalYear.includesAdjustmentPeriod).toBe(false)
          expect(result.periods.length).toBe(12)
        }).pipe(
          Effect.provide(createTestLayer({ companySettings: calendarYearEndSettings }))
        )
      )
    })
  })

  describe("FiscalYear entity", () => {
    it("has correct properties and methods", () => {
      const fiscalYear = FiscalYear.make({
        id: fiscalYearId,
        companyId,
        name: "FY2025",
        year: 2025,
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 12, day: 31 }),
        status: "Open",
        includesAdjustmentPeriod: false,
        createdAt: Timestamp.make({ epochMillis: Date.now() })
      })

      expect(fiscalYear.isOpen).toBe(true)
      expect(fiscalYear.isClosed).toBe(false)
      expect(fiscalYear.isClosing).toBe(false)
      expect(fiscalYear.toString()).toBe("FY2025")
    })

    it("recognizes Closed status", () => {
      const fiscalYear = FiscalYear.make({
        id: fiscalYearId,
        companyId,
        name: "FY2025",
        year: 2025,
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 12, day: 31 }),
        status: "Closed",
        includesAdjustmentPeriod: false,
        createdAt: Timestamp.make({ epochMillis: Date.now() })
      })

      expect(fiscalYear.isOpen).toBe(false)
      expect(fiscalYear.isClosed).toBe(true)
      expect(fiscalYear.isClosing).toBe(false)
    })

    it("recognizes Closing status", () => {
      const fiscalYear = FiscalYear.make({
        id: fiscalYearId,
        companyId,
        name: "FY2025",
        year: 2025,
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 12, day: 31 }),
        status: "Closing",
        includesAdjustmentPeriod: false,
        createdAt: Timestamp.make({ epochMillis: Date.now() })
      })

      expect(fiscalYear.isOpen).toBe(false)
      expect(fiscalYear.isClosed).toBe(false)
      expect(fiscalYear.isClosing).toBe(true)
    })
  })

  describe("FiscalPeriod entity", () => {
    it("has correct properties and methods for regular period", () => {
      const period = FiscalPeriod.make({
        id: FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001"),
        fiscalYearId,
        periodNumber: 1,
        name: "January 2025",
        periodType: "Regular",
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
        status: "Open",
        closedBy: Option.none(),
        closedAt: Option.none()
      })

      expect(period.isOpenForPosting).toBe(true)
      expect(period.allowsLimitedPosting).toBe(true)
      expect(period.isAdjustmentPeriod).toBe(false)
      expect(period.isRegularPeriod).toBe(true)
      expect(period.toString()).toBe("January 2025")
    })

    it("has correct properties for adjustment period", () => {
      const period = FiscalPeriod.make({
        id: FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440013"),
        fiscalYearId,
        periodNumber: 13,
        name: "Adjustment Period FY2025",
        periodType: "Adjustment",
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 12, day: 31 }),
        status: "Future",
        closedBy: Option.none(),
        closedAt: Option.none()
      })

      expect(period.isAdjustmentPeriod).toBe(true)
      expect(period.isRegularPeriod).toBe(false)
      expect(period.isOpenForPosting).toBe(false)
      expect(period.allowsLimitedPosting).toBe(false)
    })

    it("recognizes SoftClose status allows limited posting", () => {
      const period = FiscalPeriod.make({
        id: FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001"),
        fiscalYearId,
        periodNumber: 1,
        name: "January 2025",
        periodType: "Regular",
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
        status: "SoftClose",
        closedBy: Option.none(),
        closedAt: Option.none()
      })

      expect(period.isOpenForPosting).toBe(false)
      expect(period.allowsLimitedPosting).toBe(true)
    })

    it("recognizes Closed and Locked statuses", () => {
      const closedPeriod = FiscalPeriod.make({
        id: FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001"),
        fiscalYearId,
        periodNumber: 1,
        name: "January 2025",
        periodType: "Regular",
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
        status: "Closed",
        closedBy: Option.none(),
        closedAt: Option.none()
      })

      const lockedPeriod = FiscalPeriod.make({
        id: FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440002"),
        fiscalYearId,
        periodNumber: 2,
        name: "February 2025",
        periodType: "Regular",
        startDate: LocalDate.make({ year: 2025, month: 2, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 2, day: 28 }),
        status: "Locked",
        closedBy: Option.none(),
        closedAt: Option.none()
      })

      expect(closedPeriod.isOpenForPosting).toBe(false)
      expect(closedPeriod.allowsLimitedPosting).toBe(false)

      expect(lockedPeriod.isOpenForPosting).toBe(false)
      expect(lockedPeriod.allowsLimitedPosting).toBe(false)
    })
  })

  describe("type guards", () => {
    it("isFiscalYear returns true for FiscalYear instances", () => {
      const fiscalYear = FiscalYear.make({
        id: fiscalYearId,
        companyId,
        name: "FY2025",
        year: 2025,
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 12, day: 31 }),
        status: "Open",
        includesAdjustmentPeriod: false,
        createdAt: Timestamp.make({ epochMillis: Date.now() })
      })
      expect(isFiscalYear(fiscalYear)).toBe(true)
    })

    it("isFiscalPeriod returns true for FiscalPeriod instances", () => {
      const period = FiscalPeriod.make({
        id: FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001"),
        fiscalYearId,
        periodNumber: 1,
        name: "January 2025",
        periodType: "Regular",
        startDate: LocalDate.make({ year: 2025, month: 1, day: 1 }),
        endDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
        status: "Open",
        closedBy: Option.none(),
        closedAt: Option.none()
      })
      expect(isFiscalPeriod(period)).toBe(true)
    })

    it("isFiscalYearId returns true for valid FiscalYearId", () => {
      expect(isFiscalYearId(fiscalYearId)).toBe(true)
    })

    it("isFiscalPeriodId returns true for valid FiscalPeriodId", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      expect(isFiscalPeriodId(periodId)).toBe(true)
    })

    it("isFiscalYearStatus returns true for valid statuses", () => {
      expect(isFiscalYearStatus("Open")).toBe(true)
      expect(isFiscalYearStatus("Closing")).toBe(true)
      expect(isFiscalYearStatus("Closed")).toBe(true)
      expect(isFiscalYearStatus("Invalid")).toBe(false)
    })

    it("isFiscalPeriodStatus returns true for valid statuses", () => {
      expect(isFiscalPeriodStatus("Future")).toBe(true)
      expect(isFiscalPeriodStatus("Open")).toBe(true)
      expect(isFiscalPeriodStatus("SoftClose")).toBe(true)
      expect(isFiscalPeriodStatus("Closed")).toBe(true)
      expect(isFiscalPeriodStatus("Locked")).toBe(true)
      expect(isFiscalPeriodStatus("Invalid")).toBe(false)
    })

    it("isFiscalPeriodType returns true for valid types", () => {
      expect(isFiscalPeriodType("Regular")).toBe(true)
      expect(isFiscalPeriodType("Adjustment")).toBe(true)
      expect(isFiscalPeriodType("Closing")).toBe(true)
      expect(isFiscalPeriodType("Invalid")).toBe(false)
    })
  })

  describe("error type guards and messages", () => {
    it("FiscalYearOverlapError has correct message", () => {
      const error = new FiscalYearOverlapError({
        companyId,
        newYearStart: { year: 2025, month: 1, day: 1 },
        newYearEnd: { year: 2025, month: 12, day: 31 },
        existingYearId: FiscalYearId.make("880e8400-e29b-41d4-a716-446655440002"),
        existingYearName: "FY2025"
      })
      expect(error.message).toContain("overlaps")
      expect(error.message).toContain("FY2025")
      expect(isFiscalYearOverlapError(error)).toBe(true)
    })

    it("CompanyNotFoundError has correct message", () => {
      const error = new CompanyNotFoundError({ companyId })
      expect(error.message).toContain("Company not found")
      expect(error.message).toContain(companyUUID)
      expect(isCompanyNotFoundError(error)).toBe(true)
    })

    it("InvalidFiscalYearConfigError has correct message", () => {
      const error = new InvalidFiscalYearConfigError({ reason: "Test reason" })
      expect(error.message).toContain("Invalid fiscal year configuration")
      expect(error.message).toContain("Test reason")
      expect(isInvalidFiscalYearConfigError(error)).toBe(true)
    })

    it("error type guards return false for other values", () => {
      expect(isFiscalYearOverlapError(null)).toBe(false)
      expect(isFiscalYearOverlapError(undefined)).toBe(false)
      expect(isFiscalYearOverlapError(new Error("test"))).toBe(false)
      expect(isFiscalYearOverlapError({ _tag: "FiscalYearOverlapError" })).toBe(false)

      expect(isCompanyNotFoundError(null)).toBe(false)
      expect(isCompanyNotFoundError(undefined)).toBe(false)

      expect(isInvalidFiscalYearConfigError(null)).toBe(false)
      expect(isInvalidFiscalYearConfigError(undefined)).toBe(false)
    })

    it("PeriodNotFoundError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new PeriodNotFoundError({ periodId })
      expect(error.message).toContain("Fiscal period not found")
      expect(error.message).toContain(periodId)
      expect(isPeriodNotFoundError(error)).toBe(true)
    })

    it("HasDraftEntriesError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new HasDraftEntriesError({ periodId, draftEntryCount: 5 })
      expect(error.message).toContain("Cannot close period")
      expect(error.message).toContain("5 draft entries")
      expect(isHasDraftEntriesError(error)).toBe(true)
    })

    it("AlreadyClosedError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new AlreadyClosedError({ periodId, currentStatus: "Closed" })
      expect(error.message).toContain("already Closed")
      expect(isAlreadyClosedError(error)).toBe(true)
    })

    it("PeriodNotFutureError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new PeriodNotFutureError({ periodId, currentStatus: "Open" })
      expect(error.message).toContain("Cannot open period")
      expect(error.message).toContain("must be Future")
      expect(isPeriodNotFutureError(error)).toBe(true)
    })

    it("PeriodLockedError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new PeriodLockedError({ periodId })
      expect(error.message).toContain("locked")
      expect(error.message).toContain("cannot be modified")
      expect(isPeriodLockedError(error)).toBe(true)
    })

    it("PeriodNotClosedError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new PeriodNotClosedError({ periodId, currentStatus: "Open" })
      expect(error.message).toContain("Cannot reopen period")
      expect(error.message).toContain("must be Closed")
      expect(isPeriodNotClosedError(error)).toBe(true)
    })

    it("PeriodNotOpenError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new PeriodNotOpenError({ periodId, currentStatus: "Future" })
      expect(error.message).toContain("Cannot modify period")
      expect(error.message).toContain("must be Open")
      expect(isPeriodNotOpenError(error)).toBe(true)
    })

    it("ReopenReasonRequiredError has correct message", () => {
      const periodId = FiscalPeriodId.make("770e8400-e29b-41d4-a716-446655440001")
      const error = new ReopenReasonRequiredError({ periodId })
      expect(error.message).toContain("requires a reason")
      expect(error.message).toContain("audit trail")
      expect(isReopenReasonRequiredError(error)).toBe(true)
    })

    it("new error type guards return false for other values", () => {
      expect(isPeriodNotFoundError(null)).toBe(false)
      expect(isHasDraftEntriesError(null)).toBe(false)
      expect(isAlreadyClosedError(null)).toBe(false)
      expect(isPeriodNotFutureError(null)).toBe(false)
      expect(isPeriodLockedError(null)).toBe(false)
      expect(isPeriodNotClosedError(null)).toBe(false)
      expect(isPeriodNotOpenError(null)).toBe(false)
      expect(isReopenReasonRequiredError(null)).toBe(false)
    })
  })

  describe("openPeriod", () => {
    const testPeriodUUID = "770e8400-e29b-41d4-a716-446655440001"
    const testPeriodId = FiscalPeriodId.make(testPeriodUUID)

    it.effect("successfully opens a Future period", () =>
      Effect.gen(function* () {
        const periods = new Map<string, FiscalPeriod>()
        const period = createTestPeriod(testPeriodUUID, "Future")
        periods.set(testPeriodUUID, period)

        const input: OpenPeriodInput = { periodId: testPeriodId }

        const service = yield* PeriodService
        const result = yield* service.openPeriod(input)

        expect(result.id).toBe(testPeriodId)
        expect(result.status).toBe("Open")
      }).pipe(
        Effect.provide(createTestLayer({ periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Future")]]) }))
      )
    )

    it.effect("fails with PeriodNotFoundError when period doesn't exist", () =>
      Effect.gen(function* () {
        const input: OpenPeriodInput = { periodId: testPeriodId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.openPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotFoundError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({}))
      )
    )

    it.effect("fails with PeriodNotFutureError when period is Open", () =>
      Effect.gen(function* () {
        const input: OpenPeriodInput = { periodId: testPeriodId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.openPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotFutureError(result.cause.error)).toBe(true)
          if (isPeriodNotFutureError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Open")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({ periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Open")]]) }))
      )
    )

    it.effect("fails with PeriodNotFutureError when period is Closed", () =>
      Effect.gen(function* () {
        const input: OpenPeriodInput = { periodId: testPeriodId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.openPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotFutureError(result.cause.error)).toBe(true)
          if (isPeriodNotFutureError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Closed")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({ periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Closed")]]) }))
      )
    )
  })

  describe("closePeriod", () => {
    const testPeriodUUID = "770e8400-e29b-41d4-a716-446655440001"
    const testPeriodId = FiscalPeriodId.make(testPeriodUUID)

    it.effect("successfully closes an Open period with no draft entries", () =>
      Effect.gen(function* () {
        const input: ClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* service.closePeriod(input)

        expect(result.id).toBe(testPeriodId)
        expect(result.status).toBe("Closed")
        expect(Option.isSome(result.closedBy)).toBe(true)
        expect(Option.isSome(result.closedAt)).toBe(true)
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Open")]]),
          draftEntryCounts: new Map([[testPeriodUUID, 0]])
        }))
      )
    )

    it.effect("successfully closes a SoftClose period with no draft entries", () =>
      Effect.gen(function* () {
        const input: ClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* service.closePeriod(input)

        expect(result.id).toBe(testPeriodId)
        expect(result.status).toBe("Closed")
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "SoftClose")]]),
          draftEntryCounts: new Map([[testPeriodUUID, 0]])
        }))
      )
    )

    it.effect("fails with PeriodNotFoundError when period doesn't exist", () =>
      Effect.gen(function* () {
        const input: ClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.closePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotFoundError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({}))
      )
    )

    it.effect("fails with HasDraftEntriesError when draft entries exist", () =>
      Effect.gen(function* () {
        const input: ClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.closePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isHasDraftEntriesError(result.cause.error)).toBe(true)
          if (isHasDraftEntriesError(result.cause.error)) {
            expect(result.cause.error.draftEntryCount).toBe(3)
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Open")]]),
          draftEntryCounts: new Map([[testPeriodUUID, 3]])
        }))
      )
    )

    it.effect("fails with PeriodLockedError when period is Locked", () =>
      Effect.gen(function* () {
        const input: ClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.closePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodLockedError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Locked")]])
        }))
      )
    )

    it.effect("fails with AlreadyClosedError when period is already Closed", () =>
      Effect.gen(function* () {
        const input: ClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.closePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isAlreadyClosedError(result.cause.error)).toBe(true)
          if (isAlreadyClosedError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Closed")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Closed")]])
        }))
      )
    )

    it.effect("fails with PeriodNotOpenError when period is Future", () =>
      Effect.gen(function* () {
        const input: ClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.closePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotOpenError(result.cause.error)).toBe(true)
          if (isPeriodNotOpenError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Future")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Future")]])
        }))
      )
    )
  })

  describe("softClosePeriod", () => {
    const testPeriodUUID = "770e8400-e29b-41d4-a716-446655440001"
    const testPeriodId = FiscalPeriodId.make(testPeriodUUID)

    it.effect("successfully soft closes an Open period", () =>
      Effect.gen(function* () {
        const input: SoftClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* service.softClosePeriod(input)

        expect(result.id).toBe(testPeriodId)
        expect(result.status).toBe("SoftClose")
        expect(Option.isSome(result.closedBy)).toBe(true)
        expect(Option.isSome(result.closedAt)).toBe(true)
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Open")]])
        }))
      )
    )

    it.effect("fails with PeriodNotFoundError when period doesn't exist", () =>
      Effect.gen(function* () {
        const input: SoftClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.softClosePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotFoundError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({}))
      )
    )

    it.effect("fails with PeriodLockedError when period is Locked", () =>
      Effect.gen(function* () {
        const input: SoftClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.softClosePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodLockedError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Locked")]])
        }))
      )
    )

    it.effect("fails with AlreadyClosedError when period is Closed", () =>
      Effect.gen(function* () {
        const input: SoftClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.softClosePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isAlreadyClosedError(result.cause.error)).toBe(true)
          if (isAlreadyClosedError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Closed")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Closed")]])
        }))
      )
    )

    it.effect("fails with AlreadyClosedError when period is already SoftClose", () =>
      Effect.gen(function* () {
        const input: SoftClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.softClosePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isAlreadyClosedError(result.cause.error)).toBe(true)
          if (isAlreadyClosedError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("SoftClose")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "SoftClose")]])
        }))
      )
    )

    it.effect("fails with PeriodNotOpenError when period is Future", () =>
      Effect.gen(function* () {
        const input: SoftClosePeriodInput = { periodId: testPeriodId, closedBy: userId }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.softClosePeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotOpenError(result.cause.error)).toBe(true)
          if (isPeriodNotOpenError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Future")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Future")]])
        }))
      )
    )
  })

  describe("reopenPeriod", () => {
    const testPeriodUUID = "770e8400-e29b-41d4-a716-446655440001"
    const testPeriodId = FiscalPeriodId.make(testPeriodUUID)
    const auditEntryUUID = "880e8400-e29b-41d4-a716-446655440088"
    const auditEntryId = PeriodReopenAuditEntryId.make(auditEntryUUID)

    it.effect("successfully reopens a Closed period with reason", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "Need to post additional adjustments",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* service.reopenPeriod(input)

        expect(result.period.id).toBe(testPeriodId)
        expect(result.period.status).toBe("Open")
        expect(Option.isNone(result.period.closedBy)).toBe(true)
        expect(Option.isNone(result.period.closedAt)).toBe(true)

        expect(result.auditEntry.id).toBe(auditEntryId)
        expect(result.auditEntry.periodId).toBe(testPeriodId)
        expect(result.auditEntry.reopenedBy).toBe(userId)
        expect(result.auditEntry.reason).toBe("Need to post additional adjustments")
        expect(result.auditEntry.previousStatus).toBe("Closed")
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Closed")]])
        }))
      )
    )

    it.effect("fails with PeriodNotFoundError when period doesn't exist", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "Test reason",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.reopenPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotFoundError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({}))
      )
    )

    it.effect("fails with ReopenReasonRequiredError when reason is empty", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.reopenPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isReopenReasonRequiredError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Closed")]])
        }))
      )
    )

    it.effect("fails with ReopenReasonRequiredError when reason is whitespace only", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "   ",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.reopenPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isReopenReasonRequiredError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Closed")]])
        }))
      )
    )

    it.effect("fails with PeriodLockedError when period is Locked", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "Test reason",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.reopenPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodLockedError(result.cause.error)).toBe(true)
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Locked")]])
        }))
      )
    )

    it.effect("fails with PeriodNotClosedError when period is Open", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "Test reason",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.reopenPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotClosedError(result.cause.error)).toBe(true)
          if (isPeriodNotClosedError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Open")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Open")]])
        }))
      )
    )

    it.effect("fails with PeriodNotClosedError when period is SoftClose", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "Test reason",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.reopenPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotClosedError(result.cause.error)).toBe(true)
          if (isPeriodNotClosedError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("SoftClose")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "SoftClose")]])
        }))
      )
    )

    it.effect("fails with PeriodNotClosedError when period is Future", () =>
      Effect.gen(function* () {
        const input: ReopenPeriodInput = {
          periodId: testPeriodId,
          reopenedBy: userId,
          reason: "Test reason",
          auditEntryId
        }

        const service = yield* PeriodService
        const result = yield* Effect.exit(service.reopenPeriod(input))

        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result) && result.cause._tag === "Fail") {
          expect(isPeriodNotClosedError(result.cause.error)).toBe(true)
          if (isPeriodNotClosedError(result.cause.error)) {
            expect(result.cause.error.currentStatus).toBe("Future")
          }
        }
      }).pipe(
        Effect.provide(createTestLayer({
          periods: new Map([[testPeriodUUID, createTestPeriod(testPeriodUUID, "Future")]])
        }))
      )
    )
  })

  describe("PeriodReopenAuditEntry entity", () => {
    const testPeriodUUID = "770e8400-e29b-41d4-a716-446655440001"
    const testPeriodId = FiscalPeriodId.make(testPeriodUUID)
    const auditEntryUUID = "880e8400-e29b-41d4-a716-446655440088"
    const auditEntryId = PeriodReopenAuditEntryId.make(auditEntryUUID)

    it("has correct properties", () => {
      const auditEntry = PeriodReopenAuditEntry.make({
        id: auditEntryId,
        periodId: testPeriodId,
        reason: "Adjustment posting required",
        reopenedBy: userId,
        reopenedAt: Timestamp.make({ epochMillis: Date.now() }),
        previousStatus: "Closed"
      })

      expect(auditEntry.id).toBe(auditEntryId)
      expect(auditEntry.periodId).toBe(testPeriodId)
      expect(auditEntry.reason).toBe("Adjustment posting required")
      expect(auditEntry.reopenedBy).toBe(userId)
      expect(auditEntry.previousStatus).toBe("Closed")
      expect(auditEntry.toString()).toContain("reopened by")
    })

    it("isPeriodReopenAuditEntry returns true for valid instances", () => {
      const auditEntry = PeriodReopenAuditEntry.make({
        id: auditEntryId,
        periodId: testPeriodId,
        reason: "Test reason",
        reopenedBy: userId,
        reopenedAt: Timestamp.make({ epochMillis: Date.now() }),
        previousStatus: "Closed"
      })
      expect(isPeriodReopenAuditEntry(auditEntry)).toBe(true)
    })

    it("isPeriodReopenAuditEntryId returns true for valid ID", () => {
      expect(isPeriodReopenAuditEntryId(auditEntryId)).toBe(true)
      expect(isPeriodReopenAuditEntryId("not-a-uuid")).toBe(false)
    })
  })
})
