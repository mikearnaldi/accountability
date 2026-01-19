/**
 * AccountValidation - Validation functions for Account entities
 *
 * Provides comprehensive validation for accounts including:
 * - Account number range checks (1xxx=Assets, 2xxx=Liabilities, etc.)
 * - Normal balance validation (Assets=Debit, Liabilities=Credit, etc.)
 * - Intercompany configuration validation
 * - Cash flow category restrictions for balance sheet accounts
 *
 * All validation functions return Either with Schema.TaggedError for typed error handling.
 *
 * @module AccountValidation
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"
import * as Either from "effect/Either"
import * as Option from "effect/Option"
import type {
  Account} from "./Account.ts";
import {
  AccountId,
  AccountType,
  NormalBalance,
  CashFlowCategory,
  getNormalBalanceForType
} from "./Account.ts"
import { AccountNumber, getAccountType as getAccountTypeFromNumber } from "./AccountNumber.ts"
import { CompanyId } from "../company/Company.ts"

/**
 * Error for account number not matching expected range for account type
 *
 * Per specs/ACCOUNTING_RESEARCH.md:
 * - 1xxx: Assets
 * - 2xxx: Liabilities
 * - 3xxx: Equity
 * - 4xxx: Revenue
 * - 5xxx-7xxx: Expenses
 * - 8xxx: Other Income/Expense
 * - 9xxx: Special (allowed for any type)
 */
export class AccountNumberRangeError extends Schema.TaggedError<AccountNumberRangeError>()(
  "AccountNumberRangeError",
  {
    accountId: AccountId,
    accountNumber: AccountNumber,
    declaredType: AccountType,
    expectedType: Schema.Option(AccountType)
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return Option.match(this.expectedType, {
      onNone: () =>
        `Account ${this.accountId} has number ${this.accountNumber} which is in a special range (8xxx or 9xxx) but declared type ${this.declaredType}. Special range accounts can be of any type.`,
      onSome: (expected) =>
        `Account ${this.accountId} has number ${this.accountNumber} which should be type ${expected} but is declared as ${this.declaredType}`
    })
  }
}

/**
 * Type guard for AccountNumberRangeError
 */
export const isAccountNumberRangeError = Schema.is(AccountNumberRangeError)

/**
 * Error for normal balance not matching expected balance for account type
 *
 * Per double-entry bookkeeping:
 * - Assets: Debit balance
 * - Expenses: Debit balance
 * - Liabilities: Credit balance
 * - Equity: Credit balance
 * - Revenue: Credit balance
 */
export class NormalBalanceError extends Schema.TaggedError<NormalBalanceError>()(
  "NormalBalanceError",
  {
    accountId: AccountId,
    accountType: AccountType,
    declaredBalance: NormalBalance,
    expectedBalance: NormalBalance
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Account ${this.accountId} of type ${this.accountType} should have normal balance ${this.expectedBalance} but has ${this.declaredBalance}`
  }
}

/**
 * Type guard for NormalBalanceError
 */
export const isNormalBalanceError = Schema.is(NormalBalanceError)

/**
 * Error for intercompany account missing partner company
 *
 * Per specs/ACCOUNTING_RESEARCH.md, intercompany accounts must have a partner company set
 * to enable proper tracking and elimination during consolidation.
 */
export class IntercompanyPartnerMissingError extends Schema.TaggedError<IntercompanyPartnerMissingError>()(
  "IntercompanyPartnerMissingError",
  {
    accountId: AccountId
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Intercompany account ${this.accountId} does not have a partner company set`
  }
}

/**
 * Type guard for IntercompanyPartnerMissingError
 */
export const isIntercompanyPartnerMissingError = Schema.is(IntercompanyPartnerMissingError)

/**
 * Error for non-intercompany account having a partner company set
 *
 * This is the inverse validation - if an account is not marked as intercompany,
 * it should not have a partner company ID.
 */
export class UnexpectedIntercompanyPartnerError extends Schema.TaggedError<UnexpectedIntercompanyPartnerError>()(
  "UnexpectedIntercompanyPartnerError",
  {
    accountId: AccountId,
    partnerId: CompanyId
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Account ${this.accountId} is not an intercompany account but has partner company ${this.partnerId}`
  }
}

/**
 * Type guard for UnexpectedIntercompanyPartnerError
 */
export const isUnexpectedIntercompanyPartnerError = Schema.is(UnexpectedIntercompanyPartnerError)

/**
 * Error for cash flow category set on income statement account
 *
 * Per specs/ACCOUNTING_RESEARCH.md, cash flow category should only be set for balance sheet
 * accounts (Asset, Liability, Equity). Revenue and Expense accounts are income
 * statement accounts and should not have cash flow category.
 */
export class CashFlowCategoryOnIncomeStatementError extends Schema.TaggedError<CashFlowCategoryOnIncomeStatementError>()(
  "CashFlowCategoryOnIncomeStatementError",
  {
    accountId: AccountId,
    accountType: AccountType,
    cashFlowCategory: CashFlowCategory
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Account ${this.accountId} of type ${this.accountType} is an income statement account and should not have cash flow category ${this.cashFlowCategory}`
  }
}

/**
 * Type guard for CashFlowCategoryOnIncomeStatementError
 */
export const isCashFlowCategoryOnIncomeStatementError = Schema.is(CashFlowCategoryOnIncomeStatementError)

/**
 * Union of all account validation errors
 */
export type AccountValidationError =
  | AccountNumberRangeError
  | NormalBalanceError
  | IntercompanyPartnerMissingError
  | UnexpectedIntercompanyPartnerError
  | CashFlowCategoryOnIncomeStatementError

/**
 * Validate that account number is in the correct range for the declared account type
 *
 * Account Numbering Convention:
 * - 1xxx (1000-1999): Asset
 * - 2xxx (2000-2999): Liability
 * - 3xxx (3000-3999): Equity
 * - 4xxx (4000-4999): Revenue
 * - 5xxx-7xxx (5000-7999): Expense
 * - 8xxx (8000-8999): Other Income/Expense (can be any type)
 * - 9xxx (9000-9999): Special/Intercompany (can be any type)
 *
 * @param account The account to validate
 * @returns Either an error or the validated account
 */
export const validateAccountNumberRange = (
  account: Account
): Either.Either<Account, AccountNumberRangeError> => {
  const expectedType = getAccountTypeFromNumber(account.accountNumber)

  // If account is in 8xxx or 9xxx range, any type is allowed
  if (Option.isNone(expectedType)) {
    return Either.right(account)
  }

  // Check if declared type matches expected type from number range
  if (account.accountType === expectedType.value) {
    return Either.right(account)
  }

  return Either.left(
    new AccountNumberRangeError({
      accountId: account.id,
      accountNumber: account.accountNumber,
      declaredType: account.accountType,
      expectedType
    })
  )
}

/**
 * Validate that normal balance is correct for the account type
 *
 * Per double-entry bookkeeping rules:
 * - Assets: Debit balance (debits increase, credits decrease)
 * - Expenses: Debit balance (debits increase, credits decrease)
 * - Liabilities: Credit balance (credits increase, debits decrease)
 * - Equity: Credit balance (credits increase, debits decrease)
 * - Revenue: Credit balance (credits increase, debits decrease)
 *
 * Note: Contra accounts (e.g., Accumulated Depreciation) intentionally have
 * the opposite balance and will fail this validation. This is expected behavior
 * as contra accounts should be flagged for review.
 *
 * @param account The account to validate
 * @returns Either an error or the validated account
 */
export const validateNormalBalance = (
  account: Account
): Either.Either<Account, NormalBalanceError> => {
  const expectedBalance = getNormalBalanceForType(account.accountType)

  if (account.normalBalance === expectedBalance) {
    return Either.right(account)
  }

  return Either.left(
    new NormalBalanceError({
      accountId: account.id,
      accountType: account.accountType,
      declaredBalance: account.normalBalance,
      expectedBalance
    })
  )
}

/**
 * Validate intercompany configuration
 *
 * Rules:
 * 1. If isIntercompany is true, intercompanyPartnerId must be set
 * 2. If isIntercompany is false, intercompanyPartnerId should not be set
 *
 * @param account The account to validate
 * @returns Either an error or the validated account
 */
export const validateIntercompanyConfiguration = (
  account: Account
): Either.Either<Account, IntercompanyPartnerMissingError | UnexpectedIntercompanyPartnerError> => {
  if (account.isIntercompany) {
    // Intercompany accounts must have a partner
    if (Option.isNone(account.intercompanyPartnerId)) {
      return Either.left(
        new IntercompanyPartnerMissingError({
          accountId: account.id
        })
      )
    }
  } else {
    // Non-intercompany accounts should not have a partner
    if (Option.isSome(account.intercompanyPartnerId)) {
      return Either.left(
        new UnexpectedIntercompanyPartnerError({
          accountId: account.id,
          partnerId: account.intercompanyPartnerId.value
        })
      )
    }
  }

  return Either.right(account)
}

/**
 * Validate cash flow category is only set for balance sheet accounts
 *
 * Per specs/ACCOUNTING_RESEARCH.md, cash flow category (Operating, Investing, Financing, NonCash)
 * should only be set for balance sheet accounts (Asset, Liability, Equity).
 *
 * Revenue and Expense accounts are income statement accounts and their cash flow
 * impact is derived from their nature, not a separate category assignment.
 *
 * @param account The account to validate
 * @returns Either an error or the validated account
 */
export const validateCashFlowCategory = (
  account: Account
): Either.Either<Account, CashFlowCategoryOnIncomeStatementError> => {
  // If no cash flow category is set, validation passes
  if (Option.isNone(account.cashFlowCategory)) {
    return Either.right(account)
  }

  // Check if this is a balance sheet account
  const isBalanceSheet =
    account.accountType === "Asset" ||
    account.accountType === "Liability" ||
    account.accountType === "Equity"

  if (isBalanceSheet) {
    return Either.right(account)
  }

  // Income statement accounts (Revenue, Expense) should not have cash flow category
  return Either.left(
    new CashFlowCategoryOnIncomeStatementError({
      accountId: account.id,
      accountType: account.accountType,
      cashFlowCategory: account.cashFlowCategory.value
    })
  )
}

/**
 * Perform all validations on an account
 *
 * This function runs all validation checks and returns either the validated account
 * or an array of all validation errors found.
 *
 * Validations performed:
 * 1. Account number range validation
 * 2. Normal balance validation
 * 3. Intercompany configuration validation
 * 4. Cash flow category validation
 *
 * @param account The account to validate
 * @returns Either an array of errors or the validated account
 */
export const validateAccount = (
  account: Account
): Either.Either<Account, ReadonlyArray<AccountValidationError>> => {
  const errors: AccountValidationError[] = []

  // Run each validation and collect errors
  const numberRangeResult = validateAccountNumberRange(account)
  if (Either.isLeft(numberRangeResult)) {
    errors.push(numberRangeResult.left)
  }

  const normalBalanceResult = validateNormalBalance(account)
  if (Either.isLeft(normalBalanceResult)) {
    errors.push(normalBalanceResult.left)
  }

  const intercompanyResult = validateIntercompanyConfiguration(account)
  if (Either.isLeft(intercompanyResult)) {
    errors.push(intercompanyResult.left)
  }

  const cashFlowResult = validateCashFlowCategory(account)
  if (Either.isLeft(cashFlowResult)) {
    errors.push(cashFlowResult.left)
  }

  if (errors.length > 0) {
    return Either.left(errors)
  }

  return Either.right(account)
}

/**
 * Validate multiple accounts and collect all errors
 *
 * @param accounts Array of accounts to validate
 * @returns Either an array of all errors or the validated accounts
 */
export const validateAccounts = (
  accounts: ReadonlyArray<Account>
): Either.Either<ReadonlyArray<Account>, ReadonlyArray<AccountValidationError>> => {
  const allErrors: AccountValidationError[] = []

  for (const account of accounts) {
    const result = validateAccount(account)
    if (Either.isLeft(result)) {
      allErrors.push(...result.left)
    }
  }

  if (allErrors.length > 0) {
    return Either.left(allErrors)
  }

  return Either.right(accounts)
}

/**
 * Check if an account passes all validations
 *
 * @param account The account to check
 * @returns true if all validations pass, false otherwise
 */
export const isValidAccount = (account: Account): boolean => {
  return Either.isRight(validateAccount(account))
}

/**
 * Get validation errors for an account
 *
 * @param account The account to validate
 * @returns Array of validation errors (empty if valid)
 */
export const getValidationErrors = (account: Account): ReadonlyArray<AccountValidationError> => {
  const result = validateAccount(account)
  return Either.match(result, {
    onLeft: (errors) => errors,
    onRight: () => []
  })
}
