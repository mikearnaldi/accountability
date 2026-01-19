# Core Package Code Organization

This spec proposes a reorganization of `packages/core/src` to improve maintainability, discoverability, and consistency.

## Current State Analysis

### Statistics
- **102 TypeScript files** in src/
- **~39,000 lines of code**
- **5 top-level directories**: AuditLog, Auth, Domains, Errors, FiscalPeriod, Services

### Current Structure
```
packages/core/src/
├── AuditLog/           (3 files - service, errors, context)
├── Auth/               (45 files - FLAT, mixed concerns)
│   └── matchers/       (4 files)
├── Domains/            (37 files - entities, values, validation, errors mixed)
├── Errors/             (2 files - centralized domain errors)
├── FiscalPeriod/       (2 files - service, errors)
└── Services/           (13 files - all large services)
```

### Problems Identified

#### 1. Error Placement Inconsistency (CRITICAL)
- **100+ errors** in centralized `/Errors/DomainErrors.ts`
- **56+ errors** embedded inline within Domain files
- **Separate error files** for Auth, FiscalPeriod, AuditLog
- No clear rule for where errors belong

#### 2. Auth Directory is a Flat Mess
- 45 files in single flat directory
- Services, entities, values, configs, utilities all mixed together
- Hard to find what you're looking for

#### 3. Domains is a Catch-All
- Large aggregates (AccountTemplate: 2,737 lines)
- Tiny value objects (CurrencyCode: ~50 lines)
- Validation logic with embedded errors
- Read models (interface-based, not Schema)
- No distinction between entities, values, aggregates

#### 4. Services Are Large Without Decomposition
- All 13 services are 700-1,900 lines
- Four similar report services with duplicated patterns
- No helper/utility layer for shared calculations
- No separation of orchestration from calculation

#### 5. No Utilities Directory
- PasswordHasher, SessionTokenGenerator scattered in Auth
- Common calculations embedded in services
- No place for shared domain utilities

#### 6. Inconsistent Feature Organization
- FiscalPeriod has its own directory AND files in Domains
- AuditLog has its own directory AND files in Domains
- Some features are directories, others are just files

---

## Proposed Organization

### Design Principles

1. **Co-locate by domain** - Keep related entities, errors, and services together
2. **Separate by type within domains** - Clear distinction between entities, values, services
3. **Errors live with their domain** - No central error dumping ground
4. **Flat where small, nested where large** - Don't over-organize small domains
5. **Explicit utility layer** - Shared calculations and helpers have a home

### New Structure

```
packages/core/src/
│
├── shared/                          # Cross-cutting utilities and types
│   ├── utils/
│   │   ├── BigDecimalUtils.ts       # Common BigDecimal operations
│   │   ├── DateUtils.ts             # Date calculation helpers
│   │   └── SchemaUtils.ts           # Schema helper functions
│   ├── values/                      # Reusable value objects (used across domains)
│   │   ├── LocalDate.ts
│   │   ├── Timestamp.ts
│   │   ├── MonetaryAmount.ts
│   │   ├── Percentage.ts
│   │   └── Address.ts
│   └── context/                     # Cross-cutting Effect contexts
│       └── CurrentUserId.ts
│
├── organization/                    # Organization domain
│   ├── Organization.ts              # Entity
│   ├── OrganizationId.ts            # Branded ID
│   └── OrganizationErrors.ts        # Domain errors
│
├── company/                         # Company domain
│   ├── Company.ts                   # Entity
│   ├── CompanyId.ts                 # Branded ID
│   ├── CompanyType.ts               # Value object
│   └── CompanyErrors.ts             # Domain errors
│
├── accounting/                      # Core accounting domain (LARGEST)
│   ├── entities/
│   │   ├── Account.ts               # Account entity + AccountId
│   │   ├── AccountHierarchy.ts      # Account tree structure
│   │   ├── AccountTemplate.ts       # Chart of accounts templates
│   │   └── AccountBalance.ts        # Read model
│   ├── values/
│   │   ├── AccountNumber.ts
│   │   ├── AccountType.ts
│   │   ├── AccountCategory.ts
│   │   ├── NormalBalance.ts
│   │   └── CashFlowCategory.ts
│   ├── validation/
│   │   ├── AccountValidation.ts     # Account validation rules
│   │   └── BalanceValidation.ts     # Balance validation
│   ├── services/
│   │   └── TrialBalanceService.ts
│   └── errors/
│       └── AccountErrors.ts         # All account-related errors
│
├── journal/                         # Journal entry domain
│   ├── entities/
│   │   ├── JournalEntry.ts          # JournalEntry + JournalEntryId
│   │   └── JournalEntryLine.ts      # Line items
│   ├── values/
│   │   ├── EntryNumber.ts
│   │   └── EntryStatus.ts
│   ├── workflow/
│   │   └── EntryStatusWorkflow.ts   # State machine
│   ├── services/
│   │   └── JournalEntryService.ts
│   └── errors/
│       └── JournalErrors.ts
│
├── fiscal/                          # Fiscal period domain
│   ├── entities/
│   │   ├── FiscalYear.ts
│   │   ├── FiscalPeriod.ts
│   │   └── ComputedFiscalPeriod.ts
│   ├── values/
│   │   ├── FiscalYearId.ts
│   │   ├── FiscalPeriodId.ts
│   │   ├── FiscalPeriodRef.ts
│   │   ├── FiscalPeriodStatus.ts
│   │   ├── FiscalPeriodType.ts
│   │   └── FiscalYearStatus.ts
│   ├── services/
│   │   └── FiscalPeriodService.ts
│   └── errors/
│       └── FiscalErrors.ts
│
├── currency/                        # Currency domain
│   ├── entities/
│   │   ├── Currency.ts
│   │   └── ExchangeRate.ts
│   ├── values/
│   │   ├── CurrencyCode.ts
│   │   └── JurisdictionCode.ts
│   ├── services/
│   │   ├── CurrencyService.ts
│   │   └── CurrencyTranslationService.ts
│   └── errors/
│       └── CurrencyErrors.ts
│
├── consolidation/                   # Group consolidation domain
│   ├── entities/
│   │   ├── ConsolidationGroup.ts
│   │   ├── ConsolidationRun.ts
│   │   ├── EliminationRule.ts
│   │   └── IntercompanyTransaction.ts
│   ├── values/
│   │   └── ConsolidationMethod.ts
│   ├── services/
│   │   ├── ConsolidationService.ts
│   │   ├── EliminationService.ts
│   │   ├── IntercompanyService.ts
│   │   └── NCIService.ts
│   ├── logic/
│   │   └── ConsolidationMethodDetermination.ts
│   └── errors/
│       └── ConsolidationErrors.ts
│
├── reporting/                       # Financial reporting domain
│   ├── services/
│   │   ├── BalanceSheetService.ts
│   │   ├── IncomeStatementService.ts
│   │   ├── CashFlowStatementService.ts
│   │   ├── EquityStatementService.ts
│   │   └── ConsolidatedReportService.ts
│   ├── utils/                       # Report calculation helpers
│   │   ├── ReportCalculations.ts    # Shared calculation logic
│   │   └── ReportFormatting.ts      # Formatting utilities
│   └── errors/
│       └── ReportErrors.ts
│
├── auth/                            # Authentication domain
│   ├── entities/
│   │   ├── AuthUser.ts
│   │   ├── Session.ts
│   │   └── LocalCredentials.ts
│   ├── values/
│   │   ├── AuthUserId.ts
│   │   ├── SessionId.ts
│   │   ├── Email.ts
│   │   ├── ProviderId.ts
│   │   └── AuthProviderType.ts
│   ├── services/
│   │   └── AuthService.ts
│   ├── config/
│   │   └── AuthConfig.ts
│   ├── utils/
│   │   ├── PasswordHasher.ts
│   │   └── SessionTokenGenerator.ts
│   ├── context/
│   │   ├── CurrentUser.ts
│   │   └── CurrentEnvironmentContext.ts
│   └── errors/
│       └── AuthErrors.ts
│
├── authorization/                   # Authorization domain (separate from auth)
│   ├── entities/
│   │   └── AuthorizationPolicy.ts
│   ├── values/
│   │   ├── PolicyId.ts
│   │   ├── PolicyEffect.ts
│   │   ├── Action.ts
│   │   ├── BaseRole.ts
│   │   └── FunctionalRole.ts
│   ├── services/
│   │   ├── AuthorizationService.ts
│   │   └── PolicyEngine.ts
│   ├── matchers/
│   │   ├── ActionMatcher.ts
│   │   ├── EnvironmentMatcher.ts
│   │   ├── ResourceMatcher.ts
│   │   └── SubjectMatcher.ts
│   ├── config/
│   │   ├── AuthorizationConfig.ts
│   │   └── PermissionMatrix.ts
│   └── errors/
│       └── AuthorizationErrors.ts
│
├── membership/                      # Organization membership domain
│   ├── entities/
│   │   ├── OrganizationMembership.ts
│   │   └── OrganizationInvitation.ts
│   ├── values/
│   │   ├── OrganizationMembershipId.ts
│   │   ├── InvitationId.ts
│   │   ├── InvitationStatus.ts
│   │   └── MembershipStatus.ts
│   ├── services/
│   │   ├── OrganizationMemberService.ts
│   │   └── InvitationService.ts
│   ├── context/
│   │   └── CurrentOrganizationMembership.ts
│   └── errors/
│       └── MembershipErrors.ts
│
├── audit/                           # Audit logging domain
│   ├── entities/
│   │   └── AuditLog.ts
│   ├── services/
│   │   └── AuditLogService.ts
│   └── errors/
│       └── AuditErrors.ts
│
└── jurisdiction/                    # Jurisdiction/tax domain
    ├── entities/
    │   └── Jurisdiction.ts
    ├── values/
    │   └── JurisdictionCode.ts
    └── errors/
        └── JurisdictionErrors.ts
```

---

## Domain Breakdown

### Small Domains (flat structure, no subdirectories)
For domains with <5 files, keep it flat:

```
├── organization/
│   ├── Organization.ts
│   ├── OrganizationId.ts
│   └── OrganizationErrors.ts
```

### Medium Domains (light structure)
For domains with 5-15 files, use minimal subdirectories:

```
├── journal/
│   ├── entities/
│   ├── values/
│   ├── services/
│   └── errors/
```

### Large Domains (full structure)
For domains with 15+ files or complex logic, use full structure:

```
├── accounting/
│   ├── entities/
│   ├── values/
│   ├── validation/
│   ├── services/
│   └── errors/
```

---

## Error Organization

### Rule: Errors Live With Their Domain

Each domain has its own `errors/` subdirectory (or `[Domain]Errors.ts` file for small domains):

```typescript
// accounting/errors/AccountErrors.ts
export class AccountNotFoundError extends Schema.TaggedError<AccountNotFoundError>()(
  "AccountNotFoundError",
  { accountId: AccountId }
) {}

export class DuplicateAccountNumberError extends Schema.TaggedError<DuplicateAccountNumberError>()(
  "DuplicateAccountNumberError",
  { accountNumber: AccountNumber, companyId: CompanyId }
) {}
```

### Migration from Current State

1. **Move errors from DomainErrors.ts** to their respective domain's error file
2. **Extract inline errors from domain files** to the domain's error file
3. **Delete the central /Errors directory** once migration is complete

### Error Naming Convention

```
[Entity][Problem]Error
```

Examples:
- `AccountNotFoundError`
- `JournalEntryInvalidStatusError`
- `FiscalPeriodClosedError`
- `InvitationAlreadyExistsError`

---

## Service Organization

### Services Stay With Their Domain

Services that operate on a single domain live in that domain's `services/` directory:

```
├── journal/
│   └── services/
│       └── JournalEntryService.ts   # CRUD + validation for journal entries
```

### Cross-Domain Services

Services that orchestrate multiple domains get their own domain directory:

```
├── consolidation/
│   └── services/
│       ├── ConsolidationService.ts  # Orchestrates consolidation process
│       ├── EliminationService.ts    # Generates elimination entries
│       └── IntercompanyService.ts   # Handles intercompany transactions
```

### Report Services

Financial reports are their own domain since they span multiple entities:

```
├── reporting/
│   └── services/
│       ├── BalanceSheetService.ts
│       ├── IncomeStatementService.ts
│       └── ...
```

---

## Shared Code

### /shared/values/ - Reusable Value Objects

Value objects used across multiple domains:

```
├── shared/
│   └── values/
│       ├── LocalDate.ts        # Used everywhere
│       ├── Timestamp.ts        # Used everywhere
│       ├── MonetaryAmount.ts   # Used in journal, reporting, consolidation
│       └── Percentage.ts       # Used in consolidation, NCI
```

### /shared/utils/ - Utility Functions

Pure utility functions with no domain dependencies:

```
├── shared/
│   └── utils/
│       ├── BigDecimalUtils.ts  # roundToCents, sumAmounts, etc.
│       ├── DateUtils.ts        # Period calculations, comparisons
│       └── SchemaUtils.ts      # Common schema patterns
```

### /shared/context/ - Cross-Cutting Contexts

Effect contexts used across domains:

```
├── shared/
│   └── context/
│       └── CurrentUserId.ts    # Used by audit, auth
```

---

## Import Paths

### Within a Domain

```typescript
// Inside journal/services/JournalEntryService.ts
import { JournalEntry } from "../entities/JournalEntry.js"
import { JournalEntryInvalidStatusError } from "../errors/JournalErrors.js"
```

### Cross-Domain

```typescript
// Inside consolidation/services/ConsolidationService.ts
import { JournalEntry } from "../../journal/entities/JournalEntry.js"
import { Account } from "../../accounting/entities/Account.js"
```

### Using Shared

```typescript
// Inside any domain
import { LocalDate } from "../../shared/values/LocalDate.js"
import { roundToCents } from "../../shared/utils/BigDecimalUtils.js"
```

---

## Migration Strategy

### Phase 1: Create Structure (Non-Breaking)
1. Create all new directories
2. Keep old files in place (dual structure temporarily)

### Phase 2: Move Shared Code
1. Move reusable value objects to `/shared/values/`
2. Move utilities to `/shared/utils/`
3. Update imports

### Phase 3: Reorganize Small Domains
1. Start with simple domains: organization, company, jurisdiction
2. Move files, update imports
3. Run tests after each domain

### Phase 4: Reorganize Auth (Large)
1. Split auth into auth/, authorization/, membership/
2. Move files to appropriate subdirectories
3. Update imports throughout codebase

### Phase 5: Consolidate Errors
1. Move errors from DomainErrors.ts to domain-specific files
2. Extract inline errors from domain files
3. Delete /Errors directory

### Phase 6: Reorganize Accounting & Reporting
1. Move accounting files to /accounting/ subdirectories
2. Move report services to /reporting/
3. Extract shared calculations to /reporting/utils/

### Phase 7: Cleanup
1. Remove any empty directories
2. Update any remaining imports
3. Run full test suite
4. Update documentation

---

## File Placement Decision Tree

```
Is this a reusable value object used by 3+ domains?
├── YES → /shared/values/
└── NO → Continue...

Is this a pure utility function with no domain dependencies?
├── YES → /shared/utils/
└── NO → Continue...

Is this an Effect context used across domains?
├── YES → /shared/context/
└── NO → Continue...

What domain does this belong to?
├── Account/Chart of Accounts → /accounting/
├── Journal Entries → /journal/
├── Fiscal Years/Periods → /fiscal/
├── Currency/Exchange Rates → /currency/
├── Consolidation/Elimination → /consolidation/
├── Financial Reports → /reporting/
├── User Authentication → /auth/
├── Authorization/Policies → /authorization/
├── Organization Membership → /membership/
├── Audit Logging → /audit/
└── Other → Create new domain or evaluate fit

Within the domain, what type is this?
├── Entity (Schema.Class with ID) → entities/
├── Value Object (branded type, literal, small schema) → values/
├── Service (Context.Tag, business logic) → services/
├── Error (Schema.TaggedError) → errors/
├── Validation Logic → validation/
├── State Machine/Workflow → workflow/
├── Configuration → config/
├── Effect Context (Tag for dependencies) → context/
├── Utility/Helper → utils/
└── Matcher/Strategy → matchers/ (or appropriate name)
```

---

## Benefits of New Organization

### 1. Discoverability
- Need to find account errors? Look in `/accounting/errors/`
- Need the journal entry service? Look in `/journal/services/`
- Clear mental model: domain → type → file

### 2. Ownership
- Each domain is self-contained
- Easy to understand scope of changes
- Clear boundaries for code reviews

### 3. Consistency
- Same structure pattern for all domains
- Errors always in `errors/`, services always in `services/`
- No more "where should this go?" decisions

### 4. Scalability
- New domains follow the same pattern
- Large domains have room to grow with subdirectories
- Small domains stay simple

### 5. Testing
- Test structure mirrors src structure
- `/test/accounting/` tests `/src/accounting/`
- Easy to find tests for any file

---

## Checklist for Completion

- [x] Create directory structure (Phase 1 - Non-Breaking) - DONE
- [x] Move /shared/ code (values, utils, context) - DONE (re-exports created)
- [ ] Reorganize /organization/ domain
- [ ] Reorganize /company/ domain
- [ ] Reorganize /accounting/ domain
- [ ] Reorganize /journal/ domain
- [ ] Reorganize /fiscal/ domain
- [ ] Reorganize /currency/ domain
- [ ] Reorganize /consolidation/ domain
- [ ] Reorganize /reporting/ domain
- [ ] Split and reorganize /auth/ → auth, authorization, membership
- [ ] Reorganize /audit/ domain
- [ ] Reorganize /jurisdiction/ domain
- [ ] Migrate all errors to domain-specific files
- [ ] Delete old /Errors/ directory
- [ ] Delete old /Domains/ directory
- [ ] Delete old /Services/ directory
- [ ] Update all imports
- [ ] Run full test suite
- [ ] Update this spec to mark complete

---

## Progress Notes

### Phase 1 & 2 Completed (2026-01-19)

**Directory Structure Created:**
- Created all new domain directories under `packages/core/src/`:
  - `shared/` with `values/`, `utils/`, `context/` subdirectories
  - `organization/`, `company/`, `accounting/`, `journal/`, `fiscal/`
  - `currency/`, `consolidation/`, `reporting/`, `audit/`, `jurisdiction/`
  - `auth/`, `authorization/`, `membership/` (split from old Auth)

**Shared Code Re-exports Created:**
The following re-export files were created in `shared/` to establish new import paths while maintaining backward compatibility:

- `shared/values/LocalDate.ts` → re-exports from `Domains/LocalDate.ts`
- `shared/values/Timestamp.ts` → re-exports from `Domains/Timestamp.ts`
- `shared/values/MonetaryAmount.ts` → re-exports from `Domains/MonetaryAmount.ts`
- `shared/values/Percentage.ts` → re-exports from `Domains/Percentage.ts`
- `shared/values/Address.ts` → re-exports from `Domains/Address.ts`
- `shared/context/CurrentUserId.ts` → re-exports from `AuditLog/CurrentUserId.ts`

**Migration Strategy:**
The reorganization uses a non-breaking approach:
1. New directories created with re-export files pointing to old locations
2. This allows code to start using new import paths immediately
3. Old files remain in place until all consumers are migrated
4. Final phase will move actual files and update remaining imports

**CI Status:** All typecheck, lint, and 3915 tests pass.
