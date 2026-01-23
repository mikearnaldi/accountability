/**
 * Tests for ReportsApiLive endpoint handlers
 *
 * These tests verify the handler logic using mock repositories.
 * They test the report generation by calling the pure functions
 * from the core services with test data.
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
  type JournalEntryStatus
} from "@accountability/core/journal/JournalEntry"
import { JournalEntryLine, JournalEntryLineId } from "@accountability/core/journal/JournalEntryLine"
import {
  Account,
  AccountId,
  type AccountType,
  type AccountCategory,
  type NormalBalance,
  type CashFlowCategory
} from "@accountability/core/accounting/Account"
import { AccountNumber } from "@accountability/core/accounting/AccountNumber"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { JournalEntryRepository, type JournalEntryRepositoryService } from "@accountability/persistence/Services/JournalEntryRepository"
import { JournalEntryLineRepository, type JournalEntryLineRepositoryService } from "@accountability/persistence/Services/JournalEntryLineRepository"
import { CompanyRepository, type CompanyRepositoryService } from "@accountability/persistence/Services/CompanyRepository"
import { AccountRepository, type AccountRepositoryService } from "@accountability/persistence/Services/AccountRepository"
import { EntityNotFoundError } from "@accountability/persistence/Errors/RepositoryError"
import {
  generateTrialBalanceFromData
} from "@accountability/core/accounting/TrialBalanceService"
import {
  generateBalanceSheetFromData
} from "@accountability/core/reporting/BalanceSheetService"
import {
  generateIncomeStatementFromData
} from "@accountability/core/reporting/IncomeStatementService"
import {
  generateCashFlowStatementFromData
} from "@accountability/core/reporting/CashFlowStatementService"
import type { JournalEntryWithLines } from "@accountability/core/accounting/AccountBalance"

// =============================================================================
// Test Fixtures
// =============================================================================

const testCompanyId = CompanyId.make("550e8400-e29b-41d4-a716-446655440001")
const testOrganizationId = OrganizationId.make("550e8400-e29b-41d4-a716-446655440000")
const testUserId = UserId.make("550e8400-e29b-41d4-a716-446655440010")
const testCurrency = CurrencyCode.make("USD")

// Account IDs
const cashAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440101")
const arAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440102")
const apAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440103")
const equityAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440104")
const revenueAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440105")
const expenseAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440106")

const createTestCompany = (): Company => {
  return Company.make({
    id: testCompanyId,
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
    functionalCurrency: testCurrency,
    reportingCurrency: testCurrency,
    fiscalYearEnd: FiscalYearEnd.make({ month: 12, day: 31 }),
    retainedEarningsAccountId: Option.none(),
    isActive: true,
    createdAt: timestampNow()
  })
}

const createTestAccount = (overrides: Partial<{
  id: AccountId
  accountNumber: string
  name: string
  accountType: AccountType
  accountCategory: AccountCategory
  normalBalance: NormalBalance
  cashFlowCategory: Option.Option<CashFlowCategory>
}>): Account => {
  const id = overrides.id ?? AccountId.make(crypto.randomUUID())
  const accountNumber = overrides.accountNumber ?? "1000"
  const name = overrides.name ?? "Test Account"
  const accountType = overrides.accountType ?? "Asset"
  const accountCategory = overrides.accountCategory ?? "CurrentAsset"
  const normalBalance = overrides.normalBalance ?? "Debit"
  const cashFlowCategory = overrides.cashFlowCategory ?? Option.some<CashFlowCategory>("Operating")

  return Account.make({
    id,
    companyId: testCompanyId,
    accountNumber: AccountNumber.make(accountNumber),
    name,
    description: Option.none(),
    accountType,
    accountCategory,
    normalBalance,
    parentAccountId: Option.none(),
    hierarchyLevel: 1,
    isPostable: true,
    isCashFlowRelevant: true,
    cashFlowCategory,
    isIntercompany: false,
    intercompanyPartnerId: Option.none(),
    currencyRestriction: Option.none(),
    isActive: true,
    createdAt: timestampNow(),
    deactivatedAt: Option.none()
  })
}

/**
 * Create test accounts for all five account types
 */
const createChartOfAccounts = (): ReadonlyArray<Account> => [
  // Assets
  createTestAccount({
    id: cashAccountId,
    accountNumber: "1000",
    name: "Cash",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    normalBalance: "Debit",
    cashFlowCategory: Option.some<CashFlowCategory>("Operating")
  }),
  createTestAccount({
    id: arAccountId,
    accountNumber: "1100",
    name: "Accounts Receivable",
    accountType: "Asset",
    accountCategory: "CurrentAsset",
    normalBalance: "Debit",
    cashFlowCategory: Option.some<CashFlowCategory>("Operating")
  }),
  // Liabilities
  createTestAccount({
    id: apAccountId,
    accountNumber: "2000",
    name: "Accounts Payable",
    accountType: "Liability",
    accountCategory: "CurrentLiability",
    normalBalance: "Credit",
    cashFlowCategory: Option.some<CashFlowCategory>("Operating")
  }),
  // Equity
  createTestAccount({
    id: equityAccountId,
    accountNumber: "3000",
    name: "Common Stock",
    accountType: "Equity",
    accountCategory: "ContributedCapital",
    normalBalance: "Credit",
    cashFlowCategory: Option.some<CashFlowCategory>("Financing")
  }),
  // Revenue
  createTestAccount({
    id: revenueAccountId,
    accountNumber: "4000",
    name: "Service Revenue",
    accountType: "Revenue",
    accountCategory: "OperatingRevenue",
    normalBalance: "Credit",
    cashFlowCategory: Option.some<CashFlowCategory>("Operating")
  }),
  // Expenses
  createTestAccount({
    id: expenseAccountId,
    accountNumber: "5000",
    name: "Operating Expenses",
    accountType: "Expense",
    accountCategory: "OperatingExpense",
    normalBalance: "Debit",
    cashFlowCategory: Option.some<CashFlowCategory>("Operating")
  })
]

const createTestJournalEntry = (overrides: Partial<{
  id: JournalEntryId
  status: JournalEntryStatus
  transactionDate: LocalDate
  postingDate: Option.Option<LocalDate>
}>): JournalEntry => {
  const id = overrides.id ?? JournalEntryId.make(crypto.randomUUID())
  const status = overrides.status ?? "Posted"
  const transactionDate = overrides.transactionDate ?? LocalDate.make({ year: 2025, month: 1, day: 15 })
  const postingDate = overrides.postingDate ?? (status === "Posted" ? Option.some(transactionDate) : Option.none())

  return JournalEntry.make({
    id,
    companyId: testCompanyId,
    entryNumber: Option.some(EntryNumber.make("JE-0001")),
    referenceNumber: Option.none(),
    description: "Test journal entry",
    transactionDate,
    postingDate,
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
    createdBy: testUserId,
    createdAt: timestampNow(),
    postedBy: status === "Posted" ? Option.some(testUserId) : Option.none(),
    postedAt: status === "Posted" ? Option.some(timestampNow()) : Option.none()
  })
}

const createTestJournalEntryLine = (overrides: Partial<{
  journalEntryId: JournalEntryId
  lineNumber: number
  accountId: AccountId
  isDebit: boolean
  amount: string
}>): JournalEntryLine => {
  const journalEntryId = overrides.journalEntryId ?? JournalEntryId.make(crypto.randomUUID())
  const lineNumber = overrides.lineNumber ?? 1
  const accountId = overrides.accountId ?? cashAccountId
  const isDebit = overrides.isDebit ?? true
  const amount = overrides.amount ?? "100.00"

  const monetaryAmount = MonetaryAmount.make({
    amount: BigDecimal.unsafeFromString(amount),
    currency: testCurrency
  })

  return JournalEntryLine.make({
    id: JournalEntryLineId.make(crypto.randomUUID()),
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

/**
 * Create balanced journal entry with lines for testing reports
 */
const createBalancedJournalEntryWithLines = (overrides: Partial<{
  entryId: JournalEntryId
  debitAccount: AccountId
  creditAccount: AccountId
  amount: string
  postingDate: LocalDate
}>): { entry: JournalEntry; lines: ReadonlyArray<JournalEntryLine> } => {
  const entryId = overrides.entryId ?? JournalEntryId.make(crypto.randomUUID())
  const debitAccount = overrides.debitAccount ?? cashAccountId
  const creditAccount = overrides.creditAccount ?? revenueAccountId
  const amount = overrides.amount ?? "1000.00"
  const postingDate = overrides.postingDate ?? LocalDate.make({ year: 2025, month: 1, day: 15 })

  const entry = createTestJournalEntry({
    id: entryId,
    status: "Posted",
    transactionDate: postingDate,
    postingDate: Option.some(postingDate)
  })

  const lines = [
    createTestJournalEntryLine({
      journalEntryId: entryId,
      lineNumber: 1,
      accountId: debitAccount,
      isDebit: true,
      amount
    }),
    createTestJournalEntryLine({
      journalEntryId: entryId,
      lineNumber: 2,
      accountId: creditAccount,
      isDebit: false,
      amount
    })
  ]

  return { entry, lines }
}

// =============================================================================
// Mock Repositories
// =============================================================================

const createMockAccountRepository = (initialAccounts: ReadonlyArray<Account> = []) =>
  Effect.gen(function* () {
    const accountsRef = yield* Ref.make<ReadonlyArray<Account>>(initialAccounts)

    const service: AccountRepositoryService = {
      findById: (_organizationId, id) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return Option.fromNullable(accounts.find((a) => a.id === id))
        }),
      findByCompany: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId)
        }),
      findByNumber: (_organizationId, companyId, accountNumber) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return Option.fromNullable(
            accounts.find((a) => a.companyId === companyId && a.accountNumber === accountNumber)
          )
        }),
      findByType: (_organizationId, companyId, accountType) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId && a.accountType === accountType)
        }),
      findActiveByCompany: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId && a.isActive)
        }),
      findChildren: (_organizationId, parentId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => Option.isSome(a.parentAccountId) && a.parentAccountId.value === parentId)
        }),
      findIntercompanyAccounts: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId && a.isIntercompany)
        }),
      create: (account) =>
        Effect.gen(function* () {
          yield* Ref.update(accountsRef, (accounts) => [...accounts, account])
          return account
        }),
      update: (_organizationId, account) =>
        Effect.gen(function* () {
          yield* Ref.update(accountsRef, (accts) =>
            accts.map((a) => (a.id === account.id ? account : a))
          )
          return account
        }),
      getById: (_organizationId, id) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          const account = accounts.find((a) => a.id === id)
          if (!account) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Account",
              entityId: id
            }))
          }
          return account
        }),
      exists: (_organizationId, id) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.some((a) => a.id === id)
        }),
      isAccountNumberTaken: (_organizationId, companyId, accountNumber) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.some((a) => a.companyId === companyId && a.accountNumber === accountNumber)
        })
    }

    return service
  })

const createMockCompanyRepository = (companies: ReadonlyArray<Company> = [createTestCompany()]) =>
  Effect.gen(function* () {
    const companiesRef = yield* Ref.make<ReadonlyArray<Company>>(companies)

    const service: CompanyRepositoryService = {
      findById: (organizationId, id) =>
        Effect.gen(function* () {
          const allCompanies = yield* Ref.get(companiesRef)
          return Option.fromNullable(allCompanies.find((c) => c.id === id && c.organizationId === organizationId))
        }),
      findByOrganization: (_orgId) => Effect.succeed([]),
      findActiveByOrganization: (_orgId) => Effect.succeed([]),
      create: (company) =>
        Effect.gen(function* () {
          yield* Ref.update(companiesRef, (cs) => [...cs, company])
          return company
        }),
      update: (organizationId, company) =>
        Effect.gen(function* () {
          yield* Ref.update(companiesRef, (cs) =>
            cs.map((c) => (c.id === company.id ? company : c))
          )
          return company
        }),
      getById: (organizationId, id) =>
        Effect.gen(function* () {
          const allCompanies = yield* Ref.get(companiesRef)
          const company = allCompanies.find((c) => c.id === id && c.organizationId === organizationId)
          if (!company) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Company",
              entityId: id
            }))
          }
          return company
        }),
      exists: (organizationId, id) =>
        Effect.gen(function* () {
          const allCompanies = yield* Ref.get(companiesRef)
          return allCompanies.some((c) => c.id === id && c.organizationId === organizationId)
        })
    }

    return service
  })

const createMockJournalEntryRepository = (initialEntries: ReadonlyArray<JournalEntry> = []) =>
  Effect.gen(function* () {
    const entriesRef = yield* Ref.make<ReadonlyArray<JournalEntry>>(initialEntries)

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
      findByPeriodRange: (_organizationId, _companyId, _startPeriod, _endPeriod) => Effect.succeed([]),
      findDraftEntries: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.filter((e) => e.companyId === companyId && e.status === "Draft")
        }),
      findPostedByPeriod: (_organizationId, _companyId, _period) => Effect.succeed([]),
      findReversingEntry: (_organizationId, _entryId) => Effect.succeed(Option.none()),
      countDraftEntriesInPeriod: (_organizationId, _companyId, _period) => Effect.succeed(0),
      findIntercompanyEntries: (_organizationId, _companyId) => Effect.succeed([]),
      create: (entry) =>
        Effect.gen(function* () {
          yield* Ref.update(entriesRef, (entries) => [...entries, entry])
          return entry
        }),
      update: (_organizationId, entry) =>
        Effect.gen(function* () {
          yield* Ref.update(entriesRef, (es) => es.map((e) => (e.id === entry.id ? entry : e)))
          return entry
        }),
      getById: (_organizationId, id) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          const entry = entries.find((e) => e.id === id)
          if (!entry) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "JournalEntry",
              entityId: id
            }))
          }
          return entry
        }),
      exists: (_organizationId, id) =>
        Effect.gen(function* () {
          const entries = yield* Ref.get(entriesRef)
          return entries.some((e) => e.id === id)
        }),
      getNextEntryNumber: (_organizationId, _companyId) => Effect.succeed("JE-0001")
    }

    return service
  })

const createMockJournalEntryLineRepository = (initialLines: ReadonlyArray<JournalEntryLine> = []) =>
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
      findByAccount: (_accountId) => Effect.succeed([]),
      getById: (lineId) =>
        Effect.gen(function* () {
          const lines = yield* Ref.get(linesRef)
          const line = lines.find((l) => l.id === lineId)
          if (!line) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "JournalEntryLine",
              entityId: lineId
            }))
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

// =============================================================================
// Test Layer
// =============================================================================

const createTestLayer = (options: {
  accounts?: ReadonlyArray<Account>
  entries?: ReadonlyArray<JournalEntry>
  lines?: ReadonlyArray<JournalEntryLine>
  companies?: ReadonlyArray<Company>
} = {}) =>
  Layer.mergeAll(
    Layer.effect(AccountRepository, createMockAccountRepository(options.accounts ?? createChartOfAccounts())),
    Layer.effect(CompanyRepository, createMockCompanyRepository(options.companies ?? [createTestCompany()])),
    Layer.effect(JournalEntryRepository, createMockJournalEntryRepository(options.entries ?? [])),
    Layer.effect(JournalEntryLineRepository, createMockJournalEntryLineRepository(options.lines ?? []))
  )

// =============================================================================
// Tests
// =============================================================================

describe("ReportsApiLive", () => {
  // ===========================================================================
  // Trial Balance Tests
  // ===========================================================================
  describe("generateTrialBalance", () => {
    it.effect("should generate trial balance with balanced entries", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()
        const { entry, lines } = createBalancedJournalEntryWithLines({
          debitAccount: cashAccountId,
          creditAccount: revenueAccountId,
          amount: "1000.00"
        })

        const asOfDate = LocalDate.make({ year: 2025, month: 1, day: 31 })
        const entriesWithLines: JournalEntryWithLines[] = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          testCompanyId,
          accounts,
          entriesWithLines,
          asOfDate,
          testCurrency,
          { excludeZeroBalances: true }
        )

        expect(report.metadata.isBalanced).toBe(true)
        expect(report.lineItems.length).toBeGreaterThan(0)

        // Check that debits equal credits
        const totalDebits = BigDecimal.format(report.totalDebits.amount)
        const totalCredits = BigDecimal.format(report.totalCredits.amount)
        expect(totalDebits).toBe(totalCredits)
      })
    )

    it.effect("should exclude zero balances when option is set", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()
        const { entry, lines } = createBalancedJournalEntryWithLines({
          debitAccount: cashAccountId,
          creditAccount: revenueAccountId,
          amount: "500.00"
        })

        const asOfDate = LocalDate.make({ year: 2025, month: 1, day: 31 })
        const entriesWithLines: JournalEntryWithLines[] = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          testCompanyId,
          accounts,
          entriesWithLines,
          asOfDate,
          testCurrency,
          { excludeZeroBalances: true }
        )

        // Only accounts with activity should appear
        expect(report.lineItems.length).toBe(2) // Cash (debit) and Revenue (credit)
      })
    )

    it.effect("should include all accounts when excludeZeroBalances is false", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()
        const { entry, lines } = createBalancedJournalEntryWithLines({
          debitAccount: cashAccountId,
          creditAccount: revenueAccountId,
          amount: "500.00"
        })

        const asOfDate = LocalDate.make({ year: 2025, month: 1, day: 31 })
        const entriesWithLines: JournalEntryWithLines[] = [{ entry, lines }]

        const report = yield* generateTrialBalanceFromData(
          testCompanyId,
          accounts,
          entriesWithLines,
          asOfDate,
          testCurrency,
          { excludeZeroBalances: false }
        )

        // All postable accounts should appear
        expect(report.lineItems.length).toBe(6)
      })
    )
  })

  // ===========================================================================
  // Balance Sheet Tests
  // ===========================================================================
  describe("generateBalanceSheet", () => {
    it.effect("should generate balanced balance sheet", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()

        // Create entries that establish a balance sheet using only balance sheet accounts
        // The accounting equation must hold: Assets = Liabilities + Equity

        // 1. Owner invests capital (Debit Cash, Credit Equity)
        // Assets +10,000, Equity +10,000
        const { entry: entry1, lines: lines1 } = createBalancedJournalEntryWithLines({
          debitAccount: cashAccountId,
          creditAccount: equityAccountId,
          amount: "10000.00",
          postingDate: LocalDate.make({ year: 2025, month: 1, day: 1 })
        })

        // 2. Borrow money (Debit Cash, Credit AP/Liability)
        // Assets +5,000, Liabilities +5,000
        const { entry: entry2, lines: lines2 } = createBalancedJournalEntryWithLines({
          entryId: JournalEntryId.make(crypto.randomUUID()),
          debitAccount: cashAccountId,
          creditAccount: apAccountId,
          amount: "5000.00",
          postingDate: LocalDate.make({ year: 2025, month: 1, day: 15 })
        })

        // 3. Purchase on credit (Debit AR from customer advance, Credit Cash)
        // This keeps balance sheet balanced: AR +3,000, Cash -3,000 (net 0 change to assets)
        const { entry: entry3, lines: lines3 } = createBalancedJournalEntryWithLines({
          entryId: JournalEntryId.make(crypto.randomUUID()),
          debitAccount: arAccountId,
          creditAccount: cashAccountId,
          amount: "3000.00",
          postingDate: LocalDate.make({ year: 2025, month: 1, day: 20 })
        })

        // Final balances:
        // Cash: 10,000 + 5,000 - 3,000 = 12,000 (Asset)
        // AR: 3,000 (Asset)
        // Total Assets: 15,000
        // AP: 5,000 (Liability)
        // Equity: 10,000 (Equity)
        // Total Liabilities + Equity: 15,000
        // Balance sheet balances!

        const entriesWithLines: JournalEntryWithLines[] = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 },
          { entry: entry3, lines: lines3 }
        ]

        const asOfDate = LocalDate.make({ year: 2025, month: 1, day: 31 })

        const report = yield* generateBalanceSheetFromData(
          testCompanyId,
          accounts,
          entriesWithLines,
          asOfDate,
          testCurrency,
          { includeZeroBalances: false }
        )

        // Verify balance sheet structure
        expect(report.currentAssets).toBeDefined()
        expect(report.currentLiabilities).toBeDefined()
        expect(report.equity).toBeDefined()

        // Verify totals
        const totalAssets = BigDecimal.format(report.totalAssets.amount)
        const totalLiabilitiesAndEquity = BigDecimal.format(report.totalLiabilitiesAndEquity.amount)
        expect(totalAssets).toBe(totalLiabilitiesAndEquity)
        expect(totalAssets).toBe("15000")
      })
    )
  })

  // ===========================================================================
  // Income Statement Tests
  // ===========================================================================
  describe("generateIncomeStatement", () => {
    it.effect("should generate income statement with revenue and expenses", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()

        // Revenue entry (Debit Cash, Credit Revenue)
        const { entry: entry1, lines: lines1 } = createBalancedJournalEntryWithLines({
          debitAccount: cashAccountId,
          creditAccount: revenueAccountId,
          amount: "10000.00",
          postingDate: LocalDate.make({ year: 2025, month: 1, day: 15 })
        })

        // Expense entry (Debit Expense, Credit Cash)
        const { entry: entry2, lines: lines2 } = createBalancedJournalEntryWithLines({
          entryId: JournalEntryId.make(crypto.randomUUID()),
          debitAccount: expenseAccountId,
          creditAccount: cashAccountId,
          amount: "3000.00",
          postingDate: LocalDate.make({ year: 2025, month: 1, day: 20 })
        })

        const entriesWithLines: JournalEntryWithLines[] = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const periodStart = LocalDate.make({ year: 2025, month: 1, day: 1 })
        const periodEnd = LocalDate.make({ year: 2025, month: 1, day: 31 })

        const report = yield* generateIncomeStatementFromData(
          testCompanyId,
          accounts,
          entriesWithLines,
          periodStart,
          periodEnd,
          testCurrency,
          {}
        )

        expect(report.revenue).toBeDefined()
        expect(report.operatingExpenses).toBeDefined()

        // Net income should be revenue - expenses = $10,000 - $3,000 = $7,000
        expect(BigDecimal.format(report.netIncome.amount)).toBe("7000")
      })
    )
  })

  // ===========================================================================
  // Cash Flow Statement Tests
  // ===========================================================================
  describe("generateCashFlowStatement", () => {
    it.effect("should generate cash flow statement", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()

        // Revenue entry that increases cash
        const { entry: entry1, lines: lines1 } = createBalancedJournalEntryWithLines({
          debitAccount: cashAccountId,
          creditAccount: revenueAccountId,
          amount: "5000.00",
          postingDate: LocalDate.make({ year: 2025, month: 1, day: 10 })
        })

        // Expense entry that decreases cash
        const { entry: entry2, lines: lines2 } = createBalancedJournalEntryWithLines({
          entryId: JournalEntryId.make(crypto.randomUUID()),
          debitAccount: expenseAccountId,
          creditAccount: cashAccountId,
          amount: "2000.00",
          postingDate: LocalDate.make({ year: 2025, month: 1, day: 15 })
        })

        const entriesWithLines: JournalEntryWithLines[] = [
          { entry: entry1, lines: lines1 },
          { entry: entry2, lines: lines2 }
        ]

        const periodStart = LocalDate.make({ year: 2025, month: 1, day: 1 })
        const periodEnd = LocalDate.make({ year: 2025, month: 1, day: 31 })

        const report = yield* generateCashFlowStatementFromData(
          testCompanyId,
          accounts,
          entriesWithLines,
          periodStart,
          periodEnd,
          testCurrency
        )

        expect(report.operatingActivities).toBeDefined()
        expect(report.investingActivities).toBeDefined()
        expect(report.financingActivities).toBeDefined()
        expect(report.netChangeInCash).toBeDefined()
      })
    )
  })

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================
  describe("error handling", () => {
    it.effect("should verify company exists before generating report", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer({ companies: [] })

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const exists = yield* companyRepo.exists(testOrganizationId, testCompanyId)

        expect(exists).toBe(false)
      })
    )

    it.effect("should handle empty entries for trial balance", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()
        const entriesWithLines: JournalEntryWithLines[] = []

        const asOfDate = LocalDate.make({ year: 2025, month: 1, day: 31 })

        const report = yield* generateTrialBalanceFromData(
          testCompanyId,
          accounts,
          entriesWithLines,
          asOfDate,
          testCurrency,
          { excludeZeroBalances: true }
        )

        expect(report.lineItems.length).toBe(0)
        expect(report.metadata.isBalanced).toBe(true)
      })
    )
  })

  // ===========================================================================
  // Repository Integration Tests
  // ===========================================================================
  describe("repository integration", () => {
    it.effect("should fetch accounts from repository", () =>
      Effect.gen(function* () {
        const accounts = createChartOfAccounts()
        const testLayer = createTestLayer({ accounts })

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const fetchedAccounts = yield* accountRepo.findByCompany(testOrganizationId, testCompanyId)

        expect(fetchedAccounts.length).toBe(6)
      })
    )

    it.effect("should fetch journal entries with lines from repositories", () =>
      Effect.gen(function* () {
        const { entry, lines } = createBalancedJournalEntryWithLines({})
        const testLayer = createTestLayer({
          entries: [entry],
          lines
        })

        const entryRepo = yield* JournalEntryRepository.pipe(Effect.provide(testLayer))
        const lineRepo = yield* JournalEntryLineRepository.pipe(Effect.provide(testLayer))

        const entries = yield* entryRepo.findByCompany(testOrganizationId, testCompanyId)
        expect(entries.length).toBe(1)

        const linesMap = yield* lineRepo.findByJournalEntries(entries.map((e) => e.id))
        expect(linesMap.get(entry.id)?.length).toBe(2)
      })
    )
  })
})
