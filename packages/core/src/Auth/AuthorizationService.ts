/**
 * AuthorizationService - Re-export from canonical location
 *
 * This file re-exports AuthorizationService from the authorization domain
 * for backward compatibility. Import from @accountability/core/authorization/AuthorizationService
 * for new code.
 *
 * @deprecated Import from @accountability/core/authorization/AuthorizationService instead
 * @module Auth/AuthorizationService
 */

export {
  type AuthorizationServiceShape,
  AuthorizationService
} from "../authorization/AuthorizationService.ts"
