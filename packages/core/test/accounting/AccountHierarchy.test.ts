import { describe, it, expect } from "@effect/vitest"
import { Effect, Option, Either, FastCheck, Equal, Hash, Chunk } from "effect"
import * as Schema from "effect/Schema"
import {
  AccountNode,
  isAccountNode,
  AccountTypeMismatchError,
  isAccountTypeMismatchError,
  ParentAccountNotFoundError,
  isParentAccountNotFoundError,
  CircularReferenceError,
  isCircularReferenceError,
  validateParentChildType,
  findAccountById,
  getDirectChildren,
  getDescendants,
  getAncestors,
  getRootAncestor,
  isAncestorOf,
  isDescendantOf,
  getDepth,
  getRootAccounts,
  buildAccountTree,
  flattenTree,
  validateHierarchy,
  getSiblings,
  findByType,
  getPath
} from "../../src/accounting/AccountHierarchy.ts"
import type {
  AccountType,
  AccountCategory
} from "../../src/accounting/Account.ts";
import {
  Account,
  AccountId
} from "../../src/accounting/Account.ts"
import { AccountNumber } from "../../src/accounting/AccountNumber.ts"
import { CompanyId } from "../../src/company/Company.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

// Helper to create test accounts
const createTestAccount = (
  id: string,
  name: string,
  accountNumber: string,
  accountType: AccountType,
  accountCategory: AccountCategory,
  parentAccountId: Option.Option<AccountId> = Option.none(),
  hierarchyLevel: number = 1
): Account => {
  return Account.make({
    id: AccountId.make(id),
    companyId: CompanyId.make("00000000-0000-0000-0000-000000000001"),
    accountNumber: AccountNumber.make(accountNumber),
    name,
    description: Option.none(),
    accountType,
    accountCategory,
    normalBalance: accountType === "Asset" || accountType === "Expense" ? "Debit" : "Credit",
    parentAccountId,
    hierarchyLevel,
    isPostable: true,
    isCashFlowRelevant: false,
    cashFlowCategory: Option.none(),
    isIntercompany: false,
    intercompanyPartnerId: Option.none(),
    currencyRestriction: Option.none(),
    isActive: true,
    createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
    deactivatedAt: Option.none()
  })
}

// UUIDs for testing
const UUID1 = "00000000-0000-0000-0000-000000000001"
const UUID2 = "00000000-0000-0000-0000-000000000002"
const UUID3 = "00000000-0000-0000-0000-000000000003"
const UUID4 = "00000000-0000-0000-0000-000000000004"
const UUID5 = "00000000-0000-0000-0000-000000000005"
const UUID6 = "00000000-0000-0000-0000-000000000006"
const UUID7 = "00000000-0000-0000-0000-000000000007"

// Create a test hierarchy:
// Assets (1000) - root
//   ├── Current Assets (1100) - level 2
//   │   ├── Cash (1110) - level 3
//   │   └── Accounts Receivable (1120) - level 3
//   └── Fixed Assets (1500) - level 2
//       └── Equipment (1510) - level 3
// Revenue (4000) - root
//   └── Sales (4100) - level 2

const createTestHierarchy = (): ReadonlyArray<Account> => {
  const assets = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
  const currentAssets = createTestAccount(
    UUID2,
    "Current Assets",
    "1100",
    "Asset",
    "CurrentAsset",
    Option.some(AccountId.make(UUID1)),
    2
  )
  const cash = createTestAccount(
    UUID3,
    "Cash",
    "1110",
    "Asset",
    "CurrentAsset",
    Option.some(AccountId.make(UUID2)),
    3
  )
  const ar = createTestAccount(
    UUID4,
    "Accounts Receivable",
    "1120",
    "Asset",
    "CurrentAsset",
    Option.some(AccountId.make(UUID2)),
    3
  )
  const fixedAssets = createTestAccount(
    UUID5,
    "Fixed Assets",
    "1500",
    "Asset",
    "FixedAsset",
    Option.some(AccountId.make(UUID1)),
    2
  )
  const equipment = createTestAccount(
    UUID6,
    "Equipment",
    "1510",
    "Asset",
    "FixedAsset",
    Option.some(AccountId.make(UUID5)),
    3
  )
  const revenue = createTestAccount(UUID7, "Revenue", "4000", "Revenue", "OperatingRevenue")

  return [assets, currentAssets, cash, ar, fixedAssets, equipment, revenue]
}

describe("AccountNode", () => {
  describe("creation", () => {
    it("creates a leaf node (no children)", () => {
      const account = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
      const node = AccountNode.make({
        account,
        children: Chunk.empty()
      })

      expect(node.account.name).toBe("Cash")
      expect(node.children).toHaveLength(0)
      expect(node.hasChildren).toBe(false)
      expect(node.childCount).toBe(0)
      expect(node.descendantCount).toBe(0)
    })

    it("creates a node with children", () => {
      const parent = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
      const child1 = createTestAccount(UUID2, "Cash", "1100", "Asset", "CurrentAsset")
      const child2 = createTestAccount(UUID3, "AR", "1200", "Asset", "CurrentAsset")

      const childNode1 = AccountNode.make({ account: child1, children: Chunk.empty() })
      const childNode2 = AccountNode.make({ account: child2, children: Chunk.empty() })

      const parentNode = AccountNode.make({
        account: parent,
        children: Chunk.fromIterable([childNode1, childNode2])
      })

      expect(parentNode.hasChildren).toBe(true)
      expect(parentNode.childCount).toBe(2)
      expect(parentNode.descendantCount).toBe(2)
    })

    it("calculates descendant count correctly for nested hierarchy", () => {
      const root = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
      const level2 = createTestAccount(UUID2, "Current", "1100", "Asset", "CurrentAsset")
      const level3a = createTestAccount(UUID3, "Cash", "1110", "Asset", "CurrentAsset")
      const level3b = createTestAccount(UUID4, "AR", "1120", "Asset", "CurrentAsset")

      const node3a = AccountNode.make({ account: level3a, children: Chunk.empty() })
      const node3b = AccountNode.make({ account: level3b, children: Chunk.empty() })
      const node2 = AccountNode.make({ account: level2, children: Chunk.fromIterable([node3a, node3b]) })
      const rootNode = AccountNode.make({ account: root, children: Chunk.fromIterable([node2]) })

      expect(rootNode.descendantCount).toBe(3)
      expect(node2.descendantCount).toBe(2)
      expect(node3a.descendantCount).toBe(0)
    })
  })

  describe("type guard", () => {
    it("isAccountNode returns true for AccountNode instances", () => {
      const account = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
      const node = AccountNode.make({ account, children: Chunk.empty() })
      expect(isAccountNode(node)).toBe(true)
    })

    it("isAccountNode returns false for non-AccountNode values", () => {
      expect(isAccountNode(null)).toBe(false)
      expect(isAccountNode({})).toBe(false)
      expect(isAccountNode("node")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals returns true for identical nodes", () => {
      const account = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
      const node1 = AccountNode.make({ account, children: Chunk.empty() })
      const node2 = AccountNode.make({ account, children: Chunk.empty() })

      expect(Equal.equals(node1, node2)).toBe(true)
    })

    it("Equal.equals returns false for different accounts", () => {
      const account1 = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
      const account2 = createTestAccount(UUID2, "AR", "1100", "Asset", "CurrentAsset")
      const node1 = AccountNode.make({ account: account1, children: Chunk.empty() })
      const node2 = AccountNode.make({ account: account2, children: Chunk.empty() })

      expect(Equal.equals(node1, node2)).toBe(false)
    })

    it("Equal.equals returns false for different children", () => {
      const parent = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
      const child1 = createTestAccount(UUID2, "Cash", "1100", "Asset", "CurrentAsset")
      const child2 = createTestAccount(UUID3, "AR", "1200", "Asset", "CurrentAsset")

      const childNode1 = AccountNode.make({ account: child1, children: Chunk.empty() })
      const childNode2 = AccountNode.make({ account: child2, children: Chunk.empty() })

      const parentNode1 = AccountNode.make({ account: parent, children: Chunk.fromIterable([childNode1]) })
      const parentNode2 = AccountNode.make({ account: parent, children: Chunk.fromIterable([childNode2]) })

      expect(Equal.equals(parentNode1, parentNode2)).toBe(false)
    })

    it("Equal.equals returns false for different children length", () => {
      const parent = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
      const child = createTestAccount(UUID2, "Cash", "1100", "Asset", "CurrentAsset")

      const childNode = AccountNode.make({ account: child, children: Chunk.empty() })

      const parentNode1 = AccountNode.make({ account: parent, children: Chunk.fromIterable([childNode]) })
      const parentNode2 = AccountNode.make({ account: parent, children: Chunk.empty() })

      expect(Equal.equals(parentNode1, parentNode2)).toBe(false)
    })

    it("Equal.equals returns false for non-AccountNode", () => {
      const account = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
      const node = AccountNode.make({ account, children: Chunk.empty() })

      expect(Equal.equals(node, null)).toBe(false)
      expect(Equal.equals(node, {})).toBe(false)
      expect(Equal.equals(node, "string")).toBe(false)
    })
  })

  describe("hashing", () => {
    it("Hash.hash returns consistent values for equal nodes", () => {
      const account = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
      const node1 = AccountNode.make({ account, children: Chunk.empty() })
      const node2 = AccountNode.make({ account, children: Chunk.empty() })

      expect(Hash.hash(node1)).toBe(Hash.hash(node2))
    })

    it("Hash.hash returns different values for different nodes (usually)", () => {
      const account1 = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
      const account2 = createTestAccount(UUID2, "AR", "1100", "Asset", "CurrentAsset")
      const node1 = AccountNode.make({ account: account1, children: Chunk.empty() })
      const node2 = AccountNode.make({ account: account2, children: Chunk.empty() })

      // Note: Hash collisions are possible but unlikely
      expect(Hash.hash(node1)).not.toBe(Hash.hash(node2))
    })
  })

  describe("serialization", () => {
    it.effect("encodes and decodes a leaf node", () =>
      Effect.gen(function* () {
        const account = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
        const node = AccountNode.make({ account, children: Chunk.empty() })

        const encoded = yield* Schema.encode(AccountNode)(node)
        const decoded = yield* Schema.decodeUnknown(AccountNode)(encoded)

        expect(Equal.equals(node, decoded)).toBe(true)
        // Verify encoded children is an array (not Chunk) for JSON compatibility
        expect(Array.isArray(encoded.children)).toBe(true)
        expect(encoded.children).toHaveLength(0)
      })
    )

    it.effect("encodes and decodes a node with children", () =>
      Effect.gen(function* () {
        const parent = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
        const child1 = createTestAccount(UUID2, "Cash", "1100", "Asset", "CurrentAsset")
        const child2 = createTestAccount(UUID3, "AR", "1200", "Asset", "CurrentAsset")

        const childNode1 = AccountNode.make({ account: child1, children: Chunk.empty() })
        const childNode2 = AccountNode.make({ account: child2, children: Chunk.empty() })
        const parentNode = AccountNode.make({
          account: parent,
          children: Chunk.fromIterable([childNode1, childNode2])
        })

        const encoded = yield* Schema.encode(AccountNode)(parentNode)
        const decoded = yield* Schema.decodeUnknown(AccountNode)(encoded)

        expect(Equal.equals(parentNode, decoded)).toBe(true)
        // Verify encoded children is an array for JSON compatibility
        expect(Array.isArray(encoded.children)).toBe(true)
        expect(encoded.children).toHaveLength(2)
      })
    )

    it.effect("encodes to JSON-serializable format", () =>
      Effect.gen(function* () {
        const account = createTestAccount(UUID1, "Cash", "1000", "Asset", "CurrentAsset")
        const node = AccountNode.make({ account, children: Chunk.empty() })

        const encoded = yield* Schema.encode(AccountNode)(node)

        // Should be JSON serializable (round-trip through JSON)
        const jsonString = JSON.stringify(encoded)
        const parsed = JSON.parse(jsonString)
        const decoded = yield* Schema.decodeUnknown(AccountNode)(parsed)

        expect(Equal.equals(node, decoded)).toBe(true)
      })
    )

    it.effect("encodes deeply nested tree to JSON", () =>
      Effect.gen(function* () {
        const accounts = createTestHierarchy()
        const tree = buildAccountTree(accounts)

        // Encode all root nodes
        for (const rootNode of tree) {
          const encoded = yield* Schema.encode(AccountNode)(rootNode)
          const jsonString = JSON.stringify(encoded)
          const parsed = JSON.parse(jsonString)
          const decoded = yield* Schema.decodeUnknown(AccountNode)(parsed)

          expect(Equal.equals(rootNode, decoded)).toBe(true)
        }
      })
    )
  })
})

describe("Error types", () => {
  describe("AccountTypeMismatchError", () => {
    it("creates error with correct message", () => {
      const error = new AccountTypeMismatchError({
        childAccountId: AccountId.make(UUID1),
        childAccountType: "Liability",
        parentAccountId: AccountId.make(UUID2),
        parentAccountType: "Asset"
      })

      expect(error._tag).toBe("AccountTypeMismatchError")
      expect(error.message).toContain("type mismatch")
      expect(error.message).toContain(UUID1)
      expect(error.message).toContain("Liability")
      expect(error.message).toContain(UUID2)
      expect(error.message).toContain("Asset")
    })

    it("isAccountTypeMismatchError returns true for error instances", () => {
      const error = new AccountTypeMismatchError({
        childAccountId: AccountId.make(UUID1),
        childAccountType: "Liability",
        parentAccountId: AccountId.make(UUID2),
        parentAccountType: "Asset"
      })
      expect(isAccountTypeMismatchError(error)).toBe(true)
    })
  })

  describe("ParentAccountNotFoundError", () => {
    it("creates error with correct message", () => {
      const error = new ParentAccountNotFoundError({
        childAccountId: AccountId.make(UUID1),
        parentAccountId: AccountId.make(UUID2)
      })

      expect(error._tag).toBe("ParentAccountNotFoundError")
      expect(error.message).toContain("not found")
      expect(error.message).toContain(UUID2)
    })

    it("isParentAccountNotFoundError returns true for error instances", () => {
      const error = new ParentAccountNotFoundError({
        childAccountId: AccountId.make(UUID1),
        parentAccountId: AccountId.make(UUID2)
      })
      expect(isParentAccountNotFoundError(error)).toBe(true)
    })
  })

  describe("CircularReferenceError", () => {
    it("creates error with correct message", () => {
      const error = new CircularReferenceError({
        accountId: AccountId.make(UUID1),
        ancestorChain: Chunk.make(AccountId.make(UUID1), AccountId.make(UUID2), AccountId.make(UUID1))
      })

      expect(error._tag).toBe("CircularReferenceError")
      expect(error.message).toContain("Circular reference")
      expect(error.message).toContain(UUID1)
    })

    it("isCircularReferenceError returns true for error instances", () => {
      const error = new CircularReferenceError({
        accountId: AccountId.make(UUID1),
        ancestorChain: Chunk.empty()
      })
      expect(isCircularReferenceError(error)).toBe(true)
    })
  })
})

describe("validateParentChildType", () => {
  it("returns Right when types match", () => {
    const parent = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
    const child = createTestAccount(UUID2, "Cash", "1100", "Asset", "CurrentAsset")

    const result = validateParentChildType(child, parent)

    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.id).toBe(child.id)
    }
  })

  it("returns Left when types do not match", () => {
    const parent = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
    const child = createTestAccount(UUID2, "Revenue", "4000", "Revenue", "OperatingRevenue")

    const result = validateParentChildType(child, parent)

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("AccountTypeMismatchError")
      expect(result.left.childAccountType).toBe("Revenue")
      expect(result.left.parentAccountType).toBe("Asset")
    }
  })

  it("allows different categories within same type", () => {
    const parent = createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")
    const child = createTestAccount(UUID2, "Equipment", "1500", "Asset", "FixedAsset")

    const result = validateParentChildType(child, parent)

    expect(Either.isRight(result)).toBe(true)
  })
})

describe("findAccountById", () => {
  it("returns Some when account exists", () => {
    const accounts = createTestHierarchy()
    const result = findAccountById(accounts, AccountId.make(UUID1))

    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.name).toBe("Assets")
    }
  })

  it("returns None when account does not exist", () => {
    const accounts = createTestHierarchy()
    const result = findAccountById(accounts, AccountId.make("99999999-9999-9999-9999-999999999999"))

    expect(Option.isNone(result)).toBe(true)
  })

  it("returns None for empty array", () => {
    const result = findAccountById([], AccountId.make(UUID1))
    expect(Option.isNone(result)).toBe(true)
  })
})

describe("getDirectChildren", () => {
  it("returns direct children of an account", () => {
    const accounts = createTestHierarchy()
    const children = getDirectChildren(accounts, AccountId.make(UUID1))

    expect(children).toHaveLength(2)
    expect(children.map((c) => c.name)).toContain("Current Assets")
    expect(children.map((c) => c.name)).toContain("Fixed Assets")
  })

  it("returns empty array for leaf account", () => {
    const accounts = createTestHierarchy()
    const children = getDirectChildren(accounts, AccountId.make(UUID3)) // Cash

    expect(children).toHaveLength(0)
  })

  it("returns empty array for non-existent account", () => {
    const accounts = createTestHierarchy()
    const children = getDirectChildren(accounts, AccountId.make("99999999-9999-9999-9999-999999999999"))

    expect(children).toHaveLength(0)
  })
})

describe("getDescendants", () => {
  it("returns all descendants of a root account", () => {
    const accounts = createTestHierarchy()
    const descendants = getDescendants(accounts, AccountId.make(UUID1))

    expect(descendants).toHaveLength(5) // Current Assets, Cash, AR, Fixed Assets, Equipment
    expect(descendants.map((d) => d.name)).toContain("Current Assets")
    expect(descendants.map((d) => d.name)).toContain("Cash")
    expect(descendants.map((d) => d.name)).toContain("Accounts Receivable")
    expect(descendants.map((d) => d.name)).toContain("Fixed Assets")
    expect(descendants.map((d) => d.name)).toContain("Equipment")
  })

  it("returns descendants of intermediate account", () => {
    const accounts = createTestHierarchy()
    const descendants = getDescendants(accounts, AccountId.make(UUID2)) // Current Assets

    expect(descendants).toHaveLength(2) // Cash, AR
    expect(descendants.map((d) => d.name)).toContain("Cash")
    expect(descendants.map((d) => d.name)).toContain("Accounts Receivable")
  })

  it("returns empty array for leaf account", () => {
    const accounts = createTestHierarchy()
    const descendants = getDescendants(accounts, AccountId.make(UUID3)) // Cash

    expect(descendants).toHaveLength(0)
  })

  it("returns empty array for non-existent account", () => {
    const accounts = createTestHierarchy()
    const descendants = getDescendants(accounts, AccountId.make("99999999-9999-9999-9999-999999999999"))

    expect(descendants).toHaveLength(0)
  })
})

describe("getAncestors", () => {
  it("returns all ancestors of a leaf account", () => {
    const accounts = createTestHierarchy()
    const ancestors = getAncestors(accounts, AccountId.make(UUID3)) // Cash

    expect(ancestors).toHaveLength(2) // Current Assets, Assets
    expect(ancestors[0].name).toBe("Current Assets") // Immediate parent first
    expect(ancestors[1].name).toBe("Assets")
  })

  it("returns parent of intermediate account", () => {
    const accounts = createTestHierarchy()
    const ancestors = getAncestors(accounts, AccountId.make(UUID2)) // Current Assets

    expect(ancestors).toHaveLength(1)
    expect(ancestors[0].name).toBe("Assets")
  })

  it("returns empty array for root account", () => {
    const accounts = createTestHierarchy()
    const ancestors = getAncestors(accounts, AccountId.make(UUID1)) // Assets

    expect(ancestors).toHaveLength(0)
  })

  it("returns empty array for non-existent account", () => {
    const accounts = createTestHierarchy()
    const ancestors = getAncestors(accounts, AccountId.make("99999999-9999-9999-9999-999999999999"))

    expect(ancestors).toHaveLength(0)
  })
})

describe("getRootAncestor", () => {
  it("returns root ancestor of a deeply nested account", () => {
    const accounts = createTestHierarchy()
    const root = getRootAncestor(accounts, AccountId.make(UUID6)) // Equipment

    expect(Option.isSome(root)).toBe(true)
    if (Option.isSome(root)) {
      expect(root.value.name).toBe("Assets")
    }
  })

  it("returns None for root account", () => {
    const accounts = createTestHierarchy()
    const root = getRootAncestor(accounts, AccountId.make(UUID1)) // Assets

    expect(Option.isNone(root)).toBe(true)
  })
})

describe("isAncestorOf", () => {
  it("returns true when account is an ancestor", () => {
    const accounts = createTestHierarchy()

    expect(isAncestorOf(accounts, AccountId.make(UUID1), AccountId.make(UUID3))).toBe(true) // Assets -> Cash
    expect(isAncestorOf(accounts, AccountId.make(UUID2), AccountId.make(UUID3))).toBe(true) // Current Assets -> Cash
  })

  it("returns false when account is not an ancestor", () => {
    const accounts = createTestHierarchy()

    expect(isAncestorOf(accounts, AccountId.make(UUID3), AccountId.make(UUID1))).toBe(false) // Cash is not ancestor of Assets
    expect(isAncestorOf(accounts, AccountId.make(UUID7), AccountId.make(UUID3))).toBe(false) // Revenue is not ancestor of Cash
  })

  it("returns false for same account", () => {
    const accounts = createTestHierarchy()
    expect(isAncestorOf(accounts, AccountId.make(UUID1), AccountId.make(UUID1))).toBe(false)
  })
})

describe("isDescendantOf", () => {
  it("returns true when account is a descendant", () => {
    const accounts = createTestHierarchy()

    expect(isDescendantOf(accounts, AccountId.make(UUID3), AccountId.make(UUID1))).toBe(true) // Cash is descendant of Assets
    expect(isDescendantOf(accounts, AccountId.make(UUID3), AccountId.make(UUID2))).toBe(true) // Cash is descendant of Current Assets
  })

  it("returns false when account is not a descendant", () => {
    const accounts = createTestHierarchy()

    expect(isDescendantOf(accounts, AccountId.make(UUID1), AccountId.make(UUID3))).toBe(false) // Assets is not descendant of Cash
  })
})

describe("getDepth", () => {
  it("returns 0 for root account", () => {
    const accounts = createTestHierarchy()
    expect(getDepth(accounts, AccountId.make(UUID1))).toBe(0) // Assets
  })

  it("returns correct depth for nested accounts", () => {
    const accounts = createTestHierarchy()
    expect(getDepth(accounts, AccountId.make(UUID2))).toBe(1) // Current Assets
    expect(getDepth(accounts, AccountId.make(UUID3))).toBe(2) // Cash
    expect(getDepth(accounts, AccountId.make(UUID6))).toBe(2) // Equipment
  })

  it("returns 0 for non-existent account", () => {
    const accounts = createTestHierarchy()
    expect(getDepth(accounts, AccountId.make("99999999-9999-9999-9999-999999999999"))).toBe(0)
  })
})

describe("getRootAccounts", () => {
  it("returns all root accounts", () => {
    const accounts = createTestHierarchy()
    const roots = getRootAccounts(accounts)

    expect(roots).toHaveLength(2)
    expect(roots.map((r) => r.name)).toContain("Assets")
    expect(roots.map((r) => r.name)).toContain("Revenue")
  })

  it("returns empty array when no accounts", () => {
    expect(getRootAccounts([])).toHaveLength(0)
  })

  it("returns all accounts when none have parents", () => {
    const accounts = [
      createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset"),
      createTestAccount(UUID2, "Revenue", "4000", "Revenue", "OperatingRevenue")
    ]

    expect(getRootAccounts(accounts)).toHaveLength(2)
  })
})

describe("buildAccountTree", () => {
  it("builds a tree from flat account list", () => {
    const accounts = createTestHierarchy()
    const tree = buildAccountTree(accounts)

    expect(tree).toHaveLength(2) // Assets, Revenue

    const assetsNode = tree.find((n) => n.account.name === "Assets")
    expect(assetsNode).toBeDefined()
    expect(Chunk.size(assetsNode!.children)).toBe(2) // Current Assets, Fixed Assets

    const currentAssetsNode = Chunk.findFirst(assetsNode!.children, (n) => n.account.name === "Current Assets")
    expect(Option.isSome(currentAssetsNode)).toBe(true)
    expect(Chunk.size(Option.getOrThrow(currentAssetsNode).children)).toBe(2) // Cash, AR
  })

  it("returns empty array for empty input", () => {
    const tree = buildAccountTree([])
    expect(tree).toHaveLength(0)
  })

  it("handles single root account with no children", () => {
    const accounts = [createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset")]
    const tree = buildAccountTree(accounts)

    expect(tree).toHaveLength(1)
    expect(Chunk.size(tree[0].children)).toBe(0)
  })
})

describe("flattenTree", () => {
  it("flattens a tree back to array", () => {
    const accounts = createTestHierarchy()
    const tree = buildAccountTree(accounts)
    const flattened = flattenTree(tree)

    expect(flattened).toHaveLength(7)
    expect(flattened.map((a) => a.name)).toContain("Assets")
    expect(flattened.map((a) => a.name)).toContain("Cash")
    expect(flattened.map((a) => a.name)).toContain("Revenue")
  })

  it("returns empty array for empty tree", () => {
    expect(flattenTree([])).toHaveLength(0)
  })
})

describe("validateHierarchy", () => {
  it("returns Right for valid hierarchy", () => {
    const accounts = createTestHierarchy()
    const result = validateHierarchy(accounts)

    expect(Either.isRight(result)).toBe(true)
  })

  it("returns Left with ParentAccountNotFoundError for missing parent", () => {
    const accounts = [
      createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset"),
      createTestAccount(
        UUID2,
        "Cash",
        "1100",
        "Asset",
        "CurrentAsset",
        Option.some(AccountId.make("99999999-9999-9999-9999-999999999999")), // Non-existent parent
        2
      )
    ]

    const result = validateHierarchy(accounts)

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left.some((e) => e._tag === "ParentAccountNotFoundError")).toBe(true)
    }
  })

  it("returns Left with AccountTypeMismatchError for type mismatch", () => {
    const accounts = [
      createTestAccount(UUID1, "Assets", "1000", "Asset", "CurrentAsset"),
      createTestAccount(
        UUID2,
        "Revenue",
        "4000",
        "Revenue", // Different type than parent
        "OperatingRevenue",
        Option.some(AccountId.make(UUID1)),
        2
      )
    ]

    const result = validateHierarchy(accounts)

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left.some((e) => e._tag === "AccountTypeMismatchError")).toBe(true)
    }
  })

  it("returns Left with CircularReferenceError for circular reference", () => {
    // Create a circular reference: A -> B -> A
    // Account A has parent B, Account B has parent A
    const accounts = [
      createTestAccount(
        UUID1,
        "Account A",
        "1000",
        "Asset",
        "CurrentAsset",
        Option.some(AccountId.make(UUID2)), // A's parent is B
        2
      ),
      createTestAccount(
        UUID2,
        "Account B",
        "1100",
        "Asset",
        "CurrentAsset",
        Option.some(AccountId.make(UUID1)), // B's parent is A
        2
      )
    ]

    const result = validateHierarchy(accounts)

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left.some((e) => e._tag === "CircularReferenceError")).toBe(true)
    }
  })

  it("returns Left with CircularReferenceError for self-referencing account", () => {
    // Create an account that references itself as parent
    const accounts = [
      createTestAccount(
        UUID1,
        "Self Referencing",
        "1000",
        "Asset",
        "CurrentAsset",
        Option.some(AccountId.make(UUID1)), // References itself
        1
      )
    ]

    const result = validateHierarchy(accounts)

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left.some((e) => e._tag === "CircularReferenceError")).toBe(true)
    }
  })
})

describe("getSiblings", () => {
  it("returns siblings of an account", () => {
    const accounts = createTestHierarchy()
    const siblings = getSiblings(accounts, AccountId.make(UUID3)) // Cash

    expect(siblings).toHaveLength(1)
    expect(siblings[0].name).toBe("Accounts Receivable")
  })

  it("returns siblings for root accounts", () => {
    const accounts = createTestHierarchy()
    const siblings = getSiblings(accounts, AccountId.make(UUID1)) // Assets

    expect(siblings).toHaveLength(1)
    expect(siblings[0].name).toBe("Revenue")
  })

  it("returns empty array for non-existent account", () => {
    const accounts = createTestHierarchy()
    const siblings = getSiblings(accounts, AccountId.make("99999999-9999-9999-9999-999999999999"))

    expect(siblings).toHaveLength(0)
  })
})

describe("findByType", () => {
  it("returns all accounts of specified type", () => {
    const accounts = createTestHierarchy()
    const assetAccounts = findByType(accounts, "Asset")

    expect(assetAccounts).toHaveLength(6)
    assetAccounts.forEach((a) => expect(a.accountType).toBe("Asset"))
  })

  it("returns empty array when no accounts of type exist", () => {
    const accounts = createTestHierarchy()
    const expenseAccounts = findByType(accounts, "Expense")

    expect(expenseAccounts).toHaveLength(0)
  })
})

describe("getPath", () => {
  it("returns path from root to leaf", () => {
    const accounts = createTestHierarchy()
    const path = getPath(accounts, AccountId.make(UUID3)) // Cash

    expect(path).toHaveLength(3)
    expect(path[0].name).toBe("Assets")
    expect(path[1].name).toBe("Current Assets")
    expect(path[2].name).toBe("Cash")
  })

  it("returns single account for root", () => {
    const accounts = createTestHierarchy()
    const path = getPath(accounts, AccountId.make(UUID1)) // Assets

    expect(path).toHaveLength(1)
    expect(path[0].name).toBe("Assets")
  })

  it("returns empty array for non-existent account", () => {
    const accounts = createTestHierarchy()
    const path = getPath(accounts, AccountId.make("99999999-9999-9999-9999-999999999999"))

    expect(path).toHaveLength(0)
  })
})

// Property-based tests
describe("Property-based tests", () => {
  // Generate a valid AccountType
  const accountTypeArb: FastCheck.Arbitrary<AccountType> = FastCheck.oneof(
    FastCheck.constant("Asset" as const),
    FastCheck.constant("Liability" as const),
    FastCheck.constant("Equity" as const),
    FastCheck.constant("Revenue" as const),
    FastCheck.constant("Expense" as const)
  )

  // Generate a valid account category for a given type
  const categoryForType = (type: AccountType): AccountCategory => {
    switch (type) {
      case "Asset":
        return "CurrentAsset"
      case "Liability":
        return "CurrentLiability"
      case "Equity":
        return "RetainedEarnings"
      case "Revenue":
        return "OperatingRevenue"
      case "Expense":
        return "OperatingExpense"
    }
  }

  // Generate a unique UUID
  const uuidArb = FastCheck.uuid()

  describe("getDescendants and getAncestors are inverses", () => {
    it.prop(
      "if B is a descendant of A, then A is an ancestor of B",
      [uuidArb, uuidArb, uuidArb, accountTypeArb],
      ([rootId, childId, grandchildId, accountType]) => {
        // Skip if any IDs are the same
        if (rootId === childId || childId === grandchildId || rootId === grandchildId) {
          return true
        }

        const category = categoryForType(accountType)

        const root = createTestAccount(rootId, "Root", "1000", accountType, category)
        const child = createTestAccount(
          childId,
          "Child",
          "1100",
          accountType,
          category,
          Option.some(AccountId.make(rootId)),
          2
        )
        const grandchild = createTestAccount(
          grandchildId,
          "Grandchild",
          "1110",
          accountType,
          category,
          Option.some(AccountId.make(childId)),
          3
        )

        const accounts = [root, child, grandchild]

        // Grandchild is descendant of root
        const descendants = getDescendants(accounts, AccountId.make(rootId))
        const isDescendant = descendants.some((d) => d.id === grandchildId)

        // Root is ancestor of grandchild
        const ancestors = getAncestors(accounts, AccountId.make(grandchildId))
        const isAncestor = ancestors.some((a) => a.id === rootId)

        return isDescendant && isAncestor
      }
    )
  })

  describe("buildAccountTree and flattenTree are inverses", () => {
    it.prop(
      "flattenTree(buildAccountTree(accounts)) contains same accounts",
      [uuidArb, uuidArb, accountTypeArb],
      ([id1, id2, accountType]) => {
        if (id1 === id2) return true

        const category = categoryForType(accountType)

        const accounts = [
          createTestAccount(id1, "Root", "1000", accountType, category),
          createTestAccount(
            id2,
            "Child",
            "1100",
            accountType,
            category,
            Option.some(AccountId.make(id1)),
            2
          )
        ]

        const tree = buildAccountTree(accounts)
        const flattened = flattenTree(tree)

        // Same number of accounts
        if (flattened.length !== accounts.length) return false

        // All accounts present
        return accounts.every((acc) => flattened.some((f) => f.id === acc.id))
      }
    )
  })

  describe("getRootAccounts returns only accounts with no parent", () => {
    it.prop(
      "all root accounts have no parent",
      [uuidArb, uuidArb, accountTypeArb],
      ([id1, id2, accountType]) => {
        if (id1 === id2) return true

        const category = categoryForType(accountType)

        const accounts = [
          createTestAccount(id1, "Root", "1000", accountType, category),
          createTestAccount(
            id2,
            "Child",
            "1100",
            accountType,
            category,
            Option.some(AccountId.make(id1)),
            2
          )
        ]

        const roots = getRootAccounts(accounts)

        return roots.every((r) => Option.isNone(r.parentAccountId))
      }
    )
  })

  describe("getDepth equals length of ancestors", () => {
    it.prop(
      "depth of account equals number of ancestors",
      [uuidArb, uuidArb, uuidArb, accountTypeArb],
      ([id1, id2, id3, accountType]) => {
        if (id1 === id2 || id2 === id3 || id1 === id3) return true

        const category = categoryForType(accountType)

        const accounts = [
          createTestAccount(id1, "Root", "1000", accountType, category),
          createTestAccount(
            id2,
            "Child",
            "1100",
            accountType,
            category,
            Option.some(AccountId.make(id1)),
            2
          ),
          createTestAccount(
            id3,
            "Grandchild",
            "1110",
            accountType,
            category,
            Option.some(AccountId.make(id2)),
            3
          )
        ]

        const grandchildId = AccountId.make(id3)
        const depth = getDepth(accounts, grandchildId)
        const ancestors = getAncestors(accounts, grandchildId)

        return depth === ancestors.length
      }
    )
  })

  describe("validateParentChildType consistency", () => {
    it.prop(
      "same type always validates",
      [uuidArb, uuidArb, accountTypeArb],
      ([parentId, childId, accountType]) => {
        if (parentId === childId) return true

        const category = categoryForType(accountType)

        const parent = createTestAccount(parentId, "Parent", "1000", accountType, category)
        const child = createTestAccount(childId, "Child", "1100", accountType, category)

        const result = validateParentChildType(child, parent)
        return Either.isRight(result)
      }
    )

    it.prop(
      "different types always fail validation",
      [uuidArb, uuidArb],
      ([parentId, childId]) => {
        if (parentId === childId) return true

        const parent = createTestAccount(parentId, "Parent", "1000", "Asset", "CurrentAsset")
        const child = createTestAccount(childId, "Child", "4000", "Revenue", "OperatingRevenue")

        const result = validateParentChildType(child, parent)
        return Either.isLeft(result)
      }
    )
  })

  describe("getSiblings does not include self", () => {
    it.prop(
      "account is never in its own siblings list",
      [uuidArb, uuidArb, uuidArb, accountTypeArb],
      ([parentId, childId1, childId2, accountType]) => {
        if (parentId === childId1 || parentId === childId2 || childId1 === childId2) {
          return true
        }

        const category = categoryForType(accountType)

        const accounts = [
          createTestAccount(parentId, "Parent", "1000", accountType, category),
          createTestAccount(
            childId1,
            "Child1",
            "1100",
            accountType,
            category,
            Option.some(AccountId.make(parentId)),
            2
          ),
          createTestAccount(
            childId2,
            "Child2",
            "1200",
            accountType,
            category,
            Option.some(AccountId.make(parentId)),
            2
          )
        ]

        const siblings = getSiblings(accounts, AccountId.make(childId1))
        return !siblings.some((s) => s.id === childId1)
      }
    )
  })

  describe("getPath starts at root and ends at target", () => {
    it.prop(
      "path starts at root ancestor",
      [uuidArb, uuidArb, uuidArb, accountTypeArb],
      ([id1, id2, id3, accountType]) => {
        if (id1 === id2 || id2 === id3 || id1 === id3) return true

        const category = categoryForType(accountType)

        const accounts = [
          createTestAccount(id1, "Root", "1000", accountType, category),
          createTestAccount(
            id2,
            "Child",
            "1100",
            accountType,
            category,
            Option.some(AccountId.make(id1)),
            2
          ),
          createTestAccount(
            id3,
            "Grandchild",
            "1110",
            accountType,
            category,
            Option.some(AccountId.make(id2)),
            3
          )
        ]

        const path = getPath(accounts, AccountId.make(id3))

        if (path.length === 0) return false

        // First element should be root (no parent)
        const first = path[0]
        const isRoot = Option.isNone(first.parentAccountId)

        // Last element should be the target account
        const last = path[path.length - 1]
        const isTarget = last.id === id3

        return isRoot && isTarget
      }
    )
  })

  describe("findByType returns only accounts of that type", () => {
    it.prop("all returned accounts have matching type", [accountTypeArb], ([accountType]) => {
      const category = categoryForType(accountType)
      const otherType: AccountType = accountType === "Asset" ? "Liability" : "Asset"
      const otherCategory = categoryForType(otherType)

      const accounts = [
        createTestAccount(UUID1, "Account1", "1000", accountType, category),
        createTestAccount(UUID2, "Account2", "1100", accountType, category),
        createTestAccount(UUID3, "Account3", "2000", otherType, otherCategory)
      ]

      const found = findByType(accounts, accountType)

      return (
        found.length === 2 && found.every((a) => a.accountType === accountType)
      )
    })
  })

  describe("descendant count is consistent with getDescendants", () => {
    it.prop(
      "AccountNode.descendantCount matches getDescendants length",
      [uuidArb, uuidArb, uuidArb, accountTypeArb],
      ([id1, id2, id3, accountType]) => {
        if (id1 === id2 || id2 === id3 || id1 === id3) return true

        const category = categoryForType(accountType)

        const accounts = [
          createTestAccount(id1, "Root", "1000", accountType, category),
          createTestAccount(
            id2,
            "Child",
            "1100",
            accountType,
            category,
            Option.some(AccountId.make(id1)),
            2
          ),
          createTestAccount(
            id3,
            "Grandchild",
            "1110",
            accountType,
            category,
            Option.some(AccountId.make(id2)),
            3
          )
        ]

        const tree = buildAccountTree(accounts)
        const rootNode = tree[0]

        const descendantsViaFunction = getDescendants(accounts, rootNode.account.id)
        const descendantCountViaProperty = rootNode.descendantCount

        return descendantsViaFunction.length === descendantCountViaProperty
      }
    )
  })
})
