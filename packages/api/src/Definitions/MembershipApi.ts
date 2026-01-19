/**
 * MembershipApi - HTTP API group for organization member management
 *
 * Provides endpoints for managing organization memberships:
 * - List members
 * - Invite new members
 * - Update member roles
 * - Remove members
 * - Reinstate removed members
 * - Transfer ownership
 *
 * @module MembershipApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Email } from "@accountability/core/authentication/Email"
import { BaseRole } from "@accountability/core/authorization/BaseRole"
import { FunctionalRoles } from "@accountability/core/authorization/FunctionalRole"
import { MembershipStatus } from "@accountability/core/membership/MembershipStatus"
import { InvitationId } from "@accountability/core/membership/InvitationId"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { ForbiddenError } from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import { MemberNotFoundError } from "@accountability/core/membership/MembershipErrors"
import { InvalidOrganizationIdError } from "@accountability/core/organization/OrganizationErrors"
import {
  MembershipNotFoundError,
  OwnerCannotBeRemovedError,
  OwnerCannotBeSuspendedError,
  MemberNotSuspendedError,
  CannotTransferToNonAdminError,
  InvitationAlreadyExistsError
} from "@accountability/core/authorization/AuthorizationErrors"

// =============================================================================
// Member Request/Response Schemas
// =============================================================================

/**
 * MemberInfo - Information about an organization member (for list responses)
 */
export class MemberInfo extends Schema.Class<MemberInfo>("MemberInfo")({
  userId: AuthUserId,
  email: Email,
  displayName: Schema.NonEmptyTrimmedString,
  role: BaseRole,
  functionalRoles: FunctionalRoles,
  status: MembershipStatus,
  joinedAt: Timestamp
}) {}

/**
 * MemberListResponse - Response containing list of organization members
 */
export class MemberListResponse extends Schema.Class<MemberListResponse>("MemberListResponse")({
  members: Schema.Array(MemberInfo)
}) {}

/**
 * InviteMemberRequest - Request to invite a new member
 */
export class InviteMemberRequest extends Schema.Class<InviteMemberRequest>("InviteMemberRequest")({
  email: Email,
  role: Schema.Literal("admin", "member", "viewer").annotations({
    description: "The role to assign. Owner cannot be assigned via invitation."
  }),
  functionalRoles: Schema.optionalWith(FunctionalRoles, { default: () => [] })
}) {}

/**
 * InviteMemberResponse - Response after creating an invitation
 *
 * Includes the raw invitation token which should be shared with the invitee.
 * The token is only returned once at creation time - it cannot be retrieved later.
 */
export class InviteMemberResponse extends Schema.Class<InviteMemberResponse>("InviteMemberResponse")({
  invitationId: InvitationId,
  /** The invitation token to share with the invitee (base64url encoded) */
  invitationToken: Schema.NonEmptyTrimmedString
}) {}

/**
 * UpdateMemberRequest - Request to update a member's role
 */
export class UpdateMemberRequest extends Schema.Class<UpdateMemberRequest>("UpdateMemberRequest")({
  role: Schema.OptionFromNullOr(BaseRole),
  functionalRoles: Schema.OptionFromNullOr(FunctionalRoles)
}) {}

/**
 * RemoveMemberRequest - Request to remove a member
 */
export class RemoveMemberRequest extends Schema.Class<RemoveMemberRequest>("RemoveMemberRequest")({
  reason: Schema.OptionFromNullOr(Schema.String)
}) {}

/**
 * SuspendMemberRequest - Request to suspend a member
 */
export class SuspendMemberRequest extends Schema.Class<SuspendMemberRequest>("SuspendMemberRequest")({
  reason: Schema.OptionFromNullOr(Schema.String)
}) {}

/**
 * TransferOwnershipRequest - Request to transfer organization ownership
 */
export class TransferOwnershipRequest extends Schema.Class<TransferOwnershipRequest>("TransferOwnershipRequest")({
  toUserId: AuthUserId,
  myNewRole: Schema.Literal("admin", "member", "viewer").annotations({
    description: "The role the current owner will have after transfer"
  })
}) {}

// =============================================================================
// Membership API Endpoints
// =============================================================================

/**
 * List all members of an organization
 */
const listMembers = HttpApiEndpoint.get("listMembers", "/organizations/:orgId/members")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .addSuccess(MemberListResponse)
  .addError(InvalidOrganizationIdError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List organization members",
    description: "Retrieve all members of an organization, including their roles and status."
  }))

/**
 * Invite a new member to the organization
 */
const inviteMember = HttpApiEndpoint.post("inviteMember", "/organizations/:orgId/members/invite")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .setPayload(InviteMemberRequest)
  .addSuccess(InviteMemberResponse, { status: 201 })
  .addError(InvalidOrganizationIdError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .addError(InvitationAlreadyExistsError)
  .annotateContext(OpenApi.annotations({
    summary: "Invite new member",
    description: "Send an invitation to join the organization. An email will be sent with an invitation link."
  }))

/**
 * Update a member's role
 */
const updateMember = HttpApiEndpoint.patch("updateMember", "/organizations/:orgId/members/:userId")
  .setPath(Schema.Struct({ orgId: Schema.String, userId: Schema.String }))
  .setPayload(UpdateMemberRequest)
  .addSuccess(MemberInfo)
  .addError(InvalidOrganizationIdError)
  .addError(MemberNotFoundError)
  .addError(MembershipNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Update member role",
    description: "Update a member's base role and/or functional roles."
  }))

/**
 * Remove a member from the organization
 */
const removeMember = HttpApiEndpoint.del("removeMember", "/organizations/:orgId/members/:userId")
  .setPath(Schema.Struct({ orgId: Schema.String, userId: Schema.String }))
  .setPayload(RemoveMemberRequest)
  .addSuccess(HttpApiSchema.NoContent)
  .addError(InvalidOrganizationIdError)
  .addError(MemberNotFoundError)
  .addError(MembershipNotFoundError)
  .addError(OwnerCannotBeRemovedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Remove member",
    description: "Remove a member from the organization (soft delete). The owner cannot be removed."
  }))

/**
 * Reinstate a removed member
 */
const reinstateMember = HttpApiEndpoint.post("reinstateMember", "/organizations/:orgId/members/:userId/reinstate")
  .setPath(Schema.Struct({ orgId: Schema.String, userId: Schema.String }))
  .addSuccess(MemberInfo)
  .addError(InvalidOrganizationIdError)
  .addError(MemberNotFoundError)
  .addError(MembershipNotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Reinstate member",
    description: "Reinstate a previously removed member, restoring their previous role and access."
  }))

/**
 * Suspend a member (temporarily deny access)
 */
const suspendMember = HttpApiEndpoint.post("suspendMember", "/organizations/:orgId/members/:userId/suspend")
  .setPath(Schema.Struct({ orgId: Schema.String, userId: Schema.String }))
  .setPayload(SuspendMemberRequest)
  .addSuccess(MemberInfo)
  .addError(InvalidOrganizationIdError)
  .addError(MemberNotFoundError)
  .addError(MembershipNotFoundError)
  .addError(OwnerCannotBeSuspendedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Suspend member",
    description: "Temporarily suspend a member's access to the organization. The owner cannot be suspended."
  }))

/**
 * Unsuspend a suspended member (restore access)
 */
const unsuspendMember = HttpApiEndpoint.post("unsuspendMember", "/organizations/:orgId/members/:userId/unsuspend")
  .setPath(Schema.Struct({ orgId: Schema.String, userId: Schema.String }))
  .addSuccess(MemberInfo)
  .addError(InvalidOrganizationIdError)
  .addError(MemberNotFoundError)
  .addError(MembershipNotFoundError)
  .addError(MemberNotSuspendedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Unsuspend member",
    description: "Restore access for a previously suspended member."
  }))

/**
 * Transfer organization ownership
 */
const transferOwnership = HttpApiEndpoint.post("transferOwnership", "/organizations/:orgId/transfer-ownership")
  .setPath(Schema.Struct({ orgId: Schema.String }))
  .setPayload(TransferOwnershipRequest)
  .addSuccess(HttpApiSchema.NoContent)
  .addError(InvalidOrganizationIdError)
  .addError(MembershipNotFoundError)
  .addError(CannotTransferToNonAdminError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Transfer ownership",
    description: "Transfer organization ownership to another admin member. Only the current owner can perform this action."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * MembershipApi - API group for organization membership management
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class MembershipApi extends HttpApiGroup.make("membership")
  .add(listMembers)
  .add(inviteMember)
  .add(updateMember)
  .add(removeMember)
  .add(reinstateMember)
  .add(suspendMember)
  .add(unsuspendMember)
  .add(transferOwnership)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Membership",
    description: "Manage organization memberships, roles, and invitations."
  })) {}
