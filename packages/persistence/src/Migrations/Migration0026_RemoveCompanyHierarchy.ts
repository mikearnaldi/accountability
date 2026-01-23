/**
 * Migration0026_RemoveCompanyHierarchy
 *
 * Removes parent-subsidiary relationship fields from the companies table.
 *
 * Consolidation relationships are now defined ONLY in ConsolidationGroups/ConsolidationMembers,
 * providing:
 * - Cleaner domain model with no data duplication
 * - More flexibility (same company can be in multiple consolidation scenarios)
 * - Single source of truth for ownership and consolidation method
 *
 * @module Migration0026_RemoveCompanyHierarchy
 */

import { SqlClient } from "@effect/sql"
import * as Effect from "effect/Effect"

/**
 * Migration to remove company hierarchy columns
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // 1. Drop the index on parent_company_id
  yield* sql`DROP INDEX IF EXISTS idx_companies_parent_company_id`

  // 2. Remove the columns from companies table
  yield* sql`
    ALTER TABLE companies
    DROP COLUMN IF EXISTS parent_company_id,
    DROP COLUMN IF EXISTS ownership_percentage,
    DROP COLUMN IF EXISTS consolidation_method
  `

  // Note: We keep the consolidation_method enum type because it's used
  // in the consolidation_members table (ConsolidationGroup memberships)
})
