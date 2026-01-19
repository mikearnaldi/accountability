/**
 * IntercompanyService - Service for matching intercompany transactions
 *
 * Per ASC 810, intercompany transactions must be matched and reconciled
 * between related companies for consolidation purposes. This service
 * provides functionality to:
 * - Match transactions by type, date (within tolerance), amount, and partner
 * - Identify unmatched transactions on each side
 * - Calculate variances for partial matches
 * - Generate matching reports with discrepancy details
 *
 * @module IntercompanyService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { CompanyId } from "../company/Company.ts"
import { ConsolidationGroupId } from "./ConsolidationGroup.ts"
import { FiscalPeriodRef } from "../fiscal/FiscalPeriodRef.ts"
import {
  IntercompanyTransaction,
  IntercompanyTransactionId,
  type MatchingStatus
} from "./IntercompanyTransaction.ts"
import { LocalDate, diffInDays } from "../shared/values/LocalDate.ts"
import { type CurrencyMismatchError, MonetaryAmount, subtract } from "../shared/values/MonetaryAmount.ts"
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
 * Union type for all intercompany service errors
 */
export type IntercompanyServiceError =
  | ConsolidationGroupNotFoundError
  | FiscalPeriodNotFoundError
  | CurrencyMismatchError

// =============================================================================
// Matching Configuration
// =============================================================================

/**
 * MatchingConfig - Configuration for transaction matching
 *
 * Defines tolerance levels for matching transactions between companies.
 */
export class MatchingConfig extends Schema.Class<MatchingConfig>("MatchingConfig")({
  /**
   * Date tolerance in days - transactions within this range are considered date-matched
   * Default: 3 days
   */
  dateTolerance: Schema.propertySignature(Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0)
  )).pipe(Schema.withConstructorDefault(() => 3)),

  /**
   * Amount tolerance as a percentage (0-100)
   * Transactions with amounts within this percentage are considered amount-matched
   * Default: 0 (exact match required)
   */
  amountTolerancePercent: Schema.propertySignature(Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(100)
  )).pipe(Schema.withConstructorDefault(() => 0))
}) {}

/**
 * Type guard for MatchingConfig
 */
export const isMatchingConfig = Schema.is(MatchingConfig)

/**
 * Default matching configuration
 */
export const defaultMatchingConfig = MatchingConfig.make({})

// =============================================================================
// Match Result Types
// =============================================================================

/**
 * MatchedPair - Represents a matched pair of transactions between two companies
 */
export class MatchedPair extends Schema.Class<MatchedPair>("MatchedPair")({
  /**
   * Transaction from the "from" company (seller/lender)
   */
  fromTransaction: IntercompanyTransaction,

  /**
   * Transaction from the "to" company (buyer/borrower)
   */
  toTransaction: IntercompanyTransaction,

  /**
   * The variance amount if any (from amount - to amount)
   */
  varianceAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Whether this is an exact match (no variance)
   */
  isExactMatch: Schema.Boolean
}) {
  /**
   * Get the variance percentage relative to the from transaction
   */
  get variancePercentage(): Option.Option<number> {
    if (Option.isNone(this.varianceAmount)) return Option.none()
    if (this.fromTransaction.amount.isZero) return Option.none()

    const variance = Option.getOrThrow(this.varianceAmount)
    const ratio = BigDecimal.divide(variance.amount, this.fromTransaction.amount.amount)
    if (Option.isNone(ratio)) return Option.none()

    return Option.some(BigDecimal.unsafeToNumber(Option.getOrThrow(ratio)) * 100)
  }
}

/**
 * Type guard for MatchedPair
 */
export const isMatchedPair = Schema.is(MatchedPair)

/**
 * UnmatchedTransaction - Represents a transaction with no matching counterpart
 */
export class UnmatchedTransaction extends Schema.Class<UnmatchedTransaction>("UnmatchedTransaction")({
  /**
   * The unmatched transaction
   */
  transaction: IntercompanyTransaction,

  /**
   * Which side is missing - "from" means no matching transaction from the from company,
   * "to" means no matching transaction from the to company
   */
  missingSide: Schema.Literal("from", "to"),

  /**
   * Possible reason for being unmatched
   */
  reason: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {}

/**
 * Type guard for UnmatchedTransaction
 */
export const isUnmatchedTransaction = Schema.is(UnmatchedTransaction)

/**
 * DiscrepancyDetail - Detailed information about a discrepancy
 */
export class DiscrepancyDetail extends Schema.Class<DiscrepancyDetail>("DiscrepancyDetail")({
  /**
   * Type of discrepancy
   */
  discrepancyType: Schema.Literal("DateMismatch", "AmountMismatch", "TypeMismatch", "MissingCounterpart"),

  /**
   * From company ID
   */
  fromCompanyId: CompanyId,

  /**
   * To company ID
   */
  toCompanyId: CompanyId,

  /**
   * Transaction type
   */
  transactionType: Schema.Literal(
    "SalePurchase",
    "Loan",
    "ManagementFee",
    "Dividend",
    "CapitalContribution",
    "CostAllocation",
    "Royalty"
  ),

  /**
   * Expected amount (from the from company)
   */
  expectedAmount: MonetaryAmount,

  /**
   * Actual amount (from the to company, if available)
   */
  actualAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Variance amount
   */
  varianceAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Expected date
   */
  expectedDate: LocalDate,

  /**
   * Actual date (if available)
   */
  actualDate: Schema.OptionFromNullOr(LocalDate),

  /**
   * Date difference in days
   */
  dateDifference: Schema.OptionFromNullOr(Schema.Number),

  /**
   * Description of the discrepancy
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * Related transaction IDs
   */
  relatedTransactionIds: Schema.Chunk(IntercompanyTransactionId)
}) {}

/**
 * Type guard for DiscrepancyDetail
 */
export const isDiscrepancyDetail = Schema.is(DiscrepancyDetail)

/**
 * MatchingReport - Summary report of intercompany transaction matching
 */
export class MatchingReport extends Schema.Class<MatchingReport>("MatchingReport")({
  /**
   * Consolidation group ID
   */
  groupId: ConsolidationGroupId,

  /**
   * Fiscal period reference
   */
  periodRef: FiscalPeriodRef,

  /**
   * When the matching was performed
   */
  matchedAt: Timestamp,

  /**
   * Matching configuration used
   */
  config: MatchingConfig,

  /**
   * Total number of transactions analyzed
   */
  totalTransactions: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

  /**
   * Number of matched pairs
   */
  matchedCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

  /**
   * Number of unmatched transactions
   */
  unmatchedCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

  /**
   * Number of partial matches (with variance)
   */
  partialMatchCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

  /**
   * Total variance amount across all partial matches
   */
  totalVarianceAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * List of discrepancy details
   */
  discrepancies: Schema.Chunk(DiscrepancyDetail)
}) {
  /**
   * Match rate as a percentage
   */
  get matchRate(): number {
    if (this.totalTransactions === 0) return 100
    return (this.matchedCount * 2) / this.totalTransactions * 100
  }

  /**
   * Check if all transactions are matched
   */
  get isFullyMatched(): boolean {
    return this.unmatchedCount === 0 && this.partialMatchCount === 0
  }

  /**
   * Check if there are any discrepancies
   */
  get hasDiscrepancies(): boolean {
    return Chunk.isNonEmpty(this.discrepancies)
  }

  /**
   * Get the number of discrepancies
   */
  get discrepancyCount(): number {
    return Chunk.size(this.discrepancies)
  }
}

/**
 * Type guard for MatchingReport
 */
export const isMatchingReport = Schema.is(MatchingReport)

/**
 * MatchingResult - Complete result of intercompany transaction matching
 */
export class MatchingResult extends Schema.Class<MatchingResult>("MatchingResult")({
  /**
   * Matched pairs of transactions
   */
  matchedPairs: Schema.Chunk(MatchedPair),

  /**
   * Unmatched transactions
   */
  unmatchedTransactions: Schema.Chunk(UnmatchedTransaction),

  /**
   * Matching report with summary and discrepancy details
   */
  report: MatchingReport
}) {
  /**
   * Get count of matched pairs
   */
  get matchedCount(): number {
    return Chunk.size(this.matchedPairs)
  }

  /**
   * Get count of unmatched transactions
   */
  get unmatchedCount(): number {
    return Chunk.size(this.unmatchedTransactions)
  }

  /**
   * Get exact match pairs (no variance)
   */
  get exactMatches(): Chunk.Chunk<MatchedPair> {
    return Chunk.filter(this.matchedPairs, (pair) => pair.isExactMatch)
  }

  /**
   * Get partial match pairs (with variance)
   */
  get partialMatches(): Chunk.Chunk<MatchedPair> {
    return Chunk.filter(this.matchedPairs, (pair) => !pair.isExactMatch)
  }

  /**
   * Get unmatched transactions missing the "from" side
   */
  get unmatchedFromSide(): Chunk.Chunk<UnmatchedTransaction> {
    return Chunk.filter(this.unmatchedTransactions, (u) => u.missingSide === "from")
  }

  /**
   * Get unmatched transactions missing the "to" side
   */
  get unmatchedToSide(): Chunk.Chunk<UnmatchedTransaction> {
    return Chunk.filter(this.unmatchedTransactions, (u) => u.missingSide === "to")
  }
}

/**
 * Type guard for MatchingResult
 */
export const isMatchingResult = Schema.is(MatchingResult)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * IntercompanyTransactionRepository - Repository interface for intercompany transactions
 */
export interface IntercompanyTransactionRepositoryService {
  /**
   * Find all intercompany transactions for a consolidation group and period
   */
  readonly findByGroupAndPeriod: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef
  ) => Effect.Effect<Chunk.Chunk<IntercompanyTransaction>>

  /**
   * Check if a consolidation group exists
   */
  readonly groupExists: (groupId: ConsolidationGroupId) => Effect.Effect<boolean>

  /**
   * Check if a fiscal period exists
   */
  readonly periodExists: (periodRef: FiscalPeriodRef) => Effect.Effect<boolean>

  /**
   * Update the matching status of transactions
   */
  readonly updateMatchingStatus: (
    transactionIds: ReadonlyArray<IntercompanyTransactionId>,
    status: MatchingStatus,
    varianceAmount?: MonetaryAmount,
    varianceExplanation?: string
  ) => Effect.Effect<void>
}

/**
 * IntercompanyTransactionRepository Context.Tag
 */
export class IntercompanyTransactionRepository extends Context.Tag("IntercompanyTransactionRepository")<
  IntercompanyTransactionRepository,
  IntercompanyTransactionRepositoryService
>() {}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * IntercompanyServiceShape - Service interface for intercompany transaction operations
 */
export interface IntercompanyServiceShape {
  /**
   * Match intercompany transactions for a consolidation group and period
   *
   * Matches transactions by:
   * - Transaction type (exact match)
   * - Date (within tolerance)
   * - Amount (within tolerance)
   * - Partner company (matching from/to pairs)
   *
   * Identifies unmatched transactions and calculates variances for partial matches.
   *
   * @param groupId - The consolidation group ID
   * @param periodRef - The fiscal period reference
   * @param config - Optional matching configuration (uses defaults if not provided)
   * @returns Effect containing the matching result
   */
  readonly matchTransactions: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    config?: MatchingConfig
  ) => Effect.Effect<MatchingResult, IntercompanyServiceError>
}

/**
 * IntercompanyService Context.Tag
 */
export class IntercompanyService extends Context.Tag("IntercompanyService")<
  IntercompanyService,
  IntercompanyServiceShape
>() {}

// =============================================================================
// Matching Logic
// =============================================================================

/**
 * Check if two transactions match by criteria (excluding status checks)
 */
const transactionsMatch = (
  from: IntercompanyTransaction,
  to: IntercompanyTransaction,
  config: MatchingConfig
): { matches: boolean; isExact: boolean; variance: Option.Option<MonetaryAmount> } => {
  // Must have opposite from/to company pairs
  if (from.fromCompanyId !== to.toCompanyId || from.toCompanyId !== to.fromCompanyId) {
    return { matches: false, isExact: false, variance: Option.none() }
  }

  // Must be same transaction type
  if (from.transactionType !== to.transactionType) {
    return { matches: false, isExact: false, variance: Option.none() }
  }

  // Check date tolerance
  const dateDiff = Math.abs(diffInDays(from.transactionDate, to.transactionDate))
  if (dateDiff > config.dateTolerance) {
    return { matches: false, isExact: false, variance: Option.none() }
  }

  // Check amount - must be same currency first
  if (from.amount.currency !== to.amount.currency) {
    return { matches: false, isExact: false, variance: Option.none() }
  }

  // Calculate variance
  const varianceResult = Effect.runSync(subtract(from.amount, to.amount))
  const varianceAbs = varianceResult.abs()

  // Check if within tolerance
  if (config.amountTolerancePercent === 0) {
    // Exact match required
    if (!varianceResult.isZero) {
      // Has variance - partial match
      return {
        matches: true,
        isExact: false,
        variance: Option.some(varianceResult)
      }
    }
    return { matches: true, isExact: true, variance: Option.none() }
  }

  // Calculate tolerance amount
  const toleranceRatio = BigDecimal.unsafeFromNumber(config.amountTolerancePercent / 100)
  const toleranceAmount = BigDecimal.multiply(from.amount.amount, toleranceRatio)

  if (BigDecimal.lessThanOrEqualTo(varianceAbs.amount, BigDecimal.abs(toleranceAmount))) {
    return {
      matches: true,
      isExact: varianceResult.isZero,
      variance: varianceResult.isZero ? Option.none() : Option.some(varianceResult)
    }
  }

  return { matches: false, isExact: false, variance: Option.none() }
}

/**
 * Group transactions by company pair (from, to) for efficient matching
 */
const groupByCompanyPair = (
  transactions: Chunk.Chunk<IntercompanyTransaction>
): Map<string, Chunk.Chunk<IntercompanyTransaction>> => {
  const groups = new Map<string, IntercompanyTransaction[]>()

  for (const tx of transactions) {
    const key = `${tx.fromCompanyId}|${tx.toCompanyId}`
    const existing = groups.get(key) || []
    existing.push(tx)
    groups.set(key, existing)
  }

  const result = new Map<string, Chunk.Chunk<IntercompanyTransaction>>()
  for (const [key, value] of groups) {
    result.set(key, Chunk.fromIterable(value))
  }
  return result
}

/**
 * Create a discrepancy detail for an unmatched transaction
 */
const createUnmatchedDiscrepancy = (
  tx: IntercompanyTransaction,
  missingSide: "from" | "to"
): DiscrepancyDetail => {
  return DiscrepancyDetail.make({
    discrepancyType: "MissingCounterpart",
    fromCompanyId: tx.fromCompanyId,
    toCompanyId: tx.toCompanyId,
    transactionType: tx.transactionType,
    expectedAmount: tx.amount,
    actualAmount: Option.none(),
    varianceAmount: Option.some(tx.amount),
    expectedDate: tx.transactionDate,
    actualDate: Option.none(),
    dateDifference: Option.none(),
    description: `Missing counterpart transaction on the ${missingSide} side for ${tx.transactionType} transaction`,
    relatedTransactionIds: Chunk.of(tx.id)
  })
}

/**
 * Create a discrepancy detail for a partial match
 */
const createPartialMatchDiscrepancy = (
  pair: MatchedPair
): Option.Option<DiscrepancyDetail> => {
  if (Option.isNone(pair.varianceAmount)) return Option.none()

  const dateDiff = diffInDays(pair.fromTransaction.transactionDate, pair.toTransaction.transactionDate)

  return Option.some(DiscrepancyDetail.make({
    discrepancyType: "AmountMismatch",
    fromCompanyId: pair.fromTransaction.fromCompanyId,
    toCompanyId: pair.fromTransaction.toCompanyId,
    transactionType: pair.fromTransaction.transactionType,
    expectedAmount: pair.fromTransaction.amount,
    actualAmount: Option.some(pair.toTransaction.amount),
    varianceAmount: pair.varianceAmount,
    expectedDate: pair.fromTransaction.transactionDate,
    actualDate: Option.some(pair.toTransaction.transactionDate),
    dateDifference: Option.some(dateDiff),
    description: `Amount variance of ${Option.getOrThrow(pair.varianceAmount).format()} ${pair.fromTransaction.amount.currency} between companies`,
    relatedTransactionIds: Chunk.make(pair.fromTransaction.id, pair.toTransaction.id)
  }))
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the IntercompanyService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* IntercompanyTransactionRepository

  return {
    matchTransactions: (
      groupId: ConsolidationGroupId,
      periodRef: FiscalPeriodRef,
      config?: MatchingConfig
    ) =>
      Effect.gen(function* () {
        const matchConfig = config ?? defaultMatchingConfig

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

        // Fetch all transactions for the group and period
        const transactions = yield* repository.findByGroupAndPeriod(groupId, periodRef)

        // If no transactions, return empty result
        if (Chunk.isEmpty(transactions)) {
          const now = yield* nowEffect
          return MatchingResult.make({
            matchedPairs: Chunk.empty(),
            unmatchedTransactions: Chunk.empty(),
            report: MatchingReport.make({
              groupId,
              periodRef,
              matchedAt: now,
              config: matchConfig,
              totalTransactions: 0,
              matchedCount: 0,
              unmatchedCount: 0,
              partialMatchCount: 0,
              totalVarianceAmount: Option.none(),
              discrepancies: Chunk.empty()
            })
          })
        }

        // Group transactions by company pair
        const groupedByPair = groupByCompanyPair(transactions)

        // Track matched and unmatched transactions
        const matchedPairs: MatchedPair[] = []
        const unmatchedTransactions: UnmatchedTransaction[] = []
        // Track all processed transaction IDs (matched, unmatched, or part of pair we already handled)
        const processedIds = new Set<IntercompanyTransactionId>()

        // For each company pair, find matching reverse pairs
        for (const [pairKey, pairTransactions] of groupedByPair) {
          const [fromCompanyId, toCompanyId] = pairKey.split("|")
          const reversePairKey = `${toCompanyId}|${fromCompanyId}`
          const reverseTransactions = groupedByPair.get(reversePairKey) || Chunk.empty()

          // Track which reverse transactions have been matched in this iteration
          const matchedReverseIds = new Set<IntercompanyTransactionId>()

          // Try to match each transaction with a reverse transaction
          for (const fromTx of pairTransactions) {
            // Skip if already processed (either matched or marked unmatched)
            if (processedIds.has(fromTx.id)) continue

            let foundMatch = false

            for (const toTx of reverseTransactions) {
              // Skip if already matched in this iteration or already processed globally
              if (matchedReverseIds.has(toTx.id) || processedIds.has(toTx.id)) continue

              const matchResult = transactionsMatch(fromTx, toTx, matchConfig)
              if (matchResult.matches) {
                matchedPairs.push(MatchedPair.make({
                  fromTransaction: fromTx,
                  toTransaction: toTx,
                  varianceAmount: matchResult.variance,
                  isExactMatch: matchResult.isExact
                }))
                processedIds.add(fromTx.id)
                processedIds.add(toTx.id)
                matchedReverseIds.add(toTx.id)
                foundMatch = true
                break
              }
            }

            if (!foundMatch) {
              unmatchedTransactions.push(UnmatchedTransaction.make({
                transaction: fromTx,
                missingSide: "to",
                reason: Option.some("No matching counterpart transaction found")
              }))
              processedIds.add(fromTx.id)
            }
          }

          // Add reverse transactions that weren't matched (and not already processed)
          for (const toTx of reverseTransactions) {
            if (!processedIds.has(toTx.id)) {
              unmatchedTransactions.push(UnmatchedTransaction.make({
                transaction: toTx,
                missingSide: "from",
                reason: Option.some("No matching counterpart transaction found")
              }))
              processedIds.add(toTx.id)
            }
          }
        }

        // Build discrepancies list
        const discrepancies: DiscrepancyDetail[] = []

        // Add discrepancies for unmatched transactions
        for (const unmatched of unmatchedTransactions) {
          discrepancies.push(createUnmatchedDiscrepancy(unmatched.transaction, unmatched.missingSide))
        }

        // Add discrepancies for partial matches
        for (const pair of matchedPairs) {
          const discrepancy = createPartialMatchDiscrepancy(pair)
          if (Option.isSome(discrepancy)) {
            discrepancies.push(Option.getOrThrow(discrepancy))
          }
        }

        // Calculate total variance
        let totalVariance: Option.Option<MonetaryAmount> = Option.none()
        const partialMatchCount = matchedPairs.filter(p => !p.isExactMatch).length

        if (partialMatchCount > 0 && matchedPairs.length > 0) {
          const firstCurrency = matchedPairs[0].fromTransaction.amount.currency
          let totalVarianceAmount = MonetaryAmount.zero(firstCurrency)

          for (const pair of matchedPairs) {
            if (Option.isSome(pair.varianceAmount)) {
              const variance = Option.getOrThrow(pair.varianceAmount)
              if (variance.currency === firstCurrency) {
                // Subtract variance from total - currency mismatch is impossible here
                // since we already filter by currency, but if it happens, let it fail
                // rather than silently swallowing the error
                totalVarianceAmount = yield* subtract(totalVarianceAmount, variance.negate())
              }
            }
          }

          if (!totalVarianceAmount.isZero) {
            totalVariance = Option.some(totalVarianceAmount)
          }
        }

        // Create the report
        const now = yield* nowEffect
        const report = MatchingReport.make({
          groupId,
          periodRef,
          matchedAt: now,
          config: matchConfig,
          totalTransactions: Chunk.size(transactions),
          matchedCount: matchedPairs.length,
          unmatchedCount: unmatchedTransactions.length,
          partialMatchCount,
          totalVarianceAmount: totalVariance,
          discrepancies: Chunk.fromIterable(discrepancies)
        })

        return MatchingResult.make({
          matchedPairs: Chunk.fromIterable(matchedPairs),
          unmatchedTransactions: Chunk.fromIterable(unmatchedTransactions),
          report
        })
      })
  } satisfies IntercompanyServiceShape
})

/**
 * IntercompanyServiceLive - Live implementation of IntercompanyService
 *
 * Requires IntercompanyTransactionRepository
 */
export const IntercompanyServiceLive: Layer.Layer<
  IntercompanyService,
  never,
  IntercompanyTransactionRepository
> = Layer.effect(IntercompanyService, make)
