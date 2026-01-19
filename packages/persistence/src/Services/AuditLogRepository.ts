/**
 * AuditLogRepository - Repository interface for AuditLogEntry entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * Read-only repository - audit entries are created by triggers or system code.
 *
 * @module AuditLogRepository
 */

import type * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import type * as DateTime from "effect/DateTime"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type {
  AuditLogEntryId,
  AuditAction,
  AuditEntityType,
  AuditChanges
} from "@accountability/core/audit/AuditLog"
import type { AuditDataCorruptionError } from "@accountability/core/audit/AuditLogErrors"
import type { PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * AuditLogEntry - Domain entity for audit log entries
 *
 * Represents a single audit trail entry tracking changes to entities.
 */
export interface AuditLogEntry {
  readonly id: AuditLogEntryId
  readonly organizationId: string
  readonly entityType: AuditEntityType
  readonly entityId: string
  readonly entityName: Option.Option<string>
  readonly action: AuditAction
  readonly userId: Option.Option<string>
  /** Denormalized user display name at time of action */
  readonly userDisplayName: Option.Option<string>
  /** Denormalized user email at time of action */
  readonly userEmail: Option.Option<string>
  readonly timestamp: DateTime.Utc
  readonly changes: Option.Option<AuditChanges>
}

/**
 * AuditLogInsert - Data required to create a new AuditLogEntry
 *
 * Used by system code or triggers to create audit entries.
 */
export interface AuditLogInsert {
  readonly organizationId: string
  readonly entityType: AuditEntityType
  readonly entityId: string
  readonly entityName: Option.Option<string>
  readonly action: AuditAction
  readonly userId: Option.Option<string>
  /** Denormalized user display name at time of action */
  readonly userDisplayName: Option.Option<string>
  /** Denormalized user email at time of action */
  readonly userEmail: Option.Option<string>
  readonly changes: Option.Option<AuditChanges>
}

/**
 * AuditLogFilter - Filter criteria for querying audit log entries
 */
export interface AuditLogFilter {
  readonly organizationId: string
  readonly entityType: Option.Option<AuditEntityType>
  readonly entityId: Option.Option<string>
  readonly userId: Option.Option<string>
  readonly action: Option.Option<AuditAction>
  readonly fromDate: Option.Option<DateTime.Utc>
  readonly toDate: Option.Option<DateTime.Utc>
  /** Search term for filtering by entity name or entity ID (case-insensitive) */
  readonly search: Option.Option<string>
}

/**
 * PaginationParams - Pagination parameters for queries
 */
export interface PaginationParams {
  readonly limit: number
  readonly offset: number
}

/**
 * AuditLogRepositoryService - Service interface for AuditLogEntry persistence
 *
 * Provides query operations for audit log entries with typed error handling.
 * This is primarily a read-only interface - creation happens via triggers.
 */
export interface AuditLogRepositoryService {
  /**
   * Find audit log entries matching filter criteria with pagination
   *
   * @param filter - Filter criteria
   * @param pagination - Pagination parameters (limit, offset)
   * @returns Effect containing Chunk of AuditLogEntry
   */
  readonly findAll: (
    filter: AuditLogFilter,
    pagination: PaginationParams
  ) => Effect.Effect<Chunk.Chunk<AuditLogEntry>, PersistenceError | AuditDataCorruptionError>

  /**
   * Count audit log entries matching filter criteria
   *
   * @param filter - Filter criteria
   * @returns Effect containing the count
   */
  readonly count: (
    filter: AuditLogFilter
  ) => Effect.Effect<number, PersistenceError>

  /**
   * Find audit log entries by entity type and entity ID
   *
   * @param entityType - The entity type to filter by
   * @param entityId - The entity ID to filter by
   * @returns Effect containing Chunk of AuditLogEntry
   */
  readonly findByEntity: (
    entityType: AuditEntityType,
    entityId: string
  ) => Effect.Effect<Chunk.Chunk<AuditLogEntry>, PersistenceError | AuditDataCorruptionError>

  /**
   * Create a new audit log entry
   *
   * Primarily used by triggers or system code.
   *
   * @param entry - The audit log entry data
   * @returns Effect containing the created AuditLogEntry
   */
  readonly create: (
    entry: AuditLogInsert
  ) => Effect.Effect<AuditLogEntry, PersistenceError | AuditDataCorruptionError>
}

/**
 * AuditLogRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { AuditLogRepository } from "@accountability/persistence/Services/AuditLogRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* AuditLogRepository
 *   const entries = yield* repo.findAll(filter, pagination)
 *   // ...
 * })
 * ```
 */
export class AuditLogRepository extends Context.Tag("AuditLogRepository")<
  AuditLogRepository,
  AuditLogRepositoryService
>() {}
