/**
 * AuditLogApiLive - Live implementation of audit log API handlers
 *
 * Implements the AuditLogApi endpoints by querying the AuditLogRepository.
 * Returns paginated audit trail entries for compliance and SOX requirements.
 *
 * @module AuditLogApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { AuditLogRepository } from "@accountability/persistence/Services/AuditLogRepository"
import type { PersistenceError } from "@accountability/persistence/Errors/RepositoryError"
import type { AuditDataCorruptionError } from "@accountability/core/audit/AuditLogErrors"
import { AppApi } from "../Definitions/AppApi.ts"
import { AuditLogEntry, AuditLogListResponse } from "../Definitions/AuditLogApi.ts"
import { InternalServerError } from "../Definitions/ApiErrors.ts"

/**
 * Map persistence errors and audit data corruption errors to InternalServerError
 */
const mapAuditLogError = (error: PersistenceError | AuditDataCorruptionError): InternalServerError => {
  if (error._tag === "AuditDataCorruptionError") {
    return new InternalServerError({
      message: `Audit data corruption: ${error.message}`,
      requestId: Option.none()
    })
  }
  return new InternalServerError({
    message: `Database error: ${error.operation}`,
    requestId: Option.none()
  })
}

/**
 * AuditLogApiLive - Layer providing AuditLogApi handlers
 *
 * Requires AuditLogRepository in context.
 */
export const AuditLogApiLive = HttpApiBuilder.group(AppApi, "auditLog", (handlers) =>
  Effect.gen(function* () {
    const auditLogRepo = yield* AuditLogRepository

    return handlers
      .handle("listAuditLog", (_) =>
        Effect.gen(function* () {
          const { path, urlParams } = _

          // Build filter from query parameters with organization scoping
          const filter = {
            organizationId: path.organizationId,
            entityType: Option.fromNullable(urlParams.entityType),
            entityId: Option.fromNullable(urlParams.entityId),
            userId: Option.fromNullable(urlParams.userId),
            action: Option.fromNullable(urlParams.action),
            fromDate: Option.fromNullable(urlParams.fromDate),
            toDate: Option.fromNullable(urlParams.toDate),
            search: Option.fromNullable(urlParams.search)
          }

          // Pagination with defaults
          const pagination = {
            limit: urlParams.limit ?? 50,
            offset: urlParams.offset ?? 0
          }

          // Query repository with error mapping
          const [entriesChunk, total] = yield* Effect.all([
            auditLogRepo.findAll(filter, pagination).pipe(
              Effect.mapError(mapAuditLogError)
            ),
            auditLogRepo.count(filter).pipe(
              Effect.mapError(mapAuditLogError)
            )
          ])

          // Convert repository entries to API response format
          const entries = Array.from(entriesChunk).map((entry) =>
            AuditLogEntry.make({
              id: entry.id,
              entityType: entry.entityType,
              entityId: entry.entityId,
              entityName: entry.entityName,
              action: entry.action,
              userId: entry.userId,
              userDisplayName: entry.userDisplayName,
              userEmail: entry.userEmail,
              timestamp: entry.timestamp,
              changes: entry.changes
            })
          )

          return AuditLogListResponse.make({ entries, total })
        })
      )
  })
)
