/**
 * Migration0015_AddRegistrationNumber
 *
 * Adds registration_number column to the companies table.
 *
 * @module Migration0015_AddRegistrationNumber
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add registration_number column to companies table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Add registration_number column
  yield* sql`
    ALTER TABLE companies
    ADD COLUMN registration_number VARCHAR(100)
  `
})
