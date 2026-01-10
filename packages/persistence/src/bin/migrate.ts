#!/usr/bin/env npx tsx
/**
 * Migration CLI script
 *
 * Runs database migrations against a PostgreSQL database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... pnpm migrate:run
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection URL (required)
 *
 * @module bin/migrate
 */

import { PgClient } from "@effect/sql-pg"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Config from "effect/Config"
import * as Redacted from "effect/Redacted"
import * as Console from "effect/Console"
import { runMigrations } from "../MigrationRunner.ts"

const program = Effect.gen(function* () {
  yield* Console.log("Starting database migrations...")

  const completed = yield* runMigrations

  if (completed.length === 0) {
    yield* Console.log("No new migrations to run.")
  } else {
    yield* Console.log(`Completed ${completed.length} migration(s):`)
    for (const [id, name] of completed) {
      yield* Console.log(`  - ${id}: ${name}`)
    }
  }

  yield* Console.log("Migrations complete.")
})

const DatabaseUrl = Config.redacted("DATABASE_URL")

const PgClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const url = yield* DatabaseUrl
    return PgClient.layer({ url })
  })
)

const MainLayer = PgClientLive.pipe(
  Layer.provide(NodeContext.layer)
)

// Run the program
program.pipe(
  Effect.provide(MainLayer),
  Effect.tapErrorCause((cause) => Console.error("Migration failed:", cause)),
  NodeRuntime.runMain
)
