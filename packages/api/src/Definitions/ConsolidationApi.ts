/**
 * ConsolidationApi - HTTP API group for consolidation group and run management
 *
 * Provides endpoints for CRUD operations on consolidation groups and runs,
 * including run initiation, status tracking, and result retrieval.
 *
 * @module ConsolidationApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  ConsolidationGroup,
  ConsolidationGroupId,
  ConsolidationMember
} from "@accountability/core/consolidation/ConsolidationGroup"
import {
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationRunStatus,
  ConsolidatedTrialBalance
} from "@accountability/core/consolidation/ConsolidationRun"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { CompanyId, ConsolidationMethod } from "@accountability/core/company/Company"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import { LocalDateFromString } from "@accountability/core/shared/values/LocalDate"
import { Percentage } from "@accountability/core/shared/values/Percentage"
import {
  AuditLogError,
  ForbiddenError,
  UserLookupError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  ConsolidationGroupNotFoundError,
  ConsolidationRunNotFoundError,
  ConsolidationMemberNotFoundError,
  ConsolidationGroupInactiveError,
  ConsolidationGroupHasCompletedRunsError,
  ConsolidationGroupDeleteNotSupportedError,
  ConsolidationMemberAlreadyExistsError,
  ConsolidationRunExistsForPeriodError,
  ConsolidationRunCannotBeCancelledError,
  ConsolidationRunCannotBeDeletedError,
  ConsolidationRunNotCompletedError,
  ConsolidatedTrialBalanceNotAvailableError,
  ConsolidatedBalanceSheetNotBalancedError,
  ConsolidationReportGenerationError
} from "@accountability/core/consolidation/ConsolidationErrors"

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * GroupMemberInput - Input for adding a member to a consolidation group
 */
export class GroupMemberInput extends Schema.Class<GroupMemberInput>("GroupMemberInput")({
  companyId: CompanyId,
  ownershipPercentage: Percentage,
  consolidationMethod: ConsolidationMethod,
  acquisitionDate: Schema.optionalWith(LocalDateFromString, { as: "Option" })
}) {}

/**
 * CreateConsolidationGroupRequest - Request body for creating a new consolidation group
 */
export class CreateConsolidationGroupRequest extends Schema.Class<CreateConsolidationGroupRequest>("CreateConsolidationGroupRequest")({
  organizationId: OrganizationId,
  name: Schema.NonEmptyTrimmedString,
  reportingCurrency: CurrencyCode,
  consolidationMethod: ConsolidationMethod,
  parentCompanyId: CompanyId,
  members: Schema.Array(GroupMemberInput)
}) {}

/**
 * UpdateConsolidationGroupRequest - Request body for updating a consolidation group
 */
export class UpdateConsolidationGroupRequest extends Schema.Class<UpdateConsolidationGroupRequest>("UpdateConsolidationGroupRequest")({
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  consolidationMethod: Schema.OptionFromNullOr(ConsolidationMethod),
  reportingCurrency: Schema.OptionFromNullOr(CurrencyCode)
}) {}

/**
 * AddMemberRequest - Request body for adding a member to a consolidation group
 */
export class AddMemberRequest extends Schema.Class<AddMemberRequest>("AddMemberRequest")({
  companyId: CompanyId,
  ownershipPercentage: Percentage,
  consolidationMethod: ConsolidationMethod,
  acquisitionDate: Schema.optionalWith(LocalDateFromString, { as: "Option" })
}) {}

/**
 * UpdateMemberRequest - Request body for updating a member in a consolidation group
 */
export class UpdateMemberRequest extends Schema.Class<UpdateMemberRequest>("UpdateMemberRequest")({
  ownershipPercentage: Schema.OptionFromNullOr(Percentage),
  consolidationMethod: Schema.OptionFromNullOr(ConsolidationMethod),
  acquisitionDate: Schema.OptionFromNullOr(LocalDateFromString)
}) {}

/**
 * InitiateConsolidationRunRequest - Request body for initiating a consolidation run
 */
export class InitiateConsolidationRunRequest extends Schema.Class<InitiateConsolidationRunRequest>("InitiateConsolidationRunRequest")({
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDateFromString,
  initiatedBy: Schema.UUID.pipe(Schema.brand("UserId")),
  skipValidation: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  continueOnWarnings: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  includeEquityMethodInvestments: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  forceRegeneration: Schema.optionalWith(Schema.Boolean, { default: () => false })
}) {}

/**
 * ConsolidationGroupListResponse - Response containing a list of consolidation groups
 */
export class ConsolidationGroupListResponse extends Schema.Class<ConsolidationGroupListResponse>("ConsolidationGroupListResponse")({
  groups: Schema.Array(ConsolidationGroup),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * ConsolidationGroupWithMembersResponse - Response containing a consolidation group with its members
 */
export class ConsolidationGroupWithMembersResponse extends Schema.Class<ConsolidationGroupWithMembersResponse>("ConsolidationGroupWithMembersResponse")({
  group: ConsolidationGroup,
  members: Schema.Array(ConsolidationMember)
}) {}

/**
 * ConsolidationRunListResponse - Response containing a list of consolidation runs
 */
export class ConsolidationRunListResponse extends Schema.Class<ConsolidationRunListResponse>("ConsolidationRunListResponse")({
  runs: Schema.Array(ConsolidationRun),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Query parameters for listing consolidation groups
 */
export const ConsolidationGroupListParams = Schema.Struct({
  organizationId: OrganizationId,
  isActive: Schema.optional(Schema.BooleanFromString),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

export type ConsolidationGroupListParams = typeof ConsolidationGroupListParams.Type

/**
 * URL parameters with organization ID for single-resource endpoints
 */
export const OrganizationIdUrlParam = Schema.Struct({
  organizationId: OrganizationId
})

export type OrganizationIdUrlParam = typeof OrganizationIdUrlParam.Type

/**
 * Query parameters for listing consolidation runs
 */
export const ConsolidationRunListParams = Schema.Struct({
  organizationId: OrganizationId,
  groupId: Schema.optional(ConsolidationGroupId),
  status: Schema.optional(ConsolidationRunStatus),
  year: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
  period: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

export type ConsolidationRunListParams = typeof ConsolidationRunListParams.Type

// =============================================================================
// Consolidation Group Endpoints
// =============================================================================

/**
 * List all consolidation groups with filtering
 */
const listConsolidationGroups = HttpApiEndpoint.get("listConsolidationGroups", "/groups")
  .setUrlParams(ConsolidationGroupListParams)
  .addSuccess(ConsolidationGroupListResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List consolidation groups",
    description: "Retrieve a paginated list of consolidation groups. Supports filtering by organization and status."
  }))

/**
 * Get a single consolidation group by ID with its members
 */
const getConsolidationGroup = HttpApiEndpoint.get("getConsolidationGroup", "/groups/:id")
  .setPath(Schema.Struct({ id: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidationGroupWithMembersResponse)
  .addError(ConsolidationGroupNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get consolidation group",
    description: "Retrieve a single consolidation group by its unique identifier, including all of its members."
  }))

/**
 * Create a new consolidation group
 */
const createConsolidationGroup = HttpApiEndpoint.post("createConsolidationGroup", "/groups")
  .setPayload(CreateConsolidationGroupRequest)
  .addSuccess(ConsolidationGroupWithMembersResponse, { status: 201 })
  .addError(CompanyNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Create consolidation group",
    description: "Create a new consolidation group with its initial members."
  }))

/**
 * Update a consolidation group
 */
const updateConsolidationGroup = HttpApiEndpoint.put("updateConsolidationGroup", "/groups/:id")
  .setPath(Schema.Struct({ id: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .setPayload(UpdateConsolidationGroupRequest)
  .addSuccess(ConsolidationGroup)
  .addError(ConsolidationGroupNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Update consolidation group",
    description: "Update an existing consolidation group's details."
  }))

/**
 * Delete a consolidation group
 */
const deleteConsolidationGroup = HttpApiEndpoint.del("deleteConsolidationGroup", "/groups/:id")
  .setPath(Schema.Struct({ id: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(HttpApiSchema.NoContent)
  .addError(ConsolidationGroupNotFoundError)
  .addError(ConsolidationGroupHasCompletedRunsError)
  .addError(ConsolidationGroupDeleteNotSupportedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete consolidation group",
    description: "Delete a consolidation group. Groups with completed runs may not be deleted."
  }))

/**
 * Activate a consolidation group
 */
const activateConsolidationGroup = HttpApiEndpoint.post("activateConsolidationGroup", "/groups/:id/activate")
  .setPath(Schema.Struct({ id: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidationGroup)
  .addError(ConsolidationGroupNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Activate consolidation group",
    description: "Activate a consolidation group for use in consolidation runs."
  }))

/**
 * Deactivate a consolidation group
 */
const deactivateConsolidationGroup = HttpApiEndpoint.post("deactivateConsolidationGroup", "/groups/:id/deactivate")
  .setPath(Schema.Struct({ id: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidationGroup)
  .addError(ConsolidationGroupNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Deactivate consolidation group",
    description: "Deactivate a consolidation group. Deactivated groups cannot be used in new consolidation runs."
  }))

// =============================================================================
// Group Member Endpoints
// =============================================================================

/**
 * Add a member to a consolidation group
 */
const addGroupMember = HttpApiEndpoint.post("addGroupMember", "/groups/:id/members")
  .setPath(Schema.Struct({ id: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .setPayload(AddMemberRequest)
  .addSuccess(ConsolidationGroupWithMembersResponse)
  .addError(ConsolidationGroupNotFoundError)
  .addError(ConsolidationMemberAlreadyExistsError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Add group member",
    description: "Add a new member (company) to a consolidation group."
  }))

/**
 * Update a member in a consolidation group
 */
const updateGroupMember = HttpApiEndpoint.put("updateGroupMember", "/groups/:id/members/:companyId")
  .setPath(Schema.Struct({ id: ConsolidationGroupId, companyId: CompanyId }))
  .setUrlParams(OrganizationIdUrlParam)
  .setPayload(UpdateMemberRequest)
  .addSuccess(ConsolidationGroupWithMembersResponse)
  .addError(ConsolidationGroupNotFoundError)
  .addError(ConsolidationMemberNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Update group member",
    description: "Update a member's ownership percentage or consolidation method."
  }))

/**
 * Remove a member from a consolidation group
 */
const removeGroupMember = HttpApiEndpoint.del("removeGroupMember", "/groups/:id/members/:companyId")
  .setPath(Schema.Struct({ id: ConsolidationGroupId, companyId: CompanyId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidationGroupWithMembersResponse)
  .addError(ConsolidationGroupNotFoundError)
  .addError(ConsolidationMemberNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Remove group member",
    description: "Remove a member (company) from a consolidation group."
  }))

// =============================================================================
// Consolidation Run Endpoints
// =============================================================================

/**
 * List all consolidation runs with filtering
 */
const listConsolidationRuns = HttpApiEndpoint.get("listConsolidationRuns", "/runs")
  .setUrlParams(ConsolidationRunListParams)
  .addSuccess(ConsolidationRunListResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List consolidation runs",
    description: "Retrieve a paginated list of consolidation runs. Supports filtering by group, status, and period."
  }))

/**
 * Get a single consolidation run by ID
 */
const getConsolidationRun = HttpApiEndpoint.get("getConsolidationRun", "/runs/:id")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidationRun)
  .addError(ConsolidationRunNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get consolidation run",
    description: "Retrieve a single consolidation run by its unique identifier, including step statuses."
  }))

/**
 * Initiate a new consolidation run
 */
const initiateConsolidationRun = HttpApiEndpoint.post("initiateConsolidationRun", "/groups/:groupId/runs")
  .setPath(Schema.Struct({ groupId: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .setPayload(InitiateConsolidationRunRequest)
  .addSuccess(ConsolidationRun, { status: 201 })
  .addError(ConsolidationGroupNotFoundError)
  .addError(ConsolidationGroupInactiveError)
  .addError(ConsolidationRunExistsForPeriodError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Initiate consolidation run",
    description: "Start a new consolidation run for a group and period. The run will execute asynchronously."
  }))

/**
 * Cancel a consolidation run
 */
const cancelConsolidationRun = HttpApiEndpoint.post("cancelConsolidationRun", "/runs/:id/cancel")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidationRun)
  .addError(ConsolidationRunNotFoundError)
  .addError(ConsolidationRunCannotBeCancelledError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Cancel consolidation run",
    description: "Cancel an in-progress consolidation run. Completed runs cannot be cancelled."
  }))

/**
 * Delete a consolidation run
 */
const deleteConsolidationRun = HttpApiEndpoint.del("deleteConsolidationRun", "/runs/:id")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(HttpApiSchema.NoContent)
  .addError(ConsolidationRunNotFoundError)
  .addError(ConsolidationRunCannotBeDeletedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(AuditLogError)
  .addError(UserLookupError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete consolidation run",
    description: "Delete a consolidation run. Only pending or failed runs can be deleted."
  }))

/**
 * Get the consolidated trial balance from a completed run
 */
const getConsolidatedTrialBalance = HttpApiEndpoint.get("getConsolidatedTrialBalance", "/runs/:id/trial-balance")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidatedTrialBalance)
  .addError(ConsolidationRunNotFoundError)
  .addError(ConsolidationRunNotCompletedError)
  .addError(ConsolidatedTrialBalanceNotAvailableError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get consolidated trial balance",
    description: "Get the consolidated trial balance from a completed consolidation run."
  }))

/**
 * Get the latest completed run for a group
 */
const getLatestCompletedRun = HttpApiEndpoint.get("getLatestCompletedRun", "/groups/:groupId/latest-run")
  .setPath(Schema.Struct({ groupId: ConsolidationGroupId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(Schema.OptionFromNullOr(ConsolidationRun))
  .addError(ConsolidationGroupNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get latest completed run",
    description: "Get the most recently completed consolidation run for a group."
  }))

// =============================================================================
// Consolidated Report Types
// =============================================================================

/**
 * ConsolidatedReportLineItem - A line item in a consolidated financial report
 */
export class ConsolidatedReportLineItem extends Schema.Class<ConsolidatedReportLineItem>("ConsolidatedReportLineItem")({
  description: Schema.NonEmptyTrimmedString,
  amount: Schema.Number,
  style: Schema.Literal("Normal", "Subtotal", "Total", "Header"),
  indentLevel: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * ConsolidatedReportSection - A section of a consolidated financial report
 */
export class ConsolidatedReportSection extends Schema.Class<ConsolidatedReportSection>("ConsolidatedReportSection")({
  title: Schema.NonEmptyTrimmedString,
  lineItems: Schema.Array(ConsolidatedReportLineItem),
  subtotal: Schema.Number
}) {}

/**
 * ConsolidatedBalanceSheetReport - Consolidated balance sheet from a completed run
 */
export class ConsolidatedBalanceSheetReport extends Schema.Class<ConsolidatedBalanceSheetReport>("ConsolidatedBalanceSheetReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  currentAssets: ConsolidatedReportSection,
  nonCurrentAssets: ConsolidatedReportSection,
  totalAssets: Schema.Number,
  currentLiabilities: ConsolidatedReportSection,
  nonCurrentLiabilities: ConsolidatedReportSection,
  totalLiabilities: Schema.Number,
  equity: ConsolidatedReportSection,
  nonControllingInterest: Schema.Number,
  totalEquity: Schema.Number,
  totalLiabilitiesAndEquity: Schema.Number
}) {}

/**
 * ConsolidatedIncomeStatementReport - Consolidated income statement from a completed run
 */
export class ConsolidatedIncomeStatementReport extends Schema.Class<ConsolidatedIncomeStatementReport>("ConsolidatedIncomeStatementReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  revenue: ConsolidatedReportSection,
  costOfSales: ConsolidatedReportSection,
  grossProfit: Schema.Number,
  operatingExpenses: ConsolidatedReportSection,
  operatingIncome: Schema.Number,
  otherIncomeExpense: ConsolidatedReportSection,
  incomeBeforeTax: Schema.Number,
  taxExpense: Schema.Number,
  netIncome: Schema.Number,
  netIncomeAttributableToParent: Schema.Number,
  netIncomeAttributableToNCI: Schema.Number
}) {}

/**
 * ConsolidatedCashFlowReport - Consolidated cash flow statement from a completed run
 */
export class ConsolidatedCashFlowReport extends Schema.Class<ConsolidatedCashFlowReport>("ConsolidatedCashFlowReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  operatingActivities: ConsolidatedReportSection,
  investingActivities: ConsolidatedReportSection,
  financingActivities: ConsolidatedReportSection,
  netChangeInCash: Schema.Number,
  beginningCash: Schema.Number,
  endingCash: Schema.Number
}) {}

/**
 * EquityMovementRow - A row in the equity statement showing movements
 */
export class EquityMovementRow extends Schema.Class<EquityMovementRow>("EquityMovementRow")({
  description: Schema.NonEmptyTrimmedString,
  commonStock: Schema.Number,
  additionalPaidInCapital: Schema.Number,
  retainedEarnings: Schema.Number,
  accumulatedOCI: Schema.Number,
  nonControllingInterest: Schema.Number,
  total: Schema.Number
}) {}

/**
 * ConsolidatedEquityStatementReport - Consolidated statement of changes in equity
 */
export class ConsolidatedEquityStatementReport extends Schema.Class<ConsolidatedEquityStatementReport>("ConsolidatedEquityStatementReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  openingBalance: EquityMovementRow,
  movements: Schema.Array(EquityMovementRow),
  closingBalance: EquityMovementRow
}) {}

// =============================================================================
// Consolidated Report Endpoints
// =============================================================================

/**
 * Get consolidated balance sheet from a completed run
 */
const getConsolidatedBalanceSheet = HttpApiEndpoint.get("getConsolidatedBalanceSheet", "/runs/:id/reports/balance-sheet")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidatedBalanceSheetReport)
  .addError(ConsolidationRunNotFoundError)
  .addError(ConsolidationRunNotCompletedError)
  .addError(ConsolidatedTrialBalanceNotAvailableError)
  .addError(ConsolidatedBalanceSheetNotBalancedError)
  .addError(ConsolidationReportGenerationError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get consolidated balance sheet",
    description: "Generate a consolidated balance sheet from a completed consolidation run per ASC 210."
  }))

/**
 * Get consolidated income statement from a completed run
 */
const getConsolidatedIncomeStatement = HttpApiEndpoint.get("getConsolidatedIncomeStatement", "/runs/:id/reports/income-statement")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidatedIncomeStatementReport)
  .addError(ConsolidationRunNotFoundError)
  .addError(ConsolidationRunNotCompletedError)
  .addError(ConsolidatedTrialBalanceNotAvailableError)
  .addError(ConsolidationReportGenerationError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get consolidated income statement",
    description: "Generate a consolidated income statement from a completed consolidation run per ASC 220."
  }))

/**
 * Get consolidated cash flow statement from a completed run
 */
const getConsolidatedCashFlowStatement = HttpApiEndpoint.get("getConsolidatedCashFlowStatement", "/runs/:id/reports/cash-flow")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidatedCashFlowReport)
  .addError(ConsolidationRunNotFoundError)
  .addError(ConsolidationRunNotCompletedError)
  .addError(ConsolidatedTrialBalanceNotAvailableError)
  .addError(ConsolidationReportGenerationError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get consolidated cash flow statement",
    description: "Generate a consolidated cash flow statement from a completed consolidation run per ASC 230."
  }))

/**
 * Get consolidated statement of changes in equity from a completed run
 */
const getConsolidatedEquityStatement = HttpApiEndpoint.get("getConsolidatedEquityStatement", "/runs/:id/reports/equity-statement")
  .setPath(Schema.Struct({ id: ConsolidationRunId }))
  .setUrlParams(OrganizationIdUrlParam)
  .addSuccess(ConsolidatedEquityStatementReport)
  .addError(ConsolidationRunNotFoundError)
  .addError(ConsolidationRunNotCompletedError)
  .addError(ConsolidatedTrialBalanceNotAvailableError)
  .addError(ConsolidationReportGenerationError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get consolidated equity statement",
    description: "Generate a consolidated statement of changes in equity from a completed consolidation run."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * ConsolidationApi - API group for consolidation group and run management
 *
 * Base path: /api/v1/consolidation
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class ConsolidationApi extends HttpApiGroup.make("consolidation")
  .add(listConsolidationGroups)
  .add(getConsolidationGroup)
  .add(createConsolidationGroup)
  .add(updateConsolidationGroup)
  .add(deleteConsolidationGroup)
  .add(activateConsolidationGroup)
  .add(deactivateConsolidationGroup)
  .add(addGroupMember)
  .add(updateGroupMember)
  .add(removeGroupMember)
  .add(listConsolidationRuns)
  .add(getConsolidationRun)
  .add(initiateConsolidationRun)
  .add(cancelConsolidationRun)
  .add(deleteConsolidationRun)
  .add(getConsolidatedTrialBalance)
  .add(getConsolidatedBalanceSheet)
  .add(getConsolidatedIncomeStatement)
  .add(getConsolidatedCashFlowStatement)
  .add(getConsolidatedEquityStatement)
  .add(getLatestCompletedRun)
  .middleware(AuthMiddleware)
  .prefix("/v1/consolidation")
  .annotateContext(OpenApi.annotations({
    title: "Consolidation",
    description: "Manage consolidation groups and runs. Includes group member management, run initiation, and result retrieval per ASC 810."
  })) {}
