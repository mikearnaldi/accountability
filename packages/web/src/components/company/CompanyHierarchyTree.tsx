/**
 * CompanyHierarchyTree component
 *
 * Displays companies in a tree structure showing parent/subsidiary hierarchy.
 * Features:
 * - Tree view with expandable nodes
 * - Indentation for subsidiaries
 * - Columns: Name, Legal Name, Jurisdiction, Functional Currency, Status
 * - Shows ownership % and consolidation method for subsidiaries
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { useState, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table"

// =============================================================================
// Types
// =============================================================================

export interface Company {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly legalName: string
  readonly jurisdiction: string
  readonly taxId: string | null
  readonly functionalCurrency: string
  readonly reportingCurrency: string
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
  readonly parentCompanyId: string | null
  readonly ownershipPercentage: number | null
  readonly isActive: boolean
  readonly createdAt: {
    readonly epochMillis: number
  }
}

interface CompanyNode {
  readonly company: Company
  readonly children: CompanyNode[]
  readonly depth: number
}

interface CompanyHierarchyTreeProps {
  /** List of companies */
  readonly companies: readonly Company[]
  /** Organization ID for navigation */
  readonly organizationId: string
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build a tree structure from a flat list of companies
 */
function buildCompanyTree(companies: readonly Company[]): CompanyNode[] {
  // Create a map for quick lookup
  const companyMap = new Map<string, Company>()
  for (const company of companies) {
    companyMap.set(company.id, company)
  }

  // Find root companies (no parent)
  const rootCompanies: Company[] = []
  const childrenMap = new Map<string, Company[]>()

  for (const company of companies) {
    if (company.parentCompanyId === null) {
      rootCompanies.push(company)
    } else {
      const siblings = childrenMap.get(company.parentCompanyId) ?? []
      siblings.push(company)
      childrenMap.set(company.parentCompanyId, siblings)
    }
  }

  // Build tree recursively
  function buildNode(company: Company, depth: number): CompanyNode {
    const children = childrenMap.get(company.id) ?? []
    return {
      company,
      depth,
      children: children
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => buildNode(child, depth + 1))
    }
  }

  return rootCompanies
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((company) => buildNode(company, 0))
}

/**
 * Flatten tree to array for rendering
 */
function flattenTree(nodes: CompanyNode[]): CompanyNode[] {
  const result: CompanyNode[] = []

  function traverse(node: CompanyNode) {
    result.push(node)
    for (const child of node.children) {
      traverse(child)
    }
  }

  for (const node of nodes) {
    traverse(node)
  }

  return result
}


// =============================================================================
// CompanyHierarchyTree Component
// =============================================================================

export function CompanyHierarchyTree({
  companies,
  organizationId,
  className,
  "data-testid": testId = "company-hierarchy-tree"
}: CompanyHierarchyTreeProps) {
  // Track expanded state for parent nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // By default, expand all parent nodes
    const expanded = new Set<string>()
    for (const company of companies) {
      // Check if this company has children
      const hasChildren = companies.some((c) => c.parentCompanyId === company.id)
      if (hasChildren) {
        expanded.add(company.id)
      }
    }
    return expanded
  })

  // Build and flatten tree
  const tree = useMemo(() => buildCompanyTree(companies), [companies])
  const flatNodes = useMemo(() => flattenTree(tree), [tree])

  // Filter out collapsed children
  const visibleNodes = useMemo(() => {
    const visible: CompanyNode[] = []

    for (const node of flatNodes) {
      // Always show root nodes
      if (node.depth === 0) {
        visible.push(node)
        continue
      }

      // Check if all ancestors are expanded
      let parentId = node.company.parentCompanyId
      let allAncestorsExpanded = true

      while (parentId !== null) {
        if (!expandedIds.has(parentId)) {
          allAncestorsExpanded = false
          break
        }
        const parent = companies.find((c) => c.id === parentId)
        parentId = parent?.parentCompanyId ?? null
      }

      if (allAncestorsExpanded) {
        visible.push(node)
      }
    }

    return visible
  }, [flatNodes, expandedIds, companies])

  const toggleExpanded = (companyId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) {
        next.delete(companyId)
      } else {
        next.add(companyId)
      }
      return next
    })
  }

  return (
    <div className={className} data-testid={testId}>
      <Table stickyHeader>
        <TableHeader data-testid="company-hierarchy-header">
          <TableRow>
            <TableHeaderCell
              data-testid="header-name"
              tooltip="Short name used to identify the company within the organization"
            >
              Name
            </TableHeaderCell>
            <TableHeaderCell
              data-testid="header-legal-name"
              tooltip="Official registered name of the legal entity"
            >
              Legal Name
            </TableHeaderCell>
            <TableHeaderCell
              data-testid="header-jurisdiction"
              tooltip="Country or region where the company is legally registered"
            >
              Jurisdiction
            </TableHeaderCell>
            <TableHeaderCell
              data-testid="header-currency"
              tooltip="Primary currency used for the company's day-to-day transactions and financial records"
            >
              Functional Currency
            </TableHeaderCell>
            <TableHeaderCell
              data-testid="header-status"
              tooltip="Current state: Active companies can receive transactions, Inactive companies are disabled"
            >
              Status
            </TableHeaderCell>
            <TableHeaderCell
              data-testid="header-ownership"
              tooltip="Percentage of the subsidiary owned by its parent company"
            >
              Ownership
            </TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody data-testid="company-hierarchy-body">
          {visibleNodes.map((node) => {
            const hasChildren = companies.some(
              (c) => c.parentCompanyId === node.company.id
            )
            const isExpanded = expandedIds.has(node.company.id)
            const isSubsidiary = node.company.parentCompanyId !== null

            return (
              <CompanyRow
                key={node.company.id}
                node={node}
                organizationId={organizationId}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                isSubsidiary={isSubsidiary}
                onToggle={() => toggleExpanded(node.company.id)}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// =============================================================================
// CompanyRow Component
// =============================================================================

interface CompanyRowProps {
  readonly node: CompanyNode
  readonly organizationId: string
  readonly hasChildren: boolean
  readonly isExpanded: boolean
  readonly isSubsidiary: boolean
  readonly onToggle: () => void
}

function CompanyRow({
  node,
  organizationId,
  hasChildren,
  isExpanded,
  isSubsidiary,
  onToggle
}: CompanyRowProps) {
  const { company, depth } = node
  const indentPx = depth * 24 // 24px per level

  return (
    <TableRow data-testid={`company-row-${company.id}`}>
      {/* Name with hierarchy indent */}
      <TableCell data-testid={`company-name-${company.id}`}>
        <div
          className="flex items-center"
          style={{ paddingLeft: `${indentPx}px` }}
        >
          {/* Expand/Collapse button for parents */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggle()
              }}
              className="mr-2 flex h-5 w-5 items-center justify-center rounded hover:bg-gray-100"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              data-testid={`company-expand-${company.id}`}
            >
              <svg
                className={clsx(
                  "h-4 w-4 text-gray-500 transition-transform",
                  isExpanded && "rotate-90"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          ) : (
            // Placeholder for alignment
            <span className="mr-2 w-5" />
          )}

          {/* Company name link */}
          <Link
            to="/organizations/$organizationId/companies/$companyId"
            params={{ organizationId, companyId: company.id }}
            className="font-medium text-gray-900 hover:text-blue-600"
          >
            {company.name}
          </Link>
        </div>
      </TableCell>

      {/* Legal Name */}
      <TableCell data-testid={`company-legal-name-${company.id}`}>
        <span className="text-gray-600">{company.legalName}</span>
      </TableCell>

      {/* Jurisdiction */}
      <TableCell data-testid={`company-jurisdiction-${company.id}`}>
        <span className="text-gray-900">{company.jurisdiction}</span>
      </TableCell>

      {/* Functional Currency */}
      <TableCell data-testid={`company-currency-${company.id}`}>
        <span className="font-mono text-gray-900">
          {company.functionalCurrency}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell data-testid={`company-status-${company.id}`}>
        <span
          className={clsx(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            company.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          )}
        >
          {company.isActive ? "Active" : "Inactive"}
        </span>
      </TableCell>

      {/* Ownership (only for subsidiaries) */}
      <TableCell data-testid={`company-ownership-${company.id}`}>
        {isSubsidiary && company.ownershipPercentage !== null ? (
          <span className="text-gray-900">{company.ownershipPercentage}%</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

// =============================================================================
// Exports
// =============================================================================

export { buildCompanyTree, flattenTree }
