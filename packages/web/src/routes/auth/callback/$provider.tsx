/**
 * OAuth Callback Route
 *
 * Handles OAuth provider callbacks after authentication.
 * This route receives the authorization code and state from OAuth providers.
 */

import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/auth/callback/$provider")({
  component: OAuthCallbackPage
})

function OAuthCallbackPage() {
  const { provider } = Route.useParams()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
        <h1 className="text-xl font-semibold text-gray-900">
          Completing {provider} authentication...
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we complete your sign-in.
        </p>
      </div>
    </div>
  )
}
