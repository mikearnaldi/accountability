/**
 * EnvironmentMatcher - Re-export from canonical location
 *
 * This file provides the new import path for EnvironmentMatcher utilities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/matchers/EnvironmentMatcher
 */

export {
  type EnvironmentContext,
  createEnvironmentContext,
  parseTimeToMinutes,
  matchesTimeOfDay,
  matchesDayOfWeek,
  matchesIPPattern,
  matchesIPAllowList,
  matchesIPDenyList,
  matchesEnvironmentCondition,
  matchesAnyEnvironmentCondition,
  matchesAllEnvironmentConditions,
  getEnvironmentMismatchReason
} from "../../Auth/matchers/EnvironmentMatcher.ts"
