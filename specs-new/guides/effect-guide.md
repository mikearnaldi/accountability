# Effect Guide

This is the consolidated guide for using Effect in the Accountability project. It covers coding patterns, error handling, Schema, Layers, SQL, and testing.

---

## Table of Contents

1. [Critical Rules](#critical-rules)
2. [Schema Patterns](#schema-patterns)
3. [Error Handling](#error-handling)
4. [Service Pattern (Context.Tag + Layer)](#service-pattern-contexttag--layer)
5. [Layer Memoization & Composition](#layer-memoization--composition)
6. [SQL Patterns (@effect/sql)](#sql-patterns-effectsql)
7. [Testing Patterns (@effect/vitest)](#testing-patterns-effectvitest)

---

## Critical Rules

### 1. NEVER Use `any` or Type Casts (`x as Y`)

```typescript
// WRONG - never use any
const result: any = someValue
const data = value as any
function process(input: any): any { ... }

// WRONG - never use type casts
const account = data as Account
const id = value as AccountId

// CORRECT - use proper types, generics, or unknown
const result: SomeType = someValue
function process<T>(input: T): Result<T> { ... }

// CORRECT - use Schema.make() for branded types
const id = AccountId.make(rawId)

// CORRECT - use Schema.decodeUnknown for parsing
const account = yield* Schema.decodeUnknown(Account)(data)
```

**AVOID `eslint-disable-next-line @typescript-eslint/consistent-type-assertions`** - Using this disable comment should be an absolute last resort. Before adding it, exhaust ALL alternatives:

1. Use `Schema.make()` for branded types
2. Use `Schema.decodeUnknown()` for parsing unknown data
3. Use `Option.some<T>()` / `Option.none<T>()` for explicit Option types
4. Use `identity<T>()` from `effect/Function` for compile-time type verification
5. Use proper generics and type parameters

#### Type-Safe Alternatives to Casting

```typescript
// When you need to specify the type for Option.some/none, use type parameters
const someValue = Option.some<Account>(account)  // Option<Account>
const noneValue = Option.none<Account>()         // Option<Account>

// Use Option.fromNullable for nullable values
const desc = Option.fromNullable(row.description)

// When you need to assert a value matches a type (without casting), use identity
import { identity } from "effect/Function"
const verified = identity<Account>(x)  // Compile error if x isn't Account
```

### 2. NEVER Use `catchAll` When Error Type Is `never`

```typescript
// If the effect never fails, error type is `never`
const infallibleEffect: Effect.Effect<Result, never> = Effect.succeed(value)

// WRONG - catchAll on never is useless and indicates misunderstanding
infallibleEffect.pipe(
  Effect.catchAll((e) => Effect.fail(new SomeError({ message: String(e) })))
)

// CORRECT - if error is never, just use the effect directly
infallibleEffect
```

### 3. NEVER Use Global `Error` in Effect Error Channel

```typescript
// WRONG - global Error breaks Effect's typed error handling
const bad: Effect.Effect<Result, Error> = Effect.fail(new Error("failed"))

// CORRECT - use Schema.TaggedError for all domain errors
export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  { message: Schema.String }
) {}

const good: Effect.Effect<Result, ValidationError> = Effect.fail(
  new ValidationError({ message: "failed" })
)
```

### 4. NEVER Use `{ disableValidation: true }` - It Is Banned

```typescript
// WRONG - disableValidation is banned by lint rule local/no-disable-validation
const account = Account.make(data, { disableValidation: true })  // LINT ERROR

// CORRECT - let Schema validate the data, always
const account = Account.make(data)
```

### 5. Don't Wrap Safe Operations in Effect Unnecessarily

```typescript
// WRONG - Effect.try is for operations that might throw
const mapped = Effect.try(() => array.map(fn))  // array.map doesn't throw

// CORRECT - for pure transformations, just use a normal function
const mapAccounts = (rows: Row[]): Account[] => rows.map(toAccount)

// CORRECT - use Effect.try ONLY for operations that might throw
const parsed = Effect.try(() => JSON.parse(jsonString))
```

### 6. NEVER Use `Effect.catchAllCause` to Wrap Errors

```typescript
// WRONG - catchAllCause catches BOTH errors AND defects (bugs)
const wrapSqlError = (operation: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> =>
    Effect.catchAllCause(effect, (cause) =>
      Effect.fail(new PersistenceError({ operation, cause: Cause.squash(cause) }))
    )

// CORRECT - use mapError to transform only expected errors
const wrapSqlError = (operation: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> =>
    Effect.mapError(effect, (error) =>
      new PersistenceError({ operation, cause: error })
    )
```

**Why this matters:**
- **Errors** are expected failures (user not found, validation failed) - they should be handled
- **Defects** are bugs (null pointer, division by zero) - they should crash and be fixed
- `catchAllCause` catches both, hiding bugs that should be fixed

### 7. NEVER Silently Swallow Errors

**Principle: If something can fail, the failure MUST be visible in the Effect's error channel `E`.**

```typescript
// WRONG - silently swallowing errors hides bugs
yield* auditLogService.log(entry).pipe(
  Effect.catchTag("AuditLogError", () => Effect.void)  // LINT ERROR
)

// WRONG - Effect.ignore silently discards errors
yield* someEffect.pipe(Effect.ignore)  // LINT ERROR

// CORRECT - let error propagate (caller decides how to handle)
yield* auditLogService.log(entry)

// CORRECT - transform error to different type (still visible in types)
yield* auditLogService.log(entry).pipe(
  Effect.mapError((e) => new MyError({ cause: e }))
)

// CORRECT - provide fallback value (for queries, not side effects)
const result = yield* findAccount(id).pipe(
  Effect.catchTag("NotFoundError", () => Effect.succeed(null))
)
```

**Lint rules that enforce this:**
- `local/no-silent-error-swallow` - Bans `() => Effect.void` in catch handlers
- `local/no-effect-ignore` - Bans `Effect.ignore`
- `local/no-effect-catchallcause` - Bans `Effect.catchAllCause`

---

## Pipe Composition

When composing many operations, chain `.pipe()` calls for readability:

```typescript
// Chained pipes - easier to read
const result = effect
  .pipe(Effect.map(transformA))
  .pipe(Effect.flatMap(fetchRelated))
  .pipe(Effect.catchTag("NotFound", handleNotFound))
  .pipe(Effect.withSpan("myOperation"))

// You can also group related operations
const result = effect
  .pipe(
    Effect.map(transformA),
    Effect.flatMap(fetchRelated)
  )
  .pipe(
    Effect.catchTag("NotFound", handleNotFound),
    Effect.catchTag("ValidationError", handleValidation)
  )
```

**Note:** `.pipe()` has a maximum of 20 arguments - long pipelines must be split.

---

## Schema Patterns

### Always Use Schema.Class for Domain Entities

**Never manually implement Equal/Hash** - Schema.Class provides them automatically.

```typescript
// CORRECT - Schema.Class with automatic Equal/Hash
export class Account extends Schema.Class<Account>("Account")({
  id: AccountId,
  code: Schema.NonEmptyTrimmedString,
  name: Schema.NonEmptyTrimmedString,
  type: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),
  isActive: Schema.Boolean
}) {
  // Add custom methods as needed
  get isExpenseOrRevenue(): boolean {
    return this.type === "Expense" || this.type === "Revenue"
  }
}

// Usage - .make() is automatic, Equal/Hash work automatically
const account = Account.make({ id, code: "1000", name: "Cash", ... })
Equal.equals(account1, account2)  // Works without manual implementation
```

### Branded Types for IDs

```typescript
export const AccountId = Schema.NonEmptyTrimmedString.pipe(
  Schema.brand("AccountId")
)
export type AccountId = typeof AccountId.Type

const id = AccountId.make("acc_123")  // Creates branded AccountId
```

### Schema.TaggedError for Domain Errors

```typescript
export class AccountNotFound extends Schema.TaggedError<AccountNotFound>()(
  "AccountNotFound",
  { accountId: AccountId }
) {
  get message(): string {
    return `Account not found: ${this.accountId}`
  }
}

// Type guards are automatically derived
export const isAccountNotFound = Schema.is(AccountNotFound)
```

### Recursive Schema Classes

For self-referencing types, use `Schema.suspend()`:

```typescript
export interface TreeNodeEncoded extends Schema.Schema.Encoded<typeof TreeNode> {}

export class TreeNode extends Schema.TaggedClass<TreeNode>()("TreeNode", {
  value: Schema.String,
  children: Schema.Array(Schema.suspend((): Schema.Schema<TreeNode, TreeNodeEncoded> => TreeNode))
}) {}
```

### Never Use *FromSelf Schemas

```typescript
// WRONG - don't use *FromSelf variants
parentId: Schema.OptionFromSelf(AccountId)  // NO!

// CORRECT - use the standard variants
parentId: Schema.Option(AccountId)  // YES - encodes to JSON properly
```

### Use Schema.decodeUnknown (Not Sync)

```typescript
// WRONG - throws exceptions
const account = Schema.decodeUnknownSync(Account)(data)

// CORRECT - returns Effect
const account = yield* Schema.decodeUnknown(Account)(data)
```

### Use Chunk Instead of Array for Structural Equality

Plain JavaScript arrays do NOT implement Equal/Hash:

```typescript
// Arrays break structural equality - WRONG
const arr1 = [1, 2, 3]
const arr2 = [1, 2, 3]
Equal.equals(arr1, arr2)  // false!

// Use Chunk - CORRECT
const c1 = Chunk.make(1, 2, 3)
const c2 = Chunk.make(1, 2, 3)
Equal.equals(c1, c2)  // true!

// In Schema classes
export class AccountHierarchy extends Schema.Class<AccountHierarchy>("AccountHierarchy")({
  root: Account,
  children: Schema.Chunk(Account)  // Chunk compares by value
}) {}
```

---

## Error Handling

### Three-Layer Error Architecture

Errors flow from Persistence → Domain → API:

1. **Persistence Layer** - Low-level database errors
2. **Domain Layer** - Business logic errors (ValidationError, NotFoundError)
3. **API Layer** - HTTP-appropriate error responses

### Using Effect.catchTag

```typescript
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

---

## Service Pattern (Context.Tag + Layer)

```typescript
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

### Creating Layers

**Layer.effect** - When service creation is effectful but doesn't need cleanup:

```typescript
const make = Effect.gen(function* () {
  const config = yield* Config
  const sql = yield* SqlClient.SqlClient

  return {
    findById: (id) => Effect.gen(function* () { ... }),
    findAll: () => Effect.gen(function* () { ... }),
    create: (account) => Effect.gen(function* () { ... })
  }
})

export const AccountServiceLive: Layer.Layer<
  AccountService,
  ConfigError,
  Config | SqlClient.SqlClient
> = Layer.effect(AccountService, make)
```

**Layer.scoped** - When the service needs resource cleanup:

```typescript
const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const changes = yield* PubSub.unbounded<AccountChange>()

  yield* Effect.forkScoped(
    sql`LISTEN account_changes`.pipe(
      Stream.runForEach((change) => PubSub.publish(changes, change))
    )
  )

  return {
    findById: (id) => Effect.gen(function* () { ... }),
    subscribe: PubSub.subscribe(changes)
  }
})

export const AccountServiceLive = Layer.scoped(AccountService, make)
```

### Two Types of Context: Global vs Per-Request

**Global Context** - Provided via Layers at startup (SqlClient, Services, Config)

**Per-Request Context** - Provided via `Effect.provideService` for each request:

```typescript
// CORRECT - per-request context
const handleRequest = (req: Request) =>
  Effect.gen(function* () {
    const result = yield* businessLogic()
    return result
  }).pipe(
    Effect.provideService(CurrentUserId, extractUserId(req)),
    Effect.provideService(CurrentEnvironmentContext, createEnvContext(req))
  )

// WRONG - don't use Layers for per-request data
Effect.provide(Layer.succeed(CurrentUserId, extractUserId(req)))  // NO!
```

---

## Layer Memoization & Composition

### Core Principle: Identity-Based Memoization

**Layers are memoized by object identity (reference equality), not by type or value.**

```typescript
// SAME layer reference used twice = ONE instance
const layer = Layer.effect(MyTag, Effect.succeed("value"))
const composed = layer.pipe(Layer.merge(layer)) // Single instance!

// DIFFERENT layer references = TWO instances
const layer1 = Layer.effect(MyTag, Effect.succeed("value"))
const layer2 = Layer.effect(MyTag, Effect.succeed("value"))
const composed2 = layer1.pipe(Layer.merge(layer2)) // Two instances!
```

### Layer.fresh: Escaping Memoization

`Layer.fresh(layer)` wraps a layer to escape memoization:

```typescript
const layer = Layer.effect(MyTag, createResource())

// Without fresh: single instance
const single = layer.pipe(Layer.merge(layer))

// With fresh: two separate instances
const two = layer.pipe(Layer.merge(Layer.fresh(layer)))
```

**When Layer.fresh IS needed:**
1. Same layer reference appearing multiple times in a composition
2. Module-level constant layers with different configs per test

**When Layer.fresh is NOT needed:**
- Factory functions returning new compositions (they already return new objects)

```typescript
// WRONG - Layer.fresh is unnecessary here
const createTestLayer = () => {
  return Layer.fresh(  // <- REMOVE THIS
    Layer.mergeAll(RepoA, RepoB).pipe(...)
  )
}
```

### Memoization Summary Table

| Scenario | Memoization Behavior |
|----------|---------------------|
| Same layer ref in composition | Shared (single instance) |
| Different layer refs (same type) | Separate instances |
| `Layer.fresh(layer)` | Escapes memoization, always new |
| Factory function calls | Different objects = no sharing |
| Same `it.layer()` block | Shared within block |
| Different `it.layer()` blocks | Separate (new MemoMap each time) |

---

## SQL Patterns (@effect/sql)

### Use Schema to Decode SQL Results

**Never use TypeScript interfaces or type parameters for SQL row types:**

```typescript
// WRONG - using type parameter on sql (banned by lint)
const rows = yield* sql<{ count: string }>`SELECT COUNT(*) as count FROM accounts`

// CORRECT - use Schema to decode results
const AccountRow = Schema.Struct({
  id: AccountId,
  name: Schema.String,
  account_type: AccountType
})

const findById = SqlSchema.findOne({
  Request: AccountId,
  Result: AccountRow,
  execute: (id) => sql`SELECT * FROM accounts WHERE id = ${id}`
})
```

### SqlSchema Patterns

```typescript
// findOne - returns Option (0 or 1 result)
const findById = SqlSchema.findOne({
  Request: Schema.String,
  Result: AccountSchema,
  execute: (id) => sql`SELECT * FROM accounts WHERE id = ${id}`
})

// findAll - returns Array (0 or more results)
const findByCompany = SqlSchema.findAll({
  Request: CompanyId,
  Result: AccountSchema,
  execute: (companyId) => sql`SELECT * FROM accounts WHERE company_id = ${companyId}`
})

// single - expects exactly 1 result (fails if 0 or >1)
const getById = SqlSchema.single({
  Request: AccountId,
  Result: AccountSchema,
  execute: (id) => sql`SELECT * FROM accounts WHERE id = ${id}`
})

// void - for INSERT/UPDATE/DELETE with no return
const deleteById = SqlSchema.void({
  Request: AccountId,
  execute: (id) => sql`DELETE FROM accounts WHERE id = ${id}`
})
```

### Model.Class for Repository Entities

```typescript
class Account extends Model.Class<Account>("Account")({
  id: Model.Generated(AccountId),      // Generated by DB
  name: Schema.String,
  createdAt: Model.DateTimeInsert,     // Auto-set on insert
  updatedAt: Model.DateTimeUpdate      // Auto-set on update
}) {}

// Model.Class provides:
// Account          - select schema (all fields)
// Account.insert   - insert schema (without generated/auto fields)
// Account.update   - update schema (for updates)
// Account.json     - JSON API schema
```

### SQL Helper Methods

```typescript
// Insert
sql`INSERT INTO accounts ${sql.insert({ name, accountType })}`
sql`INSERT INTO accounts ${sql.insert([row1, row2, row3])}`

// Update
sql`UPDATE accounts SET ${sql.update({ name })} WHERE id = ${id}`

// IN clause
sql`SELECT * FROM accounts WHERE id IN ${sql.in(ids)}`

// Combine conditions
sql`SELECT * FROM accounts WHERE ${sql.and([
  sql`company_id = ${companyId}`,
  sql`active = true`
])}`
```

### Transaction Patterns

```typescript
const createAccountWithAudit = (account: Account) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`INSERT INTO accounts ${sql.insert(account)}`
        yield* sql`INSERT INTO audit_log ${sql.insert({
          entity_type: "account",
          entity_id: account.id,
          action: "create"
        })}`
        return account
      })
    )
  })
```

---

## Testing Patterns (@effect/vitest)

### Test Variants

| Method | TestServices | Scope | Use Case |
|--------|--------------|-------|----------|
| `it.effect` | TestClock | No | Most tests - deterministic time |
| `it.live` | Real clock | No | Tests needing real time/IO |
| `it.scoped` | TestClock | Yes | Tests with resources (acquireRelease) |
| `it.scopedLive` | Real clock | Yes | Real time + resources |

### it.effect - Use for Most Tests

```typescript
it.effect("processes after delay", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(
      Effect.sleep(Duration.minutes(5)).pipe(Effect.map(() => "done"))
    )

    yield* TestClock.adjust(Duration.minutes(5))  // No real waiting!

    const result = yield* Fiber.join(fiber)
    expect(result).toBe("done")
  })
)
```

### Sharing Layers Between Tests

```typescript
layer(AccountServiceLive)("AccountService", (it) => {
  it.effect("finds account by id", () =>
    Effect.gen(function* () {
      const service = yield* AccountService
      const account = yield* service.findById(testAccountId)
      expect(account.name).toBe("Test")
    })
  )
})
```

### Property-Based Testing

```typescript
import { it } from "@effect/vitest"
import { FastCheck, Schema, Arbitrary } from "effect"

// Synchronous property test
it.prop("symmetry", [Schema.Number, FastCheck.integer()], ([a, b]) =>
  a + b === b + a
)

// Effectful property test
it.effect.prop("symmetry in effect", [Schema.Number, FastCheck.integer()], ([a, b]) =>
  Effect.gen(function* () {
    yield* Effect.void
    return a + b === b + a
  })
)
```

### Database Testing with Testcontainers

#### Per-Block Container (Simple Setup)

```typescript
export class PgContainer extends Effect.Service<PgContainer>()("test/PgContainer", {
  scoped: Effect.acquireRelease(
    Effect.tryPromise({
      try: () => new PostgreSqlContainer("postgres:alpine").start(),
      catch: (cause) => new ContainerError({ cause })
    }),
    (container) => Effect.promise(() => container.stop())
  )
}) {
  static ClientLive = Layer.unwrapEffect(
    Effect.gen(function*() {
      const container = yield* PgContainer
      return PgClient.layer({ url: Redacted.make(container.getConnectionUri()) })
    })
  ).pipe(Layer.provide(this.Default))
}

// In tests
it.layer(PgContainer.ClientLive, { timeout: "30 seconds" })("AccountRepository", (it) => {
  it.effect("creates and retrieves account", () => Effect.gen(function*() {
    const sql = yield* PgClient.PgClient
    // ...
  }))
})
```

#### Shared Container (Global Setup - Recommended for Large Test Suites)

**Step 1: Create global setup**

```typescript
// vitest.global-setup.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql"

let container: StartedPostgreSqlContainer

export async function setup({ provide }) {
  container = await new PostgreSqlContainer("postgres:alpine").start()
  provide("dbUrl", container.getConnectionUri())
}

export async function teardown() {
  await container?.stop()
}
```

**Step 2: Update vitest config**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
    hookTimeout: 120000
  }
})
```

**Step 3: Create shared layer**

```typescript
// test/utils.ts
import { inject } from "vitest"

export const SharedPgClientLive = Layer.effect(
  PgClient.PgClient,
  Effect.gen(function*() {
    const url = inject("dbUrl") as string
    return yield* PgClient.make({ url: Redacted.make(url) })
  })
)
```

**Step 4: Use in tests**

```typescript
const TestLayer = RepositoriesLayer.pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(SharedPgClientLive)  // Uses global container
)
```

### When to Use Layer.fresh in Tests

**Use Layer.fresh for module-level constant layers with different configs:**

```typescript
// AuthServiceLive is defined as module-level constant
export const AuthServiceLive = Layer.effect(AuthService, make)

// In tests with different configs - NEED Layer.fresh
const createTestLayer = (options: { autoProvisionUsers?: boolean }) => {
  const AuthConfigLayer = Layer.effect(AuthServiceConfig, Effect.succeed({
    autoProvisionUsers: options.autoProvisionUsers ?? true
  }))

  return Layer.fresh(AuthServiceLive).pipe(  // <- REQUIRED!
    Layer.provideMerge(AuthConfigLayer)
  )
}
```

**Don't use Layer.fresh for factory functions** - they already return new objects.
