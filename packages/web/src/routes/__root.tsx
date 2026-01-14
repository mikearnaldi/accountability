import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
// eslint-disable-next-line local/no-server-functions -- Required for SSR auth: need server-side access to httpOnly cookies
import { createServerFn } from "@tanstack/react-start"
import { getCookie, getRequestUrl } from "@tanstack/react-start/server"
import * as React from "react"
// Import CSS as URL to include in head (prevents FOUC)
import appCss from "../index.css?url"
import type { RouterContext } from "@/types/router"

// =============================================================================
// Server Function: Fetch current user from session cookie
// =============================================================================

// eslint-disable-next-line local/no-server-functions -- Required for SSR auth: TanStack Start server functions are the only way to access httpOnly cookies during SSR
const fetchCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  // Get the session token from the httpOnly cookie
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return null
  }

  try {
    // Get the current request URL to determine the correct host/port for API calls
    const requestUrl = getRequestUrl()
    const apiBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`

    // Call the API with the session token as Bearer auth
    // eslint-disable-next-line local/no-direct-fetch -- Required for SSR: must use native fetch with dynamic baseUrl from request context
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data?.user ?? null
  } catch {
    return null
  }
})

// =============================================================================
// Root Route
// =============================================================================

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8"
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      },
      {
        title: "Accountability - Multi-Company Accounting"
      }
    ],
    links: [{ rel: "stylesheet", href: appCss }]
  }),
  beforeLoad: async ({ context }) => {
    // beforeLoad runs on both server (SSR) and client
    // Use server function to access httpOnly cookies during SSR
    const user = await fetchCurrentUser()
    return { ...context, user }
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent
})

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">404 - Page Not Found</h1>
      <p className="mb-4 text-gray-600">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="text-blue-600 hover:underline">
        Go back home
      </Link>
    </div>
  )
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </RootDocument>
  )
}

function RootDocument({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-gray-50">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
