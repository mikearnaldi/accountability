/**
 * IntercompanyTransactionsApi - HTTP API group for intercompany transaction management
 *
 * Provides endpoints for CRUD operations on intercompany transactions,
 * including reconciliation, matching status updates, and journal entry linking.
 *
 * @module IntercompanyTransactionsApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  IntercompanyTransaction,
  IntercompanyTransactionId,
  IntercompanyTransactionType,
  MatchingStatus
} from "@accountability/core/consolidation/IntercompanyTransaction"
import { CompanyId } from "@accountability/core/company/Company"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { JournalEntryId } from "@accountability/core/journal/JournalEntry"
import { LocalDateFromString } from "@accountability/core/shared/values/LocalDate"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  IntercompanyTransactionNotFoundError,
  IntercompanyTransactionCannotBeDeletedError,
  SameCompanyIntercompanyError
} from "@accountability/core/consolidation/ConsolidationErrors"

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * CreateIntercompanyTransactionRequest - Request body for creating a new intercompany transaction
 *
 * Optional JE linking: Users can optionally link journal entries during creation
 * instead of requiring separate link actions after the fact.
 */
export class CreateIntercompanyTransactionRequest extends Schema.Class<CreateIntercompanyTransactionRequest>("CreateIntercompanyTransactionRequest")({
  organizationId: OrganizationId,
  fromCompanyId: CompanyId,
  toCompanyId: CompanyId,
  transactionType: IntercompanyTransactionType,
  transactionDate: LocalDateFromString,
  amount: MonetaryAmount,
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  // Optional JE linking during creation (per Issue 36)
  fromJournalEntryId: Schema.OptionFromNullOr(JournalEntryId),
  toJournalEntryId: Schema.OptionFromNullOr(JournalEntryId)
}) {}

/**
 * UpdateIntercompanyTransactionRequest - Request body for updating an intercompany transaction
 */
export class UpdateIntercompanyTransactionRequest extends Schema.Class<UpdateIntercompanyTransactionRequest>("UpdateIntercompanyTransactionRequest")({
  transactionType: Schema.OptionFromNullOr(IntercompanyTransactionType),
  transactionDate: Schema.OptionFromNullOr(LocalDateFromString),
  amount: Schema.OptionFromNullOr(MonetaryAmount),
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  varianceAmount: Schema.OptionFromNullOr(MonetaryAmount),
  varianceExplanation: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {}

/**
 * UpdateMatchingStatusRequest - Request body for updating the matching status
 */
export class UpdateMatchingStatusRequest extends Schema.Class<UpdateMatchingStatusRequest>("UpdateMatchingStatusRequest")({
  matchingStatus: MatchingStatus,
  varianceExplanation: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString)
}) {}

/**
 * LinkJournalEntryRequest - Request body for linking a journal entry
 */
export class LinkJournalEntryRequest extends Schema.Class<LinkJournalEntryRequest>("LinkJournalEntryRequest")({
  journalEntryId: JournalEntryId
}) {}

/**
 * IntercompanyTransactionListResponse - Response containing a list of intercompany transactions
 */
export class IntercompanyTransactionListResponse extends Schema.Class<IntercompanyTransactionListResponse>("IntercompanyTransactionListResponse")({
  transactions: Schema.Array(IntercompanyTransaction),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Query parameters for listing intercompany transactions
 */
export const IntercompanyTransactionListParams = Schema.Struct({
  fromCompanyId: Schema.optional(CompanyId),
  toCompanyId: Schema.optional(CompanyId),
  companyId: Schema.optional(CompanyId),
  transactionType: Schema.optional(IntercompanyTransactionType),
  matchingStatus: Schema.optional(MatchingStatus),
  startDate: Schema.optional(LocalDateFromString),
  endDate: Schema.optional(LocalDateFromString),
  requiresElimination: Schema.optional(Schema.BooleanFromString),
  unmatched: Schema.optional(Schema.BooleanFromString),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

export type IntercompanyTransactionListParams = typeof IntercompanyTransactionListParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List all intercompany transactions with filtering
 */
const listIntercompanyTransactions = HttpApiEndpoint.get("listIntercompanyTransactions", "/")
  .setUrlParams(IntercompanyTransactionListParams)
  .addSuccess(IntercompanyTransactionListResponse)
  .annotateContext(OpenApi.annotations({
    summary: "List intercompany transactions",
    description: "Retrieve a paginated list of intercompany transactions. Supports filtering by company, transaction type, matching status, date range, and other criteria."
  }))

/**
 * Get a single intercompany transaction by ID
 */
const getIntercompanyTransaction = HttpApiEndpoint.get("getIntercompanyTransaction", "/:id")
  .setPath(Schema.Struct({ id: IntercompanyTransactionId }))
  .addSuccess(IntercompanyTransaction)
  .addError(IntercompanyTransactionNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get intercompany transaction",
    description: "Retrieve a single intercompany transaction by its unique identifier."
  }))

/**
 * Create a new intercompany transaction
 */
const createIntercompanyTransaction = HttpApiEndpoint.post("createIntercompanyTransaction", "/")
  .setPayload(CreateIntercompanyTransactionRequest)
  .addSuccess(IntercompanyTransaction, { status: 201 })
  .addError(CompanyNotFoundError)
  .addError(SameCompanyIntercompanyError)
  .annotateContext(OpenApi.annotations({
    summary: "Create intercompany transaction",
    description: "Create a new intercompany transaction between two related companies."
  }))

/**
 * Update an existing intercompany transaction
 */
const updateIntercompanyTransaction = HttpApiEndpoint.put("updateIntercompanyTransaction", "/:id")
  .setPath(Schema.Struct({ id: IntercompanyTransactionId }))
  .setPayload(UpdateIntercompanyTransactionRequest)
  .addSuccess(IntercompanyTransaction)
  .addError(IntercompanyTransactionNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Update intercompany transaction",
    description: "Update an existing intercompany transaction. Only certain fields can be updated depending on the transaction status."
  }))

/**
 * Delete an intercompany transaction
 */
const deleteIntercompanyTransaction = HttpApiEndpoint.del("deleteIntercompanyTransaction", "/:id")
  .setPath(Schema.Struct({ id: IntercompanyTransactionId }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(IntercompanyTransactionNotFoundError)
  .addError(IntercompanyTransactionCannotBeDeletedError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete intercompany transaction",
    description: "Delete an intercompany transaction. Transactions that have been matched or eliminated may not be deleted."
  }))

/**
 * Update the matching status of an intercompany transaction
 */
const updateMatchingStatus = HttpApiEndpoint.post("updateMatchingStatus", "/:id/matching-status")
  .setPath(Schema.Struct({ id: IntercompanyTransactionId }))
  .setPayload(UpdateMatchingStatusRequest)
  .addSuccess(IntercompanyTransaction)
  .addError(IntercompanyTransactionNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Update matching status",
    description: "Update the matching status of an intercompany transaction. Use this during reconciliation to mark transactions as matched, partially matched, or to approve variances."
  }))

/**
 * Link a journal entry to the 'from' side of the transaction
 */
const linkFromJournalEntry = HttpApiEndpoint.post("linkFromJournalEntry", "/:id/link-from-journal-entry")
  .setPath(Schema.Struct({ id: IntercompanyTransactionId }))
  .setPayload(LinkJournalEntryRequest)
  .addSuccess(IntercompanyTransaction)
  .addError(IntercompanyTransactionNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Link from journal entry",
    description: "Link a journal entry to the 'from' (seller/lender) side of the intercompany transaction."
  }))

/**
 * Link a journal entry to the 'to' side of the transaction
 */
const linkToJournalEntry = HttpApiEndpoint.post("linkToJournalEntry", "/:id/link-to-journal-entry")
  .setPath(Schema.Struct({ id: IntercompanyTransactionId }))
  .setPayload(LinkJournalEntryRequest)
  .addSuccess(IntercompanyTransaction)
  .addError(IntercompanyTransactionNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Link to journal entry",
    description: "Link a journal entry to the 'to' (buyer/borrower) side of the intercompany transaction."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * IntercompanyTransactionsApi - API group for intercompany transaction management
 *
 * Base path: /api/v1/intercompany-transactions
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class IntercompanyTransactionsApi extends HttpApiGroup.make("intercompanyTransactions")
  .add(listIntercompanyTransactions)
  .add(getIntercompanyTransaction)
  .add(createIntercompanyTransaction)
  .add(updateIntercompanyTransaction)
  .add(deleteIntercompanyTransaction)
  .add(updateMatchingStatus)
  .add(linkFromJournalEntry)
  .add(linkToJournalEntry)
  .middleware(AuthMiddleware)
  .prefix("/v1/intercompany-transactions")
  .annotateContext(OpenApi.annotations({
    title: "Intercompany Transactions",
    description: "Manage intercompany transactions between related companies within a consolidation group. Includes reconciliation, matching status updates, and journal entry linking."
  })) {}
