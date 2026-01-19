/**
 * OrganizationMembership - Re-export from canonical location
 *
 * This file provides the new import path for OrganizationMembership entity
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/OrganizationMembership
 */

export {
  OrganizationMembership,
  isOrganizationMembership
} from "../Auth/OrganizationMembership.ts"
