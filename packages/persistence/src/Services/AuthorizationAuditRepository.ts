/**
 * AuthorizationAuditRepository - Repository interface for authorization audit log persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * Only denied access attempts are logged per the design decision.
 *
 * @module AuthorizationAuditRepository
 */

import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import type * as Effect from "effect/Effect"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { Action } from "@accountability/core/authorization/Action"
import type { PolicyId } from "@accountability/core/authorization/PolicyId"
import type { Timestamp } from "@accountability/core/shared/values/Timestamp"
import type { PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * Input for creating a denial audit log entry
 */
export interface LogDenialInput {
  readonly userId: AuthUserId
  readonly organizationId: OrganizationId
  readonly action: Action
  readonly resourceType: string
  readonly resourceId?: string
  readonly denialReason: string
  readonly matchedPolicyIds?: readonly PolicyId[]
  readonly ipAddress?: string
  readonly userAgent?: string
}

/**
 * A denial audit log entry
 */
export class AuthorizationDenialEntry extends Schema.Class<AuthorizationDenialEntry>(
  "AuthorizationDenialEntry"
)({
  id: Schema.UUID.pipe(Schema.brand("AuthorizationAuditId")),
  userId: Schema.UUID.pipe(Schema.brand("AuthUserId")),
  organizationId: Schema.UUID.pipe(Schema.brand("OrganizationId")),
  action: Schema.String,
  resourceType: Schema.String,
  resourceId: Schema.OptionFromNullOr(Schema.UUID),
  denialReason: Schema.String,
  matchedPolicyIds: Schema.Array(Schema.UUID.pipe(Schema.brand("PolicyId"))),
  ipAddress: Schema.OptionFromNullOr(Schema.String),
  userAgent: Schema.OptionFromNullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromSelf
}) {}

/**
 * Options for querying audit log entries
 */
export interface QueryAuditLogOptions {
  readonly limit?: number
  readonly offset?: number
  readonly startDate?: Timestamp
  readonly endDate?: Timestamp
  readonly action?: Action
  readonly resourceType?: string
}

/**
 * AuthorizationAuditRepository - Service interface for authorization audit log persistence
 *
 * Provides operations for logging and querying denied access attempts.
 */
export interface AuthorizationAuditRepositoryService {
  /**
   * Log a denial entry
   *
   * @param entry - The denial details to log
   * @returns Effect containing void
   */
  readonly logDenial: (entry: LogDenialInput) => Effect.Effect<void, PersistenceError>

  /**
   * Find denial entries by organization
   *
   * @param organizationId - The organization ID
   * @param options - Query options (pagination, date range, filters)
   * @returns Effect containing array of denial entries
   */
  readonly findByOrganization: (
    organizationId: OrganizationId,
    options?: QueryAuditLogOptions
  ) => Effect.Effect<ReadonlyArray<AuthorizationDenialEntry>, PersistenceError>

  /**
   * Find denial entries by user
   *
   * @param userId - The user ID
   * @param options - Query options (pagination, date range, filters)
   * @returns Effect containing array of denial entries
   */
  readonly findByUser: (
    userId: AuthUserId,
    options?: QueryAuditLogOptions
  ) => Effect.Effect<ReadonlyArray<AuthorizationDenialEntry>, PersistenceError>

  /**
   * Count denial entries by organization
   *
   * @param organizationId - The organization ID
   * @param options - Query options (date range, filters)
   * @returns Effect containing count of denial entries
   */
  readonly countByOrganization: (
    organizationId: OrganizationId,
    options?: QueryAuditLogOptions
  ) => Effect.Effect<number, PersistenceError>
}

/**
 * AuthorizationAuditRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { AuthorizationAuditRepository } from "@accountability/persistence/Services/AuthorizationAuditRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* AuthorizationAuditRepository
 *   yield* repo.logDenial({
 *     userId, organizationId, action, resourceType, denialReason
 *   })
 *   // ...
 * })
 * ```
 */
export class AuthorizationAuditRepository extends Context.Tag("AuthorizationAuditRepository")<
  AuthorizationAuditRepository,
  AuthorizationAuditRepositoryService
>() {}
