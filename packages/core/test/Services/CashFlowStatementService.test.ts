import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, FastCheck, Layer, Option } from "effect"
import {
  CashFlowStatementService,
  CashFlowStatementRepository,
  CashFlowStatementServiceLive,
  CashFlowStatementReport,
  CashFlowStatementReportMetadata,
  CashFlowSection,
  CashFlowLineItem,
  OperatingActivitiesSection,
  OperatingActivityAdjustment,
  SupplementalDisclosures,
  CompanyNotFoundError,
  InvalidPeriodError,
  CashFlowReconciliationError,
  generateCashFlowStatementFromData,
  isCashFlowStatementReport,
  isCashFlowSection,
  isCashFlowLineItem,
  isOperatingActivitiesSection,
  isOperatingActivityAdjustment,
  isSupplementalDisclosures,
  isCompanyNotFoundError,
  isInvalidPeriodError,
  isCashFlowReconciliationError,
  getSectionDisplayName
} from "../../src/reporting/CashFlowStatementService.ts"
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
import type { CashFlowCategory ,
  AccountType,
  AccountCategory} from "../../src/accounting/Account.ts"

describe("CashFlowStatementService", () => {
  // Test UUIDs
  const companyUUID = "a0000000-0000-0000-0000-000000000001"
  const userUUID = "b0000000-0000-0000-0000-000000000001"

  // Account UUIDs
  const cashAccountUUID = "c0000000-0000-0000-0000-000000000001"
  const accountsReceivableUUID = "c0000000-0000-0000-0000-000000000002"
  const inventoryUUID = "c0000000-0000-0000-0000-000000000003"
  const equipmentUUID = "c0000000-0000-0000-0000-000000000004"
  const accountsPayableUUID = "c0000000-0000-0000-0000-000000000006"
  const notesPayableUUID = "c0000000-0000-0000-0000-000000000007"
  const commonStockUUID = "c0000000-0000-0000-0000-000000000008"
  const salesRevenueUUID = "c0000000-0000-0000-0000-000000000009"
  const depreciationExpenseUUID = "c0000000-0000-0000-0000-000000000010"
  const salariesExpenseUUID = "c0000000-0000-0000-0000-000000000011"
  const interestExpenseUUID = "c0000000-0000-0000-0000-000000000012"
  const taxExpenseUUID = "c0000000-0000-0000-0000-000000000013"

  const usdCurrency = CurrencyCode.make("USD")
  const companyId = CompanyId.make(companyUUID)

  // Test dates
  const jan1 = LocalDate.make({ year: 2025, month: 1, day: 1 })
  const jan15 = LocalDate.make({ year: 2025, month: 1, day: 15 })
  const jan31 = LocalDate.make({ year: 2025, month: 1, day: 31 })
  const dec15_2024 = LocalDate.make({ year: 2024, month: 12, day: 15 })

  // Helper to create an account
  const createAccount = (
    id: string,
    number: string,
    name: string,
    type: AccountType,
    category: AccountCategory,
    isPostable: boolean = true,
    isCashFlowRelevant: boolean = false,
    cashFlowCategory: CashFlowCategory | null = null
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
      isCashFlowRelevant,
      cashFlowCategory: Option.fromNullable(cashFlowCategory),
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
    "CurrentAsset",
    true,
    true,
    "Operating"
  )

  const accountsReceivable = createAccount(
    accountsReceivableUUID,
    "1100",
    "Accounts Receivable",
    "Asset",
    "CurrentAsset",
    true,
    true,
    "Operating"
  )

  const inventory = createAccount(
    inventoryUUID,
    "1200",
    "Inventory",
    "Asset",
    "CurrentAsset",
    true,
    true,
    "Operating"
  )

  const equipment = createAccount(
    equipmentUUID,
    "1500",
    "Equipment",
    "Asset",
    "FixedAsset",
    true,
    true,
    "Investing"
  )

  const accountsPayable = createAccount(
    accountsPayableUUID,
    "2000",
    "Accounts Payable",
    "Liability",
    "CurrentLiability",
    true,
    true,
    "Operating"
  )

  const notesPayable = createAccount(
    notesPayableUUID,
    "2500",
    "Notes Payable",
    "Liability",
    "NonCurrentLiability",
    true,
    true,
    "Financing"
  )

  const commonStock = createAccount(
    commonStockUUID,
    "3000",
    "Common Stock",
    "Equity",
    "ContributedCapital",
    true,
    true,
    "Financing"
  )

  const salesRevenue = createAccount(
    salesRevenueUUID,
    "4000",
    "Sales Revenue",
    "Revenue",
    "OperatingRevenue",
    true,
    false,
    null
  )

  const depreciationExpense = createAccount(
    depreciationExpenseUUID,
    "6000",
    "Depreciation Expense",
    "Expense",
    "DepreciationAmortization",
    true,
    false,
    null
  )

  const salariesExpense = createAccount(
    salariesExpenseUUID,
    "6100",
    "Salaries Expense",
    "Expense",
    "OperatingExpense",
    true,
    false,
    null
  )

  const interestExpense = createAccount(
    interestExpenseUUID,
    "7000",
    "Interest Expense",
    "Expense",
    "InterestExpense",
    true,
    false,
    null
  )

  const taxExpense = createAccount(
    taxExpenseUUID,
    "8000",
    "Income Tax Expense",
    "Expense",
    "TaxExpense",
    true,
    false,
    null
  )

  describe("CashFlowLineItem", () => {
    it("creates a valid line item", () => {
      const lineItem = CashFlowLineItem.make({
        accountId: Option.some(AccountId.make(cashAccountUUID)),
        accountNumber: Option.some("1000"),
        description: "Cash",
        amount: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })

      expect(isCashFlowLineItem(lineItem)).toBe(true)
      expect(lineItem.isAccountLine).toBe(true)
      expect(lineItem.isTotalLine).toBe(false)
      expect(lineItem.isHeaderLine).toBe(false)
    })

    it("identifies subtotal lines correctly", () => {
      const lineItem = CashFlowLineItem.make({
        accountId: Option.none(),
        accountNumber: Option.none(),
        description: "Net Cash from Operating",
        amount: MonetaryAmount.unsafeFromString("50000.00", "USD"),
        isSubtotal: true,
        indentLevel: 0,
        style: "Total"
      })

      expect(lineItem.isAccountLine).toBe(false)
      expect(lineItem.isTotalLine).toBe(true)
      expect(lineItem.isSubtotal).toBe(true)
    })

    it("identifies cash inflows and outflows", () => {
      const inflow = CashFlowLineItem.make({
        accountId: Option.none(),
        accountNumber: Option.none(),
        description: "Proceeds from sale",
        amount: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })

      const outflow = CashFlowLineItem.make({
        accountId: Option.none(),
        accountNumber: Option.none(),
        description: "Purchase of equipment",
        amount: MonetaryAmount.unsafeFromString("-15000.00", "USD"),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })

      expect(inflow.isCashInflow).toBe(true)
      expect(inflow.isCashOutflow).toBe(false)
      expect(outflow.isCashInflow).toBe(false)
      expect(outflow.isCashOutflow).toBe(true)
    })
  })

  describe("OperatingActivityAdjustment", () => {
    it("creates a valid adjustment", () => {
      const adjustment = OperatingActivityAdjustment.make({
        description: "Depreciation and amortization",
        amount: MonetaryAmount.unsafeFromString("5000.00", "USD"),
        isNonCashAdjustment: true,
        indentLevel: 1
      })

      expect(isOperatingActivityAdjustment(adjustment)).toBe(true)
      expect(adjustment.isNonCashAdjustment).toBe(true)
    })
  })

  describe("OperatingActivitiesSection", () => {
    it("creates a valid operating section", () => {
      const section = OperatingActivitiesSection.make({
        netIncome: MonetaryAmount.unsafeFromString("50000.00", "USD"),
        nonCashAdjustments: [
          OperatingActivityAdjustment.make({
            description: "Depreciation",
            amount: MonetaryAmount.unsafeFromString("5000.00", "USD"),
            isNonCashAdjustment: true,
            indentLevel: 1
          })
        ],
        nonCashAdjustmentsSubtotal: MonetaryAmount.unsafeFromString("5000.00", "USD"),
        workingCapitalChanges: [
          OperatingActivityAdjustment.make({
            description: "Change in Accounts Receivable",
            amount: MonetaryAmount.unsafeFromString("-2000.00", "USD"),
            isNonCashAdjustment: false,
            indentLevel: 1
          })
        ],
        workingCapitalChangesSubtotal: MonetaryAmount.unsafeFromString("-2000.00", "USD"),
        netCashFromOperating: MonetaryAmount.unsafeFromString("53000.00", "USD")
      })

      expect(isOperatingActivitiesSection(section)).toBe(true)
      expect(section.lineItems.length).toBeGreaterThan(0)
    })

    it("generates correct line items for display", () => {
      const section = OperatingActivitiesSection.make({
        netIncome: MonetaryAmount.unsafeFromString("50000.00", "USD"),
        nonCashAdjustments: [
          OperatingActivityAdjustment.make({
            description: "Depreciation",
            amount: MonetaryAmount.unsafeFromString("5000.00", "USD"),
            isNonCashAdjustment: true,
            indentLevel: 1
          })
        ],
        nonCashAdjustmentsSubtotal: MonetaryAmount.unsafeFromString("5000.00", "USD"),
        workingCapitalChanges: [],
        workingCapitalChangesSubtotal: MonetaryAmount.zero(usdCurrency),
        netCashFromOperating: MonetaryAmount.unsafeFromString("55000.00", "USD")
      })

      const lineItems = section.lineItems
      // Should have: Net Income, Header for non-cash, Depreciation, Net Cash Total
      expect(lineItems.length).toBe(4)
      expect(lineItems[0].description).toBe("Net Income")
      expect(lineItems[lineItems.length - 1].description).toBe("Net Cash from Operating Activities")
    })
  })

  describe("CashFlowSection", () => {
    it("creates a valid investing section", () => {
      const section = CashFlowSection.make({
        sectionType: "Investing",
        displayName: "Cash Flows from Investing Activities",
        lineItems: [
          CashFlowLineItem.make({
            accountId: Option.some(AccountId.make(equipmentUUID)),
            accountNumber: Option.some("1500"),
            description: "Purchase of Equipment",
            amount: MonetaryAmount.unsafeFromString("-20000.00", "USD"),
            isSubtotal: false,
            indentLevel: 1,
            style: "Normal"
          })
        ],
        subtotal: MonetaryAmount.unsafeFromString("-20000.00", "USD")
      })

      expect(isCashFlowSection(section)).toBe(true)
      expect(section.itemCount).toBe(1)
      expect(section.hasItems).toBe(true)
      expect(section.isNetOutflow).toBe(true)
      expect(section.isNetInflow).toBe(false)
    })

    it("creates a valid financing section", () => {
      const section = CashFlowSection.make({
        sectionType: "Financing",
        displayName: "Cash Flows from Financing Activities",
        lineItems: [
          CashFlowLineItem.make({
            accountId: Option.some(AccountId.make(notesPayableUUID)),
            accountNumber: Option.some("2500"),
            description: "Proceeds from Notes Payable",
            amount: MonetaryAmount.unsafeFromString("50000.00", "USD"),
            isSubtotal: false,
            indentLevel: 1,
            style: "Normal"
          })
        ],
        subtotal: MonetaryAmount.unsafeFromString("50000.00", "USD")
      })

      expect(section.sectionType).toBe("Financing")
      expect(section.isNetInflow).toBe(true)
      expect(section.isNetOutflow).toBe(false)
    })
  })

  describe("SupplementalDisclosures", () => {
    it("creates valid supplemental disclosures", () => {
      const disclosures = SupplementalDisclosures.make({
        interestPaid: MonetaryAmount.unsafeFromString("5000.00", "USD"),
        incomesTaxesPaid: MonetaryAmount.unsafeFromString("12000.00", "USD"),
        nonCashActivities: [
          {
            description: "Equipment acquired through finance lease",
            amount: MonetaryAmount.unsafeFromString("25000.00", "USD")
          }
        ]
      })

      expect(isSupplementalDisclosures(disclosures)).toBe(true)
      expect(disclosures.nonCashActivities.length).toBe(1)
    })
  })

  describe("CashFlowStatementReport", () => {
    it("creates a valid cash flow statement report", () => {
      const metadata = CashFlowStatementReportMetadata.make({
        companyId,
        periodStart: jan1,
        periodEnd: jan31,
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        method: "Indirect"
      })

      const operatingActivities = OperatingActivitiesSection.make({
        netIncome: MonetaryAmount.unsafeFromString("50000.00", "USD"),
        nonCashAdjustments: [],
        nonCashAdjustmentsSubtotal: MonetaryAmount.zero(usdCurrency),
        workingCapitalChanges: [],
        workingCapitalChangesSubtotal: MonetaryAmount.zero(usdCurrency),
        netCashFromOperating: MonetaryAmount.unsafeFromString("50000.00", "USD")
      })

      const investingActivities = CashFlowSection.make({
        sectionType: "Investing",
        displayName: "Cash Flows from Investing Activities",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("-20000.00", "USD")
      })

      const financingActivities = CashFlowSection.make({
        sectionType: "Financing",
        displayName: "Cash Flows from Financing Activities",
        lineItems: [],
        subtotal: MonetaryAmount.unsafeFromString("-10000.00", "USD")
      })

      const supplementalDisclosures = SupplementalDisclosures.make({
        interestPaid: MonetaryAmount.zero(usdCurrency),
        incomesTaxesPaid: MonetaryAmount.zero(usdCurrency),
        nonCashActivities: []
      })

      const report = CashFlowStatementReport.make({
        metadata,
        beginningCash: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        operatingActivities,
        investingActivities,
        financingActivities,
        exchangeRateEffect: MonetaryAmount.zero(usdCurrency),
        netChangeInCash: MonetaryAmount.unsafeFromString("20000.00", "USD"),
        endingCash: MonetaryAmount.unsafeFromString("120000.00", "USD"),
        supplementalDisclosures
      })

      expect(isCashFlowStatementReport(report)).toBe(true)
      expect(report.isReconciled).toBe(true)
      expect(report.sectionsReconcile).toBe(true)
      expect(report.cashIncreased).toBe(true)
      expect(report.cashDecreased).toBe(false)
    })

    it("detects when cash flow statement does not reconcile", () => {
      const metadata = CashFlowStatementReportMetadata.make({
        companyId,
        periodStart: jan1,
        periodEnd: jan31,
        currency: usdCurrency,
        generatedAt: Timestamp.make({ epochMillis: Date.now() }),
        method: "Indirect"
      })

      const operatingActivities = OperatingActivitiesSection.make({
        netIncome: MonetaryAmount.zero(usdCurrency),
        nonCashAdjustments: [],
        nonCashAdjustmentsSubtotal: MonetaryAmount.zero(usdCurrency),
        workingCapitalChanges: [],
        workingCapitalChangesSubtotal: MonetaryAmount.zero(usdCurrency),
        netCashFromOperating: MonetaryAmount.zero(usdCurrency)
      })

      const investingActivities = CashFlowSection.make({
        sectionType: "Investing",
        displayName: "Cash Flows from Investing Activities",
        lineItems: [],
        subtotal: MonetaryAmount.zero(usdCurrency)
      })

      const financingActivities = CashFlowSection.make({
        sectionType: "Financing",
        displayName: "Cash Flows from Financing Activities",
        lineItems: [],
        subtotal: MonetaryAmount.zero(usdCurrency)
      })

      const supplementalDisclosures = SupplementalDisclosures.make({
        interestPaid: MonetaryAmount.zero(usdCurrency),
        incomesTaxesPaid: MonetaryAmount.zero(usdCurrency),
        nonCashActivities: []
      })

      // Create with incorrect ending balance
      const report = CashFlowStatementReport.make({
        metadata,
        beginningCash: MonetaryAmount.unsafeFromString("100000.00", "USD"),
        operatingActivities,
        investingActivities,
        financingActivities,
        exchangeRateEffect: MonetaryAmount.zero(usdCurrency),
        netChangeInCash: MonetaryAmount.zero(usdCurrency),
        endingCash: MonetaryAmount.unsafeFromString("150000.00", "USD"), // Wrong!
        supplementalDisclosures
      })

      expect(report.isReconciled).toBe(false)
    })
  })

  describe("getSectionDisplayName", () => {
    it("returns correct display names for all section types", () => {
      expect(getSectionDisplayName("Operating")).toBe("Cash Flows from Operating Activities")
      expect(getSectionDisplayName("Investing")).toBe("Cash Flows from Investing Activities")
      expect(getSectionDisplayName("Financing")).toBe("Cash Flows from Financing Activities")
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

    it("creates CashFlowReconciliationError", () => {
      const error = new CashFlowReconciliationError({
        companyId,
        expectedChange: MonetaryAmount.unsafeFromString("10000.00", "USD"),
        actualChange: MonetaryAmount.unsafeFromString("15000.00", "USD")
      })
      expect(isCashFlowReconciliationError(error)).toBe(true)
      expect(error.message).toContain("reconciliation failed")
    })
  })

  describe("generateCashFlowStatementFromData", () => {
    it.effect("generates cash flow statement with operating activities", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          accountsReceivable,
          salesRevenue,
          depreciationExpense,
          salariesExpense
        ]

        // Opening balances (December 2024)
        // Cash: 100,000 (debit)
        // AR: 20,000 (debit)
        const openingEntryId = "e0000000-0000-0000-0000-000000000001"
        const openingEntry = createEntry(openingEntryId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", openingEntryId, 1, cashAccountUUID, "100000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000002", openingEntryId, 2, accountsReceivableUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000003", openingEntryId, 3, commonStockUUID, "120000.00", usdCurrency)
        ]

        // January transactions
        // 1. Sales on account: DR AR, CR Revenue (50000)
        const entryId1 = "e0000000-0000-0000-0000-000000000002"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId1, 1, accountsReceivableUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId1, 2, salesRevenueUUID, "50000.00", usdCurrency)
        ]

        // 2. Collections: DR Cash, CR AR (30000)
        const entryId2 = "e0000000-0000-0000-0000-000000000003"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000020", entryId2, 1, cashAccountUUID, "30000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000021", entryId2, 2, accountsReceivableUUID, "30000.00", usdCurrency)
        ]

        // 3. Salaries paid: DR Salaries, CR Cash (15000)
        const entryId4 = "e0000000-0000-0000-0000-000000000005"
        const entry4 = createEntry(entryId4, jan15)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000040", entryId4, 1, salariesExpenseUUID, "15000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000041", entryId4, 2, cashAccountUUID, "15000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines },
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry4, lines: lines4 }
        ]

        const report = yield* generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Verify report structure
        expect(report.metadata.method).toBe("Indirect")

        // Net income: Revenue (50000) - Salaries (15000) = 35000
        expect(BigDecimal.equals(
          report.operatingActivities.netIncome.amount,
          BigDecimal.unsafeFromString("35000")
        )).toBe(true)

        // AR change: 20000 (beginning) -> 40000 (ending) = +20000 increase = -20000 cash effect
        // (50000 added - 30000 collected = 20000 increase)
        expect(report.operatingActivities.workingCapitalChanges.length).toBeGreaterThan(0)

        // Beginning cash: 100000
        expect(BigDecimal.equals(
          report.beginningCash.amount,
          BigDecimal.unsafeFromString("100000")
        )).toBe(true)

        // Ending cash: 100000 + 30000 - 15000 = 115000
        expect(BigDecimal.equals(
          report.endingCash.amount,
          BigDecimal.unsafeFromString("115000")
        )).toBe(true)

        // Check reconciliation - verify beginning + netChange = ending
        const expectedEnding = BigDecimal.sum(report.beginningCash.amount, report.netChangeInCash.amount)
        expect(BigDecimal.equals(report.endingCash.amount, expectedEnding)).toBe(true)
      })
    )

    it.effect("generates cash flow statement with investing activities", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, equipment, salesRevenue]

        // Opening: Cash 100000
        const openingEntryId = "e0000000-0000-0000-0000-000000000001"
        const openingEntry = createEntry(openingEntryId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", openingEntryId, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", openingEntryId, 2, commonStockUUID, "100000.00", usdCurrency)
        ]

        // Purchase equipment: DR Equipment, CR Cash (25000)
        const entryId1 = "e0000000-0000-0000-0000-000000000002"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId1, 1, equipmentUUID, "25000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId1, 2, cashAccountUUID, "25000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines },
          { entry: entry1, lines: lines1 }
        ]

        const report = yield* generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Investing activities should show equipment purchase as outflow
        expect(report.investingActivities.hasItems).toBe(true)
        expect(BigDecimal.equals(
          report.investingActivities.subtotal.amount,
          BigDecimal.unsafeFromString("-25000")
        )).toBe(true)

        // Net change: Operating (0) + Investing (-25000) + Financing (0) = -25000
        expect(BigDecimal.equals(
          report.netChangeInCash.amount,
          BigDecimal.unsafeFromString("-25000")
        )).toBe(true)

        // Cash decreased
        expect(report.cashDecreased).toBe(true)
      })
    )

    it.effect("generates cash flow statement with financing activities", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, notesPayable, commonStock, salesRevenue]

        // Opening: Cash 50000
        const openingEntryId = "e0000000-0000-0000-0000-000000000001"
        const openingEntry = createEntry(openingEntryId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", openingEntryId, 1, cashAccountUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", openingEntryId, 2, commonStockUUID, "50000.00", usdCurrency)
        ]

        // Borrow money: DR Cash, CR Notes Payable (30000)
        const entryId1 = "e0000000-0000-0000-0000-000000000002"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId1, 1, cashAccountUUID, "30000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId1, 2, notesPayableUUID, "30000.00", usdCurrency)
        ]

        // Issue stock: DR Cash, CR Common Stock (20000)
        const entryId2 = "e0000000-0000-0000-0000-000000000003"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000020", entryId2, 1, cashAccountUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000021", entryId2, 2, commonStockUUID, "20000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines },
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Financing activities should show borrowing and stock issuance as inflows
        expect(report.financingActivities.hasItems).toBe(true)
        expect(BigDecimal.equals(
          report.financingActivities.subtotal.amount,
          BigDecimal.unsafeFromString("50000") // 30000 + 20000
        )).toBe(true)

        // Cash increased
        expect(report.cashIncreased).toBe(true)
      })
    )

    it.effect("calculates supplemental disclosures (interest and taxes paid)", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, interestExpense, taxExpense, salesRevenue]

        // Opening: Cash 100000
        const openingEntryId = "e0000000-0000-0000-0000-000000000001"
        const openingEntry = createEntry(openingEntryId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", openingEntryId, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000002", openingEntryId, 2, commonStockUUID, "100000.00", usdCurrency)
        ]

        // Interest paid: DR Interest Expense, CR Cash (5000)
        const entryId1 = "e0000000-0000-0000-0000-000000000002"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId1, 1, interestExpenseUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId1, 2, cashAccountUUID, "5000.00", usdCurrency)
        ]

        // Taxes paid: DR Tax Expense, CR Cash (12000)
        const entryId2 = "e0000000-0000-0000-0000-000000000003"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000020", entryId2, 1, taxExpenseUUID, "12000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000021", entryId2, 2, cashAccountUUID, "12000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines },
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const report = yield* generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Check supplemental disclosures
        expect(BigDecimal.equals(
          report.supplementalDisclosures.interestPaid.amount,
          BigDecimal.unsafeFromString("5000")
        )).toBe(true)

        expect(BigDecimal.equals(
          report.supplementalDisclosures.incomesTaxesPaid.amount,
          BigDecimal.unsafeFromString("12000")
        )).toBe(true)
      })
    )

    it.effect("fails with InvalidPeriodError for invalid period", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const result = yield* Effect.either(
          generateCashFlowStatementFromData(
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

    it.effect("generates empty report when no transactions", () =>
      Effect.gen(function* () {
        const accounts = [cashAccount, salesRevenue]
        const entries: ReadonlyArray<JournalEntryWithLines> = []

        const report = yield* generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // All should be zero
        expect(report.beginningCash.isZero).toBe(true)
        expect(report.endingCash.isZero).toBe(true)
        expect(report.netChangeInCash.isZero).toBe(true)
        expect(report.operatingActivities.netIncome.isZero).toBe(true)
      })
    )

    it.effect("handles working capital changes correctly", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          accountsReceivable,
          inventory,
          accountsPayable,
          salesRevenue
        ]

        // Opening: Cash 100k, AR 10k, Inventory 20k, AP 15k
        const openingEntryId = "e0000000-0000-0000-0000-000000000001"
        const openingEntry = createEntry(openingEntryId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", openingEntryId, 1, cashAccountUUID, "100000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000002", openingEntryId, 2, accountsReceivableUUID, "10000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000003", openingEntryId, 3, inventoryUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000004", openingEntryId, 4, accountsPayableUUID, "15000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000005", openingEntryId, 5, commonStockUUID, "115000.00", usdCurrency)
        ]

        // Changes during January:
        // AR increases by 5k (sale on account): DR AR, CR Revenue
        const entryId1 = "e0000000-0000-0000-0000-000000000002"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId1, 1, accountsReceivableUUID, "5000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId1, 2, salesRevenueUUID, "5000.00", usdCurrency)
        ]

        // Inventory decreases by 8k (COGS - simplified): DR Cash, CR Inventory
        const entryId2 = "e0000000-0000-0000-0000-000000000003"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000020", entryId2, 1, cashAccountUUID, "8000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000021", entryId2, 2, inventoryUUID, "8000.00", usdCurrency)
        ]

        // AP increases by 3k (purchase on account): DR Inventory, CR AP
        const entryId3 = "e0000000-0000-0000-0000-000000000004"
        const entry3 = createEntry(entryId3, jan15)
        const lines3: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000030", entryId3, 1, inventoryUUID, "3000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000031", entryId3, 2, accountsPayableUUID, "3000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines },
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 }
        ]

        const report = yield* generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Working capital changes:
        // AR: 10k -> 15k (increase of 5k) = -5k cash effect
        // Inventory: 20k -> 15k (decrease of 5k) = +5k cash effect
        // AP: 15k -> 18k (increase of 3k) = +3k cash effect

        // Check that working capital changes are reflected
        expect(report.operatingActivities.workingCapitalChanges.length).toBeGreaterThan(0)

        // The report should reconcile
        expect(report.isReconciled).toBe(true)
      })
    )

    it.effect("handles comprehensive scenario with all activities", () =>
      Effect.gen(function* () {
        const accounts = [
          cashAccount,
          accountsReceivable,
          inventory,
          equipment,
          accountsPayable,
          notesPayable,
          commonStock,
          salesRevenue,
          salariesExpense,
          interestExpense,
          taxExpense
        ]

        // Opening balances (December 2024)
        const openingEntryId = "e0000000-0000-0000-0000-000000000001"
        const openingEntry = createEntry(openingEntryId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000001", openingEntryId, 1, cashAccountUUID, "100000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000002", openingEntryId, 2, accountsReceivableUUID, "25000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000003", openingEntryId, 3, inventoryUUID, "30000.00", usdCurrency),
          createDebitLine("d0000000-0000-0000-0000-000000000004", openingEntryId, 4, equipmentUUID, "50000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000005", openingEntryId, 5, accountsPayableUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000006", openingEntryId, 6, notesPayableUUID, "35000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000007", openingEntryId, 7, commonStockUUID, "150000.00", usdCurrency)
        ]

        // January transactions:
        // 1. Revenue: 80000 (on account)
        const entryId1 = "e0000000-0000-0000-0000-000000000002"
        const entry1 = createEntry(entryId1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000010", entryId1, 1, accountsReceivableUUID, "80000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000011", entryId1, 2, salesRevenueUUID, "80000.00", usdCurrency)
        ]

        // 2. Collections: 60000
        const entryId2 = "e0000000-0000-0000-0000-000000000003"
        const entry2 = createEntry(entryId2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000020", entryId2, 1, cashAccountUUID, "60000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000021", entryId2, 2, accountsReceivableUUID, "60000.00", usdCurrency)
        ]

        // 3. Salaries: 25000
        const entryId4 = "e0000000-0000-0000-0000-000000000005"
        const entry4 = createEntry(entryId4, jan15)
        const lines4: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000040", entryId4, 1, salariesExpenseUUID, "25000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000041", entryId4, 2, cashAccountUUID, "25000.00", usdCurrency)
        ]

        // 4. Interest: 2000
        const entryId5 = "e0000000-0000-0000-0000-000000000006"
        const entry5 = createEntry(entryId5, jan15)
        const lines5: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000050", entryId5, 1, interestExpenseUUID, "2000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000051", entryId5, 2, cashAccountUUID, "2000.00", usdCurrency)
        ]

        // 5. Taxes: 10000
        const entryId6 = "e0000000-0000-0000-0000-000000000007"
        const entry6 = createEntry(entryId6, jan15)
        const lines6: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000060", entryId6, 1, taxExpenseUUID, "10000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000061", entryId6, 2, cashAccountUUID, "10000.00", usdCurrency)
        ]

        // 6. Purchase equipment: 15000
        const entryId7 = "e0000000-0000-0000-0000-000000000008"
        const entry7 = createEntry(entryId7, jan15)
        const lines7: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000070", entryId7, 1, equipmentUUID, "15000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000071", entryId7, 2, cashAccountUUID, "15000.00", usdCurrency)
        ]

        // 7. Borrow: 20000
        const entryId8 = "e0000000-0000-0000-0000-000000000009"
        const entry8 = createEntry(entryId8, jan15)
        const lines8: ReadonlyArray<JournalEntryLine> = [
          createDebitLine("d0000000-0000-0000-0000-000000000080", entryId8, 1, cashAccountUUID, "20000.00", usdCurrency),
          createCreditLine("d0000000-0000-0000-0000-000000000081", entryId8, 2, notesPayableUUID, "20000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines },
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry4, lines: lines4 },
          { entry: entry5, lines: lines5 },
          { entry: entry6, lines: lines6 },
          { entry: entry7, lines: lines7 },
          { entry: entry8, lines: lines8 }
        ]

        const report = yield* generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        // Net income: Revenue (80000) - Salaries (25000) - Interest (2000) - Tax (10000) = 43000
        expect(BigDecimal.equals(
          report.operatingActivities.netIncome.amount,
          BigDecimal.unsafeFromString("43000")
        )).toBe(true)

        // Investing: Equipment purchase = -15000
        expect(BigDecimal.equals(
          report.investingActivities.subtotal.amount,
          BigDecimal.unsafeFromString("-15000")
        )).toBe(true)

        // Financing: Borrowing = +20000
        expect(BigDecimal.equals(
          report.financingActivities.subtotal.amount,
          BigDecimal.unsafeFromString("20000")
        )).toBe(true)

        // Supplemental disclosures
        expect(BigDecimal.equals(
          report.supplementalDisclosures.interestPaid.amount,
          BigDecimal.unsafeFromString("2000")
        )).toBe(true)

        expect(BigDecimal.equals(
          report.supplementalDisclosures.incomesTaxesPaid.amount,
          BigDecimal.unsafeFromString("10000")
        )).toBe(true)

        // Beginning cash: 100000
        expect(BigDecimal.equals(
          report.beginningCash.amount,
          BigDecimal.unsafeFromString("100000")
        )).toBe(true)

        // Actual cash: 100000 + 60000 - 25000 - 2000 - 10000 - 15000 + 20000 = 128000
        expect(BigDecimal.equals(
          report.endingCash.amount,
          BigDecimal.unsafeFromString("128000")
        )).toBe(true)

        // Should reconcile
        expect(report.isReconciled).toBe(true)
        expect(report.sectionsReconcile).toBe(true)
      })
    )
  })

  describe("CashFlowStatementService with repository", () => {
    const createTestRepository = (
      accounts: ReadonlyArray<Account>,
      entries: ReadonlyArray<JournalEntryWithLines>,
      currency: CurrencyCode | null = usdCurrency
    ): Layer.Layer<CashFlowStatementRepository> =>
      Layer.succeed(CashFlowStatementRepository, {
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
        CashFlowStatementServiceLive,
        createTestRepository(accounts, entries, currency)
      )

    it.effect("generates cash flow statement via service", () =>
      Effect.gen(function* () {
        const service = yield* CashFlowStatementService

        const report = yield* service.generateCashFlowStatement({
          companyId,
          periodStart: jan1,
          periodEnd: jan31
        })

        expect(isCashFlowStatementReport(report)).toBe(true)
        expect(report.isReconciled).toBe(true)
      }).pipe(
        Effect.provide(createServiceWithRepo(
          [cashAccount, salesRevenue],
          [
            {
              entry: createEntry("e0000000-0000-0000-0000-000000000001", dec15_2024),
              lines: [
                createDebitLine("d0000000-0000-0000-0000-000000000001", "e0000000-0000-0000-0000-000000000001", 1, cashAccountUUID, "50000.00", usdCurrency),
                createCreditLine("d0000000-0000-0000-0000-000000000002", "e0000000-0000-0000-0000-000000000001", 2, commonStockUUID, "50000.00", usdCurrency)
              ]
            },
            {
              entry: createEntry("e0000000-0000-0000-0000-000000000002", jan15),
              lines: [
                createDebitLine("d0000000-0000-0000-0000-000000000010", "e0000000-0000-0000-0000-000000000002", 1, cashAccountUUID, "20000.00", usdCurrency),
                createCreditLine("d0000000-0000-0000-0000-000000000011", "e0000000-0000-0000-0000-000000000002", 2, salesRevenueUUID, "20000.00", usdCurrency)
              ]
            }
          ]
        ))
      )
    )

    it.effect("fails with CompanyNotFoundError when company not found", () =>
      Effect.gen(function* () {
        const service = yield* CashFlowStatementService

        const result = yield* Effect.either(
          service.generateCashFlowStatement({
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
        const service = yield* CashFlowStatementService

        const result = yield* Effect.either(
          service.generateCashFlowStatement({
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
        Effect.provide(createServiceWithRepo([cashAccount], []))
      )
    )
  })

  describe("property-based tests", () => {
    const uuidArb = FastCheck.uuid()

    it.prop(
      "net change equals sum of all activities",
      [uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb, uuidArb],
      ([openingId, e1, e2, l1, l2, l3, l4, l5, l6]) => {
        const accounts = [cashAccount, salesRevenue, equipment, notesPayable]

        // Opening: Cash 100000
        const openingEntry = createEntry(openingId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(l1, openingId, 1, cashAccountUUID, "100000.00", usdCurrency),
          createCreditLine(l2, openingId, 2, commonStockUUID, "100000.00", usdCurrency)
        ]

        // Revenue: 30000
        const entry1 = createEntry(e1, jan15)
        const lines1: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(l3, e1, 1, cashAccountUUID, "30000.00", usdCurrency),
          createCreditLine(l4, e1, 2, salesRevenueUUID, "30000.00", usdCurrency)
        ]

        // Equipment purchase: 10000
        const entry2 = createEntry(e2, jan15)
        const lines2: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(l5, e2, 1, equipmentUUID, "10000.00", usdCurrency),
          createCreditLine(l6, e2, 2, cashAccountUUID, "10000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines },
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const program = generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)

        // Net change should equal sum of activities + exchange effect
        const sumOfActivities = BigDecimal.sum(
          BigDecimal.sum(
            result.operatingActivities.netCashFromOperating.amount,
            result.investingActivities.subtotal.amount
          ),
          BigDecimal.sum(
            result.financingActivities.subtotal.amount,
            result.exchangeRateEffect.amount
          )
        )

        return BigDecimal.equals(result.netChangeInCash.amount, sumOfActivities)
      }
    )

    it.prop(
      "ending cash equals beginning cash plus net change",
      [uuidArb, uuidArb, uuidArb],
      ([openingId, l1, l2]) => {
        const accounts = [cashAccount, salesRevenue]

        const openingEntry = createEntry(openingId, dec15_2024)
        const openingLines: ReadonlyArray<JournalEntryLine> = [
          createDebitLine(l1, openingId, 1, cashAccountUUID, "75000.00", usdCurrency),
          createCreditLine(l2, openingId, 2, commonStockUUID, "75000.00", usdCurrency)
        ]

        const entries: ReadonlyArray<JournalEntryWithLines> = [
          { entry: openingEntry, lines: openingLines }
        ]

        const program = generateCashFlowStatementFromData(
          companyId,
          accounts,
          entries,
          jan1,
          jan31,
          usdCurrency
        )

        const result = Effect.runSync(program)

        const expectedEnding = BigDecimal.sum(
          result.beginningCash.amount,
          result.netChangeInCash.amount
        )

        return BigDecimal.equals(result.endingCash.amount, expectedEnding)
      }
    )
  })
})
