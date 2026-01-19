/**
 * CurrentOrganizationMembership - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/CurrentOrganizationMembership" instead
 * @module Auth/CurrentOrganizationMembership
 */

export {
  CurrentOrganizationMembership,
  getCurrentOrganizationMembership,
  withOrganizationMembership,
  getCurrentOrganizationId,
  getCurrentUserRole
} from "../membership/CurrentOrganizationMembership.ts"
