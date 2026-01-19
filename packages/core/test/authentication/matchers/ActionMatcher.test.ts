import { describe, it, expect } from "@effect/vitest"
import {
  matchesActionPattern,
  matchesActionPatternString,
  matchesActionCondition,
  matchesActionPatterns,
  anyActionMatchesCondition,
  filterMatchingActions,
  filterMatchingActionsFromPatterns
} from "../../../src/authorization/matchers/ActionMatcher.ts"
import type { Action } from "../../../src/authorization/Action.ts"
import type { ActionCondition } from "../../../src/authorization/PolicyConditions.ts"
import type { ActionPattern } from "../../../src/authorization/matchers/ActionMatcher.ts"

describe("ActionMatcher", () => {
  describe("matchesActionPattern", () => {
    describe("exact match", () => {
      it("should match identical actions", () => {
        expect(
          matchesActionPattern("journal_entry:create", "journal_entry:create")
        ).toBe(true)
      })

      it("should not match different actions", () => {
        expect(
          matchesActionPattern("journal_entry:create", "journal_entry:update")
        ).toBe(false)
      })

      it("should not match different resource types", () => {
        expect(
          matchesActionPattern("journal_entry:create", "account:create")
        ).toBe(false)
      })

      it("should match all resource actions exactly", () => {
        const actions: Action[] = [
          "organization:manage_settings",
          "company:create",
          "company:read",
          "company:update",
          "company:delete",
          "account:create",
          "account:read",
          "account:update",
          "account:deactivate",
          "journal_entry:create",
          "journal_entry:read",
          "journal_entry:update",
          "journal_entry:post",
          "journal_entry:reverse",
          "report:read",
          "report:export"
        ]

        for (const action of actions) {
          expect(matchesActionPattern(action, action)).toBe(true)
        }
      })
    })

    describe("wildcard match", () => {
      it('should match any action with "*"', () => {
        expect(matchesActionPattern("*", "journal_entry:create")).toBe(true)
        expect(matchesActionPattern("*", "account:read")).toBe(true)
        expect(matchesActionPattern("*", "company:delete")).toBe(true)
        expect(matchesActionPattern("*", "organization:manage_settings")).toBe(
          true
        )
        expect(matchesActionPattern("*", "report:export")).toBe(true)
      })

      it("should match wildcard with itself", () => {
        expect(matchesActionPattern("*", "*")).toBe(true)
      })
    })

    describe("no match cases", () => {
      it("should not match partial prefix without wildcard", () => {
        expect(
          matchesActionPattern("journal_entry:create", "journal_entry:update")
        ).toBe(false)
      })

      it("should not match different verbs on same resource", () => {
        expect(matchesActionPattern("account:read", "account:update")).toBe(
          false
        )
      })
    })
  })

  describe("matchesActionPatternString (prefix wildcard support)", () => {
    describe("prefix wildcard match", () => {
      it('should match actions with matching prefix using ":*"', () => {
        expect(
          matchesActionPatternString("journal_entry:*", "journal_entry:create")
        ).toBe(true)
        expect(
          matchesActionPatternString("journal_entry:*", "journal_entry:read")
        ).toBe(true)
        expect(
          matchesActionPatternString("journal_entry:*", "journal_entry:update")
        ).toBe(true)
        expect(
          matchesActionPatternString("journal_entry:*", "journal_entry:post")
        ).toBe(true)
        expect(
          matchesActionPatternString("journal_entry:*", "journal_entry:reverse")
        ).toBe(true)
      })

      it("should not match actions with different prefix", () => {
        expect(
          matchesActionPatternString("journal_entry:*", "account:create")
        ).toBe(false)
        expect(
          matchesActionPatternString("journal_entry:*", "company:read")
        ).toBe(false)
      })

      it("should work for all resource prefixes", () => {
        const prefixes = [
          "organization",
          "company",
          "account",
          "journal_entry",
          "fiscal_period",
          "consolidation_group",
          "report",
          "exchange_rate",
          "audit_log"
        ]

        for (const prefix of prefixes) {
          const pattern: ActionPattern = `${prefix}:*`
          // Should match an action from the same resource (using read as test)
          const testAction = getTestActionForPrefix(prefix)
          expect(matchesActionPatternString(pattern, testAction)).toBe(true)
        }
      })

      it("should handle exact matches as well", () => {
        expect(
          matchesActionPatternString("journal_entry:create", "journal_entry:create")
        ).toBe(true)
        expect(
          matchesActionPatternString("*", "journal_entry:create")
        ).toBe(true)
      })
    })
  })

  describe("matchesActionCondition", () => {
    it("should match if action is in condition actions array", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create", "journal_entry:update"]
      }

      expect(matchesActionCondition(condition, "journal_entry:create")).toBe(
        true
      )
      expect(matchesActionCondition(condition, "journal_entry:update")).toBe(
        true
      )
    })

    it("should not match if action is not in condition actions array", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create", "journal_entry:update"]
      }

      expect(matchesActionCondition(condition, "journal_entry:post")).toBe(
        false
      )
      expect(matchesActionCondition(condition, "account:create")).toBe(false)
    })

    it("should match any action when condition contains wildcard", () => {
      const condition: ActionCondition = {
        actions: ["*"]
      }

      expect(matchesActionCondition(condition, "journal_entry:create")).toBe(
        true
      )
      expect(matchesActionCondition(condition, "account:read")).toBe(true)
      expect(matchesActionCondition(condition, "company:delete")).toBe(true)
      expect(
        matchesActionCondition(condition, "organization:manage_settings")
      ).toBe(true)
    })

    it("should return false for empty condition actions array", () => {
      const condition: ActionCondition = {
        actions: []
      }

      expect(matchesActionCondition(condition, "journal_entry:create")).toBe(
        false
      )
    })

    it("should match multiple read actions pattern", () => {
      // Common pattern: viewer can read multiple resource types
      const condition: ActionCondition = {
        actions: [
          "company:read",
          "account:read",
          "journal_entry:read",
          "fiscal_period:read",
          "consolidation_group:read",
          "report:read",
          "exchange_rate:read"
        ]
      }

      expect(matchesActionCondition(condition, "company:read")).toBe(true)
      expect(matchesActionCondition(condition, "account:read")).toBe(true)
      expect(matchesActionCondition(condition, "report:read")).toBe(true)
      expect(matchesActionCondition(condition, "company:create")).toBe(false)
      expect(matchesActionCondition(condition, "company:delete")).toBe(false)
    })
  })

  describe("matchesActionPatterns (with prefix wildcards)", () => {
    it("should match prefix wildcard patterns", () => {
      const patterns: ActionPattern[] = ["journal_entry:*", "account:read"]

      expect(matchesActionPatterns(patterns, "journal_entry:create")).toBe(true)
      expect(matchesActionPatterns(patterns, "journal_entry:post")).toBe(true)
      expect(matchesActionPatterns(patterns, "account:read")).toBe(true)
      expect(matchesActionPatterns(patterns, "account:create")).toBe(false)
    })

    it("should handle wildcard", () => {
      const patterns: ActionPattern[] = ["*"]

      expect(matchesActionPatterns(patterns, "journal_entry:create")).toBe(true)
      expect(matchesActionPatterns(patterns, "account:read")).toBe(true)
    })

    it("should handle empty patterns array", () => {
      const patterns: ActionPattern[] = []

      expect(matchesActionPatterns(patterns, "journal_entry:create")).toBe(false)
    })
  })

  describe("anyActionMatchesCondition", () => {
    it("should return true if any action matches", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create", "journal_entry:update"]
      }
      const actions: Action[] = [
        "account:create",
        "journal_entry:create",
        "company:read"
      ]

      expect(anyActionMatchesCondition(condition, actions)).toBe(true)
    })

    it("should return false if no action matches", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create", "journal_entry:update"]
      }
      const actions: Action[] = ["account:create", "company:read"]

      expect(anyActionMatchesCondition(condition, actions)).toBe(false)
    })

    it("should return false for empty actions array", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create"]
      }

      expect(anyActionMatchesCondition(condition, [])).toBe(false)
    })

    it("should handle wildcard condition", () => {
      const condition: ActionCondition = {
        actions: ["*"]
      }
      const actions: Action[] = ["account:create"]

      expect(anyActionMatchesCondition(condition, actions)).toBe(true)
    })
  })

  describe("filterMatchingActions", () => {
    it("should return only matching actions", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create", "journal_entry:read"]
      }
      const actions: Action[] = [
        "journal_entry:create",
        "journal_entry:read",
        "account:create",
        "company:read"
      ]

      const result = filterMatchingActions(condition, actions)

      expect(result).toEqual(["journal_entry:create", "journal_entry:read"])
    })

    it("should return empty array if no actions match", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create"]
      }
      const actions: Action[] = ["account:create", "company:read"]

      const result = filterMatchingActions(condition, actions)

      expect(result).toEqual([])
    })

    it("should return all actions for wildcard condition", () => {
      const condition: ActionCondition = {
        actions: ["*"]
      }
      const actions: Action[] = [
        "journal_entry:create",
        "account:read",
        "company:delete"
      ]

      const result = filterMatchingActions(condition, actions)

      expect(result).toEqual([
        "journal_entry:create",
        "account:read",
        "company:delete"
      ])
    })

    it("should handle empty input arrays", () => {
      const condition: ActionCondition = {
        actions: ["journal_entry:create"]
      }

      expect(filterMatchingActions(condition, [])).toEqual([])
    })
  })

  describe("filterMatchingActionsFromPatterns (with prefix wildcards)", () => {
    it("should filter using prefix wildcard patterns", () => {
      const patterns: ActionPattern[] = ["journal_entry:*"]
      const actions: Action[] = [
        "journal_entry:create",
        "journal_entry:read",
        "account:create",
        "company:read"
      ]

      const result = filterMatchingActionsFromPatterns(patterns, actions)

      expect(result).toEqual(["journal_entry:create", "journal_entry:read"])
    })

    it("should handle multiple patterns including wildcards", () => {
      const patterns: ActionPattern[] = ["journal_entry:*", "company:read"]
      const actions: Action[] = [
        "journal_entry:create",
        "journal_entry:read",
        "account:create",
        "company:read",
        "company:delete"
      ]

      const result = filterMatchingActionsFromPatterns(patterns, actions)

      expect(result).toEqual([
        "journal_entry:create",
        "journal_entry:read",
        "company:read"
      ])
    })
  })
})

/**
 * Helper to get a valid test action for a given prefix
 */
function getTestActionForPrefix(prefix: string): Action {
  const prefixToAction: Record<string, Action> = {
    organization: "organization:manage_settings",
    company: "company:read",
    account: "account:read",
    journal_entry: "journal_entry:read",
    fiscal_period: "fiscal_period:read",
    consolidation_group: "consolidation_group:read",
    report: "report:read",
    exchange_rate: "exchange_rate:read",
    audit_log: "audit_log:read"
  }
  return prefixToAction[prefix] ?? "company:read"
}
