/**
 * MembershipApiLive - Live implementation of membership API handlers
 *
 * Implements the MembershipApi endpoints using OrganizationMemberService
 * and InvitationService.
 *
 * @module MembershipApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { OrganizationMemberService } from "@accountability/core/Auth/OrganizationMemberService"
import { InvitationService } from "@accountability/core/Auth/InvitationService"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  MemberInfo,
  MemberListResponse,
  InviteMemberResponse
} from "../Definitions/MembershipApi.ts"
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError
} from "../Definitions/ApiErrors.ts"

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * MembershipApiLive - Layer providing MembershipApi handlers
 *
 * Requires:
 * - OrganizationMemberService
 * - InvitationService
 * - UserRepository
 */
export const MembershipApiLive = HttpApiBuilder.group(AppApi, "membership", (handlers) =>
  Effect.gen(function* () {
    const memberService = yield* OrganizationMemberService
    const invitationService = yield* InvitationService
    const userRepository = yield* UserRepository

    return handlers
      // =======================================================================
      // List Members
      // =======================================================================
      .handle("listMembers", ({ path }) =>
        Effect.gen(function* () {
          const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "Organization",
              id: path.orgId
            }))
          )

          // Get all members - persistence errors become defects
          const memberships = yield* memberService.listActiveMembers(orgId).pipe(
            Effect.orDie
          )

          // Look up user details for each membership
          const members: MemberInfo[] = []
          for (const membership of memberships) {
            const userOption = yield* userRepository.findById(membership.userId).pipe(
              Effect.orDie
            )

            if (Option.isSome(userOption)) {
              const user = userOption.value
              members.push(
                MemberInfo.make({
                  userId: membership.userId,
                  email: user.email,
                  displayName: user.displayName,
                  role: membership.role,
                  functionalRoles: membership.getFunctionalRoles(),
                  status: membership.status,
                  joinedAt: membership.createdAt
                })
              )
            }
          }

          return MemberListResponse.make({ members })
        })
      )

      // =======================================================================
      // Invite Member
      // =======================================================================
      .handle("inviteMember", ({ path, payload }) =>
        Effect.gen(function* () {
          const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new ValidationError({
              message: "Invalid organization ID format",
              field: Option.some("orgId"),
              details: Option.none()
            }))
          )

          const currentUserInfo = yield* CurrentUser
          const currentUserId = AuthUserId.make(currentUserInfo.userId)

          // Create invitation using InvitationService
          const result = yield* invitationService.createInvitation({
            organizationId: orgId,
            email: payload.email,
            role: payload.role,
            functionalRoles: payload.functionalRoles,
            invitedBy: currentUserId
          }).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "InvitationAlreadyExistsError") {
                return new BusinessRuleError({
                  code: "INVITATION_ALREADY_EXISTS",
                  message: "A pending invitation already exists for this email",
                  details: Option.none()
                })
              }
              // Map PersistenceError to BusinessRuleError
              return new BusinessRuleError({
                code: "INVITATION_FAILED",
                message: "message" in error ? String(error.message) : "Failed to create invitation",
                details: Option.none()
              })
            })
          )

          // TODO: Send email with rawToken to invitee
          // For now, just return the invitation ID

          return InviteMemberResponse.make({
            invitationId: result.invitation.id
          })
        })
      )

      // =======================================================================
      // Update Member
      // =======================================================================
      .handle("updateMember", ({ path, payload }) =>
        Effect.gen(function* () {
          const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new ValidationError({
              message: "Invalid organization ID format",
              field: Option.some("orgId"),
              details: Option.none()
            }))
          )

          const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
            Effect.mapError(() => new ValidationError({
              message: "Invalid user ID format",
              field: Option.some("userId"),
              details: Option.none()
            }))
          )

          // Build update input - only include fields that have values
          const updateInput: { role?: typeof payload.role extends Option.Option<infer R> ? R : never; functionalRoles?: readonly ("controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager")[] } = {}
          if (Option.isSome(payload.role)) {
            updateInput.role = payload.role.value
          }
          if (Option.isSome(payload.functionalRoles)) {
            updateInput.functionalRoles = payload.functionalRoles.value
          }

          // Update the member's role
          const membership = yield* memberService.updateRole(orgId, userId, updateInput).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "MembershipNotFoundError") {
                return new NotFoundError({
                  resource: "Membership",
                  id: `user ${path.userId} in org ${path.orgId}`
                })
              }
              if ("_tag" in error && error._tag === "EntityNotFoundError") {
                return new NotFoundError({
                  resource: "Membership",
                  id: `user ${path.userId}`
                })
              }
              // Map PersistenceError to BusinessRuleError
              return new BusinessRuleError({
                code: "UPDATE_FAILED",
                message: "message" in error ? String(error.message) : "Failed to update member",
                details: Option.none()
              })
            })
          )

          // Look up user details
          const userOption = yield* userRepository.findById(membership.userId).pipe(
            Effect.orDie
          )

          if (Option.isNone(userOption)) {
            return yield* Effect.fail(new NotFoundError({
              resource: "User",
              id: membership.userId
            }))
          }

          const user = userOption.value
          return MemberInfo.make({
            userId: membership.userId,
            email: user.email,
            displayName: user.displayName,
            role: membership.role,
            functionalRoles: membership.getFunctionalRoles(),
            status: membership.status,
            joinedAt: membership.createdAt
          })
        })
      )

      // =======================================================================
      // Remove Member
      // =======================================================================
      .handle("removeMember", ({ path, payload }) =>
        Effect.gen(function* () {
          const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "Organization",
              id: path.orgId
            }))
          )

          const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "User",
              id: path.userId
            }))
          )

          const currentUserInfo = yield* CurrentUser
          const currentUserId = AuthUserId.make(currentUserInfo.userId)

          // Remove the member
          yield* memberService.removeMember(
            orgId,
            userId,
            currentUserId,
            Option.getOrUndefined(payload.reason)
          ).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "MembershipNotFoundError") {
                return new NotFoundError({
                  resource: "Membership",
                  id: `user ${path.userId} in org ${path.orgId}`
                })
              }
              if ("_tag" in error && error._tag === "OwnerCannotBeRemovedError") {
                return new BusinessRuleError({
                  code: "OWNER_CANNOT_BE_REMOVED",
                  message: "The organization owner cannot be removed. Transfer ownership first.",
                  details: Option.none()
                })
              }
              if ("_tag" in error && error._tag === "EntityNotFoundError") {
                return new NotFoundError({
                  resource: "Membership",
                  id: `user ${path.userId}`
                })
              }
              // Map PersistenceError to BusinessRuleError
              return new BusinessRuleError({
                code: "REMOVE_FAILED",
                message: "message" in error ? String(error.message) : "Failed to remove member",
                details: Option.none()
              })
            })
          )
        })
      )

      // =======================================================================
      // Reinstate Member
      // =======================================================================
      .handle("reinstateMember", ({ path }) =>
        Effect.gen(function* () {
          const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "Organization",
              id: path.orgId
            }))
          )

          const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
            Effect.mapError(() => new NotFoundError({
              resource: "User",
              id: path.userId
            }))
          )

          const currentUserInfo = yield* CurrentUser
          const currentUserId = AuthUserId.make(currentUserInfo.userId)

          // Reinstate the member
          const membership = yield* memberService.reinstateMember(
            orgId,
            userId,
            currentUserId
          ).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "MembershipNotFoundError") {
                return new NotFoundError({
                  resource: "Membership",
                  id: `user ${path.userId} in org ${path.orgId}`
                })
              }
              if ("_tag" in error && error._tag === "EntityNotFoundError") {
                return new NotFoundError({
                  resource: "Membership",
                  id: `user ${path.userId}`
                })
              }
              // PersistenceError - map to BusinessRuleError for reinstate endpoint
              return new BusinessRuleError({
                code: "REINSTATE_FAILED",
                message: "Failed to reinstate member",
                details: Option.none()
              })
            })
          )

          // Look up user details
          const userOption = yield* userRepository.findById(membership.userId).pipe(
            Effect.orDie
          )

          if (Option.isNone(userOption)) {
            return yield* Effect.fail(new NotFoundError({
              resource: "User",
              id: membership.userId
            }))
          }

          const user = userOption.value
          return MemberInfo.make({
            userId: membership.userId,
            email: user.email,
            displayName: user.displayName,
            role: membership.role,
            functionalRoles: membership.getFunctionalRoles(),
            status: membership.status,
            joinedAt: membership.createdAt
          })
        })
      )

      // =======================================================================
      // Transfer Ownership
      // =======================================================================
      .handle("transferOwnership", ({ path, payload }) =>
        Effect.gen(function* () {
          const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
            Effect.mapError(() => new ValidationError({
              message: "Invalid organization ID format",
              field: Option.some("orgId"),
              details: Option.none()
            }))
          )

          const currentUserInfo = yield* CurrentUser
          const currentUserId = AuthUserId.make(currentUserInfo.userId)

          // Transfer ownership
          yield* memberService.transferOwnership({
            organizationId: orgId,
            fromUserId: currentUserId,
            toUserId: payload.toUserId,
            newRoleForPreviousOwner: payload.myNewRole
          }).pipe(
            Effect.mapError((error) => {
              if ("_tag" in error && error._tag === "MembershipNotFoundError") {
                return new NotFoundError({
                  resource: "Membership",
                  id: `user in org ${path.orgId}`
                })
              }
              if ("_tag" in error && error._tag === "CannotTransferToNonAdminError") {
                return new ValidationError({
                  message: "Ownership can only be transferred to an existing admin member",
                  field: Option.some("toUserId"),
                  details: Option.none()
                })
              }
              if ("_tag" in error && error._tag === "EntityNotFoundError") {
                return new NotFoundError({
                  resource: "User",
                  id: payload.toUserId
                })
              }
              // PersistenceError - map to BusinessRuleError
              return new BusinessRuleError({
                code: "TRANSFER_FAILED",
                message: "Failed to transfer ownership",
                details: Option.none()
              })
            })
          )
        })
      )
  })
)
