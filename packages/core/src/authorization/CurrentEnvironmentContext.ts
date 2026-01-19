/**
 * CurrentEnvironmentContext - Re-export from canonical location
 *
 * This file provides the new import path for CurrentEnvironmentContext
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/CurrentEnvironmentContext
 */

export {
  CurrentEnvironmentContext,
  type EnvironmentContextWithMeta,
  getCurrentEnvironmentContext,
  withEnvironmentContext,
  createEnvironmentContextFromRequest,
  defaultEnvironmentContext,
  CurrentEnvironmentContextDefault
} from "../Auth/CurrentEnvironmentContext.ts"
