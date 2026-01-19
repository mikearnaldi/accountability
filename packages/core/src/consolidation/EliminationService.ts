/**
 * EliminationService - Service for automatic elimination entry generation
 *
 * Per ASC 810, this service automatically generates elimination entries
 * based on elimination rules during consolidation. It processes rules
 * in priority order and creates journal entries for each elimination.
 *
 * Elimination Types supported:
 * - IntercompanyReceivablePayable: Eliminate AR/AP between group companies
 * - IntercompanyRevenueExpense: Eliminate sales and corresponding COGS/expenses
 * - IntercompanyDividend: Eliminate dividends paid within group
 * - IntercompanyInvestment: Eliminate investment in subsidiary against equity
 * - UnrealizedProfitInventory: Eliminate profit on inventory still held
 * - UnrealizedProfitFixedAssets: Eliminate profit on fixed assets transferred
 *
 * @module EliminationService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AccountId } from "../accounting/Account.ts"
import { CompanyId } from "../company/Company.ts"
import { ConsolidationGroupId, EliminationRuleId } from "./ConsolidationGroup.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import type {
  EliminationRule} from "./EliminationRule.ts";
import {
  type EliminationType
} from "./EliminationRule.ts"
import { FiscalPeriodRef } from "../fiscal/FiscalPeriodRef.ts"
import { JournalEntryId } from "../journal/JournalEntry.ts"
import { JournalEntryLineId } from "../journal/JournalEntryLine.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount, add as addMonetary } from "../shared/values/MonetaryAmount.ts"
import { Timestamp, nowEffect } from "../shared/values/Timestamp.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when consolidation group is not found
 */
export class ConsolidationGroupNotFoundError extends Schema.TaggedError<ConsolidationGroupNotFoundError>()(
  "ConsolidationGroupNotFoundError",
  {
    groupId: ConsolidationGroupId
  }
) {
  get message(): string {
    return `Consolidation group not found: ${this.groupId}`
  }
}

/**
 * Type guard for ConsolidationGroupNotFoundError
 */
export const isConsolidationGroupNotFoundError = Schema.is(ConsolidationGroupNotFoundError)

/**
 * Error when fiscal period is not found
 */
export class FiscalPeriodNotFoundError extends Schema.TaggedError<FiscalPeriodNotFoundError>()(
  "FiscalPeriodNotFoundError",
  {
    periodRef: FiscalPeriodRef
  }
) {
  get message(): string {
    return `Fiscal period not found: FY${this.periodRef.year}-P${String(this.periodRef.period).padStart(2, "0")}`
  }
}

/**
 * Type guard for FiscalPeriodNotFoundError
 */
export const isFiscalPeriodNotFoundError = Schema.is(FiscalPeriodNotFoundError)

/**
 * Error when elimination rule is not found
 */
export class EliminationRuleNotFoundError extends Schema.TaggedError<EliminationRuleNotFoundError>()(
  "EliminationRuleNotFoundError",
  {
    ruleId: EliminationRuleId
  }
) {
  get message(): string {
    return `Elimination rule not found: ${this.ruleId}`
  }
}

/**
 * Type guard for EliminationRuleNotFoundError
 */
export const isEliminationRuleNotFoundError = Schema.is(EliminationRuleNotFoundError)

/**
 * Error when no balances are found for elimination
 */
export class NoBalancesForEliminationError extends Schema.TaggedError<NoBalancesForEliminationError>()(
  "NoBalancesForEliminationError",
  {
    ruleId: EliminationRuleId,
    reason: Schema.String
  }
) {
  get message(): string {
    return `No balances found for elimination rule ${this.ruleId}: ${this.reason}`
  }
}

/**
 * Type guard for NoBalancesForEliminationError
 */
export const isNoBalancesForEliminationError = Schema.is(NoBalancesForEliminationError)

/**
 * Union type for all elimination service errors
 */
export type EliminationServiceError =
  | ConsolidationGroupNotFoundError
  | FiscalPeriodNotFoundError
  | EliminationRuleNotFoundError
  | NoBalancesForEliminationError

// =============================================================================
// Elimination Entry Types
// =============================================================================

/**
 * EliminationEntryId - Branded UUID string for elimination entry identification
 */
export const EliminationEntryId = Schema.UUID.pipe(
  Schema.brand("EliminationEntryId"),
  Schema.annotations({
    identifier: "EliminationEntryId",
    title: "Elimination Entry ID",
    description: "A unique identifier for an elimination entry (UUID format)"
  })
)

/**
 * The branded EliminationEntryId type
 */
export type EliminationEntryId = typeof EliminationEntryId.Type

/**
 * Type guard for EliminationEntryId
 */
export const isEliminationEntryId = Schema.is(EliminationEntryId)

/**
 * EliminationEntryLine - A line within an elimination entry
 *
 * Represents a single debit or credit line in an elimination journal entry.
 */
export class EliminationEntryLine extends Schema.Class<EliminationEntryLine>("EliminationEntryLine")({
  /**
   * Unique identifier for the line
   */
  id: JournalEntryLineId,

  /**
   * Line number for ordering
   */
  lineNumber: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1)
  ),

  /**
   * Account to debit or credit
   */
  accountId: AccountId,

  /**
   * Debit amount (None if this is a credit line)
   */
  debitAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Credit amount (None if this is a debit line)
   */
  creditAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Optional memo/description for this line
   */
  memo: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {
  /**
   * Check if this is a debit line
   */
  get isDebit(): boolean {
    return Option.isSome(this.debitAmount)
  }

  /**
   * Check if this is a credit line
   */
  get isCredit(): boolean {
    return Option.isSome(this.creditAmount)
  }

  /**
   * Get the amount (either debit or credit)
   */
  get amount(): MonetaryAmount {
    return Option.getOrElse(this.debitAmount, () => Option.getOrThrow(this.creditAmount))
  }
}

/**
 * Type guard for EliminationEntryLine
 */
export const isEliminationEntryLine = Schema.is(EliminationEntryLine)

/**
 * EliminationEntry - A consolidation elimination journal entry
 *
 * Represents a complete elimination entry generated from an elimination rule.
 * Links back to the rule that generated it for audit purposes.
 */
export class EliminationEntry extends Schema.Class<EliminationEntry>("EliminationEntry")({
  /**
   * Unique identifier for the elimination entry
   */
  id: EliminationEntryId,

  /**
   * Reference to the consolidation group
   */
  groupId: ConsolidationGroupId,

  /**
   * Reference to the elimination rule that generated this entry
   */
  ruleId: EliminationRuleId,

  /**
   * The type of elimination
   */
  eliminationType: Schema.Literal(
    "IntercompanyReceivablePayable",
    "IntercompanyRevenueExpense",
    "IntercompanyDividend",
    "IntercompanyInvestment",
    "UnrealizedProfitInventory",
    "UnrealizedProfitFixedAssets"
  ),

  /**
   * Fiscal period for this elimination
   */
  periodRef: FiscalPeriodRef,

  /**
   * Transaction date for the elimination entry
   */
  transactionDate: LocalDate,

  /**
   * Description of the elimination
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * The currency of the elimination amounts
   */
  currency: CurrencyCode,

  /**
   * Total elimination amount (sum of debits = sum of credits)
   */
  amount: MonetaryAmount,

  /**
   * Lines in this elimination entry
   */
  lines: Schema.Chunk(EliminationEntryLine),

  /**
   * Reference to the journal entry once created (optional until posted)
   */
  journalEntryId: Schema.OptionFromNullOr(JournalEntryId),

  /**
   * Whether this entry has been posted
   */
  isPosted: Schema.Boolean,

  /**
   * When this entry was generated
   */
  generatedAt: Timestamp,

  /**
   * From company ID (for intercompany eliminations)
   */
  fromCompanyId: Schema.OptionFromNullOr(CompanyId),

  /**
   * To company ID (for intercompany eliminations)
   */
  toCompanyId: Schema.OptionFromNullOr(CompanyId)
}) {
  /**
   * Get the number of lines
   */
  get lineCount(): number {
    return Chunk.size(this.lines)
  }

  /**
   * Check if the entry has a journal entry reference
   */
  get hasJournalEntry(): boolean {
    return Option.isSome(this.journalEntryId)
  }

  /**
   * Check if this is an intercompany elimination
   */
  get isIntercompanyElimination(): boolean {
    return Option.isSome(this.fromCompanyId) && Option.isSome(this.toCompanyId)
  }

  /**
   * Get total debit amount
   */
  get totalDebits(): MonetaryAmount {
    return Chunk.reduce(
      this.lines,
      MonetaryAmount.zero(this.currency),
      (acc, line) =>
        Option.isSome(line.debitAmount)
          ? Effect.runSync(addMonetary(acc, Option.getOrThrow(line.debitAmount)))
          : acc
    )
  }

  /**
   * Get total credit amount
   */
  get totalCredits(): MonetaryAmount {
    return Chunk.reduce(
      this.lines,
      MonetaryAmount.zero(this.currency),
      (acc, line) =>
        Option.isSome(line.creditAmount)
          ? Effect.runSync(addMonetary(acc, Option.getOrThrow(line.creditAmount)))
          : acc
    )
  }

  /**
   * Check if debits equal credits
   */
  get isBalanced(): boolean {
    return BigDecimal.equals(this.totalDebits.amount, this.totalCredits.amount)
  }
}

/**
 * Type guard for EliminationEntry
 */
export const isEliminationEntry = Schema.is(EliminationEntry)

/**
 * Encoded type interface for EliminationEntry
 */
export interface EliminationEntryEncoded extends Schema.Schema.Encoded<typeof EliminationEntry> {}

// =============================================================================
// Account Balance Type for Repository
// =============================================================================

/**
 * AccountBalance - Represents an account balance for elimination calculation
 */
export class AccountBalance extends Schema.Class<AccountBalance>("AccountBalance")({
  /**
   * Account ID
   */
  accountId: AccountId,

  /**
   * Company ID that owns this account
   */
  companyId: CompanyId,

  /**
   * Balance amount (positive for normal balance direction)
   */
  balance: MonetaryAmount,

  /**
   * Intercompany partner ID (if this is an intercompany account)
   */
  intercompanyPartnerId: Schema.OptionFromNullOr(CompanyId)
}) {}

/**
 * Type guard for AccountBalance
 */
export const isAccountBalance = Schema.is(AccountBalance)

// =============================================================================
// Generation Result Types
// =============================================================================

/**
 * GenerationResult - Result of generating elimination entries
 */
export class GenerationResult extends Schema.Class<GenerationResult>("GenerationResult")({
  /**
   * Generated elimination entries
   */
  entries: Schema.Chunk(EliminationEntry),

  /**
   * Rules that were processed
   */
  processedRuleIds: Schema.Chunk(EliminationRuleId),

  /**
   * Rules that were skipped (no matching balances or inactive)
   */
  skippedRuleIds: Schema.Chunk(EliminationRuleId),

  /**
   * Total elimination amount
   */
  totalAmount: MonetaryAmount,

  /**
   * When the generation was performed
   */
  generatedAt: Timestamp
}) {
  /**
   * Get the number of entries generated
   */
  get entryCount(): number {
    return Chunk.size(this.entries)
  }

  /**
   * Get the number of rules processed
   */
  get processedRuleCount(): number {
    return Chunk.size(this.processedRuleIds)
  }

  /**
   * Get the number of rules skipped
   */
  get skippedRuleCount(): number {
    return Chunk.size(this.skippedRuleIds)
  }

  /**
   * Check if any entries were generated
   */
  get hasEntries(): boolean {
    return Chunk.isNonEmpty(this.entries)
  }
}

/**
 * Type guard for GenerationResult
 */
export const isGenerationResult = Schema.is(GenerationResult)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * EliminationRepositoryService - Repository interface for elimination data
 */
export interface EliminationRepositoryService {
  /**
   * Check if a consolidation group exists
   */
  readonly groupExists: (groupId: ConsolidationGroupId) => Effect.Effect<boolean>

  /**
   * Check if a fiscal period exists
   */
  readonly periodExists: (periodRef: FiscalPeriodRef) => Effect.Effect<boolean>

  /**
   * Get elimination rules for a group (sorted by priority)
   */
  readonly getRulesByGroup: (groupId: ConsolidationGroupId) => Effect.Effect<Chunk.Chunk<EliminationRule>>

  /**
   * Get account balances that match a rule's source accounts
   */
  readonly getBalancesForRule: (
    rule: EliminationRule,
    periodRef: FiscalPeriodRef
  ) => Effect.Effect<Chunk.Chunk<AccountBalance>>

  /**
   * Get the reporting currency for a consolidation group
   */
  readonly getGroupCurrency: (groupId: ConsolidationGroupId) => Effect.Effect<CurrencyCode>

  /**
   * Get the period end date for a fiscal period
   */
  readonly getPeriodEndDate: (periodRef: FiscalPeriodRef) => Effect.Effect<LocalDate>

  /**
   * Generate a new unique elimination entry ID
   */
  readonly generateEntryId: () => Effect.Effect<EliminationEntryId>

  /**
   * Generate a new unique journal entry line ID
   */
  readonly generateLineId: () => Effect.Effect<JournalEntryLineId>
}

/**
 * EliminationRepository Context.Tag
 */
export class EliminationRepository extends Context.Tag("EliminationRepository")<
  EliminationRepository,
  EliminationRepositoryService
>() {}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * EliminationServiceShape - Service interface for elimination generation
 */
export interface EliminationServiceShape {
  /**
   * Generate elimination entries for a consolidation group and period
   *
   * Processes rules in priority order and generates journal entries
   * for each elimination. Each entry links to the rule that generated it.
   *
   * Supported elimination types:
   * - IntercompanyReceivablePayable: Eliminate AR/AP between group companies
   * - IntercompanyRevenueExpense: Eliminate IC sales and corresponding COGS
   * - IntercompanyDividend: Eliminate dividends paid within group
   * - IntercompanyInvestment: Eliminate investment vs equity
   * - UnrealizedProfitInventory: Eliminate unrealized profit in inventory
   * - UnrealizedProfitFixedAssets: Eliminate unrealized profit in fixed assets
   *
   * @param groupId - The consolidation group ID
   * @param periodRef - The fiscal period reference
   * @param rules - The elimination rules to apply (or all active rules for group if not provided)
   * @returns Effect containing the generation result with elimination entries
   */
  readonly generateEliminations: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    rules?: Chunk.Chunk<EliminationRule>
  ) => Effect.Effect<GenerationResult, EliminationServiceError>
}

/**
 * EliminationService Context.Tag
 */
export class EliminationService extends Context.Tag("EliminationService")<
  EliminationService,
  EliminationServiceShape
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sort rules by priority (lower number = higher priority)
 */
const sortByPriority = (rules: Chunk.Chunk<EliminationRule>): Chunk.Chunk<EliminationRule> => {
  return Chunk.fromIterable(
    [...Chunk.toReadonlyArray(rules)].sort((a, b) => a.priority - b.priority)
  )
}

/**
 * Get description for elimination type
 */
const getEliminationDescription = (
  eliminationType: EliminationType,
  ruleId: EliminationRuleId
): string => {
  switch (eliminationType) {
    case "IntercompanyReceivablePayable":
      return `Elimination of intercompany receivable/payable - Rule ${ruleId}`
    case "IntercompanyRevenueExpense":
      return `Elimination of intercompany revenue/expense - Rule ${ruleId}`
    case "IntercompanyDividend":
      return `Elimination of intercompany dividend - Rule ${ruleId}`
    case "IntercompanyInvestment":
      return `Elimination of investment in subsidiary - Rule ${ruleId}`
    case "UnrealizedProfitInventory":
      return `Elimination of unrealized profit in inventory - Rule ${ruleId}`
    case "UnrealizedProfitFixedAssets":
      return `Elimination of unrealized profit in fixed assets - Rule ${ruleId}`
  }
}

/**
 * Group balances by intercompany partner pairs for paired eliminations
 */
const groupBalancesByPartnerPair = (
  balances: Chunk.Chunk<AccountBalance>
): Map<string, Chunk.Chunk<AccountBalance>> => {
  const groups = new Map<string, AccountBalance[]>()

  for (const balance of balances) {
    if (Option.isSome(balance.intercompanyPartnerId)) {
      const partnerId = Option.getOrThrow(balance.intercompanyPartnerId)
      // Create a canonical key that's the same regardless of direction
      const ids = [balance.companyId, partnerId].sort()
      const key = `${ids[0]}|${ids[1]}`

      const existing = groups.get(key) || []
      existing.push(balance)
      groups.set(key, existing)
    }
  }

  const result = new Map<string, Chunk.Chunk<AccountBalance>>()
  for (const [key, value] of groups) {
    result.set(key, Chunk.fromIterable(value))
  }
  return result
}

/**
 * Calculate total balance for a group of account balances
 */
const calculateTotalBalance = (
  balances: Chunk.Chunk<AccountBalance>,
  currency: CurrencyCode
): MonetaryAmount => {
  return Chunk.reduce(
    balances,
    MonetaryAmount.zero(currency),
    (acc, balance) => Effect.runSync(addMonetary(acc, balance.balance))
  )
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the EliminationService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* EliminationRepository

  return {
    generateEliminations: (
      groupId: ConsolidationGroupId,
      periodRef: FiscalPeriodRef,
      providedRules?: Chunk.Chunk<EliminationRule>
    ) =>
      Effect.gen(function* () {
        // Validate group exists
        const groupExists = yield* repository.groupExists(groupId)
        if (!groupExists) {
          return yield* Effect.fail(new ConsolidationGroupNotFoundError({ groupId }))
        }

        // Validate period exists
        const periodExists = yield* repository.periodExists(periodRef)
        if (!periodExists) {
          return yield* Effect.fail(new FiscalPeriodNotFoundError({ periodRef }))
        }

        // Get rules - either provided or fetch from repository
        const allRules = providedRules ?? (yield* repository.getRulesByGroup(groupId))

        // Filter to only active and automatic rules, then sort by priority
        const activeRules = Chunk.filter(
          allRules,
          (rule) => rule.isActive && rule.isAutomatic
        )
        const sortedRules = sortByPriority(activeRules)

        // Get group currency and period end date
        const currency = yield* repository.getGroupCurrency(groupId)
        const periodEndDate = yield* repository.getPeriodEndDate(periodRef)

        // Track results
        const entries: EliminationEntry[] = []
        const processedRuleIds: EliminationRuleId[] = []
        const skippedRuleIds: EliminationRuleId[] = []
        let totalAmount = MonetaryAmount.zero(currency)
        const now = yield* nowEffect

        // Process each rule in priority order
        for (const rule of sortedRules) {
          // Get balances that match this rule
          const balances = yield* repository.getBalancesForRule(rule, periodRef)

          // Skip if no balances
          if (Chunk.isEmpty(balances)) {
            skippedRuleIds.push(rule.id)
            continue
          }

          // Generate elimination entries based on type
          const ruleEntries = yield* generateEntriesForRule(
            rule,
            balances,
            groupId,
            periodRef,
            periodEndDate,
            currency,
            now,
            repository
          )

          if (Chunk.isEmpty(ruleEntries)) {
            skippedRuleIds.push(rule.id)
            continue
          }

          // Add entries and update totals
          for (const entry of ruleEntries) {
            entries.push(entry)
            totalAmount = Effect.runSync(addMonetary(totalAmount, entry.amount))
          }
          processedRuleIds.push(rule.id)
        }

        return GenerationResult.make({
          entries: Chunk.fromIterable(entries),
          processedRuleIds: Chunk.fromIterable(processedRuleIds),
          skippedRuleIds: Chunk.fromIterable(skippedRuleIds),
          totalAmount,
          generatedAt: now
        })
      })
  } satisfies EliminationServiceShape
})

/**
 * Generate elimination entries for a specific rule
 */
const generateEntriesForRule = (
  rule: EliminationRule,
  balances: Chunk.Chunk<AccountBalance>,
  groupId: ConsolidationGroupId,
  periodRef: FiscalPeriodRef,
  transactionDate: LocalDate,
  currency: CurrencyCode,
  generatedAt: Timestamp,
  repository: EliminationRepositoryService
): Effect.Effect<Chunk.Chunk<EliminationEntry>> =>
  Effect.gen(function* () {
    switch (rule.eliminationType) {
      case "IntercompanyReceivablePayable":
      case "IntercompanyRevenueExpense":
      case "IntercompanyDividend":
        // For IC eliminations, group by partner pairs and create entries
        return yield* generateIntercompanyEliminations(
          rule,
          balances,
          groupId,
          periodRef,
          transactionDate,
          currency,
          generatedAt,
          repository
        )

      case "IntercompanyInvestment":
        // For investment eliminations, match investment accounts to equity
        return yield* generateInvestmentEliminations(
          rule,
          balances,
          groupId,
          periodRef,
          transactionDate,
          currency,
          generatedAt,
          repository
        )

      case "UnrealizedProfitInventory":
      case "UnrealizedProfitFixedAssets":
        // For unrealized profit, calculate profit to eliminate
        return yield* generateUnrealizedProfitEliminations(
          rule,
          balances,
          groupId,
          periodRef,
          transactionDate,
          currency,
          generatedAt,
          repository
        )
    }
  })

/**
 * Generate intercompany elimination entries (AR/AP, Revenue/Expense, Dividend)
 */
const generateIntercompanyEliminations = (
  rule: EliminationRule,
  balances: Chunk.Chunk<AccountBalance>,
  groupId: ConsolidationGroupId,
  periodRef: FiscalPeriodRef,
  transactionDate: LocalDate,
  currency: CurrencyCode,
  generatedAt: Timestamp,
  repository: EliminationRepositoryService
): Effect.Effect<Chunk.Chunk<EliminationEntry>> =>
  Effect.gen(function* () {
    const entries: EliminationEntry[] = []

    // Group balances by intercompany partner pairs
    const partnerGroups = groupBalancesByPartnerPair(balances)

    for (const [_pairKey, pairBalances] of partnerGroups) {
      if (Chunk.size(pairBalances) < 2) {
        // Need both sides for elimination
        continue
      }

      // Calculate total balance to eliminate (smaller of the two sides typically)
      const totalBalance = calculateTotalBalance(pairBalances, currency)

      // Skip if balance is zero
      if (totalBalance.isZero) {
        continue
      }

      // Get from/to company IDs from the balances
      const firstBalance = Chunk.unsafeHead(pairBalances)
      const fromCompanyId = firstBalance.companyId
      const toCompanyId = Option.getOrElse(
        firstBalance.intercompanyPartnerId,
        () => fromCompanyId
      )

      // Generate entry ID and line IDs
      const entryId = yield* repository.generateEntryId()
      const debitLineId = yield* repository.generateLineId()
      const creditLineId = yield* repository.generateLineId()

      // Create elimination entry with debit and credit lines
      const eliminationAmount = totalBalance.abs()
      const description = getEliminationDescription(rule.eliminationType, rule.id)

      const debitLine = EliminationEntryLine.make({
        id: debitLineId,
        lineNumber: 1,
        accountId: rule.debitAccountId,
        debitAmount: Option.some(eliminationAmount),
        creditAmount: Option.none(),
        memo: Option.some(`Elimination debit - ${rule.name}`)
      })

      const creditLine = EliminationEntryLine.make({
        id: creditLineId,
        lineNumber: 2,
        accountId: rule.creditAccountId,
        debitAmount: Option.none(),
        creditAmount: Option.some(eliminationAmount),
        memo: Option.some(`Elimination credit - ${rule.name}`)
      })

      const entry = EliminationEntry.make({
        id: entryId,
        groupId,
        ruleId: rule.id,
        eliminationType: rule.eliminationType,
        periodRef,
        transactionDate,
        description,
        currency,
        amount: eliminationAmount,
        lines: Chunk.make(debitLine, creditLine),
        journalEntryId: Option.none(),
        isPosted: false,
        generatedAt,
        fromCompanyId: Option.some(fromCompanyId),
        toCompanyId: Option.some(toCompanyId)
      })

      entries.push(entry)
    }

    return Chunk.fromIterable(entries)
  })

/**
 * Generate investment vs equity elimination entries
 */
const generateInvestmentEliminations = (
  rule: EliminationRule,
  balances: Chunk.Chunk<AccountBalance>,
  groupId: ConsolidationGroupId,
  periodRef: FiscalPeriodRef,
  transactionDate: LocalDate,
  currency: CurrencyCode,
  generatedAt: Timestamp,
  repository: EliminationRepositoryService
): Effect.Effect<Chunk.Chunk<EliminationEntry>> =>
  Effect.gen(function* () {
    // For investment eliminations, we eliminate the investment balance
    // against the subsidiary's equity
    const totalBalance = calculateTotalBalance(balances, currency)

    if (totalBalance.isZero) {
      return Chunk.empty()
    }

    const entryId = yield* repository.generateEntryId()
    const debitLineId = yield* repository.generateLineId()
    const creditLineId = yield* repository.generateLineId()

    const eliminationAmount = totalBalance.abs()
    const description = getEliminationDescription(rule.eliminationType, rule.id)

    // Get from/to from first balance if available
    const firstBalance = Chunk.head(balances)
    const fromCompanyId = Option.map(firstBalance, (b) => b.companyId)
    const toCompanyId = Option.flatMap(firstBalance, (b) => b.intercompanyPartnerId)

    const debitLine = EliminationEntryLine.make({
      id: debitLineId,
      lineNumber: 1,
      accountId: rule.debitAccountId,
      debitAmount: Option.some(eliminationAmount),
      creditAmount: Option.none(),
      memo: Option.some(`Investment elimination debit - ${rule.name}`)
    })

    const creditLine = EliminationEntryLine.make({
      id: creditLineId,
      lineNumber: 2,
      accountId: rule.creditAccountId,
      debitAmount: Option.none(),
      creditAmount: Option.some(eliminationAmount),
      memo: Option.some(`Investment elimination credit - ${rule.name}`)
    })

    const entry = EliminationEntry.make({
      id: entryId,
      groupId,
      ruleId: rule.id,
      eliminationType: rule.eliminationType,
      periodRef,
      transactionDate,
      description,
      currency,
      amount: eliminationAmount,
      lines: Chunk.make(debitLine, creditLine),
      journalEntryId: Option.none(),
      isPosted: false,
      generatedAt,
      fromCompanyId,
      toCompanyId
    })

    return Chunk.of(entry)
  })

/**
 * Generate unrealized profit elimination entries
 */
const generateUnrealizedProfitEliminations = (
  rule: EliminationRule,
  balances: Chunk.Chunk<AccountBalance>,
  groupId: ConsolidationGroupId,
  periodRef: FiscalPeriodRef,
  transactionDate: LocalDate,
  currency: CurrencyCode,
  generatedAt: Timestamp,
  repository: EliminationRepositoryService
): Effect.Effect<Chunk.Chunk<EliminationEntry>> =>
  Effect.gen(function* () {
    // For unrealized profit, the balances represent the profit to eliminate
    const totalProfit = calculateTotalBalance(balances, currency)

    if (totalProfit.isZero) {
      return Chunk.empty()
    }

    const entryId = yield* repository.generateEntryId()
    const debitLineId = yield* repository.generateLineId()
    const creditLineId = yield* repository.generateLineId()

    const eliminationAmount = totalProfit.abs()
    const description = getEliminationDescription(rule.eliminationType, rule.id)

    // Get from/to from first balance if available
    const firstBalance = Chunk.head(balances)
    const fromCompanyId = Option.map(firstBalance, (b) => b.companyId)
    const toCompanyId = Option.flatMap(firstBalance, (b) => b.intercompanyPartnerId)

    const debitLine = EliminationEntryLine.make({
      id: debitLineId,
      lineNumber: 1,
      accountId: rule.debitAccountId,
      debitAmount: Option.some(eliminationAmount),
      creditAmount: Option.none(),
      memo: Option.some(`Unrealized profit elimination debit - ${rule.name}`)
    })

    const creditLine = EliminationEntryLine.make({
      id: creditLineId,
      lineNumber: 2,
      accountId: rule.creditAccountId,
      debitAmount: Option.none(),
      creditAmount: Option.some(eliminationAmount),
      memo: Option.some(`Unrealized profit elimination credit - ${rule.name}`)
    })

    const entry = EliminationEntry.make({
      id: entryId,
      groupId,
      ruleId: rule.id,
      eliminationType: rule.eliminationType,
      periodRef,
      transactionDate,
      description,
      currency,
      amount: eliminationAmount,
      lines: Chunk.make(debitLine, creditLine),
      journalEntryId: Option.none(),
      isPosted: false,
      generatedAt,
      fromCompanyId,
      toCompanyId
    })

    return Chunk.of(entry)
  })

/**
 * EliminationServiceLive - Live implementation of EliminationService
 *
 * Requires EliminationRepository
 */
export const EliminationServiceLive: Layer.Layer<
  EliminationService,
  never,
  EliminationRepository
> = Layer.effect(EliminationService, make)
