/**
 * AuthorizationAuditApiLive - Live implementation of authorization audit API handlers
 *
 * Implements the AuthorizationAuditApi endpoints by querying the AuthorizationAuditRepository.
 * Returns paginated denial entries for security audit and compliance.
 *
 * @module AuthorizationAuditApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { AuthorizationAuditRepository, type QueryAuditLogOptions } from "@accountability/persistence/Services/AuthorizationAuditRepository"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  AuthorizationDenialEntryResponse,
  AuthorizationDenialListResponse
} from "../Definitions/AuthorizationAuditApi.ts"
import { ForbiddenError } from "../Definitions/ApiErrors.ts"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"

/**
 * AuthorizationAuditApiLive - Layer providing AuthorizationAuditApi handlers
 *
 * Requires:
 * - AuthorizationAuditRepository
 * - UserRepository
 * - OrganizationMemberRepository (via requireOrganizationContext)
 * - AuthorizationService (via requirePermission)
 */
export const AuthorizationAuditApiLive = HttpApiBuilder.group(AppApi, "authorizationAudit", (handlers) =>
  Effect.gen(function* () {
    const auditRepo = yield* AuthorizationAuditRepository
    const userRepo = yield* UserRepository

    return handlers.handle("listAuthorizationDenials", (_) =>
      requireOrganizationContext(_.path.orgId,
        Effect.gen(function* () {
          // Check permission - only admins/owners should view denial logs
          yield* requirePermission("audit_log:read")

          const { urlParams } = _
          const orgId = OrganizationId.make(_.path.orgId)

          // Build query options from URL params
          // Use spread to only include defined properties (exactOptionalPropertyTypes-safe)
          const queryOptions: QueryAuditLogOptions = {
            limit: urlParams.limit ?? 50,
            offset: urlParams.offset ?? 0,
            ...(urlParams.fromDate !== undefined ? { startDate: Timestamp.fromDateTime(urlParams.fromDate) } : {}),
            ...(urlParams.toDate !== undefined ? { endDate: Timestamp.fromDateTime(urlParams.toDate) } : {}),
            ...(urlParams.resourceType !== undefined ? { resourceType: urlParams.resourceType } : {})
            // Note: action filter not passed because URL param is string but repository expects Action type
          }

          // Query denial entries with count
          const [entries, total] = yield* Effect.all([
            auditRepo.findByOrganization(orgId, queryOptions).pipe(
              Effect.mapError((error) => new ForbiddenError({
                message: `Failed to query authorization audit log: ${error.operation}`,
                resource: Option.none(),
                action: Option.none()
              }))
            ),
            auditRepo.countByOrganization(orgId, queryOptions).pipe(
              Effect.mapError((error) => new ForbiddenError({
                message: `Failed to count authorization audit log: ${error.operation}`,
                resource: Option.none(),
                action: Option.none()
              }))
            )
          ])

          // Decode userId if provided and filter
          let filteredEntries = Array.from(entries)
          if (urlParams.userId !== undefined) {
            const userId = AuthUserId.make(urlParams.userId)
            filteredEntries = filteredEntries.filter((e) => e.userId === userId)
          }

          // Look up user details for each entry
          const entriesWithUserDetails = yield* Effect.all(
            filteredEntries.map((entry) =>
              Effect.gen(function* () {
                const userOption = yield* userRepo.findById(entry.userId).pipe(
                  Effect.orDie
                )

                const userEmail = Option.isSome(userOption) ? Option.some(userOption.value.email) : Option.none<string>()
                // displayName is a string, wrap in Option.some
                const userDisplayName = Option.isSome(userOption) ? Option.some(userOption.value.displayName) : Option.none<string>()

                return AuthorizationDenialEntryResponse.make({
                  id: entry.id,
                  userId: entry.userId,
                  userEmail,
                  userDisplayName,
                  action: entry.action,
                  resourceType: entry.resourceType,
                  resourceId: entry.resourceId,
                  denialReason: entry.denialReason,
                  matchedPolicyIds: entry.matchedPolicyIds,
                  ipAddress: entry.ipAddress,
                  userAgent: entry.userAgent,
                  createdAt: entry.createdAt
                })
              })
            )
          )

          // Adjust total for userId filter
          const adjustedTotal = urlParams.userId !== undefined
            ? entriesWithUserDetails.length
            : total

          return AuthorizationDenialListResponse.make({
            entries: entriesWithUserDetails,
            total: adjustedTotal
          })
        })
      )
    )
  })
)
