/**
 * OrganizationMembershipId - Re-export from canonical location
 *
 * This file provides the new import path for OrganizationMembershipId value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/OrganizationMembershipId
 */

export {
  OrganizationMembershipId,
  type OrganizationMembershipId as OrganizationMembershipIdType,
  isOrganizationMembershipId
} from "../Auth/OrganizationMembershipId.ts"
