/**
 * AccountsTree - Tree view component for displaying hierarchical accounts
 *
 * Displays accounts in a tree structure with expand/collapse functionality.
 * Shows columns: Account Number, Name, Type, Category, Normal Balance, Active
 */

import * as React from "react"
import { useState, useCallback } from "react"
import type { AccountTreeNode } from "../atoms/accounts.ts"
import { AccountRow } from "./AccountRow.tsx"

// =============================================================================
// Tree Node Component
// =============================================================================

interface TreeNodeProps {
  readonly node: AccountTreeNode
  readonly depth: number
  readonly expandedIds: ReadonlySet<string>
  readonly onToggle: (id: string) => void
  readonly onAccountClick: (id: string) => void
}

function TreeNode({
  node,
  depth,
  expandedIds,
  onToggle,
  onAccountClick
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.account.id)

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggle(node.account.id)
    },
    [node.account.id, onToggle]
  )

  const handleClick = useCallback(() => {
    onAccountClick(node.account.id)
  }, [node.account.id, onAccountClick])

  return (
    <>
      <AccountRow
        account={node.account}
        depth={depth}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={handleToggle}
        onClick={handleClick}
      />
      {hasChildren && isExpanded && (
        <div data-testid={`account-children-${node.account.id}`}>
          {node.children.map((child) => (
            <TreeNode
              key={child.account.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onAccountClick={onAccountClick}
            />
          ))}
        </div>
      )}
    </>
  )
}

// =============================================================================
// Header Row
// =============================================================================

function HeaderRow() {
  return (
    <div
      className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700"
      data-testid="accounts-header"
    >
      <div className="w-8" /> {/* Toggle button space */}
      <div className="w-24">Number</div>
      <div className="flex-1 min-w-[200px]">Name</div>
      <div className="w-24">Type</div>
      <div className="w-32">Category</div>
      <div className="w-20">Balance</div>
      <div className="w-16 text-center">Active</div>
    </div>
  )
}

// =============================================================================
// AccountsTree Component
// =============================================================================

interface AccountsTreeProps {
  readonly accounts: ReadonlyArray<AccountTreeNode>
  readonly onAccountClick: (id: string) => void
}

export function AccountsTree({ accounts, onAccountClick }: AccountsTreeProps) {
  // Track expanded state locally - default all expanded
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => {
    const ids = new Set<string>()
    const collectIds = (nodes: ReadonlyArray<AccountTreeNode>) => {
      for (const node of nodes) {
        ids.add(node.account.id)
        collectIds(node.children)
      }
    }
    collectIds(accounts)
    return ids
  })

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    const ids = new Set<string>()
    const collectIds = (nodes: ReadonlyArray<AccountTreeNode>) => {
      for (const node of nodes) {
        ids.add(node.account.id)
        collectIds(node.children)
      }
    }
    collectIds(accounts)
    setExpandedIds(ids)
  }, [accounts])

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white" data-testid="accounts-tree">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="text-sm text-gray-600">
          {accounts.length} top-level account{accounts.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="text-sm text-blue-600 hover:text-blue-800"
            data-testid="expand-all"
          >
            Expand All
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="text-sm text-blue-600 hover:text-blue-800"
            data-testid="collapse-all"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Header */}
      <HeaderRow />

      {/* Tree Rows */}
      <div className="divide-y divide-gray-100" data-testid="accounts-list">
        {accounts.map((node) => (
          <TreeNode
            key={node.account.id}
            node={node}
            depth={0}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onAccountClick={onAccountClick}
          />
        ))}
      </div>
    </div>
  )
}
