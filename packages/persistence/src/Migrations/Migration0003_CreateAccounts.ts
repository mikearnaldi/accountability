/**
 * Migration0003_CreateAccounts
 *
 * Creates the accounts table (Chart of Accounts) with all account types,
 * categories, and hierarchy support.
 *
 * @module Migration0003_CreateAccounts
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create the accounts table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for account type
  yield* sql`
    CREATE TYPE account_type AS ENUM (
      'Asset',
      'Liability',
      'Equity',
      'Revenue',
      'Expense'
    )
  `

  // Create enum for account category
  yield* sql`
    CREATE TYPE account_category AS ENUM (
      'CurrentAsset',
      'NonCurrentAsset',
      'FixedAsset',
      'IntangibleAsset',
      'CurrentLiability',
      'NonCurrentLiability',
      'ContributedCapital',
      'RetainedEarnings',
      'OtherComprehensiveIncome',
      'TreasuryStock',
      'OperatingRevenue',
      'OtherRevenue',
      'CostOfGoodsSold',
      'OperatingExpense',
      'DepreciationAmortization',
      'InterestExpense',
      'TaxExpense',
      'OtherExpense'
    )
  `

  // Create enum for normal balance
  yield* sql`
    CREATE TYPE normal_balance AS ENUM (
      'Debit',
      'Credit'
    )
  `

  // Create enum for cash flow category
  yield* sql`
    CREATE TYPE cash_flow_category AS ENUM (
      'Operating',
      'Investing',
      'Financing',
      'NonCash'
    )
  `

  // Create accounts table
  yield* sql`
    CREATE TABLE accounts (
      id UUID PRIMARY KEY,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      account_number TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,

      -- Classification
      account_type account_type NOT NULL,
      account_category account_category NOT NULL,
      normal_balance normal_balance NOT NULL,

      -- Hierarchy
      parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
      hierarchy_level SMALLINT NOT NULL DEFAULT 1 CHECK (hierarchy_level >= 1),

      -- Behavior properties
      is_postable BOOLEAN NOT NULL DEFAULT true,
      is_cash_flow_relevant BOOLEAN NOT NULL DEFAULT false,
      cash_flow_category cash_flow_category,

      -- Intercompany properties
      is_intercompany BOOLEAN NOT NULL DEFAULT false,
      intercompany_partner_id UUID REFERENCES companies(id) ON DELETE SET NULL,

      -- Currency restriction
      currency_restriction CHAR(3),

      -- Status
      is_active BOOLEAN NOT NULL DEFAULT true,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deactivated_at TIMESTAMPTZ,

      -- Constraints
      UNIQUE (company_id, account_number)
    )
  `

  // Create indexes
  yield* sql`
    CREATE INDEX idx_accounts_company_id ON accounts (company_id)
  `

  yield* sql`
    CREATE INDEX idx_accounts_parent_account_id ON accounts (parent_account_id)
  `

  yield* sql`
    CREATE INDEX idx_accounts_account_type ON accounts (account_type)
  `

  yield* sql`
    CREATE INDEX idx_accounts_account_category ON accounts (account_category)
  `

  yield* sql`
    CREATE INDEX idx_accounts_is_postable ON accounts (is_postable) WHERE is_postable = true
  `

  yield* sql`
    CREATE INDEX idx_accounts_is_intercompany ON accounts (is_intercompany) WHERE is_intercompany = true
  `

  yield* sql`
    CREATE INDEX idx_accounts_is_active ON accounts (is_active) WHERE is_active = true
  `

  yield* sql`
    CREATE INDEX idx_accounts_intercompany_partner_id ON accounts (intercompany_partner_id)
      WHERE intercompany_partner_id IS NOT NULL
  `

  // Add trigger for updated_at
  yield* sql`
    CREATE TRIGGER update_accounts_updated_at
      BEFORE UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
