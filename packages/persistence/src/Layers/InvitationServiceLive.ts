/**
 * InvitationServiceLive - PostgreSQL implementation of InvitationService
 *
 * Implements the InvitationService interface from core, providing
 * business logic for organization invitation management including:
 * - Creating invitations with secure token generation
 * - Accepting invitations (creating membership)
 * - Declining and revoking invitations
 *
 * @module InvitationServiceLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import {
  InvitationService,
  type InvitationServiceShape,
  type CreateInvitationInput,
  type CreateInvitationResult,
  type AcceptInvitationResult
} from "@accountability/core/membership/InvitationService"
import { OrganizationMembership } from "@accountability/core/membership/OrganizationMembership"
import { OrganizationMembershipId } from "@accountability/core/membership/OrganizationMembershipId"
import { InvitationId } from "@accountability/core/membership/InvitationId"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import {
  InvalidInvitationError,
  InvitationExpiredError,
  InvitationAlreadyExistsError,
  UserAlreadyMemberError
} from "@accountability/core/authorization/AuthorizationErrors"
import { InvitationRepository } from "../Services/InvitationRepository.ts"
import { OrganizationMemberRepository } from "../Services/OrganizationMemberRepository.ts"

/**
 * Generate a cryptographically secure token
 * 256-bit random, base64url encoded
 */
const generateToken = (): Effect.Effect<string> =>
  Effect.sync(() => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const base64 = btoa(String.fromCharCode(...bytes))
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  })

/**
 * Hash a token using SHA-256
 */
const hashToken = (token: string): Effect.Effect<string> =>
  Effect.promise(async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  })

/**
 * Creates the InvitationService implementation
 */
const make = Effect.gen(function* () {
  const invitationRepo = yield* InvitationRepository
  const memberRepo = yield* OrganizationMemberRepository

  /**
   * Convert functional roles array to boolean flags
   */
  const functionalRolesToFlags = (
    roles: readonly string[]
  ): {
    isController: boolean
    isFinanceManager: boolean
    isAccountant: boolean
    isPeriodAdmin: boolean
    isConsolidationManager: boolean
  } => ({
    isController: roles.includes("controller"),
    isFinanceManager: roles.includes("finance_manager"),
    isAccountant: roles.includes("accountant"),
    isPeriodAdmin: roles.includes("period_admin"),
    isConsolidationManager: roles.includes("consolidation_manager")
  })

  const service: InvitationServiceShape = {
    /**
     * Create a new invitation
     */
    createInvitation: (input: CreateInvitationInput) =>
      Effect.gen(function* () {
        // Check if a pending invitation already exists
        const hasPending = yield* invitationRepo.hasPendingInvitation(
          input.email,
          input.organizationId
        )

        if (hasPending) {
          return yield* Effect.fail(
            new InvitationAlreadyExistsError({
              email: input.email,
              organizationId: input.organizationId
            })
          )
        }

        // Generate token
        const rawToken = yield* generateToken()

        // Create invitation
        const invitationId = InvitationId.make(crypto.randomUUID())
        const invitation = yield* invitationRepo.create(
          {
            id: invitationId,
            organizationId: input.organizationId,
            email: input.email,
            role: input.role,
            functionalRoles: input.functionalRoles,
            invitedBy: input.invitedBy
          },
          rawToken
        )

        return { invitation, rawToken } satisfies CreateInvitationResult
      }),

    /**
     * Accept an invitation
     */
    acceptInvitation: (token, userId) =>
      Effect.gen(function* () {
        // Hash the token and find the invitation
        const tokenHash = yield* hashToken(token)
        const maybeInvitation = yield* invitationRepo.findByTokenHash(tokenHash)

        if (Option.isNone(maybeInvitation)) {
          return yield* Effect.fail(
            new InvalidInvitationError({ reason: "Invitation not found" })
          )
        }

        const invitation = maybeInvitation.value

        // Check invitation status
        if (invitation.isRevoked()) {
          return yield* Effect.fail(new InvitationExpiredError())
        }

        if (!invitation.isPending()) {
          return yield* Effect.fail(
            new InvalidInvitationError({ reason: "Invitation has already been used" })
          )
        }

        // Check if user is already a member
        const existingMembership = yield* memberRepo.findByUserAndOrganization(
          userId,
          invitation.organizationId
        )

        if (Option.isSome(existingMembership)) {
          return yield* Effect.fail(
            new UserAlreadyMemberError({
              userId,
              organizationId: invitation.organizationId
            })
          )
        }

        // Accept the invitation
        const updatedInvitation = yield* invitationRepo.accept(invitation.id, userId)

        // Create the membership
        const now = Timestamp.now()
        const functionalFlags = functionalRolesToFlags(invitation.functionalRoles)

        const membership = OrganizationMembership.make({
          id: OrganizationMembershipId.make(crypto.randomUUID()),
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
          isController: functionalFlags.isController,
          isFinanceManager: functionalFlags.isFinanceManager,
          isAccountant: functionalFlags.isAccountant,
          isPeriodAdmin: functionalFlags.isPeriodAdmin,
          isConsolidationManager: functionalFlags.isConsolidationManager,
          status: "active",
          removedAt: Option.none(),
          removedBy: Option.none(),
          removalReason: Option.none(),
          reinstatedAt: Option.none(),
          reinstatedBy: Option.none(),
          createdAt: now,
          updatedAt: now,
          invitedBy: Option.some(invitation.invitedBy)
        })

        const createdMembership = yield* memberRepo.create(membership)

        return {
          invitation: updatedInvitation,
          membership: createdMembership
        } satisfies AcceptInvitationResult
      }),

    /**
     * Decline an invitation
     */
    declineInvitation: (token) =>
      Effect.gen(function* () {
        // Hash the token and find the invitation
        const tokenHash = yield* hashToken(token)
        const maybeInvitation = yield* invitationRepo.findByTokenHash(tokenHash)

        if (Option.isNone(maybeInvitation)) {
          return yield* Effect.fail(
            new InvalidInvitationError({ reason: "Invitation not found" })
          )
        }

        const invitation = maybeInvitation.value

        // Check invitation status
        if (invitation.isRevoked()) {
          return yield* Effect.fail(new InvitationExpiredError())
        }

        if (!invitation.isPending()) {
          return yield* Effect.fail(
            new InvalidInvitationError({ reason: "Invitation has already been used" })
          )
        }

        // Revoke the invitation (decline is same as revoke from DB perspective)
        return yield* invitationRepo.revoke(invitation.id, invitation.invitedBy)
      }),

    /**
     * Revoke an invitation (admin action)
     */
    revokeInvitation: (invitationId, revokedBy) =>
      Effect.gen(function* () {
        // Find the invitation
        const maybeInvitation = yield* invitationRepo.findById(invitationId)

        if (Option.isNone(maybeInvitation)) {
          return yield* Effect.fail(
            new InvalidInvitationError({ reason: "Invitation not found" })
          )
        }

        const invitation = maybeInvitation.value

        // Check if already not pending
        if (!invitation.isPending()) {
          return yield* Effect.fail(
            new InvalidInvitationError({ reason: "Invitation is not pending" })
          )
        }

        // Revoke the invitation
        return yield* invitationRepo.revoke(invitationId, revokedBy)
      }),

    /**
     * List pending invitations for a user by email
     */
    listPendingByEmail: (email) => invitationRepo.findPendingByEmail(email),

    /**
     * List pending invitations for an organization
     */
    listPendingByOrganization: (organizationId) =>
      invitationRepo.findPendingByOrganization(organizationId)
  }

  return service
})

/**
 * InvitationServiceLive - Layer providing InvitationService implementation
 *
 * Requires:
 * - InvitationRepository: For invitation CRUD operations
 * - OrganizationMemberRepository: For creating memberships on accept
 *
 * Usage:
 * ```typescript
 * import { InvitationServiceLive } from "@accountability/persistence/Layers/InvitationServiceLive"
 *
 * const program = Effect.gen(function* () {
 *   const invitationService = yield* InvitationService
 *   const { invitation, rawToken } = yield* invitationService.createInvitation({
 *     organizationId,
 *     email: "user@example.com",
 *     role: "member",
 *     functionalRoles: ["accountant"],
 *     invitedBy: adminUserId
 *   })
 *   return invitation
 * })
 *
 * program.pipe(
 *   Effect.provide(InvitationServiceLive),
 *   Effect.provide(InvitationRepositoryLive),
 *   Effect.provide(OrganizationMemberRepositoryLive),
 *   Effect.provide(SqlLive)
 * )
 * ```
 */
export const InvitationServiceLive: Layer.Layer<
  InvitationService,
  never,
  InvitationRepository | OrganizationMemberRepository
> = Layer.effect(InvitationService, make)
