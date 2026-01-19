/**
 * CurrentOrganizationMembership - Context for the current user's organization membership
 *
 * Provides a Context.Tag for accessing the current user's membership in the
 * organization they are operating within. This allows request handlers and
 * business logic to access membership details (role, functional roles, etc.)
 * without threading it through every function.
 *
 * Usage:
 * - Set via middleware after loading membership for the organization context
 * - Access via getCurrentOrganizationMembership() helper in business logic
 *
 * @module membership/CurrentOrganizationMembership
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type { OrganizationMembership } from "./OrganizationMembership.ts"

// =============================================================================
// CurrentOrganizationMembership Context
// =============================================================================

/**
 * CurrentOrganizationMembership - Context.Tag for the current organization membership
 *
 * This tag holds the OrganizationMembership for the current user in the
 * organization context of the current request. It's typically set by
 * organization context middleware after validating membership.
 *
 * Usage:
 * ```typescript
 * // In middleware, after loading membership:
 * const membership = yield* memberRepo.findByUserAndOrganization(user.id, orgId)
 * yield* Effect.provideService(CurrentOrganizationMembership, membership)(nextHandler)
 *
 * // In business logic:
 * const program = Effect.gen(function* () {
 *   const membership = yield* getCurrentOrganizationMembership()
 *   console.log(`User role: ${membership.role}`)
 *   if (membership.isAccountant) {
 *     // User has accountant functional role
 *   }
 * })
 * ```
 */
export class CurrentOrganizationMembership extends Context.Tag("CurrentOrganizationMembership")<
  CurrentOrganizationMembership,
  OrganizationMembership
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * getCurrentOrganizationMembership - Get the current organization membership from context
 *
 * Convenience helper that retrieves the current membership from the
 * CurrentOrganizationMembership context. This is equivalent to
 * `yield* CurrentOrganizationMembership` but provides a more semantic API.
 *
 * @returns Effect requiring CurrentOrganizationMembership context and returning the membership
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const membership = yield* getCurrentOrganizationMembership()
 *   console.log(`Role: ${membership.role}`)
 *   if (membership.isOwner()) {
 *     console.log("User is the organization owner")
 *   }
 *   return membership.organizationId
 * })
 *
 * // The program requires CurrentOrganizationMembership to be provided:
 * // program: Effect<OrganizationId, never, CurrentOrganizationMembership>
 * ```
 */
export const getCurrentOrganizationMembership = (): Effect.Effect<
  OrganizationMembership,
  never,
  CurrentOrganizationMembership
> => CurrentOrganizationMembership

/**
 * withOrganizationMembership - Run an effect with a specific membership in context
 *
 * Provides the CurrentOrganizationMembership context with the specified
 * membership, allowing business logic that requires organization context to run.
 *
 * @param membership - The OrganizationMembership to set as current
 * @returns A function that provides CurrentOrganizationMembership to an effect
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const membership = yield* getCurrentOrganizationMembership()
 *   return `Role: ${membership.role}`
 * })
 *
 * // Provide the membership context
 * const result = yield* program.pipe(withOrganizationMembership(userMembership))
 * ```
 */
export const withOrganizationMembership = (membership: OrganizationMembership) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R | CurrentOrganizationMembership>
  ): Effect.Effect<A, E, Exclude<R, CurrentOrganizationMembership>> =>
    Effect.provideService(effect, CurrentOrganizationMembership, membership)

/**
 * getCurrentOrganizationId - Get the current organization ID from context
 *
 * Convenience helper that retrieves the organization ID from the current
 * membership context. Useful when you only need the org ID.
 *
 * @returns Effect requiring CurrentOrganizationMembership context and returning the organization ID
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const orgId = yield* getCurrentOrganizationId()
 *   const companies = yield* companyRepo.findByOrganization(orgId)
 *   return companies
 * })
 * ```
 */
export const getCurrentOrganizationId = () =>
  Effect.map(getCurrentOrganizationMembership(), (m) => m.organizationId)

/**
 * getCurrentUserRole - Get the current user's role from context
 *
 * Convenience helper that retrieves the base role from the current
 * membership context.
 *
 * @returns Effect requiring CurrentOrganizationMembership context and returning the base role
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const role = yield* getCurrentUserRole()
 *   if (role === "owner" || role === "admin") {
 *     // User has admin privileges
 *   }
 * })
 * ```
 */
export const getCurrentUserRole = () =>
  Effect.map(getCurrentOrganizationMembership(), (m) => m.role)
