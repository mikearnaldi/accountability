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

**Status: IMPLEMENTED** ✓

~~The backend supports ownership transfer, but there's no way to trigger it from the UI~~

**What's Implemented:**
- `POST /v1/organizations/:orgId/transfer-ownership` API endpoint
- `OrganizationMemberService.transferOwnership()` with business rules
- Validation: Target must be admin, atomic transaction
- [x] **Transfer ownership button/action** in members page - appears in owner's action menu
- [x] **Confirmation modal** with warnings about implications - two-step flow with warning
- [x] **Role selection** for previous owner's new role (admin/member/viewer)
- [x] **Visual indicator** showing who the current owner is - Crown icon next to Owner badge

**Workflow:**
1. Owner clicks their own action menu (three dots)
2. Selects "Transfer Ownership" action
3. Modal appears to select new owner (from admin members) and choose their new role
4. Clicking "Continue" shows confirmation with warnings
5. Clicking "Transfer Ownership" completes the transfer

**Files Modified:**
- `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` - Added TransferOwnershipModal, Crown icon indicator, transfer action in menu

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

### 4. Invitation Link Display

**Status: IMPLEMENTED** ✓

~~Invitations can be created and accepted, but the invitation link is not displayed for manual sharing~~

**What's Implemented:**
- Invitation token generation (256-bit random, base64url encoded)
- Token hashing and storage
- Accept/decline invitation API endpoints
- UI to accept invitations (if you have the token URL)
- [x] **API returns raw token in response** - `InviteMemberResponse` now includes `invitationToken` field
- [x] **Invitation link display** - After creating invitation, modal shows success view with shareable link
- [x] **Copy to clipboard button** - One-click copy with visual "Copied" feedback
- [x] **Link format display** - Shows `{origin}/invitations/{token}/accept`

**Workflow:**
1. Admin creates invitation in UI
2. UI displays the invitation link with copy button in success dialog
3. Admin manually shares link via email, Slack, etc.
4. Invitee clicks link to accept

**Files Modified:**
- `packages/api/src/Definitions/MembershipApi.ts` - Added `invitationToken` field to response
- `packages/api/src/Layers/MembershipApiLive.ts` - Return raw token from service
- `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` - Success view with link display and copy button

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

### 7. User Profile Page Broken Semantics

**Status: IMPLEMENTED** ✓

~~The profile page (`/profile`) has severe UX and semantic issues~~

**What's Implemented (Option B from suggested fixes):**
- [x] **Organization context preserved** - Fetches user's organizations and populates the selector
- [x] **Confusing "Role" field removed** - No longer shows meaningless global role
- [x] **"Your Organizations" section added** - Lists all organizations with roles:
  - Shows role badge with icon (Owner/Crown, Admin/Shield, Member/UserCircle, Viewer/Eye)
  - Shows functional roles if any (e.g., "General Ledger Controller")
  - Each organization is clickable, navigating to that org's dashboard
  - Empty state shows CTA to create organization
- [x] **Back navigation fixed** - Uses browser history when available, falls back to /organizations

**Implementation Details:**
- Profile page fetches `/api/v1/users/me/organizations` to get membership data
- Organizations are passed to AppLayout so the selector stays populated
- Back button uses `window.history.back()` if history exists, otherwise navigates to /organizations
- E2E tests updated to verify new behavior

**File Modified:** `packages/web/src/routes/profile.tsx`

---

## Partial Implementations

### 8. Member Removal/Reinstatement API Calls

**Status: IMPLEMENTED** ✓

~~The member actions menu has Remove and Reinstate buttons, but they don't actually call the API~~

**What's Implemented:**
- [x] UI buttons and confirmation dialogs
- [x] Backend API endpoints (`DELETE /members/:userId`, `POST /members/:userId/reinstate`)
- [x] Inactive members section showing removed members
- [x] **Remove handler** - calls `DELETE /api/v1/organizations/{orgId}/members/{userId}` with error handling
- [x] **Reinstate handler** - calls `POST /api/v1/organizations/{orgId}/members/{userId}/reinstate` with error handling
- [x] **Error display** - shows error message in actions menu if API call fails
- [x] **Auto-refresh** - refreshes member list after successful remove/reinstate

**Files Modified:**
- `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` - Updated `MemberActionsMenu` component with actual API calls

---

### 9. Member Suspension State

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

### 10. Effective Permissions Display

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

## Design Corrections

### Organization Selector Role Badges

**Status: IMPLEMENTED BUT SHOULD BE REMOVED**

The organization selector currently shows role badges next to each organization name. This adds unnecessary visual clutter to a simple selection component.

**Current Behavior:**
- `OrganizationSelector.tsx` displays role badges (Owner, Admin, Member, Viewer) next to org names
- Implemented in AUTHORIZATION.md Phase G3

**Correct Behavior:**
- Organization selector should simply list organization names
- Allow selection without showing roles
- Role information belongs on the Members page, not in the selector dropdown

**What Needs to Change:**
- [ ] Remove `RoleBadge` component usage from `OrganizationSelector.tsx`
- [ ] Remove role field from organization list items in selector
- [ ] Keep selector focused on its single purpose: switching organizations

**File:** `packages/web/src/components/layout/OrganizationSelector.tsx`

---

### Policies Page UX Issues

**Status: IMPLEMENTED BUT POOR UX**

The policies page shows policy summaries that are too vague to be useful, and system policies are listed but cannot be investigated.

**Current Problems:**

1. **Vague action counts** - Shows "4 actions" but no way to see which actions:
   ```
   Who: Owner, Admin, Member, Viewer
   What: Journal Entry (with conditions)
   Can: 4 actions
   ```

2. **System policies are opaque** - Listed but:
   - Cannot click to view details
   - Cannot see the actual conditions
   - Cannot understand what they do without reading code/spec

3. **No policy detail view** - No way to expand or click into a policy to see:
   - Full list of actions (not just count)
   - Actual conditions (not just "with conditions")
   - Environment restrictions if any

**What Needs to Change:**
- [ ] **Add expandable/detail view for policies** - Click to see full policy details
- [ ] **Show actual action list** - List the actions, not just "4 actions"
- [ ] **Show actual conditions** - Display attribute conditions in readable format
- [ ] **Consider removing system policies section** - Or make them viewable in read-only detail mode
- [ ] **Simplify the page** - Focus on custom policies that users can actually manage

**Alternative Approach:**
Remove the system policies section entirely from the UI. They're immutable and documented in the spec - showing them as grayed-out unclickable rows adds no value and creates confusion.

**File:** `packages/web/src/routes/organizations/$organizationId/settings/policies.tsx`

---

## Lower Priority Missing Features

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
1. ~~**Fix profile page** - Preserve org context, remove broken Role field, add memberships list (1-2 hours)~~ ✓ DONE
2. ~~**Show invitation link after creation** - Display shareable URL with copy button (30 min)~~ ✓ DONE
3. ~~**Complete member removal API calls** - Fix stub implementations (30 min)~~ ✓ DONE
4. ~~**Add owner transfer modal** - UI for existing backend (2-3 hours)~~ ✓ DONE
5. ~~**Show current owner indicator** - Visual badge in members list (30 min)~~ ✓ DONE (Crown icon)

### Phase 2: Environment Integration (Medium effort)
6. **Capture request context in middleware** - Time, IP, user agent (2-3 hours)
7. **Pass environment to policy engine** - Enable time/IP restrictions (1-2 hours)
8. **Re-enable IP restrictions in policy builder** - Uncomment UI fields (30 min)

### Phase 3: Fiscal Period Management (High effort)
9. **Design fiscal period data model** - Period status table schema (1-2 hours)
10. **Create FiscalPeriodRepository** - Database operations (2-3 hours)
11. **Create FiscalPeriodService** - State transition logic (3-4 hours)
12. **Create FiscalPeriodApi** - REST endpoints (2-3 hours)
13. **Create Fiscal Period Management UI** - List/detail pages (4-6 hours)

### Phase 4: Admin Features (Medium effort)
14. **Create authorization audit log UI** - View denied access attempts
15. **Create platform admin viewer** - Read-only list of admins
16. **Create effective permissions viewer** - Permission matrix UI

---

## Files to Create/Modify

### New Files Needed:
- `packages/core/src/Domains/FiscalPeriod.ts` - Period entity (not just Ref)
- `packages/persistence/src/Services/FiscalPeriodRepository.ts` - Period storage
- `packages/core/src/FiscalPeriod/FiscalPeriodService.ts` - Period management
- `packages/api/src/Definitions/FiscalPeriodApi.ts` - Period API
- `packages/api/src/Layers/FiscalPeriodApiLive.ts` - Period API handlers
- `packages/web/src/routes/organizations/$organizationId/fiscal-periods/` - Period UI
- `packages/web/src/components/members/TransferOwnershipModal.tsx` - Transfer UI
- `packages/web/src/components/members/EffectivePermissionsView.tsx` - Permission display

### Files to Modify:
- `packages/web/src/routes/profile.tsx`:
  - Fix organization context (don't clear org selector)
  - Remove or clarify meaningless "Role" field
  - Add "Your Organizations" section with roles
  - Fix back navigation
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
