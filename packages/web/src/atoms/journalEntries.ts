/**
 * Journal Entries Atoms - State management for journal entry forms
 *
 * Provides atoms for:
 * - Form state management (formAtom pattern)
 * - Running balance computation (derived atom)
 * - Validation state
 * - Mutation atoms for create/update operations
 *
 * @module journalEntries
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Duration from "effect/Duration"
import * as BigDecimal from "effect/BigDecimal"
import * as Option from "effect/Option"
import type {
  JournalEntryType,
  SourceModule
} from "@accountability/core/Domains/JournalEntry"
import { JournalEntryId as JournalEntryIdSchema } from "@accountability/core/Domains/JournalEntry"
import type { AccountId } from "@accountability/core/Domains/Account"
import type { CompanyId } from "@accountability/core/Domains/Company"
import type { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { FiscalPeriodRef } from "@accountability/core/Domains/FiscalPeriodRef"
import { MonetaryAmount } from "@accountability/core/Domains/MonetaryAmount"
import {
  CreateJournalEntryRequest,
  CreateJournalEntryLineRequest
} from "@accountability/api/Definitions/JournalEntriesApi"
import { ApiClient } from "./ApiClient.ts"

// =============================================================================
// Form Line Types
// =============================================================================

/**
 * A single line in the journal entry form
 * Uses string IDs for React key management
 */
export interface JournalEntryFormLine {
  /** Unique ID for this line (for React keys) */
  readonly id: string
  /** Line number (1-indexed) */
  readonly lineNumber: number
  /** Selected account ID */
  readonly accountId: AccountId | null
  /** Debit amount as string for input binding */
  readonly debitAmount: string
  /** Credit amount as string for input binding */
  readonly creditAmount: string
  /** Currency code for amounts */
  readonly currencyCode: CurrencyCode
  /** Optional memo for this line */
  readonly memo: string
}

/**
 * Form state for creating/editing a journal entry
 */
export interface JournalEntryFormState {
  /** Company ID the entry belongs to */
  readonly companyId: CompanyId | null
  /** Entry description */
  readonly description: string
  /** Transaction date as ISO string */
  readonly transactionDate: string
  /** Document date as ISO string (optional) */
  readonly documentDate: string
  /** Fiscal year */
  readonly fiscalYear: number
  /** Fiscal period (1-13) */
  readonly fiscalPeriod: number
  /** Entry type */
  readonly entryType: JournalEntryType
  /** Source module */
  readonly sourceModule: SourceModule
  /** Reference number (optional) */
  readonly referenceNumber: string
  /** Source document reference (optional) */
  readonly sourceDocumentRef: string
  /** Journal entry lines */
  readonly lines: ReadonlyArray<JournalEntryFormLine>
  /** Whether the form is being submitted */
  readonly isSubmitting: boolean
  /** Submission error message */
  readonly error: string | null
  /** ID of entry being edited (null for new entry) */
  readonly editingId: string | null
}

/**
 * Line error type
 */
export interface JournalEntryLineError {
  readonly lineId: string
  readonly accountId?: string | undefined
  readonly amount?: string | undefined
}

/**
 * Validation errors for the form
 */
export interface JournalEntryFormErrors {
  readonly description?: string | undefined
  readonly transactionDate?: string | undefined
  readonly fiscalYear?: string | undefined
  readonly fiscalPeriod?: string | undefined
  readonly lines?: string | undefined
  readonly balance?: string | undefined
  readonly lineErrors: ReadonlyArray<JournalEntryLineError>
}

// =============================================================================
// Default Values
// =============================================================================

/**
 * Generate a unique line ID
 */
export const generateLineId = (): string => {
  return `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a new empty line
 */
export const createEmptyLine = (
  lineNumber: number,
  currencyCode: CurrencyCode
): JournalEntryFormLine => ({
  id: generateLineId(),
  lineNumber,
  accountId: null,
  debitAmount: "",
  creditAmount: "",
  currencyCode,
  memo: ""
})

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
const getTodayString = (): string => {
  const today = new Date()
  return today.toISOString().split("T")[0]
}

/**
 * Get current fiscal year and period from today's date
 */
const getCurrentFiscalPeriod = (): { year: number; period: number } => {
  const today = new Date()
  return {
    year: today.getFullYear(),
    period: today.getMonth() + 1 // 1-12
  }
}

/**
 * Create initial form state
 */
export const createInitialFormState = (
  companyId: CompanyId | null,
  defaultCurrency: CurrencyCode
): JournalEntryFormState => {
  const fiscal = getCurrentFiscalPeriod()
  return {
    companyId,
    description: "",
    transactionDate: getTodayString(),
    documentDate: "",
    fiscalYear: fiscal.year,
    fiscalPeriod: fiscal.period,
    entryType: "Standard",
    sourceModule: "GeneralLedger",
    referenceNumber: "",
    sourceDocumentRef: "",
    lines: [
      createEmptyLine(1, defaultCurrency),
      createEmptyLine(2, defaultCurrency)
    ],
    isSubmitting: false,
    error: null,
    editingId: null
  }
}

// =============================================================================
// Balance Calculation
// =============================================================================

/**
 * Parse a string amount to BigDecimal, returning zero for invalid/empty values
 */
export const parseAmount = (amount: string): BigDecimal.BigDecimal => {
  if (!amount.trim()) {
    return BigDecimal.fromBigInt(0n)
  }
  try {
    return BigDecimal.unsafeFromString(amount)
  } catch {
    return BigDecimal.fromBigInt(0n)
  }
}

/**
 * Running balance calculation result
 */
export interface RunningBalance {
  /** Total debits */
  readonly totalDebits: BigDecimal.BigDecimal
  /** Total credits */
  readonly totalCredits: BigDecimal.BigDecimal
  /** Net balance (debits - credits) */
  readonly netBalance: BigDecimal.BigDecimal
  /** Whether the entry is balanced (debits = credits) */
  readonly isBalanced: boolean
  /** Formatted total debits */
  readonly formattedDebits: string
  /** Formatted total credits */
  readonly formattedCredits: string
  /** Formatted net balance */
  readonly formattedBalance: string
}

/**
 * Calculate running balance from form lines
 */
export const calculateRunningBalance = (
  lines: ReadonlyArray<JournalEntryFormLine>
): RunningBalance => {
  let totalDebits = BigDecimal.fromBigInt(0n)
  let totalCredits = BigDecimal.fromBigInt(0n)

  for (const line of lines) {
    const debit = parseAmount(line.debitAmount)
    const credit = parseAmount(line.creditAmount)
    totalDebits = BigDecimal.sum(totalDebits, debit)
    totalCredits = BigDecimal.sum(totalCredits, credit)
  }

  const netBalance = BigDecimal.subtract(totalDebits, totalCredits)
  const isBalanced = BigDecimal.isZero(netBalance)

  return {
    totalDebits,
    totalCredits,
    netBalance,
    isBalanced,
    formattedDebits: BigDecimal.format(totalDebits),
    formattedCredits: BigDecimal.format(totalCredits),
    formattedBalance: BigDecimal.format(netBalance)
  }
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate the journal entry form
 */
export const validateForm = (state: JournalEntryFormState): JournalEntryFormErrors => {
  let description: string | undefined
  let transactionDate: string | undefined
  let fiscalYear: string | undefined
  let fiscalPeriod: string | undefined
  let lines: string | undefined
  let balance: string | undefined
  const lineErrors: JournalEntryLineError[] = []

  // Validate description
  if (!state.description.trim()) {
    description = "Description is required"
  }

  // Validate transaction date
  if (!state.transactionDate) {
    transactionDate = "Transaction date is required"
  }

  // Validate fiscal year
  if (state.fiscalYear < 1900 || state.fiscalYear > 2999) {
    fiscalYear = "Fiscal year must be between 1900 and 2999"
  }

  // Validate fiscal period
  if (state.fiscalPeriod < 1 || state.fiscalPeriod > 13) {
    fiscalPeriod = "Fiscal period must be between 1 and 13"
  }

  // Validate lines - need at least 2
  if (state.lines.length < 2) {
    lines = "At least two lines are required"
  }

  // Validate each line
  for (const line of state.lines) {
    let accountIdError: string | undefined
    let amountError: string | undefined
    let hasError = false

    // Account is required
    if (!line.accountId) {
      accountIdError = "Account is required"
      hasError = true
    }

    // Exactly one of debit or credit must be set
    const hasDebit = line.debitAmount.trim() !== ""
    const hasCredit = line.creditAmount.trim() !== ""

    if (!hasDebit && !hasCredit) {
      amountError = "Enter a debit or credit amount"
      hasError = true
    } else if (hasDebit && hasCredit) {
      amountError = "Line cannot have both debit and credit"
      hasError = true
    }

    if (hasError) {
      lineErrors.push({
        lineId: line.id,
        accountId: accountIdError,
        amount: amountError
      })
    }
  }

  // Check balance
  const balanceResult = calculateRunningBalance(state.lines)
  if (!balanceResult.isBalanced) {
    balance = `Entry is not balanced. Difference: ${balanceResult.formattedBalance}`
  }

  return {
    description,
    transactionDate,
    fiscalYear,
    fiscalPeriod,
    lines,
    balance,
    lineErrors
  }
}

/**
 * Check if form has any validation errors
 */
export const hasValidationErrors = (errors: JournalEntryFormErrors): boolean => {
  return !!(
    errors.description ||
    errors.transactionDate ||
    errors.fiscalYear ||
    errors.fiscalPeriod ||
    errors.lines ||
    errors.balance ||
    errors.lineErrors.length > 0
  )
}

// =============================================================================
// API Queries
// =============================================================================

/**
 * Single journal entry query by ID
 */
export const journalEntryByIdFamily = Atom.family((id: string) =>
  ApiClient.query("journal-entries", "getJournalEntry", {
    path: { id: JournalEntryIdSchema.make(id) },
    timeToLive: Duration.minutes(2)
  })
)

/**
 * Journal entries list query parameters
 */
export interface JournalEntriesQueryParams {
  readonly companyId: CompanyId
  readonly status?: "Draft" | "PendingApproval" | "Approved" | "Posted" | "Reversed" | undefined
  readonly entryType?: JournalEntryType | undefined
  readonly limit?: number | undefined
  readonly offset?: number | undefined
}

/**
 * Create journal entries list query atom
 */
export const createJournalEntriesQueryAtom = (params: JournalEntriesQueryParams) => {
  return ApiClient.query("journal-entries", "listJournalEntries", {
    urlParams: {
      companyId: params.companyId,
      status: params.status,
      entryType: params.entryType,
      limit: params.limit,
      offset: params.offset
    },
    timeToLive: Duration.seconds(5)  // Short TTL to ensure fresh data
  })
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create journal entry mutation
 */
export const createJournalEntryMutation = ApiClient.mutation("journal-entries", "createJournalEntry")

/**
 * Update journal entry mutation
 */
export const updateJournalEntryMutation = ApiClient.mutation("journal-entries", "updateJournalEntry")

/**
 * Submit for approval mutation
 */
export const submitForApprovalMutation = ApiClient.mutation("journal-entries", "submitForApproval")

/**
 * Approve journal entry mutation
 */
export const approveJournalEntryMutation = ApiClient.mutation("journal-entries", "approveJournalEntry")

/**
 * Reject journal entry mutation
 */
export const rejectJournalEntryMutation = ApiClient.mutation("journal-entries", "rejectJournalEntry")

/**
 * Post journal entry mutation
 */
export const postJournalEntryMutation = ApiClient.mutation("journal-entries", "postJournalEntry")

/**
 * Delete journal entry mutation
 */
export const deleteJournalEntryMutation = ApiClient.mutation("journal-entries", "deleteJournalEntry")

// =============================================================================
// Form State Helpers
// =============================================================================

/**
 * Convert form state to API create request
 */
export const formStateToCreateRequest = (state: JournalEntryFormState): CreateJournalEntryRequest => {
  if (!state.companyId) {
    throw new Error("Company ID is required")
  }

  // Parse transaction date
  const [year, month, day] = state.transactionDate.split("-").map(Number)
  const transactionDate = LocalDate.make({ year, month, day })

  // Parse document date if provided
  const documentDate = state.documentDate
    ? Option.some((() => {
        const [docYear, docMonth, docDay] = state.documentDate.split("-").map(Number)
        return LocalDate.make({ year: docYear, month: docMonth, day: docDay })
      })())
    : Option.none<LocalDate>()

  // Create fiscal period reference
  const fiscalPeriod = FiscalPeriodRef.make({
    year: state.fiscalYear,
    period: state.fiscalPeriod
  })

  // Create line requests
  const lineRequests = state.lines
    .filter((line) => line.accountId !== null)
    .map((line) =>
      CreateJournalEntryLineRequest.make({
        accountId: line.accountId!,
        debitAmount: line.debitAmount.trim()
          ? Option.some(
              MonetaryAmount.fromBigDecimal(
                BigDecimal.unsafeFromString(line.debitAmount),
                line.currencyCode
              )
            )
          : Option.none<MonetaryAmount>(),
        creditAmount: line.creditAmount.trim()
          ? Option.some(
              MonetaryAmount.fromBigDecimal(
                BigDecimal.unsafeFromString(line.creditAmount),
                line.currencyCode
              )
            )
          : Option.none<MonetaryAmount>(),
        memo: line.memo
          ? Option.some(line.memo)
          : Option.none<string>(),
        dimensions: Option.none<Record<string, string>>(),
        intercompanyPartnerId: Option.none<CompanyId>()
      })
    )

  return CreateJournalEntryRequest.make({
    companyId: state.companyId,
    description: state.description,
    transactionDate,
    documentDate,
    fiscalPeriod,
    entryType: state.entryType,
    sourceModule: state.sourceModule,
    referenceNumber: state.referenceNumber
      ? Option.some(state.referenceNumber)
      : Option.none<string>(),
    sourceDocumentRef: state.sourceDocumentRef
      ? Option.some(state.sourceDocumentRef)
      : Option.none<string>(),
    lines: lineRequests
  })
}
