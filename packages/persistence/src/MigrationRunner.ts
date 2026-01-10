/**
 * MigrationRunner - Migration runner with inline loader
 *
 * Uses PgMigrator with fromRecord to define migrations inline.
 * All migrations are statically imported - no dynamic file system loading.
 *
 * @module MigrationRunner
 */

import { PgMigrator } from "@effect/sql-pg"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

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
 * Run all pending migrations.
 *
 * Creates the migrations tracking table (effect_sql_migrations) if it doesn't exist,
 * then runs any migrations with ID greater than the latest recorded migration.
 *
 * Returns array of [id, name] tuples for migrations that were run.
 *
 * @returns Effect containing array of executed migrations
 */
export const runMigrations = PgMigrator.run({
  loader
})

/**
 * Layer that runs migrations when the layer is built.
 *
 * Use this to ensure migrations run before your application starts.
 *
 * @example
 * ```typescript
 * import { MigrationLayer } from "@accountability/persistence/MigrationRunner"
 *
 * const AppLayer = MigrationLayer.pipe(
 *   Layer.provideMerge(PgClient.layer({ ... }))
 * )
 * ```
 */
export const MigrationLayer: Layer.Layer<
  never,
  PgMigrator.MigrationError,
  Parameters<typeof PgMigrator.run>[0] extends infer T
    ? T extends { loader: infer L }
      ? Effect.Effect.Context<ReturnType<typeof PgMigrator.run>>
      : never
    : never
> = Layer.effectDiscard(runMigrations)
