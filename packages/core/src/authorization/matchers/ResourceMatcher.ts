/**
 * ResourceMatcher - Re-export from canonical location
 *
 * This file provides the new import path for ResourceMatcher utilities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module authorization/matchers/ResourceMatcher
 */

export {
  type ResourceType,
  type AccountType,
  type JournalEntryType,
  type PeriodStatus,
  type ResourceContext,
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
} from "../../Auth/matchers/ResourceMatcher.ts"
