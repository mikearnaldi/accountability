/**
 * AuditLogServiceLive Integration Tests
 *
 * Tests for the AuditLogService against a testcontainers PostgreSQL database.
 * Verifies audit logging operations including create, update, delete, and status changes.
 *
 * @module test/AuditLogServiceLive
 */

import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Option } from "effect"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import { AuditLogRepositoryLive } from "../src/Layers/AuditLogRepositoryLive.ts"
import { AuditLogServiceLive } from "../src/Layers/AuditLogServiceLive.ts"
import { AuditLogRepository } from "../src/Services/AuditLogRepository.ts"
import { UserRepositoryLive } from "../src/Layers/UserRepositoryLive.ts"
import { SharedPgClientLive } from "./Utils.ts"

/**
 * Layer with AuditLogService and AuditLogRepository.
 * Migrations are run globally in vitest.global-setup.ts to avoid race conditions.
 */
const TestLayer = AuditLogServiceLive.pipe(
  Layer.provideMerge(AuditLogRepositoryLive),
  Layer.provideMerge(UserRepositoryLive),
  Layer.provideMerge(SharedPgClientLive)
)

// Test UUIDs - these are valid UUID format
// Note: organization_id has no FK constraint, so any UUID works for testing
const testOrganizationId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const testUserId = AuthUserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
const testEntityId = "cccccccc-cccc-cccc-cccc-cccccccccccc"

describe("AuditLogServiceLive", () => {
  it.layer(TestLayer, { timeout: "60 seconds" })("AuditLogServiceLive", (it) => {
    // =========================================================================
    // logCreate
    // =========================================================================
    it.effect("logCreate: records entity creation with all fields", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const entity = {
          id: testEntityId,
          name: "Test Account",
          code: "1000",
          category: "Asset"
        }

        // Log the creation
        yield* service.logCreate(testOrganizationId, "Account", testEntityId, entity.name, entity, testUserId)

        // Verify the entry was created
        const entries = yield* repo.findByEntity("Account", testEntityId)
        expect(Chunk.size(entries)).toBeGreaterThanOrEqual(1)

        // Find the Create entry
        const createEntry = Chunk.toArray(entries).find(e => e.action === "Create")
        expect(createEntry).toBeDefined()

        if (createEntry !== undefined) {
          expect(createEntry.entityType).toBe("Account")
          expect(createEntry.entityId).toBe(testEntityId)
          expect(createEntry.action).toBe("Create")
          expect(Option.isSome(createEntry.userId)).toBe(true)
          expect(Option.getOrNull(createEntry.userId)).toBe(testUserId)
          expect(Option.isSome(createEntry.changes)).toBe(true)

          // Verify changes contain all entity fields with from=null
          if (Option.isSome(createEntry.changes)) {
            const changes = createEntry.changes.value
            expect(changes.id?.from).toBeNull()
            expect(changes.id?.to).toBe(testEntityId)
            expect(changes.name?.from).toBeNull()
            expect(changes.name?.to).toBe("Test Account")
            expect(changes.code?.from).toBeNull()
            expect(changes.code?.to).toBe("1000")
          }
        }
      })
    )

    // =========================================================================
    // logUpdate
    // =========================================================================
    it.effect("logUpdate: records changes between before and after states", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const updateEntityId = "dddddddd-dddd-dddd-dddd-dddddddddddd"
        const before = {
          id: updateEntityId,
          name: "Old Name",
          status: "active"
        }
        const after = {
          id: updateEntityId,
          name: "New Name",
          status: "active"
        }

        // Log the update
        yield* service.logUpdate(testOrganizationId, "Company", updateEntityId, after.name, before, after, testUserId)

        // Verify the entry was created
        const entries = yield* repo.findByEntity("Company", updateEntityId)
        const updateEntry = Chunk.toArray(entries).find(e => e.action === "Update")
        expect(updateEntry).toBeDefined()

        if (updateEntry !== undefined) {
          expect(updateEntry.entityType).toBe("Company")
          expect(updateEntry.entityId).toBe(updateEntityId)
          expect(updateEntry.action).toBe("Update")
          expect(Option.isSome(updateEntry.changes)).toBe(true)

          // Verify only changed fields are recorded
          if (Option.isSome(updateEntry.changes)) {
            const changes = updateEntry.changes.value
            expect(changes.name?.from).toBe("Old Name")
            expect(changes.name?.to).toBe("New Name")
            // id and status unchanged, should NOT be in changes
            expect(changes.id).toBeUndefined()
            expect(changes.status).toBeUndefined()
          }
        }
      })
    )

    it.effect("logUpdate: skips audit entry when no fields changed", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const noChangeEntityId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
        const entity = {
          id: noChangeEntityId,
          name: "Same Name",
          status: "active"
        }

        // Count entries before
        const beforeEntries = yield* repo.findByEntity("Company", noChangeEntityId)
        const countBefore = Chunk.size(beforeEntries)

        // Log update with identical before/after
        yield* service.logUpdate(testOrganizationId, "Company", noChangeEntityId, entity.name, entity, entity, testUserId)

        // Count should be the same - no entry created
        const afterEntries = yield* repo.findByEntity("Company", noChangeEntityId)
        const countAfter = Chunk.size(afterEntries)
        expect(countAfter).toBe(countBefore)
      })
    )

    it.effect("logUpdate: handles nested object changes", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const nestedEntityId = "ffffffff-ffff-ffff-ffff-ffffffffffff"
        const before = {
          id: nestedEntityId,
          settings: { timezone: "UTC", locale: "en-US" }
        }
        const after = {
          id: nestedEntityId,
          settings: { timezone: "America/New_York", locale: "en-US" }
        }

        yield* service.logUpdate(testOrganizationId, "Organization", nestedEntityId, "Test Organization", before, after, testUserId)

        const entries = yield* repo.findByEntity("Organization", nestedEntityId)
        const updateEntry = Chunk.toArray(entries).find(e => e.action === "Update")
        expect(updateEntry).toBeDefined()

        if (updateEntry !== undefined && Option.isSome(updateEntry.changes)) {
          const changes = updateEntry.changes.value
          // Nested objects are compared via JSON stringification
          expect(changes.settings).toBeDefined()
        }
      })
    )

    // =========================================================================
    // logDelete
    // =========================================================================
    it.effect("logDelete: records entity deletion with final state", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const deleteEntityId = "11111111-1111-1111-1111-111111111111"
        const entity = {
          id: deleteEntityId,
          name: "To Be Deleted",
          balance: 1000
        }

        yield* service.logDelete(testOrganizationId, "Account", deleteEntityId, entity.name, entity, testUserId)

        const entries = yield* repo.findByEntity("Account", deleteEntityId)
        const deleteEntry = Chunk.toArray(entries).find(e => e.action === "Delete")
        expect(deleteEntry).toBeDefined()

        if (deleteEntry !== undefined) {
          expect(deleteEntry.entityType).toBe("Account")
          expect(deleteEntry.entityId).toBe(deleteEntityId)
          expect(deleteEntry.action).toBe("Delete")
          expect(Option.isSome(deleteEntry.changes)).toBe(true)

          // Verify changes contain all fields with to=null
          if (Option.isSome(deleteEntry.changes)) {
            const changes = deleteEntry.changes.value
            expect(changes.id?.from).toBe(deleteEntityId)
            expect(changes.id?.to).toBeNull()
            expect(changes.name?.from).toBe("To Be Deleted")
            expect(changes.name?.to).toBeNull()
            expect(changes.balance?.from).toBe(1000)
            expect(changes.balance?.to).toBeNull()
          }
        }
      })
    )

    // =========================================================================
    // logStatusChange
    // =========================================================================
    it.effect("logStatusChange: records status transition", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const statusEntityId = "22222222-2222-2222-2222-222222222222"

        yield* service.logStatusChange(
          testOrganizationId,
          "FiscalPeriod",
          statusEntityId,
          "Q4 2024", // entityName for fiscal period
          "Open",
          "Closed",
          testUserId
        )

        const entries = yield* repo.findByEntity("FiscalPeriod", statusEntityId)
        const statusEntry = Chunk.toArray(entries).find(e => e.action === "StatusChange")
        expect(statusEntry).toBeDefined()

        if (statusEntry !== undefined) {
          expect(statusEntry.entityType).toBe("FiscalPeriod")
          expect(statusEntry.action).toBe("StatusChange")
          expect(Option.isSome(statusEntry.changes)).toBe(true)

          if (Option.isSome(statusEntry.changes)) {
            const changes = statusEntry.changes.value
            expect(changes.status?.from).toBe("Open")
            expect(changes.status?.to).toBe("Closed")
          }
        }
      })
    )

    it.effect("logStatusChange: includes optional reason", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const reasonEntityId = "33333333-3333-3333-3333-333333333333"

        yield* service.logStatusChange(
          testOrganizationId,
          "FiscalPeriod",
          reasonEntityId,
          "Q3 2024", // entityName for fiscal period
          "Locked",
          "Open",
          testUserId,
          "Reopened for correction"
        )

        const entries = yield* repo.findByEntity("FiscalPeriod", reasonEntityId)
        const statusEntry = Chunk.toArray(entries).find(e => e.action === "StatusChange")
        expect(statusEntry).toBeDefined()

        if (statusEntry !== undefined && Option.isSome(statusEntry.changes)) {
          const changes = statusEntry.changes.value
          expect(changes.status?.from).toBe("Locked")
          expect(changes.status?.to).toBe("Open")
          expect(changes.reason?.from).toBeNull()
          expect(changes.reason?.to).toBe("Reopened for correction")
        }
      })
    )

    // =========================================================================
    // logWithChanges
    // =========================================================================
    it.effect("logWithChanges: records pre-computed changes", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const precomputedEntityId = "44444444-4444-4444-4444-444444444444"
        const customChanges = {
          field1: { from: "a", to: "b" },
          field2: { from: 100, to: 200 }
        }

        yield* service.logWithChanges(
          testOrganizationId,
          "JournalEntry",
          precomputedEntityId,
          "JE-00001", // entityName for journal entry
          "Update",
          customChanges,
          testUserId
        )

        const entries = yield* repo.findByEntity("JournalEntry", precomputedEntityId)
        const entry = Chunk.toArray(entries).find(e => e.action === "Update")
        expect(entry).toBeDefined()

        if (entry !== undefined && Option.isSome(entry.changes)) {
          const changes = entry.changes.value
          expect(changes.field1?.from).toBe("a")
          expect(changes.field1?.to).toBe("b")
          expect(changes.field2?.from).toBe(100)
          expect(changes.field2?.to).toBe(200)
        }
      })
    )

    // =========================================================================
    // Edge cases
    // =========================================================================
    it.effect("logCreate: handles empty entity", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const emptyEntityId = "55555555-5555-5555-5555-555555555555"
        const emptyEntity = {}

        yield* service.logCreate(testOrganizationId, "Account", emptyEntityId, null, emptyEntity, testUserId)

        const entries = yield* repo.findByEntity("Account", emptyEntityId)
        const entry = Chunk.toArray(entries).find(e => e.action === "Create")
        expect(entry).toBeDefined()

        if (entry !== undefined && Option.isSome(entry.changes)) {
          // Empty entity should have empty changes object
          expect(Object.keys(entry.changes.value).length).toBe(0)
        }
      })
    )

    it.effect("logUpdate: handles added and removed fields", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const fieldChangeEntityId = "66666666-6666-6666-6666-666666666666"
        // Use Record<string, unknown> to allow different field sets
        const before: Record<string, unknown> = {
          id: fieldChangeEntityId,
          oldField: "exists"
        }
        const after: Record<string, unknown> = {
          id: fieldChangeEntityId,
          newField: "added"
        }

        yield* service.logUpdate(testOrganizationId, "Company", fieldChangeEntityId, "Test Company", before, after, testUserId)

        const entries = yield* repo.findByEntity("Company", fieldChangeEntityId)
        const entry = Chunk.toArray(entries).find(e => e.action === "Update")
        expect(entry).toBeDefined()

        if (entry !== undefined && Option.isSome(entry.changes)) {
          const changes = entry.changes.value
          // oldField was removed (value is undefined)
          expect(changes.oldField?.from).toBe("exists")
          expect(changes.oldField?.to).toBeUndefined()
          // newField was added (from is undefined)
          expect(changes.newField?.from).toBeUndefined()
          expect(changes.newField?.to).toBe("added")
        }
      })
    )

    it.effect("logCreate: handles null and undefined values", () =>
      Effect.gen(function* () {
        const service = yield* AuditLogService
        const repo = yield* AuditLogRepository

        const nullEntityId = "77777777-7777-7777-7777-777777777777"
        const entityWithNulls = {
          id: nullEntityId,
          nullField: null,
          undefinedField: undefined,
          normalField: "value"
        }

        yield* service.logCreate(testOrganizationId, "Account", nullEntityId, null, entityWithNulls, testUserId)

        const entries = yield* repo.findByEntity("Account", nullEntityId)
        const entry = Chunk.toArray(entries).find(e => e.action === "Create")
        expect(entry).toBeDefined()

        if (entry !== undefined && Option.isSome(entry.changes)) {
          const changes = entry.changes.value
          expect(changes.normalField?.to).toBe("value")
          // null values should be recorded
          expect(changes.nullField?.to).toBeNull()
        }
      })
    )
  })
})
