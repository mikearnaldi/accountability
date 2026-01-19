/**
 * CompanyErrors - Re-export from canonical location
 *
 * This file provides the new import path for Company-related errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module company/CompanyErrors
 */

export {
  CompanyNotFoundError,
  isCompanyNotFoundError,
  InvalidCompanyIdError,
  isInvalidCompanyIdError,
  OwnershipPercentageRequiredError,
  isOwnershipPercentageRequiredError,
  ParentCompanyNotFoundError,
  isParentCompanyNotFoundError,
  CircularCompanyReferenceError,
  isCircularCompanyReferenceError,
  CompanyNameAlreadyExistsError,
  isCompanyNameAlreadyExistsError,
  HasActiveSubsidiariesError,
  isHasActiveSubsidiariesError
} from "../Errors/DomainErrors.ts"
