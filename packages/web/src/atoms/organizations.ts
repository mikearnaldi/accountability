/**
 * Organizations State Atoms
 *
 * Manages organization state using Effect Atom.
 * Handles fetching organizations list, creating organizations,
 * and derived state like organization count.
 */

import * as Atom from "@effect-atom/atom/Atom"
import { AtomRegistry } from "@effect-atom/atom/Registry"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { ApiClient } from "./ApiClient.ts"
import { CreateOrganizationRequest, UpdateOrganizationRequest } from "@accountability/api/Definitions/CompaniesApi"
import { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import type { Organization } from "@accountability/core/Domains/Organization"

// =============================================================================
// Reactivity Keys
// =============================================================================

/**
 * Reactivity keys for organizations - used to auto-refresh queries after mutations
 */
export const ORGANIZATIONS_REACTIVITY_KEY = "organizations" as const

// =============================================================================
// Organizations List Atom
// =============================================================================

/**
 * organizationsAtom - Async atom that fetches all organizations for the current user
 *
 * Behavior:
 * - Fetches /api/v1/organizations on first access
 * - Caches result for 5 minutes when idle
 * - Automatically refetches when invalidated by mutations
 */
export const organizationsAtom = ApiClient.query("companies", "listOrganizations", {
  timeToLive: Duration.minutes(5),
  reactivityKeys: [ORGANIZATIONS_REACTIVITY_KEY]
})

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * organizationsListAtom - Derived atom that extracts the organizations array from response
 */
export const organizationsListAtom = Atom.readable((get): ReadonlyArray<Organization> => {
  const result = get(organizationsAtom)
  if (!Result.isSuccess(result)) {
    return []
  }
  return result.value.organizations
})

/**
 * organizationsCountAtom - Derived atom that returns the count of organizations
 */
export const organizationsCountAtom = Atom.readable((get) => {
  const result = get(organizationsAtom)
  if (!Result.isSuccess(result)) {
    return 0
  }
  return result.value.total
})

/**
 * hasOrganizationsAtom - Derived atom that indicates if user has any organizations
 */
export const hasOrganizationsAtom = Atom.readable((get) => {
  const count = get(organizationsCountAtom)
  return count > 0
})

// =============================================================================
// Create Organization Mutation
// =============================================================================

/**
 * Input type for creating an organization (form input)
 * Uses plain strings since form data is untyped at runtime
 */
export interface CreateOrganizationInput {
  readonly name: string
  readonly reportingCurrency: string
}

/**
 * createOrganizationMutation - Create a new organization
 *
 * This mutation:
 * 1. Calls the create organization API endpoint
 * 2. On success, automatically refreshes the organizations list via reactivityKeys
 *
 * Usage:
 * ```typescript
 * const [result, createOrg] = useAtom(createOrganizationMutation)
 *
 * // Fire-and-forget (Result tracks loading/error)
 * createOrg({
 *   name: "My Organization",
 *   reportingCurrency: "USD"
 * })
 *
 * // Or with promise mode for post-success actions
 * const [, createOrg] = useAtom(createOrganizationMutation, { mode: "promise" })
 * const org = await createOrg({ name, reportingCurrency })
 * navigate(`/organizations/${org.id}`)
 * ```
 */
/**
 * createOrganizationMutation - Create a new organization
 *
 * This mutation:
 * 1. Calls the create organization API endpoint
 * 2. On success, automatically refreshes the organizations list via reactivityKeys
 *
 * Usage:
 * ```typescript
 * const [result, createOrg] = useAtom(createOrganizationMutation)
 *
 * // Fire-and-forget (Result tracks loading/error)
 * createOrg({
 *   name: "My Organization",
 *   reportingCurrency: "USD"
 * })
 *
 * // Or with promise mode for post-success actions
 * const [, createOrg] = useAtom(createOrganizationMutation, { mode: "promise" })
 * const org = await createOrg({ name, reportingCurrency })
 * navigate(`/organizations/${org.id}`)
 * ```
 */
export const createOrganizationMutation = ApiClient.runtime.fn<CreateOrganizationInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry

    // Properly construct the request using Schema.make() constructor
    const payload = CreateOrganizationRequest.make({
      name: input.name,
      reportingCurrency: CurrencyCode.make(input.reportingCurrency),
      settings: Option.none()
    })
    const response: Organization = yield* client.companies.createOrganization({
      payload
    })

    // Manually refresh the organizations query after successful creation
    registry.refresh(organizationsAtom)

    return response
  })
)

// =============================================================================
// Organization Family (for individual organization queries)
// =============================================================================

/**
 * organizationFamily - Parameterized atom for fetching a single organization by ID
 *
 * Usage:
 * ```typescript
 * const orgAtom = organizationFamily(orgId)
 * const result = useAtomValue(orgAtom)
 * ```
 */
export const organizationFamily = Atom.family((id: string) =>
  ApiClient.query("companies", "getOrganization", {
    path: { id },
    timeToLive: Duration.minutes(5),
    reactivityKeys: [ORGANIZATIONS_REACTIVITY_KEY, id]
  })
)

// =============================================================================
// Company Count Family
// =============================================================================

/**
 * organizationCompanyCountFamily - Get the count of companies for an organization
 *
 * Since we need to fetch companies to get the count, this uses the companies list endpoint.
 * This is useful for showing company count on organization cards.
 */
export const organizationCompanyCountFamily = Atom.family((organizationId: string) =>
  Atom.readable((get) => {
    const result = get(
      ApiClient.query("companies", "listCompanies", {
        urlParams: {
          organizationId,
          limit: 1,
          offset: 0
        },
        timeToLive: Duration.minutes(5),
        reactivityKeys: ["companies", organizationId]
      })
    )
    if (!Result.isSuccess(result)) {
      return 0
    }
    return result.value.total
  })
)

// =============================================================================
// Companies by Organization
// =============================================================================

/**
 * Reactivity keys for companies - used to auto-refresh queries after mutations
 */
export const COMPANIES_REACTIVITY_KEY = "companies" as const

/**
 * companiesByOrgFamily - Fetch companies for a specific organization
 *
 * Returns all companies belonging to the specified organization.
 *
 * Usage:
 * ```typescript
 * const companiesAtom = companiesByOrgFamily(orgId)
 * const result = useAtomValue(companiesAtom)
 * ```
 */
export const companiesByOrgFamily = Atom.family((organizationId: string) =>
  ApiClient.query("companies", "listCompanies", {
    urlParams: {
      organizationId,
      limit: 100,
      offset: 0
    },
    timeToLive: Duration.minutes(5),
    reactivityKeys: [COMPANIES_REACTIVITY_KEY, organizationId]
  })
)

// =============================================================================
// Update Organization Mutation
// =============================================================================

/**
 * Input type for updating an organization (form input)
 */
export interface UpdateOrganizationInput {
  readonly id: string
  readonly name: string | undefined
  readonly reportingCurrency: string | undefined
}

/**
 * updateOrganizationMutation - Update an existing organization
 *
 * This mutation:
 * 1. Calls the update organization API endpoint
 * 2. On success, automatically refreshes the organization and organizations list
 *
 * Usage:
 * ```typescript
 * const [result, updateOrg] = useAtom(updateOrganizationMutation)
 *
 * updateOrg({
 *   id: orgId,
 *   name: "New Name",
 *   reportingCurrency: "EUR"
 * })
 * ```
 */
export const updateOrganizationMutation = ApiClient.runtime.fn<UpdateOrganizationInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry

    // Properly construct the request using Schema.make() constructor
    const payload = UpdateOrganizationRequest.make({
      name: Option.fromNullable(input.name),
      reportingCurrency: input.reportingCurrency !== undefined
        ? Option.some(CurrencyCode.make(input.reportingCurrency))
        : Option.none(),
      settings: Option.none()
    })

    const response = yield* client.companies.updateOrganization({
      path: { id: input.id },
      payload
    })

    // Refresh the organization family and organizations list
    registry.refresh(organizationFamily(input.id))
    registry.refresh(organizationsAtom)

    return response
  })
)
