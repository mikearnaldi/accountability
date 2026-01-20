# Error Design

This document describes the error handling strategy for the Accountability codebase.

## Overview

### Target Architecture (One Layer)

**Goal:** Domain errors with HTTP annotations, used everywhere. Errors flow through without transformation.

```
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN ERRORS                          │
│  Schema.TaggedError + HttpApiSchema.annotations             │
│  Used in repositories, services, and API handlers           │
│  Flow directly to HTTP responses                            │
└─────────────────────────────────────────────────────────────┘
```

### Current Architecture (One Layer) ✅ COMPLETE

**The codebase now has ONE error layer matching the target architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN ERRORS                          │
│  Schema.TaggedError + HttpApiSchema.annotations             │
│  Used in repositories, services, and API handlers           │
│  Flow directly to HTTP responses                            │
│                                                             │
│  ~133 domain errors in packages/core/src/Errors/            │
│  Auth, FiscalPeriod, JournalEntry, Currency, etc.           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  API-LAYER ERRORS (kept for distinct purposes)              │
│  UnauthorizedError (401) - Authentication                   │
│  ForbiddenError (403) - Authorization                       │
│  InternalServerError (500) - Catch-all                      │
│  AuditLogError (500) - Audit logging failures               │
│  UserLookupError (500) - User lookup failures               │
└─────────────────────────────────────────────────────────────┘
```

**Current state:**
- ✅ All 133+ domain errors have `HttpApiSchema.annotations`
- ✅ Generic API errors (NotFoundError, ValidationError, etc.) removed
- ✅ All API handlers use domain-specific errors directly
- ✅ No error mapping in handlers - errors flow through

## Key Principles

1. **One error layer** - domain errors with HTTP annotations, used everywhere
2. **Errors flow through** - no mapping unless business logic requires it
3. **No manual logging** - telemetry will handle error logging automatically
4. **Never swallow errors** - propagate or fail, never silently catch

---

## Domain Errors

**Location:** `packages/core/src/*/` (organized by domain module)

Every error MUST:

1. **Extend `Schema.TaggedError`** - provides `_tag` discriminator
2. **Include HTTP annotation** - `HttpApiSchema.annotations({ status: ### })`
3. **Include a `message` getter** - human-readable description
4. **Export a type guard** - `export const isMyError = Schema.is(MyError)`

```typescript
import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

export class MembershipNotFoundError extends Schema.TaggedError<MembershipNotFoundError>()(
  "MembershipNotFoundError",
  {
    userId: AuthUserId,
    organizationId: OrganizationId
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Membership not found for user ${this.userId} in org ${this.organizationId}`
  }
}

export const isMembershipNotFoundError = Schema.is(MembershipNotFoundError)
```

### Naming Convention

**Pattern:** `{Domain}{Failure}Error`

- `MembershipNotFoundError`
- `InvalidCredentialsError`
- `FiscalYearAlreadyExistsError`

---

## Usage

### Repositories Return Domain Errors Directly

```typescript
// In repository
const findByUserAndOrg = (userId: AuthUserId, orgId: OrganizationId) =>
  sql`SELECT * FROM memberships WHERE user_id = ${userId} AND org_id = ${orgId}`.pipe(
    Effect.flatMap((rows) =>
      rows.length === 0
        ? Effect.fail(new MembershipNotFoundError({ userId, organizationId: orgId }))
        : Effect.succeed(rows[0])
    )
  )
```

### Errors Flow Through

```typescript
// In API handler - errors flow through automatically
.handle("getMember", ({ path }) =>
  memberService.getMembership(path.orgId, path.userId)
  // MembershipNotFoundError (404) flows directly to HTTP response
)
```

### Map Only When Business Logic Requires

```typescript
// Login - security requires hiding whether user exists
.handle("login", ({ payload }) =>
  authService.login(payload).pipe(
    Effect.mapError((error) => {
      if (isUserNotFoundError(error)) {
        return new InvalidCredentialsError({ email: payload.email })
      }
      return error
    })
  )
)
```

### Use `orDie` for Impossible States

```typescript
// User must exist if we have a membership pointing to them
const user = yield* userRepository.findById(membership.userId).pipe(
  Effect.flatMap(Option.match({
    onNone: () => Effect.die(new Error(`Data corruption: user ${membership.userId} not found`)),
    onSome: Effect.succeed
  }))
)
```

---

## HTTP Status Code Guidelines

| Status | When to Use |
|--------|-------------|
| 400 | Invalid input, validation failures |
| 401 | Authentication required or failed |
| 403 | Authenticated but lacks permission |
| 404 | Resource not found |
| 409 | Conflict with existing state (duplicates) |
| 422 | Business rule violation |
| 500 | Unexpected errors |

---

## Anti-Patterns

### Excessive Mapping

**Wrong:**
```typescript
yield* memberService.getMembership(orgId, userId).pipe(
  Effect.mapError((error) => {
    if (error._tag === "MembershipNotFoundError") {
      return new NotFoundError({ resource: "Membership", id: userId })
    }
    // ...more cases
  })
)
```

**Right:**
```typescript
yield* memberService.getMembership(orgId, userId)
// Error flows through directly
```

### Manual Logging

**Wrong:**
```typescript
Effect.tapError((error) => Effect.logError("Something failed", error))
```

**Right:**
```typescript
// Don't log - telemetry handles this
```

### Swallowing Errors

**Wrong:**
```typescript
Effect.catchAll(() => Effect.succeed(undefined))
```

**Right:**
```typescript
// Let errors propagate
```

### Catching Defects

**Wrong:**
```typescript
Effect.catchAllCause((cause) => ...)
```

**Right:**
```typescript
Effect.catchAll((error) => ...)  // Only catches expected errors
```

---

## Current Generic Error Patterns (To Be Refactored)

This section documents the actual patterns found in API handlers that use generic errors instead of domain errors. These represent the work needed for Phase 2.

### Pattern 1: Resource Lookup with Generic NotFoundError

**Current (anti-pattern):**
```typescript
// In AccountsApiLive.ts
const maybeAccount = yield* accountRepository.findById(companyId, accountId).pipe(Effect.orDie)
if (Option.isNone(maybeAccount)) {
  return yield* Effect.fail(new NotFoundError({ resource: "Account", id: accountId }))
}
```

**Target (domain error):**
```typescript
// With domain error - flow through directly
const account = yield* accountRepository.getById(companyId, accountId)
// AccountNotFoundError flows directly to HTTP 404
```

### Pattern 2: Explicit Mapping from Domain to Generic

**Current (anti-pattern):**
```typescript
// In FiscalPeriodApiLive.ts
Effect.mapError((e) => {
  if (isFiscalYearNotFoundError(e)) {
    return new NotFoundError({ resource: "FiscalYear", id: path.fiscalYearId })
  }
  if (isFiscalYearOverlapError(e)) {
    return new ValidationError({
      message: e.message,
      field: Option.some("year"),
      details: Option.none()
    })
  }
  return new BusinessRuleError({ message: e.message, code: Option.some(e._tag) })
})
```

**Target (no mapping):**
```typescript
// Domain errors flow through directly
periodService.getFiscalYear(companyId, fiscalYearId)
// FiscalYearNotFoundError → HTTP 404
// FiscalYearOverlapError → HTTP 400
// All errors carry full domain context
```

### Pattern 3: Validation Before Service Calls

**Current (anti-pattern):**
```typescript
// In MembershipApiLive.ts
const orgId = yield* Schema.decodeUnknown(OrganizationId)(path.orgId).pipe(
  Effect.mapError(() => new ValidationError({
    message: "Invalid organization ID format",
    field: Option.some("orgId"),
    details: Option.none()
  }))
)
```

**Target (schema validation flows through):**
```typescript
// Schema decode errors should use domain validation errors
// or the API layer should accept validated types only
```

### Pattern 4: Catch-All BusinessRuleError

**Current (anti-pattern):**
```typescript
// In multiple handlers
Effect.mapError((error) =>
  new BusinessRuleError({ message: error.message, code: Option.some(error._tag) })
)
```

**Target (let domain errors flow):**
```typescript
// Domain errors already have HTTP status annotations
// No catch-all mapping needed
```

### Generic Error Usage by File

| File | NotFound | Validation | Business | Conflict |
|------|----------|------------|----------|----------|
| AccountsApiLive.ts | 15 | 5 | 10 | 2 |
| JournalEntriesApiLive.ts | 12 | 8 | 15 | 3 |
| FiscalPeriodApiLive.ts | 8 | 4 | 6 | 0 |
| CompaniesApiLive.ts | 10 | 3 | 5 | 1 |
| MembershipApiLive.ts | 5 | 4 | 8 | 0 |
| ConsolidationApiLive.ts | 8 | 3 | 10 | 2 |
| CurrencyApiLive.ts | 6 | 4 | 5 | 1 |
| ReportsApiLive.ts | 5 | 4 | 8 | 0 |
| InvitationApiLive.ts | 4 | 3 | 5 | 0 |
| AuthApiLive.ts | 3 | 5 | 5 | 0 |
| PolicyApiLive.ts | 4 | 2 | 3 | 0 |
| OrganizationsApiLive.ts | 5 | 2 | 5 | 0 |
| AuditLogApiLive.ts | 2 | 1 | 2 | 0 |
| + 5 more files | ~10 | ~5 | ~10 | ~0 |
| **Total** | **~97** | **~53** | **~97** | **~9** |

**Total: ~256 generic error instantiations to replace**

---

## Adding New Errors

1. Create in `packages/core/src/{Domain}/{Domain}Errors.ts`
2. Include `HttpApiSchema.annotations({ status: ### })`
3. Export type guard
4. Use directly in repositories/services

---

## Complete Error Catalog

This section catalogs all error definitions and their required HTTP status codes.

### Auth Errors (`packages/core/src/Auth/AuthErrors.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `InvalidCredentialsError` | 401 | Wrong username/password |
| `SessionExpiredError` | 401 | Session has expired |
| `SessionNotFoundError` | 401 | Invalid session token |
| `ProviderAuthFailedError` | 401 | External provider auth failed |
| `UserNotFoundError` | 404 | User does not exist |
| `ProviderNotEnabledError` | 404 | Auth provider not configured |
| `UserAlreadyExistsError` | 409 | Duplicate registration |
| `IdentityAlreadyLinkedError` | 409 | Provider identity already linked |
| `PasswordTooWeakError` | 400 | Password validation failed |
| `OAuthStateError` | 400 | OAuth state mismatch |
| `SessionCleanupError` | 500 | Failed to delete session |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

### Authorization Errors (`packages/core/src/Auth/AuthorizationErrors.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `PermissionDeniedError` | 403 | User lacks required permission |
| `MembershipNotActiveError` | 403 | Membership is suspended/removed |
| `MembershipNotFoundError` | 404 | User is not a member |
| `InvalidInvitationError` | 400 | Invitation is invalid |
| `InvitationExpiredError` | 400 | Invitation has been revoked |
| `OwnerCannotBeRemovedError` | 409 | Cannot remove organization owner |
| `OwnerCannotBeSuspendedError` | 409 | Cannot suspend organization owner |
| `MemberNotSuspendedError` | 409 | Cannot unsuspend non-suspended member |
| `CannotTransferToNonAdminError` | 409 | Cannot transfer ownership to non-admin |
| `InvitationAlreadyExistsError` | 409 | Pending invitation exists |
| `UserAlreadyMemberError` | 409 | User is already a member |
| `PolicyLoadError` | 500 | Failed to load policies |
| `AuthorizationAuditError` | 500 | Failed to log audit entry |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

### Fiscal Period Errors (`packages/core/src/FiscalPeriod/FiscalPeriodErrors.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `FiscalYearNotFoundError` | 404 | Fiscal year does not exist |
| `FiscalPeriodNotFoundError` | 404 | Fiscal period does not exist |
| `FiscalPeriodNotFoundForDateError` | 400 | No period for given date |
| `InvalidStatusTransitionError` | 400 | Invalid period status transition |
| `InvalidYearStatusTransitionError` | 400 | Invalid year status transition |
| `FiscalYearOverlapError` | 400 | Year dates overlap |
| `FiscalYearAlreadyExistsError` | 409 | Fiscal year already exists |
| `PeriodsNotClosedError` | 409 | Periods not all closed |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

**Removed unused errors:** `PeriodNotOpenError`, `PeriodProtectedError`, `YearNotClosedError` (defined but never instantiated)

### Audit Log Errors (`packages/core/src/AuditLog/AuditLogErrors.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `AuditLogError` | 500 | Audit logging failed |
| `UserLookupError` | 500 | User lookup failed |
| `AuditDataCorruptionError` | 500 | Audit data corrupted |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

### Journal Entry Errors (`packages/core/src/Services/JournalEntryService.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `AccountNotFoundError` | 404 | Account not found |
| `AccountNotPostableError` | 422 | Account is not postable |
| `AccountNotActiveError` | 422 | Account is not active |
| `EmptyJournalEntryError` | 400 | Entry has no lines |
| `DuplicateLineNumberError` | 400 | Duplicate line number |
| `NotApprovedError` | 422 | Entry not approved for posting |
| `EntryNotPostedError` | 422 | Entry must be posted to reverse |
| `EntryAlreadyReversedError` | 409 | Entry already reversed |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

**Removed unused errors:** `PeriodNotOpenError`, `PeriodNotFoundError`, `PeriodClosedError` (defined but never instantiated)

### Currency Errors (`packages/core/src/Services/CurrencyService.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `RateNotFoundError` | 404 | Exchange rate not found |
| `RateAlreadyExistsError` | 409 | Exchange rate already exists |
| `ExchangeRateIdNotFoundError` | 404 | Exchange rate ID not found |
| `InverseRateCalculationError` | 500 | Inverse rate calculation failed |
| `NoForeignCurrencyBalancesError` | 422 | No foreign currency balances |
| `UnrealizedGainLossAccountNotFoundError` | 422 | Missing GL account for revaluation |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

### Consolidation Errors (`packages/core/src/Services/ConsolidationService.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `ConsolidationGroupNotFoundError` | 404 | Group not found |
| `FiscalPeriodNotFoundError` | 400 | Period not found for consolidation |
| `ConsolidationRunExistsError` | 409 | Run already exists |
| `ConsolidationValidationError` | 422 | Validation failed |
| `ConsolidationStepFailedError` | 500 | Step execution failed |
| `ConsolidationDataCorruptionError` | 500 | Data corruption detected |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

### Domain Validation Errors (various files in `packages/core/src/Domains/`)

| Error Class | File | HTTP Status | Description |
|-------------|------|-------------|-------------|
| `AccountNumberRangeError` | AccountValidation.ts | 400 | Account number out of range |
| `NormalBalanceError` | AccountValidation.ts | 400 | Invalid normal balance |
| `IntercompanyPartnerMissingError` | AccountValidation.ts | 400 | IC account missing partner |
| `UnexpectedIntercompanyPartnerError` | AccountValidation.ts | 400 | Non-IC account has partner |
| `CashFlowCategoryOnIncomeStatementError` | AccountValidation.ts | 400 | Invalid cash flow category |
| `UnbalancedEntryError` | BalanceValidation.ts | 422 | Debits ≠ credits |
| `InvalidStatusTransitionError` | EntryStatusWorkflow.ts | 400 | Invalid status transition |
| `AccountTypeMismatchError` | AccountHierarchy.ts | 400 | Parent/child type mismatch |
| `ParentAccountNotFoundError` | AccountHierarchy.ts | 404 | Parent account not found |
| `CircularReferenceError` | AccountHierarchy.ts | 400 | Circular parent reference |
| `CurrencyMismatchError` | MonetaryAmount.ts | 400 | Currency mismatch in operation |
| `DivisionByZeroError` | MonetaryAmount.ts | 400 | Division by zero |
| `MissingExchangeRateError` | MultiCurrencyLineHandling.ts | 422 | Required exchange rate missing |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

### Repository Errors (`packages/core/src/Errors/RepositoryError.ts` and `packages/persistence/src/Errors/RepositoryError.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `EntityNotFoundError` | 404 | Entity not found in database |
| `PersistenceError` | 500 | Database operation failed |

**Status:** ✅ All errors have `HttpApiSchema.annotations`

**Removed unused errors:** `DuplicateEntityError`, `ValidationError`, `ConcurrencyError` (defined but never instantiated)

---

## API Layer Errors (To Be Removed/Consolidated)

The following errors in `packages/api/src/Definitions/ApiErrors.ts` should be **removed** as they duplicate domain errors:

| API Error | Replace With | Reason |
|-----------|--------------|--------|
| `NotFoundError` | Specific domain `*NotFoundError` | Generic; loses context |
| `ValidationError` | Specific domain validation errors | Generic; loses context |
| `ConflictError` | Specific domain `*AlreadyExistsError` | Generic; loses context |
| `BusinessRuleError` | Specific domain errors | Generic catch-all |

**Keep these API errors** (they serve distinct purposes):
- `UnauthorizedError` (401) - Authentication layer concern
- `ForbiddenError` (403) - Authorization layer concern
- `InternalServerError` (500) - Catch-all for unexpected errors
- `AuditLogError` (500) - Already mirrors domain error
- `UserLookupError` (500) - Already mirrors domain error

---

## Implementation Plan

### Phase 1: Add HttpApiSchema Annotations to Domain Errors

Each domain error file needs to import `HttpApiSchema` and add the annotation to each error class.

**Example transformation:**
```typescript
// BEFORE
export class MembershipNotFoundError extends Schema.TaggedError<MembershipNotFoundError>()(
  "MembershipNotFoundError",
  { userId: AuthUserId, organizationId: OrganizationId }
) {
  get message(): string { return `Membership not found` }
}

// AFTER
import { HttpApiSchema } from "@effect/platform"

export class MembershipNotFoundError extends Schema.TaggedError<MembershipNotFoundError>()(
  "MembershipNotFoundError",
  { userId: AuthUserId, organizationId: OrganizationId },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string { return `Membership not found` }
}
```

**Files to update:**
1. [x] `packages/core/src/Auth/AuthErrors.ts` (11 errors) ✅ Done
2. [x] `packages/core/src/Auth/AuthorizationErrors.ts` (13 errors) ✅ Done
3. [x] `packages/core/src/FiscalPeriod/FiscalPeriodErrors.ts` (11 errors) ✅ Done
4. [x] `packages/core/src/AuditLog/AuditLogErrors.ts` (3 errors) ✅ Done
5. [x] `packages/core/src/Services/JournalEntryService.ts` (11 errors) ✅ Done
6. [x] `packages/core/src/Services/CurrencyService.ts` (6 errors) ✅ Done
7. [x] `packages/core/src/Services/ConsolidationService.ts` (6 errors) ✅ Done
8. [x] `packages/core/src/Domains/AccountValidation.ts` (5 errors) ✅ Done
9. [x] `packages/core/src/Domains/BalanceValidation.ts` (1 error) ✅ Done
10. [x] `packages/core/src/Domains/EntryStatusWorkflow.ts` (1 error) ✅ Done
11. [x] `packages/core/src/Domains/AccountHierarchy.ts` (3 errors) ✅ Done
12. [x] `packages/core/src/Domains/MonetaryAmount.ts` (2 errors) ✅ Done
13. [x] `packages/core/src/Domains/MultiCurrencyLineHandling.ts` (1 error) ✅ Done
14. [x] `packages/core/src/Errors/RepositoryError.ts` (2 errors) ✅ Done
15. [x] `packages/persistence/src/Errors/RepositoryError.ts` (5 errors) ✅ Done

**Total: 81 errors to annotate**

**Phase 1 Status: ✅ COMPLETE** - All 81 errors across 15 files now have HttpApiSchema.annotations.

### Phase 2: Remove Generic API Layer Errors

**Status:** 🔄 IN PROGRESS

**Analysis:** The generic API errors (`NotFoundError`, `ValidationError`, `ConflictError`, `BusinessRuleError`) were used extensively across API handlers (~200+ usages). We are progressively replacing them with domain-specific errors.

**Phase 2a: Create shared domain errors** ✅ COMPLETE

Created `packages/core/src/Errors/DomainErrors.ts` with ~35 shared domain error classes:

**Not Found Errors (404):**
- `OrganizationNotFoundError`
- `CompanyNotFoundError`
- `AccountNotFoundError`
- `ParentAccountNotFoundError`
- `JournalEntryNotFoundError`
- `ExchangeRateNotFoundError`
- `PolicyNotFoundError`
- `InvitationNotFoundError`
- `IntercompanyTransactionNotFoundError`
- `ConsolidationRunNotFoundError`
- `AccountTemplateNotFoundError`
- `MemberNotFoundError`
- `UserNotFoundByEmailError`

**Validation Errors (400):**
- `OwnershipPercentageRequiredError`
- `InvalidOrganizationIdError`
- `InvalidCompanyIdError`
- `InvalidPolicyConditionError`
- `SameCurrencyExchangeRateError`
- `InvalidExchangeRateError`
- `SameCompanyIntercompanyError`
- `ParentAccountDifferentCompanyError`

**Conflict Errors (409):**
- `OrganizationHasCompaniesError`
- `ParentCompanyNotFoundError`
- `CircularCompanyReferenceError`
- `HasActiveSubsidiariesError`
- `HasActiveChildAccountsError`
- `AccountNumberAlreadyExistsError`
- `CircularAccountReferenceError`
- `AccountsAlreadyExistError`
- `PolicyAlreadyExistsError`
- `SystemPolicyCannotBeModifiedError`
- `ExchangeRateAlreadyExistsError`

**Business Rule Errors (422):**
- `MembershipCreationFailedError`
- `SystemPolicySeedingFailedError`
- `InvitationNotPendingError`
- `ConsolidationGroupInactiveError`
- `ConsolidationRunInProgressError`

**Internal Errors (500):**
- `DataCorruptionError`
- `OperationFailedError`

**Phase 2b-2d: Replace generic errors in API handlers** ✅ COMPLETE

| File | Status | Notes |
|------|--------|-------|
| `AccountTemplatesApiLive.ts` | ✅ COMPLETE | Replaced all generic errors |
| `CompaniesApiLive.ts` | ✅ COMPLETE | Replaced all generic errors |
| `AccountsApiLive.ts` | ✅ COMPLETE | Replaced all generic errors |
| `JournalEntriesApiLive.ts` | ✅ COMPLETE | All generic errors replaced |
| `IntercompanyTransactionsApiLive.ts` | ✅ COMPLETE | All generic errors replaced (NotFoundError→IntercompanyTransactionNotFoundError, BusinessRuleError→CompanyNotFoundError/SameCompanyIntercompanyError/IntercompanyTransactionCannotBeDeletedError, removed mapping functions, use Effect.orDie for persistence) |
| `FiscalPeriodApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors |
| `MembershipApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors (InvalidOrganizationIdError, MemberNotFoundError, etc.) |
| `CurrencyApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors (ExchangeRateNotFoundError, SameCurrencyExchangeRateError) |
| `ConsolidationApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors (ConsolidationGroupNotFoundError, ConsolidationRunNotFoundError, etc.), removed old mapping functions |
| `ReportsApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors (CompanyNotFoundError, InvalidReportPeriodError, TrialBalanceNotBalancedError, BalanceSheetNotBalancedError), removed old mapping functions |
| `InvitationApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors (InvalidInvitationError, InvitationExpiredError, UserAlreadyMemberError, InvitationNotFoundError, InvalidOrganizationIdError, InvalidInvitationIdError) |
| `AuthApiLive.ts` | ✅ COMPLETE | Uses domain-specific errors defined in AuthApi.ts (AuthValidationError, PasswordWeakError, etc.), replaced UnauthorizedError with AuthUserNotFoundError in handlers |
| `PolicyApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors (PolicyNotFoundError, InvalidPolicyIdError, PolicyPriorityValidationError, InvalidResourceTypeError, UserNotMemberOfOrganizationError, SystemPolicyCannotBeModifiedError) |
| `EliminationRulesApiLive.ts` | ✅ COMPLETE | All generic errors replaced with domain-specific errors (EliminationRuleNotFoundError, EliminationRuleOperationFailedError, ConsolidationGroupNotFoundError), removed mapping functions, use Effect.orDie for persistence errors |

**Conversion pattern established:**

1. **Remove old mapping functions** (`mapPersistenceToNotFound`, `mapPersistenceToBusinessRule`, etc.)
2. **Use `Effect.orDie` for persistence errors** (unexpected infrastructure failures)
3. **Use domain-specific errors for expected failures** (not found, validation, conflicts)
4. **Update API definitions** to include new domain errors in error unions
5. **Update tests** to expect domain error `_tag` values

### Phase 3: Verify Error Flow-Through

**Status:** ✅ COMPLETE (implicit)

Domain errors with `HttpApiSchema.annotations` now flow directly to HTTP responses. The Effect HttpApi framework automatically:
1. Uses the `_tag` as the error discriminator in JSON responses
2. Uses the annotated `status` for HTTP response codes
3. Serializes error properties to the response body

No additional tests needed - this is framework behavior, already tested by Effect.

### Phase 4: Documentation Cleanup

**Status:** ✅ COMPLETE

1. [x] Error catalog tables serve as authoritative reference - status code mapping objects are redundant but can remain for backwards compatibility
2. [x] API documentation references domain errors via OpenAPI spec (auto-generated)
3. [x] Spec updated with accurate current vs. target architecture documentation
4. [x] Documented actual generic error usage patterns and refactoring scope
5. [ ] Remove `*_ERROR_STATUS_CODES` mapping objects if unused (optional, low priority)

---

## Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Add HttpApiSchema annotations | ✅ COMPLETE | 81 errors across 15 files |
| Phase 2: Remove generic API errors | ✅ COMPLETE | All 16 API files converted, generic errors removed from ApiErrors.ts |
| Phase 3: Verify error flow-through | ✅ COMPLETE | Framework behavior, works automatically |
| Phase 4: Documentation cleanup | ✅ COMPLETE | Spec updated with accurate current/target state |

### Current State vs. Target

| Aspect | Current | Target |
|--------|---------|--------|
| Error layers | **ONE (domain only)** | One (domain only) ✅ |
| Domain errors created | ~133 (81 + 52 new) | ~133 ✅ |
| Shared domain errors file | ✅ `packages/core/src/Errors/DomainErrors.ts` | ✅ Created |
| API files converted | **All 16** | All ✅ |
| Error mapping in handlers | **None** | None ✅ |
| Error context preserved | **Full** | Full (domain-specific) ✅ |

**Progress made:**
- ✅ Created `packages/core/src/Errors/DomainErrors.ts` with ~35 shared domain errors
- ✅ Converted `AccountTemplatesApiLive.ts` - all generic errors replaced
- ✅ Converted `CompaniesApiLive.ts` - all generic errors replaced
- ✅ Converted `AccountsApiLive.ts` - all generic errors replaced
- ✅ Added `OrganizationNotFoundError` to all 15 API definition files
- ✅ Updated test assertions for converted files
- ✅ Converted `JournalEntriesApi.ts` - replaced all `NotFoundError` with `JournalEntryNotFoundError` and `CompanyNotFoundError`
- ✅ Converted `JournalEntriesApiLive.ts` - all handlers now use domain-specific errors, removed unused `NotFoundError` import
- ✅ Updated frontend routes to handle domain-specific errors (`CompanyNotFoundError`, `JournalEntryNotFoundError`)
- ✅ Converted `FiscalPeriodApiLive.ts` - all handlers now use domain-specific errors (FiscalYearNotFoundError, FiscalPeriodNotFoundError, InvalidStatusTransitionError, etc.)
- ✅ Converted `MembershipApiLive.ts` - all handlers now use domain-specific errors (InvalidOrganizationIdError, MemberNotFoundError, etc.), domain errors flow through directly
- ✅ Converted `CurrencyApiLive.ts` - all handlers now use domain-specific errors (ExchangeRateNotFoundError, SameCurrencyExchangeRateError), removed old mapping functions
- ✅ Converted `ConsolidationApiLive.ts` - all handlers now use domain-specific errors (ConsolidationGroupNotFoundError, ConsolidationRunNotFoundError, ConsolidationMemberNotFoundError, ConsolidationGroupInactiveError, ConsolidationRunExistsForPeriodError, ConsolidationRunCannotBeCancelledError, ConsolidationRunCannotBeDeletedError, ConsolidationRunNotCompletedError, ConsolidatedTrialBalanceNotAvailableError, ConsolidatedBalanceSheetNotBalancedError, ConsolidationReportGenerationError), removed old mapping functions
- ✅ Converted `ReportsApiLive.ts` - all handlers now use domain-specific errors (CompanyNotFoundError, InvalidReportPeriodError, TrialBalanceNotBalancedError, BalanceSheetNotBalancedError), removed old mapping functions
- ✅ Converted `InvitationApiLive.ts` - all handlers now use domain-specific errors (InvalidInvitationError, InvitationExpiredError, UserAlreadyMemberError, InvitationNotFoundError, InvalidOrganizationIdError, InvalidInvitationIdError)
- ✅ Converted `AuthApiLive.ts` - uses domain-specific errors defined in AuthApi.ts (AuthValidationError, PasswordWeakError, etc.), replaced UnauthorizedError with AuthUserNotFoundError in handlers
- ✅ Converted `PolicyApiLive.ts` - all handlers now use domain-specific errors (PolicyNotFoundError, InvalidPolicyIdError, PolicyPriorityValidationError, InvalidResourceTypeError, UserNotMemberOfOrganizationError, SystemPolicyCannotBeModifiedError)
- ✅ Converted `AccountsApiLive.ts` - replaced ConflictError with AccountNumberAlreadyExistsError
- ✅ Converted `CompaniesApiLive.ts` - replaced ConflictError/ValidationError with OrganizationNameAlreadyExistsError, CompanyNameAlreadyExistsError, OrganizationUpdateFailedError
- ✅ Converted `IntercompanyTransactionsApiLive.ts` - all handlers now use domain-specific errors (IntercompanyTransactionNotFoundError, CompanyNotFoundError, SameCompanyIntercompanyError, IntercompanyTransactionCannotBeDeletedError), removed mapping functions, use Effect.orDie for persistence errors
- ✅ Converted `EliminationRulesApiLive.ts` - all handlers now use domain-specific errors (EliminationRuleNotFoundError, EliminationRuleOperationFailedError, ConsolidationGroupNotFoundError), removed mapping functions, use Effect.orDie for persistence errors
- ✅ Removed unused generic errors (NotFoundError, ValidationError, BusinessRuleError, ConflictError) from `ApiErrors.ts`
- ✅ Updated test assertions for AppApi.test.ts to use domain errors

**All work complete!**

The codebase now follows the one-layer error architecture:
- Domain errors are defined in `packages/core/src/Errors/DomainErrors.ts` with `HttpApiSchema.annotations`
- Domain errors flow through directly to HTTP responses
- No error mapping in API handlers
- API layer only contains: `UnauthorizedError` (401), `ForbiddenError` (403), `InternalServerError` (500), `AuditLogError` (500), `UserLookupError` (500)

**Conversion pattern that was applied:**
1. Create domain-specific errors in `packages/core/src/Errors/DomainErrors.ts`
2. Add domain errors to API definition error unions
3. Replace generic errors in handler implementations
4. Use `Effect.orDie` for persistence errors
5. Update tests to expect new error `_tag` values
