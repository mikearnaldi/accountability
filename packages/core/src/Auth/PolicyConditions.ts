/**
 * PolicyConditions - Re-export from canonical location
 *
 * This file re-exports PolicyConditions from the authorization domain
 * for backward compatibility. Import from @accountability/core/authorization/PolicyConditions
 * for new code.
 *
 * @deprecated Import from @accountability/core/authorization/PolicyConditions instead
 * @module Auth/PolicyConditions
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
} from "../authorization/PolicyConditions.ts"
