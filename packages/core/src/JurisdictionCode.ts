/**
 * JurisdictionCode - ISO 3166-1 alpha-2 country code value object
 *
 * A branded type representing a valid ISO 3166-1 alpha-2 country code (2 uppercase letters).
 * Uses Schema.brand for compile-time type safety.
 *
 * @module JurisdictionCode
 */

import * as Schema from "effect/Schema"

/**
 * Schema for a valid ISO 3166-1 alpha-2 country code.
 * Must be exactly 2 uppercase ASCII letters.
 */
export const JurisdictionCode = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{2}$/),
  Schema.brand("JurisdictionCode"),
  Schema.annotations({
    identifier: "JurisdictionCode",
    title: "Jurisdiction Code",
    description: "An ISO 3166-1 alpha-2 country code (2 uppercase letters)"
  })
)

/**
 * The branded JurisdictionCode type
 */
export type JurisdictionCode = typeof JurisdictionCode.Type

/**
 * Constructor that bypasses validation (for internal use with known-valid codes)
 */
export const make = (code: string): JurisdictionCode => code as JurisdictionCode

/**
 * Type guard for JurisdictionCode using Schema.is
 */
export const isJurisdictionCode = Schema.is(JurisdictionCode)

/**
 * Common ISO 3166-1 alpha-2 country codes
 */
export const US: JurisdictionCode = make("US")
export const GB: JurisdictionCode = make("GB")
export const CA: JurisdictionCode = make("CA")
export const AU: JurisdictionCode = make("AU")
export const DE: JurisdictionCode = make("DE")
export const FR: JurisdictionCode = make("FR")
export const JP: JurisdictionCode = make("JP")
export const CN: JurisdictionCode = make("CN")
export const SG: JurisdictionCode = make("SG")
export const HK: JurisdictionCode = make("HK")
export const CH: JurisdictionCode = make("CH")
