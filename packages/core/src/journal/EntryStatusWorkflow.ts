/**
 * EntryStatusWorkflow - State machine for journal entry status transitions
 *
 * Implements status transition rules for journal entries with validation
 * of allowed transitions per specs/ACCOUNTING_RESEARCH.md workflow.
 *
 * Status Workflow:
 * - Draft -> PendingApproval: Submit for approval
 * - PendingApproval -> Approved: Approve entry
 * - PendingApproval -> Draft: Reject entry (return for edits)
 * - Approved -> Posted: Post to general ledger
 * - Posted -> Reversed: Only via separate reversal entry creation
 *
 * Important: The transition from Posted to Reversed is NOT allowed
 * through normal status transitions. A posted entry becomes Reversed
 * only when a separate reversing entry is created and posted.
 *
 * @module journal/EntryStatusWorkflow
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as Array from "effect/Array"
import * as Option from "effect/Option"
import type { JournalEntryStatus } from "./JournalEntry.ts"

/**
 * StatusTransition - Represents a single allowed status transition
 *
 * This is a pure data structure representing one allowed transition
 * from one status to another, with a description of what the transition means.
 */
export class StatusTransition extends Schema.Class<StatusTransition>("StatusTransition")({
  /**
   * The status to transition from
   */
  from: Schema.Literal("Draft", "PendingApproval", "Approved", "Posted", "Reversed"),

  /**
   * The status to transition to
   */
  to: Schema.Literal("Draft", "PendingApproval", "Approved", "Posted", "Reversed"),

  /**
   * Human-readable description of what this transition represents
   */
  description: Schema.NonEmptyTrimmedString
}) {}

/**
 * Type guard for StatusTransition using Schema.is
 */
export const isStatusTransition = Schema.is(StatusTransition)

/**
 * TransitionAction - The action that triggers a status transition
 *
 * These are the business actions that cause status changes.
 */
export const TransitionAction = Schema.Literal(
  "Submit",      // Draft -> PendingApproval
  "Approve",     // PendingApproval -> Approved
  "Reject",      // PendingApproval -> Draft
  "Post",        // Approved -> Posted
  "MarkReversed" // Posted -> Reversed (internal only, via reversal entry)
).annotations({
  identifier: "TransitionAction",
  title: "Transition Action",
  description: "The action that triggers a status transition"
})

/**
 * The TransitionAction type
 */
export type TransitionAction = typeof TransitionAction.Type

/**
 * Type guard for TransitionAction using Schema.is
 */
export const isTransitionAction = Schema.is(TransitionAction)

/**
 * Allowed status transitions as a pure data structure.
 *
 * This is the source of truth for all valid status transitions in the system.
 * Each transition is documented with its business meaning.
 *
 * Note: The Posted -> Reversed transition is included but is marked as
 * only allowed via reversal entry creation, not direct status change.
 */
export const allowedTransitions: ReadonlyArray<StatusTransition> = [
  // Draft -> PendingApproval: Submit entry for approval
  StatusTransition.make({
    from: "Draft",
    to: "PendingApproval",
    description: "Submit entry for approval"
  }),

  // PendingApproval -> Approved: Approve the entry
  StatusTransition.make({
    from: "PendingApproval",
    to: "Approved",
    description: "Approve the entry"
  }),

  // PendingApproval -> Draft: Reject entry (return for edits)
  StatusTransition.make({
    from: "PendingApproval",
    to: "Draft",
    description: "Reject entry and return for edits"
  }),

  // Approved -> Posted: Post entry to general ledger
  StatusTransition.make({
    from: "Approved",
    to: "Posted",
    description: "Post entry to general ledger"
  })
]

/**
 * Internal transitions that are only allowed via special operations.
 * These transitions cannot be performed via normal canTransition checks.
 *
 * Posted -> Reversed: Only allowed when creating a reversing entry
 */
export const internalTransitions: ReadonlyArray<StatusTransition> = [
  StatusTransition.make({
    from: "Posted",
    to: "Reversed",
    description: "Mark entry as reversed (only via reversal entry creation)"
  })
]

/**
 * All transitions including internal ones (for reference/documentation)
 */
export const allTransitions: ReadonlyArray<StatusTransition> = [
  ...allowedTransitions,
  ...internalTransitions
]

/**
 * InvalidStatusTransitionError - Error for disallowed status transitions
 *
 * Thrown when attempting an invalid status transition.
 */
export class InvalidStatusTransitionError extends Schema.TaggedError<InvalidStatusTransitionError>()(
  "InvalidStatusTransitionError",
  {
    /**
     * The current status of the entry
     */
    from: Schema.Literal("Draft", "PendingApproval", "Approved", "Posted", "Reversed"),

    /**
     * The status that was attempted to transition to
     */
    to: Schema.Literal("Draft", "PendingApproval", "Approved", "Posted", "Reversed"),

    /**
     * Optional reason for why the transition is not allowed
     */
    reason: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  /**
   * Human-readable error message
   */
  get message(): string {
    const baseMessage = `Cannot transition from '${this.from}' to '${this.to}'`
    if (this.reason._tag === "Some") {
      return `${baseMessage}: ${this.reason.value}`
    }
    return baseMessage
  }
}

/**
 * Type guard for InvalidStatusTransitionError using Schema.is
 */
export const isInvalidStatusTransitionError = Schema.is(InvalidStatusTransitionError)

/**
 * Check if a status transition is allowed (direct transitions only).
 *
 * This function checks whether transitioning from one status to another
 * is allowed via the normal status transition rules.
 *
 * Important: This does NOT include the Posted -> Reversed transition,
 * which is only allowed via reversal entry creation.
 *
 * @param from - The current status
 * @param to - The desired target status
 * @returns true if the transition is allowed, false otherwise
 *
 * @example
 * ```ts
 * canTransition("Draft", "PendingApproval") // true
 * canTransition("Draft", "Posted") // false
 * canTransition("Posted", "Reversed") // false (requires reversal entry)
 * ```
 */
export const canTransition = (from: JournalEntryStatus, to: JournalEntryStatus): boolean => {
  return Array.some(
    allowedTransitions,
    (t) => t.from === from && t.to === to
  )
}

/**
 * Check if a transition can be performed via reversal entry.
 *
 * This specifically checks for the Posted -> Reversed transition
 * which is only allowed when creating a separate reversing entry.
 *
 * @param from - The current status (should be "Posted")
 * @param to - The desired target status (should be "Reversed")
 * @returns true if this is the reversal transition, false otherwise
 */
export const canTransitionViaReversal = (from: JournalEntryStatus, to: JournalEntryStatus): boolean => {
  return from === "Posted" && to === "Reversed"
}

/**
 * Check if a transition is allowed (including internal transitions).
 *
 * This includes all transitions, even internal ones like Posted -> Reversed.
 * Use with caution - prefer canTransition for normal operations.
 *
 * @param from - The current status
 * @param to - The desired target status
 * @returns true if the transition is allowed (including internal), false otherwise
 */
export const canTransitionIncludingInternal = (from: JournalEntryStatus, to: JournalEntryStatus): boolean => {
  return Array.some(
    allTransitions,
    (t) => t.from === from && t.to === to
  )
}

/**
 * Get the description of a transition if it exists.
 *
 * @param from - The current status
 * @param to - The target status
 * @returns The description if the transition exists, undefined otherwise
 */
export const getTransitionDescription = (
  from: JournalEntryStatus,
  to: JournalEntryStatus
): string | undefined => {
  const transition = Array.findFirst(
    allTransitions,
    (t) => t.from === from && t.to === to
  )
  return transition._tag === "Some" ? transition.value.description : undefined
}

/**
 * Get all allowed transitions from a given status.
 *
 * Returns only direct transitions (not internal ones).
 *
 * @param from - The current status
 * @returns Array of statuses that can be transitioned to
 */
export const getAllowedTransitionsFrom = (from: JournalEntryStatus): ReadonlyArray<JournalEntryStatus> => {
  return Array.filterMap(
    allowedTransitions,
    (t) => t.from === from ? Option.some(t.to) : Option.none()
  )
}

/**
 * Get the action required to perform a status transition.
 *
 * Uses Match from effect for pattern matching on status pairs.
 *
 * @param from - The current status
 * @param to - The target status
 * @returns The action name if the transition is valid, undefined otherwise
 */
export const getTransitionAction = (
  from: JournalEntryStatus,
  to: JournalEntryStatus
): TransitionAction | undefined => {
  const pair = { from, to }

  return Match.value(pair).pipe(
    Match.when({ from: "Draft", to: "PendingApproval" }, () => "Submit" as const),
    Match.when({ from: "PendingApproval", to: "Approved" }, () => "Approve" as const),
    Match.when({ from: "PendingApproval", to: "Draft" }, () => "Reject" as const),
    Match.when({ from: "Approved", to: "Posted" }, () => "Post" as const),
    Match.when({ from: "Posted", to: "Reversed" }, () => "MarkReversed" as const),
    Match.orElse(() => undefined)
  )
}

/**
 * Validate a status transition and return an Effect.
 *
 * Returns Effect.succeed(to) if the transition is allowed,
 * or Effect.fail(InvalidStatusTransitionError) if not allowed.
 *
 * Uses Match from effect for exhaustive pattern matching.
 *
 * @param from - The current status
 * @param to - The target status
 * @returns Effect that succeeds with the target status or fails with error
 */
export const validateTransition = (
  from: JournalEntryStatus,
  to: JournalEntryStatus
): Effect.Effect<JournalEntryStatus, InvalidStatusTransitionError> => {
  // Use Match for pattern matching on the from status to provide contextual error messages
  const validateFromStatus = Match.type<JournalEntryStatus>().pipe(
    Match.when("Draft", () => {
      if (to === "PendingApproval") {
        return Effect.succeed(to)
      }
      return Effect.fail(new InvalidStatusTransitionError({
        from,
        to,
        reason: Option.some("Draft entries can only be submitted for approval")
      }))
    }),
    Match.when("PendingApproval", () => {
      if (to === "Approved" || to === "Draft") {
        return Effect.succeed(to)
      }
      return Effect.fail(new InvalidStatusTransitionError({
        from,
        to,
        reason: Option.some("Pending approval entries can only be approved or rejected")
      }))
    }),
    Match.when("Approved", () => {
      if (to === "Posted") {
        return Effect.succeed(to)
      }
      return Effect.fail(new InvalidStatusTransitionError({
        from,
        to,
        reason: Option.some("Approved entries can only be posted")
      }))
    }),
    Match.when("Posted", () => {
      if (to === "Reversed") {
        return Effect.fail(new InvalidStatusTransitionError({
          from,
          to,
          reason: Option.some("Posted entries can only be reversed via separate reversal entry creation")
        }))
      }
      return Effect.fail(new InvalidStatusTransitionError({
        from,
        to,
        reason: Option.some("Posted entries cannot be modified directly")
      }))
    }),
    Match.when("Reversed", () => {
      return Effect.fail(new InvalidStatusTransitionError({
        from,
        to,
        reason: Option.some("Reversed entries cannot be modified")
      }))
    }),
    Match.exhaustive
  )

  return validateFromStatus(from)
}

/**
 * Validate a status transition including internal transitions.
 *
 * This variant allows the Posted -> Reversed transition, which should
 * only be used when creating a reversing entry.
 *
 * @param from - The current status
 * @param to - The target status
 * @returns Effect that succeeds with the target status or fails with error
 */
export const validateTransitionIncludingInternal = (
  from: JournalEntryStatus,
  to: JournalEntryStatus
): Effect.Effect<JournalEntryStatus, InvalidStatusTransitionError> => {
  if (canTransitionIncludingInternal(from, to)) {
    return Effect.succeed(to)
  }

  return Effect.fail(new InvalidStatusTransitionError({
    from,
    to,
    reason: Option.none()
  }))
}

/**
 * Get the next status based on an action, using Match for pattern matching.
 *
 * Given a current status and an action, returns the resulting status
 * if the action is valid for that status.
 *
 * @param status - The current status
 * @param action - The action to perform
 * @returns The new status if valid, undefined otherwise
 */
export const getNextStatus = (
  status: JournalEntryStatus,
  action: TransitionAction
): JournalEntryStatus | undefined => {
  const pair = { status, action }

  return Match.value(pair).pipe(
    Match.when({ status: "Draft", action: "Submit" }, () => "PendingApproval" as const),
    Match.when({ status: "PendingApproval", action: "Approve" }, () => "Approved" as const),
    Match.when({ status: "PendingApproval", action: "Reject" }, () => "Draft" as const),
    Match.when({ status: "Approved", action: "Post" }, () => "Posted" as const),
    Match.when({ status: "Posted", action: "MarkReversed" }, () => "Reversed" as const),
    Match.orElse(() => undefined)
  )
}

/**
 * Check if an action is valid for a given status.
 *
 * @param status - The current status
 * @param action - The action to check
 * @returns true if the action is valid for the status, false otherwise
 */
export const isActionValidForStatus = (
  status: JournalEntryStatus,
  action: TransitionAction
): boolean => {
  return getNextStatus(status, action) !== undefined
}

/**
 * Get all valid actions for a given status.
 *
 * Returns an array of actions that can be performed on an entry
 * with the given status.
 *
 * Uses Match for pattern matching on status.
 *
 * @param status - The current status
 * @returns Array of valid actions
 */
export const getValidActionsForStatus = (
  status: JournalEntryStatus
): ReadonlyArray<TransitionAction> => {
  return Match.value(status).pipe(
    Match.when("Draft", () => ["Submit"] as const),
    Match.when("PendingApproval", () => ["Approve", "Reject"] as const),
    Match.when("Approved", () => ["Post"] as const),
    Match.when("Posted", () => ["MarkReversed"] as const), // Internal only
    Match.when("Reversed", () => [] as const),
    Match.exhaustive
  )
}

/**
 * Get user-facing valid actions for a given status.
 *
 * Unlike getValidActionsForStatus, this excludes internal actions
 * like MarkReversed that cannot be triggered by users directly.
 *
 * @param status - The current status
 * @returns Array of user-facing valid actions
 */
export const getUserActionsForStatus = (
  status: JournalEntryStatus
): ReadonlyArray<TransitionAction> => {
  return Match.value(status).pipe(
    Match.when("Draft", () => ["Submit"] as const),
    Match.when("PendingApproval", () => ["Approve", "Reject"] as const),
    Match.when("Approved", () => ["Post"] as const),
    Match.when("Posted", () => [] as const), // MarkReversed is internal
    Match.when("Reversed", () => [] as const),
    Match.exhaustive
  )
}

/**
 * Check if a status is a terminal status (no further transitions possible).
 *
 * @param status - The status to check
 * @returns true if the status is terminal, false otherwise
 */
export const isTerminalStatus = (status: JournalEntryStatus): boolean => {
  return Match.value(status).pipe(
    Match.when("Draft", () => false),
    Match.when("PendingApproval", () => false),
    Match.when("Approved", () => false),
    Match.when("Posted", () => false), // Can become Reversed via reversal entry
    Match.when("Reversed", () => true),
    Match.exhaustive
  )
}

/**
 * Check if an entry with the given status is editable.
 *
 * @param status - The status to check
 * @returns true if entries with this status can be edited, false otherwise
 */
export const isEditableStatus = (status: JournalEntryStatus): boolean => {
  return Match.value(status).pipe(
    Match.when("Draft", () => true),
    Match.when("PendingApproval", () => false),
    Match.when("Approved", () => false),
    Match.when("Posted", () => false),
    Match.when("Reversed", () => false),
    Match.exhaustive
  )
}

/**
 * Check if an entry with the given status can be deleted.
 *
 * Only draft entries can be deleted.
 *
 * @param status - The status to check
 * @returns true if entries with this status can be deleted, false otherwise
 */
export const isDeletableStatus = (status: JournalEntryStatus): boolean => {
  return Match.value(status).pipe(
    Match.when("Draft", () => true),
    Match.when("PendingApproval", () => false),
    Match.when("Approved", () => false),
    Match.when("Posted", () => false),
    Match.when("Reversed", () => false),
    Match.exhaustive
  )
}
