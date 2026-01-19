/**
 * OrganizationMemberService - Re-export from canonical location
 *
 * This file provides the new import path for OrganizationMemberService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/OrganizationMemberService
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
} from "../Auth/OrganizationMemberService.ts"
