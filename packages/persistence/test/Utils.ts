/**
 * Test Utilities for Persistence Package
 *
 * Provides shared PostgreSQL container layer for integration tests.
 * Includes automatic migration running with singleton pattern to ensure
 * migrations only run once regardless of how many test files use this layer.
 *
 * @module test/Utils
 */

import { PgClient } from "@effect/sql-pg"
import { Effect, Layer, Redacted } from "effect"
import { inject } from "vitest"
import { runMigrations } from "../src/Layers/MigrationsLive.ts"

/**
 * Module-level singleton to track migration state.
 * Since vitest is configured with singleFork: true, this ensures
 * migrations only run once even when multiple test files are executed.
 */
let migrationsRan = false

/**
 * Base PgClient layer that uses the container from globalSetup.
 *
 * The container URL is injected via vitest's inject() mechanism,
 * which reads from the globalSetup's provide() calls.
 */
const BasePgClientLive = PgClient.layer({
  url: Redacted.make(inject("dbUrl"))
})

/**
 * Runs migrations exactly once, using a module-level singleton.
 * Subsequent calls return immediately if migrations are complete.
 *
 * This is an Effect that requires SqlClient (provided by PgClient).
 */
const ensureMigrationsOnce = Effect.gen(function* () {
  // Fast path: already done
  if (migrationsRan) {
    return
  }

  yield* runMigrations.pipe(
    Effect.tap(() => Effect.sync(() => {
      migrationsRan = true
    })),
    Effect.catchAll((error) => {
      // Check if error is duplicate key constraint - means migrations already ran
      const errorStr = String(error)
      if (errorStr.includes("effect_sql_migrations_name_key") ||
          errorStr.includes("duplicate key") ||
          errorStr.includes("already exists") ||
          errorStr.includes("pg_type_typname_nsp_index")) {
        // This is fine - migrations already ran
        migrationsRan = true
        return Effect.void
      }
      return Effect.fail(error)
    })
  )
})

/**
 * Layer that runs migrations once after PgClient is available.
 * Uses a singleton pattern to ensure migrations only run once
 * since vitest is configured with singleFork: true.
 */
const MigrationsOnceLive = Layer.effectDiscard(ensureMigrationsOnce)

/**
 * Shared PgClient layer that uses the container from globalSetup
 * and ensures migrations are run exactly once.
 *
 * This layer enables sharing a single PostgreSQL container across
 * ALL test files instead of creating one per it.layer() block.
 *
 * Usage:
 * ```typescript
 * const TestLayer = RepositoriesLayer.pipe(
 *   Layer.provideMerge(SharedPgClientLive)  // Uses global container + migrations
 * )
 * ```
 *
 * @see vitest.global-setup.ts for container lifecycle
 * @see specs/EFFECT_TESTING.md for migration instructions
 */
export const SharedPgClientLive = MigrationsOnceLive.pipe(
  Layer.provideMerge(BasePgClientLive)
)
