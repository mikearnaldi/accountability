/**
 * JournalErrors - Domain errors for Journal domain
 *
 * These errors are used for JournalEntry-related operations and include
 * HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * @module journal/JournalErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404)
// =============================================================================

/**
 * JournalEntryNotFoundError - Journal entry does not exist
 */
export class JournalEntryNotFoundError extends Schema.TaggedError<JournalEntryNotFoundError>()(
  "JournalEntryNotFoundError",
  {
    entryId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Journal entry not found: ${this.entryId}`
  }
}

export const isJournalEntryNotFoundError = Schema.is(JournalEntryNotFoundError)

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * UnbalancedJournalEntryError - Journal entry debits and credits do not balance
 */
export class UnbalancedJournalEntryError extends Schema.TaggedError<UnbalancedJournalEntryError>()(
  "UnbalancedJournalEntryError",
  {
    totalDebits: Schema.String,
    totalCredits: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Journal entry is unbalanced: debits (${this.totalDebits}) != credits (${this.totalCredits})`
  }
}

export const isUnbalancedJournalEntryError = Schema.is(UnbalancedJournalEntryError)

// =============================================================================
// Conflict Errors (409)
// =============================================================================

/**
 * JournalEntryStatusError - Invalid journal entry status for operation
 */
export class JournalEntryStatusError extends Schema.TaggedError<JournalEntryStatusError>()(
  "JournalEntryStatusError",
  {
    entryId: Schema.String,
    currentStatus: Schema.String,
    requiredStatus: Schema.String,
    operation: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot ${this.operation}: status is '${this.currentStatus}', must be '${this.requiredStatus}'`
  }
}

export const isJournalEntryStatusError = Schema.is(JournalEntryStatusError)

/**
 * JournalEntryAlreadyReversedError - Journal entry has already been reversed
 */
export class JournalEntryAlreadyReversedError extends Schema.TaggedError<JournalEntryAlreadyReversedError>()(
  "JournalEntryAlreadyReversedError",
  {
    entryId: Schema.String,
    reversingEntryId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Journal entry ${this.entryId} has already been reversed by entry ${this.reversingEntryId}`
  }
}

export const isJournalEntryAlreadyReversedError = Schema.is(JournalEntryAlreadyReversedError)
