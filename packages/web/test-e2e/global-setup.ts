/**
 * Global setup for Playwright E2E tests
 *
 * Starts PostgreSQL container using testcontainers and runs migrations.
 * The container connection info is stored in files for:
 * 1. The preview server to use (via DATABASE_URL)
 * 2. The teardown script to clean up
 *
 * @module test-e2e/global-setup
 */

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { PgClient } from "@effect/sql-pg"
import { Effect, Layer, Redacted } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"

// File to persist container ID for teardown
const CONTAINER_INFO_FILE = path.join(process.cwd(), "test-e2e", ".container-info.json")

/**
 * Container info persisted between setup and teardown
 */
interface ContainerInfo {
  containerId: string
  dbUrl: string
}

export default async function globalSetup() {
  console.log("Starting PostgreSQL container for E2E tests...")

  // Start PostgreSQL container
  const container = await new PostgreSqlContainer("postgres:alpine")
    .withDatabase("accountability_e2e")
    .start()

  const dbUrl = container.getConnectionUri()

  console.log(`PostgreSQL ready at ${dbUrl}`)

  // Persist container info for teardown
  const containerInfo: ContainerInfo = {
    containerId: container.getId(),
    dbUrl
  }
  fs.writeFileSync(CONTAINER_INFO_FILE, JSON.stringify(containerInfo))

  // Run migrations using Effect
  console.log("Running database migrations...")

  // Dynamic import the persistence package
  const { MigrationsLive, runMigrations } = await import(
    "@accountability/persistence/Layers/MigrationsLive"
  )

  await Effect.runPromise(
    runMigrations.pipe(
      Effect.provide(
        Layer.provideMerge(
          MigrationsLive,
          PgClient.layer({ url: Redacted.make(dbUrl) })
        )
      )
    )
  )

  console.log("Migrations complete!")

  // Store DATABASE_URL for the web server to use
  // The playwright config will pass this to the webServer command
  process.env.TEST_DATABASE_URL = dbUrl

  // Write env file that can be sourced by the preview server
  const envFilePath = path.join(process.cwd(), "test-e2e", ".env.test")
  fs.writeFileSync(envFilePath, `DATABASE_URL="${dbUrl}"\n`)

  console.log("E2E test setup complete!")
}
