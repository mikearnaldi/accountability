/**
 * JournalEntriesApi - HTTP API group for journal entry management
 *
 * Provides endpoints for CRUD operations on journal entries,
 * including creating, posting, and reversing entries.
 *
 * @module JournalEntriesApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  JournalEntry,
  JournalEntryId,
  JournalEntryStatus,
  JournalEntryType,
  SourceModule,
  UserId
} from "@accountability/core/domain/JournalEntry"
import { JournalEntryLine } from "@accountability/core/domain/JournalEntryLine"
import { AccountId } from "@accountability/core/domain/Account"
import { CompanyId } from "@accountability/core/domain/Company"
import { FiscalPeriodRef } from "@accountability/core/domain/FiscalPeriodRef"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { MonetaryAmount } from "@accountability/core/domain/MonetaryAmount"
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError
} from "./ApiErrors.ts"

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * CreateJournalEntryLineRequest - Line item for creating a journal entry
 */
export class CreateJournalEntryLineRequest extends Schema.Class<CreateJournalEntryLineRequest>("CreateJournalEntryLineRequest")({
  accountId: AccountId,
  debitAmount: Schema.OptionFromNullOr(MonetaryAmount),
  creditAmount: Schema.OptionFromNullOr(MonetaryAmount),
  memo: Schema.OptionFromNullOr(Schema.String),
  dimensions: Schema.OptionFromNullOr(Schema.Record({
    key: Schema.String,
    value: Schema.String
  })),
  intercompanyPartnerId: Schema.OptionFromNullOr(CompanyId)
}) {}

/**
 * CreateJournalEntryRequest - Request body for creating a new journal entry
 */
export class CreateJournalEntryRequest extends Schema.Class<CreateJournalEntryRequest>("CreateJournalEntryRequest")({
  companyId: CompanyId,
  description: Schema.NonEmptyTrimmedString,
  transactionDate: LocalDate,
  documentDate: Schema.OptionFromNullOr(LocalDate),
  fiscalPeriod: FiscalPeriodRef,
  entryType: JournalEntryType,
  sourceModule: SourceModule,
  referenceNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  sourceDocumentRef: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  lines: Schema.Array(CreateJournalEntryLineRequest).pipe(
    Schema.minItems(2)
  )
}) {}

/**
 * UpdateJournalEntryRequest - Request body for updating a draft journal entry
 */
export class UpdateJournalEntryRequest extends Schema.Class<UpdateJournalEntryRequest>("UpdateJournalEntryRequest")({
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  transactionDate: Schema.OptionFromNullOr(LocalDate),
  documentDate: Schema.OptionFromNullOr(LocalDate),
  fiscalPeriod: Schema.OptionFromNullOr(FiscalPeriodRef),
  referenceNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  sourceDocumentRef: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  lines: Schema.OptionFromNullOr(
    Schema.Array(CreateJournalEntryLineRequest).pipe(Schema.minItems(2))
  )
}) {}

/**
 * PostJournalEntryRequest - Request to post a journal entry
 */
export class PostJournalEntryRequest extends Schema.Class<PostJournalEntryRequest>("PostJournalEntryRequest")({
  postedBy: UserId,
  postingDate: Schema.OptionFromNullOr(LocalDate)
}) {}

/**
 * ReverseJournalEntryRequest - Request to reverse a posted journal entry
 */
export class ReverseJournalEntryRequest extends Schema.Class<ReverseJournalEntryRequest>("ReverseJournalEntryRequest")({
  reversalDate: LocalDate,
  reversalDescription: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  reversedBy: UserId
}) {}

/**
 * JournalEntryWithLines - Journal entry including its line items
 */
export class JournalEntryWithLinesResponse extends Schema.Class<JournalEntryWithLinesResponse>("JournalEntryWithLinesResponse")({
  entry: JournalEntry,
  lines: Schema.Array(JournalEntryLine)
}) {}

/**
 * JournalEntryListResponse - Response containing a list of journal entries
 */
export class JournalEntryListResponse extends Schema.Class<JournalEntryListResponse>("JournalEntryListResponse")({
  entries: Schema.Array(JournalEntry),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Query parameters for listing journal entries
 * URL params must be string-encodeable, so we use primitive types with validation
 */
export const JournalEntryListParams = Schema.Struct({
  companyId: Schema.String.pipe(Schema.brand("CompanyId")),
  status: Schema.optional(JournalEntryStatus),
  entryType: Schema.optional(JournalEntryType),
  sourceModule: Schema.optional(SourceModule),
  fiscalYear: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
  fiscalPeriod: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
  fromDate: Schema.optional(Schema.String),
  toDate: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

/**
 * Type for JournalEntryListParams
 */
export type JournalEntryListParams = typeof JournalEntryListParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List journal entries with filtering
 */
const listJournalEntries = HttpApiEndpoint.get("listJournalEntries", "/")
  .setUrlParams(JournalEntryListParams)
  .addSuccess(JournalEntryListResponse)
  .addError(NotFoundError)
  .addError(ValidationError)

/**
 * Get a single journal entry by ID
 */
const getJournalEntry = HttpApiEndpoint.get("getJournalEntry", "/:id")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .addSuccess(JournalEntryWithLinesResponse)
  .addError(NotFoundError)

/**
 * Create a new journal entry
 */
const createJournalEntry = HttpApiEndpoint.post("createJournalEntry", "/")
  .setPayload(CreateJournalEntryRequest)
  .addSuccess(JournalEntryWithLinesResponse, { status: 201 })
  .addError(ValidationError)
  .addError(BusinessRuleError)

/**
 * Update a draft journal entry
 */
const updateJournalEntry = HttpApiEndpoint.put("updateJournalEntry", "/:id")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setPayload(UpdateJournalEntryRequest)
  .addSuccess(JournalEntryWithLinesResponse)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(BusinessRuleError)
  .addError(ConflictError)

/**
 * Delete a draft journal entry
 */
const deleteJournalEntry = HttpApiEndpoint.del("deleteJournalEntry", "/:id")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

/**
 * Submit a journal entry for approval
 */
const submitForApproval = HttpApiEndpoint.post("submitForApproval", "/:id/submit")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .addSuccess(JournalEntry)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

/**
 * Approve a journal entry
 */
const approveJournalEntry = HttpApiEndpoint.post("approveJournalEntry", "/:id/approve")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .addSuccess(JournalEntry)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

/**
 * Reject a journal entry (return to draft)
 */
const rejectJournalEntry = HttpApiEndpoint.post("rejectJournalEntry", "/:id/reject")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setPayload(Schema.Struct({
    reason: Schema.OptionFromNullOr(Schema.String)
  }))
  .addSuccess(JournalEntry)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

/**
 * Post a journal entry to the general ledger
 */
const postJournalEntry = HttpApiEndpoint.post("postJournalEntry", "/:id/post")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setPayload(PostJournalEntryRequest)
  .addSuccess(JournalEntry)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

/**
 * Reverse a posted journal entry
 */
const reverseJournalEntry = HttpApiEndpoint.post("reverseJournalEntry", "/:id/reverse")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setPayload(ReverseJournalEntryRequest)
  .addSuccess(JournalEntryWithLinesResponse)
  .addError(NotFoundError)
  .addError(BusinessRuleError)

// =============================================================================
// API Group
// =============================================================================

/**
 * JournalEntriesApi - API group for journal entry management
 *
 * Base path: /api/v1/journal-entries
 */
export class JournalEntriesApi extends HttpApiGroup.make("journal-entries")
  .add(listJournalEntries)
  .add(getJournalEntry)
  .add(createJournalEntry)
  .add(updateJournalEntry)
  .add(deleteJournalEntry)
  .add(submitForApproval)
  .add(approveJournalEntry)
  .add(rejectJournalEntry)
  .add(postJournalEntry)
  .add(reverseJournalEntry)
  .prefix("/v1/journal-entries") {}
