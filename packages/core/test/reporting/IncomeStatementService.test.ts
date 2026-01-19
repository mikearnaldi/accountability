import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, FastCheck, Layer, Option } from "effect"
import {
  IncomeStatementService,
  IncomeStatementRepository,
  IncomeStatementServiceLive,
  IncomeStatementReport,
  IncomeStatementReportMetadata,
  IncomeStatementSection,
  IncomeStatementLineItem,
  CompanyNotFoundError,
  InvalidPeriodError,
  generateIncomeStatementFromData,
  isIncomeStatementReport,
  isIncomeStatementSection,
  isIncomeStatementLineItem,
  isCompanyNotFoundError,
  isInvalidPeriodError,
  getSectionDisplayName
} from "../../src/reporting/IncomeStatementService.ts"
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

describe("IncomeStatementService", () => {
  // Test UUIDs
  const companyUUID = "a0000000-0000-0000-0000-000000000001"
  const userUUID = "b0000000-0000-0000-0000-000000000001"

  // Account UUIDs by category
  const salesRevenueAccountUUID = "c0000000-0000-0000-0000-000000000001"
  const serviceRevenueAccountUUID = "c0000000-0000-0000-0000-000000000002"
  const otherRevenueAccountUUID = "c0000000-0000-0000-0000-000000000003"
  const cogsAccountUUID = "c0000000-0000-0000-0000-000000000004"
  const salariesExpenseAccountUUID = "c0000000-0000-0000-0000-000000000005"
  const rentExpenseAccountUUID = "c0000000-0000-0000-0000-000000000006"
  const utilitiesExpenseAccountUUID = "c0000000-0000-0000-0000-000000000007"
  const depreciationAccountUUID = "c0000000-0000-0000-0000-000000000008"
  const interestExpenseAccountUUID = "c0000000-0000-0000-0000-000000000009"
  const otherExpenseAccountUUID = "c0000000-0000-0000-0000-000000000010"
  const taxExpenseAccountUUID = "c0000000-0000-0000-0000-000000000011"
  const cashAccountUUID = "c0000000-0000-0000-0000-000000000012"

  const usdCurrency = CurrencyCode.make("USD")
  const companyId = CompanyId.make(companyUUID)

  // Test dates
  const jan1 = LocalDate.make({ year: 2025, month: 1, day: 1 })
  const jan15 = LocalDate.make({ year: 2025, month: 1, day: 15 })
  const jan31 = LocalDate.make({ year: 2025, month: 1, day: 31 })
  const dec1_2024 = LocalDate.make({ year: 2024, month: 12, day: 1 })
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

  // Standard test accounts - Revenue
  const salesRevenueAccount = createAccount(salesRevenueAccountUUID, "4000", "Sales Revenue", "Revenue", "OperatingRevenue")
  const serviceRevenueAccount = createAccount(serviceRevenueAccountUUID, "4100", "Service Revenue", "Revenue", "OperatingRevenue")
  const otherRevenueAccount = createAccount(otherRevenueAccountUUID, "4500", "Other Revenue", "Revenue", "OtherRevenue")

  // Standard test accounts - Cost of Sales
  const cogsAccount = createAccount(cogsAccountUUID, "5000", "Cost of Goods Sold", "Expense", "CostOfGoodsSold")

  // Standard test accounts - Operating Expenses
  const salariesExpenseAccount = createAccount(salariesExpenseAccountUUID, "6000", "Salaries Expense", "Expense", "OperatingExpense")
  const rentExpenseAccount = createAccount(rentExpenseAccountUUID, "6100", "Rent Expense", "Expense", "OperatingExpense")
  const utilitiesExpenseAccount = createAccount(utilitiesExpenseAccountUUID, "6200", "Utilities Expense", "Expense", "OperatingExpense")
  const depreciationAccount = createAccount(depreciationAccountUUID, "6300", "Depreciation Expense", "Expense", "DepreciationAmortization")

  // Standard test accounts - Other Income/Expense
  const interestExpenseAccount = createAccount(interestExpenseAccountUUID, "7000", "Interest Expense", "Expense", "InterestExpense")
  const otherExpenseAccount = createAccount(otherExpenseAccountUUID, "7100", "Other Expense", "Expense", "OtherExpense")

  // Standard test accounts - Tax
  const taxExpenseAccount = createAccount(taxExpenseAccountUUID, "8000", "Income Tax Expense", "Expense", "TaxExpense")

  // Balance sheet account (should be excluded from income statement)
  const cashAccount = createAccount(cashAccountUUID, "1000", "Cash", "Asset", "CurrentAsset")

  describe("IncomeStatementLineItem", () => {
    it("creates a valid line item", () => {
      const lineItem = IncomeStatementLineItem.make({
        accountId: Option.some(AccountId.make(salesRevenueAccountUUID)),
        accountNumber: Option.some("4000"),
        description: "Sales Revenue",
        currentAmount: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        comparativeAmount: Option.none(),
        variance: Option.none(),
        variancePercentage: Option.none(),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })

      expect(isIncomeStatementLineItem(lineItem)).toBe(true)
      expect(lineItem.isAccountLine).toBe(true)
      expect(lineItem.isTotalLine).toBe(false)
      expect(lineItem.isHeaderLine).toBe(false)
    })

    it("identifies subtotal lines correctly", () => {
      const lineItem = IncomeStatementLineItem.make({
        accountId: Option.none(),
        accountNumber: Option.none(),
        description: "Total Revenue",
        currentAmount: MonetaryAmount.unsafeFromString("150000.00", "USD"),
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
      const lineItem = IncomeStatementLineItem.make({
        accountId: Option.some(AccountId.make(salesRevenueAccountUUID)),
        accountNumber: Option.some("4000"),
        description: "Sales Revenue",
        currentAmount: MonetaryAmount.unsafeFromString("120000.00", "USD"),
        comparativeAmount: Option.some(MonetaryAmount.unsafeFromString("100000.00", "USD")),
        variance: Option.some(MonetaryAmount.unsafeFromString("20000.00", "USD")),
        variancePercentage: Option.some(20),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })

      expect(lineItem.hasPositiveVariance).toBe(true)
      expect(lineItem.hasNegativeVariance).toBe(false)
    })
  })

  describe("IncomeStatementSection", () => {
    it("creates a valid section", () => {
      const section = IncomeStatementSection.make({
        sectionType: "Revenue",
        displayName: "Revenue",
        lineItems: [
          IncomeStatementLineItem.make({
            accountId: Option.some(AccountId.make(salesRevenueAccountUUID)),
            accountNumber: Option.some("4000"),
            description: "Sales Revenue",
            currentAmount: MonetaryAmount.unsafeFromString("100000.00", "USD"),
            comparativeAmount: Option.none(),
            variance: Option.none(),
            variancePercentage: Option.none(),
            isSubtotal: false,
            indentLevel: 1,
            style: "Normal"
          })
        ],
        subtotal: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      expect(isIncomeStatementSection(section)).toBe(true)
      expect(section.accountCount).toBe(1)
      expect(section.hasAccounts).toBe(true)
    })
  })

  describe("IncomeStatementReport", () => {
    it("creates a valid report with profit margins", () => {
      const metadata = IncomeStatementReportMetadata.make({
        companyId,
        periodStart: jan1,
        periodEnd: jan31,
        comparativePeriodStart: Option.none(),
        comparativePeriodEnd: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 5
      })

      const revenue = IncomeStatementSection.make({
        sectionType: "Revenue",
        displayName: "Revenue",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const costOfSales = IncomeStatementSection.make({
        sectionType: "CostOfSales",
        displayName: "Cost of Sales",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("40000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const operatingExpenses = IncomeStatementSection.make({
        sectionType: "OperatingExpenses",
        displayName: "Operating Expenses",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("30000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const otherIncomeExpense = IncomeStatementSection.make({
        sectionType: "OtherIncomeExpense",
        displayName: "Other Income and Expenses",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("5000.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const incomeTaxExpense = IncomeStatementSection.make({
        sectionType: "IncomeTaxExpense",
        displayName: "Income Tax Expense",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("6250.00", "USD"),
        comparativeSubtotal: Option.none()
      })

      const report = IncomeStatementReport.make({
        metadata,
        revenue,
        costOfSales,
        operatingExpenses,
        otherIncomeExpense,
        incomeTaxExpense,
        totalRevenue: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        comparativeTotalRevenue: Option.none(),
        grossProfit: MonetaryAmount.unsafeFromString("60000.00", "USD"), // 100000 - 40000
        comparativeGrossProfit: Option.none(),
        operatingIncome: MonetaryAmount.unsafeFromString("30000.00", "USD"), // 60000 - 30000
        comparativeOperatingIncome: Option.none(),
        incomeBeforeTax: MonetaryAmount.unsafeFromString("25000.00", "USD"), // 30000 - 5000
        comparativeIncomeBeforeTax: Option.none(),
        netIncome: MonetaryAmount.unsafeFromString("18750.00", "USD"), // 25000 - 6250
        comparativeNetIncome: Option.none()
      })

      expect(isIncomeStatementReport(report)).toBe(true)
      expect(report.isProfitable).toBe(true)
      expect(report.grossProfitMargin).toBe(60) // 60000/100000 * 100
      expect(report.operatingProfitMargin).toBe(30) // 30000/100000 * 100
      expect(report.netProfitMargin).toBe(18.75) // 18750/100000 * 100
      expect(report.sections.length).toBe(5)
    })

    it("handles zero revenue (no division by zero)", () => {
      const metadata = IncomeStatementReportMetadata.make({
        companyId,
        periodStart: jan1,
        periodEnd: jan31,
        comparativePeriodStart: Option.none(),
        comparativePeriodEnd: Option.none(),
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        accountCount: 0
      })

      const emptySection = (type: "Revenue" | "CostOfSales" | "OperatingExpenses" | "OtherIncomeExpense" | "IncomeTaxExpense") =>
        IncomeStatementSection.make({
          sectionType: type,
          displayName: getSectionDisplayName(type),
          lineItems: [],
          subtotal: MonetaryAmount.zero(usdCurrency),
          comparativeSubtotal: Option.none()
        })

      const report = IncomeStatementReport.make({
        metadata,
        revenue: emptySection("Revenue"),
        costOfSales: emptySection("CostOfSales"),
        operatingExpenses: emptySection("OperatingExpenses"),
        otherIncomeExpense: emptySection("OtherIncomeExpense"),
        incomeTaxExpense: emptySection("IncomeTaxExpense"),
        totalRevenue: MonetaryAmount.zero(usdCurrency),
        comparativeTotalRevenue: Option.none(),
        grossProfit: MonetaryAmount.zero(usdCurrency),
        comparativeGrossProfit: Option.none(),
        operatingIncome: MonetaryAmount.zero(usdCurrency),
        comparativeOperatingIncome: Option.none(),
        incomeBeforeTax: MonetaryAmount.zero(usdCurrency),
        comparativeIncomeBeforeTax: Option.none(),
        netIncome: MonetaryAmount.zero(usdCurrency),
        comparativeNetIncome: Option.none()
      })

      // Should return null for margins when revenue is zero
      expect(report.grossProfitMargin).toBeNull()
      expect(report.operatingProfitMargin).toBeNull()
      expect(report.netProfitMargin).toBeNull()
    })
  })

  describe("getSectionDisplayName", () => {
    it("returns correct display names for all section types", () => {
      expect(getSectionDisplayName("Revenue")).toBe("Revenue")
      expect(getSectionDisplayName("CostOfSales")).toBe("Cost of Sales")
      expect(getSectionDisplayName("OperatingExpenses")).toBe("Operating Expenses")
      expect(getSectionDisplayName("OtherIncomeExpense")).toBe("Other Income and Expenses")
      expect(getSectionDisplayName("IncomeTaxExpense")).toBe("Income Tax Expense")
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

  describe("generateIncomeStatementFromData", () => {
    it.effect("generates income statement with all sections", () =>
      Effect.gen(function* () {
        const accounts = [
          salesRevenueAccount,
          cogsAccount,
          salariesExpenseAccount,
          interestExpenseAccount,
          taxExpenseAccount,
          cashAccount // Should be excluded
        ]

        // Entry 1: Sales revenue - Debit Cash, Credit Sales Revenue
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, salesRevenueAccountUUID, "100000.00", usdCurrency)
        ]

        // Entry 2: COGS - Debit COGS, Credit Cash
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cogsAccountUUID, "40000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "40000.00", usdCurrency)
        ]

        // Entry 3: Salaries - Debit Salaries, Credit Cash
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, salariesExpenseAccountUUID, "25000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, cashAccountUUID, "25000.00", usdCurrency)
        ]

        // Entry 4: Interest - Debit Interest Expense, Credit Cash
        const entryId4 = "e0000000-0000-0000-0000-000000000004"
        const entry4 = createEntry(entryId4, jan15)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000007", entryId4, 1, interestExpenseAccountUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000008", entryId4, 2, cashAccountUUID, "5000.00", usdCurrency)
        ]

        // Entry 5: Tax - Debit Tax Expense, Credit Cash
        const entryId5 = "e0000000-0000-0000-0000-000000000005"
        const entry5 = createEntry(entryId5, jan15)
        const lines5: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000009", entryId5, 1, taxExpenseAccountUUID, "7500.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000010", entryId5, 2, cashAccountUUID, "7500.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 },
          { entry: entry4, lines: lines4 },
          { entry: entry5, lines: lines5 }
        ]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Revenue: 100000
        expect(BigDecimal.equals(report.totalRevenue.amount, BigDecimal.unsafeFromString("100000"))).toBe(true)

        // COGS: 40000
        expect(BigDecimal.equals(report.costOfSales.subtotal.amount, BigDecimal.unsafeFromString("40000"))).toBe(true)

        // Gross Profit: 100000 - 40000 = 60000
        expect(BigDecimal.equals(report.grossProfit.amount, BigDecimal.unsafeFromString("60000"))).toBe(true)

        // Operating Expenses: 25000
        expect(BigDecimal.equals(report.operatingExpenses.subtotal.amount, BigDecimal.unsafeFromString("25000"))).toBe(true)

        // Operating Income: 60000 - 25000 = 35000
        expect(BigDecimal.equals(report.operatingIncome.amount, BigDecimal.unsafeFromString("35000"))).toBe(true)

        // Other Income/Expense: 5000
        expect(BigDecimal.equals(report.otherIncomeExpense.subtotal.amount, BigDecimal.unsafeFromString("5000"))).toBe(true)

        // Income Before Tax: 35000 - 5000 = 30000
        expect(BigDecimal.equals(report.incomeBeforeTax.amount, BigDecimal.unsafeFromString("30000"))).toBe(true)

        // Tax Expense: 7500
        expect(BigDecimal.equals(report.incomeTaxExpense.subtotal.amount, BigDecimal.unsafeFromString("7500"))).toBe(true)

        // Net Income: 30000 - 7500 = 22500
        expect(BigDecimal.equals(report.netIncome.amount, BigDecimal.unsafeFromString("22500"))).toBe(true)

        // Profitability
        expect(report.isProfitable).toBe(true)

        // Account counts (excluding balance sheet accounts)
        expect(report.revenue.accountCount).toBe(1)
        expect(report.costOfSales.accountCount).toBe(1)
        expect(report.operatingExpenses.accountCount).toBe(1)
        expect(report.otherIncomeExpense.accountCount).toBe(1)
        expect(report.incomeTaxExpense.accountCount).toBe(1)
        expect(report.totalAccountCount).toBe(5)
      })
    )

    it.effect("returns empty sections when no income statement accounts", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount] // Only balance sheet accounts
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        expect(report.totalRevenue.isZero).toBe(true)
        expect(report.grossProfit.isZero).toBe(true)
        expect(report.operatingIncome.isZero).toBe(true)
        expect(report.incomeBeforeTax.isZero).toBe(true)
        expect(report.netIncome.isZero).toBe(true)
        expect(report.totalAccountCount).toBe(0)
      })
    )

    it.effect("excludes zero balance accounts by default", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount, serviceRevenueAccount, cogsAccount]

        // Only create entry for sales revenue (service revenue has no entries)
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Should only have 1 revenue account (Sales)
        expect(report.revenue.accountCount).toBe(1)
        expect(report.costOfSales.accountCount).toBe(0)
      })
    )

    it.effect("includes zero balance accounts when requested", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount, serviceRevenueAccount, cogsAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency,
          { includeZeroBalances: true }
        )

        // Should have both revenue accounts
        expect(report.revenue.accountCount).toBe(2)
        expect(report.costOfSales.accountCount).toBe(1) // COGS with zero balance
      })
    )

    it.effect("groups accounts into correct sections", () =>
      Effect.gen(function* () {
        const accounts = [
          salesRevenueAccount,       // OperatingRevenue -> Revenue
          serviceRevenueAccount,     // OperatingRevenue -> Revenue
          otherRevenueAccount,       // OtherRevenue -> Revenue
          cogsAccount,               // CostOfGoodsSold -> CostOfSales
          salariesExpenseAccount,    // OperatingExpense -> OperatingExpenses
          rentExpenseAccount,        // OperatingExpense -> OperatingExpenses
          depreciationAccount,       // DepreciationAmortization -> OperatingExpenses
          interestExpenseAccount,    // InterestExpense -> OtherIncomeExpense
          otherExpenseAccount,       // OtherExpense -> OtherIncomeExpense
          taxExpenseAccount          // TaxExpense -> IncomeTaxExpense
        ]

        // Create minimal entry to activate accounts
        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "100.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, salesRevenueAccountUUID, "100.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency,
          { includeZeroBalances: true }
        )

        // Check account categorization
        expect(report.revenue.accountCount).toBe(3) // Sales, Service, Other
        expect(report.costOfSales.accountCount).toBe(1) // COGS
        expect(report.operatingExpenses.accountCount).toBe(3) // Salaries, Rent, Depreciation
        expect(report.otherIncomeExpense.accountCount).toBe(2) // Interest, Other
        expect(report.incomeTaxExpense.accountCount).toBe(1) // Tax
      })
    )

    it.effect("sorts line items by account number", () =>
      Effect.gen(function* () {
        // Create accounts out of order
        const accounts = [serviceRevenueAccount, salesRevenueAccount, otherRevenueAccount] // 4100, 4000, 4500

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "300.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, salesRevenueAccountUUID, "100.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId, 3, serviceRevenueAccountUUID, "100.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId, 4, otherRevenueAccountUUID, "100.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Should be sorted by account number
        const lineItems = report.revenue.lineItems
        expect(lineItems.length).toBe(3)
        expect(Option.getOrThrow(lineItems[0].accountNumber)).toBe("4000") // Sales
        expect(Option.getOrThrow(lineItems[1].accountNumber)).toBe("4100") // Service
        expect(Option.getOrThrow(lineItems[2].accountNumber)).toBe("4500") // Other
      })
    )

    it.effect("ignores draft entries", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15, "Draft")
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // No revenue should be recorded (draft entry)
        expect(report.revenue.accountCount).toBe(0)
        expect(report.totalRevenue.isZero).toBe(true)
      })
    )

    it.effect("respects period date filters", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount]

        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entryId2 = "e0000000-0000-0000-0000-000000000002"

        const entry1 = createEntry(entryId1, jan15)
        const feb15 = LocalDate.make({ year: 2025, month: 2, day: 15 })
        const entry2 = createEntry(entryId2, feb15) // After period end

        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "30000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, salesRevenueAccountUUID, "30000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Only January entry should be included
        expect(BigDecimal.equals(report.totalRevenue.amount, BigDecimal.unsafeFromString("50000"))).toBe(true)
      })
    )

    it.effect("fails with InvalidPeriodError for invalid period", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const result = yield* Effect.either(
          generateIncomeStatementFromData(
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

    it.effect("supports comparative periods", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount, cogsAccount]

        // Entry in prior year (December 2024)
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const dec15_2024 = LocalDate.make({ year: 2024, month: 12, day: 15 })
        const entry1 = createEntry(entryId1, dec15_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "80000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, salesRevenueAccountUUID, "80000.00", usdCurrency)
        ]

        // Entry for COGS in December 2024
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, dec15_2024)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cogsAccountUUID, "32000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "32000.00", usdCurrency)
        ]

        // Entry in current year (January 2025)
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, salesRevenueAccountUUID, "100000.00", usdCurrency)
        ]

        // Entry for COGS in January 2025
        const entryId4 = "e0000000-0000-0000-0000-000000000004"
        const entry4 = createEntry(entryId4, jan15)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000007", entryId4, 1, cogsAccountUUID, "40000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000008", entryId4, 2, cashAccountUUID, "40000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 },
          { entry: entry4, lines: lines4 }
        ]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency,
          {
            comparativePeriodStart: dec1_2024,
            comparativePeriodEnd: dec31_2024
          }
        )

        // Current period: Revenue 100000, COGS 40000, Gross Profit 60000
        expect(BigDecimal.equals(report.totalRevenue.amount, BigDecimal.unsafeFromString("100000"))).toBe(true)
        expect(BigDecimal.equals(report.grossProfit.amount, BigDecimal.unsafeFromString("60000"))).toBe(true)

        // Comparative period: Revenue 80000, COGS 32000, Gross Profit 48000
        expect(Option.isSome(report.comparativeTotalRevenue)).toBe(true)
        expect(BigDecimal.equals(Option.getOrThrow(report.comparativeTotalRevenue).amount, BigDecimal.unsafeFromString("80000"))).toBe(true)
        expect(BigDecimal.equals(Option.getOrThrow(report.comparativeGrossProfit).amount, BigDecimal.unsafeFromString("48000"))).toBe(true)

        // Check variance on line items
        const revenueItem = report.revenue.lineItems.find(item =>
          Option.isSome(item.accountNumber) && Option.getOrThrow(item.accountNumber) === "4000"
        )
        expect(revenueItem).toBeDefined()
        expect(Option.isSome(revenueItem!.variance)).toBe(true)
        expect(BigDecimal.equals(Option.getOrThrow(revenueItem!.variance).amount, BigDecimal.unsafeFromString("20000"))).toBe(true)
        expect(Option.isSome(revenueItem!.variancePercentage)).toBe(true)
        expect(Option.getOrThrow(revenueItem!.variancePercentage)).toBe(25)
      })
    )

    it.effect("calculates variance percentage correctly", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount]

        // Prior period: 80000
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const dec15_2024 = LocalDate.make({ year: 2024, month: 12, day: 15 })
        const entry1 = createEntry(entryId1, dec15_2024)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "80000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, salesRevenueAccountUUID, "80000.00", usdCurrency)
        ]

        // Current period: 100000 (25% increase)
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, salesRevenueAccountUUID, "100000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency,
          {
            comparativePeriodStart: dec1_2024,
            comparativePeriodEnd: dec31_2024
          }
        )

        const revenueItem = report.revenue.lineItems.find(item =>
          Option.isSome(item.accountNumber) && Option.getOrThrow(item.accountNumber) === "4000"
        )
        expect(revenueItem).toBeDefined()
        expect(Option.getOrThrow(revenueItem!.variancePercentage)).toBe(25)
      })
    )

    it.effect("excludes non-postable (summary) accounts", () =>
      Effect.gen(function* () {
        const summaryAccount = createAccount(
          "c0000000-0000-0000-0000-000000000099",
          "4001",
          "Revenue Summary",
          "Revenue",
          "OperatingRevenue",
          false // not postable
        )

        const accounts = [salesRevenueAccount, summaryAccount]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Summary account should not appear
        expect(report.revenue.accountCount).toBe(1) // Only Sales Revenue
        const summaryLine = report.revenue.lineItems.find(item =>
          Option.isSome(item.accountNumber) && Option.getOrThrow(item.accountNumber) === "4001"
        )
        expect(summaryLine).toBeUndefined()
      })
    )

    it.effect("excludes balance sheet accounts", () =>
      Effect.gen(function* () {
        const accounts = [
          salesRevenueAccount,
          cashAccount  // Should be excluded
        ]

        const entryId = "e0000000-0000-0000-0000-000000000001"
        const entry = createEntry(entryId, jan15)
        const lines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [{ entry, lines }]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency,
          { includeZeroBalances: true }
        )

        // Only income statement accounts
        expect(report.totalAccountCount).toBe(1) // Only Sales Revenue
      })
    )

    it.effect("handles loss scenario (negative net income)", () =>
      Effect.gen(function* () {
        const accounts = [salesRevenueAccount, cogsAccount, salariesExpenseAccount]

        // Revenue: 50000
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
        ]

        // COGS: 40000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cogsAccountUUID, "40000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "40000.00", usdCurrency)
        ]

        // Operating Expenses: 20000
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

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Gross Profit: 50000 - 40000 = 10000
        expect(BigDecimal.equals(report.grossProfit.amount, BigDecimal.unsafeFromString("10000"))).toBe(true)

        // Operating Income: 10000 - 20000 = -10000 (loss)
        expect(BigDecimal.equals(report.operatingIncome.amount, BigDecimal.unsafeFromString("-10000"))).toBe(true)

        // Net Income: -10000 (loss)
        expect(BigDecimal.equals(report.netIncome.amount, BigDecimal.unsafeFromString("-10000"))).toBe(true)

        // Not profitable
        expect(report.isProfitable).toBe(false)
      })
    )
  })

  describe("IncomeStatementService with repository", () => {
    const createTestRepository = (
      accounts: ReadonlyArray<Account>,
      entries: ReadonlyArray<JournalEntryWithLines>,
      currency: CurrencyCode | null = usdCurrency
    ): Layer.Layer<IncomeStatementRepository> =>
      Layer.succeed(IncomeStatementRepository, {
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
        IncomeStatementServiceLive,
        createTestRepository(accounts, entries, currency)
      )

    it.effect("generates income statement via service", () =>
      Effect.gen(function* () {
        const service = yield* IncomeStatementService

        const report = yield* service.generateIncomeStatement({
          companyId,
          periodStart: jan1,
          periodEnd: jan31
        })

        expect(report.revenue.accountCount).toBe(1)
        expect(BigDecimal.equals(report.totalRevenue.amount, BigDecimal.unsafeFromString("50000"))).toBe(true)
      }).pipe(
        Effect.provide(createServiceWithRepo([salesRevenueAccount], [
          {
            entry: createEntry("e0000000-0000-0000-0000-000000000001", jan15),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "50000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
            ]
          }
        ]))
      )
    )

    it.effect("fails with CompanyNotFoundError when company not found", () =>
      Effect.gen(function* () {
        const service = yield* IncomeStatementService

        const result = yield* Effect.either(
          service.generateIncomeStatement({
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
        const service = yield* IncomeStatementService

        const result = yield* Effect.either(
          service.generateIncomeStatement({
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
        Effect.provide(createServiceWithRepo([salesRevenueAccount], []))
      )
    )

    it.effect("supports comparative via service", () =>
      Effect.gen(function* () {
        const service = yield* IncomeStatementService

        const report = yield* service.generateIncomeStatement({
          companyId,
          periodStart: jan1,
          periodEnd: jan31,
          comparativePeriodStart: dec1_2024,
          comparativePeriodEnd: dec31_2024
        })

        expect(Option.isSome(report.comparativeTotalRevenue)).toBe(true)
      }).pipe(
        Effect.provide(createServiceWithRepo([salesRevenueAccount], [
          {
            entry: createEntry("e0000000-0000-0000-0000-000000000001", LocalDate.make({ year: 2024, month: 12, day: 15 })),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "40000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, salesRevenueAccountUUID, "40000.00", usdCurrency)
            ]
          },
          {
            entry: createEntry("e0000000-0000-0000-0000-000000000002", jan15),
            lines: [
              createDebitLine("d0000000-0000-0000-0000-000000000003", "e0000000-0000-0000-0000-000000000002", 1, cashAccountUUID, "50000.00", usdCurrency),
              createCreditLine("d0000000-0000-0000-0000-000000000004", "e0000000-0000-0000-0000-000000000002", 2, salesRevenueAccountUUID, "50000.00", usdCurrency)
            ]
          }
        ]))
      )
    )
  })

  describe("property-based tests", () => {
    const positiveAmountString = FastCheck.integer({ min: 1, max: 999999 })
      .chain((int) =>
        FastCheck.integer({ min: 0, max: 9999 })
          .map((decimal) => `${int}.${String(decimal).padStart(4, "0")}`)
      )

    const uuidArb = FastCheck.uuid()

    it.prop(
      "gross profit equals revenue minus cost of sales",
      [uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, positiveAmountString, positiveAmountString],
      ([entryUuid1, entryUuid2, lineUuid1a, lineUuid1b, lineUuid2a, lineUuid2b, revenueAmount, cogsAmount]) => {
        const accounts = [salesRevenueAccount, cogsAccount]

        const entry1 = createEntry(entryUuid1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid1a, entryUuid1, 1, cashAccountUUID, revenueAmount, usdCurrency),
          createCreditLine(lineUuid1b, entryUuid1, 2, salesRevenueAccountUUID, revenueAmount, usdCurrency)
        ]

        const entry2 = createEntry(entryUuid2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(lineUuid2a, entryUuid2, 1, cogsAccountUUID, cogsAmount, usdCurrency),
          createCreditLine(lineUuid2b, entryUuid2, 2, cashAccountUUID, cogsAmount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const program = generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        const expectedGrossProfit = BigDecimal.subtract(
          result.totalRevenue.amount,
          result.costOfSales.subtotal.amount
        )
        return BigDecimal.equals(result.grossProfit.amount, expectedGrossProfit)
      }
    )

    it.prop(
      "empty entries always produces zero net income",
      [uuidArb],
      () => {
        const accounts = [salesRevenueAccount, cogsAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const program = generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        return result.netIncome.isZero
      }
    )

    it.prop(
      "operating income equals gross profit minus operating expenses",
      [uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, positiveAmountString, positiveAmountString, positiveAmountString],
      ([entryUuid1, entryUuid2, entryUuid3, l1a, l1b, l2a, l2b, l3a, l3b, revenueAmount, cogsAmount, opexAmount]) => {
        const accounts = [salesRevenueAccount, cogsAccount, salariesExpenseAccount]

        const entry1 = createEntry(entryUuid1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(l1a, entryUuid1, 1, cashAccountUUID, revenueAmount, usdCurrency),
          createCreditLine(l1b, entryUuid1, 2, salesRevenueAccountUUID, revenueAmount, usdCurrency)
        ]

        const entry2 = createEntry(entryUuid2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(l2a, entryUuid2, 1, cogsAccountUUID, cogsAmount, usdCurrency),
          createCreditLine(l2b, entryUuid2, 2, cashAccountUUID, cogsAmount, usdCurrency)
        ]

        const entry3 = createEntry(entryUuid3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(l3a, entryUuid3, 1, salariesExpenseAccountUUID, opexAmount, usdCurrency),
          createCreditLine(l3b, entryUuid3, 2, cashAccountUUID, opexAmount, usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 }
        ]

        const program = generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)
        const expectedOperatingIncome = BigDecimal.subtract(
          result.grossProfit.amount,
          result.operatingExpenses.subtotal.amount
        )
        return BigDecimal.equals(result.operatingIncome.amount, expectedOperatingIncome)
      }
    )
  })

  describe("comprehensive accounting scenarios", () => {
    it.effect("handles typical income statement with all sections populated", () =>
      Effect.gen(function* () {
        const accounts = [
          salesRevenueAccount,
          serviceRevenueAccount,
          otherRevenueAccount,
          cogsAccount,
          salariesExpenseAccount,
          rentExpenseAccount,
          utilitiesExpenseAccount,
          depreciationAccount,
          interestExpenseAccount,
          otherExpenseAccount,
          taxExpenseAccount
        ]

        // Revenue entries
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "200000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, salesRevenueAccountUUID, "150000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", entryId1, 3, serviceRevenueAccountUUID, "40000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId1, 4, otherRevenueAccountUUID, "10000.00", usdCurrency)
        ]

        // COGS entry
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId2, 1, cogsAccountUUID, "80000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", entryId2, 2, cashAccountUUID, "80000.00", usdCurrency)
        ]

        // Operating expenses entry
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000007", entryId3, 1, salariesExpenseAccountUUID, "40000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000008", entryId3, 2, rentExpenseAccountUUID, "10000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000009", entryId3, 3, utilitiesExpenseAccountUUID, "5000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId3, 4, depreciationAccountUUID, "8000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId3, 5, cashAccountUUID, "63000.00", usdCurrency)
        ]

        // Other income/expense entry
        const entryId4 = "e0000000-0000-0000-0000-000000000004"
        const entry4 = createEntry(entryId4, jan15)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000012", entryId4, 1, interestExpenseAccountUUID, "5000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000013", entryId4, 2, otherExpenseAccountUUID, "2000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000014", entryId4, 3, cashAccountUUID, "7000.00", usdCurrency)
        ]

        // Tax expense entry
        const entryId5 = "e0000000-0000-0000-0000-000000000005"
        const entry5 = createEntry(entryId5, jan15)
        const lines5: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000015", entryId5, 1, taxExpenseAccountUUID, "12500.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000016", entryId5, 2, cashAccountUUID, "12500.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 },
          { entry: entry4, lines: lines4 },
          { entry: entry5, lines: lines5 }
        ]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Total Revenue: 150000 + 40000 + 10000 = 200000
        expect(BigDecimal.equals(report.totalRevenue.amount, BigDecimal.unsafeFromString("200000"))).toBe(true)

        // COGS: 80000
        expect(BigDecimal.equals(report.costOfSales.subtotal.amount, BigDecimal.unsafeFromString("80000"))).toBe(true)

        // Gross Profit: 200000 - 80000 = 120000
        expect(BigDecimal.equals(report.grossProfit.amount, BigDecimal.unsafeFromString("120000"))).toBe(true)

        // Operating Expenses: 40000 + 10000 + 5000 + 8000 = 63000
        expect(BigDecimal.equals(report.operatingExpenses.subtotal.amount, BigDecimal.unsafeFromString("63000"))).toBe(true)

        // Operating Income: 120000 - 63000 = 57000
        expect(BigDecimal.equals(report.operatingIncome.amount, BigDecimal.unsafeFromString("57000"))).toBe(true)

        // Other Income/Expense: 5000 + 2000 = 7000
        expect(BigDecimal.equals(report.otherIncomeExpense.subtotal.amount, BigDecimal.unsafeFromString("7000"))).toBe(true)

        // Income Before Tax: 57000 - 7000 = 50000
        expect(BigDecimal.equals(report.incomeBeforeTax.amount, BigDecimal.unsafeFromString("50000"))).toBe(true)

        // Tax Expense: 12500
        expect(BigDecimal.equals(report.incomeTaxExpense.subtotal.amount, BigDecimal.unsafeFromString("12500"))).toBe(true)

        // Net Income: 50000 - 12500 = 37500
        expect(BigDecimal.equals(report.netIncome.amount, BigDecimal.unsafeFromString("37500"))).toBe(true)

        // Verify account counts
        expect(report.revenue.accountCount).toBe(3) // Sales, Service, Other
        expect(report.costOfSales.accountCount).toBe(1) // COGS
        expect(report.operatingExpenses.accountCount).toBe(4) // Salaries, Rent, Utilities, Depreciation
        expect(report.otherIncomeExpense.accountCount).toBe(2) // Interest, Other
        expect(report.incomeTaxExpense.accountCount).toBe(1) // Tax

        // Verify profitability metrics
        expect(report.isProfitable).toBe(true)
        expect(report.grossProfitMargin).toBe(60) // 120000/200000 * 100
        expect(report.operatingProfitMargin).toBe(28.5) // 57000/200000 * 100
        expect(report.netProfitMargin).toBe(18.75) // 37500/200000 * 100
      })
    )

    it.effect("handles multi-step format with all expense categories correctly grouped by function", () =>
      Effect.gen(function* () {
        // Create accounts for each expense function
        const accounts = [
          salesRevenueAccount,
          cogsAccount,
          // Operating expenses grouped by function
          salariesExpenseAccount,  // OperatingExpense
          rentExpenseAccount,       // OperatingExpense
          depreciationAccount,      // DepreciationAmortization (still operating)
          // Non-operating expenses
          interestExpenseAccount,   // InterestExpense -> OtherIncomeExpense
          taxExpenseAccount         // TaxExpense
        ]

        // Revenue: 100000
        const entryId1 = "e0000000-0000-0000-0000-000000000001"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", entryId1, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", entryId1, 2, salesRevenueAccountUUID, "100000.00", usdCurrency)
        ]

        // COGS: 30000
        const entryId2 = "e0000000-0000-0000-0000-000000000002"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000003", entryId2, 1, cogsAccountUUID, "30000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", entryId2, 2, cashAccountUUID, "30000.00", usdCurrency)
        ]

        // Operating expenses: Salaries 20000, Rent 5000, Depreciation 3000
        const entryId3 = "e0000000-0000-0000-0000-000000000003"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000005", entryId3, 1, salariesExpenseAccountUUID, "20000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000006", entryId3, 2, rentExpenseAccountUUID, "5000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000007", entryId3, 3, depreciationAccountUUID, "3000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000008", entryId3, 4, cashAccountUUID, "28000.00", usdCurrency)
        ]

        // Interest expense: 2000
        const entryId4 = "e0000000-0000-0000-0000-000000000004"
        const entry4 = createEntry(entryId4, jan15)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000009", entryId4, 1, interestExpenseAccountUUID, "2000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000010", entryId4, 2, cashAccountUUID, "2000.00", usdCurrency)
        ]

        // Tax expense: 10000
        const entryId5 = "e0000000-0000-0000-0000-000000000005"
        const entry5 = createEntry(entryId5, jan15)
        const lines5: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000011", entryId5, 1, taxExpenseAccountUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000012", entryId5, 2, cashAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 },
          { entry: entry4, lines: lines4 },
          { entry: entry5, lines: lines5 }
        ]

        const report = yield* generateIncomeStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Multi-step format validation
        // Step 1: Revenue 100000
        expect(BigDecimal.equals(report.totalRevenue.amount, BigDecimal.unsafeFromString("100000"))).toBe(true)

        // Step 2: - COGS 30000
        expect(BigDecimal.equals(report.costOfSales.subtotal.amount, BigDecimal.unsafeFromString("30000"))).toBe(true)

        // Step 3: = Gross Profit 70000
        expect(BigDecimal.equals(report.grossProfit.amount, BigDecimal.unsafeFromString("70000"))).toBe(true)

        // Step 4: - Operating Expenses 28000 (grouped by function)
        expect(BigDecimal.equals(report.operatingExpenses.subtotal.amount, BigDecimal.unsafeFromString("28000"))).toBe(true)
        expect(report.operatingExpenses.accountCount).toBe(3) // Salaries, Rent, Depreciation grouped together

        // Step 5: = Operating Income 42000
        expect(BigDecimal.equals(report.operatingIncome.amount, BigDecimal.unsafeFromString("42000"))).toBe(true)

        // Step 6: - Other Income/Expense 2000 (Interest separated from operating)
        expect(BigDecimal.equals(report.otherIncomeExpense.subtotal.amount, BigDecimal.unsafeFromString("2000"))).toBe(true)
        expect(report.otherIncomeExpense.accountCount).toBe(1) // Only interest

        // Step 7: = Income Before Tax 40000
        expect(BigDecimal.equals(report.incomeBeforeTax.amount, BigDecimal.unsafeFromString("40000"))).toBe(true)

        // Step 8: - Tax 10000
        expect(BigDecimal.equals(report.incomeTaxExpense.subtotal.amount, BigDecimal.unsafeFromString("10000"))).toBe(true)

        // Step 9: = Net Income 30000
        expect(BigDecimal.equals(report.netIncome.amount, BigDecimal.unsafeFromString("30000"))).toBe(true)
      })
    )
  })
})
