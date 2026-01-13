/**
 * Companies List Page Route for Organization
 *
 * Route: /organizations/:organizationId/companies
 *
 * Displays a list of companies for a specific organization with:
 * - Companies list with name, legal name, and status
 * - Create new company button/form
 * - Links to company details
 *
 * @module routes/organizations/$organizationId/companies.index
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import type { Company } from "@accountability/core/Domains/Company"
import { FiscalYearEnd } from "@accountability/core/Domains/Company"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import { JurisdictionCode } from "@accountability/core/Domains/JurisdictionCode"
import { ApiClient } from "../../../atoms/ApiClient.ts"
import { organizationByIdFamily, createCompanyMutation } from "../../../atoms/companies.ts"
import { AuthGuard } from "../../../components/AuthGuard.tsx"

export const Route = createFileRoute("/organizations/$organizationId/companies/")({
  component: CompaniesListWithAuth,
  beforeLoad: async ({ params }) => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: `/organizations/${params.organizationId}/companies` },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function CompaniesListWithAuth(): React.ReactElement {
  const { organizationId } = Route.useParams()
  return (
    <AuthGuard redirectTo={`/organizations/${organizationId}/companies`}>
      <CompaniesList />
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
  alignItems: "center",
  marginBottom: "1.5rem"
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

const buttonStyles: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "4px",
  backgroundColor: "#52c41a",
  color: "white",
  border: "none",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer"
}

const emptyStateStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#666",
  backgroundColor: "#fafafa",
  borderRadius: "8px",
  border: "1px dashed #d9d9d9"
}

const formStyles: React.CSSProperties = {
  border: "1px solid #d9d9d9",
  borderRadius: "8px",
  padding: "1.5rem",
  marginBottom: "2rem",
  backgroundColor: "#fff"
}

const inputStyles: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: "4px",
  border: "1px solid #d9d9d9",
  fontSize: "14px",
  marginBottom: "1rem",
  boxSizing: "border-box"
}

const selectStyles: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: "4px",
  border: "1px solid #d9d9d9",
  fontSize: "14px",
  marginBottom: "1rem",
  boxSizing: "border-box"
}

const labelStyles: React.CSSProperties = {
  display: "block",
  marginBottom: "0.25rem",
  fontSize: "14px",
  fontWeight: 500
}

const errorStyles: React.CSSProperties = {
  color: "#ff4d4f",
  fontSize: "14px",
  marginBottom: "1rem",
  padding: "0.5rem",
  backgroundColor: "#fff2f0",
  border: "1px solid #ffccc7",
  borderRadius: "4px"
}

const formButtonsStyles: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  justifyContent: "flex-end"
}

const cancelButtonStyles: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "4px",
  backgroundColor: "#fff",
  color: "#333",
  border: "1px solid #d9d9d9",
  fontSize: "14px",
  cursor: "pointer"
}

const twoColumnStyles: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1rem"
}

// =============================================================================
// Components
// =============================================================================

/**
 * Company Card Component
 */
function CompanyCard({
  company,
  organizationId
}: {
  readonly company: Company
  readonly organizationId: string
}): React.ReactElement {
  return (
    <div style={cardStyles} data-testid={`company-card-${company.id}`}>
      <div style={cardHeaderStyles}>
        <div>
          <h3 style={cardTitleStyles} data-testid="company-name">{company.name}</h3>
          <p style={cardSubtitleStyles} data-testid="company-legal-name">{company.legalName}</p>
        </div>
        <span style={badgeStyles(company.isActive)} data-testid="company-status">
          {company.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div style={metaGridStyles}>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Jurisdiction</span>
          <span data-testid="company-jurisdiction">{company.jurisdiction}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Functional Currency</span>
          <span data-testid="company-functional-currency">{company.functionalCurrency}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Reporting Currency</span>
          <span data-testid="company-reporting-currency">{company.reportingCurrency}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Fiscal Year End</span>
          <span data-testid="company-fiscal-year-end">
            {company.fiscalYearEnd.month}/{company.fiscalYearEnd.day}
          </span>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <Link
          to="/organizations/$organizationId/companies/$companyId"
          params={{ organizationId, companyId: company.id }}
          style={linkButtonStyles}
          data-testid={`view-company-${company.id}`}
        >
          View Details
        </Link>
        <Link
          to="/companies/$companyId/accounts"
          params={{ companyId: company.id }}
          style={{ ...linkButtonStyles, backgroundColor: "#1890ff" }}
          data-testid={`view-accounts-${company.id}`}
        >
          Chart of Accounts
        </Link>
      </div>
    </div>
  )
}

/**
 * Create Company Form Component
 */
function CreateCompanyForm({
  organizationId,
  onClose,
  onSuccess
}: {
  readonly organizationId: string
  readonly onClose: () => void
  readonly onSuccess: () => void
}): React.ReactElement {
  const [name, setName] = React.useState("")
  const [legalName, setLegalName] = React.useState("")
  const [jurisdiction, setJurisdiction] = React.useState("US")
  const [taxId, setTaxId] = React.useState("")
  const [functionalCurrency, setFunctionalCurrency] = React.useState("USD")
  const [reportingCurrency, setReportingCurrency] = React.useState("USD")
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = React.useState(12)
  const [fiscalYearEndDay, setFiscalYearEndDay] = React.useState(31)
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [, runMutation] = useAtom(createCompanyMutation, { mode: "promise" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Company name is required")
      return
    }

    if (!legalName.trim()) {
      setError("Legal name is required")
      return
    }

    setIsSubmitting(true)

    try {
      await runMutation({
        payload: {
          organizationId: OrganizationId.make(organizationId),
          name: name.trim(),
          legalName: legalName.trim(),
          jurisdiction: JurisdictionCode.make(jurisdiction),
          taxId: taxId.trim() ? Option.some(taxId.trim()) : Option.none(),
          functionalCurrency: CurrencyCode.make(functionalCurrency),
          reportingCurrency: CurrencyCode.make(reportingCurrency),
          fiscalYearEnd: FiscalYearEnd.make({ month: fiscalYearEndMonth, day: fiscalYearEndDay }),
          parentCompanyId: Option.none(),
          ownershipPercentage: Option.none(),
          consolidationMethod: Option.none()
        }
      })
      // Reset form and close
      setName("")
      setLegalName("")
      setJurisdiction("US")
      setTaxId("")
      setFunctionalCurrency("USD")
      setReportingCurrency("USD")
      setFiscalYearEndMonth(12)
      setFiscalYearEndDay(31)
      onClose()
      // Trigger a refresh of the companies list
      onSuccess()
    } catch {
      setError("Failed to create company. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form style={formStyles} onSubmit={handleSubmit} data-testid="create-company-form">
      <h3 style={{ marginTop: 0 }}>Create New Company</h3>

      {error && (
        <div style={errorStyles} role="alert" data-testid="form-error">
          {error}
        </div>
      )}

      <div style={twoColumnStyles}>
        <div>
          <label htmlFor="company-name" style={labelStyles}>
            Company Name *
          </label>
          <input
            id="company-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyles}
            placeholder="Enter company name"
            disabled={isSubmitting}
            data-testid="company-name-input"
          />
        </div>

        <div>
          <label htmlFor="legal-name" style={labelStyles}>
            Legal Name *
          </label>
          <input
            id="legal-name"
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            style={inputStyles}
            placeholder="Enter legal name"
            disabled={isSubmitting}
            data-testid="legal-name-input"
          />
        </div>
      </div>

      <div style={twoColumnStyles}>
        <div>
          <label htmlFor="jurisdiction" style={labelStyles}>
            Jurisdiction
          </label>
          <select
            id="jurisdiction"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            style={selectStyles}
            disabled={isSubmitting}
            data-testid="jurisdiction-select"
          >
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="JP">Japan</option>
            <option value="CN">China</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="CH">Switzerland</option>
          </select>
        </div>

        <div>
          <label htmlFor="tax-id" style={labelStyles}>
            Tax ID (optional)
          </label>
          <input
            id="tax-id"
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            style={inputStyles}
            placeholder="Enter tax ID"
            disabled={isSubmitting}
            data-testid="tax-id-input"
          />
        </div>
      </div>

      <div style={twoColumnStyles}>
        <div>
          <label htmlFor="functional-currency" style={labelStyles}>
            Functional Currency
          </label>
          <select
            id="functional-currency"
            value={functionalCurrency}
            onChange={(e) => setFunctionalCurrency(e.target.value)}
            style={selectStyles}
            disabled={isSubmitting}
            data-testid="functional-currency-select"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="JPY">JPY - Japanese Yen</option>
            <option value="CHF">CHF - Swiss Franc</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>

        <div>
          <label htmlFor="reporting-currency" style={labelStyles}>
            Reporting Currency
          </label>
          <select
            id="reporting-currency"
            value={reportingCurrency}
            onChange={(e) => setReportingCurrency(e.target.value)}
            style={selectStyles}
            disabled={isSubmitting}
            data-testid="reporting-currency-select"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="JPY">JPY - Japanese Yen</option>
            <option value="CHF">CHF - Swiss Franc</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>
      </div>

      <div style={twoColumnStyles}>
        <div>
          <label htmlFor="fiscal-year-month" style={labelStyles}>
            Fiscal Year End Month
          </label>
          <select
            id="fiscal-year-month"
            value={fiscalYearEndMonth}
            onChange={(e) => setFiscalYearEndMonth(Number(e.target.value))}
            style={selectStyles}
            disabled={isSubmitting}
            data-testid="fiscal-year-month-select"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
              <option key={month} value={month}>
                {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="fiscal-year-day" style={labelStyles}>
            Fiscal Year End Day
          </label>
          <select
            id="fiscal-year-day"
            value={fiscalYearEndDay}
            onChange={(e) => setFiscalYearEndDay(Number(e.target.value))}
            style={selectStyles}
            disabled={isSubmitting}
            data-testid="fiscal-year-day-select"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={formButtonsStyles}>
        <button
          type="button"
          onClick={onClose}
          style={cancelButtonStyles}
          disabled={isSubmitting}
          data-testid="cancel-create-company"
        >
          Cancel
        </button>
        <button
          type="submit"
          style={buttonStyles}
          disabled={isSubmitting}
          data-testid="submit-create-company"
        >
          {isSubmitting ? "Creating..." : "Create Company"}
        </button>
      </div>
    </form>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function CompaniesList(): React.ReactElement {
  const { organizationId } = Route.useParams()
  const [showCreateForm, setShowCreateForm] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)

  // Fetch organization details
  const orgAtom = React.useMemo(
    () => organizationByIdFamily(OrganizationId.make(organizationId)),
    [organizationId]
  )
  const orgResult = useAtomValue(orgAtom)

  // Fetch companies for the organization
  const companiesQueryAtom = React.useMemo(
    () => ApiClient.query("companies", "listCompanies", {
      urlParams: {
        organizationId,
        limit: 100,
        offset: 0
      },
      timeToLive: Duration.minutes(5)
    }),
    [organizationId, refreshKey]
  )
  const companiesResult = useAtomValue(companiesQueryAtom)

  // Loading state
  const orgLoading = Result.isInitial(orgResult) || Result.isWaiting(orgResult)
  const orgError = Result.isFailure(orgResult)
  const organization = Result.isSuccess(orgResult) ? orgResult.value : null

  const companiesLoading = Result.isInitial(companiesResult) || Result.isWaiting(companiesResult)
  const companiesError = Result.isFailure(companiesResult)
  const companies = Result.isSuccess(companiesResult) ? companiesResult.value.companies : []

  const handleCreateSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (orgError) {
    return (
      <div style={pageStyles}>
        <div style={breadcrumbStyles}>
          <Link to="/organizations" style={breadcrumbLinkStyles}>Organizations</Link>
          <span> / </span>
          <span>Not Found</span>
        </div>
        <div style={{ ...emptyStateStyles, color: "#ff4d4f" }} role="alert" data-testid="organization-error">
          Organization not found or you do not have access.
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyles} data-testid="companies-list-page">
      <div style={breadcrumbStyles}>
        <Link to="/organizations" style={breadcrumbLinkStyles}>Organizations</Link>
        <span> / </span>
        {organization ? (
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
        ) : null}
        <span>Companies</span>
      </div>

      <div style={headerStyles}>
        <div>
          <h1 data-testid="page-title">Companies</h1>
          <p style={{ color: "#666", margin: 0 }}>
            Manage companies for {organization?.name ?? "this organization"}.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            style={buttonStyles}
            data-testid="create-company-button"
          >
            New Company
          </button>
        )}
      </div>

      {showCreateForm && (
        <CreateCompanyForm
          organizationId={organizationId}
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {(orgLoading || companiesLoading) && (
        <div style={emptyStateStyles} data-testid="companies-loading">
          Loading companies...
        </div>
      )}

      {companiesError && (
        <div style={{ ...emptyStateStyles, color: "#ff4d4f" }} role="alert" data-testid="companies-error">
          Error loading companies. Please try again.
        </div>
      )}

      {!orgLoading && !companiesLoading && !companiesError && companies.length === 0 && (
        <div style={emptyStateStyles} data-testid="companies-empty">
          No companies found in this organization.
          <br />
          Create your first company to get started.
        </div>
      )}

      {!orgLoading && !companiesLoading && !companiesError && companies.length > 0 && (
        <div data-testid="companies-list">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              organizationId={organizationId}
            />
          ))}
          <p style={{ color: "#666", fontSize: "14px" }}>
            Showing {companies.length} compan{companies.length !== 1 ? "ies" : "y"}
          </p>
        </div>
      )}
    </div>
  )
}
