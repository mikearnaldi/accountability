/**
 * Company - Legal entity within an organization
 *
 * Each company represents a legal entity within the organization with its own
 * functional currency, jurisdiction, fiscal settings, and consolidation properties.
 *
 * @module company/Company
 */

import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { Address } from "../shared/values/Address.ts"
import { CompanyType } from "./CompanyType.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { JurisdictionCode } from "../jurisdiction/JurisdictionCode.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"
import { OrganizationId } from "../organization/Organization.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { AccountId } from "../accounting/AccountId.ts"

/**
 * CompanyId - Branded UUID string for company identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const CompanyId = Schema.UUID.pipe(
  Schema.brand("CompanyId"),
  Schema.annotations({
    identifier: "CompanyId",
    title: "Company ID",
    description: "A unique identifier for a company (UUID format)"
  })
)

/**
 * The branded CompanyId type
 */
export type CompanyId = typeof CompanyId.Type

/**
 * Type guard for CompanyId using Schema.is
 */
export const isCompanyId = Schema.is(CompanyId)

/**
 * ConsolidationMethod - Defines how a subsidiary is consolidated
 *
 * Per ASC 810:
 * - FullConsolidation: >50% voting interest - 100% of assets/liabilities, recognize NCI
 * - EquityMethod: 20-50% - Single line investment, share of earnings
 * - CostMethod: <20% - Investment at cost, dividends as income
 * - VariableInterestEntity: Primary beneficiary - Full consolidation regardless of voting interest
 */
export const ConsolidationMethod = Schema.Literal(
  "FullConsolidation",
  "EquityMethod",
  "CostMethod",
  "VariableInterestEntity"
).annotations({
  identifier: "ConsolidationMethod",
  title: "Consolidation Method",
  description: "The method used to consolidate a subsidiary per ASC 810"
})

/**
 * The ConsolidationMethod type
 */
export type ConsolidationMethod = typeof ConsolidationMethod.Type

/**
 * Type guard for ConsolidationMethod using Schema.is
 */
export const isConsolidationMethod = Schema.is(ConsolidationMethod)

/**
 * FiscalYearEnd - Represents the fiscal year end date (month and day)
 *
 * Used to define when a company's fiscal year ends. The fiscal year
 * start is calculated as the day after the previous fiscal year end.
 */
export class FiscalYearEnd extends Schema.Class<FiscalYearEnd>("FiscalYearEnd")({
  /**
   * Month of fiscal year end (1-12)
   */
  month: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
    Schema.lessThanOrEqualTo(12)
  ),

  /**
   * Day of fiscal year end (1-31, must be valid for the month)
   */
  day: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
    Schema.lessThanOrEqualTo(31)
  )
}) {
  /**
   * Check if this represents a calendar year end (December 31)
   */
  get isCalendarYearEnd(): boolean {
    return this.month === 12 && this.day === 31
  }

  /**
   * Format as a display string (e.g., "December 31")
   */
  toDisplayString(): string {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]
    return `${monthNames[this.month - 1]} ${this.day}`
  }
}

/**
 * Type guard for FiscalYearEnd using Schema.is
 */
export const isFiscalYearEnd = Schema.is(FiscalYearEnd)

/**
 * Common fiscal year end dates
 */
export const CALENDAR_YEAR_END: FiscalYearEnd = FiscalYearEnd.make({ month: 12, day: 31 })

export const FISCAL_YEAR_END_MARCH: FiscalYearEnd = FiscalYearEnd.make({ month: 3, day: 31 })

export const FISCAL_YEAR_END_JUNE: FiscalYearEnd = FiscalYearEnd.make({ month: 6, day: 30 })

export const FISCAL_YEAR_END_SEPTEMBER: FiscalYearEnd = FiscalYearEnd.make({ month: 9, day: 30 })

/**
 * Company - Legal entity within an organization
 *
 * Represents a legal entity with its own functional currency, jurisdiction,
 * fiscal settings, and consolidation properties per ASC 810 and ASC 830.
 */
export class Company extends Schema.Class<Company>("Company")({
  /**
   * Unique identifier for the company
   */
  id: CompanyId,

  /**
   * Reference to parent organization
   */
  organizationId: OrganizationId,

  /**
   * Display name of the company
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Company Name",
    description: "The display name of the company"
  }),

  /**
   * Legal name of the company (as registered)
   */
  legalName: Schema.NonEmptyTrimmedString.annotations({
    title: "Legal Name",
    description: "The legal registered name of the company"
  }),

  /**
   * Jurisdiction (country of incorporation)
   */
  jurisdiction: JurisdictionCode,

  /**
   * Tax identification number (optional)
   */
  taxId: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Tax ID",
    description: "Tax identification number (EIN, VAT number, etc.)"
  }),

  /**
   * Date when the company was legally incorporated (optional)
   */
  incorporationDate: Schema.OptionFromNullOr(LocalDate).annotations({
    title: "Incorporation Date",
    description: "The date when the company was legally incorporated"
  }),

  /**
   * Company registration/incorporation number (optional)
   * Format varies by jurisdiction (e.g., EIN in US, Companies House number in UK)
   */
  registrationNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Registration Number",
    description: "Company registration or incorporation number for the jurisdiction"
  }),

  /**
   * Registered address of the company (optional)
   * The official legal address where the company is registered
   */
  registeredAddress: Schema.OptionFromNullOr(Address).annotations({
    title: "Registered Address",
    description: "Official legal address where the company is registered"
  }),

  /**
   * Industry classification code (optional)
   * NAICS (North American) or SIC code
   */
  industryCode: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Industry Code",
    description: "NAICS or SIC industry classification code"
  }),

  /**
   * Legal structure of the company (optional)
   * Corporation, LLC, Partnership, etc.
   */
  companyType: Schema.OptionFromNullOr(CompanyType).annotations({
    title: "Company Type",
    description: "Legal structure of the company (Corporation, LLC, etc.)"
  }),

  /**
   * Jurisdiction where the company was incorporated (optional)
   * May differ from operating jurisdiction
   */
  incorporationJurisdiction: Schema.OptionFromNullOr(JurisdictionCode).annotations({
    title: "Incorporation Jurisdiction",
    description: "Jurisdiction where the company was legally incorporated (if different from operating jurisdiction)"
  }),

  /**
   * Functional currency per ASC 830
   * The currency of the primary economic environment in which the entity operates
   */
  functionalCurrency: CurrencyCode,

  /**
   * Reporting currency
   * The currency used for presenting financial statements (may differ from functional)
   */
  reportingCurrency: CurrencyCode,

  /**
   * Fiscal year end date (month and day)
   */
  fiscalYearEnd: FiscalYearEnd,

  /**
   * Retained earnings account for year-end closing (optional)
   * Net income will be posted to this account during year-end close.
   * Should be an Equity account with category "RetainedEarnings".
   * Can be auto-set when applying a Chart of Accounts template.
   */
  retainedEarningsAccountId: Schema.OptionFromNullOr(AccountId).annotations({
    title: "Retained Earnings Account ID",
    description: "Account for posting net income during year-end close"
  }),

  /**
   * Whether the company is active
   */
  isActive: Schema.Boolean.annotations({
    title: "Is Active",
    description: "Whether the company is currently active"
  }),

  /**
   * When the company was created
   */
  createdAt: Timestamp
}) {
  /**
   * Check if functional and reporting currencies match
   */
  get hasSameFunctionalAndReportingCurrency(): boolean {
    return this.functionalCurrency === this.reportingCurrency
  }

  /**
   * Check if retained earnings account is configured for year-end closing
   */
  get hasRetainedEarningsAccount(): boolean {
    return Option.isSome(this.retainedEarningsAccountId)
  }
}

/**
 * Type guard for Company using Schema.is
 */
export const isCompany = Schema.is(Company)
