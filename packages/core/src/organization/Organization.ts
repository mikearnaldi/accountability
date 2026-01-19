/**
 * Organization - Re-export from canonical location
 *
 * This file provides the new import path for Organization domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module organization/Organization
 */

export {
  OrganizationId,
  isOrganizationId,
  OrganizationSettings,
  isOrganizationSettings,
  Organization,
  isOrganization
} from "../Domains/Organization.ts"
