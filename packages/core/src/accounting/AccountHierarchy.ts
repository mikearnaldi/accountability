/**
 * AccountHierarchy - Pure functions to manage account hierarchy
 *
 * Provides functions for building account trees, calculating rollups,
 * and validating parent-child relationships in the Chart of Accounts.
 *
 * @module accounting/AccountHierarchy
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import * as Chunk from "effect/Chunk"
import * as Either from "effect/Either"
import { Account, AccountId, AccountType } from "./Account.ts"

/**
 * Encoded type interface for AccountNode (required for recursive Schema)
 */
export interface AccountNodeEncoded extends Schema.Schema.Encoded<typeof AccountNode> {}

/**
 * AccountNode - A node in the account hierarchy tree
 *
 * Wraps an Account with its children for tree representation.
 * Uses Schema.TaggedClass which automatically provides Equal and Hash.
 * Children use Schema.Chunk for serializability (encodes to/from array).
 */
export class AccountNode extends Schema.TaggedClass<AccountNode>()("AccountNode", {
  /**
   * The account at this node
   */
  account: Account,
  /**
   * Child nodes (sub-accounts) - recursive reference using Schema.suspend
   * Uses Schema.Chunk for JSON serializability (encodes to array)
   */
  children: Schema.Chunk(Schema.suspend((): Schema.Schema<AccountNode, AccountNodeEncoded> => AccountNode))
}) {
  /**
   * Check if this node has any children
   */
  get hasChildren(): boolean {
    return Chunk.size(this.children) > 0
  }

  /**
   * Get the number of direct children
   */
  get childCount(): number {
    return Chunk.size(this.children)
  }

  /**
   * Get total descendant count (including all nested children)
   */
  get descendantCount(): number {
    return Chunk.reduce(
      this.children,
      0,
      (count, child) => count + 1 + child.descendantCount
    )
  }
}

/**
 * Type guard for AccountNode
 */
export const isAccountNode = (value: unknown): value is AccountNode => {
  return value instanceof AccountNode
}

/**
 * Error for parent-child type mismatch
 */
export class AccountTypeMismatchError extends Schema.TaggedError<AccountTypeMismatchError>()(
  "AccountTypeMismatchError",
  {
    childAccountId: AccountId,
    childAccountType: AccountType,
    parentAccountId: AccountId,
    parentAccountType: AccountType
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Account type mismatch: child account ${this.childAccountId} has type ${this.childAccountType} but parent account ${this.parentAccountId} has type ${this.parentAccountType}`
  }
}

/**
 * Type guard for AccountTypeMismatchError
 */
export const isAccountTypeMismatchError = Schema.is(AccountTypeMismatchError)

/**
 * Error for parent account not found
 */
export class ParentAccountNotFoundError extends Schema.TaggedError<ParentAccountNotFoundError>()(
  "ParentAccountNotFoundError",
  {
    childAccountId: AccountId,
    parentAccountId: AccountId
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Parent account ${this.parentAccountId} not found for child account ${this.childAccountId}`
  }
}

/**
 * Type guard for ParentAccountNotFoundError
 */
export const isParentAccountNotFoundError = Schema.is(ParentAccountNotFoundError)

/**
 * Error for circular reference in account hierarchy
 */
export class CircularReferenceError extends Schema.TaggedError<CircularReferenceError>()(
  "CircularReferenceError",
  {
    accountId: AccountId,
    ancestorChain: Schema.Chunk(AccountId)
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Circular reference detected for account ${this.accountId}. Ancestor chain: ${Chunk.join(this.ancestorChain, " -> ")}`
  }
}

/**
 * Type guard for CircularReferenceError
 */
export const isCircularReferenceError = Schema.is(CircularReferenceError)

/**
 * Union of all account hierarchy errors
 */
export type AccountHierarchyError =
  | AccountTypeMismatchError
  | ParentAccountNotFoundError
  | CircularReferenceError

/**
 * Validate that a child account's type matches its parent's type
 *
 * Per accounting standards, child accounts must have the same type as their parent.
 * For example, a sub-account of an Asset account must also be an Asset.
 *
 * @param child The child account to validate
 * @param parent The parent account
 * @returns Either an error or the validated child account
 */
export const validateParentChildType = (
  child: Account,
  parent: Account
): Either.Either<Account, AccountTypeMismatchError> => {
  if (child.accountType === parent.accountType) {
    return Either.right(child)
  }
  return Either.left(
    new AccountTypeMismatchError({
      childAccountId: child.id,
      childAccountType: child.accountType,
      parentAccountId: parent.id,
      parentAccountType: parent.accountType
    })
  )
}

/**
 * Find an account by ID in an array of accounts
 *
 * @param accounts Array of accounts to search
 * @param accountId The account ID to find
 * @returns Option of the found account
 */
export const findAccountById = (
  accounts: ReadonlyArray<Account>,
  accountId: AccountId
): Option.Option<Account> => {
  return Array.findFirst(accounts, (account) => account.id === accountId)
}

/**
 * Get all direct children of an account
 *
 * @param accounts Array of all accounts
 * @param parentId The parent account ID
 * @returns Array of direct child accounts
 */
export const getDirectChildren = (
  accounts: ReadonlyArray<Account>,
  parentId: AccountId
): ReadonlyArray<Account> => {
  return Array.filter(accounts, (account) =>
    Option.match(account.parentAccountId, {
      onNone: () => false,
      onSome: (pid) => pid === parentId
    })
  )
}

/**
 * Get all descendants of an account (recursive)
 *
 * Traverses the account hierarchy and returns all accounts that are
 * descendants of the specified account (children, grandchildren, etc.)
 *
 * @param accounts Array of all accounts
 * @param accountId The root account ID to get descendants for
 * @returns Array of all descendant accounts
 */
export const getDescendants = (
  accounts: ReadonlyArray<Account>,
  accountId: AccountId
): ReadonlyArray<Account> => {
  const directChildren = getDirectChildren(accounts, accountId)

  if (directChildren.length === 0) {
    return []
  }

  const nestedDescendants = Array.flatMap(directChildren, (child) =>
    getDescendants(accounts, child.id)
  )

  return [...directChildren, ...nestedDescendants]
}

/**
 * Get all ancestors of an account (from immediate parent to root)
 *
 * Traverses up the account hierarchy and returns all accounts that are
 * ancestors of the specified account (parent, grandparent, etc.)
 *
 * @param accounts Array of all accounts
 * @param accountId The account ID to get ancestors for
 * @returns Array of ancestor accounts (immediate parent first)
 */
export const getAncestors = (
  accounts: ReadonlyArray<Account>,
  accountId: AccountId
): ReadonlyArray<Account> => {
  const account = findAccountById(accounts, accountId)

  return Option.match(account, {
    onNone: (): ReadonlyArray<Account> => [],
    onSome: (acc) =>
      Option.match(acc.parentAccountId, {
        onNone: (): ReadonlyArray<Account> => [],
        onSome: (parentId) => {
          const parent = findAccountById(accounts, parentId)
          return Option.match(parent, {
            onNone: (): ReadonlyArray<Account> => [],
            onSome: (p) => [p, ...getAncestors(accounts, p.id)]
          })
        }
      })
  })
}

/**
 * Get the root ancestor of an account
 *
 * @param accounts Array of all accounts
 * @param accountId The account ID to get root ancestor for
 * @returns Option of the root ancestor, or None if account has no parent
 */
export const getRootAncestor = (
  accounts: ReadonlyArray<Account>,
  accountId: AccountId
): Option.Option<Account> => {
  const ancestors = getAncestors(accounts, accountId)
  return Array.last(ancestors)
}

/**
 * Check if an account is an ancestor of another account
 *
 * @param accounts Array of all accounts
 * @param potentialAncestorId The potential ancestor account ID
 * @param descendantId The descendant account ID
 * @returns true if potentialAncestorId is an ancestor of descendantId
 */
export const isAncestorOf = (
  accounts: ReadonlyArray<Account>,
  potentialAncestorId: AccountId,
  descendantId: AccountId
): boolean => {
  const ancestors = getAncestors(accounts, descendantId)
  return Array.some(ancestors, (ancestor) => ancestor.id === potentialAncestorId)
}

/**
 * Check if an account is a descendant of another account
 *
 * @param accounts Array of all accounts
 * @param potentialDescendantId The potential descendant account ID
 * @param ancestorId The ancestor account ID
 * @returns true if potentialDescendantId is a descendant of ancestorId
 */
export const isDescendantOf = (
  accounts: ReadonlyArray<Account>,
  potentialDescendantId: AccountId,
  ancestorId: AccountId
): boolean => {
  return isAncestorOf(accounts, ancestorId, potentialDescendantId)
}

/**
 * Get the depth of an account in the hierarchy
 *
 * Root accounts (no parent) have depth 0. First-level children have depth 1, etc.
 *
 * @param accounts Array of all accounts
 * @param accountId The account ID
 * @returns The depth of the account
 */
export const getDepth = (
  accounts: ReadonlyArray<Account>,
  accountId: AccountId
): number => {
  return getAncestors(accounts, accountId).length
}

/**
 * Get all root accounts (accounts with no parent)
 *
 * @param accounts Array of all accounts
 * @returns Array of root accounts
 */
export const getRootAccounts = (
  accounts: ReadonlyArray<Account>
): ReadonlyArray<Account> => {
  return Array.filter(accounts, (account) => Option.isNone(account.parentAccountId))
}

/**
 * Build a single AccountNode from an account and its descendants
 *
 * @param accounts Array of all accounts
 * @param account The account to build a node for
 * @returns AccountNode with children populated
 */
const buildNode = (
  accounts: ReadonlyArray<Account>,
  account: Account
): AccountNode => {
  const directChildren = getDirectChildren(accounts, account.id)
  const childNodes = Array.map(directChildren, (child) =>
    buildNode(accounts, child)
  )

  return AccountNode.make({
    account,
    children: Chunk.fromIterable(childNodes)
  })
}

/**
 * Build an account tree from a flat array of accounts
 *
 * Creates a hierarchical tree structure from a flat list of accounts,
 * using the parentAccountId field to establish relationships.
 *
 * @param accounts Array of all accounts
 * @returns Array of root AccountNodes (accounts with no parent)
 */
export const buildAccountTree = (
  accounts: ReadonlyArray<Account>
): ReadonlyArray<AccountNode> => {
  const rootAccounts = getRootAccounts(accounts)
  return Array.map(rootAccounts, (root) => buildNode(accounts, root))
}

/**
 * Flatten an account tree back to an array of accounts
 *
 * Performs a depth-first traversal of the tree.
 *
 * @param nodes Array of AccountNodes
 * @returns Flat array of accounts
 */
export const flattenTree = (
  nodes: ReadonlyArray<AccountNode>
): ReadonlyArray<Account> => {
  return Array.flatMap(nodes, (node) => [
    node.account,
    ...flattenTree(Chunk.toReadonlyArray(node.children))
  ])
}

/**
 * Validate the entire account hierarchy
 *
 * Checks that:
 * 1. All parent references point to existing accounts
 * 2. Child account types match parent account types
 * 3. No circular references exist
 *
 * @param accounts Array of all accounts
 * @returns Either an array of errors or the validated accounts
 */
export const validateHierarchy = (
  accounts: ReadonlyArray<Account>
): Either.Either<ReadonlyArray<Account>, ReadonlyArray<AccountHierarchyError>> => {
  const errors: AccountHierarchyError[] = []

  for (const account of accounts) {
    Option.match(account.parentAccountId, {
      onNone: () => {},
      onSome: (parentId) => {
        const parent = findAccountById(accounts, parentId)

        Option.match(parent, {
          onNone: () => {
            errors.push(
              new ParentAccountNotFoundError({
                childAccountId: account.id,
                parentAccountId: parentId
              })
            )
          },
          onSome: (p) => {
            const typeValidation = validateParentChildType(account, p)
            if (Either.isLeft(typeValidation)) {
              errors.push(typeValidation.left)
            }
          }
        })
      }
    })
  }

  // Check for circular references
  for (const account of accounts) {
    const visited = new Set<AccountId>()
    let current: Option.Option<Account> = Option.some(account)
    const chain: AccountId[] = []

    while (Option.isSome(current)) {
      const acc = current.value
      chain.push(acc.id)

      if (visited.has(acc.id)) {
        errors.push(
          new CircularReferenceError({
            accountId: account.id,
            ancestorChain: Chunk.fromIterable(chain)
          })
        )
        break
      }

      visited.add(acc.id)

      current = Option.flatMap(acc.parentAccountId, (parentId) =>
        findAccountById(accounts, parentId)
      )
    }
  }

  if (errors.length > 0) {
    return Either.left(errors)
  }

  return Either.right(accounts)
}

/**
 * Get siblings of an account (accounts with the same parent)
 *
 * @param accounts Array of all accounts
 * @param accountId The account ID
 * @returns Array of sibling accounts (excluding the account itself)
 */
export const getSiblings = (
  accounts: ReadonlyArray<Account>,
  accountId: AccountId
): ReadonlyArray<Account> => {
  const account = findAccountById(accounts, accountId)

  return Option.match(account, {
    onNone: (): ReadonlyArray<Account> => [],
    onSome: (acc) =>
      Option.match(acc.parentAccountId, {
        onNone: () =>
          Array.filter(
            getRootAccounts(accounts),
            (a) => a.id !== accountId
          ),
        onSome: (parentId) =>
          Array.filter(
            getDirectChildren(accounts, parentId),
            (a) => a.id !== accountId
          )
      })
  })
}

/**
 * Find accounts by type
 *
 * @param accounts Array of all accounts
 * @param accountType The account type to filter by
 * @returns Array of accounts with the specified type
 */
export const findByType = (
  accounts: ReadonlyArray<Account>,
  accountType: AccountType
): ReadonlyArray<Account> => {
  return Array.filter(accounts, (account) => account.accountType === accountType)
}

/**
 * Get the account path from root to account
 *
 * @param accounts Array of all accounts
 * @param accountId The account ID
 * @returns Array of accounts from root to the specified account (inclusive)
 */
export const getPath = (
  accounts: ReadonlyArray<Account>,
  accountId: AccountId
): ReadonlyArray<Account> => {
  const account = findAccountById(accounts, accountId)

  return Option.match(account, {
    onNone: (): ReadonlyArray<Account> => [],
    onSome: (acc) => {
      const ancestors = getAncestors(accounts, accountId)
      return [...Array.reverse(ancestors), acc]
    }
  })
}
