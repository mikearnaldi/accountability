/**
 * AuditLogServiceLive - Implementation of AuditLogService
 *
 * Uses AuditLogRepository to persist audit entries with automatic
 * change detection and proper field tracking.
 *
 * @module AuditLogServiceLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type { AuditChanges, AuditEntityType } from "@accountability/core/audit/AuditLog"
import {
  AuditLogService,
  type AuditLogServiceShape
} from "@accountability/core/audit/AuditLogService"
import { AuditLogError, UserLookupError } from "@accountability/core/audit/AuditLogErrors"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { AuditLogRepository } from "../Services/AuditLogRepository.ts"
import { UserRepository } from "../Services/UserRepository.ts"

// =============================================================================
// Change Detection Helpers
// =============================================================================

/**
 * Safely get object keys from any value
 */
function safeObjectKeys(value: unknown): string[] {
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
  }
  return []
}

/**
 * Safely get a property value from an object
 * Uses Object.entries to avoid type assertions
 */
function safeGetProperty(obj: unknown, key: string): unknown {
  if (obj !== null && typeof obj === "object" && key in obj) {
    const entries = Object.entries(obj)
    const found = entries.find(([k]) => k === key)
    return found !== undefined ? found[1] : undefined
  }
  return undefined
}

/**
 * Safely iterate over object entries
 */
function safeObjectEntries(value: unknown): [string, unknown][] {
  if (value !== null && typeof value === "object") {
    return Object.entries(value)
  }
  return []
}

/**
 * Build AuditChanges using Object.fromEntries to avoid type assertions
 */
function buildChanges(entries: Array<[string, { from: unknown; to: unknown }]>): AuditChanges {
  return Object.fromEntries(entries)
}

/**
 * Compute changes between two objects for audit logging
 *
 * Compares all enumerable properties and records changes where values differ.
 * Handles nested objects by converting to JSON for comparison.
 *
 * @param before - The entity state before the change
 * @param after - The entity state after the change
 * @returns AuditChanges record with from/to values for changed fields
 */
const computeChanges = <T>(before: T, after: T): AuditChanges => {
  const beforeKeys = safeObjectKeys(before)
  const afterKeys = safeObjectKeys(after)
  const allKeys = new Set([...beforeKeys, ...afterKeys])

  const changedEntries: Array<[string, { from: unknown; to: unknown }]> = []

  for (const key of allKeys) {
    const fromValue = safeGetProperty(before, key)
    const toValue = safeGetProperty(after, key)

    // Compare values (handling objects by JSON comparison)
    const fromString = typeof fromValue === "object"
      ? JSON.stringify(fromValue)
      : String(fromValue)
    const toString = typeof toValue === "object"
      ? JSON.stringify(toValue)
      : String(toValue)

    if (fromString !== toString) {
      changedEntries.push([key, { from: fromValue, to: toValue }])
    }
  }

  return buildChanges(changedEntries)
}

/**
 * Convert an entity to changes record for create audit
 *
 * For create operations, we record all fields with from=null, to=value
 *
 * @param entity - The created entity
 * @returns AuditChanges record with all entity fields
 */
const entityToCreateChanges = <T>(entity: T): AuditChanges => {
  const entries = safeObjectEntries(entity)
  const changedEntries: Array<[string, { from: unknown; to: unknown }]> = entries.map(
    ([key, value]) => [key, { from: null, to: value }]
  )
  return buildChanges(changedEntries)
}

/**
 * Convert an entity to changes record for delete audit
 *
 * For delete operations, we record all fields with from=value, to=null
 *
 * @param entity - The deleted entity
 * @returns AuditChanges record with all entity fields
 */
const entityToDeleteChanges = <T>(entity: T): AuditChanges => {
  const entries = safeObjectEntries(entity)
  const changedEntries: Array<[string, { from: unknown; to: unknown }]> = entries.map(
    ([key, value]) => [key, { from: value, to: null }]
  )
  return buildChanges(changedEntries)
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * User info for denormalization into audit entries
 */
interface UserInfo {
  readonly displayName: Option.Option<string>
  readonly email: Option.Option<string>
}

/**
 * Create the AuditLogService implementation
 */
const make = Effect.gen(function* () {
  const auditRepo = yield* AuditLogRepository
  const userRepo = yield* UserRepository

  /**
   * Wrap repository errors in AuditLogError, preserving UserLookupError as-is
   *
   * UserLookupError is a specific error that should propagate unchanged,
   * while other errors (like repository errors) get wrapped in AuditLogError.
   */
  const wrapError = (operation: string) =>
    <A, R>(effect: Effect.Effect<A, UserLookupError | unknown, R>): Effect.Effect<A, AuditLogError | UserLookupError, R> =>
      Effect.catchAll(effect, (cause): Effect.Effect<never, AuditLogError | UserLookupError> => {
        if (cause instanceof UserLookupError) {
          return Effect.fail(cause)
        }
        return Effect.fail(new AuditLogError({ operation, cause }))
      })

  /**
   * Look up user display name and email for denormalization
   *
   * Audit logs must include complete actor information for compliance.
   * If we cannot look up the user, we fail with UserLookupError rather
   * than creating an incomplete audit entry.
   *
   * Note: If the user is not found (Option.none), we still succeed with
   * empty display name/email - this handles legitimate cases like deleted
   * users. We only fail if the lookup operation itself fails (database error).
   */
  const lookupUserInfo = (userId: AuthUserId): Effect.Effect<UserInfo, UserLookupError> =>
    userRepo.findById(userId).pipe(
      Effect.map((userOpt) =>
        Option.match(userOpt, {
          onNone: () => ({
            displayName: Option.none<string>(),
            email: Option.none<string>()
          }),
          onSome: (user) => ({
            displayName: Option.some(user.displayName),
            email: Option.some(user.email)
          })
        })
      ),
      // User lookup failure must fail the audit log creation
      Effect.mapError((cause) =>
        new UserLookupError({ userId: String(userId), cause })
      )
    )

  const logCreate: AuditLogServiceShape["logCreate"] = <T>(organizationId: string, entityType: AuditEntityType, entityId: string, entityName: string | null, entity: T, userId: AuthUserId) =>
    Effect.gen(function* () {
      const changes = entityToCreateChanges(entity)
      const userInfo = yield* lookupUserInfo(userId)
      yield* auditRepo.create({
        organizationId,
        entityType,
        entityId,
        entityName: Option.fromNullable(entityName),
        action: "Create",
        userId: Option.some(userId),
        userDisplayName: userInfo.displayName,
        userEmail: userInfo.email,
        changes: Option.some(changes)
      })
    }).pipe(
      wrapError("logCreate")
    )

  const logUpdate: AuditLogServiceShape["logUpdate"] = <T>(organizationId: string, entityType: AuditEntityType, entityId: string, entityName: string | null, before: T, after: T, userId: AuthUserId) =>
    Effect.gen(function* () {
      const changes = computeChanges(before, after)
      // Only create audit entry if there are actual changes
      if (Object.keys(changes).length > 0) {
        const userInfo = yield* lookupUserInfo(userId)
        yield* auditRepo.create({
          organizationId,
          entityType,
          entityId,
          entityName: Option.fromNullable(entityName),
          action: "Update",
          userId: Option.some(userId),
          userDisplayName: userInfo.displayName,
          userEmail: userInfo.email,
          changes: Option.some(changes)
        })
      }
    }).pipe(
      wrapError("logUpdate")
    )

  const logDelete: AuditLogServiceShape["logDelete"] = <T>(organizationId: string, entityType: AuditEntityType, entityId: string, entityName: string | null, entity: T, userId: AuthUserId) =>
    Effect.gen(function* () {
      const changes = entityToDeleteChanges(entity)
      const userInfo = yield* lookupUserInfo(userId)
      yield* auditRepo.create({
        organizationId,
        entityType,
        entityId,
        entityName: Option.fromNullable(entityName),
        action: "Delete",
        userId: Option.some(userId),
        userDisplayName: userInfo.displayName,
        userEmail: userInfo.email,
        changes: Option.some(changes)
      })
    }).pipe(
      wrapError("logDelete")
    )

  const logStatusChange: AuditLogServiceShape["logStatusChange"] = (
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityName: string | null,
    previousStatus: string,
    newStatus: string,
    userId: AuthUserId,
    reason?: string
  ) =>
    Effect.gen(function* () {
      const baseEntries: Array<[string, { from: unknown; to: unknown }]> = [
        ["status", { from: previousStatus, to: newStatus }]
      ]
      if (reason !== undefined) {
        baseEntries.push(["reason", { from: null, to: reason }])
      }
      const changes = buildChanges(baseEntries)
      const userInfo = yield* lookupUserInfo(userId)
      yield* auditRepo.create({
        organizationId,
        entityType,
        entityId,
        entityName: Option.fromNullable(entityName),
        action: "StatusChange",
        userId: Option.some(userId),
        userDisplayName: userInfo.displayName,
        userEmail: userInfo.email,
        changes: Option.some(changes)
      })
    }).pipe(
      wrapError("logStatusChange")
    )

  const logWithChanges: AuditLogServiceShape["logWithChanges"] = (
    organizationId: string,
    entityType: AuditEntityType,
    entityId: string,
    entityName: string | null,
    action: "Create" | "Update" | "Delete" | "StatusChange",
    changes: AuditChanges,
    userId: AuthUserId
  ) =>
    Effect.gen(function* () {
      const userInfo = yield* lookupUserInfo(userId)
      yield* auditRepo.create({
        organizationId,
        entityType,
        entityId,
        entityName: Option.fromNullable(entityName),
        action,
        userId: Option.some(userId),
        userDisplayName: userInfo.displayName,
        userEmail: userInfo.email,
        changes: Option.some(changes)
      })
    }).pipe(
      wrapError("logWithChanges")
    )

  return {
    logCreate,
    logUpdate,
    logDelete,
    logStatusChange,
    logWithChanges
  } satisfies AuditLogServiceShape
})

/**
 * AuditLogServiceLive - Layer providing AuditLogService implementation
 *
 * Requires AuditLogRepository and UserRepository in context.
 */
export const AuditLogServiceLive = Layer.effect(AuditLogService, make)
