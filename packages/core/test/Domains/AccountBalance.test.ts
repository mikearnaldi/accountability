import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, FastCheck, Option } from "effect"
import type { JournalEntryWithLines } from "../../src/accounting/AccountBalance.ts"
import {
  calculateBalance,
  calculatePeriodBalance,
  calculateYTDBalance,
  calculateBeginningBalance,
  calculateDebitCreditTotals,
  calculatePeriodDebitCreditTotals
} from "../../src/accounting/AccountBalance.ts"
import { AccountId } from "../../src/accounting/Account.ts"
import { JournalEntry, JournalEntryId, UserId, EntryNumber } from "../../src/journal/JournalEntry.ts"
import { JournalEntryLine, JournalEntryLineId } from "../../src/journal/JournalEntryLine.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("AccountBalance", () => {
  // Test UUIDs (must be valid UUID format - hex characters only)
  const companyUUID = "a0000000-0000-0000-0000-000000000001"
  const userUUID = "b0000000-0000-0000-0000-000000000001"
  const cashAccountUUID = "c0000000-0000-0000-0000-000000000001"
  const revenueAccountUUID = "c0000000-0000-0000-0000-000000000002"
  const expenseAccountUUID = "c0000000-0000-0000-0000-000000000003"
  const liabilityAccountUUID = "c0000000-0000-0000-0000-000000000004"

  const usdCurrency = CurrencyCode.make("USD")

  // Helper to create a journal entry
  const createEntry = (
    id: string,
    postingDate: LocalDate,
    status: "Draft" | "Posted" | "Reversed" = "Posted"
  ): JournalEntry => {
    return JournalEntry.make({
      id: JournalEntryId.make(id),
      companyId: CompanyId.make(companyUUID),
      entryNumber: status === "Posted" ? Option.some(EntryNumber.make("JE-001")) : Option.none(),
      referenceNumber: Option.none(),
      description: "Test entry",
      transactionDate: postingDate,
      postingDate: status === "Posted" || status === "Reversed" ? Option.some(postingDate) : Option.none(),
      documentDate: Option.none(),
      fiscalPeriod: FiscalPeriodRef.make({ year: postingDate.year, period: postingDate.month }),
      entryType: "Standard",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.none(),
      isMultiCurrency: false,
      status,
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: Date.now() }),
      postedBy: status === "Posted" ? Option.some(UserId.make(userUUID)) : Option.none(),
      postedAt: status === "Posted" ? Option.some(Timestamp.make({ epochMillis: Date.now() })) : Option.none()
    })
  }

  // Helper to create a debit line
  const createDebitLine = (
    lineId: string,
    entryId: string,
    lineNumber: number,
    accountId: string,
    amount: string,
    currency: CurrencyCode
  ): JournalEntryLine => {
    const monetaryAmount = MonetaryAmount.unsafeFromString(amount, currency)
    return JournalEntryLine.make({
      id: JournalEntryLineId.make(lineId),
      journalEntryId: JournalEntryId.make(entryId),
      lineNumber,
      accountId: AccountId.make(accountId),
      debitAmount: Option.some(monetaryAmount),
      creditAmount: Option.none(),
      functionalCurrencyDebitAmount: Option.some(monetaryAmount),
      functionalCurrencyCreditAmount: Option.none(),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.none(),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  // Helper to create a credit line
  const createCreditLine = (
    lineId: string,
    entryId: string,
    lineNumber: number,
    accountId: string,
    amount: string,
    currency: CurrencyCode
  ): JournalEntryLine => {
    const monetaryAmount = MonetaryAmount.unsafeFromString(amount, currency)
    return JournalEntryLine.make({
      id: JournalEntryLineId.make(lineId),
      journalEntryId: JournalEntryId.make(entryId),
      lineNumber,
      accountId: AccountId.make(accountId),
      debitAmount: Option.none(),
      creditAmount: Option.some(monetaryAmount),
      functionalCurrencyDebitAmount: Option.none(),
      functionalCurrencyCreditAmount: Option.some(monetaryAmount),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.none(),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  // Test dates
  const jan1 = LocalDate.make({ year: 2025, month: 1, day: 1 })
  const jan15 = LocalDate.make({ year: 2025, month: 1, day: 15 })
  const jan20 = LocalDate.make({ year: 2025, month: 1, day: 20 })
  const jan31 = LocalDate.make({ year: 2025, month: 1, day: 31 })
  const feb15 = LocalDate.make({ year: 2025, month: 2, day: 15 })
  const feb28 = LocalDate.make({ year: 2025, month: 2, day: 28 })
  const mar15 = LocalDate.make({ year: 2025, month: 3, day: 15 })
  const dec10 = LocalDate.make({ year: 2024, month: 12, day: 10 })
  const dec15 = LocalDate.make({ year: 2024, month: 12, day: 15 })
  const dec20 = LocalDate.make({ year: 2024, month: 12, day: 20 })

  describe("calculateBalance", () => {
    it("returns zero for empty entries", () => {
      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        [],
        jan31,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("calculates balance for normal debit account (asset)", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15)
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      // Cash (debit account): debits increase balance
      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("calculates balance for normal credit account (revenue)", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15)
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      // Revenue (credit account): credits increase balance
      const result = calculateBalance(
        AccountId.make(revenueAccountUUID),
        "Credit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("ignores draft entries", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15, "Draft")
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("excludes entries after asOfDate", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"

      const entry1 = createEntry(entryId1, jan15) // Before asOfDate
      const entry2 = createEntry(entryId2, feb15) // After asOfDate

      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "500.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "500.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 }
      ]

      // Only entry1 should be included (posted on Jan 15)
      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("includes entries on asOfDate", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan31) // Exactly on asOfDate
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("sums multiple entries correctly", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"

      const entry1 = createEntry(entryId1, jan15)
      const entry2 = createEntry(entryId2, jan20)

      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "500.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "500.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 }
      ]

      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1500"))).toBe(true)
    })

    it("handles mixed debits and credits for same account", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"

      const entry1 = createEntry(entryId1, jan15)
      const entry2 = createEntry(entryId2, jan20)

      // Entry 1: Debit cash 1000
      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      // Entry 2: Credit cash 300 (e.g., expense payment)
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, expenseAccountUUID, "300.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "300.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 }
      ]

      // Cash: 1000 debit - 300 credit = 700
      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("700"))).toBe(true)
    })

    it("calculates negative balance when credits exceed debits (for debit account)", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15)

      // A scenario where cash is credited more than debited (overdraft)
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, expenseAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, cashAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      // Cash: 0 debits - 1000 credits = -1000
      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("-1000"))).toBe(true)
      expect(result.isNegative).toBe(true)
    })
  })

  describe("calculatePeriodBalance", () => {
    it("returns zero for empty entries", () => {
      const result = calculatePeriodBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        [],
        jan1,
        jan31,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("includes entries within the period", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15) // Within period
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculatePeriodBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("excludes entries before the period", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, dec15) // Before period
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculatePeriodBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        jan31,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("excludes entries after the period", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, feb15) // After period
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculatePeriodBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        jan31,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("includes entries on period boundaries", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"

      const entry1 = createEntry(entryId1, jan1) // On start
      const entry2 = createEntry(entryId2, jan31) // On end

      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "500.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "500.00", usdCurrency)
      ]
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "500.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "500.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 }
      ]

      const result = calculatePeriodBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("calculates correctly for credit account", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15)
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculatePeriodBalance(
        AccountId.make(revenueAccountUUID),
        "Credit",
        entries,
        jan1,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })
  })

  describe("calculateYTDBalance", () => {
    it("calculates from fiscal year start to asOfDate", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"
      const entryId3 = "e0000000-0000-0000-0000-000000000003"

      const entry1 = createEntry(entryId1, jan15)
      const entry2 = createEntry(entryId2, feb15)
      const entry3 = createEntry(entryId3, mar15)

      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "500.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "500.00", usdCurrency)
      ]
      const lines3: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, cashAccountUUID, "250.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, revenueAccountUUID, "250.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 },
        { entry: entry3, lines: lines3 }
      ]

      // YTD from Jan 1 to Feb 28 should include entries 1 and 2
      const result = calculateYTDBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        feb28,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1500"))).toBe(true)

      // YTD from Jan 1 to Mar 15 should include all entries
      const resultMar = calculateYTDBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        mar15,
        usdCurrency
      )
      expect(BigDecimal.equals(resultMar.amount, BigDecimal.unsafeFromString("1750"))).toBe(true)
    })

    it("returns zero when no entries in fiscal year", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, dec15) // Previous year
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculateYTDBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        jan31,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })
  })

  describe("calculateBeginningBalance", () => {
    it("returns zero for empty entries", () => {
      const result = calculateBeginningBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        [],
        jan1,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("includes entries before periodStart", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, dec15) // Before period start
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculateBeginningBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("excludes entries on periodStart", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan1) // On period start (not before)
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculateBeginningBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("excludes entries after periodStart", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15) // After period start
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      const result = calculateBeginningBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        usdCurrency
      )
      expect(result.isZero).toBe(true)
    })

    it("accumulates all entries before periodStart", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"

      const entry1 = createEntry(entryId1, dec10)
      const entry2 = createEntry(entryId2, dec20)

      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "500.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "500.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 }
      ]

      const result = calculateBeginningBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("1500"))).toBe(true)
    })
  })

  describe("calculateDebitCreditTotals", () => {
    it("returns zeros for empty entries", () => {
      const result = calculateDebitCreditTotals(
        AccountId.make(cashAccountUUID),
        [],
        jan31,
        usdCurrency
      )
      expect(result.totalDebits.isZero).toBe(true)
      expect(result.totalCredits.isZero).toBe(true)
    })

    it("calculates separate debit and credit totals", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"

      const entry1 = createEntry(entryId1, jan15)
      const entry2 = createEntry(entryId2, jan20)

      // Entry 1: Debit cash 1000
      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      // Entry 2: Credit cash 300
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, expenseAccountUUID, "300.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "300.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 }
      ]

      const result = calculateDebitCreditTotals(
        AccountId.make(cashAccountUUID),
        entries,
        jan31,
        usdCurrency
      )

      expect(BigDecimal.equals(result.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(BigDecimal.equals(result.totalCredits.amount, BigDecimal.unsafeFromString("300"))).toBe(true)
    })
  })

  describe("calculatePeriodDebitCreditTotals", () => {
    it("calculates separate debit and credit totals for period", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"
      const entryId3 = "e0000000-0000-0000-0000-000000000003"

      const entry1 = createEntry(entryId1, dec15) // Before period - excluded
      const entry2 = createEntry(entryId2, jan15)
      const entry3 = createEntry(entryId3, jan20)

      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "5000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "5000.00", usdCurrency)
      ]
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      const lines3: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, expenseAccountUUID, "300.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, cashAccountUUID, "300.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 },
        { entry: entry3, lines: lines3 }
      ]

      const result = calculatePeriodDebitCreditTotals(
        AccountId.make(cashAccountUUID),
        entries,
        jan1,
        jan31,
        usdCurrency
      )

      // Only entries 2 and 3 are in period
      expect(BigDecimal.equals(result.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(BigDecimal.equals(result.totalCredits.amount, BigDecimal.unsafeFromString("300"))).toBe(true)
    })
  })

  describe("normal balance handling", () => {
    it("handles Debit normal balance correctly - debits increase, credits decrease", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15)

      // Debit cash 1000, then credit cash 300
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, cashAccountUUID, "300.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      // For debit account: balance = debits - credits = 1000 - 300 = 700
      const result = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("700"))).toBe(true)
    })

    it("handles Credit normal balance correctly - credits increase, debits decrease", () => {
      const entryId = "e0000000-0000-0000-0000-000000000001"
      const entry = createEntry(entryId, jan15)

      // Debit liability 300, credit liability 1000
      const lines: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, liabilityAccountUUID, "300.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, liabilityAccountUUID, "1000.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

      // For credit account: balance = credits - debits = 1000 - 300 = 700
      const result = calculateBalance(
        AccountId.make(liabilityAccountUUID),
        "Credit",
        entries,
        jan31,
        usdCurrency
      )
      expect(BigDecimal.equals(result.amount, BigDecimal.unsafeFromString("700"))).toBe(true)
    })
  })

  describe("algebraic properties", () => {
    it("beginning balance + period balance = ending balance", () => {
      const entryId1 = "e0000000-0000-0000-0000-000000000001"
      const entryId2 = "e0000000-0000-0000-0000-000000000002"

      const entry1 = createEntry(entryId1, dec15) // Before January
      const entry2 = createEntry(entryId2, jan15) // In January

      const lines1: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
      ]
      const lines2: ReadonlyArray<JournalEntryLine> = [
        createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "500.00", usdCurrency),
        createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "500.00", usdCurrency)
      ]

      const entries: ReadonlyArray<JournalEntryWithLines> = [
        { entry: entry1, lines: lines1 },
        { entry: entry2, lines: lines2 }
      ]

      const beginningBalance = calculateBeginningBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        usdCurrency
      )

      const periodBalance = calculatePeriodBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan1,
        jan31,
        usdCurrency
      )

      const endingBalance = calculateBalance(
        AccountId.make(cashAccountUUID),
        "Debit",
        entries,
        jan31,
        usdCurrency
      )

      // Beginning (1000) + Period (500) = Ending (1500)
      const sum = BigDecimal.sum(beginningBalance.amount, periodBalance.amount)
      expect(BigDecimal.equals(sum, endingBalance.amount)).toBe(true)
    })
  })

  describe("property-based tests", () => {
    // Generate a positive amount string
    const positiveAmountString = FastCheck.integer({ min: 1, max: 999999 })
      .chain((int) =>
        FastCheck.integer({ min: 0, max: 9999 })
          .map((decimal) => `${int}.${String(decimal).padStart(4, "0")}`)
      )

    // Generate a valid UUID
    const uuidArb = FastCheck.uuid()

    // Generate a year between 2020 and 2030
    const yearArb = FastCheck.integer({ min: 2020, max: 2030 })

    // Generate a month (1-12)
    const monthArb = FastCheck.integer({ min: 1, max: 12 })

    // Generate a day (1-28 to avoid month-end issues)
    const dayArb = FastCheck.integer({ min: 1, max: 28 })

    // Generate a LocalDate
    const localDateArb = FastCheck.tuple(yearArb, monthArb, dayArb).map(
      ([year, month, day]) => LocalDate.make({ year, month, day })
    )

    it.prop(
      "balance is zero when debits equal credits for debit account",
      [uuidArb, uuidArb, uuidArb, positiveAmountString, localDateArb],
      ([entryUuid, lineUuid1, lineUuid2, amount, date]) => {
        const entry = createEntry(entryUuid, date)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, cashAccountUUID, amount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const result = calculateBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entries,
          date,
          usdCurrency
        )

        return result.isZero
      }
    )

    it.prop(
      "balance is zero when debits equal credits for credit account",
      [uuidArb, uuidArb, uuidArb, positiveAmountString, localDateArb],
      ([entryUuid, lineUuid1, lineUuid2, amount, date]) => {
        const entry = createEntry(entryUuid, date)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, revenueAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, revenueAccountUUID, amount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const result = calculateBalance(
          AccountId.make(revenueAccountUUID),
          "Credit",
          entries,
          date,
          usdCurrency
        )

        return result.isZero
      }
    )

    it.prop(
      "debit balance equals debit amount when only debits exist",
      [uuidArb, uuidArb, positiveAmountString, localDateArb],
      ([entryUuid, lineUuid, amount, date]) => {
        const entry = createEntry(entryUuid, date)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid, entryUuid, 1, cashAccountUUID, amount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const result = calculateBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entries,
          date,
          usdCurrency
        )

        const expectedAmount = BigDecimal.unsafeFromString(amount)
        return BigDecimal.equals(result.amount, expectedAmount)
      }
    )

    it.prop(
      "credit balance equals credit amount when only credits exist",
      [uuidArb, uuidArb, positiveAmountString, localDateArb],
      ([entryUuid, lineUuid, amount, date]) => {
        const entry = createEntry(entryUuid, date)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createCreditLine(lineUuid, entryUuid, 1, revenueAccountUUID, amount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const result = calculateBalance(
          AccountId.make(revenueAccountUUID),
          "Credit",
          entries,
          date,
          usdCurrency
        )

        const expectedAmount = BigDecimal.unsafeFromString(amount)
        return BigDecimal.equals(result.amount, expectedAmount)
      }
    )

    it.prop(
      "beginning + period = ending balance (algebraic identity)",
      [
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        positiveAmountString,
        positiveAmountString,
        localDateArb,
        localDateArb
      ],
      ([entryUuid1, entryUuid2, lineUuid1, lineUuid2, amount1, amount2, date1, date2]) => {
        // Ensure date1 < date2
        const earlierDate = date1.year < date2.year ||
          (date1.year === date2.year && date1.month < date2.month) ||
          (date1.year === date2.year && date1.month === date2.month && date1.day < date2.day)
          ? date1
          : date2
        const laterDate = earlierDate === date1 ? date2 : date1

        const entry1 = createEntry(entryUuid1, earlierDate)
        const entry2 = createEntry(entryUuid2, laterDate)

        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid1, 1, cashAccountUUID, amount1, usdCurrency)
        ]
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid2, entryUuid2, 1, cashAccountUUID, amount2, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const beginning = calculateBeginningBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entries,
          laterDate,
          usdCurrency
        )

        const period = calculatePeriodBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entries,
          laterDate,
          laterDate,
          usdCurrency
        )

        const ending = calculateBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entries,
          laterDate,
          usdCurrency
        )

        const sum = BigDecimal.sum(beginning.amount, period.amount)
        return BigDecimal.equals(sum, ending.amount)
      }
    )

    it.prop(
      "debits minus credits equals balance for debit accounts",
      [uuidArb, uuidArb, uuidArb, positiveAmountString, positiveAmountString, localDateArb],
      ([entryUuid, lineUuid1, lineUuid2, debitAmount, creditAmount, date]) => {
        const entry = createEntry(entryUuid, date)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, debitAmount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, cashAccountUUID, creditAmount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const { totalDebits, totalCredits } = calculateDebitCreditTotals(
          AccountId.make(cashAccountUUID),
          entries,
          date,
          usdCurrency
        )

        const balance = calculateBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entries,
          date,
          usdCurrency
        )

        // For debit account: balance = debits - credits
        const expected = BigDecimal.subtract(totalDebits.amount, totalCredits.amount)
        return BigDecimal.equals(balance.amount, expected)
      }
    )

    it.prop(
      "credits minus debits equals balance for credit accounts",
      [uuidArb, uuidArb, uuidArb, positiveAmountString, positiveAmountString, localDateArb],
      ([entryUuid, lineUuid1, lineUuid2, debitAmount, creditAmount, date]) => {
        const entry = createEntry(entryUuid, date)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, revenueAccountUUID, debitAmount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, revenueAccountUUID, creditAmount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const { totalDebits, totalCredits } = calculateDebitCreditTotals(
          AccountId.make(revenueAccountUUID),
          entries,
          date,
          usdCurrency
        )

        const balance = calculateBalance(
          AccountId.make(revenueAccountUUID),
          "Credit",
          entries,
          date,
          usdCurrency
        )

        // For credit account: balance = credits - debits
        const expected = BigDecimal.subtract(totalCredits.amount, totalDebits.amount)
        return BigDecimal.equals(balance.amount, expected)
      }
    )

    it.prop(
      "empty entries always returns zero balance",
      [uuidArb, localDateArb, FastCheck.constantFrom("Debit" as const, "Credit" as const)],
      ([accountUuid, date, normalBalance]) => {
        const result = calculateBalance(
          AccountId.make(accountUuid),
          normalBalance,
          [],
          date,
          usdCurrency
        )
        return result.isZero
      }
    )

    it.prop(
      "draft entries do not affect balance",
      [uuidArb, uuidArb, positiveAmountString, localDateArb],
      ([entryUuid, lineUuid, amount, date]) => {
        const entry = createEntry(entryUuid, date, "Draft")
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid, entryUuid, 1, cashAccountUUID, amount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const result = calculateBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entries,
          date,
          usdCurrency
        )

        return result.isZero
      }
    )

    it.prop(
      "balance is commutative with entry order",
      [
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        positiveAmountString,
        positiveAmountString,
        localDateArb
      ],
      ([entryUuid1, entryUuid2, lineUuid1, lineUuid2, amount1, amount2, date]) => {
        const entry1 = createEntry(entryUuid1, date)
        const entry2 = createEntry(entryUuid2, date)

        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid1, 1, cashAccountUUID, amount1, usdCurrency)
        ]
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid2, entryUuid2, 1, cashAccountUUID, amount2, usdCurrency)
        ]

        const entriesOrder1: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const entriesOrder2: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry2, lines: lines2 },
          { entry: entry1, lines: lines1 }
        ]

        const balance1 = calculateBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entriesOrder1,
          date,
          usdCurrency
        )

        const balance2 = calculateBalance(
          AccountId.make(cashAccountUUID),
          "Debit",
          entriesOrder2,
          date,
          usdCurrency
        )

        return BigDecimal.equals(balance1.amount, balance2.amount)
      }
    )
  })
})
