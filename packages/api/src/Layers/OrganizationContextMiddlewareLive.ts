/**
 * OrganizationContextMiddlewareLive - Helper for loading organization context
 *
 * Provides a helper function for API handlers to load and validate
 * organization membership for the current user. This acts as a
 * "middleware-like" pattern that handlers call at the beginning.
 *
 * Since Effect HttpApiMiddleware doesn't have access to path parameters,
 * we use this helper pattern instead where handlers:
 * 1. Extract orgId from path
 * 2. Call withOrganizationContext(orgId) to load membership
 * 3. Run their business logic with CurrentOrganizationMembership provided
 *
 * @module OrganizationContextMiddlewareLive
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { OrganizationMemberRepository } from "@accountability/persistence/Services/OrganizationMemberRepository"
import {
  CurrentOrganizationMembership,
  withOrganizationMembership
} from "@accountability/core/Auth/CurrentOrganizationMembership"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { ForbiddenError, NotFoundError } from "../Definitions/ApiErrors.ts"

// =============================================================================
// Types
// =============================================================================

/**
 * OrganizationContextError - Errors that can occur during organization context loading
 */
export type OrganizationContextError = ForbiddenError | NotFoundError

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * validateOrganizationId - Decode and validate organization ID from string
 *
 * @param orgIdString - The raw organization ID string from path parameter
 * @returns Effect that decodes to OrganizationId or fails with NotFoundError
 */
export const validateOrganizationId = (orgIdString: string) =>
  Schema.decodeUnknown(OrganizationId)(orgIdString).pipe(
    Effect.mapError(() =>
      new NotFoundError({
        resource: "Organization",
        id: orgIdString
      })
    )
  )

/**
 * loadOrganizationMembership - Load and validate the current user's membership
 *
 * Loads the membership for the current authenticated user in the specified
 * organization. Validates that:
 * - The user is authenticated (via CurrentUser context)
 * - The user is a member of the organization
 * - The membership is active
 *
 * @param organizationId - The organization ID to load membership for
 * @returns Effect containing the membership or failing with ForbiddenError
 *
 * Requires: CurrentUser, OrganizationMemberRepository
 */
export const loadOrganizationMembership = (organizationId: OrganizationId) =>
  Effect.gen(function* () {
    // Get current authenticated user
    const currentUser = yield* CurrentUser
    const userId = AuthUserId.make(currentUser.userId)

    // Load membership from repository
    const memberRepo = yield* OrganizationMemberRepository
    const membershipOption = yield* memberRepo.findByUserAndOrganization(
      userId,
      organizationId
    ).pipe(
      Effect.mapError(() =>
        new ForbiddenError({
          message: "Failed to verify organization membership",
          resource: Option.some("Organization"),
          action: Option.none()
        })
      )
    )

    // Check membership exists
    if (Option.isNone(membershipOption)) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: "You are not a member of this organization",
          resource: Option.some("Organization"),
          action: Option.none()
        })
      )
    }

    const membership = membershipOption.value

    // Check membership is active
    if (!membership.isActive()) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: `Your membership is ${membership.status}. Contact an administrator.`,
          resource: Option.some("Organization"),
          action: Option.none()
        })
      )
    }

    return membership
  })

/**
 * withOrganizationContext - Load membership and provide it as context for an effect
 *
 * This is the main helper function for handlers. It:
 * 1. Loads the organization membership for the current user
 * 2. Validates the membership is active
 * 3. Provides CurrentOrganizationMembership context to the wrapped effect
 *
 * @param organizationId - The organization ID
 * @param effect - The effect to run with organization context
 * @returns Effect with CurrentOrganizationMembership provided
 *
 * @example
 * ```typescript
 * .handle("myEndpoint", ({ path }) =>
 *   Effect.gen(function* () {
 *     const orgId = yield* validateOrganizationId(path.orgId)
 *
 *     return yield* withOrganizationContext(orgId,
 *       Effect.gen(function* () {
 *         // CurrentOrganizationMembership is now available
 *         const membership = yield* getCurrentOrganizationMembership()
 *         // ...
 *       })
 *     )
 *   })
 * )
 * ```
 */
export const withOrganizationContext = <A, E, R>(
  organizationId: OrganizationId,
  effect: Effect.Effect<A, E, R | CurrentOrganizationMembership>
): Effect.Effect<
  A,
  E | OrganizationContextError,
  Exclude<R, CurrentOrganizationMembership> | CurrentUser | OrganizationMemberRepository
> =>
  Effect.gen(function* () {
    const membership = yield* loadOrganizationMembership(organizationId)
    return yield* withOrganizationMembership(membership)(effect)
  })

/**
 * requireOrganizationContext - Validate org ID and provide membership context
 *
 * Convenience function that combines validateOrganizationId and withOrganizationContext.
 * Use this in handlers when you have the raw string org ID from the path.
 *
 * @param orgIdString - The raw organization ID string from path parameter
 * @param effect - The effect to run with organization context
 * @returns Effect with CurrentOrganizationMembership provided
 *
 * @example
 * ```typescript
 * .handle("myEndpoint", ({ path }) =>
 *   requireOrganizationContext(path.orgId,
 *     Effect.gen(function* () {
 *       const membership = yield* getCurrentOrganizationMembership()
 *       // ...
 *     })
 *   )
 * )
 * ```
 */
export const requireOrganizationContext = <A, E, R>(
  orgIdString: string,
  effect: Effect.Effect<A, E, R | CurrentOrganizationMembership>
): Effect.Effect<
  A,
  E | OrganizationContextError,
  Exclude<R, CurrentOrganizationMembership> | CurrentUser | OrganizationMemberRepository
> =>
  Effect.gen(function* () {
    const organizationId = yield* validateOrganizationId(orgIdString)
    return yield* withOrganizationContext(organizationId, effect)
  })

/**
 * requireAdminOrOwner - Require the current user to be an admin or owner
 *
 * Use after requireOrganizationContext to verify the user has admin privileges.
 *
 * @returns Effect that fails with ForbiddenError if user is not admin/owner
 *
 * Requires: CurrentOrganizationMembership
 */
export const requireAdminOrOwner = Effect.gen(function* () {
  const membership = yield* CurrentOrganizationMembership

  if (!membership.isAdmin()) {
    return yield* Effect.fail(
      new ForbiddenError({
        message: "This action requires admin privileges",
        resource: Option.none(),
        action: Option.none()
      })
    )
  }

  return membership
})

/**
 * requireOwner - Require the current user to be the organization owner
 *
 * Use after requireOrganizationContext to verify the user is the owner.
 *
 * @returns Effect that fails with ForbiddenError if user is not owner
 *
 * Requires: CurrentOrganizationMembership
 */
export const requireOwner = Effect.gen(function* () {
  const membership = yield* CurrentOrganizationMembership

  if (!membership.isOwner()) {
    return yield* Effect.fail(
      new ForbiddenError({
        message: "This action requires owner privileges",
        resource: Option.none(),
        action: Option.none()
      })
    )
  }

  return membership
})

/**
 * requireFunctionalRole - Require the current user to have a specific functional role
 *
 * Use after requireOrganizationContext to verify the user has a functional role.
 *
 * @param role - The functional role to require
 * @returns Effect that fails with ForbiddenError if user doesn't have the role
 *
 * Requires: CurrentOrganizationMembership
 */
export const requireFunctionalRole = (
  role:
    | "controller"
    | "finance_manager"
    | "accountant"
    | "period_admin"
    | "consolidation_manager"
) =>
  Effect.gen(function* () {
    const membership = yield* CurrentOrganizationMembership

    // Admins and owners bypass functional role requirements
    if (membership.isAdmin()) {
      return membership
    }

    if (!membership.hasFunctionalRole(role)) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: `This action requires the ${role.replace("_", " ")} role`,
          resource: Option.none(),
          action: Option.none()
        })
      )
    }

    return membership
  })
