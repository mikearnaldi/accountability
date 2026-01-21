/**
 * YearEndCloseServiceLive - Implementation of YearEndCloseService
 *
 * Implements the year-end close workflow including:
 * - Preview calculation of net income from income statement accounts
 * - Generation of closing journal entries
 * - Closing all periods and the fiscal year
 * - Reopening closed years with reversal entries
 *
 * @module YearEndCloseServiceLive
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/Array"
import {
  YearEndCloseService,
  type YearEndCloseServiceShape,
  YearEndClosePreview,
  YearEndCloseResult,
  ReopenYearResult,
  AccountSummary,
  YearAlreadyClosedError,
  YearNotClosedError,
  RetainedEarningsNotConfiguredError
} from "@accountability/core/fiscal/YearEndCloseService"
import { FiscalPeriodService } from "@accountability/core/fiscal/FiscalPeriodService"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import type { LocalDate } from "@accountability/core/shared/values/LocalDate"
import type { JournalEntryWithLines } from "@accountability/core/accounting/AccountBalance"
import { generateTrialBalanceFromData } from "@accountability/core/accounting/TrialBalanceService"
import { FiscalPeriodRepository } from "../Services/FiscalPeriodRepository.ts"
import { AccountRepository } from "../Services/AccountRepository.ts"
import { CompanyRepository } from "../Services/CompanyRepository.ts"
import { JournalEntryRepository } from "../Services/JournalEntryRepository.ts"
import { JournalEntryLineRepository } from "../Services/JournalEntryLineRepository.ts"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { CompanyId } from "@accountability/core/company/Company"
import { JournalEntry, JournalEntryId, UserId } from "@accountability/core/journal/JournalEntry"
import { JournalEntryLine, JournalEntryLineId } from "@accountability/core/journal/JournalEntryLine"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import type { Account } from "@accountability/core/accounting/Account"

// =============================================================================
// Default currency for fallback
// =============================================================================

const DEFAULT_CURRENCY = CurrencyCode.make("USD")

/**
 * Creates the YearEndCloseService implementation
 */
const make = Effect.gen(function* () {
  const fiscalPeriodService = yield* FiscalPeriodService
  const fiscalPeriodRepo = yield* FiscalPeriodRepository
  const accountRepo = yield* AccountRepository
  const companyRepo = yield* CompanyRepository
  const journalEntryRepo = yield* JournalEntryRepository
  const journalEntryLineRepo = yield* JournalEntryLineRepository

  /**
   * Get the company's functional currency
   */
  const getCompanyCurrency = (organizationId: OrganizationId, companyId: CompanyId) =>
    Effect.gen(function* () {
      const maybeCompany = yield* companyRepo.findById(organizationId, companyId)
      if (Option.isNone(maybeCompany)) {
        return DEFAULT_CURRENCY
      }
      return maybeCompany.value.functionalCurrency
    })

  /**
   * Get retained earnings account for a company
   */
  const getRetainedEarnings = (organizationId: OrganizationId, companyId: CompanyId) =>
    Effect.gen(function* () {
      const maybeCompany = yield* companyRepo.findById(organizationId, companyId)
      if (Option.isNone(maybeCompany)) {
        return Option.none<AccountSummary>()
      }

      const company = maybeCompany.value
      if (Option.isNone(company.retainedEarningsAccountId)) {
        return Option.none<AccountSummary>()
      }

      const maybeAccount = yield* accountRepo.findById(
        organizationId,
        company.retainedEarningsAccountId.value
      )
      if (Option.isNone(maybeAccount)) {
        return Option.none<AccountSummary>()
      }

      const account = maybeAccount.value
      return Option.some(
        AccountSummary.make({
          id: account.id,
          number: account.accountNumber,
          name: account.name
        })
      )
    })

  /**
   * Fetch posted journal entries with lines for a company
   */
  const fetchJournalEntriesWithLines = (
    organizationId: OrganizationId,
    companyId: CompanyId
  ): Effect.Effect<ReadonlyArray<JournalEntryWithLines>, never, never> =>
    Effect.gen(function* () {
      // Get all posted journal entries
      const journalEntries = yield* journalEntryRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)
      const postedEntries = journalEntries.filter((e) => e.status === "Posted")

      // Get lines for each entry
      const entriesWithLines: JournalEntryWithLines[] = []
      for (const entry of postedEntries) {
        const lines = yield* journalEntryLineRepo.findByJournalEntry(entry.id).pipe(Effect.orDie)
        entriesWithLines.push({ entry, lines })
      }

      return entriesWithLines
    })

  /**
   * Calculate income statement totals (revenue and expenses) for a fiscal year
   *
   * Returns total revenue (credit balances on Revenue accounts) and
   * total expenses (debit balances on Expense accounts)
   */
  const calculateIncomeStatementTotals = (
    organizationId: OrganizationId,
    companyId: CompanyId,
    endDate: LocalDate
  ) =>
    Effect.gen(function* () {
      // Get functional currency
      const currency = yield* getCompanyCurrency(organizationId, companyId)

      // Get all accounts for the company
      const accounts = yield* accountRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)

      // Get all posted journal entries with lines
      const entries = yield* fetchJournalEntriesWithLines(organizationId, companyId)

      // Generate trial balance using the pure function
      const trialBalanceResult = yield* generateTrialBalanceFromData(
        companyId,
        accounts,
        entries,
        endDate,
        currency,
        { excludeZeroBalances: false }
      ).pipe(
        // If trial balance fails due to not being balanced, still calculate totals
        // The preview should show the amounts even if unbalanced
        Effect.catchTag("TrialBalanceNotBalancedError", () =>
          Effect.succeed(null)
        )
      )

      // If we couldn't generate a balanced trial balance, calculate manually
      if (trialBalanceResult === null) {
        // Manual calculation for revenue and expense accounts
        let totalRevenue = BigDecimal.fromBigInt(0n)
        let totalExpenses = BigDecimal.fromBigInt(0n)

        const revenueAccounts = accounts.filter((a) => a.accountType === "Revenue")
        const expenseAccounts = accounts.filter((a) => a.accountType === "Expense")

        // Calculate revenue (credit balances)
        for (const account of revenueAccounts) {
          if (!account.isPostable) continue
          // Revenue accounts have credit normal balance
          // Sum all credits - debits to get the balance
          const accountEntries = entries.flatMap((e) =>
            e.lines.filter((l) => l.accountId === account.id)
          )
          for (const line of accountEntries) {
            // Extract amounts from Options, defaulting to zero
            const creditAmt = Option.getOrElse(line.creditAmount, () =>
              MonetaryAmount.zero(currency)
            )
            const debitAmt = Option.getOrElse(line.debitAmount, () =>
              MonetaryAmount.zero(currency)
            )
            totalRevenue = BigDecimal.sum(
              totalRevenue,
              BigDecimal.subtract(creditAmt.amount, debitAmt.amount)
            )
          }
        }

        // Calculate expenses (debit balances)
        for (const account of expenseAccounts) {
          if (!account.isPostable) continue
          // Expense accounts have debit normal balance
          // Sum all debits - credits to get the balance
          const accountEntries = entries.flatMap((e) =>
            e.lines.filter((l) => l.accountId === account.id)
          )
          for (const line of accountEntries) {
            // Extract amounts from Options, defaulting to zero
            const debitAmt = Option.getOrElse(line.debitAmount, () =>
              MonetaryAmount.zero(currency)
            )
            const creditAmt = Option.getOrElse(line.creditAmount, () =>
              MonetaryAmount.zero(currency)
            )
            totalExpenses = BigDecimal.sum(
              totalExpenses,
              BigDecimal.subtract(debitAmt.amount, creditAmt.amount)
            )
          }
        }

        return {
          totalRevenue: MonetaryAmount.fromBigDecimal(totalRevenue, currency),
          totalExpenses: MonetaryAmount.fromBigDecimal(totalExpenses, currency),
          isBalanced: false
        }
      }

      // Use trial balance report to get income statement totals
      const incomeItems = trialBalanceResult.incomeStatementItems

      // Revenue accounts show in credit column
      const revenueItems = ReadonlyArray.filter(incomeItems, (i) => i.accountType === "Revenue")
      const totalRevenue = ReadonlyArray.reduce(
        revenueItems,
        BigDecimal.fromBigInt(0n),
        (sum, item) => BigDecimal.sum(sum, item.creditBalance.amount)
      )

      // Expense accounts show in debit column
      const expenseItems = ReadonlyArray.filter(incomeItems, (i) => i.accountType === "Expense")
      const totalExpenses = ReadonlyArray.reduce(
        expenseItems,
        BigDecimal.fromBigInt(0n),
        (sum, item) => BigDecimal.sum(sum, item.debitBalance.amount)
      )

      return {
        totalRevenue: MonetaryAmount.fromBigDecimal(totalRevenue, currency),
        totalExpenses: MonetaryAmount.fromBigDecimal(totalExpenses, currency),
        isBalanced: trialBalanceResult.isBalanced
      }
    })

  /**
   * AccountBalance - Holds account and its calculated balance
   */
  interface AccountBalance {
    account: Account
    balance: BigDecimal.BigDecimal // Positive for normal balance (credit for revenue, debit for expense)
  }

  /**
   * Calculate individual account balances from journal entry lines
   * Returns accounts with their net balances in their normal balance direction
   */
  const calculateAccountBalances = (
    accounts: ReadonlyArray<Account>,
    entries: ReadonlyArray<JournalEntryWithLines>,
    currency: CurrencyCode
  ): Effect.Effect<ReadonlyArray<AccountBalance>, never, never> =>
    Effect.succeed(
      accounts
        .filter(a => a.isPostable) // Only postable accounts have balances
        .map(account => {
          // Find all lines for this account across all entries
          const accountLines = entries.flatMap(e =>
            e.lines.filter(l => l.accountId === account.id)
          )

          // Calculate net balance
          // For Revenue (credit normal): credits - debits gives positive balance
          // For Expense (debit normal): debits - credits gives positive balance
          let netBalance = BigDecimal.fromBigInt(0n)

          for (const line of accountLines) {
            const debitAmt = Option.getOrElse(line.debitAmount, () =>
              MonetaryAmount.zero(currency)
            )
            const creditAmt = Option.getOrElse(line.creditAmount, () =>
              MonetaryAmount.zero(currency)
            )

            if (account.accountType === "Revenue") {
              // Revenue accounts have credit normal balance
              // Positive balance = credits > debits
              netBalance = BigDecimal.sum(
                netBalance,
                BigDecimal.subtract(creditAmt.amount, debitAmt.amount)
              )
            } else if (account.accountType === "Expense") {
              // Expense accounts have debit normal balance
              // Positive balance = debits > credits
              netBalance = BigDecimal.sum(
                netBalance,
                BigDecimal.subtract(debitAmt.amount, creditAmt.amount)
              )
            }
          }

          return { account, balance: netBalance }
        })
    )

  const service: YearEndCloseServiceShape = {
    previewYearEndClose: (organizationId, companyId, fiscalYearId) =>
      Effect.gen(function* () {
        // Get fiscal year
        const fiscalYearOpt = yield* fiscalPeriodRepo.findFiscalYearById(companyId, fiscalYearId)
        if (Option.isNone(fiscalYearOpt)) {
          // Return a preview with blockers
          return YearEndClosePreview.make({
            fiscalYearId,
            fiscalYearName: "Unknown",
            totalRevenue: MonetaryAmount.zero(DEFAULT_CURRENCY),
            totalExpenses: MonetaryAmount.zero(DEFAULT_CURRENCY),
            netIncome: MonetaryAmount.zero(DEFAULT_CURRENCY),
            retainedEarningsAccount: Option.none(),
            canProceed: false,
            blockers: ["Fiscal year not found"]
          })
        }

        const fiscalYear = fiscalYearOpt.value
        const blockers: string[] = []

        // Check if year is already closed
        if (fiscalYear.status === "Closed") {
          blockers.push("Fiscal year is already closed")
        }

        // Get retained earnings account
        const retainedEarningsAccount = yield* getRetainedEarnings(organizationId, companyId)
        if (Option.isNone(retainedEarningsAccount)) {
          blockers.push("Retained earnings account not configured. Configure it in Company Settings.")
        }

        // Get currency
        const currency = yield* getCompanyCurrency(organizationId, companyId)

        // Calculate income statement totals
        const incomeResult = yield* calculateIncomeStatementTotals(
          organizationId,
          companyId,
          fiscalYear.endDate
        )

        // Check if trial balance is balanced
        if (!incomeResult.isBalanced) {
          blockers.push("Trial balance is not balanced. Review journal entries before closing.")
        }

        // Calculate net income (Revenue - Expenses)
        const netIncomeAmount = BigDecimal.subtract(
          incomeResult.totalRevenue.amount,
          incomeResult.totalExpenses.amount
        )
        const netIncome = MonetaryAmount.fromBigDecimal(netIncomeAmount, currency)

        return YearEndClosePreview.make({
          fiscalYearId,
          fiscalYearName: fiscalYear.name,
          totalRevenue: incomeResult.totalRevenue,
          totalExpenses: incomeResult.totalExpenses,
          netIncome,
          retainedEarningsAccount,
          canProceed: blockers.length === 0,
          blockers
        })
      }),

    executeYearEndClose: (organizationId, companyId, fiscalYearId) =>
      Effect.gen(function* () {
        // Get fiscal year
        const fiscalYearOpt = yield* fiscalPeriodRepo.findFiscalYearById(companyId, fiscalYearId)
        if (Option.isNone(fiscalYearOpt)) {
          return yield* Effect.fail(
            new YearAlreadyClosedError({ fiscalYearId, year: 0 })
          )
        }

        const fiscalYear = fiscalYearOpt.value

        // Check if already closed
        if (fiscalYear.status === "Closed") {
          return yield* Effect.fail(
            new YearAlreadyClosedError({ fiscalYearId, year: fiscalYear.year })
          )
        }

        // Check retained earnings is configured
        const retainedEarningsOpt = yield* getRetainedEarnings(organizationId, companyId)
        if (Option.isNone(retainedEarningsOpt)) {
          return yield* Effect.fail(
            new RetainedEarningsNotConfiguredError({ companyId })
          )
        }
        const retainedEarningsAccount = retainedEarningsOpt.value

        // Get the actual retained earnings account to get its ID
        const maybeCompany = yield* companyRepo.findById(organizationId, companyId)
        const retainedEarningsAccountId = Option.flatMap(maybeCompany, c => c.retainedEarningsAccountId)
        if (Option.isNone(retainedEarningsAccountId)) {
          return yield* Effect.fail(
            new RetainedEarningsNotConfiguredError({ companyId })
          )
        }

        // Get currency
        const currency = yield* getCompanyCurrency(organizationId, companyId)

        // Get all accounts for the company to calculate individual balances
        const accounts = yield* accountRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)

        // Get all posted journal entries with lines
        const entries = yield* fetchJournalEntriesWithLines(organizationId, companyId)

        // Calculate individual account balances for income statement accounts
        const accountBalances = yield* calculateAccountBalances(accounts, entries, currency)

        // Filter for revenue and expense accounts with non-zero balances
        const revenueAccountBalances = accountBalances.filter(
          ab => ab.account.accountType === "Revenue" && !BigDecimal.isZero(ab.balance)
        )
        const expenseAccountBalances = accountBalances.filter(
          ab => ab.account.accountType === "Expense" && !BigDecimal.isZero(ab.balance)
        )

        // Calculate totals
        const totalRevenue = revenueAccountBalances.reduce(
          (sum, ab) => BigDecimal.sum(sum, ab.balance),
          BigDecimal.fromBigInt(0n)
        )
        const totalExpenses = expenseAccountBalances.reduce(
          (sum, ab) => BigDecimal.sum(sum, ab.balance),
          BigDecimal.fromBigInt(0n)
        )
        const netIncomeAmount = BigDecimal.subtract(totalRevenue, totalExpenses)
        const netIncome = MonetaryAmount.fromBigDecimal(netIncomeAmount, currency)

        // Create system user ID for closing entries
        const systemUserId = UserId.make("00000000-0000-0000-0000-000000000000")
        const now = timestampNow()

        // Create fiscal period reference for period 13 (adjustment period)
        const closingPeriod = FiscalPeriodRef.make({ year: fiscalYear.year, period: 13 })

        const closingEntryIds: JournalEntryId[] = []

        // Entry 1: Close Revenue Accounts (DR Revenue, CR Retained Earnings)
        // Only create if there are revenue accounts with balances
        if (revenueAccountBalances.length > 0) {
          const revenueEntryId = JournalEntryId.make(crypto.randomUUID())

          const revenueEntry = JournalEntry.make({
            id: revenueEntryId,
            companyId,
            entryNumber: Option.none(), // Will be assigned when posting
            referenceNumber: Option.none(),
            description: `Year-end closing entry - Close Revenue - FY ${fiscalYear.year}`,
            transactionDate: fiscalYear.endDate,
            postingDate: Option.some(fiscalYear.endDate),
            documentDate: Option.none(),
            fiscalPeriod: closingPeriod,
            entryType: "Closing",
            sourceModule: "GeneralLedger",
            sourceDocumentRef: Option.some(`year-end-close:${fiscalYearId}`),
            isMultiCurrency: false,
            status: "Posted", // Closing entries are immediately posted
            isReversing: false,
            reversedEntryId: Option.none(),
            reversingEntryId: Option.none(),
            createdBy: systemUserId,
            createdAt: now,
            postedBy: Option.some(systemUserId),
            postedAt: Option.some(now)
          })

          // Create lines: Debit each revenue account, Credit retained earnings
          const revenueLines: JournalEntryLine[] = []
          let lineNumber = 1

          // Debit each revenue account (to zero out credit balances)
          for (const { account, balance } of revenueAccountBalances) {
            const amount = MonetaryAmount.fromBigDecimal(BigDecimal.abs(balance), currency)
            revenueLines.push(
              JournalEntryLine.make({
                id: JournalEntryLineId.make(crypto.randomUUID()),
                journalEntryId: revenueEntryId,
                lineNumber: lineNumber++,
                accountId: account.id,
                debitAmount: Option.some(amount),
                creditAmount: Option.none(),
                functionalCurrencyDebitAmount: Option.some(amount),
                functionalCurrencyCreditAmount: Option.none(),
                exchangeRate: BigDecimal.fromBigInt(1n),
                memo: Option.some(`Close ${account.name}`),
                dimensions: Option.none(),
                intercompanyPartnerId: Option.none(),
                matchingLineId: Option.none()
              })
            )
          }

          // Credit retained earnings for total revenue
          const totalRevenueAmount = MonetaryAmount.fromBigDecimal(BigDecimal.abs(totalRevenue), currency)
          revenueLines.push(
            JournalEntryLine.make({
              id: JournalEntryLineId.make(crypto.randomUUID()),
              journalEntryId: revenueEntryId,
              lineNumber,
              accountId: retainedEarningsAccountId.value,
              debitAmount: Option.none(),
              creditAmount: Option.some(totalRevenueAmount),
              functionalCurrencyDebitAmount: Option.none(),
              functionalCurrencyCreditAmount: Option.some(totalRevenueAmount),
              exchangeRate: BigDecimal.fromBigInt(1n),
              memo: Option.some(`Transfer revenue to ${retainedEarningsAccount.name}`),
              dimensions: Option.none(),
              intercompanyPartnerId: Option.none(),
              matchingLineId: Option.none()
            })
          )

          // Persist the revenue closing entry
          yield* journalEntryRepo.create(revenueEntry)
          yield* journalEntryLineRepo.createMany(revenueLines)
          closingEntryIds.push(revenueEntryId)
        }

        // Entry 2: Close Expense Accounts (DR Retained Earnings, CR Expenses)
        // Only create if there are expense accounts with balances
        if (expenseAccountBalances.length > 0) {
          const expenseEntryId = JournalEntryId.make(crypto.randomUUID())

          const expenseEntry = JournalEntry.make({
            id: expenseEntryId,
            companyId,
            entryNumber: Option.none(), // Will be assigned when posting
            referenceNumber: Option.none(),
            description: `Year-end closing entry - Close Expenses - FY ${fiscalYear.year}`,
            transactionDate: fiscalYear.endDate,
            postingDate: Option.some(fiscalYear.endDate),
            documentDate: Option.none(),
            fiscalPeriod: closingPeriod,
            entryType: "Closing",
            sourceModule: "GeneralLedger",
            sourceDocumentRef: Option.some(`year-end-close:${fiscalYearId}`),
            isMultiCurrency: false,
            status: "Posted", // Closing entries are immediately posted
            isReversing: false,
            reversedEntryId: Option.none(),
            reversingEntryId: Option.none(),
            createdBy: systemUserId,
            createdAt: now,
            postedBy: Option.some(systemUserId),
            postedAt: Option.some(now)
          })

          // Create lines: Debit retained earnings, Credit each expense account
          const expenseLines: JournalEntryLine[] = []
          let lineNumber = 1

          // Debit retained earnings for total expenses
          const totalExpensesAmount = MonetaryAmount.fromBigDecimal(BigDecimal.abs(totalExpenses), currency)
          expenseLines.push(
            JournalEntryLine.make({
              id: JournalEntryLineId.make(crypto.randomUUID()),
              journalEntryId: expenseEntryId,
              lineNumber: lineNumber++,
              accountId: retainedEarningsAccountId.value,
              debitAmount: Option.some(totalExpensesAmount),
              creditAmount: Option.none(),
              functionalCurrencyDebitAmount: Option.some(totalExpensesAmount),
              functionalCurrencyCreditAmount: Option.none(),
              exchangeRate: BigDecimal.fromBigInt(1n),
              memo: Option.some(`Transfer expenses from ${retainedEarningsAccount.name}`),
              dimensions: Option.none(),
              intercompanyPartnerId: Option.none(),
              matchingLineId: Option.none()
            })
          )

          // Credit each expense account (to zero out debit balances)
          for (const { account, balance } of expenseAccountBalances) {
            const amount = MonetaryAmount.fromBigDecimal(BigDecimal.abs(balance), currency)
            expenseLines.push(
              JournalEntryLine.make({
                id: JournalEntryLineId.make(crypto.randomUUID()),
                journalEntryId: expenseEntryId,
                lineNumber: lineNumber++,
                accountId: account.id,
                debitAmount: Option.none(),
                creditAmount: Option.some(amount),
                functionalCurrencyDebitAmount: Option.none(),
                functionalCurrencyCreditAmount: Option.some(amount),
                exchangeRate: BigDecimal.fromBigInt(1n),
                memo: Option.some(`Close ${account.name}`),
                dimensions: Option.none(),
                intercompanyPartnerId: Option.none(),
                matchingLineId: Option.none()
              })
            )
          }

          // Persist the expense closing entry
          yield* journalEntryRepo.create(expenseEntry)
          yield* journalEntryLineRepo.createMany(expenseLines)
          closingEntryIds.push(expenseEntryId)
        }

        // Close the fiscal year using the existing service
        yield* fiscalPeriodService.closeFiscalYear(companyId, fiscalYearId)

        // Count periods that were closed
        const periods = yield* fiscalPeriodService.listPeriods(fiscalYearId)
        const periodsClosed = periods.filter((p) => p.status === "Closed").length

        return YearEndCloseResult.make({
          fiscalYearId,
          closingEntryIds,
          netIncome,
          periodsClosed
        })
      }).pipe(
        // Map the error types to match the expected interface
        Effect.mapError((error) => {
          // Convert FiscalYearNotFoundError or other errors to YearAlreadyClosedError
          // since the interface expects YearEndCloseExecuteError
          if (error._tag === "FiscalYearNotFoundError") {
            return new YearAlreadyClosedError({
              fiscalYearId,
              year: 0
            })
          }
          return error
        })
      ),

    reopenFiscalYear: (organizationId, companyId, fiscalYearId, _reason) =>
      Effect.gen(function* () {
        // Get fiscal year
        const fiscalYearOpt = yield* fiscalPeriodRepo.findFiscalYearById(companyId, fiscalYearId)
        if (Option.isNone(fiscalYearOpt)) {
          return yield* Effect.fail(
            new YearNotClosedError({ fiscalYearId, year: 0, currentStatus: "Not Found" })
          )
        }

        const fiscalYear = fiscalYearOpt.value

        // Check if not closed
        if (fiscalYear.status !== "Closed") {
          return yield* Effect.fail(
            new YearNotClosedError({
              fiscalYearId,
              year: fiscalYear.year,
              currentStatus: fiscalYear.status
            })
          )
        }

        // Find closing entries by sourceDocumentRef pattern
        // Closing entries have sourceDocumentRef = "year-end-close:{fiscalYearId}"
        const allEntries = yield* journalEntryRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)
        const closingEntries = allEntries.filter(e =>
          e.entryType === "Closing" &&
          e.status === "Posted" &&
          Option.isSome(e.sourceDocumentRef) &&
          e.sourceDocumentRef.value === `year-end-close:${fiscalYearId}`
        )

        // Note: If no closing entries found, we can still reopen the year
        // This happens when a year was closed with zero activity (no revenue/expense balances)

        // Create system user ID for reversing entries
        const systemUserId = UserId.make("00000000-0000-0000-0000-000000000000")
        const now = timestampNow()

        // Create fiscal period reference for period 13 (adjustment period)
        const reversalPeriod = FiscalPeriodRef.make({ year: fiscalYear.year, period: 13 })

        const reversedEntryIds: JournalEntryId[] = []

        // Create reversal entries for each closing entry
        for (const closingEntry of closingEntries) {
          const reversalEntryId = JournalEntryId.make(crypto.randomUUID())

          // Get the original lines
          const originalLines = yield* journalEntryLineRepo.findByJournalEntry(closingEntry.id).pipe(Effect.orDie)

          // Create reversal entry
          const reversalEntry = JournalEntry.make({
            id: reversalEntryId,
            companyId,
            entryNumber: Option.none(),
            referenceNumber: Option.none(),
            description: `Reversal of year-end closing entry - FY ${fiscalYear.year}`,
            transactionDate: fiscalYear.endDate,
            postingDate: Option.some(fiscalYear.endDate),
            documentDate: Option.none(),
            fiscalPeriod: reversalPeriod,
            entryType: "Reversing",
            sourceModule: "GeneralLedger",
            sourceDocumentRef: Option.some(`year-end-reopen:${fiscalYearId}`),
            isMultiCurrency: false,
            status: "Posted",
            isReversing: true,
            reversedEntryId: Option.some(closingEntry.id),
            reversingEntryId: Option.none(),
            createdBy: systemUserId,
            createdAt: now,
            postedBy: Option.some(systemUserId),
            postedAt: Option.some(now)
          })

          // Create reversed lines (swap debit/credit)
          const reversalLines: JournalEntryLine[] = originalLines.map((line, index) => {
            // Swap debit and credit amounts
            const debitAmount = line.creditAmount
            const creditAmount = line.debitAmount
            const functionalDebitAmount = line.functionalCurrencyCreditAmount
            const functionalCreditAmount = line.functionalCurrencyDebitAmount

            return JournalEntryLine.make({
              id: JournalEntryLineId.make(crypto.randomUUID()),
              journalEntryId: reversalEntryId,
              lineNumber: index + 1,
              accountId: line.accountId,
              debitAmount,
              creditAmount,
              functionalCurrencyDebitAmount: functionalDebitAmount,
              functionalCurrencyCreditAmount: functionalCreditAmount,
              exchangeRate: line.exchangeRate,
              memo: Option.some(`Reversal: ${Option.getOrElse(line.memo, () => "")}`),
              dimensions: line.dimensions,
              intercompanyPartnerId: line.intercompanyPartnerId,
              matchingLineId: Option.none()
            })
          })

          // Persist the reversal entry and its lines
          yield* journalEntryRepo.create(reversalEntry)
          yield* journalEntryLineRepo.createMany(reversalLines)

          // Update the original closing entry to mark it as reversed
          const updatedClosingEntry = JournalEntry.make({
            ...closingEntry,
            status: "Reversed",
            reversingEntryId: Option.some(reversalEntryId)
          })
          yield* journalEntryRepo.update(organizationId, updatedClosingEntry)

          reversedEntryIds.push(reversalEntryId)
        }

        // Reopen the fiscal year
        yield* fiscalPeriodService.reopenFiscalYear(companyId, fiscalYearId)

        // Count periods that were reopened
        const periods = yield* fiscalPeriodService.listPeriods(fiscalYearId)
        const periodsReopened = periods.filter((p) => p.status === "Open").length

        return ReopenYearResult.make({
          fiscalYearId,
          reversedEntryIds,
          periodsReopened
        })
      }).pipe(
        // Map the error types to match the expected interface
        Effect.mapError((error) => {
          if (error._tag === "FiscalYearNotFoundError") {
            return new YearNotClosedError({
              fiscalYearId,
              year: 0,
              currentStatus: "Not Found"
            })
          }
          return error
        })
      ),

    getRetainedEarningsAccount: (organizationId, companyId) =>
      getRetainedEarnings(organizationId, companyId)
  }

  return service
})

/**
 * YearEndCloseServiceLive - Layer providing YearEndCloseService implementation
 *
 * Requires:
 * - FiscalPeriodService
 * - FiscalPeriodRepository
 * - AccountRepository
 * - CompanyRepository
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 */
export const YearEndCloseServiceLive = Layer.effect(YearEndCloseService, make)
