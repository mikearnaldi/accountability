# Effect Testing

This document covers testing patterns using `@effect/vitest` and testcontainers.

> **See also**: [EFFECT_LAYERS.md](./EFFECT_LAYERS.md) for deep dive on layer memoization semantics.

## Testing with @effect/vitest

Import from `@effect/vitest` for Effect-aware testing:

```typescript
import { describe, expect, it, layer } from "@effect/vitest"
import { Effect, TestClock, Fiber, Duration } from "effect"
```

## Test Variants

| Method | TestServices | Scope | Use Case |
|--------|--------------|-------|----------|
| `it.effect` | TestClock | No | Most tests - deterministic time |
| `it.live` | Real clock | No | Tests needing real time/IO |
| `it.scoped` | TestClock | Yes | Tests with resources (acquireRelease) |
| `it.scopedLive` | Real clock | Yes | Real time + resources |

### it.effect - Use for Most Tests (with TestClock)

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

### it.live - Use When You Need Real Time/External IO

```typescript
it.live("calls external API", () =>
  Effect.gen(function* () {
    // This actually waits 100ms
    yield* Effect.sleep(Duration.millis(100))
    // Real HTTP calls, file system, etc.
  })
)
```

### TestClock Patterns

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

## Sharing Layers Between Tests

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

## Property-Based Testing with @effect/vitest

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

## Testing Database-Dependent Code with Testcontainers

Use `@testcontainers/postgresql` to run integration tests against a real PostgreSQL database. Wrap the container in an Effect layer for proper lifecycle management.

### Container Layer Setup

```typescript
// test/utils.ts - Container layer setup
import { PgClient } from "@effect/sql-pg"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Data, Effect, Layer, Redacted } from "effect"

// Error type for container failures
export class ContainerError extends Data.TaggedError("ContainerError")<{
  cause: unknown
}> {}

// Container as Effect.Service with scoped lifecycle
export class PgContainer extends Effect.Service<PgContainer>()("test/PgContainer", {
  scoped: Effect.acquireRelease(
    Effect.tryPromise({
      try: () => new PostgreSqlContainer("postgres:alpine").start(),
      catch: (cause) => new ContainerError({ cause })
    }),
    (container) => Effect.promise(() => container.stop())
  )
}) {
  // Layer that provides PgClient from the container
  static ClientLive = Layer.unwrapEffect(
    Effect.gen(function*() {
      const container = yield* PgContainer
      return PgClient.layer({
        url: Redacted.make(container.getConnectionUri())
      })
    })
  ).pipe(Layer.provide(this.Default))
}
```

### Using the Container in Tests

```typescript
// test/Repository.test.ts - Using the container in tests
import { it, expect } from "@effect/vitest"
import { PgClient } from "@effect/sql-pg"
import { Effect } from "effect"
import { PgContainer } from "./utils.ts"

// Use it.layer with 30s timeout (container startup is slow)
it.layer(PgContainer.ClientLive, { timeout: "30 seconds" })("AccountRepository", (it) => {
  it.effect("creates and retrieves account", () =>
    Effect.gen(function*() {
      const sql = yield* PgClient.PgClient

      // Create table
      yield* sql`CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL)`

      // Insert
      yield* sql`INSERT INTO accounts (id, name) VALUES ('acc_1', 'Cash')`

      // Query
      const rows = yield* sql`SELECT * FROM accounts WHERE id = 'acc_1'`
      expect(rows[0].name).toBe("Cash")
    })
  )

  it.effect("handles transactions", () =>
    Effect.gen(function*() {
      const sql = yield* PgClient.PgClient

      // Transaction that rolls back on error
      const result = yield* sql.withTransaction(
        Effect.gen(function*() {
          yield* sql`INSERT INTO accounts (id, name) VALUES ('acc_2', 'Bank')`
          return yield* sql`SELECT * FROM accounts WHERE id = 'acc_2'`
        })
      )
      expect(result).toHaveLength(1)
    })
  )
})
```

### Key Points (Per-Block Containers)

- Container starts once per `it.layer` block, shared across all tests in that block
- Container stops automatically when tests complete (acquireRelease cleanup)
- Use `{ timeout: "30 seconds" }` because container startup takes time
- Each test gets the same database - use transactions or cleanup between tests
- `Layer.unwrapEffect` defers layer creation until container is running

## Shared Database Container (Global Setup)

**Problem**: Using `PgContainer.ClientLive` directly in tests creates a new container for each `it.layer()` block. This is slow and wasteful when tests could share a single container.

**Solution**: Use vitest's `globalSetup` to start ONE container before all tests and share it.

### Step 1: Create Global Setup File

```typescript
// vitest.global-setup.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql"

let container: StartedPostgreSqlContainer

export async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  console.log("Starting shared PostgreSQL container...")

  container = await new PostgreSqlContainer("postgres:alpine").start()

  // Make connection URL available to tests via inject()
  provide("dbUrl", container.getConnectionUri())

  console.log(`PostgreSQL ready at ${container.getConnectionUri()}`)
}

export async function teardown() {
  console.log("Stopping shared PostgreSQL container...")
  await container?.stop()
}
```

### Step 2: Update Vitest Config

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
    hookTimeout: 120000,
    // ... rest of config
  }
})
```

### Step 3: Update Test Utils to Use Injected URL

```typescript
// packages/persistence/test/Utils.ts
import { PgClient } from "@effect/sql-pg"
import { Layer, Redacted } from "effect"
import { inject } from "vitest"

/**
 * PgClient layer that uses the shared container from globalSetup.
 *
 * The container URL is injected via vitest's inject() mechanism,
 * which reads from the globalSetup's provide() calls.
 */
export const SharedPgClientLive = Layer.effect(
  PgClient.PgClient,
  Effect.gen(function*() {
    const url = inject("dbUrl") as string
    return yield* PgClient.make({ url: Redacted.make(url) })
  })
)
```

### Step 4: Update Tests to Use Shared Layer

```typescript
// Before (per-block container - SLOW)
const TestLayer = RepositoriesLayer.pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(PgContainer.ClientLive)  // Creates new container!
)

// After (shared container - FAST)
const TestLayer = RepositoriesLayer.pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(SharedPgClientLive)  // Uses global container
)
```

### Key Benefits

- **Single container** for entire test suite (not per `it.layer` block)
- **Faster tests** - container starts once before any test, stops after all tests
- **Same isolation** - each test group still gets its own layer instances
- **Migrations run per-block** - schema is set up fresh for each `it.layer` block

## Layer.fresh: When NOT to Use

**Common Misconception**: Using `Layer.fresh` in factory functions "to prevent memoization".

```typescript
// WRONG: Layer.fresh is unnecessary here!
const createTestLayer = (options: Config) => {
  return Layer.fresh(  // <- REMOVE THIS
    ComposedLayer.pipe(...)
  )
}
```

**Why it's wrong**: Factory functions already return NEW layer objects on each call. Memoization is identity-based (object reference). Different calls to `createTestLayer()` return different objects, so no memoization occurs between them anyway.

**When Layer.fresh IS needed**: Only when the **same layer reference** appears twice in a single composition and you want separate instances:

```typescript
// CORRECT use of Layer.fresh
const sharedLayer = makeLayer()
const needsBothInstances = Layer.merge(
  sharedLayer,                  // First instance
  Layer.fresh(sharedLayer)      // Force second instance
)
```

See [EFFECT_LAYERS.md](./EFFECT_LAYERS.md) for complete details.

## Migration Instructions: Shared Container Setup

To switch from per-block containers to a shared container:

1. **Create `vitest.global-setup.ts`** at project root (see template above)
2. **Update `vitest.config.ts`** to add `globalSetup: ["./vitest.global-setup.ts"]`
3. **Create `SharedPgClientLive`** layer in test utils that uses `inject("dbUrl")`
4. **Update all test layers** to use `SharedPgClientLive` instead of `PgContainer.ClientLive`
5. **Remove `Layer.fresh`** from `createTestLayer()` functions - it's unnecessary
6. **Keep `MigrationLayer`** in test layer compositions - migrations will run once per `it.layer` block (idempotent)

### Before and After

```typescript
// BEFORE: packages/persistence/test/AuthService.test.ts
const RepositoriesLayer = Layer.mergeAll(
  UserRepositoryLive,
  IdentityRepositoryLive,
  SessionRepositoryLive
).pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(PgContainer.ClientLive)  // <- New container per block!
)

const createTestLayer = (options = {}) => {
  // ...
  return Layer.fresh(AuthServiceLive.pipe(...))  // <- Unnecessary!
}

// AFTER
const RepositoriesLayer = Layer.mergeAll(
  UserRepositoryLive,
  IdentityRepositoryLive,
  SessionRepositoryLive
).pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(SharedPgClientLive)  // <- Uses global container
)

const createTestLayer = (options = {}) => {
  // ...
  return AuthServiceLive.pipe(...)  // <- No Layer.fresh needed!
}
```
