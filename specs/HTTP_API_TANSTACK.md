# Effect HttpApi + TanStack Start + OpenAPI Fetch Integration

This document outlines the architecture for integrating Effect's HttpApi on the backend with TanStack Start and a generated openapi-fetch client on the frontend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  React State    │    │  openapi-fetch  │                     │
│  │  (useState)     │    │  (Type-safe)    │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│  ┌───────────────────────────────┼───────────────────────────┐  │
│  │              TanStack Start SSR                            │  │
│  │   loader() ──► Route.useLoaderData() ──► Component         │  │
│  │   beforeLoad() ──► Auth checks ──► Redirect                │  │
│  └───────────────────────────────┼───────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────┘
                                   │ HTTP (fetch)
┌──────────────────────────────────┼──────────────────────────────┐
│                        Backend (Effect)                          │
│                    ┌─────────────▼────────────┐                 │
│                    │    HttpApiBuilder.serve  │                 │
│                    │    (API Handler)         │                 │
│                    └─────────────┬────────────┘                 │
│  ┌─────────────────┐  ┌──────────▼──────────┐  ┌──────────────┐│
│  │   HttpApiGroup  │  │   HttpApiGroup      │  │  HttpApiGroup ││
│  │   (accounts)    │  │   (companies)       │  │  (reports)    ││
│  └────────┬────────┘  └──────────┬──────────┘  └──────┬───────┘│
│           │                      │                     │        │
│           └──────────────────────┼─────────────────────┘        │
│                                  ▼                              │
│                         Domain Services                         │
│                    (Effect Layers + Repos)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Effect HttpApi (Backend)

### 1.1 Defining API Endpoints

```typescript
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

// Path parameters
const accountIdParam = HttpApiSchema.param("accountId", AccountId)

// Define endpoints
const findById = HttpApiEndpoint.get("findById")`/accounts/${accountIdParam}`
  .addSuccess(Account)
  .addError(NotFoundError)

const create = HttpApiEndpoint.post("create", "/accounts")
  .setPayload(CreateAccountInput)
  .addSuccess(Account, { status: 201 })
  .addError(ValidationError)

const list = HttpApiEndpoint.get("list", "/accounts")
  .setUrlParams(Schema.Struct({
    companyId: CompanyId,
    page: Schema.optional(Schema.NumberFromString),
    limit: Schema.optional(Schema.NumberFromString)
  }))
  .addSuccess(Schema.Array(Account))
```

### 1.2 Creating API Groups

```typescript
// Group related endpoints
class AccountsApi extends HttpApiGroup.make("accounts")
  .add(findById)
  .add(create)
  .add(list)
  .add(update)
  .add(remove)
  .prefix("/api/v1")
  .addError(UnauthorizedError, { status: 401 })
{}

class CompaniesApi extends HttpApiGroup.make("companies")
  .add(getCompany)
  .add(listCompanies)
  .add(createCompany)
  .prefix("/api/v1")
{}

// Compose into full API
class AppApi extends HttpApi.make("app")
  .add(AccountsApi)
  .add(CompaniesApi)
  .add(ReportsApi)
  .addError(InternalServerError, { status: 500 })
{}
```

### 1.3 Request/Response Schemas

```typescript
// Success responses with status codes
HttpApiEndpoint.post("create", "/")
  .setPayload(CreateInput)
  .addSuccess(CreatedResponse, { status: 201 })

// Error responses with status codes
class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  { message: Schema.String, resourceId: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}

class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  { errors: Schema.Array(Schema.String) },
  HttpApiSchema.annotations({ status: 422 })
) {}

// Empty errors (status only, no body)
class UnauthorizedError extends HttpApiSchema.EmptyError<UnauthorizedError>()({
  tag: "UnauthorizedError",
  status: 401
}) {}

// Content types
HttpApiEndpoint.get("export", "/export")
  .addSuccess(HttpApiSchema.Text({ contentType: "text/csv" }))

HttpApiEndpoint.post("upload", "/upload")
  .setPayload(HttpApiSchema.Multipart(Schema.Struct({
    file: Multipart.SingleFile,
    name: Schema.String
  })))
```

### 1.4 Implementing Handlers (HttpApiBuilder)

```typescript
import { HttpApiBuilder } from "@effect/platform"

// Implement handlers for a group
const AccountsLive = HttpApiBuilder.group(
  AppApi,
  "accounts",
  (handlers) =>
    handlers
      .handle("findById", ({ path }) =>
        Effect.gen(function* () {
          const service = yield* AccountService
          const account = yield* service.findById(path.accountId)
          return yield* account.pipe(
            Option.match({
              onNone: () => Effect.fail(new NotFoundError({
                message: "Account not found",
                resourceId: path.accountId
              })),
              onSome: Effect.succeed
            })
          )
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* AccountService
          return yield* service.create(payload)
        })
      )
      .handle("list", ({ urlParams }) =>
        Effect.gen(function* () {
          const service = yield* AccountService
          return yield* service.list({
            companyId: urlParams.companyId,
            page: urlParams.page ?? 1,
            limit: urlParams.limit ?? 20
          })
        })
      )
).pipe(
  Layer.provide(AccountServiceLive)
)

// Compose all group implementations
const ApiLive = HttpApiBuilder.api(AppApi).pipe(
  Layer.provide([
    AccountsLive,
    CompaniesLive,
    ReportsLive
  ])
)
```

### 1.5 Serving the API

```typescript
import { HttpApiBuilder, HttpApiSwagger } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { createServer } from "node:http"

// Full server setup
HttpApiBuilder.serve().pipe(
  // OpenAPI documentation at /docs
  Layer.provide(HttpApiSwagger.layer({ path: "/docs" })),
  // OpenAPI JSON at /openapi.json
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  // CORS
  Layer.provide(HttpApiBuilder.middlewareCors({
    allowedOrigins: ["http://localhost:3000"],
    allowedMethods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  })),
  // API implementation
  Layer.provide(ApiLive),
  // Server
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
  Layer.launch,
  NodeRuntime.runMain
)
```

### 1.6 TanStack Start Integration

For TanStack Start, use `HttpApiBuilder.toWebHandler` to create a Web API compatible handler:

```typescript
// packages/web/src/api/handler.ts
import { HttpApiBuilder, HttpServer } from "@effect/platform"

export const createApiHandler = () => {
  const { handler, dispose } = HttpApiBuilder.toWebHandler(
    Layer.mergeAll(
      ApiLive,
      HttpServer.layerContext
    ),
    { memoMap: MemoMap.make() }
  )

  return { handler, dispose }
}

// packages/web/src/routes/api/[...path].ts (TanStack Start catch-all route)
import { createAPIFileRoute } from "@tanstack/react-start/api"
import { createApiHandler } from "../../api/handler"

const { handler } = createApiHandler()

export const APIRoute = createAPIFileRoute("/api/$")({
  GET: ({ request }) => handler(request),
  POST: ({ request }) => handler(request),
  PUT: ({ request }) => handler(request),
  DELETE: ({ request }) => handler(request),
})
```

### 1.7 Authentication Middleware

```typescript
import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"

// Define authentication middleware
class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
  "AuthMiddleware",
  {
    failure: UnauthorizedError,
    provides: CurrentUser,  // Service tag for authenticated user
    security: {
      bearer: HttpApiSecurity.bearer
    }
  }
) {}

// Implement middleware
const AuthMiddlewareLive = Layer.succeed(
  AuthMiddleware,
  AuthMiddleware.of({
    bearer: (token) =>
      Effect.gen(function* () {
        const authService = yield* AuthService
        const user = yield* authService.validateToken(token)
        return user
      })
  })
)

// Apply to group
class SecureApi extends HttpApiGroup.make("secure")
  .add(protectedEndpoint)
  .middleware(AuthMiddleware)
{}
```

---

## Part 2: Generated OpenAPI Client (Frontend)

### 2.1 Client Generation

The API client is generated from the Effect HttpApi definition:

```bash
# Generate typed client from OpenAPI spec
pnpm generate:api
```

This runs the generation script that:
1. Exports OpenAPI spec from `AppApi` using `OpenApi.fromApi()`
2. Generates TypeScript types using `openapi-typescript`
3. Creates a configured `openapi-fetch` client

### 2.2 Client Usage

```typescript
// packages/web/src/api/client.ts (generated)
import createClient from "openapi-fetch"
import type { paths } from "./schema.ts"

export const api = createClient<paths>({
  baseUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  credentials: "include"  // Include cookies for auth
})
```

### 2.3 Making API Calls

```typescript
import { api } from "@/api/client"

// GET request
const { data, error } = await api.GET("/api/v1/accounts", {
  params: {
    query: { companyId: "comp_123", page: 1, limit: 20 }
  }
})

// GET with path params
const { data, error } = await api.GET("/api/v1/accounts/{accountId}", {
  params: {
    path: { accountId: "acc_456" }
  }
})

// POST request
const { data, error } = await api.POST("/api/v1/accounts", {
  body: {
    name: "Cash",
    type: "Asset",
    companyId: "comp_123"
  }
})

// PATCH request
const { data, error } = await api.PATCH("/api/v1/accounts/{accountId}", {
  params: { path: { accountId: "acc_456" } },
  body: { name: "Updated Name" }
})

// DELETE request
const { data, error } = await api.DELETE("/api/v1/accounts/{accountId}", {
  params: { path: { accountId: "acc_456" } }
})
```

### 2.4 Error Handling

```typescript
const { data, error } = await api.POST("/api/v1/accounts", { body })

if (error) {
  // error is typed based on the endpoint's error responses
  if (error.status === 422) {
    // ValidationError - error.body has the error details
    console.log(error.body.errors)
  } else if (error.status === 401) {
    // UnauthorizedError
    redirect({ to: "/login" })
  } else if (error.status === 404) {
    // NotFoundError
    console.log(error.body.message)
  }
  return
}

// data is typed as the success response
console.log(data.id, data.name)
```

---

## Part 3: TanStack Start SSR Patterns

### 3.1 Route with SSR Data Fetching

**IMPORTANT**: Always pass the cookie header in loaders for authenticated endpoints.

```typescript
// packages/web/src/routes/organizations/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { api } from "@/api/client"

export const Route = createFileRoute("/organizations/")({
  // Auth check - runs before loader
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" })
    }
  },

  // SSR data fetch - runs on server
  loader: async ({ request }) => {
    // Forward cookie from request to API for authentication
    const cookie = request.headers.get("cookie")

    const { data, error } = await api.GET("/api/v1/organizations", {
      headers: cookie ? { cookie } : undefined
    })

    if (error) {
      throw new Error("Failed to load organizations")
    }
    return { organizations: data ?? [] }
  },

  component: OrganizationsPage
})

function OrganizationsPage() {
  // Data is immediately available - no loading state needed
  const { organizations } = Route.useLoaderData()

  return (
    <div>
      <h1>Organizations</h1>
      <ul>
        {organizations.map(org => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 3.2 Root Route with Auth Context (Cookie-Based Auth)

**IMPORTANT**: Authentication uses httpOnly cookies. The cookie header must be forwarded from the request to API calls during SSR.

```typescript
// packages/web/src/routes/__root.tsx
import { createRootRouteWithContext } from "@tanstack/react-router"
import { api } from "@/api/client"

interface RouterContext {
  user: User | null
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ request }) => {
    // Get the cookie header from the SSR request
    const cookie = request?.headers?.get("cookie")

    if (!cookie) {
      return { user: null }
    }

    // Pass cookie header to API - server will validate the session
    const { data, error } = await api.GET("/api/auth/me", {
      headers: { cookie }  // Forward the cookie header, NOT Authorization
    })

    if (error) {
      return { user: null }
    }

    return { user: data?.user ?? null }
  },

  component: RootComponent
})

function RootComponent() {
  return (
    <html>
      <body>
        <Outlet />
      </body>
    </html>
  )
}
```

### 3.3 Client-Side Mutations with Revalidation

```typescript
function CreateOrganizationForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const { data, error } = await api.POST("/api/v1/organizations", {
      body: { name }
    })

    if (error) {
      setError(error.body?.message ?? "Failed to create organization")
      setIsSubmitting(false)
      return
    }

    // Revalidate loader data to show new organization
    await router.invalidate()

    // Navigate to new organization
    router.navigate({ to: `/organizations/${data.id}` })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Organization name"
        disabled={isSubmitting}
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create"}
      </button>
    </form>
  )
}
```

### 3.4 Login Page Pattern

```typescript
// packages/web/src/routes/login.tsx
import { createFileRoute, redirect, useRouter, useNavigate } from "@tanstack/react-router"
import { api } from "@/api/client"

export const Route = createFileRoute("/login")({
  // Redirect to home if already logged in
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/" })
    }
  },
  component: LoginPage
})

function LoginPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const { error } = await api.POST("/api/auth/login", {
      body: { email, password }
    })

    if (error) {
      setError("Invalid email or password")
      setIsSubmitting(false)
      return
    }

    // Cookie is set by API response
    // Invalidate to re-run beforeLoad with new auth state
    await router.invalidate()

    // Navigate to home (or redirect param)
    navigate({ to: "/" })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log In"}
      </button>
    </form>
  )
}
```

### 3.5 Protected Route Pattern

```typescript
// packages/web/src/routes/organizations/$organizationId/index.tsx
import { createFileRoute, redirect } from "@tanstack/react-router"
import { api } from "@/api/client"

export const Route = createFileRoute("/organizations/$organizationId/")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" })
    }
  },

  loader: async ({ params, request }) => {
    // Forward cookie for SSR authentication
    const cookie = request.headers.get("cookie")

    const [orgResult, companiesResult] = await Promise.all([
      api.GET("/api/v1/organizations/{organizationId}", {
        params: { path: { organizationId: params.organizationId } },
        headers: cookie ? { cookie } : undefined
      }),
      api.GET("/api/v1/organizations/{organizationId}/companies", {
        params: { path: { organizationId: params.organizationId } },
        headers: cookie ? { cookie } : undefined
      })
    ])

    if (orgResult.error) {
      throw new Error("Organization not found")
    }

    return {
      organization: orgResult.data,
      companies: companiesResult.data ?? []
    }
  },

  component: OrganizationDetailsPage
})

function OrganizationDetailsPage() {
  const { organization, companies } = Route.useLoaderData()

  return (
    <div>
      <h1>{organization.name}</h1>
      <h2>Companies</h2>
      <ul>
        {companies.map(company => (
          <li key={company.id}>{company.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Part 4: Key Patterns Summary

### 4.1 SSR Data Flow

1. **beforeLoad**: Auth checks, redirects - runs before loader
2. **loader**: Fetch data server-side using `api` client
3. **useLoaderData**: Access data in component - no loading state needed
4. **router.invalidate()**: Refetch data after mutations

### 4.2 State Management

| State Type | Where to Store |
|------------|----------------|
| Server data (lists, entities) | `loader()` + `useLoaderData()` |
| Form input (before submit) | `useState` |
| UI state (modals, toggles) | `useState` |
| URL state (filters, pagination) | URL search params |

### 4.3 When to Use What

| Need | Solution |
|------|----------|
| Load data on page | `loader()` |
| Auth check | `beforeLoad()` |
| Create/Update/Delete | `api.POST/PATCH/DELETE` + `router.invalidate()` |
| Form state | `useState` |
| Refresh after mutation | `router.invalidate()` |
| Navigate after action | `useNavigate()` or `redirect()` |

---

## Part 5: Anti-Patterns (FORBIDDEN)

### 5.1 DO NOT Use createServerFn for API Calls

```typescript
// ❌ WRONG - Do not use createServerFn for data fetching
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

const fetchData = createServerFn({ method: "GET" })
  .handler(async () => {
    const sessionToken = getCookie("session")
    const response = await fetch("/api/v1/data", {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    return response.json()
  })

// ✅ CORRECT - Use loader with api client
loader: async ({ request }) => {
  const cookie = request.headers.get("cookie")
  const { data } = await api.GET("/api/v1/data", {
    headers: cookie ? { cookie } : undefined
  })
  return { data }
}
```

### 5.2 DO NOT Use Raw fetch()

```typescript
// ❌ WRONG - Raw fetch bypasses type safety
const response = await fetch("/api/v1/organizations")
const data = await response.json()

// ✅ CORRECT - Use typed api client
const { data, error } = await api.GET("/api/v1/organizations")
```

### 5.3 DO NOT Store Tokens in localStorage

```typescript
// ❌ WRONG - localStorage is vulnerable to XSS
localStorage.setItem("token", response.token)
headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }

// ✅ CORRECT - Server sets httpOnly cookie, client sends automatically
// Login response sets cookie via Set-Cookie header
// Browser includes cookies automatically with credentials: "include"
await api.POST("/api/auth/login", { body: { email, password } })
```

### 5.4 DO NOT Return Tokens in API Response Body

```typescript
// ❌ WRONG - Token in response body can be stolen by XSS
return { token: sessionToken, user: { ... } }

// ✅ CORRECT - Set token in httpOnly cookie only
HttpServerResponse.setCookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict"
})
return { user: { id, email, displayName } }
```

### 5.5 DO NOT Manually Parse Cookies for Auth

```typescript
// ❌ WRONG - Manual cookie parsing and token handling
const cookie = request.headers.get("cookie")
const token = parseCookie(cookie, "session")
headers: { Authorization: `Bearer ${token}` }

// ✅ CORRECT - Forward entire cookie header, let server handle it
const cookie = request.headers.get("cookie")
headers: cookie ? { cookie } : undefined
```

---

## Summary

This architecture provides:

1. **Type-safe API definitions** using Effect Schema (backend)
2. **Generated typed client** via openapi-typescript + openapi-fetch
3. **SSR data fetching** with TanStack Start loaders
4. **Simple state management** with React useState for local state
5. **Automatic revalidation** with router.invalidate()
6. **No Effect code in frontend** - plain fetch calls via generated client
7. **Full-stack type safety** from database to UI
