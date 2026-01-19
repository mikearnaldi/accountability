/**
 * OrganizationErrors - Re-export from canonical location
 *
 * This file provides the new import path for Organization-related errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module organization/OrganizationErrors
 */

export {
  OrganizationNotFoundError,
  isOrganizationNotFoundError,
  InvalidOrganizationIdError,
  isInvalidOrganizationIdError,
  UserNotMemberOfOrganizationError,
  isUserNotMemberOfOrganizationError,
  OrganizationHasCompaniesError,
  isOrganizationHasCompaniesError,
  OrganizationNameAlreadyExistsError,
  isOrganizationNameAlreadyExistsError,
  OrganizationUpdateFailedError,
  isOrganizationUpdateFailedError,
  MembershipCreationFailedError,
  isMembershipCreationFailedError,
  SystemPolicySeedingFailedError,
  isSystemPolicySeedingFailedError
} from "../Errors/DomainErrors.ts"
