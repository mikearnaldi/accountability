/**
 * OrganizationInvitation - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/OrganizationInvitation" instead
 * @module Auth/OrganizationInvitation
 */

export {
  OrganizationInvitation,
  isOrganizationInvitation,
  InvitationRole,
  type InvitationRole as InvitationRoleType
} from "../membership/OrganizationInvitation.ts"
