/**
 * DomainErrors - Barrel file re-exporting all domain errors
 *
 * This file provides backward compatibility for imports from the centralized
 * Errors directory. All errors are now defined in their respective domain
 * directories and re-exported here.
 *
 * DEPRECATED: Import errors from their domain-specific files instead:
 * - organization/OrganizationErrors.ts
 * - company/CompanyErrors.ts
 * - accounting/AccountErrors.ts
 * - journal/JournalErrors.ts
 * - currency/CurrencyErrors.ts
 * - consolidation/ConsolidationErrors.ts
 * - reporting/ReportErrors.ts
 * - membership/MembershipErrors.ts
 * - authorization/AuthorizationErrors.ts
 * - shared/errors/SharedErrors.ts
 * - shared/errors/RepositoryError.ts
 *
 * @module Errors/DomainErrors
 */

// =============================================================================
// Organization Domain Errors
// =============================================================================

export {
  OrganizationNotFoundError,
  isOrganizationNotFoundError,
  InvalidOrganizationIdError,
  isInvalidOrganizationIdError,
  UserNotMemberOfOrganizationError,
  isUserNotMemberOfOrganizationError,
  OrganizationHasCompaniesError,
  isOrganizationHasCompaniesError,
  OrganizationNameAlreadyExistsError,
  isOrganizationNameAlreadyExistsError,
  OrganizationUpdateFailedError,
  isOrganizationUpdateFailedError,
  MembershipCreationFailedError,
  isMembershipCreationFailedError,
  SystemPolicySeedingFailedError,
  isSystemPolicySeedingFailedError
} from "../organization/OrganizationErrors.ts"

// =============================================================================
// Company Domain Errors
// =============================================================================

export {
  CompanyNotFoundError,
  isCompanyNotFoundError,
  InvalidCompanyIdError,
  isInvalidCompanyIdError,
  OwnershipPercentageRequiredError,
  isOwnershipPercentageRequiredError,
  ParentCompanyNotFoundError,
  isParentCompanyNotFoundError,
  CircularCompanyReferenceError,
  isCircularCompanyReferenceError,
  CompanyNameAlreadyExistsError,
  isCompanyNameAlreadyExistsError,
  HasActiveSubsidiariesError,
  isHasActiveSubsidiariesError
} from "../company/CompanyErrors.ts"

// =============================================================================
// Accounting Domain Errors
// =============================================================================

export {
  AccountNotFoundError,
  isAccountNotFoundError,
  ParentAccountNotFoundError,
  isParentAccountNotFoundError,
  AccountTemplateNotFoundError,
  isAccountTemplateNotFoundError,
  ParentAccountDifferentCompanyError,
  isParentAccountDifferentCompanyError,
  HasActiveChildAccountsError,
  isHasActiveChildAccountsError,
  AccountNumberAlreadyExistsError,
  isAccountNumberAlreadyExistsError,
  CircularAccountReferenceError,
  isCircularAccountReferenceError,
  AccountsAlreadyExistError,
  isAccountsAlreadyExistError
} from "../accounting/AccountErrors.ts"

// =============================================================================
// Journal Domain Errors
// =============================================================================

export {
  JournalEntryNotFoundError,
  isJournalEntryNotFoundError,
  UnbalancedJournalEntryError,
  isUnbalancedJournalEntryError,
  JournalEntryStatusError,
  isJournalEntryStatusError,
  JournalEntryAlreadyReversedError,
  isJournalEntryAlreadyReversedError
} from "../journal/JournalErrors.ts"

// =============================================================================
// Currency Domain Errors
// =============================================================================

export {
  ExchangeRateNotFoundError,
  isExchangeRateNotFoundError,
  SameCurrencyExchangeRateError,
  isSameCurrencyExchangeRateError,
  InvalidExchangeRateError,
  isInvalidExchangeRateError,
  ExchangeRateAlreadyExistsError,
  isExchangeRateAlreadyExistsError
} from "../currency/CurrencyErrors.ts"

// =============================================================================
// Consolidation Domain Errors
// =============================================================================

export {
  IntercompanyTransactionNotFoundError,
  isIntercompanyTransactionNotFoundError,
  ConsolidationGroupNotFoundError,
  isConsolidationGroupNotFoundError,
  ConsolidationRunNotFoundError,
  isConsolidationRunNotFoundError,
  ConsolidationMemberNotFoundError,
  isConsolidationMemberNotFoundError,
  EliminationRuleNotFoundError,
  isEliminationRuleNotFoundError,
  SameCompanyIntercompanyError,
  isSameCompanyIntercompanyError,
  ConsolidationMemberAlreadyExistsError,
  isConsolidationMemberAlreadyExistsError,
  ConsolidationRunExistsForPeriodError,
  isConsolidationRunExistsForPeriodError,
  ConsolidationGroupHasCompletedRunsError,
  isConsolidationGroupHasCompletedRunsError,
  ConsolidationGroupInactiveError,
  isConsolidationGroupInactiveError,
  ConsolidationRunInProgressError,
  isConsolidationRunInProgressError,
  ConsolidationGroupDeleteNotSupportedError,
  isConsolidationGroupDeleteNotSupportedError,
  ConsolidationRunCannotBeCancelledError,
  isConsolidationRunCannotBeCancelledError,
  ConsolidationRunCannotBeDeletedError,
  isConsolidationRunCannotBeDeletedError,
  ConsolidationRunNotCompletedError,
  isConsolidationRunNotCompletedError,
  ConsolidatedTrialBalanceNotAvailableError,
  isConsolidatedTrialBalanceNotAvailableError,
  ConsolidatedBalanceSheetNotBalancedError,
  isConsolidatedBalanceSheetNotBalancedError,
  IntercompanyTransactionCannotBeDeletedError,
  isIntercompanyTransactionCannotBeDeletedError,
  EliminationRuleOperationFailedError,
  isEliminationRuleOperationFailedError,
  ConsolidationReportGenerationError,
  isConsolidationReportGenerationError
} from "../consolidation/ConsolidationErrors.ts"

// =============================================================================
// Reporting Domain Errors
// =============================================================================

export {
  InvalidReportPeriodError,
  isInvalidReportPeriodError,
  TrialBalanceNotBalancedError,
  isTrialBalanceNotBalancedError,
  BalanceSheetNotBalancedError,
  isBalanceSheetNotBalancedError
} from "../reporting/ReportErrors.ts"

// =============================================================================
// Membership Domain Errors
// =============================================================================

export {
  MemberNotFoundError,
  isMemberNotFoundError,
  InvitationNotFoundError,
  isInvitationNotFoundError,
  UserNotFoundByEmailError,
  isUserNotFoundByEmailError,
  InvalidInvitationIdError,
  isInvalidInvitationIdError,
  InvitationNotPendingError,
  isInvitationNotPendingError
} from "../membership/MembershipErrors.ts"

// =============================================================================
// Authorization Domain Errors
// =============================================================================

export {
  PolicyNotFoundError,
  isPolicyNotFoundError,
  InvalidPolicyIdError,
  isInvalidPolicyIdError,
  InvalidPolicyConditionError,
  isInvalidPolicyConditionError,
  PolicyPriorityValidationError,
  isPolicyPriorityValidationError,
  InvalidResourceTypeError,
  isInvalidResourceTypeError,
  PolicyAlreadyExistsError,
  isPolicyAlreadyExistsError,
  SystemPolicyCannotBeModifiedError,
  isSystemPolicyCannotBeModifiedError
} from "../authorization/AuthorizationErrors.ts"

// =============================================================================
// Shared Errors
// =============================================================================

export {
  DataCorruptionError,
  isDataCorruptionError,
  OperationFailedError,
  isOperationFailedError
} from "../shared/errors/SharedErrors.ts"
