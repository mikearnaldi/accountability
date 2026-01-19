/**
 * EliminationRulesApi - HTTP API group for consolidation elimination rule management
 *
 * Provides endpoints for CRUD operations on elimination rules,
 * including activation, deactivation, and priority management.
 *
 * @module EliminationRulesApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  EliminationRule,
  EliminationType,
  AccountSelector
} from "@accountability/core/consolidation/EliminationRule"
import { ConsolidationGroupId, EliminationRuleId } from "@accountability/core/consolidation/ConsolidationGroup"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { AccountId } from "@accountability/core/accounting/Account"
import {
  EliminationRuleNotFoundError,
  EliminationRuleOperationFailedError,
  ConsolidationGroupNotFoundError
} from "@accountability/core/consolidation/ConsolidationErrors"
import { AuthMiddleware } from "./AuthMiddleware.ts"

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * TriggerConditionInput - Input for creating a trigger condition
 */
export class TriggerConditionInput extends Schema.Class<TriggerConditionInput>("TriggerConditionInput")({
  description: Schema.NonEmptyTrimmedString,
  sourceAccounts: Schema.Array(AccountSelector),
  minimumAmount: Schema.OptionFromNullOr(Schema.BigDecimal)
}) {}

/**
 * CreateEliminationRuleRequest - Request body for creating a new elimination rule
 */
export class CreateEliminationRuleRequest extends Schema.Class<CreateEliminationRuleRequest>("CreateEliminationRuleRequest")({
  organizationId: OrganizationId,
  consolidationGroupId: ConsolidationGroupId,
  name: Schema.NonEmptyTrimmedString,
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  eliminationType: EliminationType,
  triggerConditions: Schema.Array(TriggerConditionInput),
  sourceAccounts: Schema.Array(AccountSelector),
  targetAccounts: Schema.Array(AccountSelector),
  debitAccountId: AccountId,
  creditAccountId: AccountId,
  isAutomatic: Schema.Boolean,
  priority: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  isActive: Schema.optionalWith(Schema.Boolean, { default: () => true })
}) {}

/**
 * UpdateEliminationRuleRequest - Request body for updating an elimination rule
 */
export class UpdateEliminationRuleRequest extends Schema.Class<UpdateEliminationRuleRequest>("UpdateEliminationRuleRequest")({
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  triggerConditions: Schema.OptionFromNullOr(Schema.Array(TriggerConditionInput)),
  sourceAccounts: Schema.OptionFromNullOr(Schema.Array(AccountSelector)),
  targetAccounts: Schema.OptionFromNullOr(Schema.Array(AccountSelector)),
  debitAccountId: Schema.OptionFromNullOr(AccountId),
  creditAccountId: Schema.OptionFromNullOr(AccountId),
  isAutomatic: Schema.OptionFromNullOr(Schema.Boolean)
}) {}

/**
 * UpdatePriorityRequest - Request body for updating the priority of an elimination rule
 */
export class UpdatePriorityRequest extends Schema.Class<UpdatePriorityRequest>("UpdatePriorityRequest")({
  priority: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * BulkCreateEliminationRulesRequest - Request body for creating multiple elimination rules
 */
export class BulkCreateEliminationRulesRequest extends Schema.Class<BulkCreateEliminationRulesRequest>("BulkCreateEliminationRulesRequest")({
  rules: Schema.Array(CreateEliminationRuleRequest)
}) {}

/**
 * BulkCreateEliminationRulesResponse - Response after creating multiple elimination rules
 */
export class BulkCreateEliminationRulesResponse extends Schema.Class<BulkCreateEliminationRulesResponse>("BulkCreateEliminationRulesResponse")({
  created: Schema.Array(EliminationRule),
  count: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * EliminationRuleListResponse - Response containing a list of elimination rules
 */
export class EliminationRuleListResponse extends Schema.Class<EliminationRuleListResponse>("EliminationRuleListResponse")({
  rules: Schema.Array(EliminationRule),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Query parameters for listing elimination rules
 */
export const EliminationRuleListParams = Schema.Struct({
  consolidationGroupId: Schema.optional(ConsolidationGroupId),
  eliminationType: Schema.optional(EliminationType),
  isActive: Schema.optional(Schema.BooleanFromString),
  isAutomatic: Schema.optional(Schema.BooleanFromString),
  highPriorityOnly: Schema.optional(Schema.BooleanFromString),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

export type EliminationRuleListParams = typeof EliminationRuleListParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List all elimination rules with filtering
 */
const listEliminationRules = HttpApiEndpoint.get("listEliminationRules", "/")
  .setUrlParams(EliminationRuleListParams)
  .addSuccess(EliminationRuleListResponse)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "List elimination rules",
    description: "Retrieve a paginated list of elimination rules. Supports filtering by consolidation group, type, and status."
  }))

/**
 * Get a single elimination rule by ID
 */
const getEliminationRule = HttpApiEndpoint.get("getEliminationRule", "/:id")
  .setPath(Schema.Struct({ id: EliminationRuleId }))
  .addSuccess(EliminationRule)
  .addError(EliminationRuleNotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get elimination rule",
    description: "Retrieve a single elimination rule by its unique identifier."
  }))

/**
 * Create a new elimination rule
 */
const createEliminationRule = HttpApiEndpoint.post("createEliminationRule", "/")
  .setPayload(CreateEliminationRuleRequest)
  .addSuccess(EliminationRule, { status: 201 })
  .addError(ConsolidationGroupNotFoundError)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Create elimination rule",
    description: "Create a new elimination rule for a consolidation group."
  }))

/**
 * Bulk create elimination rules
 */
const bulkCreateEliminationRules = HttpApiEndpoint.post("bulkCreateEliminationRules", "/bulk")
  .setPayload(BulkCreateEliminationRulesRequest)
  .addSuccess(BulkCreateEliminationRulesResponse, { status: 201 })
  .addError(ConsolidationGroupNotFoundError)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Bulk create elimination rules",
    description: "Create multiple elimination rules in a single request. Useful for setting up standard elimination rule sets."
  }))

/**
 * Update an elimination rule
 */
const updateEliminationRule = HttpApiEndpoint.put("updateEliminationRule", "/:id")
  .setPath(Schema.Struct({ id: EliminationRuleId }))
  .setPayload(UpdateEliminationRuleRequest)
  .addSuccess(EliminationRule)
  .addError(EliminationRuleNotFoundError)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Update elimination rule",
    description: "Update an existing elimination rule's details."
  }))

/**
 * Delete an elimination rule
 */
const deleteEliminationRule = HttpApiEndpoint.del("deleteEliminationRule", "/:id")
  .setPath(Schema.Struct({ id: EliminationRuleId }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(EliminationRuleNotFoundError)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete elimination rule",
    description: "Delete an elimination rule. Rules that have been used in completed consolidation runs may not be deleted."
  }))

/**
 * Activate an elimination rule
 */
const activateEliminationRule = HttpApiEndpoint.post("activateEliminationRule", "/:id/activate")
  .setPath(Schema.Struct({ id: EliminationRuleId }))
  .addSuccess(EliminationRule)
  .addError(EliminationRuleNotFoundError)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Activate elimination rule",
    description: "Activate an elimination rule for use in consolidation runs."
  }))

/**
 * Deactivate an elimination rule
 */
const deactivateEliminationRule = HttpApiEndpoint.post("deactivateEliminationRule", "/:id/deactivate")
  .setPath(Schema.Struct({ id: EliminationRuleId }))
  .addSuccess(EliminationRule)
  .addError(EliminationRuleNotFoundError)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Deactivate elimination rule",
    description: "Deactivate an elimination rule. Deactivated rules are skipped during consolidation."
  }))

/**
 * Update the priority of an elimination rule
 */
const updateEliminationRulePriority = HttpApiEndpoint.post("updateEliminationRulePriority", "/:id/priority")
  .setPath(Schema.Struct({ id: EliminationRuleId }))
  .setPayload(UpdatePriorityRequest)
  .addSuccess(EliminationRule)
  .addError(EliminationRuleNotFoundError)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Update rule priority",
    description: "Update the execution priority of an elimination rule. Lower numbers execute first."
  }))

/**
 * Get elimination rules by type for a consolidation group
 */
const getEliminationRulesByType = HttpApiEndpoint.get("getEliminationRulesByType", "/by-type")
  .setUrlParams(Schema.Struct({
    consolidationGroupId: ConsolidationGroupId,
    eliminationType: EliminationType
  }))
  .addSuccess(EliminationRuleListResponse)
  .addError(EliminationRuleOperationFailedError)
  .annotateContext(OpenApi.annotations({
    summary: "Get rules by type",
    description: "Get all elimination rules of a specific type for a consolidation group."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * EliminationRulesApi - API group for elimination rule management
 *
 * Base path: /api/v1/elimination-rules
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class EliminationRulesApi extends HttpApiGroup.make("eliminationRules")
  .add(listEliminationRules)
  .add(getEliminationRule)
  .add(createEliminationRule)
  .add(bulkCreateEliminationRules)
  .add(updateEliminationRule)
  .add(deleteEliminationRule)
  .add(activateEliminationRule)
  .add(deactivateEliminationRule)
  .add(updateEliminationRulePriority)
  .add(getEliminationRulesByType)
  .middleware(AuthMiddleware)
  .prefix("/v1/elimination-rules")
  .annotateContext(OpenApi.annotations({
    title: "Elimination Rules",
    description: "Manage consolidation elimination rules. Includes rule creation, activation/deactivation, and priority management per ASC 810."
  })) {}
