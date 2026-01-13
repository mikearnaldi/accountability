/**
 * Organization Details Page Route
 *
 * Route: /organizations/:organizationId
 *
 * Displays detailed information about a single organization:
 * - Organization name and settings
 * - List of companies in the organization
 * - Edit organization settings
 *
 * @module routes/organizations/$organizationId
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import type { Company as CompanyType } from "@accountability/core/Domains/Company"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { organizationByIdFamily } from "../../atoms/companies.ts"
import { ApiClient } from "../../atoms/ApiClient.ts"
import { AuthGuard } from "../../components/AuthGuard.tsx"

export const Route = createFileRoute("/organizations/$organizationId")({
  component: OrganizationDetailsWithAuth,
  beforeLoad: async () => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: window.location.pathname },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function OrganizationDetailsWithAuth(): React.ReactElement {
  const { organizationId } = Route.useParams()
  return (
    <AuthGuard redirectTo={`/organizations/${organizationId}`}>
      <OrganizationDetails />
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

const companyCardStyles: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "1rem",
  marginBottom: "0.75rem",
  backgroundColor: "#fff"
}

const companyCardHeaderStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
}

const companyNameStyles: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 500
}

const badgeStyles = (isActive: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "12px",
  backgroundColor: isActive ? "#e6fffb" : "#fff1f0",
  color: isActive ? "#13c2c2" : "#ff4d4f"
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
  marginTop: "0.5rem"
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
// Components
// =============================================================================

/**
 * Company Card Component
 */
function CompanyCard({ company }: { readonly company: CompanyType }): React.ReactElement {
  return (
    <div style={companyCardStyles} data-testid={`company-card-${company.id}`}>
      <div style={companyCardHeaderStyles}>
        <div>
          <h4 style={companyNameStyles}>{company.name}</h4>
          <span style={{ color: "#666", fontSize: "13px" }}>{company.legalName}</span>
        </div>
        <span style={badgeStyles(company.isActive)}>
          {company.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div style={{ marginTop: "0.5rem", fontSize: "13px", color: "#666" }}>
        <span>Jurisdiction: {company.jurisdiction}</span>
        <span style={{ marginLeft: "1rem" }}>Currency: {company.functionalCurrency}</span>
      </div>
      <Link
        to="/companies/$companyId/accounts"
        params={{ companyId: company.id }}
        style={linkButtonStyles}
      >
        View Chart of Accounts
      </Link>
    </div>
  )
}

/**
 * Companies List Component
 */
function CompaniesList({ organizationId }: { readonly organizationId: string }): React.ReactElement {
  const companiesQueryAtom = React.useMemo(
    () => ApiClient.query("companies", "listCompanies", {
      urlParams: {
        organizationId,
        limit: 100,
        offset: 0
      },
      timeToLive: Duration.minutes(5)
    }),
    [organizationId]
  )

  const companiesResult = useAtomValue(companiesQueryAtom)

  if (Result.isInitial(companiesResult) || Result.isWaiting(companiesResult)) {
    return (
      <div style={emptyStateStyles}>
        Loading companies...
      </div>
    )
  }

  if (Result.isFailure(companiesResult)) {
    return (
      <div style={errorStyles} role="alert">
        Error loading companies. Please try again.
      </div>
    )
  }

  const companies = companiesResult.value.companies

  if (companies.length === 0) {
    return (
      <div style={emptyStateStyles} data-testid="no-companies-message">
        No companies found in this organization.
        <br />
        Go to the Companies page to create your first company.
      </div>
    )
  }

  return (
    <div data-testid="companies-list">
      {companies.map(company => (
        <CompanyCard key={company.id} company={company} />
      ))}
      <p style={{ color: "#666", fontSize: "14px" }}>
        Showing {companies.length} of {companiesResult.value.total} companies
      </p>
    </div>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function OrganizationDetails(): React.ReactElement {
  const { organizationId } = Route.useParams()

  const orgAtom = React.useMemo(
    () => organizationByIdFamily(OrganizationId.make(organizationId)),
    [organizationId]
  )

  const orgResult = useAtomValue(orgAtom)

  // Loading state
  const isLoading = Result.isInitial(orgResult) || Result.isWaiting(orgResult)
  const hasError = Result.isFailure(orgResult)
  const organization = Result.isSuccess(orgResult) ? orgResult.value : null

  if (isLoading) {
    return (
      <div style={pageStyles}>
        <div style={emptyStateStyles} data-testid="organization-loading">
          Loading organization details...
        </div>
      </div>
    )
  }

  if (hasError) {
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

  if (!organization) {
    return (
      <div style={pageStyles}>
        <div style={errorStyles} role="alert">
          Organization data not available.
        </div>
      </div>
    )
  }

  const createdDate = organization.createdAt.toDate().toLocaleDateString()

  return (
    <div style={pageStyles} data-testid="organization-details-page">
      <div style={breadcrumbStyles}>
        <Link to="/organizations" style={breadcrumbLinkStyles}>Organizations</Link>
        <span> / </span>
        <span>{organization.name}</span>
      </div>

      <h1 data-testid="organization-name">{organization.name}</h1>

      <section style={sectionStyles}>
        <h2>Organization Details</h2>
        <div style={cardStyles} data-testid="organization-info">
          <div style={detailGridStyles}>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Organization ID</span>
              <span data-testid="org-id">{organization.id}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Reporting Currency</span>
              <span data-testid="org-currency">{organization.reportingCurrency}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Created</span>
              <span data-testid="org-created">{createdDate}</span>
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyles}>
        <h2>Settings</h2>
        <div style={cardStyles} data-testid="organization-settings">
          <div style={detailGridStyles}>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Default Locale</span>
              <span data-testid="org-locale">{organization.settings.defaultLocale}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Default Timezone</span>
              <span data-testid="org-timezone">{organization.settings.defaultTimezone}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Use Fiscal Year</span>
              <span data-testid="org-fiscal-year">{organization.settings.useFiscalYear ? "Yes" : "No"}</span>
            </div>
            <div style={detailItemStyles}>
              <span style={detailLabelStyles}>Decimal Places</span>
              <span data-testid="org-decimal-places">{organization.settings.defaultDecimalPlaces}</span>
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyles}>
        <h2>Companies</h2>
        <CompaniesList organizationId={organizationId} />
      </section>
    </div>
  )
}
