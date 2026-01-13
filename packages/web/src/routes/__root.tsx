import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useNavigate
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { RegistryProvider, useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as React from "react"
import * as Option from "effect/Option"
import * as Result from "@effect-atom/atom/Result"
import { authTokenAtom, currentUserAtom, logoutMutation } from "../atoms/auth.ts"

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

const authSectionStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem"
}

const userEmailStyles: React.CSSProperties = {
  color: "#666",
  fontSize: "14px"
}

const logoutButtonStyles: React.CSSProperties = {
  padding: "0.5rem 1rem",
  border: "1px solid #d9d9d9",
  borderRadius: "4px",
  backgroundColor: "#fff",
  cursor: "pointer",
  fontSize: "14px"
}

// =============================================================================
// Navigation Component
// =============================================================================

function Navigation(): React.ReactElement {
  const tokenOption = useAtomValue(authTokenAtom)
  const userResult = useAtomValue(currentUserAtom)
  const executeLogout = useAtomSet(logoutMutation)
  const navigate = useNavigate()

  const hasToken = Option.isSome(tokenOption)
  const isAuthenticated = hasToken && Result.isSuccess(userResult)
  const userEmail = isAuthenticated ? userResult.value.user.email : null

  const handleLogout = async (): Promise<void> => {
    executeLogout()
    // Navigate to home after logout
    navigate({ to: "/", replace: true })
  }

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
      <div style={authSectionStyles}>
        {isAuthenticated ? (
          <>
            <span style={userEmailStyles}>{userEmail}</span>
            <button
              type="button"
              onClick={handleLogout}
              style={logoutButtonStyles}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
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
