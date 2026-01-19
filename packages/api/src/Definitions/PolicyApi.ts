/**
 * PolicyApi - HTTP API group for organization policy management
 *
 * Provides endpoints for managing ABAC (Attribute-Based Access Control) policies:
 * - List policies
 * - Create custom policies
 * - Update policies
 * - Delete policies
 * - Test policies (evaluate hypothetical scenarios)
 *
 * System policies (created by the system on organization creation) cannot be
 * modified or deleted - they are read-only.
 *
 * @module PolicyApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { PolicyId } from "@accountability/core/authorization/PolicyId"
import { PolicyEffect } from "@accountability/core/authorization/PolicyEffect"
import {
  SubjectCondition,
  ResourceCondition,
  ActionCondition,
  EnvironmentCondition
} from "@accountability/core/authorization/PolicyConditions"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Action } from "@accountability/core/authorization/Action"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { ForbiddenError } from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError, UserNotMemberOfOrganizationError } from "@accountability/core/organization/OrganizationErrors"
import {
  PolicyNotFoundError,
  InvalidPolicyIdError,
  PolicyPriorityValidationError,
  InvalidResourceTypeError,
  SystemPolicyCannotBeModifiedError
} from "@accountability/core/authorization/AuthorizationErrors"

// =============================================================================
// Policy Request/Response Schemas
// =============================================================================

/**
 * PolicyInfo - Information about a policy (for list responses)
 */
export class PolicyInfo extends Schema.Class<PolicyInfo>("PolicyInfo")({
  id: PolicyId,
  name: Schema.NonEmptyTrimmedString,
  description: Schema.OptionFromNullOr(Schema.String),
  subject: SubjectCondition,
  resource: ResourceCondition,
  action: ActionCondition,
  environment: Schema.OptionFromNullOr(EnvironmentCondition),
  effect: PolicyEffect,
  priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 1000)),
  isSystemPolicy: Schema.Boolean,
  isActive: Schema.Boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: Schema.OptionFromNullOr(AuthUserId)
}) {}

/**
 * PolicyListResponse - Response containing list of organization policies
 */
export class PolicyListResponse extends Schema.Class<PolicyListResponse>("PolicyListResponse")({
  policies: Schema.Array(PolicyInfo)
}) {}

/**
 * CreatePolicyRequest - Request to create a new custom policy
 */
export class CreatePolicyRequest extends Schema.Class<CreatePolicyRequest>("CreatePolicyRequest")({
  name: Schema.NonEmptyTrimmedString.annotations({
    description: "Human-readable name for the policy"
  }),
  description: Schema.OptionFromNullOr(Schema.String).annotations({
    description: "Optional description of what this policy does"
  }),
  subject: SubjectCondition.annotations({
    description: "Conditions that define who this policy applies to"
  }),
  resource: ResourceCondition.annotations({
    description: "Conditions that define what resources this policy applies to"
  }),
  action: ActionCondition.annotations({
    description: "Conditions that define what actions this policy applies to"
  }),
  environment: Schema.OptionFromNullOr(EnvironmentCondition).annotations({
    description: "Optional contextual conditions (time, IP, etc.)"
  }),
  effect: PolicyEffect.annotations({
    description: "Whether to allow or deny when this policy matches"
  }),
  priority: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.between(0, 899)),
    { default: () => 500 }
  ).annotations({
    description: "Priority for conflict resolution (0-899 for custom policies, higher = evaluated first)"
  }),
  isActive: Schema.optionalWith(Schema.Boolean, { default: () => true }).annotations({
    description: "Whether this policy should be active immediately"
  })
}) {}

/**
 * UpdatePolicyRequest - Request to update an existing policy
 */
export class UpdatePolicyRequest extends Schema.Class<UpdatePolicyRequest>("UpdatePolicyRequest")({
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  description: Schema.OptionFromNullOr(Schema.String),
  subject: Schema.OptionFromNullOr(SubjectCondition),
  resource: Schema.OptionFromNullOr(ResourceCondition),
  action: Schema.OptionFromNullOr(ActionCondition),
  environment: Schema.OptionFromNullOr(EnvironmentCondition),
  effect: Schema.OptionFromNullOr(PolicyEffect),
  priority: Schema.OptionFromNullOr(Schema.Number.pipe(Schema.int(), Schema.between(0, 899))),
  isActive: Schema.OptionFromNullOr(Schema.Boolean)
}) {}

/**
 * TestPolicyRequest - Request to test policy evaluation (simulate authorization)
 */
export class TestPolicyRequest extends Schema.Class<TestPolicyRequest>("TestPolicyRequest")({
  userId: AuthUserId.annotations({
    description: "The user to test authorization for"
  }),
  action: Action.annotations({
    description: "The action to test"
  }),
  resourceType: Schema.String.annotations({
    description: "The type of resource being accessed"
  }),
  resourceId: Schema.OptionFromNullOr(Schema.String).annotations({
    description: "Optional specific resource ID"
  }),
  resourceAttributes: Schema.OptionFromNullOr(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  })).annotations({
    description: "Optional resource attributes for attribute-based matching"
  })
}) {}

/**
 * TestPolicyResponse - Response from policy evaluation test
 */
export class TestPolicyResponse extends Schema.Class<TestPolicyResponse>("TestPolicyResponse")({
  decision: Schema.Literal("allow", "deny").annotations({
    description: "The final authorization decision"
  }),
  matchedPolicies: Schema.Array(PolicyInfo).annotations({
    description: "Policies that matched and influenced the decision"
  }),
  reason: Schema.String.annotations({
    description: "Human-readable explanation for the decision"
  })
}) {}

// =============================================================================
// Policy API Endpoints
// =============================================================================

/**
 * List all policies for an organization
 */
const listPolicies = HttpApiEndpoint.get("listPolicies", "/organizations/:orgId/policies")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .addSuccess(PolicyListResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List organization policies",
    description: "Retrieve all policies for an organization, including system policies."
  }))

/**
 * Get a specific policy
 */
const getPolicy = HttpApiEndpoint.get("getPolicy", "/organizations/:orgId/policies/:policyId")
  .setPath(Schema.Struct({ orgId: Schema.String, policyId: Schema.String }))
  .addSuccess(PolicyInfo)
  .addError(InvalidPolicyIdError)
  .addError(PolicyNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get policy details",
    description: "Retrieve details of a specific policy."
  }))

/**
 * Create a new custom policy
 */
const createPolicy = HttpApiEndpoint.post("createPolicy", "/organizations/:orgId/policies")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .setPayload(CreatePolicyRequest)
  .addSuccess(PolicyInfo, { status: 201 })
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(PolicyPriorityValidationError)
  .annotateContext(OpenApi.annotations({
    summary: "Create custom policy",
    description: "Create a new custom authorization policy for the organization."
  }))

/**
 * Update an existing policy
 */
const updatePolicy = HttpApiEndpoint.patch("updatePolicy", "/organizations/:orgId/policies/:policyId")
  .setPath(Schema.Struct({ orgId: Schema.String, policyId: Schema.String }))
  .setPayload(UpdatePolicyRequest)
  .addSuccess(PolicyInfo)
  .addError(InvalidPolicyIdError)
  .addError(PolicyNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(PolicyPriorityValidationError)
  .addError(SystemPolicyCannotBeModifiedError)
  .annotateContext(OpenApi.annotations({
    summary: "Update policy",
    description: "Update an existing custom policy. System policies cannot be modified."
  }))

/**
 * Delete a policy
 */
const deletePolicy = HttpApiEndpoint.del("deletePolicy", "/organizations/:orgId/policies/:policyId")
  .setPath(Schema.Struct({ orgId: Schema.String, policyId: Schema.String }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(InvalidPolicyIdError)
  .addError(PolicyNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(SystemPolicyCannotBeModifiedError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete policy",
    description: "Delete a custom policy. System policies cannot be deleted."
  }))

/**
 * Test policy evaluation (simulate authorization)
 */
const testPolicy = HttpApiEndpoint.post("testPolicy", "/organizations/:orgId/policies/test")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .setPayload(TestPolicyRequest)
  .addSuccess(TestPolicyResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(InvalidResourceTypeError)
  .addError(UserNotMemberOfOrganizationError)
  .annotateContext(OpenApi.annotations({
    summary: "Test policy evaluation",
    description: "Simulate an authorization request to see which policies would match and what decision would be made."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * PolicyApi - API group for organization policy management
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class PolicyApi extends HttpApiGroup.make("policy")
  .add(listPolicies)
  .add(getPolicy)
  .add(createPolicy)
  .add(updatePolicy)
  .add(deletePolicy)
  .add(testPolicy)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Policy",
    description: "Manage ABAC authorization policies for fine-grained access control."
  })) {}
