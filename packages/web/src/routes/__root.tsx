import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import * as React from "react"
// Import CSS as URL to include in head (prevents FOUC)
import appCss from "../index.css?url"
import { api } from "@/api/client"
import type { RouterContext } from "@/types/router"

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
    // The context is initialized with the default user: null from the router
    // We need to check if we can access the session cookie and validate it

    try {
      // Attempt to call /api/auth/me to validate the session
      // On the server, cookies are automatically included in the request
      // On the client, they're also available
      const { data, error } = await api.GET("/api/auth/me")

      if (error || !data?.user) {
        return context
      }

      return { user: data.user }
    } catch {
      return context
    }
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
