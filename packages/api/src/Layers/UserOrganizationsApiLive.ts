/**
 * UserOrganizationsApiLive - Live implementation of user organizations API handlers
 *
 * Implements the UserOrganizationsApi endpoints to list organizations
 * a user belongs to with their roles and effective permissions.
 *
 * @module UserOrganizationsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { FunctionalRole } from "@accountability/core/authorization/FunctionalRole"
import {
  computeEffectivePermissions,
  permissionSetToArray
} from "@accountability/core/authorization/PermissionMatrix"
import { OrganizationMemberRepository } from "@accountability/persistence/Services/OrganizationMemberRepository"
import { OrganizationRepository } from "@accountability/persistence/Services/OrganizationRepository"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  UserOrganizationInfo,
  UserOrganizationsResponse
} from "../Definitions/UserOrganizationsApi.ts"

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * UserOrganizationsApiLive - Layer providing UserOrganizationsApi handlers
 *
 * Requires:
 * - OrganizationMemberRepository
 * - OrganizationRepository
 */
export const UserOrganizationsApiLive = HttpApiBuilder.group(AppApi, "userOrganizations", (handlers) =>
  Effect.gen(function* () {
    const memberRepository = yield* OrganizationMemberRepository
    const organizationRepository = yield* OrganizationRepository

    return handlers
      // =======================================================================
      // List User's Organizations
      // =======================================================================
      .handle("listUserOrganizations", () =>
        Effect.gen(function* () {
          const currentUserInfo = yield* CurrentUser
          const userId = AuthUserId.make(currentUserInfo.userId)

          // Get all active memberships for this user
          const memberships = yield* memberRepository.findActiveByUser(userId).pipe(
            Effect.orDie
          )

          // Build response with organization details and effective permissions
          const organizations: UserOrganizationInfo[] = []

          for (const membership of memberships) {
            // Get organization details
            const orgOption = yield* organizationRepository.findById(membership.organizationId).pipe(
              Effect.orDie
            )

            if (Option.isNone(orgOption)) {
              continue // Skip if org not found
            }

            const org = orgOption.value

            // Compute functional roles array from membership flags
            const functionalRoles: FunctionalRole[] = []
            if (membership.isController) functionalRoles.push("controller")
            if (membership.isFinanceManager) functionalRoles.push("finance_manager")
            if (membership.isAccountant) functionalRoles.push("accountant")
            if (membership.isPeriodAdmin) functionalRoles.push("period_admin")
            if (membership.isConsolidationManager) functionalRoles.push("consolidation_manager")

            // Compute effective permissions
            const permissions = computeEffectivePermissions(membership.role, functionalRoles)
            const effectivePermissions = permissionSetToArray(permissions)

            organizations.push(
              UserOrganizationInfo.make({
                id: org.id,
                name: org.name,
                role: membership.role,
                functionalRoles,
                effectivePermissions: [...effectivePermissions]
              })
            )
          }

          return UserOrganizationsResponse.make({ organizations })
        })
      )
  })
)
