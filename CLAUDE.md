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
5. **Read specs/UI_ARCHITECTURE.md** - See "MANDATORY: BACKEND AND FRONTEND MUST STAY ALIGNED" section

**Data flow**: Frontend → API → Service → Repository → Database
**All layers must be consistent.**

## 🚫 NEVER RUN DOCKER

**NEVER run docker commands.** The database and infrastructure are managed externally. Tests use testcontainers which handle their own containers automatically. Do not run:
- `docker run`
- `docker compose`
- `docker-compose`
- Any docker-related commands

## Project Structure

```
accountability/
├── packages/
│   ├── core/           # Core accounting logic (Effect, 100% tested) ← BACKEND
│   ├── persistence/    # Database layer (@effect/sql + PostgreSQL) ← BACKEND
│   ├── api/            # Effect HttpApi server + OpenAPI export ← BACKEND
│   └── web/            # React UI (NO Effect - loaders + openapi-fetch client) ← FRONTEND
├── specs/              # All specs and context - use focus mode to select relevant files
└── repos/              # Reference repositories (git subtrees)
    ├── effect/         # Effect-TS source
    └── tanstack-router/# TanStack Router/Start source
```

## Specs Directory

All specifications and context documentation live in `specs/`. Use focus mode to select relevant files for your task.

### Consolidated Guides (Start Here)

| File | Description |
|------|-------------|
| [specs/guides/effect-guide.md](specs/guides/effect-guide.md) | Effect patterns, layers, errors, SQL, testing |
| [specs/guides/testing-guide.md](specs/guides/testing-guide.md) | Unit, integration, E2E testing |
| [specs/guides/frontend-guide.md](specs/guides/frontend-guide.md) | React, UI, components, styling, design system |
| [specs/guides/api-guide.md](specs/guides/api-guide.md) | HttpApi, endpoints, schemas, SSR |

### Architecture

| File | Description |
|------|-------------|
| [specs/architecture/accounting-research.md](specs/architecture/accounting-research.md) | Comprehensive domain spec - US GAAP, entities, services, reports |
| [specs/architecture/authentication.md](specs/architecture/authentication.md) | Multi-provider auth system, session management |
| [specs/architecture/authorization.md](specs/architecture/authorization.md) | RBAC/ABAC policies and permissions |
| [specs/architecture/error-design.md](specs/architecture/error-design.md) | One-layer error architecture |
| [specs/architecture/fiscal-periods.md](specs/architecture/fiscal-periods.md) | Fiscal year/period management, mandatory period 13 |

### Pending Implementation

| File | Description |
|------|-------------|
| [specs/pending/exchange-rate-sync.md](specs/pending/exchange-rate-sync.md) | ECB exchange rate sync and cross-rate triangulation |
| [specs/pending/policy-ux-improvements.md](specs/pending/policy-ux-improvements.md) | Policy creation UX redesign |
| [specs/pending/duplicated-company-creation-page.md](specs/pending/duplicated-company-creation-page.md) | Remove duplicate company creation UI |

### Completed (Historical Reference)

| File | Description |
|------|-------------|
| [specs/completed/consolidated-reports.md](specs/completed/consolidated-reports.md) | Consolidated financial reports |
| [specs/completed/consolidation-method-cleanup.md](specs/completed/consolidation-method-cleanup.md) | Consolidation method field cleanup |
| [specs/completed/e2e-test-coverage.md](specs/completed/e2e-test-coverage.md) | E2E test coverage status |
| [specs/completed/synthetic-data-generator.md](specs/completed/synthetic-data-generator.md) | Playwright script for demo data |
| [specs/completed/past-date-journal-entries.md](specs/completed/past-date-journal-entries.md) | Journal entries with past dates |
| [specs/completed/form-components-standardization.md](specs/completed/form-components-standardization.md) | Form component patterns |
| [specs/completed/company-details.md](specs/completed/company-details.md) | Company details implementation |
| [specs/completed/core-code-organisation.md](specs/completed/core-code-organisation.md) | Core package organization |
| [specs/completed/error-tracker.md](specs/completed/error-tracker.md) | Error tracking issues |
| [specs/completed/audit-page.md](specs/completed/audit-page.md) | Audit log page implementation |
| [specs/completed/authorization-missing.md](specs/completed/authorization-missing.md) | Missing authorization features |

### Reference

| File | Description |
|------|-------------|
| [specs/reference/reference-repos.md](specs/reference/reference-repos.md) | Reference repository documentation |

## Key Files

| File | Purpose |
|------|---------|
| `ralph-auto.sh` | **AUTO agent loop** - implements everything in `specs/` automatically |
| `RALPH_AUTO_PROMPT.md` | Prompt template for the Ralph Auto agent |
| `progress-auto.txt` | Progress log for Ralph Auto iterations |

---

## Quick Start: Critical Rules

### Backend (Effect code in core, persistence, api)

**Read [specs/guides/effect-guide.md](specs/guides/effect-guide.md) first.** Key rules:

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

**Read [specs/guides/frontend-guide.md](specs/guides/frontend-guide.md) for all UI work.** Key rules:

1. **ALL pages use AppLayout** - sidebar + header on EVERY authenticated page
2. **NO manual breadcrumb HTML** - use the Breadcrumbs component
3. **NO page-specific headers** - use the shared Header component
4. **Organization selector always accessible** - users can switch orgs from any page
5. **Consistent page templates** - use List, Detail, Form page patterns from spec
6. **Empty states required** - every list page needs an empty state with CTA
7. **NO redundant CTAs** - when list is empty, hide header button (`items.length > 0 &&`), show only empty state CTA

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

**Read these specs:**
- [specs/guides/effect-guide.md](specs/guides/effect-guide.md) - critical rules for Effect code, layers, SQL, testing
- [specs/guides/api-guide.md](specs/guides/api-guide.md) - API layer conventions

**Guidelines:**
1. **Flat modules, no barrel files** - `CurrencyCode.ts` not `domain/currency/index.ts`
2. **Prefer Schema.Class over Schema.Struct** - classes give you constructor, Equal, Hash
3. **Use Schema's `.make()` constructor** - all schemas have it, never use `new`
4. **Use Schema.TaggedError** for all domain errors - type guards via `Schema.is()`
5. **Use branded types** for IDs (AccountId, CompanyId, etc.)
6. **Use BigDecimal** for all monetary calculations
7. **Use Layer.effect or Layer.scoped** - avoid Layer.succeed and Tag.of
8. **Write tests** alongside implementation using `@effect/vitest`
9. **ALWAYS use precise domain schemas** - if a field can be `AccountCategory` or `Schema.String`, ALWAYS use `AccountCategory`. Never lose type precision by using primitives when a richer domain type exists. This applies to all schemas - domain entities, API requests/responses, and intermediate data structures.

### Frontend (packages/web)

**NO Effect code** - use openapi-fetch client for API calls. Use loaders for SSR data fetching, useState for UI state.

**Read these specs:**
- [specs/guides/frontend-guide.md](specs/guides/frontend-guide.md) - React patterns, UI components, Tailwind, layout, navigation

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

1. **Read relevant files in `specs/`** - use focus mode to select specs for your task
2. **Implement specs fully** - each spec file defines work to be done
3. **Update specs as you work** - mark issues resolved, remove completed items
4. **Signal TASK_COMPLETE** when a task is done
5. **Signal NOTHING_LEFT_TO_DO** when all specs are fully implemented
