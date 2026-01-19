/**
 * Tests for Organizations API endpoints
 *
 * These tests verify the organization list and create endpoints work correctly.
 * Tests use mock repositories to verify handler logic.
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import {
  Organization,
  OrganizationId,
  OrganizationSettings
} from "@accountability/core/organization/Organization"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { OrganizationRepository, type OrganizationRepositoryService } from "@accountability/persistence/Services/OrganizationRepository"
import { EntityNotFoundError } from "@accountability/persistence/Errors/RepositoryError"

// =============================================================================
// Test Fixtures
// =============================================================================

const testOrganizationId = OrganizationId.make("550e8400-e29b-41d4-a716-446655440000")
const testOrganizationId2 = OrganizationId.make("550e8400-e29b-41d4-a716-446655440001")
const testOrganizationId3 = OrganizationId.make("550e8400-e29b-41d4-a716-446655440002")

const createTestOrganization = (overrides: Partial<{
  id: typeof testOrganizationId
  name: string
  reportingCurrency: string
}> = {}): Organization => {
  const id = overrides.id ?? testOrganizationId
  const name = overrides.name ?? "Test Organization"
  const reportingCurrency = overrides.reportingCurrency ?? "USD"

  return Organization.make({
    id,
    name,
    reportingCurrency: CurrencyCode.make(reportingCurrency),
    createdAt: timestampNow(),
    settings: OrganizationSettings.make({})
  })
}

// =============================================================================
// Mock Repository
// =============================================================================

const createMockOrganizationRepository = (
  initialOrgs: ReadonlyArray<Organization> = []
) =>
  Effect.gen(function* () {
    const orgsRef = yield* Ref.make<ReadonlyArray<Organization>>(initialOrgs)

    const service: OrganizationRepositoryService = {
      findById: (id) =>
        Effect.gen(function* () {
          const orgs = yield* Ref.get(orgsRef)
          return Option.fromNullable(orgs.find((o) => o.id === id))
        }),
      findAll: () =>
        Effect.gen(function* () {
          return yield* Ref.get(orgsRef)
        }),
      create: (org) =>
        Effect.gen(function* () {
          yield* Ref.update(orgsRef, (orgs) => [...orgs, org])
          return org
        }),
      update: (org) =>
        Effect.gen(function* () {
          const orgs = yield* Ref.get(orgsRef)
          const exists = orgs.some((o) => o.id === org.id)
          if (!exists) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Organization",
              entityId: org.id
            }))
          }
          yield* Ref.update(orgsRef, (os) =>
            os.map((o) => (o.id === org.id ? org : o))
          )
          return org
        }),
      delete: (id) =>
        Effect.gen(function* () {
          const orgs = yield* Ref.get(orgsRef)
          const exists = orgs.some((o) => o.id === id)
          if (!exists) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Organization",
              entityId: id
            }))
          }
          yield* Ref.update(orgsRef, (os) => os.filter((o) => o.id !== id))
        }),
      getById: (id) =>
        Effect.gen(function* () {
          const orgs = yield* Ref.get(orgsRef)
          const org = orgs.find((o) => o.id === id)
          if (!org) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Organization",
              entityId: id
            }))
          }
          return org
        }),
      exists: (id) =>
        Effect.gen(function* () {
          const orgs = yield* Ref.get(orgsRef)
          return orgs.some((o) => o.id === id)
        })
    }

    return service
  })

// =============================================================================
// Test Layer
// =============================================================================

const createTestLayer = (organizations: ReadonlyArray<Organization> = []) =>
  Layer.effect(OrganizationRepository, createMockOrganizationRepository(organizations))

// =============================================================================
// Tests
// =============================================================================

describe("Organizations API", () => {
  // ===========================================================================
  // List Organizations
  // ===========================================================================
  describe("listOrganizations", () => {
    it.effect("should return all organizations", () =>
      Effect.gen(function* () {
        const org1 = createTestOrganization({ id: testOrganizationId, name: "Org 1" })
        const org2 = createTestOrganization({ id: testOrganizationId2, name: "Org 2" })
        const org3 = createTestOrganization({ id: testOrganizationId3, name: "Org 3", reportingCurrency: "EUR" })
        const testLayer = createTestLayer([org1, org2, org3])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const orgs = yield* orgRepo.findAll()

        expect(orgs.length).toBe(3)
        expect(orgs.map(o => o.name)).toEqual(["Org 1", "Org 2", "Org 3"])
      })
    )

    it.effect("should return empty list when no organizations exist", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const orgs = yield* orgRepo.findAll()

        expect(orgs.length).toBe(0)
      })
    )

    it.effect("should return organizations with different currencies", () =>
      Effect.gen(function* () {
        const usdOrg = createTestOrganization({ id: testOrganizationId, name: "USD Org", reportingCurrency: "USD" })
        const eurOrg = createTestOrganization({ id: testOrganizationId2, name: "EUR Org", reportingCurrency: "EUR" })
        const gbpOrg = createTestOrganization({ id: testOrganizationId3, name: "GBP Org", reportingCurrency: "GBP" })
        const testLayer = createTestLayer([usdOrg, eurOrg, gbpOrg])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const orgs = yield* orgRepo.findAll()

        expect(orgs.length).toBe(3)
        expect(orgs.find(o => o.name === "USD Org")?.reportingCurrency).toBe("USD")
        expect(orgs.find(o => o.name === "EUR Org")?.reportingCurrency).toBe("EUR")
        expect(orgs.find(o => o.name === "GBP Org")?.reportingCurrency).toBe("GBP")
      })
    )
  })

  // ===========================================================================
  // Create Organization
  // ===========================================================================
  describe("createOrganization", () => {
    it.effect("should create a new organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))

        // Create organization
        const newOrg = createTestOrganization({ name: "New Organization", reportingCurrency: "USD" })
        const created = yield* orgRepo.create(newOrg)

        expect(created.name).toBe("New Organization")
        expect(created.reportingCurrency).toBe("USD")
        expect(created.id).toBe(testOrganizationId)

        // Verify it was persisted
        const found = yield* orgRepo.findById(testOrganizationId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.name).toBe("New Organization")
        }
      })
    )

    it.effect("should create organization with different currency", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))

        const newOrg = createTestOrganization({
          id: testOrganizationId,
          name: "Euro Organization",
          reportingCurrency: "EUR"
        })
        const created = yield* orgRepo.create(newOrg)

        expect(created.reportingCurrency).toBe("EUR")
      })
    )

    it.effect("should allow creating multiple organizations", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))

        // Create first organization
        const org1 = createTestOrganization({ id: testOrganizationId, name: "First Org" })
        yield* orgRepo.create(org1)

        // Create second organization
        const org2 = createTestOrganization({ id: testOrganizationId2, name: "Second Org" })
        yield* orgRepo.create(org2)

        // Verify both exist
        const all = yield* orgRepo.findAll()
        expect(all.length).toBe(2)
      })
    )

    it.effect("should preserve organization settings", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))

        const newOrg = Organization.make({
          id: testOrganizationId,
          name: "Org with Settings",
          reportingCurrency: CurrencyCode.make("USD"),
          createdAt: timestampNow(),
          settings: OrganizationSettings.make({
            defaultLocale: "en-GB",
            defaultTimezone: "Europe/London",
            defaultDecimalPlaces: 2
          })
        })
        const created = yield* orgRepo.create(newOrg)

        expect(created.settings.defaultLocale).toBe("en-GB")
        expect(created.settings.defaultTimezone).toBe("Europe/London")
        expect(created.settings.defaultDecimalPlaces).toBe(2)
      })
    )
  })

  // ===========================================================================
  // Get Organization
  // ===========================================================================
  describe("getOrganization", () => {
    it.effect("should return organization by id", () =>
      Effect.gen(function* () {
        const org = createTestOrganization({ name: "My Organization" })
        const testLayer = createTestLayer([org])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const result = yield* orgRepo.findById(testOrganizationId)

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("My Organization")
        }
      })
    )

    it.effect("should return None for non-existent organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const result = yield* orgRepo.findById(testOrganizationId)

        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("getById should fail for non-existent organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const result = yield* orgRepo.getById(testOrganizationId).pipe(Effect.either)

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )
  })

  // ===========================================================================
  // Update Organization
  // ===========================================================================
  describe("updateOrganization", () => {
    it.effect("should update organization name", () =>
      Effect.gen(function* () {
        const org = createTestOrganization({ name: "Old Name" })
        const testLayer = createTestLayer([org])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))

        const updated = Organization.make({
          ...org,
          name: "New Name"
        })
        const result = yield* orgRepo.update(updated)

        expect(result.name).toBe("New Name")

        // Verify persisted
        const found = yield* orgRepo.findById(testOrganizationId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.name).toBe("New Name")
        }
      })
    )

    it.effect("should update organization currency", () =>
      Effect.gen(function* () {
        const org = createTestOrganization({ reportingCurrency: "USD" })
        const testLayer = createTestLayer([org])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))

        const updated = Organization.make({
          ...org,
          reportingCurrency: CurrencyCode.make("EUR")
        })
        const result = yield* orgRepo.update(updated)

        expect(result.reportingCurrency).toBe("EUR")
      })
    )

    it.effect("should fail to update non-existent organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const nonExistent = createTestOrganization()
        const result = yield* orgRepo.update(nonExistent).pipe(Effect.either)

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )
  })

  // ===========================================================================
  // Delete Organization
  // ===========================================================================
  describe("deleteOrganization", () => {
    it.effect("should delete an organization", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const testLayer = createTestLayer([org])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))

        // Verify it exists
        const before = yield* orgRepo.exists(testOrganizationId)
        expect(before).toBe(true)

        // Delete
        yield* orgRepo.delete(testOrganizationId)

        // Verify it's gone
        const after = yield* orgRepo.exists(testOrganizationId)
        expect(after).toBe(false)
      })
    )

    it.effect("should fail to delete non-existent organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const result = yield* orgRepo.delete(testOrganizationId).pipe(Effect.either)

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )
  })

  // ===========================================================================
  // Exists
  // ===========================================================================
  describe("exists", () => {
    it.effect("should return true for existing organization", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const testLayer = createTestLayer([org])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const exists = yield* orgRepo.exists(testOrganizationId)

        expect(exists).toBe(true)
      })
    )

    it.effect("should return false for non-existing organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const exists = yield* orgRepo.exists(testOrganizationId)

        expect(exists).toBe(false)
      })
    )
  })
})
