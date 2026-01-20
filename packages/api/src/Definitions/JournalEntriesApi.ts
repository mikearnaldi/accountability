/**
 * JournalEntriesApi - HTTP API group for journal entry management
 *
 * Provides endpoints for CRUD operations on journal entries,
 * including creating, posting, and reversing entries.
 *
 * @module JournalEntriesApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  JournalEntry,
  JournalEntryId,
  JournalEntryStatus,
  JournalEntryType,
  SourceModule,
  UserId
} from "@accountability/core/journal/JournalEntry"
import { JournalEntryLine } from "@accountability/core/journal/JournalEntryLine"
import { AccountId } from "@accountability/core/accounting/Account"
import { CompanyId } from "@accountability/core/company/Company"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import { LocalDateFromString } from "@accountability/core/shared/values/LocalDate"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import {
  AuditLogError,
  ForbiddenError,
  UserLookupError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  JournalEntryNotFoundError,
  JournalEntryStatusError,
  JournalEntryAlreadyReversedError,
  UnbalancedJournalEntryError
} from "@accountability/core/journal/JournalErrors"
import { FiscalPeriodNotFoundForDateError, FiscalPeriodClosedError } from "@accountability/core/fiscal/FiscalPeriodErrors"

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
 * Uses LocalDateFromString to automatically parse ISO date strings (YYYY-MM-DD)
 *
 * fiscalPeriod is optional - if not provided, it will be computed from the
 * transactionDate and the company's fiscalYearEnd setting.
 */
export class CreateJournalEntryRequest extends Schema.Class<CreateJournalEntryRequest>("CreateJournalEntryRequest")({
  organizationId: OrganizationId,
  companyId: CompanyId,
  description: Schema.NonEmptyTrimmedString,
  transactionDate: LocalDateFromString,
  documentDate: Schema.OptionFromNullOr(LocalDateFromString),
  fiscalPeriod: Schema.OptionFromNullOr(FiscalPeriodRef),
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
 * Uses LocalDateFromString to automatically parse ISO date strings (YYYY-MM-DD)
 */
export class UpdateJournalEntryRequest extends Schema.Class<UpdateJournalEntryRequest>("UpdateJournalEntryRequest")({
  organizationId: OrganizationId,
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  transactionDate: Schema.OptionFromNullOr(LocalDateFromString),
  documentDate: Schema.OptionFromNullOr(LocalDateFromString),
  fiscalPeriod: Schema.OptionFromNullOr(FiscalPeriodRef),
  referenceNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  sourceDocumentRef: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  lines: Schema.OptionFromNullOr(
    Schema.Array(CreateJournalEntryLineRequest).pipe(Schema.minItems(2))
  )
}) {}

/**
 * PostJournalEntryRequest - Request to post a journal entry
 * Uses LocalDateFromString to automatically parse ISO date strings (YYYY-MM-DD)
 */
export class PostJournalEntryRequest extends Schema.Class<PostJournalEntryRequest>("PostJournalEntryRequest")({
  organizationId: OrganizationId,
  postedBy: UserId,
  postingDate: Schema.OptionFromNullOr(LocalDateFromString)
}) {}

/**
 * ReverseJournalEntryRequest - Request to reverse a posted journal entry
 * Uses LocalDateFromString to automatically parse ISO date strings (YYYY-MM-DD)
 */
export class ReverseJournalEntryRequest extends Schema.Class<ReverseJournalEntryRequest>("ReverseJournalEntryRequest")({
  organizationId: OrganizationId,
  reversalDate: LocalDateFromString,
  reversalDescription: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  reversedBy: UserId
}) {}

/**
 * Common URL params for endpoints that need organizationId
 */
export const OrganizationIdUrlParams = Schema.Struct({
  organizationId: Schema.String.pipe(Schema.brand("OrganizationId"))
})

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
 * Uses LocalDateFromString to automatically parse ISO date strings to LocalDate
 */
export const JournalEntryListParams = Schema.Struct({
  organizationId: Schema.String.pipe(Schema.brand("OrganizationId")),
  companyId: Schema.String.pipe(Schema.brand("CompanyId")),
  status: Schema.optional(JournalEntryStatus),
  entryType: Schema.optional(JournalEntryType),
  sourceModule: Schema.optional(SourceModule),
  fiscalYear: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
  fiscalPeriod: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
  fromDate: Schema.optional(LocalDateFromString),
  toDate: Schema.optional(LocalDateFromString),
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
  .addError(CompanyNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List journal entries",
    description: "Retrieve a paginated list of journal entries for a company. Supports filtering by status, type, source module, fiscal period, and date range."
  }))

/**
 * Get a single journal entry by ID
 */
const getJournalEntry = HttpApiEndpoint.get("getJournalEntry", "/:id")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setUrlParams(OrganizationIdUrlParams)
  .addSuccess(JournalEntryWithLinesResponse)
  .addError(JournalEntryNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get journal entry",
    description: "Retrieve a single journal entry with all its line items by unique identifier."
  }))

/**
 * Create a new journal entry
 */
const createJournalEntry = HttpApiEndpoint.post("createJournalEntry", "/")
  .setPayload(CreateJournalEntryRequest)
  .addSuccess(JournalEntryWithLinesResponse, { status: 201 })
  .addError(CompanyNotFoundError)
  .addError(UnbalancedJournalEntryError)
  .addError(FiscalPeriodNotFoundForDateError)
  .addError(FiscalPeriodClosedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Create journal entry",
    description: "Create a new journal entry in draft status. Entries must have at least two lines and debits must equal credits."
  }))

/**
 * Update a draft journal entry
 */
const updateJournalEntry = HttpApiEndpoint.put("updateJournalEntry", "/:id")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setPayload(UpdateJournalEntryRequest)
  .addSuccess(JournalEntryWithLinesResponse)
  .addError(JournalEntryNotFoundError)
  .addError(JournalEntryStatusError)
  .addError(UnbalancedJournalEntryError)
  .addError(FiscalPeriodNotFoundForDateError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Update journal entry",
    description: "Update a draft journal entry. Only entries in draft status can be updated."
  }))

/**
 * Delete a draft journal entry
 */
const deleteJournalEntry = HttpApiEndpoint.del("deleteJournalEntry", "/:id")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setUrlParams(OrganizationIdUrlParams)
  .addSuccess(HttpApiSchema.NoContent)
  .addError(JournalEntryNotFoundError)
  .addError(JournalEntryStatusError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete journal entry",
    description: "Delete a draft journal entry. Only entries in draft status can be deleted."
  }))

/**
 * Submit a journal entry for approval
 */
const submitForApproval = HttpApiEndpoint.post("submitForApproval", "/:id/submit")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setUrlParams(OrganizationIdUrlParams)
  .addSuccess(JournalEntry)
  .addError(JournalEntryNotFoundError)
  .addError(JournalEntryStatusError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Submit for approval",
    description: "Submit a draft journal entry for approval. Changes the status from draft to pending_approval."
  }))

/**
 * Approve a journal entry
 */
const approveJournalEntry = HttpApiEndpoint.post("approveJournalEntry", "/:id/approve")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setUrlParams(OrganizationIdUrlParams)
  .addSuccess(JournalEntry)
  .addError(JournalEntryNotFoundError)
  .addError(JournalEntryStatusError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Approve journal entry",
    description: "Approve a pending journal entry. Changes the status from pending_approval to approved."
  }))

/**
 * Reject a journal entry (return to draft)
 */
const rejectJournalEntry = HttpApiEndpoint.post("rejectJournalEntry", "/:id/reject")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setUrlParams(OrganizationIdUrlParams)
  .setPayload(Schema.Struct({
    reason: Schema.OptionFromNullOr(Schema.String)
  }))
  .addSuccess(JournalEntry)
  .addError(JournalEntryNotFoundError)
  .addError(JournalEntryStatusError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Reject journal entry",
    description: "Reject a pending journal entry and return it to draft status for corrections."
  }))

/**
 * Post a journal entry to the general ledger
 */
const postJournalEntry = HttpApiEndpoint.post("postJournalEntry", "/:id/post")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setPayload(PostJournalEntryRequest)
  .addSuccess(JournalEntry)
  .addError(JournalEntryNotFoundError)
  .addError(JournalEntryStatusError)
  .addError(FiscalPeriodNotFoundForDateError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Post journal entry",
    description: "Post an approved journal entry to the general ledger. This updates account balances and changes the status to posted."
  }))

/**
 * Reverse a posted journal entry
 */
const reverseJournalEntry = HttpApiEndpoint.post("reverseJournalEntry", "/:id/reverse")
  .setPath(Schema.Struct({ id: JournalEntryId }))
  .setPayload(ReverseJournalEntryRequest)
  .addSuccess(JournalEntryWithLinesResponse)
  .addError(JournalEntryNotFoundError)
  .addError(JournalEntryStatusError)
  .addError(JournalEntryAlreadyReversedError)
  .addError(FiscalPeriodNotFoundForDateError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Reverse journal entry",
    description: "Reverse a posted journal entry by creating a new entry with opposite debits and credits."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * JournalEntriesApi - API group for journal entry management
 *
 * Base path: /api/v1/journal-entries
 * Protected by: AuthMiddleware (bearer token authentication)
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
  .middleware(AuthMiddleware)
  .prefix("/v1/journal-entries")
  .annotateContext(OpenApi.annotations({
    title: "Journal Entries",
    description: "Manage journal entries for double-entry bookkeeping. Entries go through a workflow: draft → pending_approval → approved → posted. Posted entries can be reversed."
  })) {}
