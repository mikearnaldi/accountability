/**
 * Organization - Re-export from canonical location
 *
 * This file re-exports from the canonical location for backward compatibility.
 * New code should import from @accountability/core/organization/Organization
 *
 * @deprecated Import from @accountability/core/organization/Organization instead
 * @module Domains/Organization
 */

export {
  OrganizationId,
  isOrganizationId,
  OrganizationSettings,
  isOrganizationSettings,
  Organization,
  isOrganization
} from "../organization/Organization.ts"
