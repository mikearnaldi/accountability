/**
 * JournalEntry - Journal Entry entity for double-entry bookkeeping
 *
 * Represents a journal entry header with all properties per specs/ACCOUNTING_RESEARCH.md
 * including dates, period, type, status, and audit information.
 *
 * Journal Entry Types per spec:
 * - Standard: Manual journal entries for day-to-day transactions
 * - Adjusting: Period-end adjustments (accruals, deferrals, corrections)
 * - Closing: Year-end closing entries
 * - Opening: Beginning balance entries for new fiscal year
 * - Reversing: Reversal of prior entry for error correction
 * - Recurring: Auto-generated recurring entries
 * - Intercompany: Transactions between related companies
 * - Revaluation: Currency revaluation entries
 * - Elimination: Consolidation elimination entries
 * - System: System-generated entries from sub-modules
 *
 * Status Workflow:
 * Draft -> PendingApproval -> Approved -> Posted -> Reversed
 *
 * @module journal/JournalEntry
 */

import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { CompanyId } from "../company/Company.ts"
import { FiscalPeriodRef } from "../fiscal/FiscalPeriodRef.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * JournalEntryId - Branded UUID string for journal entry identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const JournalEntryId = Schema.UUID.pipe(
  Schema.brand("JournalEntryId"),
  Schema.annotations({
    identifier: "JournalEntryId",
    title: "Journal Entry ID",
    description: "A unique identifier for a journal entry (UUID format)"
  })
)

/**
 * The branded JournalEntryId type
 */
export type JournalEntryId = typeof JournalEntryId.Type

/**
 * Type guard for JournalEntryId using Schema.is
 */
export const isJournalEntryId = Schema.is(JournalEntryId)

/**
 * EntryNumber - Branded string for sequential entry numbering
 *
 * Sequential entry numbers are assigned when entries are posted.
 * Format is company-specific but typically follows patterns like:
 * - "JE-2025-00001"
 * - "2025-001"
 * - "GL00001"
 */
export const EntryNumber = Schema.NonEmptyTrimmedString.pipe(
  Schema.brand("EntryNumber"),
  Schema.annotations({
    identifier: "EntryNumber",
    title: "Entry Number",
    description: "Sequential entry number for tracking (e.g., 'JE-2025-00001')"
  })
)

/**
 * The branded EntryNumber type
 */
export type EntryNumber = typeof EntryNumber.Type

/**
 * Type guard for EntryNumber using Schema.is
 */
export const isEntryNumber = Schema.is(EntryNumber)

/**
 * JournalEntryType - Classification of journal entry type
 *
 * Per specs/ACCOUNTING_RESEARCH.md Journal Entry Types:
 * - Standard: Manual journal entries for day-to-day transactions
 * - Adjusting: Period-end adjustments (accruals, deferrals, corrections)
 * - Closing: Year-end closing entries
 * - Opening: Beginning balance entries for new fiscal year
 * - Reversing: Reversal of prior entry for error correction
 * - Recurring: Auto-generated recurring entries
 * - Intercompany: Transactions between related companies
 * - Revaluation: Currency revaluation entries
 * - Elimination: Consolidation elimination entries
 * - System: System-generated entries from sub-modules
 */
export const JournalEntryType = Schema.Literal(
  "Standard",
  "Adjusting",
  "Closing",
  "Opening",
  "Reversing",
  "Recurring",
  "Intercompany",
  "Revaluation",
  "Elimination",
  "System"
).annotations({
  identifier: "JournalEntryType",
  title: "Journal Entry Type",
  description: "Classification of the journal entry type"
})

/**
 * The JournalEntryType type
 */
export type JournalEntryType = typeof JournalEntryType.Type

/**
 * Type guard for JournalEntryType using Schema.is
 */
export const isJournalEntryType = Schema.is(JournalEntryType)

/**
 * JournalEntryStatus - Status workflow for journal entries
 *
 * Per specs/ACCOUNTING_RESEARCH.md Status Workflow:
 * - Draft: Initial creation, editable
 * - PendingApproval: Awaiting authorization
 * - Approved: Authorized but not yet posted
 * - Posted: Recorded in general ledger
 * - Reversed: Entry has been reversed
 */
export const JournalEntryStatus = Schema.Literal(
  "Draft",
  "PendingApproval",
  "Approved",
  "Posted",
  "Reversed"
).annotations({
  identifier: "JournalEntryStatus",
  title: "Journal Entry Status",
  description: "Status in the journal entry workflow"
})

/**
 * The JournalEntryStatus type
 */
export type JournalEntryStatus = typeof JournalEntryStatus.Type

/**
 * Type guard for JournalEntryStatus using Schema.is
 */
export const isJournalEntryStatus = Schema.is(JournalEntryStatus)

/**
 * SourceModule - Originating module for journal entries
 *
 * Per specs/ACCOUNTING_RESEARCH.md:
 * - GeneralLedger: Direct GL entry
 * - AccountsPayable: AP module
 * - AccountsReceivable: AR module
 * - FixedAssets: Fixed asset module
 * - Inventory: Inventory module
 * - Payroll: Payroll module
 * - Consolidation: Consolidation process
 */
export const SourceModule = Schema.Literal(
  "GeneralLedger",
  "AccountsPayable",
  "AccountsReceivable",
  "FixedAssets",
  "Inventory",
  "Payroll",
  "Consolidation"
).annotations({
  identifier: "SourceModule",
  title: "Source Module",
  description: "The module that originated this journal entry"
})

/**
 * The SourceModule type
 */
export type SourceModule = typeof SourceModule.Type

/**
 * Type guard for SourceModule using Schema.is
 */
export const isSourceModule = Schema.is(SourceModule)

/**
 * UserId - Branded UUID string for user identification
 *
 * Used for audit fields (createdBy, postedBy).
 */
export const UserId = Schema.UUID.pipe(
  Schema.brand("UserId"),
  Schema.annotations({
    identifier: "UserId",
    title: "User ID",
    description: "A unique identifier for a user (UUID format)"
  })
)

/**
 * The branded UserId type
 */
export type UserId = typeof UserId.Type

/**
 * Type guard for UserId using Schema.is
 */
export const isUserId = Schema.is(UserId)

/**
 * JournalEntry - Journal Entry header entity
 *
 * Represents a journal entry with all header properties per specs/ACCOUNTING_RESEARCH.md.
 * Does not include journal entry lines (those are handled separately).
 *
 * Key features:
 * - Multiple date fields (transaction, posting, document)
 * - Fiscal period assignment
 * - Entry type classification
 * - Status workflow
 * - Reversal tracking
 * - Audit information
 */
export class JournalEntry extends Schema.Class<JournalEntry>("JournalEntry")({
  /**
   * Unique identifier for the journal entry
   */
  id: JournalEntryId,

  /**
   * Reference to the company that owns this entry
   */
  companyId: CompanyId,

  /**
   * Sequential entry number (assigned when posted)
   * Optional because draft entries may not have a number yet
   */
  entryNumber: Schema.OptionFromNullOr(EntryNumber).annotations({
    title: "Entry Number",
    description: "Sequential entry number (assigned when posted)"
  }),

  /**
   * Optional reference number (external document reference)
   */
  referenceNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Reference Number",
    description: "External reference number (e.g., invoice number)"
  }),

  /**
   * Description/narrative for the journal entry
   */
  description: Schema.NonEmptyTrimmedString.annotations({
    title: "Description",
    description: "Description or narrative for the journal entry"
  }),

  /**
   * Transaction date: When the economic event occurred
   */
  transactionDate: LocalDate,

  /**
   * Posting date: When posted to the general ledger
   * Optional because draft entries are not yet posted
   */
  postingDate: Schema.OptionFromNullOr(LocalDate).annotations({
    title: "Posting Date",
    description: "Date when posted to the general ledger"
  }),

  /**
   * Document date: Date on source document (optional)
   */
  documentDate: Schema.OptionFromNullOr(LocalDate).annotations({
    title: "Document Date",
    description: "Date on the source document"
  }),

  /**
   * Fiscal period reference (year and period)
   */
  fiscalPeriod: FiscalPeriodRef,

  /**
   * Entry type classification
   */
  entryType: JournalEntryType,

  /**
   * Source module that originated this entry
   */
  sourceModule: SourceModule,

  /**
   * Source document reference (optional)
   */
  sourceDocumentRef: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Source Document Reference",
    description: "Reference to the source document"
  }),

  /**
   * Multi-currency flag
   * True if the entry contains lines in multiple currencies
   */
  isMultiCurrency: Schema.Boolean.annotations({
    title: "Is Multi-Currency",
    description: "Whether entry contains lines in multiple currencies"
  }),

  /**
   * Status in the entry workflow
   */
  status: JournalEntryStatus,

  /**
   * Is reversing entry flag
   * True if this entry reverses another entry
   */
  isReversing: Schema.Boolean.annotations({
    title: "Is Reversing",
    description: "Whether this entry is a reversal of another entry"
  }),

  /**
   * Reference to reversed entry (if this is a reversal)
   * The ID of the entry that this entry reverses
   */
  reversedEntryId: Schema.OptionFromNullOr(JournalEntryId).annotations({
    title: "Reversed Entry ID",
    description: "ID of the entry that this entry reverses"
  }),

  /**
   * Reference to reversing entry (if this has been reversed)
   * The ID of the entry that reversed this entry
   */
  reversingEntryId: Schema.OptionFromNullOr(JournalEntryId).annotations({
    title: "Reversing Entry ID",
    description: "ID of the entry that reversed this entry"
  }),

  /**
   * Created by (user reference)
   */
  createdBy: UserId,

  /**
   * Creation timestamp
   */
  createdAt: Timestamp,

  /**
   * Posted by (user reference, if posted)
   */
  postedBy: Schema.OptionFromNullOr(UserId).annotations({
    title: "Posted By",
    description: "User who posted the entry"
  }),

  /**
   * Posted timestamp (if posted)
   */
  postedAt: Schema.OptionFromNullOr(Timestamp).annotations({
    title: "Posted At",
    description: "Timestamp when the entry was posted"
  })
}) {
  /**
   * Check if the entry is in draft status
   */
  get isDraft(): boolean {
    return this.status === "Draft"
  }

  /**
   * Check if the entry is pending approval
   */
  get isPendingApproval(): boolean {
    return this.status === "PendingApproval"
  }

  /**
   * Check if the entry is approved but not yet posted
   */
  get isApproved(): boolean {
    return this.status === "Approved"
  }

  /**
   * Check if the entry is posted
   */
  get isPosted(): boolean {
    return this.status === "Posted"
  }

  /**
   * Check if the entry has been reversed
   */
  get isReversed(): boolean {
    return this.status === "Reversed"
  }

  /**
   * Check if the entry can be edited
   * Only draft entries can be edited
   */
  get isEditable(): boolean {
    return this.status === "Draft"
  }

  /**
   * Check if the entry can be submitted for approval
   */
  get canSubmitForApproval(): boolean {
    return this.status === "Draft"
  }

  /**
   * Check if the entry can be approved
   */
  get canApprove(): boolean {
    return this.status === "PendingApproval"
  }

  /**
   * Check if the entry can be posted
   */
  get canPost(): boolean {
    return this.status === "Approved"
  }

  /**
   * Check if the entry can be reversed
   * Only posted entries can be reversed
   */
  get canReverse(): boolean {
    return this.status === "Posted"
  }

  /**
   * Check if the entry has an entry number
   */
  get hasEntryNumber(): boolean {
    return Option.isSome(this.entryNumber)
  }

  /**
   * Check if the entry has been assigned a posting date
   */
  get hasPostingDate(): boolean {
    return Option.isSome(this.postingDate)
  }

  /**
   * Check if this entry is a reversal entry
   */
  get isReversalEntry(): boolean {
    return this.isReversing && Option.isSome(this.reversedEntryId)
  }

  /**
   * Check if this entry has been reversed by another entry
   */
  get hasBeenReversed(): boolean {
    return Option.isSome(this.reversingEntryId)
  }

  /**
   * Check if entry is a standard journal entry
   */
  get isStandardEntry(): boolean {
    return this.entryType === "Standard"
  }

  /**
   * Check if entry is an adjusting entry
   */
  get isAdjustingEntry(): boolean {
    return this.entryType === "Adjusting"
  }

  /**
   * Check if entry is a closing entry
   */
  get isClosingEntry(): boolean {
    return this.entryType === "Closing"
  }

  /**
   * Check if entry is an opening entry
   */
  get isOpeningEntry(): boolean {
    return this.entryType === "Opening"
  }

  /**
   * Check if entry is a reversing entry type
   */
  get isReversingEntryType(): boolean {
    return this.entryType === "Reversing"
  }

  /**
   * Check if entry is a recurring entry
   */
  get isRecurringEntry(): boolean {
    return this.entryType === "Recurring"
  }

  /**
   * Check if entry is an intercompany entry
   */
  get isIntercompanyEntry(): boolean {
    return this.entryType === "Intercompany"
  }

  /**
   * Check if entry is a revaluation entry
   */
  get isRevaluationEntry(): boolean {
    return this.entryType === "Revaluation"
  }

  /**
   * Check if entry is an elimination entry
   */
  get isEliminationEntry(): boolean {
    return this.entryType === "Elimination"
  }

  /**
   * Check if entry is a system-generated entry
   */
  get isSystemEntry(): boolean {
    return this.entryType === "System"
  }

  /**
   * Check if entry originated from General Ledger
   */
  get isFromGeneralLedger(): boolean {
    return this.sourceModule === "GeneralLedger"
  }

  /**
   * Check if entry originated from a sub-module
   */
  get isFromSubModule(): boolean {
    return this.sourceModule !== "GeneralLedger"
  }

  /**
   * Get the fiscal year from the fiscal period
   */
  get fiscalYear(): number {
    return this.fiscalPeriod.year
  }

  /**
   * Get the fiscal period number from the fiscal period
   */
  get fiscalPeriodNumber(): number {
    return this.fiscalPeriod.period
  }
}

/**
 * Type guard for JournalEntry using Schema.is
 */
export const isJournalEntry = Schema.is(JournalEntry)
