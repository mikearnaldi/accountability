/**
 * Migration0016_AddCompanyOptionalFields
 *
 * Adds optional fields to the companies table:
 * - registered_address_* (street1, street2, city, state, postal_code, country)
 * - industry_code (NAICS/SIC)
 * - company_type (Corporation, LLC, etc.)
 * - incorporation_jurisdiction (may differ from operating jurisdiction)
 *
 * @module Migration0016_AddCompanyOptionalFields
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to add optional fields to companies table
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Add registered address fields
  yield* sql`
    ALTER TABLE companies
    ADD COLUMN registered_address_street1 VARCHAR(200),
    ADD COLUMN registered_address_street2 VARCHAR(200),
    ADD COLUMN registered_address_city VARCHAR(100),
    ADD COLUMN registered_address_state VARCHAR(100),
    ADD COLUMN registered_address_postal_code VARCHAR(20),
    ADD COLUMN registered_address_country VARCHAR(100)
  `

  // Add industry code
  yield* sql`
    ALTER TABLE companies
    ADD COLUMN industry_code VARCHAR(20)
  `

  // Add company type
  yield* sql`
    ALTER TABLE companies
    ADD COLUMN company_type VARCHAR(50)
  `

  // Add incorporation jurisdiction
  yield* sql`
    ALTER TABLE companies
    ADD COLUMN incorporation_jurisdiction VARCHAR(10)
  `
})
