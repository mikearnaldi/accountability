/**
 * ActionMatcher - Re-export from canonical location
 *
 * This file provides the new import path for ActionMatcher utilities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/matchers/ActionMatcher
 */

export {
  type ActionPattern,
  matchesActionPattern,
  matchesActionPatternString,
  matchesActionCondition,
  matchesActionPatterns,
  anyActionMatchesCondition,
  filterMatchingActions,
  filterMatchingActionsFromPatterns
} from "../../Auth/matchers/ActionMatcher.ts"
