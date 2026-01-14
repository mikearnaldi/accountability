# Effect + TanStack Start SSR Best Practices

This document describes how to implement server-side rendering (SSR) data prefetching using TanStack Start loaders with Effect HttpApiClient. **We do NOT use server functions (createServerFn)** - all data fetching uses HttpApiClient directly.

## Architecture Overview

```
Browser Request
    │
    ▼
TanStack Start Server
    │
    ├─► Root beforeLoad: Read session cookie, validate token
    │       │
    │       ▼
    │   HttpApiClient.make() → API → Database
    │       │
    │       ▼
    │   Return { user } to context
    │
    ├─► Route beforeLoad: Check auth, redirect if needed
    │
    ├─► Route loader: Prefetch data with HttpApiClient
    │       │
    │       ▼
    │   Return data to component
    │
    ▼
Server renders HTML with data embedded
    │
    ▼
Browser receives complete HTML (no loading flash)
```

## Key Principles

1. **No server functions** - `createServerFn` is banned. Use HttpApiClient directly in loaders.
2. **loaders run on server during SSR** - They have access to request context.
3. **HttpApiClient works everywhere** - Same code runs on server and client.
4. **Auth via httpOnly cookies** - Server reads cookie, passes token to HttpApiClient.
5. **Context flows down** - Root provides session, child routes consume it.

---

## 1. Server-Side HttpApiClient Setup

### Creating a Server Client

```typescript
// packages/web/src/lib/api-client.server.ts
import { HttpApiClient, HttpClient, HttpClientRequest, FetchHttpClient } from "@effect/platform"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/**
 * Create an HttpApiClient for server-side use.
 *
 * On the server, we use FetchHttpClient which works in Node.js 18+.
 * The baseUrl should point to the API - in development this is localhost,
 * in production it could be an internal service URL.
 */
export const makeServerApiClient = (token?: string) =>
  Effect.gen(function* () {
    return yield* HttpApiClient.make(AppApi, {
      baseUrl: process.env.API_URL || "http://localhost:3000",
      transformClient: token
        ? (httpClient) =>
            HttpClient.mapRequest(httpClient, (request) =>
              HttpClientRequest.bearerToken(request, token)
            )
        : undefined
    })
  }).pipe(Effect.provide(FetchHttpClient.layer))

/**
 * Run an Effect that uses the API client.
 * Returns a Promise for use in TanStack loaders.
 */
export const runServerEffect = <A, E>(
  effect: Effect.Effect<A, E>,
  token?: string
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(FetchHttpClient.layer))
  )
```

### Why FetchHttpClient on Server?

- Node.js 18+ has native `fetch()` support
- FetchHttpClient works identically on server and client
- No need for platform-specific code
- Simpler than NodeHttpClient for our use case

---

## 2. Root Route: Session Fetching

The root route fetches the session from the httpOnly cookie and passes it to all child routes via context.

```typescript
// packages/web/src/routes/__root.tsx
import {
  createRootRouteWithContext,
  Outlet,
  HeadContent,
  Scripts,
} from "@tanstack/react-router"
import { RegistryProvider } from "@effect-atom/atom-react"
import { registry } from "../atoms/registry"
import { getSessionFromCookie } from "../lib/session.server"

// Define the router context type
export interface RouterContext {
  user: {
    id: string
    email: string
    displayName: string | null
  } | null
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // beforeLoad runs on EVERY navigation (server during SSR, client during SPA nav)
  beforeLoad: async ({ context }) => {
    // On server: context.request contains the incoming request
    // On client: context.request is undefined
    const request = (context as any).request as Request | undefined

    if (request) {
      // Server-side: extract session from cookie
      const user = await getSessionFromCookie(request)
      return { user }
    }

    // Client-side navigation: use existing context or null
    // The root context persists across client navigations
    return { user: context?.user ?? null }
  },

  component: RootComponent,

  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      { rel: "stylesheet", href: "/src/index.css" },
    ],
  }),
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <RegistryProvider value={registry}>
          <Outlet />
        </RegistryProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

### Session Extraction from Cookie

```typescript
// packages/web/src/lib/session.server.ts
import { HttpApiClient, FetchHttpClient } from "@effect/platform"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

const COOKIE_NAME = "accountability_session"

/**
 * Extract and validate session from request cookies.
 * Returns the user if valid, null otherwise.
 */
export async function getSessionFromCookie(
  request: Request
): Promise<{ id: string; email: string; displayName: string | null } | null> {
  // Parse cookie header
  const cookieHeader = request.headers.get("cookie") || ""
  const token = parseCookie(cookieHeader, COOKIE_NAME)

  if (!token) {
    return null
  }

  // Validate token by calling /api/auth/me
  try {
    const user = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi, {
          baseUrl: process.env.API_URL || "http://localhost:3000",
          transformClient: (httpClient) =>
            HttpClient.mapRequest(httpClient, (req) =>
              HttpClientRequest.bearerToken(req, token)
            )
        })

        return yield* client.auth.me()
      }).pipe(Effect.provide(FetchHttpClient.layer))
    )

    return user
  } catch {
    // Token invalid or expired
    return null
  }
}

/**
 * Parse a specific cookie from the Cookie header.
 */
function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim())
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=")
    if (key === name) {
      return valueParts.join("=")
    }
  }
  return null
}
```

---

## 3. Protected Routes with beforeLoad

Protected routes check auth in `beforeLoad` and redirect to login if not authenticated.

```typescript
// packages/web/src/routes/organizations/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOrganizations } from "../../lib/api.server"

export const Route = createFileRoute("/organizations/")({
  // Auth check - runs before loader
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.pathname,
        },
      })
    }
  },

  // Data fetching - only runs if beforeLoad passes
  loader: async ({ context }) => {
    // context.user is guaranteed to exist here
    const organizations = await getOrganizations(context.user.id)
    return { organizations }
  },

  component: OrganizationsPage,
})

function OrganizationsPage() {
  // Access loader data - available immediately, no loading state
  const { organizations } = Route.useLoaderData()

  return (
    <div>
      <h1>Organizations</h1>
      {organizations.map((org) => (
        <OrganizationCard key={org.id} organization={org} />
      ))}
    </div>
  )
}
```

### Auth Routes Redirect If Already Authenticated

```typescript
// packages/web/src/routes/login.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context, search }) => {
    // If already authenticated, redirect to home or intended destination
    if (context.user) {
      throw redirect({
        to: (search as any).redirect || "/",
      })
    }
  },

  component: LoginPage,
})
```

---

## 4. Server API Functions (NOT Server Functions)

These are regular async functions that use HttpApiClient. They are **not** TanStack server functions.

```typescript
// packages/web/src/lib/api.server.ts
import { HttpApiClient, HttpClient, HttpClientRequest, FetchHttpClient } from "@effect/platform"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import * as Effect from "effect/Effect"

/**
 * Fetch organizations for a user.
 * Called from route loaders.
 */
export async function getOrganizations(userId: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi, {
        baseUrl: process.env.API_URL || "http://localhost:3000",
      })

      // The API uses the authenticated user from the session
      return yield* client.organizations.list()
    }).pipe(Effect.provide(FetchHttpClient.layer))
  )
}

/**
 * Fetch a single organization with its companies.
 */
export async function getOrganization(organizationId: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi, {
        baseUrl: process.env.API_URL || "http://localhost:3000",
      })

      const [organization, companies] = yield* Effect.all([
        client.organizations.get({ path: { organizationId } }),
        client.companies.listByOrganization({ path: { organizationId } }),
      ])

      return { organization, companies }
    }).pipe(Effect.provide(FetchHttpClient.layer))
  )
}

/**
 * Fetch companies for an organization.
 */
export async function getCompanies(organizationId: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi, {
        baseUrl: process.env.API_URL || "http://localhost:3000",
      })

      return yield* client.companies.listByOrganization({
        path: { organizationId }
      })
    }).pipe(Effect.provide(FetchHttpClient.layer))
  )
}

/**
 * Fetch accounts for a company.
 */
export async function getAccounts(companyId: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi, {
        baseUrl: process.env.API_URL || "http://localhost:3000",
      })

      return yield* client.accounts.list({
        path: { companyId }
      })
    }).pipe(Effect.provide(FetchHttpClient.layer))
  )
}
```

### Passing Auth Token to API

If your API requires authentication per-request (not session-based), extract the token and pass it:

```typescript
// packages/web/src/lib/api.server.ts
export async function getOrganizationsWithToken(token: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(AppApi, {
        baseUrl: process.env.API_URL || "http://localhost:3000",
        transformClient: (httpClient) =>
          HttpClient.mapRequest(httpClient, (request) =>
            HttpClientRequest.bearerToken(request, token)
          )
      })

      return yield* client.organizations.list()
    }).pipe(Effect.provide(FetchHttpClient.layer))
  )
}
```

---

## 5. Route with Parameters

```typescript
// packages/web/src/routes/organizations/$organizationId/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOrganization } from "../../../lib/api.server"

export const Route = createFileRoute("/organizations/$organizationId/")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" })
    }
  },

  loader: async ({ params }) => {
    const { organization, companies } = await getOrganization(params.organizationId)
    return { organization, companies }
  },

  component: OrganizationDetailPage,
})

function OrganizationDetailPage() {
  const { organization, companies } = Route.useLoaderData()
  const { organizationId } = Route.useParams()

  return (
    <div>
      <h1>{organization.name}</h1>
      <p>Currency: {organization.reportingCurrency}</p>

      <h2>Companies ({companies.length})</h2>
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} />
      ))}
    </div>
  )
}
```

---

## 6. Accessing Route Context

Child routes automatically receive context from parent routes.

```typescript
// packages/web/src/routes/organizations/$organizationId/companies/$companyId/index.tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/"
)({
  loader: async ({ params }) => {
    const company = await getCompany(params.companyId)
    const accounts = await getAccounts(params.companyId)
    return { company, accounts }
  },

  component: CompanyDetailPage,
})

function CompanyDetailPage() {
  // Access loader data from this route
  const { company, accounts } = Route.useLoaderData()

  // Access params
  const { organizationId, companyId } = Route.useParams()

  // Access context from root (user info)
  const { user } = Route.useRouteContext()

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Organizations", to: "/organizations" },
          { label: company.organizationName, to: `/organizations/${organizationId}` },
          { label: company.name },
        ]}
      />

      <h1>{company.name}</h1>
      <p>Logged in as: {user?.email}</p>

      <AccountsList accounts={accounts} />
    </div>
  )
}
```

---

## 7. Integrating with Effect Atoms

After SSR, client-side atoms still work for mutations and refetching. The pattern is:

1. **Initial render**: Use loader data (no loading state)
2. **Mutations**: Use Effect Atom mutations with `reactivityKeys`
3. **Refetch**: Atoms automatically refresh after mutations

```typescript
// packages/web/src/routes/organizations/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import { organizationsAtom, createOrganizationMutation } from "../../atoms/organizations"
import { getOrganizations } from "../../lib/api.server"
import * as Result from "@effect-atom/atom/Result"

export const Route = createFileRoute("/organizations/")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" })
    }
  },

  loader: async () => {
    const organizations = await getOrganizations()
    return { organizations }
  },

  component: OrganizationsPage,
})

function OrganizationsPage() {
  // Loader data for initial render (SSR)
  const loaderData = Route.useLoaderData()

  // Atom for client-side updates (after mutations)
  const organizationsResult = useAtomValue(organizationsAtom)

  // Mutation for creating organizations
  const [createResult, createOrg] = useAtom(createOrganizationMutation)

  // Use loader data initially, then atom data after client-side updates
  const organizations = Result.isSuccess(organizationsResult)
    ? organizationsResult.value
    : loaderData.organizations

  const handleCreate = async (data: CreateOrganizationInput) => {
    // Fire-and-forget mutation - reactivityKeys will refresh organizationsAtom
    createOrg(data)
  }

  return (
    <div>
      <h1>Organizations</h1>
      <CreateOrganizationButton onClick={handleCreate} />

      {organizations.map((org) => (
        <OrganizationCard key={org.id} organization={org} />
      ))}
    </div>
  )
}
```

### Atom with reactivityKeys

```typescript
// packages/web/src/atoms/organizations.ts
import { ApiClient } from "./ApiClient"
import * as Duration from "effect/Duration"

// Query atom - refreshes when reactivityKeys change
export const organizationsAtom = ApiClient.query(
  "organizations",
  "list",
  {
    timeToLive: Duration.minutes(5),
    reactivityKeys: ["organizations"], // Refresh when this key is triggered
  }
)

// Mutation atom - triggers reactivityKeys on success
export const createOrganizationMutation = ApiClient.mutation(
  "organizations",
  "create",
  {
    reactivityKeys: ["organizations"], // Triggers organizationsAtom refresh
  }
)
```

---

## 8. Error Handling in Loaders

```typescript
// packages/web/src/routes/organizations/$organizationId/index.tsx
import { createFileRoute, redirect, notFound } from "@tanstack/react-router"
import { getOrganization } from "../../../lib/api.server"

export const Route = createFileRoute("/organizations/$organizationId/")({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" })
    }
  },

  loader: async ({ params }) => {
    try {
      const data = await getOrganization(params.organizationId)
      return data
    } catch (error) {
      // Check if it's a 404
      if (isNotFoundError(error)) {
        throw notFound()
      }
      // Re-throw other errors
      throw error
    }
  },

  // Custom error component
  errorComponent: ({ error }) => (
    <div className="p-4 bg-red-50 text-red-700 rounded">
      <h2>Error loading organization</h2>
      <p>{error.message}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  ),

  // Custom not found component
  notFoundComponent: () => (
    <div className="p-4 bg-yellow-50 text-yellow-700 rounded">
      <h2>Organization not found</h2>
      <Link to="/organizations">Back to organizations</Link>
    </div>
  ),

  component: OrganizationDetailPage,
})
```

---

## 9. Setting Cookies on Login

The login API should set the httpOnly cookie. This happens in the API handler, not in TanStack routes.

```typescript
// packages/api/src/Handlers/AuthHandler.ts
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"

const loginHandler = HttpApiBuilder.handler(AuthApi, "login", ({ payload }) =>
  Effect.gen(function* () {
    // Validate credentials, create session...
    const token = yield* createSession(payload.email, payload.password)
    const user = yield* getUser(payload.email)

    // Set httpOnly cookie
    return HttpServerResponse.json({ user, token }).pipe(
      HttpServerResponse.setCookie("accountability_session", token, {
        httpOnly: true,
        secure: true, // Works on localhost in Chrome
        sameSite: "lax",
        path: "/",
        maxAge: Duration.toSeconds(Duration.days(30)),
      })
    )
  })
)

const logoutHandler = HttpApiBuilder.handler(AuthApi, "logout", () =>
  Effect.gen(function* () {
    // Clear the cookie by setting empty value with immediate expiry
    return HttpServerResponse.json({ success: true }).pipe(
      HttpServerResponse.setCookie("accountability_session", "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0, // Expire immediately
      })
    )
  })
)
```

---

## 10. Summary: SSR Data Flow

### Server-Side Rendering (Initial Page Load)

```
1. Browser requests /organizations
2. TanStack Start receives request
3. Root beforeLoad:
   - Extracts cookie from request headers
   - Calls getSessionFromCookie() → HttpApiClient → API
   - Returns { user } to context
4. /organizations beforeLoad:
   - Checks context.user exists
   - Redirects to /login if not
5. /organizations loader:
   - Calls getOrganizations() → HttpApiClient → API
   - Returns { organizations }
6. Component renders with loader data
7. Server sends complete HTML with data
8. Browser receives HTML - no loading flash!
```

### Client-Side Navigation (After Initial Load)

```
1. User clicks link to /organizations/$id
2. Router triggers navigation
3. beforeLoad runs client-side (checks cached context)
4. loader runs client-side (can use atoms or fetch)
5. Component renders with new data
```

### Mutations (Client-Side Only)

```
1. User clicks "Create Organization"
2. createOrganizationMutation fires
3. API creates organization
4. reactivityKeys triggers organizationsAtom refresh
5. UI updates automatically
```

---

## Anti-Patterns to Avoid

### DON'T: Use createServerFn

```typescript
// BAD - Server functions are banned
import { createServerFn } from "@tanstack/react-start"

const getOrgs = createServerFn({ method: "GET" }).handler(async () => {
  // ...
})
```

### DON'T: Fetch in Components

```typescript
// BAD - Data fetching in components causes loading flash
function OrganizationsPage() {
  const [orgs, setOrgs] = useState([])

  useEffect(() => {
    fetch("/api/organizations").then(/* ... */)
  }, [])
}
```

### DON'T: Check Auth in Components

```typescript
// BAD - Auth checks in components cause flash
function OrganizationsPage() {
  const user = useAtomValue(currentUserAtom)

  if (!user) {
    return <Navigate to="/login" />
  }
}
```

### DO: Use beforeLoad for Auth and Loader for Data

```typescript
// GOOD - Auth in beforeLoad, data in loader
export const Route = createFileRoute("/organizations/")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" })
  },
  loader: async () => {
    return { organizations: await getOrganizations() }
  },
  component: OrganizationsPage,
})

function OrganizationsPage() {
  const { organizations } = Route.useLoaderData()
  // Render immediately - no loading state needed
}
```
