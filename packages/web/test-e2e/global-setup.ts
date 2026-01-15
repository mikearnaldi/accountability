/**
 * E2E Test Global Setup
 *
 * Handles:
 * 1. Starting PostgreSQL container
 * 2. Running database migrations
 * 3. Building the app
 * 4. Starting the production server
 *
 * This script is executed by Playwright's webServer config.
 * It must stay running until the tests complete.
 *
 * @module test-e2e/global-setup
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { PgClient } from "@effect/sql-pg"
import { Effect, Layer, Redacted } from "effect"
import { spawn, execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

// Quiet mode by default - use VERBOSE=1 to see full output
const VERBOSE = process.env.VERBOSE === "1"
const log = VERBOSE ? console.log.bind(console) : () => {}

// File to persist container ID for cleanup
const CONTAINER_INFO_FILE = path.join(import.meta.dirname, ".container-info.json")

interface ContainerInfo {
  containerId: string
  dbUrl: string
}

// Track container for cleanup
let container: StartedPostgreSqlContainer | null = null

async function startDatabase(): Promise<string> {
  log("Starting PostgreSQL container for E2E tests...")

  container = await new PostgreSqlContainer("postgres:alpine")
    .withDatabase("accountability_e2e")
    .start()

  const dbUrl = container.getConnectionUri()
  log(`PostgreSQL ready at ${dbUrl}`)

  // Persist container info for teardown
  const containerInfo: ContainerInfo = {
    containerId: container.getId(),
    dbUrl
  }
  fs.writeFileSync(CONTAINER_INFO_FILE, JSON.stringify(containerInfo))

  return dbUrl
}

async function runMigrations(dbUrl: string): Promise<void> {
  log("Running database migrations...")

  const { MigrationsLive, runMigrations } = await import(
    "../../persistence/src/Layers/MigrationsLive.ts"
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

  log("Migrations complete!")
}

function buildApp(): void {
  log("Building application...")
  execSync("pnpm build", {
    cwd: path.join(import.meta.dirname, ".."),
    stdio: VERBOSE ? "inherit" : "pipe",
    env: process.env
  })
  log("Build complete!")
}

function startServer(dbUrl: string): Promise<never> {
  return new Promise((resolve, reject) => {
    const port = process.env.TEST_PORT || "3333"

    log("")
    log(`Starting E2E server on port ${port}...`)
    log(`  DATABASE_URL: ${dbUrl}`)
    log("")

    const serverPath = path.join(import.meta.dirname, "..", ".output", "server", "index.mjs")

    const server = spawn("node", [serverPath], {
      cwd: path.join(import.meta.dirname, ".."),
      // Always show stderr for errors, only show stdout in verbose mode
      stdio: VERBOSE ? "inherit" : ["pipe", "pipe", "inherit"],
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
        PORT: port,
        NODE_ENV: "production"
      }
    })

    server.on("error", (err) => {
      console.error("Server failed to start:", err)
      reject(err)
    })

    server.on("exit", (code) => {
      log(`Server exited with code ${code}`)
      // Don't reject on exit - server might be killed by cleanup
    })

    // Handle cleanup signals
    const cleanup = async () => {
      log("Received shutdown signal, cleaning up...")
      server.kill()
      if (container) {
        log("Stopping PostgreSQL container...")
        await container.stop()
      }
      // Clean up info file
      if (fs.existsSync(CONTAINER_INFO_FILE)) {
        fs.unlinkSync(CONTAINER_INFO_FILE)
      }
      process.exit(0)
    }

    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)
  })
}

async function main() {
  try {
    // Step 1: Start database
    const dbUrl = await startDatabase()

    // Step 2: Run migrations
    await runMigrations(dbUrl)

    // Step 3: Build app
    buildApp()

    // Step 4: Start server (blocks indefinitely)
    await startServer(dbUrl)
  } catch (error) {
    console.error("E2E setup failed:", error)
    // Clean up container on failure
    if (container) {
      try {
        await container.stop()
      } catch {
        // Ignore cleanup errors
      }
    }
    process.exit(1)
  }
}

main()
