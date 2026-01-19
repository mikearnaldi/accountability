/**
 * InvitationService - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/InvitationService" instead
 * @module Auth/InvitationService
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
} from "../membership/InvitationService.ts"
