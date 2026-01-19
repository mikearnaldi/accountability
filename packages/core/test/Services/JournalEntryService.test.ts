import { describe, it, expect } from "@effect/vitest"
import { BigDecimal, Effect, Exit, Layer, Option } from "effect"
import {
  JournalEntryService,
  JournalEntryServiceLive,
  AccountRepository,
  EntryNumberGenerator,
  AccountNotFoundError,
  AccountNotPostableError,
  AccountNotActiveError,
  EmptyJournalEntryError,
  DuplicateLineNumberError,
  NotApprovedError,
  EntryNotPostedError,
  EntryAlreadyReversedError,
  isAccountNotFoundError,
  isAccountNotPostableError,
  isAccountNotActiveError,
  isEmptyJournalEntryError,
  isDuplicateLineNumberError,
  isNotApprovedError,
  isEntryNotPostedError,
  isEntryAlreadyReversedError,
  type CreateJournalEntryInput,
  type PostJournalEntryInput,
  type ReverseJournalEntryInput,
  type AccountRepositoryService,
  type EntryNumberGeneratorService
} from "../../src/journal/JournalEntryService.ts"
import { JournalEntry, JournalEntryId, UserId, EntryNumber } from "../../src/journal/JournalEntry.ts"
import { JournalEntryLine, JournalEntryLineId } from "../../src/journal/JournalEntryLine.ts"
import { Account, AccountId, type AccountType, type AccountCategory, type NormalBalance } from "../../src/accounting/Account.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"
import { AccountNumber } from "../../src/accounting/AccountNumber.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { isUnbalancedEntryError } from "../../src/accounting/BalanceValidation.ts"

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
  const createTestLayer = (accounts: ReadonlyArray<Account>) => {
    const accountRepoLayer = Layer.succeed(
      AccountRepository,
      createMockAccountRepository(accounts)
    )
    const entryNumberGenLayer = Layer.succeed(
      EntryNumberGenerator,
      createMockEntryNumberGenerator()
    )

    return JournalEntryServiceLive.pipe(
      Layer.provide(accountRepoLayer),
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
              ])
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
              ])
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
              ])
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
            createTestLayer([])
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
              ])
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
              ])
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
              ])
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
              ])
          )
        )
      )

      // NOTE: Period validation tests removed. Fiscal periods are now computed from
      // transaction dates at runtime rather than validated against stored periods.
      // This simplifies the system by eliminating period management workflows.
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
              [createAccount(accountUUID1, "Cash", "1000")])
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
              ])
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
              [createAccount(accountUUID1, "Cash", "1000")])
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

    it("EmptyJournalEntryError has correct message", () => {
      const error = new EmptyJournalEntryError()
      expect(error.message).toContain("at least one line")
    })

    it("DuplicateLineNumberError has correct message", () => {
      const error = new DuplicateLineNumberError({ lineNumber: 5 })
      expect(error.message).toContain("Duplicate line number")
      expect(error.message).toContain("5")
    })

    it("NotApprovedError has correct message", () => {
      const error = new NotApprovedError({
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        currentStatus: "Draft"
      })
      expect(error.message).toContain(journalEntryUUID)
      expect(error.message).toContain("Draft")
      expect(error.message).toContain("must be 'Approved'")
    })
  })

  describe("post", () => {
    // Helper to create an approved journal entry
    const createApprovedJournalEntry = (id: string = journalEntryUUID): JournalEntry => {
      return JournalEntry.make({
        id: JournalEntryId.make(id),
        companyId,
        entryNumber: Option.some(EntryNumber.make("JE-2025-00001")),
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
        status: "Approved",
        isReversing: false,
        reversedEntryId: Option.none(),
        reversingEntryId: Option.none(),
        createdBy: UserId.make(userUUID),
        createdAt: Timestamp.make({ epochMillis: Date.now() }),
        postedBy: Option.none(),
        postedAt: Option.none()
      })
    }

    describe("successful posting", () => {
      it.effect("posts an approved journal entry successfully", () =>
        Effect.gen(function* () {
          const entry = createApprovedJournalEntry()
          const postingUser = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: PostJournalEntryInput = {
            entry,
            postedBy: postingUser
          }

          const service = yield* JournalEntryService
          const result = yield* service.post(input)

          expect(result.status).toBe("Posted")
          expect(Option.isSome(result.postedBy)).toBe(true)
          expect(Option.isSome(result.postedAt)).toBe(true)
          expect(Option.isSome(result.postingDate)).toBe(true)

          if (Option.isSome(result.postedBy)) {
            expect(result.postedBy.value).toBe(postingUser)
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [])
          )
        )
      )

      it.effect("preserves original entry data when posting", () =>
        Effect.gen(function* () {
          const entry = createApprovedJournalEntry()
          const postingUser = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: PostJournalEntryInput = {
            entry,
            postedBy: postingUser
          }

          const service = yield* JournalEntryService
          const result = yield* service.post(input)

          // Verify original data is preserved
          expect(result.id).toBe(entry.id)
          expect(result.companyId).toBe(entry.companyId)
          expect(result.description).toBe(entry.description)
          expect(result.entryType).toBe(entry.entryType)
          expect(result.sourceModule).toBe(entry.sourceModule)
          expect(Option.isSome(result.entryNumber)).toBe(true)
          if (Option.isSome(result.entryNumber) && Option.isSome(entry.entryNumber)) {
            expect(result.entryNumber.value).toBe(entry.entryNumber.value)
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [])
          )
        )
      )
    })

    describe("validation errors", () => {
      it.effect("fails with NotApprovedError when entry is in Draft status", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry() // Draft status
          const postingUser = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: PostJournalEntryInput = {
            entry,
            postedBy: postingUser
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.post(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isNotApprovedError(result.cause.error)).toBe(true)
            if (isNotApprovedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("Draft")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [])
          )
        )
      )

      it.effect("fails with NotApprovedError when entry is in PendingApproval status", () =>
        Effect.gen(function* () {
          const entry = JournalEntry.make({
            ...createJournalEntry(),
            status: "PendingApproval"
          })
          const postingUser = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: PostJournalEntryInput = {
            entry,
            postedBy: postingUser
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.post(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isNotApprovedError(result.cause.error)).toBe(true)
            if (isNotApprovedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("PendingApproval")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [])
          )
        )
      )

      it.effect("fails with NotApprovedError when entry is already Posted", () =>
        Effect.gen(function* () {
          const entry = JournalEntry.make({
            ...createApprovedJournalEntry(),
            status: "Posted",
            postedBy: Option.some(UserId.make(userUUID)),
            postedAt: Option.some(Timestamp.make({ epochMillis: Date.now() })),
            postingDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 15 }))
          })
          const postingUser = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: PostJournalEntryInput = {
            entry,
            postedBy: postingUser
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.post(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isNotApprovedError(result.cause.error)).toBe(true)
            if (isNotApprovedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("Posted")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [])
          )
        )
      )

      it.effect("fails with NotApprovedError when entry is Reversed", () =>
        Effect.gen(function* () {
          const entry = JournalEntry.make({
            ...createApprovedJournalEntry(),
            status: "Reversed"
          })
          const postingUser = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: PostJournalEntryInput = {
            entry,
            postedBy: postingUser
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.post(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isNotApprovedError(result.cause.error)).toBe(true)
            if (isNotApprovedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("Reversed")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer(
              [])
          )
        )
      )

      // NOTE: Period validation tests removed. Fiscal periods are now computed from
      // transaction dates at runtime rather than validated against stored periods.
      // This simplifies the system by eliminating period management workflows.
    })
  })

  describe("additional error type guards", () => {
    it("isNotApprovedError returns true for NotApprovedError", () => {
      const error = new NotApprovedError({
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        currentStatus: "Draft"
      })
      expect(isNotApprovedError(error)).toBe(true)
      expect(error._tag).toBe("NotApprovedError")
    })

    it("new type guards return false for other values", () => {
      expect(isNotApprovedError(null)).toBe(false)
      expect(isNotApprovedError(undefined)).toBe(false)
      expect(isNotApprovedError(new Error("test"))).toBe(false)
      expect(isNotApprovedError({ _tag: "NotApprovedError" })).toBe(false)
    })

    it("isEntryNotPostedError returns true for EntryNotPostedError", () => {
      const error = new EntryNotPostedError({
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        currentStatus: "Draft"
      })
      expect(isEntryNotPostedError(error)).toBe(true)
      expect(error._tag).toBe("EntryNotPostedError")
    })

    it("isEntryAlreadyReversedError returns true for EntryAlreadyReversedError", () => {
      const reversalUUID = "f0a7b810-9dad-11d1-80b4-00c04fd430cc"
      const error = new EntryAlreadyReversedError({
        journalEntryId: JournalEntryId.make(journalEntryUUID),
        reversingEntryId: JournalEntryId.make(reversalUUID)
      })
      expect(isEntryAlreadyReversedError(error)).toBe(true)
      expect(error._tag).toBe("EntryAlreadyReversedError")
    })

    it("reversal type guards return false for other values", () => {
      expect(isEntryNotPostedError(null)).toBe(false)
      expect(isEntryNotPostedError(undefined)).toBe(false)
      expect(isEntryNotPostedError(new Error("test"))).toBe(false)
      expect(isEntryNotPostedError({ _tag: "EntryNotPostedError" })).toBe(false)

      expect(isEntryAlreadyReversedError(null)).toBe(false)
      expect(isEntryAlreadyReversedError(undefined)).toBe(false)
      expect(isEntryAlreadyReversedError(new Error("test"))).toBe(false)
      expect(isEntryAlreadyReversedError({ _tag: "EntryAlreadyReversedError" })).toBe(false)
    })
  })

  describe("reverse", () => {
    const reversalEntryUUID = "f0a7b810-9dad-11d1-80b4-00c04fd430cc"
    const reversalLineUUID1 = "f1a7b810-9dad-11d1-80b4-00c04fd430cd"
    const reversalLineUUID2 = "f2a7b810-9dad-11d1-80b4-00c04fd430ce"

    // Helper to create a posted journal entry
    const createPostedJournalEntry = (id: string = journalEntryUUID): JournalEntry => {
      return JournalEntry.make({
        id: JournalEntryId.make(id),
        companyId,
        entryNumber: Option.some(EntryNumber.make("JE-2025-00001")),
        referenceNumber: Option.none(),
        description: "Test journal entry",
        transactionDate: LocalDate.make({ year: 2025, month: 1, day: 15 }),
        postingDate: Option.some(LocalDate.make({ year: 2025, month: 1, day: 15 })),
        documentDate: Option.none(),
        fiscalPeriod,
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        sourceDocumentRef: Option.none(),
        isMultiCurrency: false,
        status: "Posted",
        isReversing: false,
        reversedEntryId: Option.none(),
        reversingEntryId: Option.none(),
        createdBy: UserId.make(userUUID),
        createdAt: Timestamp.make({ epochMillis: Date.now() }),
        postedBy: Option.some(UserId.make(userUUID)),
        postedAt: Option.some(Timestamp.make({ epochMillis: Date.now() }))
      })
    }

    describe("successful reversal", () => {
      it.effect("reverses a posted journal entry with swapped debits/credits", () =>
        Effect.gen(function* () {
          const entry = createPostedJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* service.reverse(input)

          // Check original entry is marked as Reversed
          expect(result.originalEntry.status).toBe("Reversed")
          expect(Option.isSome(result.originalEntry.reversingEntryId)).toBe(true)
          if (Option.isSome(result.originalEntry.reversingEntryId)) {
            expect(result.originalEntry.reversingEntryId.value).toBe(JournalEntryId.make(reversalEntryUUID))
          }

          // Check reversal entry properties
          expect(result.reversalEntry.status).toBe("Posted")
          expect(result.reversalEntry.isReversing).toBe(true)
          expect(result.reversalEntry.entryType).toBe("Reversing")
          expect(Option.isSome(result.reversalEntry.reversedEntryId)).toBe(true)
          if (Option.isSome(result.reversalEntry.reversedEntryId)) {
            expect(result.reversalEntry.reversedEntryId.value).toBe(entry.id)
          }
          expect(Option.isSome(result.reversalEntry.entryNumber)).toBe(true)
          expect(Option.isSome(result.reversalEntry.postedBy)).toBe(true)
          expect(Option.isSome(result.reversalEntry.postedAt)).toBe(true)
          expect(Option.isSome(result.reversalEntry.postingDate)).toBe(true)

          // Check reversal lines - debits and credits should be swapped
          expect(result.reversalLines.length).toBe(2)

          // First line was a debit, should now be a credit
          const reversedLine1 = result.reversalLines[0]
          expect(Option.isNone(reversedLine1.debitAmount)).toBe(true)
          expect(Option.isSome(reversedLine1.creditAmount)).toBe(true)
          if (Option.isSome(reversedLine1.creditAmount)) {
            expect(BigDecimal.equals(
              reversedLine1.creditAmount.value.amount,
              BigDecimal.unsafeFromString("1000")
            )).toBe(true)
          }

          // Second line was a credit, should now be a debit
          const reversedLine2 = result.reversalLines[1]
          expect(Option.isSome(reversedLine2.debitAmount)).toBe(true)
          expect(Option.isNone(reversedLine2.creditAmount)).toBe(true)
          if (Option.isSome(reversedLine2.debitAmount)) {
            expect(BigDecimal.equals(
              reversedLine2.debitAmount.value.amount,
              BigDecimal.unsafeFromString("1000")
            )).toBe(true)
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("preserves original entry data in reversal entry", () =>
        Effect.gen(function* () {
          const entry = createPostedJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "500.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "500.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* service.reverse(input)

          // Verify reversal entry inherits appropriate properties from original
          expect(result.reversalEntry.companyId).toBe(entry.companyId)
          expect(result.reversalEntry.fiscalPeriod.year).toBe(entry.fiscalPeriod.year)
          expect(result.reversalEntry.fiscalPeriod.period).toBe(entry.fiscalPeriod.period)
          expect(result.reversalEntry.sourceModule).toBe(entry.sourceModule)
          expect(result.reversalEntry.isMultiCurrency).toBe(entry.isMultiCurrency)
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("generates sequential entry number for reversal entry", () =>
        Effect.gen(function* () {
          const entry = createPostedJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "100.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "100.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* service.reverse(input)

          expect(Option.isSome(result.reversalEntry.entryNumber)).toBe(true)
          if (Option.isSome(result.reversalEntry.entryNumber)) {
            expect(result.reversalEntry.entryNumber.value).toBe("JE-2025-00001")
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("sets reversal description referencing original entry number", () =>
        Effect.gen(function* () {
          const entry = createPostedJournalEntry()
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "100.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "100.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* service.reverse(input)

          expect(result.reversalEntry.description).toContain("Reversal of")
          expect(result.reversalEntry.description).toContain("JE-2025-00001")
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("preserves line properties (memo, dimensions, etc.) in reversal lines", () =>
        Effect.gen(function* () {
          const entry = createPostedJournalEntry()
          // Create a line with memo and dimensions
          const debitAmount = MonetaryAmount.unsafeFromString("1000.00", "USD")
          const debitLine = JournalEntryLine.make({
            id: JournalEntryLineId.make(lineUUID1),
            journalEntryId: JournalEntryId.make(journalEntryUUID),
            lineNumber: 1,
            accountId: AccountId.make(accountUUID1),
            debitAmount: Option.some(debitAmount),
            creditAmount: Option.none(),
            functionalCurrencyDebitAmount: Option.some(debitAmount),
            functionalCurrencyCreditAmount: Option.none(),
            exchangeRate: BigDecimal.fromBigInt(1n),
            memo: Option.some("Original memo"),
            dimensions: Option.some({ department: "Sales", project: "Q1" }),
            intercompanyPartnerId: Option.none(),
            matchingLineId: Option.none()
          })
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* service.reverse(input)

          // Check that memo and dimensions are preserved
          const reversedLine1 = result.reversalLines[0]
          expect(Option.isSome(reversedLine1.memo)).toBe(true)
          if (Option.isSome(reversedLine1.memo)) {
            expect(reversedLine1.memo.value).toBe("Original memo")
          }
          expect(Option.isSome(reversedLine1.dimensions)).toBe(true)
          if (Option.isSome(reversedLine1.dimensions)) {
            expect(reversedLine1.dimensions.value.department).toBe("Sales")
            expect(reversedLine1.dimensions.value.project).toBe("Q1")
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("handles multi-line entries correctly", () =>
        Effect.gen(function* () {
          const entry = createPostedJournalEntry()
          const debitLine1 = createDebitLine(lineUUID1, 1, accountUUID1, "600.00")
          const debitLine2 = createDebitLine(lineUUID2, 2, accountUUID2, "400.00")
          const creditLine = createCreditLine(lineUUID3, 3, accountUUID3, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine1, debitLine2, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2),
              JournalEntryLineId.make("f3a7b810-9dad-11d1-80b4-00c04fd430cf")
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* service.reverse(input)

          expect(result.reversalLines.length).toBe(3)

          // First two lines were debits, should now be credits
          expect(Option.isNone(result.reversalLines[0].debitAmount)).toBe(true)
          expect(Option.isSome(result.reversalLines[0].creditAmount)).toBe(true)
          expect(Option.isNone(result.reversalLines[1].debitAmount)).toBe(true)
          expect(Option.isSome(result.reversalLines[1].creditAmount)).toBe(true)

          // Third line was credit, should now be debit
          expect(Option.isSome(result.reversalLines[2].debitAmount)).toBe(true)
          expect(Option.isNone(result.reversalLines[2].creditAmount)).toBe(true)
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )
    })

    describe("validation errors", () => {
      it.effect("fails with EntryNotPostedError when entry is in Draft status", () =>
        Effect.gen(function* () {
          const entry = createJournalEntry() // Draft status
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.reverse(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isEntryNotPostedError(result.cause.error)).toBe(true)
            if (isEntryNotPostedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("Draft")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("fails with EntryNotPostedError when entry is in PendingApproval status", () =>
        Effect.gen(function* () {
          const entry = JournalEntry.make({
            ...createJournalEntry(),
            status: "PendingApproval"
          })
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.reverse(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isEntryNotPostedError(result.cause.error)).toBe(true)
            if (isEntryNotPostedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("PendingApproval")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("fails with EntryNotPostedError when entry is in Approved status", () =>
        Effect.gen(function* () {
          const entry = JournalEntry.make({
            ...createJournalEntry(),
            status: "Approved"
          })
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.reverse(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isEntryNotPostedError(result.cause.error)).toBe(true)
            if (isEntryNotPostedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("Approved")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("fails with EntryNotPostedError when entry is already Reversed", () =>
        Effect.gen(function* () {
          const entry = JournalEntry.make({
            ...createPostedJournalEntry(),
            status: "Reversed"
          })
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.reverse(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isEntryNotPostedError(result.cause.error)).toBe(true)
            if (isEntryNotPostedError(result.cause.error)) {
              expect(result.cause.error.currentStatus).toBe("Reversed")
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )

      it.effect("fails with EntryAlreadyReversedError when entry has reversingEntryId set", () =>
        Effect.gen(function* () {
          const existingReversalId = "f5a7b810-9dad-11d1-80b4-00c04fd430d0"
          const entry = JournalEntry.make({
            ...createPostedJournalEntry(),
            reversingEntryId: Option.some(JournalEntryId.make(existingReversalId))
          })
          const debitLine = createDebitLine(lineUUID1, 1, accountUUID1, "1000.00")
          const creditLine = createCreditLine(lineUUID2, 2, accountUUID2, "1000.00")
          const reversedBy = UserId.make("e0a7b810-9dad-11d1-80b4-00c04fd430cc")

          const input: ReverseJournalEntryInput = {
            entry,
            lines: [debitLine, creditLine],
            reversalEntryId: JournalEntryId.make(reversalEntryUUID),
            reversalLineIds: [
              JournalEntryLineId.make(reversalLineUUID1),
              JournalEntryLineId.make(reversalLineUUID2)
            ],
            reversedBy
          }

          const service = yield* JournalEntryService
          const result = yield* Effect.exit(service.reverse(input))

          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result) && result.cause._tag === "Fail") {
            expect(isEntryAlreadyReversedError(result.cause.error)).toBe(true)
            if (isEntryAlreadyReversedError(result.cause.error)) {
              expect(result.cause.error.reversingEntryId).toBe(JournalEntryId.make(existingReversalId))
            }
          }
        }).pipe(
          Effect.provide(
            createTestLayer([])
          )
        )
      )
    })

    describe("error messages", () => {
      it("EntryNotPostedError has correct message", () => {
        const error = new EntryNotPostedError({
          journalEntryId: JournalEntryId.make(journalEntryUUID),
          currentStatus: "Draft"
        })
        expect(error.message).toContain(journalEntryUUID)
        expect(error.message).toContain("Draft")
        expect(error.message).toContain("must be 'Posted'")
      })

      it("EntryAlreadyReversedError has correct message", () => {
        const reversalId = "f0a7b810-9dad-11d1-80b4-00c04fd430cc"
        const error = new EntryAlreadyReversedError({
          journalEntryId: JournalEntryId.make(journalEntryUUID),
          reversingEntryId: JournalEntryId.make(reversalId)
        })
        expect(error.message).toContain(journalEntryUUID)
        expect(error.message).toContain(reversalId)
        expect(error.message).toContain("already been reversed")
      })
    })
  })
})
