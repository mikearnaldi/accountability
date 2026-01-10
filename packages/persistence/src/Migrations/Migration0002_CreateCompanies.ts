/**
 * Migration0002_CreateCompanies
 *
 * Creates the companies table for legal entities within organizations.
 *
 * @module Migration0002_CreateCompanies
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create the companies table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for consolidation method
  yield* sql`
    CREATE TYPE consolidation_method AS ENUM (
      'FullConsolidation',
      'EquityMethod',
      'CostMethod',
      'VariableInterestEntity'
    )
  `

  // Create companies table
  yield* sql`
    CREATE TABLE companies (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      jurisdiction CHAR(2) NOT NULL,
      tax_id TEXT,
      functional_currency CHAR(3) NOT NULL,
      reporting_currency CHAR(3) NOT NULL,

      -- Fiscal year end settings (month 1-12, day 1-31)
      fiscal_year_end_month SMALLINT NOT NULL CHECK (fiscal_year_end_month BETWEEN 1 AND 12),
      fiscal_year_end_day SMALLINT NOT NULL CHECK (fiscal_year_end_day BETWEEN 1 AND 31),

      -- Consolidation hierarchy
      parent_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      ownership_percentage NUMERIC(5, 2) CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
      consolidation_method consolidation_method,

      -- Status
      is_active BOOLEAN NOT NULL DEFAULT true,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Create indexes
  yield* sql`
    CREATE INDEX idx_companies_organization_id ON companies (organization_id)
  `

  yield* sql`
    CREATE INDEX idx_companies_parent_company_id ON companies (parent_company_id)
  `

  yield* sql`
    CREATE INDEX idx_companies_name ON companies (name)
  `

  yield* sql`
    CREATE INDEX idx_companies_is_active ON companies (is_active) WHERE is_active = true
  `

  // Create trigger for updated_at
  yield* sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `

  yield* sql`
    CREATE TRIGGER update_companies_updated_at
      BEFORE UPDATE ON companies
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
