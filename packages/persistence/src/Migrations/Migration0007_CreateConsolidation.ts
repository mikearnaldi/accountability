/**
 * Migration0007_CreateConsolidation
 *
 * Creates consolidation_groups, consolidation_members, and elimination_rules tables
 * for multi-company consolidation support per ASC 810.
 *
 * @module Migration0007_CreateConsolidation
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create consolidation tables
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create consolidation_groups table
  yield* sql`
    CREATE TABLE consolidation_groups (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      reporting_currency CHAR(3) NOT NULL,
      consolidation_method consolidation_method NOT NULL DEFAULT 'FullConsolidation',
      parent_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      is_active BOOLEAN NOT NULL DEFAULT true,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Create indexes for consolidation_groups
  yield* sql`
    CREATE INDEX idx_consolidation_groups_organization_id
      ON consolidation_groups (organization_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_groups_parent_company_id
      ON consolidation_groups (parent_company_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_groups_is_active
      ON consolidation_groups (is_active) WHERE is_active = true
  `

  // Create consolidation_members table (join table with additional properties)
  yield* sql`
    CREATE TABLE consolidation_members (
      id UUID PRIMARY KEY,
      consolidation_group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      ownership_percentage NUMERIC(5, 2) NOT NULL CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
      consolidation_method consolidation_method NOT NULL,
      acquisition_date DATE NOT NULL,

      -- Goodwill amount as JSONB (MonetaryAmount with amount and currency)
      goodwill_amount JSONB,

      -- Non-controlling interest percentage
      non_controlling_interest_percentage NUMERIC(5, 2) NOT NULL
        CHECK (non_controlling_interest_percentage >= 0 AND non_controlling_interest_percentage <= 100),

      -- VIE determination as JSONB
      vie_determination JSONB,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      UNIQUE (consolidation_group_id, company_id)
    )
  `

  // Create indexes for consolidation_members
  yield* sql`
    CREATE INDEX idx_consolidation_members_group_id
      ON consolidation_members (consolidation_group_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_members_company_id
      ON consolidation_members (company_id)
  `

  yield* sql`
    CREATE INDEX idx_consolidation_members_consolidation_method
      ON consolidation_members (consolidation_method)
  `

  // Create enum for elimination type
  yield* sql`
    CREATE TYPE elimination_type AS ENUM (
      'IntercompanyReceivablePayable',
      'IntercompanyRevenueExpense',
      'IntercompanyDividend',
      'IntercompanyInvestment',
      'UnrealizedProfitInventory',
      'UnrealizedProfitFixedAssets'
    )
  `

  // Create elimination_rules table
  yield* sql`
    CREATE TABLE elimination_rules (
      id UUID PRIMARY KEY,
      consolidation_group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      elimination_type elimination_type NOT NULL,

      -- Account targeting as JSONB arrays of AccountSelector
      trigger_conditions JSONB NOT NULL DEFAULT '[]',
      source_accounts JSONB NOT NULL DEFAULT '[]',
      target_accounts JSONB NOT NULL DEFAULT '[]',

      -- Elimination entry accounts
      debit_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      credit_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

      -- Processing options
      is_automatic BOOLEAN NOT NULL DEFAULT true,
      priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0),
      is_active BOOLEAN NOT NULL DEFAULT true,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Create indexes for elimination_rules
  yield* sql`
    CREATE INDEX idx_elimination_rules_consolidation_group_id
      ON elimination_rules (consolidation_group_id)
  `

  yield* sql`
    CREATE INDEX idx_elimination_rules_elimination_type
      ON elimination_rules (elimination_type)
  `

  yield* sql`
    CREATE INDEX idx_elimination_rules_priority
      ON elimination_rules (priority)
  `

  yield* sql`
    CREATE INDEX idx_elimination_rules_is_active
      ON elimination_rules (is_active) WHERE is_active = true
  `

  yield* sql`
    CREATE INDEX idx_elimination_rules_is_automatic
      ON elimination_rules (is_automatic) WHERE is_automatic = true
  `

  // Add triggers for updated_at
  yield* sql`
    CREATE TRIGGER update_consolidation_groups_updated_at
      BEFORE UPDATE ON consolidation_groups
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `

  yield* sql`
    CREATE TRIGGER update_consolidation_members_updated_at
      BEFORE UPDATE ON consolidation_members
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `

  yield* sql`
    CREATE TRIGGER update_elimination_rules_updated_at
      BEFORE UPDATE ON elimination_rules
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
