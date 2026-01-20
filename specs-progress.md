# Specs Reorganization Progress

This document tracks the reorganization of the `specs/` directory, including conflicts found, decisions made, and the new organization structure.

## Overview

**Total spec files analyzed:** 35
**Date started:** 2026-01-20
**Final cleanup:** 2026-01-20

## Current Status: COMPLETE

The specs-new/ directory has been fully reorganized with:
1. **Consistent naming** - all files use lowercase with hyphens
2. **No duplication** - files merged into guides/ have been removed from architecture/
3. **Clear purpose** - each directory has a distinct role

## Final Directory Structure

```
specs-new/
├── README.md
│
├── guides/                              # Consolidated how-to guides (PRIMARY REFERENCE)
│   ├── effect-guide.md                  # Effect patterns, layers, errors, SQL, testing
│   ├── testing-guide.md                 # Unit, integration, E2E testing
│   ├── frontend-guide.md                # React, UI, components, styling, design system
│   └── api-guide.md                     # HttpApi, endpoints, schemas, SSR
│
├── architecture/                        # System architecture documentation
│   ├── accounting-research.md           # Comprehensive domain spec (US GAAP)
│   ├── domain-model.md                  # Domain model quick reference
│   ├── authentication.md                # Auth system architecture
│   ├── authorization.md                 # RBAC/ABAC architecture
│   ├── error-design.md                  # Error handling architecture
│   └── fiscal-periods.md                # Fiscal period management
│
├── pending/                             # Features not yet implemented
│   ├── exchange-rate-sync.md            # ECB sync (15 phases)
│   ├── policy-ux-improvements.md        # Policy UX (5 phases)
│   ├── authorization-missing.md         # Remaining auth features
│   └── duplicated-company-creation-page.md  # UI cleanup task
│
├── completed/                           # Historical reference (all work done)
│   ├── audit-page.md
│   ├── company-details.md
│   ├── consolidated-reports.md
│   ├── consolidation-method-cleanup.md
│   ├── core-code-organisation.md
│   ├── e2e-test-coverage.md
│   ├── error-tracker.md
│   ├── fix-fiscal-periods.md
│   ├── form-components-standardization.md
│   ├── past-date-journal-entries.md
│   └── synthetic-data-generator.md
│
└── reference/
    └── reference-repos.md
```

## File Counts

| Directory | Files |
|-----------|-------|
| guides/ | 4 (consolidated how-to guides) |
| architecture/ | 6 |
| pending/ | 4 |
| completed/ | 11 |
| reference/ | 1 |
| README.md | 1 |
| **Total** | **27** |

---

## What Changed (2026-01-20 Cleanup)

### Naming Standardization

All files renamed from SCREAMING_SNAKE_CASE to lowercase-with-hyphens:
- `ACCOUNTING_RESEARCH.md` → `accounting-research.md`
- `AUTHENTICATION.md` → `authentication.md`
- etc.

### Duplicate Removal

The following files were **removed from architecture/** because their content is now consolidated in guides/:

| Removed File | Consolidated Into |
|-------------|-------------------|
| `UI_ARCHITECTURE.md` | `guides/frontend-guide.md` |
| `HTTP_API_TANSTACK.md` | `guides/api-guide.md` |
| `DESIGN_SYSTEM.md` | `guides/frontend-guide.md` |

### Directory Removed

The `best-practices/` directory was removed entirely - all content is in `guides/`.

---

## What's In Each Consolidated Guide

| Guide | Content Merged From |
|-------|-------------------|
| `effect-guide.md` | EFFECT_BEST_PRACTICES, EFFECT_LAYERS, EFFECT_SQL, EFFECT_TESTING |
| `testing-guide.md` | EFFECT_TESTING, E2E_TESTING, E2E_TEST_COVERAGE |
| `frontend-guide.md` | REACT_BEST_PRACTICES, UI_ARCHITECTURE, USABILITY_BEST_PRACTICES, DESIGN_SYSTEM, FORM_COMPONENTS_STANDARDIZATION |
| `api-guide.md` | API_BEST_PRACTICES, HTTP_API_TANSTACK |

---

## Migration Checklist

- [x] Read all 35 spec files
- [x] Identify conflicts
- [x] Document resolutions
- [x] Create new directory structure
- [x] Create README.md index
- [x] Move files to new locations
- [x] Create consolidated guides
- [x] Standardize file naming (lowercase with hyphens)
- [x] Remove duplicate files from architecture/
- [ ] Update CLAUDE.md to reference new structure (optional - depends on adoption decision)

---

## Recommended Next Steps

1. **Delete original specs/** directory - content has been reorganized into specs-new/
2. **Rename specs-new/ to specs/** - make the new structure the primary location
3. **Update CLAUDE.md** - reference the consolidated guides instead of individual specs

---

## Notes

### On Completed Specs
Completed specs are kept in `completed/` rather than deleted because:
1. They serve as historical documentation
2. They document architectural decisions made
3. They can be referenced if similar work is needed
4. They help new team members understand project history

### On Guides vs Architecture
- **Guides** are how-to documentation for developers working on the codebase
- **Architecture** is reference documentation about the system design

### Naming Convention
All files use lowercase with hyphens:
- `effect-guide.md` (not `EFFECT_GUIDE.md` or `effect_guide.md`)
- `accounting-research.md` (not `ACCOUNTING_RESEARCH.md`)

This convention was chosen for:
1. Consistency across all directories
2. URL-friendliness
3. Readability
