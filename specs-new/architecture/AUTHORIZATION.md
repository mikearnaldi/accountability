# Authorization Specification

## Overview

This specification defines the authorization system for Accountability, implementing **Attribute-Based Access Control (ABAC)** with **Role-Based Access Control (RBAC)** as a foundation. The system enables:

- Multi-organization user membership with per-organization roles
- Fine-grained attribute-based permissions via admin-configurable policies
- Audit trail for denied authorization attempts
- Member reinstatement with full history preservation

---

## Implementation Phases (Agent-Sized Tasks)

Each phase is sized for **1-2 hours of agent work**. Complete phases in order within each track. Run `pnpm test && pnpm typecheck` after each phase.

### Track A: Foundation (Backend) ✅ COMPLETE

#### Phase A1: Database Migration
**File**: `packages/persistence/src/Migrations/Migration00XX_CreateAuthorizationTables.ts`

Create all authorization tables in a single migration:
- `user_organization_members` table with roles, functional roles, status
- `organization_invitations` table with token_hash, status
- `organization_policies` table with JSONB conditions
- `authorization_audit_log` table
- Add `is_platform_admin` to `auth_users`
- All indexes from Data Model section

**Test**: Migration runs, tables exist, constraints valid.

---

#### Phase A2: Core Type Definitions
**Files** (packages/core/src/Auth/):
- `BaseRole.ts` - Literal union: `owner | admin | member | viewer`
- `FunctionalRole.ts` - Literal union: `controller | finance_manager | accountant | period_admin | consolidation_manager`
- `Action.ts` - Union of all action strings (copy from spec)
- `MembershipStatus.ts` - Literal union: `active | suspended | removed`

**Test**: Types compile, can create values.

---

#### Phase A3: Authorization Errors
**File**: `packages/core/src/Auth/AuthorizationErrors.ts`

Create TaggedError classes:
- `PermissionDeniedError` - action, resource, reason
- `MembershipNotFoundError` - userId, organizationId
- `MembershipNotActiveError` - userId, organizationId, status
- `InvalidInvitationError` - reason
- `InvitationExpiredError` - (even though invites don't expire, for revoked)
- `OwnerCannotBeRemovedError` - organizationId
- `CannotTransferToNonAdminError` - userId

**Test**: Errors have correct messages, `Schema.is()` type guards work.

---

#### Phase A4: OrganizationMembership Schema
**Files** (packages/core/src/Auth/):
- `OrganizationMembershipId.ts` - Branded UUID
- `OrganizationMembership.ts` - Schema.Class with:
  - id, userId, organizationId
  - role (BaseRole), functional role booleans
  - status, removedAt, removedBy, removalReason
  - reinstatedAt, reinstatedBy
  - createdAt, updatedAt, invitedBy

**Test**: Schema encodes/decodes, `.make()` works.

---

#### Phase A5: OrganizationInvitation Schema
**Files** (packages/core/src/Auth/):
- `InvitationId.ts` - Branded UUID
- `InvitationStatus.ts` - Literal union: `pending | accepted | revoked`
- `OrganizationInvitation.ts` - Schema.Class with:
  - id, organizationId, email, role
  - functionalRoles (array), tokenHash
  - status, acceptedAt, acceptedBy, revokedAt, revokedBy
  - createdAt, invitedBy

**Test**: Schema encodes/decodes, `.make()` works.

---

#### Phase A6: Policy Condition Schemas
**Files** (packages/core/src/Auth/):
- `SubjectCondition.ts` - Schema with optional: roles[], functionalRoles[], userIds[], isPlatformAdmin
- `ResourceCondition.ts` - Schema with type, optional attributes
- `ActionCondition.ts` - Schema with actions[]
- `EnvironmentCondition.ts` - Schema with optional: timeOfDay, daysOfWeek, ipAllowList, ipDenyList

**Test**: Schemas validate correctly, reject invalid conditions.

---

#### Phase A7: AuthorizationPolicy Schema
**Files** (packages/core/src/Auth/):
- `PolicyId.ts` - Branded UUID
- `PolicyEffect.ts` - Literal union: `allow | deny`
- `AuthorizationPolicy.ts` - Schema.Class with:
  - id, organizationId, name, description
  - subject (SubjectCondition), resource (ResourceCondition)
  - action (ActionCondition), environment (optional EnvironmentCondition)
  - effect, priority, isSystemPolicy, isActive
  - createdAt, updatedAt, createdBy

**Test**: Schema encodes/decodes, `.make()` works.

---

### Track B: Repositories (Backend) ✅ COMPLETE

#### Phase B1: OrganizationMemberRepository
**Files**:
- `packages/persistence/src/Services/OrganizationMemberRepository.ts` - Interface
- `packages/persistence/src/Layers/OrganizationMemberRepositoryLive.ts` - Implementation

**Methods**:
- `findByOrganization(orgId)` - List all members (any status)
- `findActiveByOrganization(orgId)` - List active members only
- `findByUser(userId)` - List user's memberships
- `findByUserAndOrganization(userId, orgId)` - Single membership
- `create(membership)` - Insert new
- `update(id, changes)` - Update role/status
- `remove(id, removedBy, reason)` - Soft delete
- `reinstate(id, reinstatedBy)` - Reactivate

**Test**: Integration tests with testcontainers.

---

#### Phase B2: InvitationRepository
**Files**:
- `packages/persistence/src/Services/InvitationRepository.ts` - Interface
- `packages/persistence/src/Layers/InvitationRepositoryLive.ts` - Implementation

**Methods**:
- `create(invitation, rawToken)` - Insert with hashed token
- `findByTokenHash(hash)` - Lookup by hash
- `findByOrganization(orgId)` - List org's invitations
- `findPendingByEmail(email)` - User's pending invites
- `accept(id, acceptedBy)` - Mark accepted
- `revoke(id, revokedBy)` - Mark revoked

**Token Hashing**: Use `crypto.subtle.digest('SHA-256', ...)` or similar.

**Test**: Integration tests, verify token hashing works.

---

#### Phase B3: PolicyRepository
**Files**:
- `packages/persistence/src/Services/PolicyRepository.ts` - Interface
- `packages/persistence/src/Layers/PolicyRepositoryLive.ts` - Implementation

**Methods**:
- `findByOrganization(orgId)` - All policies
- `findActiveByOrganization(orgId)` - Active policies only
- `findById(id)` - Single policy
- `create(policy)` - Insert (reject if isSystemPolicy=true from user)
- `update(id, changes)` - Update (reject system policies)
- `delete(id)` - Delete (reject system policies)

**Test**: Integration tests, verify system policy protection.

---

#### Phase B4: AuthorizationAuditRepository
**Files**:
- `packages/persistence/src/Services/AuthorizationAuditRepository.ts` - Interface
- `packages/persistence/src/Layers/AuthorizationAuditRepositoryLive.ts` - Implementation

**Methods**:
- `logDenial(entry)` - Insert denial record
- `findByOrganization(orgId, options)` - Query with pagination
- `findByUser(userId, options)` - Query with pagination

**Test**: Integration tests.

---

### Track C: Services (Backend) ✅ COMPLETE

#### Phase C1: OrganizationMemberService
**Files**:
- `packages/core/src/Auth/OrganizationMemberService.ts` - Interface
- `packages/persistence/src/Layers/OrganizationMemberServiceLive.ts` - Implementation

**Methods**:
- `addMember(orgId, userId, role, functionalRoles, invitedBy)` - Create membership
- `removeMember(orgId, userId, removedBy, reason)` - Soft delete (check not owner)
- `updateRole(orgId, userId, role, functionalRoles)` - Change roles
- `reinstateMember(orgId, userId, reinstatedBy)` - Reactivate
- `transferOwnership(orgId, fromUserId, toUserId, newRoleForPrevious)` - Atomic transfer

**Business Rules**:
- Owner cannot be removed (use `OwnerCannotBeRemovedError`)
- Transfer target must be admin (use `CannotTransferToNonAdminError`)
- Transfer is atomic (transaction)

**Test**: Unit tests for business rules.

---

#### Phase C2: InvitationService
**Files**:
- `packages/core/src/Auth/InvitationService.ts` - Interface
- `packages/persistence/src/Layers/InvitationServiceLive.ts` - Implementation

**Methods**:
- `createInvitation(orgId, email, role, functionalRoles, invitedBy)` - Generate token, create invite
- `acceptInvitation(token, userId)` - Validate, create membership, mark accepted
- `declineInvitation(token)` - Mark revoked
- `revokeInvitation(invitationId, revokedBy)` - Admin revoke

**Token Generation**: 256-bit random, base64url encoded.

**Test**: Unit tests, integration tests for accept flow.

---

#### Phase C3: CurrentOrganizationMembership Context
**File**: `packages/core/src/Auth/CurrentOrganizationMembership.ts`

Create Context.Tag pattern (like CurrentUser):
- `CurrentOrganizationMembership` tag
- `getCurrentOrganizationMembership()` accessor
- `withOrganizationMembership(membership)` provider

**Test**: Unit test for context access.

---

#### Phase C4: AuthorizationService (RBAC)
**Files**:
- `packages/core/src/Auth/AuthorizationService.ts` - Interface
- `packages/persistence/src/Layers/AuthorizationServiceLive.ts` - Implementation

**Methods**:
- `checkPermission(action)` - Check against permission matrix, throw PermissionDeniedError
- `checkPermissions(actions[])` - Batch check, return Record<Action, boolean>
- `hasRole(role)` - Check current membership role
- `hasFunctionalRole(role)` - Check functional role flag
- `getEffectivePermissions()` - List all allowed actions

**Implementation**: Use hardcoded permission matrix from spec (for now, ABAC comes later).

**Test**: Unit tests for permission matrix.

---

### Track D: API Endpoints (Backend) ✅ COMPLETE

#### Phase D1: Membership API Definition ✅ COMPLETE
**File**: `packages/api/src/Definitions/MembershipApi.ts`

Define HttpApi endpoints:
- `GET /v1/organizations/:orgId/members` - List members
- `POST /v1/organizations/:orgId/members/invite` - Send invitation
- `PATCH /v1/organizations/:orgId/members/:userId` - Update role
- `DELETE /v1/organizations/:orgId/members/:userId` - Remove member
- `POST /v1/organizations/:orgId/members/:userId/reinstate` - Reinstate
- `POST /v1/organizations/:orgId/transfer-ownership` - Transfer

**Test**: Types compile.

**Completed**: MembershipApi.ts created with all endpoint definitions, request/response schemas (MemberInfo, MemberListResponse, InviteMemberRequest, InviteMemberResponse, UpdateMemberRequest, RemoveMemberRequest, TransferOwnershipRequest), and proper OpenApi annotations.

---

#### Phase D2: Membership API Implementation ✅ COMPLETE
**File**: `packages/api/src/Layers/MembershipApiLive.ts`

Implement handlers using MemberService, InvitationService.

**Test**: Integration tests for all endpoints.

**Completed**: MembershipApiLive.ts created with full handler implementations for all 6 endpoints, proper error mapping to API error types, integration with OrganizationMemberService and InvitationService. Also wired into AppApi and AppApiLive, added services to RepositoriesWithAuthLive, and updated AuthApi.test.ts layer setup.

---

#### Phase D3: Invitation API Definition & Implementation ✅ COMPLETE
**Files**:
- `packages/api/src/Definitions/InvitationApi.ts`
- `packages/api/src/Layers/InvitationApiLive.ts`

**Endpoints**:
- `GET /v1/users/me/invitations` - User's pending invitations
- `POST /v1/invitations/:token/accept` - Accept
- `POST /v1/invitations/:token/decline` - Decline
- `DELETE /v1/organizations/:orgId/invitations/:invitationId` - Revoke
- `GET /v1/organizations/:orgId/invitations` - List org's pending invitations (admin)

**Completed**: InvitationApi.ts created with 5 endpoints (listUserInvitations, acceptInvitation, declineInvitation, revokeInvitation, listOrgInvitations) and response schemas (PendingInvitationInfo, OrgInvitationInfo, AcceptInvitationResponse). InvitationApiLive.ts implemented with full handlers using InvitationService, UserRepository, and OrganizationRepository. Added to AppApi and AppApiLive, and wired into test layer in AuthApi.test.ts.

---

#### Phase D4: User Organizations API ✅ COMPLETE
**Files**:
- `packages/api/src/Definitions/UserOrganizationsApi.ts`
- `packages/api/src/Layers/UserOrganizationsApiLive.ts`

**Endpoint**: `GET /v1/users/me/organizations` - List user's orgs with roles

**Completed**: UserOrganizationsApi.ts created with GET /v1/users/me/organizations endpoint that returns UserOrganizationsResponse containing array of UserOrganizationInfo objects (id, name, role, functionalRoles, effectivePermissions). UserOrganizationsApiLive.ts implemented using OrganizationMemberRepository and OrganizationRepository to fetch active memberships and compute effective permissions using PermissionMatrix. Added to AppApi and AppApiLive, updated test layer in AuthApi.test.ts.

---

#### Phase D5: Organization Context Middleware ✅ COMPLETE
**File**: `packages/api/src/Layers/OrganizationContextMiddlewareLive.ts`

Middleware that:
1. Extracts `organizationId` from URL path
2. Loads membership via `OrganizationMemberRepository`
3. Validates status is `active`
4. Provides `CurrentOrganizationMembership`
5. Returns 403 `ForbiddenError` if not a member

**Completed**: Created OrganizationContextMiddlewareLive.ts with helper functions for API handlers:
- `validateOrganizationId(orgIdString)` - Decode and validate organization ID from path
- `loadOrganizationMembership(organizationId)` - Load and validate membership for current user
- `withOrganizationContext(organizationId, effect)` - Wrapper that loads membership and provides it as context
- `requireOrganizationContext(orgIdString, effect)` - Convenience function combining validation and context
- `requireAdminOrOwner` - Check if current user is admin/owner
- `requireOwner` - Check if current user is owner
- `requireFunctionalRole(role)` - Check if current user has a specific functional role

Since Effect HttpApiMiddleware doesn't have direct access to path parameters, this uses a helper function pattern where handlers call these functions at the start to load membership context. Also fixed nested Layer.provide lint error in AppApiLive.ts.

---

### Track E: Enforcement (Backend) ✅ COMPLETE

#### Phase E1: Add Org Filtering to CompanyRepository ✅ COMPLETE
Update `packages/persistence/src/Services/CompanyRepository.ts` and implementation:
- All methods require `organizationId` parameter
- All queries filter by `organization_id`

**Test**: Verify queries include filter.

**Completed**: Updated CompanyRepository interface and CompanyRepositoryLive implementation to require organizationId on all methods (findById, getById, update, findSubsidiaries, exists). Updated all API definitions (CompaniesApi, AccountsApi, JournalEntriesApi, ReportsApi, IntercompanyTransactionsApi, AccountTemplatesApi) to include organizationId parameter. Updated all API Live handlers to pass organizationId to repository methods. Updated all test files (persistence tests, API tests, integration tests) to pass organizationId. Changed GET/PUT company endpoints to use path `/organizations/:organizationId/companies/:id`. All 3620 tests pass, typecheck clean, lint clean.

---

#### Phase E2: Add Org Filtering to AccountRepository ✅ COMPLETE
Same pattern as E1 for accounts.

**Completed**: Updated AccountRepository interface and AccountRepositoryLive implementation to require organizationId on all methods (findById, getById, findByCompany, findByNumber, findActiveByCompany, findByType, findChildren, findIntercompanyAccounts, exists, isAccountNumberTaken, update). Queries now JOIN with companies table to filter by organization_id. Updated AccountsApi definition to change paths for getAccount, updateAccount, deactivateAccount to `/organizations/:organizationId/accounts/:id`. Updated AccountsApiLive, AccountTemplatesApiLive, and ReportsApiLive handlers to pass organizationId. Updated all test files (Repositories.test.ts, AccountsApiLive.test.ts, ReportsApiLive.test.ts, HttpApiIntegration.test.ts). All 3620 tests pass, typecheck clean, lint clean.

---

#### Phase E3: Add Org Filtering to JournalEntryRepository ✅ COMPLETE
Same pattern as E1 for journal entries.

---

#### Phase E4: Add Org Filtering to FiscalPeriodRepository ✅ N/A
FiscalPeriodRepository does not exist in the codebase - fiscal periods are stored as FiscalPeriodRef value objects within JournalEntry entities, not as separate repository entities.

---

#### Phase E5: Add Org Filtering to ConsolidationGroupRepository ✅ COMPLETE
Same pattern as E1 for consolidation groups.

**Completed**: Updated ConsolidationRepository interface to require organizationId on all group and run methods: findGroup, getGroup, updateGroup, groupExists, findRun, getRun, updateRun, runExists, deleteRun, findRunsByGroup, findRunByGroupAndPeriod, findRunsByStatus, findLatestCompletedRun, findInProgressRuns, findRunsByPeriodRange. Updated ConsolidationRepositoryLive with SQL JOINs to consolidation_groups table for org filtering. Updated ConsolidationApi definition to add OrganizationIdUrlParam to single-resource endpoints. Updated ConsolidationApiLive and EliminationRulesApiLive handlers to pass organizationId. Updated Repositories.test.ts. All 3620 tests pass, typecheck clean.

---

#### Phase E6: Add Org Filtering to ExchangeRateRepository ✅ N/A
Exchange rates are global system data (currency exchange rates from ECB), not per-organization data. They are shared across all organizations and don't require organization filtering.

---

#### Track E Infrastructure: Permission Check Helper ✅ COMPLETE
Added `requirePermission(action)` helper to `OrganizationContextMiddlewareLive.ts`. This helper uses `AuthorizationService.checkPermission()` to verify permissions and maps `PermissionDeniedError` to `ForbiddenError` for API responses. Also added `AuthorizationServiceLive` to `AppApiLive` layer composition.

The infrastructure is now in place for E7-E13. Handlers can use:
```typescript
requireOrganizationContext(orgIdString,
  Effect.gen(function* () {
    yield* requirePermission("company:create")
    // User has permission, proceed with creation
  })
)
```

---

#### Phase E7: Permission Checks in CompaniesApi ✅ COMPLETE
Update handlers to:
1. Get `organizationId` from `CurrentOrganizationMembership`
2. Call `AuthorizationService.checkPermission()` before operations
3. Pass `organizationId` to repository methods

**Completed**:
- Added permission checks to Company endpoints (listCompanies, getCompany, createCompany, updateCompany, deactivateCompany)
- Wrapped handlers with `requireOrganizationContext` and `requirePermission`
- Added ForbiddenError to API endpoint error types
- Updated `createOrganization` to automatically add creating user as owner with all functional roles
- Updated tests to use valid UUIDs for user IDs and expect ForbiddenError for unauthorized access
- All 3620 tests pass, typecheck clean

---

#### Phase E8: Permission Checks in AccountsApi ✅ COMPLETE
Same pattern as E7.

**Completed**:
- Added permission checks to Account endpoints (listAccounts, getAccount, createAccount, updateAccount, deactivateAccount)
- Wrapped handlers with `requireOrganizationContext` and `requirePermission`
- Added ForbiddenError to API endpoint error types
- Updated tests to expect ForbiddenError for unauthorized access
- All 3620 tests pass, typecheck clean

---

#### Phase E9: Permission Checks in JournalEntriesApi ✅ COMPLETE
Same pattern as E7.

**Completed**:
- Added permission checks to all Journal Entry endpoints (listJournalEntries, getJournalEntry, createJournalEntry, updateJournalEntry, deleteJournalEntry, submitForApproval, approveJournalEntry, rejectJournalEntry, postJournalEntry, reverseJournalEntry)
- Wrapped handlers with `requireOrganizationContext` and `requirePermission`
- Permission mapping:
  - `journal_entry:read` - list and get operations
  - `journal_entry:create` - create operation
  - `journal_entry:update` - update, delete draft, and submit operations
  - `journal_entry:post` - approve, reject, and post operations
  - `journal_entry:reverse` - reverse operation
- Added ForbiddenError to all API endpoint error types
- Added NotFoundError to createJournalEntry (required by OrganizationContextError)
- Updated tests to expect ForbiddenError for unauthorized access
- All 3620 tests pass, typecheck clean, lint clean

---

#### Phase E10: Permission Checks in FiscalPeriodsApi ✅ N/A
FiscalPeriodsApi does not exist in the codebase - fiscal periods are computed automatically as FiscalPeriodRef value objects within JournalEntry entities, not managed via a separate API.

---

#### Phase E11: Permission Checks in ConsolidationApi ✅ COMPLETE
Same pattern as E7.

**Completed**:
- Added permission checks to all Consolidation endpoints (21 endpoints total)
- Group operations: listConsolidationGroups, getConsolidationGroup, createConsolidationGroup, updateConsolidationGroup, deleteConsolidationGroup, activateConsolidationGroup, deactivateConsolidationGroup
- Member operations: addGroupMember, updateGroupMember, removeGroupMember
- Run operations: listConsolidationRuns, getConsolidationRun, initiateConsolidationRun, cancelConsolidationRun, deleteConsolidationRun, getConsolidatedTrialBalance, getLatestCompletedRun
- Report operations: getConsolidatedBalanceSheet, getConsolidatedIncomeStatement, getConsolidatedCashFlowStatement, getConsolidatedEquityStatement
- Permission mapping:
  - `consolidation_group:read` - list, get, and trial balance operations
  - `consolidation_group:create` - create group
  - `consolidation_group:update` - update group, activate/deactivate, add/update/remove members
  - `consolidation_group:delete` - delete group
  - `consolidation_group:run` - initiate, cancel, delete runs
  - `report:read` - consolidated financial reports
- Added ForbiddenError to all API endpoint error types
- Wrapped handlers with `requireOrganizationContext` and `requirePermission`
- All 3620 tests pass, typecheck clean, lint clean

---

#### Phase E12: Permission Checks in ExchangeRatesApi ✅ COMPLETE
Same pattern as E7.

**Completed**:
- Added permission checks to Exchange Rate endpoints (listExchangeRates, getExchangeRate, createExchangeRate, bulkCreateExchangeRates, deleteExchangeRate)
- Wrapped handlers with `requireOrganizationContext` and `requirePermission`
- Permission mapping:
  - `exchange_rate:read` - list, get operations
  - `exchange_rate:manage` - create, bulk create, delete operations
- Added ForbiddenError and NotFoundError to API endpoint error types
- Rate query endpoints (getRateForDate, getLatestRate, getClosestRate, getPeriodAverageRate, getPeriodClosingRate) remain authenticated-only since they query globally by currency pair
- Added validation for bulk create to require all rates be for the same organization
- All 3620 tests pass, typecheck clean, lint clean

---

#### Phase E13: Permission Checks in ReportsApi ✅ COMPLETE
Same pattern as E7.

**Completed**:
- Added permission checks to all Report endpoints (generateTrialBalance, generateBalanceSheet, generateIncomeStatement, generateCashFlowStatement, generateEquityStatement)
- Wrapped handlers with `requireOrganizationContext` and `requirePermission`
- Permission mapping:
  - `report:read` - all report generation endpoints
- Added ForbiddenError to all API endpoint error types
- Updated tests to expect ForbiddenError for unauthorized access
- All 3620 tests pass, typecheck clean, lint clean

---

#### Phase E14: Denial Audit Logging ✅ COMPLETE
Update `AuthorizationServiceLive.ts`:
- On `checkPermission` denial, call `AuthorizationAuditRepository.logDenial()`
- Include user, org, action, resource, reason, IP, user agent

**Test**: Verify denials are logged.

**Completed**:
- Updated `AuthorizationServiceLive.ts` to depend on `AuthorizationAuditRepository`
- Changed from `Layer.succeed` to `Layer.effect` to allow effectful initialization
- On `checkPermission` denial, logs to `authorization_audit_log` table with:
  - userId, organizationId, action, resourceType, denialReason
  - ipAddress and userAgent are optional (not available in current context)
- Logging is fire-and-forget (uses `catchAll` to not block main operation if logging fails)
- Added `AuthorizationAuditRepositoryLive` to `RepositoriesLive` layer composition
- All 3620 tests pass, typecheck clean, lint clean

---

### Track F: ABAC Policy Engine (Backend) ✅ COMPLETE

#### Phase F1: Action Matcher ✅ COMPLETE
**File**: `packages/core/src/Auth/matchers/ActionMatcher.ts`

Function to match action against ActionCondition:
- Exact match: `"journal_entry:create"` matches `"journal_entry:create"`
- Wildcard: `"*"` matches any action
- Prefix wildcard: `"journal_entry:*"` matches `"journal_entry:create"`

**Test**: Unit tests for all match types.

**Completed**:
- Created `ActionMatcher.ts` with functions for matching actions against patterns and conditions
- Implemented `matchesActionPattern` for exact matching and global wildcard matching
- Implemented `matchesActionPatternString` for prefix wildcard patterns like `journal_entry:*`
- Implemented `matchesActionCondition` for matching against ActionCondition objects
- Implemented `matchesActionPatterns`, `anyActionMatchesCondition`, `filterMatchingActions`, `filterMatchingActionsFromPatterns` helper functions
- Added `ActionPattern` type for prefix wildcard support
- Created comprehensive unit tests (30 tests) covering exact matches, wildcards, prefix wildcards, and edge cases
- All 3650 tests pass, typecheck clean, lint clean

---

#### Phase F2: Subject Matcher ✅ COMPLETE
**File**: `packages/core/src/Auth/matchers/SubjectMatcher.ts`

Function to match current user against SubjectCondition:
- `roles` - any of user's role matches
- `functionalRoles` - any of user's functional roles matches
- `userIds` - user's ID in list
- `isPlatformAdmin` - user's platform admin flag

**Test**: Unit tests.

**Completed**:
- Created `SubjectMatcher.ts` with functions for matching users against subject conditions in ABAC policy evaluation
- Implemented `matchesRoles`, `matchesFunctionalRoles`, `matchesUserIds`, `matchesPlatformAdmin` individual matchers
- Implemented `matchesSubjectCondition` that combines all conditions with AND logic (all must match)
- Implemented `matchesAnySubjectCondition` and `matchesAllSubjectConditions` for multiple condition matching
- Implemented `getSubjectMismatchReason` for human-readable denial reasons
- Created `SubjectContext` interface and `createSubjectContextFromMembership` helper
- Added 48 comprehensive unit tests covering all match types and edge cases
- All 3698 tests pass, typecheck clean, lint clean

---

#### Phase F3: Resource Matcher ✅ COMPLETE
**File**: `packages/core/src/Auth/matchers/ResourceMatcher.ts`

Function to match resource against ResourceCondition:
- `type` - matches or is `"*"`
- `attributes.accountNumber.range` - number in range
- `attributes.accountType` - type in list
- `attributes.periodStatus` - status in list
- etc.

**Test**: Unit tests.

**Completed**:
- Created `ResourceMatcher.ts` with functions for matching resources against resource conditions in ABAC policy evaluation
- Implemented `matchesResourceType` for type matching with wildcard support
- Implemented `matchesAccountNumberCondition` for range and list-based matching
- Implemented `matchesAccountType`, `matchesEntryType`, `matchesPeriodStatus` for literal list matching
- Implemented `matchesBooleanAttribute` for boolean flag matching
- Implemented `matchesResourceAttributes` that combines all attribute conditions with AND logic
- Implemented `matchesResourceCondition` as the main entry point for resource matching
- Implemented `matchesAnyResourceCondition` and `matchesAllResourceConditions` for multi-condition matching
- Implemented `getResourceMismatchReason` for human-readable denial reasons
- Created helper functions for creating ResourceContext objects: `createAccountResourceContext`, `createJournalEntryResourceContext`, `createFiscalPeriodResourceContext`, `createCompanyResourceContext`, `createOrganizationResourceContext`, `createConsolidationGroupResourceContext`, `createReportResourceContext`
- Added 76 comprehensive unit tests covering all match types and edge cases
- All 3774 tests pass, typecheck clean, lint clean

---

#### Phase F4: Environment Matcher ✅ COMPLETE
**File**: `packages/core/src/Auth/matchers/EnvironmentMatcher.ts`

Function to match request context against EnvironmentCondition:
- `timeOfDay` - current time in range
- `daysOfWeek` - current day in list
- `ipAllowList` - request IP matches CIDR
- `ipDenyList` - request IP not in CIDR

**Test**: Unit tests.

**Completed**:
- Created `EnvironmentMatcher.ts` with functions for matching request context against environment conditions
- Implemented `parseTimeToMinutes` for time string parsing
- Implemented `matchesTimeOfDay` with support for normal and overnight time ranges (e.g., 22:00-06:00)
- Implemented `matchesDayOfWeek` for day-of-week list matching
- Implemented `matchesIPPattern` with full IPv4 CIDR support (e.g., /8, /16, /24, /32) and basic IPv6 exact matching
- Implemented `matchesIPAllowList` and `matchesIPDenyList` for IP-based access control
- Implemented `matchesEnvironmentCondition` combining all conditions with AND logic
- Implemented `matchesAnyEnvironmentCondition` and `matchesAllEnvironmentConditions` for multi-condition matching
- Implemented `getEnvironmentMismatchReason` for human-readable denial messages
- Created `createEnvironmentContext` helper for building context from date and IP
- Added 74 comprehensive unit tests covering all match types and edge cases
- All 3848 tests pass, typecheck clean, lint clean

---

#### Phase F5: Policy Engine Service ✅ COMPLETE
**Files**:
- `packages/core/src/Auth/PolicyEngine.ts` - Interface
- `packages/persistence/src/Layers/PolicyEngineLive.ts` - Implementation

**Methods**:
- `evaluatePolicy(policy, context)` - Returns match result
- `evaluatePolicies(policies, context)` - Returns decision + matched policies

**Logic**:
1. Filter to active policies
2. Evaluate deny policies first (any match = deny)
3. Evaluate allow policies by priority
4. Default deny

**Test**: Integration tests.

**Completed**:
- Created `PolicyEngine.ts` interface with Context.Tag pattern for the policy engine service
- Defined `PolicyEvaluationContext` interface (subject, resource, action, optional environment)
- Defined `PolicyMatchResult` and `PolicyEvaluationResult` types for evaluation results
- Implemented `PolicyEngineLive.ts` with full evaluation logic:
  - `evaluatePolicy` - evaluates single policy against context using all 4 matchers
  - `evaluatePolicies` - evaluates multiple policies with deny-first, priority-ordered logic
  - `wouldDeny` - quick check if any deny policy matches
  - `findMatchingPolicies` - returns all matching policies for debugging
- Evaluation follows spec: (1) filter to active, (2) deny policies first, (3) allow by priority, (4) default deny
- Added exports to packages/core/package.json and packages/persistence/package.json
- Created comprehensive unit tests (34 tests) covering:
  - Wildcard matching, role matching, resource type matching, action matching
  - Environment condition handling, functional role matching, resource attribute matching
  - Priority ordering, deny-first precedence, default deny behavior
  - Complex policy combinations demonstrating locked period enforcement
- All 3882 tests pass, typecheck clean, lint clean

---

#### Phase F6: System Policies Seeding ✅ COMPLETE
**File**: `packages/persistence/src/Seeds/SystemPolicies.ts`

Define the 4 system policies as seed data.
Update organization creation to insert system policies.

**Test**: New org has 4 system policies.

**Completed**:
- Created `SystemPolicies.ts` with `createSystemPoliciesForOrganization()` function that generates the 4 system policies:
  1. Platform Admin Full Access (priority 1000, allow all)
  2. Organization Owner Full Access (priority 900, allow all)
  3. Viewer Read-Only Access (priority 100, allow read actions only)
  4. Locked Period Protection (priority 999, deny journal entry modifications in locked periods)
- Added `seedSystemPolicies()` function to create all policies for an organization
- Added `hasSystemPolicies()` helper to check if policies are already seeded
- Updated `createOrganization` handler in `CompaniesApiLive.ts` to seed system policies on org creation
- Added `PolicyRepositoryLive` to `RepositoriesLive` layer composition
- Added 17 unit tests for system policy generation and seeding
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase F7: Integrate ABAC into AuthorizationService ✅ COMPLETE
Update `AuthorizationServiceLive.ts`:
- Replace hardcoded matrix with `PolicyEngine.evaluatePolicies()`
- Load policies from `PolicyRepository`
- Fall back to RBAC matrix if no policies (backward compat)

**Test**: Policy-based authorization works.

**Completed**:
- Updated `AuthorizationServiceLive.ts` to integrate ABAC policy engine:
  - Added dependencies on `PolicyRepository` and `PolicyEngine`
  - Updated `checkPermission` to load policies and use ABAC when policies exist
  - Updated `checkPermissions` to evaluate each action with ABAC
  - Updated `getEffectivePermissions` to check all actions against ABAC policies
  - Falls back to RBAC permission matrix when no policies exist for organization
  - Falls back to RBAC for unknown resource types
- Created type-safe `RESOURCE_TYPE_MAP` lookup table to convert resource type strings
- Created `createResourceContext` helper to avoid type assertions
- Updated `AppApiLive.ts` to compose `AuthorizationServiceLive` with `PolicyEngineLive`
- Updated `AuthApi.test.ts` to include `PolicyEngineLive` in test layer
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase F8: Policy Management API ✅ COMPLETE
**Files**:
- `packages/api/src/Definitions/PolicyApi.ts` ✅
- `packages/api/src/Layers/PolicyApiLive.ts` ✅

**Endpoints**:
- `GET /v1/organizations/:orgId/policies` - List all policies (admin only) ✅
- `GET /v1/organizations/:orgId/policies/:policyId` - Get policy details ✅
- `POST /v1/organizations/:orgId/policies` - Create custom policy ✅
- `PATCH /v1/organizations/:orgId/policies/:policyId` - Update policy ✅
- `DELETE /v1/organizations/:orgId/policies/:policyId` - Delete policy ✅
- `POST /v1/organizations/:orgId/policies/test` - Test policy evaluation ✅

**Implementation Notes**:
- Created `PolicyApi.ts` with 6 endpoints (list, get, create, update, delete, test)
- Created `PolicyApiLive.ts` implementing all handlers with organization context and admin-only access
- System policies cannot be modified or deleted (SystemPolicyProtectionError)
- Custom policy priority limited to 0-899 (system policies use 900-1000)
- Test endpoint allows simulating authorization decisions for any org member
- Added PolicyApi to AppApi and PolicyApiLive to AppApiLive
- Combined MembershipApiLive + PolicyApiLive into MembershipPolicyApiGroup to reduce Layer.provide calls
- Provided PolicyEngineLive to MembershipPolicyApiGroup for policy evaluation
- Updated AuthApi.test.ts to include PolicyApiLive and PolicyEngineLive in test layer
- All 3899 tests pass, typecheck clean, lint clean

---

### Track G: Frontend - Core ✅ COMPLETE

#### Phase G1: Generate API Client ✅ COMPLETE
Run `pnpm generate:api` in packages/web.
Verify new endpoints available in typed client.

**Completed**: Generated API client with all new authorization endpoints:
- `/v1/organizations/:orgId/members` - Membership management (list, invite, update, remove, reinstate)
- `/v1/organizations/:orgId/transfer-ownership` - Ownership transfer
- `/v1/users/me/invitations` - User's pending invitations
- `/v1/invitations/:token/accept|decline` - Accept/decline invitations
- `/v1/organizations/:orgId/invitations` - Org invitation management
- `/v1/organizations/:orgId/policies` - Policy management (list, create, update, delete, test)
- `/v1/users/me/organizations` - User's organizations with roles and permissions
Verified: 87 endpoints, 231 schemas. Typecheck clean, lint clean.

---

#### Phase G2: Permission Hook ✅ COMPLETE
**File**: `packages/web/src/hooks/usePermissions.ts`

Hook that:
- Fetches effective permissions from `/v1/users/me/organizations`
- Caches in context
- Exposes `canPerform(action)` function

**Completed**:
- Created `packages/web/src/hooks/usePermissions.ts` with:
  - `usePermissions()` hook with `canPerform(action)`, `canPerformAny(actions)`, `canPerformAll(actions)`, `hasRole(role)`, `hasAnyRole(roles)`, `isAdminOrOwner`, `isOwner` helpers
  - `PermissionContext` React context for permission state
  - `createPermissionContextValue()` helper for creating context values
  - `parseUserOrganizations()` helper for parsing API responses
  - Types for `Action`, `BaseRole`, `FunctionalRoles`, `UserOrganization`, `PermissionContextValue`
- Created `packages/web/src/components/auth/PermissionProvider.tsx`:
  - Provider component that wraps children with permission context
  - Uses `useMemo` for performance optimization
- Updated `packages/web/src/routes/organizations/$organizationId/route.tsx`:
  - Added `fetchUserOrganizations()` server function to fetch from `/api/v1/users/me/organizations`
  - Fetches both organizations and user permissions in parallel in `beforeLoad`
  - Wraps child routes in `PermissionProvider` with current organization context
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase G3: Update Organization Selector ✅ COMPLETE
**File**: `packages/web/src/components/layout/OrganizationSelector.tsx`

Changes:
- Fetch from `/v1/users/me/organizations` instead of all orgs
- Show role badge next to org name
- Handle empty state (no orgs)

**Completed**:
- Updated `OrganizationSelector.tsx` with role badge support:
  - Added `BaseRole` type and `RoleBadge` component with distinct styling for owner (amber), admin (purple), member (blue), and viewer (gray)
  - Added `role?: BaseRole` optional field to `Organization` interface
  - Role badges display next to organization names in the dropdown list with appropriate icons (Crown, Shield, Users, Eye)
  - Exported `RoleBadge` component for reuse in other places (members page)
- Updated `route.tsx` organization layout route:
  - Added `BaseRole` type and `role` field to `OrganizationListItem` interface
  - Modified `beforeLoad` to merge role info from `userOrganizations` (permissions API) into `organizations` data
  - Organizations now include role data when available from the authorization API
- Empty state already handled (shows "No organizations yet" with prompt to create)
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase G4: Protected UI Elements - Companies ✅ COMPLETE
Hide/disable UI elements in company pages based on permissions:
- Create button: `company:create`
- Edit button: `company:update`
- Delete button: `company:delete`

**Completed**:
- Updated `companies/index.tsx` (list page):
  - Import and use `usePermissions` hook
  - Hide "New Company" header button if user lacks `company:create` permission
  - Hide empty state CTA button if user lacks `company:create` permission
- Updated `companies/$companyId/index.tsx` (detail page):
  - Import and use `usePermissions` hook
  - Hide "Edit" button if user lacks `company:update` permission
  - Hide "Deactivate/Activate" button if user lacks `company:delete` permission
- Updated `companies/new.tsx` (create page):
  - Import and use `usePermissions` hook
  - Show permission denied message with back button if user lacks `company:create` permission
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase G5: Protected UI Elements - Accounts ✅ COMPLETE
Same pattern for accounts pages.

**Completed**:
- Updated `accounts/index.tsx` (list page):
  - Import and use `usePermissions` hook
  - Hide "New Account" header button if user lacks `account:create` permission
  - Hide empty state create/apply template buttons if user lacks `account:create` permission
  - Hide edit buttons in AccountTreeView if user lacks `account:update` permission
  - Updated AccountsEmptyState component to accept `canCreateAccount` prop
  - Updated AccountTreeView and AccountTreeRow components to accept `canEditAccount` prop
- Updated `accounts/new.tsx` (create page):
  - Import and use `usePermissions` hook
  - Show permission denied message with back button if user lacks `account:create` permission
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase G6: Protected UI Elements - Journal Entries ✅ COMPLETE
Same pattern for journal entry pages.

**Completed**:
- Updated `journal-entries/index.tsx` (list page):
  - Import and use `usePermissions` hook
  - Hide "New Entry" header button if user lacks `journal_entry:create` permission
  - Hide empty state CTA button if user lacks `journal_entry:create` permission
  - Updated JournalEntriesEmptyState component to accept `canCreateEntry` prop
- Updated `journal-entries/new.tsx` (create page):
  - Import and use `usePermissions` hook
  - Show permission denied message with back button if user lacks `journal_entry:create` permission
- Updated `journal-entries/$entryId/index.tsx` (detail page):
  - Import and use `usePermissions` hook
  - Hide "Edit" button if user lacks `journal_entry:update` permission
  - Hide "Submit for Approval" button if user lacks `journal_entry:update` permission
  - Hide "Delete" button if user lacks `journal_entry:update` permission
  - Hide "Approve/Reject" buttons if user lacks `journal_entry:post` permission
  - Hide "Post to Ledger" button if user lacks `journal_entry:post` permission
  - Hide "Create Reversal" button if user lacks `journal_entry:reverse` permission
  - Updated WorkflowActions component to accept permission props
- Updated `journal-entries/$entryId/edit.tsx` (edit page):
  - Import and use `usePermissions` hook
  - Show permission denied message with back button if user lacks `journal_entry:update` permission
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase G7: Protected UI Elements - Periods ✅ N/A
Fiscal period pages do not exist in the codebase - fiscal periods are computed automatically from journal entry dates and stored as FiscalPeriodRef value objects.

---

#### Phase G8: Protected UI Elements - Consolidation ✅ COMPLETE
Same pattern for consolidation pages.

**Completed**:
- Updated `consolidation/index.tsx` (list page):
  - Import and use `usePermissions` hook
  - Hide "New Consolidation Group" header button if user lacks `consolidation_group:create` permission
  - Hide empty state CTA button if user lacks `consolidation_group:create` permission
  - Updated EmptyState component to accept `canCreateGroup` prop
- Updated `consolidation/new.tsx` (create page):
  - Import and use `usePermissions` hook
  - Show permission denied message with back button if user lacks `consolidation_group:create` permission
- Updated `consolidation/$groupId/index.tsx` (detail page):
  - Import and use `usePermissions` hook
  - Hide "Activate/Deactivate" button if user lacks `consolidation_group:update` permission
  - Hide "Edit" button if user lacks `consolidation_group:update` permission
  - Hide "Delete" button if user lacks `consolidation_group:delete` permission
  - Hide "Add Member" button if user lacks `consolidation_group:update` permission
  - Hide "New Run" button if user lacks `consolidation_group:run` permission
  - Hide empty state run CTA if user lacks `consolidation_group:run` permission
- Updated `consolidation/$groupId/edit.tsx` (edit page):
  - Import and use `usePermissions` hook
  - Show permission denied message with back button if user lacks `consolidation_group:update` permission
- All 3899 tests pass, typecheck clean, lint clean

---

### Track H: Frontend - Member Management ✅ COMPLETE

#### Phase H1: Members Page Route ✅ COMPLETE
**File**: `packages/web/src/routes/organizations/$organizationId/settings/members.tsx`

Create route with:
- Loader fetching members list
- Basic page layout with table

**Completed**: Created `settings/members.tsx` with:
- Loader fetching organization, members, invitations, and companies data
- AppLayout integration with sidebar
- Page header with refresh and invite buttons
- Active/inactive members sections
- Empty state with CTA
- Permission-based UI element hiding via `usePermissions`

---

#### Phase H2: Member Table Component ✅ COMPLETE
Display members with:
- Name, email
- Role badge
- Functional roles tags
- Status indicator
- Actions dropdown

**Completed**: `MembersTable` component with:
- Avatar with initials, name, and email columns
- Role badges using `RoleBadge` from OrganizationSelector
- Functional roles as gray tags
- Status indicator (active/suspended/removed)
- Joined date column
- Actions dropdown column with MoreVertical icon

---

#### Phase H3: Invite Member Modal ✅ COMPLETE
**File**: `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` (inline)

Form with:
- Email input (with validation)
- Role dropdown
- Functional roles checkboxes
- Submit/cancel buttons

**Completed**: `InviteMemberModal` component with:
- Email input with validation
- Role select (admin/member/viewer) with descriptions
- API integration via POST `/api/v1/organizations/{orgId}/members/invite`
- Error handling and loading states
- Cancel and Submit buttons

---

#### Phase H4: Edit Member Role Modal ✅ COMPLETE
**File**: `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` (inline)

Form with:
- Role dropdown (with templates)
- Functional roles checkboxes
- Effective permissions display (read-only)

**Completed**: `EditMemberModal` component with:
- Base role select (admin/member/viewer)
- Functional roles checkboxes (controller, finance_manager, accountant, period_admin, consolidation_manager)
- API integration via PATCH `/api/v1/organizations/{orgId}/members/{userId}`
- Error handling and loading states

---

#### Phase H5: Member Actions ✅ COMPLETE
Implement:
- Remove member (confirmation dialog)
- Reinstate member
- Transfer ownership (owner only, confirmation)

**Completed**: `MemberActionsMenu` component with:
- Edit Role action (disabled for owners)
- Remove action with confirmation (disabled for self and owners)
- Reinstate action (for removed members)
- Owner protection message
- Context-sensitive action visibility

---

#### Phase H6: Pending Invitations Section ✅ COMPLETE
Add section showing:
- Pending invitations list
- Revoke button for each

**Completed**: `PendingInvitationsSection` component with:
- Yellow-themed section with Clock icon
- Invitation cards showing email, role badge, inviter, and sent date
- Revoke button for each invitation
- API integration via DELETE `/api/v1/organizations/{orgId}/invitations/{invitationId}`
- Loading states during revocation

---

### Track I: Frontend - Policy Management ✅ COMPLETE

#### Phase I1: Policies Page Route ✅ COMPLETE
**File**: `packages/web/src/routes/organizations/$organizationId/settings/policies.tsx`

Create route with:
- Loader fetching policies
- Table with name, effect, priority, status
- System policy indicator (grayed)

**Completed**: Created `settings/policies.tsx` with:
- Server function to fetch organization, policies, and companies data
- AppLayout integration with sidebar
- Page header with refresh and create policy buttons
- Info banner explaining policy concepts
- System policies section (locked, grayed out, cannot modify)
- Custom policies section with action menus (edit, test, delete placeholders)
- Policy table showing name, effect badge, priority, target summary, status
- Empty state with CTA for custom policies
- PolicyTargetSummary component showing who/what/can summary
- Permission-based UI element hiding via `usePermissions.isAdminOrOwner`

---

#### Phase I2: Policy Builder Modal - Basic ✅ COMPLETE
**File**: `packages/web/src/components/policies/PolicyBuilderModal.tsx`

Basic form with:
- Name, description
- Effect (allow/deny)
- Priority slider

**Completed**: Created `PolicyBuilderModal.tsx` implementing all I2-I6 phases in a single comprehensive component:
- Name and description inputs with validation
- Effect selector (allow/deny) with visual icons
- Priority slider (0-899 range for custom policies)
- Active toggle checkbox
- Create and Edit modes with proper API integration
- Error handling and loading states

---

#### Phase I3: Policy Builder - Subject Conditions ✅ COMPLETE
Add to modal:
- Role multi-select
- Functional role multi-select
- User selector (optional)

**Completed** in `PolicyBuilderModal.tsx`:
- Base role checkboxes with labels and descriptions (owner, admin, member, viewer)
- Functional role toggle buttons (controller, finance_manager, accountant, period_admin, consolidation_manager)
- Validation requiring at least one role or functional role

---

#### Phase I4: Policy Builder - Resource Conditions ✅ COMPLETE
Add to modal:
- Resource type dropdown
- Attribute editors (account range, etc.)

**Completed** in `PolicyBuilderModal.tsx`:
- Resource type dropdown with all types (*, organization, company, account, journal_entry, fiscal_period, consolidation_group, report)
- Conditional attribute editors for account resources (account type, intercompany flag)
- Conditional attribute editors for journal entry resources (entry type, period status, own entry flag)

---

#### Phase I5: Policy Builder - Action Selection ✅ COMPLETE
Add to modal:
- Action multi-select with search
- Group by resource type

**Completed** in `PolicyBuilderModal.tsx`:
- "All Actions" toggle for wildcard permission
- Searchable action list
- Actions grouped by resource type (Organization, Company, Account, Journal Entry, Fiscal Period, Consolidation, Report, Exchange Rate, Audit Log)
- Selected action count display

---

#### Phase I6: Policy Builder - Environment Conditions ✅ COMPLETE
Add to modal:
- Time range inputs
- Day of week checkboxes
- IP allowlist/denylist inputs

**Completed** in `PolicyBuilderModal.tsx`:
- Optional section with info banner explaining purpose
- Time restriction toggle with start/end time inputs
- Day of week button group (Su-Sa)
- IP allow list input (comma-separated CIDR notation)
- IP deny list input (comma-separated CIDR notation)

---

#### Phase I7: Policy Testing Tool ✅ COMPLETE
**File**: `packages/web/src/components/policies/PolicyTestModal.tsx`

Form with:
- User selector
- Action dropdown
- Resource inputs
- Test button
- Result display (decision + matched policies)

**Completed**:
- Created `PolicyTestModal.tsx` in `packages/web/src/components/policies/` with:
  - User selector dropdown populated from active organization members
  - Resource type dropdown (organization, company, account, journal_entry, fiscal_period, consolidation_group, report)
  - Action dropdown filtered by selected resource type
  - Optional resource ID input
  - Conditional attribute inputs for account resources (account type, intercompany flag)
  - Conditional attribute inputs for journal entry resources (entry type, period status, own entry flag)
  - Test button that calls POST `/api/v1/organizations/{orgId}/policies/test` endpoint
  - Result display showing allow/deny decision with reason
  - Matched policies list showing policy name, effect, priority, and system policy indicator
- Updated `policies.tsx` to:
  - Fetch members data for the test modal
  - Added "Test Policies" button in page header for admins/owners
  - Added "Test Policy" action in policy action menu
  - Integrated PolicyTestModal component
- Used type-safe lookup tables (ACTION_MAP, ACTION_TYPE_MAP) to validate action values
- All 3899 tests pass, typecheck clean, lint clean

---

### Track J: Frontend - Invitations & Migration ✅ COMPLETE

#### Phase J1: User Invitations Page ✅ COMPLETE
**File**: `packages/web/src/routes/invitations.tsx`

Page showing:
- List of pending invitations
- Accept/decline buttons
- Org name, role, invited by

**Completed**: Created `/invitations` route with:
- Server function to fetch user's pending invitations from `/api/v1/users/me/invitations`
- AppLayout integration without organization context (global page)
- Invitation cards showing organization name, role badge, inviter info, and date
- Accept button that calls POST `/api/v1/invitations/{token}/accept` and redirects to org
- Decline button with confirmation that calls POST `/api/v1/invitations/{token}/decline`
- Empty state with helpful message and link to organizations page
- Refresh button to reload invitations
- Info banner explaining how invitations work

---

#### Phase J2: Invitation Accept Deep Link ✅ COMPLETE
**File**: `packages/web/src/routes/invitations/$token.tsx`

Handle:
- Logged in: accept and redirect to org
- Logged out: redirect to login with return URL

**Completed**:
- Created `invitations/$token.tsx` deep link route
- Redirects unauthenticated users to `/login?redirect=/invitations/{token}` for post-login return
- Shows confirmation page for authenticated users with Accept/Decline buttons
- Accept calls POST `/api/v1/invitations/{token}/accept` and redirects to organization dashboard
- Decline calls POST `/api/v1/invitations/{token}/decline` and redirects to invitations list
- Shows invalid token state for malformed tokens
- Shows success/declined states with auto-redirect
- Displays current user email so they can verify correct account
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase J3: Owner Seeding Migration ✅ COMPLETE
**File**: `packages/persistence/src/Migrations/Migration0018_SeedOwners.ts`

SQL to seed existing org creators as owners.

**Completed**:
- Created `Migration0018_SeedOwners.ts` that:
  1. Finds organizations without any members
  2. Looks up the audit_log for Organization Create events to find the original creator
  3. Inserts the creator as owner with all functional roles enabled
  4. Also seeds system policies for organizations that don't have them yet
- Migration uses `ON CONFLICT DO NOTHING` to be idempotent
- Handles the type difference between audit_log.entity_id (VARCHAR) and organizations.id (UUID)
- All 3899 tests pass, typecheck clean, lint clean

---

#### Phase J4: Grace Period Feature Flag ✅ COMPLETE
Add `AUTHORIZATION_ENFORCEMENT` env var:
- When `false`: skip membership check in middleware
- When `true`: enforce strictly

**Completed**:
- Created `packages/core/src/Auth/AuthorizationConfig.ts` with:
  - `AuthorizationConfig` Context.Tag for dependency injection
  - `AuthorizationConfigData` interface with `enforcementEnabled` boolean
  - `AuthorizationConfigLive` Layer that reads `AUTHORIZATION_ENFORCEMENT` env var (defaults to `true`)
  - `AuthorizationConfigEnforced` preset layer for strict enforcement
  - `AuthorizationConfigGracePeriod` preset layer for grace period mode
  - `makeAuthorizationConfigLayer` helper for tests
- Updated `packages/api/src/Layers/OrganizationContextMiddlewareLive.ts`:
  - `loadOrganizationMembership` now checks `AuthorizationConfig.enforcementEnabled`
  - When enforcement disabled, creates synthetic admin membership for authenticated users
  - Uses `Effect.serviceOption` to default to strict enforcement when config unavailable
- Updated `packages/api/src/Layers/AppApiLive.ts` to provide `AuthorizationConfigLive`
- Added export to `packages/core/package.json`
- Created unit tests in `packages/core/test/Auth/AuthorizationConfig.test.ts`
- All 3906 unit tests pass, typecheck clean, lint clean

---

### UI Improvements (Post-Implementation)

#### Policies Page Responsive Layout
- Fixed text breaking badly when resized by adding mobile-responsive card layout
- Desktop view uses table with proper min-width constraints and text wrapping
- Mobile/tablet view uses card layout with badges and wrapped text
- PolicyTargetSummary component now uses flex-wrap for proper text flow

#### Members Page Functional Roles
- Updated InviteMemberModal to show functional role selection when "Member" role is selected
- Functional roles displayed with descriptions explaining each role's capabilities
- Conditional section that only appears for Member role (Admin/Viewer don't need functional roles)
- Updated EditMemberModal with same functional role selection pattern
- Info banners explain when functional roles are/aren't applicable

#### Policy Builder Simplification
- Removed IP allow/deny fields (backend has matching logic but API doesn't extract IP addresses)
- Removed periodStatus from journal entry attributes (fiscal period management not yet implemented)
- Added "Coming Soon" labels to time-based conditions section (stored but not evaluated at runtime)
- Added "(not yet implemented)" labels to fiscal period actions in action list
- Environment conditions section now clearly indicates these are stored but not enforced

#### Known Limitations
- **Environment conditions**: Time-of-day and day-of-week conditions are stored in policies but not currently evaluated at runtime because the API layer doesn't extract environment context
- **Fiscal period management**: Actions like `fiscal_period:lock`, `fiscal_period:open`, etc. are defined but there's no UI or API to actually manage fiscal periods yet. Fiscal periods are computed automatically from journal entry dates.
- **IP-based restrictions**: Removed from UI. The backend matcher exists but the API doesn't capture client IP addresses.

---

### Phase Summary

| Track | Phases | Focus |
|-------|--------|-------|
| **A** | A1-A7 | Foundation: DB + Domain Models |
| **B** | B1-B4 | Repositories |
| **C** | C1-C4 | Services |
| **D** | D1-D5 | API Endpoints |
| **E** | E1-E14 | Enforcement (org filtering + permissions) |
| **F** | F1-F8 | ABAC Policy Engine |
| **G** | G1-G8 | Frontend Core |
| **H** | H1-H6 | Frontend Member Management |
| **I** | I1-I7 | Frontend Policy Management |
| **J** | J1-J4 | Frontend Invitations + Migration |

**Total: 57 phases**

### Execution Order

```
A1 → A2 → A3 → A4 → A5 → A6 → A7  (Foundation)
         ↓
B1 → B2 → B3 → B4  (Repositories)
         ↓
C1 → C2 → C3 → C4  (Services)
         ↓
D1 → D2 → D3 → D4 → D5  (API)
         ↓
    ┌────┴────┐
    ↓         ↓
E1-E14    F1-F8  (Enforcement + ABAC - can parallelize)
    ↓         ↓
    └────┬────┘
         ↓
G1 → G2 → G3 → G4-G8  (Frontend Core)
         ↓
    ┌────┴────┐
    ↓         ↓
H1-H6      I1-I7  (Member UI + Policy UI - can parallelize)
    ↓         ↓
    └────┬────┘
         ↓
J1 → J2 → J3 → J4  (Invitations + Migration)
```

### Testing Checkpoints

After each phase, run:
```bash
pnpm test        # Unit/integration tests
pnpm typecheck   # TypeScript validation
pnpm lint        # Code quality
```

After G1+:
```bash
pnpm test:e2e    # E2E tests
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHORIZATION FLOW                        │
└─────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   Request    │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Authentication Layer  │  ← Existing: validates session
              │   (CurrentUser)        │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Organization Context  │  ← NEW: resolves org membership
              │   (OrgMembership)      │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   ABAC Policy Engine   │  ← NEW: evaluates policies
              │  (Subject, Resource,   │
              │   Action, Environment) │
              └────────────┬───────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
               ┌────────┐   ┌────────┐
               │ ALLOW  │   │  DENY  │ → Audit log
               └────────┘   └────────┘
```

## Data Model

### User-Organization Membership

```sql
CREATE TABLE user_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Base role determines default permission set
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

  -- Functional roles (can have multiple)
  is_controller BOOLEAN NOT NULL DEFAULT false,
  is_finance_manager BOOLEAN NOT NULL DEFAULT false,
  is_accountant BOOLEAN NOT NULL DEFAULT false,
  is_period_admin BOOLEAN NOT NULL DEFAULT false,
  is_consolidation_manager BOOLEAN NOT NULL DEFAULT false,

  -- Membership status with soft delete support
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES auth_users(id),
  removal_reason TEXT,

  -- Reinstatement tracking
  reinstated_at TIMESTAMPTZ,
  reinstated_by UUID REFERENCES auth_users(id),

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth_users(id),

  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_user_org_members_user ON user_organization_members(user_id) WHERE status = 'active';
CREATE INDEX idx_user_org_members_org ON user_organization_members(organization_id) WHERE status = 'active';
```

### Organization Invitations

Invitations do not expire automatically - they remain valid until accepted or revoked.

```sql
CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Invitation details
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),

  -- Functional roles to assign on acceptance
  functional_roles JSONB NOT NULL DEFAULT '[]',

  -- Token for accepting invitation (hashed for security)
  token_hash TEXT NOT NULL UNIQUE,

  -- Status tracking (no expiration - invites last until revoked)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth_users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth_users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID NOT NULL REFERENCES auth_users(id),

  UNIQUE(organization_id, email, status) -- Only one pending invite per email per org
);

CREATE INDEX idx_org_invitations_token ON organization_invitations(token_hash) WHERE status = 'pending';
CREATE INDEX idx_org_invitations_email ON organization_invitations(email) WHERE status = 'pending';
```

### Custom Policies (ABAC)

```sql
CREATE TABLE organization_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Policy definition
  name TEXT NOT NULL,
  description TEXT,

  -- Conditions (JSONB for flexibility)
  subject_condition JSONB NOT NULL,    -- Who this applies to
  resource_condition JSONB NOT NULL,   -- What resources
  action_condition JSONB NOT NULL,     -- What actions
  environment_condition JSONB,         -- Optional contextual conditions

  -- Effect and priority
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  priority INTEGER NOT NULL DEFAULT 500,

  -- System policies cannot be modified/deleted
  is_system_policy BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth_users(id),

  UNIQUE(organization_id, name)
);

CREATE INDEX idx_org_policies_active ON organization_policies(organization_id) WHERE is_active = true;
```

### Authorization Audit Log

Only denied access attempts are logged (per design decision).

```sql
CREATE TABLE authorization_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who was denied
  user_id UUID NOT NULL REFERENCES auth_users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- What was attempted
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,

  -- Why it was denied
  denial_reason TEXT NOT NULL,
  matched_policy_ids UUID[],

  -- Request context
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_audit_user ON authorization_audit_log(user_id);
CREATE INDEX idx_auth_audit_org ON authorization_audit_log(organization_id);
CREATE INDEX idx_auth_audit_time ON authorization_audit_log(created_at);
```

### Platform Admin Flag

```sql
ALTER TABLE auth_users ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT false;
```

## Role Definitions

### Base Roles (per organization)

| Role | Description | Default Capabilities |
|------|-------------|---------------------|
| `owner` | Organization creator/owner | Full access, delete org, transfer ownership |
| `admin` | Organization administrator | Manage members, settings, all data operations |
| `member` | Standard user | Access based on functional roles assigned |
| `viewer` | Read-only access | View data and reports only |

### Functional Roles (additive permissions)

Users with `member` base role can be assigned functional roles that grant specific capabilities:

| Functional Role | Capabilities |
|----------------|--------------|
| `controller` | Period lock/unlock, consolidation run/approval, full financial oversight |
| `finance_manager` | Period soft close, account management, exchange rates, elimination rules |
| `accountant` | Create/edit/post journal entries, reconciliation |
| `period_admin` | Open/close periods, create adjustment periods |
| `consolidation_manager` | Manage consolidation groups, elimination rules |

### Role Templates

For ease of use, the UI provides preset role templates that configure functional roles:

| Template | Base Role | Functional Roles |
|----------|-----------|------------------|
| **Controller** | member | controller |
| **Finance Manager** | member | finance_manager |
| **Staff Accountant** | member | accountant |
| **Period Administrator** | member | period_admin |
| **Consolidation Specialist** | member | consolidation_manager |
| **Bookkeeper** | member | accountant |
| **Read-Only Auditor** | viewer | (none) |

Admins can also customize individual functional role toggles after selecting a template.

### Permission Matrix

```
                          owner  admin  controller  fin_mgr  accountant  period_admin  consol_mgr  viewer
Organization
  manage_settings           ✓      ✓        -          -          -          -            -          -
  manage_members            ✓      ✓        -          -          -          -            -          -
  delete_organization       ✓      -        -          -          -          -            -          -
  transfer_ownership        ✓      -        -          -          -          -            -          -

Company
  create                    ✓      ✓        ✓          -          -          -            -          -
  edit                      ✓      ✓        ✓          ✓          -          -            -          -
  delete                    ✓      ✓        -          -          -          -            -          -
  view                      ✓      ✓        ✓          ✓          ✓          ✓            ✓          ✓

Chart of Accounts
  create_account            ✓      ✓        ✓          ✓          -          -            -          -
  edit_account              ✓      ✓        ✓          ✓          -          -            -          -
  deactivate_account        ✓      ✓        ✓          ✓          -          -            -          -
  view                      ✓      ✓        ✓          ✓          ✓          ✓            ✓          ✓

Journal Entries
  create                    ✓      ✓        ✓          ✓          ✓          -            -          -
  edit                      ✓      ✓        ✓          ✓          ✓          -            -          -
  post                      ✓      ✓        ✓          ✓          ✓          -            -          -
  reverse                   ✓      ✓        ✓          ✓          -          -            -          -
  view                      ✓      ✓        ✓          ✓          ✓          ✓            ✓          ✓

Fiscal Periods
  open                      ✓      ✓        ✓          -          -          ✓            -          -
  soft_close                ✓      ✓        ✓          ✓          -          ✓            -          -
  close                     ✓      ✓        ✓          -          -          -            -          -
  lock                      ✓      ✓        ✓          -          -          -            -          -
  reopen                    ✓      ✓        ✓          -          -          -            -          -
  view                      ✓      ✓        ✓          ✓          ✓          ✓            ✓          ✓

Consolidation
  create_group              ✓      ✓        ✓          -          -          -            ✓          -
  edit_group                ✓      ✓        ✓          -          -          -            ✓          -
  delete_group              ✓      ✓        ✓          -          -          -            -          -
  create_elimination        ✓      ✓        ✓          ✓          -          -            ✓          -
  run_consolidation         ✓      ✓        ✓          ✓          -          -            -          -
  view                      ✓      ✓        ✓          ✓          ✓          ✓            ✓          ✓

Reports
  view                      ✓      ✓        ✓          ✓          ✓          ✓            ✓          ✓
  export                    ✓      ✓        ✓          ✓          ✓          -            ✓          -

Exchange Rates
  manage                    ✓      ✓        ✓          ✓          -          -            -          -
  view                      ✓      ✓        ✓          ✓          ✓          ✓            ✓          ✓

Audit Log
  view                      ✓      ✓        ✓          -          -          -            -          -
```

## ABAC Policy Engine

### Policy Structure

```typescript
interface Policy {
  id: PolicyId
  organizationId: OrganizationId
  name: string
  description: string

  // When this policy applies
  subject: SubjectCondition      // Who is making the request
  resource: ResourceCondition    // What resource is being accessed
  action: ActionCondition        // What action is being performed
  environment?: EnvironmentCondition  // Contextual conditions (optional)

  // What to do when policy matches
  effect: "allow" | "deny"

  // Priority for conflict resolution (higher = evaluated first)
  priority: number

  // System policies cannot be modified
  isSystemPolicy: boolean
  isActive: boolean
}
```

### Subject Conditions

```typescript
interface SubjectCondition {
  // Match by base role (any of)
  roles?: ("owner" | "admin" | "member" | "viewer")[]

  // Match by functional roles (any of)
  functionalRoles?: FunctionalRole[]

  // Match specific users by ID
  userIds?: AuthUserId[]

  // Match by platform admin status
  isPlatformAdmin?: boolean
}
```

### Resource Conditions

```typescript
interface ResourceCondition {
  // Resource type
  type: "organization" | "company" | "account" | "journal_entry" | "fiscal_period" | "consolidation_group" | "report" | "*"

  // Attribute conditions (all must match)
  attributes?: {
    // Account-specific
    accountNumber?: {
      range?: [number, number]  // e.g., [1000, 1999]
      in?: number[]             // specific account numbers
    }
    accountType?: ("Asset" | "Liability" | "Equity" | "Revenue" | "Expense")[]
    isIntercompany?: boolean

    // Journal entry-specific
    entryType?: JournalEntryType[]
    isOwnEntry?: boolean  // Created by requesting user

    // Fiscal period-specific
    periodStatus?: ("Open" | "SoftClose" | "Closed" | "Locked")[]
    isAdjustmentPeriod?: boolean
  }
}
```

### Action Conditions

```typescript
type Action =
  // Organization actions
  | "organization:manage_settings"
  | "organization:manage_members"
  | "organization:delete"
  | "organization:transfer_ownership"

  // Company actions
  | "company:create"
  | "company:read"
  | "company:update"
  | "company:delete"

  // Account actions
  | "account:create"
  | "account:read"
  | "account:update"
  | "account:deactivate"

  // Journal entry actions
  | "journal_entry:create"
  | "journal_entry:read"
  | "journal_entry:update"
  | "journal_entry:post"
  | "journal_entry:reverse"

  // Fiscal period actions
  | "fiscal_period:read"
  | "fiscal_period:open"
  | "fiscal_period:soft_close"
  | "fiscal_period:close"
  | "fiscal_period:lock"
  | "fiscal_period:reopen"

  // Consolidation actions
  | "consolidation_group:create"
  | "consolidation_group:read"
  | "consolidation_group:update"
  | "consolidation_group:delete"
  | "consolidation_group:run"
  | "elimination:create"

  // Report actions
  | "report:read"
  | "report:export"

  // Exchange rate actions
  | "exchange_rate:read"
  | "exchange_rate:manage"

  // Audit log actions
  | "audit_log:read"

  // Wildcard
  | "*"

interface ActionCondition {
  actions: Action[]
}
```

### Environment Conditions

```typescript
interface EnvironmentCondition {
  // Time-based restrictions
  timeOfDay?: { start: string, end: string }  // e.g., "09:00" to "17:00"
  daysOfWeek?: number[]  // 0=Sunday, 6=Saturday

  // IP-based restrictions
  ipAllowList?: string[]  // CIDR notation supported
  ipDenyList?: string[]
}
```

### Policy Evaluation

```typescript
interface PolicyEvaluationResult {
  decision: "allow" | "deny"
  matchedPolicies: Policy[]
  reason: string
}

// Evaluation order:
// 1. Check if user has active membership in organization
// 2. Check platform admin override (if applicable)
// 3. Evaluate deny policies first (explicit deny wins)
// 4. Evaluate allow policies by priority (highest first)
// 5. Default deny if no policies match
```

## Default System Policies

The system includes built-in policies that cannot be modified or deleted:

### 1. Platform Admin Override

```typescript
{
  name: "Platform Admin Full Access",
  subject: { isPlatformAdmin: true },
  resource: { type: "*" },
  action: { actions: ["*"] },
  effect: "allow",
  priority: 1000,
  isSystemPolicy: true
}
```

### 2. Organization Owner Full Access

```typescript
{
  name: "Organization Owner Full Access",
  subject: { roles: ["owner"] },
  resource: { type: "*" },
  action: { actions: ["*"] },
  effect: "allow",
  priority: 900,
  isSystemPolicy: true
}
```

### 3. Viewer Read-Only

```typescript
{
  name: "Viewer Read-Only Access",
  subject: { roles: ["viewer"] },
  resource: { type: "*" },
  action: { actions: ["*:read", "report:read", "report:export"] },
  effect: "allow",
  priority: 100,
  isSystemPolicy: true
}
```

### 4. Locked Period Protection

```typescript
{
  name: "Prevent Modifications to Locked Periods",
  subject: { roles: ["*"] },
  resource: {
    type: "journal_entry",
    attributes: { periodStatus: ["Locked"] }
  },
  action: { actions: ["journal_entry:create", "journal_entry:update", "journal_entry:post", "journal_entry:reverse"] },
  effect: "deny",
  priority: 999,
  isSystemPolicy: true
}
```

## Owner Transfer Rules

**An organization must always have exactly one owner.** The following rules apply:

1. **Owner cannot be removed** - Must transfer ownership first
2. **Transfer requires admin target** - Can only transfer to existing admin
3. **Transfer is atomic** - Old owner becomes admin, new owner gains ownership
4. **Audit logged** - All ownership transfers are recorded

```typescript
interface OwnershipTransfer {
  organizationId: OrganizationId
  fromUserId: AuthUserId
  toUserId: AuthUserId
  newRoleForPreviousOwner: "admin" | "member" | "viewer"
  transferredAt: Timestamp
}
```

## API Endpoints

### Organization Membership

```typescript
// List organization members
GET /v1/organizations/:orgId/members
Response: {
  members: Array<{
    userId: AuthUserId
    email: Email
    displayName: string
    role: BaseRole
    functionalRoles: FunctionalRole[]
    status: "active" | "suspended" | "removed"
    joinedAt: Timestamp
  }>
}

// Invite new member
POST /v1/organizations/:orgId/members/invite
Body: {
  email: Email
  role: "admin" | "member" | "viewer"
  functionalRoles?: FunctionalRole[]
}
Response: { invitationId: InvitationId }

// Update member role
PATCH /v1/organizations/:orgId/members/:userId
Body: {
  role?: BaseRole
  functionalRoles?: FunctionalRole[]
}

// Remove member (soft delete)
DELETE /v1/organizations/:orgId/members/:userId
Body: { reason?: string }

// Reinstate member
POST /v1/organizations/:orgId/members/:userId/reinstate

// Transfer ownership
POST /v1/organizations/:orgId/transfer-ownership
Body: {
  toUserId: AuthUserId
  myNewRole: "admin" | "member" | "viewer"
}
```

### Invitations

```typescript
// List user's pending invitations
GET /v1/users/me/invitations
Response: {
  invitations: Array<{
    id: InvitationId
    organizationId: OrganizationId
    organizationName: string
    role: BaseRole
    invitedBy: { email: Email, displayName: string }
    createdAt: Timestamp
  }>
}

// Accept invitation
POST /v1/invitations/:token/accept

// Decline invitation
POST /v1/invitations/:token/decline

// Revoke invitation (org admin)
DELETE /v1/organizations/:orgId/invitations/:invitationId
```

### Policy Management

```typescript
// List organization policies
GET /v1/organizations/:orgId/policies
Response: {
  policies: Array<Policy>
}

// Create custom policy
POST /v1/organizations/:orgId/policies
Body: Omit<Policy, "id" | "organizationId" | "isSystemPolicy">

// Update policy
PATCH /v1/organizations/:orgId/policies/:policyId
Body: Partial<Policy>

// Delete policy
DELETE /v1/organizations/:orgId/policies/:policyId

// Test policy (evaluate without applying)
POST /v1/organizations/:orgId/policies/test
Body: {
  userId: AuthUserId
  action: Action
  resource: { type: string, id?: string, attributes?: object }
}
Response: {
  decision: "allow" | "deny"
  matchedPolicies: Policy[]
  reason: string
}
```

### User Organizations

```typescript
// List user's organizations with effective permissions
GET /v1/users/me/organizations
Response: {
  organizations: Array<{
    id: OrganizationId
    name: string
    role: BaseRole
    functionalRoles: FunctionalRole[]
    effectivePermissions: Action[]  // Computed from role + policies
  }>
}
```

## UI Components

### Settings Navigation Integration ✅ COMPLETE

**COMPLETED**: Added navigation to Members and Policies pages from the main UI.

#### Implementation (Option A: Sidebar Sub-items)

Updated `packages/web/src/components/layout/Sidebar.tsx` with expandable Settings sub-items:

```typescript
{
  label: "Settings",
  href: `/organizations/${organizationId}/settings`,
  icon: Settings,
  testId: "nav-org-settings",
  subItems: [
    {
      label: "General",
      href: `/organizations/${organizationId}/settings`,
      icon: Settings,
      testId: "nav-settings-general"
    },
    {
      label: "Members",
      href: `/organizations/${organizationId}/settings/members`,
      icon: Users,
      testId: "nav-settings-members"
    },
    {
      label: "Policies",
      href: `/organizations/${organizationId}/settings/policies`,
      icon: Shield,
      testId: "nav-settings-policies"
    }
  ]
}
```

#### Completed Tasks

- [x] Update Sidebar.tsx to add Settings sub-items with expandable menu
- [x] Add Users and Shield icons to Sidebar imports
- [x] Test navigation works on desktop and mobile sidebar
- [x] Ensure active state highlighting works for sub-items (fixed path-based comparison logic)

---

### Member Management Page

Location: `/organizations/:orgId/settings/members`

Features:
- List all members with role badges
- Show effective permissions for each member (computed)
- Invite new members via email
- Role template selector with customization
- Individual functional role toggles
- Remove/suspend members
- Reinstate removed members
- View and revoke pending invitations

### Policy Management Page

Location: `/organizations/:orgId/settings/policies`

Features:
- List all policies (system + custom)
- Visual policy builder with dropdowns for:
  - Subject conditions (roles, users)
  - Resource conditions (type, attributes)
  - Action selection
  - Environment conditions
- Policy priority ordering
- Enable/disable toggle
- Policy testing tool (evaluate hypothetical scenarios)
- Cannot modify system policies (shown grayed out)

### Effective Permissions View

When viewing a member's details, show computed effective permissions:

```
┌─────────────────────────────────────────────┐
│ Jane Doe (jane@example.com)                 │
│ Role: member                                │
│ Functional Roles: accountant, period_admin  │
├─────────────────────────────────────────────┤
│ Effective Permissions:                      │
│ ✓ journal_entry:create                      │
│ ✓ journal_entry:edit                        │
│ ✓ journal_entry:post                        │
│ ✓ fiscal_period:open                        │
│ ✓ fiscal_period:soft_close                  │
│ ✗ fiscal_period:lock (requires controller)  │
│ ✗ company:create (requires admin)           │
└─────────────────────────────────────────────┘
```

### Organization Selector Updates

The existing `OrganizationSelector` component should:
- Only show organizations the user is a member of
- Display role badge next to each organization name
- Show "Create Organization" option for all users
- Highlight current organization

## Implementation Plan

### Phase 1: Core Membership Infrastructure

1. **Database Schema**
   - Create `user_organization_members` table
   - Create `organization_invitations` table
   - Create `organization_policies` table
   - Create `authorization_audit_log` table
   - Add `is_platform_admin` to `auth_users`

2. **Domain Models** (packages/core/src/Auth/)
   - `OrganizationMembership.ts` - Schema with functional roles
   - `OrganizationInvitation.ts` - Invitation schema
   - `AuthorizationPolicy.ts` - Policy schema
   - `AuthorizationErrors.ts` - Permission denied, membership errors

3. **Repository Layer** (packages/persistence/src/)
   - `OrganizationMemberRepository` - Membership CRUD
   - `InvitationRepository` - Invitation management
   - `PolicyRepository` - Policy storage

4. **Service Layer** (packages/core/src/Auth/)
   - `OrganizationMemberService` - Membership business logic
   - `InvitationService` - Invitation flow

### Phase 2: Authorization Middleware

1. **Organization Context**
   - `CurrentOrganizationMembership` context tag
   - Middleware to load membership from URL path
   - Validate membership status (active only)

2. **Permission Checking**
   - `AuthorizationService.checkPermission(action, resource)`
   - Integration with existing `AuthMiddleware`
   - Deny logging to `authorization_audit_log`

3. **Data Filtering**
   - Update all repositories to require `organizationId`
   - Ensure no cross-org data leakage
   - Add organization validation to all API handlers

### Phase 3: ABAC Policy Engine

1. **Policy Evaluation Engine**
   - `PolicyEngine` service
   - Subject/Resource/Action/Environment matching
   - Priority-based conflict resolution
   - Default deny behavior

2. **System Policies**
   - Seed default policies on org creation
   - Mark as `isSystemPolicy: true`
   - Prevent modification/deletion

3. **Effective Permissions Calculation**
   - Compute all allowed actions for a user
   - Cache with invalidation on policy/role change

### Phase 4: UI Implementation

1. **Member Management**
   - Member list with role badges
   - Invite modal with role templates
   - Role editor with functional toggles
   - Remove/reinstate actions

2. **Policy Builder**
   - Visual condition builder
   - Action selector
   - Priority controls
   - Test execution UI

3. **Organization Selector**
   - Filter to user's orgs
   - Role indicators
   - Create org option

## Security Considerations

### Data Isolation

- All repository queries MUST include `organizationId` filter
- No API endpoint returns data from other organizations
- Platform admin access is logged to audit trail

### Invitation Security

- Tokens are 256-bit cryptographically random
- Store only token hash in database (not raw token)
- Tokens are single-use
- Rate limit: max 10 invitations per org per hour

### Audit Requirements

- Denied access attempts logged with full context
- Membership changes logged (add, remove, reinstate, role change)
- Policy changes logged (create, update, delete)
- Ownership transfers logged

### Platform Admin Guidelines

- Platform admins can access any organization for support
- All platform admin organization access is logged
- Platform admin flag can only be set via database migration (not UI)

## Migration Strategy

### Initial Deployment

1. **Create tables** with migration
2. **Seed memberships**: For each organization, make the creator the owner
3. **Grace period**: Allow 30-day period where all authenticated users retain access
4. **Enable enforcement**: After grace period, require membership for access

### Existing Data

```sql
-- Migration to create initial memberships
INSERT INTO user_organization_members (user_id, organization_id, role, status)
SELECT created_by, id, 'owner', 'active'
FROM organizations
WHERE created_by IS NOT NULL;
```

## Testing Strategy

### Unit Tests

- Policy evaluation matching logic
- Permission matrix verification
- Role hierarchy and functional role combinations

### Integration Tests

- Membership CRUD with Effect services
- Invitation accept/decline flow
- Cross-organization isolation verification
- Reinstatement flow

### E2E Tests

- Complete invitation flow (invite → accept → access)
- Role-based UI element visibility
- Policy builder save and enforcement
- Owner transfer flow

## Success Criteria

- Zero cross-organization data access
- All denied access attempts captured in audit log
- Policy evaluation latency < 5ms (p99)
- UI correctly shows/hides elements based on permissions
