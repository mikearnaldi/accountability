/**
 * Organization - Top-level container entity for companies
 *
 * The Organization represents the top-level entity that owns and manages
 * multiple companies. It defines the consolidated reporting currency and
 * organization-wide settings.
 *
 * @module organization/Organization
 */

import * as Schema from "effect/Schema"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * OrganizationId - Branded UUID string for organization identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const OrganizationId = Schema.UUID.pipe(
  Schema.brand("OrganizationId"),
  Schema.annotations({
    identifier: "OrganizationId",
    title: "Organization ID",
    description: "A unique identifier for an organization (UUID format)"
  })
)

/**
 * The branded OrganizationId type
 */
export type OrganizationId = typeof OrganizationId.Type

/**
 * Type guard for OrganizationId using Schema.is
 */
export const isOrganizationId = Schema.is(OrganizationId)

/**
 * OrganizationSettings - Organization-wide configuration settings
 *
 * A flexible settings object for organization-level configuration.
 */
export class OrganizationSettings extends Schema.Class<OrganizationSettings>("OrganizationSettings")({
  /**
   * Default locale for the organization (e.g., "en-US", "en-GB")
   */
  defaultLocale: Schema.propertySignature(Schema.String).pipe(
    Schema.withConstructorDefault(() => "en-US")
  ),

  /**
   * Default timezone for the organization (IANA timezone identifier)
   */
  defaultTimezone: Schema.propertySignature(Schema.String).pipe(
    Schema.withConstructorDefault(() => "UTC")
  ),

  /**
   * Default decimal places for monetary display
   */
  defaultDecimalPlaces: Schema.propertySignature(Schema.Number.pipe(Schema.int(), Schema.between(0, 4))).pipe(
    Schema.withConstructorDefault(() => 2)
  )
}) {}

/**
 * Type guard for OrganizationSettings using Schema.is
 */
export const isOrganizationSettings = Schema.is(OrganizationSettings)

/**
 * Organization - The top-level container entity
 *
 * Represents an organization that can own multiple companies.
 * Contains the reporting currency used for consolidated reports
 * and organization-wide settings.
 */
export class Organization extends Schema.Class<Organization>("Organization")({
  /**
   * Unique identifier for the organization
   */
  id: OrganizationId,

  /**
   * Display name of the organization
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Organization Name",
    description: "The display name of the organization"
  }),

  /**
   * The currency used for consolidated reporting across all companies
   */
  reportingCurrency: CurrencyCode,

  /**
   * When the organization was created
   */
  createdAt: Timestamp,

  /**
   * Organization-wide settings and configuration
   */
  settings: OrganizationSettings
}) {}

/**
 * Type guard for Organization using Schema.is
 */
export const isOrganization = Schema.is(Organization)
