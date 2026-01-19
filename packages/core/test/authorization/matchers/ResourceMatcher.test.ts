import { describe, it, expect } from "@effect/vitest"
import {
  matchesResourceType,
  matchesAccountNumberCondition,
  matchesAccountType,
  matchesEntryType,
  matchesPeriodStatus,
  matchesBooleanAttribute,
  matchesResourceAttributes,
  matchesResourceCondition,
  matchesAnyResourceCondition,
  matchesAllResourceConditions,
  getResourceMismatchReason,
  createAccountResourceContext,
  createJournalEntryResourceContext,
  createFiscalPeriodResourceContext,
  createCompanyResourceContext,
  createOrganizationResourceContext,
  createConsolidationGroupResourceContext,
  createReportResourceContext
} from "../../../src/authorization/matchers/ResourceMatcher.ts"
import type {
  ResourceContext,
  ResourceType,
  AccountType,
  JournalEntryType,
  PeriodStatus
} from "../../../src/authorization/matchers/ResourceMatcher.ts"
import type { ResourceCondition } from "../../../src/authorization/PolicyConditions.ts"

describe("ResourceMatcher", () => {
  describe("matchesResourceType", () => {
    describe("exact match", () => {
      it("should match identical resource types", () => {
        const types: ResourceType[] = [
          "organization",
          "company",
          "account",
          "journal_entry",
          "fiscal_period",
          "consolidation_group",
          "report"
        ]

        for (const type of types) {
          expect(matchesResourceType(type, type)).toBe(true)
        }
      })

      it("should not match different resource types", () => {
        expect(matchesResourceType("account", "company")).toBe(false)
        expect(matchesResourceType("journal_entry", "fiscal_period")).toBe(false)
        expect(matchesResourceType("organization", "report")).toBe(false)
      })
    })

    describe("wildcard match", () => {
      it('should match any resource type with "*"', () => {
        const types: ResourceType[] = [
          "organization",
          "company",
          "account",
          "journal_entry",
          "fiscal_period",
          "consolidation_group",
          "report"
        ]

        for (const type of types) {
          expect(matchesResourceType("*", type)).toBe(true)
        }
      })
    })
  })

  describe("matchesAccountNumberCondition", () => {
    describe("range condition", () => {
      it("should match account number within range", () => {
        expect(matchesAccountNumberCondition({ range: [1000, 1999] }, 1000)).toBe(
          true
        )
        expect(matchesAccountNumberCondition({ range: [1000, 1999] }, 1500)).toBe(
          true
        )
        expect(matchesAccountNumberCondition({ range: [1000, 1999] }, 1999)).toBe(
          true
        )
      })

      it("should not match account number outside range", () => {
        expect(matchesAccountNumberCondition({ range: [1000, 1999] }, 999)).toBe(
          false
        )
        expect(matchesAccountNumberCondition({ range: [1000, 1999] }, 2000)).toBe(
          false
        )
      })

      it("should handle single-value range", () => {
        expect(matchesAccountNumberCondition({ range: [1000, 1000] }, 1000)).toBe(
          true
        )
        expect(matchesAccountNumberCondition({ range: [1000, 1000] }, 1001)).toBe(
          false
        )
      })
    })

    describe("in condition", () => {
      it("should match account number in list", () => {
        expect(matchesAccountNumberCondition({ in: [1000, 1100, 1200] }, 1000)).toBe(
          true
        )
        expect(matchesAccountNumberCondition({ in: [1000, 1100, 1200] }, 1100)).toBe(
          true
        )
        expect(matchesAccountNumberCondition({ in: [1000, 1100, 1200] }, 1200)).toBe(
          true
        )
      })

      it("should not match account number not in list", () => {
        expect(matchesAccountNumberCondition({ in: [1000, 1100, 1200] }, 1050)).toBe(
          false
        )
        expect(matchesAccountNumberCondition({ in: [1000, 1100, 1200] }, 2000)).toBe(
          false
        )
      })

      it("should handle empty in array", () => {
        expect(matchesAccountNumberCondition({ in: [] }, 1000)).toBe(true)
      })
    })

    describe("combined conditions", () => {
      it("should require both range and in to match (AND logic)", () => {
        // In range [1000-1999] AND in list [1000, 1100]
        expect(
          matchesAccountNumberCondition({ range: [1000, 1999], in: [1000, 1100] }, 1000)
        ).toBe(true)
        expect(
          matchesAccountNumberCondition({ range: [1000, 1999], in: [1000, 1100] }, 1100)
        ).toBe(true)
        // In range but not in list
        expect(
          matchesAccountNumberCondition({ range: [1000, 1999], in: [1000, 1100] }, 1500)
        ).toBe(false)
        // In list but not in range (not possible if list items are in range)
        expect(
          matchesAccountNumberCondition({ range: [1000, 1999], in: [2000] }, 2000)
        ).toBe(false)
      })
    })

    describe("no conditions", () => {
      it("should pass when no conditions specified", () => {
        expect(matchesAccountNumberCondition({}, 1000)).toBe(true)
        expect(matchesAccountNumberCondition({}, 9999)).toBe(true)
      })
    })
  })

  describe("matchesAccountType", () => {
    it("should match account type in allowed list", () => {
      expect(matchesAccountType(["Asset", "Liability"], "Asset")).toBe(true)
      expect(matchesAccountType(["Asset", "Liability"], "Liability")).toBe(true)
    })

    it("should not match account type not in list", () => {
      expect(matchesAccountType(["Asset", "Liability"], "Revenue")).toBe(false)
      expect(matchesAccountType(["Asset", "Liability"], "Expense")).toBe(false)
    })

    it("should handle all account types", () => {
      const types: AccountType[] = ["Asset", "Liability", "Equity", "Revenue", "Expense"]
      for (const type of types) {
        expect(matchesAccountType([type], type)).toBe(true)
        expect(matchesAccountType(types, type)).toBe(true)
      }
    })
  })

  describe("matchesEntryType", () => {
    it("should match entry type in allowed list", () => {
      expect(matchesEntryType(["Standard", "Adjusting"], "Standard")).toBe(true)
      expect(matchesEntryType(["Standard", "Adjusting"], "Adjusting")).toBe(true)
    })

    it("should not match entry type not in list", () => {
      expect(matchesEntryType(["Standard", "Adjusting"], "Closing")).toBe(false)
      expect(matchesEntryType(["Standard", "Adjusting"], "Elimination")).toBe(false)
    })

    it("should handle all entry types", () => {
      const types: JournalEntryType[] = [
        "Standard",
        "Adjusting",
        "Closing",
        "Reversing",
        "Elimination",
        "Consolidation",
        "Intercompany"
      ]
      for (const type of types) {
        expect(matchesEntryType([type], type)).toBe(true)
        expect(matchesEntryType(types, type)).toBe(true)
      }
    })
  })

  describe("matchesPeriodStatus", () => {
    it("should match period status in allowed list", () => {
      expect(matchesPeriodStatus(["Open", "SoftClose"], "Open")).toBe(true)
      expect(matchesPeriodStatus(["Open", "SoftClose"], "SoftClose")).toBe(true)
    })

    it("should not match period status not in list", () => {
      expect(matchesPeriodStatus(["Open", "SoftClose"], "Closed")).toBe(false)
      expect(matchesPeriodStatus(["Open", "SoftClose"], "Locked")).toBe(false)
    })

    it("should handle all period statuses", () => {
      const statuses: PeriodStatus[] = ["Open", "SoftClose", "Closed", "Locked"]
      for (const status of statuses) {
        expect(matchesPeriodStatus([status], status)).toBe(true)
        expect(matchesPeriodStatus(statuses, status)).toBe(true)
      }
    })
  })

  describe("matchesBooleanAttribute", () => {
    it("should match when values are equal", () => {
      expect(matchesBooleanAttribute(true, true)).toBe(true)
      expect(matchesBooleanAttribute(false, false)).toBe(true)
    })

    it("should not match when values differ", () => {
      expect(matchesBooleanAttribute(true, false)).toBe(false)
      expect(matchesBooleanAttribute(false, true)).toBe(false)
    })
  })

  describe("matchesResourceAttributes", () => {
    describe("account number attribute", () => {
      it("should match when account number is in range", () => {
        const resource: ResourceContext = { type: "account", accountNumber: 1500 }
        expect(
          matchesResourceAttributes({ accountNumber: { range: [1000, 1999] } }, resource)
        ).toBe(true)
      })

      it("should fail when account number is missing but condition specified", () => {
        const resource: ResourceContext = { type: "account" }
        expect(
          matchesResourceAttributes({ accountNumber: { range: [1000, 1999] } }, resource)
        ).toBe(false)
      })
    })

    describe("account type attribute", () => {
      it("should match when account type is in list", () => {
        const resource: ResourceContext = { type: "account", accountType: "Asset" }
        expect(matchesResourceAttributes({ accountType: ["Asset", "Liability"] }, resource)).toBe(
          true
        )
      })

      it("should fail when account type is missing but condition specified", () => {
        const resource: ResourceContext = { type: "account" }
        expect(matchesResourceAttributes({ accountType: ["Asset"] }, resource)).toBe(false)
      })
    })

    describe("intercompany flag", () => {
      it("should match when isIntercompany matches", () => {
        const resource: ResourceContext = { type: "account", isIntercompany: true }
        expect(matchesResourceAttributes({ isIntercompany: true }, resource)).toBe(true)
      })

      it("should fail when isIntercompany is missing but condition specified", () => {
        const resource: ResourceContext = { type: "account" }
        expect(matchesResourceAttributes({ isIntercompany: true }, resource)).toBe(false)
      })
    })

    describe("entry type attribute", () => {
      it("should match when entry type is in list", () => {
        const resource: ResourceContext = { type: "journal_entry", entryType: "Standard" }
        expect(matchesResourceAttributes({ entryType: ["Standard", "Adjusting"] }, resource)).toBe(
          true
        )
      })

      it("should fail when entry type is missing but condition specified", () => {
        const resource: ResourceContext = { type: "journal_entry" }
        expect(matchesResourceAttributes({ entryType: ["Standard"] }, resource)).toBe(false)
      })
    })

    describe("own entry flag", () => {
      it("should match when isOwnEntry matches", () => {
        const resource: ResourceContext = { type: "journal_entry", isOwnEntry: true }
        expect(matchesResourceAttributes({ isOwnEntry: true }, resource)).toBe(true)
      })

      it("should fail when isOwnEntry is missing but condition specified", () => {
        const resource: ResourceContext = { type: "journal_entry" }
        expect(matchesResourceAttributes({ isOwnEntry: true }, resource)).toBe(false)
      })
    })

    describe("period status attribute", () => {
      it("should match when period status is in list", () => {
        const resource: ResourceContext = { type: "fiscal_period", periodStatus: "Open" }
        expect(matchesResourceAttributes({ periodStatus: ["Open", "SoftClose"] }, resource)).toBe(
          true
        )
      })

      it("should fail when period status is missing but condition specified", () => {
        const resource: ResourceContext = { type: "fiscal_period" }
        expect(matchesResourceAttributes({ periodStatus: ["Open"] }, resource)).toBe(false)
      })
    })

    describe("adjustment period flag", () => {
      it("should match when isAdjustmentPeriod matches", () => {
        const resource: ResourceContext = { type: "fiscal_period", isAdjustmentPeriod: true }
        expect(matchesResourceAttributes({ isAdjustmentPeriod: true }, resource)).toBe(true)
      })

      it("should fail when isAdjustmentPeriod is missing but condition specified", () => {
        const resource: ResourceContext = { type: "fiscal_period" }
        expect(matchesResourceAttributes({ isAdjustmentPeriod: true }, resource)).toBe(false)
      })
    })

    describe("multiple attributes (AND logic)", () => {
      it("should require all specified attributes to match", () => {
        const resource: ResourceContext = {
          type: "account",
          accountNumber: 1500,
          accountType: "Asset",
          isIntercompany: false
        }

        // All match
        expect(
          matchesResourceAttributes(
            {
              accountNumber: { range: [1000, 1999] },
              accountType: ["Asset"],
              isIntercompany: false
            },
            resource
          )
        ).toBe(true)

        // One doesn't match
        expect(
          matchesResourceAttributes(
            {
              accountNumber: { range: [1000, 1999] },
              accountType: ["Liability"], // Wrong!
              isIntercompany: false
            },
            resource
          )
        ).toBe(false)
      })
    })

    describe("empty attributes", () => {
      it("should pass with empty attributes object", () => {
        const resource: ResourceContext = { type: "account" }
        expect(matchesResourceAttributes({}, resource)).toBe(true)
      })
    })
  })

  describe("matchesResourceCondition", () => {
    describe("type matching", () => {
      it("should match when type matches exactly", () => {
        const condition: ResourceCondition = { type: "account" }
        const resource: ResourceContext = { type: "account" }
        expect(matchesResourceCondition(condition, resource)).toBe(true)
      })

      it("should not match when type differs", () => {
        const condition: ResourceCondition = { type: "account" }
        const resource: ResourceContext = { type: "company" }
        expect(matchesResourceCondition(condition, resource)).toBe(false)
      })

      it("should match any type with wildcard", () => {
        const condition: ResourceCondition = { type: "*" }
        const types: ResourceType[] = [
          "organization",
          "company",
          "account",
          "journal_entry",
          "fiscal_period",
          "consolidation_group",
          "report"
        ]

        for (const type of types) {
          expect(matchesResourceCondition(condition, { type })).toBe(true)
        }
      })
    })

    describe("type with attributes", () => {
      it("should match when type and attributes match", () => {
        const condition: ResourceCondition = {
          type: "account",
          attributes: {
            accountType: ["Asset", "Liability"]
          }
        }
        const resource: ResourceContext = { type: "account", accountType: "Asset" }
        expect(matchesResourceCondition(condition, resource)).toBe(true)
      })

      it("should not match when type matches but attributes do not", () => {
        const condition: ResourceCondition = {
          type: "account",
          attributes: {
            accountType: ["Asset", "Liability"]
          }
        }
        const resource: ResourceContext = { type: "account", accountType: "Revenue" }
        expect(matchesResourceCondition(condition, resource)).toBe(false)
      })
    })

    describe("complex conditions", () => {
      it("should match locked period protection policy pattern", () => {
        // From spec: Prevent Modifications to Locked Periods
        const condition: ResourceCondition = {
          type: "journal_entry",
          attributes: {
            periodStatus: ["Locked"]
          }
        }

        const lockedPeriodEntry: ResourceContext = {
          type: "journal_entry",
          periodStatus: "Locked"
        }
        const openPeriodEntry: ResourceContext = {
          type: "journal_entry",
          periodStatus: "Open"
        }

        expect(matchesResourceCondition(condition, lockedPeriodEntry)).toBe(true)
        expect(matchesResourceCondition(condition, openPeriodEntry)).toBe(false)
      })

      it("should match account range policy pattern", () => {
        const condition: ResourceCondition = {
          type: "account",
          attributes: {
            accountNumber: { range: [1000, 1999] }
          }
        }

        const matchingAccount: ResourceContext = {
          type: "account",
          accountNumber: 1500
        }
        const nonMatchingAccount: ResourceContext = {
          type: "account",
          accountNumber: 2500
        }

        expect(matchesResourceCondition(condition, matchingAccount)).toBe(true)
        expect(matchesResourceCondition(condition, nonMatchingAccount)).toBe(false)
      })
    })
  })

  describe("matchesAnyResourceCondition", () => {
    it("should return true if any condition matches", () => {
      const conditions: ResourceCondition[] = [
        { type: "account" },
        { type: "journal_entry" }
      ]
      expect(matchesAnyResourceCondition(conditions, { type: "account" })).toBe(true)
      expect(matchesAnyResourceCondition(conditions, { type: "journal_entry" })).toBe(true)
    })

    it("should return false if no condition matches", () => {
      const conditions: ResourceCondition[] = [
        { type: "account" },
        { type: "journal_entry" }
      ]
      expect(matchesAnyResourceCondition(conditions, { type: "company" })).toBe(false)
    })

    it("should return false for empty conditions array", () => {
      expect(matchesAnyResourceCondition([], { type: "account" })).toBe(false)
    })
  })

  describe("matchesAllResourceConditions", () => {
    it("should return true if all conditions match", () => {
      const conditions: ResourceCondition[] = [
        { type: "*" },
        { type: "account" }
      ]
      expect(matchesAllResourceConditions(conditions, { type: "account" })).toBe(true)
    })

    it("should return false if any condition does not match", () => {
      const conditions: ResourceCondition[] = [
        { type: "account" },
        { type: "company" }
      ]
      expect(matchesAllResourceConditions(conditions, { type: "account" })).toBe(false)
    })

    it("should return true for empty conditions array", () => {
      expect(matchesAllResourceConditions([], { type: "account" })).toBe(true)
    })
  })

  describe("getResourceMismatchReason", () => {
    it("should return null when resource matches", () => {
      const condition: ResourceCondition = { type: "account" }
      const resource: ResourceContext = { type: "account" }
      expect(getResourceMismatchReason(condition, resource)).toBe(null)
    })

    it("should explain type mismatch", () => {
      const condition: ResourceCondition = { type: "account" }
      const resource: ResourceContext = { type: "company" }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Resource type 'company' does not match condition type 'account'"
      )
    })

    it("should explain missing account number", () => {
      const condition: ResourceCondition = {
        type: "account",
        attributes: { accountNumber: { range: [1000, 1999] } }
      }
      const resource: ResourceContext = { type: "account" }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Condition requires account number but resource has none"
      )
    })

    it("should explain account number range mismatch", () => {
      const condition: ResourceCondition = {
        type: "account",
        attributes: { accountNumber: { range: [1000, 1999] } }
      }
      const resource: ResourceContext = { type: "account", accountNumber: 2500 }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Account number 2500 is not in range [1000, 1999]"
      )
    })

    it("should explain account number in-list mismatch", () => {
      const condition: ResourceCondition = {
        type: "account",
        attributes: { accountNumber: { in: [1000, 1100] } }
      }
      const resource: ResourceContext = { type: "account", accountNumber: 1500 }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Account number 1500 is not in allowed list: [1000, 1100]"
      )
    })

    it("should explain account type mismatch", () => {
      const condition: ResourceCondition = {
        type: "account",
        attributes: { accountType: ["Asset", "Liability"] }
      }
      const resource: ResourceContext = { type: "account", accountType: "Revenue" }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Account type 'Revenue' is not in allowed types: [Asset, Liability]"
      )
    })

    it("should explain intercompany flag mismatch", () => {
      const condition: ResourceCondition = {
        type: "account",
        attributes: { isIntercompany: true }
      }
      const resource: ResourceContext = { type: "account", isIntercompany: false }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Resource is non-intercompany but condition requires intercompany"
      )
    })

    it("should explain entry type mismatch", () => {
      const condition: ResourceCondition = {
        type: "journal_entry",
        attributes: { entryType: ["Standard", "Adjusting"] }
      }
      const resource: ResourceContext = { type: "journal_entry", entryType: "Closing" }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Entry type 'Closing' is not in allowed types: [Standard, Adjusting]"
      )
    })

    it("should explain own entry flag mismatch", () => {
      const condition: ResourceCondition = {
        type: "journal_entry",
        attributes: { isOwnEntry: true }
      }
      const resource: ResourceContext = { type: "journal_entry", isOwnEntry: false }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Resource is other's entry but condition requires own entry"
      )
    })

    it("should explain period status mismatch", () => {
      const condition: ResourceCondition = {
        type: "journal_entry",
        attributes: { periodStatus: ["Locked"] }
      }
      const resource: ResourceContext = { type: "journal_entry", periodStatus: "Open" }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Period status 'Open' is not in allowed statuses: [Locked]"
      )
    })

    it("should explain adjustment period flag mismatch", () => {
      const condition: ResourceCondition = {
        type: "fiscal_period",
        attributes: { isAdjustmentPeriod: true }
      }
      const resource: ResourceContext = { type: "fiscal_period", isAdjustmentPeriod: false }
      expect(getResourceMismatchReason(condition, resource)).toBe(
        "Resource is regular period but condition requires adjustment period"
      )
    })
  })

  describe("helper functions", () => {
    describe("createAccountResourceContext", () => {
      it("should create account context with type", () => {
        const context = createAccountResourceContext({})
        expect(context.type).toBe("account")
      })

      it("should include all provided attributes", () => {
        const context = createAccountResourceContext({
          id: "acc-123",
          accountNumber: 1000,
          accountType: "Asset",
          isIntercompany: true
        })
        expect(context).toEqual({
          type: "account",
          id: "acc-123",
          accountNumber: 1000,
          accountType: "Asset",
          isIntercompany: true
        })
      })
    })

    describe("createJournalEntryResourceContext", () => {
      it("should create journal entry context with type", () => {
        const context = createJournalEntryResourceContext({})
        expect(context.type).toBe("journal_entry")
      })

      it("should include all provided attributes", () => {
        const context = createJournalEntryResourceContext({
          id: "je-123",
          entryType: "Standard",
          isOwnEntry: true,
          periodStatus: "Open"
        })
        expect(context).toEqual({
          type: "journal_entry",
          id: "je-123",
          entryType: "Standard",
          isOwnEntry: true,
          periodStatus: "Open"
        })
      })
    })

    describe("createFiscalPeriodResourceContext", () => {
      it("should create fiscal period context with type", () => {
        const context = createFiscalPeriodResourceContext({})
        expect(context.type).toBe("fiscal_period")
      })

      it("should include all provided attributes", () => {
        const context = createFiscalPeriodResourceContext({
          id: "fp-123",
          periodStatus: "Closed",
          isAdjustmentPeriod: true
        })
        expect(context).toEqual({
          type: "fiscal_period",
          id: "fp-123",
          periodStatus: "Closed",
          isAdjustmentPeriod: true
        })
      })
    })

    describe("createCompanyResourceContext", () => {
      it("should create company context with type", () => {
        const context = createCompanyResourceContext({})
        expect(context.type).toBe("company")
      })

      it("should include id if provided", () => {
        const context = createCompanyResourceContext({ id: "comp-123" })
        expect(context).toEqual({
          type: "company",
          id: "comp-123"
        })
      })
    })

    describe("createOrganizationResourceContext", () => {
      it("should create organization context with type", () => {
        const context = createOrganizationResourceContext({})
        expect(context.type).toBe("organization")
      })

      it("should include id if provided", () => {
        const context = createOrganizationResourceContext({ id: "org-123" })
        expect(context).toEqual({
          type: "organization",
          id: "org-123"
        })
      })
    })

    describe("createConsolidationGroupResourceContext", () => {
      it("should create consolidation group context with type", () => {
        const context = createConsolidationGroupResourceContext({})
        expect(context.type).toBe("consolidation_group")
      })

      it("should include id if provided", () => {
        const context = createConsolidationGroupResourceContext({ id: "cg-123" })
        expect(context).toEqual({
          type: "consolidation_group",
          id: "cg-123"
        })
      })
    })

    describe("createReportResourceContext", () => {
      it("should create report context with type", () => {
        const context = createReportResourceContext({})
        expect(context.type).toBe("report")
      })

      it("should include id if provided", () => {
        const context = createReportResourceContext({ id: "rpt-123" })
        expect(context).toEqual({
          type: "report",
          id: "rpt-123"
        })
      })
    })
  })
})
