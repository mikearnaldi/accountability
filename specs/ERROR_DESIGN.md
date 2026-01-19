# Error Design

This document describes the error handling strategy for the Accountability codebase.

## Overview

**One layer of errors:** Domain errors with HTTP annotations. Used everywhere - services, repositories, API handlers. Errors flow through without transformation.

```
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN ERRORS                          │
│  Schema.TaggedError + HttpApiSchema.annotations             │
│  Used in repositories, services, and API handlers           │
│  Flow directly to HTTP responses                            │
└─────────────────────────────────────────────────────────────┘
```

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

**Status:** ✅ Has `AUTH_ERROR_STATUS_CODES` mapping object, but errors lack `HttpApiSchema.annotations`

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

**Status:** ✅ Has `AUTHORIZATION_ERROR_STATUS_CODES` mapping object, but errors lack `HttpApiSchema.annotations`

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
| `PeriodNotOpenError` | 409 | Period is not open |
| `PeriodProtectedError` | 409 | Period is closed/locked |
| `YearNotClosedError` | 409 | Year is not closed |
| `PeriodsNotClosedError` | 409 | Periods not all closed |

**Status:** ✅ Has `FISCAL_PERIOD_ERROR_STATUS_CODES` mapping object, but errors lack `HttpApiSchema.annotations`

### Audit Log Errors (`packages/core/src/AuditLog/AuditLogErrors.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `AuditLogError` | 500 | Audit logging failed |
| `UserLookupError` | 500 | User lookup failed |
| `AuditDataCorruptionError` | 500 | Audit data corrupted |

**Status:** ⚠️ Needs status code mapping object and `HttpApiSchema.annotations`

### Journal Entry Errors (`packages/core/src/Services/JournalEntryService.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `AccountNotFoundError` | 404 | Account not found |
| `AccountNotPostableError` | 422 | Account is not postable |
| `AccountNotActiveError` | 422 | Account is not active |
| `PeriodNotOpenError` | 409 | Fiscal period is not open |
| `PeriodNotFoundError` | 400 | Fiscal period not found |
| `EmptyJournalEntryError` | 400 | Entry has no lines |
| `DuplicateLineNumberError` | 400 | Duplicate line number |
| `NotApprovedError` | 422 | Entry not approved for posting |
| `PeriodClosedError` | 409 | Cannot post to closed period |
| `EntryNotPostedError` | 422 | Entry must be posted to reverse |
| `EntryAlreadyReversedError` | 409 | Entry already reversed |

**Status:** ⚠️ Needs status code mapping object and `HttpApiSchema.annotations`

### Currency Errors (`packages/core/src/Services/CurrencyService.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `RateNotFoundError` | 404 | Exchange rate not found |
| `RateAlreadyExistsError` | 409 | Exchange rate already exists |
| `ExchangeRateIdNotFoundError` | 404 | Exchange rate ID not found |
| `InverseRateCalculationError` | 500 | Inverse rate calculation failed |
| `NoForeignCurrencyBalancesError` | 422 | No foreign currency balances |
| `UnrealizedGainLossAccountNotFoundError` | 422 | Missing GL account for revaluation |

**Status:** ⚠️ Needs status code mapping object and `HttpApiSchema.annotations`

### Consolidation Errors (`packages/core/src/Services/ConsolidationService.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `ConsolidationGroupNotFoundError` | 404 | Group not found |
| `FiscalPeriodNotFoundError` | 400 | Period not found for consolidation |
| `ConsolidationRunExistsError` | 409 | Run already exists |
| `ConsolidationValidationError` | 422 | Validation failed |
| `ConsolidationStepFailedError` | 500 | Step execution failed |
| `ConsolidationDataCorruptionError` | 500 | Data corruption detected |

**Status:** ⚠️ Needs status code mapping object and `HttpApiSchema.annotations`

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

**Status:** ⚠️ Needs status code mapping object and `HttpApiSchema.annotations`

### Repository Errors (`packages/core/src/Errors/RepositoryError.ts` and `packages/persistence/src/Errors/RepositoryError.ts`)

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `EntityNotFoundError` | 404 | Entity not found in database |
| `DuplicateEntityError` | 409 | Entity violates unique constraint |
| `PersistenceError` | 500 | Database operation failed |
| `ValidationError` | 400 | Schema validation failed |
| `ConcurrencyError` | 409 | Optimistic locking conflict |

**Status:** ⚠️ Needs status code mapping object and `HttpApiSchema.annotations`

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
1. [ ] `packages/core/src/Auth/AuthErrors.ts` (11 errors)
2. [ ] `packages/core/src/Auth/AuthorizationErrors.ts` (13 errors)
3. [ ] `packages/core/src/FiscalPeriod/FiscalPeriodErrors.ts` (11 errors)
4. [ ] `packages/core/src/AuditLog/AuditLogErrors.ts` (3 errors)
5. [ ] `packages/core/src/Services/JournalEntryService.ts` (11 errors)
6. [ ] `packages/core/src/Services/CurrencyService.ts` (6 errors)
7. [ ] `packages/core/src/Services/ConsolidationService.ts` (6 errors)
8. [ ] `packages/core/src/Domains/AccountValidation.ts` (5 errors)
9. [ ] `packages/core/src/Domains/BalanceValidation.ts` (1 error)
10. [ ] `packages/core/src/Domains/EntryStatusWorkflow.ts` (1 error)
11. [ ] `packages/core/src/Domains/AccountHierarchy.ts` (3 errors)
12. [ ] `packages/core/src/Domains/MonetaryAmount.ts` (2 errors)
13. [ ] `packages/core/src/Domains/MultiCurrencyLineHandling.ts` (1 error)
14. [ ] `packages/core/src/Errors/RepositoryError.ts` (2 errors)
15. [ ] `packages/persistence/src/Errors/RepositoryError.ts` (5 errors)

**Total: 81 errors to annotate**

### Phase 2: Remove Generic API Layer Errors

Once domain errors have HTTP annotations, remove these from API handlers:
1. [ ] Remove error mapping that converts domain errors to generic API errors
2. [ ] Remove unused generic errors from `ApiErrors.ts`
3. [ ] Update API endpoint definitions to use domain errors directly

### Phase 3: Verify Error Flow-Through

1. [ ] Write tests verifying domain errors flow directly to HTTP responses
2. [ ] Verify error `_tag` and HTTP status codes match in responses
3. [ ] Ensure no error transformations occur except where business logic requires

### Phase 4: Documentation Cleanup

1. [ ] Remove `*_ERROR_STATUS_CODES` mapping objects (no longer needed)
2. [ ] Update API documentation to reference domain errors
3. [ ] Remove "HTTP Status" comments from domain errors (now self-documenting)
