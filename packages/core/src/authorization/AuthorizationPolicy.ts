/**
 * AuthorizationPolicy - Re-export from canonical location
 *
 * This file provides the new import path for AuthorizationPolicy entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/AuthorizationPolicy
 */

export {
  AuthorizationPolicy,
  isAuthorizationPolicy,
  DEFAULT_POLICY_PRIORITY,
  SYSTEM_POLICY_PRIORITIES
} from "../Auth/AuthorizationPolicy.ts"
