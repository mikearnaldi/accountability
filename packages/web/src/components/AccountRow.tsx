/**
 * AccountRow - Individual row component for account in tree view
 *
 * Displays account information in a row format with:
 * - Expand/collapse toggle for parent accounts
 * - Indentation based on depth
 * - Account Number, Name, Type, Category, Normal Balance, Active status
 */

import * as React from "react"
import type { Account, AccountType, AccountCategory } from "@accountability/core/Domains/Account"

// =============================================================================
// Icons
// =============================================================================

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  )
}

// =============================================================================
// Type Display Helpers
// =============================================================================

const TYPE_COLORS: Record<AccountType, string> = {
  Asset: "bg-blue-100 text-blue-700",
  Liability: "bg-red-100 text-red-700",
  Equity: "bg-purple-100 text-purple-700",
  Revenue: "bg-green-100 text-green-700",
  Expense: "bg-orange-100 text-orange-700"
}

const CATEGORY_LABELS: Record<AccountCategory, string> = {
  // Asset categories
  CurrentAsset: "Current Asset",
  NonCurrentAsset: "Non-Current Asset",
  FixedAsset: "Fixed Asset",
  IntangibleAsset: "Intangible Asset",
  // Liability categories
  CurrentLiability: "Current Liability",
  NonCurrentLiability: "Non-Current Liability",
  // Equity categories
  ContributedCapital: "Contributed Capital",
  RetainedEarnings: "Retained Earnings",
  OtherComprehensiveIncome: "OCI",
  TreasuryStock: "Treasury Stock",
  // Revenue categories
  OperatingRevenue: "Operating Revenue",
  OtherRevenue: "Other Revenue",
  // Expense categories
  CostOfGoodsSold: "COGS",
  OperatingExpense: "Operating Expense",
  DepreciationAmortization: "Depreciation",
  InterestExpense: "Interest Expense",
  TaxExpense: "Tax Expense",
  OtherExpense: "Other Expense"
}

// =============================================================================
// AccountRow Component
// =============================================================================

interface AccountRowProps {
  readonly account: Account
  readonly depth: number
  readonly hasChildren: boolean
  readonly isExpanded: boolean
  readonly onToggle: (e: React.MouseEvent) => void
  readonly onClick: () => void
}

export function AccountRow({
  account,
  depth,
  hasChildren,
  isExpanded,
  onToggle,
  onClick
}: AccountRowProps) {
  const indentPadding = depth * 20 // 20px per level

  return (
    <div
      className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
      style={{ paddingLeft: `${16 + indentPadding}px` }}
      onClick={onClick}
      data-testid={`account-row-${account.id}`}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Toggle button */}
      <div className="w-8 flex-shrink-0">
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            data-testid={`toggle-${account.id}`}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>
        ) : (
          <div className="h-6 w-6" /> // Spacer for alignment
        )}
      </div>

      {/* Account Number */}
      <div
        className="w-24 flex-shrink-0 font-mono text-sm text-gray-600"
        data-testid={`account-number-${account.id}`}
      >
        {account.accountNumber}
      </div>

      {/* Name */}
      <div
        className="flex-1 min-w-[200px] font-medium text-gray-900 truncate"
        data-testid={`account-name-${account.id}`}
        title={account.name}
      >
        {account.name}
        {!account.isPostable && (
          <span className="ml-2 text-xs text-gray-400">(Summary)</span>
        )}
      </div>

      {/* Type */}
      <div className="w-24 flex-shrink-0">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[account.accountType]}`}
          data-testid={`account-type-${account.id}`}
        >
          {account.accountType}
        </span>
      </div>

      {/* Category */}
      <div
        className="w-32 flex-shrink-0 text-sm text-gray-600 truncate"
        data-testid={`account-category-${account.id}`}
        title={CATEGORY_LABELS[account.accountCategory]}
      >
        {CATEGORY_LABELS[account.accountCategory]}
      </div>

      {/* Normal Balance */}
      <div
        className="w-20 flex-shrink-0 text-sm text-gray-600"
        data-testid={`account-balance-${account.id}`}
      >
        {account.normalBalance}
      </div>

      {/* Active Status */}
      <div className="w-16 flex-shrink-0 text-center">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            account.isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
          data-testid={`account-active-${account.id}`}
        >
          {account.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  )
}
