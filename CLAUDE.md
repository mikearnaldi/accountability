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

### Branded Types for IDs

Use `Schema.brand` to create type-safe IDs. Reference: `repos/effect/packages/cluster/src/EntityId.ts`

```typescript
import * as Schema from "effect/Schema"

// Define the branded type
export const AccountId = Schema.NonEmptyTrimmedString.pipe(
  Schema.brand("AccountId")
)

// Export the type
export type AccountId = typeof AccountId.Type

// Constructor for internal use (bypasses validation)
export const make = (id: string): AccountId => id as AccountId
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

Use `Schema.Class` for domain entities. Reference: `repos/effect/packages/cluster/src/EntityAddress.ts`

```typescript
import * as Schema from "effect/Schema"
import * as Equal from "effect/Equal"
import * as Hash from "effect/Hash"

export class Account extends Schema.Class<Account>("Account")({
  id: AccountId,
  code: Schema.NonEmptyTrimmedString,
  name: Schema.NonEmptyTrimmedString,
  type: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),
  normalBalance: Schema.Literal("Debit", "Credit"),
  isActive: Schema.Boolean
}) {
  // Optional: Implement Equal for value comparison
  [Equal.symbol](that: Account): boolean {
    return this.id === that.id
  }

  // Optional: Implement Hash for use in HashSet/HashMap
  [Hash.symbol]() {
    return Hash.cached(this, Hash.string(this.id))
  }
}

// Type guard is automatically derived
export const isAccount = Schema.is(Account)

// Constructor that bypasses validation (for internal use)
export const make = (options: typeof Account.Encoded): Account =>
  new Account(options, { disableValidation: true })
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

// Live implementation
export const AccountServiceLive = Layer.succeed(
  AccountService,
  AccountService.of({
    findById: (id) => Effect.gen(function* () {
      // implementation
    }),
    findAll: () => Effect.gen(function* () {
      // implementation
    }),
    create: (account) => Effect.gen(function* () {
      // implementation
    })
  })
)
```

---

## Guidelines for Implementation

1. **Always search the reference repos** for patterns before implementing
2. **Follow Effect conventions** from `repos/effect/packages/effect/src/`
3. **Use Schema.TaggedError** for all domain errors - type guards via `Schema.is()`
4. **Use Schema.Class** for domain entities - optionally add Equal and Hash
5. **Use branded types** for IDs (AccountId, CompanyId, etc.)
6. **Use BigDecimal** for all monetary calculations
7. **Derive type guards** using `Schema.is(MySchema)` - never write manual type guards
8. **Write tests** alongside implementation using `repos/effect/packages/vitest/`
9. **Follow TanStack patterns** for API routes and server functions

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
