/**
 * Accounts State Atoms
 *
 * Manages account state using Effect Atom.
 * Provides atoms for:
 * - Accounts by company with filtering and search
 * - Account type filter
 * - Account search
 * - Filtered accounts (derived)
 * - Account mutations (create, update)
 *
 * @module accounts
 */

import * as Atom from "@effect-atom/atom/Atom"
import { AtomRegistry } from "@effect-atom/atom/Registry"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { Account, AccountType, AccountCategory } from "@accountability/core/Domains/Account"
import { ApiClient } from "./ApiClient.ts"

// =============================================================================
// Reactivity Keys
// =============================================================================

/**
 * Reactivity keys for accounts - used to auto-refresh queries after mutations
 */
export const ACCOUNTS_REACTIVITY_KEY = "accounts" as const

// =============================================================================
// Filter Atoms
// =============================================================================

/**
 * accountTypeFilterAtom - Filter accounts by type
 *
 * Options: "" (all), "Asset", "Liability", "Equity", "Revenue", "Expense"
 */
export const accountTypeFilterAtom = Atom.make<AccountType | "">("")

/**
 * accountSearchAtom - Search accounts by number or name
 */
export const accountSearchAtom = Atom.make<string>("")

// =============================================================================
// Accounts Query Atoms
// =============================================================================

/**
 * accountsByCompanyFamily - Fetch accounts for a specific company
 *
 * Returns all accounts belonging to the specified company.
 *
 * Usage:
 * ```typescript
 * const accountsAtom = accountsByCompanyFamily(companyId)
 * const result = useAtomValue(accountsAtom)
 * ```
 */
export const accountsByCompanyFamily = Atom.family((companyId: string) =>
  ApiClient.query("accounts", "listAccounts", {
    urlParams: {
      companyId,
      limit: 1000,
      offset: 0
    },
    timeToLive: Duration.minutes(5),
    reactivityKeys: [ACCOUNTS_REACTIVITY_KEY, companyId]
  })
)

/**
 * accountFamily - Parameterized atom for fetching a single account by ID
 *
 * Usage:
 * ```typescript
 * const accountAtom = accountFamily(accountId)
 * const result = useAtomValue(accountAtom)
 * ```
 */
export const accountFamily = Atom.family((id: string) =>
  ApiClient.query("accounts", "getAccount", {
    path: { id },
    timeToLive: Duration.minutes(5),
    reactivityKeys: [ACCOUNTS_REACTIVITY_KEY, id]
  })
)

// =============================================================================
// Filtered Accounts Atom (Derived)
// =============================================================================

/**
 * Creates a filtered accounts atom for a specific company
 *
 * This derived atom:
 * 1. Gets accounts from accountsByCompanyFamily
 * 2. Applies type filter from accountTypeFilterAtom
 * 3. Applies search filter from accountSearchAtom
 * 4. Returns filtered result maintaining Result structure
 */
export const createFilteredAccountsAtom = (companyId: string) =>
  Atom.readable((get): Result.Result<{
    accounts: ReadonlyArray<Account>
    total: number
    limit: number
    offset: number
  }, unknown> => {
    const result = get(accountsByCompanyFamily(companyId))
    const typeFilter = get(accountTypeFilterAtom)
    const searchQuery = get(accountSearchAtom)

    if (!Result.isSuccess(result)) {
      return result
    }

    let filtered = result.value.accounts

    // Apply type filter
    if (typeFilter !== "") {
      filtered = filtered.filter((account) => account.accountType === typeFilter)
    }

    // Apply search filter (case-insensitive search on account number and name)
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (account) =>
          account.accountNumber.toLowerCase().includes(query) ||
          account.name.toLowerCase().includes(query)
      )
    }

    return Result.success({
      accounts: filtered,
      total: filtered.length,
      limit: result.value.limit,
      offset: result.value.offset
    })
  })

// =============================================================================
// Account Tree Structure
// =============================================================================

/**
 * AccountTreeNode - Represents an account in a hierarchical tree structure
 */
export interface AccountTreeNode {
  readonly account: Account
  readonly children: ReadonlyArray<AccountTreeNode>
  readonly isExpanded: boolean
}

/**
 * Builds a tree structure from a flat list of accounts
 * Accounts are organized by their parentAccountId relationships
 */
export function buildAccountTree(accounts: ReadonlyArray<Account>): ReadonlyArray<AccountTreeNode> {
  // Create a map of account id to account for quick lookup
  const accountMap = new Map<string, Account>()
  for (const account of accounts) {
    accountMap.set(account.id, account)
  }

  // Create a map of parent id to children
  const childrenMap = new Map<string, Array<Account>>()
  const rootAccounts: Array<Account> = []

  for (const account of accounts) {
    if (Option.isSome(account.parentAccountId)) {
      const parentId = account.parentAccountId.value
      const children = childrenMap.get(parentId) ?? []
      children.push(account)
      childrenMap.set(parentId, children)
    } else {
      rootAccounts.push(account)
    }
  }

  // Sort accounts by account number
  const sortByNumber = (a: Account, b: Account) =>
    a.accountNumber.localeCompare(b.accountNumber)

  rootAccounts.sort(sortByNumber)

  // Recursively build tree nodes
  const buildNode = (account: Account): AccountTreeNode => {
    const children = childrenMap.get(account.id) ?? []
    children.sort(sortByNumber)

    return {
      account,
      children: children.map(buildNode),
      isExpanded: true // Default to expanded
    }
  }

  return rootAccounts.map(buildNode)
}

/**
 * expandedAccountsAtom - Tracks which accounts are expanded in the tree view
 *
 * Key is account ID, value is whether it's expanded
 */
export const expandedAccountsAtom = Atom.make<ReadonlyMap<string, boolean>>(new Map())

/**
 * Toggle an account's expanded state
 */
export const toggleAccountExpanded = (accountId: string) =>
  Effect.gen(function* () {
    const registry = yield* AtomRegistry
    const current = registry.get(expandedAccountsAtom)
    const newMap = new Map(current)
    const isCurrentlyExpanded = newMap.get(accountId) ?? true // Default to expanded
    newMap.set(accountId, !isCurrentlyExpanded)
    registry.set(expandedAccountsAtom, newMap)
  })

// =============================================================================
// Create Account Mutation
// =============================================================================

/**
 * Input type for creating an account (form input)
 */
export interface CreateAccountInput {
  readonly companyId: string
  readonly accountNumber: string
  readonly name: string
  readonly description: string | undefined
  readonly accountType: AccountType
  readonly accountCategory: AccountCategory
  readonly normalBalance: "Debit" | "Credit"
  readonly parentAccountId: string | undefined
  readonly isPostable: boolean
  readonly isCashFlowRelevant: boolean
  readonly cashFlowCategory: "Operating" | "Investing" | "Financing" | "NonCash" | undefined
  readonly isIntercompany: boolean
  readonly intercompanyPartnerId: string | undefined
  readonly currencyRestriction: string | undefined
}

/**
 * createAccountMutation - Create a new account
 *
 * This mutation:
 * 1. Calls the create account API endpoint
 * 2. On success, automatically refreshes the accounts list via manual refresh
 */
export const createAccountMutation = ApiClient.runtime.fn<CreateAccountInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry

    // Import types dynamically to avoid circular dependencies
    const { AccountNumber } = yield* Effect.promise(() =>
      import("@accountability/core/Domains/AccountNumber")
    )
    const { CompanyId } = yield* Effect.promise(() =>
      import("@accountability/core/Domains/Company")
    )
    const { CurrencyCode } = yield* Effect.promise(() =>
      import("@accountability/core/Domains/CurrencyCode")
    )
    const { CreateAccountRequest } = yield* Effect.promise(() =>
      import("@accountability/api/Definitions/AccountsApi")
    )
    const { AccountId } = yield* Effect.promise(() =>
      import("@accountability/core/Domains/Account")
    )

    // Build the payload
    const payload = CreateAccountRequest.make({
      companyId: CompanyId.make(input.companyId),
      accountNumber: AccountNumber.make(input.accountNumber),
      name: input.name,
      description: Option.fromNullable(input.description),
      accountType: input.accountType,
      accountCategory: input.accountCategory,
      normalBalance: input.normalBalance,
      parentAccountId: input.parentAccountId !== undefined
        ? Option.some(AccountId.make(input.parentAccountId))
        : Option.none(),
      isPostable: input.isPostable,
      isCashFlowRelevant: input.isCashFlowRelevant,
      cashFlowCategory: Option.fromNullable(input.cashFlowCategory),
      isIntercompany: input.isIntercompany,
      intercompanyPartnerId: input.intercompanyPartnerId !== undefined
        ? Option.some(CompanyId.make(input.intercompanyPartnerId))
        : Option.none(),
      currencyRestriction: input.currencyRestriction !== undefined
        ? Option.some(CurrencyCode.make(input.currencyRestriction))
        : Option.none()
    })

    const response = yield* client.accounts.createAccount({ payload })

    // Refresh the accounts list for this company
    registry.refresh(accountsByCompanyFamily(input.companyId))

    return response
  })
)

// =============================================================================
// Update Account Mutation
// =============================================================================

/**
 * Input type for updating an account
 */
export interface UpdateAccountInput {
  readonly id: string
  readonly companyId: string // For refreshing the list
  readonly name?: string
  readonly description?: string | null
  readonly parentAccountId?: string | null
  readonly isPostable?: boolean
  readonly isCashFlowRelevant?: boolean
  readonly cashFlowCategory?: "Operating" | "Investing" | "Financing" | "NonCash" | null
  readonly isIntercompany?: boolean
  readonly intercompanyPartnerId?: string | null
  readonly currencyRestriction?: string | null
  readonly isActive?: boolean
}

/**
 * updateAccountMutation - Update an existing account
 */
export const updateAccountMutation = ApiClient.runtime.fn<UpdateAccountInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry

    // Import types dynamically
    const { UpdateAccountRequest } = yield* Effect.promise(() =>
      import("@accountability/api/Definitions/AccountsApi")
    )
    const { AccountId } = yield* Effect.promise(() =>
      import("@accountability/core/Domains/Account")
    )
    const { CompanyId } = yield* Effect.promise(() =>
      import("@accountability/core/Domains/Company")
    )
    const { CurrencyCode } = yield* Effect.promise(() =>
      import("@accountability/core/Domains/CurrencyCode")
    )

    // Build the payload - only include fields that are provided
    const payload = UpdateAccountRequest.make({
      name: Option.fromNullable(input.name),
      description: input.description !== undefined
        ? (input.description === null ? Option.none() : Option.some(input.description))
        : Option.none(),
      parentAccountId: input.parentAccountId !== undefined
        ? (input.parentAccountId === null ? Option.none() : Option.some(AccountId.make(input.parentAccountId)))
        : Option.none(),
      isPostable: Option.fromNullable(input.isPostable),
      isCashFlowRelevant: Option.fromNullable(input.isCashFlowRelevant),
      cashFlowCategory: input.cashFlowCategory !== undefined
        ? Option.fromNullable(input.cashFlowCategory)
        : Option.none(),
      isIntercompany: Option.fromNullable(input.isIntercompany),
      intercompanyPartnerId: input.intercompanyPartnerId !== undefined
        ? (input.intercompanyPartnerId === null ? Option.none() : Option.some(CompanyId.make(input.intercompanyPartnerId)))
        : Option.none(),
      currencyRestriction: input.currencyRestriction !== undefined
        ? (input.currencyRestriction === null ? Option.none() : Option.some(CurrencyCode.make(input.currencyRestriction)))
        : Option.none(),
      isActive: Option.fromNullable(input.isActive)
    })

    const response = yield* client.accounts.updateAccount({
      path: { id: input.id },
      payload
    })

    // Refresh the accounts list for this company and the individual account
    registry.refresh(accountsByCompanyFamily(input.companyId))
    registry.refresh(accountFamily(input.id))

    return response
  })
)

// =============================================================================
// Deactivate Account Mutation
// =============================================================================

/**
 * Input type for deactivating an account
 */
export interface DeactivateAccountInput {
  readonly id: string
  readonly companyId: string
}

/**
 * deactivateAccountMutation - Deactivate an account (soft delete)
 */
export const deactivateAccountMutation = ApiClient.runtime.fn<DeactivateAccountInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry

    yield* client.accounts.deactivateAccount({
      path: { id: input.id }
    })

    // Refresh the accounts list for this company
    registry.refresh(accountsByCompanyFamily(input.companyId))
    registry.refresh(accountFamily(input.id))
  })
)
