/**
 * Invitation Accept Deep Link
 *
 * Phase J2 of AUTHORIZATION.md spec - Invitation Accept Deep Link
 *
 * Handles the deep link flow for accepting invitations:
 * - If logged in: accepts the invitation and redirects to the organization
 * - If logged out: redirects to login with return URL pointing back here
 *
 * Route: /invitations/:token (direct link from invitation email)
 */

import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
import { useState } from "react"
import { api } from "@/api/client"
import {
  Mail,
  Check,
  X,
  AlertCircle,
  Loader2,
  ArrowLeft
} from "lucide-react"
import { Button } from "@/components/ui/Button"

// =============================================================================
// Types
// =============================================================================

export interface TokenValid {
  readonly valid: true
}

export interface TokenInvalid {
  readonly valid: false
  readonly error: string
}

export type TokenValidationResult = TokenValid | TokenInvalid

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validates the invitation token format
 * Note: Actual token validation happens when accepting via the API
 */
function validateTokenFormat(token: string): TokenValidationResult {
  // Validate the token format - should be a valid token string (at least 20 chars for base64url 256-bit)
  if (!token || token.length < 20) {
    return { valid: false, error: "Invalid invitation token" }
  }

  // Token format looks valid, actual validation happens on accept
  return { valid: true }
}

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/invitations/$token")({
  beforeLoad: async ({ context, params }) => {
    // If not logged in, redirect to login with return URL
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/invitations/${params.token}`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = validateTokenFormat(params.token)
    return { tokenStatus: result, token: params.token }
  },
  component: InvitationAcceptPage
})

// =============================================================================
// Page Component
// =============================================================================

function InvitationAcceptPage() {
  const context = Route.useRouteContext()
  const { token, tokenStatus: initialStatus } = Route.useLoaderData()
  const router = useRouter()

  const [status, setStatus] = useState<"idle" | "accepting" | "declining" | "accepted" | "declined" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  // Auto-accept mode: if there's a query param to auto-accept
  // For now, we show the confirmation page
  const isValidToken = initialStatus.valid

  const handleAccept = async () => {
    setStatus("accepting")
    setError(null)

    try {
      const { error: apiError, data } = await api.POST("/api/v1/invitations/{token}/accept", {
        params: { path: { token } }
      })

      if (apiError) {
        let errorMessage = "Failed to accept invitation"

        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
          // Check for specific error codes
          if ("code" in apiError) {
            if (apiError.code === "INVITATION_REVOKED") {
              errorMessage = "This invitation has been revoked and is no longer valid."
            } else if (apiError.code === "ALREADY_MEMBER") {
              errorMessage = "You are already a member of this organization."
            }
          }
        }

        setError(errorMessage)
        setStatus("error")
        return
      }

      if (data?.organizationId) {
        setStatus("accepted")

        // Redirect to the organization dashboard after a brief delay
        setTimeout(() => {
          router.navigate({
            to: "/organizations/$organizationId/dashboard",
            params: { organizationId: data.organizationId }
          })
        }, 1500)
      } else {
        setStatus("accepted")
        // Fallback: redirect to invitations page
        setTimeout(() => {
          router.navigate({ to: "/invitations" })
        }, 1500)
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setStatus("error")
    }
  }

  const handleDecline = async () => {
    if (!window.confirm("Are you sure you want to decline this invitation?")) {
      return
    }

    setStatus("declining")
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/invitations/{token}/decline", {
        params: { path: { token } }
      })

      if (apiError) {
        let errorMessage = "Failed to decline invitation"

        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }

        setError(errorMessage)
        setStatus("error")
        return
      }

      setStatus("declined")

      // Redirect to invitations page after a brief delay
      setTimeout(() => {
        router.navigate({ to: "/invitations" })
      }, 1500)
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setStatus("error")
    }
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-red-200 bg-white p-8 shadow-sm text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mx-auto">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>

            <h1 className="mt-6 text-2xl font-bold text-gray-900">Invalid Invitation</h1>

            <p className="mt-4 text-gray-600">
              This invitation link is invalid or has expired. Please ask the organization admin
              to send you a new invitation.
            </p>

            <div className="mt-8">
              <Link
                to="/invitations"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Invitations
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success states
  if (status === "accepted") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-green-200 bg-white p-8 shadow-sm text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>

            <h1 className="mt-6 text-2xl font-bold text-gray-900">Invitation Accepted!</h1>

            <p className="mt-4 text-gray-600">
              You have successfully joined the organization. Redirecting to your dashboard...
            </p>

            <div className="mt-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === "declined") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mx-auto">
              <X className="h-8 w-8 text-gray-600" />
            </div>

            <h1 className="mt-6 text-2xl font-bold text-gray-900">Invitation Declined</h1>

            <p className="mt-4 text-gray-600">
              You have declined this invitation. Redirecting...
            </p>

            <div className="mt-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main confirmation view
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm" data-testid="invitation-accept-page">
          {/* Header */}
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>

            <h1 className="mt-6 text-2xl font-bold text-gray-900">Organization Invitation</h1>

            <p className="mt-4 text-gray-600">
              You&apos;ve been invited to join an organization. Click Accept to join or Decline to reject this invitation.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              className="mt-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700"
              data-testid="invitation-error"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
            <p>
              You are logged in as <span className="font-medium">{context.user?.email}</span>.
              If this is not the correct account, please log out and sign in with the correct account.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleAccept}
              disabled={status === "accepting" || status === "declining"}
              loading={status === "accepting"}
              icon={<Check className="h-5 w-5" />}
              className="w-full justify-center"
              data-testid="invitation-accept-button"
            >
              Accept Invitation
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={handleDecline}
              disabled={status === "accepting" || status === "declining"}
              loading={status === "declining"}
              icon={<X className="h-5 w-5" />}
              className="w-full justify-center"
              data-testid="invitation-decline-button"
            >
              Decline
            </Button>
          </div>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <Link
              to="/invitations"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to all invitations
            </Link>
          </div>
        </div>

        {/* User Info Footer */}
        <div className="mt-4 text-center text-sm text-gray-500">
          Logged in as {context.user?.email}
        </div>
      </div>
    </div>
  )
}
