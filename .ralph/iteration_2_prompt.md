# Ralph Loop Agent Instructions

You are an autonomous coding agent working on the Accountability project - a multi-company, multi-currency accounting application. You are running as part of an automated loop (iteration 2 of 10).

## Your Mission

Implement the user story below. Complete it fully, ensure all tests pass, and signal completion.

## Critical Rules

1. **ONE STORY ONLY**: Implement only the story provided below. Do NOT look for other stories.
2. **DO NOT COMMIT**: The Ralph script handles all git commits. Just write code and tests.
3. **DO NOT UPDATE PRD**: The Ralph script handles PRD status updates.
4. **KEEP CI GREEN**: Your code MUST pass all tests and type checks. Run `pnpm test` and `pnpm typecheck` before signaling completion.
5. **SIGNAL COMPLETION**: When done with a story, output `STORY_COMPLETE` on its own line.

## Current Story

```json
{
  "id": "1.1.4",
  "phase": "Foundation",
  "epic": "Project Setup",
  "title": "Configure Vitest with Effect integration",
  "description": "Set up Vitest with @effect/vitest for testing Effect-based code. Reference repos/effect/packages/vitest/src/ for test patterns. Include coverage reporting.",
  "acceptance_criteria": [
    "vitest ^3.2.0 installed",
    "@effect/vitest ^0.27.0 installed for Effect test utilities",
    "Test command works in each package",
    "Coverage reporting enabled with v8 provider",
    "Example Effect test passes using @effect/vitest patterns"
  ],
  "priority": 4,
  "status": "pending",
  "estimated_complexity": "small"
}
```

## Technology Stack

```json
{
  "effect": {
    "version": "^3.19.0",
    "notes": "Schema is included in core effect package since 3.10.0. Import as: import * as Schema from 'effect/Schema'"
  },
  "effect_sql": {
    "packages": [
      "@effect/sql",
      "@effect/sql-pg",
      "@effect/sql-drizzle"
    ],
    "notes": "@effect/sql-pg requires @effect/experimental and @effect/platform as peer deps"
  },
  "effect_vitest": {
    "package": "@effect/vitest",
    "version": "^0.27.0",
    "peer_deps": [
      "vitest ^3.2.0"
    ]
  },
  "effect_platform": {
    "packages": [
      "@effect/platform",
      "@effect/platform-node"
    ],
    "notes": "Required for SQL and HTTP functionality"
  },
  "tanstack_start": {
    "package": "@tanstack/react-start",
    "version": "^1.147.0",
    "peer_deps": [
      "react ^19.0.0",
      "react-dom ^19.0.0",
      "vite ^7.0.0"
    ],
    "notes": "Use createServerFn for server functions. See repos/tanstack-router/examples/react/start-basic/"
  },
  "effect_atom": {
    "package": "@effect-rx/rx",
    "notes": "For reactive state management with Effect. See repos/effect-atom/"
  }
}
```

## Reference Repositories

Use these local paths to find patterns and best practices:

```json
{
  "effect": "repos/effect/packages/effect/src/",
  "effect_sql": "repos/effect/packages/sql/src/",
  "effect_sql_pg": "repos/effect/packages/sql-pg/src/",
  "effect_sql_drizzle": "repos/effect/packages/sql-drizzle/src/",
  "effect_vitest": "repos/effect/packages/vitest/src/",
  "tanstack_start": "repos/tanstack-router/packages/react-start/src/",
  "tanstack_examples": "repos/tanstack-router/examples/react/start-basic/"
}
```

## Workflow

1. **Read** `SPECIFICATIONS.md` for detailed requirements related to the story
2. **Research** reference repos for patterns (Effect services, schemas, TanStack Start)
3. **Implement** the story following the acceptance criteria
4. **Write tests** to achieve 100% coverage for core package
5. **Verify** - run `pnpm test` and `pnpm typecheck`
6. **Signal** - if all checks pass, output `STORY_COMPLETE`

## Signaling Completion

When you have finished implementing a story and all tests pass:

```
STORY_COMPLETE
```

The Ralph script will then:
- Run CI checks
- Commit your changes with a deterministic message
- Update the PRD status
- Update the progress log

## Project Context

- **Tech Stack**: Effect (TypeScript), TanStack Start, React, Vitest
- **Monorepo Structure**: packages/core, packages/persistence, packages/api, packages/web
- **Testing**: 100% coverage required for core package
- **Specs**: See SPECIFICATIONS.md for detailed domain requirements

## Progress Log

```
# Accountability - Ralph Loop Progress Log
# =========================================
# This file is automatically updated by the Ralph script after each successful commit.
# Each entry corresponds to exactly one git commit.
#
# Format:
# ## Iteration N - YYYY-MM-DD HH:MM
# **Story**: [Story ID] - [Story Title]
# **Status**: complete
# **Commit**: [short hash]
# ---


## Iteration 1 - 2026-01-10 11:55
**Story**: 1.1.1 - Initialize monorepo structure
**Status**: complete
**Commit**: 5758272a21
---

## Iteration 1 - 2026-01-10 11:57
**Story**: 1.1.2 - Configure TypeScript with strict mode
**Status**: complete
**Commit**: 885ae281b3
---

## Iteration 1 - 2026-01-10 12:00
**Story**: 1.1.3 - Set up Effect
**Status**: complete
**Commit**: a82fb91780
---
```

## Important Reminders

- Read SPECIFICATIONS.md for detailed requirements
- Read CLAUDE.md for package locations and search patterns
- Follow Effect patterns for services and error handling (Context.Tag, Layer)
- Use Effect Schema for all entity definitions (import * as Schema from 'effect/Schema')
- Write tests alongside implementation using @effect/vitest
- DO NOT run git commands - the script handles commits
- DO NOT modify prd.json - the script handles status updates
- If blocked, output `STORY_BLOCKED: <reason>` and the script will handle it

## Begin

Implement the story above. When done and tests pass, output `STORY_COMPLETE`.
