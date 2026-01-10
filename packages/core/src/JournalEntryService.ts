/**
 * JournalEntryService - Effect service for creating journal entries
 *
 * Implements journal entry creation with full validation per SPECIFICATIONS.md:
 * - Balance validation (debits = credits)
 * - Account existence and postability validation via AccountRepository
 * - Period validation via PeriodRepository
 * - Sequential entry number assignment
 *
 * Uses Context.Tag and Layer patterns for dependency injection.
 *
 * @module JournalEntryService
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import * as Schema from "effect/Schema"
import type { JournalEntry } from "./JournalEntry.js"
import { EntryNumber } from "./JournalEntry.js"
import type { JournalEntryLine } from "./JournalEntryLine.js"
import type { Account, AccountId } from "./Account.js"
import type { CompanyId } from "./Company.js"
import type { CurrencyCode } from "./CurrencyCode.js"
import type { FiscalPeriodRef } from "./FiscalPeriodRef.js"
import { validateBalance, UnbalancedEntryError } from "./BalanceValidation.js"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when an account is not found
 */
export class AccountNotFoundError extends Schema.TaggedError<AccountNotFoundError>()(
  "AccountNotFoundError",
  {
    accountId: Schema.UUID.pipe(Schema.brand("AccountId"))
  }
) {
  get message(): string {
    return `Account not found: ${this.accountId}`
  }
}

/**
 * Type guard for AccountNotFoundError
 */
export const isAccountNotFoundError = Schema.is(AccountNotFoundError)

/**
 * Error when an account is not postable
 */
export class AccountNotPostableError extends Schema.TaggedError<AccountNotPostableError>()(
  "AccountNotPostableError",
  {
    accountId: Schema.UUID.pipe(Schema.brand("AccountId")),
    accountName: Schema.String
  }
) {
  get message(): string {
    return `Account '${this.accountName}' (${this.accountId}) is not postable`
  }
}

/**
 * Type guard for AccountNotPostableError
 */
export const isAccountNotPostableError = Schema.is(AccountNotPostableError)

/**
 * Error when an account is not active
 */
export class AccountNotActiveError extends Schema.TaggedError<AccountNotActiveError>()(
  "AccountNotActiveError",
  {
    accountId: Schema.UUID.pipe(Schema.brand("AccountId")),
    accountName: Schema.String
  }
) {
  get message(): string {
    return `Account '${this.accountName}' (${this.accountId}) is not active`
  }
}

/**
 * Type guard for AccountNotActiveError
 */
export const isAccountNotActiveError = Schema.is(AccountNotActiveError)

/**
 * Error when the fiscal period is not open
 */
export class PeriodNotOpenError extends Schema.TaggedError<PeriodNotOpenError>()(
  "PeriodNotOpenError",
  {
    fiscalPeriod: Schema.Struct({
      year: Schema.Number,
      period: Schema.Number
    }),
    status: Schema.String
  }
) {
  get message(): string {
    return `Fiscal period FY${this.fiscalPeriod.year}-P${String(this.fiscalPeriod.period).padStart(2, "0")} is not open (status: ${this.status})`
  }
}

/**
 * Type guard for PeriodNotOpenError
 */
export const isPeriodNotOpenError = Schema.is(PeriodNotOpenError)

/**
 * Error when the fiscal period is not found
 */
export class PeriodNotFoundError extends Schema.TaggedError<PeriodNotFoundError>()(
  "PeriodNotFoundError",
  {
    fiscalPeriod: Schema.Struct({
      year: Schema.Number,
      period: Schema.Number
    }),
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId"))
  }
) {
  get message(): string {
    return `Fiscal period FY${this.fiscalPeriod.year}-P${String(this.fiscalPeriod.period).padStart(2, "0")} not found for company ${this.companyId}`
  }
}

/**
 * Type guard for PeriodNotFoundError
 */
export const isPeriodNotFoundError = Schema.is(PeriodNotFoundError)

/**
 * Error when journal entry has no lines
 */
export class EmptyJournalEntryError extends Schema.TaggedError<EmptyJournalEntryError>()(
  "EmptyJournalEntryError",
  {}
) {
  get message(): string {
    return "Journal entry must have at least one line"
  }
}

/**
 * Type guard for EmptyJournalEntryError
 */
export const isEmptyJournalEntryError = Schema.is(EmptyJournalEntryError)

/**
 * Error when journal entry has duplicate line numbers
 */
export class DuplicateLineNumberError extends Schema.TaggedError<DuplicateLineNumberError>()(
  "DuplicateLineNumberError",
  {
    lineNumber: Schema.Number
  }
) {
  get message(): string {
    return `Duplicate line number: ${this.lineNumber}`
  }
}

/**
 * Type guard for DuplicateLineNumberError
 */
export const isDuplicateLineNumberError = Schema.is(DuplicateLineNumberError)

/**
 * Union type for all journal entry service errors
 */
export type JournalEntryError =
  | UnbalancedEntryError
  | AccountNotFoundError
  | AccountNotPostableError
  | AccountNotActiveError
  | PeriodNotOpenError
  | PeriodNotFoundError
  | EmptyJournalEntryError
  | DuplicateLineNumberError

// =============================================================================
// Repository Interfaces
// =============================================================================

/**
 * PeriodStatus - Status of a fiscal period
 */
export type PeriodStatus = "Future" | "Open" | "SoftClose" | "Closed" | "Locked"

/**
 * FiscalPeriodInfo - Information about a fiscal period from the repository
 */
export interface FiscalPeriodInfo {
  readonly year: number
  readonly period: number
  readonly status: PeriodStatus
}

/**
 * AccountRepository - Repository interface for account lookups
 *
 * Used by JournalEntryService to validate that accounts exist and are postable.
 */
export interface AccountRepositoryService {
  /**
   * Find an account by ID
   * @param accountId - The account ID to look up
   * @returns Effect containing the account or None if not found
   */
  readonly findById: (accountId: AccountId) => Effect.Effect<Option.Option<Account>>

  /**
   * Find multiple accounts by their IDs
   * @param accountIds - Array of account IDs to look up
   * @returns Effect containing a Map of found accounts
   */
  readonly findByIds: (accountIds: ReadonlyArray<AccountId>) => Effect.Effect<ReadonlyMap<AccountId, Account>>
}

/**
 * AccountRepository Context.Tag
 */
export class AccountRepository extends Context.Tag("AccountRepository")<
  AccountRepository,
  AccountRepositoryService
>() {}

/**
 * PeriodRepository - Repository interface for fiscal period lookups
 *
 * Used by JournalEntryService to validate that periods are open.
 */
export interface PeriodRepositoryService {
  /**
   * Get the status of a fiscal period for a company
   * @param companyId - The company ID
   * @param fiscalPeriod - The fiscal period reference
   * @returns Effect containing the period info or None if not found
   */
  readonly getPeriodStatus: (
    companyId: CompanyId,
    fiscalPeriod: FiscalPeriodRef
  ) => Effect.Effect<Option.Option<FiscalPeriodInfo>>

  /**
   * Check if a fiscal period is open for posting
   * @param companyId - The company ID
   * @param fiscalPeriod - The fiscal period reference
   * @returns Effect containing true if open, false otherwise
   */
  readonly isPeriodOpen: (
    companyId: CompanyId,
    fiscalPeriod: FiscalPeriodRef
  ) => Effect.Effect<boolean>
}

/**
 * PeriodRepository Context.Tag
 */
export class PeriodRepository extends Context.Tag("PeriodRepository")<
  PeriodRepository,
  PeriodRepositoryService
>() {}

/**
 * EntryNumberGenerator - Service for generating sequential entry numbers
 */
export interface EntryNumberGeneratorService {
  /**
   * Generate the next sequential entry number for a company
   * @param companyId - The company ID
   * @param fiscalYear - The fiscal year
   * @returns Effect containing the next entry number
   */
  readonly nextEntryNumber: (
    companyId: CompanyId,
    fiscalYear: number
  ) => Effect.Effect<string>
}

/**
 * EntryNumberGenerator Context.Tag
 */
export class EntryNumberGenerator extends Context.Tag("EntryNumberGenerator")<
  EntryNumberGenerator,
  EntryNumberGeneratorService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * CreateJournalEntryInput - Input for creating a journal entry
 */
export interface CreateJournalEntryInput {
  readonly entry: JournalEntry
  readonly lines: ReadonlyArray<JournalEntryLine>
  readonly functionalCurrency: CurrencyCode
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * JournalEntryService - Service interface for journal entry operations
 */
export interface JournalEntryServiceShape {
  /**
   * Create a new journal entry with full validation
   *
   * Validates:
   * - Entry has at least one line
   * - Lines have unique line numbers
   * - All accounts exist and are postable
   * - All accounts are active
   * - Entry is balanced (debits = credits)
   * - Fiscal period is open
   * - Assigns sequential entry number
   *
   * @param input - The journal entry and lines to create
   * @returns Effect containing the created entry with assigned entry number
   */
  readonly create: (
    input: CreateJournalEntryInput
  ) => Effect.Effect<
    JournalEntry,
    JournalEntryError,
    never
  >
}

/**
 * JournalEntryService Context.Tag
 */
export class JournalEntryService extends Context.Tag("JournalEntryService")<
  JournalEntryService,
  JournalEntryServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Validate that the entry has at least one line
 */
const validateHasLines = (
  lines: ReadonlyArray<JournalEntryLine>
): Effect.Effect<void, EmptyJournalEntryError> => {
  if (lines.length === 0) {
    return Effect.fail(new EmptyJournalEntryError())
  }
  return Effect.void
}

/**
 * Validate that line numbers are unique
 */
const validateUniqueLineNumbers = (
  lines: ReadonlyArray<JournalEntryLine>
): Effect.Effect<void, DuplicateLineNumberError> => {
  const lineNumbers = new Set<number>()
  for (const line of lines) {
    if (lineNumbers.has(line.lineNumber)) {
      return Effect.fail(new DuplicateLineNumberError({ lineNumber: line.lineNumber }))
    }
    lineNumbers.add(line.lineNumber)
  }
  return Effect.void
}

/**
 * Validate that all accounts exist and are postable
 */
const validateAccounts = (
  lines: ReadonlyArray<JournalEntryLine>,
  accountRepository: AccountRepositoryService
): Effect.Effect<
  void,
  AccountNotFoundError | AccountNotPostableError | AccountNotActiveError
> => {
  return Effect.gen(function* () {
    // Get unique account IDs from lines
    const accountIds = Array.dedupe(Array.map(lines, (line) => line.accountId))

    // Fetch all accounts at once
    const accounts = yield* accountRepository.findByIds(accountIds)

    // Validate each account
    for (const accountId of accountIds) {
      const account = accounts.get(accountId)

      if (account === undefined) {
        return yield* Effect.fail(new AccountNotFoundError({ accountId }))
      }

      if (!account.isActive) {
        return yield* Effect.fail(
          new AccountNotActiveError({
            accountId,
            accountName: account.name
          })
        )
      }

      if (!account.isPostable) {
        return yield* Effect.fail(
          new AccountNotPostableError({
            accountId,
            accountName: account.name
          })
        )
      }
    }
  })
}

/**
 * Validate that the fiscal period is open
 */
const validatePeriodOpen = (
  companyId: CompanyId,
  fiscalPeriod: FiscalPeriodRef,
  periodRepository: PeriodRepositoryService
): Effect.Effect<void, PeriodNotOpenError | PeriodNotFoundError> => {
  return Effect.gen(function* () {
    const periodInfo = yield* periodRepository.getPeriodStatus(companyId, fiscalPeriod)

    if (Option.isNone(periodInfo)) {
      return yield* Effect.fail(
        new PeriodNotFoundError({
          fiscalPeriod: { year: fiscalPeriod.year, period: fiscalPeriod.period },
          companyId
        })
      )
    }

    const status = periodInfo.value.status
    // Only "Open" status allows unrestricted posting
    // "SoftClose" requires approval, "Future", "Closed", "Locked" do not allow posting
    if (status !== "Open") {
      return yield* Effect.fail(
        new PeriodNotOpenError({
          fiscalPeriod: { year: fiscalPeriod.year, period: fiscalPeriod.period },
          status
        })
      )
    }
  })
}

/**
 * Create the JournalEntryService implementation
 */
const make = Effect.gen(function* () {
  const accountRepository = yield* AccountRepository
  const periodRepository = yield* PeriodRepository
  const entryNumberGenerator = yield* EntryNumberGenerator

  return {
    create: (input: CreateJournalEntryInput) =>
      Effect.gen(function* () {
        const { entry, lines, functionalCurrency } = input

        // Validate entry has lines
        yield* validateHasLines(lines)

        // Validate unique line numbers
        yield* validateUniqueLineNumbers(lines)

        // Validate all accounts exist, are active, and are postable
        yield* validateAccounts(lines, accountRepository)

        // Validate balance (debits = credits)
        yield* validateBalance(lines, functionalCurrency)

        // Validate fiscal period is open
        yield* validatePeriodOpen(entry.companyId, entry.fiscalPeriod, periodRepository)

        // Generate entry number
        const entryNumber = yield* entryNumberGenerator.nextEntryNumber(
          entry.companyId,
          entry.fiscalPeriod.year
        )

        // Return entry with assigned entry number
        // Using structural copying to create a new entry with the entry number
        return {
          ...entry,
          entryNumber: Option.some(EntryNumber.make(entryNumber))
        } as JournalEntry
      })
  } satisfies JournalEntryServiceShape
})

/**
 * JournalEntryServiceLive - Live implementation of JournalEntryService
 *
 * Requires AccountRepository, PeriodRepository, and EntryNumberGenerator
 */
export const JournalEntryServiceLive: Layer.Layer<
  JournalEntryService,
  never,
  AccountRepository | PeriodRepository | EntryNumberGenerator
> = Layer.effect(JournalEntryService, make)
