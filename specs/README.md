# Accountability Specifications

This directory contains all project specifications, organized by category.

## Directory Structure

```
specs-new/
├── guides/             # Consolidated how-to guides (START HERE)
├── architecture/       # System architecture documentation
├── pending/            # Features not yet implemented
├── completed/          # Historical reference (all work done)
└── reference/          # External references
```

## Naming Convention

All files use lowercase with hyphens (e.g., `effect-guide.md`, `accounting-research.md`).

## Quick Links

### Consolidated Guides (Recommended Starting Point)

These guides consolidate related best practices into comprehensive documents:

| Guide | Description |
|-------|-------------|
| [effect-guide.md](guides/effect-guide.md) | Effect patterns, layers, errors, SQL, testing |
| [testing-guide.md](guides/testing-guide.md) | Unit, integration, E2E testing |
| [frontend-guide.md](guides/frontend-guide.md) | React, UI, components, styling, design system |
| [api-guide.md](guides/api-guide.md) | HttpApi, endpoints, schemas, SSR |

### Architecture (Reference Documentation)

| Document | Description |
|----------|-------------|
| [accounting-research.md](architecture/accounting-research.md) | Comprehensive domain spec - US GAAP, regulatory framework, entities, services, reports, consolidation engine |
| [authentication.md](architecture/authentication.md) | Multi-provider auth system |
| [authorization.md](architecture/authorization.md) | RBAC/ABAC policies and permissions |
| [error-design.md](architecture/error-design.md) | One-layer error architecture |
| [fiscal-periods.md](architecture/fiscal-periods.md) | Fiscal year/period management |

**Note:** `accounting-research.md` is the comprehensive domain reference document covering all entities, relationships, and business rules.

### Pending Implementation

| Document | Description | Complexity |
|----------|-------------|------------|
| [exchange-rate-sync.md](pending/exchange-rate-sync.md) | ECB exchange rate sync via Frankfurter API | 15 phases |
| [policy-ux-improvements.md](pending/policy-ux-improvements.md) | Multi-resource policy UI improvements | 5 phases |
| [duplicated-company-creation-page.md](pending/duplicated-company-creation-page.md) | Remove duplicate company creation UI | Small |

### Completed (Historical Reference)

These specs document completed work. Kept for historical context and reference.

| Document | Completed |
|----------|-----------|
| [audit-page.md](completed/audit-page.md) | All 3 phases |
| [authorization-missing.md](completed/authorization-missing.md) | All features implemented |
| [company-details.md](completed/company-details.md) | All 6 phases |
| [consolidated-reports.md](completed/consolidated-reports.md) | 2026-01-16 |
| [consolidation-method-cleanup.md](completed/consolidation-method-cleanup.md) | 2026-01-15 |
| [core-code-organisation.md](completed/core-code-organisation.md) | 2026-01-19 |
| [e2e-test-coverage.md](completed/e2e-test-coverage.md) | 261 tests |
| [error-tracker.md](completed/error-tracker.md) | 17/17 issues |
| [form-components-standardization.md](completed/form-components-standardization.md) | All done |
| [past-date-journal-entries.md](completed/past-date-journal-entries.md) | Verified |
| [synthetic-data-generator.md](completed/synthetic-data-generator.md) | All 9 phases |

**Note:** `consolidated-reports.md` documents consolidated financial statements generation, while `consolidation-method-cleanup.md` documents a domain model refactoring. Despite similar names, these are distinct features.

### Reference

| Document | Description |
|----------|-------------|
| [reference-repos.md](reference/reference-repos.md) | Reference repositories in repos/ directory |

## For New Contributors

1. Start with [accounting-research.md](architecture/accounting-research.md) for domain understanding
2. Read [effect-guide.md](guides/effect-guide.md) before writing backend code
3. Read [frontend-guide.md](guides/frontend-guide.md) before writing frontend code
4. Read [api-guide.md](guides/api-guide.md) for API development
5. Read [testing-guide.md](guides/testing-guide.md) before writing tests

## What's In Each Section

### guides/
**Consolidated how-to documentation.** These are your primary reference when working on the codebase. They combine content from multiple original spec files into cohesive, topical guides.

### architecture/
**System design documentation.** Reference these to understand the domain model, authentication/authorization model, and error handling patterns.

### pending/
**Features not yet implemented.** Each file describes work that needs to be done with implementation phases.

### completed/
**Historical reference.** Completed implementation specs kept for context about how features were built.

### reference/
**External references.** Documentation about reference repositories used in the project.

## Maintenance

- **Guides** are living documents - update them as patterns evolve
- **Pending** specs should be moved to **Completed** when finished
- **Architecture** specs should be updated when the architecture changes
