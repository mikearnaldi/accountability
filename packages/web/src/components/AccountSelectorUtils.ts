/**
 * AccountSelectorUtils - Utility functions for AccountSelector component
 *
 * Contains pure functions for building hierarchical account lists and
 * filtering accounts by search query. These are extracted for testability.
 *
 * @module AccountSelectorUtils
 */

import type { Account } from "@accountability/core/Domains/Account"

// =============================================================================
// Types
// =============================================================================

/**
 * Account with depth information for hierarchical display
 */
export interface AccountWithDepth {
  readonly account: Account
  readonly depth: number
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Build hierarchical account tree and flatten with depth information
 *
 * Takes a flat array of accounts and produces a depth-first ordered list
 * where each account has an associated depth for indentation. Accounts
 * are sorted by account number within each level.
 *
 * @param accounts - Flat array of accounts
 * @returns Array of accounts with depth information, in hierarchical order
 */
export const buildHierarchicalList = (accounts: ReadonlyArray<Account>): ReadonlyArray<AccountWithDepth> => {
  // Create a map of parent ID to children
  const childrenMap = new Map<string | null, Account[]>()

  for (const account of accounts) {
    const parentId = account.parentAccountId._tag === "Some"
      ? account.parentAccountId.value
      : null
    const children = childrenMap.get(parentId) ?? []
    children.push(account)
    childrenMap.set(parentId, children)
  }

  // Sort children by account number
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
  }

  // Build flattened list with depth using DFS
  const result: AccountWithDepth[] = []

  const addAccountsAtDepth = (parentId: string | null, depth: number) => {
    const children = childrenMap.get(parentId) ?? []
    for (const account of children) {
      result.push({ account, depth })
      addAccountsAtDepth(account.id, depth + 1)
    }
  }

  addAccountsAtDepth(null, 0)

  return result
}

/**
 * Filter accounts by search query
 *
 * Performs case-insensitive search across account name, account number,
 * and description. Returns all accounts if search query is empty.
 *
 * @param accounts - Array of accounts with depth information
 * @param searchQuery - Search string to filter by
 * @returns Filtered array of accounts matching the search query
 */
export const filterBySearch = (
  accounts: ReadonlyArray<AccountWithDepth>,
  searchQuery: string
): ReadonlyArray<AccountWithDepth> => {
  if (searchQuery.trim() === "") {
    return accounts
  }

  const query = searchQuery.toLowerCase().trim()

  return accounts.filter(({ account }) =>
    account.name.toLowerCase().includes(query) ||
    account.accountNumber.toLowerCase().includes(query) ||
    (account.description._tag === "Some" &&
      account.description.value.toLowerCase().includes(query))
  )
}

/**
 * Find an account by ID in the hierarchical list
 *
 * @param accounts - Array of accounts with depth information
 * @param accountId - ID to search for
 * @returns The matching account or null if not found
 */
export const findAccountById = (
  accounts: ReadonlyArray<AccountWithDepth>,
  accountId: string | null
): Account | null => {
  if (accountId === null) return null
  return accounts.find(({ account }) => account.id === accountId)?.account ?? null
}

/**
 * Get the display string for an account (number + name)
 *
 * @param account - The account to format
 * @returns Formatted display string
 */
export const formatAccountDisplay = (account: Account): string => {
  return `${account.accountNumber} - ${account.name}`
}
