# Error Tracker Specification

This document tracks all instances where errors are being swallowed, ignored, or where business rules are bent for testing purposes in the Accountability codebase.

## Core Principle: No Silent Failures

**Logging errors is NOT a valid fix.** Every single error must fail the request.

- If an operation can fail, that failure MUST propagate to the caller
- "Log and continue" is not acceptable - it hides problems and creates inconsistent state
- If something is truly optional, it should be modeled as optional in the type system, not caught and ignored at runtime
- The only valid responses to an error are: propagate it, recover with a well-defined fallback value that is part of the API contract, or transform it into a more appropriate error type

When fixing issues in this document:
- Remove `catchAll(() => succeed(...))` patterns entirely
- Do NOT replace them with `catchAll(() => { log(error); return succeed(...) })`
- Let errors propagate - the caller will handle them appropriately
- If an operation genuinely cannot fail the request, reconsider whether it should be in the request path at all

## Core Principle: Use Proper Domain Types

**If you need to call `.make()` or `Schema.decode` on a value that should already be typed, the source type is wrong.**

- Domain objects must use proper branded/newtype IDs, not primitive strings
- If `CurrentUser.sessionId` requires `SessionId.make(currentUser.sessionId)`, then `CurrentUser` should have `sessionId: SessionId` not `sessionId: string`
- Runtime conversions indicate type system gaps - fix the source, don't patch at usage sites
- Every manual type conversion is a potential runtime error waiting to happen

Signs of improper typing:
- `SomeId.make(obj.someId)` - the field should already be `SomeId`
- `Schema.decodeUnknown(SomeSchema)(obj.field)` on internal data - internal data should already be decoded
- Type assertions or casts on domain objects
- `as unknown as SomeType` patterns

## Summary

**Total Issues Found:** 17 instances across 10 files
**Issues Fixed:** 17 (All issues resolved)
**Issues Remaining:** 0

| Severity | Count | Fixed | Remaining | Description |
|----------|-------|-------|-----------|-------------|
| CRITICAL | 6 | 6 | 0 | Business rules bent, data integrity at risk |
| MEDIUM | 5 | 5 | 0 | Audit/security gaps, cleanup failures |
| LOW | 4 | 4 | 0 | Minor data loss, debugging hindered |
| TYPE | 2 | 2 | 0 | Domain objects using primitive types instead of branded types |

---

## CRITICAL Issues

### Issue 1: Organization Membership Creation for Test Tokens

**File:** `packages/api/src/Layers/CompaniesApiLive.ts`
**Lines:** 279-314

```typescript
// Line 279-281: Effect.option swallows all parsing errors
const maybeAuthUserId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
  Effect.option
)

// Line 311-313: Entire membership creation silently fails
yield* memberRepo.create(membership).pipe(
  Effect.catchAll(() => Effect.succeed(undefined))
)
```

**Problem:**
- Uses `Effect.option` to convert parse errors to `None` instead of proper error handling
- Membership creation is silently swallowed with `catchAll(() => succeed(undefined))`
- Comments explicitly mention this is for "test tokens" (`test tokens may use non-UUID IDs like "123"`)

**Business Rule Bent:** Users created via test tokens won't have membership records, breaking the fundamental assumption that organization creators are auto-added as owners.

**Fix:**
- [x] Remove test-specific code path - test infrastructure should use valid UUIDs
- [x] Replace `Effect.option` with proper error handling that fails for invalid user IDs
- [x] Remove `catchAll` wrapper - membership creation failure should fail the organization creation
- [ ] Add a transaction to ensure atomicity (org + membership created together or neither)

**Status:** ✅ Fixed (validation + membership creation propagate errors)

---

### Issue 2: System Policy Seeding Silent Failure

**File:** `packages/api/src/Layers/CompaniesApiLive.ts`
**Lines:** 319-321

```typescript
yield* seedSystemPolicies(createdOrg.id, policyRepo).pipe(
  Effect.catchAll(() => Effect.succeed(undefined))
)
```

**Problem:**
- System policies are baseline access controls that must always exist
- Silent failure leaves organizations in inconsistent state
- Comment says error is "intentionally handled" but provides no fallback or logging

**Business Rule Bent:** Organizations created without system policies will have no baseline access controls, potentially leaving them inaccessible or with incorrect permissions.

**Fix:**
- [x] Remove `catchAll` - policy seeding failure should fail organization creation
- [ ] Or: Add retry logic with eventual failure
- [x] Policy seeding is NOT optional - organization creation must fail if policies cannot be seeded

**Status:** ✅ Fixed (policy seeding errors now propagate as BusinessRuleError)

---

### Issue 3: Policy Loading Falls Back to Empty Array (3 instances)

**File:** `packages/persistence/src/Layers/AuthorizationServiceLive.ts`
**Lines:** 197, 303, 385

```typescript
// Each instance follows this pattern:
const policies = yield* policyRepo
  .findActiveByOrganization(membership.organizationId)
  .pipe(Effect.catchAll(() => Effect.succeed([] as const)))
```

**Problem:**
- **THREE instances** of silently swallowing policy load errors
- Falls back to empty array (`[]`), triggering RBAC-only fallback path
- Database errors, network issues, or corruption silently downgrade authorization

**Business Rule Bent:** Permissions are silently downgraded when policy database has issues. Users may get more or fewer permissions than intended without any indication of the problem.

**Affected Functions:**
- Line 197: `isAllowed` (main authorization check)
- Line 303: `isAllowedMultiple` (multi-action check)
- Line 385: `listPermissions` (permission enumeration)

**Fix:**
- [x] Replace `catchAll(() => [])` with proper error propagation
- [x] Let callers decide how to handle policy loading failures
- [x] Authorization must fail if policies cannot be loaded - silent fallback to RBAC is NOT acceptable

**Status:** ✅ Fixed (PolicyLoadError now propagates through interface)

---

### Issue 4: Variance Calculation Error Hidden

**File:** `packages/core/src/Services/IntercompanyService.ts`
**Line:** 807

```typescript
totalVarianceAmount = Effect.runSync(
  Effect.map(
    subtract(totalVarianceAmount, variance.negate()),
    (result) => result
  ).pipe(Effect.orElseSucceed(() => totalVarianceAmount))
)
```

**Problem:**
- Uses `Effect.orElseSucceed` to replace calculation error with pre-calculation amount
- Variance calculation errors are completely hidden
- Financial calculations should never silently fail

**Business Rule Bent:** Calculation errors in consolidation variance reconciliation produce incorrect variance amounts in financial reports without any indication.

**Fix:**
- [x] Remove `Effect.orElseSucceed` - let arithmetic errors propagate
- [x] Use proper error handling that surfaces the calculation failure
- [x] Consider what would cause `subtract` to fail and handle that case explicitly

**Status:** ✅ Fixed (CurrencyMismatchError now propagates through interface)

---

## MEDIUM Issues

### Issue 5: Session Deletion on Expiry Ignored

**File:** `packages/persistence/src/Layers/AuthServiceLive.ts`
**Lines:** 477-481

```typescript
// Delete expired session - errors are intentionally ignored
// since the main goal is to fail with SessionExpiredError
yield* sessionRepo.delete(sessionId).pipe(
  Effect.catchAll(() => Effect.succeed(undefined))
)
```

**Problem:**
- Failed session deletions are silently ignored
- Expired sessions accumulate in database if delete consistently fails
- No audit trail of cleanup failures

**Business Rule Bent:** Session cleanup is not guaranteed, potentially leaving stale session data in the database.

**Fix:**
- [x] Session deletion failure should fail the request - don't proceed with SessionExpiredError if cleanup fails
- [ ] Or: Move session cleanup to a background job that retries failures
- [x] Stale sessions are a security risk - cleanup failures must be addressed, not ignored

**Status:** ✅ Fixed (SessionCleanupError now propagates through interface)

---

### Issue 6: Old Session Logout Ignored During Refresh

**File:** `packages/api/src/Layers/AuthApiLive.ts`
**Lines:** 594-598

```typescript
// Logout old session - errors are intentionally ignored during refresh
// since we want to proceed with creating a new session even if logout fails
yield* authService.logout(sessionId).pipe(
  Effect.catchAll(() => Effect.succeed(undefined))
)
```

**Problem:**
- Old sessions may not be cleaned up when refresh fails to logout
- Could lead to multiple active sessions for same user
- Session hijacking risk if old session remains valid

**Business Rule Bent:** Session lifecycle management is not guaranteed, potentially leaving security vulnerabilities.

**Fix:**
- [x] Make this a hard error - fail refresh if can't cleanup old session
- [x] Multiple active sessions per user is a security risk
- [x] Session refresh must be atomic: cleanup old + create new, or neither

**Status:** ✅ Fixed (refresh endpoint maps logout failure to SessionInvalidError)

---

### Issue 7: Audit Log User Info Lookup Failure

**File:** `packages/persistence/src/Layers/AuditLogServiceLive.ts`
**Lines:** 180-187

```typescript
// If lookup fails, gracefully degrade to no user info
Effect.catchAll(() =>
  Effect.succeed({
    displayName: Option.none<string>(),
    email: Option.none<string>()
  })
)
```

**Problem:**
- User lookup failures result in audit logs missing actor information
- Compliance/audit trail integrity is compromised
- No way to know who performed an action if lookup failed

**Business Rule Bent:** Audit trail may be incomplete, which could violate compliance requirements.

**Fix:**
- [x] User lookup failure should fail audit log creation - incomplete audit data is worse than no audit data
- [x] Added UserLookupError that propagates through the type system
- [x] Audit integrity is non-negotiable - partial data hides compliance gaps

**Status:** ✅ Fixed (UserLookupError now propagates through AuditLogService interface)

---

### Issue 8: Audit Changes JSON Parsing Silently Fails

**File:** `packages/persistence/src/Layers/AuditLogRepositoryLive.ts`
**Lines:** 67-71

```typescript
const changesOption: Option.Option<AuditChanges> = row.changes !== null
  ? yield* AuditChangesFromUnknown(row.changes).pipe(
      Effect.map((c): Option.Option<AuditChanges> => Option.some(c)),
      Effect.catchAll(() => Effect.succeed(Option.none<AuditChanges>()))
    )
  : Option.none<AuditChanges>()
```

**Problem:**
- Corrupted or unparseable audit change JSON returns `None` instead of failing
- Audit log entries lose their change details silently
- Compliance/audit trail integrity compromised

**Business Rule Bent:** Historical audit data may become inaccessible without any indication of data corruption.

**Fix:**
- [x] Parse failures should fail the request - don't return audit entries with missing change data
- [x] If data is corrupted, surface the corruption to the caller as an error
- [x] Data integrity issues must be visible, not hidden behind Option.none()

**Status:** ✅ Fixed (AuditDataCorruptionError now propagates through AuditLogRepository interface)

---

### Issue 9: Permission Denial Audit Logging Fire-and-Forget

**File:** `packages/persistence/src/Layers/AuthorizationServiceLive.ts`
**Lines:** 266-273

```typescript
// Log the denial to audit log (fire-and-forget, don't block on logging)
// Error is intentionally handled - permission denial should still fail with
// PermissionDeniedError even if the audit logging fails
yield* auditRepo
  .logDenial(auditEntry)
  .pipe(
    Effect.catchAll(() => Effect.succeed(undefined))
  )
```

**Problem:**
- Security-critical operation uses "fire-and-forget" pattern
- If logging fails, no record of denied access attempt exists
- Could hide attack patterns or unauthorized access attempts

**Business Rule Bent:** Security audit trail may have gaps, potentially violating security compliance requirements.

**Fix:**
- [x] Audit logging failure should fail the permission denial response
- [x] Security audit gaps are unacceptable - if we can't record the denial, the request must fail
- [ ] Or: Use a transactional approach where denial + audit happen atomically

**Status:** ✅ Fixed (AuthorizationAuditError now propagates through interface)

---

## LOW Issues

### Issue 10: Consolidation Line Items JSON Parsing

**File:** `packages/persistence/src/Layers/ConsolidationRepositoryLive.ts`
**Line:** 468

```typescript
const lineItemsRaw = yield* Schema.decodeUnknown(Schema.Array(LineItemSchema))(row.line_items).pipe(
  Effect.catchAll(() => Effect.succeed([]))
)
```

**Problem:**
- Corrupted line items JSON replaced with empty array
- Consolidation trial balance could lose account details silently

**Fix:**
- [x] Parse failures must fail the request - financial data corruption cannot be silent
- [x] Empty array fallback hides data integrity issues
- [x] Fail fast so the problem is discovered and fixed
- [x] Added ConsolidationDataCorruptionError that propagates through the type system
- [x] Updated loadConsolidatedTrialBalance to use mapError instead of catchAll

**Status:** ✅ Fixed (ConsolidationDataCorruptionError now propagates through ConsolidationRepository interface)

---

### Issue 11: Consolidation Validation Result Parsing

**File:** `packages/persistence/src/Layers/ConsolidationRepositoryLive.ts`
**Line:** 524

```typescript
Effect.catchAll(() => Effect.succeed(Option.none<ValidationResult>()))
```

**Problem:**
- Validation result JSON corruption silently loses validation details
- Consolidation validation history becomes incomplete

**Fix:**
- [x] Parse failures must fail the request
- [x] Corrupted validation data indicates a serious problem that needs immediate attention
- [x] Updated rowToConsolidationRun to use mapError instead of catchAll for validation_result
- [x] Updated rowToConsolidationRun to use mapError instead of catchAll for options
- [x] Both now return ConsolidationDataCorruptionError on parse failures

**Status:** ✅ Fixed (ConsolidationDataCorruptionError now propagates through ConsolidationRepository interface)

---

### Issue 12: Google OAuth Error Body Reading (2 instances)

**File:** `packages/persistence/src/Layers/GoogleAuthProviderLive.ts`
**Lines:** 208, 255

```typescript
const errorBody = yield* tokenResponse.text.pipe(
  Effect.catchAll(() => Effect.succeed("Unknown error"))
)
```

**Problem:**
- HTTP error response body reading fails silently
- OAuth authentication failure debugging is hindered

**Fix:**
- [x] If we can't read the error body, include what we know (status code, headers) in the error
- [x] Don't fallback to "Unknown error" - propagate a structured error with available context
- [x] The auth failure itself should already be failing the request; ensure error details are preserved
- [x] Changed to mapError that includes status code and body read error details

**Status:** ✅ Fixed (both instances now use mapError with detailed error messages)

---

### Issue 13: WorkOS OAuth Error Body Reading

**File:** `packages/persistence/src/Layers/WorkOSAuthProviderLive.ts`
**Line:** 201

```typescript
const errorBody = yield* tokenResponse.text.pipe(
  Effect.catchAll(() => Effect.succeed("Unknown error"))
)
```

**Problem:**
- Same as Google OAuth - error body reading fails silently
- WorkOS authentication failure debugging is hindered

**Fix:**
- [x] If we can't read the error body, include what we know (status code, headers) in the error
- [x] Don't fallback to "Unknown error" - propagate a structured error with available context
- [x] The auth failure itself should already be failing the request; ensure error details are preserved
- [x] Changed to mapError that includes status code and body read error details

**Status:** ✅ Fixed (now uses mapError with detailed error messages)

---

## Type System Issues

These are logical mistakes where domain objects don't use proper types, requiring runtime conversions that should be unnecessary.

### Issue 14: CurrentUser Uses Primitive Strings Instead of Branded Types

**File:** `packages/api/src/Layers/AuthApiLive.ts`
**Line:** 580

```typescript
const sessionId = SessionId.make(currentUser.sessionId)
```

**Problem:**
- `CurrentUser.sessionId` is typed as `string` instead of `SessionId`
- Every usage site must call `SessionId.make()` to get a properly typed value
- This is error-prone and indicates the `CurrentUser` type is incorrectly defined

**Business Rule Bent:** Type safety is circumvented - the compiler can't catch misuse of session IDs because they're stored as plain strings.

**Fix:**
- [x] Update `CurrentUser` schema to use `SessionId` type for the `sessionId` field
- [x] Update `CurrentUser` schema to use `AuthUserId` type for the `userId` field
- [x] Remove all `SomeId.make(currentUser.field)` conversions - they should be unnecessary
- [x] Updated User class in AuthMiddleware.ts to use branded types
- [x] Updated all token validators to properly validate and decode user IDs
- [x] Updated all test files to use valid UUID tokens

**Status:** ✅ Fixed (User class now uses AuthUserId and SessionId branded types)

---

### Issue 15: CurrentUser.userId Requires Schema.decodeUnknown

**File:** `packages/api/src/Layers/CompaniesApiLive.ts`
**Lines:** 279-281

```typescript
const maybeAuthUserId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
  Effect.option
)
```

**Problem:**
- `CurrentUser.userId` is typed as `string` instead of `AuthUserId`
- Code must decode it at runtime, which can fail
- The `Effect.option` swallows decode failures (see Issue 1)

**Business Rule Bent:** Internal data requires runtime validation that should be guaranteed by the type system.

**Fix:**
- [x] Update `CurrentUser` schema to use `AuthUserId` type for the `userId` field
- [x] This decode should become unnecessary once the type is correct
- [x] If test tokens need non-UUID IDs, fix the test infrastructure, don't weaken the types
- [x] Fixed test tokens to use valid UUID format instead of numeric IDs like "123"
- [x] Added test case for non-UUID user ID rejection

**Status:** ✅ Fixed (User.userId is now typed as AuthUserId, test tokens use valid UUIDs)

---

## Patterns Detected

### 1. Test-Environment-Specific Code Bending
**Files:** CompaniesApiLive.ts (lines 279-321)

Code explicitly accommodates "test tokens" (non-UUID user IDs like "123"), bending business rules to allow tests to pass without proper user records.

**Root Cause:** Test infrastructure uses simple tokens instead of proper test users.

**Solution:** Fix test infrastructure to create proper test users with valid UUIDs.

### 2. Silent Fallback to Weaker Checks
**Files:** AuthorizationServiceLive.ts (lines 197, 303, 385)

ABAC policy loading errors cause silent downgrade to RBAC-only authorization.

**Root Cause:** Defensive coding that prioritizes availability over correctness.

**Solution:** Fail fast for authorization system errors; let the application surface them.

### 3. Fire-and-Forget Audit Logging
**Files:** AuthorizationServiceLive.ts (lines 266-273)

Security-critical audit logging uses fire-and-forget pattern.

**Root Cause:** Not wanting to block the main operation for logging.

**Solution:** Audit logging must be part of the operation - if audit fails, the operation fails. Security audit gaps are unacceptable.

### 4. JSON Corruption Handling
**Files:** AuditLogRepositoryLive.ts (line 67), ConsolidationRepositoryLive.ts (lines 468, 524)

Corrupted JSON data silently replaced with empty/none values.

**Root Cause:** Defensive coding to avoid crashing on bad data.

**Solution:** Fail the request with a clear corruption error. Data corruption must be surfaced immediately, not hidden.

### 5. Graceful Degradation Masking Real Issues
**Files:** AuditLogServiceLive.ts (lines 180-187)

User lookup failures silently degrade audit logs.

**Root Cause:** Wanting audit log creation to succeed even when metadata lookup fails.

**Solution:** Fail the audit log creation. Incomplete audit data is worse than failing the operation - it creates false confidence in audit completeness.

### 6. Primitive Types in Domain Objects
**Files:** CurrentUser type definition, AuthApiLive.ts, CompaniesApiLive.ts

Domain objects use primitive `string` types instead of branded types like `SessionId`, `AuthUserId`.

**Root Cause:** Likely evolved from early prototyping or external API boundaries not being properly mapped to domain types.

**Solution:** Update domain object schemas to use proper branded types. Remove all `.make()` and `Schema.decodeUnknown()` calls on internal data - if the type system is correct, these conversions are unnecessary.

---

## Implementation Priority

### Phase 1: Critical Business Rules (High Priority)
1. Fix CompaniesApiLive.ts test token accommodation (Issues 1, 2)
2. Fix AuthorizationServiceLive.ts policy loading fallback (Issue 3)
3. Fix IntercompanyService.ts variance calculation (Issue 4)

### Phase 2: Security and Audit (Medium Priority)
4. Fix permission denial audit logging (Issue 9)
5. Fix session cleanup (Issues 5, 6)
6. Fix audit log data integrity (Issues 7, 8)

### Phase 3: Data Integrity (Low Priority)
7. Fix consolidation JSON parsing (Issues 10, 11)
8. Improve OAuth error handling (Issues 12, 13)

### Phase 4: Type System Cleanup
9. Fix CurrentUser to use branded types (Issues 14, 15) - this will also simplify fixes for Issues 1, 2

---

## Test Infrastructure Changes Required

The root cause of Issues 1-2 is that test infrastructure uses non-UUID user IDs. To fix this properly:

1. **Update test token validator** to require valid UUID format for user IDs
2. **Create test user fixtures** in `auth_users` table for integration tests
3. **Update existing tests** to use proper test users instead of simple tokens
4. **Remove the test-specific code paths** once tests are updated

---

## Acceptance Criteria

For each issue to be marked as fixed:

1. ✅ Error is no longer swallowed silently
2. ✅ Error propagates and fails the request (logging alone is NOT acceptable)
3. ✅ Business rule is no longer bent
4. ✅ Unit tests verify correct error handling (error cases return errors, not success)
5. ✅ Integration tests pass with proper test infrastructure
6. ✅ No regressions in existing functionality

---

## Progress Tracking

| Issue | Status | PR/Commit | Notes |
|-------|--------|-----------|-------|
| 1 | ✅ | - | User ID validation + membership creation must succeed |
| 2 | ✅ | - | Policy seeding failure now fails organization creation |
| 3 | ✅ | - | PolicyLoadError now propagates in AuthorizationService |
| 4 | ✅ | - | CurrencyMismatchError now propagates in IntercompanyService |
| 5 | ✅ | - | SessionCleanupError now propagates in validateSession |
| 6 | ✅ | - | Refresh endpoint fails if old session cleanup fails |
| 7 | ✅ | - | UserLookupError now propagates through AuditLogService |
| 8 | ✅ | - | AuditDataCorruptionError now propagates through AuditLogRepository |
| 9 | ✅ | - | AuthorizationAuditError now propagates in checkPermission |
| 10 | ✅ | - | ConsolidationDataCorruptionError now propagates for line_items |
| 11 | ✅ | - | ConsolidationDataCorruptionError now propagates for validation_result |
| 12 | ✅ | - | Google OAuth uses mapError with detailed error messages |
| 13 | ✅ | - | WorkOS OAuth uses mapError with detailed error messages |
| 14 | ✅ | - | User.sessionId is now typed as SessionId (branded type) |
| 15 | ✅ | - | User.userId is now typed as AuthUserId (branded type) |
