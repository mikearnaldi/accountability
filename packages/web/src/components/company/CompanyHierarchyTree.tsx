/**
 * CompanyList component
 *
 * Displays companies in a simple table.
 * Features:
 * - Columns: Name, Legal Name, Jurisdiction, Functional Currency, Status
 * - Data-testid attributes for E2E testing
 *
 * Note: Parent-subsidiary relationships are defined in Consolidation Groups,
 * not on individual companies. See the Consolidation page for hierarchy view.
 */

import { clsx } from "clsx"
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
  readonly isActive: boolean
  readonly createdAt: {
    readonly epochMillis: number
  }
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
// CompanyHierarchyTree Component
// =============================================================================

export function CompanyHierarchyTree({
  companies,
  organizationId,
  className,
  "data-testid": testId = "company-hierarchy-tree"
}: CompanyHierarchyTreeProps) {
  // Sort companies alphabetically by name
  const sortedCompanies = [...companies].sort((a, b) => a.name.localeCompare(b.name))

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
          </TableRow>
        </TableHeader>
        <TableBody data-testid="company-hierarchy-body">
          {sortedCompanies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              organizationId={organizationId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// =============================================================================
// CompanyRow Component
// =============================================================================

interface CompanyRowProps {
  readonly company: Company
  readonly organizationId: string
}

function CompanyRow({
  company,
  organizationId
}: CompanyRowProps) {
  return (
    <TableRow data-testid={`company-row-${company.id}`}>
      {/* Name */}
      <TableCell data-testid={`company-name-${company.id}`}>
        <Link
          to="/organizations/$organizationId/companies/$companyId"
          params={{ organizationId, companyId: company.id }}
          className="font-medium text-gray-900 hover:text-blue-600"
        >
          {company.name}
        </Link>
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
    </TableRow>
  )
}

