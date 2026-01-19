import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, FastCheck, Layer, Option } from "effect"
import {
  BalanceSheetService,
  BalanceSheetRepository,
  BalanceSheetServiceLive,
  BalanceSheetReport,
  BalanceSheetReportMetadata,
  BalanceSheetSection,
  BalanceSheetLineItem,
  CompanyNotFoundError,
  BalanceSheetNotBalancedError,
  generateBalanceSheetFromData,
  isBalanceSheetReport,
  isBalanceSheetSection,
  isBalanceSheetLineItem,
  isCompanyNotFoundError,
  isBalanceSheetNotBalancedError,
  getSectionDisplayName
} from "../../src/reporting/BalanceSheetService.ts"
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

describe("BalanceSheetService", () => {
  // Test UUIDs
  const companyUUID = "a0000000-0000-0000-0000-000000000001"
  const userUUID = "b0000000-0000-0000-0000-000000000001"

  // Account UUIDs by category
  const cashAccountUUID = "c0000000-0000-0000-0000-000000000001"
  const arAccountUUID = "c0000000-0000-0000-0000-000000000002"
  const inventoryAccountUUID = "c0000000-0000-0000-0000-000000000003"
  const equipmentAccountUUID = "c0000000-0000-0000-0000-000000000004"
  const buildingAccountUUID = "c0000000-0000-0000-0000-000000000005"
  const intangibleAccountUUID = "c0000000-0000-0000-0000-000000000006"
  const apAccountUUID = "c0000000-0000-0000-0000-000000000007"
  const accruedLiabAccountUUID = "c0000000-0000-0000-0000-000000000008"
  const longTermDebtAccountUUID = "c0000000-0000-0000-0000-000000000009"
  const commonStockAccountUUID = "c0000000-0000-0000-0000-000000000010"
  const retainedEarningsAccountUUID = "c0000000-0000-0000-0000-000000000011"
  const ociAccountUUID = "c0000000-0000-0000-0000-000000000012"
  const treasuryStockAccountUUID = "c0000000-0000-0000-0000-000000000013"
  const revenueAccountUUID = "c0000000-0000-0000-0000-000000000014"
  const expenseAccountUUID = "c0000000-0000-0000-0000-000000000015"

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

  // Standard test accounts
  const cashAccount = createAccount(cashAccountUUID, "1000", "Cash", "Asset", "CurrentAsset")
  const arAccount = createAccount(arAccountUUID, "1100", "Accounts Receivable", "Asset", "CurrentAsset")
  const inventoryAccount = createAccount(inventoryAccountUUID, "1200", "Inventory", "Asset", "CurrentAsset")
  const equipmentAccount = createAccount(equipmentAccountUUID, "1500", "Equipment", "Asset", "FixedAsset")
  const buildingAccount = createAccount(buildingAccountUUID, "1600", "Building", "Asset", "FixedAsset")
  const intangibleAccount = createAccount(intangibleAccountUUID, "1700", "Patents", "Asset", "IntangibleAsset")
  const apAccount = createAccount(apAccountUUID, "2000", "Accounts Payable", "Liability", "CurrentLiability")
  const accruedLiabAccount = createAccount(accruedLiabAccountUUID, "2100", "Accrued Liabilities", "Liability", "CurrentLiability")
  const longTermDebtAccount = createAccount(longTermDebtAccountUUID, "2500", "Long-term Debt", "Liability", "NonCurrentLiability")
  const commonStockAccount = createAccount(commonStockAccountUUID, "3000", "Common Stock", "Equity", "ContributedCapital")
  const retainedEarningsAccount = createAccount(retainedEarningsAccountUUID, "3100", "Retained Earnings", "Equity", "RetainedEarnings")
  const ociAccount = createAccount(ociAccountUUID, "3200", "Accumulated OCI", "Equity", "OtherComprehensiveIncome")
  const treasuryStockAccount = createAccount(treasuryStockAccountUUID, "3300", "Treasury Stock", "Equity", "TreasuryStock")
  const revenueAccount = createAccount(revenueAccountUUID, "4000", "Sales Revenue", "Revenue", "OperatingRevenue")
  const expenseAccount = createAccount(expenseAccountUUID, "6000", "Office Expense", "Expense", "OperatingExpense")

  describe("BalanceSheetLineItem", () => {
    it("creates a valid line item", () => {
      const lineItem = BalanceSheetLineItem.make({
        accountId: Option.some(AccountId.make(cashAccountUUID)),
        accountNumber: Option.some("1000"),
        description: "Cash",
        currentAmount: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        comparativeAmount: Option.none(),
        variance: Option.none(),
        variancePercentage: Option.none(),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })

      expect(isBalanceSheetLineItem(lineItem)).toBe(true)
      expect(lineItem.isAccountLine).toBe(true)
      expect(lineItem.isTotalLine).toBe(false)
      expect(lineItem.isHeaderLine).toBe(false)
    })

    it("identifies subtotal lines correctly", () => {
      const lineItem = BalanceSheetLineItem.make({
        accountId: Option.none(),
        accountNumber: Option.none(),
        description: "Total Current Assets",
        currentAmount: MonetaryAmount.unsafeFromString("25000.00", "USD"),
        comparativeAmount: Option.none(),
        variance: Option.none(),
        variancePercentage: Option.none(),
        isSubtotal: true,
        indentLevel: 0,
        style: "Subtotal"
      })

      expect(lineItem.isAccountLine).toBe(false)
      expect(lineItem.isSubtotal).toBe(true)
    })

    it("tracks variance correctly", () => {
      const lineItem = BalanceSheetLineItem.make({
        accountId: Option.some(AccountId.make(cashAccountUUID)),
        accountNumber: Option.some("1000"),
        description: "Cash",
        currentAmount: MonetaryAmount.unsafeFromString("12000.00", "USD"),
        comparativeAmount: Option.some(MonetaryAmount.unsafeFromString("10000.00", "USD")),
        variance: Option.some(MonetaryAmount.unsafeFromString("2000.00", "USD")),
        variancePercentage: Option.some(20),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })

      expect(lineItem.hasPositiveVariance).toBe(true)
      expect(lineItem.hasNegativeVariance).toBe(false)
    })
  })

  describe("BalanceSheetSection", () => {
    it("creates a valid section", () => {
      const section = BalanceSheetSection.make({
        sectionType: "CurrentAssets",
        displayName: "Current Assets",
        lineItems: [
          BalanceSheetLineItem.make({
            accountId: Option.some(AccountId.make(cashAccountUUID)),
            accountNumber: Option.some("1000"),
            description: "Cash",
            currentAmount: MonetaryAmount.unsafeFromString("10000.00", "USD"),
            comparativeAmount: Option.none(),
            variance: Option.none(),
            variancePercentage: Option.none(),
            isSubtotal: false,
            indentLevel: 1,
            style: "Normal"
          })
        ],
        subtotal: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      expect(isBalanceSheetSection(section)).toBe(true)
      expect(section.accountCount).toBe(1)
      expect(section.hasAccounts).toBe(true)
    })
  })

  describe("BalanceSheetReport", () => {
    it("creates a valid balanced report", () => {
      const metadata = BalanceSheetReportMetadata.make({
        companyId,
        asOfDate: jan31,
        comparativeDate: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 3,
        isBalanced: true
      })

      const currentAssets = BalanceSheetSection.make({
        sectionType: "CurrentAssets",
        displayName: "Current Assets",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const nonCurrentAssets = BalanceSheetSection.make({
        sectionType: "NonCurrentAssets",
        displayName: "Non-Current Assets",
        lineItems: [],
        subtotal: MonetaryAmount.zero(usdCurrency),
        comparativeSubtotal: Option.none()
      })

      const currentLiabilities = BalanceSheetSection.make({
        sectionType: "CurrentLiabilities",
        displayName: "Current Liabilities",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("3000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const nonCurrentLiabilities = BalanceSheetSection.make({
        sectionType: "NonCurrentLiabilities",
        displayName: "Non-Current Liabilities",
        lineItems: [],
        subtotal: MonetaryAmount.zero(usdCurrency),
        comparativeSubtotal: Option.none()
      })

      const equity = BalanceSheetSection.make({
        sectionType: "Equity",
        displayName: "Equity",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("7000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const report = BalanceSheetReport.make({
        metadata,
        currentAssets,
        nonCurrentAssets,
        currentLiabilities,
        nonCurrentLiabilities,
        equity,
        totalAssets: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        comparativeTotalAssets: Option.none(),
        totalLiabilities: MonetaryAmount.unsafeFromString("3000.00", "USD"),
        comparativeTotalLiabilities: Option.none(),
        totalEquity: MonetaryAmount.unsafeFromString("7000.00", "USD"),
        comparativeTotalEquity: Option.none(),
        totalLiabilitiesAndEquity: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        comparativeTotalLiabilitiesAndEquity: Option.none()
      })

      expect(isBalanceSheetReport(report)).toBe(true)
      expect(report.isBalanced).toBe(true)
      expect(report.outOfBalanceAmount.isZero).toBe(true)
      expect(report.sections.length).toBe(5)
    })

    it("detects unbalanced report", () => {
      const metadata = BalanceSheetReportMetadata.make({
        companyId,
        asOfDate: jan31,
        comparativeDate: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 2,
        isBalanced: false
      })

      const currentAssets = BalanceSheetSection.make({
        sectionType: "CurrentAssets",
        displayName: "Current Assets",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const nonCurrentAssets = BalanceSheetSection.make({
        sectionType: "NonCurrentAssets",
        displayName: "Non-Current Assets",
        lineItems: [],
        subtotal: MonetaryAmount.zero(usdCurrency),
        comparativeSubtotal: Option.none()
      })

      const currentLiabilities = BalanceSheetSection.make({
        sectionType: "CurrentLiabilities",
        displayName: "Current Liabilities",
        lineItems: [],
        subtotal: MonetaryAmount.zero(usdCurrency),
        comparativeSubtotal: Option.none()
      })

      const nonCurrentLiabilities = BalanceSheetSection.make({
        sectionType: "NonCurrentLiabilities",
        displayName: "Non-Current Liabilities",
        lineItems: [],
        subtotal: MonetaryAmount.zero(usdCurrency),
        comparativeSubtotal: Option.none()
      })

      const equity = BalanceSheetSection.make({
        sectionType: "Equity",
        displayName: "Equity",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("8000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const report = BalanceSheetReport.make({
        metadata,
        currentAssets,
        nonCurrentAssets,
        currentLiabilities,
        nonCurrentLiabilities,
        equity,
        totalAssets: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        comparativeTotalAssets: Option.none(),
        totalLiabilities: MonetaryAmount.zero(usdCurrency),
        comparativeTotalLiabilities: Option.none(),
        totalEquity: MonetaryAmount.unsafeFromString("8000.00", "USD"),
        comparativeTotalEquity: Option.none(),
        totalLiabilitiesAndEquity: MonetaryAmount.unsafeFromString("8000.00", "USD"),
        comparativeTotalLiabilitiesAndEquity: Option.none()
      })

      expect(report.isBalanced).toBe(false)
      expect(BigDecimal.equals(report.outOfBalanceAmount.amount, BigDecimal.unsafeFromString("2000"))).toBe(true)
    })
  })

  describe("getSectionDisplayName", () => {
    it("returns correct display names for all section types", () => {
      expect(getSectionDisplayName("CurrentAssets")).toBe("Current Assets")
      expect(getSectionDisplayName("NonCurrentAssets")).toBe("Non-Current Assets")
      expect(getSectionDisplayName("CurrentLiabilities")).toBe("Current Liabilities")
      expect(getSectionDisplayName("NonCurrentLiabilities")).toBe("Non-Current Liabilities")
      expect(getSectionDisplayName("Equity")).toBe("Equity")
    })
  })

  describe("Error Types", () => {
    it("creates CompanyNotFoundError", () => {
      const error = new CompanyNotFoundError({ companyId })
      expect(isCompanyNotFoundError(error)).toBe(true)
      expect(error.message).toContain(companyUUID)
    })

    it("creates BalanceSheetNotBalancedError", () => {
      const error = new BalanceSheetNotBalancedError({
        companyId,
        asOfDate: { year: 2025, month: 1, day: 31 },
        totalAssets: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        totalLiabilities: MonetaryAmount.unsafeFromString("3000.00", "USD"),
        totalEquity: MonetaryAmount.unsafeFromString("5000.00", "USD")
      })
      expect(isBalanceSheetNotBalancedError(error)).toBe(true)
      expect(error.message).toContain("not balanced")
      expect(error.message).toContain("2025-01-31")
    })
  })

  describe("generateBalanceSheetFromData", () => {
    it.effect("generates balance sheet with all sections", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          equipmentAccount,
          apAccount,
          longTermDebtAccount,
          commonStockAccount,
          retainedEarningsAccount
        ]

        // Opening entry: Debit Cash 10000, Debit Equipment 5000, Credit Common Stock 15000
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan1)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "10000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, equipmentAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId1, 3, commonStockAccountUUID, "15000.00", usdCurrency)
        ]

        // Operating entry: Debit AP 2000, Credit Cash 2000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000004", entryId2, 1, apAccountUUID, "2000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000005", entryId2, 2, cashAccountUUID, "2000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        expect(report.isBalanced).toBe(true)

        // Current Assets: Cash 8000
        expect(BigDecimal.equals(report.currentAssets.subtotal.amount, BigDecimal.unsafeFromString("8000"))).toBe(true)

        // Non-Current Assets: Equipment 5000
        expect(BigDecimal.equals(report.nonCurrentAssets.subtotal.amount, BigDecimal.unsafeFromString("5000"))).toBe(true)

        // Current Liabilities: AP -2000 (we paid off 2000, starting from 0)
        expect(BigDecimal.equals(report.currentLiabilities.subtotal.amount, BigDecimal.unsafeFromString("-2000"))).toBe(true)

        // Non-Current Liabilities: 0
        expect(report.nonCurrentLiabilities.subtotal.isZero).toBe(true)

        // Equity: Common Stock 15000
        expect(BigDecimal.equals(report.equity.subtotal.amount, BigDecimal.unsafeFromString("15000"))).toBe(true)

        // Total Assets: 8000 + 5000 = 13000
        expect(BigDecimal.equals(report.totalAssets.amount, BigDecimal.unsafeFromString("13000"))).toBe(true)

        // Total Liabilities: -2000
        expect(BigDecimal.equals(report.totalLiabilities.amount, BigDecimal.unsafeFromString("-2000"))).toBe(true)

        // Total Equity: 15000
        expect(BigDecimal.equals(report.totalEquity.amount, BigDecimal.unsafeFromString("15000"))).toBe(true)

        // Total L&E: -2000 + 15000 = 13000
        expect(BigDecimal.equals(report.totalLiabilitiesAndEquity.amount, BigDecimal.unsafeFromString("13000"))).toBe(true)
      })
    )

    it.effect("returns empty sections when no balance sheet accounts", () =>
      Effect.gen(function* () {
        const accounts = [revenueAccount, expenseAccount] // Only income statement accounts
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        expect(report.isBalanced).toBe(true)
        expect(report.currentAssets.accountCount).toBe(0)
        expect(report.nonCurrentAssets.accountCount).toBe(0)
        expect(report.currentLiabilities.accountCount).toBe(0)
        expect(report.nonCurrentLiabilities.accountCount).toBe(0)
        expect(report.equity.accountCount).toBe(0)
        expect(report.totalAssets.isZero).toBe(true)
        expect(report.totalLiabilitiesAndEquity.isZero).toBe(true)
      })
    )

    it.effect("excludes zero balance accounts by default", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, arAccount, apAccount, commonStockAccount]

        // Only create entries for cash and common stock (AR and AP have no entries)
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Should only have 2 accounts (Cash and Common Stock)
        expect(report.currentAssets.accountCount).toBe(1)
        expect(report.currentLiabilities.accountCount).toBe(0)
        expect(report.equity.accountCount).toBe(1)
      })
    )

    it.effect("includes zero balance accounts when requested", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, arAccount, apAccount, commonStockAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency,
          { includeZeroBalances: true }
        )

        // Should have all 4 accounts
        expect(report.currentAssets.accountCount).toBe(2) // Cash and AR
        expect(report.currentLiabilities.accountCount).toBe(1) // AP
        expect(report.equity.accountCount).toBe(1) // Common Stock
      })
    )

    it.effect("groups accounts into correct sections", () =>
      Effect.gen(function* () {
        // Create accounts for all balance sheet categories
        const accounts = [
          cashAccount,            // CurrentAsset
          arAccount,              // CurrentAsset
          inventoryAccount,       // CurrentAsset
          equipmentAccount,       // FixedAsset -> NonCurrentAssets
          buildingAccount,        // FixedAsset -> NonCurrentAssets
          intangibleAccount,      // IntangibleAsset -> NonCurrentAssets
          apAccount,              // CurrentLiability
          accruedLiabAccount,     // CurrentLiability
          longTermDebtAccount,    // NonCurrentLiability
          commonStockAccount,     // ContributedCapital -> Equity
          retainedEarningsAccount,// RetainedEarnings -> Equity
          ociAccount,             // OtherComprehensiveIncome -> Equity
          treasuryStockAccount    // TreasuryStock -> Equity
        ]

        // Create balanced entry
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "100.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "100.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency,
          { includeZeroBalances: true }
        )

        // Check account categorization
        expect(report.currentAssets.accountCount).toBe(3) // Cash, AR, Inventory
        expect(report.nonCurrentAssets.accountCount).toBe(3) // Equipment, Building, Patents
        expect(report.currentLiabilities.accountCount).toBe(2) // AP, Accrued
        expect(report.nonCurrentLiabilities.accountCount).toBe(1) // Long-term Debt
        expect(report.equity.accountCount).toBe(4) // Common Stock, RE, OCI, Treasury Stock
      })
    )

    it.effect("sorts line items by account number", () =>
      Effect.gen(function* () {
        // Create accounts out of order
        const accounts = [arAccount, cashAccount, inventoryAccount] // 1100, 1000, 1200

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "100.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000002", entryId, 2, arAccountUUID, "100.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId, 3, inventoryAccountUUID, "100.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId, 4, commonStockAccountUUID, "300.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]
        const accountsWithEquity = [...accounts, commonStockAccount]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accountsWithEquity,
          entries,
          jan31,
          usdCurrency
        )

        // Should be sorted by account number
        const lineItems = report.currentAssets.lineItems
        expect(lineItems.length).toBe(3)
        expect(Option.getOrThrow(lineItems[0].accountNumber)).toBe("1000") // Cash
        expect(Option.getOrThrow(lineItems[1].accountNumber)).toBe("1100") // AR
        expect(Option.getOrThrow(lineItems[2].accountNumber)).toBe("1200") // Inventory
      })
    )

    it.effect("ignores draft entries", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, commonStockAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15, "Draft")
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // No balances should be recorded (draft entry)
        expect(report.currentAssets.accountCount).toBe(0)
        expect(report.equity.accountCount).toBe(0)
        expect(report.totalAssets.isZero).toBe(true)
      })
    )

    it.effect("respects asOfDate filter", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, commonStockAccount]

        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entryId2 = "e0000000-0000-0000-0000-000000000002"

        const entry1 = createEntry(entryId1, jan15)
        const feb15 = LocalDate.make({ year: 2025, month: 2, day: 15 })
        const entry2 = createEntry(entryId2, feb15) // After asOfDate

        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, commonStockAccountUUID, "5000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Only January entry should be included
        expect(BigDecimal.equals(report.totalAssets.amount, BigDecimal.unsafeFromString("10000"))).toBe(true)
      })
    )

    it.effect("fails with BalanceSheetNotBalancedError for unbalanced data", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, commonStockAccount]

        // Create an unbalanced entry (shouldn't happen in real systems)
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)

        // Unbalanced: Debit 10000, Credit only 8000
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "8000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const result = yield* Effect.either(
          generateBalanceSheetFromData(
            companyId,
            accounts,
            entries,
            jan31,
            usdCurrency
          )
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(isBalanceSheetNotBalancedError(result.left)).toBe(true)
        }
      })
    )

    it.effect("supports comparative periods", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, commonStockAccount]

        // Entry in prior year
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]

        // Additional entry in current year
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, commonStockAccountUUID, "5000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency,
          { comparativeDate: dec31_2024 }
        )

        // Current amounts: Cash 15000, Common Stock 15000
        expect(BigDecimal.equals(report.totalAssets.amount, BigDecimal.unsafeFromString("15000"))).toBe(true)
        expect(BigDecimal.equals(report.totalEquity.amount, BigDecimal.unsafeFromString("15000"))).toBe(true)

        // Comparative amounts: Cash 10000, Common Stock 10000
        expect(Option.isSome(report.comparativeTotalAssets)).toBe(true)
        expect(BigDecimal.equals(Option.getOrThrow(report.comparativeTotalAssets).amount, BigDecimal.unsafeFromString("10000"))).toBe(true)
        expect(BigDecimal.equals(Option.getOrThrow(report.comparativeTotalEquity).amount, BigDecimal.unsafeFromString("10000"))).toBe(true)

        // Check comparative subtotals
        expect(Option.isSome(report.currentAssets.comparativeSubtotal)).toBe(true)
        expect(BigDecimal.equals(Option.getOrThrow(report.currentAssets.comparativeSubtotal).amount, BigDecimal.unsafeFromString("10000"))).toBe(true)

        // Check variance on line items
        const cashLine = report.currentAssets.lineItems.find(item =>
          Option.isSome(item.accountNumber) && Option.getOrThrow(item.accountNumber) === "1000"
        )
        expect(cashLine).toBeDefined()
        expect(Option.isSome(cashLine!.variance)).toBe(true)
        expect(BigDecimal.equals(Option.getOrThrow(cashLine!.variance).amount, BigDecimal.unsafeFromString("5000"))).toBe(true)
        expect(Option.isSome(cashLine!.variancePercentage)).toBe(true)
        expect(Option.getOrThrow(cashLine!.variancePercentage)).toBe(50)
      })
    )

    it.effect("calculates variance percentage correctly", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, commonStockAccount]

        // Prior period: 10000
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, dec31_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]

        // Current period: additional 2500 (25% increase)
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "2500.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, commonStockAccountUUID, "2500.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency,
          { comparativeDate: dec31_2024 }
        )

        const cashLine = report.currentAssets.lineItems.find(item =>
          Option.isSome(item.accountNumber) && Option.getOrThrow(item.accountNumber) === "1000"
        )
        expect(cashLine).toBeDefined()
        expect(Option.getOrThrow(cashLine!.variancePercentage)).toBe(25)
      })
    )

    it.effect("excludes non-postable (summary) accounts", () =>
      Effect.gen(function* () {
        const summaryAccount = createAccount(
          "c0000000-0000-0000-0000-000000000099",
          "1001",
          "Cash Summary",
          "Asset",
          "CurrentAsset",
          false // not postable
        )

        const accounts = [cashAccount, summaryAccount, commonStockAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Summary account should not appear
        expect(report.currentAssets.accountCount).toBe(1) // Only Cash
        const summaryLine = report.currentAssets.lineItems.find(item =>
          Option.isSome(item.accountNumber) && Option.getOrThrow(item.accountNumber) === "1001"
        )
        expect(summaryLine).toBeUndefined()
      })
    )

    it.effect("excludes revenue and expense accounts", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          commonStockAccount,
          revenueAccount,  // Should be excluded
          expenseAccount   // Should be excluded
        ]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, commonStockAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency,
          { includeZeroBalances: true }
        )

        // Only balance sheet accounts
        expect(report.totalAccountCount).toBe(2) // Cash and Common Stock only
      })
    )
  })

  describe("BalanceSheetService with repository", () => {
    const createTestRepository = (
      accounts: ReadonlyArray<Account>,
      entries: ReadonlyArray<JournalEntryWithLines>,
      currency: CurrencyCode | null = usdCurrency
    ): Layer.Layer<BalanceSheetRepository> =>
      Layer.succeed(BalanceSheetRepository, {
        getAccountsForCompany: () => Effect.succeed(accounts),
        getCompanyFunctionalCurrency: () =>
          Effect.succeed(currency ? Option.some(currency) : Option.none()),
        getPostedJournalEntriesWithLines: () => Effect.succeed(entries)
      })

    const createServiceWithRepo = (
      accounts: ReadonlyArray<Account>,
      entries: ReadonlyArray<JournalEntryWithLines>,
      currency: CurrencyCode | null = usdCurrency
    ) =>
      Layer.provideMerge(
        BalanceSheetServiceLive,
        createTestRepository(accounts, entries, currency)
      )

    it.effect("generates balance sheet via service", () =>
      Effect.gen(function* () {
        const service = yield* BalanceSheetService

        const report = yield* service.generateBalanceSheet({
          companyId,
          asOfDate: jan31
        })

        expect(report.isBalanced).toBe(true)
        expect(report.currentAssets.accountCount).toBe(1)
        expect(report.equity.accountCount).toBe(1)
      }).pipe(
        Effect.provide(createServiceWithRepo([cashAccount, commonStockAccount], [
          {
            entry: createEntry("e0000000-0000-0000-0000-000000000001", jan15),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "10000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, commonStockAccountUUID, "10000.00", usdCurrency)
            ]
          }
        ]))
      )
    )

    it.effect("fails with CompanyNotFoundError when company not found", () =>
      Effect.gen(function* () {
        const service = yield* BalanceSheetService

        const result = yield* Effect.either(
          service.generateBalanceSheet({
            companyId,
            asOfDate: jan31
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

    it.effect("fails with BalanceSheetNotBalancedError via service", () =>
      Effect.gen(function* () {
        const service = yield* BalanceSheetService

        const result = yield* Effect.either(
          service.generateBalanceSheet({
            companyId,
            asOfDate: jan31
          })
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(isBalanceSheetNotBalancedError(result.left)).toBe(true)
        }
      }).pipe(
        Effect.provide(createServiceWithRepo([cashAccount, commonStockAccount], [
          {
            // Unbalanced entry
            entry: createEntry("e0000000-0000-0000-0000-000000000001", jan15),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "10000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, commonStockAccountUUID, "8000.00", usdCurrency)
            ]
          }
        ]))
      )
    )

    it.effect("supports comparative via service", () =>
      Effect.gen(function* () {
        const service = yield* BalanceSheetService

        const report = yield* service.generateBalanceSheet({
          companyId,
          asOfDate: jan31,
          comparativeDate: dec31_2024
        })

        expect(report.isBalanced).toBe(true)
        expect(Option.isSome(report.comparativeTotalAssets)).toBe(true)
      }).pipe(
        Effect.provide(createServiceWithRepo([cashAccount, commonStockAccount], [
          {
            entry: createEntry("e0000000-0000-0000-0000-000000000001", dec31_2024),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "10000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, commonStockAccountUUID, "10000.00", usdCurrency)
            ]
          },
          {
            entry: createEntry("e0000000-0000-0000-0000-000000000002", jan15),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000003", "e0000000-0000-0000-0000-000000000002", 1, cashAccountUUID, "5000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000004", "e0000000-0000-0000-0000-000000000002", 2, commonStockAccountUUID, "5000.00", usdCurrency)
            ]
          }
        ]))
      )
    )
  })

  describe("property-based tests", () => {
    // Generate a positive amount string
    const positiveAmountString = FastCheck.integer({ min: 1, max: 999999 })
      .chain((int) =>
        FastCheck.integer({ min: 0, max: 9999 })
          .map((decimal) => `${int}.${String(decimal).padStart(4, "0")}`)
      )

    const uuidArb = FastCheck.uuid()

    it.prop(
      "balance sheet is always balanced when all entries are balanced",
      [uuidArb, uuidArb, uuidArb, positiveAmountString],
      ([entryUuid, lineUuid1, lineUuid2, amount]) => {
        const accounts = [cashAccount, commonStockAccount]
        const entry = createEntry(entryUuid, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, commonStockAccountUUID, amount, usdCurrency)
        ]
        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const program = generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return result.isBalanced
      }
    )

    it.prop(
      "total assets equals total liabilities plus equity",
      [uuidArb, uuidArb, uuidArb, positiveAmountString],
      ([entryUuid, lineUuid1, lineUuid2, amount]) => {
        const accounts = [cashAccount, commonStockAccount]
        const entry = createEntry(entryUuid, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, commonStockAccountUUID, amount, usdCurrency)
        ]
        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const program = generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return BigDecimal.equals(
          result.totalAssets.amount,
          result.totalLiabilitiesAndEquity.amount
        )
      }
    )

    it.prop(
      "empty entries always produces balanced report",
      [uuidArb],
      () => {
        const accounts = [cashAccount, commonStockAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const program = generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return result.isBalanced && result.totalAssets.isZero
      }
    )

    it.prop(
      "out of balance amount is zero for balanced balance sheet",
      [uuidArb, uuidArb, uuidArb, positiveAmountString],
      ([entryUuid, lineUuid1, lineUuid2, amount]) => {
        const accounts = [cashAccount, commonStockAccount]
        const entry = createEntry(entryUuid, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, commonStockAccountUUID, amount, usdCurrency)
        ]
        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const program = generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return result.outOfBalanceAmount.isZero
      }
    )
  })

  describe("comprehensive accounting scenarios", () => {
    it.effect("handles typical balance sheet with all sections populated", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          arAccount,
          inventoryAccount,
          equipmentAccount,
          buildingAccount,
          apAccount,
          accruedLiabAccount,
          longTermDebtAccount,
          commonStockAccount,
          retainedEarningsAccount
        ]

        // Entry 1: Initial investment - Cash 50000, Equipment 30000, Building 100000 -> Common Stock 180000
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan1)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "50000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, equipmentAccountUUID, "30000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId1, 3, buildingAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId1, 4, commonStockAccountUUID, "180000.00", usdCurrency)
        ]

        // Entry 2: Purchase inventory on credit - Inventory 10000 -> AP 10000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId2, 1, inventoryAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId2, 2, apAccountUUID, "10000.00", usdCurrency)
        ]

        // Entry 3: Long-term loan - Cash 50000 -> Long-term Debt 50000
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const jan20 = LocalDate.make({ year: 2025, month: 1, day: 20 })
        const entry3 = createEntry(entryId3, jan20)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000007", entryId3, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000008", entryId3, 2, longTermDebtAccountUUID, "50000.00", usdCurrency)
        ]

        // Entry 4: Accrue expense - Retained Earnings (expense) 2000 -> Accrued Liabilities 2000
        const entryId4 = "e0000000-0000-0000-0000-000000000004"
        const entry4 = createEntry(entryId4, jan31)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000009", entryId4, 1, retainedEarningsAccountUUID, "2000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000010", entryId4, 2, accruedLiabAccountUUID, "2000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 },
          { entry: entry4, lines: lines4 }
        ]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Verify the report is balanced
        expect(report.isBalanced).toBe(true)

        // Verify section totals
        // Current Assets: Cash 100000, Inventory 10000 = 110000
        expect(BigDecimal.equals(report.currentAssets.subtotal.amount, BigDecimal.unsafeFromString("110000"))).toBe(true)

        // Non-Current Assets: Equipment 30000, Building 100000 = 130000
        expect(BigDecimal.equals(report.nonCurrentAssets.subtotal.amount, BigDecimal.unsafeFromString("130000"))).toBe(true)

        // Total Assets: 110000 + 130000 = 240000
        expect(BigDecimal.equals(report.totalAssets.amount, BigDecimal.unsafeFromString("240000"))).toBe(true)

        // Current Liabilities: AP 10000, Accrued 2000 = 12000
        expect(BigDecimal.equals(report.currentLiabilities.subtotal.amount, BigDecimal.unsafeFromString("12000"))).toBe(true)

        // Non-Current Liabilities: Long-term Debt 50000
        expect(BigDecimal.equals(report.nonCurrentLiabilities.subtotal.amount, BigDecimal.unsafeFromString("50000"))).toBe(true)

        // Total Liabilities: 12000 + 50000 = 62000
        expect(BigDecimal.equals(report.totalLiabilities.amount, BigDecimal.unsafeFromString("62000"))).toBe(true)

        // Equity: Common Stock 180000, Retained Earnings -2000 = 178000
        expect(BigDecimal.equals(report.totalEquity.amount, BigDecimal.unsafeFromString("178000"))).toBe(true)

        // Total L&E: 62000 + 178000 = 240000
        expect(BigDecimal.equals(report.totalLiabilitiesAndEquity.amount, BigDecimal.unsafeFromString("240000"))).toBe(true)

        // Verify account counts
        expect(report.currentAssets.accountCount).toBe(2) // Cash, Inventory (AR is zero)
        expect(report.nonCurrentAssets.accountCount).toBe(2) // Equipment, Building
        expect(report.currentLiabilities.accountCount).toBe(2) // AP, Accrued
        expect(report.nonCurrentLiabilities.accountCount).toBe(1) // Long-term Debt
        expect(report.equity.accountCount).toBe(2) // Common Stock, Retained Earnings
      })
    )

    it.effect("handles all equity categories correctly", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          commonStockAccount,
          retainedEarningsAccount,
          ociAccount,
          treasuryStockAccount
        ]

        // Entry 1: Initial investment
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan1)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, commonStockAccountUUID, "100000.00", usdCurrency)
        ]

        // Entry 2: OCI gain
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, ociAccountUUID, "5000.00", usdCurrency)
        ]

        // Entry 3: Treasury stock purchase (debit equity, credit cash)
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const jan20 = LocalDate.make({ year: 2025, month: 1, day: 20 })
        const entry3 = createEntry(entryId3, jan20)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, treasuryStockAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, cashAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 }
        ]

        const report = yield* generateBalanceSheetFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency,
          { includeZeroBalances: true }
        )

        expect(report.isBalanced).toBe(true)

        // Cash: 100000 + 5000 - 10000 = 95000
        expect(BigDecimal.equals(report.totalAssets.amount, BigDecimal.unsafeFromString("95000"))).toBe(true)

        // Total Equity: 100000 (CS) + 0 (RE) + 5000 (OCI) - 10000 (TS) = 95000
        // Note: Treasury Stock has debit balance, so it reduces equity
        expect(BigDecimal.equals(report.totalEquity.amount, BigDecimal.unsafeFromString("95000"))).toBe(true)

        // Verify equity accounts are categorized correctly
        expect(report.equity.accountCount).toBe(4) // All equity categories
      })
    )
  })
})
