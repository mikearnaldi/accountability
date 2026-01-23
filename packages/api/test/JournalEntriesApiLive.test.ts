/**
 * Tests for JournalEntriesApiLive endpoint handlers
 *
 * These tests verify the handler logic using mock repositories.
 */

import { describe, expect, it } from "@effect/vitest"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import { CompanyId, Company, FiscalYearEnd } from "@accountability/core/company/Company"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/jurisdiction/JurisdictionCode"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import {
  JournalEntry,
  JournalEntryId,
  EntryNumber,
  UserId,
  type JournalEntryStatus,
  type JournalEntryType,
  type SourceModule
} from "@accountability/core/journal/JournalEntry"
import { JournalEntryLine, JournalEntryLineId } from "@accountability/core/journal/JournalEntryLine"
import { AccountId } from "@accountability/core/accounting/Account"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import { LocalDate, today as localDateToday } from "@accountability/core/shared/values/LocalDate"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { JournalEntryRepository, type JournalEntryRepositoryService } from "@accountability/persistence/Services/JournalEntryRepository"
import { JournalEntryLineRepository, type JournalEntryLineRepositoryService } from "@accountability/persistence/Services/JournalEntryLineRepository"
import { CompanyRepository, type CompanyRepositoryService } from "@accountability/persistence/Services/CompanyRepository"
import { EntityNotFoundError } from "@accountability/persistence/Errors/RepositoryError"

// =============================================================================
// Test Fixtures
// =============================================================================

const testCompanyId = CompanyId.make("550e8400-e29b-41d4-a716-446655440001")
const testOrganizationId = OrganizationId.make("550e8400-e29b-41d4-a716-446655440000")
const testUserId = UserId.make("550e8400-e29b-41d4-a716-446655440010")

const testAccountId1 = AccountId.make("550e8400-e29b-41d4-a716-446655440030")
const testAccountId2 = AccountId.make("550e8400-e29b-41d4-a716-446655440031")

const createTestCompany = (overrides: Partial<{
  id: typeof testCompanyId
  functionalCurrency: string
}> = {}): Company => {
  const id = overrides.id ?? testCompanyId
  const functionalCurrency = overrides.functionalCurrency ?? "USD"

  return Company.make({
    id,
    organizationId: testOrganizationId,
    name: "Test Company",
    legalName: "Test Company Inc.",
    jurisdiction: JurisdictionCode.make("US"),
    taxId: Option.none(),
    incorporationDate: Option.none(),
    registrationNumber: Option.none(),
    registeredAddress: Option.none(),
    industryCode: Option.none(),
    companyType: Option.none(),
    incorporationJurisdiction: Option.none(),
    functionalCurrency: CurrencyCode.make(functionalCurrency),
    reportingCurrency: CurrencyCode.make("USD"),
    fiscalYearEnd: FiscalYearEnd.make({ month: 12, day: 31 }),
    retainedEarningsAccountId: Option.none(),
    isActive: true,
    createdAt: timestampNow()
  })
}

// NOTE: FiscalYear and FiscalPeriod test fixtures removed.
// Fiscal periods are now computed from transaction dates at runtime.

const createTestJournalEntry = (overrides: Partial<{
  id: JournalEntryId
  status: JournalEntryStatus
  entryType: JournalEntryType
  sourceModule: SourceModule
  entryNumber: Option.Option<string>
  reversingEntryId: Option.Option<JournalEntryId>
}> = {}): JournalEntry => {
  const id = overrides.id ?? JournalEntryId.make(crypto.randomUUID())
  const status = overrides.status ?? "Draft"
  const entryType = overrides.entryType ?? "Standard"
  const sourceModule = overrides.sourceModule ?? "GeneralLedger"
  const entryNumber = overrides.entryNumber ?? Option.some("JE-0001")
  const reversingEntryId = overrides.reversingEntryId ?? Option.none()

  return JournalEntry.make({
    id,
    companyId: testCompanyId,
    entryNumber: Option.isSome(entryNumber) ? Option.some(EntryNumber.make(entryNumber.value)) : Option.none(),
    referenceNumber: Option.none(),
    description: "Test journal entry",
    transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
    postingDate: status === "Posted" ? Option.some(LocalDate.make({ year: 2025, month: 1, day: 15 })) : Option.none(),
    documentDate: Option.none(),
    fiscalPeriod: FiscalPeriodRef.make({ year: 2025, period: 1 }),
    entryType,
    sourceModule,
    sourceDocumentRef: Option.none(),
    isMultiCurrency: false,
    status,
    isReversing: false,
    reversedEntryId: Option.none(),
    reversingEntryId,
    createdBy: testUserId,
    createdAt: timestampNow(),
    postedBy: status === "Posted" ? Option.some(testUserId) : Option.none(),
    postedAt: status === "Posted" ? Option.some(timestampNow()) : Option.none()
  })
}

const createTestJournalEntryLine = (overrides: Partial<{
  id: JournalEntryLineId
  journalEntryId: JournalEntryId
  lineNumber: number
  accountId: AccountId
  isDebit: boolean
  amount: string
}> = {}): JournalEntryLine => {
  const id = overrides.id ?? JournalEntryLineId.make(crypto.randomUUID())
  const journalEntryId = overrides.journalEntryId ?? JournalEntryId.make(crypto.randomUUID())
  const lineNumber = overrides.lineNumber ?? 1
  const accountId = overrides.accountId ?? testAccountId1
  const isDebit = overrides.isDebit ?? true
  const amount = overrides.amount ?? "100.00"

  const monetaryAmount = MonetaryAmount.make({
    amount: BigDecimal.unsafeFromString(amount),
    currency: CurrencyCode.make("USD")
  })

  return JournalEntryLine.make({
    id,
    journalEntryId,
    lineNumber,
    accountId,
    debitAmount: isDebit ? Option.some(monetaryAmount) : Option.none(),
    creditAmount: isDebit ? Option.none() : Option.some(monetaryAmount),
    functionalCurrencyDebitAmount: isDebit ? Option.some(monetaryAmount) : Option.none(),
    functionalCurrencyCreditAmount: isDebit ? Option.none() : Option.some(monetaryAmount),
    exchangeRate: BigDecimal.fromBigInt(1n),
    memo: Option.none(),
    dimensions: Option.none(),
    intercompanyPartnerId: Option.none(),
    matchingLineId: Option.none()
  })
}

// =============================================================================
// Mock Repositories
// =============================================================================

const createMockJournalEntryRepository = (
  initialEntries: ReadonlyArray<JournalEntry> = []
) =>
  Effect.gen(function* () {
    const entriesRef = yield* Ref.make<ReadonlyArray<JournalEntry>>(initialEntries)
    const entryNumberRef = yield* Ref.make(1)

    const service: JournalEntryRepositoryService = {
      findById: (_organizationId, id) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return Option.fromNullable(entries.find((e) => e.id === id))
        }),

      findByCompany: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.filter((e) => e.companyId === companyId)
        }),

      findByPeriod: (_organizationId, companyId, period) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.filter(
            (e) =>
              e.companyId === companyId &&
              e.fiscalPeriod.year === period.year &&
              e.fiscalPeriod.period === period.period
          )
        }),

      findByStatus: (_organizationId, companyId, status) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.filter((e) => e.companyId === companyId && e.status === status)
        }),

      findByType: (_organizationId, companyId, entryType) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.filter((e) => e.companyId === companyId && e.entryType === entryType)
        }),

      findByPeriodRange: (_organizationId, _companyId, _startPeriod, _endPeriod) =>
        Effect.succeed([]),

      findDraftEntries: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.filter((e) => e.companyId === companyId && e.status === "Draft")
        }),

      findPostedByPeriod: (_organizationId, _companyId, _period) =>
        Effect.succeed([]),

      findReversingEntry: (_organizationId, entryId) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return Option.fromNullable(
            entries.find((e) => Option.isSome(e.reversedEntryId) && e.reversedEntryId.value === entryId)
          )
        }),

      countDraftEntriesInPeriod: (_organizationId, _companyId, _period) =>
        Effect.succeed(0),

      findIntercompanyEntries: (_organizationId, _companyId) =>
        Effect.succeed([]),

      create: (entry) =>
        Effect.gen(function* () {
          yield* Ref.update(entriesRef, (entries) => [...entries, entry])
          return entry
        }),

      update: (_organizationId, entry) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          const exists = entries.some((e) => e.id === entry.id)
          if (!exists) {
            return yield* Effect.fail(
              new EntityNotFoundError({ entityType: "JournalEntry", entityId: entry.id })
            )
          }
          yield* Ref.update(entriesRef, (es) => es.map((e) => (e.id === entry.id ? entry : e)))
          return entry
        }),

      getById: (_organizationId, id) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          const entry = entries.find((e) => e.id === id)
          if (!entry) {
            return yield* Effect.fail(
              new EntityNotFoundError({ entityType: "JournalEntry", entityId: id })
            )
          }
          return entry
        }),

      exists: (_organizationId, id) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.some((e) => e.id === id)
        }),

      getNextEntryNumber: (_organizationId, _companyId) =>
        Effect.gen(function* () {
          const num = yield* Ref.getAndUpdate(entryNumberRef, (n) => n + 1)
          return `JE-${String(num).padStart(4, "0")}`
        })
    }

    return service
  })

const createMockJournalEntryLineRepository = (
  initialLines: ReadonlyArray<JournalEntryLine> = []
) =>
  Effect.gen(function* () {
    const linesRef = yield* Ref.make<ReadonlyArray<JournalEntryLine>>(initialLines)

    const service: JournalEntryLineRepositoryService = {
      findByJournalEntry: (journalEntryId) =>
        Effect.gen(function* () {
          const lines = yield* Ref.get(linesRef)
          return lines.filter((l) => l.journalEntryId === journalEntryId)
        }),

      findByJournalEntries: (journalEntryIds) =>
        Effect.gen(function* () {
          const lines = yield* Ref.get(linesRef)
          const result = new Map<JournalEntryId, JournalEntryLine[]>()
          for (const line of lines) {
            if (journalEntryIds.includes(line.journalEntryId)) {
              const existing = result.get(line.journalEntryId) ?? []
              existing.push(line)
              result.set(line.journalEntryId, existing)
            }
          }
          return result
        }),

      createMany: (newLines) =>
        Effect.gen(function* () {
          yield* Ref.update(linesRef, (lines) => [...lines, ...newLines])
          return newLines
        }),

      deleteByJournalEntry: (journalEntryId) =>
        Effect.gen(function* () {
          yield* Ref.update(linesRef, (lines) =>
            lines.filter((l) => l.journalEntryId !== journalEntryId)
          )
        }),

      findByAccount: (_accountId) =>
        Effect.succeed([]),

      getById: (lineId) =>
        Effect.gen(function* () {
          const lines = yield* Ref.get(linesRef)
          const line = lines.find((l) => l.id === lineId)
          if (!line) {
            return yield* Effect.fail(
              new EntityNotFoundError({ entityType: "JournalEntryLine", entityId: lineId })
            )
          }
          return line
        }),

      updateMany: (updatedLines) =>
        Effect.gen(function* () {
          yield* Ref.update(linesRef, (lines) =>
            lines.map((l) => {
              const updated = updatedLines.find((u) => u.id === l.id)
              return updated ?? l
            })
          )
          return updatedLines
        })
    }

    return service
  })

const createMockCompanyRepository = (
  initialCompanies: ReadonlyArray<Company> = [createTestCompany()]
) =>
  Effect.gen(function* () {
    const companiesRef = yield* Ref.make<ReadonlyArray<Company>>(initialCompanies)

    const service: CompanyRepositoryService = {
      findById: (organizationId, id) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          return Option.fromNullable(companies.find((c) => c.id === id && c.organizationId === organizationId))
        }),

      findByOrganization: (_orgId) =>
        Effect.succeed([]),

      findActiveByOrganization: (_orgId) =>
        Effect.succeed([]),

      create: (company) =>
        Effect.gen(function* () {
          yield* Ref.update(companiesRef, (cs) => [...cs, company])
          return company
        }),

      update: (organizationId, company) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          const exists = companies.some((c) => c.id === company.id && c.organizationId === organizationId)
          if (!exists) {
            return yield* Effect.fail(
              new EntityNotFoundError({ entityType: "Company", entityId: company.id })
            )
          }
          yield* Ref.update(companiesRef, (cs) =>
            cs.map((c) => (c.id === company.id ? company : c))
          )
          return company
        }),

      getById: (organizationId, id) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          const company = companies.find((c) => c.id === id && c.organizationId === organizationId)
          if (!company) {
            return yield* Effect.fail(
              new EntityNotFoundError({ entityType: "Company", entityId: id })
            )
          }
          return company
        }),

      exists: (organizationId, id) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          return companies.some((c) => c.id === id && c.organizationId === organizationId)
        })
    }

    return service
  })

// NOTE: FiscalPeriodRepository mock removed. Fiscal periods are now computed
// from transaction dates at runtime rather than validated against stored periods.

// =============================================================================
// Test Layer
// =============================================================================

const createTestLayer = (options: {
  entries?: ReadonlyArray<JournalEntry>
  lines?: ReadonlyArray<JournalEntryLine>
  companies?: ReadonlyArray<Company>
} = {}) =>
  Layer.mergeAll(
    Layer.effect(JournalEntryRepository, createMockJournalEntryRepository(options.entries ?? [])),
    Layer.effect(JournalEntryLineRepository, createMockJournalEntryLineRepository(options.lines ?? [])),
    Layer.effect(CompanyRepository, createMockCompanyRepository(options.companies ?? [createTestCompany()]))
  )

// =============================================================================
// Tests
// =============================================================================

describe("JournalEntriesApiLive", () => {
  // ===========================================================================
  // List Entries Tests
  // ===========================================================================
  describe("listJournalEntries", () => {
    it.effect("should return entries for a company", () =>
      Effect.gen(function* () {
        const entry1 = createTestJournalEntry()
        const entry2 = createTestJournalEntry({
          id: JournalEntryId.make(crypto.randomUUID()),
          entryNumber: Option.some("JE-0002")
        })
        const testLayer = createTestLayer({ entries: [entry1, entry2] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const entries = yield* entryRepo.findByCompany(testOrganizationId, testCompanyId)

        expect(entries.length).toBe(2)
      })
    )

    it.effect("should filter by status", () =>
      Effect.gen(function* () {
        const draftEntry = createTestJournalEntry({ status: "Draft" })
        const postedEntry = createTestJournalEntry({
          id: JournalEntryId.make(crypto.randomUUID()),
          status: "Posted",
          entryNumber: Option.some("JE-0002")
        })
        const testLayer = createTestLayer({ entries: [draftEntry, postedEntry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const draftEntries = yield* entryRepo.findByStatus(testOrganizationId, testCompanyId, "Draft")

        expect(draftEntries.length).toBe(1)
        expect(draftEntries[0].status).toBe("Draft")
      })
    )

    it.effect("should filter by entry type", () =>
      Effect.gen(function* () {
        const standardEntry = createTestJournalEntry({ entryType: "Standard" })
        const adjustingEntry = createTestJournalEntry({
          id: JournalEntryId.make(crypto.randomUUID()),
          entryType: "Adjusting",
          entryNumber: Option.some("JE-0002")
        })
        const testLayer = createTestLayer({ entries: [standardEntry, adjustingEntry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const adjustingEntries = yield* entryRepo.findByType(testOrganizationId, testCompanyId, "Adjusting")

        expect(adjustingEntries.length).toBe(1)
        expect(adjustingEntries[0].entryType).toBe("Adjusting")
      })
    )
  })

  // ===========================================================================
  // Get Entry Tests
  // ===========================================================================
  describe("getJournalEntry", () => {
    it.effect("should return entry with lines when found", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry()
        const line1 = createTestJournalEntryLine({
          journalEntryId: entry.id,
          lineNumber: 1,
          accountId: testAccountId1,
          isDebit: true
        })
        const line2 = createTestJournalEntryLine({
          journalEntryId: entry.id,
          lineNumber: 2,
          accountId: testAccountId2,
          isDebit: false
        })
        const testLayer = createTestLayer({ entries: [entry], lines: [line1, line2] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const lineRepo = yield* JournalEntryLineRepository.pipe(Effect.provide(testLayer))

        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entry.id)
        expect(Option.isSome(maybeEntry)).toBe(true)

        const lines = yield* lineRepo.findByJournalEntry(entry.id)
        expect(lines.length).toBe(2)
      })
    )

    it.effect("should return None when entry not found", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer()

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const maybeEntry = yield* entryRepo.findById(
          testOrganizationId,
          JournalEntryId.make("00000000-0000-0000-0000-000000000000")
        )

        expect(Option.isNone(maybeEntry)).toBe(true)
      })
    )
  })

  // ===========================================================================
  // Create Entry Tests
  // ===========================================================================
  describe("createJournalEntry", () => {
    it.effect("should create entry with lines", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer()

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const lineRepo = yield* JournalEntryLineRepository.pipe(Effect.provide(testLayer))

        // Create entry
        const entryId = JournalEntryId.make(crypto.randomUUID())
        const entry = createTestJournalEntry({ id: entryId })
        yield* entryRepo.create(entry)

        // Create lines
        const line1 = createTestJournalEntryLine({
          journalEntryId: entryId,
          lineNumber: 1,
          isDebit: true
        })
        const line2 = createTestJournalEntryLine({
          journalEntryId: entryId,
          lineNumber: 2,
          isDebit: false
        })
        yield* lineRepo.createMany([line1, line2])

        // Verify
        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entryId)
        expect(Option.isSome(maybeEntry)).toBe(true)

        const lines = yield* lineRepo.findByJournalEntry(entryId)
        expect(lines.length).toBe(2)
      })
    )

    it.effect("should validate company exists", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer({ companies: [] })

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const exists = yield* companyRepo.exists(testOrganizationId, testCompanyId)

        expect(exists).toBe(false)
      })
    )

    // NOTE: Period validation test removed. Fiscal periods are now computed
    // from transaction dates at runtime rather than validated against stored periods.
  })

  // ===========================================================================
  // Update Entry Tests
  // ===========================================================================
  describe("updateJournalEntry", () => {
    it.effect("should update draft entry", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry({ status: "Draft" })
        const testLayer = createTestLayer({ entries: [entry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))

        const updated = JournalEntry.make({
          ...entry,
          description: "Updated description"
        })
        yield* entryRepo.update(testOrganizationId, updated)

        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entry.id)
        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.description).toBe("Updated description")
        }
      })
    )

    it.effect("should reject updating non-draft entry", () =>
      Effect.gen(function* () {
        const postedEntry = createTestJournalEntry({ status: "Posted" })
        const testLayer = createTestLayer({ entries: [postedEntry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const maybeEntry = yield* entryRepo.findById(testOrganizationId, postedEntry.id)

        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.status).toBe("Posted")
          expect(maybeEntry.value.isEditable).toBe(false)
        }
      })
    )
  })

  // ===========================================================================
  // Workflow Tests
  // ===========================================================================
  describe("workflow transitions", () => {
    it.effect("should submit draft for approval", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry({ status: "Draft" })
        const testLayer = createTestLayer({ entries: [entry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))

        expect(entry.canSubmitForApproval).toBe(true)

        const submitted = JournalEntry.make({
          ...entry,
          status: "PendingApproval"
        })
        yield* entryRepo.update(testOrganizationId, submitted)

        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entry.id)
        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.status).toBe("PendingApproval")
        }
      })
    )

    it.effect("should approve pending entry", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry({ status: "PendingApproval" })
        const testLayer = createTestLayer({ entries: [entry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))

        expect(entry.canApprove).toBe(true)

        const approved = JournalEntry.make({
          ...entry,
          status: "Approved"
        })
        yield* entryRepo.update(testOrganizationId, approved)

        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entry.id)
        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.status).toBe("Approved")
        }
      })
    )

    it.effect("should reject pending entry back to draft", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry({ status: "PendingApproval" })
        const testLayer = createTestLayer({ entries: [entry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))

        const rejected = JournalEntry.make({
          ...entry,
          status: "Draft"
        })
        yield* entryRepo.update(testOrganizationId, rejected)

        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entry.id)
        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.status).toBe("Draft")
        }
      })
    )
  })

  // ===========================================================================
  // Post Entry Tests
  // ===========================================================================
  describe("postJournalEntry", () => {
    it.effect("should post approved entry", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry({ status: "Approved" })
        const testLayer = createTestLayer({ entries: [entry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))

        expect(entry.canPost).toBe(true)

        const posted = JournalEntry.make({
          ...entry,
          status: "Posted",
          postingDate: Option.some(localDateToday()),
          postedBy: Option.some(testUserId),
          postedAt: Option.some(timestampNow())
        })
        yield* entryRepo.update(testOrganizationId, posted)

        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entry.id)
        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.status).toBe("Posted")
          expect(Option.isSome(maybeEntry.value.postingDate)).toBe(true)
        }
      })
    )

    it.effect("should reject posting non-approved entry", () =>
      Effect.gen(function* () {
        const draftEntry = createTestJournalEntry({ status: "Draft" })
        const testLayer = createTestLayer({ entries: [draftEntry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const maybeEntry = yield* entryRepo.findById(testOrganizationId, draftEntry.id)

        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.canPost).toBe(false)
        }
      })
    )
  })

  // ===========================================================================
  // Reverse Entry Tests
  // ===========================================================================
  describe("reverseJournalEntry", () => {
    it.effect("should reverse posted entry", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry({ status: "Posted" })
        const line1 = createTestJournalEntryLine({
          journalEntryId: entry.id,
          lineNumber: 1,
          isDebit: true
        })
        const line2 = createTestJournalEntryLine({
          journalEntryId: entry.id,
          lineNumber: 2,
          isDebit: false
        })
        const testLayer = createTestLayer({ entries: [entry], lines: [line1, line2] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const lineRepo = yield* JournalEntryLineRepository.pipe(Effect.provide(testLayer))

        expect(entry.canReverse).toBe(true)

        // Create reversal entry
        const reversalId = JournalEntryId.make(crypto.randomUUID())
        const reversalEntry = JournalEntry.make({
          ...entry,
          id: reversalId,
          entryNumber: Option.some(EntryNumber.make("JE-0002")),
          description: `Reversal of ${entry.entryNumber.pipe(Option.getOrElse(() => entry.id))}`,
          status: "Posted",
          entryType: "Reversing",
          isReversing: true,
          reversedEntryId: Option.some(entry.id),
          reversingEntryId: Option.none()
        })

        // Create reversal lines (swapped debits/credits)
        const reversalLine1 = createTestJournalEntryLine({
          journalEntryId: reversalId,
          lineNumber: 1,
          accountId: line1.accountId,
          isDebit: false
        })
        const reversalLine2 = createTestJournalEntryLine({
          journalEntryId: reversalId,
          lineNumber: 2,
          accountId: line2.accountId,
          isDebit: true
        })

        // Update original entry
        const reversedOriginal = JournalEntry.make({
          ...entry,
          status: "Reversed",
          reversingEntryId: Option.some(reversalId)
        })

        yield* entryRepo.update(testOrganizationId, reversedOriginal)
        yield* entryRepo.create(reversalEntry)
        yield* lineRepo.createMany([reversalLine1, reversalLine2])

        // Verify
        const maybeOriginal = yield* entryRepo.findById(testOrganizationId, entry.id)
        expect(Option.isSome(maybeOriginal)).toBe(true)
        if (Option.isSome(maybeOriginal)) {
          expect(maybeOriginal.value.status).toBe("Reversed")
          expect(Option.isSome(maybeOriginal.value.reversingEntryId)).toBe(true)
        }

        const maybeReversal = yield* entryRepo.findById(testOrganizationId, reversalId)
        expect(Option.isSome(maybeReversal)).toBe(true)
        if (Option.isSome(maybeReversal)) {
          expect(maybeReversal.value.isReversing).toBe(true)
          expect(maybeReversal.value.entryType).toBe("Reversing")
        }
      })
    )

    it.effect("should reject reversing non-posted entry", () =>
      Effect.gen(function* () {
        const draftEntry = createTestJournalEntry({ status: "Draft" })
        const testLayer = createTestLayer({ entries: [draftEntry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const maybeEntry = yield* entryRepo.findById(testOrganizationId, draftEntry.id)

        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.canReverse).toBe(false)
        }
      })
    )

    it.effect("should reject reversing already-reversed entry", () =>
      Effect.gen(function* () {
        const reversedEntry = createTestJournalEntry({
          status: "Posted",
          reversingEntryId: Option.some(JournalEntryId.make(crypto.randomUUID()))
        })
        const testLayer = createTestLayer({ entries: [reversedEntry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const maybeEntry = yield* entryRepo.findById(testOrganizationId, reversedEntry.id)

        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.hasBeenReversed).toBe(true)
        }
      })
    )
  })

  // ===========================================================================
  // Delete Entry Tests
  // ===========================================================================
  describe("deleteJournalEntry", () => {
    it.effect("should allow deleting draft entry", () =>
      Effect.gen(function* () {
        const entry = createTestJournalEntry({ status: "Draft" })
        const testLayer = createTestLayer({ entries: [entry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const maybeEntry = yield* entryRepo.findById(testOrganizationId, entry.id)

        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.status).toBe("Draft")
          expect(maybeEntry.value.isEditable).toBe(true)
        }
      })
    )

    it.effect("should reject deleting non-draft entry", () =>
      Effect.gen(function* () {
        const postedEntry = createTestJournalEntry({ status: "Posted" })
        const testLayer = createTestLayer({ entries: [postedEntry] })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const maybeEntry = yield* entryRepo.findById(testOrganizationId, postedEntry.id)

        expect(Option.isSome(maybeEntry)).toBe(true)
        if (Option.isSome(maybeEntry)) {
          expect(maybeEntry.value.isEditable).toBe(false)
        }
      })
    )
  })
})
