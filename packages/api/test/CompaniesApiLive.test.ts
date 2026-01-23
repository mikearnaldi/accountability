/**
 * Tests for CompaniesApiLive endpoint handlers
 *
 * These tests verify the handler logic using mock repositories.
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import {
  Company,
  CompanyId,
  FiscalYearEnd
} from "@accountability/core/company/Company"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/jurisdiction/JurisdictionCode"
import {
  Organization,
  OrganizationId,
  OrganizationSettings
} from "@accountability/core/organization/Organization"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { CompanyRepository, type CompanyRepositoryService } from "@accountability/persistence/Services/CompanyRepository"
import { OrganizationRepository, type OrganizationRepositoryService } from "@accountability/persistence/Services/OrganizationRepository"
import { EntityNotFoundError } from "@accountability/persistence/Errors/RepositoryError"

// =============================================================================
// Test Fixtures
// =============================================================================

const testOrganizationId = OrganizationId.make("550e8400-e29b-41d4-a716-446655440000")
const testCompanyId = CompanyId.make("550e8400-e29b-41d4-a716-446655440001")

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

const createTestCompany = (overrides: Partial<{
  id: typeof testCompanyId
  organizationId: typeof testOrganizationId
  name: string
  legalName: string
  jurisdiction: string
  functionalCurrency: string
  reportingCurrency: string
  fiscalYearEnd: { month: number; day: number }
  isActive: boolean
}> = {}): Company => {
  const id = overrides.id ?? testCompanyId
  const organizationId = overrides.organizationId ?? testOrganizationId
  const name = overrides.name ?? "ACME Corp"
  const legalName = overrides.legalName ?? "ACME Corporation Inc."
  const jurisdiction = overrides.jurisdiction ?? "US"
  const functionalCurrency = overrides.functionalCurrency ?? "USD"
  const reportingCurrency = overrides.reportingCurrency ?? "USD"
  const fiscalYearEnd = overrides.fiscalYearEnd ?? { month: 12, day: 31 }
  const isActive = overrides.isActive ?? true

  return Company.make({
    id,
    organizationId,
    name,
    legalName,
    jurisdiction: JurisdictionCode.make(jurisdiction),
    taxId: Option.none(),
    incorporationDate: Option.none(),
    registrationNumber: Option.none(),
    registeredAddress: Option.none(),
    industryCode: Option.none(),
    companyType: Option.none(),
    incorporationJurisdiction: Option.none(),
    functionalCurrency: CurrencyCode.make(functionalCurrency),
    reportingCurrency: CurrencyCode.make(reportingCurrency),
    fiscalYearEnd: FiscalYearEnd.make(fiscalYearEnd),
    retainedEarningsAccountId: Option.none(),
    isActive,
    createdAt: timestampNow()
  })
}

// =============================================================================
// Mock Repositories
// =============================================================================

const createMockOrganizationRepository = (
  initialOrgs: ReadonlyArray<Organization> = [createTestOrganization()]
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

const createMockCompanyRepository = (
  initialCompanies: ReadonlyArray<Company> = []
) =>
  Effect.gen(function* () {
    const companiesRef = yield* Ref.make<ReadonlyArray<Company>>(initialCompanies)

    const service: CompanyRepositoryService = {
      findById: (organizationId, id) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          return Option.fromNullable(companies.find((c) => c.id === id && c.organizationId === organizationId))
        }),
      findByOrganization: (orgId) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          return companies.filter((c) => c.organizationId === orgId)
        }),
      findActiveByOrganization: (orgId) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          return companies.filter((c) => c.organizationId === orgId && c.isActive)
        }),
      create: (company) =>
        Effect.gen(function* () {
          yield* Ref.update(companiesRef, (cs) => [...cs, company])
          return company
        }),
      update: (organizationId, company) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          const exists = companies.some((c) => c.id === company.id && c.organizationId === organizationId)
          if (!exists) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Company",
              entityId: company.id
            }))
          }
          yield* Ref.update(companiesRef, (cs) =>
            cs.map((c) => (c.id === company.id ? company : c))
          )
          return company
        }),
      getById: (organizationId, id) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          const company = companies.find((c) => c.id === id && c.organizationId === organizationId)
          if (!company) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Company",
              entityId: id
            }))
          }
          return company
        }),
      exists: (organizationId, id) =>
        Effect.gen(function* () {
          const companies = yield* Ref.get(companiesRef)
          return companies.some((c) => c.id === id && c.organizationId === organizationId)
        })
    }

    return service
  })

// =============================================================================
// Test Layer
// =============================================================================

const createTestLayer = (
  organizations: ReadonlyArray<Organization> = [createTestOrganization()],
  companies: ReadonlyArray<Company> = []
) =>
  Layer.mergeAll(
    Layer.effect(OrganizationRepository, createMockOrganizationRepository(organizations)),
    Layer.effect(CompanyRepository, createMockCompanyRepository(companies))
  )

// =============================================================================
// Tests
// =============================================================================

describe("CompaniesApiLive", () => {
  // ===========================================================================
  // Organization Tests
  // ===========================================================================
  describe("listOrganizations", () => {
    it.effect("should return all organizations", () =>
      Effect.gen(function* () {
        const org1 = createTestOrganization({ name: "Org 1" })
        const org2 = createTestOrganization({
          id: OrganizationId.make("550e8400-e29b-41d4-a716-446655440099"),
          name: "Org 2"
        })
        const testLayer = createTestLayer([org1, org2], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const orgs = yield* orgRepo.findAll()

        expect(orgs.length).toBe(2)
      })
    )

    it.effect("should return empty list when no organizations exist", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const orgs = yield* orgRepo.findAll()

        expect(orgs.length).toBe(0)
      })
    )
  })

  describe("getOrganization", () => {
    it.effect("should return organization when found", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const testLayer = createTestLayer([org], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const result = yield* orgRepo.findById(testOrganizationId)

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testOrganizationId)
        }
      })
    )

    it.effect("should return None when not found", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const result = yield* orgRepo.findById(testOrganizationId)

        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  describe("createOrganization", () => {
    it.effect("should create organization successfully", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const newOrg = createTestOrganization()
        const created = yield* orgRepo.create(newOrg)

        expect(created.id).toBe(testOrganizationId)

        const found = yield* orgRepo.findById(testOrganizationId)
        expect(Option.isSome(found)).toBe(true)
      })
    )
  })

  describe("updateOrganization", () => {
    it.effect("should update organization name", () =>
      Effect.gen(function* () {
        const org = createTestOrganization({ name: "Old Name" })
        const testLayer = createTestLayer([org], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const updated = Organization.make({
          ...org,
          name: "New Name"
        })
        yield* orgRepo.update(updated)

        const found = yield* orgRepo.findById(testOrganizationId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.name).toBe("New Name")
        }
      })
    )

    it.effect("should fail to update non-existent organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const nonExistent = createTestOrganization()
        const result = yield* orgRepo.update(nonExistent).pipe(Effect.either)

        expect(result._tag).toBe("Left")
      })
    )
  })

  describe("deleteOrganization", () => {
    it.effect("should delete organization when no companies exist", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const testLayer = createTestLayer([org], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        yield* orgRepo.delete(testOrganizationId)

        const found = yield* orgRepo.findById(testOrganizationId)
        expect(Option.isNone(found)).toBe(true)
      })
    )

    it.effect("should check if organization has companies", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany()
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const companies = yield* companyRepo.findByOrganization(testOrganizationId)

        expect(companies.length).toBe(1)
      })
    )
  })

  // ===========================================================================
  // Company Tests
  // ===========================================================================
  describe("listCompanies", () => {
    it.effect("should return companies for an organization", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company1 = createTestCompany({ name: "Company 1" })
        const company2 = createTestCompany({
          id: CompanyId.make("550e8400-e29b-41d4-a716-446655440004"),
          name: "Company 2"
        })
        const testLayer = createTestLayer([org], [company1, company2])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const companies = yield* companyRepo.findByOrganization(testOrganizationId)

        expect(companies.length).toBe(2)
      })
    )

    it.effect("should filter by active status", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const activeCompany = createTestCompany({ isActive: true })
        const inactiveCompany = createTestCompany({
          id: CompanyId.make("550e8400-e29b-41d4-a716-446655440004"),
          isActive: false
        })
        const testLayer = createTestLayer([org], [activeCompany, inactiveCompany])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const active = yield* companyRepo.findActiveByOrganization(testOrganizationId)

        expect(active.length).toBe(1)
        expect(active[0].isActive).toBe(true)
      })
    )
  })

  describe("getCompany", () => {
    it.effect("should return company when found", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany()
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const result = yield* companyRepo.findById(testOrganizationId, testCompanyId)

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testCompanyId)
          expect(result.value.fiscalYearEnd.month).toBe(12)
          expect(result.value.fiscalYearEnd.day).toBe(31)
        }
      })
    )

    it.effect("should return None when not found", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const testLayer = createTestLayer([org], [])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const result = yield* companyRepo.findById(testOrganizationId, testCompanyId)

        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  describe("createCompany", () => {
    it.effect("should create company successfully", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const testLayer = createTestLayer([org], [])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const newCompany = createTestCompany()
        const created = yield* companyRepo.create(newCompany)

        expect(created.id).toBe(testCompanyId)
        expect(created.functionalCurrency).toBe("USD")
        expect(created.fiscalYearEnd.isCalendarYearEnd).toBe(true)

        const found = yield* companyRepo.findById(testOrganizationId, testCompanyId)
        expect(Option.isSome(found)).toBe(true)
      })
    )

    it.effect("should validate organization exists", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [])

        const orgRepo = yield* OrganizationRepository.pipe(Effect.provide(testLayer))
        const exists = yield* orgRepo.exists(testOrganizationId)

        expect(exists).toBe(false)
      })
    )
  })

  describe("updateCompany", () => {
    it.effect("should update company name and fiscal year", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany({ name: "Old Name" })
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const updated = Company.make({
          ...company,
          name: "New Name",
          fiscalYearEnd: FiscalYearEnd.make({ month: 6, day: 30 })
        })
        yield* companyRepo.update(testOrganizationId, updated)

        const found = yield* companyRepo.findById(testOrganizationId, testCompanyId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.name).toBe("New Name")
          expect(found.value.fiscalYearEnd.month).toBe(6)
          expect(found.value.fiscalYearEnd.day).toBe(30)
          expect(found.value.fiscalYearEnd.isCalendarYearEnd).toBe(false)
        }
      })
    )

    it.effect("should update reporting currency", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany({ reportingCurrency: "USD" })
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const updated = Company.make({
          ...company,
          reportingCurrency: CurrencyCode.make("EUR")
        })
        yield* companyRepo.update(testOrganizationId, updated)

        const found = yield* companyRepo.findById(testOrganizationId, testCompanyId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.reportingCurrency).toBe("EUR")
          expect(found.value.hasSameFunctionalAndReportingCurrency).toBe(false)
        }
      })
    )

    it.effect("should fail to update non-existent company", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const testLayer = createTestLayer([org], [])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const nonExistent = createTestCompany()
        const result = yield* companyRepo.update(testOrganizationId, nonExistent).pipe(Effect.either)

        expect(result._tag).toBe("Left")
      })
    )
  })

  describe("deactivateCompany", () => {
    it.effect("should deactivate company", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany({ isActive: true })
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const deactivated = Company.make({
          ...company,
          isActive: false
        })
        yield* companyRepo.update(testOrganizationId, deactivated)

        const found = yield* companyRepo.findById(testOrganizationId, testCompanyId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.isActive).toBe(false)
        }
      })
    )
  })

  // ===========================================================================
  // Company Settings Tests (Fiscal Year, Base Currency)
  // ===========================================================================
  describe("company settings", () => {
    it.effect("should correctly identify calendar year end", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany({
          fiscalYearEnd: { month: 12, day: 31 }
        })
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const found = yield* companyRepo.findById(testOrganizationId, testCompanyId)

        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.fiscalYearEnd.isCalendarYearEnd).toBe(true)
        }
      })
    )

    it.effect("should correctly identify non-calendar fiscal year end", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany({
          fiscalYearEnd: { month: 3, day: 31 }
        })
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const found = yield* companyRepo.findById(testOrganizationId, testCompanyId)

        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.fiscalYearEnd.isCalendarYearEnd).toBe(false)
          expect(found.value.fiscalYearEnd.toDisplayString()).toBe("March 31")
        }
      })
    )

    it.effect("should track functional vs reporting currency mismatch", () =>
      Effect.gen(function* () {
        const org = createTestOrganization()
        const company = createTestCompany({
          functionalCurrency: "EUR",
          reportingCurrency: "USD"
        })
        const testLayer = createTestLayer([org], [company])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const found = yield* companyRepo.findById(testOrganizationId, testCompanyId)

        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.hasSameFunctionalAndReportingCurrency).toBe(false)
        }
      })
    )
  })
})
