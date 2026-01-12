/**
 * RepositoriesLive - Combined layer providing all real repository implementations
 *
 * This module provides a single layer that combines all repository implementations
 * for use in production and testing with real database connections.
 *
 * Dependencies:
 * - PgClient.PgClient (SqlClient.SqlClient) - Must be provided by the caller
 *
 * @module RepositoriesLive
 */

import * as Layer from "effect/Layer"
import { AccountRepositoryLive } from "./AccountRepositoryLive.ts"
import { CompanyRepositoryLive } from "./CompanyRepositoryLive.ts"
import { OrganizationRepositoryLive } from "./OrganizationRepositoryLive.ts"
import { JournalEntryRepositoryLive } from "./JournalEntryRepositoryLive.ts"
import { JournalEntryLineRepositoryLive } from "./JournalEntryLineRepositoryLive.ts"
import { FiscalPeriodRepositoryLive } from "./FiscalPeriodRepositoryLive.ts"
import { ExchangeRateRepositoryLive } from "./ExchangeRateRepositoryLive.ts"
import { ConsolidationRepositoryLive } from "./ConsolidationRepositoryLive.ts"
import { IntercompanyTransactionRepositoryLive } from "./IntercompanyTransactionRepositoryLive.ts"
import { EliminationRuleRepositoryLive } from "./EliminationRuleRepositoryLive.ts"

/**
 * RepositoriesLive - Combined layer providing all repository implementations
 *
 * This layer provides implementations for:
 * - AccountRepository
 * - CompanyRepository
 * - OrganizationRepository
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 * - FiscalPeriodRepository
 * - ExchangeRateRepository
 * - ConsolidationRepository
 * - IntercompanyTransactionRepository
 * - EliminationRuleRepository
 *
 * All implementations use PostgreSQL via @effect/sql-pg.
 *
 * Usage:
 * ```typescript
 * import { RepositoriesLive, PgClientLive } from "@accountability/persistence/RepositoriesLive"
 *
 * const FullLayer = RepositoriesLive.pipe(
 *   Layer.provide(PgClientLive)
 * )
 * ```
 *
 * For testing with testcontainers:
 * ```typescript
 * import { RepositoriesLive } from "@accountability/persistence/RepositoriesLive"
 * import { PgContainer } from "./test/utils.ts"
 *
 * const TestLayer = RepositoriesLive.pipe(
 *   Layer.provide(PgContainer.ClientLive)
 * )
 * ```
 */
export const RepositoriesLive = Layer.mergeAll(
  AccountRepositoryLive,
  CompanyRepositoryLive,
  OrganizationRepositoryLive,
  JournalEntryRepositoryLive,
  JournalEntryLineRepositoryLive,
  FiscalPeriodRepositoryLive,
  ExchangeRateRepositoryLive,
  ConsolidationRepositoryLive,
  IntercompanyTransactionRepositoryLive,
  EliminationRuleRepositoryLive
)

/**
 * Re-export PgClientLive for convenience
 */
export { PgClientLive, PgClientConfig } from "./PgClientLive.ts"
