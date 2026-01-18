# Authorization - Missing Features

This document identifies features specified in AUTHORIZATION.md that are not yet implemented in the application.

---

## Overview

The authorization system has all 57 specification phases marked as complete. However, several features exist only at the backend level, have partial implementations, or are entirely missing from runtime. This document catalogs these gaps for future implementation.

---

## Critical Missing Features

### 1. Fiscal Period Management

**Status: IN PROGRESS**

The AUTHORIZATION.md spec defines actions for fiscal period management. Implementation is underway:

**What's Defined:**
- Actions: `fiscal_period:read`, `fiscal_period:open`, `fiscal_period:soft_close`, `fiscal_period:close`, `fiscal_period:lock`, `fiscal_period:reopen`
- Permission matrix with role-based access to these actions
- "Locked Period Protection" system policy to prevent journal entry modifications in locked periods

**What's Implemented:**
- [x] **Domain models** - `FiscalYear`, `FiscalPeriod`, `FiscalPeriodStatus`, `FiscalPeriodType`, `FiscalYearStatus`
  - `packages/core/src/Domains/FiscalYear.ts` - Fiscal year entity with status tracking
  - `packages/core/src/Domains/FiscalPeriod.ts` - Fiscal period entity with status tracking
  - `packages/core/src/Domains/FiscalPeriodStatus.ts` - Status enum (Future/Open/SoftClose/Closed/Locked)
  - `packages/core/src/Domains/FiscalPeriodType.ts` - Type enum (Regular/Adjustment/Closing)
  - `packages/core/src/Domains/FiscalYearStatus.ts` - Year status enum (Open/Closing/Closed)
- [x] **Database tables** - Already exist from Migration0004 (fiscal_years, fiscal_periods, period_reopen_audit_entries)
- [x] **FiscalPeriodRepository** - Full CRUD operations for fiscal years and periods
  - `packages/persistence/src/Services/FiscalPeriodRepository.ts` - Repository interface
  - `packages/persistence/src/Layers/FiscalPeriodRepositoryLive.ts` - PostgreSQL implementation
- [x] **FiscalPeriodService** - Business logic for period state transitions and validation
  - `packages/core/src/FiscalPeriod/FiscalPeriodService.ts` - Service interface with operations for fiscal years and periods
  - `packages/core/src/FiscalPeriod/FiscalPeriodErrors.ts` - Tagged error types for fiscal period operations
  - `packages/persistence/src/Layers/FiscalPeriodServiceLive.ts` - Service implementation

**What's Missing:**
- [ ] **FiscalPeriodApi endpoints** - REST API to create, open, close, or lock fiscal periods
- [ ] **Fiscal Period Management UI** - Pages to view or manage period states
- [ ] **Period status integration** - Connect ResourceMatcher `periodStatus` attribute to actual period data

**Current Behavior:** Fiscal periods can be persisted, queried, and managed through the service layer. The service provides:
- Fiscal year creation with validation for duplicates
- Period generation with standard monthly schedule
- Period status transitions (Future → Open → SoftClose → Closed → Locked)
- Period reopening with audit trail
- Status queries for authorization checks (isPeriodOpenForEntries, isPeriodOpenForModifications)

**Impact:** The "Locked Period Protection" system policy cannot function until:
1. ~~FiscalPeriodService implements period creation and status transitions~~ ✓ Done
2. FiscalPeriodApi exposes endpoints for period management
3. Period status is integrated with journal entry authorization checks

**Files Created:**
- `packages/core/src/Domains/FiscalYear.ts` - Fiscal year domain entity
- `packages/core/src/Domains/FiscalPeriod.ts` - Fiscal period domain entity
- `packages/core/src/Domains/FiscalPeriodStatus.ts` - Period status enum
- `packages/core/src/Domains/FiscalPeriodType.ts` - Period type enum
- `packages/core/src/Domains/FiscalYearStatus.ts` - Year status enum
- `packages/persistence/src/Services/FiscalPeriodRepository.ts` - Repository interface
- `packages/persistence/src/Layers/FiscalPeriodRepositoryLive.ts` - Repository implementation
- `packages/core/src/FiscalPeriod/FiscalPeriodService.ts` - Service interface
- `packages/core/src/FiscalPeriod/FiscalPeriodErrors.ts` - Error definitions
- `packages/persistence/src/Layers/FiscalPeriodServiceLive.ts` - Service implementation

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

**Status: IMPLEMENTED (READ-ONLY VIEWER)** ✓

Platform admin capability exists in the database with a read-only viewer for platform administrators:

**What's Implemented:**
- `is_platform_admin` column in `auth_users` table
- Platform admin policy evaluation in authorization service
- "Platform Admin Full Access" system policy
- [x] **Platform Admin API endpoint** - `GET /api/v1/platform-admins` returns list of all platform admins
- [x] **isPlatformAdmin repository method** - Checks if a user has platform admin status
- [x] **Platform Admin viewer UI** - `/platform-admins` page showing all platform administrators
  - Only accessible to platform administrators (403 for non-admins)
  - Shows admin name, email, and member since date
  - Access denied state for non-admin users
  - Info banner explaining platform admin access level

**By Design (Not Implemented):**
- **No API to set/unset platform admin status** - This is intentional per spec: "Platform admin flag can only be set via database migration (not UI)"
- **No audit logging for platform admin changes** - Changes happen via migrations, not runtime operations

**Files Added:**
- `packages/persistence/src/Services/UserRepository.ts` - Added `findPlatformAdmins()` and `isPlatformAdmin()` methods
- `packages/persistence/src/Layers/UserRepositoryLive.ts` - Implementations for new methods
- `packages/api/src/Definitions/PlatformAdminApi.ts` - API definition
- `packages/api/src/Layers/PlatformAdminApiLive.ts` - API handler
- `packages/web/src/routes/platform-admins.tsx` - UI page

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

**Status: IMPLEMENTED** ✓

~~The ABAC policy engine has full environment matching logic, but it's never used at runtime~~

**What's Implemented:**
- `EnvironmentMatcher.ts` with complete matching logic:
  - `matchesTimeOfDay()` - Time range matching (including overnight ranges)
  - `matchesDayOfWeek()` - Day-of-week matching
  - `matchesIPPattern()` - IPv4 CIDR and basic IPv6 matching
  - `matchesIPAllowList()` / `matchesIPDenyList()`
- Environment condition storage in policies
- UI to configure environment conditions (marked "Coming Soon")
- [x] **API middleware captures request context** - `OrganizationContextMiddlewareLive.ts` provides:
  - `captureEnvironmentContext` - Captures current time, day of week, IP address, user agent
  - `getClientIP()` - Extracts IP from X-Forwarded-For, X-Real-IP, CF-Connecting-IP, or socket
  - `withEnvironmentContext()` - Wraps effects to provide `CurrentEnvironmentContext`
- [x] **PolicyEngine receives environment context** - `AuthorizationServiceLive.checkPermission()`:
  - Reads `CurrentEnvironmentContext` from effect context when available
  - Passes to `PolicyEvaluationContext.environment` for ABAC evaluation
  - Falls back gracefully when environment context not provided (e.g., in tests)
- [x] **Audit log includes IP/user agent** - Denial logs now capture ipAddress and userAgent

**What's Implemented (UI):**
- [x] **IP address fields in policy builder** - IP Allow List and IP Deny List fields with CIDR support

**Files Involved:**
- `packages/core/src/Auth/CurrentEnvironmentContext.ts` - Service tag and helpers for environment context
- `packages/api/src/Layers/OrganizationContextMiddlewareLive.ts` - Captures environment from HTTP request
- `packages/persistence/src/Layers/AuthorizationServiceLive.ts` - Uses environment in policy evaluation
- `packages/web/src/components/policies/PolicyBuilderModal.tsx` - Has environment section but limited (Coming Soon)

---

### 6. Authorization Denial Audit Log Viewing

**Status: IMPLEMENTED** ✓

~~Authorization denials are logged to the database, but there's no UI to view them~~

**What's Implemented:**
- `authorization_audit_log` table captures:
  - User, organization, action, resource type/id
  - Denial reason, matched policy IDs
  - IP address, user agent (when available)
- `AuthorizationAuditRepository` with `findByOrganization()` and `findByUser()`
- Denials logged via `AuthorizationServiceLive.checkPermission()`
- [x] **Authorization Audit API** - `GET /api/v1/organizations/{orgId}/authorization-audit` endpoint
- [x] **Authorization Audit UI** - `/organizations/:orgId/settings/authorization-audit` page
- [x] **Filtering/search** - Resource type and date range filters
- [ ] **Denial alerts** - Notifications not yet implemented (lower priority)

**Files Added:**
- `packages/api/src/Definitions/AuthorizationAuditApi.ts` - API definition
- `packages/api/src/Layers/AuthorizationAuditApiLive.ts` - API implementation
- `packages/web/src/routes/organizations/$organizationId/settings/authorization-audit.tsx` - UI page

**Note:** The existing audit log page at `/organizations/:organizationId/audit-log` shows data operations (create/update/delete entities), while the new authorization audit page shows denied access attempts.

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

**Status: IMPLEMENTED** ✓

~~Permissions are calculated and cached, but users can't see what permissions they or others have~~

**What's Implemented:**
- `AuthorizationService.getEffectivePermissions()` returns all allowed actions
- `usePermissions()` hook with `canPerform()` helper
- UI elements conditionally shown/hidden based on permissions
- Policy test modal shows allow/deny decision
- [x] **"My Permissions" button** on Members page to view current user's effective permissions
- [x] **Permission matrix visualization** showing categorized actions with allowed/denied indicators
- [x] **EffectivePermissionsView component** with expandable categories:
  - Organization, Companies, Chart of Accounts, Journal Entries
  - Fiscal Periods, Consolidation, Reports, Exchange Rates, Audit Log
  - Shows count (allowed/total) for each category
  - Visual indicators (green checkmarks, gray X marks) for each action
- [x] **EffectivePermissionsModal** displaying:
  - User info (name, email)
  - Base role badge
  - Functional roles badges
  - Full categorized permissions view

**Files Added:**
- `packages/web/src/components/members/EffectivePermissionsView.tsx` - Reusable permission display component
- Updated `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` - Added modal and button

**What's NOT Implemented (Lower Priority):**
- [ ] **View other members' permissions** - Would require new API endpoint to fetch permissions for arbitrary users
- [ ] **Policy impact preview** - Would show how a policy change affects permissions before saving

---

## Design Corrections

### Organization Selector Role Badges

**Status: IMPLEMENTED** ✓

~~The organization selector currently shows role badges next to each organization name. This adds unnecessary visual clutter to a simple selection component.~~

**What Was Fixed:**
- [x] Removed `RoleBadge` component usage from the dropdown list in `OrganizationSelector.tsx`
- [x] Organization selector now shows only organization names and currency
- [x] Selector is focused on its single purpose: switching organizations
- [x] `RoleBadge` component is kept and used on Members page where it's contextually relevant

**File Modified:** `packages/web/src/components/layout/OrganizationSelector.tsx`

---

### Policies Page UX Issues

**Status: IMPLEMENTED** ✓

~~The policies page shows policy summaries that are too vague to be useful, and system policies are listed but cannot be investigated.~~

**What Was Fixed:**

1. **Action list display** - Now shows actual action names (e.g., "Create, Read, Update") instead of vague counts
   - Shows up to 3 actions inline with "(+N more)" for additional actions
   - "All actions (*)" shown with amber highlighting for wildcard policies

2. **System policies viewable** - System policies are now clickable to view full details:
   - [x] All policy rows are clickable to open detail modal
   - [x] View button (eye icon) added to all policy rows
   - [x] System policies open in read-only detail modal
   - [x] Custom policies can be edited from detail modal

3. **PolicyDetailModal** - New read-only modal showing complete policy information:
   - Basic info (name, description, effect, priority, status)
   - Subject conditions (roles, functional roles, user IDs)
   - Resource conditions (type and all attributes)
   - Full action list with human-readable labels
   - Environment conditions (time, days, IP restrictions)
   - Metadata (created/updated timestamps, policy ID)

**Files Added/Modified:**
- `packages/web/src/components/policies/PolicyDetailModal.tsx` - New component for viewing policy details
- `packages/web/src/routes/organizations/$organizationId/settings/policies.tsx` - Updated to use detail modal and show action names

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

**Status:** IMPLEMENTED ✓

- [x] Extract `User-Agent` header in API middleware - `captureEnvironmentContext` extracts from `request.headers["user-agent"]`
- [x] Pass to authorization audit log - `AuthorizationServiceLive.checkPermission()` logs `ipAddress` and `userAgent` on denial

**Note:** This is now captured by the environment context system. When `withEnvironmentContext()` or `requireOrganizationContext()` wraps an API handler, the environment context is available for both policy evaluation and audit logging.

---

## Implementation Recommendations

### Phase 1: Quick Wins (Low effort, High impact)
1. ~~**Fix profile page** - Preserve org context, remove broken Role field, add memberships list (1-2 hours)~~ ✓ DONE
2. ~~**Show invitation link after creation** - Display shareable URL with copy button (30 min)~~ ✓ DONE
3. ~~**Complete member removal API calls** - Fix stub implementations (30 min)~~ ✓ DONE
4. ~~**Add owner transfer modal** - UI for existing backend (2-3 hours)~~ ✓ DONE
5. ~~**Show current owner indicator** - Visual badge in members list (30 min)~~ ✓ DONE (Crown icon)

### Phase 2: Environment Integration (Medium effort)
6. ~~**Capture request context in middleware** - Time, IP, user agent (2-3 hours)~~ ✓ DONE
7. ~~**Pass environment to policy engine** - Enable time/IP restrictions (1-2 hours)~~ ✓ DONE
8. ~~**Re-enable IP restrictions in policy builder** - IP Allow List and IP Deny List fields (30 min)~~ ✓ DONE

### Phase 3: Fiscal Period Management (High effort)
9. **Design fiscal period data model** - Period status table schema (1-2 hours)
10. **Create FiscalPeriodRepository** - Database operations (2-3 hours)
11. **Create FiscalPeriodService** - State transition logic (3-4 hours)
12. **Create FiscalPeriodApi** - REST endpoints (2-3 hours)
13. **Create Fiscal Period Management UI** - List/detail pages (4-6 hours)

### Phase 4: Admin Features (Medium effort)
14. ~~**Create authorization audit log UI** - View denied access attempts~~ ✓ DONE
15. ~~**Create platform admin viewer** - Read-only list of admins~~ ✓ DONE (GET /api/v1/platform-admins, /platform-admins page)
16. ~~**Create effective permissions viewer** - Permission matrix UI~~ ✓ DONE

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
- `packages/web/src/routes/profile.tsx`: ✓ DONE
  - ~~Fix organization context (don't clear org selector)~~
  - ~~Remove or clarify meaningless "Role" field~~
  - ~~Add "Your Organizations" section with roles~~
  - ~~Fix back navigation~~
- `packages/web/src/routes/organizations/$organizationId/settings/members.tsx`: ✓ DONE
  - ~~Complete removal/reinstatement API calls~~
  - ~~Add owner transfer button and modal~~
  - ~~Add owner indicator badge~~
- `packages/api/src/Layers/OrganizationContextMiddlewareLive.ts`: ✓ DONE
  - ~~Capture time, IP, user agent~~
  - ~~Create environment context~~
- `packages/persistence/src/Layers/AuthorizationServiceLive.ts`: ✓ DONE (not PolicyEngineLive)
  - ~~Use environment context when available~~
- `packages/web/src/components/policies/PolicyBuilderModal.tsx`: ✓ DONE
  - ~~Re-enable IP restriction fields~~ - Added IP Allow List and IP Deny List input fields
  - ~~Remove "Coming Soon" labels when environment evaluation works~~ - Updated info banner to reflect that environment conditions are now evaluated at runtime

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
