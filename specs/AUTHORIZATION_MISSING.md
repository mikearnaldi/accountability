# Authorization - Missing Features

This document identifies features specified in AUTHORIZATION.md that are not yet implemented in the application.

---

## Overview

The authorization system has all 57 specification phases marked as complete. However, several features exist only at the backend level, have partial implementations, or are entirely missing from runtime. This document catalogs these gaps for future implementation.

---

## Critical Missing Features

### 1. Fiscal Period Management

**Status: NOT IMPLEMENTED**

The AUTHORIZATION.md spec defines actions for fiscal period management, but the application has no way to actually manage fiscal periods:

**What's Defined:**
- Actions: `fiscal_period:read`, `fiscal_period:open`, `fiscal_period:soft_close`, `fiscal_period:close`, `fiscal_period:lock`, `fiscal_period:reopen`
- Permission matrix with role-based access to these actions
- "Locked Period Protection" system policy to prevent journal entry modifications in locked periods

**What's Missing:**
- [ ] **No FiscalPeriodApi endpoints** - No API to create, open, close, or lock fiscal periods
- [ ] **No FiscalPeriodService** - No business logic for period state transitions
- [ ] **No FiscalPeriodRepository** - No database table for tracking period lock/close status
- [ ] **No Fiscal Period Management UI** - No pages to view or manage period states
- [ ] **Period status attribute** - ResourceMatcher supports `periodStatus` but there's no source of period status data

**Current Behavior:** Fiscal periods are computed automatically from journal entry dates as `FiscalPeriodRef` value objects. They are purely calculated, not managed entities.

**Impact:** The "Locked Period Protection" system policy cannot function because:
1. No period has a "Locked" status (there's no status to check)
2. Journal entries can be created/modified for any past date
3. Period-based access control is not enforceable

**Files Involved:**
- `packages/core/src/Domains/FiscalPeriodRef.ts` - Value object (read-only)
- `packages/core/src/Auth/Action.ts` - Actions defined but unused

---

### 2. Owner Transfer UI

**Status: BACKEND ONLY - NO UI**

The backend supports ownership transfer, but there's no way to trigger it from the UI:

**What's Implemented:**
- `POST /v1/organizations/:orgId/transfer-ownership` API endpoint
- `OrganizationMemberService.transferOwnership()` with business rules
- Validation: Target must be admin, atomic transaction

**What's Missing:**
- [ ] **Transfer ownership button/action** in members page
- [ ] **Confirmation modal** with warnings about implications
- [ ] **Role selection** for previous owner's new role (admin/member/viewer)
- [ ] **Visual indicator** showing who the current owner is

**Location:** Should be added to `/packages/web/src/routes/organizations/$organizationId/settings/members.tsx`

---

### 3. Platform Admin Management

**Status: DATABASE FIELD ONLY - NO MANAGEMENT**

Platform admin capability exists in the database but cannot be managed:

**What's Implemented:**
- `is_platform_admin` column in `auth_users` table
- Platform admin policy evaluation in authorization service
- "Platform Admin Full Access" system policy

**What's Missing:**
- [ ] **No admin console UI** to view/manage platform admins
- [ ] **No API endpoint** to set/unset platform admin status
- [ ] **No service method** to manage platform admins
- [ ] **No audit logging** for platform admin changes

**Note:** The spec states "Platform admin flag can only be set via database migration (not UI)" - this is by design. However, at minimum there should be a way to VIEW who the platform admins are.

---

### 4. Invitation Email Sending

**Status: TOKEN GENERATED - NO EMAIL SENT**

Invitations can be created and accepted, but there's no way to notify invitees:

**What's Implemented:**
- Invitation token generation (256-bit random, base64url encoded)
- Token hashing and storage
- Accept/decline invitation API endpoints
- UI to accept invitations (if you have the token URL)

**What's Missing:**
- [ ] **No email service integration** (Mailgun, SendGrid, AWS SES, etc.)
- [ ] **No invitation email template**
- [ ] **No background job system** for async email sending
- [ ] **No SMTP/email configuration**
- [ ] **No email queue/retry logic**

**Current Workaround:** The API returns the raw token in the response. The frontend could theoretically display this token for manual sharing, but there's no UI for this. Invitation acceptance requires knowing the token URL.

---

### 5. Environment Condition Runtime Evaluation

**Status: IMPLEMENTED BUT NOT INTEGRATED**

The ABAC policy engine has full environment matching logic, but it's never used at runtime:

**What's Implemented:**
- `EnvironmentMatcher.ts` with complete matching logic:
  - `matchesTimeOfDay()` - Time range matching (including overnight ranges)
  - `matchesDayOfWeek()` - Day-of-week matching
  - `matchesIPPattern()` - IPv4 CIDR and basic IPv6 matching
  - `matchesIPAllowList()` / `matchesIPDenyList()`
- Environment condition storage in policies
- UI to configure environment conditions (marked "Coming Soon")

**What's Missing:**
- [ ] **API middleware doesn't capture request context** - No extraction of:
  - Current time/date
  - Client IP address
  - User agent
- [ ] **PolicyEngine doesn't receive environment context** - Evaluation skips environment check when context undefined
- [ ] **IP address removed from UI** - Backend matcher exists but UI won't let you configure IP restrictions

**Files Involved:**
- `packages/api/src/Layers/OrganizationContextMiddlewareLive.ts` - Should capture environment context
- `packages/persistence/src/Layers/PolicyEngineLive.ts` - Skips environment when undefined
- `packages/web/src/components/policies/PolicyBuilderModal.tsx` - Has environment section but limited

---

### 6. Authorization Denial Audit Log Viewing

**Status: LOGGED BUT NOT VIEWABLE**

Authorization denials are logged to the database, but there's no UI to view them:

**What's Implemented:**
- `authorization_audit_log` table captures:
  - User, organization, action, resource type/id
  - Denial reason, matched policy IDs
  - IP address, user agent (when available)
- `AuthorizationAuditRepository` with `findByOrganization()` and `findByUser()`
- Denials logged via `AuthorizationServiceLive.checkPermission()`

**What's Missing:**
- [ ] **No authorization audit log UI** - Only data operation audit log is shown
- [ ] **No API endpoint** to query authorization denials via HTTP
- [ ] **No filtering/search** for denial logs
- [ ] **No denial alerts** or notifications

**Note:** The existing audit log page at `/organizations/:organizationId/audit-log` shows data operations (create/update/delete entities), not authorization denials.

---

## Partial Implementations

### 7. Member Removal/Reinstatement API Calls

**Status: UI EXISTS - API CALLS STUBBED**

The member actions menu has Remove and Reinstate buttons, but they don't actually call the API:

**What's Implemented:**
- UI buttons and confirmation dialogs
- Backend API endpoints (`DELETE /members/:userId`, `POST /members/:userId/reinstate`)
- Inactive members section showing removed members

**What's Missing (in members.tsx lines 574-602):**
```typescript
// Remove handler - TODO: Add actual API call
// Currently shows success message but doesn't call DELETE endpoint

// Reinstate handler - TODO: Add actual API call
// Currently shows success message but doesn't call POST reinstate endpoint
```

**Fix Required:**
- [ ] Replace stub implementations with actual `fetch()` calls to API
- [ ] Add error handling for API failures
- [ ] Refresh member list after successful actions

---

### 8. Member Suspension State

**Status: DEFINED BUT UNUSED**

The membership status includes "suspended" but it's never used:

**What's Implemented:**
- Database column: `status TEXT CHECK (status IN ('active', 'suspended', 'removed'))`
- `MembershipStatus.ts` union type includes `suspended`
- Permission checks validate `status = 'active'`

**What's Missing:**
- [ ] **No suspend action** in member actions menu
- [ ] **No API endpoint** to suspend a member
- [ ] **No service method** `suspendMember()`
- [ ] **No suspension reason/duration tracking**
- [ ] **No auto-unsuspend logic**

**Note:** The application only uses "active" and "removed" states. Suspension as a temporary state between them is not implemented.

---

### 9. Effective Permissions Display

**Status: CACHED INTERNALLY - NOT SHOWN TO USERS**

Permissions are calculated and cached, but users can't see what permissions they or others have:

**What's Implemented:**
- `AuthorizationService.getEffectivePermissions()` returns all allowed actions
- `usePermissions()` hook with `canPerform()` helper
- UI elements conditionally shown/hidden based on permissions
- Policy test modal shows allow/deny decision

**What's Missing:**
- [ ] **"View permissions" UI** to see all effective permissions for a user
- [ ] **Permission matrix visualization** showing role → action mappings
- [ ] **Member detail permission breakdown** in edit member modal
- [ ] **Policy impact preview** showing how a policy change affects permissions

**Spec Reference:** AUTHORIZATION.md shows "Effective Permissions View" mockup with checkmarks/crosses:
```
│ Effective Permissions:                      │
│ ✓ journal_entry:create                      │
│ ✓ journal_entry:edit                        │
│ ✓ journal_entry:post                        │
│ ✓ fiscal_period:open                        │
│ ✗ fiscal_period:lock (requires controller)  │
```

This UI component is not implemented.

---

## Lower Priority Missing Features

### 10. Rate Limiting for Invitations

**Spec States:** "Rate limit: max 10 invitations per org per hour"

**Status:** NOT IMPLEMENTED

- [ ] No rate limiting middleware
- [ ] No invitation count tracking
- [ ] No 429 Too Many Requests response

---

### 11. Invitation Uniqueness Constraint

**Spec States:** Unique constraint `(organization_id, email, status)` for pending invites

**Status:** IMPLEMENTED IN DATABASE

The database has this constraint, but the UI doesn't handle the duplicate invitation error gracefully:

- [ ] Friendlier error message when inviting same email twice
- [ ] Show existing pending invitation for that email

---

### 12. User Agent Capture for Audit

**Spec States:** Audit log should include IP address and user agent

**Status:** FIELDS EXIST - NOT CAPTURED

- [ ] Extract `User-Agent` header in API middleware
- [ ] Pass to authorization audit log

---

## Implementation Recommendations

### Phase 1: Quick Wins (Low effort, High impact)
1. **Complete member removal API calls** - Fix stub implementations (30 min)
2. **Add owner transfer modal** - UI for existing backend (2-3 hours)
3. **Show current owner indicator** - Visual badge in members list (30 min)

### Phase 2: Environment Integration (Medium effort)
4. **Capture request context in middleware** - Time, IP, user agent (2-3 hours)
5. **Pass environment to policy engine** - Enable time/IP restrictions (1-2 hours)
6. **Re-enable IP restrictions in policy builder** - Uncomment UI fields (30 min)

### Phase 3: Fiscal Period Management (High effort)
7. **Design fiscal period data model** - Period status table schema (1-2 hours)
8. **Create FiscalPeriodRepository** - Database operations (2-3 hours)
9. **Create FiscalPeriodService** - State transition logic (3-4 hours)
10. **Create FiscalPeriodApi** - REST endpoints (2-3 hours)
11. **Create Fiscal Period Management UI** - List/detail pages (4-6 hours)

### Phase 4: Email Service (High effort, External dependency)
12. **Choose email provider** - Mailgun, SendGrid, AWS SES
13. **Implement email service** - Provider integration
14. **Create invitation email template** - HTML email
15. **Add background job system** - Async email sending

### Phase 5: Admin Features (Medium effort)
16. **Create authorization audit log UI** - View denied access attempts
17. **Create platform admin viewer** - Read-only list of admins
18. **Create effective permissions viewer** - Permission matrix UI

---

## Files to Create/Modify

### New Files Needed:
- `packages/core/src/Domains/FiscalPeriod.ts` - Period entity (not just Ref)
- `packages/persistence/src/Services/FiscalPeriodRepository.ts` - Period storage
- `packages/core/src/FiscalPeriod/FiscalPeriodService.ts` - Period management
- `packages/api/src/Definitions/FiscalPeriodApi.ts` - Period API
- `packages/api/src/Layers/FiscalPeriodApiLive.ts` - Period API handlers
- `packages/web/src/routes/organizations/$organizationId/fiscal-periods/` - Period UI
- `packages/core/src/Email/EmailService.ts` - Email sending interface
- `packages/persistence/src/Services/EmailServiceLive.ts` - Email implementation
- `packages/web/src/components/members/TransferOwnershipModal.tsx` - Transfer UI
- `packages/web/src/components/members/EffectivePermissionsView.tsx` - Permission display

### Files to Modify:
- `packages/web/src/routes/organizations/$organizationId/settings/members.tsx`:
  - Complete removal/reinstatement API calls
  - Add owner transfer button and modal
  - Add owner indicator badge
- `packages/api/src/Layers/OrganizationContextMiddlewareLive.ts`:
  - Capture time, IP, user agent
  - Create environment context
- `packages/persistence/src/Layers/PolicyEngineLive.ts`:
  - Use environment context when available
- `packages/web/src/components/policies/PolicyBuilderModal.tsx`:
  - Re-enable IP restriction fields
  - Remove "Coming Soon" labels when environment evaluation works

---

## Testing Gaps

The following test coverage is missing for authorization features:

- [ ] E2E tests for owner transfer flow
- [ ] E2E tests for member removal/reinstatement
- [ ] Integration tests for environment condition evaluation
- [ ] E2E tests for fiscal period management (once implemented)
- [ ] Load tests for permission checking latency

---

## Related Specs

- [AUTHORIZATION.md](./AUTHORIZATION.md) - Full authorization specification
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Authentication system
- [API_BEST_PRACTICES.md](./API_BEST_PRACTICES.md) - API conventions
- [UI_ARCHITECTURE.md](./UI_ARCHITECTURE.md) - Frontend patterns
