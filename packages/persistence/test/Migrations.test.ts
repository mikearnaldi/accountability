/**
 * Migration Tests
 *
 * Verifies that database migrations run successfully against a testcontainers
 * PostgreSQL instance.
 *
 * @module test/Migrations
 */

import { PgClient } from "@effect/sql-pg"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { PgContainer } from "./utils.ts"
import { MigrationLayer, runMigrations } from "../src/MigrationRunner.ts"

/**
 * Layer that provides PgClient with migrations run.
 * This is the pattern applications should use.
 */
const PgClientWithMigrations = MigrationLayer.pipe(
  Layer.provideMerge(PgContainer.ClientLive)
)

describe("Migrations", () => {
  it.layer(PgContainer.ClientLive, { timeout: "30 seconds" })(
    "runMigrations",
    (it) => {
      it.effect("runs all migrations successfully", () =>
        Effect.gen(function* () {
          const completed = yield* runMigrations

          // Should run all 8 migrations
          expect(completed).toHaveLength(8)

          // Verify migration order
          expect(completed[0]).toEqual([1, "CreateOrganizations"])
          expect(completed[1]).toEqual([2, "CreateCompanies"])
          expect(completed[2]).toEqual([3, "CreateAccounts"])
          expect(completed[3]).toEqual([4, "CreateFiscalPeriods"])
          expect(completed[4]).toEqual([5, "CreateJournalEntries"])
          expect(completed[5]).toEqual([6, "CreateExchangeRates"])
          expect(completed[6]).toEqual([7, "CreateConsolidation"])
          expect(completed[7]).toEqual([8, "CreateIntercompany"])
        })
      )

      it.effect("creates migrations tracking table", () =>
        Effect.gen(function* () {
          // Run migrations first
          yield* runMigrations

          const sql = yield* PgClient.PgClient

          // Check tracking table exists and has entries
          const rows = yield* sql<{
            migration_id: number
            name: string
          }>`SELECT migration_id, name FROM effect_sql_migrations ORDER BY migration_id`

          expect(rows).toHaveLength(8)
          expect(rows[0].migration_id).toBe(1)
          expect(rows[0].name).toBe("CreateOrganizations")
        })
      )

      it.effect("is idempotent - running twice does not re-run migrations", () =>
        Effect.gen(function* () {
          // Note: Previous tests in this layer block already ran migrations.
          // First call should return empty since migrations were already run
          const first = yield* runMigrations
          expect(first).toHaveLength(0)

          // Second call also returns empty
          const second = yield* runMigrations
          expect(second).toHaveLength(0)
        })
      )
    }
  )

  it.layer(PgClientWithMigrations, { timeout: "30 seconds" })(
    "MigrationLayer",
    (it) => {
      it.effect("creates organizations table with correct schema", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Verify table exists by describing it
          const columns = yield* sql<{
            column_name: string
            data_type: string
          }>`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'organizations'
            ORDER BY ordinal_position
          `

          const columnNames = columns.map((c) => c.column_name)
          expect(columnNames).toContain("id")
          expect(columnNames).toContain("name")
          expect(columnNames).toContain("reporting_currency")
          expect(columnNames).toContain("created_at")
          expect(columnNames).toContain("settings")
        })
      )

      it.effect("creates companies table with foreign key to organizations", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check foreign key exists
          const fks = yield* sql<{
            constraint_name: string
            column_name: string
          }>`
            SELECT tc.constraint_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'companies'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'organization_id'
          `

          expect(fks).toHaveLength(1)
          expect(fks[0].column_name).toBe("organization_id")
        })
      )

      it.effect("creates accounts table with proper enums", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check enum types exist
          const enums = yield* sql<{
            typname: string
          }>`
            SELECT typname FROM pg_type
            WHERE typname IN ('account_type', 'account_category', 'normal_balance', 'cash_flow_category')
          `

          const enumNames = enums.map((e) => e.typname)
          expect(enumNames).toContain("account_type")
          expect(enumNames).toContain("account_category")
          expect(enumNames).toContain("normal_balance")
          expect(enumNames).toContain("cash_flow_category")
        })
      )

      it.effect("creates fiscal_years and fiscal_periods tables", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check tables exist
          const tables = yield* sql<{
            table_name: string
          }>`
            SELECT table_name FROM information_schema.tables
            WHERE table_name IN ('fiscal_years', 'fiscal_periods')
          `

          expect(tables).toHaveLength(2)
        })
      )

      it.effect("creates journal_entries and journal_entry_lines tables", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          const tables = yield* sql<{
            table_name: string
          }>`
            SELECT table_name FROM information_schema.tables
            WHERE table_name IN ('journal_entries', 'journal_entry_lines')
          `

          expect(tables).toHaveLength(2)
        })
      )

      it.effect("creates exchange_rates table", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          const tables = yield* sql<{
            table_name: string
          }>`
            SELECT table_name FROM information_schema.tables
            WHERE table_name = 'exchange_rates'
          `

          expect(tables).toHaveLength(1)
        })
      )

      it.effect(
        "creates consolidation tables (consolidation_groups, consolidation_members, elimination_rules)",
        () =>
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            const tables = yield* sql<{
              table_name: string
            }>`
              SELECT table_name FROM information_schema.tables
              WHERE table_name IN ('consolidation_groups', 'consolidation_members', 'elimination_rules')
            `

            expect(tables).toHaveLength(3)
          })
      )

      it.effect("creates intercompany_transactions table", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          const tables = yield* sql<{
            table_name: string
          }>`
            SELECT table_name FROM information_schema.tables
            WHERE table_name = 'intercompany_transactions'
          `

          expect(tables).toHaveLength(1)
        })
      )

      it.effect("creates proper indexes on commonly queried fields", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check that key indexes exist
          const indexes = yield* sql<{
            indexname: string
            tablename: string
          }>`
            SELECT indexname, tablename FROM pg_indexes
            WHERE schemaname = 'public'
            AND (
              indexname LIKE 'idx_%_company_id' OR
              indexname LIKE 'idx_%_status' OR
              indexname LIKE 'idx_%_is_active'
            )
          `

          // Should have multiple indexes on company_id, status, and is_active
          expect(indexes.length).toBeGreaterThan(5)
        })
      )

      it.effect("creates update_updated_at trigger function", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check trigger function exists
          const funcs = yield* sql<{
            proname: string
          }>`
            SELECT proname FROM pg_proc
            WHERE proname = 'update_updated_at_column'
          `

          expect(funcs).toHaveLength(1)
        })
      )

      it.effect("can insert and query data after migrations", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Insert an organization
          yield* sql`
            INSERT INTO organizations (id, name, reporting_currency)
            VALUES ('11111111-1111-1111-1111-111111111111', 'Test Org', 'USD')
          `

          // Insert a company
          yield* sql`
            INSERT INTO companies (
              id, organization_id, name, legal_name, jurisdiction,
              functional_currency, reporting_currency,
              fiscal_year_end_month, fiscal_year_end_day
            ) VALUES (
              '22222222-2222-2222-2222-222222222222',
              '11111111-1111-1111-1111-111111111111',
              'Test Company', 'Test Company LLC', 'US',
              'USD', 'USD', 12, 31
            )
          `

          // Query it back
          const companies = yield* sql<{
            name: string
            legal_name: string
          }>`SELECT name, legal_name FROM companies`

          expect(companies).toHaveLength(1)
          expect(companies[0].name).toBe("Test Company")
        })
      )
    }
  )
})
