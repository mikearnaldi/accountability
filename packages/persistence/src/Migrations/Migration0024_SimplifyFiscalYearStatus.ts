/**
 * Migration0024_SimplifyFiscalYearStatus
 *
 * Simplifies the fiscal year status model from 3 states to 2 states:
 * - Converts "Closing" status to "Open" (since Closing was a meaningless intermediate state)
 * - Updates the enum to only contain "Open" and "Closed"
 *
 * This supports the simplified workflow: Open ←→ Closed
 * Year-end close is now a single atomic operation.
 *
 * @module Migration0024_SimplifyFiscalYearStatus
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to convert existing fiscal year statuses to simplified 2-state model
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // First, convert any "Closing" years to "Open"
  // (They were in an intermediate state and should be reopened)
  yield* sql`
    UPDATE fiscal_years
    SET status = 'Open'
    WHERE status = 'Closing'
  `

  // PostgreSQL doesn't allow removing enum values directly,
  // so we need to create a new enum, update the column, and drop the old one
  yield* sql`
    CREATE TYPE fiscal_year_status_new AS ENUM (
      'Open',
      'Closed'
    )
  `

  // Drop the default before changing the column type
  // (otherwise PostgreSQL can't cast the default automatically)
  yield* sql`
    ALTER TABLE fiscal_years
    ALTER COLUMN status DROP DEFAULT
  `

  yield* sql`
    ALTER TABLE fiscal_years
    ALTER COLUMN status TYPE fiscal_year_status_new
    USING status::text::fiscal_year_status_new
  `

  // Restore the default with the new enum type
  yield* sql`
    ALTER TABLE fiscal_years
    ALTER COLUMN status SET DEFAULT 'Open'::fiscal_year_status_new
  `

  yield* sql`
    DROP TYPE fiscal_year_status
  `

  yield* sql`
    ALTER TYPE fiscal_year_status_new RENAME TO fiscal_year_status
  `
})
