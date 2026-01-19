import { describe, it, expect } from "@effect/vitest"
import { Chunk, Effect, Exit, Option } from "effect"
import * as Schema from "effect/Schema"
import type { AccountCategory } from "../../src/accounting/Account.ts"
import {
  ConsolidationRunId,
  ConsolidationRunStatus,
  ConsolidationStepType,
  ConsolidationStepStatus,
  ConsolidationStep,
  ValidationIssue,
  ValidationResult,
  ConsolidatedTrialBalanceLineItem,
  ConsolidatedTrialBalance,
  ConsolidationRunOptions,
  ConsolidationRun,
  CONSOLIDATION_STEP_ORDER,
  createInitialSteps,
  defaultConsolidationRunOptions,
  isConsolidationRunId,
  isConsolidationRunStatus,
  isConsolidationStepType,
  isConsolidationStepStatus,
  isConsolidationStep,
  isValidationIssue,
  isValidationResult,
  isConsolidatedTrialBalanceLineItem,
  isConsolidatedTrialBalance,
  isConsolidationRunOptions,
  isConsolidationRun
} from "../../src/consolidation/ConsolidationRun.ts"
import { ConsolidationGroupId } from "../../src/consolidation/ConsolidationGroup.ts"
import { CurrencyCode } from "../../src/currency/CurrencyCode.ts"
import { FiscalPeriodRef } from "../../src/fiscal/FiscalPeriodRef.ts"
import { UserId } from "../../src/journal/JournalEntry.ts"
import { EliminationEntryId } from "../../src/consolidation/EliminationService.ts"
import { LocalDate } from "../../src/shared/values/LocalDate.ts"
import { MonetaryAmount } from "../../src/shared/values/MonetaryAmount.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

// =============================================================================
// Test Helpers
// =============================================================================

const makeTimestamp = () => Timestamp.make({ epochMillis: Date.now() })

const groupUUID = "550e8400-e29b-41d4-a716-446655440000"
const runUUID = "660e8400-e29b-41d4-a716-446655440001"
const userUUID = "770e8400-e29b-41d4-a716-446655440002"

const groupId = ConsolidationGroupId.make(groupUUID)
const runId = ConsolidationRunId.make(runUUID)
const userId = UserId.make(userUUID)
const periodRef = FiscalPeriodRef.make({ year: 2024, period: 12 })
const testDate = LocalDate.make({ year: 2024, month: 12, day: 31 })
const testCurrency = CurrencyCode.make("USD")

// =============================================================================
// ConsolidationRunId Tests
// =============================================================================

describe("ConsolidationRunId", () => {
  it("creates valid run ID", () => {
    const id = ConsolidationRunId.make(runUUID)
    expect(id).toBeDefined()
    expect(id).toBe(runUUID)
  })

  it.effect("rejects invalid UUID format", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        Schema.decodeUnknown(ConsolidationRunId)("invalid-uuid")
      )
      expect(Exit.isFailure(result)).toBe(true)
    })
  )

  describe("type guard", () => {
    it("isConsolidationRunId returns true for valid ID", () => {
      const id = ConsolidationRunId.make(runUUID)
      expect(isConsolidationRunId(id)).toBe(true)
    })

    it("isConsolidationRunId returns false for invalid values", () => {
      expect(isConsolidationRunId(null)).toBe(false)
      expect(isConsolidationRunId(undefined)).toBe(false)
      expect(isConsolidationRunId("not-a-uuid")).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidationRunStatus Tests
// =============================================================================

describe("ConsolidationRunStatus", () => {
  const validStatuses = ["Pending", "InProgress", "Completed", "Failed", "Cancelled"]

  it("accepts valid statuses", () => {
    for (const status of validStatuses) {
      const result = Schema.decodeUnknownSync(ConsolidationRunStatus)(status)
      expect(result).toBe(status)
    }
  })

  it.effect("rejects invalid status", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        Schema.decodeUnknown(ConsolidationRunStatus)("InvalidStatus")
      )
      expect(Exit.isFailure(result)).toBe(true)
    })
  )

  describe("type guard", () => {
    it("isConsolidationRunStatus returns true for valid statuses", () => {
      for (const status of validStatuses) {
        expect(isConsolidationRunStatus(status)).toBe(true)
      }
    })

    it("isConsolidationRunStatus returns false for invalid values", () => {
      expect(isConsolidationRunStatus(null)).toBe(false)
      expect(isConsolidationRunStatus("Invalid")).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidationStepType Tests
// =============================================================================

describe("ConsolidationStepType", () => {
  const validTypes = ["Validate", "Translate", "Aggregate", "MatchIC", "Eliminate", "NCI", "GenerateTB"]

  it("accepts valid step types", () => {
    for (const stepType of validTypes) {
      const result = Schema.decodeUnknownSync(ConsolidationStepType)(stepType)
      expect(result).toBe(stepType)
    }
  })

  it.effect("rejects invalid step type", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        Schema.decodeUnknown(ConsolidationStepType)("InvalidStep")
      )
      expect(Exit.isFailure(result)).toBe(true)
    })
  )

  describe("type guard", () => {
    it("isConsolidationStepType returns true for valid types", () => {
      for (const stepType of validTypes) {
        expect(isConsolidationStepType(stepType)).toBe(true)
      }
    })

    it("isConsolidationStepType returns false for invalid values", () => {
      expect(isConsolidationStepType(null)).toBe(false)
      expect(isConsolidationStepType("Invalid")).toBe(false)
    })
  })

  describe("CONSOLIDATION_STEP_ORDER", () => {
    it("contains all step types in correct order", () => {
      expect(CONSOLIDATION_STEP_ORDER).toEqual([
        "Validate",
        "Translate",
        "Aggregate",
        "MatchIC",
        "Eliminate",
        "NCI",
        "GenerateTB"
      ])
    })

    it("has 7 steps", () => {
      expect(CONSOLIDATION_STEP_ORDER.length).toBe(7)
    })
  })
})

// =============================================================================
// ConsolidationStepStatus Tests
// =============================================================================

describe("ConsolidationStepStatus", () => {
  const validStatuses = ["Pending", "InProgress", "Completed", "Failed", "Skipped"]

  it("accepts valid step statuses", () => {
    for (const status of validStatuses) {
      const result = Schema.decodeUnknownSync(ConsolidationStepStatus)(status)
      expect(result).toBe(status)
    }
  })

  it.effect("rejects invalid step status", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        Schema.decodeUnknown(ConsolidationStepStatus)("InvalidStatus")
      )
      expect(Exit.isFailure(result)).toBe(true)
    })
  )

  describe("type guard", () => {
    it("isConsolidationStepStatus returns true for valid statuses", () => {
      for (const status of validStatuses) {
        expect(isConsolidationStepStatus(status)).toBe(true)
      }
    })

    it("isConsolidationStepStatus returns false for invalid values", () => {
      expect(isConsolidationStepStatus(null)).toBe(false)
      expect(isConsolidationStepStatus("Invalid")).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidationStep Tests
// =============================================================================

describe("ConsolidationStep", () => {
  const now = makeTimestamp()

  const createPendingStep = () =>
    ConsolidationStep.make({
      stepType: "Validate",
      status: "Pending",
      startedAt: Option.none(),
      completedAt: Option.none(),
      durationMs: Option.none(),
      errorMessage: Option.none(),
      details: Option.none()
    })

  const createRunningStep = () =>
    ConsolidationStep.make({
      stepType: "Translate",
      status: "InProgress",
      startedAt: Option.some(now),
      completedAt: Option.none(),
      durationMs: Option.none(),
      errorMessage: Option.none(),
      details: Option.none()
    })

  const createCompletedStep = () =>
    ConsolidationStep.make({
      stepType: "Aggregate",
      status: "Completed",
      startedAt: Option.some(now),
      completedAt: Option.some(Timestamp.make({ epochMillis: now.epochMillis + 1000 })),
      durationMs: Option.some(1000),
      errorMessage: Option.none(),
      details: Option.some("Aggregated 50 accounts")
    })

  const createFailedStep = () =>
    ConsolidationStep.make({
      stepType: "Eliminate",
      status: "Failed",
      startedAt: Option.some(now),
      completedAt: Option.some(Timestamp.make({ epochMillis: now.epochMillis + 500 })),
      durationMs: Option.some(500),
      errorMessage: Option.some("No elimination rules found"),
      details: Option.none()
    })

  it("creates pending step", () => {
    const step = createPendingStep()
    expect(step.stepType).toBe("Validate")
    expect(step.status).toBe("Pending")
    expect(step.isPending).toBe(true)
    expect(step.isRunning).toBe(false)
    expect(step.isSuccessful).toBe(false)
    expect(step.isFailed).toBe(false)
    expect(step.hasStarted).toBe(false)
    expect(step.hasCompleted).toBe(false)
  })

  it("creates running step", () => {
    const step = createRunningStep()
    expect(step.status).toBe("InProgress")
    expect(step.isPending).toBe(false)
    expect(step.isRunning).toBe(true)
    expect(step.hasStarted).toBe(true)
    expect(step.hasCompleted).toBe(false)
  })

  it("creates completed step", () => {
    const step = createCompletedStep()
    expect(step.status).toBe("Completed")
    expect(step.isSuccessful).toBe(true)
    expect(step.isFailed).toBe(false)
    expect(step.hasCompleted).toBe(true)
    expect(Option.getOrThrow(step.durationMs)).toBe(1000)
  })

  it("creates failed step with error message", () => {
    const step = createFailedStep()
    expect(step.status).toBe("Failed")
    expect(step.isFailed).toBe(true)
    expect(step.isSuccessful).toBe(false)
    expect(step.hasError).toBe(true)
    expect(Option.getOrThrow(step.errorMessage)).toBe("No elimination rules found")
  })

  it("creates skipped step", () => {
    const step = ConsolidationStep.make({
      stepType: "NCI",
      status: "Skipped",
      startedAt: Option.none(),
      completedAt: Option.none(),
      durationMs: Option.none(),
      errorMessage: Option.none(),
      details: Option.some("No subsidiaries with minority interest")
    })
    expect(step.isSkipped).toBe(true)
    expect(step.isPending).toBe(false)
  })

  describe("displayName", () => {
    it("returns correct display name for each step type", () => {
      const steps: Array<{ type: typeof ConsolidationStepType.Type; expected: string }> = [
        { type: "Validate", expected: "Validate Member Data" },
        { type: "Translate", expected: "Currency Translation" },
        { type: "Aggregate", expected: "Aggregate Balances" },
        { type: "MatchIC", expected: "Intercompany Matching" },
        { type: "Eliminate", expected: "Generate Eliminations" },
        { type: "NCI", expected: "Calculate Minority Interest" },
        { type: "GenerateTB", expected: "Generate Consolidated TB" }
      ]

      for (const { type, expected } of steps) {
        const step = ConsolidationStep.make({
          stepType: type,
          status: "Pending",
          startedAt: Option.none(),
          completedAt: Option.none(),
          durationMs: Option.none(),
          errorMessage: Option.none(),
          details: Option.none()
        })
        expect(step.displayName).toBe(expected)
      }
    })
  })

  describe("type guard", () => {
    it("isConsolidationStep returns true for valid step", () => {
      const step = createPendingStep()
      expect(isConsolidationStep(step)).toBe(true)
    })

    it("isConsolidationStep returns false for invalid values", () => {
      expect(isConsolidationStep(null)).toBe(false)
      expect(isConsolidationStep(undefined)).toBe(false)
      expect(isConsolidationStep({})).toBe(false)
    })
  })
})

// =============================================================================
// createInitialSteps Tests
// =============================================================================

describe("createInitialSteps", () => {
  it("creates 7 pending steps", () => {
    const steps = createInitialSteps()
    expect(Chunk.size(steps)).toBe(7)
  })

  it("creates steps in correct order", () => {
    const steps = createInitialSteps()
    const stepTypes = Chunk.map(steps, (s) => s.stepType)
    expect(Chunk.toReadonlyArray(stepTypes)).toEqual(CONSOLIDATION_STEP_ORDER)
  })

  it("creates all steps as pending", () => {
    const steps = createInitialSteps()
    for (const step of Chunk.toReadonlyArray(steps)) {
      expect(step.status).toBe("Pending")
      expect(step.isPending).toBe(true)
      expect(Option.isNone(step.startedAt)).toBe(true)
      expect(Option.isNone(step.completedAt)).toBe(true)
    }
  })
})

// =============================================================================
// ValidationIssue Tests
// =============================================================================

describe("ValidationIssue", () => {
  it("creates error issue", () => {
    const issue = ValidationIssue.make({
      severity: "Error",
      code: "PERIOD_NOT_CLOSED",
      message: "Fiscal period is not closed",
      entityReference: Option.some("company-123")
    })

    expect(issue.severity).toBe("Error")
    expect(issue.isError).toBe(true)
    expect(issue.isWarning).toBe(false)
    expect(issue.code).toBe("PERIOD_NOT_CLOSED")
  })

  it("creates warning issue", () => {
    const issue = ValidationIssue.make({
      severity: "Warning",
      code: "MISSING_RATE",
      message: "Exchange rate may be stale",
      entityReference: Option.none()
    })

    expect(issue.severity).toBe("Warning")
    expect(issue.isError).toBe(false)
    expect(issue.isWarning).toBe(true)
  })

  describe("type guard", () => {
    it("isValidationIssue returns true for valid issue", () => {
      const issue = ValidationIssue.make({
        severity: "Error",
        code: "TEST",
        message: "Test message",
        entityReference: Option.none()
      })
      expect(isValidationIssue(issue)).toBe(true)
    })

    it("isValidationIssue returns false for invalid values", () => {
      expect(isValidationIssue(null)).toBe(false)
      expect(isValidationIssue(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// ValidationResult Tests
// =============================================================================

describe("ValidationResult", () => {
  it("creates valid result with no issues", () => {
    const result = ValidationResult.make({
      isValid: true,
      issues: Chunk.empty()
    })

    expect(result.isValid).toBe(true)
    expect(result.errorCount).toBe(0)
    expect(result.warningCount).toBe(0)
    expect(result.hasErrors).toBe(false)
    expect(result.hasWarnings).toBe(false)
  })

  it("creates invalid result with errors", () => {
    const error = ValidationIssue.make({
      severity: "Error",
      code: "TEST",
      message: "Test error",
      entityReference: Option.none()
    })
    const warning = ValidationIssue.make({
      severity: "Warning",
      code: "TEST",
      message: "Test warning",
      entityReference: Option.none()
    })

    const result = ValidationResult.make({
      isValid: false,
      issues: Chunk.make(error, warning, error)
    })

    expect(result.isValid).toBe(false)
    expect(result.errorCount).toBe(2)
    expect(result.warningCount).toBe(1)
    expect(result.hasErrors).toBe(true)
    expect(result.hasWarnings).toBe(true)
    expect(Chunk.size(result.errors)).toBe(2)
    expect(Chunk.size(result.warnings)).toBe(1)
  })

  describe("type guard", () => {
    it("isValidationResult returns true for valid result", () => {
      const result = ValidationResult.make({
        isValid: true,
        issues: Chunk.empty()
      })
      expect(isValidationResult(result)).toBe(true)
    })

    it("isValidationResult returns false for invalid values", () => {
      expect(isValidationResult(null)).toBe(false)
      expect(isValidationResult(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidatedTrialBalanceLineItem Tests
// =============================================================================

describe("ConsolidatedTrialBalanceLineItem", () => {
  const amount = MonetaryAmount.unsafeFromString("10000", "USD")
  const elimAmount = MonetaryAmount.unsafeFromString("500", "USD")
  const nciAmount = MonetaryAmount.unsafeFromString("200", "USD")
  const zeroAmount = MonetaryAmount.zero(testCurrency)

  it("creates line item with eliminations and NCI", () => {
    const item = ConsolidatedTrialBalanceLineItem.make({
      accountNumber: "1000",
      accountName: "Cash",
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      aggregatedBalance: amount,
      eliminationAmount: elimAmount,
      nciAmount: Option.some(nciAmount),
      consolidatedBalance: amount
    })

    expect(item.hasEliminations).toBe(true)
    expect(item.hasNCI).toBe(true)
    expect(item.accountCategory).toBe("CurrentAsset")
  })

  it("creates line item without eliminations", () => {
    const item = ConsolidatedTrialBalanceLineItem.make({
      accountNumber: "1000",
      accountName: "Cash",
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      aggregatedBalance: amount,
      eliminationAmount: zeroAmount,
      nciAmount: Option.none(),
      consolidatedBalance: amount
    })

    expect(item.hasEliminations).toBe(false)
    expect(item.hasNCI).toBe(false)
  })

  describe("type guard", () => {
    it("isConsolidatedTrialBalanceLineItem returns true for valid item", () => {
      const item = ConsolidatedTrialBalanceLineItem.make({
        accountNumber: "1000",
        accountName: "Cash",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        aggregatedBalance: amount,
        eliminationAmount: zeroAmount,
        nciAmount: Option.none(),
        consolidatedBalance: amount
      })
      expect(isConsolidatedTrialBalanceLineItem(item)).toBe(true)
    })

    it("isConsolidatedTrialBalanceLineItem returns false for invalid values", () => {
      expect(isConsolidatedTrialBalanceLineItem(null)).toBe(false)
      expect(isConsolidatedTrialBalanceLineItem(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidatedTrialBalance Tests
// =============================================================================

describe("ConsolidatedTrialBalance", () => {
  const now = makeTimestamp()
  const amount = MonetaryAmount.unsafeFromString("10000", "USD")
  const zeroAmount = MonetaryAmount.zero(testCurrency)

  // Map account types to their default categories for testing
  const accountTypeToCategory: Record<"Asset" | "Liability" | "Equity" | "Revenue" | "Expense", AccountCategory> = {
    Asset: "CurrentAsset",
    Liability: "CurrentLiability",
    Equity: "RetainedEarnings",
    Revenue: "OperatingRevenue",
    Expense: "OperatingExpense"
  }

  const createLineItem = (accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense") =>
    ConsolidatedTrialBalanceLineItem.make({
      accountNumber: "1000",
      accountName: "Test Account",
      accountType,
      accountCategory: accountTypeToCategory[accountType],
      aggregatedBalance: amount,
      eliminationAmount: zeroAmount,
      nciAmount: Option.none(),
      consolidatedBalance: amount
    })

  it("creates trial balance with line items", () => {
    const tb = ConsolidatedTrialBalance.make({
      consolidationRunId: runId,
      groupId,
      periodRef,
      asOfDate: testDate,
      currency: testCurrency,
      lineItems: Chunk.make(createLineItem("Asset"), createLineItem("Liability")),
      totalDebits: amount,
      totalCredits: amount,
      totalEliminations: zeroAmount,
      totalNCI: zeroAmount,
      generatedAt: now
    })

    expect(tb.lineCount).toBe(2)
    expect(tb.hasLineItems).toBe(true)
    expect(tb.isBalanced).toBe(true)
  })

  it("creates empty trial balance", () => {
    const tb = ConsolidatedTrialBalance.make({
      consolidationRunId: runId,
      groupId,
      periodRef,
      asOfDate: testDate,
      currency: testCurrency,
      lineItems: Chunk.empty(),
      totalDebits: zeroAmount,
      totalCredits: zeroAmount,
      totalEliminations: zeroAmount,
      totalNCI: zeroAmount,
      generatedAt: now
    })

    expect(tb.lineCount).toBe(0)
    expect(tb.hasLineItems).toBe(false)
    expect(tb.isBalanced).toBe(true)
  })

  describe("type guard", () => {
    it("isConsolidatedTrialBalance returns true for valid TB", () => {
      const tb = ConsolidatedTrialBalance.make({
        consolidationRunId: runId,
        groupId,
        periodRef,
        asOfDate: testDate,
        currency: testCurrency,
        lineItems: Chunk.empty(),
        totalDebits: zeroAmount,
        totalCredits: zeroAmount,
        totalEliminations: zeroAmount,
        totalNCI: zeroAmount,
        generatedAt: now
      })
      expect(isConsolidatedTrialBalance(tb)).toBe(true)
    })

    it("isConsolidatedTrialBalance returns false for invalid values", () => {
      expect(isConsolidatedTrialBalance(null)).toBe(false)
      expect(isConsolidatedTrialBalance(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidationRunOptions Tests
// =============================================================================

describe("ConsolidationRunOptions", () => {
  it("creates options with defaults", () => {
    const opts = ConsolidationRunOptions.make({})

    expect(opts.skipValidation).toBe(false)
    expect(opts.continueOnWarnings).toBe(true)
    expect(opts.includeEquityMethodInvestments).toBe(true)
    expect(opts.forceRegeneration).toBe(false)
  })

  it("creates options with custom values", () => {
    const opts = ConsolidationRunOptions.make({
      skipValidation: true,
      continueOnWarnings: false,
      includeEquityMethodInvestments: false,
      forceRegeneration: true
    })

    expect(opts.skipValidation).toBe(true)
    expect(opts.continueOnWarnings).toBe(false)
    expect(opts.includeEquityMethodInvestments).toBe(false)
    expect(opts.forceRegeneration).toBe(true)
  })

  describe("defaultConsolidationRunOptions", () => {
    it("has expected default values", () => {
      expect(defaultConsolidationRunOptions.skipValidation).toBe(false)
      expect(defaultConsolidationRunOptions.continueOnWarnings).toBe(true)
      expect(defaultConsolidationRunOptions.includeEquityMethodInvestments).toBe(true)
      expect(defaultConsolidationRunOptions.forceRegeneration).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isConsolidationRunOptions returns true for valid options", () => {
      const opts = ConsolidationRunOptions.make({})
      expect(isConsolidationRunOptions(opts)).toBe(true)
    })

    it("isConsolidationRunOptions returns false for invalid values", () => {
      expect(isConsolidationRunOptions(null)).toBe(false)
      expect(isConsolidationRunOptions(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// ConsolidationRun Tests
// =============================================================================

describe("ConsolidationRun", () => {
  const now = makeTimestamp()
  const opts = defaultConsolidationRunOptions

  const createPendingRun = () =>
    ConsolidationRun.make({
      id: runId,
      groupId,
      periodRef,
      asOfDate: testDate,
      status: "Pending",
      steps: createInitialSteps(),
      validationResult: Option.none(),
      consolidatedTrialBalance: Option.none(),
      eliminationEntryIds: Chunk.empty(),
      options: opts,
      initiatedBy: userId,
      initiatedAt: now,
      startedAt: Option.none(),
      completedAt: Option.none(),
      totalDurationMs: Option.none(),
      errorMessage: Option.none()
    })

  const createInProgressRun = () =>
    ConsolidationRun.make({
      id: runId,
      groupId,
      periodRef,
      asOfDate: testDate,
      status: "InProgress",
      steps: Chunk.map(createInitialSteps(), (step, i) =>
        i === 0
          ? ConsolidationStep.make({ ...step, status: "InProgress", startedAt: Option.some(now) })
          : step
      ),
      validationResult: Option.none(),
      consolidatedTrialBalance: Option.none(),
      eliminationEntryIds: Chunk.empty(),
      options: opts,
      initiatedBy: userId,
      initiatedAt: now,
      startedAt: Option.some(now),
      completedAt: Option.none(),
      totalDurationMs: Option.none(),
      errorMessage: Option.none()
    })

  const createCompletedRun = () => {
    const endTime = Timestamp.make({ epochMillis: now.epochMillis + 10000 })
    return ConsolidationRun.make({
      id: runId,
      groupId,
      periodRef,
      asOfDate: testDate,
      status: "Completed",
      steps: Chunk.map(createInitialSteps(), (step) =>
        ConsolidationStep.make({
          ...step,
          status: "Completed",
          startedAt: Option.some(now),
          completedAt: Option.some(endTime),
          durationMs: Option.some(1000)
        })
      ),
      validationResult: Option.some(
        ValidationResult.make({ isValid: true, issues: Chunk.empty() })
      ),
      consolidatedTrialBalance: Option.none(),
      eliminationEntryIds: Chunk.make(
        EliminationEntryId.make("00000000-0000-0000-0003-000000000001"),
        EliminationEntryId.make("00000000-0000-0000-0003-000000000002")
      ),
      options: opts,
      initiatedBy: userId,
      initiatedAt: now,
      startedAt: Option.some(now),
      completedAt: Option.some(endTime),
      totalDurationMs: Option.some(10000),
      errorMessage: Option.none()
    })
  }

  const createFailedRun = () => {
    const endTime = Timestamp.make({ epochMillis: now.epochMillis + 5000 })
    const steps = Chunk.map(createInitialSteps(), (step, i) => {
      if (i < 2) {
        return ConsolidationStep.make({
          ...step,
          status: "Completed",
          startedAt: Option.some(now),
          completedAt: Option.some(endTime),
          durationMs: Option.some(1000)
        })
      }
      if (i === 2) {
        return ConsolidationStep.make({
          ...step,
          status: "Failed",
          startedAt: Option.some(now),
          completedAt: Option.some(endTime),
          durationMs: Option.some(500),
          errorMessage: Option.some("Aggregation failed")
        })
      }
      return step
    })

    return ConsolidationRun.make({
      id: runId,
      groupId,
      periodRef,
      asOfDate: testDate,
      status: "Failed",
      steps,
      validationResult: Option.none(),
      consolidatedTrialBalance: Option.none(),
      eliminationEntryIds: Chunk.empty(),
      options: opts,
      initiatedBy: userId,
      initiatedAt: now,
      startedAt: Option.some(now),
      completedAt: Option.some(endTime),
      totalDurationMs: Option.some(5000),
      errorMessage: Option.some("Aggregation failed")
    })
  }

  describe("status checks", () => {
    it("identifies pending run", () => {
      const run = createPendingRun()
      expect(run.isPending).toBe(true)
      expect(run.isInProgress).toBe(false)
      expect(run.isCompleted).toBe(false)
      expect(run.isFailed).toBe(false)
      expect(run.isCancelled).toBe(false)
      expect(run.isFinished).toBe(false)
    })

    it("identifies in-progress run", () => {
      const run = createInProgressRun()
      expect(run.isPending).toBe(false)
      expect(run.isInProgress).toBe(true)
      expect(run.isFinished).toBe(false)
    })

    it("identifies completed run", () => {
      const run = createCompletedRun()
      expect(run.isCompleted).toBe(true)
      expect(run.isFinished).toBe(true)
    })

    it("identifies failed run", () => {
      const run = createFailedRun()
      expect(run.isFailed).toBe(true)
      expect(run.isFinished).toBe(true)
      expect(run.hasError).toBe(true)
    })

    it("identifies cancelled run", () => {
      const run = ConsolidationRun.make({
        ...createPendingRun(),
        status: "Cancelled"
      })
      expect(run.isCancelled).toBe(true)
      expect(run.isFinished).toBe(true)
    })
  })

  describe("step tracking", () => {
    it("counts total steps", () => {
      const run = createPendingRun()
      expect(run.stepCount).toBe(7)
    })

    it("counts completed steps", () => {
      const run = createCompletedRun()
      expect(run.completedStepCount).toBe(7)
    })

    it("counts failed steps", () => {
      const run = createFailedRun()
      expect(run.failedStepCount).toBe(1)
    })

    it("calculates progress percent", () => {
      const pendingRun = createPendingRun()
      expect(pendingRun.progressPercent).toBe(0)

      const completedRun = createCompletedRun()
      expect(completedRun.progressPercent).toBe(100)

      const failedRun = createFailedRun()
      // 2 completed + 1 failed = 3 finished out of 7
      expect(failedRun.progressPercent).toBe(43)
    })

    it("finds current step", () => {
      const run = createInProgressRun()
      const currentStep = run.currentStep
      expect(Option.isSome(currentStep)).toBe(true)
      expect(Option.getOrThrow(currentStep).stepType).toBe("Validate")
    })

    it("finds current step type", () => {
      const run = createInProgressRun()
      const currentStepType = run.currentStepType
      expect(Option.isSome(currentStepType)).toBe(true)
      expect(Option.getOrThrow(currentStepType)).toBe("Validate")
    })

    it("gets step by type", () => {
      const run = createPendingRun()
      const translateStep = run.getStep("Translate")
      expect(Option.isSome(translateStep)).toBe(true)
      expect(Option.getOrThrow(translateStep).stepType).toBe("Translate")
    })

    it("returns none for non-existent step type", () => {
      const run = ConsolidationRun.make({
        ...createPendingRun(),
        steps: Chunk.empty()
      })
      const step = run.getStep("Validate")
      expect(Option.isNone(step)).toBe(true)
    })
  })

  describe("validation tracking", () => {
    it("identifies when validation passed", () => {
      const run = createCompletedRun()
      expect(run.validationPassed).toBe(true)
    })

    it("identifies when validation failed", () => {
      const run = ConsolidationRun.make({
        ...createPendingRun(),
        validationResult: Option.some(
          ValidationResult.make({
            isValid: false,
            issues: Chunk.of(
              ValidationIssue.make({
                severity: "Error",
                code: "TEST",
                message: "Test",
                entityReference: Option.none()
              })
            )
          })
        )
      })
      expect(run.validationPassed).toBe(false)
    })

    it("identifies when validation not run", () => {
      const run = createPendingRun()
      expect(run.validationPassed).toBe(false)
    })
  })

  describe("elimination tracking", () => {
    it("counts elimination entries", () => {
      const run = createCompletedRun()
      expect(run.eliminationEntryCount).toBe(2)
    })

    it("identifies when elimination entries exist", () => {
      const run = createCompletedRun()
      expect(run.hasEliminationEntries).toBe(true)
    })

    it("identifies when no elimination entries", () => {
      const run = createPendingRun()
      expect(run.hasEliminationEntries).toBe(false)
    })
  })

  describe("consolidated trial balance", () => {
    it("identifies when CTB exists", () => {
      const zeroAmount = MonetaryAmount.zero(testCurrency)
      const ctb = ConsolidatedTrialBalance.make({
        consolidationRunId: runId,
        groupId,
        periodRef,
        asOfDate: testDate,
        currency: testCurrency,
        lineItems: Chunk.empty(),
        totalDebits: zeroAmount,
        totalCredits: zeroAmount,
        totalEliminations: zeroAmount,
        totalNCI: zeroAmount,
        generatedAt: now
      })

      const run = ConsolidationRun.make({
        ...createCompletedRun(),
        consolidatedTrialBalance: Option.some(ctb)
      })
      expect(run.hasConsolidatedTrialBalance).toBe(true)
    })

    it("identifies when CTB does not exist", () => {
      const run = createPendingRun()
      expect(run.hasConsolidatedTrialBalance).toBe(false)
    })
  })

  describe("type guard", () => {
    it("isConsolidationRun returns true for valid run", () => {
      const run = createPendingRun()
      expect(isConsolidationRun(run)).toBe(true)
    })

    it("isConsolidationRun returns false for invalid values", () => {
      expect(isConsolidationRun(null)).toBe(false)
      expect(isConsolidationRun(undefined)).toBe(false)
      expect(isConsolidationRun({})).toBe(false)
    })
  })
})
