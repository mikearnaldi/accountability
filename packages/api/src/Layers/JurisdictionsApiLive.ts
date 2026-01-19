/**
 * JurisdictionsApiLive - Live implementation of jurisdictions API handlers
 *
 * Implements the JurisdictionsApi endpoints by returning the predefined
 * PREDEFINED_JURISDICTIONS from the core package.
 *
 * @module JurisdictionsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import { PREDEFINED_JURISDICTIONS } from "@accountability/core/jurisdiction/Jurisdiction"
import { AppApi } from "../Definitions/AppApi.ts"
import { JurisdictionItem } from "../Definitions/JurisdictionsApi.ts"

/**
 * JurisdictionsApiLive - Layer providing JurisdictionsApi handlers
 *
 * No external dependencies - uses predefined jurisdictions from core package.
 */
export const JurisdictionsApiLive = HttpApiBuilder.group(AppApi, "jurisdictions", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle("listJurisdictions", () =>
        Effect.gen(function* () {
          // Convert Jurisdiction entities to JurisdictionItem response objects
          const jurisdictionItems = PREDEFINED_JURISDICTIONS.map(JurisdictionItem.fromJurisdiction)

          return { jurisdictions: jurisdictionItems }
        })
      )
  })
)
