/**
 * JurisdictionCode - ISO 3166-1 alpha-2 country code value object
 *
 * A branded type representing a valid ISO 3166-1 alpha-2 country code (2 uppercase letters).
 * Uses Schema.brand for compile-time type safety.
 *
 * @module jurisdiction/JurisdictionCode
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
 * Type guard for JurisdictionCode using Schema.is
 */
export const isJurisdictionCode = Schema.is(JurisdictionCode)

/**
 * Common ISO 3166-1 alpha-2 country codes
 * Using Schema's .make() constructor which validates by default
 */
export const US: JurisdictionCode = JurisdictionCode.make("US")
export const GB: JurisdictionCode = JurisdictionCode.make("GB")
export const CA: JurisdictionCode = JurisdictionCode.make("CA")
export const AU: JurisdictionCode = JurisdictionCode.make("AU")
export const DE: JurisdictionCode = JurisdictionCode.make("DE")
export const FR: JurisdictionCode = JurisdictionCode.make("FR")
export const JP: JurisdictionCode = JurisdictionCode.make("JP")
export const CN: JurisdictionCode = JurisdictionCode.make("CN")
export const SG: JurisdictionCode = JurisdictionCode.make("SG")
export const HK: JurisdictionCode = JurisdictionCode.make("HK")
export const CH: JurisdictionCode = JurisdictionCode.make("CH")
export const NL: JurisdictionCode = JurisdictionCode.make("NL")
export const IE: JurisdictionCode = JurisdictionCode.make("IE")
