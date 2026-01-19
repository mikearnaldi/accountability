/**
 * OrganizationMembershipId - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/OrganizationMembershipId" instead
 * @module Auth/OrganizationMembershipId
 */

export {
  OrganizationMembershipId,
  type OrganizationMembershipId as OrganizationMembershipIdType,
  isOrganizationMembershipId
} from "../membership/OrganizationMembershipId.ts"
