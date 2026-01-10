/**
 * MigrationRunner - Migration runner with inline loader
 *
 * Uses PgMigrator with fromRecord to define migrations inline.
 * All migrations are statically imported - no dynamic file system loading.
 *
 * Migrations run automatically when the MigrationLayer is provided,
 * ensuring the database schema is always up-to-date before the application starts.
 *
 * @module MigrationRunner
 */

import { PgMigrator } from "@effect/sql-pg"

// Import all migrations statically
import Migration0001 from "./Migrations/Migration0001_CreateOrganizations.ts"
import Migration0002 from "./Migrations/Migration0002_CreateCompanies.ts"
import Migration0003 from "./Migrations/Migration0003_CreateAccounts.ts"
import Migration0004 from "./Migrations/Migration0004_CreateFiscalPeriods.ts"
import Migration0005 from "./Migrations/Migration0005_CreateJournalEntries.ts"
import Migration0006 from "./Migrations/Migration0006_CreateExchangeRates.ts"
import Migration0007 from "./Migrations/Migration0007_CreateConsolidation.ts"
import Migration0008 from "./Migrations/Migration0008_CreateIntercompany.ts"

/**
 * Migration loader with all migrations defined inline.
 *
 * Key format: "{id}_{name}" where:
 * - id: numeric migration ID (determines execution order)
 * - name: descriptive name for the migration
 *
 * Uses PgMigrator.fromRecord which parses the key format and
 * returns migrations sorted by ID.
 */
const loader = PgMigrator.fromRecord({
  "1_CreateOrganizations": Migration0001,
  "2_CreateCompanies": Migration0002,
  "3_CreateAccounts": Migration0003,
  "4_CreateFiscalPeriods": Migration0004,
  "5_CreateJournalEntries": Migration0005,
  "6_CreateExchangeRates": Migration0006,
  "7_CreateConsolidation": Migration0007,
  "8_CreateIntercompany": Migration0008
})

/**
 * Migrator options with the inline loader.
 */
const migratorOptions = { loader }

/**
 * Run all pending migrations.
 *
 * Creates the migrations tracking table (effect_sql_migrations) if it doesn't exist,
 * then runs any migrations with ID greater than the latest recorded migration.
 *
 * Returns array of [id, name] tuples for migrations that were run.
 *
 * @returns Effect containing array of executed migrations
 */
export const runMigrations = PgMigrator.run(migratorOptions)

/**
 * Layer that runs migrations when the layer is built.
 *
 * Use this to ensure migrations run before your application starts.
 * Migrations are run automatically - no separate script is needed.
 *
 * @example
 * ```typescript
 * import { MigrationLayer } from "@accountability/persistence/MigrationRunner"
 * import { PgClient } from "@effect/sql-pg"
 *
 * // Migrations run automatically when PgClient is provided
 * const AppLayer = MigrationLayer.pipe(
 *   Layer.provideMerge(PgClient.layer({ url: Redacted.make("postgresql://...") }))
 * )
 * ```
 */
export const MigrationLayer = PgMigrator.layer(migratorOptions)
