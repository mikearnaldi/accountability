/**
 * PlatformAdminApi - HTTP API group for platform administrator management
 *
 * Provides read-only endpoint for listing platform administrators.
 * Platform admin status can only be set via database migration by design.
 *
 * @module PlatformAdminApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Email } from "@accountability/core/authentication/Email"
import { ForbiddenError } from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * PlatformAdminInfo - Information about a platform administrator
 */
export class PlatformAdminInfo extends Schema.Class<PlatformAdminInfo>("PlatformAdminInfo")({
  /** User ID */
  id: AuthUserId,

  /** User email */
  email: Email,

  /** User display name */
  displayName: Schema.NonEmptyTrimmedString,

  /** When the user was created */
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * PlatformAdminsResponse - Response containing list of platform administrators
 */
export class PlatformAdminsResponse extends Schema.Class<PlatformAdminsResponse>("PlatformAdminsResponse")({
  admins: Schema.Array(PlatformAdminInfo),
  /** Total count of platform administrators */
  count: Schema.Int
}) {}

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List platform administrators
 * Only platform admins can see this list
 */
const listPlatformAdmins = HttpApiEndpoint.get("listPlatformAdmins", "/platform-admins")
  .addSuccess(PlatformAdminsResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List platform administrators",
    description: "Retrieve all platform administrators. Only accessible by platform administrators."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * PlatformAdminApi - API group for platform administrator management
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 *
 * Note: This API only provides read access. Platform admin status can only
 * be set via database migration for security reasons.
 */
export class PlatformAdminApi extends HttpApiGroup.make("platformAdmins")
  .add(listPlatformAdmins)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Platform Administrators",
    description: "View platform administrator list. Platform admin status is managed via database migrations only."
  })) {}
