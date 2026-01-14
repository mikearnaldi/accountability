# Effect Atom - Reactivity Patterns and Best Practices

This document covers the reactivity system, patterns, and best practices for Effect Atom in this codebase.

Reference: `repos/effect-atom/`

---

## 1. Core Reactivity System

### 1.1 How Atoms Track Dependencies

Effect Atom uses a **Node-based dependency graph** where each atom is backed by a Node that tracks:

- **parents**: Atoms this node depends on (read via `get()`)
- **children**: Atoms that depend on this node
- **listeners**: React components subscribed to changes
- **state**: Lifecycle flags (uninitialized, stale, valid, removed)

```typescript
// When you read an atom inside another atom, a dependency is automatically tracked
const baseAtom = Atom.make(5)

const derivedAtom = Atom.readable((get) => {
  // This creates: baseAtom -> derivedAtom dependency
  return get(baseAtom) * 2
})
```

**Key insight**: Dependencies are tracked automatically during execution. No manual dependency arrays needed.

### 1.2 Change Propagation

When an atom's value changes:

1. **Equality check**: Only propagates if value actually differs (`Equal.equals`)
2. **Child invalidation**: All dependent atoms are marked as "stale"
3. **Lazy recomputation**: Stale atoms recompute only when accessed
4. **Listener notification**: React components re-render via `useSyncExternalStore`

```
baseAtom changes → derivedAtom marked stale → component reads derivedAtom → recomputes
```

### 1.3 Registry and Subscriptions

The `Registry` is the central store for all atom state:

```typescript
import * as Registry from "@effect-atom/atom/Registry"
import { RegistryProvider } from "@effect-atom/atom-react"

const registry = Registry.make()

// In React
<RegistryProvider registry={registry}>
  <App />
</RegistryProvider>
```

Subscriptions happen automatically when using hooks:

```typescript
const result = useAtomValue(myAtom)  // Subscribes to changes
```

---

## 2. Refresh and Invalidation Patterns

### 2.1 useAtomRefresh (Correct Pattern)

The proper way to refresh an atom after a mutation:

```typescript
import { useAtomValue, useAtom, useAtomRefresh } from "@effect-atom/atom-react"

function JournalEntriesPage() {
  const entriesResult = useAtomValue(entriesQueryAtom)
  const refreshEntries = useAtomRefresh(entriesQueryAtom)

  const [, submitForApproval] = useAtom(submitMutation, { mode: "promise" })

  const handleSubmit = async (entry: JournalEntry) => {
    await submitForApproval({ path: { id: entry.id } })
    refreshEntries()  // Triggers re-fetch of the query atom
  }
}
```

### 2.2 How refresh() Works

`registry.refresh(atom)` does one of two things:

1. **Custom refresh** (if defined): Calls the atom's custom refresh function
2. **Default invalidation**: Marks atom as stale, clears parent tracking, triggers recomputation

```typescript
// Atom with custom refresh behavior
const derivedAtom = Atom.writable(
  (get) => get(baseAtom),
  (set, value) => set(baseAtom, value),
  // Custom refresh: refresh the base instead of self
  (refresh) => refresh(baseAtom)
)
```

### 2.3 Automatic Invalidation via Reactivity Keys

For mutations that should auto-invalidate related queries, use `reactivityKeys`:

```typescript
// Query with reactivity keys
const journalEntriesAtom = ApiClient.query("journalEntries", "list", {
  urlParams: { companyId },
  reactivityKeys: ["journalEntries", companyId]  // Keys this query listens to
})

// Mutation that invalidates queries with matching keys
const submitMutation = ApiClient.mutation("journalEntries", "submit", {
  reactivityKeys: ["journalEntries"]  // Invalidates all queries with this key
})
```

When the mutation completes, any queries with overlapping `reactivityKeys` are automatically refreshed.

---

## 3. Query and Mutation Patterns

### 3.1 Queries (Read Operations)

Queries are atoms that fetch data and return `Result<A, E>`:

```typescript
import { ApiClient } from "./ApiClient"
import * as Duration from "effect/Duration"

// Simple query
export const organizationsAtom = ApiClient.query("companies", "listOrganizations", {
  timeToLive: Duration.minutes(10)  // Cache for 10 minutes when idle
})

// Query with parameters
export const companyByIdFamily = Atom.family((id: CompanyId) =>
  ApiClient.query("companies", "getCompany", {
    path: { id },
    timeToLive: Duration.minutes(5)
  })
)
```

### 3.2 Mutations (Write Operations)

Mutations are function atoms that execute on demand:

```typescript
// Define mutation
export const createCompanyMutation = ApiClient.mutation("companies", "createCompany")

// Use in component with promise mode
function CreateCompanyForm() {
  const [, runMutation] = useAtom(createCompanyMutation, { mode: "promise" })
  const refreshOrganizations = useAtomRefresh(organizationsAtom)

  const handleCreate = async (data: CreateCompanyInput) => {
    try {
      const result = await runMutation({ payload: data })
      console.log("Created:", result.value)
      refreshOrganizations()  // Refresh related query
    } catch (error) {
      console.error("Failed:", error)
    }
  }
}
```

### 3.3 Mutation → Query Refresh Flow

**Pattern 1: Manual refresh (explicit control)**

```typescript
const query = useAtomValue(queryAtom)
const refreshQuery = useAtomRefresh(queryAtom)
const [, mutation] = useAtom(mutationAtom, { mode: "promise" })

const handleMutation = async () => {
  await mutation({ payload: data })
  refreshQuery()  // Explicitly refresh after mutation
}
```

**Pattern 2: Reactivity keys (automatic)**

```typescript
// Query listens to keys
const entriesQuery = ApiClient.query("entries", "list", {
  reactivityKeys: ["entries", companyId]
})

// Mutation invalidates keys
const createEntry = ApiClient.mutation("entries", "create", {
  reactivityKeys: ["entries"]  // Auto-refreshes queries with this key
})
```

---

## 4. Anti-Patterns to Avoid

### 4.1 NEVER: window.location.reload()

```typescript
// ❌ BAD - Destroys all state, full page reload
const handleApprove = async () => {
  await approveMutation({ path: { id } })
  window.location.reload()  // DON'T DO THIS
}

// ✅ GOOD - Refresh only the affected atom
const handleApprove = async () => {
  await approveMutation({ path: { id } })
  refreshEntries()  // useAtomRefresh(entriesAtom)
}
```

### 4.2 NEVER: refreshKey State Pattern

```typescript
// ❌ BAD - Creates new atom instance on every refresh
const [refreshKey, setRefreshKey] = React.useState(0)

const entriesAtom = React.useMemo(
  () => createEntriesQueryAtom({ companyId }),
  [companyId, refreshKey]  // refreshKey forces new atom
)

const handleRefresh = () => setRefreshKey(k => k + 1)

// ✅ GOOD - Use useAtomRefresh
const entriesAtom = React.useMemo(
  () => createEntriesQueryAtom({ companyId }),
  [companyId]
)
const refreshEntries = useAtomRefresh(entriesAtom)
```

**Why refreshKey is bad**:
- Creates a new atom object each time (loses memoization)
- Previous atom becomes orphaned
- Loses caching benefits
- Not idiomatic effect-atom

### 4.3 NEVER: Creating atoms inside render without memoization

```typescript
// ❌ BAD - New atom every render
function Component({ id }) {
  const atom = ApiClient.query("items", "get", { path: { id } })
  return useAtomValue(atom)  // New subscription every render!
}

// ✅ GOOD - Use Atom.family for memoization
const itemFamily = Atom.family((id: string) =>
  ApiClient.query("items", "get", { path: { id } })
)

function Component({ id }) {
  const atom = itemFamily(id)  // Memoized - same id = same atom
  return useAtomValue(atom)
}

// ✅ ALSO GOOD - useMemo for one-off atoms
function Component({ id }) {
  const atom = React.useMemo(
    () => ApiClient.query("items", "get", { path: { id } }),
    [id]  // Only id in deps, NOT refreshKey
  )
  return useAtomValue(atom)
}
```

---

## 5. Best Practices

### 5.1 Define Atoms Outside Components

```typescript
// atoms/accounts.ts
export const accountsAtom = ApiClient.query("accounts", "list", {
  timeToLive: Duration.minutes(5)
})

export const accountFamily = Atom.family((id: AccountId) =>
  ApiClient.query("accounts", "get", { path: { id } })
)

export const createAccountMutation = ApiClient.mutation("accounts", "create")
```

### 5.2 Use Family for Parameterized Queries

```typescript
// Memoized by parameter
export const companyFamily = Atom.family((id: CompanyId) =>
  ApiClient.query("companies", "get", {
    path: { id },
    timeToLive: Duration.minutes(5)
  })
)

// Usage - same ID returns same atom instance
const company1 = companyFamily("company-123")
const company1Again = companyFamily("company-123")
// company1 === company1Again (referentially equal)
```

### 5.3 Handle Result States Properly

```typescript
import * as Result from "@effect-atom/atom/Result"

function AccountsList() {
  const result = useAtomValue(accountsAtom)

  // Check loading states
  if (Result.isInitial(result)) {
    return <div>Loading...</div>
  }

  if (Result.isWaiting(result)) {
    // Still loading but may have previous data
    const previous = Result.value(result)  // Option<A>
    return <div>Refreshing... {Option.isSome(previous) && "showing cached"}</div>
  }

  if (Result.isFailure(result)) {
    return <div>Error: {String(result.cause)}</div>
  }

  // Result.isSuccess(result) is true here
  return <ul>{result.value.map(acc => <li key={acc.id}>{acc.name}</li>)}</ul>
}
```

### 5.4 Mutation Patterns (Choose Based on Use Case)

**Pattern 1: Fire-and-forget with reactivityKeys (preferred)**

The Result already tracks loading/error states. No manual state needed:

```typescript
function CreateForm() {
  // Result tracks: Initial → Waiting → Success/Failure
  const [result, runMutation] = useAtom(createAccountMutation)

  const handleSubmit = (data: CreateAccountInput) => {
    // Fire mutation with reactivityKeys for auto-refresh
    runMutation({
      payload: data,
      reactivityKeys: ["accounts"]  // Auto-refreshes queries with this key
    })
    // Don't await - Result updates reactively
  }

  // UI reacts to Result state
  if (Result.isWaiting(result)) {
    return <div>Creating...</div>
  }
  if (Result.isFailure(result)) {
    return <div>Error: {Cause.pretty(result.cause)}</div>
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

**Pattern 2: React to success (for post-success actions like closing modals)**

```typescript
function CreateModal({ onClose }: { onClose: () => void }) {
  const [result, runMutation] = useAtom(createAccountMutation)
  const prevWaiting = React.useRef(false)

  // Detect success completion
  React.useEffect(() => {
    const wasWaiting = prevWaiting.current
    const isNowSuccess = Result.isSuccess(result) && !result.waiting
    prevWaiting.current = Result.isWaiting(result)

    if (wasWaiting && isNowSuccess) {
      onClose()  // Close modal on success
    }
  }, [result, onClose])

  const handleSubmit = (data: CreateAccountInput) => {
    runMutation({ payload: data, reactivityKeys: ["accounts"] })
  }

  return (
    <Modal>
      {Result.isFailure(result) && <ErrorBanner cause={result.cause} />}
      <form onSubmit={handleSubmit}>
        <button disabled={Result.isWaiting(result)}>
          {Result.isWaiting(result) ? "Creating..." : "Create"}
        </button>
      </form>
    </Modal>
  )
}
```

**Pattern 3: await with mode: "promise" (only for sequential operations)**

Use this ONLY when you must await completion (e.g., navigate to created resource):

```typescript
function CreateForm() {
  const navigate = useNavigate()
  // mode: "promise" returns Promise from setter
  const [, runMutation] = useAtom(createAccountMutation, { mode: "promise" })

  const handleSubmit = async (data: CreateAccountInput) => {
    try {
      const result = await runMutation({ payload: data })
      // Navigate to newly created item
      navigate(`/accounts/${result.value.id}`)
    } catch (err) {
      // Error is also in Result - this catch is for navigation logic only
      console.error("Cannot navigate - creation failed")
    }
  }
}
```

**When to use each pattern:**

| Pattern | Use When |
|---------|----------|
| Fire-and-forget | Default choice. Query refresh via reactivityKeys |
| React to success | Need to perform action on success (close modal, show toast) |
| await/promise | Must await completion (navigate to created resource, sequential ops) |

### 5.5 Use Batching for Multiple Updates

```typescript
import * as Atom from "@effect-atom/atom/Atom"

// Multiple writes trigger dependent atoms only ONCE after batch
Atom.batch(() => {
  registry.set(atom1, value1)
  registry.set(atom2, value2)
  registry.set(atom3, value3)
})
```

### 5.6 TTL and Lifecycle Management

```typescript
// Auto-dispose after 5 minutes of no subscribers
const cachedQuery = ApiClient.query("data", "list", {
  timeToLive: Duration.minutes(5)
})

// Never auto-dispose (stays in memory)
const persistentAtom = Atom.make(initialValue).pipe(Atom.keepAlive)

// Custom idle TTL
const customTTLAtom = Atom.make(fetchData).pipe(
  Atom.setIdleTTL(Duration.seconds(30))
)
```

---

## 6. Complete Example: Journal Entries Page

```typescript
// atoms/journalEntries.ts
import * as Atom from "@effect-atom/atom/Atom"
import * as Duration from "effect/Duration"
import { ApiClient } from "./ApiClient"

// Query with company parameter
export const createJournalEntriesQueryAtom = (params: {
  companyId: CompanyId
  status?: JournalEntryStatus
  limit?: number
}) =>
  ApiClient.query("journalEntries", "list", {
    urlParams: {
      companyId: params.companyId,
      status: params.status,
      limit: params.limit ?? 50
    },
    timeToLive: Duration.minutes(5),
    reactivityKeys: ["journalEntries", params.companyId]
  })

// Mutations - note: reactivityKeys can also be passed at call time
export const submitForApprovalMutation = ApiClient.mutation(
  "journalEntries",
  "submitForApproval"
)

export const approveMutation = ApiClient.mutation(
  "journalEntries",
  "approve"
)
```

```typescript
// routes/companies/$companyId.journal-entries.index.tsx
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"

function JournalEntriesPage() {
  const { companyId } = Route.useParams()
  const [statusFilter, setStatusFilter] = React.useState<string>("")

  // Create query atom (memoized by deps)
  const entriesQueryAtom = React.useMemo(
    () => createJournalEntriesQueryAtom({
      companyId: CompanyId.make(companyId),
      status: statusFilter || undefined
    }),
    [companyId, statusFilter]
  )

  // Subscribe to query
  const entriesResult = useAtomValue(entriesQueryAtom)

  // Mutations - Result tracks loading/error state
  const [submitResult, submitForApproval] = useAtom(submitForApprovalMutation)
  const [approveResult, approve] = useAtom(approveMutation)

  // Fire-and-forget with reactivityKeys - no await needed
  const handleSubmitForApproval = (entry: JournalEntry) => {
    submitForApproval({
      path: { id: entry.id },
      reactivityKeys: ["journalEntries", companyId]  // Auto-refreshes query
    })
  }

  const handleApprove = (entry: JournalEntry) => {
    approve({
      path: { id: entry.id },
      reactivityKeys: ["journalEntries", companyId]
    })
  }

  // Check if any mutation is in progress
  const isMutating = Result.isWaiting(submitResult) || Result.isWaiting(approveResult)

  // Show mutation errors
  const mutationError = Result.isFailure(submitResult)
    ? submitResult.cause
    : Result.isFailure(approveResult)
    ? approveResult.cause
    : null

  // Render based on Result state
  if (Result.isInitial(entriesResult) || Result.isWaiting(entriesResult)) {
    return <Loading />
  }

  if (Result.isFailure(entriesResult)) {
    return <ErrorDisplay cause={entriesResult.cause} />
  }

  const entries = entriesResult.value.entries

  return (
    <div>
      {mutationError && <ErrorBanner cause={mutationError} />}
      {isMutating && <LoadingOverlay />}
      <FilterBar value={statusFilter} onChange={setStatusFilter} />
      <EntriesList
        entries={entries}
        onSubmit={handleSubmitForApproval}
        onApprove={handleApprove}
        disabled={isMutating}
      />
    </div>
  )
}
```

---

## 7. AtomHttpApi Deep Dive

### 7.1 Tag Class Structure

The `AtomHttpApi.Tag` creates a type-safe API client with automatic layer composition:

```typescript
// packages/web/src/atoms/ApiClient.ts
import * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { AppApi } from "@accountability/api/Definitions/AppApi"

export class ApiClient extends AtomHttpApi.Tag<ApiClient>()(
  "ApiClient",
  {
    api: AppApi,                           // HttpApi definition
    httpClient: AuthenticatedHttpClient,   // Layer providing HttpClient
    baseUrl: typeof window !== "undefined" ? window.location.origin : ""
  }
) {}
```

**What the Tag provides:**
- `ApiClient.layer` - Layer that builds the HttpApiClient
- `ApiClient.runtime` - AtomRuntime for running effects with httpClient context
- `ApiClient.query()` - Creates query atoms (read-only)
- `ApiClient.mutation()` - Creates mutation atoms (writable)

### 7.2 Query Implementation Details

Internally, `ApiClient.query()` uses `Atom.family` for memoization:

```typescript
// Simplified from AtomHttpApi.ts
const queryFamily = Atom.family((opts: QueryKey) => {
  // 1. Create atom that calls the API
  let atom = self.runtime.atom(
    Effect.flatMap(self, (client) => client[opts.group][opts.endpoint](opts))
  )

  // 2. Apply timeToLive caching
  if (opts.timeToLive) {
    atom = Duration.isFinite(opts.timeToLive)
      ? Atom.setIdleTTL(atom, opts.timeToLive)  // Auto-dispose after idle
      : Atom.keepAlive(atom)                     // Never auto-dispose
  }

  // 3. Register for reactivity invalidation
  return opts.reactivityKeys
    ? self.runtime.factory.withReactivity(opts.reactivityKeys)(atom)
    : atom
})
```

**Query caching key includes:**
- group, endpoint
- path, urlParams, payload, headers
- withResponse, reactivityKeys, timeToLive

Two queries with identical parameters return the **same atom instance**.

### 7.3 Mutation Implementation Details

Mutations are function atoms that execute on demand:

```typescript
// Simplified from AtomHttpApi.ts
const mutationFamily = Atom.family(({ endpoint, group, withResponse }: MutationKey) =>
  self.runtime.fn<MutationArgs>()(
    Effect.fnUntraced(function*(opts) {
      const client = yield* self
      const effect = client[group][endpoint]({ ...opts, withResponse })

      // Wrap with Reactivity.mutation if keys provided
      return yield* opts.reactivityKeys
        ? Reactivity.mutation(effect, opts.reactivityKeys)
        : effect
    })
  )
)
```

**Key difference from queries:**
- Mutations are `AtomResultFn<Arg, Success, Error>` - writable atoms
- Each call can have different `reactivityKeys` (passed at call time)
- `Reactivity.mutation()` wrapper invalidates matching queries on completion

### 7.4 How Reactivity Keys Work

The Reactivity service maintains a registry of keys → callbacks:

```typescript
// When query registers with reactivityKeys
reactivity.unsafeRegister(keys, () => {
  get.refresh(queryAtom)  // Called when keys are invalidated
})

// When mutation completes with reactivityKeys
Reactivity.mutation(effect, keys)
// Internally calls Reactivity.invalidate(keys) on success
// Which triggers all registered callbacks for overlapping keys
```

**Matching logic:**
- Array keys: `["users"]` matches `["users"]`, `["users", "123"]`
- Object keys: `{ users: ["list"] }` matches queries with same structure

### 7.5 withResponse Option

Get the raw HTTP response alongside parsed data:

```typescript
// Query with response
const queryWithResponse = ApiClient.query("users", "get", {
  path: { id: "123" },
  withResponse: true
})
// Returns: Atom<Result<[User, HttpClientResponse], Error>>

// Mutation with response
const mutationWithResponse = ApiClient.mutation("users", "create", {
  withResponse: true
})
// Returns: AtomResultFn<Args, [User, HttpClientResponse], Error>
```

### 7.6 Error Types in Queries/Mutations

All API operations can fail with these error types:

```typescript
type QueryError<Endpoint, Group, ClientError> =
  | EndpointError          // Errors defined on the endpoint
  | GroupError             // Errors defined on the group
  | ClientError            // Errors from httpClient layer
  | HttpClientError        // HTTP-level errors (network, status codes)
  | ParseResult.ParseError // Schema decode/encode errors
```

### 7.7 Runtime and Layer Composition

The `AtomRuntime` provides context for atoms:

```typescript
// runtime.atom() - creates read-only async atom
const usersAtom = ApiClient.runtime.atom(
  Effect.gen(function*() {
    const client = yield* ApiClient  // Gets client from context
    return yield* client.users.list({})
  })
)

// runtime.fn() - creates writable function atom
const createUserFn = ApiClient.runtime.fn<CreateUserInput>()(
  Effect.fnUntraced(function*(input) {
    const client = yield* ApiClient
    return yield* client.users.create({ payload: input })
  })
)
```

**Layer composition:**
```typescript
// ApiClient.layer includes:
// - FetchHttpClient (or custom httpClient)
// - Reactivity.layer (always merged)
// - HttpApiClient.make(api, options)
```

### 7.8 Custom HTTP Client with Auth

Example of adding authentication to all requests:

```typescript
const AuthenticatedHttpClient = FetchHttpClient.layer.pipe(
  Layer.map((context) => {
    const client = Context.get(context, HttpClient.HttpClient)
    const authenticatedClient = HttpClient.mapRequest(client, (request) => {
      const token = localStorage.getItem("auth_token")
      return token
        ? HttpClientRequest.bearerToken(request, token)
        : request
    })
    return Context.add(context, HttpClient.HttpClient, authenticatedClient)
  })
)

export class ApiClient extends AtomHttpApi.Tag<ApiClient>()(
  "ApiClient",
  {
    api: AppApi,
    httpClient: AuthenticatedHttpClient,  // Custom layer
    baseUrl: window.location.origin
  }
) {}
```

---

## 8. Result Type Details

### 8.1 Result ADT

```typescript
type Result<A, E = never> = Initial<A, E> | Success<A, E> | Failure<A, E>

interface Initial<A, E> {
  readonly _tag: "Initial"
}

interface Success<A, E> {
  readonly _tag: "Success"
  readonly value: A
  readonly timestamp: number  // When value was received
}

interface Failure<A, E> {
  readonly _tag: "Failure"
  readonly cause: Cause<E>
  readonly previousSuccess: Option<Success<A, E>>  // For optimistic updates
}
```

### 8.2 Waiting State

Both Initial and Success can be in a "waiting" state:

```typescript
// Check if currently fetching (initial load or refresh)
if (Result.isWaiting(result)) {
  // Show loading indicator
  // May still have previous value: Result.value(result) returns Option<A>
}
```

### 8.3 Result Helpers

```typescript
import * as Result from "@effect-atom/atom/Result"

// Type guards
Result.isInitial(result)   // true if Initial
Result.isSuccess(result)   // true if Success
Result.isFailure(result)   // true if Failure
Result.isWaiting(result)   // true if currently loading

// Value extraction
Result.value(result)       // Option<A> - Some if has value
Result.getOrThrow(result)  // A - throws if not success

// Pattern matching
Result.match(result, {
  onInitial: () => <Loading />,
  onSuccess: ({ value }) => <Data value={value} />,
  onFailure: ({ cause }) => <Error cause={cause} />
})
```

---

## 9. Advanced Patterns

### 9.1 Optimistic Updates

```typescript
import * as Atom from "@effect-atom/atom/Atom"

// Wrap query for optimistic updates
const accountsOptimistic = Atom.optimistic(accountsAtom)

// Create optimistic mutation
const createAccountOptimistic = Atom.optimisticFn(accountsOptimistic, {
  // Immediately update UI
  reducer: (accounts, newAccount) => [...accounts, {
    ...newAccount,
    id: `temp_${Date.now()}`  // Temporary ID
  }],
  // Actual API call
  fn: createAccountMutation
})

// Usage: UI updates immediately, reverts on error
await createAccountOptimistic({ payload: newAccountData })
```

### 9.2 Pagination with pull()

```typescript
const accountsPullAtom = Atom.pull(
  Stream.paginateChunkEffect(1, (page) =>
    Effect.gen(function*() {
      const client = yield* ApiClient
      const accounts = yield* client.accounts.list({
        urlParams: { page, limit: 20 }
      })
      const nextPage = accounts.length === 20
        ? Option.some(page + 1)
        : Option.none()
      return [Chunk.fromIterable(accounts), nextPage]
    })
  ),
  { disableAccumulation: false }  // Accumulate pages
)

// Pull next page
const [result, pullMore] = useAtom(accountsPullAtom)
// result.value = { done: boolean, items: NonEmptyArray<Account> }
pullMore(void 0)  // Fetch next page
```

### 9.3 Debounced Search

```typescript
const searchQueryAtom = Atom.make("")

const searchResultsAtom = Atom.readable((get) =>
  Effect.gen(function*() {
    const query = get(searchQueryAtom)
    if (query.length < 2) return []
    const client = yield* ApiClient
    return yield* client.accounts.search({ urlParams: { query } })
  })
).pipe(Atom.debounce(Duration.millis(300)))
```

### 9.4 Multiple API Clients

```typescript
// Define multiple API clients
const MainApi = AtomHttpApi.Tag<MainApi>()("MainApi", { ... })
const AdminApi = AtomHttpApi.Tag<AdminApi>()("AdminApi", { ... })

// Use independently
const users = MainApi.query("users", "list", {})
const adminStats = AdminApi.query("stats", "dashboard", {})

// Or compose layers
const combinedRuntime = Atom.runtime(
  Layer.merge(MainApi.layer, AdminApi.layer)
)
```

---

## 10. AtomRuntime Deep Dive

### 10.1 What is AtomRuntime?

An `AtomRuntime<R, ER>` is a special atom that represents an Effect Layer execution environment. It provides methods to create atoms that can access services from a specific Effect context.

```typescript
import * as Atom from "@effect-atom/atom/Atom"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"

// Define a service
interface Counter {
  readonly get: Effect.Effect<number>
  readonly inc: Effect.Effect<void>
}
const Counter = Context.GenericTag<Counter>("Counter")

// Create layer implementation
const CounterLive = Layer.effect(
  Counter,
  Effect.sync(() => {
    let count = 0
    return Counter.of({
      get: Effect.sync(() => count),
      inc: Effect.sync(() => { count++ })
    })
  })
)

// Create runtime from layer
const counterRuntime = Atom.runtime(CounterLive)
```

**Key characteristics:**
- Extends `Atom<Result.Result<Runtime.Runtime<R>, ER>>`
- Manages a `Layer<R, ER>` that defines services/dependencies
- Provides a `factory: RuntimeFactory` for creating derived atoms
- Includes methods: `atom()`, `fn()`, `pull()`, `subscriptionRef()`, `subscribable()`

### 10.2 runtime.atom() - Read-Only Async Atoms

Creates a read-only atom that executes an Effect with access to the runtime's context.

**Signatures:**
```typescript
// Direct effect
runtime.atom<A, E>(
  effect: Effect.Effect<A, E, Scope.Scope | R>,
  options?: { readonly initialValue?: A }
): Atom<Result.Result<A, E | ER>>

// Function form with atom access
runtime.atom<A, E>(
  create: (get: Context) => Effect.Effect<A, E, Scope.Scope | R>,
  options?: { readonly initialValue?: A }
): Atom<Result.Result<A, E | ER>>
```

**Examples:**

```typescript
// Direct effect - access service from runtime context
const countAtom = counterRuntime.atom(
  Effect.flatMap(Counter, (counter) => counter.get)
)

// Function form - access other atoms via get()
const doubleCountAtom = counterRuntime.atom((get) =>
  Effect.gen(function*() {
    const counter = yield* Counter
    const current = yield* counter.get
    // Can also read other atoms
    const otherValue = yield* get.result(someOtherAtom)
    return current * 2
  })
)

// With initial value for optimistic loading
const usersAtom = apiRuntime.atom(
  Effect.flatMap(UserService, (svc) => svc.listUsers()),
  { initialValue: [] }  // Show empty array while loading
)
```

**Behavior:**
- Returns `Result.Result<A, E>` (Initial, Waiting, Success, or Failure)
- Automatically manages Effect execution and cleanup
- Supports `initialValue` for optimistic loading
- Can access other atoms via `get()` in function form

### 10.3 runtime.fn() - Writable Function Atoms (Mutations)

Creates writable atoms that execute an Effect when set with a value (argument).

**Signatures:**
```typescript
// Curried form - explicit Arg type (recommended)
runtime.fn<Arg>(): {
  <E, A>(
    fn: (arg: Arg, get: FnContext) => Effect.Effect<A, E, Scope.Scope | R>,
    options?: {
      readonly initialValue?: A
      readonly reactivityKeys?: ReadonlyArray<unknown>
      readonly concurrent?: boolean
    }
  ): AtomResultFn<Arg, A, E | ER>
}

// Direct form - Arg inferred
runtime.fn<E, A, Arg>(
  fn: (arg: Arg, get: FnContext) => Effect.Effect<A, E, Scope.Scope | R>,
  options?: { ... }
): AtomResultFn<Arg, A, E | ER>
```

**Examples:**

```typescript
// Simple mutation with no argument
const incrementFn = counterRuntime.fn<void>()(
  (_arg) => Effect.flatMap(Counter, (c) => c.inc)
)

// Usage
registry.set(incrementFn, void 0)  // Trigger increment

// Mutation with typed argument
interface CreateUserInput {
  name: string
  email: string
}

const createUserFn = userRuntime.fn<CreateUserInput>()(
  (input, get) => Effect.flatMap(UserService, (svc) => svc.create(input))
)

// Usage
registry.set(createUserFn, { name: "John", email: "john@example.com" })

// With initial value
const counterFn = counterRuntime.fn<number>()(
  (n, _get) => Effect.succeed(n + 1),
  { initialValue: 0 }
)

// With concurrent execution (multiple calls run in parallel)
const uploadFn = apiRuntime.fn<File>()(
  (file, _get) => Effect.flatMap(UploadService, (svc) => svc.upload(file)),
  { concurrent: true }
)

// With reactivity keys (auto-refresh related queries)
const updateUserFn = userRuntime.fn<UpdateUserInput>()(
  (input, _get) => Effect.flatMap(UserService, (svc) => svc.update(input)),
  { reactivityKeys: ["users"] }
)
```

**Key features:**
- Returns `AtomResultFn<Arg, A, E>` (a Writable atom)
- Write context provides `FnContext` with atom access
- Supports `Reset` and `Interrupt` symbols for special operations
- `concurrent: true` allows multiple concurrent executions
- `reactivityKeys` automatically refreshes matching query atoms

### 10.4 Reset and Interrupt

Function atoms support special control symbols:

```typescript
const longRunningFn = apiRuntime.fn<void>()(
  () => Effect.sleep(Duration.seconds(30)).pipe(Effect.as("done"))
)

// Start the operation
registry.set(longRunningFn, void 0)

// Cancel/interrupt the ongoing execution
registry.set(longRunningFn, Atom.Interrupt)

// Reset to initial state (clears result)
registry.set(longRunningFn, Atom.Reset)
```

### 10.5 runtime.pull() - Streaming Data

For paginated or streamed data with backpressure control:

```typescript
import * as Stream from "effect/Stream"

const paginatedUsersAtom = apiRuntime.pull(
  Stream.paginateChunkEffect(1, (page) =>
    Effect.gen(function*() {
      const client = yield* UserService
      const users = yield* client.list({ page, limit: 20 })
      const nextPage = users.length === 20
        ? Option.some(page + 1)
        : Option.none()
      return [Chunk.fromIterable(users), nextPage]
    })
  ),
  { disableAccumulation: false }  // Accumulate pages
)

// Usage in component
const [result, pullMore] = useAtom(paginatedUsersAtom)

// result.value = { done: boolean, items: NonEmptyArray<User> }

// Pull next page
const handleLoadMore = () => pullMore(void 0)
```

### 10.6 RuntimeFactory

The `runtime.factory` provides utilities for creating and managing runtimes:

```typescript
interface RuntimeFactory {
  // Create new runtime from layer
  <R, E>(layer: Layer.Layer<R, E>): AtomRuntime<R, E>

  // Memoization map for layer building
  readonly memoMap: Layer.MemoMap

  // Add global layers (middleware, logging, etc.)
  readonly addGlobalLayer: <A, E>(layer: Layer.Layer<A, E>) => void

  // Wrap atom with reactivity keys
  readonly withReactivity: (
    keys: ReadonlyArray<unknown>
  ) => <A extends Atom<any>>(atom: A) => A
}

// Usage
const runtime = Atom.runtime(MyServiceLive)

// Add global middleware to all atoms created from this factory
runtime.factory.addGlobalLayer(LoggingLive)

// Manually add reactivity to an atom
const refreshableAtom = runtime.factory.withReactivity(["data"])(
  runtime.atom(fetchData)
)
```

### 10.7 Creating Custom API Clients with Runtime

The `AtomHttpApi.Tag` uses runtime internally. Here's how it works:

```typescript
import * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"

export class ApiClient extends AtomHttpApi.Tag<ApiClient>()(
  "ApiClient",
  {
    api: AppApi,                      // HttpApi definition
    httpClient: AuthenticatedClient,  // Layer providing HttpClient
    baseUrl: window.location.origin
  }
) {}

// What Tag provides internally:
// - ApiClient.layer: Layer that builds HttpApiClient
// - ApiClient.runtime: AtomRuntime for running effects
// - ApiClient.query(): Creates query atoms (uses runtime.atom internally)
// - ApiClient.mutation(): Creates mutation atoms (uses runtime.fn internally)
```

### 10.8 Composing Multiple Runtimes

```typescript
// Define multiple service runtimes
const userRuntime = Atom.runtime(UserServiceLive)
const productRuntime = Atom.runtime(ProductServiceLive)

// Option 1: Use independently
const usersAtom = userRuntime.atom(/* ... */)
const productsAtom = productRuntime.atom(/* ... */)

// Option 2: Compose layers into single runtime
const combinedRuntime = Atom.runtime(
  Layer.merge(UserServiceLive, ProductServiceLive)
)

const orderAtom = combinedRuntime.atom((get) =>
  Effect.gen(function*() {
    const users = yield* UserService
    const products = yield* ProductService
    // Can access both services
    return yield* createOrder(users, products)
  })
)
```

### 10.9 FnContext vs Context

The `get` parameter in `runtime.fn()` is a `FnContext`, which extends `Context`:

```typescript
interface Context {
  // Read atom value (Result)
  <A>(atom: Atom<A>): A

  // Read as Effect (extracts from Result)
  result<A, E>(atom: Atom<Result.Result<A, E>>): Effect.Effect<A, E>

  // Create dependency on atom
  subscribe<A>(atom: Atom<A>): A
}

interface FnContext extends Context {
  // Write to an atom
  set<A>(atom: Writable<A>, value: A): void

  // Refresh an atom
  refresh<A>(atom: Atom<A>): void
}

// Example: mutation that reads and writes atoms
const transferFn = bankRuntime.fn<TransferInput>()(
  (input, get) => Effect.gen(function*() {
    const bank = yield* BankService

    // Read current balances
    const fromBalance = yield* get.result(balanceFamily(input.from))
    const toBalance = yield* get.result(balanceFamily(input.to))

    // Perform transfer
    yield* bank.transfer(input)

    // Refresh affected atoms
    get.refresh(balanceFamily(input.from))
    get.refresh(balanceFamily(input.to))
  })
)
```

### 10.10 Runtime Lifecycle

```
1. Runtime created: Atom.runtime(Layer)
   └── Layer NOT built yet (lazy)

2. First atom reads from runtime
   └── Layer builds, services initialize
   └── Effect executes with service context

3. Atom disposed (no subscribers, TTL expires)
   └── Effect scope closed, cleanup runs

4. Runtime disposed (no dependent atoms)
   └── Layer scope closed, all services cleanup
```

**Best practices:**
- Create runtimes at module level (not inside components)
- Use `timeToLive` to control atom lifecycle
- Compose related services into single runtime when they're used together
- Use separate runtimes for independent service domains

---

## 11. Summary

| Do | Don't |
|----|-------|
| Use `reactivityKeys` for auto-invalidation | Use `window.location.reload()` |
| Use `Atom.family()` for parameterized atoms | Use `refreshKey` state pattern |
| Let Result track loading/error states | Use manual `isSubmitting` state |
| Fire-and-forget mutations with reactivityKeys | Await every mutation unnecessarily |
| Handle all `Result` states in UI | Assume success without checking |
| Define atoms outside components | Create new atoms on every render |
| Use `mode: "promise"` only for sequential ops | Use await when reactivityKeys suffice |
| Use `timeToLive` for caching | Keep stale data indefinitely |
| Use `Atom.optimistic` for instant UI updates | Show loading for every mutation |
| Use `useAtomRefresh()` when reactivityKeys don't fit | Manually refresh after every mutation |
