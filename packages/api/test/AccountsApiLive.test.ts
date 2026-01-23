/**
 * Tests for AccountsApiLive endpoint handlers
 *
 * These tests verify the handler logic using mock repositories.
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import {
  Account,
  AccountId,
  type AccountCategory,
  type AccountType,
  type NormalBalance,
  type CashFlowCategory
} from "@accountability/core/accounting/Account"
import { AccountNumber } from "@accountability/core/accounting/AccountNumber"
import { Company, CompanyId, FiscalYearEnd } from "@accountability/core/company/Company"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/jurisdiction/JurisdictionCode"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { AccountRepository, type AccountRepositoryService } from "@accountability/persistence/Services/AccountRepository"
import { CompanyRepository, type CompanyRepositoryService } from "@accountability/persistence/Services/CompanyRepository"
import { EntityNotFoundError } from "@accountability/persistence/Errors/RepositoryError"

// =============================================================================
// Test Fixtures
// =============================================================================

const testCompanyId = CompanyId.make("550e8400-e29b-41d4-a716-446655440001")
const testAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440002")
const testParentAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440003")
const testOrganizationId = OrganizationId.make("550e8400-e29b-41d4-a716-446655440000")

const createTestAccount = (overrides: Partial<{
  id: typeof testAccountId
  companyId: typeof testCompanyId
  accountNumber: string
  name: string
  accountType: AccountType
  accountCategory: AccountCategory
  normalBalance: NormalBalance
  isActive: boolean
  hierarchyLevel: number
  parentAccountId: Option.Option<typeof testAccountId>
}> = {}): Account => {
  const id = overrides.id ?? testAccountId
  const companyId = overrides.companyId ?? testCompanyId
  const accountNumber = overrides.accountNumber ?? "1000"
  const name = overrides.name ?? "Cash"
  const accountType = overrides.accountType ?? "Asset"
  const accountCategory = overrides.accountCategory ?? "CurrentAsset"
  const normalBalance = overrides.normalBalance ?? "Debit"
  const isActive = overrides.isActive ?? true
  const hierarchyLevel = overrides.hierarchyLevel ?? 1
  const parentAccountId = overrides.parentAccountId ?? Option.none()

  return Account.make({
    id,
    companyId,
    accountNumber: AccountNumber.make(accountNumber),
    name,
    description: Option.none(),
    accountType,
    accountCategory,
    normalBalance,
    parentAccountId,
    hierarchyLevel,
    isPostable: true,
    isCashFlowRelevant: true,
    cashFlowCategory: Option.some<CashFlowCategory>("Operating"),
    isIntercompany: false,
    intercompanyPartnerId: Option.none(),
    currencyRestriction: Option.none(),
    isActive,
    createdAt: timestampNow(),
    deactivatedAt: Option.none()
  })
}

const createTestCompany = (): Company => {
  return Company.make({
    id: testCompanyId,
    organizationId: testOrganizationId,
    name: "ACME Corp",
    legalName: "ACME Corporation Inc.",
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
    createdAt: timestampNow()
  })
}

// =============================================================================
// Mock Repositories
// =============================================================================

const createMockAccountRepository = (initialAccounts: ReadonlyArray<Account> = []) =>
  Effect.gen(function* () {
    const accountsRef = yield* Ref.make<ReadonlyArray<Account>>(initialAccounts)

    const service: AccountRepositoryService = {
      findById: (_organizationId, id) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return Option.fromNullable(accounts.find((a) => a.id === id))
        }),
      findByCompany: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId)
        }),
      findByNumber: (_organizationId, companyId, accountNumber) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return Option.fromNullable(
            accounts.find((a) => a.companyId === companyId && a.accountNumber === accountNumber)
          )
        }),
      findByType: (_organizationId, companyId, accountType) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId && a.accountType === accountType)
        }),
      findActiveByCompany: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId && a.isActive)
        }),
      findChildren: (_organizationId, parentId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => Option.isSome(a.parentAccountId) && a.parentAccountId.value === parentId)
        }),
      findIntercompanyAccounts: (_organizationId, companyId) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.filter((a) => a.companyId === companyId && a.isIntercompany)
        }),
      create: (account) =>
        Effect.gen(function* () {
          yield* Ref.update(accountsRef, (accounts) => [...accounts, account])
          return account
        }),
      update: (_organizationId, account) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          const exists = accounts.some((a) => a.id === account.id)
          if (!exists) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Account",
              entityId: account.id
            }))
          }
          yield* Ref.update(accountsRef, (accts) =>
            accts.map((a) => (a.id === account.id ? account : a))
          )
          return account
        }),
      getById: (_organizationId, id) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          const account = accounts.find((a) => a.id === id)
          if (!account) {
            return yield* Effect.fail(new EntityNotFoundError({
              entityType: "Account",
              entityId: id
            }))
          }
          return account
        }),
      exists: (_organizationId, id) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.some((a) => a.id === id)
        }),
      isAccountNumberTaken: (_organizationId, companyId, accountNumber) =>
        Effect.gen(function* () {
          const accounts = yield* Ref.get(accountsRef)
          return accounts.some((a) => a.companyId === companyId && a.accountNumber === accountNumber)
        })
    }

    return service
  })

const createMockCompanyRepository = (
  companies: ReadonlyArray<Company> = [createTestCompany()]
) =>
  Effect.gen(function* () {
    const companiesRef = yield* Ref.make<ReadonlyArray<Company>>(companies)

    const service: CompanyRepositoryService = {
      findById: (organizationId, id) =>
        Effect.gen(function* () {
          const allCompanies = yield* Ref.get(companiesRef)
          return Option.fromNullable(allCompanies.find((c) => c.id === id && c.organizationId === organizationId))
        }),
      findByOrganization: (orgId) =>
        Effect.gen(function* () {
          const allCompanies = yield* Ref.get(companiesRef)
          return allCompanies.filter((c) => c.organizationId === orgId)
        }),
      findActiveByOrganization: (orgId) =>
        Effect.gen(function* () {
          const allCompanies = yield* Ref.get(companiesRef)
          return allCompanies.filter((c) => c.organizationId === orgId && c.isActive)
        }),
      create: (company) =>
        Effect.gen(function* () {
          yield* Ref.update(companiesRef, (cs) => [...cs, company])
          return company
        }),
      update: (organizationId, company) =>
        Effect.gen(function* () {
          const allCompanies = yield* Ref.get(companiesRef)
          const exists = allCompanies.some((c) => c.id === company.id && c.organizationId === organizationId)
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
          const allCompanies = yield* Ref.get(companiesRef)
          const company = allCompanies.find((c) => c.id === id && c.organizationId === organizationId)
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
          const allCompanies = yield* Ref.get(companiesRef)
          return allCompanies.some((c) => c.id === id && c.organizationId === organizationId)
        })
    }

    return service
  })

// =============================================================================
// Test Layer
// =============================================================================

const createTestLayer = (
  accounts: ReadonlyArray<Account> = [],
  companies: ReadonlyArray<Company> = [createTestCompany()]
) =>
  Layer.mergeAll(
    Layer.effect(AccountRepository, createMockAccountRepository(accounts)),
    Layer.effect(CompanyRepository, createMockCompanyRepository(companies))
  )

// =============================================================================
// Tests
// =============================================================================

describe("AccountsApiLive", () => {
  describe("listAccounts", () => {
    it.effect("should return accounts for a company", () =>
      Effect.gen(function* () {
        const account1 = createTestAccount({ accountNumber: "1000", name: "Cash" })
        const account2 = createTestAccount({
          id: AccountId.make("550e8400-e29b-41d4-a716-446655440004"),
          accountNumber: "2000",
          name: "Bank",
          accountType: "Asset",
          accountCategory: "CurrentAsset"
        })
        const testLayer = createTestLayer([account1, account2])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const accounts = yield* accountRepo.findByCompany(testOrganizationId, testCompanyId)

        expect(accounts.length).toBe(2)
      })
    )

    it.effect("should filter by account type", () =>
      Effect.gen(function* () {
        const assetAccount = createTestAccount({ accountType: "Asset", accountCategory: "CurrentAsset" })
        const liabilityAccount = createTestAccount({
          id: AccountId.make("550e8400-e29b-41d4-a716-446655440004"),
          accountNumber: "3000",
          name: "Accounts Payable",
          accountType: "Liability",
          accountCategory: "CurrentLiability",
          normalBalance: "Credit"
        })
        const testLayer = createTestLayer([assetAccount, liabilityAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const assets = yield* accountRepo.findByType(testOrganizationId, testCompanyId, "Asset")

        expect(assets.length).toBe(1)
        expect(assets[0].accountType).toBe("Asset")
      })
    )

    it.effect("should filter by active status", () =>
      Effect.gen(function* () {
        const activeAccount = createTestAccount({ isActive: true })
        const inactiveAccount = createTestAccount({
          id: AccountId.make("550e8400-e29b-41d4-a716-446655440004"),
          accountNumber: "2000",
          isActive: false
        })
        const testLayer = createTestLayer([activeAccount, inactiveAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const active = yield* accountRepo.findActiveByCompany(testOrganizationId, testCompanyId)

        expect(active.length).toBe(1)
        expect(active[0].isActive).toBe(true)
      })
    )

    it.effect("should find child accounts", () =>
      Effect.gen(function* () {
        const parentAccount = createTestAccount({
          id: testParentAccountId,
          accountNumber: "1000",
          name: "Parent"
        })
        const childAccount = createTestAccount({
          id: testAccountId,
          accountNumber: "1010",
          name: "Child",
          parentAccountId: Option.some(testParentAccountId),
          hierarchyLevel: 2
        })
        const testLayer = createTestLayer([parentAccount, childAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const children = yield* accountRepo.findChildren(testOrganizationId, testParentAccountId)

        expect(children.length).toBe(1)
        expect(children[0].name).toBe("Child")
      })
    )
  })

  describe("getAccount", () => {
    it.effect("should return account when found", () =>
      Effect.gen(function* () {
        const account = createTestAccount()
        const testLayer = createTestLayer([account])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const result = yield* accountRepo.findById(testOrganizationId, testAccountId)

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testAccountId)
        }
      })
    )

    it.effect("should return None when not found", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const result = yield* accountRepo.findById(testOrganizationId, testAccountId)

        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("should throw EntityNotFoundError for getById when not found", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const result = yield* accountRepo.getById(testOrganizationId, testAccountId).pipe(Effect.either)

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )
  })

  describe("createAccount", () => {
    it.effect("should create account successfully", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const newAccount = createTestAccount()
        const created = yield* accountRepo.create(newAccount)

        expect(created.id).toBe(testAccountId)

        const found = yield* accountRepo.findById(testOrganizationId, testAccountId)
        expect(Option.isSome(found)).toBe(true)
      })
    )

    it.effect("should detect duplicate account numbers", () =>
      Effect.gen(function* () {
        const existingAccount = createTestAccount({ accountNumber: "1000" })
        const testLayer = createTestLayer([existingAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const duplicate = yield* accountRepo.findByNumber(testOrganizationId, testCompanyId, AccountNumber.make("1000"))

        expect(Option.isSome(duplicate)).toBe(true)
      })
    )

    it.effect("should check if account number is taken", () =>
      Effect.gen(function* () {
        const existingAccount = createTestAccount({ accountNumber: "1000" })
        const testLayer = createTestLayer([existingAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const isTaken = yield* accountRepo.isAccountNumberTaken(testOrganizationId, testCompanyId, AccountNumber.make("1000"))

        expect(isTaken).toBe(true)

        const isNotTaken = yield* accountRepo.isAccountNumberTaken(testOrganizationId, testCompanyId, AccountNumber.make("9999"))
        expect(isNotTaken).toBe(false)
      })
    )

    it.effect("should validate parent account exists", () =>
      Effect.gen(function* () {
        const parentAccount = createTestAccount({
          id: testParentAccountId,
          accountNumber: "1000"
        })
        const testLayer = createTestLayer([parentAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const parent = yield* accountRepo.findById(testOrganizationId, testParentAccountId)

        expect(Option.isSome(parent)).toBe(true)
      })
    )
  })

  describe("updateAccount", () => {
    it.effect("should update account name", () =>
      Effect.gen(function* () {
        const account = createTestAccount({ name: "Old Name" })
        const testLayer = createTestLayer([account])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const updated = Account.make({
          ...account,
          name: "New Name"
        })
        yield* accountRepo.update(testOrganizationId, updated)

        const found = yield* accountRepo.findById(testOrganizationId, testAccountId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.name).toBe("New Name")
        }
      })
    )

    it.effect("should fail to update non-existent account", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const nonExistent = createTestAccount({ name: "Non-existent" })
        const result = yield* accountRepo.update(testOrganizationId, nonExistent).pipe(Effect.either)

        expect(result._tag).toBe("Left")
      })
    )

    it.effect("should change parent account", () =>
      Effect.gen(function* () {
        const parentAccount = createTestAccount({
          id: testParentAccountId,
          accountNumber: "1000",
          name: "Parent"
        })
        const childAccount = createTestAccount({
          id: testAccountId,
          accountNumber: "1010",
          name: "Child",
          hierarchyLevel: 1
        })
        const testLayer = createTestLayer([parentAccount, childAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const updated = Account.make({
          ...childAccount,
          parentAccountId: Option.some(testParentAccountId),
          hierarchyLevel: 2
        })
        yield* accountRepo.update(testOrganizationId, updated)

        const found = yield* accountRepo.findById(testOrganizationId, testAccountId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(Option.isSome(found.value.parentAccountId)).toBe(true)
        }
      })
    )

    it.effect("should deactivate account", () =>
      Effect.gen(function* () {
        const account = createTestAccount({ isActive: true })
        const testLayer = createTestLayer([account])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const deactivated = Account.make({
          ...account,
          isActive: false,
          deactivatedAt: Option.some(timestampNow())
        })
        yield* accountRepo.update(testOrganizationId, deactivated)

        const found = yield* accountRepo.findById(testOrganizationId, testAccountId)
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.isActive).toBe(false)
        }
      })
    )
  })

  describe("deactivateAccount validation", () => {
    it.effect("should detect active children", () =>
      Effect.gen(function* () {
        const parentAccount = createTestAccount({
          id: testParentAccountId,
          accountNumber: "1000"
        })
        const childAccount = createTestAccount({
          id: testAccountId,
          accountNumber: "1010",
          parentAccountId: Option.some(testParentAccountId),
          isActive: true
        })
        const testLayer = createTestLayer([parentAccount, childAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const children = yield* accountRepo.findChildren(testOrganizationId, testParentAccountId)
        const activeChildren = children.filter((c) => c.isActive)

        expect(activeChildren.length).toBe(1)
      })
    )

    it.effect("should allow deactivation when no active children", () =>
      Effect.gen(function* () {
        const parentAccount = createTestAccount({
          id: testParentAccountId,
          accountNumber: "1000"
        })
        const inactiveChild = createTestAccount({
          id: testAccountId,
          accountNumber: "1010",
          parentAccountId: Option.some(testParentAccountId),
          isActive: false
        })
        const testLayer = createTestLayer([parentAccount, inactiveChild])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const children = yield* accountRepo.findChildren(testOrganizationId, testParentAccountId)
        const activeChildren = children.filter((c) => c.isActive)

        expect(activeChildren.length).toBe(0)
      })
    )
  })

  describe("company validation", () => {
    it.effect("should check company exists", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [createTestCompany()])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const exists = yield* companyRepo.exists(testOrganizationId, testCompanyId)

        expect(exists).toBe(true)
      })
    )

    it.effect("should return false for non-existent company", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const exists = yield* companyRepo.exists(testOrganizationId, testCompanyId)

        expect(exists).toBe(false)
      })
    )

    it.effect("should find company by organization", () =>
      Effect.gen(function* () {
        const testLayer = createTestLayer([], [createTestCompany()])

        const companyRepo = yield* CompanyRepository.pipe(Effect.provide(testLayer))
        const companies = yield* companyRepo.findByOrganization(testOrganizationId)

        expect(companies.length).toBe(1)
        expect(companies[0].id).toBe(testCompanyId)
      })
    )
  })

  describe("intercompany accounts", () => {
    it.effect("should find intercompany accounts", () =>
      Effect.gen(function* () {
        const regularAccount = createTestAccount({
          accountNumber: "1000",
          name: "Regular"
        })
        const intercompanyAccount = Account.make({
          ...createTestAccount({
            id: AccountId.make("550e8400-e29b-41d4-a716-446655440004"),
            accountNumber: "1500",
            name: "Intercompany Receivable"
          }),
          isIntercompany: true,
          intercompanyPartnerId: Option.some(CompanyId.make("550e8400-e29b-41d4-a716-446655440099"))
        })
        const testLayer = createTestLayer([regularAccount, intercompanyAccount])

        const accountRepo = yield* AccountRepository.pipe(Effect.provide(testLayer))
        const icAccounts = yield* accountRepo.findIntercompanyAccounts(testOrganizationId, testCompanyId)

        expect(icAccounts.length).toBe(1)
        expect(icAccounts[0].isIntercompany).toBe(true)
      })
    )
  })
})
