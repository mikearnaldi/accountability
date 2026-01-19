import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  JournalEntryId,
  isJournalEntryId,
  EntryNumber,
  isEntryNumber,
  JournalEntryType,
  isJournalEntryType,
  JournalEntryStatus,
  isJournalEntryStatus,
  SourceModule,
  isSourceModule,
  UserId,
  isUserId,
  JournalEntry,
  isJournalEntry
} from "../../src/journal/JournalEntry.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("JournalEntryId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = JournalEntryId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = JournalEntryId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryId)
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isJournalEntryId returns true for valid JournalEntryId", () => {
      const id = JournalEntryId.make(validUUID)
      expect(isJournalEntryId(id)).toBe(true)
    })

    it("isJournalEntryId returns true for plain UUID string (validates pattern)", () => {
      expect(isJournalEntryId(validUUID)).toBe(true)
    })

    it("isJournalEntryId returns false for non-string values", () => {
      expect(isJournalEntryId(null)).toBe(false)
      expect(isJournalEntryId(undefined)).toBe(false)
      expect(isJournalEntryId(123)).toBe(false)
      expect(isJournalEntryId({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates JournalEntryId using Schema's .make()", () => {
      const id = JournalEntryId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isJournalEntryId(id)).toBe(true)
    })
  })
})

describe("EntryNumber", () => {
  describe("validation", () => {
    it.effect("accepts valid entry number formats", () =>
      Effect.gen(function* () {
        const formats = [
          "JE-2025-00001",
          "2025-001",
          "GL00001",
          "JE001",
          "12345"
        ]
        for (const format of formats) {
          const number = EntryNumber.make(format)
          expect(number).toBe(format)
        }
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EntryNumber)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(EntryNumber)
        const result = yield* Effect.exit(decode("   "))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isEntryNumber returns true for valid entry numbers", () => {
      const number = EntryNumber.make("JE-2025-00001")
      expect(isEntryNumber(number)).toBe(true)
    })

    it("isEntryNumber returns false for invalid values", () => {
      expect(isEntryNumber("")).toBe(false)
      expect(isEntryNumber(null)).toBe(false)
      expect(isEntryNumber(undefined)).toBe(false)
      expect(isEntryNumber(123)).toBe(false)
    })
  })
})

describe("JournalEntryType", () => {
  const allTypes = [
    "Standard",
    "Adjusting",
    "Closing",
    "Opening",
    "Reversing",
    "Recurring",
    "Intercompany",
    "Revaluation",
    "Elimination",
    "System"
  ] as const

  describe("validation", () => {
    it.effect("accepts all valid entry types", () =>
      Effect.gen(function* () {
        for (const type of allTypes) {
          const result = yield* Schema.decodeUnknown(JournalEntryType)(type)
          expect(result).toBe(type)
        }
      })
    )

    it.effect("rejects invalid entry types", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryType)
        const result = yield* Effect.exit(decode("InvalidType"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryType)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryType)
        const result = yield* Effect.exit(decode(123))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isJournalEntryType returns true for valid types", () => {
      for (const type of allTypes) {
        expect(isJournalEntryType(type)).toBe(true)
      }
    })

    it("isJournalEntryType returns false for invalid types", () => {
      expect(isJournalEntryType("InvalidType")).toBe(false)
      expect(isJournalEntryType("")).toBe(false)
      expect(isJournalEntryType(null)).toBe(false)
      expect(isJournalEntryType(undefined)).toBe(false)
    })
  })
})

describe("JournalEntryStatus", () => {
  const allStatuses = [
    "Draft",
    "PendingApproval",
    "Approved",
    "Posted",
    "Reversed"
  ] as const

  describe("validation", () => {
    it.effect("accepts all valid statuses", () =>
      Effect.gen(function* () {
        for (const status of allStatuses) {
          const result = yield* Schema.decodeUnknown(JournalEntryStatus)(status)
          expect(result).toBe(status)
        }
      })
    )

    it.effect("rejects invalid statuses", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryStatus)
        const result = yield* Effect.exit(decode("InvalidStatus"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryStatus)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects non-string values", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntryStatus)
        const result = yield* Effect.exit(decode(123))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isJournalEntryStatus returns true for valid statuses", () => {
      for (const status of allStatuses) {
        expect(isJournalEntryStatus(status)).toBe(true)
      }
    })

    it("isJournalEntryStatus returns false for invalid statuses", () => {
      expect(isJournalEntryStatus("InvalidStatus")).toBe(false)
      expect(isJournalEntryStatus("")).toBe(false)
      expect(isJournalEntryStatus(null)).toBe(false)
      expect(isJournalEntryStatus(undefined)).toBe(false)
    })
  })
})

describe("SourceModule", () => {
  const allModules = [
    "GeneralLedger",
    "AccountsPayable",
    "AccountsReceivable",
    "FixedAssets",
    "Inventory",
    "Payroll",
    "Consolidation"
  ] as const

  describe("validation", () => {
    it.effect("accepts all valid source modules", () =>
      Effect.gen(function* () {
        for (const module of allModules) {
          const result = yield* Schema.decodeUnknown(SourceModule)(module)
          expect(result).toBe(module)
        }
      })
    )

    it.effect("rejects invalid source modules", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(SourceModule)
        const result = yield* Effect.exit(decode("InvalidModule"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(SourceModule)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isSourceModule returns true for valid modules", () => {
      for (const module of allModules) {
        expect(isSourceModule(module)).toBe(true)
      }
    })

    it("isSourceModule returns false for invalid modules", () => {
      expect(isSourceModule("InvalidModule")).toBe(false)
      expect(isSourceModule("")).toBe(false)
      expect(isSourceModule(null)).toBe(false)
    })
  })
})

describe("UserId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = UserId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(UserId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isUserId returns true for valid UserId", () => {
      const id = UserId.make(validUUID)
      expect(isUserId(id)).toBe(true)
    })

    it("isUserId returns false for invalid values", () => {
      expect(isUserId("not-a-uuid")).toBe(false)
      expect(isUserId(null)).toBe(false)
    })
  })
})

describe("JournalEntry", () => {
  const entryUUID = "550e8400-e29b-41d4-a716-446655440000"
  const companyUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const userUUID = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const reversedEntryUUID = "8ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const reversingEntryUUID = "9ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createDraftEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.none(),
      referenceNumber: Option.some("INV-2025-001"),
      description: "Monthly rent payment",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
      postingDate: Option.none(),
      documentDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 14 })),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Standard",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.some("RENT-JAN-2025"),
      isMultiCurrency: false,
      status: "Draft",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.none(),
      postedAt: Option.none()
    })
  }

  const createPendingApprovalEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.none(),
      referenceNumber: Option.none(),
      description: "Adjusting entry for accrued expenses",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
      postingDate: Option.none(),
      documentDate: Option.none(),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Adjusting",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.none(),
      isMultiCurrency: false,
      status: "PendingApproval",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.none(),
      postedAt: Option.none()
    })
  }

  const createApprovedEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.none(),
      referenceNumber: Option.none(),
      description: "Approved entry awaiting posting",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
      postingDate: Option.none(),
      documentDate: Option.none(),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Standard",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.none(),
      isMultiCurrency: false,
      status: "Approved",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.none(),
      postedAt: Option.none()
    })
  }

  const createPostedEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.some(EntryNumber.make("JE-2025-00001")),
      referenceNumber: Option.some("INV-2025-001"),
      description: "Posted monthly rent payment",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
      postingDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 16 })),
      documentDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 14 })),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Standard",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.some("RENT-JAN-2025"),
      isMultiCurrency: false,
      status: "Posted",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.some(UserId.make(userUUID)),
      postedAt: Option.some(Timestamp.make({ epochMillis: 1718496000000 }))
    })
  }

  const createReversedEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.some(EntryNumber.make("JE-2025-00001")),
      referenceNumber: Option.some("INV-2025-001"),
      description: "Reversed monthly rent payment",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
      postingDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 16 })),
      documentDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 14 })),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Standard",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.some("RENT-JAN-2025"),
      isMultiCurrency: false,
      status: "Reversed",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.some(JournalEntryId.make(reversingEntryUUID)),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.some(UserId.make(userUUID)),
      postedAt: Option.some(Timestamp.make({ epochMillis: 1718496000000 }))
    })
  }

  const createReversalEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(reversingEntryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.some(EntryNumber.make("JE-2025-00002")),
      referenceNumber: Option.some("REV-INV-2025-001"),
      description: "Reversal of monthly rent payment",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 20 }),
      postingDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 20 })),
      documentDate: Option.none(),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Reversing",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.none(),
      isMultiCurrency: false,
      status: "Posted",
      isReversing: true,
      reversedEntryId: Option.some(JournalEntryId.make(reversedEntryUUID)),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718582400000 }),
      postedBy: Option.some(UserId.make(userUUID)),
      postedAt: Option.some(Timestamp.make({ epochMillis: 1718582400000 }))
    })
  }

  const createMultiCurrencyEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.none(),
      referenceNumber: Option.some("FX-2025-001"),
      description: "Multi-currency transaction",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
      postingDate: Option.none(),
      documentDate: Option.none(),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Standard",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.none(),
      isMultiCurrency: true,
      status: "Draft",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.none(),
      postedAt: Option.none()
    })
  }

  const createIntercompanyEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.some(EntryNumber.make("IC-2025-00001")),
      referenceNumber: Option.some("IC-SALES-001"),
      description: "Intercompany sales transaction",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
      postingDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 15 })),
      documentDate: Option.none(),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "Intercompany",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.some("IC-DOC-001"),
      isMultiCurrency: false,
      status: "Posted",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.some(UserId.make(userUUID)),
      postedAt: Option.some(Timestamp.make({ epochMillis: 1718409600000 }))
    })
  }

  const createSystemEntry = () => {
    return JournalEntry.make({
      id: JournalEntryId.make(entryUUID),
      companyId: CompanyId.make(companyUUID),
      entryNumber: Option.some(EntryNumber.make("SYS-2025-00001")),
      referenceNumber: Option.none(),
      description: "System-generated depreciation entry",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 31 }),
      postingDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 31 })),
      documentDate: Option.none(),
      fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
      entryType: "System",
      sourceModule: "FixedAssets",
      sourceDocumentRef: Option.some("DEP-JAN-2025"),
      isMultiCurrency: false,
      status: "Posted",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      postedBy: Option.some(UserId.make(userUUID)),
      postedAt: Option.some(Timestamp.make({ epochMillis: 1718409600000 }))
    })
  }

  describe("validation", () => {
    it.effect("accepts valid draft entry data", () =>
      Effect.gen(function* () {
        const entry = createDraftEntry()
        expect(entry.id).toBe(entryUUID)
        expect(entry.description).toBe("Monthly rent payment")
        expect(entry.status).toBe("Draft")
        expect(entry.entryType).toBe("Standard")
        expect(entry.sourceModule).toBe("GeneralLedger")
        expect(Option.isNone(entry.entryNumber)).toBe(true)
        expect(Option.isSome(entry.referenceNumber)).toBe(true)
      })
    )

    it.effect("accepts valid posted entry data", () =>
      Effect.gen(function* () {
        const entry = createPostedEntry()
        expect(entry.status).toBe("Posted")
        expect(Option.isSome(entry.entryNumber)).toBe(true)
        expect(Option.getOrNull(entry.entryNumber)).toBe("JE-2025-00001")
        expect(Option.isSome(entry.postingDate)).toBe(true)
        expect(Option.isSome(entry.postedBy)).toBe(true)
        expect(Option.isSome(entry.postedAt)).toBe(true)
      })
    )

    it.effect("accepts valid reversal entry data", () =>
      Effect.gen(function* () {
        const entry = createReversalEntry()
        expect(entry.entryType).toBe("Reversing")
        expect(entry.isReversing).toBe(true)
        expect(Option.isSome(entry.reversedEntryId)).toBe(true)
        expect(Option.getOrNull(entry.reversedEntryId)).toBe(reversedEntryUUID)
      })
    )

    it.effect("accepts valid reversed entry data", () =>
      Effect.gen(function* () {
        const entry = createReversedEntry()
        expect(entry.status).toBe("Reversed")
        expect(Option.isSome(entry.reversingEntryId)).toBe(true)
        expect(Option.getOrNull(entry.reversingEntryId)).toBe(reversingEntryUUID)
      })
    )

    it.effect("accepts valid multi-currency entry data", () =>
      Effect.gen(function* () {
        const entry = createMultiCurrencyEntry()
        expect(entry.isMultiCurrency).toBe(true)
      })
    )

    it.effect("accepts valid intercompany entry data", () =>
      Effect.gen(function* () {
        const entry = createIntercompanyEntry()
        expect(entry.entryType).toBe("Intercompany")
      })
    )

    it.effect("accepts valid system entry data", () =>
      Effect.gen(function* () {
        const entry = createSystemEntry()
        expect(entry.entryType).toBe("System")
        expect(entry.sourceModule).toBe("FixedAssets")
      })
    )

    it.effect("accepts all entry types", () =>
      Effect.gen(function* () {
        const entryTypes: JournalEntryType[] = [
          "Standard",
          "Adjusting",
          "Closing",
          "Opening",
          "Reversing",
          "Recurring",
          "Intercompany",
          "Revaluation",
          "Elimination",
          "System"
        ]

        for (const type of entryTypes) {
          const entry = JournalEntry.make({
            id: JournalEntryId.make(entryUUID),
            companyId: CompanyId.make(companyUUID),
            entryNumber: Option.none(),
            referenceNumber: Option.none(),
            description: `${type} entry`,
            transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
            postingDate: Option.none(),
            documentDate: Option.none(),
            fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
            entryType: type,
            sourceModule: "GeneralLedger",
            sourceDocumentRef: Option.none(),
            isMultiCurrency: false,
            status: "Draft",
            isReversing: false,
            reversedEntryId: Option.none(),
            reversingEntryId: Option.none(),
            createdBy: UserId.make(userUUID),
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            postedBy: Option.none(),
            postedAt: Option.none()
          })
          expect(entry.entryType).toBe(type)
        }
      })
    )

    it.effect("accepts all status values", () =>
      Effect.gen(function* () {
        const statuses: JournalEntryStatus[] = [
          "Draft",
          "PendingApproval",
          "Approved",
          "Posted",
          "Reversed"
        ]

        for (const status of statuses) {
          const entry = JournalEntry.make({
            id: JournalEntryId.make(entryUUID),
            companyId: CompanyId.make(companyUUID),
            entryNumber: status === "Posted" || status === "Reversed"
              ? Option.some(EntryNumber.make("JE-2025-00001"))
              : Option.none(),
            referenceNumber: Option.none(),
            description: `${status} entry`,
            transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
            postingDate: status === "Posted" || status === "Reversed"
              ? Option.some(LocalDate.make({ year: 2025, month: 1, day: 16 }))
              : Option.none(),
            documentDate: Option.none(),
            fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
            entryType: "Standard",
            sourceModule: "GeneralLedger",
            sourceDocumentRef: Option.none(),
            isMultiCurrency: false,
            status,
            isReversing: false,
            reversedEntryId: Option.none(),
            reversingEntryId: Option.none(),
            createdBy: UserId.make(userUUID),
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            postedBy: status === "Posted" || status === "Reversed"
              ? Option.some(UserId.make(userUUID))
              : Option.none(),
            postedAt: status === "Posted" || status === "Reversed"
              ? Option.some(Timestamp.make({ epochMillis: 1718496000000 }))
              : Option.none()
          })
          expect(entry.status).toBe(status)
        }
      })
    )

    it.effect("accepts all source modules", () =>
      Effect.gen(function* () {
        const modules: SourceModule[] = [
          "GeneralLedger",
          "AccountsPayable",
          "AccountsReceivable",
          "FixedAssets",
          "Inventory",
          "Payroll",
          "Consolidation"
        ]

        for (const module of modules) {
          const entry = JournalEntry.make({
            id: JournalEntryId.make(entryUUID),
            companyId: CompanyId.make(companyUUID),
            entryNumber: Option.none(),
            referenceNumber: Option.none(),
            description: `Entry from ${module}`,
            transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
            postingDate: Option.none(),
            documentDate: Option.none(),
            fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
            entryType: "Standard",
            sourceModule: module,
            sourceDocumentRef: Option.none(),
            isMultiCurrency: false,
            status: "Draft",
            isReversing: false,
            reversedEntryId: Option.none(),
            reversingEntryId: Option.none(),
            createdBy: UserId.make(userUUID),
            createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
            postedBy: Option.none(),
            postedAt: Option.none()
          })
          expect(entry.sourceModule).toBe(module)
        }
      })
    )

    it.effect("rejects empty description", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: entryUUID,
          companyId: companyUUID,
          entryNumber: null,
          referenceNumber: null,
          description: "",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "Draft",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: userUUID,
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid entry type", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: entryUUID,
          companyId: companyUUID,
          entryNumber: null,
          referenceNumber: null,
          description: "Test entry",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 1 },
          entryType: "InvalidType",
          sourceModule: "GeneralLedger",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "Draft",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: userUUID,
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid status", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: entryUUID,
          companyId: companyUUID,
          entryNumber: null,
          referenceNumber: null,
          description: "Test entry",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "InvalidStatus",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: userUUID,
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid source module", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: entryUUID,
          companyId: companyUUID,
          entryNumber: null,
          referenceNumber: null,
          description: "Test entry",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 1 },
          entryType: "Standard",
          sourceModule: "InvalidModule",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "Draft",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: userUUID,
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid journal entry id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: "not-a-uuid",
          companyId: companyUUID,
          entryNumber: null,
          referenceNumber: null,
          description: "Test entry",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "Draft",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: userUUID,
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid company id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: entryUUID,
          companyId: "not-a-uuid",
          entryNumber: null,
          referenceNumber: null,
          description: "Test entry",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "Draft",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: userUUID,
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid user id", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: entryUUID,
          companyId: companyUUID,
          entryNumber: null,
          referenceNumber: null,
          description: "Test entry",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "Draft",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: "not-a-uuid",
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid fiscal period", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(JournalEntry)
        const result = yield* Effect.exit(decode({
          id: entryUUID,
          companyId: companyUUID,
          entryNumber: null,
          referenceNumber: null,
          description: "Test entry",
          transactionDate: { year: 2025, month: 1, day: 15 },
          postingDate: null,
          documentDate: null,
          fiscalPeriod: { year: 2025, period: 15 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          sourceDocumentRef: null,
          isMultiCurrency: false,
          status: "Draft",
          isReversing: false,
          reversedEntryId: null,
          reversingEntryId: null,
          createdBy: userUUID,
          createdAt: { epochMillis: 1718409600000 },
          postedBy: null,
          postedAt: null
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("computed properties - status", () => {
    it("isDraft returns true for Draft status", () => {
      const entry = createDraftEntry()
      expect(entry.isDraft).toBe(true)
      expect(entry.isPendingApproval).toBe(false)
      expect(entry.isApproved).toBe(false)
      expect(entry.isPosted).toBe(false)
      expect(entry.isReversed).toBe(false)
    })

    it("isPendingApproval returns true for PendingApproval status", () => {
      const entry = createPendingApprovalEntry()
      expect(entry.isDraft).toBe(false)
      expect(entry.isPendingApproval).toBe(true)
      expect(entry.isApproved).toBe(false)
      expect(entry.isPosted).toBe(false)
      expect(entry.isReversed).toBe(false)
    })

    it("isApproved returns true for Approved status", () => {
      const entry = createApprovedEntry()
      expect(entry.isDraft).toBe(false)
      expect(entry.isPendingApproval).toBe(false)
      expect(entry.isApproved).toBe(true)
      expect(entry.isPosted).toBe(false)
      expect(entry.isReversed).toBe(false)
    })

    it("isPosted returns true for Posted status", () => {
      const entry = createPostedEntry()
      expect(entry.isDraft).toBe(false)
      expect(entry.isPendingApproval).toBe(false)
      expect(entry.isApproved).toBe(false)
      expect(entry.isPosted).toBe(true)
      expect(entry.isReversed).toBe(false)
    })

    it("isReversed returns true for Reversed status", () => {
      const entry = createReversedEntry()
      expect(entry.isDraft).toBe(false)
      expect(entry.isPendingApproval).toBe(false)
      expect(entry.isApproved).toBe(false)
      expect(entry.isPosted).toBe(false)
      expect(entry.isReversed).toBe(true)
    })
  })

  describe("computed properties - workflow", () => {
    it("isEditable returns true only for Draft", () => {
      expect(createDraftEntry().isEditable).toBe(true)
      expect(createPendingApprovalEntry().isEditable).toBe(false)
      expect(createApprovedEntry().isEditable).toBe(false)
      expect(createPostedEntry().isEditable).toBe(false)
      expect(createReversedEntry().isEditable).toBe(false)
    })

    it("canSubmitForApproval returns true only for Draft", () => {
      expect(createDraftEntry().canSubmitForApproval).toBe(true)
      expect(createPendingApprovalEntry().canSubmitForApproval).toBe(false)
      expect(createApprovedEntry().canSubmitForApproval).toBe(false)
      expect(createPostedEntry().canSubmitForApproval).toBe(false)
      expect(createReversedEntry().canSubmitForApproval).toBe(false)
    })

    it("canApprove returns true only for PendingApproval", () => {
      expect(createDraftEntry().canApprove).toBe(false)
      expect(createPendingApprovalEntry().canApprove).toBe(true)
      expect(createApprovedEntry().canApprove).toBe(false)
      expect(createPostedEntry().canApprove).toBe(false)
      expect(createReversedEntry().canApprove).toBe(false)
    })

    it("canPost returns true only for Approved", () => {
      expect(createDraftEntry().canPost).toBe(false)
      expect(createPendingApprovalEntry().canPost).toBe(false)
      expect(createApprovedEntry().canPost).toBe(true)
      expect(createPostedEntry().canPost).toBe(false)
      expect(createReversedEntry().canPost).toBe(false)
    })

    it("canReverse returns true only for Posted", () => {
      expect(createDraftEntry().canReverse).toBe(false)
      expect(createPendingApprovalEntry().canReverse).toBe(false)
      expect(createApprovedEntry().canReverse).toBe(false)
      expect(createPostedEntry().canReverse).toBe(true)
      expect(createReversedEntry().canReverse).toBe(false)
    })
  })

  describe("computed properties - entry number and dates", () => {
    it("hasEntryNumber returns false for draft entry", () => {
      const entry = createDraftEntry()
      expect(entry.hasEntryNumber).toBe(false)
    })

    it("hasEntryNumber returns true for posted entry", () => {
      const entry = createPostedEntry()
      expect(entry.hasEntryNumber).toBe(true)
    })

    it("hasPostingDate returns false for draft entry", () => {
      const entry = createDraftEntry()
      expect(entry.hasPostingDate).toBe(false)
    })

    it("hasPostingDate returns true for posted entry", () => {
      const entry = createPostedEntry()
      expect(entry.hasPostingDate).toBe(true)
    })
  })

  describe("computed properties - reversal tracking", () => {
    it("isReversalEntry returns true for reversal entry", () => {
      const entry = createReversalEntry()
      expect(entry.isReversalEntry).toBe(true)
    })

    it("isReversalEntry returns false for non-reversal entry", () => {
      const entry = createDraftEntry()
      expect(entry.isReversalEntry).toBe(false)
    })

    it("hasBeenReversed returns true for reversed entry", () => {
      const entry = createReversedEntry()
      expect(entry.hasBeenReversed).toBe(true)
    })

    it("hasBeenReversed returns false for non-reversed entry", () => {
      const entry = createPostedEntry()
      expect(entry.hasBeenReversed).toBe(false)
    })
  })

  describe("computed properties - entry types", () => {
    it("isStandardEntry returns true for Standard entry", () => {
      const entry = createDraftEntry()
      expect(entry.isStandardEntry).toBe(true)
    })

    it("isAdjustingEntry returns true for Adjusting entry", () => {
      const entry = createPendingApprovalEntry()
      expect(entry.isAdjustingEntry).toBe(true)
    })

    it("isClosingEntry returns true for Closing entry", () => {
      const entry = JournalEntry.make({
        ...createDraftEntry(),
        entryType: "Closing",
        description: "Year-end closing entry"
      })
      expect(entry.isClosingEntry).toBe(true)
    })

    it("isOpeningEntry returns true for Opening entry", () => {
      const entry = JournalEntry.make({
        ...createDraftEntry(),
        entryType: "Opening",
        description: "Opening balance entry"
      })
      expect(entry.isOpeningEntry).toBe(true)
    })

    it("isReversingEntryType returns true for Reversing entry", () => {
      const entry = createReversalEntry()
      expect(entry.isReversingEntryType).toBe(true)
    })

    it("isRecurringEntry returns true for Recurring entry", () => {
      const entry = JournalEntry.make({
        ...createDraftEntry(),
        entryType: "Recurring",
        description: "Monthly recurring entry"
      })
      expect(entry.isRecurringEntry).toBe(true)
    })

    it("isIntercompanyEntry returns true for Intercompany entry", () => {
      const entry = createIntercompanyEntry()
      expect(entry.isIntercompanyEntry).toBe(true)
    })

    it("isRevaluationEntry returns true for Revaluation entry", () => {
      const entry = JournalEntry.make({
        ...createDraftEntry(),
        entryType: "Revaluation",
        description: "Currency revaluation"
      })
      expect(entry.isRevaluationEntry).toBe(true)
    })

    it("isEliminationEntry returns true for Elimination entry", () => {
      const entry = JournalEntry.make({
        ...createDraftEntry(),
        entryType: "Elimination",
        description: "Consolidation elimination"
      })
      expect(entry.isEliminationEntry).toBe(true)
    })

    it("isSystemEntry returns true for System entry", () => {
      const entry = createSystemEntry()
      expect(entry.isSystemEntry).toBe(true)
    })
  })

  describe("computed properties - source module", () => {
    it("isFromGeneralLedger returns true for GL entries", () => {
      const entry = createDraftEntry()
      expect(entry.isFromGeneralLedger).toBe(true)
      expect(entry.isFromSubModule).toBe(false)
    })

    it("isFromSubModule returns true for non-GL entries", () => {
      const entry = createSystemEntry()
      expect(entry.isFromGeneralLedger).toBe(false)
      expect(entry.isFromSubModule).toBe(true)
    })
  })

  describe("computed properties - fiscal period", () => {
    it("fiscalYear returns the fiscal year", () => {
      const entry = createDraftEntry()
      expect(entry.fiscalYear).toBe(2025)
    })

    it("fiscalPeriodNumber returns the period number", () => {
      const entry = createDraftEntry()
      expect(entry.fiscalPeriodNumber).toBe(1)
    })
  })

  describe("type guard", () => {
    it("isJournalEntry returns true for JournalEntry instances", () => {
      const entry = createDraftEntry()
      expect(isJournalEntry(entry)).toBe(true)
    })

    it("isJournalEntry returns false for plain objects", () => {
      expect(isJournalEntry({
        id: entryUUID,
        description: "Test"
      })).toBe(false)
    })

    it("isJournalEntry returns false for non-object values", () => {
      expect(isJournalEntry(null)).toBe(false)
      expect(isJournalEntry(undefined)).toBe(false)
      expect(isJournalEntry("entry")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for JournalEntry", () => {
      const entry1 = createDraftEntry()
      const entry2 = JournalEntry.make({
        id: JournalEntryId.make(entryUUID),
        companyId: CompanyId.make(companyUUID),
        entryNumber: Option.none(),
        referenceNumber: Option.some("INV-2025-001"),
        description: "Monthly rent payment",
        transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
        postingDate: Option.none(),
        documentDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 14 })),
        fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        sourceDocumentRef: Option.some("RENT-JAN-2025"),
        isMultiCurrency: false,
        status: "Draft",
        isReversing: false,
        reversedEntryId: Option.none(),
        reversingEntryId: Option.none(),
        createdBy: UserId.make(userUUID),
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        postedBy: Option.none(),
        postedAt: Option.none()
      })
      const entry3 = createPostedEntry()

      expect(Equal.equals(entry1, entry2)).toBe(true)
      expect(Equal.equals(entry1, entry3)).toBe(false)
    })

    it("Equal.equals is false for different descriptions", () => {
      const entry1 = createDraftEntry()
      const entry2 = JournalEntry.make({
        ...entry1,
        description: "Different description"
      })

      expect(Equal.equals(entry1, entry2)).toBe(false)
    })

    it("Equal.equals is false for different statuses", () => {
      const entry1 = createDraftEntry()
      const entry2 = createPendingApprovalEntry()

      expect(Equal.equals(entry1, entry2)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes draft JournalEntry", () =>
      Effect.gen(function* () {
        const original = createDraftEntry()
        const encoded = yield* Schema.encode(JournalEntry)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntry)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes posted JournalEntry", () =>
      Effect.gen(function* () {
        const original = createPostedEntry()
        const encoded = yield* Schema.encode(JournalEntry)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntry)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes reversal JournalEntry", () =>
      Effect.gen(function* () {
        const original = createReversalEntry()
        const encoded = yield* Schema.encode(JournalEntry)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntry)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes reversed JournalEntry", () =>
      Effect.gen(function* () {
        const original = createReversedEntry()
        const encoded = yield* Schema.encode(JournalEntry)(original)
        const decoded = yield* Schema.decodeUnknown(JournalEntry)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const entry = createDraftEntry()
        const encoded = yield* Schema.encode(JournalEntry)(entry)

        expect(encoded).toHaveProperty("id", entryUUID)
        expect(encoded).toHaveProperty("companyId", companyUUID)
        expect(encoded).toHaveProperty("entryNumber", null)
        expect(encoded).toHaveProperty("referenceNumber", "INV-2025-001")
        expect(encoded).toHaveProperty("description", "Monthly rent payment")
        expect(encoded).toHaveProperty("transactionDate")
        expect(encoded).toHaveProperty("postingDate", null)
        expect(encoded).toHaveProperty("documentDate")
        expect(encoded).toHaveProperty("fiscalPeriod")
        expect(encoded).toHaveProperty("entryType", "Standard")
        expect(encoded).toHaveProperty("sourceModule", "GeneralLedger")
        expect(encoded).toHaveProperty("sourceDocumentRef", "RENT-JAN-2025")
        expect(encoded).toHaveProperty("isMultiCurrency", false)
        expect(encoded).toHaveProperty("status", "Draft")
        expect(encoded).toHaveProperty("isReversing", false)
        expect(encoded).toHaveProperty("reversedEntryId", null)
        expect(encoded).toHaveProperty("reversingEntryId", null)
        expect(encoded).toHaveProperty("createdBy", userUUID)
        expect(encoded).toHaveProperty("createdAt")
        expect(encoded).toHaveProperty("postedBy", null)
        expect(encoded).toHaveProperty("postedAt", null)
      })
    )

    it.effect("encodes posted entry with all fields populated", () =>
      Effect.gen(function* () {
        const entry = createPostedEntry()
        const encoded = yield* Schema.encode(JournalEntry)(entry)

        expect(encoded).toHaveProperty("entryNumber", "JE-2025-00001")
        expect(encoded).toHaveProperty("postingDate")
        expect(encoded.postingDate).not.toBeNull()
        expect(encoded).toHaveProperty("postedBy", userUUID)
        expect(encoded).toHaveProperty("postedAt")
        expect(encoded.postedAt).not.toBeNull()
      })
    )

    it.effect("encodes reversal entry with reversal fields", () =>
      Effect.gen(function* () {
        const entry = createReversalEntry()
        const encoded = yield* Schema.encode(JournalEntry)(entry)

        expect(encoded).toHaveProperty("isReversing", true)
        expect(encoded).toHaveProperty("reversedEntryId", reversedEntryUUID)
        expect(encoded).toHaveProperty("reversingEntryId", null)
      })
    )

    it.effect("encodes reversed entry with reversing entry reference", () =>
      Effect.gen(function* () {
        const entry = createReversedEntry()
        const encoded = yield* Schema.encode(JournalEntry)(entry)

        expect(encoded).toHaveProperty("status", "Reversed")
        expect(encoded).toHaveProperty("reversingEntryId", reversingEntryUUID)
      })
    )
  })

  describe("immutability", () => {
    it("JournalEntry properties are readonly at compile time", () => {
      const entry = createDraftEntry()
      expect(entry.description).toBe("Monthly rent payment")
      expect(entry.status).toBe("Draft")
    })
  })
})
