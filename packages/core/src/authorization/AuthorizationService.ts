/**
 * AuthorizationService - Re-export from canonical location
 *
 * This file provides the new import path for AuthorizationService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/AuthorizationService
 */

export {
  type AuthorizationServiceShape,
  AuthorizationService
} from "../Auth/AuthorizationService.ts"
