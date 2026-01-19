/**
 * JurisdictionsApi - HTTP API group for jurisdiction master data
 *
 * Provides endpoint to list available jurisdictions for UI dropdowns.
 * Returns predefined PREDEFINED_JURISDICTIONS from the core package.
 *
 * @module JurisdictionsApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import type { Jurisdiction } from "@accountability/core/jurisdiction/Jurisdiction"
import { JurisdictionCode } from "@accountability/core/jurisdiction/JurisdictionCode"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { AuthMiddleware } from "./AuthMiddleware.ts"

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * JurisdictionItem - Single jurisdiction item in the response
 *
 * This is the response shape for API consumers, derived from Jurisdiction entity.
 * Uses simplified schema without taxSettings for dropdown use cases.
 */
export class JurisdictionItem extends Schema.Class<JurisdictionItem>("JurisdictionItem")({
  code: JurisdictionCode,
  name: Schema.NonEmptyTrimmedString,
  defaultCurrency: CurrencyCode
}) {
  /**
   * Create a JurisdictionItem from a Jurisdiction entity
   */
  static fromJurisdiction(jurisdiction: Jurisdiction): JurisdictionItem {
    return JurisdictionItem.make({
      code: jurisdiction.code,
      name: jurisdiction.name,
      defaultCurrency: jurisdiction.defaultCurrency
    })
  }
}

/**
 * JurisdictionListResponse - Response containing a list of jurisdictions
 */
export class JurisdictionListResponse extends Schema.Class<JurisdictionListResponse>("JurisdictionListResponse")({
  jurisdictions: Schema.Array(JurisdictionItem)
}) {}

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * List all available jurisdictions
 *
 * Returns predefined jurisdictions for use in UI dropdowns.
 */
const listJurisdictions = HttpApiEndpoint.get("listJurisdictions", "/")
  .addSuccess(JurisdictionListResponse)
  .annotateContext(OpenApi.annotations({
    summary: "List jurisdictions",
    description: "Retrieve a list of available jurisdictions for UI dropdowns. Returns predefined jurisdictions with ISO 3166-1 alpha-2 country codes and their default currencies."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * JurisdictionsApi - API group for jurisdiction master data
 *
 * Base path: /api/v1/jurisdictions
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class JurisdictionsApi extends HttpApiGroup.make("jurisdictions")
  .add(listJurisdictions)
  .middleware(AuthMiddleware)
  .prefix("/v1/jurisdictions")
  .annotateContext(OpenApi.annotations({
    title: "Jurisdictions",
    description: "Jurisdiction master data for UI dropdowns. Returns predefined jurisdictions with ISO 3166-1 alpha-2 country codes and default currencies."
  })) {}
