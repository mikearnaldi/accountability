# Error Design Architecture

This document describes the error handling strategy for the Accountability codebase, explaining the three-layer error architecture and how errors flow between layers.

## Overview

The codebase uses a **three-layer error architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                     API ERRORS (packages/api)               │
│  HTTP-aware, generic errors with status code annotations    │
│  NotFoundError, ValidationError, ForbiddenError, etc.       │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ mapError (explicit mapping)
                              │
┌─────────────────────────────────────────────────────────────┐
│                   DOMAIN ERRORS (packages/core)             │
│  Business-level, semantically rich errors                   │
│  InvalidCredentialsError, MembershipNotFoundError, etc.     │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ mapError (wrap or propagate)
                              │
┌─────────────────────────────────────────────────────────────┐
│               PERSISTENCE ERRORS (packages/persistence)     │
│  Database operation errors, low-level                       │
│  EntityNotFoundError, PersistenceError, etc.                │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Persistence Errors

**Location:** `packages/persistence/src/Errors/RepositoryError.ts`

**Purpose:** Represent low-level database operation failures. These errors are generic and do not leak business domain details.

### Error Catalog

| Error | Fields | Description | When to Use |
|-------|--------|-------------|-------------|
| `EntityNotFoundError` | `entityType: String`, `entityId: String` | Entity lookup returned no results | `findById`, `findByCode` when entity doesn't exist |
| `DuplicateEntityError` | `entityType: String`, `entityId: String`, `conflictField: Option<String>` | Unique constraint violation | Insert/update with duplicate key |
| `PersistenceError` | `operation: String`, `cause: Defect` | Generic database error wrapper | Wrap SQL errors with operation context |
| `ValidationError` | `entityType: String`, `field: String`, `message: String` | Entity validation failed | Schema validation at persistence boundary |
| `ConcurrencyError` | `entityType: String`, `entityId: String` | Optimistic locking failure | Concurrent modification detected |

### Union Type

```typescript
export type RepositoryError =
  | EntityNotFoundError
  | DuplicateEntityError
  | PersistenceError
  | ValidationError
  | ConcurrencyError
```

### Type Guards

All persistence errors export type guards:
- `isEntityNotFoundError(e)` → `e is EntityNotFoundError`
- `isDuplicateEntityError(e)` → `e is DuplicateEntityError`
- `isPersistenceError(e)` → `e is PersistenceError`
- `isValidationError(e)` → `e is ValidationError`
- `isConcurrencyError(e)` → `e is ConcurrencyError`

### Utility Functions

```typescript
// Wrap SQL errors with operation context
export const wrapSqlError = (operation: string) =>
  Effect.mapError((cause) => new PersistenceError({ operation, cause }))
```

### Example Usage

```typescript
// In a repository
export const findById = (id: AccountId) =>
  sql`SELECT * FROM accounts WHERE id = ${id}`.pipe(
    wrapSqlError("findById"),
    Effect.flatMap((rows) =>
      rows.length === 0
        ? Effect.fail(new EntityNotFoundError({ entityType: "Account", entityId: id }))
        : Effect.succeed(rows[0])
    )
  )
```

---

## Layer 2: Domain Errors

**Location:** `packages/core/src/*/` (organized by domain module)

**Purpose:** Represent business-level failures with rich semantic meaning. These errors:
- Express domain concepts (e.g., "invitation expired", "owner cannot be removed")
- Include domain-specific context (e.g., `email`, `organizationId`)
- Document HTTP status codes as metadata for API layer reference
- Do NOT include `HttpApiSchema` annotations (no HTTP awareness)

### Naming Convention

**Pattern:** `{Domain}{Failure}Error`

Examples:
- `InvalidCredentialsError` (Auth domain, credentials failure)
- `MembershipNotFoundError` (Membership domain, not found)
- `InvitationExpiredError` (Invitation domain, expiry failure)
- `FiscalYearNotFoundError` (FiscalPeriod domain, not found)

### Required Structure

Every domain error MUST:

1. **Extend `Schema.TaggedError`** - provides `_tag` discriminator
2. **Use domain-specific types** - prefer `Email`, `OrganizationId` over `Schema.String`
3. **Include a `message` getter** - human-readable description
4. **Document HTTP status in JSDoc comment** - helps API layer implementers
5. **Export a type guard** - `export const isMyError = Schema.is(MyError)`

```typescript
/**
 * HTTP Status: 401 Unauthorized
 *
 * The user provided invalid credentials during authentication.
 */
export class InvalidCredentialsError extends Schema.TaggedError<InvalidCredentialsError>()(
  "InvalidCredentialsError",
  {
    email: Email.annotations({
      description: "The email address that was used for authentication"
    })
  }
) {
  get message(): string {
    return "Invalid email or password"
  }
}

export const isInvalidCredentialsError = Schema.is(InvalidCredentialsError)
```

### Domain Error Catalog

#### Auth Module (`packages/core/src/Auth/AuthErrors.ts`)

| Error | Fields | HTTP | Purpose |
|-------|--------|------|---------|
| `InvalidCredentialsError` | `email: Email` | 401 | Wrong username/password |
| `SessionExpiredError` | `sessionId: SessionId` | 401 | Session exceeded lifetime |
| `SessionNotFoundError` | `sessionId: SessionId` | 401 | Invalid session token |
| `ProviderAuthFailedError` | `provider: AuthProviderType`, `reason: String` | 401 | External provider auth failed |
| `UserNotFoundError` | `email: Email` | 404 | User doesn't exist |
| `ProviderNotEnabledError` | `provider: AuthProviderType` | 404 | Provider not configured |
| `UserAlreadyExistsError` | `email: Email` | 409 | Duplicate email registration |
| `IdentityAlreadyLinkedError` | `provider: AuthProviderType`, `providerId: ProviderId`, `existingUserId: AuthUserId` | 409 | Identity linked to different user |
| `PasswordTooWeakError` | `requirements: Chunk<String>` | 400 | Password validation failed |
| `OAuthStateError` | `provider: AuthProviderType` | 400 | OAuth state mismatch (CSRF) |
| `SessionCleanupError` | `sessionId: SessionId`, `operation: String`, `cause: Unknown` | 500 | Failed to delete expired session |

**Status Code Map:** `AUTH_ERROR_STATUS_CODES`

#### Authorization Module (`packages/core/src/Auth/AuthorizationErrors.ts`)

| Error | Fields | HTTP | Purpose |
|-------|--------|------|---------|
| `PermissionDeniedError` | `action: Action`, `resourceType: String`, `resourceId?: UUID`, `reason: String` | 403 | User lacks required permission |
| `MembershipNotActiveError` | `userId: AuthUserId`, `organizationId: OrganizationId`, `status: MembershipStatus` | 403 | Membership is suspended/removed |
| `MembershipNotFoundError` | `userId: AuthUserId`, `organizationId: OrganizationId` | 404 | User not member of org |
| `InvalidInvitationError` | `reason: String` | 400 | Invitation is invalid/not found |
| `InvitationExpiredError` | (no fields) | 400 | Invitation revoked |
| `OwnerCannotBeRemovedError` | `organizationId: OrganizationId` | 409 | Cannot remove org owner |
| `OwnerCannotBeSuspendedError` | `organizationId: OrganizationId` | 409 | Cannot suspend org owner |
| `MemberNotSuspendedError` | `userId: AuthUserId`, `organizationId: OrganizationId`, `currentStatus: MembershipStatus` | 409 | Cannot unsuspend non-suspended member |
| `CannotTransferToNonAdminError` | `userId: AuthUserId` | 409 | Cannot transfer to non-admin |
| `InvitationAlreadyExistsError` | `email: String`, `organizationId: OrganizationId` | 409 | Pending invitation already exists |
| `UserAlreadyMemberError` | `userId: AuthUserId`, `organizationId: OrganizationId` | 409 | User already member |
| `PolicyLoadError` | `organizationId: OrganizationId`, `cause: Unknown` | 500 | Failed to load policies |
| `AuthorizationAuditError` | `operation: String`, `cause: Unknown` | 500 | Failed to log audit |

**Status Code Map:** `AUTHORIZATION_ERROR_STATUS_CODES`

#### AuditLog Module (`packages/core/src/AuditLog/AuditLogErrors.ts`)

| Error | Fields | HTTP | Purpose |
|-------|--------|------|---------|
| `AuditLogError` | `operation: String`, `cause: Defect` | 500 | Audit log operation failed |
| `UserLookupError` | `userId: String`, `cause: Defect` | 500 | User lookup failed during audit |
| `AuditDataCorruptionError` | `entryId: String`, `field: String`, `cause: Defect` | 500 | Audit data parse failed |

#### FiscalPeriod Module (`packages/core/src/FiscalPeriod/FiscalPeriodErrors.ts`)

| Error | Fields | HTTP | Purpose |
|-------|--------|------|---------|
| `FiscalYearNotFoundError` | `fiscalYearId: FiscalYearId` | 404 | Fiscal year doesn't exist |
| `FiscalPeriodNotFoundError` | `fiscalPeriodId: FiscalPeriodId` | 404 | Fiscal period doesn't exist |
| `FiscalPeriodNotFoundForDateError` | `companyId: CompanyId`, `date: String` | 400 | No fiscal period for date |
| `InvalidStatusTransitionError` | `currentStatus: FiscalPeriodStatus`, `targetStatus: FiscalPeriodStatus`, `periodId: FiscalPeriodId` | 400 | Invalid period status transition |
| `InvalidYearStatusTransitionError` | `currentStatus: FiscalYearStatus`, `targetStatus: FiscalYearStatus`, `fiscalYearId: FiscalYearId` | 400 | Invalid year status transition |
| `FiscalYearOverlapError` | `companyId: CompanyId`, `year: Number`, `existingYearId: FiscalYearId` | 400 | Fiscal year dates overlap |
| `FiscalYearAlreadyExistsError` | `companyId: CompanyId`, `year: Number` | 409 | Fiscal year already exists |
| `PeriodNotOpenError` | `periodId: FiscalPeriodId`, `currentStatus: FiscalPeriodStatus` | 409 | Period not in Open status |
| `PeriodProtectedError` | `periodId: FiscalPeriodId`, `currentStatus: FiscalPeriodStatus`, `action: String` | 409 | Period is closed/locked |
| `YearNotClosedError` | `fiscalYearId: FiscalYearId`, `currentStatus: FiscalYearStatus` | 409 | Year not fully closed |
| `PeriodsNotClosedError` | `fiscalYearId: FiscalYearId`, `openPeriodCount: Number` | 409 | Not all periods closed |

**Status Code Map:** `FISCAL_PERIOD_ERROR_STATUS_CODES`

### Status Code Maps

Each domain module SHOULD export a status code map for API layer reference:

```typescript
export const AUTH_ERROR_STATUS_CODES = {
  InvalidCredentialsError: 401,
  SessionExpiredError: 401,
  SessionNotFoundError: 401,
  ProviderAuthFailedError: 401,
  UserNotFoundError: 404,
  ProviderNotEnabledError: 404,
  UserAlreadyExistsError: 409,
  IdentityAlreadyLinkedError: 409,
  PasswordTooWeakError: 400,
  OAuthStateError: 400,
  SessionCleanupError: 500
} as const
```

---

## Layer 3: API Errors

**Location:** `packages/api/src/Definitions/ApiErrors.ts`

**Purpose:** HTTP-aware errors that get serialized to API responses. These errors:
- Include `HttpApiSchema.annotations({ status: ### })` for HTTP status mapping
- Are generic and reusable across all endpoints
- Map multiple domain errors to a single HTTP error type
- Include field descriptions for OpenAPI documentation

### API Error Catalog

| Error | Status | Fields | Purpose |
|-------|--------|--------|---------|
| `NotFoundError` | 404 | `resource: String`, `id: String` | Resource not found |
| `ValidationError` | 400 | `message: String`, `field?: String`, `details?: Array<{field, message}>` | Request validation failed |
| `UnauthorizedError` | 401 | `message: String` (default: "Authentication required") | Authentication required |
| `ForbiddenError` | 403 | `message: String`, `resource?: String`, `action?: String` | Access denied |
| `ConflictError` | 409 | `message: String`, `resource?: String`, `conflictingField?: String` | Resource conflict |
| `BusinessRuleError` | 422 | `code: String`, `message: String`, `details?: Unknown` | Business rule violation |
| `InternalServerError` | 500 | `message: String`, `requestId?: String` | Unexpected server error |

### When to Use Each API Error

| Scenario | API Error | Example |
|----------|-----------|---------|
| Entity doesn't exist | `NotFoundError` | Account, Company, JournalEntry not found |
| Input validation failed | `ValidationError` | Invalid date format, missing required field |
| User not authenticated | `UnauthorizedError` | No session, expired session, invalid credentials |
| User lacks permission | `ForbiddenError` | Cannot edit, cannot delete, cannot approve |
| Duplicate/conflict | `ConflictError` | Email already exists, duplicate entry |
| Business rule violated | `BusinessRuleError` | Owner cannot be removed, period is locked |
| Unexpected failure | `InternalServerError` | Database down, external service failed |

### Example API Error

```typescript
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    resource: Schema.String.annotations({
      description: "The type of resource that was not found"
    }),
    id: Schema.String.annotations({
      description: "The identifier of the resource"
    })
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `${this.resource} not found: ${this.id}`
  }
}

export const isNotFoundError = Schema.is(NotFoundError)
```

---

## Error Mapping Strategy

### Domain → API Mapping Table

This is the **authoritative** mapping table. API handlers MUST follow this mapping:

#### Authentication Errors (401)

| Domain Error | API Error | Code | Example Message |
|--------------|-----------|------|-----------------|
| `InvalidCredentialsError` | `UnauthorizedError` | - | "Invalid email or password" |
| `SessionExpiredError` | `UnauthorizedError` | - | "Session expired" |
| `SessionNotFoundError` | `UnauthorizedError` | - | "Authentication required" |
| `ProviderAuthFailedError` | `UnauthorizedError` | - | "Authentication with {provider} failed" |

#### Authorization Errors (403)

| Domain Error | API Error | Code | Example Message |
|--------------|-----------|------|-----------------|
| `PermissionDeniedError` | `ForbiddenError` | - | "You don't have permission to {action}" |
| `MembershipNotActiveError` | `ForbiddenError` | - | "Your membership is suspended" |

#### Not Found Errors (404)

| Domain Error | API Error | Resource | ID Format |
|--------------|-----------|----------|-----------|
| `EntityNotFoundError` | `NotFoundError` | `{entityType}` | `{entityId}` |
| `MembershipNotFoundError` | `NotFoundError` | "Membership" | "user {userId} in org {orgId}" |
| `UserNotFoundError` | `NotFoundError` | "User" | `{email}` |
| `ProviderNotEnabledError` | `NotFoundError` | "AuthProvider" | `{provider}` |
| `FiscalYearNotFoundError` | `NotFoundError` | "FiscalYear" | `{fiscalYearId}` |
| `FiscalPeriodNotFoundError` | `NotFoundError` | "FiscalPeriod" | `{fiscalPeriodId}` |

#### Validation Errors (400)

| Domain Error | API Error | Message Pattern |
|--------------|-----------|-----------------|
| `PasswordTooWeakError` | `ValidationError` | "Password does not meet requirements" |
| `OAuthStateError` | `ValidationError` | "OAuth state mismatch" |
| `FiscalPeriodNotFoundForDateError` | `ValidationError` | "No fiscal period found for date {date}" |
| `InvalidStatusTransitionError` | `ValidationError` | "Cannot transition from {current} to {target}" |
| `InvalidYearStatusTransitionError` | `ValidationError` | "Cannot transition year from {current} to {target}" |
| `FiscalYearOverlapError` | `ValidationError` | "Fiscal year {year} overlaps with existing year" |
| `InvalidInvitationError` | `ValidationError` | "{reason}" |
| `InvitationExpiredError` | `ValidationError` | "Invitation has expired" |

#### Conflict Errors (409)

| Domain Error | API Error | Resource | ConflictingField |
|--------------|-----------|----------|------------------|
| `UserAlreadyExistsError` | `ConflictError` | "User" | "email" |
| `IdentityAlreadyLinkedError` | `ConflictError` | "Identity" | "providerId" |
| `FiscalYearAlreadyExistsError` | `ConflictError` | "FiscalYear" | "year" |
| `DuplicateEntityError` | `ConflictError` | `{entityType}` | `{conflictField}` |

#### Business Rule Errors (422)

| Domain Error | API Error Code | Example Message |
|--------------|---------------|-----------------|
| `OwnerCannotBeRemovedError` | `OWNER_CANNOT_BE_REMOVED` | "The organization owner cannot be removed" |
| `OwnerCannotBeSuspendedError` | `OWNER_CANNOT_BE_SUSPENDED` | "The organization owner cannot be suspended" |
| `MemberNotSuspendedError` | `MEMBER_NOT_SUSPENDED` | "Member is not suspended" |
| `CannotTransferToNonAdminError` | `CANNOT_TRANSFER_TO_NON_ADMIN` | "Ownership can only be transferred to an admin" |
| `InvitationAlreadyExistsError` | `INVITATION_ALREADY_EXISTS` | "A pending invitation already exists for this email" |
| `UserAlreadyMemberError` | `USER_ALREADY_MEMBER` | "User is already a member of this organization" |
| `PeriodNotOpenError` | `PERIOD_NOT_OPEN` | "Fiscal period is not open" |
| `PeriodProtectedError` | `PERIOD_PROTECTED` | "Fiscal period is closed/locked" |
| `YearNotClosedError` | `YEAR_NOT_CLOSED` | "Fiscal year is not fully closed" |
| `PeriodsNotClosedError` | `PERIODS_NOT_CLOSED` | "Not all periods are closed" |

#### Internal Errors (500)

| Domain Error | API Error | Message Pattern |
|--------------|-----------|-----------------|
| `PersistenceError` | `InternalServerError` | "Database operation failed" |
| `PolicyLoadError` | `InternalServerError` | "Failed to load policies" |
| `AuthorizationAuditError` | `InternalServerError` | "Failed to log audit" |
| `SessionCleanupError` | `InternalServerError` | "Session cleanup failed" |
| `AuditLogError` | `InternalServerError` | "Audit log operation failed: {operation}" |
| `UserLookupError` | `InternalServerError` | "User lookup failed" |
| `AuditDataCorruptionError` | `InternalServerError` | "Audit data corrupted" |

### Mapping Implementation Pattern

**ALWAYS use type guards** (preferred) or `_tag` checks for mapping:

#### Pattern 1: Using Type Guards (Recommended)

```typescript
import { isInvalidCredentialsError, isSessionExpiredError } from "@accountability/core/Auth"

yield* authService.login(provider, authRequest).pipe(
  Effect.mapError((error) => {
    if (isInvalidCredentialsError(error)) {
      return new UnauthorizedError({ message: "Invalid email or password" })
    }
    if (isSessionExpiredError(error)) {
      return new UnauthorizedError({ message: "Session expired" })
    }
    // Fallback - log and return generic error
    return new InternalServerError({
      message: "Authentication failed",
      requestId: Option.none()
    })
  })
)
```

#### Pattern 2: Using `_tag` Checks (Alternative)

```typescript
yield* memberService.updateRole(orgId, userId, updateInput).pipe(
  Effect.mapError((error) => {
    switch (error._tag) {
      case "MembershipNotFoundError":
        return new NotFoundError({
          resource: "Membership",
          id: `user ${userId} in org ${orgId}`
        })
      case "OwnerCannotBeRemovedError":
        return new BusinessRuleError({
          code: "OWNER_CANNOT_BE_REMOVED",
          message: "The organization owner cannot be removed",
          details: Option.none()
        })
      default:
        return new BusinessRuleError({
          code: "UPDATE_FAILED",
          message: "message" in error ? String(error.message) : "Failed to update member",
          details: Option.none()
        })
    }
  })
)
```

### Persistence → Domain Mapping

Services wrap persistence errors into domain errors:

```typescript
// Option 1: Wrap into domain error (preferred for expected failures)
const getMembership = (orgId: OrganizationId, userId: AuthUserId) =>
  membershipRepository.findByOrgAndUser(orgId, userId).pipe(
    Effect.flatMap((opt) =>
      Option.match(opt, {
        onNone: () => Effect.fail(new MembershipNotFoundError({ organizationId: orgId, userId })),
        onSome: Effect.succeed
      })
    )
  )

// Option 2: Let persistence errors propagate (for truly unexpected failures)
const listAllMembers = (orgId: OrganizationId) =>
  membershipRepository.findByOrganization(orgId)  // PersistenceError propagates
```

### When to Use `Effect.orDie`

Use `Effect.orDie` ONLY when a failure indicates a bug or data corruption:

```typescript
// User lookup during list - if the user doesn't exist, that's data corruption
const user = yield* userRepository.findById(membership.userId).pipe(
  Effect.flatMap(Option.match({
    onNone: () => Effect.die(new Error(`Data corruption: user ${membership.userId} not found`)),
    onSome: Effect.succeed
  }))
)
```

**WARNING:** Overusing `orDie` hides real errors. Only use for truly impossible states.

---

## Anti-Patterns to Avoid

### 1. Duplicating Domain Errors in API Layer

**Wrong:**
```typescript
// In ApiErrors.ts - DON'T duplicate domain errors
export class AuditLogError extends Schema.TaggedError<AuditLogError>()(
  "AuditLogError",
  { operation: Schema.String, cause: Schema.Defect },
  HttpApiSchema.annotations({ status: 500 })
) {}
```

**Right:** Map domain errors to generic API errors:
```typescript
// In handler
Effect.mapError((error) => {
  if (error._tag === "AuditLogError") {
    return new InternalServerError({
      message: `Audit log failed: ${error.operation}`,
      requestId: Option.none()
    })
  }
})
```

### 2. Using Global `Error` Class

**Wrong:**
```typescript
throw new Error("Something went wrong")
```

**Right:**
```typescript
Effect.fail(new BusinessRuleError({
  code: "SOMETHING_WRONG",
  message: "Something went wrong",
  details: Option.none()
}))
```

### 3. Catching Defects

**Wrong:**
```typescript
Effect.catchAllCause((cause) => ...)  // Catches bugs too!
```

**Right:**
```typescript
Effect.catchAll((error) => ...)  // Only catches expected errors
Effect.mapError((error) => ...)  // Transform without catching defects
```

### 4. HTTP Annotations in Domain Errors

**Wrong:**
```typescript
// In packages/core - DON'T add HTTP annotations
export class InvalidCredentialsError extends Schema.TaggedError<InvalidCredentialsError>()(
  "InvalidCredentialsError",
  { email: Email },
  HttpApiSchema.annotations({ status: 401 })  // NO! Core shouldn't know about HTTP
) {}
```

**Right:**
```typescript
// In packages/core - document status in comments only
/**
 * HTTP Status: 401 Unauthorized
 */
export class InvalidCredentialsError extends Schema.TaggedError<InvalidCredentialsError>()(
  "InvalidCredentialsError",
  { email: Email }
) {}
```

### 5. Silently Swallowing Errors

**Wrong:**
```typescript
yield* someOperation().pipe(
  Effect.catchAll(() => Effect.succeed(undefined))  // Silently swallows!
)
```

**Right:**
```typescript
yield* someOperation().pipe(
  Effect.catchAll((error) => {
    // Log the error
    yield* Effect.logError("Operation failed", error)
    // Fail with domain error
    return Effect.fail(new SomeOperationError({ cause: error }))
  })
)
```

### 6. Generic Fallback Without Logging

**Wrong:**
```typescript
Effect.mapError(() => new InternalServerError({ message: "Something went wrong" }))
```

**Right:**
```typescript
Effect.tapError((error) => Effect.logError("Unexpected error in handler", error)).pipe(
  Effect.mapError((error) => new InternalServerError({
    message: `Unexpected error: ${error._tag}`,
    requestId: Option.none()
  }))
)
```

---

## Creating New Errors

### Adding a Domain Error

1. **Create in appropriate module** under `packages/core/src/{Domain}/`:

```typescript
/**
 * HTTP Status: 400 Bad Request
 *
 * The provided value is invalid for the given context.
 */
export class InvalidValueError extends Schema.TaggedError<InvalidValueError>()(
  "InvalidValueError",
  {
    field: Schema.String.annotations({
      description: "The field that contains the invalid value"
    }),
    value: Schema.Unknown.annotations({
      description: "The invalid value that was provided"
    }),
    reason: Schema.String.annotations({
      description: "Why the value is invalid"
    })
  }
) {
  get message(): string {
    return `Invalid value for ${this.field}: ${this.reason}`
  }
}

export const isInvalidValueError = Schema.is(InvalidValueError)
```

2. **Add to status code map** (if module has one):

```typescript
export const MY_DOMAIN_ERROR_STATUS_CODES = {
  // ...existing errors
  InvalidValueError: 400
} as const
```

3. **Add to mapping table** in this spec document

4. **Update API handler** to map the new error

### Adding an API Error

**Only add new API errors if the existing generic errors don't fit.** Most cases should use:

- `NotFoundError` - any "not found" scenario
- `ValidationError` - any input validation failure
- `BusinessRuleError` - any business rule violation
- `ForbiddenError` - any permission denial
- `ConflictError` - any duplicate/conflict scenario
- `InternalServerError` - any unexpected failure

If you truly need a new API error:

1. **Add to** `packages/api/src/Definitions/ApiErrors.ts`:

```typescript
export class RateLimitedError extends Schema.TaggedError<RateLimitedError>()(
  "RateLimitedError",
  {
    retryAfter: Schema.Number.annotations({
      description: "Seconds to wait before retrying"
    }),
    limit: Schema.Number.annotations({
      description: "The rate limit that was exceeded"
    })
  },
  HttpApiSchema.annotations({ status: 429 })
) {
  get message(): string {
    return `Rate limit exceeded. Retry after ${this.retryAfter} seconds.`
  }
}

export const isRateLimitedError = Schema.is(RateLimitedError)
```

2. **Update this spec** with the new error in the API Error Catalog

---

## Known Issues and Cleanup Tasks

### Issue 1: Duplicate AuditLogError in API Layer

**Status:** Needs cleanup

**Location:** `packages/api/src/Definitions/ApiErrors.ts`

**Problem:** `AuditLogError` and `UserLookupError` are defined in both domain layer and API layer.

**Fix:** Remove from API layer. Map domain errors to `InternalServerError` instead.

```typescript
// In handler, map domain AuditLogError to InternalServerError
Effect.mapError((error) => {
  if (error._tag === "AuditLogError") {
    return new InternalServerError({
      message: `Audit operation failed: ${error.operation}`,
      requestId: Option.none()
    })
  }
})
```

### Issue 2: Duplicate RepositoryError in Core Package

**Status:** By design (acceptable)

**Location:** `packages/core/src/Errors/RepositoryError.ts`

**Reason:** Avoids circular dependency between `core` and `persistence` packages. The core package needs to reference persistence error types in service interfaces without importing from persistence.

**Decision:** Keep both, but ensure they are structurally identical.

### Issue 3: Inconsistent Type Guard Usage

**Status:** Low priority cleanup

**Problem:** Some handlers use `error._tag === "ErrorName"` instead of type guards.

**Fix:** Gradually migrate to type guard usage for better type safety:

```typescript
// Migrate from:
if (error._tag === "InvalidCredentialsError") { ... }

// To:
if (isInvalidCredentialsError(error)) { ... }
```

---

## Quick Reference

### Error Layer Summary

| Layer | Package | HTTP-Aware | Purpose |
|-------|---------|------------|---------|
| Persistence | `persistence` | No | Database operation errors |
| Domain | `core` | No (docs only) | Business logic errors |
| API | `api` | Yes | HTTP response errors |

### Key Principles

1. **Separation of concerns** - each layer has its own error vocabulary
2. **Explicit mapping** - use `mapError` to transform errors between layers
3. **No duplication** - don't recreate domain errors in API layer
4. **Rich semantics in domain** - domain errors carry business meaning
5. **Generic API errors** - API errors are reusable across endpoints
6. **Type guards for safety** - use `isErrorName()` for type-safe error handling
7. **Document HTTP status** - domain errors document status in JSDoc, not annotations
8. **Never swallow errors** - always log or propagate, never silently catch

### Adding a New Feature Checklist

When adding a feature that can fail:

- [ ] Define domain error(s) in `packages/core/src/{Domain}/{Domain}Errors.ts`
- [ ] Add JSDoc with HTTP status code
- [ ] Export type guard (`isMyError`)
- [ ] Add to status code map (if module has one)
- [ ] Update API handler with `mapError` to convert to API error
- [ ] Update this spec with new error mappings
- [ ] Add tests for error paths
