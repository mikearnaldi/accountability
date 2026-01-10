import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, Exit, Layer, Option } from "effect"
import {
  JournalEntryService,
  JournalEntryServiceLive,
  AccountRepository,
  PeriodRepository,
  EntryNumberGenerator,
  AccountNotFoundError,
  AccountNotPostableError,
  AccountNotActiveError,
  PeriodNotOpenError,
  PeriodNotFoundError,
  EmptyJournalEntryError,
  DuplicateLineNumberError,
  isAccountNotFoundError,
  isAccountNotPostableError,
  isAccountNotActiveError,
  isPeriodNotOpenError,
  isPeriodNotFoundError,
  isEmptyJournalEntryError,
  isDuplicateLineNumberError,
  type FiscalPeriodInfo,
  type CreateJournalEntryInput,
  type AccountRepositoryService,
  type PeriodRepositoryService,
  type EntryNumberGeneratorService
} from "../src/JournalEntryService.js"
import { JournalEntry, JournalEntryId, UserId } from "../src/JournalEntry.js"
import { JournalEntryLine, JournalEntryLineId } from "../src/JournalEntryLine.js"
import { Account, AccountId, type AccountType, type AccountCategory, type NormalBalance } from "../src/Account.js"
import { CompanyId } from "../src/Company.js"
import { CurrencyCode } from "../src/CurrencyCode.js"
import { FiscalPeriodRef } from "../src/FiscalPeriodRef.js"
import { LocalDate } from "../src/LocalDate.js"
import { Timestamp } from "../src/Timestamp.js"
import { AccountNumber } from "../src/AccountNumber.js"
import { MonetaryAmount } from "../src/MonetaryAmount.js"
import { isUnbalancedEntryError } from "../src/BalanceValidation.js"

describe("JournalEntryService", () => {
  // Test data constants
  const companyUUID = "550e8400-e29b-41d4-a716-446655440000"
  const journalEntryUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const lineUUID1 = "7ba7b810-9dad-11d1-80b4-00c04fd430c8"
  const lineUUID2 = "8ba7b810-9dad-11d1-80b4-00c04fd430c9"
  const lineUUID3 = "9ba7b810-9dad-11d1-80b4-00c04fd430ca"
  const accountUUID1 = "a0a7b810-9dad-11d1-80b4-00c04fd430c8"
  const accountUUID2 = "b0a7b810-9dad-11d1-80b4-00c04fd430c9"
  const accountUUID3 = "c0a7b810-9dad-11d1-80b4-00c04fd430ca"
  const userUUID = "d0a7b810-9dad-11d1-80b4-00c04fd430cb"

  const companyId = CompanyId.make(companyUUID)
  const usdCurrency = CurrencyCode.make("USD")
  const fiscalPeriod = FiscalPeriodRef.make({ year: 2025, period: 1 })

  // Helper to create test accounts
  const createAccount = (
    id: string,
    name: string,
    accountNumber: string,
    isPostable: boolean = true,
    isActive: boolean = true,
    accountType: AccountType = "Asset",
    accountCategory: AccountCategory = "CurrentAsset",
    normalBalance: NormalBalance = "Debit"
  ): Account => {
    return Account.make({
      id: AccountId.make(id),
      companyId,
      accountNumber: AccountNumber.make(accountNumber),
      name,
      description: Option.none(),
      accountType,
      accountCategory,
      normalBalance,
      parentAccountId: Option.none(),
      hierarchyLevel: 1,
      isPostable,
      isCashFlowRelevant: true,
      cashFlowCategory: Option.some("Operating" as const),
      isIntercompany: false,
      intercompanyPartnerId: Option.none(),
      currencyRestriction: Option.none(),
      isActive,
      createdAt: Timestamp.make({ epochMillis: Date.now() }),
      deactivatedAt: Option.none()
    })
  }

  // Helper to create test journal entry
  const createJournalEntry = (id: string = journalEntryUUID): JournalEntry => {
    return JournalEntry.make({
      id: JournalEntryId.make(id),
      companyId,
      entryNumber: Option.none(),
      referenceNumber: Option.none(),
      description: "Test journal entry",
      transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
      postingDate: Option.none(),
      documentDate: Option.none(),
      fiscalPeriod,
      entryType: "Standard",
      sourceModule: "GeneralLedger",
      sourceDocumentRef: Option.none(),
      isMultiCurrency: false,
      status: "Draft",
      isReversing: false,
      reversedEntryId: Option.none(),
      reversingEntryId: Option.none(),
      createdBy: UserId.make(userUUID),
      createdAt: Timestamp.make({ epochMillis: Date.now() }),
      postedBy: Option.none(),
      postedAt: Option.none()
    })
  }

  // Helper to create test journal entry line
  const createDebitLine = (
    id: string,
    lineNumber: number,
    accountId: string,
    amount: string,
    journalEntryId: string = journalEntryUUID
  ): JournalEntryLine => {
    const debitAmount = MonetaryAmount.unsafeFromString(amount, "USD")
    return JournalEntryLine.make({
      id: JournalEntryLineId.make(id),
      journalEntryId: JournalEntryId.make(journalEntryId),
      lineNumber,
      accountId: AccountId.make(accountId),
      debitAmount: Option.some(debitAmount),
      creditAmount: Option.none(),
      functionalCurrencyDebitAmount: Option.some(debitAmount),
      functionalCurrencyCreditAmount: Option.none(),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.none(),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  const createCreditLine = (
    id: string,
    lineNumber: number,
    accountId: string,
    amount: string,
    journalEntryId: string = journalEntryUUID
  ): JournalEntryLine => {
    const creditAmount = MonetaryAmount.unsafeFromString(amount, "USD")
    return JournalEntryLine.make({
      id: JournalEntryLineId.make(id),
      journalEntryId: JournalEntryId.make(journalEntryId),
      lineNumber,
      accountId: AccountId.make(accountId),
      debitAmount: Option.none(),
      creditAmount: Option.some(creditAmount),
      functionalCurrencyDebitAmount: Option.none(),
      functionalCurrencyCreditAmount: Option.some(creditAmount),
      exchangeRate: BigDecimal.fromBigInt(1n),
      memo: Option.none(),
      dimensions: Option.none(),
      intercompanyPartnerId: Option.none(),
      matchingLineId: Option.none()
    })
  }

  // Mock repositories
  const createMockAccountRepository = (
    accounts: ReadonlyArray<Account>
  ): AccountRepositoryService => {
    const accountMap = new Map(accounts.map((a) => [a.id, a]))
    return {
      findById: (accountId) =>
        Effect.succeed(Option.fromNullable(accountMap.get(accountId))),
      findByIds: (accountIds) => {
        const result = new Map<AccountId, Account>()
        for (const id of accountIds) {
          const account = accountMap.get(id)
          if (account) {
            result.set(id, account)
          }
        }
        return Effect.succeed(result)
      }
    }
  }

  const createMockPeriodRepository = (
    openPeriods: ReadonlyArray<{ year: number; period: number; status: FiscalPeriodInfo["status"] }>
  ): PeriodRepositoryService => {
    const periodMap = new Map(
      openPeriods.map((p) => [`${p.year}-${p.period}`, p])
    )
    return {
      getPeriodStatus: (_companyId, fiscalPeriod) => {
        const key = `${fiscalPeriod.year}-${fiscalPeriod.period}`
        const periodInfo = periodMap.get(key)
        if (periodInfo) {
          return Effect.succeed(Option.some({
            year: periodInfo.year,
            period: periodInfo.period,
            status: periodInfo.status
          }))
        }
        return Effect.succeed(Option.none())
      },
      isPeriodOpen: (_companyId, fiscalPeriod) => {
        const key = `${fiscalPeriod.year}-${fiscalPeriod.period}`
        const periodInfo = periodMap.get(key)
        return Effect.succeed(periodInfo?.status === "Open")
      }
    }
  }

  const createMockEntryNumberGenerator = (): EntryNumberGeneratorService => {
    let counter = 0
    return {
      nextEntryNumber: (_companyId, fiscalYear) => {
        counter++
        const paddedCounter = String(counter).padStart(5, "0")
        return Effect.succeed(`JE-${fiscalYear}-${paddedCounter}`)
      }
    }
  }

  // Create test layer with mock dependencies
  const createTestLayer = (
    accounts: ReadonlyArray<Account>,
    periods: ReadonlyArray<{ year: number; period: number; status: FiscalPeriodInfo["status"] }>
  ) => {
    const accountRepoLayer = Layer.succeed(
      AccountRepository,
      createMockAccountRepository(accounts)
    )
    const periodRepoLayer = Layer.succeed(
      PeriodRepository,
      createMockPeriodRepository(periods)
    )
    const entryNumberGenLayer = Layer.succeed(
      EntryNumberGenerator,
      createMockEntryNumberGenerator()
    )

    return JournalEntryServiceLive.pipe(
      Layer.provide(accountRepoLayer),
      Layer.provide(periodRepoLayer),
      Layer.provide(entryNumberGenLayer)
    )
  }

  describe("create", () => {
    describe("successful creation", () => {
      it.effect("creates a balanced journal entry with valid accounts and open period", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* service.create(input)

          expect(Option.isSome(result.entryNumber)).toBe(true)
          if (Option.isSome(result.entryNumber)) {
            expect(result.entryNumber.value).toBe("JE-2025-00001")
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Sales Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("creates entry with multiple debit and credit lines", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine1 = createDebitLine(lineUUID1, 1, accountUUID1, "600.00")
          const debitLine2 = createDebitLine(lineUUID2, 2, accountUUID2, "400.00")
          const creditLine = createCreditLine(lineUUID3, 3, accountUUID3, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine1, debitLine2, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* service.create(input)

          expect(Option.isSome(result.entryNumber)).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Accounts Receivable", "1100"),
                createAccount(accountUUID3, "Sales Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("assigns sequential entry numbers", () =>
        Effect.gen(function* () {
          const service = yield* JournalEntryService

          // First entry
          const entry1 = createJournalEntry("6ba7b810-9dad-11d1-80b4-00c04fd43001")
          const result1 = yield* service.create({
            entry: entry1,
            lines: [
              createDebitLine(lineUUID1, 1, accountUUID1, "100.00", "6ba7b810-9dad-11d1-80b4-00c04fd43001"),
              createCreditLine(lineUUID2, 2, accountUUID2, "100.00", "6ba7b810-9dad-11d1-80b4-00c04fd43001")
            ],
            functionalCurrency: usdCurrency
          })

          // Second entry
          const entry2 = createJournalEntry("6ba7b810-9dad-11d1-80b4-00c04fd43002")
          const result2 = yield* service.create({
            entry: entry2,
            lines: [
              createDebitLine("7ba7b810-9dad-11d1-80b4-00c04fd43003", 1, accountUUID1, "200.00", "6ba7b810-9dad-11d1-80b4-00c04fd43002"),
              createCreditLine("7ba7b810-9dad-11d1-80b4-00c04fd43004", 2, accountUUID2, "200.00", "6ba7b810-9dad-11d1-80b4-00c04fd43002")
            ],
            functionalCurrency: usdCurrency
          })

          expect(Option.isSome(result1.entryNumber)).toBe(true)
          expect(Option.isSome(result2.entryNumber)).toBe(true)

          if (Option.isSome(result1.entryNumber) && Option.isSome(result2.entryNumber)) {
            expect(result1.entryNumber.value).toBe("JE-2025-00001")
            expect(result2.entryNumber.value).toBe("JE-2025-00002")
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )
    })

    describe("validation errors", () => {
      it.effect("fails with EmptyJournalEntryError when no lines provided", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const input: CreateJournalEntryInput = {
            entry,
            lines: [],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isEmptyJournalEntryError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer([], [{ year: 2025, period: 1, status: "Open" }])
          )
        )
      )

      it.effect("fails with DuplicateLineNumberError when line numbers are not unique", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 1, accountUUID2, "1000.00") // Duplicate line number

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isDuplicateLineNumberError(result.cause.error)).toBe(true)
            if (isDuplicateLineNumberError(result.cause.error)) {
              expect(result.cause.error.lineNumber).toBe(1)
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("fails with AccountNotFoundError when account does not exist", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          // Only provide one account
          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isAccountNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [createAccount(accountUUID1, "Cash", "1000")], // Missing account 2
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("fails with AccountNotPostableError when account is not postable", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isAccountNotPostableError(result.cause.error)).toBe(true)
            if (isAccountNotPostableError(result.cause.error)) {
              expect(result.cause.error.accountName).toBe("Summary Account")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Summary Account", "4000", false)
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("fails with AccountNotActiveError when account is not active", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isAccountNotActiveError(result.cause.error)).toBe(true)
            if (isAccountNotActiveError(result.cause.error)) {
              expect(result.cause.error.accountName).toBe("Inactive Account")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Inactive Account", "4000", true, false)
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("fails with UnbalancedEntryError when debits do not equal credits", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "900.00") // Unbalanced

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isUnbalancedEntryError(result.cause.error)).toBe(true)
            if (isUnbalancedEntryError(result.cause.error)) {
              expect(BigDecimal.equals(
                result.cause.error.totalDebits.amount,
                BigDecimal.unsafeFromString("1000")
              )).toBe(true)
              expect(BigDecimal.equals(
                result.cause.error.totalCredits.amount,
                BigDecimal.unsafeFromString("900")
              )).toBe(true)
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("fails with PeriodNotFoundError when fiscal period does not exist", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isPeriodNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [] // No periods defined
            )
          )
        )
      )

      it.effect("fails with PeriodNotOpenError when fiscal period is closed", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isPeriodNotOpenError(result.cause.error)).toBe(true)
            if (isPeriodNotOpenError(result.cause.error)) {
              expect(result.cause.error.status).toBe("Closed")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Closed" }]
            )
          )
        )
      )

      it.effect("fails with PeriodNotOpenError when fiscal period is locked", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isPeriodNotOpenError(result.cause.error)).toBe(true)
            if (isPeriodNotOpenError(result.cause.error)) {
              expect(result.cause.error.status).toBe("Locked")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Locked" }]
            )
          )
        )
      )

      it.effect("fails with PeriodNotOpenError when fiscal period has soft close status", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isPeriodNotOpenError(result.cause.error)).toBe(true)
            if (isPeriodNotOpenError(result.cause.error)) {
              expect(result.cause.error.status).toBe("SoftClose")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "SoftClose" }]
            )
          )
        )
      )

      it.effect("fails with PeriodNotOpenError when fiscal period is in future", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isPeriodNotOpenError(result.cause.error)).toBe(true)
            if (isPeriodNotOpenError(result.cause.error)) {
              expect(result.cause.error.status).toBe("Future")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Future" }]
            )
          )
        )
      )
    })

    describe("edge cases", () => {
      it.effect("handles single line with zero amounts as unbalanced", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "100.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isUnbalancedEntryError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [createAccount(accountUUID1, "Cash", "1000")],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("handles high precision amounts correctly", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.123456")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.123456")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* service.create(input)

          expect(Option.isSome(result.entryNumber)).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer(
              [
                createAccount(accountUUID1, "Cash", "1000"),
                createAccount(accountUUID2, "Revenue", "4000", true, true, "Revenue", "OperatingRevenue", "Credit")
              ],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("validates accounts before balance check", () =>
        Effect.gen(function* () {
          // If an account doesn't exist, we should get AccountNotFoundError
          // even if the entry would be unbalanced
          const entry = createJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "900.00") // Also unbalanced

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.create(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            // Should fail with account error first, not balance error
            expect(isAccountNotFoundError(result.cause.error)).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [], // No accounts
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )

      it.effect("can use same account for both debit and credit", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry()
          // Same account for debit and credit (e.g., reclassification within same account)
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "500.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID1, "500.00")

          const input: CreateJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            functionalCurrency: usdCurrency
          }

          const service = yield* JournalEntryService
          const result = yield* service.create(input)

          expect(Option.isSome(result.entryNumber)).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer(
              [createAccount(accountUUID1, "Cash", "1000")],
              [{ year: 2025, period: 1, status: "Open" }]
            )
          )
        )
      )
    })
  })

  describe("error type guards", () => {
    it("isAccountNotFoundError returns true for AccountNotFoundError", () => {
      const error = new AccountNotFoundError({
        accountId: AccountId.make(accountUUID1)
      })
      expect(isAccountNotFoundError(error)).toBe(true)
      expect(error._tag).toBe("AccountNotFoundError")
    })

    it("isAccountNotPostableError returns true for AccountNotPostableError", () => {
      const error = new AccountNotPostableError({
        accountId: AccountId.make(accountUUID1),
        accountName: "Test Account"
      })
      expect(isAccountNotPostableError(error)).toBe(true)
      expect(error._tag).toBe("AccountNotPostableError")
    })

    it("isAccountNotActiveError returns true for AccountNotActiveError", () => {
      const error = new AccountNotActiveError({
        accountId: AccountId.make(accountUUID1),
        accountName: "Test Account"
      })
      expect(isAccountNotActiveError(error)).toBe(true)
      expect(error._tag).toBe("AccountNotActiveError")
    })

    it("isPeriodNotOpenError returns true for PeriodNotOpenError", () => {
      const error = new PeriodNotOpenError({
        fiscalPeriod: { year: 2025, period: 1 },
        status: "Closed"
      })
      expect(isPeriodNotOpenError(error)).toBe(true)
      expect(error._tag).toBe("PeriodNotOpenError")
    })

    it("isPeriodNotFoundError returns true for PeriodNotFoundError", () => {
      const error = new PeriodNotFoundError({
        fiscalPeriod: { year: 2025, period: 1 },
        companyId: CompanyId.make(companyUUID)
      })
      expect(isPeriodNotFoundError(error)).toBe(true)
      expect(error._tag).toBe("PeriodNotFoundError")
    })

    it("isEmptyJournalEntryError returns true for EmptyJournalEntryError", () => {
      const error = new EmptyJournalEntryError()
      expect(isEmptyJournalEntryError(error)).toBe(true)
      expect(error._tag).toBe("EmptyJournalEntryError")
    })

    it("isDuplicateLineNumberError returns true for DuplicateLineNumberError", () => {
      const error = new DuplicateLineNumberError({ lineNumber: 1 })
      expect(isDuplicateLineNumberError(error)).toBe(true)
      expect(error._tag).toBe("DuplicateLineNumberError")
    })

    it("type guards return false for other values", () => {
      expect(isAccountNotFoundError(null)).toBe(false)
      expect(isAccountNotFoundError(undefined)).toBe(false)
      expect(isAccountNotFoundError(new Error("test"))).toBe(false)
      expect(isAccountNotFoundError({ _tag: "AccountNotFoundError" })).toBe(false)
    })
  })

  describe("error messages", () => {
    it("AccountNotFoundError has correct message", () => {
      const error = new AccountNotFoundError({
        accountId: AccountId.make(accountUUID1)
      })
      expect(error.message).toContain("Account not found")
      expect(error.message).toContain(accountUUID1)
    })

    it("AccountNotPostableError has correct message", () => {
      const error = new AccountNotPostableError({
        accountId: AccountId.make(accountUUID1),
        accountName: "Summary Account"
      })
      expect(error.message).toContain("Summary Account")
      expect(error.message).toContain("not postable")
    })

    it("AccountNotActiveError has correct message", () => {
      const error = new AccountNotActiveError({
        accountId: AccountId.make(accountUUID1),
        accountName: "Inactive Account"
      })
      expect(error.message).toContain("Inactive Account")
      expect(error.message).toContain("not active")
    })

    it("PeriodNotOpenError has correct message", () => {
      const error = new PeriodNotOpenError({
        fiscalPeriod: { year: 2025, period: 1 },
        status: "Closed"
      })
      expect(error.message).toContain("FY2025-P01")
      expect(error.message).toContain("not open")
      expect(error.message).toContain("Closed")
    })

    it("PeriodNotFoundError has correct message", () => {
      const error = new PeriodNotFoundError({
        fiscalPeriod: { year: 2025, period: 1 },
        companyId: CompanyId.make(companyUUID)
      })
      expect(error.message).toContain("FY2025-P01")
      expect(error.message).toContain("not found")
    })

    it("EmptyJournalEntryError has correct message", () => {
      const error = new EmptyJournalEntryError()
      expect(error.message).toContain("at least one line")
    })

    it("DuplicateLineNumberError has correct message", () => {
      const error = new DuplicateLineNumberError({ lineNumber: 5 })
      expect(error.message).toContain("Duplicate line number")
      expect(error.message).toContain("5")
    })
  })
})
