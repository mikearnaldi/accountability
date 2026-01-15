import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import * as React from "react"
// Import CSS as URL to include in head (prevents FOUC)
import appCss from "../index.css?url"
import type { RouterContext } from "@/types/router"
import { createServerApi } from "@/api/server"

// =============================================================================
// Server Function: Fetch current user from session cookie
// =============================================================================

const fetchCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  // Get the session cookie to forward to API
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return null
  }

  try {
    // Create server API client with dynamic base URL from request context
    const api = createServerApi()
    // Forward session token to API using Authorization Bearer header
    const { data, error } = await api.GET("/api/auth/me", {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (error) {
      return null
    }

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

// Lazy load devtools to avoid SSR issues (window is not defined)
// Only load in development and after client-side hydration
const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null
    : React.lazy(() =>
        import("@tanstack/react-router-devtools").then((mod) => ({
          default: mod.TanStackRouterDevtools
        }))
      )

function RouterDevtools() {
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <React.Suspense>
      <TanStackRouterDevtools position="bottom-right" />
    </React.Suspense>
  )
}

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
      <RouterDevtools />
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
