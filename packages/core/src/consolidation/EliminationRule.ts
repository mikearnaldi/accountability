/**
 * EliminationRule - Entity for defining consolidation elimination rules
 *
 * Per ASC 810, elimination rules define how intercompany transactions and
 * balances are eliminated during consolidation. Each rule specifies:
 * - What type of elimination (e.g., intercompany receivable/payable)
 * - Which accounts to target (via AccountSelector)
 * - Where elimination entries post (debit and credit accounts)
 * - Whether to auto-process or require manual review
 *
 * Elimination Types per specs/ACCOUNTING_RESEARCH.md:
 * - IntercompanyReceivablePayable: Eliminate AR/AP between group companies
 * - IntercompanyRevenueExpense: Eliminate sales and corresponding COGS/expenses
 * - IntercompanyDividend: Eliminate dividends paid within group
 * - IntercompanyInvestment: Eliminate investment in subsidiary against equity
 * - UnrealizedProfitInventory: Eliminate profit on inventory still held
 * - UnrealizedProfitFixedAssets: Eliminate profit on fixed assets transferred
 *
 * Account Selectors:
 * - ById: Target specific account by ID
 * - ByRange: Target accounts within an account number range
 * - ByCategory: Target accounts by category classification
 *
 * @module EliminationRule
 */

import * as Schema from "effect/Schema"
import * as Chunk from "effect/Chunk"
import { AccountId, AccountCategory } from "../accounting/Account.ts"
import { AccountNumber } from "../accounting/AccountNumber.ts"
import { ConsolidationGroupId, EliminationRuleId } from "./ConsolidationGroup.ts"

/**
 * EliminationType - Classification of elimination rule types
 *
 * Per specs/ACCOUNTING_RESEARCH.md Elimination Types:
 * - IntercompanyReceivablePayable: Eliminate AR/AP between group companies
 * - IntercompanyRevenueExpense: Eliminate sales and corresponding COGS/expenses
 * - IntercompanyDividend: Eliminate dividends paid within group
 * - IntercompanyInvestment: Eliminate investment in subsidiary against equity
 * - UnrealizedProfitInventory: Eliminate profit on inventory still held
 * - UnrealizedProfitFixedAssets: Eliminate profit on fixed assets transferred
 */
export const EliminationType = Schema.Literal(
  "IntercompanyReceivablePayable",
  "IntercompanyRevenueExpense",
  "IntercompanyDividend",
  "IntercompanyInvestment",
  "UnrealizedProfitInventory",
  "UnrealizedProfitFixedAssets"
).annotations({
  identifier: "EliminationType",
  title: "Elimination Type",
  description: "Classification of the elimination rule type per ASC 810"
})

/**
 * The EliminationType type
 */
export type EliminationType = typeof EliminationType.Type

/**
 * Type guard for EliminationType using Schema.is
 */
export const isEliminationType = Schema.is(EliminationType)

/**
 * AccountSelectorById - Select account by specific account ID
 *
 * Used when targeting a specific, known account for elimination.
 */
export class AccountSelectorById extends Schema.TaggedClass<AccountSelectorById>()("ById", {
  /**
   * The specific account ID to target
   */
  accountId: AccountId
}) {}

/**
 * Type guard for AccountSelectorById using Schema.is
 */
export const isAccountSelectorById = Schema.is(AccountSelectorById)

/**
 * AccountSelectorByRange - Select accounts within an account number range
 *
 * Used when targeting multiple accounts based on their account numbers,
 * e.g., all accounts in range 9000-9099 for intercompany accounts.
 */
export class AccountSelectorByRange extends Schema.TaggedClass<AccountSelectorByRange>()("ByRange", {
  /**
   * The starting account number (inclusive)
   */
  fromAccountNumber: AccountNumber,

  /**
   * The ending account number (inclusive)
   */
  toAccountNumber: AccountNumber
}) {
  /**
   * Check if an account number falls within this range
   */
  isInRange(accountNumber: AccountNumber): boolean {
    return accountNumber >= this.fromAccountNumber && accountNumber <= this.toAccountNumber
  }
}

/**
 * Type guard for AccountSelectorByRange using Schema.is
 */
export const isAccountSelectorByRange = Schema.is(AccountSelectorByRange)

/**
 * AccountSelectorByCategory - Select accounts by category classification
 *
 * Used when targeting all accounts of a specific category,
 * e.g., all CurrentAsset or CurrentLiability accounts.
 */
export class AccountSelectorByCategory extends Schema.TaggedClass<AccountSelectorByCategory>()("ByCategory", {
  /**
   * The account category to target
   */
  category: AccountCategory
}) {}

/**
 * Type guard for AccountSelectorByCategory using Schema.is
 */
export const isAccountSelectorByCategory = Schema.is(AccountSelectorByCategory)

/**
 * AccountSelector - Union type for different ways to select accounts
 *
 * Per specs/ACCOUNTING_RESEARCH.md, elimination rules can target accounts by:
 * - Specific account ID (ById)
 * - Account number range (ByRange)
 * - Account category (ByCategory)
 */
export const AccountSelector = Schema.Union(
  AccountSelectorById,
  AccountSelectorByRange,
  AccountSelectorByCategory
).annotations({
  identifier: "AccountSelector",
  title: "Account Selector",
  description: "Selector for targeting accounts in elimination rules"
})

/**
 * The AccountSelector type
 */
export type AccountSelector = typeof AccountSelector.Type

/**
 * Type guard for AccountSelector using Schema.is
 */
export const isAccountSelector = Schema.is(AccountSelector)

/**
 * TriggerCondition - Condition that triggers an elimination rule
 *
 * Defines when an elimination rule should be applied based on
 * intercompany transaction properties.
 */
export class TriggerCondition extends Schema.Class<TriggerCondition>("TriggerCondition")({
  /**
   * Description of the trigger condition
   */
  description: Schema.NonEmptyTrimmedString.annotations({
    title: "Description",
    description: "Human-readable description of the trigger condition"
  }),

  /**
   * Source accounts to match (any of these accounts will trigger)
   */
  sourceAccounts: Schema.Chunk(AccountSelector).annotations({
    title: "Source Accounts",
    description: "Account selectors that define source accounts to match"
  }),

  /**
   * Minimum transaction amount threshold (optional)
   * Transactions below this amount won't trigger the rule
   */
  minimumAmount: Schema.OptionFromNullOr(Schema.BigDecimal).annotations({
    title: "Minimum Amount",
    description: "Optional minimum transaction amount to trigger the rule"
  })
}) {
  /**
   * Get the number of source account selectors
   */
  get sourceAccountCount(): number {
    return Chunk.size(this.sourceAccounts)
  }

  /**
   * Check if the trigger has any source account selectors
   */
  get hasSourceAccounts(): boolean {
    return Chunk.isNonEmpty(this.sourceAccounts)
  }
}

/**
 * Type guard for TriggerCondition using Schema.is
 */
export const isTriggerCondition = Schema.is(TriggerCondition)

/**
 * Encoded type interface for TriggerCondition
 */
export interface TriggerConditionEncoded extends Schema.Schema.Encoded<typeof TriggerCondition> {}

/**
 * EliminationRule - Entity representing a consolidation elimination rule
 *
 * Per ASC 810, elimination rules define how intercompany transactions
 * and balances are eliminated during consolidation. Each rule specifies
 * the type of elimination, trigger conditions, source and target accounts,
 * and processing settings.
 *
 * Key features:
 * - Elimination type classification
 * - Flexible account targeting via AccountSelector
 * - Automatic or manual processing modes
 * - Priority ordering for rule execution
 * - Debit and credit accounts for elimination entries
 */
export class EliminationRule extends Schema.Class<EliminationRule>("EliminationRule")({
  /**
   * Unique identifier for the elimination rule
   */
  id: EliminationRuleId,

  /**
   * Reference to the consolidation group this rule belongs to
   */
  consolidationGroupId: ConsolidationGroupId,

  /**
   * Name of the elimination rule
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Rule Name",
    description: "The display name of the elimination rule"
  }),

  /**
   * Optional detailed description of the rule
   */
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Description",
    description: "Optional detailed description of the rule's purpose"
  }),

  /**
   * Type of elimination this rule performs
   */
  eliminationType: EliminationType,

  /**
   * Conditions that trigger this elimination rule
   * Multiple conditions can be defined (OR logic - any match triggers)
   */
  triggerConditions: Schema.Chunk(TriggerCondition).annotations({
    title: "Trigger Conditions",
    description: "Conditions that trigger this elimination rule"
  }),

  /**
   * Source accounts to eliminate from (what to eliminate)
   * Uses AccountSelector for flexible account targeting
   */
  sourceAccounts: Schema.Chunk(AccountSelector).annotations({
    title: "Source Accounts",
    description: "Account selectors for source accounts to eliminate"
  }),

  /**
   * Target accounts where elimination posts (where elimination posts)
   * Uses AccountSelector for flexible account targeting
   */
  targetAccounts: Schema.Chunk(AccountSelector).annotations({
    title: "Target Accounts",
    description: "Account selectors for target accounts for elimination"
  }),

  /**
   * Account to debit for the elimination entry
   * This is the specific account that will receive the debit side of the elimination
   */
  debitAccountId: AccountId,

  /**
   * Account to credit for the elimination entry
   * This is the specific account that will receive the credit side of the elimination
   */
  creditAccountId: AccountId,

  /**
   * Whether this rule should be automatically processed during consolidation
   * When false, requires manual review and approval
   */
  isAutomatic: Schema.Boolean.annotations({
    title: "Is Automatic",
    description: "Whether to auto-process during consolidation or require manual review"
  }),

  /**
   * Priority order for rule execution (lower numbers execute first)
   * Used to control the sequence when multiple rules apply
   */
  priority: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({
      title: "Priority",
      description: "Execution priority (lower executes first)"
    })
  ),

  /**
   * Whether the elimination rule is active
   * Inactive rules are skipped during consolidation processing
   */
  isActive: Schema.Boolean.annotations({
    title: "Is Active",
    description: "Whether the elimination rule is currently active"
  })
}) {
  /**
   * Check if this is an intercompany receivable/payable elimination
   */
  get isReceivablePayableElimination(): boolean {
    return this.eliminationType === "IntercompanyReceivablePayable"
  }

  /**
   * Check if this is an intercompany revenue/expense elimination
   */
  get isRevenueExpenseElimination(): boolean {
    return this.eliminationType === "IntercompanyRevenueExpense"
  }

  /**
   * Check if this is an intercompany dividend elimination
   */
  get isDividendElimination(): boolean {
    return this.eliminationType === "IntercompanyDividend"
  }

  /**
   * Check if this is an intercompany investment elimination
   */
  get isInvestmentElimination(): boolean {
    return this.eliminationType === "IntercompanyInvestment"
  }

  /**
   * Check if this is an unrealized profit in inventory elimination
   */
  get isUnrealizedInventoryElimination(): boolean {
    return this.eliminationType === "UnrealizedProfitInventory"
  }

  /**
   * Check if this is an unrealized profit in fixed assets elimination
   */
  get isUnrealizedFixedAssetElimination(): boolean {
    return this.eliminationType === "UnrealizedProfitFixedAssets"
  }

  /**
   * Check if this is an unrealized profit elimination (inventory or fixed assets)
   */
  get isUnrealizedProfitElimination(): boolean {
    return this.isUnrealizedInventoryElimination || this.isUnrealizedFixedAssetElimination
  }

  /**
   * Check if this is an intercompany balance elimination (receivable/payable)
   */
  get isBalanceElimination(): boolean {
    return this.isReceivablePayableElimination
  }

  /**
   * Check if this is an intercompany income statement elimination (revenue/expense/dividend)
   */
  get isIncomeStatementElimination(): boolean {
    return this.isRevenueExpenseElimination || this.isDividendElimination
  }

  /**
   * Check if this rule requires manual processing
   */
  get requiresManualProcessing(): boolean {
    return !this.isAutomatic
  }

  /**
   * Check if the rule has a description
   */
  get hasDescription(): boolean {
    return this.description._tag === "Some"
  }

  /**
   * Get the number of trigger conditions
   */
  get triggerConditionCount(): number {
    return Chunk.size(this.triggerConditions)
  }

  /**
   * Check if the rule has any trigger conditions
   */
  get hasTriggerConditions(): boolean {
    return Chunk.isNonEmpty(this.triggerConditions)
  }

  /**
   * Get the number of source account selectors
   */
  get sourceAccountCount(): number {
    return Chunk.size(this.sourceAccounts)
  }

  /**
   * Check if the rule has source accounts defined
   */
  get hasSourceAccounts(): boolean {
    return Chunk.isNonEmpty(this.sourceAccounts)
  }

  /**
   * Get the number of target account selectors
   */
  get targetAccountCount(): number {
    return Chunk.size(this.targetAccounts)
  }

  /**
   * Check if the rule has target accounts defined
   */
  get hasTargetAccounts(): boolean {
    return Chunk.isNonEmpty(this.targetAccounts)
  }

  /**
   * Check if the rule is ready for processing
   * A rule is ready if it's active and has both debit and credit accounts
   */
  get isReadyForProcessing(): boolean {
    return this.isActive
  }

  /**
   * Check if this is a high priority rule (priority 0-10)
   */
  get isHighPriority(): boolean {
    return this.priority <= 10
  }

  /**
   * Check if this is a low priority rule (priority > 100)
   */
  get isLowPriority(): boolean {
    return this.priority > 100
  }
}

/**
 * Type guard for EliminationRule using Schema.is
 */
export const isEliminationRule = Schema.is(EliminationRule)

/**
 * Encoded type interface for EliminationRule
 */
export interface EliminationRuleEncoded extends Schema.Schema.Encoded<typeof EliminationRule> {}
