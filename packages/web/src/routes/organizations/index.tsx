/**
 * Organizations List Page Route
 *
 * Route: /organizations (index)
 *
 * Displays a list of organizations with:
 * - Organization cards with name and reporting currency
 * - Create new organization button/form
 * - Links to organization details
 *
 * @module routes/organizations/index
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtom, useAtomRefresh } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Option from "effect/Option"
import type { Organization } from "@accountability/core/Domains/Organization"
import { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import { organizationsAtom, createOrganizationMutation } from "../../atoms/companies.ts"
import { AuthGuard } from "../../components/AuthGuard.tsx"

export const Route = createFileRoute("/organizations/")({
  component: OrganizationsWithAuth,
  beforeLoad: async () => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: "/organizations" },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function OrganizationsWithAuth(): React.ReactElement {
  return (
    <AuthGuard redirectTo="/organizations">
      <Organizations />
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
  fontWeight: 500
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
  color: "#666"
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

// =============================================================================
// Components
// =============================================================================

/**
 * Organization Card Component
 */
function OrganizationCard({ organization }: { readonly organization: Organization }): React.ReactElement {
  const createdDate = organization.createdAt.toDate().toLocaleDateString()

  return (
    <div style={cardStyles} data-testid={`organization-card-${organization.id}`}>
      <div style={cardHeaderStyles}>
        <div>
          <h3 style={cardTitleStyles}>{organization.name}</h3>
          <p style={cardSubtitleStyles}>Reporting Currency: {organization.reportingCurrency}</p>
        </div>
      </div>

      <div style={metaGridStyles}>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Created</span>
          <span>{createdDate}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Locale</span>
          <span>{organization.settings.defaultLocale}</span>
        </div>
        <div style={metaItemStyles}>
          <span style={metaLabelStyles}>Timezone</span>
          <span>{organization.settings.defaultTimezone}</span>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <Link
          to="/organizations/$organizationId"
          params={{ organizationId: organization.id }}
          style={linkButtonStyles}
          data-testid={`view-organization-${organization.id}`}
        >
          View Details
        </Link>
      </div>
    </div>
  )
}

/**
 * Create Organization Form Component
 */
function CreateOrganizationForm({ onClose, onSuccess }: { readonly onClose: () => void; readonly onSuccess: () => void }): React.ReactElement {
  const [name, setName] = React.useState("")
  const [reportingCurrency, setReportingCurrency] = React.useState("USD")
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [, runMutation] = useAtom(createOrganizationMutation, { mode: "promise" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Organization name is required")
      return
    }

    setIsSubmitting(true)

    try {
      await runMutation({
        payload: {
          name: name.trim(),
          reportingCurrency: CurrencyCode.make(reportingCurrency),
          settings: Option.none()
        }
      })
      // Reset form and close
      setName("")
      setReportingCurrency("USD")
      onClose()
      // Trigger a refresh of the organizations list
      onSuccess()
    } catch {
      setError("Failed to create organization. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form style={formStyles} onSubmit={handleSubmit} data-testid="create-organization-form">
      <h3 style={{ marginTop: 0 }}>Create New Organization</h3>

      {error && (
        <div style={errorStyles} role="alert" data-testid="form-error">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="org-name" style={labelStyles}>
          Organization Name *
        </label>
        <input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyles}
          placeholder="Enter organization name"
          disabled={isSubmitting}
          data-testid="org-name-input"
        />
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

      <div style={formButtonsStyles}>
        <button
          type="button"
          onClick={onClose}
          style={cancelButtonStyles}
          disabled={isSubmitting}
          data-testid="cancel-create-org"
        >
          Cancel
        </button>
        <button
          type="submit"
          style={buttonStyles}
          disabled={isSubmitting}
          data-testid="submit-create-org"
        >
          {isSubmitting ? "Creating..." : "Create Organization"}
        </button>
      </div>
    </form>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function Organizations(): React.ReactElement {
  const [showCreateForm, setShowCreateForm] = React.useState(false)
  const orgsResult = useAtomValue(organizationsAtom)
  const refreshOrganizations = useAtomRefresh(organizationsAtom)

  // Loading state
  const isLoading = Result.isInitial(orgsResult) || Result.isWaiting(orgsResult)
  const hasError = Result.isFailure(orgsResult)
  const organizations = Result.isSuccess(orgsResult) ? orgsResult.value.organizations : []

  return (
    <div style={pageStyles}>
      <div style={headerStyles}>
        <div>
          <h1>Organizations</h1>
          <p style={{ color: "#666", margin: 0 }}>
            Manage your organizations and their settings.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            style={buttonStyles}
            data-testid="create-organization-button"
          >
            New Organization
          </button>
        )}
      </div>

      {showCreateForm && (
        <CreateOrganizationForm onClose={() => setShowCreateForm(false)} onSuccess={refreshOrganizations} />
      )}

      {isLoading && (
        <div style={emptyStateStyles} data-testid="organizations-loading">
          Loading organizations...
        </div>
      )}

      {hasError && (
        <div style={{ ...emptyStateStyles, color: "#ff4d4f" }} role="alert" data-testid="organizations-error">
          Error loading organizations. Please try again.
        </div>
      )}

      {!isLoading && !hasError && organizations.length === 0 && (
        <div style={emptyStateStyles} data-testid="organizations-empty">
          No organizations found. Create your first organization to get started.
        </div>
      )}

      {!isLoading && !hasError && organizations.length > 0 && (
        <div data-testid="organizations-list">
          {organizations.map((org) => (
            <OrganizationCard key={org.id} organization={org} />
          ))}
          <p style={{ color: "#666", fontSize: "14px" }}>
            Showing {organizations.length} organization{organizations.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  )
}
