/**
 * JournalEntryService - Effect service for creating journal entries
 *
 * Implements journal entry creation with full validation per specs/ACCOUNTING_RESEARCH.md:
 * - Balance validation (debits = credits)
 * - Account existence and postability validation via AccountRepository
 * - Period validation via PeriodRepository
 * - Sequential entry number assignment
 *
 * Uses Context.Tag and Layer patterns for dependency injection.
 *
 * @module JournalEntryService
 */

import { HttpApiSchema } from "@effect/platform"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import * as Schema from "effect/Schema"
import type { JournalEntryId, UserId } from "./JournalEntry.ts";
import { JournalEntry, EntryNumber } from "./JournalEntry.ts"
import { nowEffect as timestampNowEffect } from "../shared/values/Timestamp.ts"
import { today as localDateToday } from "../shared/values/LocalDate.ts"
import type { JournalEntryLineId } from "./JournalEntryLine.ts";
import { JournalEntryLine } from "./JournalEntryLine.ts"
import type { Account, AccountId } from "../accounting/Account.ts"
import type { CompanyId } from "../company/Company.ts"
import type { CurrencyCode } from "../currency/CurrencyCode.ts"
import type { UnbalancedEntryError } from "../accounting/BalanceValidation.ts";
import { validateBalance } from "../accounting/BalanceValidation.ts"

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
  },
  HttpApiSchema.annotations({ status: 404 })
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
  },
  HttpApiSchema.annotations({ status: 422 })
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
  },
  HttpApiSchema.annotations({ status: 422 })
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
 * Error when journal entry has no lines
 */
export class EmptyJournalEntryError extends Schema.TaggedError<EmptyJournalEntryError>()(
  "EmptyJournalEntryError",
  {},
  HttpApiSchema.annotations({ status: 400 })
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
  },
  HttpApiSchema.annotations({ status: 400 })
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
 * Error when attempting to post a journal entry that is not in 'Approved' status
 */
export class NotApprovedError extends Schema.TaggedError<NotApprovedError>()(
  "NotApprovedError",
  {
    journalEntryId: Schema.UUID.pipe(Schema.brand("JournalEntryId")),
    currentStatus: Schema.Literal("Draft", "PendingApproval", "Approved", "Posted", "Reversed")
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Journal entry ${this.journalEntryId} cannot be posted: current status is '${this.currentStatus}', must be 'Approved'`
  }
}

/**
 * Type guard for NotApprovedError
 */
export const isNotApprovedError = Schema.is(NotApprovedError)

/**
 * Error when attempting to reverse a journal entry that is not posted
 */
export class EntryNotPostedError extends Schema.TaggedError<EntryNotPostedError>()(
  "EntryNotPostedError",
  {
    journalEntryId: Schema.UUID.pipe(Schema.brand("JournalEntryId")),
    currentStatus: Schema.Literal("Draft", "PendingApproval", "Approved", "Posted", "Reversed")
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Journal entry ${this.journalEntryId} cannot be reversed: current status is '${this.currentStatus}', must be 'Posted'`
  }
}

/**
 * Type guard for EntryNotPostedError
 */
export const isEntryNotPostedError = Schema.is(EntryNotPostedError)

/**
 * Error when attempting to reverse a journal entry that has already been reversed
 */
export class EntryAlreadyReversedError extends Schema.TaggedError<EntryAlreadyReversedError>()(
  "EntryAlreadyReversedError",
  {
    journalEntryId: Schema.UUID.pipe(Schema.brand("JournalEntryId")),
    reversingEntryId: Schema.UUID.pipe(Schema.brand("JournalEntryId"))
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Journal entry ${this.journalEntryId} has already been reversed by entry ${this.reversingEntryId}`
  }
}

/**
 * Type guard for EntryAlreadyReversedError
 */
export const isEntryAlreadyReversedError = Schema.is(EntryAlreadyReversedError)

/**
 * Union type for all journal entry service errors
 */
export type JournalEntryError =
  | UnbalancedEntryError
  | AccountNotFoundError
  | AccountNotPostableError
  | AccountNotActiveError
  | EmptyJournalEntryError
  | DuplicateLineNumberError
  | NotApprovedError
  | EntryNotPostedError
  | EntryAlreadyReversedError

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

// NOTE: PeriodRepository has been removed. Fiscal periods are now computed from
// transaction dates at runtime using computeFiscalPeriod() rather than being
// validated against stored periods. This simplifies the system by eliminating
// period management workflows.

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

/**
 * PostJournalEntryInput - Input for posting an approved journal entry
 */
export interface PostJournalEntryInput {
  /** The journal entry to post (must be in 'Approved' status) */
  readonly entry: JournalEntry
  /** The user posting the entry */
  readonly postedBy: typeof UserId.Type
}

/**
 * ReverseJournalEntryInput - Input for reversing a posted journal entry
 */
export interface ReverseJournalEntryInput {
  /** The journal entry to reverse (must be in 'Posted' status) */
  readonly entry: JournalEntry
  /** The original entry's lines to be reversed */
  readonly lines: ReadonlyArray<JournalEntryLine>
  /** The new reversal entry ID */
  readonly reversalEntryId: typeof JournalEntryId.Type
  /** New line IDs for the reversed lines (must match count of original lines) */
  readonly reversalLineIds: ReadonlyArray<typeof JournalEntryLineId.Type>
  /** The user performing the reversal */
  readonly reversedBy: typeof UserId.Type
}

/**
 * ReverseJournalEntryResult - Result of reversing a journal entry
 */
export interface ReverseJournalEntryResult {
  /** The updated original entry (status: 'Reversed') */
  readonly originalEntry: JournalEntry
  /** The new reversal entry (status: 'Posted') */
  readonly reversalEntry: JournalEntry
  /** The reversed lines (debits/credits swapped) */
  readonly reversalLines: ReadonlyArray<JournalEntryLine>
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
   * - Assigns sequential entry number
   *
   * NOTE: Fiscal period validation has been removed. Periods are computed
   * from the transaction date at runtime rather than validated against
   * stored periods.
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

  /**
   * Post an approved journal entry to the general ledger
   *
   * Validates:
   * - Entry is in 'Approved' status
   *
   * NOTE: Fiscal period validation has been removed. Periods are computed
   * from the transaction date at runtime rather than validated against
   * stored periods.
   *
   * Updates:
   * - Status to 'Posted'
   * - Records postedBy (UserId)
   * - Records postedAt (Timestamp)
   * - Sets postingDate to current date
   *
   * @param input - The journal entry to post and the user posting it
   * @returns Effect containing the posted entry
   */
  readonly post: (
    input: PostJournalEntryInput
  ) => Effect.Effect<
    JournalEntry,
    NotApprovedError,
    never
  >

  /**
   * Reverse a posted journal entry
   *
   * Creates a reversing entry that:
   * - Has opposite debits/credits (swapped from original)
   * - Has isReversing=true and reversedEntryId set to original entry
   * - Is created as Posted (bypasses approval workflow)
   * - Uses entryType='Reversing'
   *
   * Updates the original entry to:
   * - Set status to 'Reversed'
   * - Set reversingEntryId to the new reversal entry
   *
   * Validates:
   * - Entry is in 'Posted' status
   * - Entry has not already been reversed
   *
   * @param input - The journal entry to reverse with new IDs
   * @returns Effect containing the updated original entry and new reversal entry with lines
   */
  readonly reverse: (
    input: ReverseJournalEntryInput
  ) => Effect.Effect<
    ReverseJournalEntryResult,
    EntryNotPostedError | EntryAlreadyReversedError,
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

// NOTE: Period validation functions have been removed.
// Fiscal periods are now computed from transaction dates at runtime rather than
// being validated against stored periods. This simplifies the system by eliminating
// the need for period management and closing workflows.

/**
 * Create the JournalEntryService implementation
 */
const make = Effect.gen(function* () {
  const accountRepository = yield* AccountRepository
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

        // NOTE: Period validation removed. Fiscal periods are computed from
        // the transaction date at runtime rather than being validated against
        // stored periods. This simplifies the system by eliminating the need
        // for period management and closing workflows.

        // Generate entry number
        const entryNumber = yield* entryNumberGenerator.nextEntryNumber(
          entry.companyId,
          entry.fiscalPeriod.year
        )

        // Return entry with assigned entry number
        return JournalEntry.make({
          ...entry,
          entryNumber: Option.some(EntryNumber.make(entryNumber))
        })
      }),

    post: (input: PostJournalEntryInput) =>
      Effect.gen(function* () {
        const { entry, postedBy } = input

        // Validate entry is in 'Approved' status
        if (entry.status !== "Approved") {
          return yield* Effect.fail(
            new NotApprovedError({
              journalEntryId: entry.id,
              currentStatus: entry.status
            })
          )
        }

        // NOTE: Period validation removed. Fiscal periods are computed from
        // the transaction date at runtime rather than being validated against
        // stored periods. This simplifies the system by eliminating the need
        // for period management and closing workflows.

        // Get the current timestamp for postedAt
        const postedAt = yield* timestampNowEffect

        // Get the current date for postingDate
        const postingDate = localDateToday()

        // Return entry with updated status and posting information
        return JournalEntry.make({
          ...entry,
          status: "Posted",
          postedBy: Option.some(postedBy),
          postedAt: Option.some(postedAt),
          postingDate: Option.some(postingDate)
        })
      }),

    reverse: (input: ReverseJournalEntryInput) =>
      Effect.gen(function* () {
        const { entry, lines, reversalEntryId, reversalLineIds, reversedBy } = input

        // Validate entry is in 'Posted' status
        if (entry.status !== "Posted") {
          return yield* Effect.fail(
            new EntryNotPostedError({
              journalEntryId: entry.id,
              currentStatus: entry.status
            })
          )
        }

        // Validate entry has not already been reversed
        if (Option.isSome(entry.reversingEntryId)) {
          return yield* Effect.fail(
            new EntryAlreadyReversedError({
              journalEntryId: entry.id,
              reversingEntryId: entry.reversingEntryId.value
            })
          )
        }

        // Get the current timestamp
        const now = yield* timestampNowEffect

        // Get the current date for postingDate
        const postingDate = localDateToday()

        // Generate entry number for the reversal entry
        const reversalEntryNumber = yield* entryNumberGenerator.nextEntryNumber(
          entry.companyId,
          entry.fiscalPeriod.year
        )

        // Create the reversing lines by swapping debits and credits
        const reversalLines: ReadonlyArray<JournalEntryLine> = Array.map(
          lines,
          (line, index) =>
            JournalEntryLine.make({
              id: reversalLineIds[index],
              journalEntryId: reversalEntryId,
              lineNumber: line.lineNumber,
              accountId: line.accountId,
              // Swap debit and credit: if original was debit, make it credit
              debitAmount: line.creditAmount,
              creditAmount: line.debitAmount,
              // Swap functional currency amounts as well
              functionalCurrencyDebitAmount: line.functionalCurrencyCreditAmount,
              functionalCurrencyCreditAmount: line.functionalCurrencyDebitAmount,
              exchangeRate: line.exchangeRate,
              memo: line.memo,
              dimensions: line.dimensions,
              intercompanyPartnerId: line.intercompanyPartnerId,
              matchingLineId: line.matchingLineId
            })
        )

        // Create the reversal entry - it's created as Posted (bypasses approval)
        const reversalEntry = JournalEntry.make({
          id: reversalEntryId,
          companyId: entry.companyId,
          entryNumber: Option.some(EntryNumber.make(reversalEntryNumber)),
          referenceNumber: entry.referenceNumber,
          description: `Reversal of ${Option.isSome(entry.entryNumber) ? entry.entryNumber.value : entry.id}`,
          transactionDate: postingDate,
          postingDate: Option.some(postingDate),
          documentDate: Option.none(),
          fiscalPeriod: entry.fiscalPeriod,
          entryType: "Reversing",
          sourceModule: entry.sourceModule,
          sourceDocumentRef: entry.sourceDocumentRef,
          isMultiCurrency: entry.isMultiCurrency,
          status: "Posted",
          isReversing: true,
          reversedEntryId: Option.some(entry.id),
          reversingEntryId: Option.none(),
          createdBy: reversedBy,
          createdAt: now,
          postedBy: Option.some(reversedBy),
          postedAt: Option.some(now)
        })

        // Update the original entry to mark it as reversed
        const updatedOriginalEntry = JournalEntry.make({
          ...entry,
          status: "Reversed",
          reversingEntryId: Option.some(reversalEntryId)
        })

        return {
          originalEntry: updatedOriginalEntry,
          reversalEntry,
          reversalLines
        } satisfies ReverseJournalEntryResult
      })
  } satisfies JournalEntryServiceShape
})

/**
 * JournalEntryServiceLive - Live implementation of JournalEntryService
 *
 * Requires AccountRepository and EntryNumberGenerator
 */
export const JournalEntryServiceLive: Layer.Layer<
  JournalEntryService,
  never,
  AccountRepository | EntryNumberGenerator
> = Layer.effect(JournalEntryService, make)
