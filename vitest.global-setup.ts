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

import type { TestProject } from "vitest/node"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"

let container: StartedPostgreSqlContainer

export async function setup(project: TestProject) {
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

// Type augmentation for provide/inject
declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string
  }
}
