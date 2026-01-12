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
import { AccountRepositoryLive } from "./Layers/AccountRepositoryLive.ts"
import { CompanyRepositoryLive } from "./Layers/CompanyRepositoryLive.ts"
import { OrganizationRepositoryLive } from "./Layers/OrganizationRepositoryLive.ts"
import { JournalEntryRepositoryLive } from "./Layers/JournalEntryRepositoryLive.ts"
import { JournalEntryLineRepositoryLive } from "./Layers/JournalEntryLineRepositoryLive.ts"
import { FiscalPeriodRepositoryLive } from "./Layers/FiscalPeriodRepositoryLive.ts"
import { ExchangeRateRepositoryLive } from "./Layers/ExchangeRateRepositoryLive.ts"
import { ConsolidationRepositoryLive } from "./Layers/ConsolidationRepositoryLive.ts"
import { IntercompanyTransactionRepositoryLive } from "./Layers/IntercompanyTransactionRepositoryLive.ts"
import { EliminationRuleRepositoryLive } from "./Layers/EliminationRuleRepositoryLive.ts"

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
 * import { RepositoriesLive } from "@accountability/persistence/RepositoriesLive"
 * import { PgClientLive } from "@accountability/persistence/PgClientLive"
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
