# Accountability - Claude Code Guide

This document provides guidance for Claude Code when working on the Accountability project.

## Project Overview

Accountability is a multi-company, multi-currency accounting application using:
- **Effect** - Functional TypeScript library for type-safe backend business logic (server only)
- **TanStack Start** - Full-stack React framework with SSR and file-based routing
- **openapi-fetch** - Typed fetch client generated from Effect HttpApi's OpenAPI spec

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (web)                         │
│  React + TanStack Start + openapi-fetch + Tailwind          │
│  NO Effect code - loaders for SSR, useState for UI          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (openapi-fetch client)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND (api)                          │
│  Effect HttpApi + HttpApiBuilder                             │
│  Exports OpenAPI spec for client generation                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PERSISTENCE + CORE                         │
│  @effect/sql + PostgreSQL │ Effect business logic            │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
accountability/
├── packages/
│   ├── core/           # Core accounting logic (Effect, 100% tested)
│   ├── persistence/    # Database layer (@effect/sql + PostgreSQL)
│   ├── api/            # Effect HttpApi server + OpenAPI export
│   └── web/            # React UI (NO Effect - loaders + openapi-fetch client)
├── specs/              # Detailed specifications (see below)
└── repos/              # Reference repositories (git subtrees)
    ├── effect/         # Effect-TS source
    └── tanstack-router/# TanStack Router/Start source
```

## Specifications Index

| Spec File | Description |
|-----------|-------------|
| [specs/ACCOUNTING_RESEARCH.md](specs/ACCOUNTING_RESEARCH.md) | Domain specifications (entities, services, reports) |
| [specs/EFFECT_BEST_PRACTICES.md](specs/EFFECT_BEST_PRACTICES.md) | **Critical rules** for backend Effect code |
| [specs/EFFECT_SQL.md](specs/EFFECT_SQL.md) | SqlSchema, Model.Class, repository patterns |
| [specs/EFFECT_LAYERS.md](specs/EFFECT_LAYERS.md) | Layer composition, memoization, service patterns |
| [specs/EFFECT_TESTING.md](specs/EFFECT_TESTING.md) | @effect/vitest, testcontainers, property testing |
| [specs/TYPESCRIPT_CONVENTIONS.md](specs/TYPESCRIPT_CONVENTIONS.md) | Project refs, imports, module structure |
| [specs/HTTP_API_TANSTACK.md](specs/HTTP_API_TANSTACK.md) | Effect HttpApi + TanStack Start SSR + openapi-fetch |
| [specs/API_BEST_PRACTICES.md](specs/API_BEST_PRACTICES.md) | API layer conventions |
| [specs/AUTHENTICATION.md](specs/AUTHENTICATION.md) | Multi-provider auth system, session management |
| [specs/E2E_TESTING.md](specs/E2E_TESTING.md) | Playwright E2E testing patterns |
| [specs/REACT_BEST_PRACTICES.md](specs/REACT_BEST_PRACTICES.md) | React patterns, loaders, mutations, Tailwind |
| [specs/USABILITY_BEST_PRACTICES.md](specs/USABILITY_BEST_PRACTICES.md) | UX patterns, navigation, forms, states |
| [specs/UI_ARCHITECTURE.md](specs/UI_ARCHITECTURE.md) | **Critical** - Layout, navigation, page templates |

## Key Files

| File | Purpose |
|------|---------|
| `prd.json` | User stories with status tracking |
| `ralph.sh` | Autonomous agent loop orchestrator |
| `RALPH_PROMPT.md` | Agent prompt template |
| `progress.txt` | Progress log for Ralph iterations |

---

## Quick Start: Critical Rules

### Backend (Effect code in core, persistence, api)

**Read [specs/EFFECT_BEST_PRACTICES.md](specs/EFFECT_BEST_PRACTICES.md) first.** Key rules:

1. **NEVER use `any` or type casts** - use Schema.make(), decodeUnknown, identity
2. **NEVER use global `Error`** - use Schema.TaggedError for all domain errors
3. **NEVER use `catchAllCause`** - it catches defects (bugs); use catchAll or mapError
4. **NEVER use `disableValidation: true`** - banned by lint rule
5. **NEVER use `*FromSelf` schemas** - use standard variants (Schema.Option, not OptionFromSelf)
6. **NEVER use Sync variants** - use Schema.decodeUnknown not decodeUnknownSync
7. **NEVER create index.ts barrel files** - import from specific modules

### Frontend (React code in web package)

**NO Effect code in frontend.** Key patterns:

1. **Use openapi-fetch client** - `api.GET()`, `api.POST()` for typed API calls
2. **Use loaders for SSR** - `loader()` fetches data, `useLoaderData()` in component
3. **Use `router.invalidate()`** - refetch data after mutations
4. **Use `useState` for UI** - local form state, modals, toggles
5. **Use Tailwind CSS** - no inline styles, use clsx for conditional classes

### UI Architecture (CRITICAL)

**Read [specs/UI_ARCHITECTURE.md](specs/UI_ARCHITECTURE.md) for all UI work.** Key rules:

1. **ALL pages use AppLayout** - sidebar + header on EVERY authenticated page
2. **NO manual breadcrumb HTML** - use the Breadcrumbs component
3. **NO page-specific headers** - use the shared Header component
4. **Organization selector always accessible** - users can switch orgs from any page
5. **Consistent page templates** - use List, Detail, Form page patterns from spec
6. **Empty states required** - every list page needs an empty state with CTA

---

## Quick Reference Commands

```bash
# Development
pnpm dev                # Start dev server (port 3000)
pnpm build              # Build for production
pnpm preview            # Preview production build
pnpm start              # Start production server

# Code Generation
pnpm generate-routes    # Regenerate TanStack Router routes (routeTree.gen.ts)
pnpm generate:api       # Generate typed API client from OpenAPI spec (run in packages/web)

# Testing (minimal output by default - shows dots for passes, details for failures)
pnpm test               # Run unit/integration tests (vitest) - minimal output
pnpm test:verbose       # Run tests with full output (all test names)
pnpm test:coverage      # Run tests with coverage
pnpm test:e2e           # Run Playwright E2E tests - minimal output
pnpm test:e2e:verbose   # Run E2E tests with full output (all test names)
pnpm test:e2e:ui        # Run E2E tests with interactive UI
pnpm test:e2e:report    # View E2E test report

# Code Quality
pnpm typecheck          # Check TypeScript types
pnpm lint               # Run ESLint
pnpm lint:fix           # Run ESLint with auto-fix
pnpm format             # Format code with Prettier
pnpm format:check       # Check formatting

# Maintenance
pnpm clean              # Clean build outputs

# Ralph Agent
./ralph.sh [max_iterations]   # Start autonomous agent loop
```

---

## Implementation Guidelines

### Backend (Effect)

1. **Flat modules, no barrel files** - `CurrencyCode.ts` not `domain/currency/index.ts`
2. **Prefer Schema.Class over Schema.Struct** - classes give you constructor, Equal, Hash
3. **Use Schema's `.make()` constructor** - all schemas have it, never use `new`
4. **Use Schema.TaggedError** for all domain errors - type guards via `Schema.is()`
5. **Use branded types** for IDs (AccountId, CompanyId, etc.)
6. **Use BigDecimal** for all monetary calculations
7. **Use Layer.effect or Layer.scoped** - avoid Layer.succeed and Tag.of
8. **Write tests** alongside implementation using `@effect/vitest`

### Frontend (React)

1. **Use openapi-fetch client** - `api.GET()`, `api.POST()` for type-safe calls
2. **Fetch in loaders** - use `loader()` for SSR data, `useLoaderData()` in component
3. **Invalidate after mutations** - call `router.invalidate()` to refetch data
4. **Handle empty states** - show helpful messages when no data
5. **Use Tailwind utilities** - consistent spacing, colors, typography

---

## Notes for Ralph Agent

When working on stories:

1. **Read [specs/ACCOUNTING_RESEARCH.md](specs/ACCOUNTING_RESEARCH.md)** for domain requirements
2. **Read [specs/EFFECT_BEST_PRACTICES.md](specs/EFFECT_BEST_PRACTICES.md)** for backend coding rules
3. **Read [specs/REACT_BEST_PRACTICES.md](specs/REACT_BEST_PRACTICES.md)** for frontend patterns
4. **Read [specs/UI_ARCHITECTURE.md](specs/UI_ARCHITECTURE.md)** for UI layout and navigation rules
5. **Search repos/** for implementation patterns
6. **Signal STORY_COMPLETE** when done (don't commit, script handles it)
7. **Run tests** before signaling completion: `pnpm test && pnpm typecheck`
