import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, FastCheck, Layer, Option } from "effect"
import {
  EquityStatementService,
  EquityStatementRepository,
  EquityStatementServiceLive,
  EquityComponentColumn,
  EquityMovementRow,
  CompanyNotFoundError,
  InvalidPeriodError,
  generateEquityStatementFromData,
  isEquityStatementReport,
  isEquityComponentColumn,
  isEquityMovementRow,
  isCompanyNotFoundError,
  isInvalidPeriodError,
  getComponentDisplayName,
  getMovementDisplayName
} from "../../src/reporting/EquityStatementService.ts"
import type {
  AccountType,
  AccountCategory} from "../../src/accounting/Account.ts";
import {
  Account,
  AccountId,
  getNormalBalanceForType
} from "../../src/accounting/Account.ts"
import { JournalEntry, JournalEntryId, UserId, EntryNumber } from "../../src/journal/JournalEntry.ts"
import { JournalEntryLine, JournalEntryLineId } from "../../src/journal/JournalEntryLine.ts"
import type { JournalEntryWithLines } from "../../src/accounting/AccountBalance.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"
import { AccountNumber } from "../../src/accounting/AccountNumber.ts"

describe("EquityStatementService", () => {
  // Test UUIDs
  const companyUUID = "a0000000-0000-0000-0000-000000000001"
  const userUUID = "b0000000-0000-0000-0000-000000000001"

  // Account UUIDs
  const commonStockAccountUUID = "c0000000-0000-0000-0000-000000000001"
  const apicAccountUUID = "c0000000-0000-0000-0000-000000000002"
  const retainedEarningsAccountUUID = "c0000000-0000-0000-0000-000000000003"
  const treasuryStockAccountUUID = "c0000000-0000-0000-0000-000000000004"
  const aociAccountUUID = "c0000000-0000-0000-0000-000000000005"
  const nciAccountUUID = "c0000000-0000-0000-0000-000000000006"
  const dividendsAccountUUID = "c0000000-0000-0000-0000-000000000007"
  const salesRevenueAccountUUID = "c0000000-0000-0000-0000-000000000008"
  const salariesExpenseAccountUUID = "c0000000-0000-0000-0000-000000000009"
  const cashAccountUUID = "c0000000-0000-0000-0000-000000000010"

  const usdCurrency = CurrencyCode.make("USD")
  const companyId = CompanyId.make(companyUUID)

  // Test dates
  const jan1 = LocalDate.make({ year: 2025, month: 1, day: 1 })
  const jan15 = LocalDate.make({ year: 2025, month: 1, day: 15 })
  const jan31 = LocalDate.make({ year: 2025, month: 1, day: 31 })
  const dec31_2024 = LocalDate.make({ year: 2024, month: 12, day: 31 })

  // Helper to create an account
  const createAccount = (
    id: string,
    number: string,
    name: string,
    type: AccountType,
    category: AccountCategory,
    isPostable: boolean = true
  ): Account => {
    return Account.make({
      id: AccountId.make(id),
      companyId: CompanyId.make(companyUUID),
      accountNumber: AccountNumber.make(number),
      name,
      description: Option.none(),
      accountType: type,
      accountCategory: category,
      normalBalance: getNormalBalanceForType(type),
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable,
      isCashFlowRelevant: type === "Asset",
      cashFlowCategory: type === "Asset" ? Option.some("Operating" as const) : Option.none(),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive: true,
      createdAt: Timestamp.make({ epochMillis: Date.now() }),
      deactivatedAt: Option.none()
    })
  }

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

  // Standard test accounts - Equity
  const commonStockAccount = createAccount(
    commonStockAccountUUID,
    "3000",
    "Common Stock",
    "Equity",
    "ContributedCapital"
  )
  const apicAccount = createAccount(
    apicAccountUUID,
    "3100",
    "Additional Paid-In Capital",
    "Equity",
    "ContributedCapital"
  )
  const retainedEarningsAccount = createAccount(
    retainedEarningsAccountUUID,
    "3200",
    "Retained Earnings",
    "Equity",
    "RetainedEarnings"
  )
  const treasuryStockAccount = createAccount(
    treasuryStockAccountUUID,
    "3300",
    "Treasury Stock",
    "Equity",
    "TreasuryStock"
  )
  const aociAccount = createAccount(
    aociAccountUUID,
    "3400",
    "Accumulated Other Comprehensive Income",
    "Equity",
    "OtherComprehensiveIncome"
  )
  const nciAccount = createAccount(
    nciAccountUUID,
    "3500",
    "Non-Controlling Interest",
    "Equity",
    "ContributedCapital"
  )
  const dividendsAccount = createAccount(
    dividendsAccountUUID,
    "3210",
    "Dividends Declared",
    "Equity",
    "RetainedEarnings"
  )

  // Income statement accounts
  const salesRevenueAccount = createAccount(
    salesRevenueAccountUUID,
    "4000",
    "Sales Revenue",
    "Revenue",
    "OperatingRevenue"
  )
  const salariesExpenseAccount = createAccount(
    salariesExpenseAccountUUID,
    "6000",
    "Salaries Expense",
    "Expense",
    "OperatingExpense"
  )

  // Balance sheet accounts
  const cashAccount = createAccount(
    cashAccountUUID,
    "1000",
    "Cash",
    "Asset",
    "CurrentAsset"
  )

  describe("EquityComponentColumn", () => {
    it("creates a valid column", () => {
      const column = EquityComponentColumn.make({
        componentType: "CommonStock",
        displayName: "Common Stock",
        openingBalance: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        netIncome: MonetaryAmount.zero(usdCurrency),
        oci: MonetaryAmount.zero(usdCurrency),
        dividends: MonetaryAmount.zero(usdCurrency),
        stockIssuance: MonetaryAmount.unsafeFromString("50000.00", "USD"),
        stockRepurchase: MonetaryAmount.zero(usdCurrency),
        otherAdjustments: MonetaryAmount.zero(usdCurrency),
        closingBalance: MonetaryAmount.unsafeFromString("150000.00", "USD")
      })

      expect(isEquityComponentColumn(column)).toBe(true)
      expect(column.hasMovement).toBe(true)
      expect(BigDecimal.equals(
        column.totalChange.amount,
        BigDecimal.unsafeFromString("50000")
      )).toBe(true)
    })

    it("calculates sum of movements correctly", () => {
      const column = EquityComponentColumn.make({
        componentType: "RetainedEarnings",
        displayName: "Retained Earnings",
        openingBalance: MonetaryAmount.unsafeFromString("200000.00", "USD"),
        netIncome: MonetaryAmount.unsafeFromString("50000.00", "USD"),
        oci: MonetaryAmount.zero(usdCurrency),
        dividends: MonetaryAmount.unsafeFromString("-10000.00", "USD"),
        stockIssuance: MonetaryAmount.zero(usdCurrency),
        stockRepurchase: MonetaryAmount.zero(usdCurrency),
        otherAdjustments: MonetaryAmount.zero(usdCurrency),
        closingBalance: MonetaryAmount.unsafeFromString("240000.00", "USD")
      })

      expect(BigDecimal.equals(
        column.sumOfMovements.amount,
        BigDecimal.unsafeFromString("40000")
      )).toBe(true)
    })
  })

  describe("EquityMovementRow", () => {
    it("creates a valid row", () => {
      const row = EquityMovementRow.make({
        movementType: "OpeningBalance",
        displayName: "Opening Balance",
        commonStock: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        apic: MonetaryAmount.unsafeFromString("200000.00", "USD"),
        retainedEarnings: MonetaryAmount.unsafeFromString("150000.00", "USD"),
        treasuryStock: MonetaryAmount.unsafeFromString("-50000.00", "USD"),
        aoci: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        nci: MonetaryAmount.zero(usdCurrency),
        rowTotal: MonetaryAmount.unsafeFromString("410000.00", "USD")
      })

      expect(isEquityMovementRow(row)).toBe(true)
      expect(row.isBalanceRow).toBe(true)
      expect(row.isMovementRow).toBe(false)
      expect(row.hasAmounts).toBe(true)
    })

    it("identifies movement rows correctly", () => {
      const row = EquityMovementRow.make({
        movementType: "NetIncome",
        displayName: "Net Income",
        commonStock: MonetaryAmount.zero(usdCurrency),
        apic: MonetaryAmount.zero(usdCurrency),
        retainedEarnings: MonetaryAmount.unsafeFromString("50000.00", "USD"),
        treasuryStock: MonetaryAmount.zero(usdCurrency),
        aoci: MonetaryAmount.zero(usdCurrency),
        nci: MonetaryAmount.zero(usdCurrency),
        rowTotal: MonetaryAmount.unsafeFromString("50000.00", "USD")
      })

      expect(row.isBalanceRow).toBe(false)
      expect(row.isMovementRow).toBe(true)
    })
  })

  describe("getComponentDisplayName", () => {
    it("returns correct display names for all component types", () => {
      expect(getComponentDisplayName("CommonStock")).toBe("Common Stock")
      expect(getComponentDisplayName("APIC")).toBe("Additional Paid-In Capital")
      expect(getComponentDisplayName("RetainedEarnings")).toBe("Retained Earnings")
      expect(getComponentDisplayName("TreasuryStock")).toBe("Treasury Stock")
      expect(getComponentDisplayName("AOCI")).toBe("Accumulated Other Comprehensive Income")
      expect(getComponentDisplayName("NCI")).toBe("Non-Controlling Interest")
    })
  })

  describe("getMovementDisplayName", () => {
    it("returns correct display names for all movement types", () => {
      expect(getMovementDisplayName("OpeningBalance")).toBe("Opening Balance")
      expect(getMovementDisplayName("NetIncome")).toBe("Net Income")
      expect(getMovementDisplayName("OCI")).toBe("Other Comprehensive Income")
      expect(getMovementDisplayName("Dividends")).toBe("Dividends Declared")
      expect(getMovementDisplayName("StockIssuance")).toBe("Stock Issuance")
      expect(getMovementDisplayName("StockRepurchase")).toBe("Stock Repurchase")
      expect(getMovementDisplayName("OtherAdjustments")).toBe("Other Adjustments")
      expect(getMovementDisplayName("ClosingBalance")).toBe("Closing Balance")
    })
  })

  describe("Error Types", () => {
    it("creates CompanyNotFoundError", () => {
      const error = new CompanyNotFoundError({ companyId })
      expect(isCompanyNotFoundError(error)).toBe(true)
      expect(error.message).toContain(companyUUID)
    })

    it("creates InvalidPeriodError", () => {
      const error = new InvalidPeriodError({
        periodStart: { year: 2025, month: 1, day: 31 },
        periodEnd: { year: 2025, month: 1, day: 1 }
      })
      expect(isInvalidPeriodError(error)).toBe(true)
      expect(error.message).toContain("Invalid period")
      expect(error.message).toContain("2025-01-31")
      expect(error.message).toContain("2025-01-01")
    })
  })

  describe("generateEquityStatementFromData", () => {
    it.effect("generates equity statement with opening balances", () =>
      Effect.gen(function* () {
        const accounts = [
          commonStockAccount,
          apicAccount,
          retainedEarningsAccount,
          treasuryStockAccount,
          aociAccount,
          cashAccount
        ]

        // Opening balance entries (before period start)
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "300000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId1, 3, apicAccountUUID, "200000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        expect(isEquityStatementReport(report)).toBe(true)

        // Check opening balances
        expect(BigDecimal.equals(
          report.columns.commonStock.openingBalance.amount,
          BigDecimal.unsafeFromString("100000")
        )).toBe(true)
        expect(BigDecimal.equals(
          report.columns.apic.openingBalance.amount,
          BigDecimal.unsafeFromString("200000")
        )).toBe(true)

        // Total opening equity should be 300000
        expect(BigDecimal.equals(
          report.totalOpeningEquity.amount,
          BigDecimal.unsafeFromString("300000")
        )).toBe(true)

        // Since no changes in January, closing should equal opening
        expect(BigDecimal.equals(
          report.totalClosingEquity.amount,
          BigDecimal.unsafeFromString("300000")
        )).toBe(true)
      })
    )

    it.effect("calculates net income effect on retained earnings", () =>
      Effect.gen(function* () {
        const accounts = [
          commonStockAccount,
          apicAccount,
          retainedEarningsAccount,
          salesRevenueAccount,
          salariesExpenseAccount,
          cashAccount
        ]

        // Opening balance entry
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, retainedEarningsAccountUUID, "100000.00", usdCurrency)
        ]

        // Revenue entry in January: 50000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        // Expense entry in January: 20000
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, salariesExpenseAccountUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, cashAccountUUID, "20000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Net income should be 50000 - 20000 = 30000
        expect(BigDecimal.equals(
          report.netIncome.amount,
          BigDecimal.unsafeFromString("30000")
        )).toBe(true)

        // Net income flows to retained earnings column
        expect(BigDecimal.equals(
          report.columns.retainedEarnings.netIncome.amount,
          BigDecimal.unsafeFromString("30000")
        )).toBe(true)

        // Opening retained earnings was 100000
        expect(BigDecimal.equals(
          report.columns.retainedEarnings.openingBalance.amount,
          BigDecimal.unsafeFromString("100000")
        )).toBe(true)
      })
    )

    it.effect("tracks dividends reducing retained earnings", () =>
      Effect.gen(function* () {
        const accounts = [
          retainedEarningsAccount,
          dividendsAccount,
          cashAccount
        ]

        // Opening balance entry
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, retainedEarningsAccountUUID, "100000.00", usdCurrency)
        ]

        // Dividend declaration entry
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, dividendsAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Dividends should show as negative (reducing equity)
        expect(BigDecimal.equals(
          report.dividends.amount,
          BigDecimal.unsafeFromString("-10000")
        )).toBe(true)

        // The dividends row should exist
        const dividendsRow = report.dividendsRow
        expect(dividendsRow).toBeDefined()
      })
    )

    it.effect("tracks stock issuance in common stock and APIC", () =>
      Effect.gen(function* () {
        const accounts = [
          commonStockAccount,
          apicAccount,
          cashAccount
        ]

        // Opening balance entry
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId1, 3, apicAccountUUID, "50000.00", usdCurrency)
        ]

        // Stock issuance entry in January
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000004", entryId2, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000005", entryId2, 2, commonStockAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId2, 3, apicAccountUUID, "40000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Common Stock opening: 50000, issuance: 10000, closing: 60000
        expect(BigDecimal.equals(
          report.columns.commonStock.openingBalance.amount,
          BigDecimal.unsafeFromString("50000")
        )).toBe(true)
        expect(BigDecimal.equals(
          report.columns.commonStock.stockIssuance.amount,
          BigDecimal.unsafeFromString("10000")
        )).toBe(true)
        expect(BigDecimal.equals(
          report.columns.commonStock.closingBalance.amount,
          BigDecimal.unsafeFromString("60000")
        )).toBe(true)

        // APIC opening: 50000, issuance: 40000, closing: 90000
        expect(BigDecimal.equals(
          report.columns.apic.openingBalance.amount,
          BigDecimal.unsafeFromString("50000")
        )).toBe(true)
        expect(BigDecimal.equals(
          report.columns.apic.stockIssuance.amount,
          BigDecimal.unsafeFromString("40000")
        )).toBe(true)
        expect(BigDecimal.equals(
          report.columns.apic.closingBalance.amount,
          BigDecimal.unsafeFromString("90000")
        )).toBe(true)
      })
    )

    it.effect("tracks treasury stock repurchase", () =>
      Effect.gen(function* () {
        const accounts = [
          commonStockAccount,
          treasuryStockAccount,
          cashAccount
        ]

        // Opening balance entry
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "100000.00", usdCurrency)
        ]

        // Treasury stock purchase in January
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, treasuryStockAccountUUID, "25000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "25000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Treasury stock should have repurchase movement
        expect(BigDecimal.equals(
          report.columns.treasuryStock.openingBalance.amount,
          BigDecimal.unsafeFromString("0")
        )).toBe(true)
        // Treasury stock balance increases (contra equity account)
        expect(BigDecimal.equals(
          report.columns.treasuryStock.closingBalance.amount,
          BigDecimal.unsafeFromString("-25000")
        )).toBe(true)
      })
    )

    it.effect("tracks other comprehensive income in AOCI", () =>
      Effect.gen(function* () {
        const accounts = [
          aociAccount,
          cashAccount
        ]

        // Opening balance entry
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, aociAccountUUID, "10000.00", usdCurrency)
        ]

        // OCI entry in January (foreign currency translation adjustment)
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, aociAccountUUID, "5000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // AOCI should show OCI movement
        expect(BigDecimal.equals(
          report.columns.aoci.openingBalance.amount,
          BigDecimal.unsafeFromString("10000")
        )).toBe(true)
        expect(BigDecimal.equals(
          report.columns.aoci.oci.amount,
          BigDecimal.unsafeFromString("5000")
        )).toBe(true)
        expect(BigDecimal.equals(
          report.columns.aoci.closingBalance.amount,
          BigDecimal.unsafeFromString("15000")
        )).toBe(true)
      })
    )

    it.effect("generates all required rows", () =>
      Effect.gen(function* () {
        const accounts = [commonStockAccount, retainedEarningsAccount, cashAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Check that all required rows exist
        expect(report.rows.length).toBe(8)

        const movementTypes = report.rows.map(r => r.movementType)
        expect(movementTypes).toContain("OpeningBalance")
        expect(movementTypes).toContain("NetIncome")
        expect(movementTypes).toContain("OCI")
        expect(movementTypes).toContain("Dividends")
        expect(movementTypes).toContain("StockIssuance")
        expect(movementTypes).toContain("StockRepurchase")
        expect(movementTypes).toContain("OtherAdjustments")
        expect(movementTypes).toContain("ClosingBalance")
      })
    )

    it.effect("calculates row totals correctly", () =>
      Effect.gen(function* () {
        const accounts = [
          commonStockAccount,
          apicAccount,
          retainedEarningsAccount,
          cashAccount
        ]

        // Opening balance entry
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "350000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId1, 3, apicAccountUUID, "150000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId1, 4, retainedEarningsAccountUUID, "100000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Opening balance row total should be 350000
        const openingRow = report.openingBalanceRow
        expect(openingRow).toBeDefined()
        expect(BigDecimal.equals(
          openingRow!.rowTotal.amount,
          BigDecimal.unsafeFromString("350000")
        )).toBe(true)

        // Closing balance should equal opening (no movements)
        const closingRow = report.closingBalanceRow
        expect(closingRow).toBeDefined()
        expect(BigDecimal.equals(
          closingRow!.rowTotal.amount,
          BigDecimal.unsafeFromString("350000")
        )).toBe(true)
      })
    )

    it.effect("returns empty sections when no equity accounts", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        expect(report.totalOpeningEquity.isZero).toBe(true)
        expect(report.totalClosingEquity.isZero).toBe(true)
        expect(report.totalChangeInEquity.isZero).toBe(true)
      })
    )

    it.effect("fails with InvalidPeriodError for invalid period", () =>
      Effect.gen(function* () {
        const accounts = [commonStockAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const result = yield* Effect.either(
          generateEquityStatementFromData(
            companyId,
            accounts,
            entries,
            jan31,
            jan1, // Start after end
            usdCurrency
          )
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(isInvalidPeriodError(result.left)).toBe(true)
        }
      })
    )

    it.effect("excludes non-postable (summary) accounts", () =>
      Effect.gen(function* () {
        const summaryAccount = createAccount(
          "c0000000-0000-0000-0000-000000000099",
          "3001",
          "Equity Summary",
          "Equity",
          "ContributedCapital",
          false // not postable
        )

        const accounts = [commonStockAccount, summaryAccount, cashAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, dec31_2024)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "100000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Only common stock should be included
        expect(BigDecimal.equals(
          report.totalOpeningEquity.amount,
          BigDecimal.unsafeFromString("100000")
        )).toBe(true)
      })
    )

    it.effect("supports consolidated option", () =>
      Effect.gen(function* () {
        const accounts = [commonStockAccount, nciAccount, cashAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, dec31_2024)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "120000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId, 3, nciAccountUUID, "20000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency,
          { isConsolidated: true }
        )

        expect(report.metadata.isConsolidated).toBe(true)
        // NCI should be included in total
        expect(BigDecimal.equals(
          report.totalOpeningEquity.amount,
          BigDecimal.unsafeFromString("120000")
        )).toBe(true)
      })
    )

    it.effect("handles loss scenario (negative net income)", () =>
      Effect.gen(function* () {
        const accounts = [
          retainedEarningsAccount,
          salesRevenueAccount,
          salariesExpenseAccount,
          cashAccount
        ]

        // Opening balance entry
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, retainedEarningsAccountUUID, "100000.00", usdCurrency)
        ]

        // Revenue: 20000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, salesRevenueAccountUUID, "20000.00", usdCurrency)
        ]

        // Expenses: 50000 (loss of 30000)
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, salariesExpenseAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, cashAccountUUID, "50000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Net income should be negative (loss)
        expect(BigDecimal.equals(
          report.netIncome.amount,
          BigDecimal.unsafeFromString("-30000")
        )).toBe(true)

        // Total equity should decrease
        expect(report.equityDecreased).toBe(true)
      })
    )
  })

  describe("EquityStatementService with repository", () => {
    const createTestRepository = (
      accounts: ReadonlyArray<Account>,
      entries: ReadonlyArray<JournalEntryWithLines>,
      currency: CurrencyCode | null = usdCurrency,
      isConsolidated: boolean = false
    ): Layer.Layer<EquityStatementRepository> =>
      Layer.succeed(EquityStatementRepository, {
        getAccountsForCompany: () => Effect.succeed(accounts),
        getCompanyFunctionalCurrency: () =>
          Effect.succeed(currency ? Option.some(currency) : Option.none()),
        getPostedJournalEntriesWithLines: () => Effect.succeed(entries),
        isConsolidatedCompany: () => Effect.succeed(isConsolidated)
      })

    const createServiceWithRepo = (
      accounts: ReadonlyArray<Account>,
      entries: ReadonlyArray<JournalEntryWithLines>,
      currency: CurrencyCode | null = usdCurrency,
      isConsolidated: boolean = false
    ) =>
      Layer.provideMerge(
        EquityStatementServiceLive,
        createTestRepository(accounts, entries, currency, isConsolidated)
      )

    it.effect("generates equity statement via service", () =>
      Effect.gen(function* () {
        const service = yield* EquityStatementService

        const report = yield* service.generateEquityStatement({
          companyId,
          periodStart: jan1,
          periodEnd: jan31
        })

        expect(isEquityStatementReport(report)).toBe(true)
        expect(report.rows.length).toBe(8)
      }).pipe(
        Effect.provide(createServiceWithRepo(
          [commonStockAccount, retainedEarningsAccount, cashAccount],
          [
            {
              entry: createEntry("e0000000-0000-0000-0000-000000000001", dec31_2024),
              lines: [
                createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "100000.00", usdCurrency),
                createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, commonStockAccountUUID, "100000.00", usdCurrency)
              ]
            }
          ]
        ))
      )
    )

    it.effect("fails with CompanyNotFoundError when company not found", () =>
      Effect.gen(function* () {
        const service = yield* EquityStatementService

        const result = yield* Effect.either(
          service.generateEquityStatement({
            companyId,
            periodStart: jan1,
            periodEnd: jan31
          })
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(isCompanyNotFoundError(result.left)).toBe(true)
        }
      }).pipe(
        Effect.provide(createServiceWithRepo([], [], null))
      )
    )

    it.effect("fails with InvalidPeriodError via service", () =>
      Effect.gen(function* () {
        const service = yield* EquityStatementService

        const result = yield* Effect.either(
          service.generateEquityStatement({
            companyId,
            periodStart: jan31,
            periodEnd: jan1 // Invalid: start > end
          })
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(isInvalidPeriodError(result.left)).toBe(true)
        }
      }).pipe(
        Effect.provide(createServiceWithRepo([commonStockAccount], []))
      )
    )
  })

  describe("property-based tests", () => {
    const positiveAmountString = FastCheck.integer({ min: 1, max: 999999 })
      .chain((int) =>
        FastCheck.integer({ min: 0, max: 99 })
          .map((decimal) => `${int}.${String(decimal).padStart(2, "0")}`)
      )

    const uuidArb = FastCheck.uuid()

    it.prop(
      "closing balance equals opening plus changes",
      [uuidArb, uuidArb, uuidArb, uuidArb, positiveAmountString, positiveAmountString, positiveAmountString],
      ([entryUuid1, entryUuid2, lineUuid1a, lineUuid1b, openingAmount, revenueAmount, expenseAmount]) => {
        const accounts = [
          retainedEarningsAccount,
          salesRevenueAccount,
          salariesExpenseAccount,
          cashAccount
        ]

        // Opening balance
        const entry1 = createEntry(entryUuid1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1a, entryUuid1, 1, cashAccountUUID, openingAmount, usdCurrency),
          createCreditLine(lineUuid1b, entryUuid1, 2, retainedEarningsAccountUUID, openingAmount, usdCurrency)
        ]

        // Revenue entry
        const lineUuid2a = "d0000000-0000-0000-0000-000000000011"
        const lineUuid2b = "d0000000-0000-0000-0000-000000000012"
        const entry2 = createEntry(entryUuid2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid2a, entryUuid2, 1, cashAccountUUID, revenueAmount, usdCurrency),
          createCreditLine(lineUuid2b, entryUuid2, 2, salesRevenueAccountUUID, revenueAmount, usdCurrency)
        ]

        // Expense entry
        const expenseEntryUuid = "e0000000-0000-0000-0000-000000000099"
        const lineUuid3a = "d0000000-0000-0000-0000-000000000021"
        const lineUuid3b = "d0000000-0000-0000-0000-000000000022"
        const entry3 = createEntry(expenseEntryUuid, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid3a, expenseEntryUuid, 1, salariesExpenseAccountUUID, expenseAmount, usdCurrency),
          createCreditLine(lineUuid3b, expenseEntryUuid, 2, cashAccountUUID, expenseAmount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 }
        ]

        const program = generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)

        // Total change should equal closing - opening
        const expectedChange = BigDecimal.subtract(
          result.totalClosingEquity.amount,
          result.totalOpeningEquity.amount
        )
        return BigDecimal.equals(result.totalChangeInEquity.amount, expectedChange)
      }
    )

    it.prop(
      "empty entries always produces zero change in equity",
      [uuidArb],
      () => {
        const accounts = [commonStockAccount, retainedEarningsAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const program = generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return result.totalChangeInEquity.isZero
      }
    )
  })

  describe("comprehensive accounting scenarios", () => {
    it.effect("handles complete equity statement with all components", () =>
      Effect.gen(function* () {
        const accounts = [
          commonStockAccount,
          apicAccount,
          retainedEarningsAccount,
          treasuryStockAccount,
          aociAccount,
          dividendsAccount,
          salesRevenueAccount,
          salariesExpenseAccount,
          cashAccount
        ]

        // Opening balances (prior year)
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "500000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId1, 3, apicAccountUUID, "200000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId1, 4, retainedEarningsAccountUUID, "180000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000005", entryId1, 5, aociAccountUUID, "20000.00", usdCurrency)
        ]

        // Revenue for the period: 150000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000006", entryId2, 1, cashAccountUUID, "150000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000007", entryId2, 2, salesRevenueAccountUUID, "150000.00", usdCurrency)
        ]

        // Expenses for the period: 70000
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000008", entryId3, 1, salariesExpenseAccountUUID, "70000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000009", entryId3, 2, cashAccountUUID, "70000.00", usdCurrency)
        ]

        // Dividends: 20000
        const entryId4 = "e0000000-0000-0000-0000-000000000004"
        const entry4 = createEntry(entryId4, jan15)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId4, 1, dividendsAccountUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId4, 2, cashAccountUUID, "20000.00", usdCurrency)
        ]

        // Stock issuance: 25000 (5000 par + 20000 APIC)
        const entryId5 = "e0000000-0000-0000-0000-000000000005"
        const entry5 = createEntry(entryId5, jan15)
        const lines5: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000012", entryId5, 1, cashAccountUUID, "25000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000013", entryId5, 2, commonStockAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000014", entryId5, 3, apicAccountUUID, "20000.00", usdCurrency)
        ]

        // Treasury stock repurchase: 15000
        const entryId6 = "e0000000-0000-0000-0000-000000000006"
        const entry6 = createEntry(entryId6, jan15)
        const lines6: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000015", entryId6, 1, treasuryStockAccountUUID, "15000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000016", entryId6, 2, cashAccountUUID, "15000.00", usdCurrency)
        ]

        // OCI gain: 5000
        const entryId7 = "e0000000-0000-0000-0000-000000000007"
        const entry7 = createEntry(entryId7, jan15)
        const lines7: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000017", entryId7, 1, cashAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000018", entryId7, 2, aociAccountUUID, "5000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 },
          { entry: entry4, lines: lines4 },
          { entry: entry5, lines: lines5 },
          { entry: entry6, lines: lines6 },
          { entry: entry7, lines: lines7 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Verify opening balances
        expect(BigDecimal.equals(
          report.totalOpeningEquity.amount,
          BigDecimal.unsafeFromString("500000")
        )).toBe(true)

        // Net income: 150000 - 70000 = 80000
        expect(BigDecimal.equals(
          report.netIncome.amount,
          BigDecimal.unsafeFromString("80000")
        )).toBe(true)

        // Dividends: -20000
        expect(BigDecimal.equals(
          report.dividends.amount,
          BigDecimal.unsafeFromString("-20000")
        )).toBe(true)

        // Stock issuance effect on Common Stock
        expect(BigDecimal.equals(
          report.columns.commonStock.stockIssuance.amount,
          BigDecimal.unsafeFromString("5000")
        )).toBe(true)

        // Stock issuance effect on APIC
        expect(BigDecimal.equals(
          report.columns.apic.stockIssuance.amount,
          BigDecimal.unsafeFromString("20000")
        )).toBe(true)

        // OCI effect on AOCI
        expect(BigDecimal.equals(
          report.columns.aoci.oci.amount,
          BigDecimal.unsafeFromString("5000")
        )).toBe(true)

        // Total change: 80000 (net income) - 20000 (dividends) + 25000 (stock) - 15000 (treasury) + 5000 (OCI) = 75000
        expect(BigDecimal.equals(
          report.totalChangeInEquity.amount,
          BigDecimal.unsafeFromString("75000")
        )).toBe(true)

        // Closing equity: 500000 + 75000 = 575000
        expect(BigDecimal.equals(
          report.totalClosingEquity.amount,
          BigDecimal.unsafeFromString("575000")
        )).toBe(true)

        // Verify report structure
        expect(report.allColumns.length).toBe(6)
        expect(report.movementRows.length).toBe(6) // All except opening and closing
      })
    )

    it.effect("equity increased flag works correctly", () =>
      Effect.gen(function* () {
        const accounts = [retainedEarningsAccount, salesRevenueAccount, cashAccount]

        // Opening balance
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, retainedEarningsAccountUUID, "100000.00", usdCurrency)
        ]

        // Revenue
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateEquityStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        expect(report.equityIncreased).toBe(true)
        expect(report.equityDecreased).toBe(false)
      })
    )
  })
})
