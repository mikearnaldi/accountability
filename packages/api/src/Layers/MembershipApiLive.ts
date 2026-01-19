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
import { OrganizationMemberService } from "@accountability/core/membership/OrganizationMemberService"
import { InvitationService } from "@accountability/core/membership/InvitationService"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  MemberInfo,
  MemberListResponse,
  InviteMemberResponse
} from "../Definitions/MembershipApi.ts"
import { InvalidOrganizationIdError } from "@accountability/core/organization/OrganizationErrors"
import { MemberNotFoundError } from "@accountability/core/membership/MembershipErrors"
import { requireOrganizationContext } from "./OrganizationContextMiddlewareLive.ts"

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
            Effect.mapError(() => new InvalidOrganizationIdError({
              value: path.orgId
            }))
          )

          // Get all members (including removed/suspended) - persistence errors become defects
          const memberships = yield* memberService.listAllMembers(orgId).pipe(
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
            Effect.mapError(() => new InvalidOrganizationIdError({
              value: path.orgId
            }))
          )

          const currentUserInfo = yield* CurrentUser
          const currentUserId = AuthUserId.make(currentUserInfo.userId)

          // Create invitation using InvitationService
          // InvitationAlreadyExistsError flows through directly
          const result = yield* invitationService.createInvitation({
            organizationId: orgId,
            email: payload.email,
            role: payload.role,
            functionalRoles: payload.functionalRoles,
            invitedBy: currentUserId
          }).pipe(
            Effect.orDie // PersistenceError becomes a defect
          )

          // Return the invitation ID and raw token so it can be displayed to the admin
          // The admin can then share this link with the invitee manually
          // Email sending is explicitly NOT implemented - the manual workflow is:
          // 1. Admin creates invitation, sees the link
          // 2. Admin copies and shares link via email/Slack/etc.
          // 3. Invitee clicks link to accept

          return InviteMemberResponse.make({
            invitationId: result.invitation.id,
            invitationToken: result.rawToken
          })
        })
      )

      // =======================================================================
      // Update Member
      // =======================================================================
      .handle("updateMember", ({ path, payload }) =>
        requireOrganizationContext(path.orgId,
          Effect.gen(function* () {
            const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
              Effect.mapError(() => new InvalidOrganizationIdError({
                value: path.orgId
              }))
            )

            const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
              Effect.mapError(() => new MemberNotFoundError({
                memberId: path.userId
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
            // MembershipNotFoundError flows through directly
            const membership = yield* memberService.updateRole(orgId, userId, updateInput).pipe(
              Effect.orDie // PersistenceError/EntityNotFoundError becomes a defect
            )

            // Look up user details
            const userOption = yield* userRepository.findById(membership.userId).pipe(
              Effect.orDie
            )

            if (Option.isNone(userOption)) {
              return yield* Effect.fail(new MemberNotFoundError({
                memberId: membership.userId
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
      )

      // =======================================================================
      // Remove Member
      // =======================================================================
      .handle("removeMember", ({ path, payload }) =>
        requireOrganizationContext(path.orgId,
          Effect.gen(function* () {
            const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
              Effect.mapError(() => new InvalidOrganizationIdError({
                value: path.orgId
              }))
            )

            const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
              Effect.mapError(() => new MemberNotFoundError({
                memberId: path.userId
              }))
            )

            // Get current user ID from context (provided by requireOrganizationContext)
            const currentUserId = yield* CurrentUserId

            // Remove the member
            // MembershipNotFoundError, OwnerCannotBeRemovedError flow through directly
            yield* memberService.removeMember(
              orgId,
              userId,
              currentUserId,
              Option.getOrUndefined(payload.reason)
            ).pipe(
              Effect.orDie // PersistenceError/EntityNotFoundError becomes a defect
            )
          })
        )
      )

      // =======================================================================
      // Reinstate Member
      // =======================================================================
      .handle("reinstateMember", ({ path }) =>
        requireOrganizationContext(path.orgId,
          Effect.gen(function* () {
            const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
              Effect.mapError(() => new InvalidOrganizationIdError({
                value: path.orgId
              }))
            )

            const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
              Effect.mapError(() => new MemberNotFoundError({
                memberId: path.userId
              }))
            )

            // Get current user ID from context (provided by requireOrganizationContext)
            const currentUserId = yield* CurrentUserId

            // Reinstate the member
            // MembershipNotFoundError flows through directly
            const membership = yield* memberService.reinstateMember(
              orgId,
              userId,
              currentUserId
            ).pipe(
              Effect.orDie // PersistenceError/EntityNotFoundError becomes a defect
            )

            // Look up user details
            const userOption = yield* userRepository.findById(membership.userId).pipe(
              Effect.orDie
            )

            if (Option.isNone(userOption)) {
              return yield* Effect.fail(new MemberNotFoundError({
                memberId: membership.userId
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
      )

      // =======================================================================
      // Suspend Member
      // =======================================================================
      .handle("suspendMember", ({ path, payload }) =>
        requireOrganizationContext(path.orgId,
          Effect.gen(function* () {
            const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
              Effect.mapError(() => new InvalidOrganizationIdError({
                value: path.orgId
              }))
            )

            const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
              Effect.mapError(() => new MemberNotFoundError({
                memberId: path.userId
              }))
            )

            // Get current user ID from context (provided by requireOrganizationContext)
            const currentUserId = yield* CurrentUserId

            // Suspend the member
            // MembershipNotFoundError, OwnerCannotBeSuspendedError flow through directly
            const membership = yield* memberService.suspendMember(
              orgId,
              userId,
              currentUserId,
              Option.getOrUndefined(payload.reason)
            ).pipe(
              Effect.orDie // PersistenceError/EntityNotFoundError becomes a defect
            )

            // Look up user details
            const userOption = yield* userRepository.findById(membership.userId).pipe(
              Effect.orDie
            )

            if (Option.isNone(userOption)) {
              return yield* Effect.fail(new MemberNotFoundError({
                memberId: membership.userId
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
      )

      // =======================================================================
      // Unsuspend Member
      // =======================================================================
      .handle("unsuspendMember", ({ path }) =>
        requireOrganizationContext(path.orgId,
          Effect.gen(function* () {
            const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
              Effect.mapError(() => new InvalidOrganizationIdError({
                value: path.orgId
              }))
            )

            const userId = yield* Schema.decodeUnknown(AuthUserId)(path.userId).pipe(
              Effect.mapError(() => new MemberNotFoundError({
                memberId: path.userId
              }))
            )

            // Get current user ID from context (provided by requireOrganizationContext)
            const currentUserId = yield* CurrentUserId

            // Unsuspend the member
            // MembershipNotFoundError, MemberNotSuspendedError flow through directly
            const membership = yield* memberService.unsuspendMember(
              orgId,
              userId,
              currentUserId
            ).pipe(
              Effect.orDie // PersistenceError/EntityNotFoundError becomes a defect
            )

            // Look up user details
            const userOption = yield* userRepository.findById(membership.userId).pipe(
              Effect.orDie
            )

            if (Option.isNone(userOption)) {
              return yield* Effect.fail(new MemberNotFoundError({
                memberId: membership.userId
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
      )

      // =======================================================================
      // Transfer Ownership
      // =======================================================================
      .handle("transferOwnership", ({ path, payload }) =>
        requireOrganizationContext(path.orgId,
          Effect.gen(function* () {
            const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
              Effect.mapError(() => new InvalidOrganizationIdError({
                value: path.orgId
              }))
            )

            // Get current user ID from context (provided by requireOrganizationContext)
            const currentUserId = yield* CurrentUserId

            // Transfer ownership
            // MembershipNotFoundError, CannotTransferToNonAdminError flow through directly
            yield* memberService.transferOwnership({
              organizationId: orgId,
              fromUserId: currentUserId,
              toUserId: payload.toUserId,
              newRoleForPreviousOwner: payload.myNewRole
            }).pipe(
              Effect.orDie // PersistenceError/EntityNotFoundError becomes a defect
            )
          })
        )
      )
  })
)
