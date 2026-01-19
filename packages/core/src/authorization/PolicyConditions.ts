/**
 * PolicyConditions - Re-export from canonical location
 *
 * This file provides the new import path for PolicyConditions schemas
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/PolicyConditions
 */

export {
  // Subject conditions
  SubjectCondition,
  type SubjectCondition as SubjectConditionType,
  isSubjectCondition,

  // Resource conditions
  AccountNumberCondition,
  AccountTypeCondition,
  JournalEntryTypeCondition,
  PeriodStatusCondition,
  ResourceAttributes,
  type ResourceAttributes as ResourceAttributesType,
  PolicyResourceType,
  ResourceCondition,
  type ResourceCondition as ResourceConditionType,
  isResourceCondition,

  // Action conditions
  ActionCondition,
  type ActionCondition as ActionConditionType,
  isActionCondition,

  // Environment conditions
  TimeRange,
  EnvironmentCondition,
  type EnvironmentCondition as EnvironmentConditionType,
  isEnvironmentCondition
} from "../Auth/PolicyConditions.ts"
