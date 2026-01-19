/**
 * AuthorizationErrors - Re-export from canonical location
 *
 * This file provides the new import path for authorization domain errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/AuthorizationErrors
 */

export {
  // Permission errors
  PermissionDeniedError,
  isPermissionDeniedError,

  // Policy errors
  PolicyLoadError,
  isPolicyLoadError,
  AuthorizationAuditError,
  isAuthorizationAuditError,

  // Error types and status codes
  type AuthorizationError,
  AUTHORIZATION_ERROR_STATUS_CODES
} from "../Auth/AuthorizationErrors.ts"
