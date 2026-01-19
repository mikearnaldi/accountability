/**
 * AuthorizationAuditApi - HTTP API group for authorization denial audit log queries
 *
 * Provides endpoint to query authorization denial entries for security audit and compliance.
 * Tracks denied access attempts with user, action, resource, denial reason, and context.
 *
 * Read-only endpoint - denial entries are system-generated when permission checks fail.
 *
 * @module AuthorizationAuditApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { ForbiddenError } from "./ApiErrors.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * AuthorizationDenialEntry - Single authorization denial entry in the response
 */
export class AuthorizationDenialEntryResponse extends Schema.Class<AuthorizationDenialEntryResponse>(
  "AuthorizationDenialEntryResponse"
)({
  id: Schema.UUID,
  userId: Schema.UUID,
  userEmail: Schema.OptionFromNullOr(Schema.String),
  userDisplayName: Schema.OptionFromNullOr(Schema.String),
  action: Schema.String,
  resourceType: Schema.String,
  resourceId: Schema.OptionFromNullOr(Schema.UUID),
  denialReason: Schema.String,
  matchedPolicyIds: Schema.Array(Schema.UUID),
  ipAddress: Schema.OptionFromNullOr(Schema.String),
  userAgent: Schema.OptionFromNullOr(Schema.String),
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * AuthorizationDenialListResponse - Response containing paginated denial entries
 */
export class AuthorizationDenialListResponse extends Schema.Class<AuthorizationDenialListResponse>(
  "AuthorizationDenialListResponse"
)({
  entries: Schema.Array(AuthorizationDenialEntryResponse),
  total: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
}) {}

// =============================================================================
// Query Parameters
// =============================================================================

/**
 * Query parameters for listing authorization denial entries
 */
export const AuthorizationDenialListParams = Schema.Struct({
  userId: Schema.optional(Schema.UUID),
  action: Schema.optional(Schema.String),
  resourceType: Schema.optional(Schema.String),
  fromDate: Schema.optional(Schema.DateTimeUtc),
  toDate: Schema.optional(Schema.DateTimeUtc),
  limit: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.lessThanOrEqualTo(1000)
    )
  ),
  offset: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.nonNegative()
    )
  )
})

export type AuthorizationDenialListParams = typeof AuthorizationDenialListParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List authorization denial entries for an organization with filtering and pagination
 *
 * Returns paginated denial entries for security audit and compliance.
 * Supports filtering by user, action, resource type, and date range.
 */
const listDenials = HttpApiEndpoint.get("listAuthorizationDenials", "/organizations/:orgId/authorization-audit")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .setUrlParams(AuthorizationDenialListParams)
  .addSuccess(AuthorizationDenialListResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List authorization denial audit entries",
    description: "Retrieve paginated authorization denial entries for security audit and compliance. Supports filtering by user, action, resource type, and date range. Only admins and owners can view denial logs."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * AuthorizationAuditApi - API group for authorization denial audit log queries
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 *
 * This is a read-only endpoint - denial entries are system-generated when
 * permission checks fail.
 */
export class AuthorizationAuditApi extends HttpApiGroup.make("authorizationAudit")
  .add(listDenials)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Authorization Audit",
    description: "Authorization denial audit log for security and compliance. Tracks denied access attempts with user, action, resource, denial reason, and context. Read-only endpoint."
  })) {}
