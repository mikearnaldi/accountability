/**
 * AccountErrors - Re-export from canonical location
 *
 * This file provides the new import path for Account-related errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module accounting/AccountErrors
 */

export {
  AccountNotFoundError,
  isAccountNotFoundError,
  ParentAccountNotFoundError,
  isParentAccountNotFoundError,
  ParentAccountDifferentCompanyError,
  isParentAccountDifferentCompanyError,
  HasActiveChildAccountsError,
  isHasActiveChildAccountsError,
  AccountNumberAlreadyExistsError,
  isAccountNumberAlreadyExistsError,
  CircularAccountReferenceError,
  isCircularAccountReferenceError,
  AccountsAlreadyExistError,
  isAccountsAlreadyExistError,
  AccountTemplateNotFoundError,
  isAccountTemplateNotFoundError
} from "../Errors/DomainErrors.ts"
