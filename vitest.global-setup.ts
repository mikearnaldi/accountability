/**
 * Vitest Global Setup
 *
 * Starts a single PostgreSQL container shared across ALL test files.
 * This dramatically improves test performance by eliminating per-block container startup.
 *
 * The container URL is provided to tests via vitest's inject() mechanism.
 * Tests read the URL using `inject('dbUrl')` and create their PgClient from it.
 *
 * @see specs/EFFECT_TESTING.md for usage patterns
 * @module vitest.global-setup
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"

/**
 * Vitest global setup context with typed provide method.
 * We define this locally because module augmentation in vitest.d.ts
 * isn't visible to files outside the main TypeScript project.
 */
interface GlobalSetupContext {
  provide: (key: "dbUrl", value: string) => void
}

let container: StartedPostgreSqlContainer

export async function setup(project: GlobalSetupContext) {
  console.log("Starting shared PostgreSQL container...")

  container = await new PostgreSqlContainer("postgres:alpine").start()

  const dbUrl = container.getConnectionUri()

  // Make connection URL available to tests via inject()
  project.provide("dbUrl", dbUrl)

  console.log(`PostgreSQL ready at ${dbUrl}`)
}

export async function teardown() {
  console.log("Stopping shared PostgreSQL container...")
  await container?.stop()
}
