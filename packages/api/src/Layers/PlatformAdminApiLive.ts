/**
 * PlatformAdminApiLive - Live implementation of platform admin API handlers
 *
 * Implements the PlatformAdminApi endpoints to list platform administrators.
 * Only platform administrators can access this endpoint.
 *
 * @module PlatformAdminApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { ForbiddenError } from "../Definitions/ApiErrors.ts"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  PlatformAdminInfo,
  PlatformAdminsResponse
} from "../Definitions/PlatformAdminApi.ts"

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * PlatformAdminApiLive - Layer providing PlatformAdminApi handlers
 *
 * Requires:
 * - UserRepository
 */
export const PlatformAdminApiLive = HttpApiBuilder.group(AppApi, "platformAdmins", (handlers) =>
  Effect.gen(function* () {
    const userRepository = yield* UserRepository

    return handlers
      // =======================================================================
      // List Platform Administrators
      // =======================================================================
      .handle("listPlatformAdmins", () =>
        Effect.gen(function* () {
          const currentUserInfo = yield* CurrentUser
          const userId = AuthUserId.make(currentUserInfo.userId)

          // Check if current user is a platform admin
          const isCurrentUserAdmin = yield* userRepository.isPlatformAdmin(userId).pipe(
            Effect.orDie
          )

          if (!isCurrentUserAdmin) {
            return yield* Effect.fail(
              new ForbiddenError({
                message: "Only platform administrators can view this list",
                resource: Option.some("platform-admins"),
                action: Option.some("list")
              })
            )
          }

          // Get all platform admins
          const platformAdmins = yield* userRepository.findPlatformAdmins().pipe(
            Effect.orDie
          )

          // Map to response format
          const admins = platformAdmins.map((user) =>
            PlatformAdminInfo.make({
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              createdAt: DateTime.unsafeMake(user.createdAt.epochMillis)
            })
          )

          return PlatformAdminsResponse.make({
            admins,
            count: admins.length
          })
        })
      )
  })
)
