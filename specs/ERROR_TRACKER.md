# Error Tracker Specification

This document tracks all instances where errors are being swallowed, ignored, or where business rules are bent for testing purposes in the Accountability codebase.

## Summary

**Total Issues Found:** 15 instances across 9 files

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 6 | Business rules bent, data integrity at risk |
| MEDIUM | 5 | Audit/security gaps, cleanup failures |
| LOW | 4 | Minor data loss, debugging hindered |

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
- [ ] Remove test-specific code path - test infrastructure should use valid UUIDs
- [ ] Replace `Effect.option` with proper error handling that fails for invalid user IDs
- [ ] Remove `catchAll` wrapper - membership creation failure should fail the organization creation
- [ ] Add a transaction to ensure atomicity (org + membership created together or neither)

**Status:** ❌ Not Fixed

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
- [ ] Remove `catchAll` - policy seeding failure should fail organization creation
- [ ] Or: Add retry logic with eventual failure
- [ ] Log the error before swallowing if truly optional (but it shouldn't be)

**Status:** ❌ Not Fixed

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
- [ ] Replace `catchAll(() => [])` with proper error propagation
- [ ] Let callers decide how to handle policy loading failures
- [ ] At minimum, log the error before falling back to RBAC

**Status:** ❌ Not Fixed

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
- [ ] Remove `Effect.orElseSucceed` - let arithmetic errors propagate
- [ ] Use proper error handling that surfaces the calculation failure
- [ ] Consider what would cause `subtract` to fail and handle that case explicitly

**Status:** ❌ Not Fixed

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
- [ ] Log deletion failures even if proceeding with SessionExpiredError
- [ ] Consider background cleanup job for orphaned sessions
- [ ] Monitor session table growth

**Status:** ❌ Not Fixed

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
- [ ] Log logout failures
- [ ] Consider making this a hard error (fail refresh if can't cleanup old session)
- [ ] Add monitoring for users with multiple active sessions

**Status:** ❌ Not Fixed

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
- [ ] Log the lookup failure separately
- [ ] Store the userId even when displayName/email lookup fails
- [ ] Consider retry logic for transient failures

**Status:** ❌ Not Fixed

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
- [ ] Log parse errors with the raw JSON for investigation
- [ ] Consider a "raw_changes" fallback that stores unparsed JSON
- [ ] Alert on repeated parse failures (indicates corruption pattern)

**Status:** ❌ Not Fixed

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
- [ ] At minimum, log to console/error tracker when audit fails
- [ ] Consider queuing failed audit logs for retry
- [ ] Monitor audit log write failures

**Status:** ❌ Not Fixed

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
- [ ] Log parse errors with context
- [ ] Consider failing loudly for critical financial data

**Status:** ❌ Not Fixed

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
- [ ] Log parse errors
- [ ] Consider failing for corrupted validation data

**Status:** ❌ Not Fixed

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
- [ ] Log the actual error that prevented reading the body
- [ ] Include HTTP status code in fallback message

**Status:** ❌ Not Fixed

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
- [ ] Log the actual error that prevented reading the body
- [ ] Include HTTP status code in fallback message

**Status:** ❌ Not Fixed

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

**Solution:** Queue failed audits for retry; alert on audit failures.

### 4. JSON Corruption Handling
**Files:** AuditLogRepositoryLive.ts (line 67), ConsolidationRepositoryLive.ts (lines 468, 524)

Corrupted JSON data silently replaced with empty/none values.

**Root Cause:** Defensive coding to avoid crashing on bad data.

**Solution:** Log corruption, alert, and consider data migration to fix.

### 5. Graceful Degradation Masking Real Issues
**Files:** AuditLogServiceLive.ts (lines 180-187)

User lookup failures silently degrade audit logs.

**Root Cause:** Wanting audit log creation to succeed even when metadata lookup fails.

**Solution:** Log the degradation, store partial data with error flag.

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
2. ✅ Appropriate error type is returned or logged
3. ✅ Business rule is no longer bent
4. ✅ Unit tests verify correct error handling
5. ✅ Integration tests pass with proper test infrastructure
6. ✅ No regressions in existing functionality

---

## Progress Tracking

| Issue | Status | PR/Commit | Notes |
|-------|--------|-----------|-------|
| 1 | ❌ | - | Requires test infrastructure changes |
| 2 | ❌ | - | Blocked by Issue 1 |
| 3 | ❌ | - | 3 instances to fix |
| 4 | ❌ | - | Financial calculation fix |
| 5 | ❌ | - | - |
| 6 | ❌ | - | - |
| 7 | ❌ | - | - |
| 8 | ❌ | - | - |
| 9 | ❌ | - | - |
| 10 | ❌ | - | - |
| 11 | ❌ | - | - |
| 12 | ❌ | - | - |
| 13 | ❌ | - | - |
