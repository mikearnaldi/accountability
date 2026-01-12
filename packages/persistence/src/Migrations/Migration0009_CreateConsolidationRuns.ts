/**
 * Migration0009_CreateConsolidationRuns
 *
 * Creates tables for consolidation run orchestration and tracking:
 * - consolidation_runs: Main run record with status and timing
 * - consolidation_run_steps: Individual step status tracking
 * - consolidated_trial_balances: Output trial balance and metadata
 *
 * These tables support audit trail and historical analysis of consolidation
 * runs per ASC 810 requirements.
 *
 * @module Migration0009_CreateConsolidationRuns
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create consolidation run tables
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for consolidation run status
  yield* sql`
    CREATE TYPE consolidation_run_status AS ENUM (
      'Pending',
      'InProgress',
      'Completed',
      'Failed',
      'Cancelled'
    )
  `

  // Create enum for consolidation step type
  yield* sql`
    CREATE TYPE consolidation_step_type AS ENUM (
      'Validate',
      'Translate',
      'Aggregate',
      'MatchIC',
      'Eliminate',
      'NCI',
      'GenerateTB'
    )
  `

  // Create enum for consolidation step status
  yield* sql`
    CREATE TYPE consolidation_step_status AS ENUM (
      'Pending',
      'InProgress',
      'Completed',
      'Failed',
      'Skipped'
    )
  `

  // Create consolidation_runs table
  yield* sql`
    CREATE TABLE consolidation_runs (
      id UUID PRIMARY KEY,
      consolidation_group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE RESTRICT,

      -- Period reference
      fiscal_year INTEGER NOT NULL CHECK (fiscal_year >= 1900 AND fiscal_year <= 2999),
      fiscal_period INTEGER NOT NULL CHECK (fiscal_period >= 1 AND fiscal_period <= 13),
      as_of_date DATE NOT NULL,

      -- Status
      status consolidation_run_status NOT NULL DEFAULT 'Pending',

      -- Validation result stored as JSONB
      validation_result JSONB,

      -- Run options stored as JSONB
      options JSONB NOT NULL DEFAULT '{
        "skipValidation": false,
        "continueOnWarnings": true,
        "includeEquityMethodInvestments": true,
        "forceRegeneration": false
      }'::jsonb,

      -- Timing
      initiated_by UUID NOT NULL,
      initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      total_duration_ms INTEGER CHECK (total_duration_ms IS NULL OR total_duration_ms >= 0),

      -- Error tracking
      error_message TEXT,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Create indexes for consolidation_runs
  yield* sql`
    CREATE INDEX idx_consolidation_runs_group_id
      ON consolidation_runs (consolidation_group_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_runs_status
      ON consolidation_runs (status)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_runs_fiscal_period
      ON consolidation_runs (fiscal_year, fiscal_period)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_runs_as_of_date
      ON consolidation_runs (as_of_date)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_runs_initiated_at
      ON consolidation_runs (initiated_at DESC)
  `

  // Composite index for finding runs by group and period
  yield* sql`
    CREATE INDEX idx_consolidation_runs_group_period
      ON consolidation_runs (consolidation_group_id, fiscal_year, fiscal_period)
  `

  // Create consolidation_run_steps table
  yield* sql`
    CREATE TABLE consolidation_run_steps (
      id UUID PRIMARY KEY,
      consolidation_run_id UUID NOT NULL REFERENCES consolidation_runs(id) ON DELETE CASCADE,

      -- Step identification
      step_type consolidation_step_type NOT NULL,
      step_order SMALLINT NOT NULL CHECK (step_order >= 1 AND step_order <= 7),

      -- Status
      status consolidation_step_status NOT NULL DEFAULT 'Pending',

      -- Timing
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),

      -- Error and details
      error_message TEXT,
      details TEXT,

      -- Constraints
      UNIQUE (consolidation_run_id, step_type),
      UNIQUE (consolidation_run_id, step_order)
    )
  `

  // Create indexes for consolidation_run_steps
  yield* sql`
    CREATE INDEX idx_consolidation_run_steps_run_id
      ON consolidation_run_steps (consolidation_run_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_run_steps_status
      ON consolidation_run_steps (status)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_run_steps_step_type
      ON consolidation_run_steps (step_type)
  `

  // Create consolidated_trial_balances table
  yield* sql`
    CREATE TABLE consolidated_trial_balances (
      id UUID PRIMARY KEY,
      consolidation_run_id UUID NOT NULL REFERENCES consolidation_runs(id) ON DELETE CASCADE,
      consolidation_group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE RESTRICT,

      -- Period reference
      fiscal_year INTEGER NOT NULL CHECK (fiscal_year >= 1900 AND fiscal_year <= 2999),
      fiscal_period INTEGER NOT NULL CHECK (fiscal_period >= 1 AND fiscal_period <= 13),
      as_of_date DATE NOT NULL,

      -- Currency
      currency CHAR(3) NOT NULL,

      -- Line items stored as JSONB array
      line_items JSONB NOT NULL DEFAULT '[]',

      -- Totals stored as JSONB (MonetaryAmount)
      total_debits JSONB NOT NULL,
      total_credits JSONB NOT NULL,
      total_eliminations JSONB NOT NULL,
      total_nci JSONB NOT NULL,

      -- Generation timestamp
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Unique constraint - only one TB per run
      UNIQUE (consolidation_run_id)
    )
  `

  // Create indexes for consolidated_trial_balances
  yield* sql`
    CREATE INDEX idx_consolidated_trial_balances_run_id
      ON consolidated_trial_balances (consolidation_run_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidated_trial_balances_group_id
      ON consolidated_trial_balances (consolidation_group_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidated_trial_balances_fiscal_period
      ON consolidated_trial_balances (fiscal_year, fiscal_period)
  `

  yield* sql`
    CREATE INDEX idx_consolidated_trial_balances_as_of_date
      ON consolidated_trial_balances (as_of_date)
  `

  // Composite index for finding trial balances by group and period
  yield* sql`
    CREATE INDEX idx_consolidated_trial_balances_group_period
      ON consolidated_trial_balances (consolidation_group_id, fiscal_year, fiscal_period)
  `

  // Create elimination_entries junction table to track generated elimination entries
  yield* sql`
    CREATE TABLE consolidation_run_elimination_entries (
      consolidation_run_id UUID NOT NULL REFERENCES consolidation_runs(id) ON DELETE CASCADE,
      journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,

      -- Primary key on both columns
      PRIMARY KEY (consolidation_run_id, journal_entry_id)
    )
  `

  // Create indexes for elimination entries junction table
  yield* sql`
    CREATE INDEX idx_consolidation_run_elimination_entries_run_id
      ON consolidation_run_elimination_entries (consolidation_run_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_run_elimination_entries_entry_id
      ON consolidation_run_elimination_entries (journal_entry_id)
  `

  // Add triggers for updated_at
  yield* sql`
    CREATE TRIGGER update_consolidation_runs_updated_at
      BEFORE UPDATE ON consolidation_runs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
