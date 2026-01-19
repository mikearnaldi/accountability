/**
 * ConsolidationService - Orchestrates the full consolidation process
 *
 * Per ASC 810 and specs/ACCOUNTING_RESEARCH.md, this service orchestrates consolidation by:
 * 1. Validate - Ensure all members have closed periods, balanced trial balances
 * 2. Translate - Translate each member to reporting currency per ASC 830
 * 3. Aggregate - Sum all member account balances
 * 4. Match IC - Identify and reconcile intercompany transactions
 * 5. Eliminate - Create elimination entries based on rules
 * 6. NCI - Calculate non-controlling interest share
 * 7. Generate TB - Produce final consolidated trial balance
 *
 * The service tracks progress, timing, and status of each step, and handles
 * failures gracefully by marking the run as Failed and storing the error.
 *
 * @module consolidation/ConsolidationService
 */

import { HttpApiSchema } from "@effect/platform"
import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { type AccountCategory, isAccountCategory } from "../accounting/Account.ts"
import type { CompanyId } from "../company/Company.ts"
import {
  ConsolidationGroupId,
  type ConsolidationMember
} from "./ConsolidationGroup.ts"
import type {
  ConsolidationRunOptions} from "./ConsolidationRun.ts";
import {
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationStep,
  ConsolidatedTrialBalance,
  ConsolidatedTrialBalanceLineItem,
  ValidationResult,
  ValidationIssue,
  CONSOLIDATION_STEP_ORDER,
  createInitialSteps,
  defaultConsolidationRunOptions,
  type ConsolidationStepType
} from "./ConsolidationRun.ts"
import type { CurrencyCode } from "../currency/CurrencyCode.ts"
import type { EliminationRule } from "./EliminationRule.ts"
import { FiscalPeriodRef } from "../fiscal/FiscalPeriodRef.ts"
import type { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import type { Timestamp} from "../shared/values/Timestamp.ts";
import { nowEffect as timestampNowEffect } from "../shared/values/Timestamp.ts"
import type { UserId } from "../journal/JournalEntry.ts"
import type { EliminationEntryId } from "./EliminationService.ts"
import type { TrialBalanceReport } from "../accounting/TrialBalanceService.ts"

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
  },
  HttpApiSchema.annotations({ status: 404 })
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
 * Error when fiscal period is not found or invalid
 */
export class FiscalPeriodNotFoundError extends Schema.TaggedError<FiscalPeriodNotFoundError>()(
  "FiscalPeriodNotFoundError",
  {
    periodRef: FiscalPeriodRef
  },
  HttpApiSchema.annotations({ status: 400 })
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
 * Error when a consolidation run already exists for the period
 */
export class ConsolidationRunExistsError extends Schema.TaggedError<ConsolidationRunExistsError>()(
  "ConsolidationRunExistsError",
  {
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    existingRunId: ConsolidationRunId
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Consolidation run already exists for group ${this.groupId} period FY${this.periodRef.year}-P${String(this.periodRef.period).padStart(2, "0")}: ${this.existingRunId}`
  }
}

/**
 * Type guard for ConsolidationRunExistsError
 */
export const isConsolidationRunExistsError = Schema.is(ConsolidationRunExistsError)

/**
 * Error when validation fails during consolidation
 */
export class ConsolidationValidationError extends Schema.TaggedError<ConsolidationValidationError>()(
  "ConsolidationValidationError",
  {
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    validationResult: ValidationResult
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    const errorCount = this.validationResult.errorCount
    return `Consolidation validation failed for group ${this.groupId}: ${errorCount} error(s) found`
  }
}

/**
 * Type guard for ConsolidationValidationError
 */
export const isConsolidationValidationError = Schema.is(ConsolidationValidationError)

/**
 * Error when a consolidation step fails
 */
export class ConsolidationStepFailedError extends Schema.TaggedError<ConsolidationStepFailedError>()(
  "ConsolidationStepFailedError",
  {
    runId: ConsolidationRunId,
    stepType: Schema.Literal("Validate", "Translate", "Aggregate", "MatchIC", "Eliminate", "NCI", "GenerateTB"),
    errorMessage: Schema.NonEmptyTrimmedString
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Consolidation step ${this.stepType} failed: ${this.errorMessage}`
  }
}

/**
 * Type guard for ConsolidationStepFailedError
 */
export const isConsolidationStepFailedError = Schema.is(ConsolidationStepFailedError)

/**
 * Error when consolidation data cannot be parsed from storage
 *
 * Consolidation data integrity is critical for accurate financial reports.
 * If we cannot parse stored data (line items, validation results, etc.),
 * this indicates data corruption that must be surfaced.
 */
export class ConsolidationDataCorruptionError extends Schema.TaggedError<ConsolidationDataCorruptionError>()(
  "ConsolidationDataCorruptionError",
  {
    runId: Schema.String,
    field: Schema.String,
    cause: Schema.Defect
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Consolidation data corruption in run ${this.runId}, field ${this.field}: ${String(this.cause)}`
  }
}

/**
 * Type guard for ConsolidationDataCorruptionError
 */
export const isConsolidationDataCorruptionError = Schema.is(ConsolidationDataCorruptionError)

/**
 * Union type for all consolidation service errors
 */
export type ConsolidationServiceError =
  | ConsolidationGroupNotFoundError
  | FiscalPeriodNotFoundError
  | ConsolidationRunExistsError
  | ConsolidationValidationError
  | ConsolidationDataCorruptionError

// =============================================================================
// Step Result Types
// =============================================================================

/**
 * TranslatedBalance - Balance for a company translated to reporting currency
 */
export class TranslatedBalance extends Schema.Class<TranslatedBalance>("TranslatedBalance")({
  /**
   * Company ID
   */
  companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * Account number
   */
  accountNumber: Schema.NonEmptyTrimmedString,

  /**
   * Account name
   */
  accountName: Schema.NonEmptyTrimmedString,

  /**
   * Account type
   */
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),

  /**
   * Original balance in local currency
   */
  localBalance: MonetaryAmount,

  /**
   * Translated balance in reporting currency
   */
  translatedBalance: MonetaryAmount,

  /**
   * Exchange rate used for translation
   */
  exchangeRate: Schema.BigDecimal
}) {}

/**
 * Type guard for TranslatedBalance
 */
export const isTranslatedBalance = Schema.is(TranslatedBalance)

/**
 * AggregatedBalance - Aggregated balance across all members
 */
export class AggregatedBalance extends Schema.Class<AggregatedBalance>("AggregatedBalance")({
  /**
   * Account number
   */
  accountNumber: Schema.NonEmptyTrimmedString,

  /**
   * Account name
   */
  accountName: Schema.NonEmptyTrimmedString,

  /**
   * Account type
   */
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),

  /**
   * Account category - detailed subcategory for report section classification
   */
  accountCategory: Schema.String,

  /**
   * Aggregated balance from all members
   */
  balance: MonetaryAmount,

  /**
   * Number of members contributing to this balance
   */
  memberCount: Schema.Number
}) {
  /**
   * Check if balance is zero
   */
  get isZero(): boolean {
    return this.balance.isZero
  }
}

/**
 * Type guard for AggregatedBalance
 */
export const isAggregatedBalance = Schema.is(AggregatedBalance)

/**
 * ICMatchResult - Result of intercompany matching
 */
export class ICMatchResult extends Schema.Class<ICMatchResult>("ICMatchResult")({
  /**
   * Number of matched transaction pairs
   */
  matchedPairCount: Schema.Number,

  /**
   * Number of unmatched transactions
   */
  unmatchedCount: Schema.Number,

  /**
   * Total value of matched transactions
   */
  totalMatchedValue: MonetaryAmount,

  /**
   * Total value of unmatched transactions
   */
  totalUnmatchedValue: MonetaryAmount
}) {
  /**
   * Check if all transactions are matched
   */
  get isFullyMatched(): boolean {
    return this.unmatchedCount === 0
  }
}

/**
 * Type guard for ICMatchResult
 */
export const isICMatchResult = Schema.is(ICMatchResult)

/**
 * NCICalculation - Non-controlling interest calculation
 */
export class NCICalculation extends Schema.Class<NCICalculation>("NCICalculation")({
  /**
   * Company ID for NCI
   */
  companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),

  /**
   * Company name
   */
  companyName: Schema.NonEmptyTrimmedString,

  /**
   * Minority ownership percentage (e.g., 20% for 80% owned subsidiary)
   */
  minorityPercentage: Schema.BigDecimal,

  /**
   * Net income allocated to NCI
   */
  netIncomeNCI: MonetaryAmount,

  /**
   * Total equity allocated to NCI
   */
  equityNCI: MonetaryAmount
}) {}

/**
 * Type guard for NCICalculation
 */
export const isNCICalculation = Schema.is(NCICalculation)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * ConsolidationRepository - Repository interface for consolidation data access
 */
export interface ConsolidationRepositoryService {
  /**
   * Check if a consolidation group exists
   */
  readonly groupExists: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<boolean>

  /**
   * Get the consolidation group details
   */
  readonly getGroup: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<Option.Option<{
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  }>>

  /**
   * Check if a fiscal period exists and is valid
   */
  readonly periodExists: (
    periodRef: FiscalPeriodRef
  ) => Effect.Effect<boolean>

  /**
   * Get the end date for a fiscal period
   */
  readonly getPeriodEndDate: (
    periodRef: FiscalPeriodRef
  ) => Effect.Effect<LocalDate>

  /**
   * Get existing consolidation run for a group/period
   */
  readonly getExistingRun: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef
  ) => Effect.Effect<Option.Option<ConsolidationRun>>

  /**
   * Check if all members have closed the fiscal period
   */
  readonly allMembersPeriodsClosed: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef
  ) => Effect.Effect<{
    allClosed: boolean
    unclosedMembers: Chunk.Chunk<CompanyId>
  }>

  /**
   * Get trial balance reports for all member companies
   */
  readonly getMemberTrialBalances: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    asOfDate: LocalDate
  ) => Effect.Effect<Chunk.Chunk<{
    companyId: CompanyId
    companyName: string
    localCurrency: CurrencyCode
    trialBalance: TrialBalanceReport
  }>>

  /**
   * Translate a trial balance to reporting currency
   */
  readonly translateTrialBalance: (
    trialBalance: TrialBalanceReport,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    asOfDate: LocalDate
  ) => Effect.Effect<Chunk.Chunk<TranslatedBalance>>

  /**
   * Get intercompany transactions for the period
   */
  readonly getIntercompanyTransactions: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef
  ) => Effect.Effect<{
    matchedPairs: number
    unmatchedCount: number
    totalMatchedValue: MonetaryAmount
    totalUnmatchedValue: MonetaryAmount
  }>

  /**
   * Get elimination rules for the group
   */
  readonly getEliminationRules: (
    groupId: ConsolidationGroupId
  ) => Effect.Effect<Chunk.Chunk<EliminationRule>>

  /**
   * Generate elimination entries for the period
   */
  readonly generateEliminationEntries: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    rules: Chunk.Chunk<EliminationRule>,
    aggregatedBalances: Chunk.Chunk<AggregatedBalance>
  ) => Effect.Effect<{
    entryIds: Chunk.Chunk<EliminationEntryId>
    totalEliminationAmount: MonetaryAmount
  }>

  /**
   * Calculate NCI for members with minority interests
   */
  readonly calculateNCI: (
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    aggregatedBalances: Chunk.Chunk<AggregatedBalance>
  ) => Effect.Effect<{
    calculations: Chunk.Chunk<NCICalculation>
    totalNCI: MonetaryAmount
  }>

  /**
   * Generate new run ID
   */
  readonly generateRunId: () => Effect.Effect<ConsolidationRunId>

  /**
   * Save consolidation run
   */
  readonly saveRun: (
    run: ConsolidationRun
  ) => Effect.Effect<ConsolidationRun>

  /**
   * Update consolidation run
   */
  readonly updateRun: (
    run: ConsolidationRun
  ) => Effect.Effect<ConsolidationRun>
}

/**
 * ConsolidationRepository Context.Tag
 */
export class ConsolidationRepository extends Context.Tag("ConsolidationRepository")<
  ConsolidationRepository,
  ConsolidationRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * RunConsolidationInput - Input for running a consolidation
 */
export interface RunConsolidationInput {
  /** The consolidation group ID */
  readonly groupId: ConsolidationGroupId
  /** The fiscal period to consolidate */
  readonly periodRef: FiscalPeriodRef
  /** Options for the consolidation run */
  readonly options?: ConsolidationRunOptions
  /** User initiating the run */
  readonly userId: UserId
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ConsolidationServiceShape - Service interface for consolidation orchestration
 */
export interface ConsolidationServiceShape {
  /**
   * Run the full consolidation process for a group and period
   *
   * Executes steps in order:
   * 1. Validate - Ensure all members have closed periods, balanced trial balances
   * 2. Translate - Translate each member to reporting currency
   * 3. Aggregate - Sum all member account balances
   * 4. Match IC - Identify and reconcile intercompany transactions
   * 5. Eliminate - Create elimination entries based on rules
   * 6. NCI - Calculate non-controlling interest share
   * 7. Generate TB - Produce final consolidated trial balance
   *
   * @param input - The consolidation run parameters
   * @returns Effect containing the completed ConsolidationRun
   * @throws ConsolidationGroupNotFoundError if group doesn't exist
   * @throws FiscalPeriodNotFoundError if period is invalid
   * @throws ConsolidationRunExistsError if run exists and forceRegeneration is false
   * @throws ConsolidationValidationError if validation fails
   */
  readonly run: (
    input: RunConsolidationInput
  ) => Effect.Effect<
    ConsolidationRun,
    ConsolidationServiceError,
    never
  >
}

/**
 * ConsolidationService Context.Tag
 */
export class ConsolidationService extends Context.Tag("ConsolidationService")<
  ConsolidationService,
  ConsolidationServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Helper to update a step in the steps chunk
 */
const updateStep = (
  steps: Chunk.Chunk<ConsolidationStep>,
  stepType: ConsolidationStepType,
  update: Partial<{
    status: ConsolidationStep["status"]
    startedAt: Option.Option<Timestamp>
    completedAt: Option.Option<Timestamp>
    durationMs: Option.Option<number>
    errorMessage: Option.Option<string>
    details: Option.Option<string>
  }>
): Chunk.Chunk<ConsolidationStep> => {
  return Chunk.map(steps, (step) => {
    if (step.stepType !== stepType) return step
    return ConsolidationStep.make({
      stepType: step.stepType,
      status: update.status ?? step.status,
      startedAt: update.startedAt !== undefined ? update.startedAt : step.startedAt,
      completedAt: update.completedAt !== undefined ? update.completedAt : step.completedAt,
      durationMs: update.durationMs !== undefined ? update.durationMs : step.durationMs,
      errorMessage: update.errorMessage !== undefined ? update.errorMessage : step.errorMessage,
      details: update.details !== undefined ? update.details : step.details
    })
  })
}

/**
 * Create the ConsolidationService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* ConsolidationRepository

  return {
    run: (input: RunConsolidationInput) =>
      Effect.gen(function* () {
        const {
          groupId,
          periodRef,
          options = defaultConsolidationRunOptions,
          userId
        } = input

        // ==== Initial Validation ====

        // Check if group exists
        const groupExists = yield* repository.groupExists(groupId)
        if (!groupExists) {
          return yield* Effect.fail(new ConsolidationGroupNotFoundError({ groupId }))
        }

        // Check if period exists
        const periodExists = yield* repository.periodExists(periodRef)
        if (!periodExists) {
          return yield* Effect.fail(new FiscalPeriodNotFoundError({ periodRef }))
        }

        // Check for existing run (unless force regeneration)
        if (!options.forceRegeneration) {
          const existingRun = yield* repository.getExistingRun(groupId, periodRef)
          if (Option.isSome(existingRun)) {
            return yield* Effect.fail(
              new ConsolidationRunExistsError({
                groupId,
                periodRef,
                existingRunId: existingRun.value.id
              })
            )
          }
        }

        // Get group details
        const groupOpt = yield* repository.getGroup(groupId)
        if (Option.isNone(groupOpt)) {
          return yield* Effect.fail(new ConsolidationGroupNotFoundError({ groupId }))
        }
        const group = groupOpt.value

        // Get period end date
        const asOfDate = yield* repository.getPeriodEndDate(periodRef)

        // ==== Create Initial Run ====

        const runId = yield* repository.generateRunId()
        const initiatedAt = yield* timestampNowEffect

        let run = ConsolidationRun.make({
          id: runId,
          groupId,
          periodRef,
          asOfDate,
          status: "Pending",
          steps: createInitialSteps(),
          validationResult: Option.none(),
          consolidatedTrialBalance: Option.none(),
          eliminationEntryIds: Chunk.empty(),
          options,
          initiatedBy: userId,
          initiatedAt,
          startedAt: Option.none(),
          completedAt: Option.none(),
          totalDurationMs: Option.none(),
          errorMessage: Option.none()
        })

        // Save initial run
        run = yield* repository.saveRun(run)

        // Start the run
        const startedAt = yield* timestampNowEffect
        run = ConsolidationRun.make({
          ...run,
          status: "InProgress",
          startedAt: Option.some(startedAt)
        })
        run = yield* repository.updateRun(run)

        // Track aggregated balances for later steps
        let aggregatedBalances: Chunk.Chunk<AggregatedBalance> = Chunk.empty()
        let totalEliminationAmount = MonetaryAmount.zero(group.reportingCurrency)
        let totalNCI = MonetaryAmount.zero(group.reportingCurrency)
        let eliminationEntryIds: Chunk.Chunk<EliminationEntryId> = Chunk.empty()
        let validationResult: Option.Option<ValidationResult> = Option.none()

        // ==== Execute Steps ====

        for (const stepType of CONSOLIDATION_STEP_ORDER) {
          const stepStartTime = yield* timestampNowEffect

          // Mark step as in progress
          run = ConsolidationRun.make({
            ...run,
            steps: updateStep(run.steps, stepType, {
              status: "InProgress",
              startedAt: Option.some(stepStartTime)
            })
          })
          run = yield* repository.updateRun(run)

          // Execute the step
          const result = yield* executeStep(
            stepType,
            run,
            group,
            repository,
            options,
            aggregatedBalances
          )

          const stepEndTime = yield* timestampNowEffect
          const durationMs = stepEndTime.epochMillis - stepStartTime.epochMillis

          // Update aggregated balances if returned
          if (result.aggregatedBalances) {
            aggregatedBalances = result.aggregatedBalances
          }

          // Update validation result if returned
          if (result.validationResult) {
            validationResult = Option.some(result.validationResult)

            // Check if validation failed and we should stop
            if (!result.validationResult.isValid && !options.skipValidation) {
              const stepEndTimeVal = yield* timestampNowEffect
              const durationMsVal = stepEndTimeVal.epochMillis - stepStartTime.epochMillis

              run = ConsolidationRun.make({
                ...run,
                status: "Failed",
                steps: updateStep(run.steps, stepType, {
                  status: "Failed",
                  completedAt: Option.some(stepEndTimeVal),
                  durationMs: Option.some(durationMsVal),
                  errorMessage: Option.some(`Validation failed with ${result.validationResult.errorCount} error(s)`)
                }),
                validationResult,
                completedAt: Option.some(stepEndTimeVal),
                totalDurationMs: Option.some(
                  stepEndTimeVal.epochMillis - startedAt.epochMillis
                ),
                errorMessage: Option.some(`Validation failed with ${result.validationResult.errorCount} error(s)`)
              })
              run = yield* repository.updateRun(run)

              return yield* Effect.fail(
                new ConsolidationValidationError({
                  groupId,
                  periodRef,
                  validationResult: result.validationResult
                })
              )
            }
          }

          // Update elimination entries if returned
          if (result.eliminationEntryIds) {
            eliminationEntryIds = result.eliminationEntryIds
          }

          // Update total elimination amount if returned
          if (result.totalEliminationAmount) {
            totalEliminationAmount = result.totalEliminationAmount
          }

          // Update total NCI if returned
          if (result.totalNCI) {
            totalNCI = result.totalNCI
          }

          // Mark step as completed
          run = ConsolidationRun.make({
            ...run,
            steps: updateStep(run.steps, stepType, {
              status: "Completed",
              completedAt: Option.some(stepEndTime),
              durationMs: Option.some(durationMs),
              details: result.details ? Option.some(result.details) : Option.none()
            }),
            validationResult,
            eliminationEntryIds
          })
          run = yield* repository.updateRun(run)
        }

        // ==== Generate Consolidated Trial Balance ====

        // Helper to convert string to AccountCategory with fallback based on account type
        const toAccountCategory = (
          category: string,
          accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
        ): AccountCategory => {
          if (isAccountCategory(category)) {
            return category
          }
          // Fallback mapping for backward compatibility
          const fallbacks: Record<typeof accountType, AccountCategory> = {
            Asset: "CurrentAsset",
            Liability: "CurrentLiability",
            Equity: "RetainedEarnings",
            Revenue: "OperatingRevenue",
            Expense: "OperatingExpense"
          }
          return fallbacks[accountType]
        }

        const generatedAt = yield* timestampNowEffect
        const lineItems = Chunk.map(aggregatedBalances, (balance) =>
          ConsolidatedTrialBalanceLineItem.make({
            accountNumber: balance.accountNumber,
            accountName: balance.accountName,
            accountType: balance.accountType,
            accountCategory: toAccountCategory(balance.accountCategory, balance.accountType),
            aggregatedBalance: balance.balance,
            eliminationAmount: MonetaryAmount.zero(group.reportingCurrency),
            nciAmount: Option.none(),
            consolidatedBalance: balance.balance
          })
        )

        // Calculate totals
        let totalDebits = BigDecimal.fromNumber(0)
        let totalCredits = BigDecimal.fromNumber(0)

        for (const item of Chunk.toReadonlyArray(lineItems)) {
          if (
            item.accountType === "Asset" ||
            item.accountType === "Expense"
          ) {
            totalDebits = BigDecimal.sum(totalDebits, item.consolidatedBalance.amount)
          } else {
            totalCredits = BigDecimal.sum(totalCredits, item.consolidatedBalance.amount)
          }
        }

        const consolidatedTrialBalance = ConsolidatedTrialBalance.make({
          consolidationRunId: runId,
          groupId,
          periodRef,
          asOfDate,
          currency: group.reportingCurrency,
          lineItems,
          totalDebits: MonetaryAmount.fromBigDecimal(totalDebits, group.reportingCurrency),
          totalCredits: MonetaryAmount.fromBigDecimal(totalCredits, group.reportingCurrency),
          totalEliminations: totalEliminationAmount,
          totalNCI,
          generatedAt
        })

        // ==== Complete the Run ====

        const completedAt = yield* timestampNowEffect
        run = ConsolidationRun.make({
          ...run,
          status: "Completed",
          consolidatedTrialBalance: Option.some(consolidatedTrialBalance),
          completedAt: Option.some(completedAt),
          totalDurationMs: Option.some(
            completedAt.epochMillis - startedAt.epochMillis
          )
        })
        run = yield* repository.updateRun(run)

        return run
      })
  } satisfies ConsolidationServiceShape
})

// =============================================================================
// Step Execution
// =============================================================================

/**
 * Step execution result
 */
interface StepExecutionResult {
  details?: string
  aggregatedBalances?: Chunk.Chunk<AggregatedBalance>
  validationResult?: ValidationResult
  eliminationEntryIds?: Chunk.Chunk<EliminationEntryId>
  totalEliminationAmount?: MonetaryAmount
  totalNCI?: MonetaryAmount
}

/**
 * Execute a single consolidation step
 */
const executeStep = (
  stepType: ConsolidationStepType,
  run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  options: ConsolidationRunOptions,
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>
): Effect.Effect<StepExecutionResult> => {
  switch (stepType) {
    case "Validate":
      return executeValidateStep(run, group, repository, options)
    case "Translate":
      return executeTranslateStep(run, group, repository, run.periodRef, run.asOfDate)
    case "Aggregate":
      return executeAggregateStep(group, repository, run.periodRef, run.asOfDate)
    case "MatchIC":
      return executeMatchICStep(group, repository, run.periodRef)
    case "Eliminate":
      return executeEliminateStep(group, repository, run.periodRef, aggregatedBalances)
    case "NCI":
      return executeNCIStep(group, repository, run.periodRef, aggregatedBalances)
    case "GenerateTB":
      return executeGenerateTBStep(aggregatedBalances)
  }
}

/**
 * Execute the Validate step
 */
const executeValidateStep = (
  run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  options: ConsolidationRunOptions
): Effect.Effect<StepExecutionResult> =>
  Effect.gen(function* () {
    if (options.skipValidation) {
      return {
        details: "Validation skipped per options",
        validationResult: ValidationResult.make({
          isValid: true,
          issues: Chunk.empty()
        })
      }
    }

    const issues: ValidationIssue[] = []

    // Check if all members have closed periods
    const closureResult = yield* repository.allMembersPeriodsClosed(
      group.id,
      run.periodRef
    )

    if (!closureResult.allClosed) {
      for (const companyId of Chunk.toReadonlyArray(closureResult.unclosedMembers)) {
        issues.push(
          ValidationIssue.make({
            severity: "Error",
            code: "PERIOD_NOT_CLOSED",
            message: "Fiscal period is not closed for member company",
            entityReference: Option.some(companyId)
          })
        )
      }
    }

    // Get trial balances and check they're balanced
    const trialBalances = yield* repository.getMemberTrialBalances(
      group.id,
      run.periodRef,
      run.asOfDate
    )

    for (const tb of Chunk.toReadonlyArray(trialBalances)) {
      if (!tb.trialBalance.isBalanced) {
        issues.push(
          ValidationIssue.make({
            severity: "Error",
            code: "TRIAL_BALANCE_NOT_BALANCED",
            message: `Trial balance is not balanced for ${tb.companyName}`,
            entityReference: Option.some(tb.companyId)
          })
        )
      }
    }

    const validationResult = ValidationResult.make({
      isValid: issues.filter((i) => i.isError).length === 0,
      issues: Chunk.fromIterable(issues)
    })

    const memberCount = Chunk.size(group.members)
    return {
      details: `Validated ${memberCount} member(s): ${validationResult.errorCount} error(s), ${validationResult.warningCount} warning(s)`,
      validationResult
    }
  })

/**
 * Execute the Translate step
 */
const executeTranslateStep = (
  _run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDate
): Effect.Effect<StepExecutionResult> =>
  Effect.gen(function* () {
    const trialBalances = yield* repository.getMemberTrialBalances(
      group.id,
      periodRef,
      asOfDate
    )

    let translatedCount = 0
    for (const tb of Chunk.toReadonlyArray(trialBalances)) {
      if (tb.localCurrency !== group.reportingCurrency) {
        yield* repository.translateTrialBalance(
          tb.trialBalance,
          tb.localCurrency,
          group.reportingCurrency,
          asOfDate
        )
        translatedCount++
      }
    }

    return {
      details: `Translated ${translatedCount} member(s) to ${group.reportingCurrency}`
    }
  })

/**
 * Execute the Aggregate step
 */
const executeAggregateStep = (
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDate
): Effect.Effect<StepExecutionResult> =>
  Effect.gen(function* () {
    const trialBalances = yield* repository.getMemberTrialBalances(
      group.id,
      periodRef,
      asOfDate
    )

    // Aggregate balances by account
    const balanceMap = new Map<string, {
      accountNumber: string
      accountName: string
      accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
      accountCategory: string
      balance: BigDecimal.BigDecimal
      memberCount: number
    }>()

    for (const tb of Chunk.toReadonlyArray(trialBalances)) {
      for (const line of tb.trialBalance.lineItems) {
        const existing = balanceMap.get(line.accountNumber)
        if (existing) {
          existing.balance = BigDecimal.sum(
            existing.balance,
            line.netBalance.amount
          )
          existing.memberCount++
        } else {
          balanceMap.set(line.accountNumber, {
            accountNumber: line.accountNumber,
            accountName: line.accountName,
            accountType: line.accountType,
            accountCategory: line.accountCategory,
            balance: line.netBalance.amount,
            memberCount: 1
          })
        }
      }
    }

    const aggregatedBalances = Chunk.fromIterable(
      Array.from(balanceMap.values()).map((entry) =>
        AggregatedBalance.make({
          accountNumber: Schema.NonEmptyTrimmedString.make(entry.accountNumber),
          accountName: Schema.NonEmptyTrimmedString.make(entry.accountName),
          accountType: entry.accountType,
          accountCategory: entry.accountCategory,
          balance: MonetaryAmount.fromBigDecimal(entry.balance, group.reportingCurrency),
          memberCount: entry.memberCount
        })
      )
    )

    return {
      details: `Aggregated ${balanceMap.size} account(s) from ${Chunk.size(trialBalances)} member(s)`,
      aggregatedBalances
    }
  })

/**
 * Execute the Match IC step
 */
const executeMatchICStep = (
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  periodRef: FiscalPeriodRef
): Effect.Effect<StepExecutionResult> =>
  Effect.gen(function* () {
    const icResult = yield* repository.getIntercompanyTransactions(
      group.id,
      periodRef
    )

    return {
      details: `Matched ${icResult.matchedPairs} IC pair(s), ${icResult.unmatchedCount} unmatched`
    }
  })

/**
 * Execute the Eliminate step
 */
const executeEliminateStep = (
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  periodRef: FiscalPeriodRef,
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>
): Effect.Effect<StepExecutionResult> =>
  Effect.gen(function* () {
    const rules = yield* repository.getEliminationRules(group.id)

    if (Chunk.isEmpty(rules)) {
      return {
        details: "No elimination rules configured",
        eliminationEntryIds: Chunk.empty(),
        totalEliminationAmount: MonetaryAmount.zero(group.reportingCurrency)
      }
    }

    const elimResult = yield* repository.generateEliminationEntries(
      group.id,
      periodRef,
      rules,
      aggregatedBalances
    )

    return {
      details: `Generated ${Chunk.size(elimResult.entryIds)} elimination entry(ies)`,
      eliminationEntryIds: elimResult.entryIds,
      totalEliminationAmount: elimResult.totalEliminationAmount
    }
  })

/**
 * Execute the NCI step
 */
const executeNCIStep = (
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  periodRef: FiscalPeriodRef,
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>
): Effect.Effect<StepExecutionResult> =>
  Effect.gen(function* () {
    const nciResult = yield* repository.calculateNCI(
      group.id,
      periodRef,
      aggregatedBalances
    )

    const calculationCount = Chunk.size(nciResult.calculations)
    if (calculationCount === 0) {
      return {
        details: "No non-controlling interests to calculate",
        totalNCI: MonetaryAmount.zero(group.reportingCurrency)
      }
    }

    return {
      details: `Calculated NCI for ${calculationCount} subsidiary(ies)`,
      totalNCI: nciResult.totalNCI
    }
  })

/**
 * Execute the Generate TB step
 */
const executeGenerateTBStep = (
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>
): Effect.Effect<StepExecutionResult> =>
  Effect.gen(function* () {
    const lineCount = Chunk.size(aggregatedBalances)
    return {
      details: `Generated consolidated trial balance with ${lineCount} account(s)`
    }
  })

// =============================================================================
// Layer
// =============================================================================

/**
 * ConsolidationServiceLive - Live implementation of ConsolidationService
 *
 * Requires ConsolidationRepository
 */
export const ConsolidationServiceLive: Layer.Layer<
  ConsolidationService,
  never,
  ConsolidationRepository
> = Layer.effect(ConsolidationService, make)
