/**
 * Migration0001_CreateOrganizations
 *
 * Creates the organizations table, the top-level container for companies.
 *
 * @module Migration0001_CreateOrganizations
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to create the organizations table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create organizations table
  yield* sql`
    CREATE TABLE organizations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      reporting_currency CHAR(3) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Settings stored as JSONB
      settings JSONB NOT NULL DEFAULT '{
        "defaultLocale": "en-US",
        "defaultTimezone": "UTC",
        "defaultDecimalPlaces": 2
      }'::jsonb
    )
  `

  // Create index on name for lookups
  yield* sql`
    CREATE INDEX idx_organizations_name ON organizations (name)
  `
})
