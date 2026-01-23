/**
 * CompanyRepository Integration Tests
 *
 * Tests for the CompanyRepository against a testcontainers PostgreSQL database.
 * Verifies CRUD operations and query methods for companies.
 *
 * @module test/CompanyRepository
 */

import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { Company, CompanyId, FiscalYearEnd } from "@accountability/core/company/Company"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/jurisdiction/JurisdictionCode"
import { Organization, OrganizationId, OrganizationSettings } from "@accountability/core/organization/Organization"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { CompanyRepository } from "../src/Services/CompanyRepository.ts"
import { OrganizationRepository } from "../src/Services/OrganizationRepository.ts"
import { CompanyRepositoryLive } from "../src/Layers/CompanyRepositoryLive.ts"
import { OrganizationRepositoryLive } from "../src/Layers/OrganizationRepositoryLive.ts"
import { SharedPgClientLive } from "./Utils.ts"

/**
 * Layer with repositories.
 * Migrations are run globally in vitest.global-setup.ts to avoid race conditions.
 */
const TestLayer = Layer.mergeAll(CompanyRepositoryLive, OrganizationRepositoryLive).pipe(
  Layer.provideMerge(SharedPgClientLive)
)

// Test UUIDs - these are valid UUID format so validation passes
const testOrgId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
const testCompanyId = CompanyId.make("cccccccc-cccc-cccc-cccc-cccccccccccc")
const testCompanyId2 = CompanyId.make("cccccccc-cccc-cccc-cccc-cccccccccccd")
const testCompanyId3 = CompanyId.make("cccccccc-cccc-cccc-cccc-ccccccccccce")
const nonExistentId = "cccccccc-cccc-cccc-cccc-ffffffffffff"

describe("CompanyRepository", () => {
  it.layer(TestLayer, { timeout: "60 seconds" })("CompanyRepository", (it) => {
    // =========================================================================
    // Setup: Create test organization first
    // =========================================================================
    it.effect("setup: creates test organization", () =>
      Effect.gen(function* () {
        const orgRepo = yield* OrganizationRepository
        const organization = Organization.make({
          id: testOrgId,
          name: "Test Organization for Companies",
          reportingCurrency: CurrencyCode.make("USD"),
          createdAt: Timestamp.make({ epochMillis: Date.now() }),
          settings: OrganizationSettings.make({})
        })
        const created = yield* orgRepo.create(organization)
        expect(created.id).toBe(testOrgId)
      })
    )

    // =========================================================================
    // Create
    // =========================================================================
    it.effect("create: creates a new company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = Company.make({
          id: testCompanyId,
          organizationId: testOrgId,
          name: "Test Company",
          legalName: "Test Company Inc.",
          jurisdiction: JurisdictionCode.make("US"),
          taxId: Option.none(),
          incorporationDate: Option.none(),
          registrationNumber: Option.none(),
          registeredAddress: Option.none(),
          industryCode: Option.none(),
          companyType: Option.none(),
          incorporationJurisdiction: Option.none(),
          functionalCurrency: CurrencyCode.make("USD"),
          reportingCurrency: CurrencyCode.make("USD"),
          fiscalYearEnd: FiscalYearEnd.make({ month: 12, day: 31 }),
          retainedEarningsAccountId: Option.none(),
          isActive: true,
          createdAt: Timestamp.make({ epochMillis: Date.now() })
        })
        const created = yield* repo.create(company)
        expect(created.name).toBe("Test Company")
        expect(created.legalName).toBe("Test Company Inc.")
        expect(created.jurisdiction).toBe("US")
        expect(created.functionalCurrency).toBe("USD")
        expect(created.fiscalYearEnd.month).toBe(12)
        expect(created.fiscalYearEnd.day).toBe(31)
        expect(created.isActive).toBe(true)
      })
    )

    it.effect("create: creates company with EUR currency", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = Company.make({
          id: testCompanyId2,
          organizationId: testOrgId,
          name: "European Company",
          legalName: "European Company GmbH",
          jurisdiction: JurisdictionCode.make("DE"),
          taxId: Option.some("DE123456789"),
          incorporationDate: Option.none(),
          registrationNumber: Option.none(),
          registeredAddress: Option.none(),
          industryCode: Option.none(),
          companyType: Option.none(),
          incorporationJurisdiction: Option.none(),
          functionalCurrency: CurrencyCode.make("EUR"),
          reportingCurrency: CurrencyCode.make("EUR"),
          fiscalYearEnd: FiscalYearEnd.make({ month: 12, day: 31 }),
          retainedEarningsAccountId: Option.none(),
          isActive: true,
          createdAt: Timestamp.make({ epochMillis: Date.now() })
        })
        const created = yield* repo.create(company)
        expect(created.name).toBe("European Company")
        expect(created.functionalCurrency).toBe("EUR")
        expect(created.jurisdiction).toBe("DE")
        expect(Option.isSome(created.taxId)).toBe(true)
      })
    )

    it.effect("create: creates company with March fiscal year end", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = Company.make({
          id: testCompanyId3,
          organizationId: testOrgId,
          name: "Japanese Company",
          legalName: "Japanese Company K.K.",
          jurisdiction: JurisdictionCode.make("JP"),
          taxId: Option.none(),
          incorporationDate: Option.none(),
          registrationNumber: Option.none(),
          registeredAddress: Option.none(),
          industryCode: Option.none(),
          companyType: Option.none(),
          incorporationJurisdiction: Option.none(),
          functionalCurrency: CurrencyCode.make("JPY"),
          reportingCurrency: CurrencyCode.make("JPY"),
          fiscalYearEnd: FiscalYearEnd.make({ month: 3, day: 31 }),
          retainedEarningsAccountId: Option.none(),
          isActive: true,
          createdAt: Timestamp.make({ epochMillis: Date.now() })
        })
        const created = yield* repo.create(company)
        expect(created.fiscalYearEnd.month).toBe(3)
        expect(created.fiscalYearEnd.day).toBe(31)
        expect(created.fiscalYearEnd.isCalendarYearEnd).toBe(false)
      })
    )

    // =========================================================================
    // FindById
    // =========================================================================
    it.effect("findById: returns Some for existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const result = yield* repo.findById(testOrgId, testCompanyId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Test Company")
          expect(result.value.legalName).toBe("Test Company Inc.")
        }
      })
    )

    it.effect("findById: returns None for non-existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const result = yield* repo.findById(testOrgId, CompanyId.make(nonExistentId))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    // =========================================================================
    // GetById
    // =========================================================================
    it.effect("getById: returns company for existing id", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = yield* repo.getById(testOrgId, testCompanyId)
        expect(company.name).toBe("Test Company")
      })
    )

    it.effect("getById: throws EntityNotFoundError for non-existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const result = yield* Effect.either(repo.getById(testOrgId, CompanyId.make(nonExistentId)))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    // =========================================================================
    // FindByOrganization
    // =========================================================================
    it.effect("findByOrganization: returns all companies for organization", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const companies = yield* repo.findByOrganization(testOrgId)
        // Should have at least 3 companies we created
        expect(companies.length).toBeGreaterThanOrEqual(3)
      })
    )

    it.effect("findByOrganization: returns empty array for org with no companies", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const companies = yield* repo.findByOrganization(OrganizationId.make("00000000-0000-0000-0000-000000000001"))
        expect(companies.length).toBe(0)
      })
    )

    // =========================================================================
    // FindActiveByOrganization
    // =========================================================================
    it.effect("findActiveByOrganization: returns only active companies", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const companies = yield* repo.findActiveByOrganization(testOrgId)
        // All should be active
        for (const company of companies) {
          expect(company.isActive).toBe(true)
        }
      })
    )

    // =========================================================================
    // Exists
    // =========================================================================
    it.effect("exists: returns true for existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const exists = yield* repo.exists(testOrgId, testCompanyId)
        expect(exists).toBe(true)
      })
    )

    it.effect("exists: returns false for non-existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const exists = yield* repo.exists(testOrgId, CompanyId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )

    // =========================================================================
    // Update
    // =========================================================================
    it.effect("update: updates company name", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = yield* repo.getById(testOrgId, testCompanyId)
        const updated = Company.make({
          ...company,
          name: "Updated Test Company"
        })
        const result = yield* repo.update(testOrgId, updated)
        expect(result.name).toBe("Updated Test Company")

        // Verify persisted
        const fetched = yield* repo.getById(testOrgId, testCompanyId)
        expect(fetched.name).toBe("Updated Test Company")
      })
    )

    it.effect("update: updates company legal name", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = yield* repo.getById(testOrgId, testCompanyId)
        const updated = Company.make({
          ...company,
          legalName: "Updated Test Company LLC"
        })
        const result = yield* repo.update(testOrgId, updated)
        expect(result.legalName).toBe("Updated Test Company LLC")
      })
    )

    it.effect("update: updates company currency", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = yield* repo.getById(testOrgId, testCompanyId2)
        const updated = Company.make({
          ...company,
          reportingCurrency: CurrencyCode.make("CHF")
        })
        const result = yield* repo.update(testOrgId, updated)
        expect(result.reportingCurrency).toBe("CHF")
        expect(result.hasSameFunctionalAndReportingCurrency).toBe(false)
      })
    )

    it.effect("update: deactivates company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const company = yield* repo.getById(testOrgId, testCompanyId3)
        const updated = Company.make({
          ...company,
          isActive: false
        })
        const result = yield* repo.update(testOrgId, updated)
        expect(result.isActive).toBe(false)
      })
    )

    it.effect("update: throws EntityNotFoundError for non-existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const nonExistent = Company.make({
          id: CompanyId.make(nonExistentId),
          organizationId: testOrgId,
          name: "Non Existent",
          legalName: "Non Existent Inc.",
          jurisdiction: JurisdictionCode.make("US"),
          taxId: Option.none(),
          incorporationDate: Option.none(),
          registrationNumber: Option.none(),
          registeredAddress: Option.none(),
          industryCode: Option.none(),
          companyType: Option.none(),
          incorporationJurisdiction: Option.none(),
          functionalCurrency: CurrencyCode.make("USD"),
          reportingCurrency: CurrencyCode.make("USD"),
          fiscalYearEnd: FiscalYearEnd.make({ month: 12, day: 31 }),
          retainedEarningsAccountId: Option.none(),
          isActive: true,
          createdAt: Timestamp.make({ epochMillis: Date.now() })
        })
        const result = yield* Effect.either(repo.update(testOrgId, nonExistent))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    // =========================================================================
    // Business Logic
    // =========================================================================
    it.effect("business: fiscal year end properties are correct", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository

        // Calendar year end company
        const usCompany = yield* repo.getById(testOrgId, testCompanyId)
        expect(usCompany.fiscalYearEnd.isCalendarYearEnd).toBe(true)
        expect(usCompany.fiscalYearEnd.toDisplayString()).toBe("December 31")

        // March year end company (reactivate if needed first)
        const jpCompany = yield* repo.getById(testOrgId, testCompanyId3)
        expect(jpCompany.fiscalYearEnd.isCalendarYearEnd).toBe(false)
        expect(jpCompany.fiscalYearEnd.toDisplayString()).toBe("March 31")
      })
    )

    it.effect("business: functional vs reporting currency matching", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository

        // Same currency
        const usCompany = yield* repo.getById(testOrgId, testCompanyId)
        expect(usCompany.hasSameFunctionalAndReportingCurrency).toBe(true)

        // Different currency (EUR company was updated to CHF reporting)
        const eurCompany = yield* repo.getById(testOrgId, testCompanyId2)
        expect(eurCompany.hasSameFunctionalAndReportingCurrency).toBe(false)
      })
    )
  })
})
