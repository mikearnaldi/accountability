/**
 * CurrencyService - Effect service for managing exchange rates
 *
 * Implements exchange rate management per specs/ACCOUNTING_RESEARCH.md including:
 * - Create and update exchange rates
 * - Rate lookups by currency pair, date, and type
 * - Latest rate lookups
 * - Currency translation between currencies
 * - Period-end revaluation of foreign currency monetary items per ASC 830
 *
 * Uses Context.Tag and Layer patterns for dependency injection.
 *
 * @module CurrencyService
 */

import { HttpApiSchema } from "@effect/platform"
import * as BigDecimal from "effect/BigDecimal"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { ExchangeRateId, Rate, RateType, RateSource} from "./ExchangeRate.ts";
import { ExchangeRate, getInverseRate } from "./ExchangeRate.ts"
import { CurrencyCode } from "./CurrencyCode.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { Timestamp, nowEffect as timestampNowEffect } from "../shared/values/Timestamp.ts"
import type { JournalEntryId, UserId } from "../journal/JournalEntry.ts";
import { JournalEntry } from "../journal/JournalEntry.ts"
import type { JournalEntryLineId } from "../journal/JournalEntryLine.ts";
import { JournalEntryLine } from "../journal/JournalEntryLine.ts"
import type { AccountId, AccountType } from "../accounting/Account.ts"
import { CompanyId } from "../company/Company.ts"
import type { FiscalPeriodRef } from "../fiscal/FiscalPeriodRef.ts"
import type { OrganizationId } from "../organization/Organization.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when an exchange rate is not found
 */
export class RateNotFoundError extends Schema.TaggedError<RateNotFoundError>()(
  "RateNotFoundError",
  {
    fromCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    toCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    effectiveDate: Schema.optional(Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    })),
    rateType: Schema.optional(Schema.Literal("Spot", "Average", "Historical", "Closing"))
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    const datePart = this.effectiveDate
      ? ` for date ${this.effectiveDate.year}-${String(this.effectiveDate.month).padStart(2, "0")}-${String(this.effectiveDate.day).padStart(2, "0")}`
      : ""
    const typePart = this.rateType ? ` (${this.rateType})` : ""
    return `Exchange rate not found: ${this.fromCurrency}/${this.toCurrency}${datePart}${typePart}`
  }
}

/**
 * Type guard for RateNotFoundError
 */
export const isRateNotFoundError = Schema.is(RateNotFoundError)

/**
 * Error when an exchange rate already exists (for create operation)
 */
export class RateAlreadyExistsError extends Schema.TaggedError<RateAlreadyExistsError>()(
  "RateAlreadyExistsError",
  {
    fromCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    toCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    effectiveDate: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    rateType: Schema.Literal("Spot", "Average", "Historical", "Closing")
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    const dateStr = `${this.effectiveDate.year}-${String(this.effectiveDate.month).padStart(2, "0")}-${String(this.effectiveDate.day).padStart(2, "0")}`
    return `Exchange rate already exists: ${this.fromCurrency}/${this.toCurrency} for date ${dateStr} (${this.rateType})`
  }
}

/**
 * Type guard for RateAlreadyExistsError
 */
export const isRateAlreadyExistsError = Schema.is(RateAlreadyExistsError)

/**
 * Error when exchange rate ID is not found (for update operation)
 */
export class ExchangeRateIdNotFoundError extends Schema.TaggedError<ExchangeRateIdNotFoundError>()(
  "ExchangeRateIdNotFoundError",
  {
    exchangeRateId: Schema.UUID.pipe(Schema.brand("ExchangeRateId"))
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Exchange rate not found: ${this.exchangeRateId}`
  }
}

/**
 * Type guard for ExchangeRateIdNotFoundError
 */
export const isExchangeRateIdNotFoundError = Schema.is(ExchangeRateIdNotFoundError)

/**
 * Error when inverse rate calculation fails (e.g., division by zero)
 */
export class InverseRateCalculationError extends Schema.TaggedError<InverseRateCalculationError>()(
  "InverseRateCalculationError",
  {
    fromCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    toCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    effectiveDate: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    rateType: Schema.Literal("Spot", "Average", "Historical", "Closing")
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    const dateStr = `${this.effectiveDate.year}-${String(this.effectiveDate.month).padStart(2, "0")}-${String(this.effectiveDate.day).padStart(2, "0")}`
    return `Failed to calculate inverse rate for ${this.fromCurrency}/${this.toCurrency} on ${dateStr} (${this.rateType})`
  }
}

/**
 * Type guard for InverseRateCalculationError
 */
export const isInverseRateCalculationError = Schema.is(InverseRateCalculationError)

/**
 * Error when no monetary accounts with foreign currency balances are found
 */
export class NoForeignCurrencyBalancesError extends Schema.TaggedError<NoForeignCurrencyBalancesError>()(
  "NoForeignCurrencyBalancesError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    closingDate: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    })
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    const dateStr = `${this.closingDate.year}-${String(this.closingDate.month).padStart(2, "0")}-${String(this.closingDate.day).padStart(2, "0")}`
    return `No monetary accounts with foreign currency balances found for company ${this.companyId} as of ${dateStr}`
  }
}

/**
 * Type guard for NoForeignCurrencyBalancesError
 */
export const isNoForeignCurrencyBalancesError = Schema.is(NoForeignCurrencyBalancesError)

/**
 * Error when an unrealized gain/loss account is not configured
 */
export class UnrealizedGainLossAccountNotFoundError extends Schema.TaggedError<UnrealizedGainLossAccountNotFoundError>()(
  "UnrealizedGainLossAccountNotFoundError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    accountType: Schema.Literal("UnrealizedGain", "UnrealizedLoss")
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Unrealized ${this.accountType === "UnrealizedGain" ? "gain" : "loss"} account not configured for company ${this.companyId}`
  }
}

/**
 * Type guard for UnrealizedGainLossAccountNotFoundError
 */
export const isUnrealizedGainLossAccountNotFoundError = Schema.is(UnrealizedGainLossAccountNotFoundError)

/**
 * Union type for all currency service errors
 */
export type CurrencyServiceError =
  | RateNotFoundError
  | RateAlreadyExistsError
  | ExchangeRateIdNotFoundError
  | InverseRateCalculationError
  | NoForeignCurrencyBalancesError
  | UnrealizedGainLossAccountNotFoundError

/**
 * Union type for revaluation errors
 */
export type RevaluationError =
  | RateNotFoundError
  | InverseRateCalculationError
  | NoForeignCurrencyBalancesError
  | UnrealizedGainLossAccountNotFoundError

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * ExchangeRateRepository - Repository interface for exchange rate persistence
 *
 * Used by CurrencyService for rate storage and retrieval.
 */
export interface ExchangeRateRepositoryService {
  /**
   * Find an exchange rate by ID
   * @param id - The exchange rate ID
   * @returns Effect containing the rate or None if not found
   */
  readonly findById: (id: ExchangeRateId) => Effect.Effect<Option.Option<ExchangeRate>>

  /**
   * Find an exchange rate by currency pair, date, and type
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param effectiveDate - The date to find the rate for
   * @param rateType - The type of rate (Spot, Average, Historical, Closing)
   * @returns Effect containing the rate or None if not found
   */
  readonly findByPairDateAndType: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    effectiveDate: LocalDate,
    rateType: RateType
  ) => Effect.Effect<Option.Option<ExchangeRate>>

  /**
   * Find the latest exchange rate for a currency pair
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Effect containing the latest rate or None if not found
   */
  readonly findLatestByPair: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ) => Effect.Effect<Option.Option<ExchangeRate>>

  /**
   * Save a new exchange rate
   * @param exchangeRate - The exchange rate to save
   * @returns Effect containing the saved rate
   */
  readonly save: (exchangeRate: ExchangeRate) => Effect.Effect<ExchangeRate>

  /**
   * Update an existing exchange rate
   * @param exchangeRate - The exchange rate to update
   * @returns Effect containing the updated rate
   */
  readonly update: (exchangeRate: ExchangeRate) => Effect.Effect<ExchangeRate>

  /**
   * Check if a rate exists for the given currency pair, date, and type
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param effectiveDate - The effective date
   * @param rateType - The type of rate
   * @returns Effect containing true if exists, false otherwise
   */
  readonly exists: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    effectiveDate: LocalDate,
    rateType: RateType
  ) => Effect.Effect<boolean>
}

/**
 * ExchangeRateRepository Context.Tag
 */
export class ExchangeRateRepository extends Context.Tag("ExchangeRateRepository")<
  ExchangeRateRepository,
  ExchangeRateRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * CreateExchangeRateInput - Input for creating a new exchange rate
 */
export interface CreateExchangeRateInput {
  /** Unique identifier for the new rate */
  readonly id: ExchangeRateId
  /** The organization this rate belongs to */
  readonly organizationId: OrganizationId
  /** Source currency code */
  readonly fromCurrency: CurrencyCode
  /** Target currency code */
  readonly toCurrency: CurrencyCode
  /** The exchange rate value */
  readonly rate: Rate
  /** The date this rate is effective for */
  readonly effectiveDate: LocalDate
  /** The type of exchange rate */
  readonly rateType: RateType
  /** The source of this rate */
  readonly source: RateSource
}

/**
 * UpdateExchangeRateInput - Input for updating an existing exchange rate
 */
export interface UpdateExchangeRateInput {
  /** The ID of the rate to update */
  readonly id: ExchangeRateId
  /** The new exchange rate value */
  readonly rate: Rate
  /** Optionally update the source */
  readonly source?: RateSource
}

// =============================================================================
// Translation Types
// =============================================================================

/**
 * TranslationResult - Result of translating an amount between currencies
 *
 * Contains the original amount, translated amount, and the rate information used.
 */
export class TranslationResult extends Schema.Class<TranslationResult>("TranslationResult")({
  /**
   * The original amount before translation
   */
  originalAmount: MonetaryAmount,

  /**
   * The translated amount in the target currency
   */
  translatedAmount: MonetaryAmount,

  /**
   * The exchange rate value used for the translation
   */
  rateUsed: Schema.BigDecimal,

  /**
   * The effective date of the rate used
   */
  rateDate: LocalDate,

  /**
   * Whether the rate was inverted (i.e., using EUR/USD rate to convert USD to EUR)
   */
  wasInverted: Schema.Boolean
}) {
  /**
   * Get a human-readable string representation of the translation
   */
  toString(): string {
    const inverted = this.wasInverted ? " (inverted)" : ""
    return `${this.originalAmount.toString()} → ${this.translatedAmount.toString()} @ ${BigDecimal.format(this.rateUsed)}${inverted}`
  }
}

/**
 * Type guard for TranslationResult using Schema.is
 */
export const isTranslationResult = Schema.is(TranslationResult)

// =============================================================================
// Revaluation Types
// =============================================================================

/**
 * RevaluationMethod - Method used for period-end revaluation
 *
 * Per specs/ACCOUNTING_RESEARCH.md:
 * - BalanceSheet: Revalue all monetary items (cash, receivables, payables)
 * - OpenItems: Only revalue open AR/AP items
 */
export const RevaluationMethod = Schema.Literal("BalanceSheet", "OpenItems").annotations({
  identifier: "RevaluationMethod",
  title: "Revaluation Method",
  description: "Method used for period-end foreign currency revaluation"
})

/**
 * The RevaluationMethod type
 */
export type RevaluationMethod = typeof RevaluationMethod.Type

/**
 * Type guard for RevaluationMethod
 */
export const isRevaluationMethod = Schema.is(RevaluationMethod)

/**
 * AccountBalance - Represents the balance of an account in a specific currency
 *
 * Used by the revaluation process to track account balances and their currency.
 */
export class AccountBalance extends Schema.Class<AccountBalance>("AccountBalance")({
  /**
   * The account ID
   */
  accountId: Schema.UUID.pipe(Schema.brand("AccountId")),

  /**
   * The account name (for display in results)
   */
  accountName: Schema.NonEmptyTrimmedString,

  /**
   * The account type (Asset, Liability, etc.)
   */
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),

  /**
   * The account category (CurrentAsset, CurrentLiability, etc.)
   */
  accountCategory: Schema.String,

  /**
   * The balance in the foreign currency
   */
  foreignCurrencyBalance: MonetaryAmount,

  /**
   * The current balance in functional currency (before revaluation)
   */
  functionalCurrencyBalance: MonetaryAmount,

  /**
   * The book exchange rate used for the current functional currency balance
   */
  bookRate: Schema.BigDecimal
}) {}

/**
 * Type guard for AccountBalance
 */
export const isAccountBalance = Schema.is(AccountBalance)

/**
 * RevaluationAccountDetail - Per-account detail for revaluation result
 *
 * Per specs/ACCOUNTING_RESEARCH.md Per-Account Detail:
 * - Account reference
 * - Currency
 * - Balance in foreign currency
 * - Previous functional currency balance
 * - New functional currency balance (at closing rate)
 * - Gain or loss amount
 */
export class RevaluationAccountDetail extends Schema.Class<RevaluationAccountDetail>("RevaluationAccountDetail")({
  /**
   * The account ID
   */
  accountId: Schema.UUID.pipe(Schema.brand("AccountId")),

  /**
   * The account name (for display)
   */
  accountName: Schema.NonEmptyTrimmedString,

  /**
   * The account type (Asset or Liability for monetary accounts)
   */
  accountType: Schema.Literal("Asset", "Liability"),

  /**
   * The foreign currency code
   */
  currency: CurrencyCode,

  /**
   * Balance in foreign currency
   */
  foreignCurrencyBalance: MonetaryAmount,

  /**
   * Previous functional currency balance (before revaluation)
   */
  previousFunctionalCurrencyBalance: MonetaryAmount,

  /**
   * New functional currency balance (at closing rate)
   */
  newFunctionalCurrencyBalance: MonetaryAmount,

  /**
   * The book exchange rate (before revaluation)
   */
  bookRate: Schema.BigDecimal,

  /**
   * The closing exchange rate used for revaluation
   */
  closingRate: Schema.BigDecimal,

  /**
   * Gain or loss amount (positive = gain, negative = loss)
   * In functional currency
   */
  gainOrLoss: MonetaryAmount
}) {
  /**
   * Check if this detail represents a gain
   */
  get isGain(): boolean {
    return this.gainOrLoss.isPositive
  }

  /**
   * Check if this detail represents a loss
   */
  get isLoss(): boolean {
    return this.gainOrLoss.isNegative
  }

  /**
   * Check if there is no gain or loss (rate unchanged)
   */
  get isUnchanged(): boolean {
    return this.gainOrLoss.isZero
  }
}

/**
 * Type guard for RevaluationAccountDetail
 */
export const isRevaluationAccountDetail = Schema.is(RevaluationAccountDetail)

/**
 * RevaluationResult - Result of period-end revaluation
 *
 * Per specs/ACCOUNTING_RESEARCH.md Revaluation Run Properties:
 * - Company and fiscal period
 * - Run date
 * - Revaluation method
 * - Closing exchange rate used
 * - Total unrealized gain/loss
 * - Reference to generated journal entry
 * - Per-account detail
 */
export class RevaluationResult extends Schema.Class<RevaluationResult>("RevaluationResult")({
  /**
   * The company ID
   */
  companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * The fiscal period reference
   */
  fiscalPeriod: Schema.Struct({
    year: Schema.Number,
    period: Schema.Number
  }),

  /**
   * The closing date used for revaluation
   */
  closingDate: LocalDate,

  /**
   * The revaluation method used
   */
  method: RevaluationMethod,

  /**
   * Per-account details
   */
  accountDetails: Schema.Array(RevaluationAccountDetail),

  /**
   * Total unrealized gain (positive) in functional currency
   */
  totalUnrealizedGain: MonetaryAmount,

  /**
   * Total unrealized loss (positive value representing loss) in functional currency
   */
  totalUnrealizedLoss: MonetaryAmount,

  /**
   * Net gain or loss (gain - loss, positive = net gain, negative = net loss)
   */
  netGainOrLoss: MonetaryAmount,

  /**
   * The generated revaluation journal entry (if any adjustments were needed)
   */
  journalEntry: Schema.OptionFromNullOr(JournalEntry),

  /**
   * The journal entry lines for the revaluation
   */
  journalEntryLines: Schema.Array(JournalEntryLine),

  /**
   * When the revaluation was performed
   */
  createdAt: Timestamp
}) {
  /**
   * Check if revaluation resulted in a net gain
   */
  get hasNetGain(): boolean {
    return this.netGainOrLoss.isPositive
  }

  /**
   * Check if revaluation resulted in a net loss
   */
  get hasNetLoss(): boolean {
    return this.netGainOrLoss.isNegative
  }

  /**
   * Check if no adjustment was needed
   */
  get hasNoAdjustment(): boolean {
    return this.netGainOrLoss.isZero
  }

  /**
   * Get the count of accounts that were revalued
   */
  get accountCount(): number {
    return this.accountDetails.length
  }

  /**
   * Get accounts with gains only
   */
  get accountsWithGains(): ReadonlyArray<RevaluationAccountDetail> {
    return this.accountDetails.filter((detail) => detail.isGain)
  }

  /**
   * Get accounts with losses only
   */
  get accountsWithLosses(): ReadonlyArray<RevaluationAccountDetail> {
    return this.accountDetails.filter((detail) => detail.isLoss)
  }
}

/**
 * Type guard for RevaluationResult
 */
export const isRevaluationResult = Schema.is(RevaluationResult)

// =============================================================================
// Revaluation Repository Interface
// =============================================================================

/**
 * MonetaryAccountCriteria - Criteria for identifying monetary accounts
 *
 * Monetary accounts per ASC 830 include:
 * - Cash and cash equivalents
 * - Accounts receivable
 * - Accounts payable
 * - Short-term debt
 * - Long-term debt
 */
export interface MonetaryAccountCriteria {
  /** Account categories considered monetary for revaluation */
  readonly categories: ReadonlyArray<string>
  /** Account types to include */
  readonly types: ReadonlyArray<AccountType>
}

/**
 * Default monetary account criteria per ASC 830
 */
export const DEFAULT_MONETARY_ACCOUNT_CRITERIA: MonetaryAccountCriteria = {
  categories: ["CurrentAsset", "CurrentLiability", "NonCurrentLiability"],
  types: ["Asset", "Liability"]
}

/**
 * AccountBalanceRepository - Repository interface for account balance lookups
 *
 * Used by revaluation process to get account balances in foreign currencies.
 */
export interface AccountBalanceRepositoryService {
  /**
   * Get all monetary account balances in foreign currencies for a company
   *
   * @param companyId - The company ID
   * @param functionalCurrency - The company's functional currency
   * @param asOfDate - The date for balance calculation
   * @param criteria - Criteria for identifying monetary accounts
   * @returns Effect containing array of account balances in foreign currencies
   */
  readonly getForeignCurrencyBalances: (
    companyId: CompanyId,
    functionalCurrency: CurrencyCode,
    asOfDate: LocalDate,
    criteria: MonetaryAccountCriteria
  ) => Effect.Effect<ReadonlyArray<AccountBalance>>

  /**
   * Get the unrealized gain/loss account for a company
   *
   * @param companyId - The company ID
   * @param type - Whether to get the gain or loss account
   * @returns Effect containing the account ID or None if not configured
   */
  readonly getUnrealizedGainLossAccount: (
    companyId: CompanyId,
    type: "UnrealizedGain" | "UnrealizedLoss"
  ) => Effect.Effect<Option.Option<AccountId>>
}

/**
 * AccountBalanceRepository Context.Tag
 */
export class AccountBalanceRepository extends Context.Tag("AccountBalanceRepository")<
  AccountBalanceRepository,
  AccountBalanceRepositoryService
>() {}

// =============================================================================
// Revaluation Input Types
// =============================================================================

/**
 * RevalueInput - Input for performing period-end revaluation
 */
export interface RevalueInput {
  /** The company to revalue */
  readonly companyId: CompanyId
  /** The fiscal period reference */
  readonly fiscalPeriod: FiscalPeriodRef
  /** The closing date for rate lookup */
  readonly closingDate: LocalDate
  /** The company's functional currency */
  readonly functionalCurrency: CurrencyCode
  /** The revaluation method (default: BalanceSheet) */
  readonly method?: RevaluationMethod
  /** The new journal entry ID */
  readonly journalEntryId: JournalEntryId
  /** Line IDs for the journal entry (must have enough for all lines) */
  readonly journalEntryLineIds: ReadonlyArray<JournalEntryLineId>
  /** The user performing the revaluation */
  readonly performedBy: UserId
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * CurrencyService - Service interface for exchange rate management
 */
export interface CurrencyServiceShape {
  /**
   * Create a new exchange rate
   *
   * @param input - The exchange rate data to create
   * @returns Effect containing the created exchange rate
   * @throws RateAlreadyExistsError if a rate already exists for the same pair/date/type
   */
  readonly createRate: (
    input: CreateExchangeRateInput
  ) => Effect.Effect<
    ExchangeRate,
    RateAlreadyExistsError,
    never
  >

  /**
   * Update an existing exchange rate
   *
   * @param input - The update data
   * @returns Effect containing the updated exchange rate
   * @throws ExchangeRateIdNotFoundError if the rate ID doesn't exist
   */
  readonly updateRate: (
    input: UpdateExchangeRateInput
  ) => Effect.Effect<
    ExchangeRate,
    ExchangeRateIdNotFoundError,
    never
  >

  /**
   * Get an exchange rate for a specific currency pair, date, and type
   *
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param effectiveDate - The date to find the rate for
   * @param rateType - The type of rate
   * @returns Effect containing the exchange rate
   * @throws RateNotFoundError if no rate is found
   */
  readonly getRate: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    effectiveDate: LocalDate,
    rateType: RateType
  ) => Effect.Effect<
    ExchangeRate,
    RateNotFoundError,
    never
  >

  /**
   * Get the latest exchange rate for a currency pair
   *
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Effect containing the latest exchange rate
   * @throws RateNotFoundError if no rate is found
   */
  readonly getLatestRate: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ) => Effect.Effect<
    ExchangeRate,
    RateNotFoundError,
    never
  >

  /**
   * Translate a monetary amount from one currency to another
   *
   * This operation:
   * - First tries to find a direct rate (fromCurrency -> toCurrency)
   * - If not found, tries to find an inverse rate (toCurrency -> fromCurrency) and calculates the inverse
   * - Supports all rate types: Spot, Average, Historical, Closing
   *
   * @param amount - The monetary amount to translate
   * @param toCurrency - The target currency code
   * @param date - The date for which to use the exchange rate
   * @param rateType - The type of exchange rate to use (Spot, Average, Historical, Closing)
   * @returns Effect containing the TranslationResult with original, translated amounts, and rate info
   * @throws RateNotFoundError if no rate is found in either direction
   * @throws InverseRateCalculationError if inverse rate calculation fails
   */
  readonly translate: (
    amount: MonetaryAmount,
    toCurrency: CurrencyCode,
    date: LocalDate,
    rateType: RateType
  ) => Effect.Effect<
    TranslationResult,
    RateNotFoundError | InverseRateCalculationError,
    never
  >

  /**
   * Perform period-end revaluation of foreign currency monetary items
   *
   * Per ASC 830, monetary items (cash, receivables, payables) denominated in
   * foreign currencies must be revalued at period end using the closing rate.
   *
   * This operation:
   * - Identifies monetary accounts with foreign currency balances
   * - Calculates unrealized gain/loss using closing rate vs. book rate
   * - Generates a revaluation journal entry automatically
   * - Returns detailed per-account results and total gain/loss
   *
   * @param input - The revaluation input parameters
   * @returns Effect containing the RevaluationResult with per-account detail and generated journal entry
   * @throws NoForeignCurrencyBalancesError if no accounts need revaluation
   * @throws RateNotFoundError if closing rate is not found for a currency pair
   * @throws InverseRateCalculationError if inverse rate calculation fails
   * @throws UnrealizedGainLossAccountNotFoundError if gain/loss account is not configured
   */
  readonly revalue: (
    input: RevalueInput
  ) => Effect.Effect<
    RevaluationResult,
    RevaluationError,
    never
  >
}

/**
 * CurrencyService Context.Tag
 */
export class CurrencyService extends Context.Tag("CurrencyService")<
  CurrencyService,
  CurrencyServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the CurrencyService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* ExchangeRateRepository

  return {
    createRate: (input: CreateExchangeRateInput) =>
      Effect.gen(function* () {
        // Check if a rate already exists for this combination
        const exists = yield* repository.exists(
          input.fromCurrency,
          input.toCurrency,
          input.effectiveDate,
          input.rateType
        )

        if (exists) {
          return yield* Effect.fail(
            new RateAlreadyExistsError({
              fromCurrency: input.fromCurrency,
              toCurrency: input.toCurrency,
              effectiveDate: {
                year: input.effectiveDate.year,
                month: input.effectiveDate.month,
                day: input.effectiveDate.day
              },
              rateType: input.rateType
            })
          )
        }

        // Create the exchange rate
        const now = yield* timestampNowEffect
        const exchangeRate = ExchangeRate.make({
          id: input.id,
          organizationId: input.organizationId,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          rate: input.rate,
          effectiveDate: input.effectiveDate,
          rateType: input.rateType,
          source: input.source,
          createdAt: now
        })

        // Save and return
        return yield* repository.save(exchangeRate)
      }),

    updateRate: (input: UpdateExchangeRateInput) =>
      Effect.gen(function* () {
        // Find the existing rate
        const existingRate = yield* repository.findById(input.id)

        if (Option.isNone(existingRate)) {
          return yield* Effect.fail(
            new ExchangeRateIdNotFoundError({
              exchangeRateId: input.id
            })
          )
        }

        // Create updated rate - note we keep all other fields the same
        const updatedRate = ExchangeRate.make({
          ...existingRate.value,
          rate: input.rate,
          source: input.source ?? existingRate.value.source
        })

        // Update and return
        return yield* repository.update(updatedRate)
      }),

    getRate: (
      fromCurrency: CurrencyCode,
      toCurrency: CurrencyCode,
      effectiveDate: LocalDate,
      rateType: RateType
    ) =>
      Effect.gen(function* () {
        const rate = yield* repository.findByPairDateAndType(
          fromCurrency,
          toCurrency,
          effectiveDate,
          rateType
        )

        if (Option.isNone(rate)) {
          return yield* Effect.fail(
            new RateNotFoundError({
              fromCurrency,
              toCurrency,
              effectiveDate: {
                year: effectiveDate.year,
                month: effectiveDate.month,
                day: effectiveDate.day
              },
              rateType
            })
          )
        }

        return rate.value
      }),

    getLatestRate: (
      fromCurrency: CurrencyCode,
      toCurrency: CurrencyCode
    ) =>
      Effect.gen(function* () {
        const rate = yield* repository.findLatestByPair(fromCurrency, toCurrency)

        if (Option.isNone(rate)) {
          return yield* Effect.fail(
            new RateNotFoundError({
              fromCurrency,
              toCurrency
            })
          )
        }

        return rate.value
      }),

    translate: (
      amount: MonetaryAmount,
      toCurrency: CurrencyCode,
      date: LocalDate,
      rateType: RateType
    ) =>
      Effect.gen(function* () {
        const fromCurrency = amount.currency

        // If same currency, return identity translation
        if (fromCurrency === toCurrency) {
          return TranslationResult.make({
            originalAmount: amount,
            translatedAmount: amount,
            rateUsed: BigDecimal.fromNumber(1),
            rateDate: date,
            wasInverted: false
          })
        }

        // Try to find direct rate (fromCurrency -> toCurrency)
        const directRate = yield* repository.findByPairDateAndType(
          fromCurrency,
          toCurrency,
          date,
          rateType
        )

        if (Option.isSome(directRate)) {
          // Use direct rate
          const translatedBigDecimal = BigDecimal.multiply(amount.amount, directRate.value.rate)
          const translatedAmount = MonetaryAmount.fromBigDecimal(translatedBigDecimal, toCurrency)

          return TranslationResult.make({
            originalAmount: amount,
            translatedAmount,
            rateUsed: directRate.value.rate,
            rateDate: directRate.value.effectiveDate,
            wasInverted: false
          })
        }

        // Try to find inverse rate (toCurrency -> fromCurrency)
        const inverseRate = yield* repository.findByPairDateAndType(
          toCurrency,
          fromCurrency,
          date,
          rateType
        )

        if (Option.isSome(inverseRate)) {
          // Calculate the inverse rate
          const calculatedInverseRate = getInverseRate(inverseRate.value)

          if (calculatedInverseRate === undefined) {
            return yield* Effect.fail(
              new InverseRateCalculationError({
                fromCurrency,
                toCurrency,
                effectiveDate: {
                  year: date.year,
                  month: date.month,
                  day: date.day
                },
                rateType
              })
            )
          }

          // Use the calculated inverse rate
          const translatedBigDecimal = BigDecimal.multiply(amount.amount, calculatedInverseRate)
          const translatedAmount = MonetaryAmount.fromBigDecimal(translatedBigDecimal, toCurrency)

          return TranslationResult.make({
            originalAmount: amount,
            translatedAmount,
            rateUsed: calculatedInverseRate,
            rateDate: inverseRate.value.effectiveDate,
            wasInverted: true
          })
        }

        // No rate found in either direction
        return yield* Effect.fail(
          new RateNotFoundError({
            fromCurrency,
            toCurrency,
            effectiveDate: {
              year: date.year,
              month: date.month,
              day: date.day
            },
            rateType
          })
        )
      })
  } satisfies Omit<CurrencyServiceShape, "revalue">
})

/**
 * Create the full CurrencyService implementation with revaluation support
 */
const makeWithRevaluation = Effect.gen(function* () {
  const repository = yield* ExchangeRateRepository
  const accountBalanceRepository = yield* AccountBalanceRepository
  const baseService = yield* make

  // Helper to get the closing rate for a currency pair
  const getClosingRate = (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: LocalDate
  ): Effect.Effect<BigDecimal.BigDecimal, RateNotFoundError | InverseRateCalculationError> =>
    Effect.gen(function* () {
      // Try direct rate first
      const directRate = yield* repository.findByPairDateAndType(
        fromCurrency,
        toCurrency,
        date,
        "Closing"
      )

      if (Option.isSome(directRate)) {
        return directRate.value.rate
      }

      // Try inverse rate
      const inverseRate = yield* repository.findByPairDateAndType(
        toCurrency,
        fromCurrency,
        date,
        "Closing"
      )

      if (Option.isSome(inverseRate)) {
        const calculatedInverse = getInverseRate(inverseRate.value)
        if (calculatedInverse === undefined) {
          return yield* Effect.fail(
            new InverseRateCalculationError({
              fromCurrency,
              toCurrency,
              effectiveDate: { year: date.year, month: date.month, day: date.day },
              rateType: "Closing"
            })
          )
        }
        return calculatedInverse
      }

      return yield* Effect.fail(
        new RateNotFoundError({
          fromCurrency,
          toCurrency,
          effectiveDate: { year: date.year, month: date.month, day: date.day },
          rateType: "Closing"
        })
      )
    })

  return {
    ...baseService,

    revalue: (input: RevalueInput) =>
      Effect.gen(function* () {
        const {
          companyId,
          fiscalPeriod,
          closingDate,
          functionalCurrency,
          method = "BalanceSheet",
          journalEntryId,
          journalEntryLineIds,
          performedBy
        } = input

        // Get foreign currency balances
        const balances = yield* accountBalanceRepository.getForeignCurrencyBalances(
          companyId,
          functionalCurrency,
          closingDate,
          DEFAULT_MONETARY_ACCOUNT_CRITERIA
        )

        // If no foreign currency balances, fail with NoForeignCurrencyBalancesError
        if (balances.length === 0) {
          return yield* Effect.fail(
            new NoForeignCurrencyBalancesError({
              companyId,
              closingDate: { year: closingDate.year, month: closingDate.month, day: closingDate.day }
            })
          )
        }

        // Calculate revaluation for each account
        const accountDetails: RevaluationAccountDetail[] = []
        let totalGain = BigDecimal.fromNumber(0)
        let totalLoss = BigDecimal.fromNumber(0)

        for (const balance of balances) {
          const foreignCurrency = balance.foreignCurrencyBalance.currency

          // Get the closing rate for this currency
          const closingRate = yield* getClosingRate(foreignCurrency, functionalCurrency, closingDate)

          // Calculate new functional currency balance using closing rate
          const newFunctionalCurrencyAmount = BigDecimal.multiply(
            balance.foreignCurrencyBalance.amount,
            closingRate
          )
          const newFunctionalCurrencyBalance = MonetaryAmount.fromBigDecimal(
            newFunctionalCurrencyAmount,
            functionalCurrency
          )

          // Calculate gain or loss
          // For assets: if new value > old value, that's a gain
          // For liabilities: if new value > old value, that's a loss (we owe more)
          const difference = BigDecimal.subtract(
            newFunctionalCurrencyAmount,
            balance.functionalCurrencyBalance.amount
          )

          let gainOrLossAmount: BigDecimal.BigDecimal
          if (balance.accountType === "Asset") {
            // For assets: positive difference = gain
            gainOrLossAmount = difference
          } else {
            // For liabilities: positive difference = loss (negated)
            gainOrLossAmount = BigDecimal.negate(difference)
          }

          const gainOrLoss = MonetaryAmount.fromBigDecimal(gainOrLossAmount, functionalCurrency)

          // Accumulate gains and losses
          if (BigDecimal.greaterThan(gainOrLossAmount, BigDecimal.fromNumber(0))) {
            totalGain = BigDecimal.sum(totalGain, gainOrLossAmount)
          } else if (BigDecimal.lessThan(gainOrLossAmount, BigDecimal.fromNumber(0))) {
            totalLoss = BigDecimal.sum(totalLoss, BigDecimal.abs(gainOrLossAmount))
          }

          // Only Asset and Liability accounts are monetary
          const accountTypeForDetail = balance.accountType === "Asset" ? "Asset" as const : "Liability" as const

          accountDetails.push(
            RevaluationAccountDetail.make({
              accountId: balance.accountId,
              accountName: balance.accountName,
              accountType: accountTypeForDetail,
              currency: foreignCurrency,
              foreignCurrencyBalance: balance.foreignCurrencyBalance,
              previousFunctionalCurrencyBalance: balance.functionalCurrencyBalance,
              newFunctionalCurrencyBalance,
              bookRate: balance.bookRate,
              closingRate,
              gainOrLoss
            })
          )
        }

        // Calculate net gain/loss
        const netGainOrLossAmount = BigDecimal.subtract(totalGain, totalLoss)
        const netGainOrLoss = MonetaryAmount.fromBigDecimal(netGainOrLossAmount, functionalCurrency)
        const totalUnrealizedGain = MonetaryAmount.fromBigDecimal(totalGain, functionalCurrency)
        const totalUnrealizedLoss = MonetaryAmount.fromBigDecimal(totalLoss, functionalCurrency)

        // Generate journal entry if there's any adjustment
        let journalEntry: Option.Option<JournalEntry> = Option.none()
        const journalEntryLines: JournalEntryLine[] = []

        if (!BigDecimal.equals(netGainOrLossAmount, BigDecimal.fromNumber(0))) {
          // Get the unrealized gain/loss accounts
          const gainAccountOpt = yield* accountBalanceRepository.getUnrealizedGainLossAccount(
            companyId,
            "UnrealizedGain"
          )
          const lossAccountOpt = yield* accountBalanceRepository.getUnrealizedGainLossAccount(
            companyId,
            "UnrealizedLoss"
          )

          // Check that required accounts are configured
          if (BigDecimal.greaterThan(totalGain, BigDecimal.fromNumber(0)) && Option.isNone(gainAccountOpt)) {
            return yield* Effect.fail(
              new UnrealizedGainLossAccountNotFoundError({
                companyId,
                accountType: "UnrealizedGain"
              })
            )
          }

          if (BigDecimal.greaterThan(totalLoss, BigDecimal.fromNumber(0)) && Option.isNone(lossAccountOpt)) {
            return yield* Effect.fail(
              new UnrealizedGainLossAccountNotFoundError({
                companyId,
                accountType: "UnrealizedLoss"
              })
            )
          }

          const now = yield* timestampNowEffect
          const unitRate = BigDecimal.fromNumber(1)

          // Create journal entry lines
          let lineNumber = 1
          let lineIdIndex = 0

          // Add lines for each account that needs adjustment
          for (const detail of accountDetails) {
            if (!detail.isUnchanged) {
              if (lineIdIndex >= journalEntryLineIds.length) {
                // Not enough line IDs provided - skip remaining
                break
              }

              const adjustmentAmount = MonetaryAmount.fromBigDecimal(
                BigDecimal.abs(detail.gainOrLoss.amount),
                functionalCurrency
              )

              // Determine if this is a debit or credit to the account
              // For assets with gains: debit the asset (increase)
              // For assets with losses: credit the asset (decrease)
              // For liabilities with gains: credit the liability (decrease)
              // For liabilities with losses: debit the liability (increase)
              const isGain = detail.isGain

              if (detail.accountType === "Asset") {
                if (isGain) {
                  // Asset gain: Debit the asset
                  journalEntryLines.push(
                    JournalEntryLine.make({
                      id: journalEntryLineIds[lineIdIndex++],
                      journalEntryId,
                      lineNumber: lineNumber++,
                      accountId: detail.accountId,
                      debitAmount: Option.some(adjustmentAmount),
                      creditAmount: Option.none(),
                      functionalCurrencyDebitAmount: Option.some(adjustmentAmount),
                      functionalCurrencyCreditAmount: Option.none(),
                      exchangeRate: unitRate,
                      memo: Option.some(`Revaluation adjustment for ${detail.currency}`),
                      dimensions: Option.none(),
                      intercompanyPartnerId: Option.none(),
                      matchingLineId: Option.none()
                    })
                  )
                } else {
                  // Asset loss: Credit the asset
                  journalEntryLines.push(
                    JournalEntryLine.make({
                      id: journalEntryLineIds[lineIdIndex++],
                      journalEntryId,
                      lineNumber: lineNumber++,
                      accountId: detail.accountId,
                      debitAmount: Option.none(),
                      creditAmount: Option.some(adjustmentAmount),
                      functionalCurrencyDebitAmount: Option.none(),
                      functionalCurrencyCreditAmount: Option.some(adjustmentAmount),
                      exchangeRate: unitRate,
                      memo: Option.some(`Revaluation adjustment for ${detail.currency}`),
                      dimensions: Option.none(),
                      intercompanyPartnerId: Option.none(),
                      matchingLineId: Option.none()
                    })
                  )
                }
              } else {
                // Liability
                if (isGain) {
                  // Liability gain (decreased): Debit the liability
                  journalEntryLines.push(
                    JournalEntryLine.make({
                      id: journalEntryLineIds[lineIdIndex++],
                      journalEntryId,
                      lineNumber: lineNumber++,
                      accountId: detail.accountId,
                      debitAmount: Option.some(adjustmentAmount),
                      creditAmount: Option.none(),
                      functionalCurrencyDebitAmount: Option.some(adjustmentAmount),
                      functionalCurrencyCreditAmount: Option.none(),
                      exchangeRate: unitRate,
                      memo: Option.some(`Revaluation adjustment for ${detail.currency}`),
                      dimensions: Option.none(),
                      intercompanyPartnerId: Option.none(),
                      matchingLineId: Option.none()
                    })
                  )
                } else {
                  // Liability loss (increased): Credit the liability
                  journalEntryLines.push(
                    JournalEntryLine.make({
                      id: journalEntryLineIds[lineIdIndex++],
                      journalEntryId,
                      lineNumber: lineNumber++,
                      accountId: detail.accountId,
                      debitAmount: Option.none(),
                      creditAmount: Option.some(adjustmentAmount),
                      functionalCurrencyDebitAmount: Option.none(),
                      functionalCurrencyCreditAmount: Option.some(adjustmentAmount),
                      exchangeRate: unitRate,
                      memo: Option.some(`Revaluation adjustment for ${detail.currency}`),
                      dimensions: Option.none(),
                      intercompanyPartnerId: Option.none(),
                      matchingLineId: Option.none()
                    })
                  )
                }
              }
            }
          }

          // Add offsetting entry to unrealized gain/loss account
          if (BigDecimal.greaterThan(totalGain, BigDecimal.fromNumber(0)) && lineIdIndex < journalEntryLineIds.length) {
            const gainAccount = Option.getOrThrow(gainAccountOpt)
            journalEntryLines.push(
              JournalEntryLine.make({
                id: journalEntryLineIds[lineIdIndex++],
                journalEntryId,
                lineNumber: lineNumber++,
                accountId: gainAccount,
                debitAmount: Option.none(),
                creditAmount: Option.some(totalUnrealizedGain),
                functionalCurrencyDebitAmount: Option.none(),
                functionalCurrencyCreditAmount: Option.some(totalUnrealizedGain),
                exchangeRate: unitRate,
                memo: Option.some("Period-end foreign currency revaluation gain"),
                dimensions: Option.none(),
                intercompanyPartnerId: Option.none(),
                matchingLineId: Option.none()
              })
            )
          }

          if (BigDecimal.greaterThan(totalLoss, BigDecimal.fromNumber(0)) && lineIdIndex < journalEntryLineIds.length) {
            const lossAccount = Option.getOrThrow(lossAccountOpt)
            journalEntryLines.push(
              JournalEntryLine.make({
                id: journalEntryLineIds[lineIdIndex++],
                journalEntryId,
                lineNumber: lineNumber++,
                accountId: lossAccount,
                debitAmount: Option.some(totalUnrealizedLoss),
                creditAmount: Option.none(),
                functionalCurrencyDebitAmount: Option.some(totalUnrealizedLoss),
                functionalCurrencyCreditAmount: Option.none(),
                exchangeRate: unitRate,
                memo: Option.some("Period-end foreign currency revaluation loss"),
                dimensions: Option.none(),
                intercompanyPartnerId: Option.none(),
                matchingLineId: Option.none()
              })
            )
          }

          // Create the journal entry
          journalEntry = Option.some(
            JournalEntry.make({
              id: journalEntryId,
              companyId,
              entryNumber: Option.none(),
              referenceNumber: Option.some(`REVAL-${fiscalPeriod.year}-${String(fiscalPeriod.period).padStart(2, "0")}`),
              description: `Foreign currency revaluation for period ${fiscalPeriod.year}.${String(fiscalPeriod.period).padStart(2, "0")}`,
              transactionDate: closingDate,
              postingDate: Option.none(),
              documentDate: Option.none(),
              fiscalPeriod,
              entryType: "Revaluation",
              sourceModule: "GeneralLedger",
              sourceDocumentRef: Option.none(),
              isMultiCurrency: false,
              status: "Draft",
              isReversing: false,
              reversedEntryId: Option.none(),
              reversingEntryId: Option.none(),
              createdBy: performedBy,
              createdAt: now,
              postedBy: Option.none(),
              postedAt: Option.none()
            })
          )
        }

        const createdAt = yield* timestampNowEffect

        return RevaluationResult.make({
          companyId,
          fiscalPeriod: { year: fiscalPeriod.year, period: fiscalPeriod.period },
          closingDate,
          method,
          accountDetails,
          totalUnrealizedGain,
          totalUnrealizedLoss,
          netGainOrLoss,
          journalEntry,
          journalEntryLines,
          createdAt
        })
      })
  } satisfies CurrencyServiceShape
})

/**
 * CurrencyServiceLive - Live implementation of CurrencyService (basic, without revaluation)
 *
 * Requires ExchangeRateRepository
 *
 * Note: Use CurrencyServiceWithRevaluationLive for full functionality including revaluation.
 */
export const CurrencyServiceLive: Layer.Layer<
  CurrencyService,
  never,
  ExchangeRateRepository
> = Layer.effect(CurrencyService, Effect.gen(function* () {
  const baseService = yield* make
  // Add a stub revalue that fails - for basic service without revaluation support
  return {
    ...baseService,
    revalue: () =>
      Effect.fail(
        new NoForeignCurrencyBalancesError({
          companyId: CompanyId.make("00000000-0000-0000-0000-000000000000"),
          closingDate: { year: 0, month: 0, day: 0 }
        })
      )
  } satisfies CurrencyServiceShape
}))

/**
 * CurrencyServiceWithRevaluationLive - Full implementation of CurrencyService with revaluation
 *
 * Requires ExchangeRateRepository and AccountBalanceRepository
 */
export const CurrencyServiceWithRevaluationLive: Layer.Layer<
  CurrencyService,
  never,
  ExchangeRateRepository | AccountBalanceRepository
> = Layer.effect(CurrencyService, makeWithRevaluation)
