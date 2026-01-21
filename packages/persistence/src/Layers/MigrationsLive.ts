/**
 * MigrationsLive - Migration runner with inline loader
 *
 * Uses Migrator.make with fromRecord to define migrations inline.
 * All migrations are statically imported - no dynamic file system loading.
 *
 * Migrations run automatically when the MigrationLayer is provided,
 * ensuring the database schema is always up-to-date before the application starts.
 *
 * @module MigrationsLive
 */

import * as Migrator from "@effect/sql/Migrator"
import * as Layer from "effect/Layer"

// Import all migrations statically
import Migration0001 from "../Migrations/Migration0001_CreateOrganizations.ts"
import Migration0002 from "../Migrations/Migration0002_CreateCompanies.ts"
import Migration0003 from "../Migrations/Migration0003_CreateAccounts.ts"
import Migration0004 from "../Migrations/Migration0004_CreateFiscalPeriods.ts"
import Migration0005 from "../Migrations/Migration0005_CreateJournalEntries.ts"
import Migration0006 from "../Migrations/Migration0006_CreateExchangeRates.ts"
import Migration0007 from "../Migrations/Migration0007_CreateConsolidation.ts"
import Migration0008 from "../Migrations/Migration0008_CreateIntercompany.ts"
import Migration0009 from "../Migrations/Migration0009_CreateConsolidationRuns.ts"
import Migration0010 from "../Migrations/Migration0010_CreateAuthUsers.ts"
import Migration0011 from "../Migrations/Migration0011_CreateAuthIdentities.ts"
import Migration0012 from "../Migrations/Migration0012_CreateAuthSessions.ts"
import Migration0013 from "../Migrations/Migration0013_CreateAuditLog.ts"
import Migration0014 from "../Migrations/Migration0014_AddIncorporationDate.ts"
import Migration0015 from "../Migrations/Migration0015_AddRegistrationNumber.ts"
import Migration0016 from "../Migrations/Migration0016_AddCompanyOptionalFields.ts"
import Migration0017 from "../Migrations/Migration0017_CreateAuthorization.ts"
import Migration0018 from "../Migrations/Migration0018_SeedOwners.ts"
import Migration0019 from "../Migrations/Migration0019_AddAuditLogOrganizationId.ts"
import Migration0020 from "../Migrations/Migration0020_AddAuditLogEntityName.ts"
import Migration0021 from "../Migrations/Migration0021_AddAuditLogUserInfo.ts"
import Migration0022 from "../Migrations/Migration0022_SimplifyFiscalPeriodStatus.ts"
import Migration0023 from "../Migrations/Migration0023_BackfillPeriod13.ts"
import Migration0024 from "../Migrations/Migration0024_SimplifyFiscalYearStatus.ts"
import Migration0025 from "../Migrations/Migration0025_AddRetainedEarningsFields.ts"

/**
 * Migration loader with all migrations defined inline.
 *
 * Key format: "{id}_{name}" where:
 * - id: numeric migration ID (determines execution order)
 * - name: descriptive name for the migration
 *
 * Uses Migrator.fromRecord which parses the key format and
 * returns migrations sorted by ID.
 */
const loader = Migrator.fromRecord({
  "1_CreateOrganizations": Migration0001,
  "2_CreateCompanies": Migration0002,
  "3_CreateAccounts": Migration0003,
  "4_CreateFiscalPeriods": Migration0004,
  "5_CreateJournalEntries": Migration0005,
  "6_CreateExchangeRates": Migration0006,
  "7_CreateConsolidation": Migration0007,
  "8_CreateIntercompany": Migration0008,
  "9_CreateConsolidationRuns": Migration0009,
  "10_CreateAuthUsers": Migration0010,
  "11_CreateAuthIdentities": Migration0011,
  "12_CreateAuthSessions": Migration0012,
  "13_CreateAuditLog": Migration0013,
  "14_AddIncorporationDate": Migration0014,
  "15_AddRegistrationNumber": Migration0015,
  "16_AddCompanyOptionalFields": Migration0016,
  "17_CreateAuthorization": Migration0017,
  "18_SeedOwners": Migration0018,
  "19_AddAuditLogOrganizationId": Migration0019,
  "20_AddAuditLogEntityName": Migration0020,
  "21_AddAuditLogUserInfo": Migration0021,
  "22_SimplifyFiscalPeriodStatus": Migration0022,
  "23_BackfillPeriod13": Migration0023,
  "24_SimplifyFiscalYearStatus": Migration0024,
  "25_AddRetainedEarningsFields": Migration0025
})

/**
 * Migrator options with the inline loader.
 */
const migratorOptions = { loader }

/**
 * Migrator run function - no schema dumping needed
 * Uses the base Migrator.make without platform dependencies
 */
const run = Migrator.make({})

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
export const runMigrations = run(migratorOptions)

/**
 * Layer that runs migrations when the layer is built.
 *
 * Use this to ensure migrations run before your application starts.
 * Migrations are run automatically - no separate script is needed.
 *
 * @example
 * ```typescript
 * import { MigrationsLive } from "@accountability/persistence/Layers/MigrationsLive"
 * import { PgClient } from "@effect/sql-pg"
 *
 * // Migrations run automatically when PgClient is provided
 * const AppLayer = MigrationsLive.pipe(
 *   Layer.provideMerge(PgClient.layer({ url: Redacted.make("postgresql://...") }))
 * )
 * ```
 */
export const MigrationsLive = Layer.effectDiscard(runMigrations)

// Legacy export for backwards compatibility during transition
export { MigrationsLive as MigrationLayer }
