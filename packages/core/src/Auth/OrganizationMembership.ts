/**
 * OrganizationMembership - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/OrganizationMembership" instead
 * @module Auth/OrganizationMembership
 */

export {
  OrganizationMembership,
  isOrganizationMembership
} from "../membership/OrganizationMembership.ts"
