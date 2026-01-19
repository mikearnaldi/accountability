/**
 * AuditLogService - Service interface for creating audit log entries
 *
 * Provides a higher-level API for audit logging that encapsulates
 * the complexity of creating audit entries with proper change tracking.
 *
 * This service is used by business logic services (JournalEntryService,
 * AccountService, etc.) to log operations for compliance requirements.
 *
 * @module audit/AuditLogService
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { AuthUserId } from "../authentication/AuthUserId.ts"
import type { AuditEntityType, AuditChanges } from "./AuditLog.ts"
import type { AuditLogError, UserLookupError } from "./AuditLogErrors.ts"

// =============================================================================
// Service Interface
// =============================================================================

/**
 * AuditLogServiceShape - Service interface for audit log operations
 *
 * Provides methods for logging entity operations (create, update, delete, status change)
 * with automatic change detection, user context, and organization scoping.
 */
export interface AuditLogServiceShape {
  /**
   * Log an entity creation
   *
   * Records that a new entity was created, storing the initial state.
   *
   * @param organizationId - The organization this entity belongs to
   * @param entityType - The type of entity being created
   * @param entityId - The ID of the created entity
   * @param entityName - Human-readable name of the entity (e.g., account name)
   * @param entity - The created entity data (will be stored as changes)
   * @param userId - The ID of the user who created the entity
   * @returns Effect that completes when the audit entry is recorded
   *
   * @example
   * ```typescript
   * yield* auditLogService.logCreate(
   *   organizationId,
   *   "Account",
   *   account.id,
   *   account.name,
   *   account,
   *   currentUserId
   * )
   * ```
   */
  readonly logCreate: <T>(
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityName: string | null,
    entity: T,
    userId: AuthUserId
  ) => Effect.Effect<void, AuditLogError | UserLookupError>

  /**
   * Log an entity update with before/after changes
   *
   * Records changes made to an entity by computing the diff between
   * before and after states.
   *
   * @param organizationId - The organization this entity belongs to
   * @param entityType - The type of entity being updated
   * @param entityId - The ID of the updated entity
   * @param entityName - Human-readable name of the entity (e.g., account name)
   * @param before - The entity state before the update
   * @param after - The entity state after the update
   * @param userId - The ID of the user who made the update
   * @returns Effect that completes when the audit entry is recorded
   *
   * @example
   * ```typescript
   * const before = yield* accountRepo.findById(id)
   * const after = yield* accountRepo.update(id, input)
   * yield* auditLogService.logUpdate(
   *   organizationId,
   *   "Account",
   *   id,
   *   after.name,
   *   before,
   *   after,
   *   currentUserId
   * )
   * ```
   */
  readonly logUpdate: <T>(
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityName: string | null,
    before: T,
    after: T,
    userId: AuthUserId
  ) => Effect.Effect<void, AuditLogError | UserLookupError>

  /**
   * Log an entity deletion
   *
   * Records that an entity was deleted, storing the final state.
   *
   * @param organizationId - The organization this entity belongs to
   * @param entityType - The type of entity being deleted
   * @param entityId - The ID of the deleted entity
   * @param entityName - Human-readable name of the entity (e.g., account name)
   * @param entity - The entity data at time of deletion
   * @param userId - The ID of the user who deleted the entity
   * @returns Effect that completes when the audit entry is recorded
   *
   * @example
   * ```typescript
   * const entity = yield* accountRepo.findById(id)
   * yield* accountRepo.delete(id)
   * yield* auditLogService.logDelete(
   *   organizationId,
   *   "Account",
   *   id,
   *   entity.name,
   *   entity,
   *   currentUserId
   * )
   * ```
   */
  readonly logDelete: <T>(
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityName: string | null,
    entity: T,
    userId: AuthUserId
  ) => Effect.Effect<void, AuditLogError | UserLookupError>

  /**
   * Log a status change (for workflow state transitions)
   *
   * Records status changes for entities with workflows (e.g., fiscal periods,
   * journal entries). This is more specific than logUpdate for clarity.
   *
   * @param organizationId - The organization this entity belongs to
   * @param entityType - The type of entity with status change
   * @param entityId - The ID of the entity
   * @param entityName - Human-readable name of the entity (e.g., "JE-00123")
   * @param previousStatus - The status before the change
   * @param newStatus - The status after the change
   * @param userId - The ID of the user who changed the status
   * @param reason - Optional reason for the status change
   * @returns Effect that completes when the audit entry is recorded
   *
   * @example
   * ```typescript
   * yield* auditLogService.logStatusChange(
   *   organizationId,
   *   "FiscalPeriod",
   *   periodId,
   *   periodName,
   *   "Open",
   *   "Closed",
   *   currentUserId,
   *   "Month-end close complete"
   * )
   * ```
   */
  readonly logStatusChange: (
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityName: string | null,
    previousStatus: string,
    newStatus: string,
    userId: AuthUserId,
    reason?: string
  ) => Effect.Effect<void, AuditLogError | UserLookupError>

  /**
   * Log an operation with pre-computed changes
   *
   * For cases where you need direct control over the changes recorded.
   * Useful when the change computation is complex or pre-computed.
   *
   * @param organizationId - The organization this entity belongs to
   * @param entityType - The type of entity
   * @param entityId - The ID of the entity
   * @param entityName - Human-readable name of the entity
   * @param action - The action being performed
   * @param changes - Pre-computed changes to record
   * @param userId - The ID of the user performing the action
   * @returns Effect that completes when the audit entry is recorded
   */
  readonly logWithChanges: (
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityName: string | null,
    action: "Create" | "Update" | "Delete" | "StatusChange",
    changes: AuditChanges,
    userId: AuthUserId
  ) => Effect.Effect<void, AuditLogError | UserLookupError>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * AuditLogService - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { AuditLogService } from "@accountability/core/audit/AuditLogService"
 *
 * const program = Effect.gen(function* () {
 *   const auditService = yield* AuditLogService
 *   yield* auditService.logCreate("Account", account.id, account, userId)
 * })
 * ```
 */
export class AuditLogService extends Context.Tag("AuditLogService")<
  AuditLogService,
  AuditLogServiceShape
>() {}
