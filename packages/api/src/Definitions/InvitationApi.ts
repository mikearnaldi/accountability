/**
 * InvitationApi - HTTP API group for organization invitation management
 *
 * Provides endpoints for managing organization invitations:
 * - List user's pending invitations
 * - Accept an invitation
 * - Decline an invitation
 * - Revoke an invitation (admin action)
 *
 * @module InvitationApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { Email } from "@accountability/core/authentication/Email"
import { InvitationId } from "@accountability/core/membership/InvitationId"
import { InvitationStatus } from "@accountability/core/membership/InvitationStatus"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { BaseRole } from "@accountability/core/authorization/BaseRole"
import { FunctionalRoles } from "@accountability/core/authorization/FunctionalRole"
import { ForbiddenError } from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import {
  InvitationNotFoundError,
  InvalidInvitationIdError
} from "@accountability/core/membership/MembershipErrors"
import { InvalidOrganizationIdError } from "@accountability/core/organization/OrganizationErrors"
import {
  InvalidInvitationError,
  InvitationExpiredError,
  UserAlreadyMemberError
} from "@accountability/core/authorization/AuthorizationErrors"

// =============================================================================
// Invitation Request/Response Schemas
// =============================================================================

/**
 * InviterInfo - Information about who sent the invitation
 */
export class InviterInfo extends Schema.Class<InviterInfo>("InviterInfo")({
  email: Email,
  displayName: Schema.NonEmptyTrimmedString
}) {}

/**
 * PendingInvitationInfo - Information about a pending invitation (for user's list)
 */
export class PendingInvitationInfo extends Schema.Class<PendingInvitationInfo>("PendingInvitationInfo")({
  id: InvitationId,
  organizationId: OrganizationId,
  organizationName: Schema.NonEmptyTrimmedString,
  role: Schema.Literal("admin", "member", "viewer"),
  functionalRoles: FunctionalRoles,
  invitedBy: InviterInfo,
  createdAt: Timestamp
}) {}

/**
 * UserInvitationsResponse - Response containing list of user's pending invitations
 */
export class UserInvitationsResponse extends Schema.Class<UserInvitationsResponse>("UserInvitationsResponse")({
  invitations: Schema.Array(PendingInvitationInfo)
}) {}

/**
 * OrgInvitationInfo - Information about a pending invitation (for org admin's list)
 */
export class OrgInvitationInfo extends Schema.Class<OrgInvitationInfo>("OrgInvitationInfo")({
  id: InvitationId,
  email: Email,
  role: Schema.Literal("admin", "member", "viewer"),
  functionalRoles: FunctionalRoles,
  status: InvitationStatus,
  invitedBy: InviterInfo,
  createdAt: Timestamp
}) {}

/**
 * OrgInvitationsResponse - Response containing list of organization's invitations
 */
export class OrgInvitationsResponse extends Schema.Class<OrgInvitationsResponse>("OrgInvitationsResponse")({
  invitations: Schema.Array(OrgInvitationInfo)
}) {}

/**
 * AcceptInvitationResponse - Response after accepting an invitation
 */
export class AcceptInvitationResponse extends Schema.Class<AcceptInvitationResponse>("AcceptInvitationResponse")({
  organizationId: OrganizationId,
  organizationName: Schema.NonEmptyTrimmedString,
  role: BaseRole
}) {}

// =============================================================================
// Invitation API Endpoints
// =============================================================================

/**
 * List user's pending invitations
 */
const listUserInvitations = HttpApiEndpoint.get("listUserInvitations", "/users/me/invitations")
  .addSuccess(UserInvitationsResponse)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List user's pending invitations",
    description: "Retrieve all pending invitations for the current user."
  }))

/**
 * Accept an invitation
 */
const acceptInvitation = HttpApiEndpoint.post("acceptInvitation", "/invitations/:token/accept")
  .setPath(Schema.Struct({ token: Schema.String }))
  .addSuccess(AcceptInvitationResponse)
  .addError(InvalidInvitationError)
  .addError(InvitationExpiredError)
  .addError(UserAlreadyMemberError)
  .annotateContext(OpenApi.annotations({
    summary: "Accept invitation",
    description: "Accept an invitation to join an organization. The user will become a member with the role specified in the invitation."
  }))

/**
 * Decline an invitation
 */
const declineInvitation = HttpApiEndpoint.post("declineInvitation", "/invitations/:token/decline")
  .setPath(Schema.Struct({ token: Schema.String }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(InvalidInvitationError)
  .addError(InvitationExpiredError)
  .annotateContext(OpenApi.annotations({
    summary: "Decline invitation",
    description: "Decline an invitation to join an organization."
  }))

/**
 * Revoke an invitation (admin action)
 */
const revokeInvitation = HttpApiEndpoint.del("revokeInvitation", "/organizations/:orgId/invitations/:invitationId")
  .setPath(Schema.Struct({ orgId: Schema.String, invitationId: Schema.String }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(InvalidOrganizationIdError)
  .addError(InvalidInvitationIdError)
  .addError(InvitationNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Revoke invitation",
    description: "Revoke a pending invitation. Only organization admins can perform this action."
  }))

/**
 * List organization's pending invitations (admin action)
 */
const listOrgInvitations = HttpApiEndpoint.get("listOrgInvitations", "/organizations/:orgId/invitations")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .addSuccess(OrgInvitationsResponse)
  .addError(InvalidOrganizationIdError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List organization invitations",
    description: "List all pending invitations for an organization. Only organization admins can view this."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * InvitationApi - API group for invitation management
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class InvitationApi extends HttpApiGroup.make("invitation")
  .add(listUserInvitations)
  .add(acceptInvitation)
  .add(declineInvitation)
  .add(revokeInvitation)
  .add(listOrgInvitations)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Invitations",
    description: "Manage organization invitations for joining organizations."
  })) {}
