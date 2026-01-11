/**
 * Repository Integration Tests
 *
 * Tests repository implementations against a testcontainers PostgreSQL database.
 * Uses the MigrationLayer to set up the schema before running tests.
 *
 * @module test/Repositories
 */

import { PgClient } from "@effect/sql-pg"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option } from "effect"
import { CompanyId } from "@accountability/core/domain/Company"
import { AccountId } from "@accountability/core/domain/Account"
import { OrganizationId } from "@accountability/core/domain/Organization"
import { CompanyRepository } from "../src/CompanyRepository.ts"
import { CompanyRepositoryLive } from "../src/CompanyRepositoryLive.ts"
import { AccountRepository } from "../src/AccountRepository.ts"
import { AccountRepositoryLive } from "../src/AccountRepositoryLive.ts"
import { ExchangeRateRepository } from "../src/ExchangeRateRepository.ts"
import { ExchangeRateRepositoryLive } from "../src/ExchangeRateRepositoryLive.ts"
import { FiscalPeriodRepository } from "../src/FiscalPeriodRepository.ts"
import { FiscalPeriodRepositoryLive } from "../src/FiscalPeriodRepositoryLive.ts"
import { JournalEntryRepository } from "../src/JournalEntryRepository.ts"
import { JournalEntryRepositoryLive } from "../src/JournalEntryRepositoryLive.ts"
import { ConsolidationRepository } from "../src/ConsolidationRepository.ts"
import { ConsolidationRepositoryLive } from "../src/ConsolidationRepositoryLive.ts"
import { MigrationLayer } from "../src/MigrationRunner.ts"
import { PgContainer } from "./Utils.ts"
import { FiscalYearId, FiscalPeriodId } from "@accountability/core/services/PeriodService"
import { ExchangeRateId } from "@accountability/core/domain/ExchangeRate"
import { ConsolidationGroupId } from "@accountability/core/domain/ConsolidationGroup"
import { JournalEntryId } from "@accountability/core/domain/JournalEntry"

/**
 * Layer with migrations and all repositories
 */
const TestLayer = Layer.mergeAll(
  CompanyRepositoryLive,
  AccountRepositoryLive,
  JournalEntryRepositoryLive,
  FiscalPeriodRepositoryLive,
  ExchangeRateRepositoryLive,
  ConsolidationRepositoryLive
).pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(PgContainer.ClientLive)
)

// Test UUIDs - these are valid UUID format so validation passes
const testOrgId = OrganizationId.make("11111111-1111-1111-1111-111111111111")
const testCompanyId = CompanyId.make("22222222-2222-2222-2222-222222222222")
const testAccountId = AccountId.make("44444444-4444-4444-4444-444444444444")
const testFiscalYearId = FiscalYearId.make("cccccccc-cccc-cccc-cccc-cccccccccccc")
const testFiscalPeriodId = FiscalPeriodId.make("dddddddd-dddd-dddd-dddd-dddddddddddd")
const testRateId = ExchangeRateId.make("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
const testGroupId = ConsolidationGroupId.make("ffffffff-ffff-ffff-ffff-ffffffffffff")
const testEntryId = JournalEntryId.make("66666666-6666-6666-6666-666666666666")
const nonExistentId = "99999999-9999-9999-9999-999999999999"

describe("Repositories", () => {
  it.layer(TestLayer, { timeout: "60 seconds" })("CompanyRepository", (it) => {
    it.effect("setup: create test data", () =>
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        yield* sql`
          INSERT INTO organizations (id, name, reporting_currency, created_at)
          VALUES (${testOrgId}, 'Test Organization', 'USD', NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO companies (
            id, organization_id, name, legal_name, jurisdiction,
            functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
            is_active, created_at
          ) VALUES (
            ${testCompanyId}, ${testOrgId}, 'Test Company', 'Test Company LLC', 'US',
            'USD', 'USD', 12, 31, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const result = yield* repo.findById(testCompanyId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Test Company")
        }
      })
    )

    it.effect("findById: returns None for non-existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const result = yield* repo.findById(CompanyId.make(nonExistentId))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("getById: throws EntityNotFoundError for non-existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const result = yield* Effect.either(repo.getById(CompanyId.make(nonExistentId)))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    it.effect("exists: returns true for existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const exists = yield* repo.exists(testCompanyId)
        expect(exists).toBe(true)
      })
    )

    it.effect("exists: returns false for non-existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const exists = yield* repo.exists(CompanyId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )

    it.effect("findByOrganization: returns companies for organization", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const companies = yield* repo.findByOrganization(testOrgId)
        expect(companies.length).toBeGreaterThanOrEqual(1)
      })
    )
  })

  it.layer(TestLayer, { timeout: "60 seconds" })("AccountRepository", (it) => {
    it.effect("setup: create test data", () =>
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        yield* sql`
          INSERT INTO organizations (id, name, reporting_currency, created_at)
          VALUES (${testOrgId}, 'Test Organization', 'USD', NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO companies (
            id, organization_id, name, legal_name, jurisdiction,
            functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
            is_active, created_at
          ) VALUES (
            ${testCompanyId}, ${testOrgId}, 'Test Company', 'Test Company LLC', 'US',
            'USD', 'USD', 12, 31, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO accounts (
            id, company_id, account_number, name, account_type, account_category,
            normal_balance, hierarchy_level, is_postable, is_cash_flow_relevant,
            is_intercompany, is_active, created_at
          ) VALUES (
            ${testAccountId}, ${testCompanyId}, '1000', 'Cash', 'Asset', 'CurrentAsset',
            'Debit', 1, true, true, false, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing account", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const result = yield* repo.findById(testAccountId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Cash")
        }
      })
    )

    it.effect("findByCompany: returns accounts for a company", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const accounts = yield* repo.findByCompany(testCompanyId)
        expect(accounts.length).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findActiveByCompany: returns only active accounts", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const accounts = yield* repo.findActiveByCompany(testCompanyId)
        expect(accounts.every((a) => a.isActive)).toBe(true)
      })
    )

    it.effect("findByType: returns accounts of specific type", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const assets = yield* repo.findByType(testCompanyId, "Asset")
        expect(assets.every((a) => a.accountType === "Asset")).toBe(true)
      })
    )

    it.effect("exists: returns true for existing account", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const exists = yield* repo.exists(testAccountId)
        expect(exists).toBe(true)
      })
    )
  })

  it.layer(TestLayer, { timeout: "60 seconds" })("ExchangeRateRepository", (it) => {
    it.effect("setup: create test exchange rate", () =>
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        yield* sql`
          INSERT INTO organizations (id, name, reporting_currency, created_at)
          VALUES (${testOrgId}, 'Test Organization', 'USD', NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO exchange_rates (
            id, organization_id, from_currency, to_currency, rate, effective_date, rate_type, source, created_at
          ) VALUES (
            ${testRateId}, ${testOrgId}, 'EUR', 'USD', '1.0850', '2024-01-15', 'Spot', 'Manual', NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing rate", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const result = yield* repo.findById(testRateId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.fromCurrency).toBe("EUR")
          expect(result.value.toCurrency).toBe("USD")
        }
      })
    )

    it.effect("exists: returns true for existing rate", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const exists = yield* repo.exists(testRateId)
        expect(exists).toBe(true)
      })
    )
  })

  it.layer(TestLayer, { timeout: "60 seconds" })("FiscalPeriodRepository", (it) => {
    it.effect("setup: create test data", () =>
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        yield* sql`
          INSERT INTO organizations (id, name, reporting_currency, created_at)
          VALUES (${testOrgId}, 'Test Organization', 'USD', NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO companies (
            id, organization_id, name, legal_name, jurisdiction,
            functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
            is_active, created_at
          ) VALUES (
            ${testCompanyId}, ${testOrgId}, 'Test Company', 'Test Company LLC', 'US',
            'USD', 'USD', 12, 31, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO fiscal_years (id, company_id, name, year, start_date, end_date, status, includes_adjustment_period, created_at)
          VALUES (${testFiscalYearId}, ${testCompanyId}, 'FY 2025', 2025, '2025-01-01', '2025-12-31', 'Open', false, NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO fiscal_periods (id, fiscal_year_id, period_number, name, period_type, start_date, end_date, status)
          VALUES (${testFiscalPeriodId}, ${testFiscalYearId}, 1, 'January 2025', 'Regular', '2025-01-01', '2025-01-31', 'Open')
          ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findFiscalYearById: returns fiscal year", () =>
      Effect.gen(function* () {
        const repo = yield* FiscalPeriodRepository
        const result = yield* repo.findFiscalYearById(testFiscalYearId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.year).toBe(2025)
        }
      })
    )

    it.effect("findFiscalYearsByCompany: returns fiscal years for company", () =>
      Effect.gen(function* () {
        const repo = yield* FiscalPeriodRepository
        const years = yield* repo.findFiscalYearsByCompany(testCompanyId)
        expect(years.length).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findById: returns fiscal period", () =>
      Effect.gen(function* () {
        const repo = yield* FiscalPeriodRepository
        const result = yield* repo.findById(testFiscalPeriodId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.periodNumber).toBe(1)
        }
      })
    )

    it.effect("findByFiscalYear: returns periods for fiscal year", () =>
      Effect.gen(function* () {
        const repo = yield* FiscalPeriodRepository
        const periods = yield* repo.findByFiscalYear(testFiscalYearId)
        expect(periods.length).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findOpen: returns open periods", () =>
      Effect.gen(function* () {
        const repo = yield* FiscalPeriodRepository
        const periods = yield* repo.findOpen(testCompanyId)
        expect(periods.every((p) => p.status === "Open")).toBe(true)
      })
    )
  })

  it.layer(TestLayer, { timeout: "60 seconds" })("ConsolidationRepository", (it) => {
    it.effect("setup: create test data", () =>
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        yield* sql`
          INSERT INTO organizations (id, name, reporting_currency, created_at)
          VALUES (${testOrgId}, 'Test Organization', 'USD', NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO companies (
            id, organization_id, name, legal_name, jurisdiction,
            functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
            is_active, created_at
          ) VALUES (
            ${testCompanyId}, ${testOrgId}, 'Parent Company', 'Parent Company LLC', 'US',
            'USD', 'USD', 12, 31, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO consolidation_groups (
            id, organization_id, name, parent_company_id, reporting_currency,
            consolidation_method, is_active, created_at
          ) VALUES (
            ${testGroupId}, ${testOrgId}, 'Test Consolidation Group', ${testCompanyId},
            'USD', 'FullConsolidation', true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findGroup: returns group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const result = yield* repo.findGroup(testGroupId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Test Consolidation Group")
        }
      })
    )

    it.effect("findGroupsByOrganization: returns groups for organization", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const groups = yield* repo.findGroupsByOrganization(testOrgId)
        expect(groups.length).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findActiveGroups: returns only active groups", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const groups = yield* repo.findActiveGroups(testOrgId)
        expect(groups.every((g) => g.isActive)).toBe(true)
      })
    )

    it.effect("groupExists: returns true for existing group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const exists = yield* repo.groupExists(testGroupId)
        expect(exists).toBe(true)
      })
    )

    it.effect("groupExists: returns false for non-existing group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const exists = yield* repo.groupExists(ConsolidationGroupId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )
  })

  it.layer(TestLayer, { timeout: "60 seconds" })("JournalEntryRepository", (it) => {
    it.effect("setup: create test data", () =>
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        yield* sql`
          INSERT INTO organizations (id, name, reporting_currency, created_at)
          VALUES (${testOrgId}, 'Test Organization', 'USD', NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO companies (
            id, organization_id, name, legal_name, jurisdiction,
            functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
            is_active, created_at
          ) VALUES (
            ${testCompanyId}, ${testOrgId}, 'Test Company', 'Test Company LLC', 'US',
            'USD', 'USD', 12, 31, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO fiscal_years (id, company_id, name, year, start_date, end_date, status, includes_adjustment_period, created_at)
          VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ${testCompanyId}, 'FY 2024', 2024, '2024-01-01', '2024-12-31', 'Open', false, NOW())
          ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO journal_entries (
            id, company_id, description, transaction_date, fiscal_year, fiscal_period,
            entry_type, source_module, is_multi_currency, status, is_reversing,
            created_by, created_at
          ) VALUES (
            ${testEntryId}, ${testCompanyId}, 'Test journal entry', '2024-01-15', 2024, 1,
            'Standard', 'GeneralLedger', false, 'Draft', false,
            '00000000-0000-0000-0000-000000000001', NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const result = yield* repo.findById(testEntryId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.description).toBe("Test journal entry")
        }
      })
    )

    it.effect("findByCompany: returns entries for company", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const entries = yield* repo.findByCompany(testCompanyId)
        expect(entries.length).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findByStatus: returns entries with specific status", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const drafts = yield* repo.findByStatus(testCompanyId, "Draft")
        expect(drafts.every((e) => e.status === "Draft")).toBe(true)
      })
    )

    it.effect("findDraftEntries: returns draft entries", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const drafts = yield* repo.findDraftEntries(testCompanyId)
        expect(drafts.every((e) => e.status === "Draft")).toBe(true)
      })
    )

    it.effect("exists: returns true for existing entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const exists = yield* repo.exists(testEntryId)
        expect(exists).toBe(true)
      })
    )
  })
})
