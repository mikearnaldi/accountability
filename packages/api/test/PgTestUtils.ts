/**
 * PostgreSQL test utilities for API integration tests
 *
 * Re-exports SharedPgClientLive from persistence test utils
 * for use in API integration tests.
 *
 * @module PgTestUtils
 */

import { PgClient } from "@effect/sql-pg"
import { Redacted } from "effect"
import { inject } from "vitest"

/**
 * Shared PgClient layer that uses the container from globalSetup.
 *
 * The container URL is injected via vitest's inject() mechanism,
 * which reads from the globalSetup's provide() calls.
 *
 * This layer enables sharing a single PostgreSQL container across
 * ALL test files instead of creating one per it.layer() block.
 *
 * Usage:
 * ```typescript
 * const TestLayer = RepositoriesLayer.pipe(
 *   Layer.provideMerge(MigrationLayer),
 *   Layer.provideMerge(SharedPgClientLive)  // Uses global container
 * )
 * ```
 *
 * @see vitest.global-setup.ts for container lifecycle
 * @see specs/EFFECT_TESTING.md for migration instructions
 */
export const SharedPgClientLive = PgClient.layer({
  url: Redacted.make(inject("dbUrl"))
})
