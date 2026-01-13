/**
 * Migration Tests
 *
 * Verifies that database migrations run successfully against a testcontainers
 * PostgreSQL instance.
 *
 * @module test/Migrations
 */

import { PgClient } from "@effect/sql-pg"
import { SqlSchema } from "@effect/sql"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Schema } from "effect"
import { SharedPgClientLive } from "./Utils.ts"
import { MigrationLayer, runMigrations } from "../src/Layers/MigrationsLive.ts"

/**
 * Layer that provides PgClient with migrations run.
 * This is the pattern applications should use.
 */
const PgClientWithMigrations = MigrationLayer.pipe(
  Layer.provideMerge(SharedPgClientLive)
)

/**
 * Reusable row schemas for migration tests
 */
const MigrationRow = Schema.Struct({
  migration_id: Schema.Number,
  name: Schema.String
})

const ColumnInfoRow = Schema.Struct({
  column_name: Schema.String,
  data_type: Schema.String
})

const ConstraintRow = Schema.Struct({
  constraint_name: Schema.String,
  column_name: Schema.String
})

const TypeNameRow = Schema.Struct({
  typname: Schema.String
})

const TableNameRow = Schema.Struct({
  table_name: Schema.String
})

const IndexRow = Schema.Struct({
  indexname: Schema.String,
  tablename: Schema.String
})

const FunctionRow = Schema.Struct({
  proname: Schema.String
})

const CompanyRow = Schema.Struct({
  name: Schema.String,
  legal_name: Schema.String
})

describe("Migrations", () => {
  it.layer(SharedPgClientLive, { timeout: "30 seconds" })(
    "runMigrations",
    (it) => {
      it.effect("runs migrations or verifies already run", () =>
        Effect.gen(function* () {
          const completed = yield* runMigrations

          // With shared container, migrations may already be run by other tests.
          // Either we run all 12 migrations fresh, or they were already run (0 returned).
          if (completed.length === 12) {
            // Fresh run - verify migration order
            expect(completed[0]).toEqual([1, "CreateOrganizations"])
            expect(completed[1]).toEqual([2, "CreateCompanies"])
            expect(completed[2]).toEqual([3, "CreateAccounts"])
            expect(completed[3]).toEqual([4, "CreateFiscalPeriods"])
            expect(completed[4]).toEqual([5, "CreateJournalEntries"])
            expect(completed[5]).toEqual([6, "CreateExchangeRates"])
            expect(completed[6]).toEqual([7, "CreateConsolidation"])
            expect(completed[7]).toEqual([8, "CreateIntercompany"])
            expect(completed[8]).toEqual([9, "CreateConsolidationRuns"])
            expect(completed[9]).toEqual([10, "CreateAuthUsers"])
            expect(completed[10]).toEqual([11, "CreateAuthIdentities"])
            expect(completed[11]).toEqual([12, "CreateAuthSessions"])
          } else {
            // Already run by another test - verify idempotency
            expect(completed).toHaveLength(0)
          }
        })
      )

      it.effect("creates migrations tracking table", () =>
        Effect.gen(function* () {
          // Run migrations first (may be no-op if already run)
          yield* runMigrations

          const sql = yield* PgClient.PgClient

          // Check tracking table exists and has entries
          const findMigrations = SqlSchema.findAll({
            Request: Schema.Void,
            Result: MigrationRow,
            execute: () => sql`SELECT migration_id, name FROM effect_sql_migrations ORDER BY migration_id`
          })
          const rows = yield* findMigrations()

          expect(rows).toHaveLength(12)
          expect(rows[0].migration_id).toBe(1)
          expect(rows[0].name).toBe("CreateOrganizations")
        })
      )

      it.effect("is idempotent - running twice does not re-run migrations", () =>
        Effect.gen(function* () {
          // Run once to ensure migrations exist (may already be run by other tests)
          yield* runMigrations

          // Subsequent calls should always return empty
          const second = yield* runMigrations
          expect(second).toHaveLength(0)

          // Third call also returns empty
          const third = yield* runMigrations
          expect(third).toHaveLength(0)
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
          const findColumns = SqlSchema.findAll({
            Request: Schema.String,
            Result: ColumnInfoRow,
            execute: (tableName: string) => sql`
              SELECT column_name, data_type
              FROM information_schema.columns
              WHERE table_name = ${tableName}
              ORDER BY ordinal_position
            `
          })
          const columns = yield* findColumns("organizations")

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
          const findForeignKeys = SqlSchema.findAll({
            Request: Schema.Struct({ tableName: Schema.String, columnName: Schema.String }),
            Result: ConstraintRow,
            execute: ({ tableName, columnName }: { tableName: string; columnName: string }) => sql`
              SELECT tc.constraint_name, kcu.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
              WHERE tc.table_name = ${tableName}
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = ${columnName}
            `
          })
          const fks = yield* findForeignKeys({ tableName: "companies", columnName: "organization_id" })

          expect(fks).toHaveLength(1)
          expect(fks[0].column_name).toBe("organization_id")
        })
      )

      it.effect("creates accounts table with proper enums", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check enum types exist
          const findEnums = SqlSchema.findAll({
            Request: Schema.Void,
            Result: TypeNameRow,
            execute: () => sql`
              SELECT typname FROM pg_type
              WHERE typname IN ('account_type', 'account_category', 'normal_balance', 'cash_flow_category')
            `
          })
          const enums = yield* findEnums()

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
          const findTables = SqlSchema.findAll({
            Request: Schema.Void,
            Result: TableNameRow,
            execute: () => sql`
              SELECT table_name FROM information_schema.tables
              WHERE table_name IN ('fiscal_years', 'fiscal_periods')
            `
          })
          const tables = yield* findTables()

          expect(tables).toHaveLength(2)
        })
      )

      it.effect("creates journal_entries and journal_entry_lines tables", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          const findTables = SqlSchema.findAll({
            Request: Schema.Void,
            Result: TableNameRow,
            execute: () => sql`
              SELECT table_name FROM information_schema.tables
              WHERE table_name IN ('journal_entries', 'journal_entry_lines')
            `
          })
          const tables = yield* findTables()

          expect(tables).toHaveLength(2)
        })
      )

      it.effect("creates exchange_rates table", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          const findTables = SqlSchema.findAll({
            Request: Schema.Void,
            Result: TableNameRow,
            execute: () => sql`
              SELECT table_name FROM information_schema.tables
              WHERE table_name = 'exchange_rates'
            `
          })
          const tables = yield* findTables()

          expect(tables).toHaveLength(1)
        })
      )

      it.effect(
        "creates consolidation tables (consolidation_groups, consolidation_members, elimination_rules)",
        () =>
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            const findTables = SqlSchema.findAll({
              Request: Schema.Void,
              Result: TableNameRow,
              execute: () => sql`
                SELECT table_name FROM information_schema.tables
                WHERE table_name IN ('consolidation_groups', 'consolidation_members', 'elimination_rules')
              `
            })
            const tables = yield* findTables()

            expect(tables).toHaveLength(3)
          })
      )

      it.effect("creates intercompany_transactions table", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          const findTables = SqlSchema.findAll({
            Request: Schema.Void,
            Result: TableNameRow,
            execute: () => sql`
              SELECT table_name FROM information_schema.tables
              WHERE table_name = 'intercompany_transactions'
            `
          })
          const tables = yield* findTables()

          expect(tables).toHaveLength(1)
        })
      )

      it.effect(
        "creates consolidation run tables (consolidation_runs, consolidation_run_steps, consolidated_trial_balances)",
        () =>
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            const findTables = SqlSchema.findAll({
              Request: Schema.Void,
              Result: TableNameRow,
              execute: () => sql`
                SELECT table_name FROM information_schema.tables
                WHERE table_name IN (
                  'consolidation_runs',
                  'consolidation_run_steps',
                  'consolidated_trial_balances',
                  'consolidation_run_elimination_entries'
                )
              `
            })
            const tables = yield* findTables()

            expect(tables).toHaveLength(4)
          })
      )

      it.effect("creates consolidation run enums", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          const findEnums = SqlSchema.findAll({
            Request: Schema.Void,
            Result: TypeNameRow,
            execute: () => sql`
              SELECT typname FROM pg_type
              WHERE typname IN (
                'consolidation_run_status',
                'consolidation_step_type',
                'consolidation_step_status'
              )
            `
          })
          const enums = yield* findEnums()

          const enumNames = enums.map((e) => e.typname)
          expect(enumNames).toContain("consolidation_run_status")
          expect(enumNames).toContain("consolidation_step_type")
          expect(enumNames).toContain("consolidation_step_status")
        })
      )

      it.effect("creates proper indexes on commonly queried fields", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check that key indexes exist
          const findIndexes = SqlSchema.findAll({
            Request: Schema.Void,
            Result: IndexRow,
            execute: () => sql`
              SELECT indexname, tablename FROM pg_indexes
              WHERE schemaname = 'public'
              AND (
                indexname LIKE 'idx_%_company_id' OR
                indexname LIKE 'idx_%_status' OR
                indexname LIKE 'idx_%_is_active'
              )
            `
          })
          const indexes = yield* findIndexes()

          // Should have multiple indexes on company_id, status, and is_active
          expect(indexes.length).toBeGreaterThan(5)
        })
      )

      it.effect("creates update_updated_at trigger function", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Check trigger function exists
          const findFunctions = SqlSchema.findAll({
            Request: Schema.Void,
            Result: FunctionRow,
            execute: () => sql`
              SELECT proname FROM pg_proc
              WHERE proname = 'update_updated_at_column'
            `
          })
          const funcs = yield* findFunctions()

          expect(funcs).toHaveLength(1)
        })
      )

      it.effect("can insert and query data after migrations", () =>
        Effect.gen(function* () {
          const sql = yield* PgClient.PgClient

          // Use unique IDs to avoid conflicts with shared container
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
          const orgId = `aaaaaaaa-aaaa-aaaa-aaaa-${uniqueSuffix.slice(0, 12).padEnd(12, "0")}`
          const companyId = `bbbbbbbb-bbbb-bbbb-bbbb-${uniqueSuffix.slice(0, 12).padEnd(12, "0")}`
          const companyName = `Migration Test Company ${uniqueSuffix}`

          // Insert an organization
          yield* sql`
            INSERT INTO organizations (id, name, reporting_currency)
            VALUES (${orgId}, ${"Migration Test Org " + uniqueSuffix}, 'USD')
          `

          // Insert a company
          yield* sql`
            INSERT INTO companies (
              id, organization_id, name, legal_name, jurisdiction,
              functional_currency, reporting_currency,
              fiscal_year_end_month, fiscal_year_end_day
            ) VALUES (
              ${companyId},
              ${orgId},
              ${companyName}, ${companyName + " LLC"}, 'US',
              'USD', 'USD', 12, 31
            )
          `

          // Query it back by specific name to avoid interference from other tests
          const findCompanies = SqlSchema.findAll({
            Request: Schema.String,
            Result: CompanyRow,
            execute: (name: string) => sql`SELECT name, legal_name FROM companies WHERE name = ${name}`
          })
          const companies = yield* findCompanies(companyName)

          expect(companies).toHaveLength(1)
          expect(companies[0].name).toBe(companyName)
        })
      )
    }
  )
})
