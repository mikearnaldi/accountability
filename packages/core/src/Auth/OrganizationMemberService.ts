/**
 * OrganizationMemberService - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/OrganizationMemberService" instead
 * @module Auth/OrganizationMemberService
 */

export {
  type AddMemberInput,
  type UpdateMemberRolesInput,
  type TransferOwnershipInput,
  type OrganizationMemberServiceShape,
  OrganizationMemberService,
  type AddMemberError,
  type RemoveMemberError,
  type UpdateRoleError,
  type ReinstateMemberError,
  type SuspendMemberError,
  type UnsuspendMemberError,
  type TransferOwnershipError
} from "../membership/OrganizationMemberService.ts"
