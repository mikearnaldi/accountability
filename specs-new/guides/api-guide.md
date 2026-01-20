# API Guide

This is the consolidated guide for API development in the Accountability project, covering Effect HttpApi patterns on the backend and openapi-fetch client usage on the frontend.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Defining API Endpoints (Backend)](#defining-api-endpoints-backend)
3. [Request/Response Schemas](#requestresponse-schemas)
4. [Implementing Handlers](#implementing-handlers)
5. [Authentication & Middleware](#authentication--middleware)
6. [Generated Client (Frontend)](#generated-client-frontend)
7. [SSR Patterns with TanStack Start](#ssr-patterns-with-tanstack-start)
8. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Architecture Overview

```
Frontend (openapi-fetch) → API (Effect HttpApi) → Service → Repository → Database
```

**Backend (Effect):**
- `HttpApi` - Define typed API contracts using Schema
- `HttpApiBuilder` - Implement handlers with full type safety
- Auto-generates OpenAPI spec

**Frontend (React):**
- `openapi-fetch` - Type-safe client generated from OpenAPI spec
- No Effect code - just typed fetch calls
- TanStack Start loaders for SSR

---

## Defining API Endpoints (Backend)

### Use Domain Schemas Directly

HttpApi automatically decodes path params, URL params, headers, and payloads. Use domain schemas directly instead of raw strings:

```typescript
// GOOD: Use AccountId directly - automatic decoding
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))  // Branded type
  .addSuccess(Account)

// Handler receives already-decoded AccountId
.handle("getAccount", (_) =>
  Effect.gen(function* () {
    // _.path.id is already AccountId - no manual decoding!
    const account = yield* accountRepo.findById(_.path.id)
    // ...
  })
)

// BAD: Raw strings require manual decoding
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: Schema.String }))  // Raw string

.handle("getAccount", (_) =>
  Effect.gen(function* () {
    // Manual decoding - this is a red flag!
    const accountId = yield* Schema.decodeUnknown(AccountId)(_.path.id)
    // ...
  })
)
```

### Creating API Groups

```typescript
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

// Group related endpoints
class AccountsApi extends HttpApiGroup.make("accounts")
  .add(findById)
  .add(create)
  .add(list)
  .prefix("/api/v1")
  .addError(UnauthorizedError, { status: 401 })
{}

// Compose into full API
class AppApi extends HttpApi.make("app")
  .add(AccountsApi)
  .add(CompaniesApi)
  .add(ReportsApi)
  .addError(InternalServerError, { status: 500 })
{}
```

---

## Request/Response Schemas

### Path Parameters

Path parameters are always strings. Use branded string schemas:

```typescript
export const AccountId = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f-]{36}$/),
  Schema.brand("AccountId")
)

const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .setPath(Schema.Struct({ id: AccountId }))
```

### URL Query Parameters

Use transforming schemas for non-string types:

```typescript
export const AccountListParams = Schema.Struct({
  companyId: CompanyId,                                    // Branded string
  accountType: Schema.optional(AccountType),               // String literal union
  isActive: Schema.optional(Schema.BooleanFromString),     // Transform to boolean
  limit: Schema.optional(Schema.NumberFromString.pipe(     // Transform to number
    Schema.int(),
    Schema.greaterThan(0)
  ))
})
```

### Request Bodies

Use domain schemas directly for JSON payloads:

```typescript
export class CreateAccountRequest extends Schema.Class<CreateAccountRequest>("CreateAccountRequest")({
  companyId: CompanyId,
  accountType: AccountType,
  parentAccountId: Schema.OptionFromNullOr(AccountId),  // Option encoded as null
}) {}
```

### Response Bodies

Return domain entities directly:

```typescript
const getAccount = HttpApiEndpoint.get("getAccount", "/:id")
  .addSuccess(Account)  // Domain entity as response

// For lists with metadata
export class AccountListResponse extends Schema.Class<AccountListResponse>("AccountListResponse")({
  accounts: Schema.Array(Account),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number
}) {}
```

### Error Responses

Annotate error schemas with HTTP status codes:

```typescript
class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  { resource: Schema.String, id: Schema.String },
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
```

---

## Implementing Handlers

```typescript
const AccountsLive = HttpApiBuilder.group(
  AppApi,
  "accounts",
  (handlers) =>
    handlers
      .handle("findById", ({ path }) =>
        Effect.gen(function* () {
          const service = yield* AccountService
          const account = yield* service.findById(path.accountId)
          return yield* Option.match(account, {
            onNone: () => Effect.fail(new NotFoundError({
              resource: "Account",
              resourceId: path.accountId
            })),
            onSome: Effect.succeed
          })
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
          // urlParams are already decoded
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

// Compose all implementations
const ApiLive = HttpApiBuilder.api(AppApi).pipe(
  Layer.provide([AccountsLive, CompaniesLive, ReportsLive])
)
```

---

## Authentication & Middleware

### Cookie-Based Authentication

```typescript
class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
  "AuthMiddleware",
  {
    failure: UnauthorizedError,
    provides: CurrentUser,
    security: {
      cookie: HttpApiSecurity.apiKey({
        key: "session",
        in: "cookie"
      })
    }
  }
) {}

const AuthMiddlewareLive = Layer.succeed(
  AuthMiddleware,
  AuthMiddleware.of({
    cookie: (token) =>
      Effect.gen(function* () {
        const authService = yield* AuthService
        const user = yield* authService.validateSession(token)
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

### Setting Cookies in Responses

```typescript
// In login handler
HttpServerResponse.setCookie("session", token, {
  httpOnly: true,    // Not accessible via JavaScript
  secure: true,      // HTTPS only
  sameSite: "strict" // CSRF protection
})
```

---

## Generated Client (Frontend)

### Client Generation

```bash
# Generate typed client from OpenAPI spec
pnpm generate:api
```

### Making API Calls

```typescript
import { api } from "@/api/client"

// GET with query params
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

// POST
const { data, error } = await api.POST("/api/v1/accounts", {
  body: {
    name: "Cash",
    type: "Asset",
    companyId: "comp_123"
  }
})

// PATCH
const { data, error } = await api.PATCH("/api/v1/accounts/{accountId}", {
  params: { path: { accountId: "acc_456" } },
  body: { name: "Updated Name" }
})

// DELETE
const { data, error } = await api.DELETE("/api/v1/accounts/{accountId}", {
  params: { path: { accountId: "acc_456" } }
})
```

### Error Handling

```typescript
const { data, error } = await api.POST("/api/v1/accounts", { body })

if (error) {
  if (error.status === 422) {
    // ValidationError
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

## SSR Patterns with TanStack Start

### Route with SSR Data Fetching

**IMPORTANT**: Always forward the cookie header for authenticated endpoints.

```typescript
export const Route = createFileRoute("/organizations/")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" })
    }
  },

  loader: async ({ request }) => {
    // Forward cookie from request to API
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
  const { organizations } = Route.useLoaderData()
  // Data is immediately available - no loading state needed
  return <ul>{organizations.map(org => <li key={org.id}>{org.name}</li>)}</ul>
}
```

### Root Route with Auth Context

```typescript
export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ request }) => {
    const cookie = request?.headers?.get("cookie")

    if (!cookie) {
      return { user: null }
    }

    // Forward cookie header to API
    const { data, error } = await api.GET("/api/auth/me", {
      headers: { cookie }
    })

    return { user: error ? null : data?.user ?? null }
  },

  component: RootComponent
})
```

### Client-Side Mutations with Revalidation

```typescript
function CreateOrganizationForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const { data, error } = await api.POST("/api/v1/organizations", {
      body: { name }
    })

    if (error) {
      setIsSubmitting(false)
      return
    }

    // Revalidate loader data
    await router.invalidate()
    router.navigate({ to: `/organizations/${data.id}` })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

---

## Anti-Patterns to Avoid

### DO NOT Use Raw fetch()

```typescript
// WRONG - bypasses type safety
const response = await fetch("/api/v1/organizations")
const data = await response.json()

// CORRECT - use typed client
const { data, error } = await api.GET("/api/v1/organizations")
```

### DO NOT Store Tokens in localStorage

```typescript
// WRONG - vulnerable to XSS
localStorage.setItem("token", response.token)
headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }

// CORRECT - server sets httpOnly cookie, browser sends automatically
await api.POST("/api/auth/login", { body: { email, password } })
```

### DO NOT Return Tokens in Response Body

```typescript
// WRONG - token can be stolen by XSS
return { token: sessionToken, user: { ... } }

// CORRECT - set token in httpOnly cookie only
HttpServerResponse.setCookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict"
})
return { user: { id, email, displayName } }
```

### DO NOT Use createServerFn for API Calls

```typescript
// WRONG
import { createServerFn } from "@tanstack/react-start"
const fetchData = createServerFn({ method: "GET" }).handler(async () => { ... })

// CORRECT - use loader with api client
loader: async ({ request }) => {
  const cookie = request.headers.get("cookie")
  const { data } = await api.GET("/api/v1/data", {
    headers: cookie ? { cookie } : undefined
  })
  return { data }
}
```

### DO NOT Manually Decode in Handlers

```typescript
// WRONG - manual decoding in handler
.handle("getAccount", (_) =>
  Effect.gen(function* () {
    const accountId = yield* Schema.decodeUnknown(AccountId)(_.path.id)
    // ...
  })
)

// CORRECT - use domain schema in endpoint definition
.setPath(Schema.Struct({ id: AccountId }))  // Auto-decodes

.handle("getAccount", (_) =>
  Effect.gen(function* () {
    // _.path.id is already AccountId
    const account = yield* repo.findById(_.path.id)
  })
)
```

---

## API Definition Checklist

1. **Path params**: Use branded string schemas (`AccountId`, `CompanyId`)
2. **Query params**: Use branded strings + transforming schemas (`BooleanFromString`, `NumberFromString`)
3. **Request body**: Use domain schemas with `OptionFromNullOr` for optional fields
4. **Response body**: Return domain entities or wrap in response classes
5. **Errors**: Annotate with HTTP status codes
6. **No manual decoding**: If calling `Schema.decode*` in a handler, reconsider the API schema
7. **Forward cookies**: Always forward the cookie header in SSR loaders
