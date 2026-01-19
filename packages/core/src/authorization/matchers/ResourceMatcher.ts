/**
 * ResourceMatcher - Matches resources against resource conditions
 *
 * This module provides functions to match a resource against a ResourceCondition
 * in ABAC policy evaluation.
 *
 * Matching supports:
 * - type: Resource type must match or condition type is "*"
 * - attributes.accountNumber.range: Account number must be within [min, max]
 * - attributes.accountNumber.in: Account number must be in specific list
 * - attributes.accountType: Account type must be in list
 * - attributes.isIntercompany: Intercompany flag must match
 * - attributes.entryType: Journal entry type must be in list
 * - attributes.isOwnEntry: Entry creator check
 * - attributes.periodStatus: Period status must be in list
 * - attributes.isAdjustmentPeriod: Adjustment period flag must match
 *
 * All specified attribute conditions are combined with AND logic (all must match).
 * If an attribute condition is undefined, it is not checked (passes).
 *
 * @module ResourceMatcher
 */

import type {
  ResourceCondition,
  ResourceAttributes
} from "../PolicyConditions.ts"
import type {
  AccountNumberCondition,
  AccountTypeCondition,
  JournalEntryTypeCondition,
  PeriodStatusCondition
} from "../PolicyConditions.ts"

/**
 * Resource type string union for matching
 */
export type ResourceType =
  | "organization"
  | "company"
  | "account"
  | "journal_entry"
  | "fiscal_period"
  | "consolidation_group"
  | "report"

/**
 * Account type union for resource matching
 * Derived from the Schema type for consistency
 */
export type AccountType = typeof AccountTypeCondition.Type

/**
 * Journal entry type union for resource matching
 * Derived from the Schema type for consistency
 */
export type JournalEntryType = typeof JournalEntryTypeCondition.Type

/**
 * Period status union for resource matching
 * Derived from the Schema type for consistency
 */
export type PeriodStatus = typeof PeriodStatusCondition.Type

/**
 * Resource context for matching - represents the resource being accessed
 *
 * This interface defines all the attributes that can be matched against
 * ResourceCondition. Not all fields are required - only those relevant
 * to the resource type.
 */
export interface ResourceContext {
  /**
   * The type of resource being accessed
   */
  readonly type: ResourceType

  /**
   * The resource's unique identifier (optional, for audit/logging)
   */
  readonly id?: string

  /**
   * Account number (for account resources)
   */
  readonly accountNumber?: number

  /**
   * Account type (for account resources)
   */
  readonly accountType?: AccountType

  /**
   * Whether the resource is related to intercompany transactions
   */
  readonly isIntercompany?: boolean

  /**
   * Journal entry type (for journal_entry resources)
   */
  readonly entryType?: JournalEntryType

  /**
   * Whether the journal entry was created by the requesting user
   */
  readonly isOwnEntry?: boolean

  /**
   * Fiscal period status (for fiscal_period or journal_entry resources)
   */
  readonly periodStatus?: PeriodStatus

  /**
   * Whether this is an adjustment period
   */
  readonly isAdjustmentPeriod?: boolean
}

/**
 * Checks if a resource type matches a condition type
 *
 * @param conditionType - The type from the condition (may be "*" for any)
 * @param resourceType - The actual resource type
 * @returns true if the types match or condition is wildcard
 *
 * @example
 * ```ts
 * matchesResourceType("*", "account") // true
 * matchesResourceType("account", "account") // true
 * matchesResourceType("company", "account") // false
 * ```
 */
export const matchesResourceType = (
  conditionType: ResourceCondition["type"],
  resourceType: ResourceType
): boolean => {
  // Wildcard matches any resource type
  if (conditionType === "*") {
    return true
  }

  return conditionType === resourceType
}

/**
 * Checks if an account number matches an account number condition
 *
 * @param condition - The AccountNumberCondition to match against
 * @param accountNumber - The actual account number
 * @returns true if the account number matches the condition
 *
 * @example
 * ```ts
 * matchesAccountNumberCondition({ range: [1000, 1999] }, 1500) // true
 * matchesAccountNumberCondition({ range: [1000, 1999] }, 2000) // false
 * matchesAccountNumberCondition({ in: [1000, 1100, 1200] }, 1100) // true
 * ```
 */
export const matchesAccountNumberCondition = (
  condition: typeof AccountNumberCondition.Type,
  accountNumber: number
): boolean => {
  // Check range condition (if specified)
  if (condition.range !== undefined) {
    const [min, max] = condition.range
    if (accountNumber < min || accountNumber > max) {
      return false
    }
  }

  // Check in condition (if specified)
  if (condition.in !== undefined && condition.in.length > 0) {
    if (!condition.in.includes(accountNumber)) {
      return false
    }
  }

  return true
}

/**
 * Checks if an account type matches a condition
 *
 * @param allowedTypes - The allowed account types from the condition
 * @param accountType - The actual account type
 * @returns true if the account type is in the allowed list
 *
 * @example
 * ```ts
 * matchesAccountType(["Asset", "Liability"], "Asset") // true
 * matchesAccountType(["Asset", "Liability"], "Revenue") // false
 * ```
 */
export const matchesAccountType = (
  allowedTypes: ReadonlyArray<AccountType>,
  accountType: AccountType
): boolean => {
  return allowedTypes.includes(accountType)
}

/**
 * Checks if a journal entry type matches a condition
 *
 * @param allowedTypes - The allowed entry types from the condition
 * @param entryType - The actual entry type
 * @returns true if the entry type is in the allowed list
 *
 * @example
 * ```ts
 * matchesEntryType(["Standard", "Adjusting"], "Standard") // true
 * matchesEntryType(["Standard", "Adjusting"], "Closing") // false
 * ```
 */
export const matchesEntryType = (
  allowedTypes: ReadonlyArray<JournalEntryType>,
  entryType: JournalEntryType
): boolean => {
  return allowedTypes.includes(entryType)
}

/**
 * Checks if a period status matches a condition
 *
 * @param allowedStatuses - The allowed period statuses from the condition
 * @param periodStatus - The actual period status
 * @returns true if the period status is in the allowed list
 *
 * @example
 * ```ts
 * matchesPeriodStatus(["Open", "SoftClose"], "Open") // true
 * matchesPeriodStatus(["Open", "SoftClose"], "Locked") // false
 * ```
 */
export const matchesPeriodStatus = (
  allowedStatuses: ReadonlyArray<PeriodStatus>,
  periodStatus: PeriodStatus
): boolean => {
  return allowedStatuses.includes(periodStatus)
}

/**
 * Checks if a boolean attribute matches a condition
 *
 * @param required - The required value from the condition
 * @param actual - The actual value
 * @returns true if the values match
 *
 * @example
 * ```ts
 * matchesBooleanAttribute(true, true) // true
 * matchesBooleanAttribute(true, false) // false
 * ```
 */
export const matchesBooleanAttribute = (
  required: boolean,
  actual: boolean
): boolean => {
  return required === actual
}

/**
 * Checks if a resource matches the attributes portion of a ResourceCondition
 *
 * All specified attributes are combined with AND logic:
 * - If a condition attribute is specified, the resource must match
 * - If a condition attribute is not specified, it passes
 *
 * @param attributes - The ResourceAttributes to match against
 * @param resource - The resource context to test
 * @returns true if the resource matches all specified attribute conditions
 */
export const matchesResourceAttributes = (
  attributes: ResourceAttributes,
  resource: ResourceContext
): boolean => {
  // Check account number condition (if specified)
  if (attributes.accountNumber !== undefined) {
    if (resource.accountNumber === undefined) {
      return false // Condition specified but resource has no account number
    }
    if (!matchesAccountNumberCondition(attributes.accountNumber, resource.accountNumber)) {
      return false
    }
  }

  // Check account type condition (if specified)
  if (attributes.accountType !== undefined && attributes.accountType.length > 0) {
    if (resource.accountType === undefined) {
      return false // Condition specified but resource has no account type
    }
    if (!matchesAccountType(attributes.accountType, resource.accountType)) {
      return false
    }
  }

  // Check intercompany flag (if specified)
  if (attributes.isIntercompany !== undefined) {
    if (resource.isIntercompany === undefined) {
      return false // Condition specified but resource has no intercompany flag
    }
    if (!matchesBooleanAttribute(attributes.isIntercompany, resource.isIntercompany)) {
      return false
    }
  }

  // Check entry type condition (if specified)
  if (attributes.entryType !== undefined && attributes.entryType.length > 0) {
    if (resource.entryType === undefined) {
      return false // Condition specified but resource has no entry type
    }
    if (!matchesEntryType(attributes.entryType, resource.entryType)) {
      return false
    }
  }

  // Check own entry flag (if specified)
  if (attributes.isOwnEntry !== undefined) {
    if (resource.isOwnEntry === undefined) {
      return false // Condition specified but resource has no own entry flag
    }
    if (!matchesBooleanAttribute(attributes.isOwnEntry, resource.isOwnEntry)) {
      return false
    }
  }

  // Check period status condition (if specified)
  if (attributes.periodStatus !== undefined && attributes.periodStatus.length > 0) {
    if (resource.periodStatus === undefined) {
      return false // Condition specified but resource has no period status
    }
    if (!matchesPeriodStatus(attributes.periodStatus, resource.periodStatus)) {
      return false
    }
  }

  // Check adjustment period flag (if specified)
  if (attributes.isAdjustmentPeriod !== undefined) {
    if (resource.isAdjustmentPeriod === undefined) {
      return false // Condition specified but resource has no adjustment period flag
    }
    if (!matchesBooleanAttribute(attributes.isAdjustmentPeriod, resource.isAdjustmentPeriod)) {
      return false
    }
  }

  // All specified attribute conditions passed
  return true
}

/**
 * Checks if a resource matches a ResourceCondition
 *
 * A resource matches if:
 * 1. The resource type matches (or condition type is "*")
 * 2. All specified attribute conditions match (if any)
 *
 * @param condition - The ResourceCondition to match against
 * @param resource - The resource context to test
 * @returns true if the resource matches the condition
 *
 * @example
 * ```ts
 * const condition: ResourceCondition = {
 *   type: "account",
 *   attributes: {
 *     accountType: ["Asset", "Liability"]
 *   }
 * }
 * const assetAccount: ResourceContext = {
 *   type: "account",
 *   accountType: "Asset"
 * }
 * matchesResourceCondition(condition, assetAccount) // true
 *
 * const wildcardCondition: ResourceCondition = { type: "*" }
 * matchesResourceCondition(wildcardCondition, assetAccount) // true
 * ```
 */
export const matchesResourceCondition = (
  condition: ResourceCondition,
  resource: ResourceContext
): boolean => {
  // First, check resource type
  if (!matchesResourceType(condition.type, resource.type)) {
    return false
  }

  // If attributes are specified, check them
  if (condition.attributes !== undefined) {
    if (!matchesResourceAttributes(condition.attributes, resource)) {
      return false
    }
  }

  // Resource matches the condition
  return true
}

/**
 * Checks if a resource matches any of multiple ResourceConditions
 *
 * @param conditions - The ResourceConditions to match against
 * @param resource - The resource context to test
 * @returns true if the resource matches at least one condition
 *
 * @example
 * ```ts
 * const conditions: ResourceCondition[] = [
 *   { type: "account" },
 *   { type: "journal_entry" }
 * ]
 * matchesAnyResourceCondition(conditions, { type: "account" }) // true
 * ```
 */
export const matchesAnyResourceCondition = (
  conditions: readonly ResourceCondition[],
  resource: ResourceContext
): boolean => {
  return conditions.some((condition) => matchesResourceCondition(condition, resource))
}

/**
 * Checks if a resource matches all of multiple ResourceConditions
 *
 * @param conditions - The ResourceConditions to match against
 * @param resource - The resource context to test
 * @returns true if the resource matches all conditions
 */
export const matchesAllResourceConditions = (
  conditions: readonly ResourceCondition[],
  resource: ResourceContext
): boolean => {
  return conditions.every((condition) => matchesResourceCondition(condition, resource))
}

/**
 * Gets a human-readable description of why a resource does not match a condition
 *
 * @param condition - The ResourceCondition that failed to match
 * @param resource - The resource context that was tested
 * @returns A string describing why the match failed, or null if it matched
 */
export const getResourceMismatchReason = (
  condition: ResourceCondition,
  resource: ResourceContext
): string | null => {
  // Check resource type
  if (!matchesResourceType(condition.type, resource.type)) {
    return `Resource type '${resource.type}' does not match condition type '${condition.type}'`
  }

  // Check attributes
  if (condition.attributes !== undefined) {
    const attrs = condition.attributes

    // Check account number
    if (attrs.accountNumber !== undefined) {
      if (resource.accountNumber === undefined) {
        return "Condition requires account number but resource has none"
      }
      if (!matchesAccountNumberCondition(attrs.accountNumber, resource.accountNumber)) {
        if (attrs.accountNumber.range !== undefined) {
          const [min, max] = attrs.accountNumber.range
          return `Account number ${resource.accountNumber} is not in range [${min}, ${max}]`
        }
        if (attrs.accountNumber.in !== undefined) {
          return `Account number ${resource.accountNumber} is not in allowed list: [${attrs.accountNumber.in.join(", ")}]`
        }
      }
    }

    // Check account type
    if (attrs.accountType !== undefined && attrs.accountType.length > 0) {
      if (resource.accountType === undefined) {
        return "Condition requires account type but resource has none"
      }
      if (!matchesAccountType(attrs.accountType, resource.accountType)) {
        return `Account type '${resource.accountType}' is not in allowed types: [${attrs.accountType.join(", ")}]`
      }
    }

    // Check intercompany flag
    if (attrs.isIntercompany !== undefined) {
      if (resource.isIntercompany === undefined) {
        return "Condition requires intercompany flag but resource has none"
      }
      if (!matchesBooleanAttribute(attrs.isIntercompany, resource.isIntercompany)) {
        const expected = attrs.isIntercompany ? "intercompany" : "non-intercompany"
        const actual = resource.isIntercompany ? "intercompany" : "non-intercompany"
        return `Resource is ${actual} but condition requires ${expected}`
      }
    }

    // Check entry type
    if (attrs.entryType !== undefined && attrs.entryType.length > 0) {
      if (resource.entryType === undefined) {
        return "Condition requires entry type but resource has none"
      }
      if (!matchesEntryType(attrs.entryType, resource.entryType)) {
        return `Entry type '${resource.entryType}' is not in allowed types: [${attrs.entryType.join(", ")}]`
      }
    }

    // Check own entry flag
    if (attrs.isOwnEntry !== undefined) {
      if (resource.isOwnEntry === undefined) {
        return "Condition requires own entry check but resource has no creator info"
      }
      if (!matchesBooleanAttribute(attrs.isOwnEntry, resource.isOwnEntry)) {
        const expected = attrs.isOwnEntry ? "own entry" : "other's entry"
        const actual = resource.isOwnEntry ? "own entry" : "other's entry"
        return `Resource is ${actual} but condition requires ${expected}`
      }
    }

    // Check period status
    if (attrs.periodStatus !== undefined && attrs.periodStatus.length > 0) {
      if (resource.periodStatus === undefined) {
        return "Condition requires period status but resource has none"
      }
      if (!matchesPeriodStatus(attrs.periodStatus, resource.periodStatus)) {
        return `Period status '${resource.periodStatus}' is not in allowed statuses: [${attrs.periodStatus.join(", ")}]`
      }
    }

    // Check adjustment period flag
    if (attrs.isAdjustmentPeriod !== undefined) {
      if (resource.isAdjustmentPeriod === undefined) {
        return "Condition requires adjustment period flag but resource has none"
      }
      if (!matchesBooleanAttribute(attrs.isAdjustmentPeriod, resource.isAdjustmentPeriod)) {
        const expected = attrs.isAdjustmentPeriod ? "adjustment period" : "regular period"
        const actual = resource.isAdjustmentPeriod ? "adjustment period" : "regular period"
        return `Resource is ${actual} but condition requires ${expected}`
      }
    }
  }

  // All conditions passed
  return null
}

/**
 * Helper to create a ResourceContext for an account
 *
 * @param params - The account parameters
 * @returns A ResourceContext for the account
 */
export const createAccountResourceContext = (params: {
  id?: string
  accountNumber?: number
  accountType?: AccountType
  isIntercompany?: boolean
}): ResourceContext => ({
  type: "account",
  ...params
})

/**
 * Helper to create a ResourceContext for a journal entry
 *
 * @param params - The journal entry parameters
 * @returns A ResourceContext for the journal entry
 */
export const createJournalEntryResourceContext = (params: {
  id?: string
  entryType?: JournalEntryType
  isOwnEntry?: boolean
  periodStatus?: PeriodStatus
}): ResourceContext => ({
  type: "journal_entry",
  ...params
})

/**
 * Helper to create a ResourceContext for a fiscal period
 *
 * @param params - The fiscal period parameters
 * @returns A ResourceContext for the fiscal period
 */
export const createFiscalPeriodResourceContext = (params: {
  id?: string
  periodStatus?: PeriodStatus
  isAdjustmentPeriod?: boolean
}): ResourceContext => ({
  type: "fiscal_period",
  ...params
})

/**
 * Helper to create a ResourceContext for a company
 *
 * @param params - The company parameters
 * @returns A ResourceContext for the company
 */
export const createCompanyResourceContext = (params: {
  id?: string
}): ResourceContext => ({
  type: "company",
  ...params
})

/**
 * Helper to create a ResourceContext for an organization
 *
 * @param params - The organization parameters
 * @returns A ResourceContext for the organization
 */
export const createOrganizationResourceContext = (params: {
  id?: string
}): ResourceContext => ({
  type: "organization",
  ...params
})

/**
 * Helper to create a ResourceContext for a consolidation group
 *
 * @param params - The consolidation group parameters
 * @returns A ResourceContext for the consolidation group
 */
export const createConsolidationGroupResourceContext = (params: {
  id?: string
}): ResourceContext => ({
  type: "consolidation_group",
  ...params
})

/**
 * Helper to create a ResourceContext for a report
 *
 * @param params - The report parameters
 * @returns A ResourceContext for the report
 */
export const createReportResourceContext = (params: {
  id?: string
}): ResourceContext => ({
  type: "report",
  ...params
})
