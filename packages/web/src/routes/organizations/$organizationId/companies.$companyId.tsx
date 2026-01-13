/**
 * Company Details Page Route
 *
 * Route: /organizations/:organizationId/companies/:companyId
 *
 * Displays detailed information about a single company:
 * - Company name, legal name, and status
 * - Financial settings (currencies, fiscal year)
 * - Links to chart of accounts and other features
 *
 * @module routes/organizations/$organizationId/companies.$companyId
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { CompanyId } from "@accountability/core/Domains/Company"
import { organizationByIdFamily, companyByIdFamily } from "../../../atoms/companies.ts"
import { AuthGuard } from "../../../components/AuthGuard.tsx"

export const Route = createFileRoute("/organizations/$organizationId/companies/$companyId")({
  component: CompanyDetailsWithAuth,
  beforeLoad: async ({ params }) => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: `/organizations/${params.organizationId}/companies/${params.companyId}` },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function CompanyDetailsWithAuth(): React.ReactElement {
  const { organizationId, companyId } = Route.useParams()
  return (
    <AuthGuard redirectTo={`/organizations/${organizationId}/companies/${companyId}`}>
      <CompanyDetails />
    </AuthGuard>
  )
}

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "1000px",
  margin: "0 auto"
}

const breadcrumbStyles: React.CSSProperties = {
  marginBottom: "1rem",
  fontSize: "14px"
}

const breadcrumbLinkStyles: React.CSSProperties = {
  color: "#1890ff",
  textDecoration: "none"
}

const headerStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "1.5rem"
}

const sectionStyles: React.CSSProperties = {
  marginBottom: "2rem"
}

const cardStyles: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "1.5rem",
  backgroundColor: "#fafafa",
  marginBottom: "1rem"
}

const detailGridStyles: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1rem"
}

const detailItemStyles: React.CSSProperties = {
  fontSize: "14px"
}

const detailLabelStyles: React.CSSProperties = {
  color: "#666",
  display: "block",
  marginBottom: "0.25rem",
  fontWeight: 500
}

const badgeStyles = (isActive: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "4px",
  fontSize: "14px",
  backgroundColor: isActive ? "#e6fffb" : "#fff1f0",
  color: isActive ? "#13c2c2" : "#ff4d4f",
  fontWeight: 500
})

const linkButtonStyles: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 1rem",
  borderRadius: "4px",
  backgroundColor: "#1890ff",
  color: "white",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 500,
  marginRight: "0.5rem"
}

const secondaryLinkStyles: React.CSSProperties = {
  ...linkButtonStyles,
  backgroundColor: "#f5f5f5",
  color: "#333",
  border: "1px solid #d9d9d9"
}

const emptyStateStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#666",
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  border: "1px dashed #d9d9d9"
}

const errorStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#ff4d4f"
}

// =============================================================================
// Main Page Component
// =============================================================================

function CompanyDetails(): React.ReactElement {
  const { organizationId, companyId } = Route.useParams()

  // Fetch organization details
  const orgAtom = React.useMemo(
    () => organizationByIdFamily(OrganizationId.make(organizationId)),
    [organizationId]
  )
  const orgResult = useAtomValue(orgAtom)

  // Fetch company details
  const companyAtom = React.useMemo(
    () => companyByIdFamily(CompanyId.make(companyId)),
    [companyId]
  )
  const companyResult = useAtomValue(companyAtom)

  // Loading state
  const orgLoading = Result.isInitial(orgResult) || Result.isWaiting(orgResult)
  const orgError = Result.isFailure(orgResult)
  const organization = Result.isSuccess(orgResult) ? orgResult.value : null

  const companyLoading = Result.isInitial(companyResult) || Result.isWaiting(companyResult)
  const companyError = Result.isFailure(companyResult)
  const company = Result.isSuccess(companyResult) ? companyResult.value : null

  if (orgLoading || companyLoading) {
    return (
      <div style={pageStyles}>
        <div style={emptyStateStyles} data-testid="company-loading">
          Loading company details...
        </div>
      </div>
    )
  }

  if (orgError) {
    return (
      <div style={pageStyles}>
        <div style={breadcrumbStyles}>
          <Link to="/organizations" style={breadcrumbLinkStyles}>Organizations</Link>
          <span> / </span>
          <span>Not Found</span>
        </div>
        <div style={errorStyles} role="alert" data-testid="organization-error">
          Organization not found or you do not have access.
        </div>
      </div>
    )
  }

  if (companyError || !company) {
    return (
      <div style={pageStyles}>
        <div style={breadcrumbStyles}>
          <Link to="/organizations" style={breadcrumbLinkStyles}>Organizations</Link>
          <span> / </span>
          {organization && (
            <>
              <Link
                to="/organizations/$organizationId"
                params={{ organizationId }}
                style={breadcrumbLinkStyles}
              >
                {organization.name}
              </Link>
              <span> / </span>
              <Link
                to="/organizations/$organizationId/companies"
                params={{ organizationId }}
                style={breadcrumbLinkStyles}
              >
                Companies
              </Link>
              <span> / </span>
            </>
          )}
          <span>Not Found</span>
        </div>
        <div style={errorStyles} role="alert" data-testid="company-error">
          Company not found or you do not have access.
        </div>
      </div>
    )
  }

  const createdDate = company.createdAt.toDate().toLocaleDateString()

  return (
    <div style={pageStyles} data-testid="company-details-page">
      <div style={breadcrumbStyles}>
        <Link to="/organizations" style={breadcrumbLinkStyles}>Organizations</Link>
        <span> / </span>
        {organization && (
          <>
            <Link
              to="/organizations/$organizationId"
              params={{ organizationId }}
              style={breadcrumbLinkStyles}
            >
              {organization.name}
            </Link>
            <span> / </span>
          </>
        )}
        <Link
          to="/organizations/$organizationId/companies"
          params={{ organizationId }}
          style={breadcrumbLinkStyles}
          data-testid="breadcrumb-companies-link"
        >
          Companies
        </Link>
        <span> / </span>
        <span>{company.name}</span>
      </div>

      <div style={headerStyles}>
        <div>
          <h1 data-testid="company-name">{company.name}</h1>
          <p style={{ color: "#666", margin: 0 }} data-testid="company-legal-name">
            {company.legalName}
          </p>
        </div>
        <span style={badgeStyles(company.isActive)} data-testid="company-status">
          {company.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <section style={sectionStyles}>
        <h2>Company Details</h2>
        <div style={cardStyles} data-testid="company-info">
          <div style={detailGridStyles}>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Company ID</span>
              <span data-testid="company-id">{company.id}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Jurisdiction</span>
              <span data-testid="company-jurisdiction">{company.jurisdiction}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Tax ID</span>
              <span data-testid="company-tax-id">
                {company.taxId._tag === "Some" ? company.taxId.value : "—"}
              </span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Created</span>
              <span data-testid="company-created">{createdDate}</span>
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyles}>
        <h2>Financial Settings</h2>
        <div style={cardStyles} data-testid="financial-settings">
          <div style={detailGridStyles}>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Functional Currency</span>
              <span data-testid="company-functional-currency">{company.functionalCurrency}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Reporting Currency</span>
              <span data-testid="company-reporting-currency">{company.reportingCurrency}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Fiscal Year End</span>
              <span data-testid="company-fiscal-year-end">
                {new Date(2000, company.fiscalYearEnd.month - 1).toLocaleString('default', { month: 'long' })} {company.fiscalYearEnd.day}
              </span>
            </div>
          </div>
        </div>
      </section>

      {company.parentCompanyId._tag === "Some" && (
        <section style={sectionStyles}>
          <h2>Consolidation</h2>
          <div style={cardStyles} data-testid="consolidation-settings">
            <div style={detailGridStyles}>
              <div style={detailItemStyles}>
                <span style={detailLabelStyles}>Parent Company ID</span>
                <span data-testid="company-parent-id">{company.parentCompanyId.value}</span>
              </div>
              <div style={detailItemStyles}>
                <span style={detailLabelStyles}>Ownership Percentage</span>
                <span data-testid="company-ownership">
                  {company.ownershipPercentage._tag === "Some"
                    ? `${company.ownershipPercentage.value}%`
                    : "—"}
                </span>
              </div>
              <div style={detailItemStyles}>
                <span style={detailLabelStyles}>Consolidation Method</span>
                <span data-testid="company-consolidation-method">
                  {company.consolidationMethod._tag === "Some"
                    ? company.consolidationMethod.value
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={sectionStyles}>
        <h2>Quick Actions</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link
            to="/companies/$companyId/accounts"
            params={{ companyId: company.id }}
            style={linkButtonStyles}
            data-testid="view-accounts-link"
          >
            Chart of Accounts
          </Link>
          <Link
            to="/companies/$companyId/journal-entries/new"
            params={{ companyId: company.id }}
            style={linkButtonStyles}
            data-testid="new-journal-entry-link"
          >
            New Journal Entry
          </Link>
          <Link
            to="/companies/$companyId/reports"
            params={{ companyId: company.id }}
            style={linkButtonStyles}
            data-testid="view-reports-link"
          >
            View Reports
          </Link>
          <Link
            to="/organizations/$organizationId/companies"
            params={{ organizationId }}
            style={secondaryLinkStyles}
            data-testid="back-to-companies-link"
          >
            Back to Companies
          </Link>
        </div>
      </section>
    </div>
  )
}
