/**
 * Tests for AccountSelectorUtils
 *
 * Tests the pure utility functions used by the AccountSelector component.
 *
 * @module AccountSelectorUtils.test
 */

import { describe, expect, it } from "@effect/vitest"
import * as Option from "effect/Option"
import { Account, AccountId, type AccountType, type AccountCategory, type NormalBalance } from "@accountability/core/Domains/Account"
import { AccountNumber } from "@accountability/core/Domains/AccountNumber"
import { CompanyId } from "@accountability/core/Domains/Company"
import { Timestamp } from "@accountability/core/Domains/Timestamp"
import {
  buildHierarchicalList,
  filterBySearch,
  findAccountById,
  formatAccountDisplay,
  type AccountWithDepth
} from "../src/components/AccountSelectorUtils.ts"

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock Account for testing using Schema.make
 */
const createMockAccount = (overrides: {
  id: string
  accountNumber: string
  name: string
  accountType?: AccountType
  accountCategory?: AccountCategory
  normalBalance?: NormalBalance
  parentAccountId?: string | null
  hierarchyLevel?: number
  description?: string | null
}): Account =>
  Account.make({
    id: AccountId.make(overrides.id),
    companyId: CompanyId.make(COMPANY_UUID),
    accountNumber: AccountNumber.make(overrides.accountNumber),
    name: overrides.name,
    description: overrides.description !== undefined && overrides.description !== null
      ? Option.some(overrides.description)
      : Option.none(),
    accountType: overrides.accountType ?? "Asset",
    accountCategory: overrides.accountCategory ?? "CurrentAsset",
    normalBalance: overrides.normalBalance ?? "Debit",
    parentAccountId: overrides.parentAccountId !== undefined && overrides.parentAccountId !== null
      ? Option.some(AccountId.make(overrides.parentAccountId))
      : Option.none(),
    hierarchyLevel: overrides.hierarchyLevel ?? 1,
    isPostable: true,
    isCashFlowRelevant: false,
    cashFlowCategory: Option.none(),
    isIntercompany: false,
    intercompanyPartnerId: Option.none(),
    currencyRestriction: Option.none(),
    isActive: true,
    createdAt: Timestamp.make({ epochMillis: 1704067200000 }),
    deactivatedAt: Option.none()
  })

// =============================================================================
// Test UUIDs
// =============================================================================

// Use consistent UUIDs for testing
const UUID1 = "00000000-0000-0000-0000-000000000001"
const UUID2 = "00000000-0000-0000-0000-000000000002"
const UUID3 = "00000000-0000-0000-0000-000000000003"
const UUID4 = "00000000-0000-0000-0000-000000000004"
const COMPANY_UUID = "00000000-0000-0000-0000-000000000100"

// =============================================================================
// buildHierarchicalList Tests
// =============================================================================

describe("buildHierarchicalList", () => {
  it("returns empty array for empty input", () => {
    const result = buildHierarchicalList([])
    expect(result).toEqual([])
  })

  it("returns accounts at depth 0 for accounts with no parent", () => {
    const accounts = [
      createMockAccount({ id: UUID1, accountNumber: "1000", name: "Cash" }),
      createMockAccount({ id: UUID2, accountNumber: "2000", name: "Accounts Payable" })
    ]

    const result = buildHierarchicalList(accounts)

    expect(result).toHaveLength(2)
    expect(result[0].account.id).toBe(UUID1)
    expect(result[0].depth).toBe(0)
    expect(result[1].account.id).toBe(UUID2)
    expect(result[1].depth).toBe(0)
  })

  it("sorts accounts by account number at each level", () => {
    const accounts = [
      createMockAccount({ id: UUID3, accountNumber: "3000", name: "Equity" }),
      createMockAccount({ id: UUID1, accountNumber: "1000", name: "Assets" }),
      createMockAccount({ id: UUID2, accountNumber: "2000", name: "Liabilities" })
    ]

    const result = buildHierarchicalList(accounts)

    expect(result[0].account.accountNumber).toBe("1000")
    expect(result[1].account.accountNumber).toBe("2000")
    expect(result[2].account.accountNumber).toBe("3000")
  })

  it("correctly nests child accounts under parents", () => {
    const accounts = [
      createMockAccount({ id: UUID1, accountNumber: "1000", name: "Assets", parentAccountId: null }),
      createMockAccount({ id: UUID2, accountNumber: "1100", name: "Cash", parentAccountId: UUID1 }),
      createMockAccount({ id: UUID3, accountNumber: "1200", name: "Receivables", parentAccountId: UUID1 })
    ]

    const result = buildHierarchicalList(accounts)

    expect(result).toHaveLength(3)
    // Parent
    expect(result[0].account.id).toBe(UUID1)
    expect(result[0].depth).toBe(0)
    // First child
    expect(result[1].account.id).toBe(UUID2)
    expect(result[1].depth).toBe(1)
    // Second child
    expect(result[2].account.id).toBe(UUID3)
    expect(result[2].depth).toBe(1)
  })

  it("handles deeply nested hierarchies", () => {
    const accounts = [
      createMockAccount({ id: UUID1, accountNumber: "1000", name: "Assets", parentAccountId: null }),
      createMockAccount({ id: UUID2, accountNumber: "1100", name: "Current Assets", parentAccountId: UUID1 }),
      createMockAccount({ id: UUID3, accountNumber: "1110", name: "Cash", parentAccountId: UUID2 }),
      createMockAccount({ id: UUID4, accountNumber: "1111", name: "Petty Cash", parentAccountId: UUID3 })
    ]

    const result = buildHierarchicalList(accounts)

    expect(result).toHaveLength(4)
    expect(result[0].depth).toBe(0) // Assets
    expect(result[1].depth).toBe(1) // Current Assets
    expect(result[2].depth).toBe(2) // Cash
    expect(result[3].depth).toBe(3) // Petty Cash
  })

  it("handles multiple root-level accounts with children", () => {
    const accounts = [
      createMockAccount({ id: UUID1, accountNumber: "1000", name: "Assets", parentAccountId: null }),
      createMockAccount({ id: UUID2, accountNumber: "1100", name: "Cash", parentAccountId: UUID1 }),
      createMockAccount({ id: UUID3, accountNumber: "2000", name: "Liabilities", parentAccountId: null }),
      createMockAccount({ id: UUID4, accountNumber: "2100", name: "Accounts Payable", parentAccountId: UUID3 })
    ]

    const result = buildHierarchicalList(accounts)

    expect(result).toHaveLength(4)
    // First tree
    expect(result[0].account.id).toBe(UUID1)
    expect(result[0].depth).toBe(0)
    expect(result[1].account.id).toBe(UUID2)
    expect(result[1].depth).toBe(1)
    // Second tree
    expect(result[2].account.id).toBe(UUID3)
    expect(result[2].depth).toBe(0)
    expect(result[3].account.id).toBe(UUID4)
    expect(result[3].depth).toBe(1)
  })

  it("sorts children within each parent by account number", () => {
    const accounts = [
      createMockAccount({ id: UUID1, accountNumber: "1000", name: "Assets", parentAccountId: null }),
      createMockAccount({ id: UUID4, accountNumber: "1300", name: "Prepaid", parentAccountId: UUID1 }),
      createMockAccount({ id: UUID2, accountNumber: "1100", name: "Cash", parentAccountId: UUID1 }),
      createMockAccount({ id: UUID3, accountNumber: "1200", name: "Receivables", parentAccountId: UUID1 })
    ]

    const result = buildHierarchicalList(accounts)

    expect(result[1].account.accountNumber).toBe("1100")
    expect(result[2].account.accountNumber).toBe("1200")
    expect(result[3].account.accountNumber).toBe("1300")
  })
})

// =============================================================================
// filterBySearch Tests
// =============================================================================

describe("filterBySearch", () => {
  const createTestAccounts = (): AccountWithDepth[] => [
    {
      account: createMockAccount({ id: UUID1, accountNumber: "1000", name: "Cash", description: "Main cash account" }),
      depth: 0
    },
    {
      account: createMockAccount({ id: UUID2, accountNumber: "1100", name: "Petty Cash", description: null }),
      depth: 1
    },
    {
      account: createMockAccount({ id: UUID3, accountNumber: "2000", name: "Accounts Payable", description: "Trade payables" }),
      depth: 0
    }
  ]

  it("returns all accounts for empty search query", () => {
    const accounts = createTestAccounts()
    const result = filterBySearch(accounts, "")
    expect(result).toHaveLength(3)
  })

  it("returns all accounts for whitespace-only search query", () => {
    const accounts = createTestAccounts()
    const result = filterBySearch(accounts, "   ")
    expect(result).toHaveLength(3)
  })

  it("filters by account name (case-insensitive)", () => {
    const accounts = createTestAccounts()

    const result = filterBySearch(accounts, "cash")
    expect(result).toHaveLength(2)
    expect(result[0].account.name).toBe("Cash")
    expect(result[1].account.name).toBe("Petty Cash")
  })

  it("filters by account name with mixed case", () => {
    const accounts = createTestAccounts()

    const result = filterBySearch(accounts, "CASH")
    expect(result).toHaveLength(2)
  })

  it("filters by account number", () => {
    const accounts = createTestAccounts()

    const result = filterBySearch(accounts, "1000")
    expect(result).toHaveLength(1)
    expect(result[0].account.accountNumber).toBe("1000")
  })

  it("filters by partial account number", () => {
    const accounts = createTestAccounts()

    const result = filterBySearch(accounts, "11")
    expect(result).toHaveLength(1)
    expect(result[0].account.accountNumber).toBe("1100")
  })

  it("filters by description", () => {
    const accounts = createTestAccounts()

    const result = filterBySearch(accounts, "trade")
    expect(result).toHaveLength(1)
    expect(result[0].account.name).toBe("Accounts Payable")
  })

  it("returns empty array when no accounts match", () => {
    const accounts = createTestAccounts()

    const result = filterBySearch(accounts, "nonexistent")
    expect(result).toHaveLength(0)
  })

  it("trims search query before matching", () => {
    const accounts = createTestAccounts()

    const result = filterBySearch(accounts, "  cash  ")
    expect(result).toHaveLength(2)
  })

  it("handles accounts without description", () => {
    const accounts: AccountWithDepth[] = [
      {
        account: createMockAccount({ id: UUID1, accountNumber: "1000", name: "Cash", description: null }),
        depth: 0
      }
    ]

    const result = filterBySearch(accounts, "description")
    expect(result).toHaveLength(0)
  })
})

// =============================================================================
// findAccountById Tests
// =============================================================================

describe("findAccountById", () => {
  const createTestAccounts = (): AccountWithDepth[] => [
    { account: createMockAccount({ id: UUID1, accountNumber: "1000", name: "Cash" }), depth: 0 },
    { account: createMockAccount({ id: UUID2, accountNumber: "2000", name: "Accounts Payable" }), depth: 0 },
    { account: createMockAccount({ id: UUID3, accountNumber: "3000", name: "Equity" }), depth: 0 }
  ]

  it("returns null for null accountId", () => {
    const accounts = createTestAccounts()
    const result = findAccountById(accounts, null)
    expect(result).toBeNull()
  })

  it("returns account when found", () => {
    const accounts = createTestAccounts()
    const result = findAccountById(accounts, UUID2)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(UUID2)
    expect(result?.name).toBe("Accounts Payable")
  })

  it("returns null when account not found", () => {
    const accounts = createTestAccounts()
    const result = findAccountById(accounts, "00000000-0000-0000-0000-000000000099")
    expect(result).toBeNull()
  })

  it("returns null for empty accounts array", () => {
    const result = findAccountById([], UUID1)
    expect(result).toBeNull()
  })
})

// =============================================================================
// formatAccountDisplay Tests
// =============================================================================

describe("formatAccountDisplay", () => {
  it("formats account display with number and name", () => {
    const account = createMockAccount({ id: UUID1, accountNumber: "1000", name: "Cash" })
    const result = formatAccountDisplay(account)
    expect(result).toBe("1000 - Cash")
  })

  it("handles different account names", () => {
    const account = createMockAccount({ id: UUID1, accountNumber: "1001", name: "Main Bank Account" })
    const result = formatAccountDisplay(account)
    expect(result).toBe("1001 - Main Bank Account")
  })
})
