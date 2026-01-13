# Accountability - Claude Code Guide

This document provides guidance for Claude Code when working on the Accountability project.

## Project Overview

Accountability is a multi-company, multi-currency accounting application using:
- **Effect** - Functional TypeScript library for type-safe, composable business logic
- **TanStack Start** - Full-stack React framework with server functions
- **Effect Atom** - State management for Effect

## Project Structure

```
accountability/
├── packages/
│   ├── core/           # Core accounting logic (100% tested, no deps)
│   ├── persistence/    # Database layer (@effect/sql + PostgreSQL)
│   ├── api/            # TanStack Start server functions
│   └── web/            # React UI
├── specs/              # Detailed specifications (see below)
└── repos/              # Reference repositories (git subtrees)
    ├── effect/         # Effect-TS source
    ├── tanstack-router/# TanStack Router/Start source
    └── effect-atom/    # Effect Atom source
```

## Specifications Index

| Spec File | Description |
|-----------|-------------|
| [specs/ACCOUNTING_RESEARCH.md](specs/ACCOUNTING_RESEARCH.md) | Domain specifications (entities, services, reports) |
| [specs/EFFECT_BEST_PRACTICES.md](specs/EFFECT_BEST_PRACTICES.md) | **Critical rules**, Schema patterns, services, layers |
| [specs/EFFECT_ATOM.md](specs/EFFECT_ATOM.md) | **Effect Atom reactivity**, refresh patterns, anti-patterns |
| [specs/EFFECT_SQL.md](specs/EFFECT_SQL.md) | SqlSchema, Model.Class, repository patterns |
| [specs/EFFECT_LAYERS.md](specs/EFFECT_LAYERS.md) | Layer composition, memoization, service patterns |
| [specs/EFFECT_TESTING.md](specs/EFFECT_TESTING.md) | @effect/vitest, testcontainers, property testing |
| [specs/TYPESCRIPT_CONVENTIONS.md](specs/TYPESCRIPT_CONVENTIONS.md) | Project refs, imports, module structure |
| [specs/REFERENCE_REPOS.md](specs/REFERENCE_REPOS.md) | Effect, TanStack, Effect-Atom package references |
| [specs/HTTP_API_TANSTACK.md](specs/HTTP_API_TANSTACK.md) | TanStack Start server function patterns |
| [specs/API_BEST_PRACTICES.md](specs/API_BEST_PRACTICES.md) | API layer conventions |
| [specs/AUTHENTICATION.md](specs/AUTHENTICATION.md) | Multi-provider auth system, session management |
| [specs/E2E_TESTING.md](specs/E2E_TESTING.md) | Playwright E2E testing patterns |
| [specs/REACT_BEST_PRACTICES.md](specs/REACT_BEST_PRACTICES.md) | **React patterns**, Tailwind, Effect Atom state |

## Key Files

| File | Purpose |
|------|---------|
| `prd.json` | User stories with status tracking |
| `ralph.sh` | Autonomous agent loop orchestrator |
| `RALPH_PROMPT.md` | Agent prompt template |
| `progress.txt` | Progress log for Ralph iterations |

---

## Quick Start: Critical Rules

**Read [specs/EFFECT_BEST_PRACTICES.md](specs/EFFECT_BEST_PRACTICES.md) first.** Key rules:

1. **NEVER use `any` or type casts** - use Schema.make(), decodeUnknown, identity
2. **NEVER use global `Error`** - use Schema.TaggedError for all domain errors
3. **NEVER use `catchAllCause`** - it catches defects (bugs); use catchAll or mapError
4. **NEVER use `disableValidation: true`** - banned by lint rule
5. **NEVER use `*FromSelf` schemas** - use standard variants (Schema.Option, not OptionFromSelf)
6. **NEVER use Sync variants** - use Schema.decodeUnknown not decodeUnknownSync
7. **NEVER create index.ts barrel files** - import from specific modules

---

## Quick Reference Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm test             # Run tests
pnpm typecheck        # Check types
pnpm lint             # Run linter

# Ralph Agent
./ralph.sh [max_iterations]          # Start autonomous loop
```

---

## Implementation Guidelines

1. **Flat modules, no barrel files** - `CurrencyCode.ts` not `domain/currency/index.ts`
2. **Prefer Schema.Class over Schema.Struct** - classes give you constructor, Equal, Hash
3. **Use Schema's `.make()` constructor** - all schemas have it, never use `new`
4. **Use Schema.TaggedError** for all domain errors - type guards via `Schema.is()`
5. **Use branded types** for IDs (AccountId, CompanyId, etc.)
6. **Use BigDecimal** for all monetary calculations
7. **Use Layer.effect or Layer.scoped** - avoid Layer.succeed and Tag.of
8. **Write tests** alongside implementation using `@effect/vitest`

---

## Notes for Ralph Agent

When working on stories:

1. **Read [specs/ACCOUNTING_RESEARCH.md](specs/ACCOUNTING_RESEARCH.md)** for domain requirements
2. **Read [specs/EFFECT_BEST_PRACTICES.md](specs/EFFECT_BEST_PRACTICES.md)** for coding rules
3. **Search repos/** for implementation patterns
4. **Signal STORY_COMPLETE** when done (don't commit, script handles it)
5. **Run tests** before signaling completion: `pnpm test && pnpm typecheck`
