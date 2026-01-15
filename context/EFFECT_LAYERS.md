# Effect Layers: Deep Dive

This document covers the essential semantics of Effect's Layer system, focusing on memoization, laziness, and correct usage patterns—especially in tests.

## Core Principle: Identity-Based Memoization

**Layers are lazy by default and memoized by object identity (reference equality), not by type or value.**

When you build a layer composition, Effect maintains a `MemoMap` (a Map keyed by layer object reference). If the same layer object appears multiple times in the composition:
- First encounter: evaluate the layer, store in MemoMap
- Subsequent encounters: return cached result

```typescript
// SAME layer reference used twice = ONE instance
const layer = Layer.effect(MyTag, Effect.succeed("value"))
const composed = layer.pipe(Layer.merge(layer)) // Single instance!

// DIFFERENT layer references = TWO instances
const layer1 = Layer.effect(MyTag, Effect.succeed("value"))
const layer2 = Layer.effect(MyTag, Effect.succeed("value"))
const composed2 = layer1.pipe(Layer.merge(layer2)) // Two instances!
```

## Layer.fresh: Escaping Memoization

`Layer.fresh(layer)` wraps a layer to **escape memoization entirely**. The MemoMap ignores Fresh-wrapped layers and always creates new instances.

```typescript
const layer = Layer.effect(MyTag, createResource())

// Without fresh: single instance
const single = layer.pipe(Layer.merge(layer))

// With fresh: two separate instances
const two = layer.pipe(Layer.merge(Layer.fresh(layer)))
```

**When is Layer.fresh actually needed?**

Only when you:
1. Have the **same layer reference** appearing multiple times in a composition
2. **Want separate instances** instead of sharing

```typescript
// CORRECT use of Layer.fresh
const baseLayer = makeExpensiveLayer()
const needsBothInstances = Layer.merge(
  baseLayer,                  // First instance
  Layer.fresh(baseLayer)      // Second (separate) instance
)
```

## Common Misconception: Factory Functions Don't Need Fresh

A factory function that builds a new layer on each call **already returns different layer objects**:

```typescript
// Each call returns a NEW layer object - no memoization between them!
const createTestLayer = (config: Config) => {
  return Layer.effect(MyService, makeService(config))
}

// These are DIFFERENT objects - memoization does NOT occur between them
const layer1 = createTestLayer({ option: true })
const layer2 = createTestLayer({ option: false })

// Layer.fresh is UNNECESSARY here!
// BAD: return Layer.fresh(composed)  <- Adds no value
// GOOD: return composed
```

**The key insight**: Memoization is per-build, not global. Each time you build a layer composition (e.g., via `it.layer()`), a fresh MemoMap is created. Different `createTestLayer()` calls return different objects, so no memoization occurs between them anyway.

## Layer.memoize: Explicit Lazy Memoization

`Layer.memoize` creates a layer that is lazily built and explicitly memoized within a scope:

```typescript
const memoized = yield* Layer.memoize(expensiveLayer)

// First use: builds the layer
const ctx1 = yield* Effect.provide(myEffect, memoized)

// Second use: returns cached result (within same scope)
const ctx2 = yield* Effect.provide(myEffect, memoized)
```

Use case: When you need to delay layer construction and ensure it's only built once within a specific scope.

## ManagedRuntime: Sharing Layers Across Multiple Runs

`ManagedRuntime` stores a MemoMap that persists across all effects run through it:

```typescript
const runtime = ManagedRuntime.make(myLayers)

// Both runs share the same memoization cache
await runtime.runPromise(effect1) // Builds layers
await runtime.runPromise(effect2) // Reuses cached layers
```

You can also share a MemoMap across multiple runtimes:

```typescript
const sharedMemoMap = Layer.unsafeMakeMemoMap()
const runtime1 = ManagedRuntime.make(layer, sharedMemoMap)
const runtime2 = ManagedRuntime.make(layer, sharedMemoMap)
// Both runtimes share cached layer instances
```

## Test Patterns

### Pattern 1: Isolated Test Groups (Default)

Each `it.layer()` block creates a new MemoMap, so layers are rebuilt per block:

```typescript
describe("Feature A", () => {
  const TestLayer = createTestLayer({ optionA: true })

  it.layer(TestLayer)("tests", (it) => {
    // All tests in this block share the same layer instance
    it.effect("test 1", () => /* ... */)
    it.effect("test 2", () => /* uses same layer as test 1 */)
  })
})

describe("Feature B", () => {
  const TestLayer = createTestLayer({ optionB: true })

  it.layer(TestLayer)("tests", (it) => {
    // NEW layer instance - completely isolated from Feature A
    it.effect("test 3", () => /* ... */)
  })
})
```

### Pattern 2: Shared Infrastructure Across All Tests

For expensive resources (like database containers), use vitest's `globalSetup`:

```typescript
// vitest.global-setup.ts
export default async function setup({ provide }) {
  const container = await new PostgreSqlContainer().start()
  provide('dbUrl', container.getConnectionUri())

  return async () => {
    await container.stop()
  }
}

// In tests
import { inject } from 'vitest'

const DbLayer = Layer.effect(PgClient.PgClient,
  Effect.gen(function*() {
    const url = inject('dbUrl') // From global setup
    return yield* PgClient.make({ url: Redacted.make(url) })
  })
)
```

## Summary Table

| Scenario | Memoization Behavior |
|----------|---------------------|
| Same layer ref in composition | Shared (single instance) |
| Different layer refs (same type) | Separate instances |
| `Layer.fresh(layer)` | Escapes memoization, always new |
| Factory function calls | Different objects = no sharing |
| Same `it.layer()` block | Shared within block |
| Different `it.layer()` blocks | Separate (new MemoMap each time) |
| Same `ManagedRuntime` | Shared across runs |
| Different `ManagedRuntime` | Separate (unless sharing MemoMap) |

## Rules of Thumb

1. **Don't use `Layer.fresh` with factory functions** - they already return new objects
2. **Use `Layer.fresh` only when** you have the same layer reference twice and want separate instances
3. **For shared test infrastructure** (databases, containers), use vitest `globalSetup`
4. **For per-test-group isolation**, rely on `it.layer()` creating new MemoMaps
5. **Memoization is per-build** - different builds never share, same build always shares (unless Fresh)
