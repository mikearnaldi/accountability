/**
 * OrganizationInvitation - Re-export from canonical location
 *
 * This file provides the new import path for OrganizationInvitation entity
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/OrganizationInvitation
 */

export {
  OrganizationInvitation,
  isOrganizationInvitation,
  InvitationRole,
  type InvitationRole as InvitationRoleType
} from "../Auth/OrganizationInvitation.ts"
