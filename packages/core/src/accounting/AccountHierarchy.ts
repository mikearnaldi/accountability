/**
 * AccountHierarchy - Re-export from canonical location
 *
 * This file provides the new import path for AccountHierarchy utilities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module accounting/AccountHierarchy
 */

export {
  // Error classes
  AccountTypeMismatchError,
  isAccountTypeMismatchError,
  ParentAccountNotFoundError,
  isParentAccountNotFoundError,
  CircularReferenceError,
  isCircularReferenceError,
  type AccountHierarchyError,

  // AccountNode
  AccountNode,
  type AccountNodeEncoded,
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
} from "../Domains/AccountHierarchy.ts"
