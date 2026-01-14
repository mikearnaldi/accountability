/**
 * Server-side authentication utilities
 *
 * Provides functions for reading and validating session cookies on the server,
 * enabling server-side rendering with authentication.
 *
 * @module server/auth
 */

import { HttpApiClient, HttpClient, HttpClientRequest, FetchHttpClient } from "@effect/platform"
import * as Effect from "effect/Effect"
import { AppApi } from "@accountability/api/Definitions/AppApi"

const SESSION_COOKIE_NAME = "accountability_session"

/**
 * Extract session token from request cookies
 */
function extractSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || ""
  const cookies = cookieHeader.split(";").map((c) => c.trim())

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=")
    if (key === SESSION_COOKIE_NAME) {
      return valueParts.join("=")
    }
  }

  return null
}

/**
 * Get server session from request cookies
 *
 * Reads the httpOnly session cookie and validates it by calling the /api/auth/me endpoint.
 * Returns the authenticated user if valid, or null if the token is missing or invalid.
 *
 * @param request - The incoming HTTP request
 * @returns Promise of user object or null
 *
 * @example
 * ```typescript
 * // In a TanStack Start route beforeLoad
 * beforeLoad: async ({ context }) => {
 *   const request = (context as any).request as Request | undefined
 *   if (request) {
 *     const user = await getServerSession(request)
 *     return { user }
 *   }
 *   return { user: context?.user ?? null }
 * }
 * ```
 */
export async function getServerSession(
  request: Request
): Promise<{
  id: string
  email: string
  displayName: string | null
} | null> {
  // Extract session token from cookie
  const token = extractSessionToken(request)

  if (!token) {
    return null
  }

  // Validate token by calling /api/auth/me
  try {
    const response = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi, {
          baseUrl: process.env.API_URL || "http://localhost:3000",
          transformClient: (httpClient) =>
            HttpClient.mapRequest(httpClient, (req) =>
              HttpClientRequest.bearerToken(req, token)
            )
        })

        return yield* client.authSession.me()
      }).pipe(Effect.provide(FetchHttpClient.layer))
    )

    // Extract user from response
    if (response && "user" in response) {
      return response.user
    }

    return null
  } catch {
    // Token invalid or expired
    return null
  }
}

/**
 * Server function for getting and setting session
 *
 * This can be used by route loaders to establish server-side session context.
 * Both reads the cookie and validates the session.
 *
 * @param request - The incoming HTTP request
 * @returns Promise of validated user or null
 */
export async function serverSetSession(request: Request) {
  return getServerSession(request)
}
