/**
 * CompanyType - Legal structure of a company
 *
 * Represents the legal form/structure of a business entity.
 *
 * @module company/CompanyType
 */

import * as Schema from "effect/Schema"

/**
 * CompanyType - The legal structure of a company
 *
 * Common corporate structures across jurisdictions:
 * - Corporation: C-Corp, S-Corp, public company
 * - LLC: Limited Liability Company (US), Limited Company (UK)
 * - Partnership: General or Limited Partnership
 * - SoleProprietorship: Single owner business
 * - NonProfit: Tax-exempt charitable organization
 * - Cooperative: Member-owned organization
 * - Branch: Branch of a foreign company
 * - Other: Other legal structures
 */
export const CompanyType = Schema.Literal(
  "Corporation",
  "LLC",
  "Partnership",
  "SoleProprietorship",
  "NonProfit",
  "Cooperative",
  "Branch",
  "Other"
).annotations({
  identifier: "CompanyType",
  title: "Company Type",
  description: "The legal structure of the company"
})

/**
 * The CompanyType type
 */
export type CompanyType = typeof CompanyType.Type

/**
 * Type guard for CompanyType using Schema.is
 */
export const isCompanyType = Schema.is(CompanyType)

/**
 * Display names for company types
 */
export const COMPANY_TYPE_DISPLAY_NAMES: Record<CompanyType, string> = {
  Corporation: "Corporation",
  LLC: "Limited Liability Company (LLC)",
  Partnership: "Partnership",
  SoleProprietorship: "Sole Proprietorship",
  NonProfit: "Non-Profit Organization",
  Cooperative: "Cooperative",
  Branch: "Branch Office",
  Other: "Other"
}

/**
 * All company types in display order
 */
export const ALL_COMPANY_TYPES: readonly CompanyType[] = [
  "Corporation",
  "LLC",
  "Partnership",
  "SoleProprietorship",
  "NonProfit",
  "Cooperative",
  "Branch",
  "Other"
] as const
