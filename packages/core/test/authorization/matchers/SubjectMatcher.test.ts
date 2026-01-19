import { describe, it, expect } from "@effect/vitest"
import {
  matchesRoles,
  matchesFunctionalRoles,
  matchesUserIds,
  matchesPlatformAdmin,
  matchesSubjectCondition,
  matchesAnySubjectCondition,
  matchesAllSubjectConditions,
  getSubjectMismatchReason,
  createSubjectContextFromMembership,
  type SubjectContext
} from "../../../src/authorization/matchers/SubjectMatcher.ts"
import type { SubjectCondition } from "../../../src/authorization/PolicyConditions.ts"
import { AuthUserId } from "../../../src/authentication/AuthUserId.ts"
import type { BaseRole } from "../../../src/authorization/BaseRole.ts"
import type { FunctionalRole } from "../../../src/authorization/FunctionalRole.ts"

// Test UUIDs for user IDs
const TEST_USER_UUID = "550e8400-e29b-41d4-a716-446655440001"
const USER_1_UUID = "550e8400-e29b-41d4-a716-446655440002"
const USER_2_UUID = "550e8400-e29b-41d4-a716-446655440003"
const USER_3_UUID = "550e8400-e29b-41d4-a716-446655440004"
const SPECIFIC_USER_UUID = "550e8400-e29b-41d4-a716-446655440005"
const ALLOWED_USER_UUID = "550e8400-e29b-41d4-a716-446655440006"
const OTHER_USER_UUID = "550e8400-e29b-41d4-a716-446655440007"
const WRONG_USER_UUID = "550e8400-e29b-41d4-a716-446655440008"
const VIEWER_USER_UUID = "550e8400-e29b-41d4-a716-446655440009"
const ADMIN_USER_UUID = "550e8400-e29b-41d4-a716-446655440010"
const ACCOUNTANT_USER_UUID = "550e8400-e29b-41d4-a716-446655440011"

// Helper type for membership object to avoid type assertions
interface TestMembership {
  readonly userId: ReturnType<typeof AuthUserId.make>
  readonly role: BaseRole
  readonly isController: boolean
  readonly isFinanceManager: boolean
  readonly isAccountant: boolean
  readonly isPeriodAdmin: boolean
  readonly isConsolidationManager: boolean
}

// Helper to create test membership objects
const createMembership = (
  userId: string,
  role: BaseRole,
  functionalRoles: {
    isController?: boolean
    isFinanceManager?: boolean
    isAccountant?: boolean
    isPeriodAdmin?: boolean
    isConsolidationManager?: boolean
  } = {}
): TestMembership => ({
  userId: AuthUserId.make(userId),
  role,
  isController: functionalRoles.isController ?? false,
  isFinanceManager: functionalRoles.isFinanceManager ?? false,
  isAccountant: functionalRoles.isAccountant ?? false,
  isPeriodAdmin: functionalRoles.isPeriodAdmin ?? false,
  isConsolidationManager: functionalRoles.isConsolidationManager ?? false
})

// Helper to create test subject contexts
const createSubject = (
  overrides: Partial<SubjectContext> = {}
): SubjectContext => ({
  userId: AuthUserId.make(TEST_USER_UUID),
  role: "member",
  functionalRoles: [],
  isPlatformAdmin: false,
  ...overrides
})

describe("SubjectMatcher", () => {
  describe("matchesRoles", () => {
    it("should match when user role is in the list", () => {
      expect(matchesRoles(["owner", "admin"], "admin")).toBe(true)
      expect(matchesRoles(["owner", "admin"], "owner")).toBe(true)
    })

    it("should not match when user role is not in the list", () => {
      expect(matchesRoles(["owner", "admin"], "member")).toBe(false)
      expect(matchesRoles(["owner", "admin"], "viewer")).toBe(false)
    })

    it("should handle single role list", () => {
      expect(matchesRoles(["owner"], "owner")).toBe(true)
      expect(matchesRoles(["owner"], "admin")).toBe(false)
    })

    it("should handle all roles", () => {
      const allRoles: BaseRole[] = ["owner", "admin", "member", "viewer"]
      expect(matchesRoles(allRoles, "owner")).toBe(true)
      expect(matchesRoles(allRoles, "admin")).toBe(true)
      expect(matchesRoles(allRoles, "member")).toBe(true)
      expect(matchesRoles(allRoles, "viewer")).toBe(true)
    })

    it("should return false for empty role list", () => {
      expect(matchesRoles([], "owner")).toBe(false)
    })
  })

  describe("matchesFunctionalRoles", () => {
    it("should match when user has one of the required functional roles", () => {
      expect(
        matchesFunctionalRoles(["controller", "finance_manager"], ["controller"])
      ).toBe(true)
      expect(
        matchesFunctionalRoles(["controller"], ["controller", "accountant"])
      ).toBe(true)
    })

    it("should not match when user has none of the required roles", () => {
      expect(
        matchesFunctionalRoles(["controller", "finance_manager"], ["accountant"])
      ).toBe(false)
      expect(
        matchesFunctionalRoles(["controller"], ["finance_manager", "accountant"])
      ).toBe(false)
    })

    it("should handle empty user functional roles", () => {
      expect(matchesFunctionalRoles(["controller"], [])).toBe(false)
    })

    it("should handle empty required roles", () => {
      expect(matchesFunctionalRoles([], ["controller"])).toBe(false)
    })

    it("should match all functional roles", () => {
      const allFunctionalRoles: FunctionalRole[] = [
        "controller",
        "finance_manager",
        "accountant",
        "period_admin",
        "consolidation_manager"
      ]
      for (const role of allFunctionalRoles) {
        expect(matchesFunctionalRoles([role], [role])).toBe(true)
      }
    })
  })

  describe("matchesUserIds", () => {
    it("should match when user ID is in the list", () => {
      const user1 = AuthUserId.make(USER_1_UUID)
      const user2 = AuthUserId.make(USER_2_UUID)
      expect(matchesUserIds([user1, user2], user1)).toBe(true)
      expect(matchesUserIds([user1, user2], user2)).toBe(true)
    })

    it("should not match when user ID is not in the list", () => {
      const user1 = AuthUserId.make(USER_1_UUID)
      const user2 = AuthUserId.make(USER_2_UUID)
      const user3 = AuthUserId.make(USER_3_UUID)
      expect(matchesUserIds([user1, user2], user3)).toBe(false)
    })

    it("should handle single user list", () => {
      const user1 = AuthUserId.make(USER_1_UUID)
      expect(matchesUserIds([user1], user1)).toBe(true)
    })

    it("should return false for empty user list", () => {
      const user1 = AuthUserId.make(USER_1_UUID)
      expect(matchesUserIds([], user1)).toBe(false)
    })
  })

  describe("matchesPlatformAdmin", () => {
    it("should match when statuses are equal", () => {
      expect(matchesPlatformAdmin(true, true)).toBe(true)
      expect(matchesPlatformAdmin(false, false)).toBe(true)
    })

    it("should not match when statuses differ", () => {
      expect(matchesPlatformAdmin(true, false)).toBe(false)
      expect(matchesPlatformAdmin(false, true)).toBe(false)
    })
  })

  describe("matchesSubjectCondition", () => {
    describe("empty condition (matches all)", () => {
      it("should match any user when no conditions specified", () => {
        const condition: SubjectCondition = {}

        const ownerUser = createSubject({ role: "owner" })
        const viewerUser = createSubject({ role: "viewer" })
        const platformAdmin = createSubject({ isPlatformAdmin: true })

        expect(matchesSubjectCondition(condition, ownerUser)).toBe(true)
        expect(matchesSubjectCondition(condition, viewerUser)).toBe(true)
        expect(matchesSubjectCondition(condition, platformAdmin)).toBe(true)
      })
    })

    describe("roles condition", () => {
      it("should match when user has specified role", () => {
        const condition: SubjectCondition = {
          roles: ["owner", "admin"]
        }

        expect(
          matchesSubjectCondition(condition, createSubject({ role: "owner" }))
        ).toBe(true)
        expect(
          matchesSubjectCondition(condition, createSubject({ role: "admin" }))
        ).toBe(true)
      })

      it("should not match when user role is not in list", () => {
        const condition: SubjectCondition = {
          roles: ["owner", "admin"]
        }

        expect(
          matchesSubjectCondition(condition, createSubject({ role: "member" }))
        ).toBe(false)
        expect(
          matchesSubjectCondition(condition, createSubject({ role: "viewer" }))
        ).toBe(false)
      })

      it("should treat empty roles array as match all", () => {
        const condition: SubjectCondition = {
          roles: []
        }

        expect(
          matchesSubjectCondition(condition, createSubject({ role: "member" }))
        ).toBe(true)
      })
    })

    describe("functionalRoles condition", () => {
      it("should match when user has any specified functional role", () => {
        const condition: SubjectCondition = {
          functionalRoles: ["controller", "finance_manager"]
        }

        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ functionalRoles: ["controller"] })
          )
        ).toBe(true)
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ functionalRoles: ["finance_manager", "accountant"] })
          )
        ).toBe(true)
      })

      it("should not match when user has none of the specified functional roles", () => {
        const condition: SubjectCondition = {
          functionalRoles: ["controller", "finance_manager"]
        }

        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ functionalRoles: ["accountant"] })
          )
        ).toBe(false)
        expect(
          matchesSubjectCondition(condition, createSubject({ functionalRoles: [] }))
        ).toBe(false)
      })

      it("should treat empty functionalRoles array as match all", () => {
        const condition: SubjectCondition = {
          functionalRoles: []
        }

        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ functionalRoles: ["accountant"] })
          )
        ).toBe(true)
      })
    })

    describe("userIds condition", () => {
      it("should match when user ID is in list", () => {
        const userId = AuthUserId.make(SPECIFIC_USER_UUID)
        const condition: SubjectCondition = {
          userIds: [userId]
        }

        expect(
          matchesSubjectCondition(condition, createSubject({ userId }))
        ).toBe(true)
      })

      it("should not match when user ID is not in list", () => {
        const allowedUserId = AuthUserId.make(ALLOWED_USER_UUID)
        const actualUserId = AuthUserId.make(OTHER_USER_UUID)
        const condition: SubjectCondition = {
          userIds: [allowedUserId]
        }

        expect(
          matchesSubjectCondition(condition, createSubject({ userId: actualUserId }))
        ).toBe(false)
      })

      it("should treat empty userIds array as match all", () => {
        const condition: SubjectCondition = {
          userIds: []
        }

        expect(matchesSubjectCondition(condition, createSubject())).toBe(true)
      })
    })

    describe("isPlatformAdmin condition", () => {
      it("should match platform admins when required", () => {
        const condition: SubjectCondition = {
          isPlatformAdmin: true
        }

        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ isPlatformAdmin: true })
          )
        ).toBe(true)
      })

      it("should not match non-platform admins when platform admin required", () => {
        const condition: SubjectCondition = {
          isPlatformAdmin: true
        }

        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ isPlatformAdmin: false })
          )
        ).toBe(false)
      })

      it("should match non-platform admins when isPlatformAdmin is false", () => {
        const condition: SubjectCondition = {
          isPlatformAdmin: false
        }

        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ isPlatformAdmin: false })
          )
        ).toBe(true)
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ isPlatformAdmin: true })
          )
        ).toBe(false)
      })
    })

    describe("combined conditions (AND logic)", () => {
      it("should require ALL conditions to match", () => {
        const userId = AuthUserId.make(SPECIFIC_USER_UUID)
        const condition: SubjectCondition = {
          roles: ["admin"],
          functionalRoles: ["controller"],
          userIds: [userId]
        }

        // All conditions match
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({
              userId,
              role: "admin",
              functionalRoles: ["controller"]
            })
          )
        ).toBe(true)

        // Wrong role
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({
              userId,
              role: "member",
              functionalRoles: ["controller"]
            })
          )
        ).toBe(false)

        // Wrong functional role
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({
              userId,
              role: "admin",
              functionalRoles: ["accountant"]
            })
          )
        ).toBe(false)

        // Wrong user ID
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({
              userId: AuthUserId.make(WRONG_USER_UUID),
              role: "admin",
              functionalRoles: ["controller"]
            })
          )
        ).toBe(false)
      })

      it("should handle platform admin override pattern", () => {
        // Platform admin full access policy pattern
        const condition: SubjectCondition = {
          isPlatformAdmin: true
        }

        // Platform admin with viewer role can still access
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({
              role: "viewer",
              isPlatformAdmin: true
            })
          )
        ).toBe(true)

        // Non-platform admin owner cannot access via this policy
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({
              role: "owner",
              isPlatformAdmin: false
            })
          )
        ).toBe(false)
      })

      it("should handle owner full access pattern", () => {
        const condition: SubjectCondition = {
          roles: ["owner"]
        }

        expect(
          matchesSubjectCondition(condition, createSubject({ role: "owner" }))
        ).toBe(true)
        expect(
          matchesSubjectCondition(condition, createSubject({ role: "admin" }))
        ).toBe(false)
      })

      it("should handle controller-only operations pattern", () => {
        const condition: SubjectCondition = {
          functionalRoles: ["controller"]
        }

        // Member with controller role
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ role: "member", functionalRoles: ["controller"] })
          )
        ).toBe(true)

        // Admin with controller role
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ role: "admin", functionalRoles: ["controller"] })
          )
        ).toBe(true)

        // User without controller role
        expect(
          matchesSubjectCondition(
            condition,
            createSubject({ role: "admin", functionalRoles: ["accountant"] })
          )
        ).toBe(false)
      })
    })
  })

  describe("matchesAnySubjectCondition", () => {
    it("should return true if any condition matches", () => {
      const conditions: SubjectCondition[] = [
        { roles: ["owner"] },
        { functionalRoles: ["controller"] }
      ]

      // Owner matches first condition
      expect(
        matchesAnySubjectCondition(conditions, createSubject({ role: "owner" }))
      ).toBe(true)

      // Controller matches second condition
      expect(
        matchesAnySubjectCondition(
          conditions,
          createSubject({ role: "member", functionalRoles: ["controller"] })
        )
      ).toBe(true)
    })

    it("should return false if no condition matches", () => {
      const conditions: SubjectCondition[] = [
        { roles: ["owner"] },
        { functionalRoles: ["controller"] }
      ]

      expect(
        matchesAnySubjectCondition(
          conditions,
          createSubject({ role: "member", functionalRoles: ["accountant"] })
        )
      ).toBe(false)
    })

    it("should return false for empty conditions array", () => {
      expect(matchesAnySubjectCondition([], createSubject())).toBe(false)
    })
  })

  describe("matchesAllSubjectConditions", () => {
    it("should return true only if all conditions match", () => {
      const conditions: SubjectCondition[] = [
        { roles: ["owner", "admin"] },
        { isPlatformAdmin: false }
      ]

      // Admin + non-platform admin
      expect(
        matchesAllSubjectConditions(
          conditions,
          createSubject({ role: "admin", isPlatformAdmin: false })
        )
      ).toBe(true)

      // Admin + platform admin (fails second condition)
      expect(
        matchesAllSubjectConditions(
          conditions,
          createSubject({ role: "admin", isPlatformAdmin: true })
        )
      ).toBe(false)
    })

    it("should return true for empty conditions array", () => {
      expect(matchesAllSubjectConditions([], createSubject())).toBe(true)
    })
  })

  describe("getSubjectMismatchReason", () => {
    it("should return null when subject matches", () => {
      const condition: SubjectCondition = { roles: ["admin"] }
      expect(
        getSubjectMismatchReason(condition, createSubject({ role: "admin" }))
      ).toBe(null)
    })

    it("should describe role mismatch", () => {
      const condition: SubjectCondition = { roles: ["owner", "admin"] }
      const reason = getSubjectMismatchReason(
        condition,
        createSubject({ role: "member" })
      )

      expect(reason).toContain("member")
      expect(reason).toContain("owner")
      expect(reason).toContain("admin")
    })

    it("should describe functional role mismatch", () => {
      const condition: SubjectCondition = {
        functionalRoles: ["controller", "finance_manager"]
      }
      const reason = getSubjectMismatchReason(
        condition,
        createSubject({ functionalRoles: ["accountant"] })
      )

      expect(reason).toContain("accountant")
      expect(reason).toContain("controller")
      expect(reason).toContain("finance_manager")
    })

    it("should describe user ID mismatch without exposing allowed IDs", () => {
      const allowedUser = AuthUserId.make(ALLOWED_USER_UUID)
      const condition: SubjectCondition = { userIds: [allowedUser] }
      const reason = getSubjectMismatchReason(
        condition,
        createSubject({ userId: AuthUserId.make(OTHER_USER_UUID) })
      )

      expect(reason).toContain(OTHER_USER_UUID)
      expect(reason).toContain("not in allowed user IDs")
    })

    it("should describe platform admin mismatch", () => {
      const condition: SubjectCondition = { isPlatformAdmin: true }
      const reason = getSubjectMismatchReason(
        condition,
        createSubject({ isPlatformAdmin: false })
      )

      expect(reason).toContain("non-platform admin")
      expect(reason).toContain("platform admin")
    })

    it("should describe empty functional roles correctly", () => {
      const condition: SubjectCondition = {
        functionalRoles: ["controller"]
      }
      const reason = getSubjectMismatchReason(
        condition,
        createSubject({ functionalRoles: [] })
      )

      expect(reason).toContain("none")
    })
  })

  describe("createSubjectContextFromMembership", () => {
    it("should create context from membership with all functional roles", () => {
      const membership = createMembership(TEST_USER_UUID, "admin", {
        isController: true,
        isFinanceManager: true,
        isAccountant: true,
        isPeriodAdmin: true,
        isConsolidationManager: true
      })

      const context = createSubjectContextFromMembership(membership, false)

      expect(context.userId).toBe(membership.userId)
      expect(context.role).toBe("admin")
      expect(context.isPlatformAdmin).toBe(false)
      expect(context.functionalRoles).toContain("controller")
      expect(context.functionalRoles).toContain("finance_manager")
      expect(context.functionalRoles).toContain("accountant")
      expect(context.functionalRoles).toContain("period_admin")
      expect(context.functionalRoles).toContain("consolidation_manager")
      expect(context.functionalRoles.length).toBe(5)
    })

    it("should create context from membership with no functional roles", () => {
      const membership = createMembership(VIEWER_USER_UUID, "viewer")

      const context = createSubjectContextFromMembership(membership, false)

      expect(context.userId).toBe(membership.userId)
      expect(context.role).toBe("viewer")
      expect(context.isPlatformAdmin).toBe(false)
      expect(context.functionalRoles.length).toBe(0)
    })

    it("should respect isPlatformAdmin parameter", () => {
      const membership = createMembership(ADMIN_USER_UUID, "member")

      const normalContext = createSubjectContextFromMembership(membership, false)
      const platformAdminContext = createSubjectContextFromMembership(membership, true)

      expect(normalContext.isPlatformAdmin).toBe(false)
      expect(platformAdminContext.isPlatformAdmin).toBe(true)
    })

    it("should create context from membership with mixed functional roles", () => {
      const membership = createMembership(ACCOUNTANT_USER_UUID, "member", {
        isAccountant: true,
        isPeriodAdmin: true
      })

      const context = createSubjectContextFromMembership(membership, false)

      expect(context.functionalRoles).toContain("accountant")
      expect(context.functionalRoles).toContain("period_admin")
      expect(context.functionalRoles).not.toContain("controller")
      expect(context.functionalRoles).not.toContain("finance_manager")
      expect(context.functionalRoles).not.toContain("consolidation_manager")
      expect(context.functionalRoles.length).toBe(2)
    })
  })
})
