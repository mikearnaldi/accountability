# Accountability Specifications

This directory contains all project specifications, organized by category.

## Directory Structure

```
specs-new/
├── architecture/       # System architecture documentation
├── best-practices/     # Coding guidelines and patterns
├── pending/            # Features not yet implemented
├── completed/          # Historical reference (all work done)
└── reference/          # External references
```

## Quick Links

### Architecture (Start Here for Understanding the System)

| Document | Description |
|----------|-------------|
| [ACCOUNTING_RESEARCH.md](architecture/ACCOUNTING_RESEARCH.md) | Comprehensive domain spec - US GAAP, entities, services, reports |
| [DOMAIN_MODEL.md](architecture/DOMAIN_MODEL.md) | Domain model quick reference |
| [UI_ARCHITECTURE.md](architecture/UI_ARCHITECTURE.md) | UI patterns, layouts, page templates |
| [DESIGN_SYSTEM.md](architecture/DESIGN_SYSTEM.md) | Colors, typography, spacing, components |
| [HTTP_API_TANSTACK.md](architecture/HTTP_API_TANSTACK.md) | Effect HttpApi + TanStack Start SSR |
| [AUTHENTICATION.md](architecture/AUTHENTICATION.md) | Multi-provider auth system |
| [AUTHORIZATION.md](architecture/AUTHORIZATION.md) | RBAC/ABAC policies and permissions |
| [ERROR_DESIGN.md](architecture/ERROR_DESIGN.md) | One-layer error architecture |
| [FISCAL_PERIODS.md](architecture/FISCAL_PERIODS.md) | Fiscal year/period management |

### Best Practices (Required Reading for Contributors)

| Document | Description |
|----------|-------------|
| [EFFECT_BEST_PRACTICES.md](best-practices/EFFECT_BEST_PRACTICES.md) | **Critical** - Effect-TS patterns and rules |
| [EFFECT_LAYERS.md](best-practices/EFFECT_LAYERS.md) | Layer composition, memoization, services |
| [EFFECT_SQL.md](best-practices/EFFECT_SQL.md) | SqlSchema, Model.Class, repositories |
| [EFFECT_TESTING.md](best-practices/EFFECT_TESTING.md) | @effect/vitest, testcontainers, property testing |
| [TYPESCRIPT_CONVENTIONS.md](best-practices/TYPESCRIPT_CONVENTIONS.md) | TypeScript project refs, imports, modules |
| [REACT_BEST_PRACTICES.md](best-practices/REACT_BEST_PRACTICES.md) | React patterns, loaders, mutations |
| [API_BEST_PRACTICES.md](best-practices/API_BEST_PRACTICES.md) | Effect HttpApi design patterns |
| [E2E_TESTING.md](best-practices/E2E_TESTING.md) | Playwright E2E testing patterns |
| [USABILITY_BEST_PRACTICES.md](best-practices/USABILITY_BEST_PRACTICES.md) | UX patterns, navigation, forms, states |

### Pending Implementation

| Document | Description | Complexity |
|----------|-------------|------------|
| [EXCHANGE_RATE_SYNC.md](pending/EXCHANGE_RATE_SYNC.md) | ECB exchange rate sync via Frankfurter API | 15 phases |
| [POLICY_UX_IMPROVEMENTS.md](pending/POLICY_UX_IMPROVEMENTS.md) | Multi-resource policy UI improvements | 5 phases |
| [AUTHORIZATION_MISSING.md](pending/AUTHORIZATION_MISSING.md) | Remaining authorization features | Partial |
| [DUPLICATED_COMPANY_CREATION_PAGE.md](pending/DUPLICATED_COMPANY_CREATION_PAGE.md) | Remove duplicate company creation UI | Small |

### Completed (Historical Reference)

These specs document completed work. Kept for historical context and reference.

| Document | Completed |
|----------|-----------|
| [AUDIT_PAGE.md](completed/AUDIT_PAGE.md) | All 3 phases |
| [COMPANY_DETAILS.md](completed/COMPANY_DETAILS.md) | All 6 phases |
| [CONSOLIDATED_REPORTS.md](completed/CONSOLIDATED_REPORTS.md) | 2026-01-16 |
| [CONSOLIDATION_METHOD_CLEANUP.md](completed/CONSOLIDATION_METHOD_CLEANUP.md) | 2026-01-15 |
| [CORE_CODE_ORGANISATION.md](completed/CORE_CODE_ORGANISATION.md) | 2026-01-19 |
| [E2E_TEST_COVERAGE.md](completed/E2E_TEST_COVERAGE.md) | 261 tests |
| [ERROR_TRACKER.md](completed/ERROR_TRACKER.md) | 17/17 issues |
| [FIX_FISCAL_PERIODS.md](completed/FIX_FISCAL_PERIODS.md) | All fixed |
| [FORM_COMPONENTS_STANDARDIZATION.md](completed/FORM_COMPONENTS_STANDARDIZATION.md) | All done |
| [PAST_DATE_JOURNAL_ENTRIES.md](completed/PAST_DATE_JOURNAL_ENTRIES.md) | Verified |
| [SYNTHETIC_DATA_GENERATOR.md](completed/SYNTHETIC_DATA_GENERATOR.md) | All 9 phases |

### Reference

| Document | Description |
|----------|-------------|
| [REFERENCE_REPOS.md](reference/REFERENCE_REPOS.md) | Reference repositories in repos/ directory |

## For New Contributors

1. Start with [ACCOUNTING_RESEARCH.md](architecture/ACCOUNTING_RESEARCH.md) for domain understanding
2. Read [EFFECT_BEST_PRACTICES.md](best-practices/EFFECT_BEST_PRACTICES.md) before writing backend code
3. Read [REACT_BEST_PRACTICES.md](best-practices/REACT_BEST_PRACTICES.md) before writing frontend code
4. Consult [UI_ARCHITECTURE.md](architecture/UI_ARCHITECTURE.md) for page structure patterns

## Maintenance

- **Best Practices** specs are living documents - update them as patterns evolve
- **Pending** specs should be moved to **Completed** when finished
- **Architecture** specs should be updated when the architecture changes
