import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { RegistryProvider } from "@effect-atom/atom-react"
import * as React from "react"

export const Route = createRootRoute({
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
    ]
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent
})

function NotFoundComponent() {
  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Go back home</Link>
    </div>
  )
}

function RootComponent() {
  return (
    <RegistryProvider>
      <RootDocument>
        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
      </RootDocument>
    </RegistryProvider>
  )
}

function RootDocument({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
          <Link
            to="/"
            activeProps={{ style: { fontWeight: "bold" } }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>{" "}
          <Link
            to="/companies"
            activeProps={{ style: { fontWeight: "bold" } }}
          >
            Companies
          </Link>{" "}
          <Link
            to="/journal-entries"
            activeProps={{ style: { fontWeight: "bold" } }}
          >
            Journal Entries
          </Link>{" "}
          <Link
            to="/reports"
            activeProps={{ style: { fontWeight: "bold" } }}
          >
            Reports
          </Link>
        </nav>
        <main style={{ padding: "1rem" }}>
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  )
}
