# Effect HttpApi + TanStack Router + Effect Atom Integration

This document outlines the architecture for integrating Effect's HttpApi with TanStack Router (similar to tRPC integration) and Effect Atom for frontend state management.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   Effect Atom   │◄──►│  HttpApiClient  │                     │
│  │  (State Mgmt)   │    │  (Type-safe)    │                     │
│  └─────────────────┘    └────────┬────────┘                     │
└──────────────────────────────────┼──────────────────────────────┘
                                   │ HTTP
┌──────────────────────────────────┼──────────────────────────────┐
│                        Backend (TanStack Start)                  │
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

## Part 2: HttpApiClient (Type-Safe Client)

### 2.1 Creating the Client

```typescript
import { HttpApiClient } from "@effect/platform"
import { FetchHttpClient } from "@effect/platform"

// Create type-safe client
const makeClient = Effect.gen(function* () {
  return yield* HttpApiClient.make(AppApi, {
    baseUrl: "http://localhost:3000",
    transformClient: HttpClient.mapRequest(
      HttpClientRequest.bearerToken(yield* AuthToken)
    )
  })
})

// Usage
const program = Effect.gen(function* () {
  const client = yield* makeClient

  // Type-safe calls
  const account = yield* client.accounts.findById({
    path: { accountId: AccountId.make("acc_123") }
  })

  const accounts = yield* client.accounts.list({
    urlParams: { companyId: CompanyId.make("comp_456") }
  })

  const newAccount = yield* client.accounts.create({
    payload: {
      name: "Cash",
      type: "Asset",
      companyId: CompanyId.make("comp_456")
    }
  })
})
```

---

## Part 3: Effect Atom (Frontend State Management)

Packages: `@effect-atom/atom` and `@effect-atom/atom-react`
Reference: `repos/effect-atom/`

> **For comprehensive Effect Atom documentation including reactivity patterns, refresh mechanics, and anti-patterns, see [EFFECT_ATOM.md](./EFFECT_ATOM.md)**

### 3.1 Core Concepts

Effect Atom provides reactive state management that integrates with Effect:

```typescript
import * as Atom from "@effect-atom/atom"
import * as Result from "@effect-atom/atom/Result"
import { Effect, Option } from "effect"

// Simple state (writable)
const countAtom = Atom.make(0)

// Computed/derived state (read-only)
const doubleAtom = Atom.readable((get) => get(countAtom) * 2)

// Async state from Effect (returns Result.Result<A, E>)
const accountsAtom = Atom.make(
  Effect.gen(function* () {
    const client = yield* ApiClient
    return yield* client.accounts.list({
      urlParams: { companyId: yield* CurrentCompanyId }
    })
  })
)

// Keep atom alive when not in use
const persistentAtom = Atom.make(0).pipe(Atom.keepAlive)

// Set idle TTL (auto-dispose after duration)
const cachedAtom = Atom.make(fetchData).pipe(
  Atom.setIdleTTL(Duration.minutes(5))
)
```

### 3.2 React Hooks

```typescript
import { useAtomValue, useAtom, useSetAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"

function AccountList() {
  // Read async value
  const result = useAtomValue(accountsAtom)

  return Result.match(result, {
    onInitial: () => <Loading />,
    onWaiting: (prev) => <Loading previous={prev} />,
    onSuccess: ({ value }) => (
      <ul>
        {value.map(acc => <AccountRow key={acc.id} account={acc} />)}
      </ul>
    ),
    onFailure: ({ cause }) => <ErrorDisplay cause={cause} />
  })
}

function Counter() {
  // Read + write
  const [count, setCount] = useAtom(countAtom)

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  )
}
```

### 3.3 AtomHttpApi - Type-Safe HttpApi Client Integration

The `AtomHttpApi` module provides first-class integration with Effect HttpApi:

```typescript
import * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"
import { FetchHttpClient } from "@effect/platform"

// Create type-safe client service
class ApiClient extends AtomHttpApi.Tag<ApiClient>()(
  "ApiClient",
  {
    api: AppApi,
    httpClient: FetchHttpClient.layer,
    baseUrl: "http://localhost:3000"
  }
) {}

// Queries - for GET endpoints, returns Atom<Result<A, E>>
const accountsAtom = ApiClient.query("accounts", "list", {
  urlParams: { companyId: "comp_123" },
  timeToLive: Duration.minutes(5)  // optional caching
})

const accountAtom = ApiClient.query("accounts", "findById", {
  path: { accountId: "acc_456" }
})

// Mutations - for POST/PUT/DELETE, returns AtomResultFn<Arg, A, E>
const createAccountMutation = ApiClient.mutation("accounts", "create")
const updateAccountMutation = ApiClient.mutation("accounts", "update")
const deleteAccountMutation = ApiClient.mutation("accounts", "remove")
```

### 3.4 Data Fetching Patterns (Replacing TanStack Query)

```typescript
// Pattern 1: Runtime-based atoms (with Layer dependencies)
const appRuntime = Atom.runtime(
  Layer.mergeAll(
    FetchHttpClient.layer,
    AuthServiceLive
  )
)

const accountsAtom = appRuntime.atom(
  Effect.gen(function* () {
    const client = yield* ApiClient
    return yield* client.accounts.list({ urlParams: {} })
  })
)

// Pattern 2: Family (parameterized atoms with memoization)
const accountFamily = Atom.family((id: string) =>
  ApiClient.query("accounts", "findById", {
    path: { accountId: id }
  })
)

// Usage: accountFamily("acc_123") returns memoized atom

// Pattern 3: Mutations with Atom.fn
const createAccountAtom = Atom.fn((input: CreateAccountInput) =>
  Effect.gen(function* () {
    const client = yield* ApiClient
    return yield* client.accounts.create({ payload: input })
  })
)

// Pattern 4: Optimistic updates
const accountsOptimistic = Atom.optimistic(accountsAtom)

const createAccountOptimistic = Atom.optimisticFn(accountsOptimistic, {
  // Optimistically add to list
  reducer: (accounts, newAccount) => [...accounts, newAccount],
  // Actual mutation
  fn: createAccountAtom
})

// Pattern 5: Pagination / Infinite scroll with Atom.pull
const accountsPullAtom = Atom.pull(
  Stream.paginateChunkEffect(1, (page) =>
    Effect.gen(function* () {
      const client = yield* ApiClient
      const accounts = yield* client.accounts.list({
        urlParams: { page, limit: 20 }
      })
      const nextPage = accounts.length === 20 ? Option.some(page + 1) : Option.none()
      return [Chunk.fromIterable(accounts), nextPage]
    })
  ),
  { disableAccumulation: false }
)
// Pull more: useSetAtom(accountsPullAtom)(void)

// Pattern 6: Auto-refresh on window focus
const accountsAtom = Atom.make(fetchAccounts).pipe(
  Atom.refreshOnWindowFocus
)

// Pattern 7: Debounced search
const searchQueryAtom = Atom.make("")

const searchResultsAtom = Atom.readable((get) =>
  Effect.gen(function* () {
    const query = get(searchQueryAtom)
    if (query.length < 2) return []
    const client = yield* ApiClient
    return yield* client.accounts.search({ urlParams: { query } })
  })
).pipe(Atom.debounce(Duration.millis(300)))

// Pattern 8: SubscriptionRef (real-time updates)
const liveDataAtom = Atom.subscriptionRef(
  Effect.gen(function* () {
    const ref = yield* SubscriptionRef.make(initialData)
    // Set up WebSocket or other live updates
    return ref
  })
)
```

### 3.5 Provider Setup

```typescript
// packages/web/src/main.tsx
import { RegistryProvider } from "@effect-atom/atom-react"
import * as Registry from "@effect-atom/atom/Registry"

// Create registry
const registry = Registry.make()

function App() {
  return (
    <RegistryProvider registry={registry}>
      <Suspense fallback={<Loading />}>
        <Router />
      </Suspense>
    </RegistryProvider>
  )
}
```

### 3.6 Result Type

The `Result` type represents async atom states:

```typescript
import * as Result from "@effect-atom/atom/Result"

type Result<A, E> =
  | Result.Initial      // Not yet started
  | Result.Waiting<A, E> // Loading (may have previous value)
  | Result.Success<A, E> // Success with value
  | Result.Failure<A, E> // Failure with cause

// Helpers
Result.isInitial(result)
Result.isWaiting(result)
Result.isSuccess(result)
Result.isFailure(result)
Result.value(result)  // Option<A>
Result.getOrThrow(result)  // A (throws if not success)
Result.match(result, { onInitial, onWaiting, onSuccess, onFailure })
```

---

## Part 4: Full Integration Example

### 4.1 API Definition (Shared)

```typescript
// packages/api/src/AccountsApi.ts
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Account, AccountId, CreateAccountInput, CompanyId } from "@accountability/core"

const accountIdParam = HttpApiSchema.param("accountId", AccountId)

export const findById = HttpApiEndpoint.get("findById")`/accounts/${accountIdParam}`
  .addSuccess(Account)
  .addError(NotFoundError)

export const list = HttpApiEndpoint.get("list", "/accounts")
  .setUrlParams(Schema.Struct({
    companyId: Schema.optional(CompanyId),
    page: Schema.optional(Schema.NumberFromString),
    limit: Schema.optional(Schema.NumberFromString)
  }))
  .addSuccess(Schema.Array(Account))

export const create = HttpApiEndpoint.post("create", "/accounts")
  .setPayload(CreateAccountInput)
  .addSuccess(Account, { status: 201 })
  .addError(ValidationError)

export class AccountsApi extends HttpApiGroup.make("accounts")
  .add(findById)
  .add(list)
  .add(create)
  .prefix("/api/v1")
{}
```

### 4.2 Server Implementation

```typescript
// packages/web/src/api/accounts.ts
import { HttpApiBuilder } from "@effect/platform"
import { AccountsApi, AppApi } from "@accountability/api"
import { AccountService } from "@accountability/core"

export const AccountsLive = HttpApiBuilder.group(
  AppApi,
  "accounts",
  (handlers) =>
    handlers
      .handle("findById", ({ path }) =>
        Effect.gen(function* () {
          const service = yield* AccountService
          return yield* service.findById(path.accountId).pipe(
            Effect.flatMap(Option.match({
              onNone: () => Effect.fail(new NotFoundError({
                message: "Account not found",
                resourceId: path.accountId
              })),
              onSome: Effect.succeed
            }))
          )
        })
      )
      .handle("list", ({ urlParams }) =>
        Effect.gen(function* () {
          const service = yield* AccountService
          return yield* service.list(urlParams)
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const service = yield* AccountService
          return yield* service.create(payload)
        })
      )
).pipe(
  Layer.provide(AccountServiceLive)
)
```

### 4.3 Frontend Atoms with AtomHttpApi

```typescript
// packages/web/src/atoms/apiClient.ts
import * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"
import { FetchHttpClient } from "@effect/platform"
import { AppApi } from "@accountability/api"

// Create type-safe API client service
export class ApiClient extends AtomHttpApi.Tag<ApiClient>()(
  "ApiClient",
  {
    api: AppApi,
    httpClient: FetchHttpClient.layer,
    baseUrl: typeof window !== "undefined" ? window.location.origin : ""
  }
) {}
```

```typescript
// packages/web/src/atoms/accounts.ts
import * as Atom from "@effect-atom/atom"
import { ApiClient } from "./apiClient"
import type { CreateAccountInput } from "@accountability/core"

// Accounts list query
export const accountsAtom = ApiClient.query("accounts", "list", {
  urlParams: {}
})

// Single account query (parameterized)
export const accountAtom = Atom.family((id: string) =>
  ApiClient.query("accounts", "findById", {
    path: { accountId: id }
  })
)

// Create account mutation
export const createAccountMutation = ApiClient.mutation("accounts", "create")

// With optimistic updates
export const accountsOptimistic = Atom.optimistic(accountsAtom)

export const createAccountOptimistic = Atom.optimisticFn(accountsOptimistic, {
  reducer: (accounts, input: CreateAccountInput) => [
    ...accounts,
    { ...input, id: `temp_${Date.now()}` }  // Optimistic placeholder
  ],
  fn: createAccountMutation
})
```

### 4.4 React Components

```typescript
// packages/web/src/components/AccountList.tsx
import { useAtomValue, useSetAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { accountsAtom, createAccountMutation } from "../atoms/accounts"

export function AccountList() {
  const result = useAtomValue(accountsAtom)
  const createAccount = useSetAtom(createAccountMutation)

  const handleCreate = () => {
    createAccount({
      payload: {
        name: "New Account",
        type: "Asset",
        companyId: "comp_1"
      }
    })
  }

  if (Result.isInitial(result) || Result.isWaiting(result)) {
    return <div>Loading accounts...</div>
  }

  if (Result.isFailure(result)) {
    return <div>Error: {String(result.cause)}</div>
  }

  const accounts = result.value

  return (
    <div>
      <h2>Accounts ({accounts.length})</h2>
      <ul>
        {accounts.map(account => (
          <li key={account.id}>{account.name} - {account.accountType}</li>
        ))}
      </ul>
      <button onClick={handleCreate}>
        Add Account
      </button>
    </div>
  )
}
```

### 4.5 App Setup

```typescript
// packages/web/src/main.tsx
import { RegistryProvider } from "@effect-atom/atom-react"
import * as Registry from "@effect-atom/atom/Registry"

const registry = Registry.make()

function App() {
  return (
    <RegistryProvider registry={registry}>
      <React.Suspense fallback={<div>Loading...</div>}>
        <RouterProvider router={router} />
      </React.Suspense>
    </RegistryProvider>
  )
}
```

---

## Part 5: Key Differences from tRPC

| Feature | tRPC | Effect HttpApi |
|---------|------|----------------|
| **Type Safety** | End-to-end via inference | End-to-end via Schema |
| **Schema Definition** | Zod (typical) | Effect Schema |
| **Error Handling** | Custom error formatter | Schema.TaggedError with status codes |
| **Middleware** | Procedure middleware | HttpApiMiddleware with Tags |
| **Client Generation** | Automatic from router | HttpApiClient from API definition |
| **OpenAPI** | Plugin required | Built-in HttpApiSwagger |
| **Batching** | Built-in | Via SqlResolver patterns |
| **Effect Integration** | None | Native |

---

## Summary

This architecture provides:

1. **Type-safe API definitions** using Effect Schema
2. **Automatic client generation** via HttpApiClient
3. **Native Effect integration** for dependency injection and error handling
4. **TanStack Start compatibility** via toWebHandler
5. **Effect Atom for state management** replacing TanStack Query
6. **OpenAPI documentation** out of the box
7. **Full-stack type safety** from database to UI
