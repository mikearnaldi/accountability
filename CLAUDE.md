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

## 🚨 CRITICAL: BACKEND AND FRONTEND MUST STAY ALIGNED 🚨

**This is a HARD REQUIREMENT. When implementing features:**

1. **NEVER do frontend-only changes** for features that need backend work
2. **ALWAYS update both layers** - packages/web AND packages/core, packages/api, packages/persistence
3. **Frontend workarounds are NOT acceptable** - if the spec says "update API", update the API
4. **Run tests** - `pnpm test && pnpm typecheck` MUST pass before marking work complete
5. **Read context/UI_ARCHITECTURE.md** - See "MANDATORY: BACKEND AND FRONTEND MUST STAY ALIGNED" section

**Data flow**: Frontend → API → Service → Repository → Database
**All layers must be consistent.**

## Project Structure

```
accountability/
├── packages/
│   ├── core/           # Core accounting logic (Effect, 100% tested) ← BACKEND
│   ├── persistence/    # Database layer (@effect/sql + PostgreSQL) ← BACKEND
│   ├── api/            # Effect HttpApi server + OpenAPI export ← BACKEND
│   └── web/            # React UI (NO Effect - loaders + openapi-fetch client) ← FRONTEND
├── specs/              # ACTIONABLE specs - ralph-auto.sh implements these automatically
├── context/            # Reference documentation - provides context to agents
└── repos/              # Reference repositories (git subtrees)
    ├── effect/         # Effect-TS source
    └── tanstack-router/# TanStack Router/Start source
```

## Specs vs Context

**`specs/`** - Contains ACTIONABLE specifications that should be implemented:
- `ralph-auto.sh` automatically implements everything in this folder
- Each spec file defines features/UI/behavior that needs to be built
- Specs should be updated as work is completed (mark issues resolved, etc.)

**`context/`** - Contains REFERENCE documentation for agents:
- Best practices, conventions, patterns
- Domain knowledge and research
- Not directly actionable - provides guidance and context

## Actionable Specs (specs/)

| Spec File | Description |
|-----------|-------------|
| [specs/CONSOLIDATED_REPORTS.md](specs/CONSOLIDATED_REPORTS.md) | **IMPLEMENT** - Consolidated financial reports (Balance Sheet, Income Statement, Cash Flow, Equity) |
| [specs/E2E_TEST_COVERAGE.md](specs/E2E_TEST_COVERAGE.md) | **IMPLEMENT** - E2E test coverage gaps and implementation plan |
| [specs/EXCHANGE_RATE_SYNC.md](specs/EXCHANGE_RATE_SYNC.md) | **IMPLEMENT** - ECB exchange rate sync and cross-rate triangulation |

## Context Documentation (context/)

| File | Description |
|------|-------------|
| [context/ACCOUNTING_RESEARCH.md](context/ACCOUNTING_RESEARCH.md) | Domain specifications (entities, services, reports) |
| [context/API_BEST_PRACTICES.md](context/API_BEST_PRACTICES.md) | API layer conventions |
| [context/AUTHENTICATION.md](context/AUTHENTICATION.md) | Multi-provider auth system, session management |
| [context/CONSOLIDATION_METHOD_CLEANUP.md](context/CONSOLIDATION_METHOD_CLEANUP.md) | Consolidation method field cleanup notes |
| [context/DOMAIN_MODEL.md](context/DOMAIN_MODEL.md) | Complete domain model documentation |
| [context/E2E_TESTING.md](context/E2E_TESTING.md) | Playwright E2E testing patterns |
| [context/EFFECT_BEST_PRACTICES.md](context/EFFECT_BEST_PRACTICES.md) | **Critical rules** for backend Effect code |
| [context/EFFECT_LAYERS.md](context/EFFECT_LAYERS.md) | Layer composition, memoization, service patterns |
| [context/EFFECT_SQL.md](context/EFFECT_SQL.md) | SqlSchema, Model.Class, repository patterns |
| [context/EFFECT_TESTING.md](context/EFFECT_TESTING.md) | @effect/vitest, testcontainers, property testing |
| [context/HTTP_API_TANSTACK.md](context/HTTP_API_TANSTACK.md) | Effect HttpApi + TanStack Start SSR + openapi-fetch |
| [context/REACT_BEST_PRACTICES.md](context/REACT_BEST_PRACTICES.md) | React patterns, loaders, mutations, Tailwind |
| [context/REFERENCE_REPOS.md](context/REFERENCE_REPOS.md) | Reference repository documentation |
| [context/TYPESCRIPT_CONVENTIONS.md](context/TYPESCRIPT_CONVENTIONS.md) | Project refs, imports, module structure |
| [context/UI_ARCHITECTURE.md](context/UI_ARCHITECTURE.md) | Layout, navigation, page templates, component patterns |
| [context/USABILITY_BEST_PRACTICES.md](context/USABILITY_BEST_PRACTICES.md) | UX patterns, navigation, forms, states |

## Key Files

| File | Purpose |
|------|---------|
| `ralph-auto.sh` | **AUTO agent loop** - implements everything in `specs/` automatically |
| `RALPH_AUTO_PROMPT.md` | Prompt template for the Ralph Auto agent |
| `progress-auto.txt` | Progress log for Ralph Auto iterations |

---

## Quick Start: Critical Rules

### Backend (Effect code in core, persistence, api)

**Read [context/EFFECT_BEST_PRACTICES.md](context/EFFECT_BEST_PRACTICES.md) first.** Key rules:

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

**Read [context/UI_ARCHITECTURE.md](context/UI_ARCHITECTURE.md) for all UI work.** Key rules:

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

# Ralph Auto Agent
./ralph-auto.sh               # AUTO agent loop - implements everything in specs/
```

---

## Implementation Guidelines

### Backend (packages/core, persistence, api)

**Effect-based** - functional, type-safe, composable. Services in `core/`, repositories in `persistence/`, endpoints in `api/`.

**Read these context files:**
- [context/EFFECT_BEST_PRACTICES.md](context/EFFECT_BEST_PRACTICES.md) - critical rules for Effect code
- [context/EFFECT_SQL.md](context/EFFECT_SQL.md) - repository patterns, SqlSchema
- [context/API_BEST_PRACTICES.md](context/API_BEST_PRACTICES.md) - API layer conventions

**Guidelines:**
1. **Flat modules, no barrel files** - `CurrencyCode.ts` not `domain/currency/index.ts`
2. **Prefer Schema.Class over Schema.Struct** - classes give you constructor, Equal, Hash
3. **Use Schema's `.make()` constructor** - all schemas have it, never use `new`
4. **Use Schema.TaggedError** for all domain errors - type guards via `Schema.is()`
5. **Use branded types** for IDs (AccountId, CompanyId, etc.)
6. **Use BigDecimal** for all monetary calculations
7. **Use Layer.effect or Layer.scoped** - avoid Layer.succeed and Tag.of
8. **Write tests** alongside implementation using `@effect/vitest`

### Frontend (packages/web)

**NO Effect code** - use openapi-fetch client for API calls. Use loaders for SSR data fetching, useState for UI state.

**Read these context files:**
- [context/REACT_BEST_PRACTICES.md](context/REACT_BEST_PRACTICES.md) - React patterns
- [context/UI_ARCHITECTURE.md](context/UI_ARCHITECTURE.md) - layout, navigation, components

**Guidelines:**
1. **Use openapi-fetch client** - `api.GET()`, `api.POST()` for type-safe calls
2. **Fetch in loaders** - use `loader()` for SSR data, `useLoaderData()` in component
3. **Invalidate after mutations** - call `router.invalidate()` to refetch data
4. **Handle empty states** - show helpful messages when no data
5. **All pages use AppLayout** with Sidebar and Header
6. **Use Tailwind CSS** - consistent spacing, colors, typography

### Full Stack Features

When implementing a feature that spans layers:

1. **Domain model** in `core/` - entities, value objects
2. **Repository** in `persistence/` - database operations
3. **Service** in `core/` - business logic
4. **API endpoint** in `api/` - HTTP handlers
5. **Frontend** in `web/` - pages, components, API calls

---

## Notes for Ralph Auto Agent

When running autonomously via `ralph-auto.sh`:

1. **Read all files in `specs/`** - these are actionable specs to implement
2. **Use `context/` for reference** - best practices, conventions, patterns
3. **Implement specs fully** - each spec file defines work to be done
4. **Update specs as you work** - mark issues resolved, remove completed items
5. **Signal TASK_COMPLETE** when a task is done
6. **Signal NOTHING_LEFT_TO_DO** when all specs are fully implemented
