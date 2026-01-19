/**
 * AuthorizationConfig - Re-export from canonical location
 *
 * This file provides the new import path for AuthorizationConfig
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/AuthorizationConfig
 */

export {
  type AuthorizationConfigData,
  AuthorizationConfig,
  authorizationConfigDefaults,
  authorizationConfig,
  authorizationConfigFromEnv,
  AuthorizationConfigLive,
  makeAuthorizationConfigLayer,
  AuthorizationConfigEnforced,
  AuthorizationConfigGracePeriod
} from "../Auth/AuthorizationConfig.ts"
