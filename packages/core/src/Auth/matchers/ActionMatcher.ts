/**
 * ActionMatcher - Matches actions against action conditions
 *
 * This module provides functions to match an authorization action against
 * an ActionCondition in ABAC policy evaluation.
 *
 * Matching supports:
 * - Exact match: "journal_entry:create" matches "journal_entry:create"
 * - Wildcard: "*" matches any action
 * - Prefix wildcard: "journal_entry:*" matches all journal_entry actions
 *
 * @module ActionMatcher
 */

import type { Action } from "../Action.ts"
import type { ActionCondition } from "../PolicyConditions.ts"

/**
 * Type for action pattern strings.
 * These can be valid Actions or prefix wildcards like "journal_entry:*"
 */
export type ActionPattern = Action | `${string}:*`

/**
 * Internal string-based pattern matching for action strings.
 *
 * @param pattern - The pattern to match against (can include wildcards)
 * @param action - The action string to test
 * @returns true if the action matches the pattern
 */
const matchesPatternString = (pattern: string, action: string): boolean => {
  // Wildcard matches everything
  if (pattern === "*") {
    return true
  }

  // Exact match
  if (pattern === action) {
    return true
  }

  // Check for prefix wildcard pattern (e.g., "journal_entry:*")
  if (pattern.endsWith(":*")) {
    const prefix = pattern.slice(0, -1) // Remove the trailing '*' to get "journal_entry:"
    return action.startsWith(prefix)
  }

  return false
}

/**
 * Checks if an action matches a pattern
 *
 * @param pattern - The pattern to match against (can include wildcards)
 * @param action - The action to test
 * @returns true if the action matches the pattern
 *
 * @example
 * ```ts
 * matchesActionPattern("*", "journal_entry:create") // true
 * matchesActionPattern("journal_entry:create", "journal_entry:create") // true
 * matchesActionPattern("company:read", "company:create") // false
 * ```
 */
export const matchesActionPattern = (pattern: Action, action: Action): boolean => {
  return matchesPatternString(pattern, action)
}

/**
 * Checks if an action matches an action pattern string.
 * This is the lower-level function that supports prefix wildcards like "journal_entry:*".
 *
 * @param pattern - The pattern string to match against
 * @param action - The action to test
 * @returns true if the action matches the pattern
 *
 * @example
 * ```ts
 * matchesActionPatternString("journal_entry:*", "journal_entry:create") // true
 * matchesActionPatternString("journal_entry:*", "account:create") // false
 * ```
 */
export const matchesActionPatternString = (
  pattern: ActionPattern,
  action: Action
): boolean => {
  return matchesPatternString(pattern, action)
}

/**
 * Checks if an action matches an ActionCondition
 *
 * An action matches if it matches ANY of the patterns in the condition's actions array.
 *
 * @param condition - The ActionCondition to match against
 * @param action - The action to test
 * @returns true if the action matches any pattern in the condition
 *
 * @example
 * ```ts
 * const condition: ActionCondition = { actions: ["journal_entry:create", "journal_entry:update"] }
 * matchesActionCondition(condition, "journal_entry:create") // true
 * matchesActionCondition(condition, "journal_entry:post") // false
 *
 * const wildcardCondition: ActionCondition = { actions: ["*"] }
 * matchesActionCondition(wildcardCondition, "journal_entry:create") // true
 * ```
 */
export const matchesActionCondition = (
  condition: ActionCondition,
  action: Action
): boolean => {
  // An action matches if it matches ANY of the patterns in the condition
  return condition.actions.some((pattern) => matchesPatternString(pattern, action))
}

/**
 * Checks if an action matches an action condition that may include prefix wildcards.
 * This variant accepts raw pattern strings for flexibility.
 *
 * @param patterns - Array of action pattern strings
 * @param action - The action to test
 * @returns true if the action matches any pattern
 */
export const matchesActionPatterns = (
  patterns: readonly ActionPattern[],
  action: Action
): boolean => {
  return patterns.some((pattern) => matchesPatternString(pattern, action))
}

/**
 * Checks if any of the given actions match an ActionCondition
 *
 * Useful for batch checking multiple actions against a condition.
 *
 * @param condition - The ActionCondition to match against
 * @param actions - The actions to test
 * @returns true if any action matches the condition
 */
export const anyActionMatchesCondition = (
  condition: ActionCondition,
  actions: readonly Action[]
): boolean => {
  return actions.some((action) => matchesActionCondition(condition, action))
}

/**
 * Gets all actions from a list that match a condition
 *
 * @param condition - The ActionCondition to match against
 * @param actions - The actions to filter
 * @returns Array of actions that match the condition
 */
export const filterMatchingActions = (
  condition: ActionCondition,
  actions: readonly Action[]
): Action[] => {
  return actions.filter((action) => matchesActionCondition(condition, action))
}

/**
 * Gets all actions from a list that match patterns (including prefix wildcards)
 *
 * @param patterns - Array of action pattern strings
 * @param actions - The actions to filter
 * @returns Array of actions that match any pattern
 */
export const filterMatchingActionsFromPatterns = (
  patterns: readonly ActionPattern[],
  actions: readonly Action[]
): Action[] => {
  return actions.filter((action) => matchesActionPatterns(patterns, action))
}
