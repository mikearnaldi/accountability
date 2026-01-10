# Accountability - Claude Code Guide

This document provides guidance for Claude Code when working on the Accountability project. It maps out the codebase structure and reference repositories for pattern discovery.

## Project Overview

Accountability is a multi-company, multi-currency accounting application using:
- **Effect** - Functional TypeScript library for type-safe, composable business logic
- **TanStack Start** - Full-stack React framework with server functions
- **Effect Atom** - State management for Effect

## Key Files

| File | Purpose |
|------|---------|
| `SPECIFICATIONS.md` | Detailed domain specifications (entities, services, reports) |
| `prd.json` | User stories with status tracking |
| `ralph.sh` | Autonomous agent loop orchestrator |
| `RALPH_PROMPT.md` | Agent prompt template |
| `progress.txt` | Progress log for Ralph iterations |

## Project Structure

```
accountability/
├── packages/
│   ├── core/           # Core accounting logic (100% tested, no deps)
│   ├── persistence/    # Database layer (Drizzle + PostgreSQL)
│   ├── api/            # TanStack Start server functions
│   └── web/            # React UI
└── repos/              # Reference repositories (git subtrees)
    ├── effect/         # Effect-TS source
    ├── tanstack-router/# TanStack Router/Start source
    └── effect-atom/    # Effect Atom source
```

---

## Reference Repositories

### Effect (`repos/effect/`)

The core Effect library for functional TypeScript.

#### Core Package (`repos/effect/packages/effect/src/`)

Essential modules for this project:

| Module | Path | Use For |
|--------|------|---------|
| **Effect** | `Effect.ts` | Core effect type, operations |
| **Schema** | `Schema.ts` | Validation, encoding/decoding |
| **Context** | `Context.ts` | Dependency injection |
| **Layer** | `Layer.ts` | Service composition |
| **Data** | `Data.ts` | Value objects, tagged unions |
| **Brand** | `Brand.ts` | Branded types (AccountId, etc.) |
| **Either** | `Either.ts` | Error handling |
| **Option** | `Option.ts` | Optional values |
| **Match** | `Match.ts` | Pattern matching |
| **BigDecimal** | `BigDecimal.ts` | Monetary calculations |
| **DateTime** | `DateTime.ts` | Date/time handling |
| **Duration** | `Duration.ts` | Time durations |
| **Struct** | `Struct.ts` | Object operations |
| **Record** | `Record.ts` | Record utilities |
| **Array** | `Array.ts` | Array utilities |
| **Stream** | `Stream.ts` | Streaming data |
| **Ref** | `Ref.ts` | Mutable references |
| **Queue** | `Queue.ts` | Async queues |
| **Config** | `Config.ts` | Configuration |
| **Fiber** | `Fiber.ts` | Concurrent execution |

**Search patterns in Effect:**
```bash
# Find service definitions
grep -r "Context.Tag" repos/effect/packages/effect/src/

# Find schema examples
grep -r "Schema.Struct" repos/effect/packages/effect/src/

# Find branded type examples
grep -r "Brand.nominal" repos/effect/packages/effect/src/

# Find Layer patterns
grep -r "Layer.succeed" repos/effect/packages/effect/src/
```

#### SQL Packages (`repos/effect/packages/sql*/`)

Database integration for Effect:

| Package | Path | Description |
|---------|------|-------------|
| **sql** | `repos/effect/packages/sql/` | Core SQL abstractions |
| **sql-pg** | `repos/effect/packages/sql-pg/` | PostgreSQL client |
| **sql-drizzle** | `repos/effect/packages/sql-drizzle/` | Drizzle ORM integration |

**Search patterns for SQL:**
```bash
# Find repository patterns
grep -r "SqlClient" repos/effect/packages/sql/src/

# Find transaction patterns
grep -r "Effect.acquireRelease" repos/effect/packages/sql*/src/

# Find query patterns
grep -rn "sql\`" repos/effect/packages/sql*/src/
```

#### Platform Packages (`repos/effect/packages/platform*/`)

Runtime platform abstractions:

| Package | Path | Description |
|---------|------|-------------|
| **platform** | `repos/effect/packages/platform/` | Core platform abstractions |
| **platform-node** | `repos/effect/packages/platform-node/` | Node.js runtime |
| **platform-browser** | `repos/effect/packages/platform-browser/` | Browser runtime |

**Key modules:**
- `HttpClient.ts` - HTTP client
- `HttpServer.ts` - HTTP server
- `FileSystem.ts` - File operations
- `Terminal.ts` - CLI utilities

#### Other Effect Packages

| Package | Path | Description |
|---------|------|-------------|
| **vitest** | `repos/effect/packages/vitest/` | Testing utilities |
| **cli** | `repos/effect/packages/cli/` | CLI framework |
| **rpc** | `repos/effect/packages/rpc/` | RPC framework |
| **cluster** | `repos/effect/packages/cluster/` | Distributed systems |
| **workflow** | `repos/effect/packages/workflow/` | Workflow engine |
| **experimental** | `repos/effect/packages/experimental/` | Experimental features |

---

### TanStack Router/Start (`repos/tanstack-router/`)

Full-stack React framework.

#### Key Packages

| Package | Path | Description |
|---------|------|-------------|
| **react-start** | `repos/tanstack-router/packages/react-start/` | Main Start framework |
| **react-router** | `repos/tanstack-router/packages/react-router/` | Router for React |
| **router-core** | `repos/tanstack-router/packages/router-core/` | Core router logic |
| **start-server-core** | `repos/tanstack-router/packages/start-server-core/` | Server-side core |
| **start-client-core** | `repos/tanstack-router/packages/start-client-core/` | Client-side core |

#### Server Functions (`repos/tanstack-router/packages/react-start/src/`)

| File | Purpose |
|------|---------|
| `server.tsx` | Server-side rendering |
| `client.tsx` | Client hydration |
| `useServerFn.ts` | Server function hook |
| `server-rpc.ts` | Server RPC handling |
| `client-rpc.ts` | Client RPC calls |

**Search patterns for TanStack:**
```bash
# Find server function patterns
grep -r "createServerFn" repos/tanstack-router/packages/react-start/

# Find route definitions
grep -r "createRoute" repos/tanstack-router/packages/react-router/src/

# Find loader patterns
grep -r "loader:" repos/tanstack-router/packages/*/src/

# Find middleware patterns
grep -r "middleware" repos/tanstack-router/packages/start-server-core/src/
```

#### Examples (`repos/tanstack-router/examples/`)

Real-world usage examples:

```bash
# List available examples
ls repos/tanstack-router/examples/

# Find Start examples
ls repos/tanstack-router/examples/ | grep start
```

---

### Effect Atom (`repos/effect-atom/`)

State management for Effect.

#### Packages

| Package | Path | Description |
|---------|------|-------------|
| **atom** | `repos/effect-atom/packages/atom/` | Core atom primitives |
| **atom-react** | `repos/effect-atom/packages/atom-react/` | React bindings |
| **atom-vue** | `repos/effect-atom/packages/atom-vue/` | Vue bindings |
| **atom-livestore** | `repos/effect-atom/packages/atom-livestore/` | LiveStore integration |

**Search patterns:**
```bash
# Find atom creation patterns
grep -r "Atom.make" repos/effect-atom/packages/atom/src/

# Find React hook patterns
grep -r "useAtom" repos/effect-atom/packages/atom-react/src/
```

---

## Common Search Patterns

### Finding Effect Patterns

```bash
# Schema definitions
grep -rn "Schema\." repos/effect/packages/effect/src/Schema.ts | head -50

# Service pattern (Context.Tag + Layer)
grep -rn "extends Context.Tag" repos/effect/packages/*/src/

# Error handling (tagged errors)
grep -rn "TaggedError" repos/effect/packages/effect/src/

# Branded types
grep -rn "Brand\." repos/effect/packages/effect/src/Brand.ts

# Effect.gen pattern
grep -rn "Effect.gen" repos/effect/packages/*/src/ | head -20

# BigDecimal operations (for monetary amounts)
grep -rn "BigDecimal\." repos/effect/packages/effect/src/BigDecimal.ts
```

### Finding Tests

```bash
# Effect tests
ls repos/effect/packages/effect/test/

# Find specific test patterns
grep -rn "it\(" repos/effect/packages/effect/test/ | head -20

# Find vitest patterns
grep -rn "describe\(" repos/effect/packages/vitest/test/
```

### Finding Type Definitions

```bash
# Find interface definitions
grep -rn "^export interface" repos/effect/packages/effect/src/

# Find type aliases
grep -rn "^export type" repos/effect/packages/effect/src/ | head -30
```

---

## Accounting Domain Patterns

When implementing the accounting core, reference these patterns:

### Value Objects (use Schema + Brand)

```bash
# Find branded type examples
grep -rn "Schema.String.pipe" repos/effect/packages/effect/src/
grep -rn "Brand.nominal" repos/effect/packages/effect/src/
```

### Entities (use Schema.Class or Schema.Struct)

```bash
# Find class-based schema examples
grep -rn "Schema.Class" repos/effect/packages/effect/src/

# Find struct examples
grep -rn "Schema.Struct({" repos/effect/packages/*/src/
```

### Services (use Context.Tag + Layer)

```bash
# Find service definitions
grep -rn "Context.Tag" repos/effect/packages/effect/src/Context.ts
grep -rn "Layer.effect" repos/effect/packages/effect/src/Layer.ts
```

### Repository Pattern

```bash
# Find SQL repository patterns
grep -rn "SqlClient" repos/effect/packages/sql/src/
grep -rn "Statement" repos/effect/packages/sql/src/
```

### Monetary Calculations

```bash
# BigDecimal for precise decimal arithmetic
grep -rn "BigDecimal" repos/effect/packages/effect/src/BigDecimal.ts
```

---

## Quick Reference Commands

```bash
# Check PRD status
./scripts/prd-status.sh

# Run CI checks
./scripts/ci-check.sh

# Update story status
./scripts/prd-update.sh <story-id> <status>

# Start Ralph loop
./ralph.sh [max_iterations]

# Search Effect source
grep -rn "<pattern>" repos/effect/packages/effect/src/

# Search TanStack source
grep -rn "<pattern>" repos/tanstack-router/packages/react-start/src/

# Search Effect-Atom source
grep -rn "<pattern>" repos/effect-atom/packages/atom/src/
```

---

## Package Versions

To check package versions in the reference repos:

```bash
# Effect version
jq '.version' repos/effect/packages/effect/package.json

# TanStack Start version
jq '.version' repos/tanstack-router/packages/react-start/package.json

# Effect Atom version
jq '.version' repos/effect-atom/packages/atom/package.json
```

---

## Effect Best Practices

### Module Structure - Flat Modules, No Barrel Files

**Avoid barrel files** (index.ts re-exports). Create flat, focused modules:

```
packages/core/src/
├── CurrencyCode.ts      # NOT domain/currency/CurrencyCode.ts + index.ts
├── AccountId.ts
├── Account.ts
├── AccountError.ts
├── AccountService.ts
└── Money.ts
```

**Each module should be self-contained:**

```typescript
// CurrencyCode.ts - everything related to CurrencyCode in one file
import * as Schema from "effect/Schema"

export class CurrencyCode extends Schema.Class<CurrencyCode>("CurrencyCode")({
  code: Schema.String.pipe(Schema.length(3)),
  name: Schema.String,
  symbol: Schema.String,
  decimalPlaces: Schema.Number
}) {}

export const isoCurrencies = {
  USD: CurrencyCode.make({ code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 }),
  EUR: CurrencyCode.make({ code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 }),
  // ...
}
```

### Prefer Schema.Class Over Schema.Struct

**Always prefer `Schema.Class`** - it gives you a proper class with constructor, type guard support, and Equal/Hash.

```typescript
// WRONG - Schema.Struct creates plain objects
export const Account = Schema.Struct({
  id: AccountId,
  name: Schema.String
})
type Account = typeof Account.Type  // just a plain object type

// CORRECT - Schema.Class creates a proper class
export class Account extends Schema.Class<Account>("Account")({
  id: AccountId,
  name: Schema.String
}) {
  // Can add methods
  get displayName() {
    return `${this.name} (${this.id})`
  }
}
```

### Branded Types for IDs

Use `Schema.brand` to create type-safe IDs:

```typescript
import * as Schema from "effect/Schema"

// Define the branded type
export const AccountId = Schema.NonEmptyTrimmedString.pipe(
  Schema.brand("AccountId")
)

// Export the type
export type AccountId = typeof AccountId.Type

// Use .make() to create instances (validates by default)
const id = AccountId.make("acc_123")

// Bypass validation for trusted input
const fromDb = AccountId.make(row.id, { disableValidation: true })
```

### Schema.TaggedError for Domain Errors

Use `Schema.TaggedError` for all domain errors. Schema automatically provides type guards via `Schema.is()`.

```typescript
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Cause from "effect/Cause"

// Simple error with fields
export class AccountNotFound extends Schema.TaggedError<AccountNotFound>()(
  "AccountNotFound",
  { accountId: AccountId }
) {
  // Optional: custom message getter
  get message(): string {
    return `Account not found: ${this.accountId}`
  }
}

// Error with cause (for wrapping other errors)
export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  { cause: Schema.Defect }
) {
  // Helper to wrap effects that may fail
  static refail<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> {
    return Effect.catchAllCause(effect, (cause) =>
      Effect.fail(new PersistenceError({ cause: Cause.squash(cause) }))
    )
  }
}

// Union type for all errors in module
export type AccountError = AccountNotFound | PersistenceError

// Type guards are automatically derived using Schema.is()
export const isAccountNotFound = Schema.is(AccountNotFound)
export const isPersistenceError = Schema.is(PersistenceError)

// Usage example
const checkError = (error: unknown) => {
  if (isAccountNotFound(error)) {
    console.log(`Account ${error.accountId} not found`)
  }
}
```

### Schema.Class for Domain Entities

Use `Schema.Class` for domain entities. Equal, Hash, and constructors are auto-provided.

```typescript
import * as Schema from "effect/Schema"

export class Account extends Schema.Class<Account>("Account")({
  id: AccountId,
  code: Schema.NonEmptyTrimmedString,
  name: Schema.NonEmptyTrimmedString,
  type: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),
  normalBalance: Schema.Literal("Debit", "Credit"),
  isActive: Schema.Boolean
}) {
  // Add custom methods as needed
  get isExpenseOrRevenue(): boolean {
    return this.type === "Expense" || this.type === "Revenue"
  }
}

// Type guard is automatically derived
export const isAccount = Schema.is(Account)
```

**Always use `.make()` - never `new`:**

```typescript
// CORRECT - use .make()
const account = Account.make({ id, code: "1000", name: "Cash", ... })

// WRONG - don't use new
const account = new Account({ id, code: "1000", name: "Cash", ... })

// Disable validation when you trust the input (e.g., from database)
const fromDb = Account.make(dbRow, { disableValidation: true })
```

**All schemas have `.make()` - not just classes:**

```typescript
// Branded types
export const AccountId = Schema.String.pipe(Schema.brand("AccountId"))
const id = AccountId.make("acc_123")  // Creates branded AccountId

// Structs (if you must use them)
export const Money = Schema.Struct({
  amount: Schema.BigDecimal,
  currency: CurrencyCode
})
const money = Money.make({ amount, currency })
```

**Don't create shortcut helpers for `.make()` - use it directly:**

```typescript
// WRONG - don't create shortcuts for constructors
const mkLd = (year: number, month: number, day: number) =>
  LocalDate.make({ year, month, day })
const mkTs = (epochMillis: number) =>
  Timestamp.make({ epochMillis })

// CORRECT - use .make() directly, it's already explicit
const date = LocalDate.make({ year: 2024, month: 1, day: 15 })
const timestamp = Timestamp.make({ epochMillis: Date.now() })

// OK - aliasing long import paths is fine
const bd = BigDecimal.unsafeFromString  // Just shortening import
```

**Constructor defaults:**

```typescript
export class JournalEntry extends Schema.Class<JournalEntry>("JournalEntry")({
  id: JournalEntryId,
  date: Schema.DateFromSelf,
  description: Schema.String,
  // Default value for constructor
  status: Schema.propertySignature(Schema.String).pipe(
    Schema.withConstructorDefault(() => "draft")
  )
}) {}

// status defaults to "draft"
const entry = JournalEntry.make({ id, date: new Date(), description: "..." })
```

### Value-Based Equality in Effect

Effect provides **value-based equality** through the `Equal` and `Hash` modules. This means two separate objects with the same field values are considered equal.

**Why this matters for domain entities:**

```typescript
// With JavaScript ===, two objects with same data are NOT equal
const acc1 = { id: "acc_123", name: "Cash" }
const acc2 = { id: "acc_123", name: "Cash" }
console.log(acc1 === acc2)  // false - different object references

// With Effect's Equal.equals, objects with same data ARE equal
import { Equal } from "effect"

class Account extends Schema.Class<Account>("Account")({
  id: AccountId,
  name: Schema.String
}) {}

const account1 = Account.make({ id, name: "Cash" })
const account2 = Account.make({ id, name: "Cash" })
console.log(Equal.equals(account1, account2))  // true - same values!
```

**How it works:**

1. **Schema.Class extends Data.Class** - which implements `Equal` and `Hash` traits
2. **Fields are compared recursively** using `Equal.equals()`, not `===`
3. **Nested Effect objects** (other Schema.Class instances, Options, etc.) are compared by value
4. **Hash is consistent** - equal objects produce the same hash code

**Automatic with Schema.Class - no manual implementation needed:**

```typescript
// WRONG - don't implement Equal/Hash manually
export class Account extends Schema.Class<Account>("Account")({
  id: AccountId,
  name: Schema.String
}) {
  // DON'T DO THIS - it's automatic
  [Equal.symbol](that: unknown) { ... }
  [Hash.symbol]() { ... }
}

// CORRECT - just define the class, Equal/Hash are automatic
export class Account extends Schema.Class<Account>("Account")({
  id: AccountId,
  name: Schema.String
}) {}
// Equal.equals() and Hash.hash() work automatically
```

**Using Equal.equals in practice:**

```typescript
import { Equal, Hash } from "effect"

// Compare any two values
if (Equal.equals(account1, account2)) {
  console.log("Same account data")
}

// Works in collections - HashMap, HashSet use Equal/Hash
import { HashMap, HashSet } from "effect"

const accounts = HashSet.make(account1, account2)
// If account1 and account2 have same values, set has size 1

const map = HashMap.make([account1, "value1"])
HashMap.get(map, account2)  // Returns "value1" because account2 equals account1
```

**Important:** Always use `Equal.equals()` to compare Effect objects, not `===`:

```typescript
// WRONG
if (account1 === account2) { ... }  // Only true for same reference

// CORRECT
if (Equal.equals(account1, account2)) { ... }  // True for same values
```

### Schema Struct for Simple Value Objects

For simpler value objects without methods, use `Schema.Struct`:

```typescript
import * as Schema from "effect/Schema"

export const Money = Schema.Struct({
  amount: Schema.BigDecimal,
  currency: CurrencyCode
}).annotations({ identifier: "Money" })

export type Money = typeof Money.Type
```

### Schema Decoding/Encoding - Use Effect Variants

**NEVER** use `decodeUnknownSync` or `encodeUnknownSync` - they throw exceptions.
Always use the Effect variants that return `Effect<A, ParseError>`:

```typescript
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"

// WRONG - throws exceptions
const account = Schema.decodeUnknownSync(Account)(data)  // DON'T DO THIS

// CORRECT - returns Effect
const accountEffect = Schema.decodeUnknown(Account)(data)  // Effect<Account, ParseError>

// Usage in Effect.gen
const program = Effect.gen(function* () {
  const account = yield* Schema.decodeUnknown(Account)(data)
  // account is now typed as Account
  return account
})

// For encoding
const encoded = yield* Schema.encode(Account)(account)  // Effect<AccountEncoded, ParseError>
```

### Using Effect.catchTag for Error Handling

```typescript
import { Effect, Match } from "effect"

const program = fetchAccount(accountId).pipe(
  Effect.catchTag("AccountNotFound", (error) =>
    Effect.succeed(createDefaultAccount())
  ),
  Effect.catchTag("PersistenceError", (error) =>
    Effect.logError(`Database error: ${error.cause}`)
  )
)

// Or use Match for exhaustive handling
const handleError = Match.type<AccountError>().pipe(
  Match.tag("AccountNotFound", (err) => `Account ${err.accountId} not found`),
  Match.tag("PersistenceError", (err) => `Database error occurred`),
  Match.exhaustive
)
```

### Service Pattern (Context.Tag + Layer)

```typescript
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Effect from "effect/Effect"

// Service interface
export interface AccountService {
  readonly findById: (id: AccountId) => Effect.Effect<Account, AccountNotFound>
  readonly findAll: () => Effect.Effect<ReadonlyArray<Account>>
  readonly create: (account: Account) => Effect.Effect<Account, PersistenceError>
}

// Service tag
export class AccountService extends Context.Tag("AccountService")<
  AccountService,
  AccountService
>() {}
```

### Creating Layers - Use Layer.effect or Layer.scoped

**Avoid** `Layer.succeed` and `Tag.of` - they're rarely needed.

**Layer.effect** - When the service creation is effectful but doesn't need cleanup:

```typescript
// make function returns Effect<AccountService, Error, Dependencies>
const make = Effect.gen(function* () {
  const config = yield* Config
  const sql = yield* SqlClient.SqlClient

  return {
    findById: (id) => Effect.gen(function* () {
      const rows = yield* sql`SELECT * FROM accounts WHERE id = ${id}`
      // ...
    }),
    findAll: () => Effect.gen(function* () {
      // ...
    }),
    create: (account) => Effect.gen(function* () {
      // ...
    })
  }
})

// Layer using Layer.effect
export const AccountServiceLive: Layer.Layer<
  AccountService,
  ConfigError,
  Config | SqlClient.SqlClient
> = Layer.effect(AccountService, make)
```

**Layer.scoped** - When the service needs resource cleanup (subscriptions, background fibers, etc.):

```typescript
// Example: Service with a PubSub for change notifications
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create a PubSub that will be cleaned up when layer is released
  const changes = yield* PubSub.unbounded<AccountChange>()

  // Start a background fiber that will be interrupted on cleanup
  yield* Effect.forkScoped(
    sql`LISTEN account_changes`.pipe(
      Stream.runForEach((change) => PubSub.publish(changes, change))
    )
  )

  return {
    findById: (id) => Effect.gen(function* () {
      // sql client handles connection pooling internally
      const rows = yield* sql`SELECT * FROM accounts WHERE id = ${id}`
      // ...
    }),
    subscribe: PubSub.subscribe(changes)
  }
})

// Layer using Layer.scoped - cleans up PubSub and background fiber
export const AccountServiceLive: Layer.Layer<
  AccountService,
  SqlError,
  SqlClient.SqlClient
> = Layer.scoped(AccountService, make)
```

**Composing layers:**

```typescript
// Provide dependencies to a layer
export const AccountServiceWithDeps = AccountServiceLive.pipe(
  Layer.provide(SqlClientLive),
  Layer.provide(ConfigLive)
)

// Or use Layer.provideMerge to keep dependencies in context
export const FullLayer = Layer.provideMerge(
  AccountServiceLive,
  SqlClientLive
)
```

---

### Testing with @effect/vitest

Import from `@effect/vitest` for Effect-aware testing:

```typescript
import { describe, expect, it, layer } from "@effect/vitest"
import { Effect, TestClock, Fiber, Duration } from "effect"
```

**Test variants:**

| Method | TestServices | Scope | Use Case |
|--------|--------------|-------|----------|
| `it.effect` | ✅ TestClock | ❌ | Most tests - deterministic time |
| `it.live` | ❌ Real clock | ❌ | Tests needing real time/IO |
| `it.scoped` | ✅ TestClock | ✅ | Tests with resources (acquireRelease) |
| `it.scopedLive` | ❌ Real clock | ✅ | Real time + resources |

**it.effect - Use for most tests (with TestClock):**

```typescript
it.effect("processes after delay", () =>
  Effect.gen(function* () {
    // Fork the effect that uses time
    const fiber = yield* Effect.fork(
      Effect.sleep(Duration.minutes(5)).pipe(
        Effect.map(() => "done")
      )
    )

    // Advance the TestClock - no real waiting!
    yield* TestClock.adjust(Duration.minutes(5))

    // Now the fiber completes instantly
    const result = yield* Fiber.join(fiber)
    expect(result).toBe("done")
  })
)
```

**it.live - Use when you need real time/external IO:**

```typescript
it.live("calls external API", () =>
  Effect.gen(function* () {
    // This actually waits 100ms
    yield* Effect.sleep(Duration.millis(100))
    // Real HTTP calls, file system, etc.
  })
)
```

**TestClock patterns:**

```typescript
// Always fork effects that sleep, then adjust clock
it.effect("timeout test", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(
      Effect.sleep(Duration.seconds(30)).pipe(
        Effect.timeout(Duration.seconds(10))
      )
    )
    // Advance past timeout
    yield* TestClock.adjust(Duration.seconds(10))
    const result = yield* Fiber.join(fiber)
    expect(result._tag).toBe("None")  // Timed out
  })
)
```

**Sharing layers between tests:**

```typescript
import { layer } from "@effect/vitest"

layer(AccountServiceLive)("AccountService", (it) => {
  it.effect("finds account by id", () =>
    Effect.gen(function* () {
      const service = yield* AccountService
      const account = yield* service.findById(testAccountId)
      expect(account.name).toBe("Test")
    })
  )

  // Nested layers
  it.layer(AuditServiceLive)("with audit", (it) => {
    it.effect("logs actions", () =>
      Effect.gen(function* () {
        const accounts = yield* AccountService
        const audit = yield* AuditService
        // Both services available
      })
    )
  })
})

// Use real clock even with layer
layer(MyService.Live, { excludeTestServices: true })("live tests", (it) => {
  it.effect("uses real time", () =>
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(10))  // Actually waits
    })
  )
})
```

**Property-based testing with @effect/vitest:**

FastCheck is re-exported from `effect/FastCheck`. The `Arbitrary` module provides `Arbitrary.make()` to create arbitraries from Schema. @effect/vitest provides `it.prop` and `it.effect.prop` for property testing.

```typescript
import { it } from "@effect/vitest"
import { Effect, FastCheck, Schema, Arbitrary } from "effect"

// Synchronous property test - array syntax
it.prop("symmetry", [Schema.Number, FastCheck.integer()], ([a, b]) =>
  a + b === b + a
)

// Synchronous property test - object syntax
it.prop("symmetry with object", { a: Schema.Number, b: FastCheck.integer() }, ({ a, b }) =>
  a + b === b + a
)

// Effectful property test
it.effect.prop("symmetry in effect", [Schema.Number, FastCheck.integer()], ([a, b]) =>
  Effect.gen(function* () {
    yield* Effect.void
    return a + b === b + a
  })
)

// Scoped property test
it.scoped.prop("substring detection", { a: Schema.String, b: Schema.String }, ({ a, b }) =>
  Effect.gen(function* () {
    yield* Effect.scope
    return (a + b).includes(b)
  })
)

// With custom fastCheck options
it.effect.prop(
  "with options",
  [Schema.Number],
  ([n]) => Effect.succeed(n === n),
  { fastCheck: { numRuns: 200 } }
)

// Create arbitrary from Schema manually
const accountArb = Arbitrary.make(Account)
it.prop("account test", [accountArb], ([account]) =>
  account.name.length > 0
)
```

---

## Guidelines for Implementation

1. **Flat modules, no barrel files** - `CurrencyCode.ts` not `domain/currency/index.ts`
2. **Prefer Schema.Class over Schema.Struct** - classes give you constructor, Equal, Hash
3. **Use Schema's `.make()` constructor** - all schemas have it, never use `new` or create custom constructors
4. **Use Schema.TaggedError** for all domain errors - type guards via `Schema.is()`
5. **Use branded types** for IDs (AccountId, CompanyId, etc.)
6. **Use BigDecimal** for all monetary calculations
7. **Derive type guards** using `Schema.is(MySchema)` - never write manual type guards
8. **NEVER use Sync variants** - use `Schema.decodeUnknown` not `decodeUnknownSync` (throws)
9. **Use Layer.effect or Layer.scoped** - avoid Layer.succeed and Tag.of
10. **Write tests** alongside implementation using `@effect/vitest`
11. **Follow TanStack patterns** for API routes and server functions

---

## Notes for Ralph Agent

When working on stories:

1. **Read SPECIFICATIONS.md** for domain requirements
2. **Search repos/** for implementation patterns
3. **Follow the technology stack** defined in this file
4. **Use Schema.TaggedError** for errors - see Best Practices section above
5. **Use Schema.Class** for entities - see Best Practices section above
6. **Signal STORY_COMPLETE** when done (don't commit, script handles it)
7. **Run tests** before signaling completion: `pnpm test && pnpm typecheck`
