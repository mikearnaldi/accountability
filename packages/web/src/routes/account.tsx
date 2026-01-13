/**
 * Account Settings Page Route
 *
 * Route: /account
 *
 * User account settings page that displays:
 * - User profile information
 * - Linked authentication providers
 * - Account management options
 *
 * @module routes/account
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Option from "effect/Option"
import { authTokenAtom, currentUserAtom } from "../atoms/auth.ts"
import { AuthGuard } from "../components/AuthGuard.tsx"
import type { AuthProviderType } from "@accountability/core/Auth/AuthProviderType"
import type { UserIdentity } from "@accountability/core/Auth/UserIdentity"

// =============================================================================
// Route Configuration
// =============================================================================

export const Route = createFileRoute("/account")({
  component: AccountPage
})

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "800px",
  margin: "2rem auto",
  padding: "0 1rem"
}

const titleStyles: React.CSSProperties = {
  margin: "0 0 0.5rem 0",
  fontSize: "28px",
  fontWeight: 600,
  color: "#333"
}

const subtitleStyles: React.CSSProperties = {
  color: "#666",
  marginBottom: "2rem"
}

const sectionStyles: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "1.5rem",
  marginBottom: "1.5rem",
  backgroundColor: "#fff"
}

const sectionTitleStyles: React.CSSProperties = {
  margin: "0 0 1rem 0",
  fontSize: "18px",
  fontWeight: 600,
  color: "#333"
}

const fieldRowStyles: React.CSSProperties = {
  display: "flex",
  marginBottom: "0.75rem",
  paddingBottom: "0.75rem",
  borderBottom: "1px solid #f0f0f0"
}

const fieldLabelStyles: React.CSSProperties = {
  width: "120px",
  fontWeight: 500,
  color: "#666",
  fontSize: "14px"
}

const fieldValueStyles: React.CSSProperties = {
  flex: 1,
  color: "#333",
  fontSize: "14px"
}

const identitiesListStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem"
}

const identityItemStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem",
  border: "1px solid #e8e8e8",
  borderRadius: "6px",
  backgroundColor: "#fafafa"
}

const providerBadgeStyles = (provider: AuthProviderType): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600
  }

  switch (provider) {
    case "google":
      return {
        ...baseStyles,
        backgroundColor: "#e8f4fd",
        color: "#1a73e8"
      }
    case "github":
      return {
        ...baseStyles,
        backgroundColor: "#f6f8fa",
        color: "#24292e"
      }
    case "workos":
      return {
        ...baseStyles,
        backgroundColor: "#eef2ff",
        color: "#6366f1"
      }
    case "saml":
      return {
        ...baseStyles,
        backgroundColor: "#e7f3ff",
        color: "#0d6efd"
      }
    case "local":
      return {
        ...baseStyles,
        backgroundColor: "#f0f0f0",
        color: "#666"
      }
  }
}

const identityInfoStyles: React.CSSProperties = {
  flex: 1
}

const identityProviderStyles: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: "#333"
}

const identityDateStyles: React.CSSProperties = {
  fontSize: "12px",
  color: "#666"
}

const primaryBadgeStyles: React.CSSProperties = {
  padding: "0.125rem 0.5rem",
  backgroundColor: "#e6f7ff",
  color: "#1890ff",
  fontSize: "11px",
  fontWeight: 500,
  borderRadius: "4px"
}

const loadingStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#666"
}

const backLinkStyles: React.CSSProperties = {
  marginBottom: "1rem",
  display: "inline-block",
  color: "#1890ff",
  textDecoration: "none"
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get provider display name
 */
function getProviderName(provider: AuthProviderType): string {
  switch (provider) {
    case "google":
      return "Google"
    case "github":
      return "GitHub"
    case "workos":
      return "WorkOS"
    case "saml":
      return "SSO"
    case "local":
      return "Email & Password"
  }
}

/**
 * Get provider icon
 */
function getProviderIcon(provider: AuthProviderType): string {
  switch (provider) {
    case "google":
      return "G"
    case "github":
      return "GH"
    case "workos":
      return "W"
    case "saml":
      return "SSO"
    case "local":
      return "@"
  }
}

/**
 * Format date for display
 */
function formatDate(epochMillis: number): string {
  return new Date(epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
}

// =============================================================================
// Account Content Component
// =============================================================================

function AccountContent(): React.ReactElement {
  const tokenOption = useAtomValue(authTokenAtom)
  const userResult = useAtomValue(currentUserAtom)

  const hasToken = Option.isSome(tokenOption)
  const isAuthenticated = hasToken && Result.isSuccess(userResult)

  // Loading state
  if (Result.isInitial(userResult) || Result.isWaiting(userResult)) {
    return (
      <div style={pageStyles}>
        <div style={loadingStyles}>Loading account information...</div>
      </div>
    )
  }

  // Error state
  if (Result.isFailure(userResult)) {
    return (
      <div style={pageStyles}>
        <div style={loadingStyles}>
          Unable to load account information. Please try again.
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={pageStyles}>
        <div style={loadingStyles}>Redirecting to login...</div>
      </div>
    )
  }

  const { user, identities } = userResult.value

  return (
    <div style={pageStyles}>
      <Link to="/" style={backLinkStyles}>
        &larr; Back to Home
      </Link>

      <h1 style={titleStyles}>Account Settings</h1>
      <p style={subtitleStyles}>Manage your account information and connected authentication providers.</p>

      {/* Profile Section */}
      <div style={sectionStyles}>
        <h2 style={sectionTitleStyles}>Profile Information</h2>

        <div style={fieldRowStyles}>
          <span style={fieldLabelStyles}>Name</span>
          <span style={fieldValueStyles}>{user.displayName}</span>
        </div>

        <div style={fieldRowStyles}>
          <span style={fieldLabelStyles}>Email</span>
          <span style={fieldValueStyles}>{user.email}</span>
        </div>

        <div style={fieldRowStyles}>
          <span style={fieldLabelStyles}>Role</span>
          <span style={fieldValueStyles}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
        </div>

        <div style={{ ...fieldRowStyles, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
          <span style={fieldLabelStyles}>Member since</span>
          <span style={fieldValueStyles}>{formatDate(user.createdAt.epochMillis)}</span>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div style={sectionStyles}>
        <h2 style={sectionTitleStyles}>Connected Accounts</h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "1rem" }}>
          These are the authentication methods linked to your account.
        </p>

        <div style={identitiesListStyles}>
          {identities.map((identity: UserIdentity) => (
            <div key={identity.id} style={identityItemStyles}>
              <div style={providerBadgeStyles(identity.provider)}>
                {getProviderIcon(identity.provider)}
              </div>
              <div style={identityInfoStyles}>
                <div style={identityProviderStyles}>
                  {getProviderName(identity.provider)}
                </div>
                <div style={identityDateStyles}>
                  Connected {formatDate(identity.createdAt.epochMillis)}
                </div>
              </div>
              {identity.provider === user.primaryProvider && (
                <span style={primaryBadgeStyles}>Primary</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Main Account Page Component
// =============================================================================

function AccountPage(): React.ReactElement {
  return (
    <AuthGuard>
      <AccountContent />
    </AuthGuard>
  )
}
