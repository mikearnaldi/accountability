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
      <body className="min-h-screen bg-gray-50">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
