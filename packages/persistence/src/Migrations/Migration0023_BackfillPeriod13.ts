/**
 * Migration0023_BackfillPeriod13
 *
 * Backfills Period 13 (adjustment period) for all existing fiscal years
 * that don't already have one.
 *
 * Period 13 is mandatory for:
 * 1. Consolidation compatibility - consolidation runs support periods 1-13
 * 2. Audit compliance - year-end adjustments must be segregated
 * 3. Standard accounting practice - period 13 is an industry standard
 *
 * @module Migration0023_BackfillPeriod13
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add Period 13 to all fiscal years that don't have one
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Insert Period 13 for all fiscal years that don't already have it
  // Period 13 uses the same end date as the fiscal year (adjustment period)
  yield* sql`
    INSERT INTO fiscal_periods (
      id,
      fiscal_year_id,
      period_number,
      name,
      period_type,
      start_date,
      end_date,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      fy.id,
      13,
      'Period 13 (Adjustment)',
      'Adjustment'::fiscal_period_type,
      fy.end_date,
      fy.end_date,
      'Closed'::fiscal_period_status,
      NOW(),
      NOW()
    FROM fiscal_years fy
    WHERE NOT EXISTS (
      SELECT 1 FROM fiscal_periods fp
      WHERE fp.fiscal_year_id = fy.id AND fp.period_number = 13
    )
  `

  // Update all fiscal years to mark them as including adjustment period
  yield* sql`
    UPDATE fiscal_years
    SET includes_adjustment_period = true
    WHERE includes_adjustment_period = false
  `
})
