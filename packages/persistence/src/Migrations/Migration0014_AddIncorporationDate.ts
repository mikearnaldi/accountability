/**
 * Migration0014_AddIncorporationDate
 *
 * Adds incorporation_date column to the companies table.
 *
 * @module Migration0014_AddIncorporationDate
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add incorporation_date column to companies table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Add incorporation_date column
  yield* sql`
    ALTER TABLE companies
    ADD COLUMN incorporation_date DATE
  `
})
