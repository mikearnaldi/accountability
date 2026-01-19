import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, FastCheck, Layer, Option } from "effect"
import {
  TrialBalanceService,
  TrialBalanceRepository,
  TrialBalanceServiceLive,
  TrialBalanceReport,
  TrialBalanceReportMetadata,
  TrialBalanceLineItem,
  CompanyNotFoundError,
  TrialBalanceNotBalancedError,
  generateTrialBalanceFromData,
  isTrialBalanceReport,
  isTrialBalanceLineItem,
  isCompanyNotFoundError,
  isTrialBalanceNotBalancedError
} from "../../src/accounting/TrialBalanceService.ts"
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

describe("TrialBalanceService", () => {
  // Test UUIDs
  const companyUUID = "a0000000-0000-0000-0000-000000000001"
  const userUUID = "b0000000-0000-0000-0000-000000000001"
  const cashAccountUUID = "c0000000-0000-0000-0000-000000000001"
  const revenueAccountUUID = "c0000000-0000-0000-0000-000000000002"
  const expenseAccountUUID = "c0000000-0000-0000-0000-000000000003"
  const apAccountUUID = "c0000000-0000-0000-0000-000000000004"
  const equityAccountUUID = "c0000000-0000-0000-0000-000000000005"
  const summaryAccountUUID = "c0000000-0000-0000-0000-000000000006"

  const usdCurrency = CurrencyCode.make("USD")
  const companyId = CompanyId.make(companyUUID)

  // Test dates
  const jan1 = LocalDate.make({ year: 2025, month: 1, day: 1 })
  const jan15 = LocalDate.make({ year: 2025, month: 1, day: 15 })
  const jan20 = LocalDate.make({ year: 2025, month: 1, day: 20 })
  const jan31 = LocalDate.make({ year: 2025, month: 1, day: 31 })
  const feb15 = LocalDate.make({ year: 2025, month: 2, day: 15 })

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
  const cashAccount = createAccount(
    cashAccountUUID,
    "1000",
    "Cash",
    "Asset",
    "CurrentAsset"
  )
  const revenueAccount = createAccount(
    revenueAccountUUID,
    "4000",
    "Sales Revenue",
    "Revenue",
    "OperatingRevenue"
  )
  const expenseAccount = createAccount(
    expenseAccountUUID,
    "6000",
    "Office Expense",
    "Expense",
    "OperatingExpense"
  )
  const apAccount = createAccount(
    apAccountUUID,
    "2000",
    "Accounts Payable",
    "Liability",
    "CurrentLiability"
  )
  const equityAccount = createAccount(
    equityAccountUUID,
    "3000",
    "Common Stock",
    "Equity",
    "ContributedCapital"
  )
  const summaryAccount = createAccount(
    summaryAccountUUID,
    "1001",
    "Cash Summary",
    "Asset",
    "CurrentAsset",
    false // not postable
  )

  describe("TrialBalanceLineItem", () => {
    it("creates a valid line item", () => {
      const lineItem = TrialBalanceLineItem.make({
        accountId: AccountId.make(cashAccountUUID),
        accountNumber: "1000",
        accountName: "Cash",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        debitBalance: MonetaryAmount.unsafeFromString("1000.00", "USD"),
        creditBalance: MonetaryAmount.zero(usdCurrency)
      })

      expect(isTrialBalanceLineItem(lineItem)).toBe(true)
      expect(lineItem.hasDebitBalance).toBe(true)
      expect(lineItem.hasCreditBalance).toBe(false)
      expect(lineItem.hasBalance).toBe(true)
    })

    it("calculates net balance correctly for debit account", () => {
      const lineItem = TrialBalanceLineItem.make({
        accountId: AccountId.make(cashAccountUUID),
        accountNumber: "1000",
        accountName: "Cash",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        debitBalance: MonetaryAmount.unsafeFromString("1000.00", "USD"),
        creditBalance: MonetaryAmount.zero(usdCurrency)
      })

      const netBalance = lineItem.netBalance
      expect(BigDecimal.equals(netBalance.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })

    it("calculates net balance correctly for credit account", () => {
      const lineItem = TrialBalanceLineItem.make({
        accountId: AccountId.make(revenueAccountUUID),
        accountNumber: "4000",
        accountName: "Revenue",
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit",
        debitBalance: MonetaryAmount.zero(usdCurrency),
        creditBalance: MonetaryAmount.unsafeFromString("5000.00", "USD")
      })

      const netBalance = lineItem.netBalance
      expect(BigDecimal.equals(netBalance.amount, BigDecimal.unsafeFromString("5000"))).toBe(true)
    })
  })

  describe("TrialBalanceReport", () => {
    it("creates a valid report", () => {
      const metadata = TrialBalanceReportMetadata.make({
        companyId,
        asOfDate: jan31,
        periodStartDate: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 2,
        isBalanced: true
      })

      const lineItems = [
        TrialBalanceLineItem.make({
          accountId: AccountId.make(cashAccountUUID),
          accountNumber: "1000",
          accountName: "Cash",
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          debitBalance: MonetaryAmount.unsafeFromString("1000.00", "USD"),
          creditBalance: MonetaryAmount.zero(usdCurrency)
        }),
        TrialBalanceLineItem.make({
          accountId: AccountId.make(revenueAccountUUID),
          accountNumber: "4000",
          accountName: "Revenue",
          accountType: "Revenue",
          accountCategory: "OperatingRevenue",
          normalBalance: "Credit",
          debitBalance: MonetaryAmount.zero(usdCurrency),
          creditBalance: MonetaryAmount.unsafeFromString("1000.00", "USD")
        })
      ]

      const report = TrialBalanceReport.make({
        metadata,
        lineItems,
        totalDebits: MonetaryAmount.unsafeFromString("1000.00", "USD"),
        totalCredits: MonetaryAmount.unsafeFromString("1000.00", "USD")
      })

      expect(isTrialBalanceReport(report)).toBe(true)
      expect(report.isBalanced).toBe(true)
      expect(report.outOfBalanceAmount.isZero).toBe(true)
    })

    it("detects unbalanced trial balance", () => {
      const metadata = TrialBalanceReportMetadata.make({
        companyId,
        asOfDate: jan31,
        periodStartDate: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 2,
        isBalanced: false
      })

      const lineItems = [
        TrialBalanceLineItem.make({
          accountId: AccountId.make(cashAccountUUID),
          accountNumber: "1000",
          accountName: "Cash",
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          debitBalance: MonetaryAmount.unsafeFromString("1000.00", "USD"),
          creditBalance: MonetaryAmount.zero(usdCurrency)
        })
      ]

      const report = TrialBalanceReport.make({
        metadata,
        lineItems,
        totalDebits: MonetaryAmount.unsafeFromString("1000.00", "USD"),
        totalCredits: MonetaryAmount.unsafeFromString("900.00", "USD")
      })

      expect(report.isBalanced).toBe(false)
      expect(BigDecimal.equals(report.outOfBalanceAmount.amount, BigDecimal.unsafeFromString("100"))).toBe(true)
    })

    it("filters line items by account type", () => {
      const metadata = TrialBalanceReportMetadata.make({
        companyId,
        asOfDate: jan31,
        periodStartDate: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 3,
        isBalanced: true
      })

      const lineItems = [
        TrialBalanceLineItem.make({
          accountId: AccountId.make(cashAccountUUID),
          accountNumber: "1000",
          accountName: "Cash",
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          debitBalance: MonetaryAmount.unsafeFromString("1000.00", "USD"),
          creditBalance: MonetaryAmount.zero(usdCurrency)
        }),
        TrialBalanceLineItem.make({
          accountId: AccountId.make(apAccountUUID),
          accountNumber: "2000",
          accountName: "AP",
          accountType: "Liability",
          accountCategory: "CurrentLiability",
          normalBalance: "Credit",
          debitBalance: MonetaryAmount.zero(usdCurrency),
          creditBalance: MonetaryAmount.unsafeFromString("500.00", "USD")
        }),
        TrialBalanceLineItem.make({
          accountId: AccountId.make(revenueAccountUUID),
          accountNumber: "4000",
          accountName: "Revenue",
          accountType: "Revenue",
          accountCategory: "OperatingRevenue",
          normalBalance: "Credit",
          debitBalance: MonetaryAmount.zero(usdCurrency),
          creditBalance: MonetaryAmount.unsafeFromString("500.00", "USD")
        })
      ]

      const report = TrialBalanceReport.make({
        metadata,
        lineItems,
        totalDebits: MonetaryAmount.unsafeFromString("1000.00", "USD"),
        totalCredits: MonetaryAmount.unsafeFromString("1000.00", "USD")
      })

      expect(report.getLineItemsByType("Asset").length).toBe(1)
      expect(report.getLineItemsByType("Liability").length).toBe(1)
      expect(report.getLineItemsByType("Revenue").length).toBe(1)
      expect(report.getLineItemsByType("Expense").length).toBe(0)
      expect(report.balanceSheetItems.length).toBe(2)
      expect(report.incomeStatementItems.length).toBe(1)
    })

    it("calculates totals by type", () => {
      const metadata = TrialBalanceReportMetadata.make({
        companyId,
        asOfDate: jan31,
        periodStartDate: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 2,
        isBalanced: true
      })

      const lineItems = [
        TrialBalanceLineItem.make({
          accountId: AccountId.make(cashAccountUUID),
          accountNumber: "1000",
          accountName: "Cash",
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          debitBalance: MonetaryAmount.unsafeFromString("1000.00", "USD"),
          creditBalance: MonetaryAmount.zero(usdCurrency)
        }),
        TrialBalanceLineItem.make({
          accountId: AccountId.make(revenueAccountUUID),
          accountNumber: "4000",
          accountName: "Revenue",
          accountType: "Revenue",
          accountCategory: "OperatingRevenue",
          normalBalance: "Credit",
          debitBalance: MonetaryAmount.zero(usdCurrency),
          creditBalance: MonetaryAmount.unsafeFromString("1000.00", "USD")
        })
      ]

      const report = TrialBalanceReport.make({
        metadata,
        lineItems,
        totalDebits: MonetaryAmount.unsafeFromString("1000.00", "USD"),
        totalCredits: MonetaryAmount.unsafeFromString("1000.00", "USD")
      })

      const assetDebits = report.getTotalDebitsByType("Asset")
      const revenueCredits = report.getTotalCreditsByType("Revenue")

      expect(BigDecimal.equals(assetDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      expect(BigDecimal.equals(revenueCredits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
    })
  })

  describe("Error Types", () => {
    it("creates CompanyNotFoundError", () => {
      const error = new CompanyNotFoundError({ companyId })
      expect(isCompanyNotFoundError(error)).toBe(true)
      expect(error.message).toContain(companyUUID)
    })

    it("creates TrialBalanceNotBalancedError", () => {
      const error = new TrialBalanceNotBalancedError({
        companyId,
        asOfDate: { year: 2025, month: 1, day: 31 },
        totalDebits: MonetaryAmount.unsafeFromString("1000.00", "USD"),
        totalCredits: MonetaryAmount.unsafeFromString("900.00", "USD")
      })
      expect(isTrialBalanceNotBalancedError(error)).toBe(true)
      expect(error.message).toContain("not balanced")
      expect(error.message).toContain("2025-01-31")
    })
  })

  describe("generateTrialBalanceFromData", () => {
    it.effect("generates trial balance with balanced entries", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, revenueAccount]

        // Create a balanced journal entry: Debit Cash 1000, Credit Revenue 1000
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        expect(report.isBalanced).toBe(true)
        expect(report.lineItems.length).toBe(2)
        expect(BigDecimal.equals(report.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
        expect(BigDecimal.equals(report.totalCredits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      })
    )

    it.effect("returns empty report when no entries", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, revenueAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        expect(report.isBalanced).toBe(true)
        expect(report.lineItems.length).toBe(0)
        expect(report.totalDebits.isZero).toBe(true)
        expect(report.totalCredits.isZero).toBe(true)
      })
    )

    it.effect("excludes non-postable accounts", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, summaryAccount, revenueAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Summary account should not appear
        const summaryLine = report.lineItems.find(item => item.accountNumber === "1001")
        expect(summaryLine).toBeUndefined()
        expect(report.lineItems.length).toBe(2)
      })
    )

    it.effect("excludes zero balance accounts by default", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, expenseAccount, revenueAccount]

        // Only create entries for cash and revenue (expense has no entries)
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Expense account should not appear (zero balance)
        const expenseLine = report.lineItems.find(item => item.accountNumber === "6000")
        expect(expenseLine).toBeUndefined()
        expect(report.lineItems.length).toBe(2)
      })
    )

    it.effect("includes zero balance accounts when requested", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, expenseAccount, revenueAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency,
          { excludeZeroBalances: false }
        )

        // Expense account should appear with zero balance
        const expenseLine = report.lineItems.find(item => item.accountNumber === "6000")
        expect(expenseLine).toBeDefined()
        expect(expenseLine!.debitBalance.isZero).toBe(true)
        expect(expenseLine!.creditBalance.isZero).toBe(true)
      })
    )

    it.effect("supports period-based trial balance", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, revenueAccount]

        // Create two entries: one before period, one in period
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entryId2 = "e0000000-0000-0000-0000-000000000002"

        const entry1 = createEntry(entryId1, jan15) // Before period
        const entry2 = createEntry(entryId2, feb15) // In period

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

        // Generate trial balance for February only
        const feb1 = LocalDate.make({ year: 2025, month: 2, day: 1 })
        const feb28 = LocalDate.make({ year: 2025, month: 2, day: 28 })

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          feb28,
          usdCurrency,
          { periodStartDate: feb1 }
        )

        // Should only include February activity
        expect(BigDecimal.equals(report.totalDebits.amount, BigDecimal.unsafeFromString("500"))).toBe(true)
        expect(BigDecimal.equals(report.totalCredits.amount, BigDecimal.unsafeFromString("500"))).toBe(true)
      })
    )

    it.effect("sorts line items by account number", () =>
      Effect.gen(function* () {
        const accounts = [revenueAccount, cashAccount, apAccount] // Intentionally out of order

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, apAccountUUID, "500.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId, 3, revenueAccountUUID, "500.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Should be sorted by account number
        expect(report.lineItems[0].accountNumber).toBe("1000") // Cash
        expect(report.lineItems[1].accountNumber).toBe("2000") // AP
        expect(report.lineItems[2].accountNumber).toBe("4000") // Revenue
      })
    )

    it.effect("handles mixed debits and credits for same account", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, revenueAccount, expenseAccount]

        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entryId2 = "e0000000-0000-0000-0000-000000000002"

        const entry1 = createEntry(entryId1, jan15)
        const entry2 = createEntry(entryId2, jan20)

        // Entry 1: Debit Cash 1000, Credit Revenue 1000
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, revenueAccountUUID, "1000.00", usdCurrency)
        ]

        // Entry 2: Debit Expense 300, Credit Cash 300
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, expenseAccountUUID, "300.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "300.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Cash: 1000 - 300 = 700 (debit balance)
        const cashLine = report.lineItems.find(item => item.accountNumber === "1000")
        expect(cashLine).toBeDefined()
        expect(BigDecimal.equals(cashLine!.debitBalance.amount, BigDecimal.unsafeFromString("700"))).toBe(true)
        expect(cashLine!.creditBalance.isZero).toBe(true)

        // Expense: 300 (debit balance)
        const expenseLine = report.lineItems.find(item => item.accountNumber === "6000")
        expect(expenseLine).toBeDefined()
        expect(BigDecimal.equals(expenseLine!.debitBalance.amount, BigDecimal.unsafeFromString("300"))).toBe(true)

        // Revenue: 1000 (credit balance)
        const revenueLine = report.lineItems.find(item => item.accountNumber === "4000")
        expect(revenueLine).toBeDefined()
        expect(BigDecimal.equals(revenueLine!.creditBalance.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)

        // Total check
        expect(BigDecimal.equals(report.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
        expect(BigDecimal.equals(report.totalCredits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      })
    )

    it.effect("handles account with credit balance exceeding debits", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, apAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)

        // Debit Cash 100, Credit AP 100
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "100.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, apAccountUUID, "100.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Cash should have debit balance of 100
        const cashLine = report.lineItems.find(item => item.accountNumber === "1000")
        expect(cashLine).toBeDefined()
        expect(BigDecimal.equals(cashLine!.debitBalance.amount, BigDecimal.unsafeFromString("100"))).toBe(true)

        // AP should have credit balance of 100
        const apLine = report.lineItems.find(item => item.accountNumber === "2000")
        expect(apLine).toBeDefined()
        expect(BigDecimal.equals(apLine!.creditBalance.amount, BigDecimal.unsafeFromString("100"))).toBe(true)
      })
    )

    it.effect("ignores draft entries", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, revenueAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15, "Draft")
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "1000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // No balances should be recorded (draft entry)
        expect(report.lineItems.length).toBe(0)
        expect(report.totalDebits.isZero).toBe(true)
        expect(report.totalCredits.isZero).toBe(true)
      })
    )

    it.effect("respects asOfDate filter", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, revenueAccount]

        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entryId2 = "e0000000-0000-0000-0000-000000000002"

        const entry1 = createEntry(entryId1, jan15)
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

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Only January entry should be included
        expect(BigDecimal.equals(report.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
        expect(BigDecimal.equals(report.totalCredits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
      })
    )

    it.effect("fails with TrialBalanceNotBalancedError for unbalanced entries", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, revenueAccount]

        // Create an unbalanced entry (this shouldn't happen in real systems,
        // but tests the error path)
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)

        // Unbalanced: Debit 1000, Credit only 900
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, revenueAccountUUID, "900.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const result = yield* Effect.either(
          generateTrialBalanceFromData(
            companyId,
            accounts,
            entries,
            jan31,
            usdCurrency
          )
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          const error = result.left
          expect(isTrialBalanceNotBalancedError(error)).toBe(true)
          if (isTrialBalanceNotBalancedError(error)) {
            expect(BigDecimal.equals(error.totalDebits.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)
            expect(BigDecimal.equals(error.totalCredits.amount, BigDecimal.unsafeFromString("900"))).toBe(true)
          }
        }
      })
    )
  })

  describe("TrialBalanceService with repository", () => {
    // Create a test repository
    const createTestRepository = (
      accounts: ReadonlyArray<Account>,
      entries: ReadonlyArray<JournalEntryWithLines>,
      currency: CurrencyCode | null = usdCurrency
    ): Layer.Layer<TrialBalanceRepository> =>
      Layer.succeed(TrialBalanceRepository, {
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
        TrialBalanceServiceLive,
        createTestRepository(accounts, entries, currency)
      )

    it.effect("generates trial balance via service", () =>
      Effect.gen(function* () {
        const service = yield* TrialBalanceService

        const report = yield* service.generateTrialBalance({
          companyId,
          asOfDate: jan31
        })

        expect(report.isBalanced).toBe(true)
        expect(report.lineItems.length).toBe(2)
      }).pipe(
        Effect.provide(createServiceWithRepo([cashAccount, revenueAccount], [
          {
            entry: createEntry("e0000000-0000-0000-0000-000000000001", jan15),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "1000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, revenueAccountUUID, "1000.00", usdCurrency)
            ]
          }
        ]))
      )
    )

    it.effect("fails with CompanyNotFoundError when company not found", () =>
      Effect.gen(function* () {
        const service = yield* TrialBalanceService

        const result = yield* Effect.either(
          service.generateTrialBalance({
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

    it.effect("fails with TrialBalanceNotBalancedError via service", () =>
      Effect.gen(function* () {
        const service = yield* TrialBalanceService

        const result = yield* Effect.either(
          service.generateTrialBalance({
            companyId,
            asOfDate: jan31
          })
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(isTrialBalanceNotBalancedError(result.left)).toBe(true)
        }
      }).pipe(
        Effect.provide(createServiceWithRepo([cashAccount, revenueAccount], [
          {
            // Unbalanced entry: Debit 1000, Credit 900
            entry: createEntry("e0000000-0000-0000-0000-000000000001", jan15),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "1000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, revenueAccountUUID, "900.00", usdCurrency)
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

    // Generate a valid UUID
    const uuidArb = FastCheck.uuid()

    it.prop(
      "trial balance is always balanced when all entries are balanced",
      [uuidArb, uuidArb, uuidArb, positiveAmountString],
      ([entryUuid, lineUuid1, lineUuid2, amount]) => {
        const accounts = [cashAccount, revenueAccount]
        const entry = createEntry(entryUuid, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, revenueAccountUUID, amount, usdCurrency)
        ]
        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const program = generateTrialBalanceFromData(
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
      "total debits equals total credits in balanced trial balance",
      [uuidArb, uuidArb, uuidArb, positiveAmountString],
      ([entryUuid, lineUuid1, lineUuid2, amount]) => {
        const accounts = [cashAccount, revenueAccount]
        const entry = createEntry(entryUuid, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, revenueAccountUUID, amount, usdCurrency)
        ]
        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const program = generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return BigDecimal.equals(result.totalDebits.amount, result.totalCredits.amount)
      }
    )

    it.prop(
      "empty entries always produces balanced report",
      [uuidArb],
      () => {
        const accounts = [cashAccount, revenueAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const program = generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return result.isBalanced && result.lineItems.length === 0
      }
    )

    it.prop(
      "out of balance amount is zero for balanced trial balance",
      [uuidArb, uuidArb, uuidArb, positiveAmountString],
      ([entryUuid, lineUuid1, lineUuid2, amount]) => {
        const accounts = [cashAccount, revenueAccount]
        const entry = createEntry(entryUuid, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1, entryUuid, 1, cashAccountUUID, amount, usdCurrency),
          createCreditLine(lineUuid2, entryUuid, 2, revenueAccountUUID, amount, usdCurrency)
        ]
        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const program = generateTrialBalanceFromData(
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
    it.effect("handles typical month-end trial balance", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          apAccount,
          equityAccount,
          revenueAccount,
          expenseAccount
        ]

        // Opening entry: Debit Cash 10000, Credit Equity 10000
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan1)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, equityAccountUUID, "10000.00", usdCurrency)
        ]

        // Revenue entry: Debit Cash 5000, Credit Revenue 5000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, revenueAccountUUID, "5000.00", usdCurrency)
        ]

        // Expense entry: Debit Expense 2000, Credit Cash 2000
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan20)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, expenseAccountUUID, "2000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, cashAccountUUID, "2000.00", usdCurrency)
        ]

        // AP entry: Debit Expense 1000, Credit AP 1000
        const entryId4 = "e0000000-0000-0000-0000-000000000004"
        const entry4 = createEntry(entryId4, jan31)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000007", entryId4, 1, expenseAccountUUID, "1000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000008", entryId4, 2, apAccountUUID, "1000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 },
          { entry: entry4, lines: lines4 }
        ]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        // Verify balances
        // Cash: 10000 + 5000 - 2000 = 13000 (debit)
        const cashLine = report.lineItems.find(item => item.accountNumber === "1000")
        expect(BigDecimal.equals(cashLine!.debitBalance.amount, BigDecimal.unsafeFromString("13000"))).toBe(true)

        // AP: 1000 (credit)
        const apLine = report.lineItems.find(item => item.accountNumber === "2000")
        expect(BigDecimal.equals(apLine!.creditBalance.amount, BigDecimal.unsafeFromString("1000"))).toBe(true)

        // Equity: 10000 (credit)
        const equityLine = report.lineItems.find(item => item.accountNumber === "3000")
        expect(BigDecimal.equals(equityLine!.creditBalance.amount, BigDecimal.unsafeFromString("10000"))).toBe(true)

        // Revenue: 5000 (credit)
        const revenueLine = report.lineItems.find(item => item.accountNumber === "4000")
        expect(BigDecimal.equals(revenueLine!.creditBalance.amount, BigDecimal.unsafeFromString("5000"))).toBe(true)

        // Expense: 2000 + 1000 = 3000 (debit)
        const expenseLine = report.lineItems.find(item => item.accountNumber === "6000")
        expect(BigDecimal.equals(expenseLine!.debitBalance.amount, BigDecimal.unsafeFromString("3000"))).toBe(true)

        // Total check: 13000 + 3000 = 16000 (debits) = 1000 + 10000 + 5000 = 16000 (credits)
        expect(report.isBalanced).toBe(true)
        expect(BigDecimal.equals(report.totalDebits.amount, BigDecimal.unsafeFromString("16000"))).toBe(true)
        expect(BigDecimal.equals(report.totalCredits.amount, BigDecimal.unsafeFromString("16000"))).toBe(true)
      })
    )

    it.effect("handles all five account types correctly", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,       // Asset - debit normal
          apAccount,         // Liability - credit normal
          equityAccount,     // Equity - credit normal
          revenueAccount,    // Revenue - credit normal
          expenseAccount     // Expense - debit normal
        ]

        // Create balanced entry with all account types
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)

        // Debit Cash 1000, Debit Expense 500, Credit AP 500, Credit Equity 500, Credit Revenue 500
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "1000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000002", entryId, 2, expenseAccountUUID, "500.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId, 3, apAccountUUID, "500.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId, 4, equityAccountUUID, "500.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000005", entryId, 5, revenueAccountUUID, "500.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          companyId,
          accounts,
          entries,
          jan31,
          usdCurrency
        )

        expect(report.isBalanced).toBe(true)
        expect(report.lineItems.length).toBe(5)

        // Verify all account types are present
        expect(report.getLineItemsByType("Asset").length).toBe(1)
        expect(report.getLineItemsByType("Liability").length).toBe(1)
        expect(report.getLineItemsByType("Equity").length).toBe(1)
        expect(report.getLineItemsByType("Revenue").length).toBe(1)
        expect(report.getLineItemsByType("Expense").length).toBe(1)

        // Verify totals
        expect(BigDecimal.equals(report.totalDebits.amount, BigDecimal.unsafeFromString("1500"))).toBe(true)
        expect(BigDecimal.equals(report.totalCredits.amount, BigDecimal.unsafeFromString("1500"))).toBe(true)
      })
    )
  })
})
