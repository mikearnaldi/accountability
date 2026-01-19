/**
 * AuthorizationConfig - Re-export from canonical location
 *
 * This file re-exports AuthorizationConfig from the authorization domain
 * for backward compatibility. Import from @accountability/core/authorization/AuthorizationConfig
 * for new code.
 *
 * @deprecated Import from @accountability/core/authorization/AuthorizationConfig instead
 * @module Auth/AuthorizationConfig
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
} from "../authorization/AuthorizationConfig.ts"
