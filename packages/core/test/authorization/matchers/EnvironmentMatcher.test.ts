/**
 * Tests for EnvironmentMatcher
 *
 * Tests the environment condition matching functionality for ABAC policy evaluation.
 */

import { describe, it, expect } from "@effect/vitest"
import type { EnvironmentCondition } from "../../../src/authorization/PolicyConditions.ts"
import {
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
  getEnvironmentMismatchReason,
  type EnvironmentContext
} from "../../../src/authorization/matchers/EnvironmentMatcher.ts"

describe("EnvironmentMatcher", () => {
  // ==========================================================================
  // createEnvironmentContext
  // ==========================================================================
  describe("createEnvironmentContext", () => {
    it("should create context from a date", () => {
      // Wednesday, January 15, 2025, 14:30
      const date = new Date(2025, 0, 15, 14, 30, 0)
      const context = createEnvironmentContext(date, "192.168.1.100")

      expect(context.currentTime).toBe("14:30")
      expect(context.currentDayOfWeek).toBe(3) // Wednesday
      expect(context.ipAddress).toBe("192.168.1.100")
    })

    it("should handle single-digit hours and minutes with padding", () => {
      // Monday, January 6, 2025, 09:05
      const date = new Date(2025, 0, 6, 9, 5, 0)
      const context = createEnvironmentContext(date)

      expect(context.currentTime).toBe("09:05")
      expect(context.currentDayOfWeek).toBe(1) // Monday
      expect(context.ipAddress).toBeUndefined()
    })

    it("should handle midnight", () => {
      const date = new Date(2025, 0, 6, 0, 0, 0)
      const context = createEnvironmentContext(date)

      expect(context.currentTime).toBe("00:00")
    })

    it("should handle end of day", () => {
      const date = new Date(2025, 0, 6, 23, 59, 0)
      const context = createEnvironmentContext(date)

      expect(context.currentTime).toBe("23:59")
    })
  })

  // ==========================================================================
  // parseTimeToMinutes
  // ==========================================================================
  describe("parseTimeToMinutes", () => {
    it("should parse midnight correctly", () => {
      expect(parseTimeToMinutes("00:00")).toBe(0)
    })

    it("should parse noon correctly", () => {
      expect(parseTimeToMinutes("12:00")).toBe(720)
    })

    it("should parse end of day correctly", () => {
      expect(parseTimeToMinutes("23:59")).toBe(1439)
    })

    it("should parse arbitrary times correctly", () => {
      expect(parseTimeToMinutes("09:30")).toBe(570)
      expect(parseTimeToMinutes("17:00")).toBe(1020)
      expect(parseTimeToMinutes("14:45")).toBe(885)
    })
  })

  // ==========================================================================
  // matchesTimeOfDay
  // ==========================================================================
  describe("matchesTimeOfDay", () => {
    describe("normal time ranges", () => {
      const workingHours = { start: "09:00", end: "17:00" }

      it("should match time within range", () => {
        expect(matchesTimeOfDay(workingHours, "09:00")).toBe(true)
        expect(matchesTimeOfDay(workingHours, "12:00")).toBe(true)
        expect(matchesTimeOfDay(workingHours, "17:00")).toBe(true)
      })

      it("should not match time outside range", () => {
        expect(matchesTimeOfDay(workingHours, "08:59")).toBe(false)
        expect(matchesTimeOfDay(workingHours, "17:01")).toBe(false)
        expect(matchesTimeOfDay(workingHours, "00:00")).toBe(false)
        expect(matchesTimeOfDay(workingHours, "23:59")).toBe(false)
      })
    })

    describe("overnight time ranges", () => {
      const nightShift = { start: "22:00", end: "06:00" }

      it("should match time in evening portion", () => {
        expect(matchesTimeOfDay(nightShift, "22:00")).toBe(true)
        expect(matchesTimeOfDay(nightShift, "23:30")).toBe(true)
        expect(matchesTimeOfDay(nightShift, "23:59")).toBe(true)
      })

      it("should match time in morning portion", () => {
        expect(matchesTimeOfDay(nightShift, "00:00")).toBe(true)
        expect(matchesTimeOfDay(nightShift, "03:00")).toBe(true)
        expect(matchesTimeOfDay(nightShift, "06:00")).toBe(true)
      })

      it("should not match time in daytime gap", () => {
        expect(matchesTimeOfDay(nightShift, "06:01")).toBe(false)
        expect(matchesTimeOfDay(nightShift, "12:00")).toBe(false)
        expect(matchesTimeOfDay(nightShift, "21:59")).toBe(false)
      })
    })

    describe("edge cases", () => {
      it("should handle full day range", () => {
        const fullDay = { start: "00:00", end: "23:59" }
        expect(matchesTimeOfDay(fullDay, "00:00")).toBe(true)
        expect(matchesTimeOfDay(fullDay, "12:00")).toBe(true)
        expect(matchesTimeOfDay(fullDay, "23:59")).toBe(true)
      })

      it("should handle same start and end time", () => {
        const singleMinute = { start: "12:00", end: "12:00" }
        expect(matchesTimeOfDay(singleMinute, "12:00")).toBe(true)
        expect(matchesTimeOfDay(singleMinute, "12:01")).toBe(false)
      })
    })
  })

  // ==========================================================================
  // matchesDayOfWeek
  // ==========================================================================
  describe("matchesDayOfWeek", () => {
    it("should match weekdays", () => {
      const weekdays = [1, 2, 3, 4, 5]

      expect(matchesDayOfWeek(weekdays, 1)).toBe(true) // Monday
      expect(matchesDayOfWeek(weekdays, 3)).toBe(true) // Wednesday
      expect(matchesDayOfWeek(weekdays, 5)).toBe(true) // Friday
      expect(matchesDayOfWeek(weekdays, 0)).toBe(false) // Sunday
      expect(matchesDayOfWeek(weekdays, 6)).toBe(false) // Saturday
    })

    it("should match weekends", () => {
      const weekends = [0, 6]

      expect(matchesDayOfWeek(weekends, 0)).toBe(true) // Sunday
      expect(matchesDayOfWeek(weekends, 6)).toBe(true) // Saturday
      expect(matchesDayOfWeek(weekends, 1)).toBe(false) // Monday
    })

    it("should match specific days", () => {
      const tuesdayThursday = [2, 4]

      expect(matchesDayOfWeek(tuesdayThursday, 2)).toBe(true)
      expect(matchesDayOfWeek(tuesdayThursday, 4)).toBe(true)
      expect(matchesDayOfWeek(tuesdayThursday, 3)).toBe(false)
    })

    it("should handle single day", () => {
      const mondayOnly = [1]

      expect(matchesDayOfWeek(mondayOnly, 1)).toBe(true)
      expect(matchesDayOfWeek(mondayOnly, 0)).toBe(false)
    })

    it("should handle all days", () => {
      const allDays = [0, 1, 2, 3, 4, 5, 6]

      for (let day = 0; day <= 6; day++) {
        expect(matchesDayOfWeek(allDays, day)).toBe(true)
      }
    })
  })

  // ==========================================================================
  // matchesIPPattern
  // ==========================================================================
  describe("matchesIPPattern", () => {
    describe("exact IP matching", () => {
      it("should match exact IP", () => {
        expect(matchesIPPattern("192.168.1.100", "192.168.1.100")).toBe(true)
      })

      it("should not match different IP", () => {
        expect(matchesIPPattern("192.168.1.100", "192.168.1.101")).toBe(false)
      })
    })

    describe("CIDR matching", () => {
      it("should match IP in /24 subnet", () => {
        expect(matchesIPPattern("192.168.1.0/24", "192.168.1.0")).toBe(true)
        expect(matchesIPPattern("192.168.1.0/24", "192.168.1.100")).toBe(true)
        expect(matchesIPPattern("192.168.1.0/24", "192.168.1.255")).toBe(true)
      })

      it("should not match IP outside /24 subnet", () => {
        expect(matchesIPPattern("192.168.1.0/24", "192.168.2.1")).toBe(false)
        expect(matchesIPPattern("192.168.1.0/24", "10.0.0.1")).toBe(false)
      })

      it("should match IP in /16 subnet", () => {
        expect(matchesIPPattern("192.168.0.0/16", "192.168.0.1")).toBe(true)
        expect(matchesIPPattern("192.168.0.0/16", "192.168.255.255")).toBe(true)
      })

      it("should not match IP outside /16 subnet", () => {
        expect(matchesIPPattern("192.168.0.0/16", "192.169.0.1")).toBe(false)
      })

      it("should match IP in /8 subnet (class A)", () => {
        expect(matchesIPPattern("10.0.0.0/8", "10.0.0.1")).toBe(true)
        expect(matchesIPPattern("10.0.0.0/8", "10.255.255.255")).toBe(true)
      })

      it("should not match IP outside /8 subnet", () => {
        expect(matchesIPPattern("10.0.0.0/8", "11.0.0.1")).toBe(false)
      })

      it("should match any IP with /0 (match all)", () => {
        expect(matchesIPPattern("0.0.0.0/0", "192.168.1.100")).toBe(true)
        expect(matchesIPPattern("0.0.0.0/0", "10.0.0.1")).toBe(true)
        expect(matchesIPPattern("0.0.0.0/0", "8.8.8.8")).toBe(true)
      })

      it("should handle /32 as exact match", () => {
        expect(matchesIPPattern("192.168.1.100/32", "192.168.1.100")).toBe(true)
        expect(matchesIPPattern("192.168.1.100/32", "192.168.1.101")).toBe(false)
      })
    })

    describe("common private network ranges", () => {
      it("should match 10.x.x.x private range", () => {
        expect(matchesIPPattern("10.0.0.0/8", "10.1.2.3")).toBe(true)
      })

      it("should match 172.16-31.x.x private range", () => {
        expect(matchesIPPattern("172.16.0.0/12", "172.16.0.1")).toBe(true)
        expect(matchesIPPattern("172.16.0.0/12", "172.31.255.255")).toBe(true)
        expect(matchesIPPattern("172.16.0.0/12", "172.32.0.1")).toBe(false)
      })

      it("should match 192.168.x.x private range", () => {
        expect(matchesIPPattern("192.168.0.0/16", "192.168.1.1")).toBe(true)
      })
    })

    describe("IPv6 support", () => {
      it("should match exact IPv6 address", () => {
        expect(matchesIPPattern("::1", "::1")).toBe(true)
        expect(matchesIPPattern("2001:db8::1", "2001:db8::1")).toBe(true)
      })

      it("should not match different IPv6 address", () => {
        expect(matchesIPPattern("::1", "::2")).toBe(false)
      })
    })
  })

  // ==========================================================================
  // matchesIPAllowList
  // ==========================================================================
  describe("matchesIPAllowList", () => {
    it("should match if IP is in allow list", () => {
      const allowList = ["192.168.1.0/24", "10.0.0.0/8"]

      expect(matchesIPAllowList(allowList, "192.168.1.100")).toBe(true)
      expect(matchesIPAllowList(allowList, "10.1.2.3")).toBe(true)
    })

    it("should not match if IP is not in allow list", () => {
      const allowList = ["192.168.1.0/24", "10.0.0.0/8"]

      expect(matchesIPAllowList(allowList, "172.16.0.1")).toBe(false)
      expect(matchesIPAllowList(allowList, "8.8.8.8")).toBe(false)
    })

    it("should handle exact IPs in allow list", () => {
      const allowList = ["192.168.1.100", "10.0.0.1"]

      expect(matchesIPAllowList(allowList, "192.168.1.100")).toBe(true)
      expect(matchesIPAllowList(allowList, "192.168.1.101")).toBe(false)
    })

    it("should handle mixed exact and CIDR", () => {
      const allowList = ["192.168.1.100", "10.0.0.0/8"]

      expect(matchesIPAllowList(allowList, "192.168.1.100")).toBe(true)
      expect(matchesIPAllowList(allowList, "10.1.2.3")).toBe(true)
      expect(matchesIPAllowList(allowList, "192.168.1.101")).toBe(false)
    })
  })

  // ==========================================================================
  // matchesIPDenyList
  // ==========================================================================
  describe("matchesIPDenyList", () => {
    it("should return true if IP is NOT in deny list", () => {
      const denyList = ["192.168.1.0/24"]

      expect(matchesIPDenyList(denyList, "10.0.0.1")).toBe(true)
      expect(matchesIPDenyList(denyList, "8.8.8.8")).toBe(true)
    })

    it("should return false if IP IS in deny list", () => {
      const denyList = ["192.168.1.0/24"]

      expect(matchesIPDenyList(denyList, "192.168.1.100")).toBe(false)
      expect(matchesIPDenyList(denyList, "192.168.1.1")).toBe(false)
    })

    it("should handle multiple deny entries", () => {
      const denyList = ["192.168.1.0/24", "10.0.0.0/8"]

      expect(matchesIPDenyList(denyList, "192.168.1.100")).toBe(false)
      expect(matchesIPDenyList(denyList, "10.1.2.3")).toBe(false)
      expect(matchesIPDenyList(denyList, "172.16.0.1")).toBe(true)
    })
  })

  // ==========================================================================
  // matchesEnvironmentCondition
  // ==========================================================================
  describe("matchesEnvironmentCondition", () => {
    describe("empty condition", () => {
      it("should match any context when condition is empty", () => {
        const condition: EnvironmentCondition = {}
        const context: EnvironmentContext = {
          currentTime: "12:00",
          currentDayOfWeek: 3,
          ipAddress: "192.168.1.100"
        }

        expect(matchesEnvironmentCondition(condition, context)).toBe(true)
      })

      it("should match empty context when condition is empty", () => {
        const condition: EnvironmentCondition = {}
        const context: EnvironmentContext = {}

        expect(matchesEnvironmentCondition(condition, context)).toBe(true)
      })
    })

    describe("time of day condition", () => {
      it("should match when time is within range", () => {
        const condition: EnvironmentCondition = {
          timeOfDay: { start: "09:00", end: "17:00" }
        }
        const context: EnvironmentContext = { currentTime: "12:00" }

        expect(matchesEnvironmentCondition(condition, context)).toBe(true)
      })

      it("should not match when time is outside range", () => {
        const condition: EnvironmentCondition = {
          timeOfDay: { start: "09:00", end: "17:00" }
        }
        const context: EnvironmentContext = { currentTime: "18:00" }

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })

      it("should not match when context has no time", () => {
        const condition: EnvironmentCondition = {
          timeOfDay: { start: "09:00", end: "17:00" }
        }
        const context: EnvironmentContext = {}

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })
    })

    describe("days of week condition", () => {
      it("should match when day is in list", () => {
        const condition: EnvironmentCondition = {
          daysOfWeek: [1, 2, 3, 4, 5] // Weekdays
        }
        const context: EnvironmentContext = { currentDayOfWeek: 3 }

        expect(matchesEnvironmentCondition(condition, context)).toBe(true)
      })

      it("should not match when day is not in list", () => {
        const condition: EnvironmentCondition = {
          daysOfWeek: [1, 2, 3, 4, 5] // Weekdays
        }
        const context: EnvironmentContext = { currentDayOfWeek: 0 } // Sunday

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })

      it("should not match when context has no day", () => {
        const condition: EnvironmentCondition = {
          daysOfWeek: [1, 2, 3, 4, 5]
        }
        const context: EnvironmentContext = {}

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })
    })

    describe("IP allow list condition", () => {
      it("should match when IP is in allow list", () => {
        const condition: EnvironmentCondition = {
          ipAllowList: ["192.168.1.0/24"]
        }
        const context: EnvironmentContext = { ipAddress: "192.168.1.100" }

        expect(matchesEnvironmentCondition(condition, context)).toBe(true)
      })

      it("should not match when IP is not in allow list", () => {
        const condition: EnvironmentCondition = {
          ipAllowList: ["192.168.1.0/24"]
        }
        const context: EnvironmentContext = { ipAddress: "10.0.0.1" }

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })

      it("should not match when context has no IP", () => {
        const condition: EnvironmentCondition = {
          ipAllowList: ["192.168.1.0/24"]
        }
        const context: EnvironmentContext = {}

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })
    })

    describe("IP deny list condition", () => {
      it("should match when IP is not in deny list", () => {
        const condition: EnvironmentCondition = {
          ipDenyList: ["192.168.1.0/24"]
        }
        const context: EnvironmentContext = { ipAddress: "10.0.0.1" }

        expect(matchesEnvironmentCondition(condition, context)).toBe(true)
      })

      it("should not match when IP is in deny list", () => {
        const condition: EnvironmentCondition = {
          ipDenyList: ["192.168.1.0/24"]
        }
        const context: EnvironmentContext = { ipAddress: "192.168.1.100" }

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })

      it("should not match when context has no IP for deny list", () => {
        const condition: EnvironmentCondition = {
          ipDenyList: ["192.168.1.0/24"]
        }
        const context: EnvironmentContext = {}

        expect(matchesEnvironmentCondition(condition, context)).toBe(false)
      })
    })

    describe("combined conditions (AND logic)", () => {
      const businessHoursCondition: EnvironmentCondition = {
        timeOfDay: { start: "09:00", end: "17:00" },
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        ipAllowList: ["192.168.0.0/16"]
      }

      it("should match when all conditions are met", () => {
        const context: EnvironmentContext = {
          currentTime: "12:00",
          currentDayOfWeek: 3, // Wednesday
          ipAddress: "192.168.1.100"
        }

        expect(matchesEnvironmentCondition(businessHoursCondition, context)).toBe(true)
      })

      it("should not match when time is outside range", () => {
        const context: EnvironmentContext = {
          currentTime: "18:00", // After hours
          currentDayOfWeek: 3,
          ipAddress: "192.168.1.100"
        }

        expect(matchesEnvironmentCondition(businessHoursCondition, context)).toBe(false)
      })

      it("should not match when day is weekend", () => {
        const context: EnvironmentContext = {
          currentTime: "12:00",
          currentDayOfWeek: 0, // Sunday
          ipAddress: "192.168.1.100"
        }

        expect(matchesEnvironmentCondition(businessHoursCondition, context)).toBe(false)
      })

      it("should not match when IP is not allowed", () => {
        const context: EnvironmentContext = {
          currentTime: "12:00",
          currentDayOfWeek: 3,
          ipAddress: "10.0.0.1" // Not in 192.168.0.0/16
        }

        expect(matchesEnvironmentCondition(businessHoursCondition, context)).toBe(false)
      })
    })

    describe("allow and deny list together", () => {
      it("should require both allow and deny conditions to pass", () => {
        const condition: EnvironmentCondition = {
          ipAllowList: ["192.168.0.0/16", "10.0.0.0/8"],
          ipDenyList: ["192.168.1.0/24"] // Block specific subnet
        }

        // In allow list and NOT in deny list
        expect(matchesEnvironmentCondition(condition, { ipAddress: "192.168.2.100" })).toBe(true)
        expect(matchesEnvironmentCondition(condition, { ipAddress: "10.1.2.3" })).toBe(true)

        // In both allow and deny list (deny takes precedence via AND)
        expect(matchesEnvironmentCondition(condition, { ipAddress: "192.168.1.100" })).toBe(false)

        // Not in allow list
        expect(matchesEnvironmentCondition(condition, { ipAddress: "172.16.0.1" })).toBe(false)
      })
    })
  })

  // ==========================================================================
  // matchesAnyEnvironmentCondition
  // ==========================================================================
  describe("matchesAnyEnvironmentCondition", () => {
    it("should match if any condition matches", () => {
      const conditions: EnvironmentCondition[] = [
        { daysOfWeek: [0, 6] }, // Weekend
        { timeOfDay: { start: "09:00", end: "17:00" } } // Business hours
      ]
      const context: EnvironmentContext = {
        currentTime: "12:00",
        currentDayOfWeek: 3 // Wednesday
      }

      // Matches second condition (business hours) even though not weekend
      expect(matchesAnyEnvironmentCondition(conditions, context)).toBe(true)
    })

    it("should not match if no condition matches", () => {
      const conditions: EnvironmentCondition[] = [
        { daysOfWeek: [0, 6] }, // Weekend only
        { ipAllowList: ["10.0.0.0/8"] } // Specific network
      ]
      const context: EnvironmentContext = {
        currentDayOfWeek: 3, // Wednesday (not weekend)
        ipAddress: "192.168.1.100" // Not in 10.x.x.x
      }

      expect(matchesAnyEnvironmentCondition(conditions, context)).toBe(false)
    })
  })

  // ==========================================================================
  // matchesAllEnvironmentConditions
  // ==========================================================================
  describe("matchesAllEnvironmentConditions", () => {
    it("should match only if all conditions match", () => {
      const conditions: EnvironmentCondition[] = [
        { daysOfWeek: [1, 2, 3, 4, 5] }, // Weekday
        { timeOfDay: { start: "09:00", end: "17:00" } } // Business hours
      ]
      const context: EnvironmentContext = {
        currentTime: "12:00",
        currentDayOfWeek: 3 // Wednesday
      }

      expect(matchesAllEnvironmentConditions(conditions, context)).toBe(true)
    })

    it("should not match if any condition fails", () => {
      const conditions: EnvironmentCondition[] = [
        { daysOfWeek: [1, 2, 3, 4, 5] }, // Weekday
        { timeOfDay: { start: "09:00", end: "17:00" } } // Business hours
      ]
      const context: EnvironmentContext = {
        currentTime: "18:00", // After hours
        currentDayOfWeek: 3 // Wednesday
      }

      // Day matches but time doesn't
      expect(matchesAllEnvironmentConditions(conditions, context)).toBe(false)
    })
  })

  // ==========================================================================
  // getEnvironmentMismatchReason
  // ==========================================================================
  describe("getEnvironmentMismatchReason", () => {
    it("should return null when condition matches", () => {
      const condition: EnvironmentCondition = {
        timeOfDay: { start: "09:00", end: "17:00" }
      }
      const context: EnvironmentContext = { currentTime: "12:00" }

      expect(getEnvironmentMismatchReason(condition, context)).toBeNull()
    })

    it("should return reason for time of day mismatch", () => {
      const condition: EnvironmentCondition = {
        timeOfDay: { start: "09:00", end: "17:00" }
      }
      const context: EnvironmentContext = { currentTime: "18:00" }

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("18:00")
      expect(reason).toContain("09:00")
      expect(reason).toContain("17:00")
    })

    it("should return reason for missing time", () => {
      const condition: EnvironmentCondition = {
        timeOfDay: { start: "09:00", end: "17:00" }
      }
      const context: EnvironmentContext = {}

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("time of day")
      expect(reason).toContain("no time")
    })

    it("should return reason for day of week mismatch", () => {
      const condition: EnvironmentCondition = {
        daysOfWeek: [1, 2, 3, 4, 5]
      }
      const context: EnvironmentContext = { currentDayOfWeek: 0 } // Sunday

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("Sunday")
    })

    it("should return reason for missing day", () => {
      const condition: EnvironmentCondition = {
        daysOfWeek: [1, 2, 3, 4, 5]
      }
      const context: EnvironmentContext = {}

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("day of week")
      expect(reason).toContain("no day")
    })

    it("should return reason for IP not in allow list", () => {
      const condition: EnvironmentCondition = {
        ipAllowList: ["192.168.1.0/24"]
      }
      const context: EnvironmentContext = { ipAddress: "10.0.0.1" }

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("10.0.0.1")
      expect(reason).toContain("not in allowed list")
    })

    it("should return reason for IP in deny list", () => {
      const condition: EnvironmentCondition = {
        ipDenyList: ["192.168.1.0/24"]
      }
      const context: EnvironmentContext = { ipAddress: "192.168.1.100" }

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("192.168.1.100")
      expect(reason).toContain("deny list")
    })

    it("should return reason for missing IP when allow list specified", () => {
      const condition: EnvironmentCondition = {
        ipAllowList: ["192.168.1.0/24"]
      }
      const context: EnvironmentContext = {}

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("IP address")
      expect(reason).toContain("no IP")
    })

    it("should return reason for missing IP when deny list specified", () => {
      const condition: EnvironmentCondition = {
        ipDenyList: ["192.168.1.0/24"]
      }
      const context: EnvironmentContext = {}

      const reason = getEnvironmentMismatchReason(condition, context)
      expect(reason).toContain("IP address")
      expect(reason).toContain("no IP")
    })
  })
})
