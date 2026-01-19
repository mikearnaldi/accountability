/**
 * Address - Value object for physical addresses
 *
 * Used for registered addresses, business addresses, etc.
 *
 * @module shared/values/Address
 */

import * as Schema from "effect/Schema"

/**
 * Address - A physical address
 *
 * All fields are optional to accommodate various international address formats.
 */
export class Address extends Schema.Class<Address>("Address")({
  /**
   * Street address line 1 (e.g., "123 Main St")
   */
  street1: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Street Address Line 1",
    description: "Primary street address"
  }),

  /**
   * Street address line 2 (e.g., "Suite 100")
   */
  street2: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Street Address Line 2",
    description: "Secondary street address (apartment, suite, etc.)"
  }),

  /**
   * City
   */
  city: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "City",
    description: "City or locality"
  }),

  /**
   * State, province, or region
   */
  state: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "State/Province",
    description: "State, province, or region"
  }),

  /**
   * Postal or ZIP code
   */
  postalCode: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Postal Code",
    description: "Postal or ZIP code"
  }),

  /**
   * Country (ISO 3166-1 alpha-2 code)
   */
  country: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Country",
    description: "Country (ISO 3166-1 alpha-2 code or full name)"
  })
}) {
  /**
   * Check if the address has any data
   */
  get isEmpty(): boolean {
    return (
      this.street1._tag === "None" &&
      this.street2._tag === "None" &&
      this.city._tag === "None" &&
      this.state._tag === "None" &&
      this.postalCode._tag === "None" &&
      this.country._tag === "None"
    )
  }

  /**
   * Format address as a single line
   */
  toSingleLine(): string {
    const parts: string[] = []

    if (this.street1._tag === "Some") parts.push(this.street1.value)
    if (this.street2._tag === "Some") parts.push(this.street2.value)
    if (this.city._tag === "Some") parts.push(this.city.value)
    if (this.state._tag === "Some") parts.push(this.state.value)
    if (this.postalCode._tag === "Some") parts.push(this.postalCode.value)
    if (this.country._tag === "Some") parts.push(this.country.value)

    return parts.join(", ")
  }

  /**
   * Format address as multiple lines
   */
  toMultiLine(): string[] {
    const lines: string[] = []

    if (this.street1._tag === "Some") lines.push(this.street1.value)
    if (this.street2._tag === "Some") lines.push(this.street2.value)

    const cityStatePostal: string[] = []
    if (this.city._tag === "Some") cityStatePostal.push(this.city.value)
    if (this.state._tag === "Some") cityStatePostal.push(this.state.value)
    if (this.postalCode._tag === "Some") cityStatePostal.push(this.postalCode.value)
    if (cityStatePostal.length > 0) lines.push(cityStatePostal.join(", "))

    if (this.country._tag === "Some") lines.push(this.country.value)

    return lines
  }
}

/**
 * Type guard for Address using Schema.is
 */
export const isAddress = Schema.is(Address)
