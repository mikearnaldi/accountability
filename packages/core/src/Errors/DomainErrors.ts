/**
 * DomainErrors - Shared domain error types
 *
 * These errors are used across the entire codebase and include
 * HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * Following the one-layer error architecture from ERROR_DESIGN.md:
 * - Errors are defined once in the domain layer
 * - Errors flow through without transformation
 * - HTTP annotations ensure correct status codes
 *
 * @module DomainErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404)
// =============================================================================

/**
 * OrganizationNotFoundError - Organization does not exist
 */
export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>()(
  "OrganizationNotFoundError",
  {
    organizationId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Organization not found: ${this.organizationId}`
  }
}

export const isOrganizationNotFoundError = Schema.is(OrganizationNotFoundError)

/**
 * CompanyNotFoundError - Company does not exist
 */
export class CompanyNotFoundError extends Schema.TaggedError<CompanyNotFoundError>()(
  "CompanyNotFoundError",
  {
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Company not found: ${this.companyId}`
  }
}

export const isCompanyNotFoundError = Schema.is(CompanyNotFoundError)

/**
 * AccountNotFoundError - Account does not exist
 *
 * Note: Also defined in JournalEntryService for backwards compatibility.
 * Prefer importing from this module for new code.
 */
export class AccountNotFoundError extends Schema.TaggedError<AccountNotFoundError>()(
  "AccountNotFoundError",
  {
    accountId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Account not found: ${this.accountId}`
  }
}

export const isAccountNotFoundError = Schema.is(AccountNotFoundError)

/**
 * ParentAccountNotFoundError - Parent account reference does not exist
 */
export class ParentAccountNotFoundError extends Schema.TaggedError<ParentAccountNotFoundError>()(
  "ParentAccountNotFoundError",
  {
    parentAccountId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Parent account not found: ${this.parentAccountId}`
  }
}

export const isParentAccountNotFoundError = Schema.is(ParentAccountNotFoundError)

/**
 * JournalEntryNotFoundError - Journal entry does not exist
 */
export class JournalEntryNotFoundError extends Schema.TaggedError<JournalEntryNotFoundError>()(
  "JournalEntryNotFoundError",
  {
    entryId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Journal entry not found: ${this.entryId}`
  }
}

export const isJournalEntryNotFoundError = Schema.is(JournalEntryNotFoundError)

/**
 * ExchangeRateNotFoundError - Exchange rate does not exist
 */
export class ExchangeRateNotFoundError extends Schema.TaggedError<ExchangeRateNotFoundError>()(
  "ExchangeRateNotFoundError",
  {
    rateId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Exchange rate not found: ${this.rateId}`
  }
}

export const isExchangeRateNotFoundError = Schema.is(ExchangeRateNotFoundError)

/**
 * PolicyNotFoundError - Policy does not exist
 */
export class PolicyNotFoundError extends Schema.TaggedError<PolicyNotFoundError>()(
  "PolicyNotFoundError",
  {
    policyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Policy not found: ${this.policyId}`
  }
}

export const isPolicyNotFoundError = Schema.is(PolicyNotFoundError)

/**
 * InvitationNotFoundError - Invitation does not exist
 */
export class InvitationNotFoundError extends Schema.TaggedError<InvitationNotFoundError>()(
  "InvitationNotFoundError",
  {
    invitationId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Invitation not found: ${this.invitationId}`
  }
}

export const isInvitationNotFoundError = Schema.is(InvitationNotFoundError)

/**
 * IntercompanyTransactionNotFoundError - Intercompany transaction does not exist
 */
export class IntercompanyTransactionNotFoundError extends Schema.TaggedError<IntercompanyTransactionNotFoundError>()(
  "IntercompanyTransactionNotFoundError",
  {
    transactionId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Intercompany transaction not found: ${this.transactionId}`
  }
}

export const isIntercompanyTransactionNotFoundError = Schema.is(IntercompanyTransactionNotFoundError)

/**
 * ConsolidationRunNotFoundError - Consolidation run does not exist
 */
export class ConsolidationRunNotFoundError extends Schema.TaggedError<ConsolidationRunNotFoundError>()(
  "ConsolidationRunNotFoundError",
  {
    runId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Consolidation run not found: ${this.runId}`
  }
}

export const isConsolidationRunNotFoundError = Schema.is(ConsolidationRunNotFoundError)

/**
 * AccountTemplateNotFoundError - Account template does not exist
 */
export class AccountTemplateNotFoundError extends Schema.TaggedError<AccountTemplateNotFoundError>()(
  "AccountTemplateNotFoundError",
  {
    templateType: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Account template not found: ${this.templateType}`
  }
}

export const isAccountTemplateNotFoundError = Schema.is(AccountTemplateNotFoundError)

/**
 * MemberNotFoundError - Organization member does not exist
 */
export class MemberNotFoundError extends Schema.TaggedError<MemberNotFoundError>()(
  "MemberNotFoundError",
  {
    memberId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Member not found: ${this.memberId}`
  }
}

export const isMemberNotFoundError = Schema.is(MemberNotFoundError)

/**
 * UserNotFoundByEmailError - User with email does not exist
 */
export class UserNotFoundByEmailError extends Schema.TaggedError<UserNotFoundByEmailError>()(
  "UserNotFoundByEmailError",
  {
    email: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `User not found with email: ${this.email}`
  }
}

export const isUserNotFoundByEmailError = Schema.is(UserNotFoundByEmailError)

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * OwnershipPercentageRequiredError - Ownership percentage required for subsidiaries
 */
export class OwnershipPercentageRequiredError extends Schema.TaggedError<OwnershipPercentageRequiredError>()(
  "OwnershipPercentageRequiredError",
  {},
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return "Ownership percentage is required for subsidiaries"
  }
}

export const isOwnershipPercentageRequiredError = Schema.is(OwnershipPercentageRequiredError)

/**
 * InvalidOrganizationIdError - Invalid organization ID format
 */
export class InvalidOrganizationIdError extends Schema.TaggedError<InvalidOrganizationIdError>()(
  "InvalidOrganizationIdError",
  {
    value: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid organization ID format: ${this.value}`
  }
}

export const isInvalidOrganizationIdError = Schema.is(InvalidOrganizationIdError)

/**
 * InvalidCompanyIdError - Invalid company ID format
 */
export class InvalidCompanyIdError extends Schema.TaggedError<InvalidCompanyIdError>()(
  "InvalidCompanyIdError",
  {
    value: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid company ID format: ${this.value}`
  }
}

export const isInvalidCompanyIdError = Schema.is(InvalidCompanyIdError)

/**
 * InvalidPolicyConditionError - Invalid policy condition
 */
export class InvalidPolicyConditionError extends Schema.TaggedError<InvalidPolicyConditionError>()(
  "InvalidPolicyConditionError",
  {
    condition: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid policy condition '${this.condition}': ${this.reason}`
  }
}

export const isInvalidPolicyConditionError = Schema.is(InvalidPolicyConditionError)

/**
 * SameCurrencyExchangeRateError - Cannot create exchange rate between same currencies
 */
export class SameCurrencyExchangeRateError extends Schema.TaggedError<SameCurrencyExchangeRateError>()(
  "SameCurrencyExchangeRateError",
  {
    currency: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Cannot create exchange rate between same currency: ${this.currency}`
  }
}

export const isSameCurrencyExchangeRateError = Schema.is(SameCurrencyExchangeRateError)

/**
 * InvalidExchangeRateError - Invalid exchange rate value
 */
export class InvalidExchangeRateError extends Schema.TaggedError<InvalidExchangeRateError>()(
  "InvalidExchangeRateError",
  {
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid exchange rate: ${this.reason}`
  }
}

export const isInvalidExchangeRateError = Schema.is(InvalidExchangeRateError)

/**
 * SameCompanyIntercompanyError - Cannot create intercompany transaction between same company
 */
export class SameCompanyIntercompanyError extends Schema.TaggedError<SameCompanyIntercompanyError>()(
  "SameCompanyIntercompanyError",
  {
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Cannot create intercompany transaction between same company: ${this.companyId}`
  }
}

export const isSameCompanyIntercompanyError = Schema.is(SameCompanyIntercompanyError)

/**
 * ParentAccountDifferentCompanyError - Parent account must be in the same company
 */
export class ParentAccountDifferentCompanyError extends Schema.TaggedError<ParentAccountDifferentCompanyError>()(
  "ParentAccountDifferentCompanyError",
  {
    accountCompanyId: Schema.String,
    parentAccountCompanyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return "Parent account must be in the same company"
  }
}

export const isParentAccountDifferentCompanyError = Schema.is(ParentAccountDifferentCompanyError)

// =============================================================================
// Conflict Errors (409)
// =============================================================================

/**
 * OrganizationHasCompaniesError - Cannot delete organization with companies
 */
export class OrganizationHasCompaniesError extends Schema.TaggedError<OrganizationHasCompaniesError>()(
  "OrganizationHasCompaniesError",
  {
    organizationId: Schema.String,
    companyCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot delete organization with ${this.companyCount} companies. Delete or move companies first.`
  }
}

export const isOrganizationHasCompaniesError = Schema.is(OrganizationHasCompaniesError)

/**
 * ParentCompanyNotFoundError - Parent company reference not found
 */
export class ParentCompanyNotFoundError extends Schema.TaggedError<ParentCompanyNotFoundError>()(
  "ParentCompanyNotFoundError",
  {
    parentCompanyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Parent company not found: ${this.parentCompanyId}`
  }
}

export const isParentCompanyNotFoundError = Schema.is(ParentCompanyNotFoundError)

/**
 * CircularCompanyReferenceError - Circular reference in company hierarchy
 */
export class CircularCompanyReferenceError extends Schema.TaggedError<CircularCompanyReferenceError>()(
  "CircularCompanyReferenceError",
  {
    companyId: Schema.String,
    parentCompanyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Circular reference: setting ${this.parentCompanyId} as parent of ${this.companyId} would create a cycle`
  }
}

export const isCircularCompanyReferenceError = Schema.is(CircularCompanyReferenceError)

/**
 * HasActiveSubsidiariesError - Cannot deactivate company with active subsidiaries
 */
export class HasActiveSubsidiariesError extends Schema.TaggedError<HasActiveSubsidiariesError>()(
  "HasActiveSubsidiariesError",
  {
    companyId: Schema.String,
    subsidiaryCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot deactivate company with ${this.subsidiaryCount} active subsidiaries`
  }
}

export const isHasActiveSubsidiariesError = Schema.is(HasActiveSubsidiariesError)

/**
 * HasActiveChildAccountsError - Cannot deactivate account with active child accounts
 */
export class HasActiveChildAccountsError extends Schema.TaggedError<HasActiveChildAccountsError>()(
  "HasActiveChildAccountsError",
  {
    accountId: Schema.String,
    childCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot deactivate account with ${this.childCount} active child accounts`
  }
}

export const isHasActiveChildAccountsError = Schema.is(HasActiveChildAccountsError)

/**
 * AccountNumberAlreadyExistsError - Account number already exists in this company
 */
export class AccountNumberAlreadyExistsError extends Schema.TaggedError<AccountNumberAlreadyExistsError>()(
  "AccountNumberAlreadyExistsError",
  {
    accountNumber: Schema.String,
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Account number ${this.accountNumber} already exists in this company`
  }
}

export const isAccountNumberAlreadyExistsError = Schema.is(AccountNumberAlreadyExistsError)

/**
 * CircularAccountReferenceError - Circular reference in account hierarchy
 */
export class CircularAccountReferenceError extends Schema.TaggedError<CircularAccountReferenceError>()(
  "CircularAccountReferenceError",
  {
    accountId: Schema.String,
    parentAccountId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Circular reference: setting ${this.parentAccountId} as parent of ${this.accountId} would create a cycle`
  }
}

export const isCircularAccountReferenceError = Schema.is(CircularAccountReferenceError)

/**
 * AccountsAlreadyExistError - Company already has accounts (cannot apply template)
 */
export class AccountsAlreadyExistError extends Schema.TaggedError<AccountsAlreadyExistError>()(
  "AccountsAlreadyExistError",
  {
    companyId: Schema.String,
    accountCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Company already has ${this.accountCount} accounts. Cannot apply template to a company with existing accounts.`
  }
}

export const isAccountsAlreadyExistError = Schema.is(AccountsAlreadyExistError)

/**
 * PolicyAlreadyExistsError - Policy with same name already exists
 */
export class PolicyAlreadyExistsError extends Schema.TaggedError<PolicyAlreadyExistsError>()(
  "PolicyAlreadyExistsError",
  {
    name: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Policy with name '${this.name}' already exists`
  }
}

export const isPolicyAlreadyExistsError = Schema.is(PolicyAlreadyExistsError)

/**
 * SystemPolicyCannotBeModifiedError - System policies cannot be modified or deleted
 */
export class SystemPolicyCannotBeModifiedError extends Schema.TaggedError<SystemPolicyCannotBeModifiedError>()(
  "SystemPolicyCannotBeModifiedError",
  {
    policyId: Schema.String,
    operation: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `System policy ${this.policyId} cannot be ${this.operation}`
  }
}

export const isSystemPolicyCannotBeModifiedError = Schema.is(SystemPolicyCannotBeModifiedError)

/**
 * ExchangeRateAlreadyExistsError - Exchange rate for this currency pair already exists
 */
export class ExchangeRateAlreadyExistsError extends Schema.TaggedError<ExchangeRateAlreadyExistsError>()(
  "ExchangeRateAlreadyExistsError",
  {
    fromCurrency: Schema.String,
    toCurrency: Schema.String,
    effectiveDate: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Exchange rate from ${this.fromCurrency} to ${this.toCurrency} already exists for ${this.effectiveDate}`
  }
}

export const isExchangeRateAlreadyExistsError = Schema.is(ExchangeRateAlreadyExistsError)

// =============================================================================
// Business Rule Errors (422)
// =============================================================================

/**
 * MembershipCreationFailedError - Failed to create membership for organization creator
 */
export class MembershipCreationFailedError extends Schema.TaggedError<MembershipCreationFailedError>()(
  "MembershipCreationFailedError",
  {
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Failed to create owner membership: ${this.reason}`
  }
}

export const isMembershipCreationFailedError = Schema.is(MembershipCreationFailedError)

/**
 * SystemPolicySeedingFailedError - Failed to seed system policies for organization
 */
export class SystemPolicySeedingFailedError extends Schema.TaggedError<SystemPolicySeedingFailedError>()(
  "SystemPolicySeedingFailedError",
  {},
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return "Failed to seed system policies for organization"
  }
}

export const isSystemPolicySeedingFailedError = Schema.is(SystemPolicySeedingFailedError)

/**
 * InvitationNotPendingError - Invitation is not in pending state
 */
export class InvitationNotPendingError extends Schema.TaggedError<InvitationNotPendingError>()(
  "InvitationNotPendingError",
  {
    invitationId: Schema.String,
    currentStatus: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Invitation ${this.invitationId} is not pending (current status: ${this.currentStatus})`
  }
}

export const isInvitationNotPendingError = Schema.is(InvitationNotPendingError)

/**
 * ConsolidationGroupInactiveError - Consolidation group is not active
 */
export class ConsolidationGroupInactiveError extends Schema.TaggedError<ConsolidationGroupInactiveError>()(
  "ConsolidationGroupInactiveError",
  {
    groupId: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Consolidation group ${this.groupId} is not active`
  }
}

export const isConsolidationGroupInactiveError = Schema.is(ConsolidationGroupInactiveError)

/**
 * ConsolidationRunInProgressError - Consolidation run already in progress
 */
export class ConsolidationRunInProgressError extends Schema.TaggedError<ConsolidationRunInProgressError>()(
  "ConsolidationRunInProgressError",
  {
    groupId: Schema.String,
    existingRunId: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Consolidation run already in progress for group ${this.groupId}: ${this.existingRunId}`
  }
}

export const isConsolidationRunInProgressError = Schema.is(ConsolidationRunInProgressError)

// =============================================================================
// Internal Errors (500)
// =============================================================================

/**
 * DataCorruptionError - Data integrity violation detected
 */
export class DataCorruptionError extends Schema.TaggedError<DataCorruptionError>()(
  "DataCorruptionError",
  {
    entityType: Schema.String,
    entityId: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Data corruption detected for ${this.entityType} ${this.entityId}: ${this.reason}`
  }
}

export const isDataCorruptionError = Schema.is(DataCorruptionError)

/**
 * OperationFailedError - Generic operation failure (when specific error doesn't exist)
 */
export class OperationFailedError extends Schema.TaggedError<OperationFailedError>()(
  "OperationFailedError",
  {
    operation: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Operation '${this.operation}' failed: ${this.reason}`
  }
}

export const isOperationFailedError = Schema.is(OperationFailedError)
