/**
 * OrganizationRepository Integration Tests
 *
 * Tests for the OrganizationRepository against a testcontainers PostgreSQL database.
 * Verifies CRUD operations and query methods for organizations.
 *
 * @module test/OrganizationRepository
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { Organization, OrganizationId, OrganizationSettings } from "@accountability/core/organization/Organization"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { OrganizationRepository } from "../src/Services/OrganizationRepository.ts"
import { OrganizationRepositoryLive } from "../src/Layers/OrganizationRepositoryLive.ts"
import { SharedPgClientLive } from "./Utils.ts"

/**
 * Layer with OrganizationRepository.
 * Migrations are run globally in vitest.global-setup.ts to avoid race conditions.
 */
const TestLayer = OrganizationRepositoryLive.pipe(
  Layer.provideMerge(SharedPgClientLive)
)

// Test UUIDs - these are valid UUID format so validation passes
const testOrgId = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
const testOrgId2 = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab")
const testOrgId3 = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac")
const nonExistentId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaff"

describe("OrganizationRepository", () => {
  it.layer(TestLayer, { timeout: "60 seconds" })("OrganizationRepository", (it) => {
    // =========================================================================
    // Create
    // =========================================================================
    it.effect("create: creates a new organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const organization = Organization.make({
          id: testOrgId,
          name: "Test Organization",
          reportingCurrency: CurrencyCode.make("USD"),
          createdAt: Timestamp.make({ epochMillis: Date.now() }),
          settings: OrganizationSettings.make({})
        })
        const created = yield* repo.create(organization)
        expect(created.name).toBe("Test Organization")
        expect(created.reportingCurrency).toBe("USD")
      })
    )

    it.effect("create: creates organization with EUR currency", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const organization = Organization.make({
          id: testOrgId2,
          name: "European Organization",
          reportingCurrency: CurrencyCode.make("EUR"),
          createdAt: Timestamp.make({ epochMillis: Date.now() }),
          settings: OrganizationSettings.make({
            defaultLocale: "en-GB",
            defaultTimezone: "Europe/London"
          })
        })
        const created = yield* repo.create(organization)
        expect(created.name).toBe("European Organization")
        expect(created.reportingCurrency).toBe("EUR")
        expect(created.settings.defaultLocale).toBe("en-GB")
      })
    )

    it.effect("create: creates organization with custom settings", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const organization = Organization.make({
          id: testOrgId3,
          name: "Custom Settings Org",
          reportingCurrency: CurrencyCode.make("GBP"),
          createdAt: Timestamp.make({ epochMillis: Date.now() }),
          settings: OrganizationSettings.make({
            defaultLocale: "en-GB",
            defaultTimezone: "Europe/London",
            defaultDecimalPlaces: 4
          })
        })
        const created = yield* repo.create(organization)
        expect(created.settings.defaultDecimalPlaces).toBe(4)
      })
    )

    // =========================================================================
    // FindById
    // =========================================================================
    it.effect("findById: returns Some for existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const result = yield* repo.findById(testOrgId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Test Organization")
        }
      })
    )

    it.effect("findById: returns None for non-existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const result = yield* repo.findById(OrganizationId.make(nonExistentId))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    // =========================================================================
    // GetById
    // =========================================================================
    it.effect("getById: returns organization for existing id", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const org = yield* repo.getById(testOrgId)
        expect(org.name).toBe("Test Organization")
      })
    )

    it.effect("getById: throws EntityNotFoundError for non-existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const result = yield* Effect.either(repo.getById(OrganizationId.make(nonExistentId)))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    // =========================================================================
    // FindAll
    // =========================================================================
    it.effect("findAll: returns all organizations", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const all = yield* repo.findAll()
        // Should have at least the 3 we created
        expect(all.length).toBeGreaterThanOrEqual(3)
      })
    )

    it.effect("findAll: includes organizations with different currencies", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const all = yield* repo.findAll()
        const currencies = all.map(o => String(o.reportingCurrency))
        // We created USD, EUR, GBP orgs
        expect(currencies).toContain("USD")
        expect(currencies).toContain("EUR")
        expect(currencies).toContain("GBP")
      })
    )

    // =========================================================================
    // Exists
    // =========================================================================
    it.effect("exists: returns true for existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const exists = yield* repo.exists(testOrgId)
        expect(exists).toBe(true)
      })
    )

    it.effect("exists: returns false for non-existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const exists = yield* repo.exists(OrganizationId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )

    // =========================================================================
    // Update
    // =========================================================================
    it.effect("update: updates organization name", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const org = yield* repo.getById(testOrgId)
        const updated = Organization.make({
          ...org,
          name: "Updated Organization Name"
        })
        const result = yield* repo.update(updated)
        expect(result.name).toBe("Updated Organization Name")

        // Verify persisted
        const fetched = yield* repo.getById(testOrgId)
        expect(fetched.name).toBe("Updated Organization Name")
      })
    )

    it.effect("update: updates organization currency", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const org = yield* repo.getById(testOrgId2)
        const updated = Organization.make({
          ...org,
          reportingCurrency: CurrencyCode.make("CHF")
        })
        const result = yield* repo.update(updated)
        expect(result.reportingCurrency).toBe("CHF")
      })
    )

    it.effect("update: throws EntityNotFoundError for non-existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const nonExistent = Organization.make({
          id: OrganizationId.make(nonExistentId),
          name: "Non Existent",
          reportingCurrency: CurrencyCode.make("USD"),
          createdAt: Timestamp.make({ epochMillis: Date.now() }),
          settings: OrganizationSettings.make({})
        })
        const result = yield* Effect.either(repo.update(nonExistent))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    // =========================================================================
    // Delete
    // =========================================================================
    it.effect("delete: deletes an existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        // Delete one of the orgs
        yield* repo.delete(testOrgId3)
        const exists = yield* repo.exists(testOrgId3)
        expect(exists).toBe(false)
      })
    )

    it.effect("delete: throws EntityNotFoundError for non-existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        const result = yield* Effect.either(repo.delete(OrganizationId.make(nonExistentId)))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )
  })
})
