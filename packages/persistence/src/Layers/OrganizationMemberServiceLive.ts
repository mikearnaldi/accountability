/**
 * OrganizationMemberServiceLive - PostgreSQL implementation of OrganizationMemberService
 *
 * Implements the OrganizationMemberService interface from core, providing
 * business logic for organization membership management including:
 * - Adding members with validation
 * - Removing members with owner protection
 * - Updating roles
 * - Reinstating removed members
 * - Transferring ownership atomically
 *
 * Includes audit logging for all member management operations:
 * - Member added (Create)
 * - Member removed (StatusChange: active → removed)
 * - Member role updated (Update)
 * - Member reinstated (StatusChange: removed → active)
 * - Member suspended (StatusChange: active → suspended)
 * - Member unsuspended (StatusChange: suspended → active)
 * - Ownership transferred (Update)
 *
 * @module OrganizationMemberServiceLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import {
  OrganizationMemberService,
  type OrganizationMemberServiceShape,
  type AddMemberInput,
  type UpdateMemberRolesInput,
  type TransferOwnershipInput
} from "@accountability/core/membership/OrganizationMemberService"
import { OrganizationMembership } from "@accountability/core/membership/OrganizationMembership"
import { OrganizationMembershipId } from "@accountability/core/membership/OrganizationMembershipId"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import {
  MembershipNotFoundError,
  OwnerCannotBeRemovedError,
  OwnerCannotBeSuspendedError,
  MemberNotSuspendedError,
  CannotTransferToNonAdminError,
  UserAlreadyMemberError
} from "@accountability/core/authorization/AuthorizationErrors"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import type { AuditLogError, UserLookupError } from "@accountability/core/audit/AuditLogErrors"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"
import { OrganizationMemberRepository } from "../Services/OrganizationMemberRepository.ts"

// =============================================================================
// Audit Log Helpers
// =============================================================================

/**
 * Helper to log member creation to audit log
 *
 * Accesses AuditLogService and CurrentUserId from the Effect context.
 * Per AUDIT_PAGE.md spec, audit logging is required - tests must provide
 * test implementations of these services.
 *
 * @param organizationId - The organization this member belongs to
 * @param membership - The created membership
 * @returns Effect that requires AuditLogService and CurrentUserId
 */
const logMemberCreate = (
  organizationId: string,
  membership: OrganizationMembership,
  memberName: string | null
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId
    yield* auditService.logCreate(
      organizationId,
      "OrganizationMember",
      membership.id,
      memberName,
      membership,
      userId
    )
  })

/**
 * Helper to log member role update to audit log
 *
 * Per AUDIT_PAGE.md spec, audit logging is required - tests must provide
 * test implementations of these services.
 *
 * @param organizationId - The organization this member belongs to
 * @param before - The membership state before the update
 * @param after - The membership state after the update
 * @returns Effect that requires AuditLogService and CurrentUserId
 */
const logMemberUpdate = (
  organizationId: string,
  before: OrganizationMembership,
  after: OrganizationMembership,
  memberName: string | null
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId
    yield* auditService.logUpdate(
      organizationId,
      "OrganizationMember",
      after.id,
      memberName,
      before,
      after,
      userId
    )
  })

/**
 * Helper to log member status change to audit log
 *
 * Used for status transitions like:
 * - active → removed (member removed)
 * - removed → active (member reinstated)
 * - active → suspended (member suspended)
 * - suspended → active (member unsuspended)
 *
 * Per AUDIT_PAGE.md spec, audit logging is required - tests must provide
 * test implementations of these services.
 *
 * @param organizationId - The organization this member belongs to
 * @param membership - The membership being changed
 * @param previousStatus - The status before the change
 * @param newStatus - The status after the change
 * @param reason - Optional reason for the status change
 * @returns Effect that requires AuditLogService and CurrentUserId
 */
const logMemberStatusChange = (
  organizationId: string,
  membership: OrganizationMembership,
  memberName: string | null,
  previousStatus: string,
  newStatus: string,
  reason?: string
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId
    yield* auditService.logStatusChange(
      organizationId,
      "OrganizationMember",
      membership.id,
      memberName,
      previousStatus,
      newStatus,
      userId,
      reason
    )
  })

/**
 * Creates the OrganizationMemberService implementation
 */
const make = Effect.gen(function* () {
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

  /**
   * Get a membership or fail with MembershipNotFoundError
   */
  const getMembershipOrFail = (organizationId: OrganizationId, userId: AuthUserId) =>
    Effect.gen(function* () {
      const maybeMembership = yield* memberRepo.findByUserAndOrganization(userId, organizationId)
      if (Option.isNone(maybeMembership)) {
        return yield* Effect.fail(
          new MembershipNotFoundError({ userId, organizationId })
        )
      }
      return maybeMembership.value
    })

  const service: OrganizationMemberServiceShape = {
    /**
     * Add a new member to an organization
     */
    addMember: (input: AddMemberInput) =>
      Effect.gen(function* () {
        // Check if user is already a member
        const existingMembership = yield* memberRepo.findByUserAndOrganization(
          input.userId,
          input.organizationId
        )

        if (Option.isSome(existingMembership)) {
          return yield* Effect.fail(
            new UserAlreadyMemberError({
              userId: input.userId,
              organizationId: input.organizationId
            })
          )
        }

        // Create the membership
        const now = Timestamp.now()
        const functionalFlags = functionalRolesToFlags(input.functionalRoles)

        const membership = OrganizationMembership.make({
          id: OrganizationMembershipId.make(crypto.randomUUID()),
          userId: input.userId,
          organizationId: input.organizationId,
          role: input.role,
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
          invitedBy: Option.fromNullable(input.invitedBy)
        })

        const createdMembership = yield* memberRepo.create(membership)

        // Log member creation to audit log
        // Note: User display name denormalization is Phase 2 work per AUDIT_PAGE.md
        yield* logMemberCreate(input.organizationId, createdMembership, null)

        return createdMembership
      }),

    /**
     * Remove a member from an organization (soft delete)
     */
    removeMember: (organizationId, userId, removedBy, reason) =>
      Effect.gen(function* () {
        // Get the membership
        const membership = yield* getMembershipOrFail(organizationId, userId)

        // Owner cannot be removed
        if (membership.isOwner()) {
          return yield* Effect.fail(
            new OwnerCannotBeRemovedError({ organizationId })
          )
        }

        // Remove the membership
        const removedMembership = yield* memberRepo.remove(membership.id, removedBy, reason)

        // Log member removal to audit log
        // Note: User display name denormalization is Phase 2 work per AUDIT_PAGE.md
        yield* logMemberStatusChange(
          organizationId,
          removedMembership,
          null,
          "active",
          "removed",
          reason ?? "Member removed from organization"
        )

        return removedMembership
      }),

    /**
     * Update a member's role and/or functional roles
     */
    updateRole: (organizationId, userId, input: UpdateMemberRolesInput) =>
      Effect.gen(function* () {
        // Get the membership
        const membership = yield* getMembershipOrFail(organizationId, userId)

        // Build the update input
        const updateInput: {
          role?: typeof input.role
          isController?: boolean
          isFinanceManager?: boolean
          isAccountant?: boolean
          isPeriodAdmin?: boolean
          isConsolidationManager?: boolean
        } = {}

        if (input.role !== undefined) {
          updateInput.role = input.role
        }

        if (input.functionalRoles !== undefined) {
          const flags = functionalRolesToFlags(input.functionalRoles)
          updateInput.isController = flags.isController
          updateInput.isFinanceManager = flags.isFinanceManager
          updateInput.isAccountant = flags.isAccountant
          updateInput.isPeriodAdmin = flags.isPeriodAdmin
          updateInput.isConsolidationManager = flags.isConsolidationManager
        }

        const updatedMembership = yield* memberRepo.update(membership.id, updateInput)

        // Log member role update to audit log
        // Note: User display name denormalization is Phase 2 work per AUDIT_PAGE.md
        yield* logMemberUpdate(organizationId, membership, updatedMembership, null)

        return updatedMembership
      }),

    /**
     * Reinstate a previously removed member
     */
    reinstateMember: (organizationId, userId, reinstatedBy) =>
      Effect.gen(function* () {
        // Get the membership (including removed ones)
        const membership = yield* getMembershipOrFail(organizationId, userId)
        const previousStatus = membership.status

        // Reinstate the membership
        const reinstatedMembership = yield* memberRepo.reinstate(membership.id, reinstatedBy)

        // Log member reinstatement to audit log
        // Note: User display name denormalization is Phase 2 work per AUDIT_PAGE.md
        yield* logMemberStatusChange(
          organizationId,
          reinstatedMembership,
          null,
          previousStatus,
          "active",
          "Member reinstated"
        )

        return reinstatedMembership
      }),

    /**
     * Suspend a member temporarily
     */
    suspendMember: (organizationId, userId, suspendedBy, reason) =>
      Effect.gen(function* () {
        // Get the membership
        const membership = yield* getMembershipOrFail(organizationId, userId)

        // Owner cannot be suspended
        if (membership.isOwner()) {
          return yield* Effect.fail(
            new OwnerCannotBeSuspendedError({ organizationId })
          )
        }

        // Suspend the membership
        const suspendedMembership = yield* memberRepo.suspend(membership.id, suspendedBy, reason)

        // Log member suspension to audit log
        // Note: User display name denormalization is Phase 2 work per AUDIT_PAGE.md
        yield* logMemberStatusChange(
          organizationId,
          suspendedMembership,
          null,
          "active",
          "suspended",
          reason ?? "Member suspended"
        )

        return suspendedMembership
      }),

    /**
     * Unsuspend a previously suspended member
     */
    unsuspendMember: (organizationId, userId, unsuspendedBy) =>
      Effect.gen(function* () {
        // Get the membership
        const membership = yield* getMembershipOrFail(organizationId, userId)

        // Check that member is actually suspended
        if (membership.status !== "suspended") {
          return yield* Effect.fail(
            new MemberNotSuspendedError({
              userId,
              organizationId,
              currentStatus: membership.status
            })
          )
        }

        // Unsuspend the membership
        const unsuspendedMembership = yield* memberRepo.unsuspend(membership.id, unsuspendedBy)

        // Log member unsuspension to audit log
        // Note: User display name denormalization is Phase 2 work per AUDIT_PAGE.md
        yield* logMemberStatusChange(
          organizationId,
          unsuspendedMembership,
          null,
          "suspended",
          "active",
          "Member unsuspended"
        )

        return unsuspendedMembership
      }),

    /**
     * Transfer organization ownership
     */
    transferOwnership: (input: TransferOwnershipInput) =>
      Effect.gen(function* () {
        // Get the current owner's membership
        const fromMembership = yield* getMembershipOrFail(
          input.organizationId,
          input.fromUserId
        )

        // Verify the 'from' user is actually the owner
        if (!fromMembership.isOwner()) {
          return yield* Effect.fail(
            new MembershipNotFoundError({
              userId: input.fromUserId,
              organizationId: input.organizationId
            })
          )
        }

        // Get the target user's membership
        const toMembership = yield* getMembershipOrFail(
          input.organizationId,
          input.toUserId
        )

        // Verify the target is an admin
        if (toMembership.role !== "admin") {
          return yield* Effect.fail(
            new CannotTransferToNonAdminError({ userId: input.toUserId })
          )
        }

        // Update the previous owner's role
        const updatedPreviousOwner = yield* memberRepo.update(fromMembership.id, {
          role: input.newRoleForPreviousOwner
        })

        // Update the new owner's role
        const updatedNewOwner = yield* memberRepo.update(toMembership.id, {
          role: "owner"
        })

        // Log ownership transfer to audit log
        // Note: User display name denormalization is Phase 2 work per AUDIT_PAGE.md
        yield* logMemberUpdate(input.organizationId, fromMembership, updatedPreviousOwner, null)
        yield* logMemberUpdate(input.organizationId, toMembership, updatedNewOwner, null)

        return {
          previousOwner: updatedPreviousOwner,
          newOwner: updatedNewOwner
        }
      }),

    /**
     * Get membership for a user in an organization
     */
    getMembership: (organizationId, userId) => getMembershipOrFail(organizationId, userId),

    /**
     * List all active members in an organization
     */
    listActiveMembers: (organizationId) => memberRepo.findActiveByOrganization(organizationId),

    /**
     * List all members in an organization (including removed/suspended)
     */
    listAllMembers: (organizationId) => memberRepo.findByOrganization(organizationId),

    /**
     * List all memberships for a user (across all organizations)
     */
    listUserMemberships: (userId) => memberRepo.findByUser(userId)
  }

  return service
})

/**
 * OrganizationMemberServiceLive - Layer providing OrganizationMemberService implementation
 *
 * Requires:
 * - OrganizationMemberRepository: For membership CRUD operations
 *
 * Usage:
 * ```typescript
 * import { OrganizationMemberServiceLive } from "@accountability/persistence/Layers/OrganizationMemberServiceLive"
 *
 * const program = Effect.gen(function* () {
 *   const memberService = yield* OrganizationMemberService
 *   const membership = yield* memberService.addMember({
 *     organizationId,
 *     userId,
 *     role: "member",
 *     functionalRoles: ["accountant"]
 *   })
 *   return membership
 * })
 *
 * program.pipe(
 *   Effect.provide(OrganizationMemberServiceLive),
 *   Effect.provide(OrganizationMemberRepositoryLive),
 *   Effect.provide(SqlLive)
 * )
 * ```
 */
export const OrganizationMemberServiceLive: Layer.Layer<
  OrganizationMemberService,
  never,
  OrganizationMemberRepository
> = Layer.effect(OrganizationMemberService, make)
