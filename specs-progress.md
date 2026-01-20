# Specs Reorganization Progress

This document tracks the reorganization of the `specs/` directory, including conflicts found, decisions made, and the new organization structure.

## Overview

**Total spec files analyzed:** 35
**Date started:** 2026-01-20

## Spec File Analysis

### Category: COMPLETED/ARCHIVED (Can be archived or deleted)

These specs document work that is fully complete and no longer need to be active references:

| File | Status | Notes |
|------|--------|-------|
| `AUDIT_PAGE.md` | COMPLETE | All 3 phases done |
| `COMPANY_DETAILS.md` | COMPLETE | All 6 phases done |
| `CONSOLIDATED_REPORTS.md` | COMPLETE | All phases done (2026-01-16) |
| `CONSOLIDATION_METHOD_CLEANUP.md` | COMPLETE | Completed 2026-01-15 |
| `CORE_CODE_ORGANISATION.md` | COMPLETE | Reorganization finished (2026-01-19) |
| `E2E_TEST_COVERAGE.md` | COMPLETE | 261 tests, all coverage gaps resolved |
| `ERROR_TRACKER.md` | COMPLETE | All 17 issues fixed |
| `FIX_FISCAL_PERIODS.md` | COMPLETE | All issues fixed |
| `FORM_COMPONENTS_STANDARDIZATION.md` | COMPLETE | All components standardized |
| `PAST_DATE_JOURNAL_ENTRIES.md` | COMPLETE | No restrictions found |
| `RESEARCH_ERRORS.md` | COMPLETE | Points to ERROR_TRACKER.md |
| `DUPLICATED_COMPANY_CREATION_PAGE.md` | PENDING | Not yet implemented but clearly defined |
| `SYNTHETIC_DATA_GENERATOR.md` | COMPLETE | All 9 phases done |

### Category: ACTIVE BEST PRACTICES (Keep as active reference)

These are evergreen guides that should remain active:

| File | Purpose |
|------|---------|
| `EFFECT_BEST_PRACTICES.md` | Critical rules for backend Effect code |
| `EFFECT_LAYERS.md` | Layer composition, memoization, service patterns |
| `EFFECT_SQL.md` | SqlSchema, Model.Class, repository patterns |
| `EFFECT_TESTING.md` | @effect/vitest, testcontainers, property testing |
| `ERROR_DESIGN.md` | Three-layer error architecture |
| `TYPESCRIPT_CONVENTIONS.md` | Project refs, imports, module structure |
| `REACT_BEST_PRACTICES.md` | React patterns, loaders, mutations, Tailwind |
| `API_BEST_PRACTICES.md` | Effect HttpApi best practices |
| `USABILITY_BEST_PRACTICES.md` | UX patterns, navigation, forms, states |
| `E2E_TESTING.md` | Playwright E2E testing patterns |

### Category: ARCHITECTURE DOCUMENTATION (Keep as reference)

These document the system architecture:

| File | Purpose |
|------|---------|
| `DOMAIN_MODEL.md` | Complete domain model documentation |
| `ACCOUNTING_RESEARCH.md` | Domain specifications, US GAAP, comprehensive spec |
| `UI_ARCHITECTURE.md` | Layout, navigation, page templates, component patterns |
| `HTTP_API_TANSTACK.md` | Effect HttpApi + TanStack Start SSR + openapi-fetch |
| `AUTHENTICATION.md` | Multi-provider auth system, session management |
| `AUTHORIZATION.md` | Role-based access control and permissions |
| `DESIGN_SYSTEM.md` | Comprehensive UI design system (colors, typography, components) |
| `FISCAL_PERIODS.md` | Fiscal year/period management, mandatory period 13 |

### Category: PENDING IMPLEMENTATION (Work to be done)

These specs describe features not yet implemented:

| File | Status | Complexity |
|------|--------|------------|
| `EXCHANGE_RATE_SYNC.md` | NOT IMPLEMENTED | 15-phase implementation plan |
| `POLICY_UX_IMPROVEMENTS.md` | NOT IMPLEMENTED | 5 implementation phases |
| `AUTHORIZATION_MISSING.md` | PARTIALLY DONE | Most items implemented, a few remaining |

### Category: REFERENCE MATERIALS

| File | Purpose |
|------|---------|
| `REFERENCE_REPOS.md` | Documents reference repos in repos/ directory |

---

## Conflicts Found and Resolutions

### Conflict 1: DOMAIN_MODEL.md vs ACCOUNTING_RESEARCH.md

**Issue:** Both files document domain entities with overlapping content.

**Analysis:**
- `ACCOUNTING_RESEARCH.md` (1284 lines) - Comprehensive spec including regulatory framework (US GAAP), domain model, architecture, testing strategy, task breakdown
- `DOMAIN_MODEL.md` - Focused domain model documentation

**Resolution:** Keep both. They serve different purposes:
- `ACCOUNTING_RESEARCH.md` → Primary comprehensive specification (move to `architecture/`)
- `DOMAIN_MODEL.md` → Quick reference for domain entities (move to `architecture/`)

### Conflict 2: TYPESCRIPT_CONVENTIONS.md vs CORE_CODE_ORGANISATION.md

**Issue:** Both discuss code organization but CORE_CODE_ORGANISATION.md is more recent and detailed.

**Analysis:**
- `TYPESCRIPT_CONVENTIONS.md` - Covers TypeScript project refs, imports, module structure
- `CORE_CODE_ORGANISATION.md` - Detailed reorganization of packages/core/src (COMPLETE)

**Resolution:**
- `TYPESCRIPT_CONVENTIONS.md` → Keep in `best-practices/` (still relevant for general TS conventions)
- `CORE_CODE_ORGANISATION.md` → Archive to `completed/` (work is done, serves as historical reference)

### Conflict 3: FIX_FISCAL_PERIODS.md vs FISCAL_PERIODS.md

**Issue:** Two files about fiscal periods.

**Analysis:**
- `FISCAL_PERIODS.md` - Architecture documentation for fiscal period management
- `FIX_FISCAL_PERIODS.md` - Bug fixes (ALL COMPLETE)

**Resolution:**
- `FISCAL_PERIODS.md` → Keep in `architecture/` (ongoing reference)
- `FIX_FISCAL_PERIODS.md` → Archive to `completed/`

### Conflict 4: AUTHORIZATION.md vs AUTHORIZATION_MISSING.md

**Issue:** Two authorization-related specs.

**Analysis:**
- `AUTHORIZATION.md` - Complete RBAC/ABAC documentation
- `AUTHORIZATION_MISSING.md` - Tracking missing features (most implemented)

**Resolution:**
- `AUTHORIZATION.md` → Keep in `architecture/`
- `AUTHORIZATION_MISSING.md` → Keep in `pending/` (has remaining items)

### Conflict 5: ERROR_DESIGN.md vs ERROR_TRACKER.md vs RESEARCH_ERRORS.md

**Issue:** Three error-related specs.

**Analysis:**
- `ERROR_DESIGN.md` - Error architecture documentation (one-layer design)
- `ERROR_TRACKER.md` - Tracking 17 error issues (ALL FIXED)
- `RESEARCH_ERRORS.md` - Just points to ERROR_TRACKER.md (COMPLETE)

**Resolution:**
- `ERROR_DESIGN.md` → Keep in `architecture/`
- `ERROR_TRACKER.md` → Archive to `completed/`
- `RESEARCH_ERRORS.md` → Delete (redundant, just a pointer)

---

## New Directory Structure

```
specs-new/
├── README.md                           # Index of all specs
│
├── architecture/                       # System architecture documentation
│   ├── ACCOUNTING_RESEARCH.md          # Comprehensive domain spec (US GAAP)
│   ├── DOMAIN_MODEL.md                 # Domain model quick reference
│   ├── UI_ARCHITECTURE.md              # UI patterns and components
│   ├── HTTP_API_TANSTACK.md            # API + TanStack integration
│   ├── AUTHENTICATION.md               # Auth system architecture
│   ├── AUTHORIZATION.md                # RBAC/ABAC architecture
│   ├── ERROR_DESIGN.md                 # Error handling architecture
│   ├── FISCAL_PERIODS.md               # Fiscal period management
│   └── DESIGN_SYSTEM.md                # UI design system
│
├── best-practices/                     # Coding guidelines and patterns
│   ├── EFFECT_BEST_PRACTICES.md        # Effect-TS patterns
│   ├── EFFECT_LAYERS.md                # Layer composition
│   ├── EFFECT_SQL.md                   # SQL patterns
│   ├── EFFECT_TESTING.md               # Testing patterns
│   ├── TYPESCRIPT_CONVENTIONS.md       # TS project conventions
│   ├── REACT_BEST_PRACTICES.md         # React patterns
│   ├── API_BEST_PRACTICES.md           # API design patterns
│   ├── E2E_TESTING.md                  # E2E test patterns
│   └── USABILITY_BEST_PRACTICES.md     # UX patterns
│
├── pending/                            # Features not yet implemented
│   ├── EXCHANGE_RATE_SYNC.md           # ECB sync (15 phases)
│   ├── POLICY_UX_IMPROVEMENTS.md       # Policy UX (5 phases)
│   ├── AUTHORIZATION_MISSING.md        # Remaining auth features
│   └── DUPLICATED_COMPANY_CREATION_PAGE.md  # UI cleanup task
│
├── completed/                          # Historical reference (all done)
│   ├── AUDIT_PAGE.md
│   ├── COMPANY_DETAILS.md
│   ├── CONSOLIDATED_REPORTS.md
│   ├── CONSOLIDATION_METHOD_CLEANUP.md
│   ├── CORE_CODE_ORGANISATION.md
│   ├── E2E_TEST_COVERAGE.md
│   ├── ERROR_TRACKER.md
│   ├── FIX_FISCAL_PERIODS.md
│   ├── FORM_COMPONENTS_STANDARDIZATION.md
│   ├── PAST_DATE_JOURNAL_ENTRIES.md
│   └── SYNTHETIC_DATA_GENERATOR.md
│
└── reference/                          # External references
    └── REFERENCE_REPOS.md
```

---

## Files to Delete

| File | Reason |
|------|--------|
| `RESEARCH_ERRORS.md` | Redundant - just points to ERROR_TRACKER.md |

---

## Migration Checklist

- [x] Read all 35 spec files
- [x] Identify conflicts
- [x] Document resolutions
- [x] Create new directory structure
- [x] Create README.md index
- [x] Move files to new locations (34 files organized)
- [x] Delete redundant files (RESEARCH_ERRORS.md intentionally not copied - was just a pointer)
- [ ] Update CLAUDE.md to reference new structure (optional - depends on adoption decision)

## Final Counts

| Directory | Files |
|-----------|-------|
| architecture/ | 9 |
| best-practices/ | 9 |
| pending/ | 4 |
| completed/ | 11 |
| reference/ | 1 |
| README.md | 1 |
| **Total** | **35** (34 specs + 1 README)

## Migration Status: ✅ COMPLETE

The specs-new/ directory is now fully organized and ready for use. The original specs/ directory remains untouched so both can be compared before final adoption.

---

## Notes

### On Completed Specs
Completed specs are kept in `completed/` rather than deleted because:
1. They serve as historical documentation
2. They document architectural decisions made
3. They can be referenced if similar work is needed
4. They help new team members understand project history

### On the Architecture Category
The architecture specs are the most important long-term references. These document:
- Domain model and business rules (ACCOUNTING_RESEARCH.md, DOMAIN_MODEL.md)
- Technical architecture (HTTP_API_TANSTACK.md, ERROR_DESIGN.md)
- Security model (AUTHENTICATION.md, AUTHORIZATION.md)
- UI patterns (UI_ARCHITECTURE.md, DESIGN_SYSTEM.md)

### On Best Practices
Best practices specs are evergreen guides that should be updated as patterns evolve. They don't become "complete" - they're living documents.
