/**
 * Repository Integration Tests
 *
 * Comprehensive tests for all repository implementations against a testcontainers
 * PostgreSQL database. Uses the MigrationLayer to set up the schema before running tests.
 *
 * Coverage goals:
 * - All repository methods have unit tests
 * - Tests cover success and error paths
 * - Tests for CRUD operations on each entity
 * - Tests for findBy* queries with various filters
 * - Tests for edge cases (not found, duplicates, etc.)
 * - Tests use proper test fixtures and cleanup
 *
 * @module test/Repositories
 */

import { PgClient } from "@effect/sql-pg"
import { describe, expect, it } from "@effect/vitest"
import * as BigDecimal from "effect/BigDecimal"
import { Effect, Layer, Option } from "effect"
import { CompanyId } from "@accountability/core/company/Company"
import { AccountId } from "@accountability/core/accounting/Account"
import { AccountNumber } from "@accountability/core/accounting/AccountNumber"
import { Organization, OrganizationId, OrganizationSettings } from "@accountability/core/organization/Organization"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { OrganizationRepository } from "../src/Services/OrganizationRepository.ts"
import { OrganizationRepositoryLive } from "../src/Layers/OrganizationRepositoryLive.ts"
import { CompanyRepository } from "../src/Services/CompanyRepository.ts"
import { CompanyRepositoryLive } from "../src/Layers/CompanyRepositoryLive.ts"
import { AccountRepository } from "../src/Services/AccountRepository.ts"
import { AccountRepositoryLive } from "../src/Layers/AccountRepositoryLive.ts"
import { ExchangeRateRepository } from "../src/Services/ExchangeRateRepository.ts"
import { ExchangeRateRepositoryLive } from "../src/Layers/ExchangeRateRepositoryLive.ts"
import { JournalEntryRepository } from "../src/Services/JournalEntryRepository.ts"
import { JournalEntryRepositoryLive } from "../src/Layers/JournalEntryRepositoryLive.ts"
import { JournalEntryLineRepository } from "../src/Services/JournalEntryLineRepository.ts"
import { JournalEntryLineRepositoryLive } from "../src/Layers/JournalEntryLineRepositoryLive.ts"
import { ConsolidationRepository } from "../src/Services/ConsolidationRepository.ts"
import { ConsolidationRepositoryLive } from "../src/Layers/ConsolidationRepositoryLive.ts"
import { IntercompanyTransactionRepository } from "../src/Services/IntercompanyTransactionRepository.ts"
import { IntercompanyTransactionRepositoryLive } from "../src/Layers/IntercompanyTransactionRepositoryLive.ts"
import { EliminationRuleRepository } from "../src/Services/EliminationRuleRepository.ts"
import { EliminationRuleRepositoryLive } from "../src/Layers/EliminationRuleRepositoryLive.ts"
import { SharedPgClientLive } from "./Utils.ts"
import { ExchangeRateId } from "@accountability/core/currency/ExchangeRate"
import { ConsolidationGroupId, EliminationRuleId } from "@accountability/core/consolidation/ConsolidationGroup"
import { JournalEntryId, UserId } from "@accountability/core/journal/JournalEntry"
import { JournalEntryLineId, JournalEntryLine } from "@accountability/core/journal/JournalEntryLine"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { IntercompanyTransactionId } from "@accountability/core/consolidation/IntercompanyTransaction"
import {
  ConsolidatedTrialBalance,
  ConsolidatedTrialBalanceLineItem,
  ConsolidationRun,
  ConsolidationRunId,
  ConsolidationRunOptions
} from "@accountability/core/consolidation/ConsolidationRun"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { FiscalPeriodRef } from "@accountability/core/fiscal/FiscalPeriodRef"
import { EliminationRule } from "@accountability/core/consolidation/EliminationRule"
import * as Chunk from "effect/Chunk"

/**
 * Layer with all repositories.
 * Migrations are run globally in vitest.global-setup.ts to avoid race conditions.
 */
const TestLayer = Layer.mergeAll(
  OrganizationRepositoryLive,
  CompanyRepositoryLive,
  AccountRepositoryLive,
  JournalEntryRepositoryLive,
  JournalEntryLineRepositoryLive,
  ExchangeRateRepositoryLive,
  ConsolidationRepositoryLive,
  IntercompanyTransactionRepositoryLive,
  EliminationRuleRepositoryLive
).pipe(
  Layer.provideMerge(SharedPgClientLive)
)

// Test UUIDs - these are valid UUID format so validation passes
const testOrgId = OrganizationId.make("11111111-1111-1111-1111-111111111111")
const testOrgId2 = OrganizationId.make("11111111-1111-1111-1111-111111111112")
const testCompanyId = CompanyId.make("22222222-2222-2222-2222-222222222222")
const testCompanyId2 = CompanyId.make("33333333-3333-3333-3333-333333333333")
const testCompanyId3 = CompanyId.make("33333333-3333-3333-3333-333333333334")
const testAccountId = AccountId.make("44444444-4444-4444-4444-444444444444")
const testAccountId2 = AccountId.make("55555555-5555-5555-5555-555555555555")
const testAccountId3 = AccountId.make("55555555-5555-5555-5555-555555555556")
// Fiscal year UUID for test data setup (database still has fiscal_years table for journal entry references)
const testFiscalYearId2 = "cccccccc-cccc-cccc-cccc-cccccccccccd"
const testRateId = ExchangeRateId.make("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
const testRateId2 = ExchangeRateId.make("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef")
const testRateId3 = ExchangeRateId.make("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03")
const testGroupId = ConsolidationGroupId.make("ffffffff-ffff-ffff-ffff-ffffffffffff")
const testGroupId2 = ConsolidationGroupId.make("ffffffff-ffff-ffff-ffff-fffffffffff2")
const testEntryId = JournalEntryId.make("66666666-6666-6666-6666-666666666666")
const testEntryId2 = JournalEntryId.make("66666666-6666-6666-6666-666666666667")
const testEntryId3 = JournalEntryId.make("66666666-6666-6666-6666-666666666668")
const testLineId = JournalEntryLineId.make("aabbccdd-aabb-ccdd-aabb-ccddaabbccdd")
const testLineId2 = JournalEntryLineId.make("aabbccdd-aabb-ccdd-aabb-ccddaabbccde")
const testLineId3 = JournalEntryLineId.make("aabbccdd-aabb-ccdd-aabb-ccddaabbccdf")
const testLineId4 = JournalEntryLineId.make("aabbccdd-aabb-ccdd-aabb-ccddaabbcc04")
const testIntercompanyTxnId = IntercompanyTransactionId.make("77777777-7777-7777-7777-777777777777")
const testIntercompanyTxnId2 = IntercompanyTransactionId.make("77777777-7777-7777-7777-777777777778")
const testEliminationRuleId = EliminationRuleId.make("88888888-8888-8888-8888-888888888888")
const testEliminationRuleId2 = EliminationRuleId.make("88888888-8888-8888-8888-888888888889")
const testRunId = ConsolidationRunId.make("99999999-9999-9999-9999-999999999991")
const testRunId2 = ConsolidationRunId.make("99999999-9999-9999-9999-999999999992")
const testRunId3 = ConsolidationRunId.make("99999999-9999-9999-9999-999999999993")
const testRunId4 = ConsolidationRunId.make("99999999-9999-9999-9999-999999999994")
const nonExistentId = "99999999-9999-9999-9999-999999999999"
const testEliminationRuleId3 = EliminationRuleId.make("88888888-8888-8888-8888-88888888888a")
const testUserId = "00000000-0000-0000-0000-000000000002"

describe("Repositories", () => {
  // ============================================================================
  // OrganizationRepository Tests
  // ============================================================================
  it.layer(TestLayer, { timeout: "60 seconds" })("OrganizationRepository", (it) => {
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

    it.effect("findAll: returns all organizations", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        // Create second org
        const org2 = Organization.make({
          id: testOrgId2,
          name: "Second Organization",
          reportingCurrency: CurrencyCode.make("EUR"),
          createdAt: Timestamp.make({ epochMillis: Date.now() }),
          settings: OrganizationSettings.make({})
        })
        yield* repo.create(org2)

        const all = yield* repo.findAll()
        expect(all.length).toBeGreaterThanOrEqual(2)
      })
    )

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

    it.effect("update: updates an existing organization", () =>
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

    it.effect("delete: deletes an existing organization", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository
        // Delete org2
        yield* repo.delete(testOrgId2)
        const exists = yield* repo.exists(testOrgId2)
        expect(exists).toBe(false)
      })
    )
  })

  // ============================================================================
  // CompanyRepository Tests
  // ============================================================================
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
        yield* sql`
          INSERT INTO companies (
            id, organization_id, name, legal_name, jurisdiction,
            functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
            is_active, parent_company_id, created_at
          ) VALUES (
            ${testCompanyId3}, ${testOrgId}, 'Subsidiary Company', 'Subsidiary LLC', 'US',
            'USD', 'USD', 12, 31, false, ${testCompanyId}, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing company", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const result = yield* repo.findById(testOrgId, testCompanyId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Test Company")
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

    it.effect("findByOrganization: returns companies for organization", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const companies = yield* repo.findByOrganization(testOrgId)
        expect(companies.length).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findActiveByOrganization: returns only active companies", () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const active = yield* repo.findActiveByOrganization(testOrgId)
        expect(active.every((c) => c.isActive)).toBe(true)
        // Should not include the inactive company
        expect(active.some((c) => c.id === testCompanyId3)).toBe(false)
      })
    )
  })

  // ============================================================================
  // AccountRepository Tests
  // ============================================================================
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
        yield* sql`
          INSERT INTO accounts (
            id, company_id, account_number, name, account_type, account_category,
            normal_balance, hierarchy_level, parent_account_id, is_postable, is_cash_flow_relevant,
            is_intercompany, is_active, created_at
          ) VALUES (
            ${testAccountId2}, ${testCompanyId}, '1010', 'Petty Cash', 'Asset', 'CurrentAsset',
            'Debit', 2, ${testAccountId}, true, true, false, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO accounts (
            id, company_id, account_number, name, account_type, account_category,
            normal_balance, hierarchy_level, is_postable, is_cash_flow_relevant,
            is_intercompany, is_active, created_at
          ) VALUES (
            ${testAccountId3}, ${testCompanyId}, '9000', 'IC Receivable', 'Asset', 'CurrentAsset',
            'Debit', 1, true, false, true, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing account", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const result = yield* repo.findById(testOrgId, testAccountId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Cash")
        }
      })
    )

    it.effect("findByCompany: returns accounts for a company", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const accounts = yield* repo.findByCompany(testOrgId, testCompanyId)
        expect(accounts.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("findActiveByCompany: returns only active accounts", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const accounts = yield* repo.findActiveByCompany(testOrgId, testCompanyId)
        expect(accounts.every((a) => a.isActive)).toBe(true)
      })
    )

    it.effect("findByType: returns accounts of specific type", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const assets = yield* repo.findByType(testOrgId, testCompanyId, "Asset")
        expect(assets.every((a) => a.accountType === "Asset")).toBe(true)
      })
    )

    it.effect("findByNumber: returns account with specific number", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const result = yield* repo.findByNumber(testOrgId, testCompanyId, AccountNumber.make("1000"))
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Cash")
        }
      })
    )

    it.effect("findByNumber: returns None for non-existing number", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const result = yield* repo.findByNumber(testOrgId, testCompanyId, AccountNumber.make("9999"))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("findChildren: returns child accounts", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const children = yield* repo.findChildren(testOrgId, testAccountId)
        expect(children.length).toBeGreaterThanOrEqual(1)
        expect(children.some((a) => a.id === testAccountId2)).toBe(true)
      })
    )

    it.effect("findIntercompanyAccounts: returns intercompany accounts", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const icAccounts = yield* repo.findIntercompanyAccounts(testOrgId, testCompanyId)
        expect(icAccounts.length).toBeGreaterThanOrEqual(1)
        expect(icAccounts.every((a) => a.isIntercompany)).toBe(true)
      })
    )

    it.effect("isAccountNumberTaken: returns true for existing number", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const taken = yield* repo.isAccountNumberTaken(testOrgId, testCompanyId, AccountNumber.make("1000"))
        expect(taken).toBe(true)
      })
    )

    it.effect("isAccountNumberTaken: returns false for available number", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const taken = yield* repo.isAccountNumberTaken(testOrgId, testCompanyId, AccountNumber.make("9999"))
        expect(taken).toBe(false)
      })
    )

    it.effect("exists: returns true for existing account", () =>
      Effect.gen(function* () {
        const repo = yield* AccountRepository
        const exists = yield* repo.exists(testOrgId, testAccountId)
        expect(exists).toBe(true)
      })
    )
  })

  // ============================================================================
  // ExchangeRateRepository Tests
  // ============================================================================
  it.layer(TestLayer, { timeout: "60 seconds" })("ExchangeRateRepository", (it) => {
    it.effect("setup: create test exchange rates", () =>
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
        yield* sql`
          INSERT INTO exchange_rates (
            id, organization_id, from_currency, to_currency, rate, effective_date, rate_type, source, created_at
          ) VALUES (
            ${testRateId2}, ${testOrgId}, 'EUR', 'USD', '1.0900', '2024-01-20', 'Spot', 'Manual', NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO exchange_rates (
            id, organization_id, from_currency, to_currency, rate, effective_date, rate_type, source, created_at
          ) VALUES (
            ${testRateId3}, ${testOrgId}, 'GBP', 'USD', '1.2700', '2024-01-15', 'Spot', 'Manual', NOW()
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

    it.effect("findById: returns None for non-existing rate", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const result = yield* repo.findById(ExchangeRateId.make(nonExistentId))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("findByCurrencyPair: returns rates for currency pair", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const rates = yield* repo.findByCurrencyPair(
          CurrencyCode.make("EUR"),
          CurrencyCode.make("USD")
        )
        expect(rates.length).toBeGreaterThanOrEqual(2)
        expect(rates.every((r) => r.fromCurrency === "EUR" && r.toCurrency === "USD")).toBe(true)
      })
    )

    it.effect("findByDateRange: returns rates within date range", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const startDate = LocalDate.make({ year: 2024, month: 1, day: 10 })
        const endDate = LocalDate.make({ year: 2024, month: 1, day: 25 })
        const rates = yield* repo.findByDateRange(
          CurrencyCode.make("EUR"),
          CurrencyCode.make("USD"),
          startDate,
          endDate
        )
        expect(rates.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("findLatestRate: returns the most recent rate for currency pair", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const result = yield* repo.findLatestRate(
          CurrencyCode.make("EUR"),
          CurrencyCode.make("USD"),
          "Spot"
        )
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          // Should return a valid rate for the currency pair
          expect(result.value.effectiveDate.year).toBe(2024)
          expect(result.value.effectiveDate.month).toBe(1)
          expect(result.value.fromCurrency).toBe("EUR")
          expect(result.value.toCurrency).toBe("USD")
        }
      })
    )

    it.effect("findRate: returns rate for specific date and type", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const effectiveDate = LocalDate.make({ year: 2024, month: 1, day: 15 })
        const result = yield* repo.findRate(
          CurrencyCode.make("EUR"),
          CurrencyCode.make("USD"),
          effectiveDate,
          "Spot"
        )
        expect(Option.isSome(result)).toBe(true)
      })
    )

    it.effect("findClosestRate: returns closest rate for a date", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const date = LocalDate.make({ year: 2024, month: 1, day: 17 })
        const result = yield* repo.findClosestRate(
          CurrencyCode.make("EUR"),
          CurrencyCode.make("USD"),
          date,
          "Spot"
        )
        expect(Option.isSome(result)).toBe(true)
      })
    )

    it.effect("exists: returns true for existing rate", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const exists = yield* repo.exists(testRateId)
        expect(exists).toBe(true)
      })
    )

    it.effect("exists: returns false for non-existing rate", () =>
      Effect.gen(function* () {
        const repo = yield* ExchangeRateRepository
        const exists = yield* repo.exists(ExchangeRateId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )
  })

  // NOTE: FiscalPeriodRepository tests removed. Fiscal periods are now computed
  // from transaction dates at runtime rather than stored/validated against periods.

  // ============================================================================
  // JournalEntryRepository Tests
  // ============================================================================
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
        // Create fiscal year for journal entry tests
        yield* sql`
          INSERT INTO fiscal_years (id, company_id, name, year, start_date, end_date, status, includes_adjustment_period, created_at)
          VALUES (${testFiscalYearId2}, ${testCompanyId}, 'FY 2024', 2024, '2024-01-01', '2024-12-31', 'Open', false, NOW())
          ON CONFLICT (id) DO UPDATE SET status = 'Open'
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
        yield* sql`
          INSERT INTO journal_entries (
            id, company_id, description, transaction_date, fiscal_year, fiscal_period,
            entry_type, source_module, is_multi_currency, status, is_reversing,
            created_by, created_at
          ) VALUES (
            ${testEntryId2}, ${testCompanyId}, 'Posted entry', '2024-01-20', 2024, 1,
            'Standard', 'GeneralLedger', false, 'Posted', false,
            '00000000-0000-0000-0000-000000000001', NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO journal_entries (
            id, company_id, description, transaction_date, fiscal_year, fiscal_period,
            entry_type, source_module, is_multi_currency, status, is_reversing,
            created_by, created_at
          ) VALUES (
            ${testEntryId3}, ${testCompanyId}, 'Intercompany entry', '2024-02-01', 2024, 2,
            'Intercompany', 'GeneralLedger', false, 'Posted', false,
            '00000000-0000-0000-0000-000000000001', NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const result = yield* repo.findById(testOrgId, testEntryId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.description).toBe("Test journal entry")
        }
      })
    )

    it.effect("getById: throws EntityNotFoundError for non-existing entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const result = yield* Effect.either(
          repo.getById(testOrgId, JournalEntryId.make(nonExistentId))
        )
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    it.effect("findByCompany: returns entries for company", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const entries = yield* repo.findByCompany(testOrgId, testCompanyId)
        expect(entries.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("findByStatus: returns entries with specific status", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const drafts = yield* repo.findByStatus(testOrgId, testCompanyId, "Draft")
        expect(drafts.every((e) => e.status === "Draft")).toBe(true)
      })
    )

    it.effect("findByType: returns entries of specific type", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const standard = yield* repo.findByType(testOrgId, testCompanyId, "Standard")
        expect(standard.every((e) => e.entryType === "Standard")).toBe(true)
      })
    )

    it.effect("findDraftEntries: returns draft entries", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const drafts = yield* repo.findDraftEntries(testOrgId, testCompanyId)
        expect(drafts.every((e) => e.status === "Draft")).toBe(true)
      })
    )

    it.effect("findPostedByPeriod: returns posted entries for period", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const period = FiscalPeriodRef.make({ year: 2024, period: 1 })
        const posted = yield* repo.findPostedByPeriod(testOrgId, testCompanyId, period)
        expect(posted.every((e) => e.status === "Posted" && e.fiscalPeriod.period === 1)).toBe(true)
      })
    )

    it.effect("findByPeriod: returns entries for fiscal period", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const period = FiscalPeriodRef.make({ year: 2024, period: 1 })
        const entries = yield* repo.findByPeriod(testOrgId, testCompanyId, period)
        expect(entries.every((e) => e.fiscalPeriod.year === 2024 && e.fiscalPeriod.period === 1)).toBe(true)
      })
    )

    it.effect("findByPeriodRange: returns entries within period range", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const startPeriod = FiscalPeriodRef.make({ year: 2024, period: 1 })
        const endPeriod = FiscalPeriodRef.make({ year: 2024, period: 2 })
        const entries = yield* repo.findByPeriodRange(testOrgId, testCompanyId, startPeriod, endPeriod)
        expect(entries.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("countDraftEntriesInPeriod: returns count of draft entries", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const period = FiscalPeriodRef.make({ year: 2024, period: 1 })
        const count = yield* repo.countDraftEntriesInPeriod(testOrgId, testCompanyId, period)
        expect(count).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findIntercompanyEntries: returns intercompany entries", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const icEntries = yield* repo.findIntercompanyEntries(testOrgId, testCompanyId)
        expect(icEntries.every((e) => e.isIntercompanyEntry)).toBe(true)
      })
    )

    it.effect("exists: returns true for existing entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const exists = yield* repo.exists(testOrgId, testEntryId)
        expect(exists).toBe(true)
      })
    )

    it.effect("getNextEntryNumber: returns sequential entry number", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryRepository
        const nextNum = yield* repo.getNextEntryNumber(testOrgId, testCompanyId)
        expect(nextNum).toBeDefined()
        expect(typeof nextNum).toBe("string")
      })
    )
  })

  // ============================================================================
  // JournalEntryLineRepository Tests
  // ============================================================================
  it.layer(TestLayer, { timeout: "60 seconds" })("JournalEntryLineRepository", (it) => {
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
        yield* sql`
          INSERT INTO accounts (
            id, company_id, account_number, name, account_type, account_category,
            normal_balance, hierarchy_level, is_postable, is_cash_flow_relevant,
            is_intercompany, is_active, created_at
          ) VALUES (
            ${testAccountId2}, ${testCompanyId}, '2000', 'Accounts Payable', 'Liability', 'CurrentLiability',
            'Credit', 1, true, false, false, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO journal_entries (
            id, company_id, description, transaction_date, fiscal_year, fiscal_period,
            entry_type, source_module, is_multi_currency, status, is_reversing,
            created_by, created_at
          ) VALUES (
            ${testEntryId}, ${testCompanyId}, 'Test entry for lines', '2024-01-15', 2024, 1,
            'Standard', 'GeneralLedger', false, 'Draft', false,
            '00000000-0000-0000-0000-000000000001', NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO journal_entries (
            id, company_id, description, transaction_date, fiscal_year, fiscal_period,
            entry_type, source_module, is_multi_currency, status, is_reversing,
            created_by, created_at
          ) VALUES (
            ${testEntryId2}, ${testCompanyId}, 'Second entry for lines', '2024-01-20', 2024, 1,
            'Standard', 'GeneralLedger', false, 'Draft', false,
            '00000000-0000-0000-0000-000000000001', NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO journal_entry_lines (
            id, journal_entry_id, line_number, account_id,
            debit_amount, debit_currency, credit_amount, credit_currency,
            functional_debit_amount, functional_debit_currency,
            functional_credit_amount, functional_credit_currency,
            exchange_rate, memo
          ) VALUES (
            ${testLineId}, ${testEntryId}, 1, ${testAccountId},
            '1000.00', 'USD', NULL, NULL,
            '1000.00', 'USD', NULL, NULL,
            '1.0000', 'Debit line'
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO journal_entry_lines (
            id, journal_entry_id, line_number, account_id,
            debit_amount, debit_currency, credit_amount, credit_currency,
            functional_debit_amount, functional_debit_currency,
            functional_credit_amount, functional_credit_currency,
            exchange_rate, memo
          ) VALUES (
            ${testLineId2}, ${testEntryId}, 2, ${testAccountId2},
            NULL, NULL, '1000.00', 'USD',
            NULL, NULL, '1000.00', 'USD',
            '1.0000', 'Credit line'
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findByJournalEntry: returns lines for journal entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const lines = yield* repo.findByJournalEntry(testEntryId)
        expect(lines.length).toBe(2)
        expect(lines[0].lineNumber).toBe(1)
        expect(lines[1].lineNumber).toBe(2)
      })
    )

    it.effect("findByJournalEntry: returns empty array for entry without lines", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const lines = yield* repo.findByJournalEntry(testEntryId2)
        expect(lines.length).toBe(0)
      })
    )

    it.effect("findByJournalEntries: returns lines grouped by entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const linesMap = yield* repo.findByJournalEntries([testEntryId, testEntryId2])
        expect(linesMap.get(testEntryId)?.length).toBe(2)
        expect(linesMap.get(testEntryId2)?.length ?? 0).toBe(0)
      })
    )

    it.effect("findByJournalEntries: returns empty map for empty input", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const linesMap = yield* repo.findByJournalEntries([])
        expect(linesMap.size).toBe(0)
      })
    )

    it.effect("getById: returns specific line", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const line = yield* repo.getById(testLineId)
        expect(line.id).toBe(testLineId)
        expect(line.lineNumber).toBe(1)
        expect(Option.isSome(line.debitAmount)).toBe(true)
      })
    )

    it.effect("getById: throws EntityNotFoundError for non-existing line", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const result = yield* Effect.either(
          repo.getById(JournalEntryLineId.make(nonExistentId))
        )
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    it.effect("findByAccount: returns lines for account", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const lines = yield* repo.findByAccount(testAccountId)
        expect(lines.length).toBeGreaterThanOrEqual(1)
        expect(lines.every((l) => l.accountId === testAccountId)).toBe(true)
      })
    )

    it.effect("createMany: creates multiple lines", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository

        const newLine1 = JournalEntryLine.make({
          id: testLineId3,
          journalEntryId: testEntryId2,
          lineNumber: 1,
          accountId: testAccountId,
          debitAmount: Option.some(MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("500.00"),
            currency: CurrencyCode.make("USD")
          })),
          creditAmount: Option.none(),
          functionalCurrencyDebitAmount: Option.some(MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("500.00"),
            currency: CurrencyCode.make("USD")
          })),
          functionalCurrencyCreditAmount: Option.none(),
          exchangeRate: BigDecimal.unsafeFromString("1.0000"),
          memo: Option.some("New debit line"),
          dimensions: Option.none(),
          intercompanyPartnerId: Option.none(),
          matchingLineId: Option.none()
        })

        const newLine2 = JournalEntryLine.make({
          id: testLineId4,
          journalEntryId: testEntryId2,
          lineNumber: 2,
          accountId: testAccountId2,
          debitAmount: Option.none(),
          creditAmount: Option.some(MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("500.00"),
            currency: CurrencyCode.make("USD")
          })),
          functionalCurrencyDebitAmount: Option.none(),
          functionalCurrencyCreditAmount: Option.some(MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("500.00"),
            currency: CurrencyCode.make("USD")
          })),
          exchangeRate: BigDecimal.unsafeFromString("1.0000"),
          memo: Option.some("New credit line"),
          dimensions: Option.none(),
          intercompanyPartnerId: Option.none(),
          matchingLineId: Option.none()
        })

        const created = yield* repo.createMany([newLine1, newLine2])
        expect(created.length).toBe(2)

        // Verify persisted
        const lines = yield* repo.findByJournalEntry(testEntryId2)
        expect(lines.length).toBe(2)
      })
    )

    it.effect("createMany: returns empty array for empty input", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const created = yield* repo.createMany([])
        expect(created.length).toBe(0)
      })
    )

    it.effect("updateMany: updates existing lines", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository
        const line = yield* repo.getById(testLineId3)

        const updatedLine = JournalEntryLine.make({
          ...line,
          memo: Option.some("Updated memo")
        })

        yield* repo.updateMany([updatedLine])

        const fetched = yield* repo.getById(testLineId3)
        expect(Option.getOrNull(fetched.memo)).toBe("Updated memo")
      })
    )

    it.effect("deleteByJournalEntry: deletes all lines for entry", () =>
      Effect.gen(function* () {
        const repo = yield* JournalEntryLineRepository

        // First verify lines exist
        const linesBefore = yield* repo.findByJournalEntry(testEntryId2)
        expect(linesBefore.length).toBeGreaterThan(0)

        yield* repo.deleteByJournalEntry(testEntryId2)

        const linesAfter = yield* repo.findByJournalEntry(testEntryId2)
        expect(linesAfter.length).toBe(0)
      })
    )
  })

  // ============================================================================
  // ConsolidationRepository Tests
  // ============================================================================
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
        yield* sql`
          INSERT INTO consolidation_groups (
            id, organization_id, name, parent_company_id, reporting_currency,
            consolidation_method, is_active, created_at
          ) VALUES (
            ${testGroupId2}, ${testOrgId}, 'Inactive Group', ${testCompanyId},
            'USD', 'FullConsolidation', false, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO consolidation_runs (
            id, consolidation_group_id, fiscal_year, fiscal_period, as_of_date,
            status, initiated_by, initiated_at, created_at
          ) VALUES (
            ${testRunId}, ${testGroupId}, 2024, 1, '2024-03-31',
            'Completed', '00000000-0000-0000-0000-000000000001', NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
        yield* sql`
          INSERT INTO consolidation_runs (
            id, consolidation_group_id, fiscal_year, fiscal_period, as_of_date,
            status, initiated_by, initiated_at, created_at
          ) VALUES (
            ${testRunId2}, ${testGroupId}, 2024, 2, '2024-06-30',
            'InProgress', '00000000-0000-0000-0000-000000000001', NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findGroup: returns group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const result = yield* repo.findGroup(testOrgId, testGroupId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("Test Consolidation Group")
        }
      })
    )

    it.effect("findGroup: returns None for non-existing group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const result = yield* repo.findGroup(testOrgId, ConsolidationGroupId.make(nonExistentId))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("getGroup: throws for non-existing group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const result = yield* Effect.either(
          repo.getGroup(testOrgId, ConsolidationGroupId.make(nonExistentId))
        )
        expect(result._tag).toBe("Left")
      })
    )

    it.effect("findGroupsByOrganization: returns groups for organization", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const groups = yield* repo.findGroupsByOrganization(testOrgId)
        expect(groups.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("findActiveGroups: returns only active groups", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const groups = yield* repo.findActiveGroups(testOrgId)
        expect(groups.every((g) => g.isActive)).toBe(true)
        expect(groups.some((g) => g.id === testGroupId2)).toBe(false)
      })
    )

    it.effect("groupExists: returns true for existing group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const exists = yield* repo.groupExists(testOrgId, testGroupId)
        expect(exists).toBe(true)
      })
    )

    it.effect("groupExists: returns false for non-existing group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const exists = yield* repo.groupExists(testOrgId, ConsolidationGroupId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )

    // Consolidation Run tests
    it.effect("findRun: returns run", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const result = yield* repo.findRun(testOrgId, testRunId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.periodRef.year).toBe(2024)
          expect(result.value.periodRef.period).toBe(1)
        }
      })
    )

    it.effect("findRunsByGroup: returns runs for group", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const runs = yield* repo.findRunsByGroup(testOrgId, testGroupId)
        expect(runs.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("findRunsByStatus: returns runs with specific status", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const completed = yield* repo.findRunsByStatus(testOrgId, testGroupId, "Completed")
        expect(completed.every((r) => r.status === "Completed")).toBe(true)
      })
    )

    it.effect("findInProgressRuns: returns in-progress runs", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const inProgress = yield* repo.findInProgressRuns(testOrgId, testGroupId)
        expect(inProgress.every((r) => r.status === "InProgress")).toBe(true)
      })
    )

    it.effect("findLatestCompletedRun: returns the most recent completed run", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const result = yield* repo.findLatestCompletedRun(testOrgId, testGroupId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.status).toBe("Completed")
        }
      })
    )

    it.effect("findRunByGroupAndPeriod: returns run for specific period", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const period = FiscalPeriodRef.make({ year: 2024, period: 1 })
        const result = yield* repo.findRunByGroupAndPeriod(testOrgId, testGroupId, period)
        expect(Option.isSome(result)).toBe(true)
      })
    )

    it.effect("findRunsByPeriodRange: returns runs within period range", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const startPeriod = FiscalPeriodRef.make({ year: 2024, period: 1 })
        const endPeriod = FiscalPeriodRef.make({ year: 2024, period: 2 })
        const runs = yield* repo.findRunsByPeriodRange(testOrgId, testGroupId, startPeriod, endPeriod)
        expect(runs.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("runExists: returns true for existing run", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const exists = yield* repo.runExists(testOrgId, testRunId)
        expect(exists).toBe(true)
      })
    )

    // Consolidated Trial Balance CRUD tests
    it.effect("createRun: creates run with consolidated trial balance", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository

        const lineItem = ConsolidatedTrialBalanceLineItem.make({
          accountNumber: "1000",
          accountName: "Cash",
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          aggregatedBalance: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("100000.00"),
            currency: CurrencyCode.make("USD")
          }),
          eliminationAmount: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          nciAmount: Option.none(),
          consolidatedBalance: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("100000.00"),
            currency: CurrencyCode.make("USD")
          })
        })

        const trialBalance = ConsolidatedTrialBalance.make({
          consolidationRunId: testRunId3,
          groupId: testGroupId,
          periodRef: FiscalPeriodRef.make({ year: 2024, period: 3 }),
          asOfDate: LocalDate.make({ year: 2024, month: 9, day: 30 }),
          currency: CurrencyCode.make("USD"),
          lineItems: Chunk.make(lineItem),
          totalDebits: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("100000.00"),
            currency: CurrencyCode.make("USD")
          }),
          totalCredits: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("100000.00"),
            currency: CurrencyCode.make("USD")
          }),
          totalEliminations: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          totalNCI: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          generatedAt: Timestamp.make({ epochMillis: Date.now() })
        })

        const run = ConsolidationRun.make({
          id: testRunId3,
          groupId: testGroupId,
          periodRef: FiscalPeriodRef.make({ year: 2024, period: 3 }),
          asOfDate: LocalDate.make({ year: 2024, month: 9, day: 30 }),
          status: "Completed",
          steps: Chunk.empty(),
          validationResult: Option.none(),
          consolidatedTrialBalance: Option.some(trialBalance),
          eliminationEntryIds: Chunk.empty(),
          options: ConsolidationRunOptions.make({}),
          initiatedBy: UserId.make(testUserId),
          initiatedAt: Timestamp.make({ epochMillis: Date.now() }),
          startedAt: Option.some(Timestamp.make({ epochMillis: Date.now() })),
          completedAt: Option.some(Timestamp.make({ epochMillis: Date.now() })),
          totalDurationMs: Option.some(1000),
          errorMessage: Option.none()
        })

        const created = yield* repo.createRun(run)
        expect(created.id).toBe(testRunId3)
        expect(Option.isSome(created.consolidatedTrialBalance)).toBe(true)
      })
    )

    it.effect("findRun: retrieves run with consolidated trial balance", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository
        const result = yield* repo.findRun(testOrgId, testRunId3)

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const run = result.value
          expect(Option.isSome(run.consolidatedTrialBalance)).toBe(true)

          if (Option.isSome(run.consolidatedTrialBalance)) {
            const tb = run.consolidatedTrialBalance.value
            expect(tb.currency).toBe("USD")
            expect(tb.periodRef.year).toBe(2024)
            expect(tb.periodRef.period).toBe(3)
            expect(Chunk.size(tb.lineItems)).toBe(1)

            const lineItem = Chunk.get(tb.lineItems, 0)
            if (Option.isSome(lineItem)) {
              expect(lineItem.value.accountNumber).toBe("1000")
              expect(lineItem.value.accountName).toBe("Cash")
              expect(lineItem.value.accountType).toBe("Asset")
            }
          }
        }
      })
    )

    it.effect("updateRun: updates run with new consolidated trial balance", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository

        // First get the existing run
        const existingResult = yield* repo.findRun(testOrgId, testRunId3)
        expect(Option.isSome(existingResult)).toBe(true)
        const existingRun = Option.getOrThrow(existingResult)

        // Create updated trial balance with an additional line item
        const newLineItem = ConsolidatedTrialBalanceLineItem.make({
          accountNumber: "2000",
          accountName: "Accounts Payable",
          accountType: "Liability",
          accountCategory: "CurrentLiability",
          aggregatedBalance: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("50000.00"),
            currency: CurrencyCode.make("USD")
          }),
          eliminationAmount: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          nciAmount: Option.none(),
          consolidatedBalance: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("50000.00"),
            currency: CurrencyCode.make("USD")
          })
        })

        // Get existing line items
        const existingTB = Option.getOrThrow(existingRun.consolidatedTrialBalance)
        const updatedLineItems = Chunk.append(existingTB.lineItems, newLineItem)

        const updatedTrialBalance = ConsolidatedTrialBalance.make({
          ...existingTB,
          lineItems: updatedLineItems,
          totalCredits: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("150000.00"),
            currency: CurrencyCode.make("USD")
          })
        })

        const updatedRun = ConsolidationRun.make({
          ...existingRun,
          consolidatedTrialBalance: Option.some(updatedTrialBalance)
        })

        yield* repo.updateRun(testOrgId, updatedRun)

        // Verify the update
        const result = yield* repo.findRun(testOrgId, testRunId3)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const tb = Option.getOrThrow(result.value.consolidatedTrialBalance)
          expect(Chunk.size(tb.lineItems)).toBe(2)
        }
      })
    )

    it.effect("createRun: creates run without trial balance", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository

        const run = ConsolidationRun.make({
          id: testRunId4,
          groupId: testGroupId,
          periodRef: FiscalPeriodRef.make({ year: 2024, period: 4 }),
          asOfDate: LocalDate.make({ year: 2024, month: 12, day: 31 }),
          status: "InProgress",
          steps: Chunk.empty(),
          validationResult: Option.none(),
          consolidatedTrialBalance: Option.none(),
          eliminationEntryIds: Chunk.empty(),
          options: ConsolidationRunOptions.make({}),
          initiatedBy: UserId.make(testUserId),
          initiatedAt: Timestamp.make({ epochMillis: Date.now() }),
          startedAt: Option.none(),
          completedAt: Option.none(),
          totalDurationMs: Option.none(),
          errorMessage: Option.none()
        })

        const created = yield* repo.createRun(run)
        expect(created.id).toBe(testRunId4)
        expect(Option.isNone(created.consolidatedTrialBalance)).toBe(true)

        // Verify it can be retrieved without trial balance
        const result = yield* repo.findRun(testOrgId, testRunId4)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(Option.isNone(result.value.consolidatedTrialBalance)).toBe(true)
        }
      })
    )

    it.effect("updateRun: can add trial balance to run that didn't have one", () =>
      Effect.gen(function* () {
        const repo = yield* ConsolidationRepository

        // Get run without trial balance
        const existingResult = yield* repo.findRun(testOrgId, testRunId4)
        const existingRun = Option.getOrThrow(existingResult)
        expect(Option.isNone(existingRun.consolidatedTrialBalance)).toBe(true)

        // Create a trial balance
        const trialBalance = ConsolidatedTrialBalance.make({
          consolidationRunId: testRunId4,
          groupId: testGroupId,
          periodRef: FiscalPeriodRef.make({ year: 2024, period: 4 }),
          asOfDate: LocalDate.make({ year: 2024, month: 12, day: 31 }),
          currency: CurrencyCode.make("USD"),
          lineItems: Chunk.empty(),
          totalDebits: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          totalCredits: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          totalEliminations: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          totalNCI: MonetaryAmount.make({
            amount: BigDecimal.unsafeFromString("0.00"),
            currency: CurrencyCode.make("USD")
          }),
          generatedAt: Timestamp.make({ epochMillis: Date.now() })
        })

        const updatedRun = ConsolidationRun.make({
          ...existingRun,
          status: "Completed",
          consolidatedTrialBalance: Option.some(trialBalance),
          completedAt: Option.some(Timestamp.make({ epochMillis: Date.now() }))
        })

        yield* repo.updateRun(testOrgId, updatedRun)

        // Verify trial balance was added
        const result = yield* repo.findRun(testOrgId, testRunId4)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(Option.isSome(result.value.consolidatedTrialBalance)).toBe(true)
        }
      })
    )
  })

  // ============================================================================
  // IntercompanyTransactionRepository Tests
  // ============================================================================
  it.layer(TestLayer, { timeout: "60 seconds" })("IntercompanyTransactionRepository", (it) => {
    it.effect("setup: create test data for intercompany transactions", () =>
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
            ${testCompanyId}, ${testOrgId}, 'Seller Company', 'Seller Company LLC', 'US',
            'USD', 'USD', 12, 31, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `

        yield* sql`
          INSERT INTO companies (
            id, organization_id, name, legal_name, jurisdiction,
            functional_currency, reporting_currency, fiscal_year_end_month, fiscal_year_end_day,
            is_active, created_at
          ) VALUES (
            ${testCompanyId2}, ${testOrgId}, 'Buyer Company', 'Buyer Company LLC', 'US',
            'USD', 'USD', 12, 31, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `

        yield* sql`
          INSERT INTO intercompany_transactions (
            id, from_company_id, to_company_id, transaction_type, transaction_date,
            amount, matching_status, created_at, updated_at
          ) VALUES (
            ${testIntercompanyTxnId}, ${testCompanyId}, ${testCompanyId2}, 'SalePurchase', '2024-01-15',
            '{"amount": "10000.00", "currency": "USD"}', 'Unmatched', NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING
        `

        yield* sql`
          INSERT INTO intercompany_transactions (
            id, from_company_id, to_company_id, transaction_type, transaction_date,
            amount, matching_status, created_at, updated_at
          ) VALUES (
            ${testIntercompanyTxnId2}, ${testCompanyId2}, ${testCompanyId}, 'Loan', '2024-01-20',
            '{"amount": "50000.00", "currency": "USD"}', 'Matched', NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing transaction", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const result = yield* repo.findById(testIntercompanyTxnId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.transactionType).toBe("SalePurchase")
          expect(result.value.matchingStatus).toBe("Unmatched")
        }
      })
    )

    it.effect("findById: returns None for non-existing transaction", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const result = yield* repo.findById(IntercompanyTransactionId.make(nonExistentId))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("getById: throws EntityNotFoundError for non-existing transaction", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const result = yield* Effect.either(repo.getById(IntercompanyTransactionId.make(nonExistentId)))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    it.effect("findByFromCompany: returns transactions for seller company", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const transactions = yield* repo.findByFromCompany(testCompanyId)
        expect(transactions.length).toBeGreaterThanOrEqual(1)
        expect(transactions.every((t) => t.fromCompanyId === testCompanyId)).toBe(true)
      })
    )

    it.effect("findByToCompany: returns transactions for buyer company", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const transactions = yield* repo.findByToCompany(testCompanyId2)
        expect(transactions.length).toBeGreaterThanOrEqual(1)
        expect(transactions.every((t) => t.toCompanyId === testCompanyId2)).toBe(true)
      })
    )

    it.effect("findByCompany: returns all transactions involving a company", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const transactions = yield* repo.findByCompany(testCompanyId)
        expect(transactions.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("findBetweenCompanies: returns transactions between two companies", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const transactions = yield* repo.findBetweenCompanies(testCompanyId, testCompanyId2)
        expect(transactions.length).toBeGreaterThanOrEqual(1)
      })
    )

    it.effect("findByMatchingStatus: returns transactions by status", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const unmatched = yield* repo.findByMatchingStatus("Unmatched")
        expect(unmatched.every((t) => t.matchingStatus === "Unmatched")).toBe(true)
      })
    )

    it.effect("findByTransactionType: returns transactions by type", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const loans = yield* repo.findByTransactionType("Loan")
        expect(loans.every((t) => t.transactionType === "Loan")).toBe(true)
      })
    )

    it.effect("findUnmatched: returns unmatched transactions", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const unmatched = yield* repo.findUnmatched()
        expect(unmatched.every((t) => t.matchingStatus === "Unmatched")).toBe(true)
      })
    )

    it.effect("findByDateRange: returns transactions in date range", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const startDate = LocalDate.make({ year: 2024, month: 1, day: 1 })
        const endDate = LocalDate.make({ year: 2024, month: 1, day: 31 })
        const transactions = yield* repo.findByDateRange(
          startDate,
          endDate
        )
        expect(transactions.length).toBeGreaterThanOrEqual(2)
      })
    )

    it.effect("exists: returns true for existing transaction", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const exists = yield* repo.exists(testIntercompanyTxnId)
        expect(exists).toBe(true)
      })
    )

    it.effect("exists: returns false for non-existing transaction", () =>
      Effect.gen(function* () {
        const repo = yield* IntercompanyTransactionRepository
        const exists = yield* repo.exists(IntercompanyTransactionId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )
  })

  // ============================================================================
  // EliminationRuleRepository Tests
  // ============================================================================
  it.layer(TestLayer, { timeout: "60 seconds" })("EliminationRuleRepository", (it) => {
    it.effect("setup: create test data for elimination rules", () =>
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
          INSERT INTO accounts (
            id, company_id, account_number, name, account_type, account_category,
            normal_balance, hierarchy_level, is_postable, is_cash_flow_relevant,
            is_intercompany, is_active, created_at
          ) VALUES (
            ${testAccountId}, ${testCompanyId}, '9010', 'IC Receivable', 'Asset', 'CurrentAsset',
            'Debit', 1, true, false, true, true, NOW()
          ) ON CONFLICT (id) DO NOTHING
        `

        yield* sql`
          INSERT INTO accounts (
            id, company_id, account_number, name, account_type, account_category,
            normal_balance, hierarchy_level, is_postable, is_cash_flow_relevant,
            is_intercompany, is_active, created_at
          ) VALUES (
            ${testAccountId2}, ${testCompanyId}, '9020', 'IC Payable', 'Liability', 'CurrentLiability',
            'Credit', 1, true, false, true, true, NOW()
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

        yield* sql`
          INSERT INTO elimination_rules (
            id, consolidation_group_id, name, description, elimination_type,
            trigger_conditions, source_accounts, target_accounts,
            debit_account_id, credit_account_id, is_automatic, priority, is_active
          ) VALUES (
            ${testEliminationRuleId}, ${testGroupId}, 'IC Receivable/Payable Elimination',
            'Eliminates intercompany receivables and payables', 'IntercompanyReceivablePayable',
            '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
            ${testAccountId}, ${testAccountId2}, true, 10, true
          ) ON CONFLICT (id) DO NOTHING
        `

        yield* sql`
          INSERT INTO elimination_rules (
            id, consolidation_group_id, name, description, elimination_type,
            trigger_conditions, source_accounts, target_accounts,
            debit_account_id, credit_account_id, is_automatic, priority, is_active
          ) VALUES (
            ${testEliminationRuleId2}, ${testGroupId}, 'Manual Revenue Elimination',
            'Manually eliminates intercompany revenue', 'IntercompanyRevenueExpense',
            '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
            ${testAccountId}, ${testAccountId2}, false, 50, false
          ) ON CONFLICT (id) DO NOTHING
        `
      })
    )

    it.effect("findById: returns Some for existing rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const result = yield* repo.findById(testEliminationRuleId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.name).toBe("IC Receivable/Payable Elimination")
          expect(result.value.eliminationType).toBe("IntercompanyReceivablePayable")
        }
      })
    )

    it.effect("findById: returns None for non-existing rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const result = yield* repo.findById(EliminationRuleId.make(nonExistentId))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("getById: throws EntityNotFoundError for non-existing rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const result = yield* Effect.either(repo.getById(EliminationRuleId.make(nonExistentId)))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    it.effect("findByConsolidationGroup: returns rules for group", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rules = yield* repo.findByConsolidationGroup(testGroupId)
        expect(rules.length).toBeGreaterThanOrEqual(2)
        expect(rules.every((r) => r.consolidationGroupId === testGroupId)).toBe(true)
      })
    )

    it.effect("findActiveByConsolidationGroup: returns only active rules", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rules = yield* repo.findActiveByConsolidationGroup(testGroupId)
        expect(rules.every((r) => r.isActive)).toBe(true)
        expect(rules.some((r) => r.id === testEliminationRuleId2)).toBe(false)
      })
    )

    it.effect("findAutomaticByConsolidationGroup: returns only automatic rules", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rules = yield* repo.findAutomaticByConsolidationGroup(testGroupId)
        expect(rules.every((r) => r.isAutomatic)).toBe(true)
      })
    )

    it.effect("findByType: returns rules by elimination type", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rules = yield* repo.findByType(testGroupId, "IntercompanyReceivablePayable")
        expect(rules.every((r) => r.eliminationType === "IntercompanyReceivablePayable")).toBe(true)
      })
    )

    it.effect("findHighPriority: returns high priority rules", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rules = yield* repo.findHighPriority(testGroupId)
        expect(rules.every((r) => r.priority <= 10)).toBe(true)
      })
    )

    it.effect("exists: returns true for existing rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const exists = yield* repo.exists(testEliminationRuleId)
        expect(exists).toBe(true)
      })
    )

    it.effect("exists: returns false for non-existing rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const exists = yield* repo.exists(EliminationRuleId.make(nonExistentId))
        expect(exists).toBe(false)
      })
    )

    // Additional CRUD tests using SQL-based setup to avoid schema mismatches
    it.effect("create: creates a new elimination rule via repository", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rule = EliminationRule.make({
          id: testEliminationRuleId3,
          consolidationGroupId: testGroupId,
          name: "Created Rule",
          description: Option.some("A test rule"),
          eliminationType: "IntercompanyDividend",
          triggerConditions: Chunk.empty(),
          sourceAccounts: Chunk.empty(),
          targetAccounts: Chunk.empty(),
          debitAccountId: testAccountId,
          creditAccountId: testAccountId2,
          isAutomatic: true,
          priority: 15,
          isActive: true
        })
        const created = yield* repo.create(rule)
        expect(created.name).toBe("Created Rule")
        expect(created.eliminationType).toBe("IntercompanyDividend")
      })
    )

    it.effect("update: updates an existing rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rule = yield* repo.getById(testEliminationRuleId3)
        const updated = EliminationRule.make({
          ...rule,
          name: "Updated Rule Name"
        })
        const result = yield* repo.update(updated)
        expect(result.name).toBe("Updated Rule Name")
      })
    )

    it.effect("activate: activates a rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        yield* repo.deactivate(testEliminationRuleId3)
        const activated = yield* repo.activate(testEliminationRuleId3)
        expect(activated.isActive).toBe(true)
      })
    )

    it.effect("deactivate: deactivates a rule", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const result = yield* repo.deactivate(testEliminationRuleId3)
        expect(result.isActive).toBe(false)
      })
    )

    it.effect("updatePriority: updates rule priority", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const result = yield* repo.updatePriority(testEliminationRuleId3, 5)
        expect(result.priority).toBe(5)
      })
    )

    it.effect("delete: deletes a rule via repository", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        yield* repo.delete(testEliminationRuleId3)
        const exists = yield* repo.exists(testEliminationRuleId3)
        expect(exists).toBe(false)
      })
    )

    it.effect("createMany: creates multiple rules", () =>
      Effect.gen(function* () {
        const repo = yield* EliminationRuleRepository
        const rules = [
          EliminationRule.make({
            id: EliminationRuleId.make("88888888-8888-8888-8888-88888888888b"),
            consolidationGroupId: testGroupId,
            name: "Batch Rule 1",
            description: Option.none(),
            eliminationType: "UnrealizedProfitInventory",
            triggerConditions: Chunk.empty(),
            sourceAccounts: Chunk.empty(),
            targetAccounts: Chunk.empty(),
            debitAccountId: testAccountId,
            creditAccountId: testAccountId2,
            isAutomatic: false,
            priority: 30,
            isActive: true
          })
        ]
        const created = yield* repo.createMany(rules)
        expect(created.length).toBe(1)
        expect(created[0].name).toBe("Batch Rule 1")
      })
    )
  })
})
