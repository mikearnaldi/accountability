/**
 * Migration0006_CreateExchangeRates
 *
 * Creates exchange_rates table for currency conversion.
 *
 * @module Migration0006_CreateExchangeRates
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create exchange rates table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create enum for rate type
  yield* sql`
    CREATE TYPE rate_type AS ENUM (
      'Spot',
      'Average',
      'Historical',
      'Closing'
    )
  `

  // Create enum for rate source
  yield* sql`
    CREATE TYPE rate_source AS ENUM (
      'Manual',
      'Import',
      'API'
    )
  `

  // Create exchange_rates table
  yield* sql`
    CREATE TABLE exchange_rates (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      from_currency CHAR(3) NOT NULL,
      to_currency CHAR(3) NOT NULL,
      rate NUMERIC(19, 10) NOT NULL CHECK (rate > 0),
      effective_date DATE NOT NULL,
      rate_type rate_type NOT NULL DEFAULT 'Spot',
      source rate_source NOT NULL DEFAULT 'Manual',

      -- Audit columns
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      UNIQUE (organization_id, from_currency, to_currency, effective_date, rate_type)
    )
  `

  // Create indexes
  yield* sql`
    CREATE INDEX idx_exchange_rates_organization_id ON exchange_rates (organization_id)
  `

  yield* sql`
    CREATE INDEX idx_exchange_rates_currencies ON exchange_rates (from_currency, to_currency)
  `

  yield* sql`
    CREATE INDEX idx_exchange_rates_effective_date ON exchange_rates (effective_date DESC)
  `

  yield* sql`
    CREATE INDEX idx_exchange_rates_rate_type ON exchange_rates (rate_type)
  `

  yield* sql`
    CREATE INDEX idx_exchange_rates_lookup
      ON exchange_rates (organization_id, from_currency, to_currency, effective_date DESC, rate_type)
  `

  // Add trigger for updated_at
  yield* sql`
    CREATE TRIGGER update_exchange_rates_updated_at
      BEFORE UPDATE ON exchange_rates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `
})
