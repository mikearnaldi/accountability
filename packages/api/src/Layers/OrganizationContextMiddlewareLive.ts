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
 * ## Grace Period Mode
 *
 * When `AUTHORIZATION_ENFORCEMENT=false`, the middleware operates in "grace period"
 * mode which allows all authenticated users to access any organization without
 * membership checks. This is useful during migration while membership records
 * are being populated. Set to `true` (default) for strict enforcement.
 *
 * @module OrganizationContextMiddlewareLive
 */

import { HttpServerRequest } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { OrganizationId } from "@accountability/core/organization/Organization"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"
import { withCurrentUserId } from "@accountability/core/shared/context/CurrentUserId"
import { OrganizationMemberRepository } from "@accountability/persistence/Services/OrganizationMemberRepository"
import {
  CurrentOrganizationMembership,
  withOrganizationMembership
} from "@accountability/core/membership/CurrentOrganizationMembership"
import {
  CurrentEnvironmentContext,
  createEnvironmentContextFromRequest,
  type EnvironmentContextWithMeta
} from "@accountability/core/authorization/CurrentEnvironmentContext"
import { OrganizationMembership } from "@accountability/core/membership/OrganizationMembership"
import { OrganizationMembershipId } from "@accountability/core/membership/OrganizationMembershipId"
import { AuthorizationService } from "@accountability/core/authorization/AuthorizationService"
import { AuthorizationConfig } from "@accountability/core/authorization/AuthorizationConfig"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import type { Action } from "@accountability/core/authorization/Action"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { ForbiddenError } from "../Definitions/ApiErrors.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import type { ResourceContext } from "@accountability/core/authorization/matchers/ResourceMatcher"
import { isPermissionDeniedError } from "@accountability/core/authorization/AuthorizationErrors"

// Re-export CurrentUserId for convenience
export { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"

// =============================================================================
// Types
// =============================================================================

/**
 * OrganizationContextError - Errors that can occur during organization context loading
 */
export type OrganizationContextError = ForbiddenError | OrganizationNotFoundError

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * validateOrganizationId - Decode and validate organization ID from string
 *
 * @param orgIdString - The raw organization ID string from path parameter
 * @returns Effect that decodes to OrganizationId or fails with OrganizationNotFoundError
 */
export const validateOrganizationId = (orgIdString: string) =>
  Schema.decodeUnknown(OrganizationId)(orgIdString).pipe(
    Effect.mapError(() =>
      new OrganizationNotFoundError({
        organizationId: orgIdString
      })
    )
  )

/**
 * Nil UUID for synthetic grace period memberships
 * Pre-decoded for efficiency (decodeSync validates the format once at module load)
 */
const GRACE_PERIOD_MEMBERSHIP_ID = Schema.decodeSync(OrganizationMembershipId)(
  "00000000-0000-0000-0000-000000000000"
)

/**
 * createGracePeriodMembership - Create a synthetic membership for grace period mode
 *
 * During the grace period (AUTHORIZATION_ENFORCEMENT=false), authenticated users
 * without membership records are granted temporary admin access. This allows
 * continued access while membership records are being migrated.
 *
 * @param userId - The authenticated user's ID
 * @param organizationId - The organization being accessed
 * @returns A synthetic OrganizationMembership with admin role
 */
const createGracePeriodMembership = (
  userId: AuthUserId,
  organizationId: OrganizationId
): OrganizationMembership => {
  const timestamp = Timestamp.now()
  return OrganizationMembership.make({
    // Use the pre-decoded nil UUID for synthetic grace period memberships
    id: GRACE_PERIOD_MEMBERSHIP_ID,
    userId,
    organizationId,
    // Grant admin role during grace period for full access
    role: "admin",
    // Enable all functional roles during grace period
    isController: true,
    isFinanceManager: true,
    isAccountant: true,
    isPeriodAdmin: true,
    isConsolidationManager: true,
    status: "active",
    removedAt: Option.none(),
    removedBy: Option.none(),
    removalReason: Option.none(),
    reinstatedAt: Option.none(),
    reinstatedBy: Option.none(),
    createdAt: timestamp,
    updatedAt: timestamp,
    invitedBy: Option.none()
  })
}

/**
 * loadOrganizationMembership - Load and validate the current user's membership
 *
 * Loads the membership for the current authenticated user in the specified
 * organization. Validates that:
 * - The user is authenticated (via CurrentUser context)
 * - The user is a member of the organization
 * - The membership is active
 *
 * ## Grace Period Mode
 *
 * When `AUTHORIZATION_ENFORCEMENT=false`, membership checks are skipped and
 * a synthetic admin membership is returned for all authenticated users.
 * This is useful during migration while membership records are populated.
 *
 * @param organizationId - The organization ID to load membership for
 * @returns Effect containing the membership or failing with ForbiddenError
 *
 * Requires: CurrentUser, OrganizationMemberRepository, AuthorizationConfig
 */
export const loadOrganizationMembership = (organizationId: OrganizationId) =>
  Effect.gen(function* () {
    // Get current authenticated user
    const currentUser = yield* CurrentUser
    // currentUser.userId is already typed as AuthUserId (validated at auth middleware)

    // Check authorization config for enforcement mode
    // AuthorizationConfig is a required dependency that must be provided via layer composition
    const config = yield* AuthorizationConfig
    const enforcementEnabled = config.enforcementEnabled

    // Load membership from repository
    const memberRepo = yield* OrganizationMemberRepository
    const membershipOption = yield* memberRepo.findByUserAndOrganization(
      currentUser.userId,
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

    // If membership exists, use it
    if (Option.isSome(membershipOption)) {
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
    }

    // Membership not found - check enforcement mode
    if (!enforcementEnabled) {
      // Grace period: create synthetic membership with admin access
      return createGracePeriodMembership(currentUser.userId, organizationId)
    }

    // Strict enforcement: deny access
    return yield* Effect.fail(
      new ForbiddenError({
        message: "You are not a member of this organization",
        resource: Option.some("Organization"),
        action: Option.none()
      })
    )
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
  effect: Effect.Effect<A, E, R | CurrentOrganizationMembership | CurrentUserId | CurrentEnvironmentContext>
): Effect.Effect<
  A,
  E | OrganizationContextError,
  Exclude<Exclude<Exclude<R, CurrentOrganizationMembership>, CurrentUserId>, CurrentEnvironmentContext> | CurrentUser | OrganizationMemberRepository | AuthorizationConfig
> =>
  Effect.gen(function* () {
    const membership = yield* loadOrganizationMembership(organizationId)
    // Provide CurrentOrganizationMembership, CurrentUserId (for audit logging),
    // and CurrentEnvironmentContext (for ABAC policy evaluation)
    const withMembership = withOrganizationMembership(membership)(effect)
    const withUserId = withCurrentUserId(membership.userId)(withMembership)
    // Provide default environment context (no IP/user-agent, just time)
    // HTTP handlers can use withEnvironmentContext to provide full context
    const envContext = createEnvironmentContextFromRequest(undefined, undefined)
    return yield* Effect.provideService(withUserId, CurrentEnvironmentContext, envContext)
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
  effect: Effect.Effect<A, E, R | CurrentOrganizationMembership | CurrentUserId | CurrentEnvironmentContext>
): Effect.Effect<
  A,
  E | OrganizationContextError,
  Exclude<Exclude<Exclude<R, CurrentOrganizationMembership>, CurrentUserId>, CurrentEnvironmentContext> | CurrentUser | OrganizationMemberRepository | AuthorizationConfig
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

/**
 * requirePermission - Require the current user to have permission for an action
 *
 * Uses the AuthorizationService to check if the user has permission based on
 * their role and functional roles. This enables fine-grained RBAC permission
 * checking.
 *
 * @param action - The action to check permission for
 * @returns Effect that fails with ForbiddenError if user doesn't have permission
 *
 * Requires: CurrentOrganizationMembership, AuthorizationService
 *
 * @example
 * ```typescript
 * .handle("createAccount", ({ payload }) =>
 *   requireOrganizationContext(payload.organizationId,
 *     Effect.gen(function* () {
 *       yield* requirePermission("account:create")
 *       // User has permission, proceed with creation
 *       const account = yield* accountRepo.create(...)
 *       return account
 *     })
 *   )
 * )
 * ```
 */
export const requirePermission = (action: Action) =>
  Effect.gen(function* () {
    const authService = yield* AuthorizationService

    yield* authService.checkPermission(action).pipe(
      Effect.mapError((error) => {
        // Handle different error types from authorization
        if (isPermissionDeniedError(error)) {
          return new ForbiddenError({
            message: error.reason,
            resource: Option.fromNullable(error.resourceType),
            action: Option.some(action)
          })
        }
        // PolicyLoadError or AuthorizationAuditError - internal system failure
        return new ForbiddenError({
          message: error.message,
          resource: Option.none(),
          action: Option.some(action)
        })
      })
    )
  })

/**
 * requirePermissionWithResource - Require permission with resource context for ABAC evaluation
 *
 * Like requirePermission, but also passes a ResourceContext to the authorization
 * service. This enables ABAC policies that evaluate resource attributes like
 * periodStatus, entryType, or accountType.
 *
 * Use this for operations where the policy may vary based on the resource's state,
 * such as the "Locked Period Protection" policy that denies journal entry
 * modifications in locked fiscal periods.
 *
 * @param action - The action to check permission for
 * @param resourceContext - The resource context with attributes for ABAC evaluation
 * @returns Effect that fails with ForbiddenError if user doesn't have permission
 *
 * Requires: CurrentOrganizationMembership, AuthorizationService
 *
 * @example
 * ```typescript
 * // Journal entry creation with period status check
 * .handle("createJournalEntry", ({ payload }) =>
 *   requireOrganizationContext(payload.organizationId,
 *     Effect.gen(function* () {
 *       // Get the period status for the transaction date
 *       const periodStatus = yield* fiscalPeriodService.getPeriodStatusForDate(
 *         companyId,
 *         payload.transactionDate
 *       )
 *
 *       // Check permission with period status context
 *       yield* requirePermissionWithResource("journal_entry:create", {
 *         type: "journal_entry",
 *         periodStatus: Option.getOrUndefined(periodStatus)
 *       })
 *
 *       // If we get here, the period is open and user has permission
 *       const entry = yield* entryRepo.create(...)
 *       return entry
 *     })
 *   )
 * )
 * ```
 */
export const requirePermissionWithResource = (action: Action, resourceContext: ResourceContext) =>
  Effect.gen(function* () {
    const authService = yield* AuthorizationService

    yield* authService.checkPermission(action, resourceContext).pipe(
      Effect.mapError((error) => {
        // Handle different error types from authorization
        if (isPermissionDeniedError(error)) {
          return new ForbiddenError({
            message: error.reason,
            resource: Option.fromNullable(error.resourceType),
            action: Option.some(action)
          })
        }
        // PolicyLoadError or AuthorizationAuditError - internal system failure
        return new ForbiddenError({
          message: error.message,
          resource: Option.none(),
          action: Option.some(action)
        })
      })
    )
  })

// =============================================================================
// Environment Context Helpers
// =============================================================================

/**
 * getClientIP - Extract the client IP address from the request
 *
 * Checks for common proxy headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP)
 * before falling back to the socket remote address.
 *
 * @param request - The HTTP server request
 * @returns The client IP address if available
 */
export const getClientIP = (request: HttpServerRequest.HttpServerRequest): string | undefined => {
  // Check X-Forwarded-For header (standard proxy header)
  const xForwardedFor = request.headers["x-forwarded-for"]
  if (xForwardedFor !== undefined) {
    // X-Forwarded-For can contain multiple IPs, take the first (client) one
    const firstIP = xForwardedFor.split(",")[0]?.trim()
    if (firstIP) {
      return firstIP
    }
  }

  // Check X-Real-IP header (nginx default)
  const xRealIP = request.headers["x-real-ip"]
  if (xRealIP !== undefined) {
    return xRealIP.trim()
  }

  // Check CF-Connecting-IP header (Cloudflare)
  const cfConnectingIP = request.headers["cf-connecting-ip"]
  if (cfConnectingIP !== undefined) {
    return cfConnectingIP.trim()
  }

  // Fall back to socket remote address
  return Option.getOrUndefined(request.remoteAddress)
}

/**
 * captureEnvironmentContext - Capture environment context from the HTTP request
 *
 * Extracts:
 * - IP address (from proxy headers or socket)
 * - User-Agent header
 * - Current time
 * - Current day of week
 *
 * @returns Effect that yields the environment context
 *
 * Requires: HttpServerRequest
 */
export const captureEnvironmentContext: Effect.Effect<
  EnvironmentContextWithMeta,
  never,
  HttpServerRequest.HttpServerRequest
> = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest

  // Extract IP address
  const ipAddress = getClientIP(request)

  // Extract User-Agent header
  const userAgent = request.headers["user-agent"]

  // Create environment context with current time
  return createEnvironmentContextFromRequest(ipAddress, userAgent)
})

/**
 * withEnvironmentContext - Provide environment context for an effect
 *
 * Captures environment context from the HTTP request and provides it
 * to the wrapped effect. This enables environment-based policy evaluation
 * (time restrictions, IP restrictions, etc.).
 *
 * @param effect - The effect to run with environment context
 * @returns Effect with CurrentEnvironmentContext provided
 *
 * Requires: HttpServerRequest
 *
 * @example
 * ```typescript
 * .handle("myEndpoint", ({ path }) =>
 *   withEnvironmentContext(
 *     requireOrganizationContext(path.orgId,
 *       Effect.gen(function* () {
 *         // CurrentEnvironmentContext is available for policy evaluation
 *         yield* requirePermission("account:create")
 *         // ...
 *       })
 *     )
 *   )
 * )
 * ```
 */
export const withEnvironmentContext = <A, E, R>(
  effect: Effect.Effect<A, E, R | CurrentEnvironmentContext>
): Effect.Effect<
  A,
  E,
  Exclude<R, CurrentEnvironmentContext> | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const envContext = yield* captureEnvironmentContext
    return yield* Effect.provideService(effect, CurrentEnvironmentContext, envContext)
  })

/**
 * requireOrganizationContextWithEnv - Validate org ID and provide membership + environment context
 *
 * Convenience function that combines requireOrganizationContext and withEnvironmentContext.
 * Use this in handlers when you need both organization membership and environment context
 * for ABAC policy evaluation.
 *
 * @param orgIdString - The raw organization ID string from path parameter
 * @param effect - The effect to run with organization and environment context
 * @returns Effect with CurrentOrganizationMembership and CurrentEnvironmentContext provided
 *
 * @example
 * ```typescript
 * .handle("myEndpoint", ({ path }) =>
 *   requireOrganizationContextWithEnv(path.orgId,
 *     Effect.gen(function* () {
 *       // Both CurrentOrganizationMembership and CurrentEnvironmentContext available
 *       yield* requirePermission("account:create")
 *       // ...
 *     })
 *   )
 * )
 * ```
 */
// Note: For combined organization + environment context, compose the helpers:
//
// withEnvironmentContext(
//   requireOrganizationContext(path.orgId,
//     Effect.gen(function* () {
//       // Both CurrentOrganizationMembership and CurrentEnvironmentContext available
//       yield* requirePermission("account:create")
//     })
//   )
// )
//
// The environment context will be available in AuthorizationServiceLive.checkPermission
// for ABAC policy evaluation with time/IP-based conditions.
