/**
 * ConsolidationService - Orchestrates the full consolidation process
 *
 * Per ASC 810 and SPECIFICATIONS.md, this service orchestrates consolidation by:
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
 * @module ConsolidationService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { CompanyId } from "../domain/Company.ts"
import {
  ConsolidationGroupId,
  type ConsolidationMember
} from "../domain/ConsolidationGroup.ts"
import type {
  ConsolidationRunOptions} from "../domain/ConsolidationRun.ts";
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
  type ConsolidationStepType,
  type ConsolidationRunStatus
} from "../domain/ConsolidationRun.ts"
import type { CurrencyCode } from "../domain/CurrencyCode.ts"
import type { EliminationRule } from "../domain/EliminationRule.ts"
import { FiscalPeriodRef } from "../domain/FiscalPeriodRef.ts"
import type { LocalDate } from "../domain/LocalDate.ts"
import { MonetaryAmount } from "../domain/MonetaryAmount.ts"
import type { Timestamp} from "../domain/Timestamp.ts";
import { nowEffect as timestampNowEffect } from "../domain/Timestamp.ts"
import type { TrialBalanceReport } from "./TrialBalanceService.ts"

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
 * Error when fiscal period is not found or invalid
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
 * Error when a consolidation run already exists for the period
 */
export class ConsolidationRunExistsError extends Schema.TaggedError<ConsolidationRunExistsError>()(
  "ConsolidationRunExistsError",
  {
    groupId: ConsolidationGroupId,
    periodRef: FiscalPeriodRef,
    existingRunId: ConsolidationRunId
  }
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
  }
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
  }
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
 * Union type for all consolidation service errors
 */
export type ConsolidationServiceError =
  | ConsolidationGroupNotFoundError
  | FiscalPeriodNotFoundError
  | ConsolidationRunExistsError
  | ConsolidationValidationError
  | ConsolidationStepFailedError

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
    entryIds: Chunk.Chunk<string>
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
  readonly userId: string
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
   * @throws ConsolidationStepFailedError if any step fails
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
          initiatedBy: userId as any, // Cast to UserId branded type
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
          status: "InProgress" as ConsolidationRunStatus,
          startedAt: Option.some(startedAt)
        })
        run = yield* repository.updateRun(run)

        // Track aggregated balances for later steps
        let aggregatedBalances: Chunk.Chunk<AggregatedBalance> = Chunk.empty()
        let totalEliminationAmount = MonetaryAmount.zero(group.reportingCurrency)
        let totalNCI = MonetaryAmount.zero(group.reportingCurrency)
        let eliminationEntryIds: Chunk.Chunk<string> = Chunk.empty()
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
          const stepResult = yield* executeStep(
            stepType,
            run,
            group,
            repository,
            options,
            aggregatedBalances,
            validationResult
          ).pipe(
            Effect.map((result) => ({ success: true as const, result })),
            Effect.catchAll((error) =>
              Effect.succeed({
                success: false as const,
                error: error instanceof Error ? error.message : String(error)
              })
            )
          )

          const stepEndTime = yield* timestampNowEffect
          const durationMs = stepEndTime.epochMillis - stepStartTime.epochMillis

          if (!stepResult.success) {
            // Step failed - mark as failed and stop
            run = ConsolidationRun.make({
              ...run,
              status: "Failed" as ConsolidationRunStatus,
              steps: updateStep(run.steps, stepType, {
                status: "Failed",
                completedAt: Option.some(stepEndTime),
                durationMs: Option.some(durationMs),
                errorMessage: Option.some(stepResult.error)
              }),
              completedAt: Option.some(stepEndTime),
              totalDurationMs: Option.some(
                stepEndTime.epochMillis - startedAt.epochMillis
              ),
              errorMessage: Option.some(stepResult.error)
            })
            run = yield* repository.updateRun(run)

            return yield* Effect.fail(
              new ConsolidationStepFailedError({
                runId,
                stepType,
                errorMessage: stepResult.error as any
              })
            )
          }

          // Step succeeded - update state
          const result = stepResult.result

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
                status: "Failed" as ConsolidationRunStatus,
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
            eliminationEntryIds: eliminationEntryIds as any
          })
          run = yield* repository.updateRun(run)
        }

        // ==== Generate Consolidated Trial Balance ====

        const generatedAt = yield* timestampNowEffect
        const lineItems = Chunk.map(aggregatedBalances, (balance) =>
          ConsolidatedTrialBalanceLineItem.make({
            accountNumber: balance.accountNumber,
            accountName: balance.accountName,
            accountType: balance.accountType,
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
          status: "Completed" as ConsolidationRunStatus,
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
  eliminationEntryIds?: Chunk.Chunk<string>
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
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>,
  _validationResult: Option.Option<ValidationResult>
): Effect.Effect<StepExecutionResult, Error> => {
  switch (stepType) {
    case "Validate":
      return executeValidateStep(run, group, repository, options)
    case "Translate":
      return executeTranslateStep(run, group, repository)
    case "Aggregate":
      return executeAggregateStep(run, group, repository)
    case "MatchIC":
      return executeMatchICStep(run, group, repository)
    case "Eliminate":
      return executeEliminateStep(run, group, repository, aggregatedBalances)
    case "NCI":
      return executeNCIStep(run, group, repository, aggregatedBalances)
    case "GenerateTB":
      return executeGenerateTBStep(run, group, aggregatedBalances)
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
): Effect.Effect<StepExecutionResult, Error> =>
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
  }).pipe(
    Effect.catchAll((e) => Effect.fail(new Error(`Validation failed: ${e}`)))
  )

/**
 * Execute the Translate step
 */
const executeTranslateStep = (
  run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService
): Effect.Effect<StepExecutionResult, Error> =>
  Effect.gen(function* () {
    const trialBalances = yield* repository.getMemberTrialBalances(
      group.id,
      run.periodRef,
      run.asOfDate
    )

    let translatedCount = 0
    for (const tb of Chunk.toReadonlyArray(trialBalances)) {
      if (tb.localCurrency !== group.reportingCurrency) {
        yield* repository.translateTrialBalance(
          tb.trialBalance,
          tb.localCurrency,
          group.reportingCurrency,
          run.asOfDate
        )
        translatedCount++
      }
    }

    return {
      details: `Translated ${translatedCount} member(s) to ${group.reportingCurrency}`
    }
  }).pipe(
    Effect.catchAll((e) => Effect.fail(new Error(`Translation failed: ${e}`)))
  )

/**
 * Execute the Aggregate step
 */
const executeAggregateStep = (
  run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService
): Effect.Effect<StepExecutionResult, Error> =>
  Effect.gen(function* () {
    const trialBalances = yield* repository.getMemberTrialBalances(
      group.id,
      run.periodRef,
      run.asOfDate
    )

    // Aggregate balances by account
    const balanceMap = new Map<string, {
      accountNumber: string
      accountName: string
      accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
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
            balance: line.netBalance.amount,
            memberCount: 1
          })
        }
      }
    }

    const aggregatedBalances = Chunk.fromIterable(
      Array.from(balanceMap.values()).map((entry) =>
        AggregatedBalance.make({
          accountNumber: entry.accountNumber as any,
          accountName: entry.accountName as any,
          accountType: entry.accountType,
          balance: MonetaryAmount.fromBigDecimal(entry.balance, group.reportingCurrency),
          memberCount: entry.memberCount
        })
      )
    )

    return {
      details: `Aggregated ${balanceMap.size} account(s) from ${Chunk.size(trialBalances)} member(s)`,
      aggregatedBalances
    }
  }).pipe(
    Effect.catchAll((e) => Effect.fail(new Error(`Aggregation failed: ${e}`)))
  )

/**
 * Execute the Match IC step
 */
const executeMatchICStep = (
  run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService
): Effect.Effect<StepExecutionResult, Error> =>
  Effect.gen(function* () {
    const icResult = yield* repository.getIntercompanyTransactions(
      group.id,
      run.periodRef
    )

    return {
      details: `Matched ${icResult.matchedPairs} IC pair(s), ${icResult.unmatchedCount} unmatched`
    }
  }).pipe(
    Effect.catchAll((e) => Effect.fail(new Error(`IC matching failed: ${e}`)))
  )

/**
 * Execute the Eliminate step
 */
const executeEliminateStep = (
  run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>
): Effect.Effect<StepExecutionResult, Error> =>
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
      run.periodRef,
      rules,
      aggregatedBalances
    )

    return {
      details: `Generated ${Chunk.size(elimResult.entryIds)} elimination entry(ies)`,
      eliminationEntryIds: elimResult.entryIds,
      totalEliminationAmount: elimResult.totalEliminationAmount
    }
  }).pipe(
    Effect.catchAll((e) => Effect.fail(new Error(`Elimination failed: ${e}`)))
  )

/**
 * Execute the NCI step
 */
const executeNCIStep = (
  run: ConsolidationRun,
  group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  repository: ConsolidationRepositoryService,
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>
): Effect.Effect<StepExecutionResult, Error> =>
  Effect.gen(function* () {
    const nciResult = yield* repository.calculateNCI(
      group.id,
      run.periodRef,
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
  }).pipe(
    Effect.catchAll((e) => Effect.fail(new Error(`NCI calculation failed: ${e}`)))
  )

/**
 * Execute the Generate TB step
 */
const executeGenerateTBStep = (
  _run: ConsolidationRun,
  _group: {
    id: ConsolidationGroupId
    name: string
    reportingCurrency: CurrencyCode
    members: Chunk.Chunk<ConsolidationMember>
  },
  aggregatedBalances: Chunk.Chunk<AggregatedBalance>
): Effect.Effect<StepExecutionResult, Error> =>
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
