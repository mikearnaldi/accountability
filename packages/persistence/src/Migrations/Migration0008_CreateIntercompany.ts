/**
 * Migration0008_CreateIntercompany
 *
 * Creates intercompany_transactions table for tracking and reconciling
 * transactions between related companies.
 *
 * @module Migration0008_CreateIntercompany
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create intercompany transactions table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for intercompany transaction type
  yield* sql`
    CREATE TYPE intercompany_transaction_type AS ENUM (
      'SalePurchase',
      'Loan',
      'ManagementFee',
      'Dividend',
      'CapitalContribution',
      'CostAllocation',
      'Royalty'
    )
  `

  // Create enum for matching status
  yield* sql`
    CREATE TYPE matching_status AS ENUM (
      'Matched',
      'Unmatched',
      'PartiallyMatched',
      'VarianceApproved'
    )
  `

  // Create intercompany_transactions table
  yield* sql`
    CREATE TABLE intercompany_transactions (
      id UUID PRIMARY KEY,
      from_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      to_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
      transaction_type intercompany_transaction_type NOT NULL,
      transaction_date DATE NOT NULL,

      -- Amount as JSONB (MonetaryAmount with amount and currency)
      amount JSONB NOT NULL,

      -- Journal entry references
      from_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
      to_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,

      -- Matching status
      matching_status matching_status NOT NULL DEFAULT 'Unmatched',

      -- Variance tracking (JSONB for MonetaryAmount)
      variance_amount JSONB,
      variance_explanation TEXT,

      -- Description
      description TEXT,

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      CHECK (from_company_id <> to_company_id)
    )
  `

  // Create indexes for intercompany_transactions
  yield* sql`
    CREATE INDEX idx_intercompany_transactions_from_company_id
      ON intercompany_transactions (from_company_id)
  `

  yield* sql`
    CREATE INDEX idx_intercompany_transactions_to_company_id
      ON intercompany_transactions (to_company_id)
  `

  yield* sql`
    CREATE INDEX idx_intercompany_transactions_transaction_date
      ON intercompany_transactions (transaction_date)
  `

  yield* sql`
    CREATE INDEX idx_intercompany_transactions_transaction_type
      ON intercompany_transactions (transaction_type)
  `

  yield* sql`
    CREATE INDEX idx_intercompany_transactions_matching_status
      ON intercompany_transactions (matching_status)
  `

  yield* sql`
    CREATE INDEX idx_intercompany_transactions_from_journal_entry_id
      ON intercompany_transactions (from_journal_entry_id)
      WHERE from_journal_entry_id IS NOT NULL
  `

  yield* sql`
    CREATE INDEX idx_intercompany_transactions_to_journal_entry_id
      ON intercompany_transactions (to_journal_entry_id)
      WHERE to_journal_entry_id IS NOT NULL
  `

  // Compound index for finding transactions between two companies
  yield* sql`
    CREATE INDEX idx_intercompany_transactions_company_pair
      ON intercompany_transactions (
        LEAST(from_company_id, to_company_id),
        GREATEST(from_company_id, to_company_id)
      )
  `

  // Add trigger for updated_at
  yield* sql`
    CREATE TRIGGER update_intercompany_transactions_updated_at
      BEFORE UPDATE ON intercompany_transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
