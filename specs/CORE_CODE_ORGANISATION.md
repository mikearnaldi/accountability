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
- [x] Reorganize /organization/ domain - DONE (re-exports created)
- [x] Reorganize /company/ domain - DONE (re-exports created)
- [x] Reorganize /accounting/ domain - DONE (re-exports created)
- [x] Reorganize /journal/ domain - DONE (re-exports created)
- [x] Reorganize /fiscal/ domain - DONE (re-exports created)
- [x] Reorganize /currency/ domain - DONE (re-exports created)
- [x] Reorganize /consolidation/ domain - DONE (re-exports created)
- [x] Reorganize /reporting/ domain - DONE (re-exports created)
- [x] Reorganize /audit/ domain - DONE (re-exports created)
- [x] Reorganize /jurisdiction/ domain - DONE (re-exports created)
- [x] Split and reorganize /auth/ → auth, authorization, membership - DONE (re-exports created)
- [x] Migrate all errors to domain-specific files - DONE (Phase 5)
- [x] Update all imports in persistence/api packages to use new domain paths - DONE (Phase 6)
- [x] Update package.json exports to include new domain paths - DONE (Phase 7)
- [ ] Delete old /Errors/ directory (keep for backward compatibility - currently provides re-exports)
- [ ] Delete old /Domains/ directory (keep for now - source files still here, re-exports point to them)
- [ ] Delete old /Services/ directory (keep for now - source files still here, re-exports point to them)
- [x] Run full test suite - DONE (3915 tests pass)
- [x] Update this spec to mark progress - DONE

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

### Phase 3 Completed (2026-01-19) - Domain Re-exports

**All Domain Re-exports Created:**
Created re-export files in each new domain directory pointing to the old locations:

- **organization/**: `Organization.ts`, `OrganizationErrors.ts`
- **company/**: `Company.ts`, `CompanyType.ts`, `CompanyErrors.ts`
- **jurisdiction/**: `Jurisdiction.ts`, `JurisdictionCode.ts`
- **fiscal/**: `FiscalYear.ts`, `FiscalPeriod.ts`, `FiscalPeriodStatus.ts`, `FiscalPeriodType.ts`, `FiscalYearStatus.ts`, `FiscalPeriodRef.ts`, `ComputedFiscalPeriod.ts`, `FiscalPeriodService.ts`, `FiscalPeriodErrors.ts`
- **currency/**: `CurrencyCode.ts`, `Currency.ts`, `ExchangeRate.ts`, `CurrencyService.ts`, `CurrencyTranslationService.ts`, `CurrencyErrors.ts`
- **accounting/**: `Account.ts`, `AccountNumber.ts`, `AccountHierarchy.ts`, `AccountTemplate.ts`, `AccountBalance.ts`, `AccountValidation.ts`, `BalanceValidation.ts`, `TrialBalanceService.ts`, `AccountErrors.ts`
- **journal/**: `JournalEntry.ts`, `JournalEntryLine.ts`, `EntryStatusWorkflow.ts`, `MultiCurrencyLineHandling.ts`, `JournalErrors.ts`
- **consolidation/**: `ConsolidationGroup.ts`, `ConsolidationRun.ts`, `EliminationRule.ts`, `IntercompanyTransaction.ts`, `ConsolidationMethodDetermination.ts`, `ConsolidationService.ts`, `EliminationService.ts`, `IntercompanyService.ts`, `NCIService.ts`, `ConsolidationErrors.ts`
- **reporting/**: `BalanceSheetService.ts`, `IncomeStatementService.ts`, `CashFlowStatementService.ts`, `EquityStatementService.ts`, `ConsolidatedReportService.ts`, `ReportErrors.ts`
- **audit/**: `AuditLog.ts`, `AuditLogService.ts`, `AuditLogErrors.ts`

**Next Steps (Phase 4):**
1. Split and reorganize Auth → auth, authorization, membership (separate domains per spec)
2. Migrate remaining errors to domain-specific files
3. Update imports across the codebase to use new paths
4. Delete old /Domains/, /Services/, /Errors/ directories
5. Run full test suite

**CI Status:** Typecheck passes.

### Phase 4 Completed (2026-01-19) - Auth Split into Three Domains

**Split Auth/ into authorization/ and membership/ domains:**

The old Auth/ directory contained files belonging to three separate domains. Re-export files were created for the two new domains:

**authorization/** (policy-based access control):
- `AuthorizationPolicy.ts`, `PolicyId.ts`, `PolicyEffect.ts`
- `Action.ts`, `BaseRole.ts`, `FunctionalRole.ts`
- `AuthorizationService.ts`, `PolicyEngine.ts`, `AuthorizationConfig.ts`
- `PermissionMatrix.ts`, `PolicyConditions.ts`
- `CurrentEnvironmentContext.ts`, `AuthorizationErrors.ts`
- `matchers/` subdirectory with `ActionMatcher.ts`, `EnvironmentMatcher.ts`, `ResourceMatcher.ts`, `SubjectMatcher.ts`

**membership/** (organization membership and invitations):
- `OrganizationMembership.ts`, `OrganizationMembershipId.ts`, `MembershipStatus.ts`
- `OrganizationInvitation.ts`, `InvitationId.ts`, `InvitationStatus.ts`
- `OrganizationMemberService.ts`, `InvitationService.ts`
- `CurrentOrganizationMembership.ts`, `MembershipErrors.ts`

**auth/** (authentication):
- Remains in the existing Auth/ directory (case-insensitive filesystem treats auth/ and Auth/ as the same)
- Files include: `AuthUser.ts`, `AuthUserId.ts`, `Session.ts`, `SessionId.ts`, `LocalCredentials.ts`, `AuthService.ts`, `AuthConfig.ts`, `AuthProvider.ts`, `AuthProviderType.ts`, `AuthRequest.ts`, `AuthResult.ts`, `CurrentUser.ts`, `Email.ts`, `PasswordHasher.ts`, `SessionTokenGenerator.ts`, `AuthErrors.ts`, etc.

**CI Status:** Typecheck passes.

### Phase 5 Completed (2026-01-19) - Error Migration to Domain Files

**Errors Migrated to Domain-Specific Files:**

All errors previously defined in `Errors/DomainErrors.ts` have been moved to their respective domain error files. The `DomainErrors.ts` file now re-exports from domain files for backward compatibility.

**Domain Error Files Updated:**

- **organization/OrganizationErrors.ts**: `OrganizationNotFoundError`, `InvalidOrganizationIdError`, `UserNotMemberOfOrganizationError`, `OrganizationHasCompaniesError`, `OrganizationNameAlreadyExistsError`, `OrganizationUpdateFailedError`, `MembershipCreationFailedError`, `SystemPolicySeedingFailedError`

- **company/CompanyErrors.ts**: `CompanyNotFoundError`, `InvalidCompanyIdError`, `OwnershipPercentageRequiredError`, `ParentCompanyNotFoundError`, `CircularCompanyReferenceError`, `CompanyNameAlreadyExistsError`, `HasActiveSubsidiariesError`

- **accounting/AccountErrors.ts**: `AccountNotFoundError`, `ParentAccountNotFoundError`, `AccountTemplateNotFoundError`, `ParentAccountDifferentCompanyError`, `HasActiveChildAccountsError`, `AccountNumberAlreadyExistsError`, `CircularAccountReferenceError`, `AccountsAlreadyExistError`

- **journal/JournalErrors.ts**: `JournalEntryNotFoundError`, `UnbalancedJournalEntryError`, `JournalEntryStatusError`, `JournalEntryAlreadyReversedError`

- **currency/CurrencyErrors.ts**: `ExchangeRateNotFoundError`, `SameCurrencyExchangeRateError`, `InvalidExchangeRateError`, `ExchangeRateAlreadyExistsError`

- **consolidation/ConsolidationErrors.ts**: All 19 consolidation-related errors including `ConsolidationGroupNotFoundError`, `ConsolidationRunNotFoundError`, `IntercompanyTransactionNotFoundError`, etc.

- **reporting/ReportErrors.ts**: `InvalidReportPeriodError`, `TrialBalanceNotBalancedError`, `BalanceSheetNotBalancedError`

- **membership/MembershipErrors.ts**: `MemberNotFoundError`, `InvitationNotFoundError`, `UserNotFoundByEmailError`, `InvalidInvitationIdError`, `InvitationNotPendingError` (plus re-exports from Auth/AuthorizationErrors.ts)

- **authorization/AuthorizationErrors.ts**: `PolicyNotFoundError`, `InvalidPolicyIdError`, `InvalidPolicyConditionError`, `PolicyPriorityValidationError`, `InvalidResourceTypeError`, `PolicyAlreadyExistsError`, `SystemPolicyCannotBeModifiedError` (plus re-exports from Auth/AuthorizationErrors.ts)

- **shared/errors/SharedErrors.ts**: `DataCorruptionError`, `OperationFailedError`

- **shared/errors/RepositoryError.ts**: `EntityNotFoundError`, `PersistenceError`

**Backward Compatibility:**

- `Errors/DomainErrors.ts` now re-exports all errors from domain files
- `Errors/RepositoryError.ts` now re-exports from `shared/errors/RepositoryError.ts`
- All existing imports continue to work unchanged

**CI Status:** All typecheck, lint, and 3915 tests pass.

### Phase 6 Completed (2026-01-19) - Import Path Migration

**Updated all imports in persistence/ and api/ packages to use new domain paths:**

The following import path changes were made across 87 source files:

**Domains/ → new domain paths:**
- `@accountability/core/Domains/Account` → `@accountability/core/accounting/Account`
- `@accountability/core/Domains/AccountNumber` → `@accountability/core/accounting/AccountNumber`
- `@accountability/core/Domains/Company` → `@accountability/core/company/Company`
- `@accountability/core/Domains/Organization` → `@accountability/core/organization/Organization`
- `@accountability/core/Domains/CurrencyCode` → `@accountability/core/currency/CurrencyCode`
- `@accountability/core/Domains/Currency` → `@accountability/core/currency/Currency`
- `@accountability/core/Domains/ExchangeRate` → `@accountability/core/currency/ExchangeRate`
- `@accountability/core/Domains/JournalEntry` → `@accountability/core/journal/JournalEntry`
- `@accountability/core/Domains/JournalEntryLine` → `@accountability/core/journal/JournalEntryLine`
- `@accountability/core/Domains/FiscalYear` → `@accountability/core/fiscal/FiscalYear`
- `@accountability/core/Domains/FiscalPeriod` → `@accountability/core/fiscal/FiscalPeriod`
- `@accountability/core/Domains/ConsolidationGroup` → `@accountability/core/consolidation/ConsolidationGroup`
- `@accountability/core/Domains/ConsolidationRun` → `@accountability/core/consolidation/ConsolidationRun`
- `@accountability/core/Domains/EliminationRule` → `@accountability/core/consolidation/EliminationRule`
- `@accountability/core/Domains/IntercompanyTransaction` → `@accountability/core/consolidation/IntercompanyTransaction`
- `@accountability/core/Domains/AuditLog` → `@accountability/core/audit/AuditLog`
- `@accountability/core/Domains/Jurisdiction` → `@accountability/core/jurisdiction/Jurisdiction`
- `@accountability/core/Domains/LocalDate` → `@accountability/core/shared/values/LocalDate`
- `@accountability/core/Domains/Timestamp` → `@accountability/core/shared/values/Timestamp`
- `@accountability/core/Domains/MonetaryAmount` → `@accountability/core/shared/values/MonetaryAmount`
- `@accountability/core/Domains/Percentage` → `@accountability/core/shared/values/Percentage`

**Services/ → new domain paths:**
- `@accountability/core/Services/TrialBalanceService` → `@accountability/core/accounting/TrialBalanceService`
- `@accountability/core/Services/BalanceSheetService` → `@accountability/core/reporting/BalanceSheetService`
- `@accountability/core/Services/IncomeStatementService` → `@accountability/core/reporting/IncomeStatementService`
- `@accountability/core/Services/CashFlowStatementService` → `@accountability/core/reporting/CashFlowStatementService`
- `@accountability/core/Services/EquityStatementService` → `@accountability/core/reporting/EquityStatementService`
- `@accountability/core/Services/ConsolidatedReportService` → `@accountability/core/reporting/ConsolidatedReportService`
- `@accountability/core/Services/ConsolidationService` → `@accountability/core/consolidation/ConsolidationService`

**AuditLog/ → new domain paths:**
- `@accountability/core/AuditLog/AuditLogService` → `@accountability/core/audit/AuditLogService`
- `@accountability/core/AuditLog/AuditLogErrors` → `@accountability/core/audit/AuditLogErrors`
- `@accountability/core/AuditLog/CurrentUserId` → `@accountability/core/shared/context/CurrentUserId`

**FiscalPeriod/ → new domain paths:**
- `@accountability/core/FiscalPeriod/FiscalPeriodService` → `@accountability/core/fiscal/FiscalPeriodService`
- `@accountability/core/FiscalPeriod/FiscalPeriodErrors` → `@accountability/core/fiscal/FiscalPeriodErrors`

**Re-export files updated:**
Enhanced several re-export files to include additional exports needed by consumers:
- `audit/AuditLogService.ts` - added `AuditLogServiceShape` type export
- `fiscal/FiscalPeriodService.ts` - added `FiscalPeriodServiceShape` type export
- `accounting/TrialBalanceService.ts` - added `generateTrialBalanceFromData`, `TrialBalanceReport`, `TrialBalanceLineItem`
- `reporting/BalanceSheetService.ts` - added `generateBalanceSheetFromData`, `BalanceSheetReport`, etc.
- `reporting/IncomeStatementService.ts` - added `generateIncomeStatementFromData`, etc.
- `reporting/CashFlowStatementService.ts` - added `generateCashFlowStatementFromData`, etc.
- `reporting/EquityStatementService.ts` - added `generateEquityStatementFromData`, etc.
- `reporting/ConsolidatedReportService.ts` - added `ConsolidatedReportServiceLive`, etc.
- `consolidation/ConsolidationService.ts` - added `ConsolidationDataCorruptionError`

**Backward compatibility preserved:**
- `Errors/DomainErrors.ts` continues to work for legacy imports
- Old directory paths (Domains/, Services/, etc.) still work through re-exports

**CI Status:** All typecheck, lint, and 3915 tests pass.

### Phase 7 Completed (2026-01-19) - Package.json Exports Updated

**Added all new domain paths to package.json exports:**

The core package's `package.json` exports field was updated to include all new domain-based paths alongside the legacy paths. This is required for Node.js module resolution to work correctly with the new import paths.

**New exports added:**
- `./organization/*` - Organization domain (Organization, OrganizationErrors)
- `./company/*` - Company domain (Company, CompanyType, CompanyErrors)
- `./accounting/*` - Accounting domain (Account, AccountNumber, AccountHierarchy, etc.)
- `./journal/*` - Journal domain (JournalEntry, JournalEntryLine, etc.)
- `./fiscal/*` - Fiscal domain (FiscalYear, FiscalPeriod, etc.)
- `./currency/*` - Currency domain (Currency, CurrencyCode, ExchangeRate, etc.)
- `./consolidation/*` - Consolidation domain (ConsolidationGroup, ConsolidationRun, etc.)
- `./reporting/*` - Reporting domain (BalanceSheetService, IncomeStatementService, etc.)
- `./audit/*` - Audit domain (AuditLog, AuditLogService, AuditLogErrors)
- `./jurisdiction/*` - Jurisdiction domain (Jurisdiction, JurisdictionCode)
- `./authorization/*` - Authorization domain (AuthorizationPolicy, PolicyEngine, matchers, etc.)
- `./membership/*` - Membership domain (OrganizationMembership, OrganizationInvitation, etc.)
- `./shared/values/*` - Shared values (LocalDate, Timestamp, MonetaryAmount, Percentage, Address)
- `./shared/context/*` - Shared context (CurrentUserId)
- `./shared/errors/*` - Shared errors (SharedErrors, RepositoryError)

**CI Status:** All typecheck, lint, build, and 3915 tests pass.

---

### Phase 8: Source File Migration (In Progress)

**Started: 2026-01-19**

Moving actual source files from old directories to new domain directories, converting old locations to re-exports for backward compatibility.

**Files migrated to canonical locations:**

| File | Old Location | New Location | Status |
|------|-------------|--------------|--------|
| LocalDate.ts | Domains/ | shared/values/ | ✅ Done |
| Timestamp.ts | Domains/ | shared/values/ | ✅ Done |
| MonetaryAmount.ts | Domains/ | shared/values/ | ✅ Done |
| Percentage.ts | Domains/ | shared/values/ | ✅ Done |
| Address.ts | Domains/ | shared/values/ | ✅ Done |
| CurrencyCode.ts | Domains/ | currency/ | ✅ Done |
| Organization.ts | Domains/ | organization/ | ✅ Done |
| Company.ts | Domains/ | company/ | ✅ Done |
| CompanyType.ts | Domains/ | company/ | ✅ Done |
| JurisdictionCode.ts | Domains/ | jurisdiction/ | ✅ Done |
| Currency.ts | Domains/ | currency/ | ✅ Done |
| ExchangeRate.ts | Domains/ | currency/ | ✅ Done |
| Jurisdiction.ts | Domains/ | jurisdiction/ | ✅ Done |
| FiscalYear.ts | Domains/ | fiscal/ | ✅ Done |
| FiscalPeriod.ts | Domains/ | fiscal/ | ✅ Done |
| FiscalPeriodRef.ts | Domains/ | fiscal/ | ✅ Done |
| FiscalPeriodStatus.ts | Domains/ | fiscal/ | ✅ Done |
| FiscalPeriodType.ts | Domains/ | fiscal/ | ✅ Done |
| FiscalYearStatus.ts | Domains/ | fiscal/ | ✅ Done |
| ComputedFiscalPeriod.ts | Domains/ | fiscal/ | ✅ Done |
| Account.ts | Domains/ | accounting/ | ✅ Done |
| AccountNumber.ts | Domains/ | accounting/ | ✅ Done |
| AccountHierarchy.ts | Domains/ | accounting/ | ✅ Done |
| AccountTemplate.ts | Domains/ | accounting/ | ✅ Done |
| AccountBalance.ts | Domains/ | accounting/ | ✅ Done |
| AccountValidation.ts | Domains/ | accounting/ | ✅ Done |
| BalanceValidation.ts | Domains/ | accounting/ | ✅ Done |

**Files still needing migration:**

1. **Domains/** (9 remaining files):
   - JournalEntry.ts, JournalEntryLine.ts, EntryStatusWorkflow.ts, MultiCurrencyLineHandling.ts → journal/
   - ConsolidationGroup.ts, ConsolidationRun.ts, EliminationRule.ts, IntercompanyTransaction.ts, ConsolidationMethodDetermination.ts → consolidation/
   - AuditLog.ts → audit/

2. **Services/** (13 files):
   - TrialBalanceService.ts → accounting/
   - JournalEntryService.ts → journal/
   - ConsolidationService.ts, EliminationService.ts, IntercompanyService.ts, NCIService.ts, CurrencyTranslationService.ts → consolidation/
   - CurrencyService.ts → currency/
   - BalanceSheetService.ts, IncomeStatementService.ts, CashFlowStatementService.ts, EquityStatementService.ts, ConsolidatedReportService.ts → reporting/

3. **AuditLog/** (3 files):
   - AuditLogService.ts, AuditLogErrors.ts → audit/
   - CurrentUserId.ts → shared/context/

4. **Auth/** (19 authentication files → new auth/ directory)

**CI Status:** All typecheck and 3915 tests pass.

---

### Remaining Work

The core package reorganization is **in progress**. Source files are being moved to their canonical domain locations.

**What's already working:**
- New import paths are fully functional via re-exports
- External packages (api, persistence, web) use new paths
- package.json exports include all new domain paths
- Error files have been migrated to domain-specific files

**What's being done:**
- Moving source files from old directories (Domains/, Services/) to new domain directories
- Converting old file locations to re-exports for backward compatibility
- Maintaining internal import consistency

**Final cleanup (after all files migrated):**
1. Update internal imports within moved files to use domain-relative paths
2. Delete empty old directories (Domains/, Services/, Errors/)
