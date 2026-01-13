import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { RegistryProvider, useAtomValue } from "@effect-atom/atom-react"
import * as React from "react"
import * as Option from "effect/Option"
import * as Result from "@effect-atom/atom/Result"
import { authTokenAtom, currentUserAtom } from "../atoms/auth.ts"
import { UserMenu } from "../components/UserMenu.tsx"

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

// =============================================================================
// Navigation Styles
// =============================================================================

const navStyles: React.CSSProperties = {
  padding: "1rem",
  borderBottom: "1px solid #ccc",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
}

const navLinksStyles: React.CSSProperties = {
  display: "flex",
  gap: "1rem"
}


// =============================================================================
// Navigation Component
// =============================================================================

function Navigation(): React.ReactElement {
  const tokenOption = useAtomValue(authTokenAtom)
  const userResult = useAtomValue(currentUserAtom)

  const hasToken = Option.isSome(tokenOption)
  const isAuthenticated = hasToken && Result.isSuccess(userResult)

  return (
    <nav style={navStyles}>
      <div style={navLinksStyles}>
        <Link
          to="/"
          activeProps={{ style: { fontWeight: "bold" } }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
        {isAuthenticated && (
          <>
            <Link
              to="/organizations"
              activeProps={{ style: { fontWeight: "bold" } }}
            >
              Organizations
            </Link>
            <Link
              to="/companies"
              activeProps={{ style: { fontWeight: "bold" } }}
            >
              Companies
            </Link>
            <Link
              to="/journal-entries"
              activeProps={{ style: { fontWeight: "bold" } }}
            >
              Journal Entries
            </Link>
            <Link
              to="/reports"
              activeProps={{ style: { fontWeight: "bold" } }}
            >
              Reports
            </Link>
          </>
        )}
      </div>
      <UserMenu />
    </nav>
  )
}

function RootDocument({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Navigation />
        <main style={{ padding: "1rem" }}>
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  )
}
