/**
 * Migration0022_SimplifyFiscalPeriodStatus
 *
 * Simplifies the fiscal period status model from 5 states to 2 states:
 * - Converts Future, SoftClose, and Locked statuses to Closed
 * - Keeps Open and Closed as the only valid statuses
 *
 * This supports the simplified workflow: Open ←→ Closed
 *
 * @module Migration0022_SimplifyFiscalPeriodStatus
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to convert existing fiscal period statuses to simplified 2-state model
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Convert Future, SoftClose, and Locked statuses to Closed
  yield* sql`
    UPDATE fiscal_periods
    SET status = 'Closed'
    WHERE status IN ('Future', 'SoftClose', 'Locked')
  `
})
