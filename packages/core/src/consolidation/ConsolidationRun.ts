/**
 * ConsolidationRun - Entity for consolidation run orchestration
 *
 * Per ASC 810 and specs/ACCOUNTING_RESEARCH.md, a consolidation run orchestrates the
 * full consolidation process for a consolidation group. It tracks the status
 * and progress of each processing step.
 *
 * Processing Steps (in order):
 * 1. Validate - Ensure all members have closed periods, balanced trial balances
 * 2. Translate - Translate each member to reporting currency per ASC 830
 * 3. Aggregate - Sum all member account balances
 * 4. Match IC - Identify and reconcile intercompany transactions
 * 5. Eliminate - Create elimination entries based on rules
 * 6. NCI - Calculate non-controlling interest share
 * 7. Generate TB - Produce final consolidated trial balance
 *
 * @module ConsolidationRun
 */

import * as Schema from "effect/Schema"
import * as Chunk from "effect/Chunk"
import * as Option from "effect/Option"
import { AccountCategory } from "../accounting/Account.ts"
import { ConsolidationGroupId } from "./ConsolidationGroup.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { FiscalPeriodRef } from "../fiscal/FiscalPeriodRef.ts"
import { LocalDate, LocalDateFromString } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

// =============================================================================
// ConsolidationRunId
// =============================================================================

/**
 * ConsolidationRunId - Branded UUID string for consolidation run identification
 */
export const ConsolidationRunId = Schema.UUID.pipe(
  Schema.brand("ConsolidationRunId"),
  Schema.annotations({
    identifier: "ConsolidationRunId",
    title: "Consolidation Run ID",
    description: "A unique identifier for a consolidation run (UUID format)"
  })
)

/**
 * The branded ConsolidationRunId type
 */
export type ConsolidationRunId = typeof ConsolidationRunId.Type

/**
 * Type guard for ConsolidationRunId using Schema.is
 */
export const isConsolidationRunId = Schema.is(ConsolidationRunId)

// =============================================================================
// ConsolidationRunStatus
// =============================================================================

/**
 * ConsolidationRunStatus - Status of the consolidation run
 *
 * Per specs/ACCOUNTING_RESEARCH.md:
 * - Pending: Run has been created but not started
 * - InProgress: Run is currently executing
 * - Completed: Run finished successfully
 * - Failed: Run failed during execution
 * - Cancelled: Run was cancelled by user
 */
export const ConsolidationRunStatus = Schema.Literal(
  "Pending",
  "InProgress",
  "Completed",
  "Failed",
  "Cancelled"
).annotations({
  identifier: "ConsolidationRunStatus",
  title: "Consolidation Run Status",
  description: "Status of the consolidation run"
})

/**
 * The ConsolidationRunStatus type
 */
export type ConsolidationRunStatus = typeof ConsolidationRunStatus.Type

/**
 * Type guard for ConsolidationRunStatus using Schema.is
 */
export const isConsolidationRunStatus = Schema.is(ConsolidationRunStatus)

// =============================================================================
// ConsolidationStepType
// =============================================================================

/**
 * ConsolidationStepType - Types of processing steps in consolidation
 *
 * Per specs/ACCOUNTING_RESEARCH.md Processing Steps:
 * 1. Validate: Ensure all members have closed periods, balanced trial balances
 * 2. Translate: Translate each member to reporting currency per ASC 830
 * 3. Aggregate: Sum all member account balances
 * 4. MatchIC: Identify and reconcile intercompany transactions
 * 5. Eliminate: Create elimination entries based on rules
 * 6. NCI: Calculate non-controlling interest share
 * 7. GenerateTB: Produce final consolidated trial balance
 */
export const ConsolidationStepType = Schema.Literal(
  "Validate",
  "Translate",
  "Aggregate",
  "MatchIC",
  "Eliminate",
  "NCI",
  "GenerateTB"
).annotations({
  identifier: "ConsolidationStepType",
  title: "Consolidation Step Type",
  description: "Type of processing step in the consolidation run"
})

/**
 * The ConsolidationStepType type
 */
export type ConsolidationStepType = typeof ConsolidationStepType.Type

/**
 * Type guard for ConsolidationStepType using Schema.is
 */
export const isConsolidationStepType = Schema.is(ConsolidationStepType)

/**
 * Ordered list of consolidation steps for execution
 */
export const CONSOLIDATION_STEP_ORDER: readonly ConsolidationStepType[] = [
  "Validate",
  "Translate",
  "Aggregate",
  "MatchIC",
  "Eliminate",
  "NCI",
  "GenerateTB"
] as const

// =============================================================================
// ConsolidationStepStatus
// =============================================================================

/**
 * ConsolidationStepStatus - Status of an individual consolidation step
 *
 * - Pending: Step has not started yet
 * - InProgress: Step is currently executing
 * - Completed: Step finished successfully
 * - Failed: Step failed with an error
 * - Skipped: Step was skipped (e.g., no data to process)
 */
export const ConsolidationStepStatus = Schema.Literal(
  "Pending",
  "InProgress",
  "Completed",
  "Failed",
  "Skipped"
).annotations({
  identifier: "ConsolidationStepStatus",
  title: "Consolidation Step Status",
  description: "Status of an individual consolidation step"
})

/**
 * The ConsolidationStepStatus type
 */
export type ConsolidationStepStatus = typeof ConsolidationStepStatus.Type

/**
 * Type guard for ConsolidationStepStatus using Schema.is
 */
export const isConsolidationStepStatus = Schema.is(ConsolidationStepStatus)

// =============================================================================
// ConsolidationStep
// =============================================================================

/**
 * ConsolidationStep - Represents a single processing step in a consolidation run
 *
 * Tracks the type, status, timing, and any error information for the step.
 */
export class ConsolidationStep extends Schema.Class<ConsolidationStep>("ConsolidationStep")({
  /**
   * Type of consolidation step
   */
  stepType: ConsolidationStepType,

  /**
   * Current status of the step
   */
  status: ConsolidationStepStatus,

  /**
   * When the step started executing (None if not started)
   */
  startedAt: Schema.OptionFromNullOr(Timestamp),

  /**
   * When the step completed (None if not completed)
   */
  completedAt: Schema.OptionFromNullOr(Timestamp),

  /**
   * Duration in milliseconds (calculated when completed)
   */
  durationMs: Schema.OptionFromNullOr(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))
  ),

  /**
   * Error message if the step failed
   */
  errorMessage: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),

  /**
   * Additional details or notes about the step execution
   */
  details: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {
  /**
   * Check if the step has started
   */
  get hasStarted(): boolean {
    return Option.isSome(this.startedAt)
  }

  /**
   * Check if the step has completed (successfully or with failure)
   */
  get hasCompleted(): boolean {
    return Option.isSome(this.completedAt)
  }

  /**
   * Check if the step is currently running
   */
  get isRunning(): boolean {
    return this.status === "InProgress"
  }

  /**
   * Check if the step completed successfully
   */
  get isSuccessful(): boolean {
    return this.status === "Completed"
  }

  /**
   * Check if the step failed
   */
  get isFailed(): boolean {
    return this.status === "Failed"
  }

  /**
   * Check if the step was skipped
   */
  get isSkipped(): boolean {
    return this.status === "Skipped"
  }

  /**
   * Check if the step is pending
   */
  get isPending(): boolean {
    return this.status === "Pending"
  }

  /**
   * Check if the step has an error
   */
  get hasError(): boolean {
    return Option.isSome(this.errorMessage)
  }

  /**
   * Get the step name for display
   */
  get displayName(): string {
    switch (this.stepType) {
      case "Validate":
        return "Validate Member Data"
      case "Translate":
        return "Currency Translation"
      case "Aggregate":
        return "Aggregate Balances"
      case "MatchIC":
        return "Intercompany Matching"
      case "Eliminate":
        return "Generate Eliminations"
      case "NCI":
        return "Calculate Minority Interest"
      case "GenerateTB":
        return "Generate Consolidated TB"
      default:
        return this.stepType
    }
  }
}

/**
 * Type guard for ConsolidationStep using Schema.is
 */
export const isConsolidationStep = Schema.is(ConsolidationStep)

/**
 * Encoded type interface for ConsolidationStep
 */
export interface ConsolidationStepEncoded extends Schema.Schema.Encoded<typeof ConsolidationStep> {}

/**
 * Create initial pending steps for a new consolidation run
 */
export const createInitialSteps = (): Chunk.Chunk<ConsolidationStep> => {
  return Chunk.fromIterable(
    CONSOLIDATION_STEP_ORDER.map((stepType) =>
      ConsolidationStep.make({
        stepType,
        status: "Pending",
        startedAt: Option.none(),
        completedAt: Option.none(),
        durationMs: Option.none(),
        errorMessage: Option.none(),
        details: Option.none()
      })
    )
  )
}

// =============================================================================
// ValidationResult
// =============================================================================

/**
 * ValidationIssue - Represents a validation error or warning
 */
export class ValidationIssue extends Schema.Class<ValidationIssue>("ValidationIssue")({
  /**
   * Severity of the issue
   */
  severity: Schema.Literal("Error", "Warning"),

  /**
   * Issue code for programmatic handling
   */
  code: Schema.NonEmptyTrimmedString,

  /**
   * Human-readable message describing the issue
   */
  message: Schema.NonEmptyTrimmedString,

  /**
   * Optional reference to related entity (e.g., company ID)
   */
  entityReference: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {
  /**
   * Check if this is an error
   */
  get isError(): boolean {
    return this.severity === "Error"
  }

  /**
   * Check if this is a warning
   */
  get isWarning(): boolean {
    return this.severity === "Warning"
  }
}

/**
 * Type guard for ValidationIssue using Schema.is
 */
export const isValidationIssue = Schema.is(ValidationIssue)

/**
 * ValidationResult - Result of validating consolidation data
 */
export class ValidationResult extends Schema.Class<ValidationResult>("ValidationResult")({
  /**
   * Whether validation passed (no errors)
   */
  isValid: Schema.Boolean,

  /**
   * List of validation issues (errors and warnings)
   */
  issues: Schema.Chunk(ValidationIssue)
}) {
  /**
   * Get the count of errors
   */
  get errorCount(): number {
    return Chunk.size(Chunk.filter(this.issues, (i) => i.isError))
  }

  /**
   * Get the count of warnings
   */
  get warningCount(): number {
    return Chunk.size(Chunk.filter(this.issues, (i) => i.isWarning))
  }

  /**
   * Check if there are any errors
   */
  get hasErrors(): boolean {
    return Chunk.some(this.issues, (i) => i.isError)
  }

  /**
   * Check if there are any warnings
   */
  get hasWarnings(): boolean {
    return Chunk.some(this.issues, (i) => i.isWarning)
  }

  /**
   * Get only error issues
   */
  get errors(): Chunk.Chunk<ValidationIssue> {
    return Chunk.filter(this.issues, (i) => i.isError)
  }

  /**
   * Get only warning issues
   */
  get warnings(): Chunk.Chunk<ValidationIssue> {
    return Chunk.filter(this.issues, (i) => i.isWarning)
  }
}

/**
 * Type guard for ValidationResult using Schema.is
 */
export const isValidationResult = Schema.is(ValidationResult)

// =============================================================================
// ConsolidatedTrialBalanceLineItem
// =============================================================================

/**
 * ConsolidatedTrialBalanceLineItem - A line item in the consolidated trial balance
 */
export class ConsolidatedTrialBalanceLineItem extends Schema.Class<ConsolidatedTrialBalanceLineItem>(
  "ConsolidatedTrialBalanceLineItem"
)({
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
   * Required for generating proper financial statements (Balance Sheet sections,
   * Income Statement sections, etc.)
   */
  accountCategory: AccountCategory,

  /**
   * Aggregated balance from all members (before eliminations)
   */
  aggregatedBalance: MonetaryAmount,

  /**
   * Total eliminations applied to this account
   */
  eliminationAmount: MonetaryAmount,

  /**
   * Non-controlling interest portion (for equity accounts)
   */
  nciAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Final consolidated balance
   */
  consolidatedBalance: MonetaryAmount
}) {
  /**
   * Check if this line has eliminations
   */
  get hasEliminations(): boolean {
    return !this.eliminationAmount.isZero
  }

  /**
   * Check if this line has NCI
   */
  get hasNCI(): boolean {
    return Option.isSome(this.nciAmount) && !Option.getOrThrow(this.nciAmount).isZero
  }
}

/**
 * Type guard for ConsolidatedTrialBalanceLineItem using Schema.is
 */
export const isConsolidatedTrialBalanceLineItem = Schema.is(ConsolidatedTrialBalanceLineItem)

// =============================================================================
// ConsolidatedTrialBalance
// =============================================================================

/**
 * ConsolidatedTrialBalance - The resulting consolidated trial balance
 */
export class ConsolidatedTrialBalance extends Schema.Class<ConsolidatedTrialBalance>(
  "ConsolidatedTrialBalance"
)({
  /**
   * Reference to the consolidation run
   */
  consolidationRunId: ConsolidationRunId,

  /**
   * Reference to the consolidation group
   */
  groupId: ConsolidationGroupId,

  /**
   * Fiscal period for this trial balance
   */
  periodRef: FiscalPeriodRef,

  /**
   * As-of date for the trial balance
   */
  asOfDate: LocalDate,

  /**
   * Reporting currency
   */
  currency: CurrencyCode,

  /**
   * Line items in the trial balance
   */
  lineItems: Schema.Chunk(ConsolidatedTrialBalanceLineItem),

  /**
   * Total debits (should equal total credits)
   */
  totalDebits: MonetaryAmount,

  /**
   * Total credits (should equal total debits)
   */
  totalCredits: MonetaryAmount,

  /**
   * Total elimination entries
   */
  totalEliminations: MonetaryAmount,

  /**
   * Total non-controlling interest
   */
  totalNCI: MonetaryAmount,

  /**
   * When the trial balance was generated
   */
  generatedAt: Timestamp
}) {
  /**
   * Check if the trial balance is balanced
   */
  get isBalanced(): boolean {
    return this.totalDebits.amount === this.totalCredits.amount
  }

  /**
   * Get the number of line items
   */
  get lineCount(): number {
    return Chunk.size(this.lineItems)
  }

  /**
   * Check if there are any line items
   */
  get hasLineItems(): boolean {
    return Chunk.isNonEmpty(this.lineItems)
  }
}

/**
 * Type guard for ConsolidatedTrialBalance using Schema.is
 */
export const isConsolidatedTrialBalance = Schema.is(ConsolidatedTrialBalance)

/**
 * Encoded type interface for ConsolidatedTrialBalance
 */
export interface ConsolidatedTrialBalanceEncoded extends Schema.Schema.Encoded<typeof ConsolidatedTrialBalance> {}

// =============================================================================
// ConsolidationRunOptions
// =============================================================================

/**
 * ConsolidationRunOptions - Options for running a consolidation
 */
export class ConsolidationRunOptions extends Schema.Class<ConsolidationRunOptions>(
  "ConsolidationRunOptions"
)({
  /**
   * Skip validation step (use with caution)
   */
  skipValidation: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.withConstructorDefault(() => false)
  ),

  /**
   * Continue on warnings during validation
   */
  continueOnWarnings: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.withConstructorDefault(() => true)
  ),

  /**
   * Include equity method investments in consolidation
   */
  includeEquityMethodInvestments: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.withConstructorDefault(() => true)
  ),

  /**
   * Force regeneration even if prior run exists for period
   */
  forceRegeneration: Schema.propertySignature(Schema.Boolean).pipe(
    Schema.withConstructorDefault(() => false)
  )
}) {}

/**
 * Type guard for ConsolidationRunOptions using Schema.is
 */
export const isConsolidationRunOptions = Schema.is(ConsolidationRunOptions)

/**
 * Default consolidation run options
 */
export const defaultConsolidationRunOptions = ConsolidationRunOptions.make({})

// =============================================================================
// ConsolidationRun
// =============================================================================

/**
 * ConsolidationRun - Entity representing a consolidation run
 *
 * Orchestrates the full consolidation process for a consolidation group.
 * Tracks the status and progress of each processing step.
 */
export class ConsolidationRun extends Schema.Class<ConsolidationRun>("ConsolidationRun")({
  /**
   * Unique identifier for the consolidation run
   */
  id: ConsolidationRunId,

  /**
   * Reference to the consolidation group being consolidated
   */
  groupId: ConsolidationGroupId,

  /**
   * Fiscal period for this consolidation run
   */
  periodRef: FiscalPeriodRef,

  /**
   * As-of date for the consolidation
   * Uses LocalDateFromString to ensure proper JSON serialization as ISO string
   */
  asOfDate: LocalDateFromString,

  /**
   * Overall status of the consolidation run
   */
  status: ConsolidationRunStatus,

  /**
   * Processing steps with their status and timing
   */
  steps: Schema.Chunk(ConsolidationStep),

  /**
   * Validation results (populated after validation step)
   */
  validationResult: Schema.OptionFromNullOr(ValidationResult),

  /**
   * Reference to the consolidated trial balance (populated after GenerateTB step)
   */
  consolidatedTrialBalance: Schema.OptionFromNullOr(ConsolidatedTrialBalance),

  /**
   * IDs of generated elimination entries
   */
  eliminationEntryIds: Schema.Chunk(Schema.UUID.pipe(Schema.brand("EliminationEntryId"))),

  /**
   * Options used for this run
   */
  options: ConsolidationRunOptions,

  /**
   * User who initiated the run
   */
  initiatedBy: Schema.UUID.pipe(Schema.brand("UserId")),

  /**
   * When the run was initiated
   */
  initiatedAt: Timestamp,

  /**
   * When the run was started (first step began)
   */
  startedAt: Schema.OptionFromNullOr(Timestamp),

  /**
   * When the run completed (success, failure, or cancellation)
   */
  completedAt: Schema.OptionFromNullOr(Timestamp),

  /**
   * Total duration in milliseconds
   */
  totalDurationMs: Schema.OptionFromNullOr(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))
  ),

  /**
   * Error message if the run failed
   */
  errorMessage: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {
  /**
   * Check if the run is pending
   */
  get isPending(): boolean {
    return this.status === "Pending"
  }

  /**
   * Check if the run is in progress
   */
  get isInProgress(): boolean {
    return this.status === "InProgress"
  }

  /**
   * Check if the run completed successfully
   */
  get isCompleted(): boolean {
    return this.status === "Completed"
  }

  /**
   * Check if the run failed
   */
  get isFailed(): boolean {
    return this.status === "Failed"
  }

  /**
   * Check if the run was cancelled
   */
  get isCancelled(): boolean {
    return this.status === "Cancelled"
  }

  /**
   * Check if the run has finished (completed, failed, or cancelled)
   */
  get isFinished(): boolean {
    return this.isCompleted || this.isFailed || this.isCancelled
  }

  /**
   * Get the number of steps
   */
  get stepCount(): number {
    return Chunk.size(this.steps)
  }

  /**
   * Get the number of completed steps
   */
  get completedStepCount(): number {
    return Chunk.size(Chunk.filter(this.steps, (s) => s.isSuccessful))
  }

  /**
   * Get the number of failed steps
   */
  get failedStepCount(): number {
    return Chunk.size(Chunk.filter(this.steps, (s) => s.isFailed))
  }

  /**
   * Get progress as a percentage (0-100)
   */
  get progressPercent(): number {
    if (this.stepCount === 0) return 0
    const finishedSteps = Chunk.size(
      Chunk.filter(this.steps, (s) => s.hasCompleted)
    )
    return Math.round((finishedSteps / this.stepCount) * 100)
  }

  /**
   * Get the currently running step
   */
  get currentStep(): Option.Option<ConsolidationStep> {
    return Chunk.findFirst(this.steps, (s) => s.isRunning)
  }

  /**
   * Get the current step type
   */
  get currentStepType(): Option.Option<ConsolidationStepType> {
    return Option.map(this.currentStep, (s) => s.stepType)
  }

  /**
   * Get a step by type
   */
  getStep(stepType: ConsolidationStepType): Option.Option<ConsolidationStep> {
    return Chunk.findFirst(this.steps, (s) => s.stepType === stepType)
  }

  /**
   * Check if validation passed
   */
  get validationPassed(): boolean {
    return Option.isSome(this.validationResult) &&
           Option.getOrThrow(this.validationResult).isValid
  }

  /**
   * Check if there is a consolidated trial balance
   */
  get hasConsolidatedTrialBalance(): boolean {
    return Option.isSome(this.consolidatedTrialBalance)
  }

  /**
   * Get the number of elimination entries generated
   */
  get eliminationEntryCount(): number {
    return Chunk.size(this.eliminationEntryIds)
  }

  /**
   * Check if any elimination entries were generated
   */
  get hasEliminationEntries(): boolean {
    return Chunk.isNonEmpty(this.eliminationEntryIds)
  }

  /**
   * Check if the run has an error
   */
  get hasError(): boolean {
    return Option.isSome(this.errorMessage)
  }
}

/**
 * Type guard for ConsolidationRun using Schema.is
 */
export const isConsolidationRun = Schema.is(ConsolidationRun)

/**
 * Encoded type interface for ConsolidationRun
 */
export interface ConsolidationRunEncoded extends Schema.Schema.Encoded<typeof ConsolidationRun> {}
