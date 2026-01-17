/**
 * InvitationApiLive - Live implementation of invitation API handlers
 *
 * Implements the InvitationApi endpoints using InvitationService.
 *
 * @module InvitationApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { InvitationService } from "@accountability/core/Auth/InvitationService"
import { Email } from "@accountability/core/Auth/Email"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { OrganizationRepository } from "@accountability/persistence/Services/OrganizationRepository"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { InvitationId } from "@accountability/core/Auth/InvitationId"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  PendingInvitationInfo,
  InviterInfo,
  UserInvitationsResponse,
  OrgInvitationInfo,
  OrgInvitationsResponse,
  AcceptInvitationResponse
} from "../Definitions/InvitationApi.ts"
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError
} from "../Definitions/ApiErrors.ts"

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * InvitationApiLive - Layer providing InvitationApi handlers
 *
 * Requires:
 * - InvitationService
 * - UserRepository
 * - OrganizationRepository
 */
export const InvitationApiLive = HttpApiBuilder.group(AppApi, "invitation", (handlers) =>
  Effect.gen(function* () {
    const invitationService = yield* InvitationService
    const userRepository = yield* UserRepository
    const organizationRepository = yield* OrganizationRepository

    return handlers
      // =======================================================================
      // List User's Pending Invitations
      // =======================================================================
      .handle("listUserInvitations", () =>
        Effect.gen(function* () {
          const currentUserInfo = yield* CurrentUser

          // Look up user to get email
          const userOption = yield* userRepository.findById(
            AuthUserId.make(currentUserInfo.userId)
          ).pipe(Effect.orDie)

          if (Option.isNone(userOption)) {
            return UserInvitationsResponse.make({ invitations: [] })
          }

          const user = userOption.value

          // Get pending invitations for this email
          const invitations = yield* invitationService.listPendingByEmail(user.email).pipe(
            Effect.orDie
          )

          // Build response with organization and inviter details
          const pendingInvitations: PendingInvitationInfo[] = []

          for (const invitation of invitations) {
            // Get organization details
            const orgOption = yield* organizationRepository.findById(invitation.organizationId).pipe(
              Effect.orDie
            )

            if (Option.isNone(orgOption)) {
              continue // Skip if org not found
            }

            const org = orgOption.value

            // Get inviter details
            const inviterOption = yield* userRepository.findById(invitation.invitedBy).pipe(
              Effect.orDie
            )

            if (Option.isNone(inviterOption)) {
              continue // Skip if inviter not found
            }

            const inviter = inviterOption.value

            pendingInvitations.push(
              PendingInvitationInfo.make({
                id: invitation.id,
                organizationId: invitation.organizationId,
                organizationName: org.name,
                role: invitation.role,
                functionalRoles: invitation.functionalRoles,
                invitedBy: InviterInfo.make({
                  email: inviter.email,
                  displayName: inviter.displayName
                }),
                createdAt: invitation.createdAt
              })
            )
          }

          return UserInvitationsResponse.make({ invitations: pendingInvitations })
        })
      )

      // =======================================================================
      // Accept Invitation
      // =======================================================================
      .handle("acceptInvitation", ({ path }) =>
        Effect.gen(function* () {
          const currentUserInfo = yield* CurrentUser
          const userId = AuthUserId.make(currentUserInfo.userId)

          // Accept the invitation
          const result = yield* invitationService.acceptInvitation(path.token, userId).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "InvalidInvitationError") {
                return new NotFoundError({
                  resource: "Invitation",
                  id: "token"
                })
              }
              if ("_tag" in error && error._tag === "InvitationExpiredError") {
                return new BusinessRuleError({
                  code: "INVITATION_REVOKED",
                  message: "This invitation has been revoked",
                  details: Option.none()
                })
              }
              if ("_tag" in error && error._tag === "UserAlreadyMemberError") {
                return new BusinessRuleError({
                  code: "ALREADY_MEMBER",
                  message: "You are already a member of this organization",
                  details: Option.none()
                })
              }
              // PersistenceError or EntityNotFoundError - map to BusinessRuleError
              return new BusinessRuleError({
                code: "ACCEPT_FAILED",
                message: "message" in error ? String(error.message) : "Failed to accept invitation",
                details: Option.none()
              })
            })
          )

          // Get organization name for response
          const orgOption = yield* organizationRepository.findById(result.invitation.organizationId).pipe(
            Effect.orDie
          )

          const orgName = Option.isSome(orgOption) ? orgOption.value.name : "Unknown Organization"

          return AcceptInvitationResponse.make({
            organizationId: result.invitation.organizationId,
            organizationName: orgName,
            role: result.membership.role
          })
        })
      )

      // =======================================================================
      // Decline Invitation
      // =======================================================================
      .handle("declineInvitation", ({ path }) =>
        Effect.gen(function* () {
          // Decline the invitation
          yield* invitationService.declineInvitation(path.token).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "InvalidInvitationError") {
                return new NotFoundError({
                  resource: "Invitation",
                  id: "token"
                })
              }
              if ("_tag" in error && error._tag === "InvitationExpiredError") {
                return new BusinessRuleError({
                  code: "INVITATION_REVOKED",
                  message: "This invitation has already been revoked",
                  details: Option.none()
                })
              }
              // PersistenceError or EntityNotFoundError - map to ValidationError
              return new ValidationError({
                message: "message" in error ? String(error.message) : "Failed to decline invitation",
                field: Option.none(),
                details: Option.none()
              })
            })
          )
        })
      )

      // =======================================================================
      // Revoke Invitation (Admin Action)
      // =======================================================================
      .handle("revokeInvitation", ({ path }) =>
        Effect.gen(function* () {
          const currentUserInfo = yield* CurrentUser
          const currentUserId = AuthUserId.make(currentUserInfo.userId)

          // Validate organization ID
          yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "Organization",
              id: path.orgId
            }))
          )

          // Validate invitation ID
          const invitationId = yield* Schema.decodeUnknown(InvitationId)(path.invitationId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "Invitation",
              id: path.invitationId
            }))
          )

          // TODO: Check that current user has permission to revoke invitations for this org
          // For now, we just allow any authenticated user (will be enforced by authorization layer later)

          // Revoke the invitation
          yield* invitationService.revokeInvitation(invitationId, currentUserId).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "InvalidInvitationError") {
                return new NotFoundError({
                  resource: "Invitation",
                  id: path.invitationId
                })
              }
              // PersistenceError or EntityNotFoundError - map to BusinessRuleError
              return new BusinessRuleError({
                code: "REVOKE_FAILED",
                message: "message" in error ? String(error.message) : "Failed to revoke invitation",
                details: Option.none()
              })
            })
          )
        })
      )

      // =======================================================================
      // List Organization's Pending Invitations (Admin Action)
      // =======================================================================
      .handle("listOrgInvitations", ({ path }) =>
        Effect.gen(function* () {
          // Validate organization ID
          const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "Organization",
              id: path.orgId
            }))
          )

          // TODO: Check that current user has permission to view invitations for this org
          // For now, we just allow any authenticated user (will be enforced by authorization layer later)

          // Get pending invitations for this organization
          const invitations = yield* invitationService.listPendingByOrganization(orgId).pipe(
            Effect.orDie
          )

          // Build response with inviter details
          const orgInvitations: OrgInvitationInfo[] = []

          for (const invitation of invitations) {
            // Get inviter details
            const inviterOption = yield* userRepository.findById(invitation.invitedBy).pipe(
              Effect.orDie
            )

            if (Option.isNone(inviterOption)) {
              continue // Skip if inviter not found
            }

            const inviter = inviterOption.value

            // Decode the email to branded type (should always succeed since invitation emails are validated)
            const emailResult = yield* Schema.decodeUnknown(Email)(invitation.email).pipe(
              Effect.orDie
            )

            orgInvitations.push(
              OrgInvitationInfo.make({
                id: invitation.id,
                email: emailResult,
                role: invitation.role,
                functionalRoles: invitation.functionalRoles,
                status: invitation.status,
                invitedBy: InviterInfo.make({
                  email: inviter.email,
                  displayName: inviter.displayName
                }),
                createdAt: invitation.createdAt
              })
            )
          }

          return OrgInvitationsResponse.make({ invitations: orgInvitations })
        })
      )
  })
)
