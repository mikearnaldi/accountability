/**
 * Companies Page Route
 *
 * Route: /companies
 *
 * Displays a list of organizations and their companies with:
 * - Organization selector
 * - Company list with links to Chart of Accounts
 * - Company details summary
 *
 * @module routes/companies
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import type { Company } from "@accountability/core/Domains/Company"
import type { OrganizationId } from "@accountability/core/Domains/Organization"
import { OrganizationId as OrganizationIdSchema } from "@accountability/core/Domains/Organization"
import { ApiClient } from "../atoms/ApiClient.ts"
import { organizationsAtom } from "../atoms/companies.ts"
import { AuthGuard } from "../components/AuthGuard.tsx"

export const Route = createFileRoute("/companies")({
  component: CompaniesWithAuth,
  beforeLoad: async () => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: "/companies" },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function CompaniesWithAuth(): React.ReactElement {
  return (
    <AuthGuard redirectTo="/companies">
      <Companies />
    </AuthGuard>
  )
}

// =============================================================================
// Atoms
// =============================================================================

/**
 * Selected organization ID atom
 */
const selectedOrganizationIdAtom = Atom.make<OrganizationId | null>(null)

/**
 * Companies list for selected organization
 */
const createCompaniesQueryAtom = (organizationId: OrganizationId) => {
  return ApiClient.query("companies", "listCompanies", {
    urlParams: {
      organizationId,
      limit: 100,
      offset: 0
    },
    timeToLive: Duration.minutes(5)
  })
}

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "1000px",
  margin: "0 auto"
}

const sectionStyles: React.CSSProperties = {
  marginBottom: "2rem"
}

const selectStyles: React.CSSProperties = {
  padding: "0.5rem",
  borderRadius: "4px",
  border: "1px solid #ccc",
  minWidth: "300px",
  fontSize: "14px"
}

const cardStyles: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "1rem",
  marginBottom: "1rem",
  backgroundColor: "#fafafa"
}

const cardHeaderStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "0.5rem"
}

const cardTitleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 600
}

const cardSubtitleStyles: React.CSSProperties = {
  color: "#666",
  fontSize: "14px",
  margin: "0.25rem 0"
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
  fontWeight: 500
}

const metaGridStyles: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.5rem",
  marginTop: "0.5rem"
}

const metaItemStyles: React.CSSProperties = {
  fontSize: "13px"
}

const metaLabelStyles: React.CSSProperties = {
  color: "#666",
  display: "block"
}

const emptyStateStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#666"
}

// =============================================================================
// Components
// =============================================================================

/**
 * Company Card Component
 */
function CompanyCard({ company }: { readonly company: Company }): React.ReactElement {
  return (
    <div style={cardStyles}>
      <div style={cardHeaderStyles}>
        <div>
          <h3 style={cardTitleStyles}>{company.name}</h3>
          <p style={cardSubtitleStyles}>{company.legalName}</p>
        </div>
        <span style={badgeStyles(company.isActive)}>
          {company.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div style={metaGridStyles}>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Jurisdiction</span>
          <span>{company.jurisdiction}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Functional Currency</span>
          <span>{company.functionalCurrency}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Reporting Currency</span>
          <span>{company.reportingCurrency}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Fiscal Year End</span>
          <span>{company.fiscalYearEnd.month}/{company.fiscalYearEnd.day}</span>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <Link
          to="/companies/$companyId/accounts"
          params={{ companyId: company.id }}
          style={linkButtonStyles}
        >
          View Chart of Accounts
        </Link>
      </div>
    </div>
  )
}

/**
 * Companies List Component
 */
function CompaniesList({ organizationId }: { readonly organizationId: OrganizationId }): React.ReactElement {
  const companiesQueryAtom = React.useMemo(
    () => createCompaniesQueryAtom(organizationId),
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
      <div style={{ ...emptyStateStyles, color: "#ff4d4f" }}>
        Error loading companies. Please try again.
      </div>
    )
  }

  const companies = companiesResult.value.companies

  if (companies.length === 0) {
    return (
      <div style={emptyStateStyles}>
        No companies found for this organization.
        Create your first company to get started.
      </div>
    )
  }

  return (
    <div>
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

function Companies(): React.ReactElement {
  const [selectedOrgId, setSelectedOrgId] = useAtom(selectedOrganizationIdAtom)
  const orgsResult = useAtomValue(organizationsAtom)

  // Loading state
  const isLoading = Result.isInitial(orgsResult) || Result.isWaiting(orgsResult)
  const hasError = Result.isFailure(orgsResult)
  const organizations = Result.isSuccess(orgsResult) ? orgsResult.value.organizations : []

  // Auto-select first organization when loaded
  React.useEffect(() => {
    if (selectedOrgId === null && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id)
    }
  }, [organizations, selectedOrgId, setSelectedOrgId])

  return (
    <div style={pageStyles}>
      <h1>Companies</h1>
      <p style={{ color: "#666" }}>
        Manage your companies and access their Chart of Accounts.
      </p>

      {isLoading && (
        <div style={emptyStateStyles}>
          Loading organizations...
        </div>
      )}

      {hasError && (
        <div style={{ ...emptyStateStyles, color: "#ff4d4f" }}>
          Error loading organizations. Please try again.
        </div>
      )}

      {!isLoading && !hasError && (
        <>
          <section style={sectionStyles}>
            <h2>Select Organization</h2>
            {organizations.length === 0 ? (
              <p style={{ color: "#666" }}>
                No organizations found. Create an organization to get started.
              </p>
            ) : (
              <select
                value={selectedOrgId ?? ""}
                onChange={e => {
                  const value = e.target.value
                  setSelectedOrgId(value ? OrganizationIdSchema.make(value) : null)
                }}
                style={selectStyles}
              >
                <option value="">Select an organization...</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.reportingCurrency})
                  </option>
                ))}
              </select>
            )}
          </section>

          {selectedOrgId && (
            <section style={sectionStyles}>
              <h2>Companies</h2>
              <CompaniesList organizationId={selectedOrgId} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
