/**
 * InvitationService - Re-export from canonical location
 *
 * This file provides the new import path for InvitationService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/InvitationService
 */

export {
  type CreateInvitationInput,
  type CreateInvitationResult,
  type AcceptInvitationResult,
  type InvitationServiceShape,
  InvitationService,
  type CreateInvitationError,
  type AcceptInvitationError,
  type DeclineInvitationError,
  type RevokeInvitationError
} from "../Auth/InvitationService.ts"
