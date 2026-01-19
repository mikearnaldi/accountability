/**
 * SubjectMatcher - Re-export from canonical location
 *
 * This file provides the new import path for SubjectMatcher utilities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/matchers/SubjectMatcher
 */

export {
  type SubjectContext,
  createSubjectContextFromMembership,
  matchesRoles,
  matchesFunctionalRoles,
  matchesUserIds,
  matchesPlatformAdmin,
  matchesSubjectCondition,
  matchesAnySubjectCondition,
  matchesAllSubjectConditions,
  getSubjectMismatchReason
} from "../../Auth/matchers/SubjectMatcher.ts"
