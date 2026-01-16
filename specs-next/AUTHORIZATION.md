# Authorization Specification

## Overview

This specification defines the authorization system for Accountability, implementing **Attribute-Based Access Control (ABAC)** with **Role-Based Access Control (RBAC)** as a foundation. The system enables:

- Multi-organization user membership with per-organization roles
- Fine-grained attribute-based permissions via admin-configurable policies
- Audit trail for denied authorization attempts
- Member reinstatement with full history preservation

---

## Implementation Phases (Detailed)

This section provides a detailed breakdown of implementation phases with specific tasks, deliverables, and acceptance criteria.

### Phase 1: Database Schema & Domain Models

**Goal**: Establish the data foundation for authorization.

#### 1.1 Database Migration

**File**: `packages/persistence/src/Migrations/Migration00XX_CreateAuthorizationTables.ts`

| Task | Description | Deliverable |
|------|-------------|-------------|
| 1.1.1 | Create `user_organization_members` table | Table with roles, functional roles, status, audit fields |
| 1.1.2 | Create `organization_invitations` table | Table with token_hash, status, functional_roles JSONB |
| 1.1.3 | Create `organization_policies` table | Table with JSONB conditions, priority, system flag |
| 1.1.4 | Create `authorization_audit_log` table | Table for denied access logging |
| 1.1.5 | Add `is_platform_admin` to `auth_users` | ALTER TABLE migration |
| 1.1.6 | Add `created_by` to `organizations` table | Required for owner seeding (if not exists) |
| 1.1.7 | Create indexes | All indexes defined in Data Model section |

**Acceptance Criteria**:
- [ ] Migration runs successfully on fresh database
- [ ] Migration is idempotent (can run multiple times)
- [ ] All foreign key constraints are valid
- [ ] Indexes are created for query performance

#### 1.2 Domain Models (packages/core/src/Auth/)

| Task | File | Description |
|------|------|-------------|
| 1.2.1 | `OrganizationMembership.ts` | Schema.Class with BaseRole, FunctionalRoles, status |
| 1.2.2 | `OrganizationMembershipId.ts` | Branded UUID type |
| 1.2.3 | `BaseRole.ts` | Literal union: owner, admin, member, viewer |
| 1.2.4 | `FunctionalRole.ts` | Literal union: controller, finance_manager, accountant, period_admin, consolidation_manager |
| 1.2.5 | `OrganizationInvitation.ts` | Schema.Class with token, status, functional_roles |
| 1.2.6 | `InvitationId.ts` | Branded UUID type |
| 1.2.7 | `AuthorizationPolicy.ts` | Schema.Class with conditions, effect, priority |
| 1.2.8 | `PolicyId.ts` | Branded UUID type |
| 1.2.9 | `SubjectCondition.ts` | Schema for subject matching |
| 1.2.10 | `ResourceCondition.ts` | Schema for resource matching |
| 1.2.11 | `ActionCondition.ts` | Schema for action matching |
| 1.2.12 | `EnvironmentCondition.ts` | Schema for environment matching |
| 1.2.13 | `Action.ts` | Union type of all action strings |
| 1.2.14 | `AuthorizationErrors.ts` | TaggedErrors: PermissionDeniedError, MembershipNotFoundError, InvalidInvitationError, etc. |

**Acceptance Criteria**:
- [ ] All schemas have proper validation
- [ ] All schemas have `.make()` constructors
- [ ] All errors extend Schema.TaggedError with proper messages
- [ ] Unit tests for schema encoding/decoding

#### 1.3 Repository Interfaces (packages/persistence/src/Services/)

| Task | File | Description |
|------|------|-------------|
| 1.3.1 | `OrganizationMemberRepository.ts` | Interface: findByOrg, findByUser, findByUserAndOrg, create, update, remove, reinstate |
| 1.3.2 | `InvitationRepository.ts` | Interface: create, findByToken, findByOrg, findPendingByEmail, accept, revoke |
| 1.3.3 | `PolicyRepository.ts` | Interface: findByOrg, findActiveByOrg, create, update, delete |
| 1.3.4 | `AuthorizationAuditRepository.ts` | Interface: logDenial, findByOrg, findByUser |

**Acceptance Criteria**:
- [ ] All methods return Effect types with proper errors
- [ ] Interfaces use Context.Tag pattern
- [ ] All methods are documented with JSDoc

#### 1.4 Repository Implementations (packages/persistence/src/Layers/)

| Task | File | Description |
|------|------|-------------|
| 1.4.1 | `OrganizationMemberRepositoryLive.ts` | SQL implementation with @effect/sql |
| 1.4.2 | `InvitationRepositoryLive.ts` | SQL implementation, token hashing |
| 1.4.3 | `PolicyRepositoryLive.ts` | SQL implementation, JSONB handling |
| 1.4.4 | `AuthorizationAuditRepositoryLive.ts` | SQL implementation |

**Acceptance Criteria**:
- [ ] All queries filter by organizationId where applicable
- [ ] Token hashing uses crypto.subtle or similar
- [ ] Integration tests pass with testcontainers PostgreSQL

---

### Phase 2: Core Services & Invitation Flow

**Goal**: Implement membership management and invitation system.

#### 2.1 Service Interfaces (packages/core/src/Auth/)

| Task | File | Description |
|------|------|-------------|
| 2.1.1 | `OrganizationMemberService.ts` | Interface: addMember, removeMember, updateRole, reinstateМember, transferOwnership |
| 2.1.2 | `InvitationService.ts` | Interface: createInvitation, acceptInvitation, declineInvitation, revokeInvitation |

#### 2.2 Service Implementations (packages/persistence/src/Layers/)

| Task | File | Description |
|------|------|-------------|
| 2.2.1 | `OrganizationMemberServiceLive.ts` | Business logic: owner transfer rules, soft delete, reinstatement |
| 2.2.2 | `InvitationServiceLive.ts` | Business logic: token generation, acceptance flow, rate limiting |

**Acceptance Criteria**:
- [ ] Owner cannot be removed without transfer
- [ ] Ownership transfer is atomic
- [ ] Invitation tokens are 256-bit random, stored as hash
- [ ] Rate limiting prevents > 10 invitations/org/hour
- [ ] Unit tests for all business rules

#### 2.3 API Endpoints - Membership (packages/api/src/)

| Task | File | Description |
|------|------|-------------|
| 2.3.1 | `Definitions/MembershipApi.ts` | HttpApi definition for membership endpoints |
| 2.3.2 | `Layers/MembershipApiLive.ts` | Handler implementations |

**Endpoints**:
- `GET /v1/organizations/:orgId/members`
- `POST /v1/organizations/:orgId/members/invite`
- `PATCH /v1/organizations/:orgId/members/:userId`
- `DELETE /v1/organizations/:orgId/members/:userId`
- `POST /v1/organizations/:orgId/members/:userId/reinstate`
- `POST /v1/organizations/:orgId/transfer-ownership`

#### 2.4 API Endpoints - Invitations (packages/api/src/)

| Task | File | Description |
|------|------|-------------|
| 2.4.1 | `Definitions/InvitationApi.ts` | HttpApi definition for invitation endpoints |
| 2.4.2 | `Layers/InvitationApiLive.ts` | Handler implementations |

**Endpoints**:
- `GET /v1/users/me/invitations`
- `POST /v1/invitations/:token/accept`
- `POST /v1/invitations/:token/decline`
- `DELETE /v1/organizations/:orgId/invitations/:invitationId`

#### 2.5 API Endpoints - User Organizations

| Task | File | Description |
|------|------|-------------|
| 2.5.1 | `Definitions/UserOrganizationsApi.ts` | HttpApi definition |
| 2.5.2 | `Layers/UserOrganizationsApiLive.ts` | Handler: list user's orgs with roles |

**Endpoints**:
- `GET /v1/users/me/organizations`

**Acceptance Criteria**:
- [ ] All endpoints require authentication
- [ ] Membership endpoints require org admin/owner role
- [ ] OpenAPI spec is generated correctly
- [ ] Integration tests for all endpoints

---

### Phase 3: Authorization Middleware & Enforcement

**Goal**: Enforce permissions on all API requests.

#### 3.1 Organization Context

| Task | File | Description |
|------|------|-------------|
| 3.1.1 | `packages/core/src/Auth/CurrentOrganizationMembership.ts` | Context.Tag for current membership |
| 3.1.2 | `packages/api/src/Layers/OrganizationContextMiddlewareLive.ts` | Middleware to load membership from URL |

**Middleware Logic**:
1. Extract `organizationId` from URL path (`/v1/organizations/:orgId/...`)
2. Load user's membership for that organization
3. Validate membership status is `active`
4. Provide `CurrentOrganizationMembership` to downstream handlers
5. Return 403 if not a member

#### 3.2 Permission Checking Service

| Task | File | Description |
|------|------|-------------|
| 3.2.1 | `packages/core/src/Auth/AuthorizationService.ts` | Interface: checkPermission, checkPermissions, hasRole, hasFunctionalRole |
| 3.2.2 | `packages/persistence/src/Layers/AuthorizationServiceLive.ts` | Implementation with RBAC matrix |

**Methods**:
```typescript
checkPermission(action: Action, resource?: ResourceContext): Effect<void, PermissionDeniedError>
checkPermissions(actions: Action[]): Effect<Record<Action, boolean>, never>
hasRole(role: BaseRole): Effect<boolean, never>
hasFunctionalRole(role: FunctionalRole): Effect<boolean, never>
```

#### 3.3 Denial Audit Logging

| Task | File | Description |
|------|------|-------------|
| 3.3.1 | Update `AuthorizationServiceLive.ts` | Log to `authorization_audit_log` on denial |

**Logged Data**:
- user_id, organization_id
- action, resource_type, resource_id
- denial_reason, matched_policy_ids
- ip_address, user_agent

#### 3.4 Repository Organization Filtering

| Task | Description |
|------|-------------|
| 3.4.1 | Update `CompanyRepository` to require `organizationId` |
| 3.4.2 | Update `AccountRepository` to require `organizationId` |
| 3.4.3 | Update `JournalEntryRepository` to require `organizationId` |
| 3.4.4 | Update `FiscalPeriodRepository` to require `organizationId` |
| 3.4.5 | Update `ConsolidationGroupRepository` to require `organizationId` |
| 3.4.6 | Update `ExchangeRateRepository` to require `organizationId` |
| 3.4.7 | Update all API handlers to use `CurrentOrganizationMembership` |

**Acceptance Criteria**:
- [ ] No repository query returns data without organizationId filter
- [ ] All API handlers extract organizationId from context
- [ ] Cross-org data access is impossible
- [ ] Integration tests verify isolation

#### 3.5 API Handler Permission Checks

| Task | Description |
|------|-------------|
| 3.5.1 | Add permission checks to `CompaniesApi` handlers |
| 3.5.2 | Add permission checks to `AccountsApi` handlers |
| 3.5.3 | Add permission checks to `JournalEntriesApi` handlers |
| 3.5.4 | Add permission checks to `FiscalPeriodsApi` handlers |
| 3.5.5 | Add permission checks to `ConsolidationApi` handlers |
| 3.5.6 | Add permission checks to `ExchangeRatesApi` handlers |
| 3.5.7 | Add permission checks to `ReportsApi` handlers |

**Pattern**:
```typescript
yield* AuthorizationService.checkPermission("journal_entry:create")
// ... proceed with operation
```

**Acceptance Criteria**:
- [ ] All write operations check appropriate permissions
- [ ] Permission denials return 403 with clear message
- [ ] All denials are logged to audit table

---

### Phase 4: ABAC Policy Engine

**Goal**: Implement configurable policy-based authorization.

#### 4.1 Policy Engine Service

| Task | File | Description |
|------|------|-------------|
| 4.1.1 | `packages/core/src/Auth/PolicyEngine.ts` | Interface: evaluatePolicy, evaluatePolicies |
| 4.1.2 | `packages/persistence/src/Layers/PolicyEngineLive.ts` | Implementation with matching logic |

**Evaluation Logic**:
1. Load active policies for organization
2. Check platform admin override (priority 1000)
3. Evaluate deny policies first (explicit deny wins)
4. Evaluate allow policies by priority (highest first)
5. Default deny if no match

#### 4.2 Condition Matchers

| Task | File | Description |
|------|------|-------------|
| 4.2.1 | `packages/core/src/Auth/matchers/SubjectMatcher.ts` | Match subject conditions against current user |
| 4.2.2 | `packages/core/src/Auth/matchers/ResourceMatcher.ts` | Match resource conditions against target resource |
| 4.2.3 | `packages/core/src/Auth/matchers/ActionMatcher.ts` | Match action conditions (including wildcards) |
| 4.2.4 | `packages/core/src/Auth/matchers/EnvironmentMatcher.ts` | Match time/IP conditions |

#### 4.3 System Policies Seeding

| Task | File | Description |
|------|------|-------------|
| 4.3.1 | `packages/persistence/src/Seeds/SystemPolicies.ts` | Seed data for 4 system policies |
| 4.3.2 | Update organization creation | Auto-seed system policies on new org |

**System Policies**:
1. Platform Admin Full Access (priority 1000)
2. Organization Owner Full Access (priority 900)
3. Viewer Read-Only Access (priority 100)
4. Locked Period Protection (priority 999, deny)

#### 4.4 Effective Permissions Calculation

| Task | File | Description |
|------|------|-------------|
| 4.4.1 | `packages/core/src/Auth/EffectivePermissions.ts` | Calculate all allowed actions for a user |
| 4.4.2 | Add caching layer | Cache with invalidation on role/policy change |

#### 4.5 Policy Management API

| Task | File | Description |
|------|------|-------------|
| 4.5.1 | `Definitions/PolicyApi.ts` | HttpApi definition for policy endpoints |
| 4.5.2 | `Layers/PolicyApiLive.ts` | Handler implementations |

**Endpoints**:
- `GET /v1/organizations/:orgId/policies`
- `POST /v1/organizations/:orgId/policies`
- `PATCH /v1/organizations/:orgId/policies/:policyId`
- `DELETE /v1/organizations/:orgId/policies/:policyId`
- `POST /v1/organizations/:orgId/policies/test`

**Acceptance Criteria**:
- [ ] System policies cannot be modified/deleted
- [ ] Policy evaluation < 5ms (p99)
- [ ] Wildcard matching works correctly
- [ ] Unit tests for all matchers
- [ ] Integration tests for policy evaluation

---

### Phase 5: Frontend - Organization Selector & Access Control

**Goal**: Update frontend to respect authorization.

#### 5.1 API Client Generation

| Task | Description |
|------|-------------|
| 5.1.1 | Run `pnpm generate:api` to update typed client |
| 5.1.2 | Verify all new endpoints are available |

#### 5.2 Organization Selector Updates

| Task | File | Description |
|------|------|-------------|
| 5.2.1 | `packages/web/src/components/layout/OrganizationSelector.tsx` | Filter to user's orgs only |
| 5.2.2 | Add role badge display | Show role next to org name |
| 5.2.3 | Update loader | Fetch from `/v1/users/me/organizations` |

#### 5.3 Permission Hook

| Task | File | Description |
|------|------|-------------|
| 5.3.1 | `packages/web/src/hooks/usePermissions.ts` | Hook to check permissions client-side |
| 5.3.2 | `packages/web/src/hooks/useCanPerform.ts` | Convenience hook for single action |

**Usage**:
```typescript
const { canPerform, isLoading } = usePermissions()
if (canPerform("journal_entry:create")) { /* show button */ }
```

#### 5.4 Protected UI Elements

| Task | Description |
|------|-------------|
| 5.4.1 | Hide "Create Company" button for non-admins |
| 5.4.2 | Hide "Delete" buttons based on permissions |
| 5.4.3 | Hide "Close Period" for non-controllers |
| 5.4.4 | Hide settings pages for non-admins |
| 5.4.5 | Disable edit forms for viewers |

**Acceptance Criteria**:
- [ ] Users only see organizations they belong to
- [ ] Role badges are displayed correctly
- [ ] UI elements hidden/shown based on permissions
- [ ] No broken UI for restricted users

---

### Phase 6: Frontend - Member Management UI

**Goal**: Implement member management interface.

#### 6.1 Member List Page

| Task | File | Description |
|------|------|-------------|
| 6.1.1 | `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` | Route and loader |
| 6.1.2 | Member table component | List with role badges, status |
| 6.1.3 | Role template selector | Dropdown with presets |
| 6.1.4 | Functional role toggles | Individual checkboxes |

#### 6.2 Invite Member Modal

| Task | File | Description |
|------|------|-------------|
| 6.2.1 | `packages/web/src/components/forms/InviteMemberModal.tsx` | Modal with email, role, functional roles |
| 6.2.2 | Email validation | Check valid email format |
| 6.2.3 | Success/error handling | Toast notifications |

#### 6.3 Edit Member Role Modal

| Task | File | Description |
|------|------|-------------|
| 6.3.1 | `packages/web/src/components/forms/EditMemberRoleModal.tsx` | Modal to change roles |
| 6.3.2 | Effective permissions display | Show computed permissions |

#### 6.4 Member Actions

| Task | Description |
|------|-------------|
| 6.4.1 | Remove member (with confirmation) |
| 6.4.2 | Reinstate member |
| 6.4.3 | Transfer ownership (owner only) |

#### 6.5 Pending Invitations Section

| Task | Description |
|------|-------------|
| 6.5.1 | List pending invitations |
| 6.5.2 | Revoke invitation action |
| 6.5.3 | Resend invitation (create new) |

**Acceptance Criteria**:
- [ ] Members can be invited by email
- [ ] Roles can be changed
- [ ] Removed members can be reinstated
- [ ] Ownership can be transferred
- [ ] E2E tests pass for member management

---

### Phase 7: Frontend - Policy Management UI

**Goal**: Implement policy builder interface.

#### 7.1 Policy List Page

| Task | File | Description |
|------|------|-------------|
| 7.1.1 | `packages/web/src/routes/organizations/$organizationId/settings/policies.tsx` | Route and loader |
| 7.1.2 | Policy table | List with name, effect, priority, status |
| 7.1.3 | System policy indicator | Grayed out, non-editable |

#### 7.2 Policy Builder Modal

| Task | File | Description |
|------|------|-------------|
| 7.2.1 | `packages/web/src/components/forms/PolicyBuilderModal.tsx` | Full policy editor |
| 7.2.2 | Subject condition builder | Role/user selector |
| 7.2.3 | Resource condition builder | Type + attribute editors |
| 7.2.4 | Action selector | Multi-select with search |
| 7.2.5 | Environment condition builder | Time/IP inputs |
| 7.2.6 | Priority slider | Visual priority control |

#### 7.3 Policy Testing Tool

| Task | File | Description |
|------|------|-------------|
| 7.3.1 | `packages/web/src/components/forms/PolicyTestModal.tsx` | Test policy evaluation |
| 7.3.2 | User selector | Pick user to test |
| 7.3.3 | Action/resource inputs | Define test scenario |
| 7.3.4 | Result display | Show decision + matched policies |

**Acceptance Criteria**:
- [ ] Custom policies can be created via UI
- [ ] All condition types are configurable
- [ ] Policy testing works correctly
- [ ] System policies are protected
- [ ] E2E tests pass for policy management

---

### Phase 8: User Invitations UI & Migration

**Goal**: Complete invitation flow and migrate existing data.

#### 8.1 User Invitations Page

| Task | File | Description |
|------|------|-------------|
| 8.1.1 | `packages/web/src/routes/invitations.tsx` | List user's pending invitations |
| 8.1.2 | Accept invitation action | Call API, redirect to org |
| 8.1.3 | Decline invitation action | Call API, remove from list |

#### 8.2 Invitation Accept Page

| Task | File | Description |
|------|------|-------------|
| 8.2.1 | `packages/web/src/routes/invitations/$token.tsx` | Deep link for invitation |
| 8.2.2 | Handle logged-in user | Accept directly |
| 8.2.3 | Handle logged-out user | Redirect to login, then accept |

#### 8.3 Data Migration

| Task | File | Description |
|------|------|-------------|
| 8.3.1 | `packages/persistence/src/Migrations/Migration00XX_SeedOwners.ts` | Seed existing org owners |

**Migration Logic**:
```sql
INSERT INTO user_organization_members (user_id, organization_id, role, status)
SELECT created_by, id, 'owner', 'active'
FROM organizations
WHERE created_by IS NOT NULL
ON CONFLICT DO NOTHING;
```

#### 8.4 Grace Period Feature Flag

| Task | Description |
|------|-------------|
| 8.4.1 | Add `AUTHORIZATION_ENFORCEMENT` env var |
| 8.4.2 | When disabled, skip membership check (allow all authenticated users) |
| 8.4.3 | When enabled, enforce membership strictly |

**Acceptance Criteria**:
- [ ] Users can accept invitations via link
- [ ] Existing organizations have owners seeded
- [ ] Grace period allows gradual rollout
- [ ] E2E tests pass for invitation flow

---

### Phase Summary

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| **Phase 1** | Database Schema & Domain Models | None |
| **Phase 2** | Core Services & Invitation Flow | Phase 1 |
| **Phase 3** | Authorization Middleware & Enforcement | Phase 1, 2 |
| **Phase 4** | ABAC Policy Engine | Phase 3 |
| **Phase 5** | Frontend - Org Selector & Access Control | Phase 3 |
| **Phase 6** | Frontend - Member Management UI | Phase 2, 5 |
| **Phase 7** | Frontend - Policy Management UI | Phase 4, 5 |
| **Phase 8** | User Invitations UI & Migration | Phase 2, 5 |

### Testing Checkpoints

After each phase, run:
```bash
pnpm test        # Unit/integration tests
pnpm typecheck   # TypeScript validation
pnpm lint        # Code quality
pnpm test:e2e    # E2E tests (after Phase 5+)
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
