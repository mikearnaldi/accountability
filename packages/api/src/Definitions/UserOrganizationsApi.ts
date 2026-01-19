/**
 * UserOrganizationsApi - HTTP API group for user's organizations
 *
 * Provides the endpoint for listing organizations a user is a member of,
 * along with their roles and effective permissions.
 *
 * @module UserOrganizationsApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { BaseRole } from "@accountability/core/authorization/BaseRole"
import { FunctionalRoles } from "@accountability/core/authorization/FunctionalRole"
import { Action } from "@accountability/core/authorization/Action"
import { ForbiddenError } from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * UserOrganizationInfo - Information about an organization the user is a member of
 */
export class UserOrganizationInfo extends Schema.Class<UserOrganizationInfo>("UserOrganizationInfo")({
  /** Organization ID */
  id: OrganizationId,

  /** Organization name */
  name: Schema.NonEmptyTrimmedString,

  /** User's base role in the organization */
  role: BaseRole,

  /** User's functional roles in the organization */
  functionalRoles: FunctionalRoles,

  /** Computed list of all actions the user can perform */
  effectivePermissions: Schema.Array(Action)
}) {}

/**
 * UserOrganizationsResponse - Response containing list of user's organizations
 */
export class UserOrganizationsResponse extends Schema.Class<UserOrganizationsResponse>("UserOrganizationsResponse")({
  organizations: Schema.Array(UserOrganizationInfo)
}) {}

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List user's organizations with effective permissions
 */
const listUserOrganizations = HttpApiEndpoint.get("listUserOrganizations", "/users/me/organizations")
  .addSuccess(UserOrganizationsResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List user's organizations",
    description: "Retrieve all organizations the current user is a member of, including their roles and effective permissions."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * UserOrganizationsApi - API group for user's organization memberships
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class UserOrganizationsApi extends HttpApiGroup.make("userOrganizations")
  .add(listUserOrganizations)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "User Organizations",
    description: "Retrieve organizations the current user belongs to with their roles and permissions."
  })) {}
