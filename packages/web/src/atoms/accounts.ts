/**
 * Accounts Atoms - State management for account data
 *
 * Provides atoms for fetching and managing accounts with filtering capabilities.
 * Uses Effect Atom for reactive state management integrated with the API client.
 *
 * @module accounts
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Duration from "effect/Duration"
import type { AccountType, Account, AccountId } from "@accountability/core/Domains/Account"
import type { CompanyId } from "@accountability/core/Domains/Company"
import { ApiClient } from "./ApiClient.ts"

// =============================================================================
// Accounts List Query
// =============================================================================

/**
 * Parameters for fetching accounts list
 */
export interface AccountsQueryParams {
  readonly companyId: CompanyId
  readonly accountType?: AccountType | undefined
  readonly isActive?: boolean | undefined
  readonly isPostable?: boolean | undefined
}

/**
 * Current accounts query parameters atom
 *
 * Used to control which accounts are fetched. Components can update this
 * to change the filter parameters for the accounts list.
 */
export const accountsQueryParamsAtom = Atom.make<AccountsQueryParams | null>(null)

/**
 * Accounts list atom - Fetches accounts based on query parameters
 *
 * This is a derived atom that depends on accountsQueryParamsAtom.
 * When the parameters change, it automatically refetches the accounts.
 *
 * Returns Result.Initial when no company is selected.
 */
export const accountsListAtom = Atom.readable((get) => {
  const params = get(accountsQueryParamsAtom)

  // If no params (no company selected), return empty result
  if (params === null) {
    const emptyArray: ReadonlyArray<Account> = []
    return emptyArray
  }

  // Create the API query with the current parameters
  const queryAtom = ApiClient.query("accounts", "listAccounts", {
    urlParams: {
      companyId: params.companyId,
      accountType: params.accountType,
      isActive: params.isActive,
      isPostable: params.isPostable,
      limit: 1000, // Get all accounts for the selector
      offset: 0
    },
    timeToLive: Duration.minutes(5)
  })

  return get(queryAtom)
})

// =============================================================================
// Account Family (Single Account Queries)
// =============================================================================

/**
 * Single account by ID atom family
 *
 * Creates a memoized atom for each account ID. Multiple calls with the
 * same ID return the same atom instance.
 */
export const accountByIdFamily = Atom.family((id: AccountId) =>
  ApiClient.query("accounts", "getAccount", {
    path: { id },
    timeToLive: Duration.minutes(5)
  })
)

// =============================================================================
// Account Mutations
// =============================================================================

/**
 * Create account mutation
 */
export const createAccountMutation = ApiClient.mutation("accounts", "createAccount")

/**
 * Update account mutation
 */
export const updateAccountMutation = ApiClient.mutation("accounts", "updateAccount")

/**
 * Deactivate account mutation
 */
export const deactivateAccountMutation = ApiClient.mutation("accounts", "deactivateAccount")
