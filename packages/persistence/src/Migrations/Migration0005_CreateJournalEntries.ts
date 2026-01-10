/**
 * Migration0005_CreateJournalEntries
 *
 * Creates journal_entries and journal_entry_lines tables for double-entry bookkeeping.
 *
 * @module Migration0005_CreateJournalEntries
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create journal entries and lines tables
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for journal entry type
  yield* sql`
    CREATE TYPE journal_entry_type AS ENUM (
      'Standard',
      'Adjusting',
      'Closing',
      'Opening',
      'Reversing',
      'Recurring',
      'Intercompany',
      'Revaluation',
      'Elimination',
      'System'
    )
  `

  // Create enum for journal entry status
  yield* sql`
    CREATE TYPE journal_entry_status AS ENUM (
      'Draft',
      'PendingApproval',
      'Approved',
      'Posted',
      'Reversed'
    )
  `

  // Create enum for source module
  yield* sql`
    CREATE TYPE source_module AS ENUM (
      'GeneralLedger',
      'AccountsPayable',
      'AccountsReceivable',
      'FixedAssets',
      'Inventory',
      'Payroll',
      'Consolidation'
    )
  `

  // Create journal_entries table
  yield* sql`
    CREATE TABLE journal_entries (
      id UUID PRIMARY KEY,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      entry_number TEXT,
      reference_number TEXT,
      description TEXT NOT NULL,

      -- Dates
      transaction_date DATE NOT NULL,
      posting_date DATE,
      document_date DATE,

      -- Fiscal period reference
      fiscal_year INTEGER NOT NULL,
      fiscal_period INTEGER NOT NULL,

      -- Entry properties
      entry_type journal_entry_type NOT NULL DEFAULT 'Standard',
      source_module source_module NOT NULL DEFAULT 'GeneralLedger',
      source_document_ref TEXT,
      is_multi_currency BOOLEAN NOT NULL DEFAULT false,

      -- Status
      status journal_entry_status NOT NULL DEFAULT 'Draft',

      -- Reversal tracking
      is_reversing BOOLEAN NOT NULL DEFAULT false,
      reversed_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
      reversing_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,

      -- Audit columns
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      posted_by UUID,
      posted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      UNIQUE (company_id, entry_number)
    )
  `

  // Create indexes for journal_entries
  yield* sql`
    CREATE INDEX idx_journal_entries_company_id ON journal_entries (company_id)
  `

  yield* sql`
    CREATE INDEX idx_journal_entries_status ON journal_entries (status)
  `

  yield* sql`
    CREATE INDEX idx_journal_entries_transaction_date ON journal_entries (transaction_date)
  `

  yield* sql`
    CREATE INDEX idx_journal_entries_fiscal_period ON journal_entries (fiscal_year, fiscal_period)
  `

  yield* sql`
    CREATE INDEX idx_journal_entries_entry_type ON journal_entries (entry_type)
  `

  yield* sql`
    CREATE INDEX idx_journal_entries_source_module ON journal_entries (source_module)
  `

  yield* sql`
    CREATE INDEX idx_journal_entries_reversed_entry_id ON journal_entries (reversed_entry_id)
      WHERE reversed_entry_id IS NOT NULL
  `

  yield* sql`
    CREATE INDEX idx_journal_entries_reversing_entry_id ON journal_entries (reversing_entry_id)
      WHERE reversing_entry_id IS NOT NULL
  `

  // Create journal_entry_lines table
  yield* sql`
    CREATE TABLE journal_entry_lines (
      id UUID PRIMARY KEY,
      journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      line_number SMALLINT NOT NULL CHECK (line_number >= 1),
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

      -- Transaction currency amounts
      debit_amount NUMERIC(19, 4),
      debit_currency CHAR(3),
      credit_amount NUMERIC(19, 4),
      credit_currency CHAR(3),

      -- Functional currency amounts
      functional_debit_amount NUMERIC(19, 4),
      functional_debit_currency CHAR(3),
      functional_credit_amount NUMERIC(19, 4),
      functional_credit_currency CHAR(3),

      -- Exchange rate for currency conversion
      exchange_rate NUMERIC(19, 10) NOT NULL DEFAULT 1,

      -- Additional info
      memo TEXT,
      dimensions JSONB,

      -- Intercompany properties
      intercompany_partner_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      matching_line_id UUID REFERENCES journal_entry_lines(id) ON DELETE SET NULL,

      -- Constraints
      UNIQUE (journal_entry_id, line_number),
      CHECK (
        (debit_amount IS NOT NULL AND credit_amount IS NULL) OR
        (debit_amount IS NULL AND credit_amount IS NOT NULL)
      )
    )
  `

  // Create indexes for journal_entry_lines
  yield* sql`
    CREATE INDEX idx_journal_entry_lines_journal_entry_id ON journal_entry_lines (journal_entry_id)
  `

  yield* sql`
    CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines (account_id)
  `

  yield* sql`
    CREATE INDEX idx_journal_entry_lines_intercompany_partner_id
      ON journal_entry_lines (intercompany_partner_id)
      WHERE intercompany_partner_id IS NOT NULL
  `

  yield* sql`
    CREATE INDEX idx_journal_entry_lines_matching_line_id
      ON journal_entry_lines (matching_line_id)
      WHERE matching_line_id IS NOT NULL
  `

  // Add trigger for updated_at
  yield* sql`
    CREATE TRIGGER update_journal_entries_updated_at
      BEFORE UPDATE ON journal_entries
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
