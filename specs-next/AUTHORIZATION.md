# Authorization Specification

## Overview

This specification defines the authorization system for Accountability, implementing **Attribute-Based Access Control (ABAC)** with **Role-Based Access Control (RBAC)** as a foundation. The system enables:

- Multi-organization user membership with per-organization roles
- Fine-grained attribute-based permissions via admin-configurable policies
- Audit trail for denied authorization attempts
- Member reinstatement with full history preservation

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
