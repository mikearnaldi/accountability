/**
 * Companies State Atoms
 *
 * Manages company selection state using Effect Atom.
 * Provides atoms for:
 * - Selected company with localStorage persistence
 * - All companies grouped by organization for the selector
 *
 * @module companies
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { Company } from "@accountability/core/Domains/Company"
import type { Organization } from "@accountability/core/Domains/Organization"
import { ApiClient } from "./ApiClient.ts"

// =============================================================================
// Constants
// =============================================================================

const SELECTED_COMPANY_KEY = "selected_company_id"

// =============================================================================
// LocalStorage Helpers
// =============================================================================

/**
 * Get the stored company ID from localStorage
 */
function getStoredCompanyId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(SELECTED_COMPANY_KEY)
}

/**
 * Store the selected company ID in localStorage
 */
function setStoredCompanyId(companyId: string | null): void {
  if (typeof window === "undefined") return
  if (companyId === null) {
    localStorage.removeItem(SELECTED_COMPANY_KEY)
  } else {
    localStorage.setItem(SELECTED_COMPANY_KEY, companyId)
  }
}

// =============================================================================
// All Companies Atom
// =============================================================================

/**
 * Represents a company with its parent organization info for display
 */
export interface CompanyWithOrganization {
  readonly company: Company
  readonly organization: Organization
}

/**
 * Represents companies grouped by organization
 */
export interface CompaniesGroupedByOrg {
  readonly organization: Organization
  readonly companies: ReadonlyArray<Company>
}

/**
 * allOrganizationsAtom - Fetches all organizations for the current user
 *
 * This atom fetches the list of organizations and caches it.
 */
export const allOrganizationsAtom = ApiClient.query("companies", "listOrganizations", {
  timeToLive: Duration.minutes(5),
  reactivityKeys: ["organizations"]
})

/**
 * companiesByOrganizationAtom - Fetches all companies for all organizations
 *
 * This creates a derived atom that:
 * 1. Gets all organizations
 * 2. For each organization, fetches its companies
 * 3. Returns companies grouped by organization
 */
export const allCompaniesGroupedAtom = ApiClient.runtime.atom(
  Effect.gen(function* () {
    const client = yield* ApiClient

    // First get all organizations
    const orgsResponse = yield* client.companies.listOrganizations({})
    const organizations = orgsResponse.organizations

    // For each organization, fetch its companies
    const groupedCompanies: Array<CompaniesGroupedByOrg> = []

    for (const org of organizations) {
      const companiesResponse = yield* client.companies.listCompanies({
        urlParams: {
          organizationId: org.id,
          limit: 100,
          offset: 0
        }
      })

      groupedCompanies.push({
        organization: org,
        companies: companiesResponse.companies
      })
    }

    return groupedCompanies
  }),
  { initialValue: [] }
)

/**
 * allCompaniesAtom - Flat list of all companies with their organization info
 *
 * Derived from allCompaniesGroupedAtom for quick lookups
 */
export const allCompaniesAtom = Atom.readable((get): ReadonlyArray<CompanyWithOrganization> => {
  const result = get(allCompaniesGroupedAtom)
  if (!Result.isSuccess(result)) {
    return []
  }

  const companiesWithOrg: Array<CompanyWithOrganization> = []
  for (const group of result.value) {
    for (const company of group.companies) {
      companiesWithOrg.push({
        company,
        organization: group.organization
      })
    }
  }

  return companiesWithOrg
})

// =============================================================================
// Selected Company Atom
// =============================================================================

/**
 * selectedCompanyIdAtom - The currently selected company ID
 *
 * This is a writable atom that:
 * - Initializes from localStorage on first access
 * - Persists changes to localStorage
 * - Can be set to null to clear selection
 */
export const selectedCompanyIdAtom = Atom.writable<string | null, string | null>(
  // Read: Get initial value from localStorage
  () => getStoredCompanyId(),
  // Write: Persist to localStorage when set
  (ctx, newValue) => {
    setStoredCompanyId(newValue)
    ctx.setSelf(newValue)
  }
)

/**
 * selectedCompanyAtom - The full company object for the selected company
 *
 * Derived atom that:
 * - Returns Option.none() if no company is selected
 * - Looks up the company from allCompaniesAtom
 * - Returns Option.some(company) if found
 */
export const selectedCompanyAtom = Atom.readable((get): Option.Option<CompanyWithOrganization> => {
  const selectedId = get(selectedCompanyIdAtom)
  if (selectedId === null) {
    return Option.none()
  }

  const allCompanies = get(allCompaniesAtom)
  const found = allCompanies.find((c) => c.company.id === selectedId)

  return found !== undefined ? Option.some(found) : Option.none()
})

/**
 * hasSelectedCompanyAtom - Whether a company is currently selected
 */
export const hasSelectedCompanyAtom = Atom.readable((get): boolean => {
  const selected = get(selectedCompanyAtom)
  return Option.isSome(selected)
})

// =============================================================================
// Helpers for URL-based company selection
// =============================================================================

/**
 * Sets the selected company and optionally returns the navigation path
 *
 * This is a helper that components can use to:
 * 1. Update the selectedCompanyIdAtom
 * 2. Get a navigation path to update the URL context
 */
export function getCompanyContextPath(companyId: string, organizationId: string): string {
  return `/organizations/${organizationId}/companies/${companyId}`
}
