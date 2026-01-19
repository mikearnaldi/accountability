/**
 * CurrentEnvironmentContext - Re-export from canonical location
 *
 * This file re-exports CurrentEnvironmentContext from the authorization domain
 * for backward compatibility. Import from @accountability/core/authorization/CurrentEnvironmentContext
 * for new code.
 *
 * @deprecated Import from @accountability/core/authorization/CurrentEnvironmentContext instead
 * @module Auth/CurrentEnvironmentContext
 */

export {
  CurrentEnvironmentContext,
  type EnvironmentContextWithMeta,
  getCurrentEnvironmentContext,
  withEnvironmentContext,
  createEnvironmentContextFromRequest,
  defaultEnvironmentContext,
  CurrentEnvironmentContextDefault
} from "../authorization/CurrentEnvironmentContext.ts"
