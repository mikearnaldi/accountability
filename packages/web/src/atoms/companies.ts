/**
 * Companies Atoms - State management for company data
 *
 * Provides atoms for fetching and managing companies with filtering capabilities.
 * Uses Effect Atom for reactive state management integrated with the API client.
 *
 * @module companies
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Duration from "effect/Duration"
import type { Company, CompanyId } from "@accountability/core/Domains/Company"
import type { OrganizationId, Organization } from "@accountability/core/Domains/Organization"
import { ApiClient } from "./ApiClient.ts"

// =============================================================================
// Organizations Query
// =============================================================================

/**
 * Organizations list atom - Fetches all organizations
 *
 * Returns Result.Initial while loading, Result.Success with organizations when loaded.
 */
export const organizationsAtom = ApiClient.query("companies", "listOrganizations", {
  timeToLive: Duration.minutes(10)
})

// =============================================================================
// Companies List Query
// =============================================================================

/**
 * Parameters for fetching companies list
 */
export interface CompaniesQueryParams {
  readonly organizationId: OrganizationId
  readonly isActive?: boolean | undefined
  readonly parentCompanyId?: CompanyId | undefined
}

/**
 * Current companies query parameters atom
 *
 * Used to control which companies are fetched. Components can update this
 * to change the filter parameters for the companies list.
 */
export const companiesQueryParamsAtom = Atom.make<CompaniesQueryParams | null>(null)

/**
 * Companies list atom - Fetches companies based on query parameters
 *
 * This is a derived atom that depends on companiesQueryParamsAtom.
 * When the parameters change, it automatically refetches the companies.
 *
 * Returns an empty array when no organization is selected.
 */
export const companiesListAtom = Atom.readable((get) => {
  const params = get(companiesQueryParamsAtom)

  // If no params (no organization selected), return empty result
  if (params === null) {
    const emptyArray: ReadonlyArray<Company> = []
    return emptyArray
  }

  // Build urlParams object without undefined values
  const urlParams: {
    organizationId: string
    isActive?: boolean
    parentCompanyId?: string
    limit?: number
    offset?: number
  } = {
    organizationId: params.organizationId,
    limit: 1000,
    offset: 0
  }

  // Only add optional properties if they are not undefined
  if (params.isActive !== undefined) {
    urlParams.isActive = params.isActive
  }
  if (params.parentCompanyId !== undefined) {
    urlParams.parentCompanyId = params.parentCompanyId
  }

  // Create the API query with the current parameters
  const queryAtom = ApiClient.query("companies", "listCompanies", {
    urlParams,
    timeToLive: Duration.minutes(5)
  })

  return get(queryAtom)
})

// =============================================================================
// Company Family (Single Company Queries)
// =============================================================================

/**
 * Single company by ID atom family
 *
 * Creates a memoized atom for each company ID. Multiple calls with the
 * same ID return the same atom instance.
 */
export const companyByIdFamily = Atom.family((id: CompanyId) =>
  ApiClient.query("companies", "getCompany", {
    path: { id },
    timeToLive: Duration.minutes(5)
  })
)

// =============================================================================
// Organization Family (Single Organization Queries)
// =============================================================================

/**
 * Single organization by ID atom family
 *
 * Creates a memoized atom for each organization ID. Multiple calls with the
 * same ID return the same atom instance.
 */
export const organizationByIdFamily = Atom.family((id: OrganizationId) =>
  ApiClient.query("companies", "getOrganization", {
    path: { id },
    timeToLive: Duration.minutes(5)
  })
)

// =============================================================================
// Selected Company Atom
// =============================================================================

/**
 * Currently selected company ID
 *
 * Used by components to track which company is currently selected.
 * Persists in memory during the session.
 */
export const selectedCompanyIdAtom = Atom.make<CompanyId | null>(null)

/**
 * Currently selected company data
 *
 * Derived from selectedCompanyIdAtom - fetches company details when selected.
 */
export const selectedCompanyAtom = Atom.readable((get) => {
  const companyId = get(selectedCompanyIdAtom)
  if (companyId === null) {
    return null
  }
  return get(companyByIdFamily(companyId))
})

// =============================================================================
// Company Mutations
// =============================================================================

/**
 * Create company mutation
 */
export const createCompanyMutation = ApiClient.mutation("companies", "createCompany")

/**
 * Update company mutation
 */
export const updateCompanyMutation = ApiClient.mutation("companies", "updateCompany")

/**
 * Deactivate company mutation
 */
export const deactivateCompanyMutation = ApiClient.mutation("companies", "deactivateCompany")

// =============================================================================
// Organization Mutations
// =============================================================================

/**
 * Create organization mutation
 */
export const createOrganizationMutation = ApiClient.mutation("companies", "createOrganization")

/**
 * Update organization mutation
 */
export const updateOrganizationMutation = ApiClient.mutation("companies", "updateOrganization")

// =============================================================================
// Type exports for convenience
// =============================================================================

export type { Company, CompanyId, Organization, OrganizationId }
