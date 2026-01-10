/**
 * Migration0004_CreateFiscalPeriods
 *
 * Creates fiscal_years and fiscal_periods tables for period management.
 *
 * @module Migration0004_CreateFiscalPeriods
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create fiscal years and periods tables
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for fiscal year status
  yield* sql`
    CREATE TYPE fiscal_year_status AS ENUM (
      'Open',
      'Closing',
      'Closed'
    )
  `

  // Create enum for fiscal period status
  yield* sql`
    CREATE TYPE fiscal_period_status AS ENUM (
      'Future',
      'Open',
      'SoftClose',
      'Closed',
      'Locked'
    )
  `

  // Create enum for fiscal period type
  yield* sql`
    CREATE TYPE fiscal_period_type AS ENUM (
      'Regular',
      'Adjustment',
      'Closing'
    )
  `

  // Create fiscal_years table
  yield* sql`
    CREATE TABLE fiscal_years (
      id UUID PRIMARY KEY,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2999),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status fiscal_year_status NOT NULL DEFAULT 'Open',
      includes_adjustment_period BOOLEAN NOT NULL DEFAULT false,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      UNIQUE (company_id, year),
      CHECK (start_date < end_date)
    )
  `

  // Create indexes for fiscal_years
  yield* sql`
    CREATE INDEX idx_fiscal_years_company_id ON fiscal_years (company_id)
  `

  yield* sql`
    CREATE INDEX idx_fiscal_years_status ON fiscal_years (status)
  `

  yield* sql`
    CREATE INDEX idx_fiscal_years_year ON fiscal_years (year)
  `

  // Create fiscal_periods table
  yield* sql`
    CREATE TABLE fiscal_periods (
      id UUID PRIMARY KEY,
      fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
      period_number SMALLINT NOT NULL CHECK (period_number >= 1 AND period_number <= 13),
      name TEXT NOT NULL,
      period_type fiscal_period_type NOT NULL DEFAULT 'Regular',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status fiscal_period_status NOT NULL DEFAULT 'Future',

      -- Closing information
      closed_by UUID,
      closed_at TIMESTAMPTZ,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      UNIQUE (fiscal_year_id, period_number),
      CHECK (start_date <= end_date)
    )
  `

  // Create indexes for fiscal_periods
  yield* sql`
    CREATE INDEX idx_fiscal_periods_fiscal_year_id ON fiscal_periods (fiscal_year_id)
  `

  yield* sql`
    CREATE INDEX idx_fiscal_periods_status ON fiscal_periods (status)
  `

  yield* sql`
    CREATE INDEX idx_fiscal_periods_dates ON fiscal_periods (start_date, end_date)
  `

  // Create period_reopen_audit_entries table for audit trail
  yield* sql`
    CREATE TABLE period_reopen_audit_entries (
      id UUID PRIMARY KEY,
      period_id UUID NOT NULL REFERENCES fiscal_periods(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      reopened_by UUID NOT NULL,
      reopened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      previous_status fiscal_period_status NOT NULL
    )
  `

  yield* sql`
    CREATE INDEX idx_period_reopen_audit_entries_period_id
      ON period_reopen_audit_entries (period_id)
  `

  // Create closing_journal_entries table for year-end close tracking
  yield* sql`
    CREATE TABLE closing_journal_entries (
      id UUID PRIMARY KEY,
      fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
      journal_entry_id UUID NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('RevenueClose', 'ExpenseClose', 'OpeningBalance')),
      description TEXT NOT NULL,
      lines JSONB NOT NULL,
      total_debit JSONB NOT NULL,
      total_credit JSONB NOT NULL,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`
    CREATE INDEX idx_closing_journal_entries_fiscal_year_id
      ON closing_journal_entries (fiscal_year_id)
  `

  // Add triggers for updated_at
  yield* sql`
    CREATE TRIGGER update_fiscal_years_updated_at
      BEFORE UPDATE ON fiscal_years
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `

  yield* sql`
    CREATE TRIGGER update_fiscal_periods_updated_at
      BEFORE UPDATE ON fiscal_periods
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
