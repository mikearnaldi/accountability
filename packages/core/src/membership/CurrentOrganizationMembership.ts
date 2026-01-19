/**
 * CurrentOrganizationMembership - Re-export from canonical location
 *
 * This file provides the new import path for CurrentOrganizationMembership context
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/CurrentOrganizationMembership
 */

export {
  CurrentOrganizationMembership,
  getCurrentOrganizationMembership,
  withOrganizationMembership,
  getCurrentOrganizationId,
  getCurrentUserRole
} from "../Auth/CurrentOrganizationMembership.ts"
