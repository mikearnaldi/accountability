/**
 * AccountHierarchy - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: accounting/AccountHierarchy.ts
 *
 * @module Domains/AccountHierarchy
 * @deprecated Import from "@accountability/core/accounting/AccountHierarchy" instead
 */

export {
  // Error classes
  AccountTypeMismatchError,
  isAccountTypeMismatchError,
  ParentAccountNotFoundError,
  isParentAccountNotFoundError,
  CircularReferenceError,
  isCircularReferenceError,

  // AccountNode
  AccountNode,
  isAccountNode,

  // Functions
  validateParentChildType,
  findAccountById,
  getDirectChildren,
  getDescendants,
  getAncestors,
  getRootAncestor,
  isAncestorOf,
  isDescendantOf,
  getDepth,
  getRootAccounts,
  buildAccountTree,
  flattenTree,
  validateHierarchy,
  getSiblings,
  findByType,
  getPath
} from "../accounting/AccountHierarchy.ts"

export type {
  AccountHierarchyError,
  AccountNodeEncoded
} from "../accounting/AccountHierarchy.ts"
