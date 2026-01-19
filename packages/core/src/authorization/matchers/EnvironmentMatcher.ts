/**
 * EnvironmentMatcher - Matches request context against environment conditions
 *
 * This module provides functions to match request context against an EnvironmentCondition
 * in ABAC policy evaluation.
 *
 * Matching supports:
 * - timeOfDay: Current time must be within the specified range
 * - daysOfWeek: Current day must be in the specified list (0=Sunday, 6=Saturday)
 * - ipAllowList: Request IP must match one of the allowed IPs/CIDRs
 * - ipDenyList: Request IP must NOT match any of the denied IPs/CIDRs
 *
 * All specified conditions are combined with AND logic (all must match).
 * If a condition field is undefined, it is not checked (passes).
 *
 * @module EnvironmentMatcher
 */

import type { EnvironmentCondition, TimeRange } from "../PolicyConditions.ts"

/**
 * Environment context for matching - represents the request context
 *
 * This interface defines the contextual attributes that can be matched against
 * EnvironmentCondition.
 */
export interface EnvironmentContext {
  /**
   * Current time of day in HH:MM format (24-hour)
   */
  readonly currentTime?: string

  /**
   * Current day of week (0=Sunday, 6=Saturday)
   */
  readonly currentDayOfWeek?: number

  /**
   * IP address of the request
   */
  readonly ipAddress?: string
}

/**
 * Creates an EnvironmentContext from the current date/time and request info
 *
 * @param date - The current date (defaults to now)
 * @param ipAddress - The IP address of the request
 * @returns EnvironmentContext for policy matching
 *
 * @example
 * ```ts
 * const context = createEnvironmentContext(new Date(), "192.168.1.100")
 * matchesEnvironmentCondition(condition, context)
 * ```
 */
export const createEnvironmentContext = (
  date: Date = new Date(),
  ipAddress?: string
): EnvironmentContext => {
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

  const context: EnvironmentContext = {
    currentTime: `${hours}:${minutes}`,
    currentDayOfWeek: date.getDay()
  }

  if (ipAddress !== undefined) {
    return { ...context, ipAddress }
  }

  return context
}

/**
 * Parses a time string in HH:MM format to minutes since midnight
 *
 * @param time - Time string in HH:MM format
 * @returns Minutes since midnight
 *
 * @example
 * ```ts
 * parseTimeToMinutes("09:30") // 570
 * parseTimeToMinutes("17:00") // 1020
 * ```
 */
export const parseTimeToMinutes = (time: string): number => {
  const [hoursStr, minutesStr] = time.split(":")
  const hours = parseInt(hoursStr ?? "0", 10)
  const minutes = parseInt(minutesStr ?? "0", 10)
  return hours * 60 + minutes
}

/**
 * Checks if a time is within a time range
 *
 * Supports both normal ranges (09:00 to 17:00) and overnight ranges (22:00 to 06:00).
 *
 * @param timeRange - The time range to check against
 * @param currentTime - The current time in HH:MM format
 * @returns true if the current time is within the range
 *
 * @example
 * ```ts
 * // Normal range (9am to 5pm)
 * matchesTimeOfDay({ start: "09:00", end: "17:00" }, "12:00") // true
 * matchesTimeOfDay({ start: "09:00", end: "17:00" }, "18:00") // false
 *
 * // Overnight range (10pm to 6am)
 * matchesTimeOfDay({ start: "22:00", end: "06:00" }, "23:00") // true
 * matchesTimeOfDay({ start: "22:00", end: "06:00" }, "03:00") // true
 * matchesTimeOfDay({ start: "22:00", end: "06:00" }, "12:00") // false
 * ```
 */
export const matchesTimeOfDay = (
  timeRange: typeof TimeRange.Type,
  currentTime: string
): boolean => {
  const startMinutes = parseTimeToMinutes(timeRange.start)
  const endMinutes = parseTimeToMinutes(timeRange.end)
  const currentMinutes = parseTimeToMinutes(currentTime)

  // Check if the range spans overnight (e.g., 22:00 to 06:00)
  if (startMinutes <= endMinutes) {
    // Normal range (e.g., 09:00 to 17:00)
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  } else {
    // Overnight range (e.g., 22:00 to 06:00)
    // Current time is valid if it's after start OR before end
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }
}

/**
 * Checks if a day of week is in the allowed list
 *
 * @param allowedDays - The allowed days of week (0=Sunday, 6=Saturday)
 * @param currentDay - The current day of week
 * @returns true if the current day is in the allowed list
 *
 * @example
 * ```ts
 * matchesDayOfWeek([1, 2, 3, 4, 5], 3) // true (Wednesday is a weekday)
 * matchesDayOfWeek([1, 2, 3, 4, 5], 0) // false (Sunday is not a weekday)
 * matchesDayOfWeek([0, 6], 6) // true (Saturday is a weekend)
 * ```
 */
export const matchesDayOfWeek = (
  allowedDays: readonly number[],
  currentDay: number
): boolean => {
  return allowedDays.includes(currentDay)
}

/**
 * Parses a CIDR notation string into IP and prefix length
 *
 * @param cidr - CIDR string (e.g., "192.168.1.0/24" or "192.168.1.100")
 * @returns Object with IP and prefix length
 */
const parseCIDR = (cidr: string): { ip: string; prefixLength: number } => {
  const parts = cidr.split("/")
  const ip = parts[0] ?? ""
  const prefixLength = parts[1] !== undefined ? parseInt(parts[1], 10) : 32
  return { ip, prefixLength }
}

/**
 * Converts an IPv4 address to a 32-bit number
 *
 * @param ip - IPv4 address string
 * @returns 32-bit number representation
 */
const ipToNumber = (ip: string): number => {
  const octets = ip.split(".")
  return octets.reduce((acc, octet) => {
    return (acc << 8) + parseInt(octet, 10)
  }, 0) >>> 0 // >>> 0 ensures unsigned 32-bit
}

/**
 * Checks if an IP address matches a CIDR pattern
 *
 * Supports both exact IP addresses and CIDR notation.
 *
 * @param pattern - IP address or CIDR pattern (e.g., "192.168.1.0/24")
 * @param ipAddress - The IP address to check
 * @returns true if the IP matches the pattern
 *
 * @example
 * ```ts
 * matchesIPPattern("192.168.1.100", "192.168.1.100") // true (exact match)
 * matchesIPPattern("192.168.1.0/24", "192.168.1.100") // true (in subnet)
 * matchesIPPattern("192.168.1.0/24", "192.168.2.100") // false (different subnet)
 * matchesIPPattern("10.0.0.0/8", "10.255.255.255") // true (class A network)
 * ```
 */
export const matchesIPPattern = (pattern: string, ipAddress: string): boolean => {
  // Handle IPv6 - basic support (exact match only for now)
  if (pattern.includes(":") || ipAddress.includes(":")) {
    // For IPv6, we only support exact match currently
    return pattern === ipAddress
  }

  const { ip: patternIP, prefixLength } = parseCIDR(pattern)
  const patternNum = ipToNumber(patternIP)
  const ipNum = ipToNumber(ipAddress)

  // Create subnet mask from prefix length
  // For prefix=24, mask is 0xFFFFFF00 (255.255.255.0)
  const mask = prefixLength === 0 ? 0 : ((0xffffffff << (32 - prefixLength)) >>> 0)

  // Check if the masked IP matches the masked pattern
  return (patternNum & mask) === (ipNum & mask)
}

/**
 * Checks if an IP address is in the allow list
 *
 * @param allowList - List of allowed IP addresses/CIDRs
 * @param ipAddress - The IP address to check
 * @returns true if the IP matches any entry in the allow list
 *
 * @example
 * ```ts
 * matchesIPAllowList(["192.168.1.0/24", "10.0.0.1"], "192.168.1.50") // true
 * matchesIPAllowList(["192.168.1.0/24", "10.0.0.1"], "172.16.0.1") // false
 * ```
 */
export const matchesIPAllowList = (
  allowList: readonly string[],
  ipAddress: string
): boolean => {
  return allowList.some((pattern) => matchesIPPattern(pattern, ipAddress))
}

/**
 * Checks if an IP address is NOT in the deny list
 *
 * @param denyList - List of denied IP addresses/CIDRs
 * @param ipAddress - The IP address to check
 * @returns true if the IP does NOT match any entry in the deny list
 *
 * @example
 * ```ts
 * matchesIPDenyList(["192.168.1.0/24"], "10.0.0.1") // true (not in deny list)
 * matchesIPDenyList(["192.168.1.0/24"], "192.168.1.50") // false (in deny list)
 * ```
 */
export const matchesIPDenyList = (
  denyList: readonly string[],
  ipAddress: string
): boolean => {
  // Returns true if the IP is NOT in the deny list
  return !denyList.some((pattern) => matchesIPPattern(pattern, ipAddress))
}

/**
 * Checks if the request context matches an EnvironmentCondition
 *
 * All specified conditions are combined with AND logic:
 * - If timeOfDay is specified, the current time must be within the range
 * - If daysOfWeek is specified, the current day must be in the list
 * - If ipAllowList is specified, the request IP must match one entry
 * - If ipDenyList is specified, the request IP must NOT match any entry
 *
 * Undefined/empty conditions are treated as "match any" (they pass).
 *
 * @param condition - The EnvironmentCondition to match against
 * @param context - The request context to test
 * @returns true if the context matches all specified conditions
 *
 * @example
 * ```ts
 * const condition: EnvironmentCondition = {
 *   timeOfDay: { start: "09:00", end: "17:00" },
 *   daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
 * }
 * const context: EnvironmentContext = {
 *   currentTime: "12:00",
 *   currentDayOfWeek: 3 // Wednesday
 * }
 * matchesEnvironmentCondition(condition, context) // true
 *
 * const weekendContext: EnvironmentContext = {
 *   currentTime: "12:00",
 *   currentDayOfWeek: 0 // Sunday
 * }
 * matchesEnvironmentCondition(condition, weekendContext) // false
 * ```
 */
export const matchesEnvironmentCondition = (
  condition: EnvironmentCondition,
  context: EnvironmentContext
): boolean => {
  // Check time of day condition (if specified)
  if (condition.timeOfDay !== undefined) {
    if (context.currentTime === undefined) {
      return false // Condition specified but context has no time
    }
    if (!matchesTimeOfDay(condition.timeOfDay, context.currentTime)) {
      return false
    }
  }

  // Check days of week condition (if specified)
  if (condition.daysOfWeek !== undefined && condition.daysOfWeek.length > 0) {
    if (context.currentDayOfWeek === undefined) {
      return false // Condition specified but context has no day
    }
    if (!matchesDayOfWeek(condition.daysOfWeek, context.currentDayOfWeek)) {
      return false
    }
  }

  // Check IP allow list condition (if specified)
  if (condition.ipAllowList !== undefined && condition.ipAllowList.length > 0) {
    if (context.ipAddress === undefined) {
      return false // Condition specified but context has no IP
    }
    if (!matchesIPAllowList(condition.ipAllowList, context.ipAddress)) {
      return false
    }
  }

  // Check IP deny list condition (if specified)
  if (condition.ipDenyList !== undefined && condition.ipDenyList.length > 0) {
    if (context.ipAddress === undefined) {
      return false // Condition specified but context has no IP
    }
    if (!matchesIPDenyList(condition.ipDenyList, context.ipAddress)) {
      return false
    }
  }

  // All conditions passed (or were not specified)
  return true
}

/**
 * Checks if the request context matches any of multiple EnvironmentConditions
 *
 * @param conditions - The EnvironmentConditions to match against
 * @param context - The request context to test
 * @returns true if the context matches at least one condition
 */
export const matchesAnyEnvironmentCondition = (
  conditions: readonly EnvironmentCondition[],
  context: EnvironmentContext
): boolean => {
  return conditions.some((condition) => matchesEnvironmentCondition(condition, context))
}

/**
 * Checks if the request context matches all of multiple EnvironmentConditions
 *
 * @param conditions - The EnvironmentConditions to match against
 * @param context - The request context to test
 * @returns true if the context matches all conditions
 */
export const matchesAllEnvironmentConditions = (
  conditions: readonly EnvironmentCondition[],
  context: EnvironmentContext
): boolean => {
  return conditions.every((condition) => matchesEnvironmentCondition(condition, context))
}

/**
 * Gets a human-readable description of why a context does not match a condition
 *
 * @param condition - The EnvironmentCondition that failed to match
 * @param context - The request context that was tested
 * @returns A string describing why the match failed, or null if it matched
 */
export const getEnvironmentMismatchReason = (
  condition: EnvironmentCondition,
  context: EnvironmentContext
): string | null => {
  // Check time of day condition
  if (condition.timeOfDay !== undefined) {
    if (context.currentTime === undefined) {
      return "Condition requires time of day but context has no time"
    }
    if (!matchesTimeOfDay(condition.timeOfDay, context.currentTime)) {
      return `Current time '${context.currentTime}' is not within allowed range ${condition.timeOfDay.start} to ${condition.timeOfDay.end}`
    }
  }

  // Check days of week condition
  if (condition.daysOfWeek !== undefined && condition.daysOfWeek.length > 0) {
    if (context.currentDayOfWeek === undefined) {
      return "Condition requires day of week but context has no day"
    }
    if (!matchesDayOfWeek(condition.daysOfWeek, context.currentDayOfWeek)) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const currentDayName = dayNames[context.currentDayOfWeek] ?? context.currentDayOfWeek.toString()
      const allowedDayNames = condition.daysOfWeek.map((d) => dayNames[d] ?? d.toString()).join(", ")
      return `Current day '${currentDayName}' is not in allowed days: [${allowedDayNames}]`
    }
  }

  // Check IP allow list condition
  if (condition.ipAllowList !== undefined && condition.ipAllowList.length > 0) {
    if (context.ipAddress === undefined) {
      return "Condition requires IP address but context has no IP"
    }
    if (!matchesIPAllowList(condition.ipAllowList, context.ipAddress)) {
      return `IP address '${context.ipAddress}' is not in allowed list: [${condition.ipAllowList.join(", ")}]`
    }
  }

  // Check IP deny list condition
  if (condition.ipDenyList !== undefined && condition.ipDenyList.length > 0) {
    if (context.ipAddress === undefined) {
      return "Condition requires IP address but context has no IP"
    }
    if (!matchesIPDenyList(condition.ipDenyList, context.ipAddress)) {
      return `IP address '${context.ipAddress}' is in deny list: [${condition.ipDenyList.join(", ")}]`
    }
  }

  // All conditions passed
  return null
}
