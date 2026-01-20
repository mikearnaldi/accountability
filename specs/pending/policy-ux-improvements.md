# Policy Creation UX Improvements

This specification defines improvements to the policy creation and management UI to make it more intuitive and powerful.

---

## Current Issues

### 1. Single Resource Type Limitation

**Problem**: A policy can only target one resource type at a time.

```typescript
// Current design - single type
resource: {
  type: ResourceType  // "account" | "journal_entry" | etc.
  attributes?: ResourceAttributes
}
```

**User Impact**: To apply the same rule to multiple resource types, users must create multiple nearly-identical policies. For example, "Deny viewers access to accounts and journal entries" requires two policies.

### 2. No Way to Manage User-Specific Policies

**Problem**: The backend supports `userIds` in subject conditions, but there's no good UX for managing user-specific policies.

```typescript
// Backend supports this, but no good UX for it
subject: {
  roles?: BaseRole[]
  functionalRoles?: FunctionalRole[]
  userIds?: string[]  // ← Not exposed in UI
  isPlatformAdmin?: boolean
}
```

**User Impact**: Admins cannot easily grant specific users individual permissions (e.g., "Give John temporary access to post journal entries").

**Better Approach**: User-specific policies should be managed from the **Member page**, not the Policy page. When you want to give John specific access, you go to John's member profile - not to a policy form and search for John.

### 3. Confusing Multi-Phase Flow

**Problem**: The current 6-phase modal is overwhelming:
- Phase I2: Basic Info (name, description, effect, priority)
- Phase I3: Subject Conditions (WHO)
- Phase I4: Resource Conditions (WHAT)
- Phase I5: Action Selection (CAN)
- Phase I6: Environment Conditions (WHEN/WHERE)

**User Impact**: Users struggle to understand the relationship between phases. The separation of "Resource" and "Actions" is particularly confusing since actions are inherently tied to resource types.

---

## Design Goals

1. **Intuitive Flow** - Natural language structure: "WHO can DO WHAT on WHICH resources"
2. **Multi-Resource Support** - One policy can target multiple resource types
3. **User-Specific Policies** - Managed from the Member page, not the Policy page
4. **Progressive Disclosure** - Show complexity only when needed
5. **Immediate Feedback** - Preview what the policy will do as you build it
6. **Separation of Concerns** - Role-based policies vs user-specific assignments

---

## Proposed UX Redesign

### Two-Location Design

**Key Insight**: There are two distinct use cases that belong in different places:

1. **Role-based policies** → Managed in **Settings > Policies**
   - "All Viewers can only read data"
   - "All Members can create journal entries"
   - These are organizational rules that apply to roles

2. **User-specific policies** → Managed in **Settings > Members > [User]**
   - "Give John temporary access to post journal entries"
   - "Allow Sarah to manage fiscal periods"
   - These are individual exceptions/grants

### Policy Page: Role-Based Policies

Replace the 6-phase modal with a cleaner 4-section form focused on **roles**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create Policy                                                         [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Policy Name: [Restrict viewer journal entry access________________]         │
│ Description: [Optional description________________________________]         │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. WHO does this policy apply to? (Roles)                               │ │
│ │                                                                         │ │
│ │ Base Roles:                                                             │ │
│ │ [ ] Owner   [ ] Admin   [x] Member   [x] Viewer                        │ │
│ │                                                                         │ │
│ │ Functional Roles (optional):                                            │ │
│ │ [Controller] [Finance Manager] [Accountant] [Period Admin] [+2]        │ │
│ │                                                                         │ │
│ │ ℹ️ To assign policies to specific users, go to Settings > Members       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 2. WHAT can they do? (Actions)                                          │ │
│ │                                                                         │ │
│ │ [x] All Actions                                                         │ │
│ │ [ ] Specific Actions:                                                   │ │
│ │     [Action multi-select grouped by category]                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 3. ON WHICH resources? (Optional filters)                               │ │
│ │                                                                         │ │
│ │ Resource Types:  [x] All    [ ] Specific types                          │ │
│ │                                                                         │ │
│ │ Additional Filters (optional):                                          │ │
│ │ [Attribute filters shown when relevant]                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 4. EFFECT & CONDITIONS                                                  │ │
│ │                                                                         │ │
│ │ Effect:   ● Allow    ○ Deny                                            │ │
│ │ Priority: [====●=====] 500                                              │ │
│ │                                                                         │ │
│ │ [ ] Add time/location restrictions (Advanced)                           │ │
│ │     [Environment conditions - collapsed by default]                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Preview                                                                 │ │
│ │                                                                         │ │
│ │ "Members and Viewers CAN read accounts, companies, and reports"         │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                          [Cancel]  [Create Policy]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Member Page: User-Specific Policies

Add a "Policies" tab/section to the member detail page:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Members                                                                   │
│                                                                             │
│ John Smith                                                                  │
│ john@example.com                                                            │
│ Role: Member                                                                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [Profile]  [Functional Roles]  [●Policies]  [Activity]                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Policies Assigned to John Smith                            [+ Add Policy]   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Inherited from Role (Member)                                    3 total │ │
│ │ These policies apply because John has the Member role                   │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ ✓ Member Base Access                                          [View]    │ │
│ │   Allow read/create on accounts, journal entries                        │ │
│ │                                                                         │ │
│ │ ✓ Member Journal Entry Restrictions                           [View]    │ │
│ │   Deny post/reverse on journal entries                                  │ │
│ │                                                                         │ │
│ │ ✓ Soft-Close Period Protection                                [View]    │ │
│ │   Deny modifications during soft-close (system policy)                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Assigned to John Specifically                               1 total     │ │
│ │ These policies apply only to John, not to his role                      │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ ✓ Temporary Posting Access                      [Edit] [Remove]         │ │
│ │   Allow post on journal entries                                         │ │
│ │   Expires: Feb 28, 2026                                                 │ │
│ │                                                                         │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ + Add another policy for John                                       │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Effective Permissions (computed)                            [Expand]    │ │
│ │ What John can actually do after all policies are evaluated              │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ Accounts:        ✓ read  ✓ create  ✓ update  ✗ deactivate              │ │
│ │ Journal Entries: ✓ read  ✓ create  ✓ update  ✓ post  ✗ reverse         │ │
│ │ Reports:         ✓ read  ✓ export                                       │ │
│ │ ...                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Section Details

### Section 1: WHO (Subject Selection) - Policy Page

The policy page focuses on **role-based** targeting only:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WHO does this policy apply to?                                              │
│                                                                             │
│ Base Roles:                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [ ] Owner    - Full organization access                                 │ │
│ │ [ ] Admin    - Manage settings and members                              │ │
│ │ [x] Member   - Day-to-day accounting work                               │ │
│ │ [x] Viewer   - Read-only access                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Functional Roles (optional - for specialized access):                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [Controller]  [Finance Manager]  [Accountant]                           │ │
│ │ [Period Admin]  [Consolidation Manager]                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ℹ️ To grant permissions to specific users, go to Settings > Members and    │
│    select the user.                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Data Structure (unchanged):**
```typescript
interface SubjectCondition {
  roles?: BaseRole[]              // ["member", "viewer"]
  functionalRoles?: FunctionalRole[]
  userIds?: string[]              // Set from Member page, not Policy page
  isPlatformAdmin?: boolean
}
```

---

### Section 2: WHAT (Action Selection)

**Simplified action selection with smart grouping:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WHAT can they do?                                                           │
│                                                                             │
│ ● All Actions                                                               │
│ ○ Specific Actions                                                          │
│                                                                             │
│ [When "Specific Actions" selected:]                                         │
│                                                                             │
│ Quick Select:                                                               │
│ [All Read] [All Write] [All Delete] [Clear All]                            │
│                                                                             │
│ ┌─ Organization ──────────────────────────────────────────────────────────┐ │
│ │ [ ] manage_settings   [ ] manage_members   [ ] delete   [ ] transfer    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Company ───────────────────────────────────────────────────────────────┐ │
│ │ [x] create   [x] read   [x] update   [ ] delete                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Account ───────────────────────────────────────────────────────────────┐ │
│ │ [x] create   [x] read   [x] update   [ ] deactivate                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Journal Entry ─────────────────────────────────────────────────────────┐ │
│ │ [x] create   [x] read   [x] update   [ ] post   [ ] reverse             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ [+ Show more categories...]                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key improvements:**
- Quick select buttons for common patterns
- Collapsible categories to reduce visual noise
- Actions imply resource types (selecting `journal_entry:post` implies journal entry resources)

---

### Section 3: ON WHICH Resources (Resource Filters)

**Smart resource type inference + optional attribute filters:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ON WHICH resources?                                                         │
│                                                                             │
│ Resource Types:                                                             │
│ ● All resource types                                                        │
│ ○ Only specific types:                                                      │
│   [x] Account   [x] Journal Entry   [ ] Company   [ ] Fiscal Period        │
│   [ ] Consolidation Group   [ ] Report   [ ] Exchange Rate                 │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ Additional Filters (optional):                                              │
│ These filters further restrict which resources the policy applies to.       │
│                                                                             │
│ [ ] Filter by account attributes                                            │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ Account Type: [Any ▼]  [Asset] [Liability] [Equity] [Revenue]...  │   │
│     │ [ ] Intercompany accounts only                                    │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ [ ] Filter by journal entry attributes                                      │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ Entry Type: [Any ▼]  [Standard] [Adjusting] [Closing]...          │   │
│     │ [ ] Only entries created by the user                              │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ [ ] Filter by fiscal period status                                          │
│     ┌───────────────────────────────────────────────────────────────────┐   │
│     │ Period Status: [ ] Open  [ ] Closed                               │   │
│     │ [ ] Adjustment periods only                                       │   │
│     └───────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key improvements:**
- Resource types can be inferred from selected actions (if you select `account:create`, account is implied)
- Multiple resource types supported
- Attribute filters are optional and collapsed by default
- Only show relevant attribute filters based on selected resource types

**Data Structure Change:**
```typescript
// BEFORE: Single resource type
interface ResourceCondition {
  type: ResourceType
  attributes?: ResourceAttributes
}

// AFTER: Multiple resource types
interface ResourceCondition {
  types: ResourceType[] | "*"  // Array of types OR wildcard for all
  attributes?: ResourceAttributes  // Applied to relevant types
}
```

---

### Section 4: Effect & Conditions

**Streamlined with advanced options collapsed:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EFFECT & CONDITIONS                                                         │
│                                                                             │
│ Effect:                                                                     │
│ ● Allow - Grant access to the selected actions                             │
│ ○ Deny  - Block access to the selected actions (takes precedence)          │
│                                                                             │
│ Priority: [============●======] 500                                         │
│           Lower ←────────────→ Higher                                       │
│           ℹ️ Higher priority policies are evaluated first.                  │
│              Deny policies take precedence over Allow at same priority.     │
│                                                                             │
│ [▶ Advanced: Time & Location Restrictions]                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [ ] Restrict to specific times                                          │ │
│ │     From: [09:00] To: [17:00]                                           │ │
│ │                                                                         │ │
│ │ [ ] Restrict to specific days                                           │ │
│ │     [Su] [Mo] [Tu] [We] [Th] [Fr] [Sa]                                  │ │
│ │                                                                         │ │
│ │ [ ] Restrict by IP address                                              │ │
│ │     Allow: [192.168.1.0/24, 10.0.0.0/8_______________]                  │ │
│ │     Deny:  [________________________________________]                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Policy Preview (Policy Page)

**Real-time natural language preview of the role-based policy:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Preview                                                                     │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ✓ ALLOW                                                                 │ │
│ │                                                                         │ │
│ │ WHO:  Members and Viewers                                               │ │
│ │                                                                         │ │
│ │ CAN:  Create, Read, Update                                              │ │
│ │       accounts and journal entries                                      │ │
│ │                                                                         │ │
│ │ WHERE: All accounts (no filters)                                        │ │
│ │        Standard and Adjusting journal entries only                      │ │
│ │                                                                         │ │
│ │ WHEN:  Weekdays 9:00 AM - 5:00 PM                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ℹ️ This policy will affect 12 users with Member or Viewer roles.            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Member Page: Assign Policy Modal

When clicking "+ Add Policy" on a member's page:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Assign Policy to John Smith                                           [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Choose how to assign permissions:                                           │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Assign an existing policy                                             │ │
│ │                                                                         │ │
│ │   Select Policy: [Choose a policy...                              ▼]    │ │
│ │                                                                         │ │
│ │   Available policies:                                                   │ │
│ │   • Allow Journal Entry Posting                                         │ │
│ │   • Allow Fiscal Period Management                                      │ │
│ │   • Allow Report Export                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ● Create a custom policy for John                                       │ │
│ │                                                                         │ │
│ │   Policy Name: [Temporary Posting Access____________________]           │ │
│ │                                                                         │ │
│ │   Actions:                                                              │ │
│ │   [x] Post journal entries                                              │ │
│ │   [ ] Reverse journal entries                                           │ │
│ │   [ ] Close fiscal periods                                              │ │
│ │   [ ] More actions...                                                   │ │
│ │                                                                         │ │
│ │   Effect: ● Allow  ○ Deny                                              │ │
│ │                                                                         │ │
│ │   [ ] Set expiration date                                               │ │
│ │       Expires: [2026-02-28]                                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                           [Cancel]  [Assign Policy]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Assign existing policy**: Reuse a policy already defined for another purpose
- **Create custom policy**: Quick inline form for user-specific grants
- **Expiration date**: Built-in support for temporary access grants
- Policy is created with `userIds: [userId]` automatically

---

## Schema Changes

### Backend Changes Required

```typescript
// packages/core/src/Auth/PolicyConditions.ts

// CHANGE: ResourceCondition now supports multiple types
export class ResourceCondition extends Schema.Class<ResourceCondition>("ResourceCondition")({
  // BEFORE: type: ResourceType
  // AFTER: types array OR wildcard
  types: Schema.Union(
    Schema.Array(ResourceType),
    Schema.Literal("*")
  ),
  attributes: Schema.optionalWith(ResourceAttributes, { nullable: true })
}) {}

// SubjectCondition - no schema changes needed, just UI improvements
// userIds is already supported
```

### Migration Strategy

```typescript
// Migration: Convert existing policies from single type to types array
// Before: { type: "account", attributes: {...} }
// After:  { types: ["account"], attributes: {...} }

// This is backwards compatible - old format can be auto-migrated
```

### API Changes

```typescript
// packages/api/src/Definitions/PolicyApi.ts

// CreatePolicyRequest - update resource field
resource: {
  types: string[] | "*"  // Changed from single `type`
  attributes?: ResourceAttributes
}

// Validation: If types is "*", attributes should typically be empty
// (can't filter by account type if targeting all resource types)
```

---

## Implementation Phases

### Phase 1: Multi-Resource Type Support (Backend + Policy Page)

1. [ ] Update `ResourceCondition` schema to use `types: ResourceType[]`
2. [ ] Add database migration to convert existing `type` → `types` array
3. [ ] Update API validation and serialization
4. [ ] Update policy evaluation engine to handle multiple types
5. [ ] Update Policy Builder UI to show multi-select for resource types
6. [ ] Add "All resource types" option (`types: "*"`)

### Phase 2: Streamlined Policy Page Form

1. [ ] Redesign PolicyBuilderModal with 4 clear sections (WHO/WHAT/WHERE/EFFECT)
2. [ ] Simplify WHO section to roles-only (remove user picker)
3. [ ] Add hint text linking to Members page for user-specific policies
4. [ ] Add collapsible sections for advanced options (environment conditions)
5. [ ] Implement "Quick Select" buttons for common action patterns
6. [ ] Add action category grouping with expand/collapse
7. [ ] Conditional attribute filter display based on selected resource types

### Phase 3: Member Page - Policy Tab

1. [ ] Add "Policies" tab to member detail page
2. [ ] Create API endpoint: `GET /members/{memberId}/policies` - returns inherited + assigned policies
3. [ ] Display "Inherited from Role" section (read-only, links to policy)
4. [ ] Display "Assigned to User" section (editable, with remove button)
5. [ ] Add "Effective Permissions" computed summary

### Phase 4: Member Page - Assign Policy Modal

1. [ ] Create `AssignPolicyModal` component
2. [ ] Implement "Assign existing policy" dropdown
3. [ ] Implement "Create custom policy" inline form
4. [ ] Add expiration date support for temporary access grants
5. [ ] Auto-populate `userIds: [memberId]` when creating user-specific policy
6. [ ] API endpoint to assign policy to user (adds userId to policy's userIds array)

### Phase 5: Policy Preview

1. [ ] Create `PolicyPreview` component for Policy Builder
2. [ ] Generate natural language description from policy config
3. [ ] Show affected user count estimation (users with matching roles)
4. [ ] Real-time preview updates as form changes
5. [ ] Visual distinction for Allow vs Deny policies
6. [ ] Warning indicators for potentially dangerous policies

---

## Component Structure

```
packages/web/src/
├── components/policies/
│   ├── PolicyBuilderModal.tsx        # Main modal (refactored) - role-based only
│   ├── sections/
│   │   ├── RolesSection.tsx          # WHO - base roles + functional roles
│   │   ├── ActionSection.tsx         # WHAT - action multi-select
│   │   ├── ResourceSection.tsx       # WHICH - resource types + filters
│   │   └── EffectSection.tsx         # EFFECT - allow/deny + conditions
│   ├── ActionGroupSelect.tsx         # Grouped action checkboxes
│   ├── ResourceTypeSelect.tsx        # Multi-select resource types
│   ├── AttributeFilters.tsx          # Conditional attribute filters
│   ├── PolicyPreview.tsx             # Natural language preview
│   └── PolicyDetailModal.tsx         # Read-only view (existing)
│
├── components/members/
│   ├── MemberPoliciesTab.tsx         # Policies tab content
│   ├── InheritedPoliciesList.tsx     # Read-only list of role-inherited policies
│   ├── AssignedPoliciesList.tsx      # Editable list of user-specific policies
│   ├── EffectivePermissions.tsx      # Computed permissions summary
│   └── AssignPolicyModal.tsx         # Modal to assign/create user policy
│
└── routes/organizations/$organizationId/settings/
    ├── policies.tsx                  # Policy list page (existing)
    └── members/
        └── $memberId.tsx             # Member detail page with Policies tab
```

---

## Accessibility

1. **Keyboard Navigation**
   - Tab through all form sections
   - Arrow keys within checkbox/radio groups
   - Enter/Space to toggle selections
   - Escape to close modal

2. **Screen Reader Support**
   - ARIA labels on all form controls
   - Live region for preview updates
   - Error announcements on validation

3. **Visual Feedback**
   - Clear focus indicators
   - Validation error highlighting
   - Selected state indicators for all inputs

---

## Testing Requirements

### Unit Tests
- [ ] ResourceCondition schema handles both array and wildcard
- [ ] Policy preview generates correct descriptions for role-based policies
- [ ] Effective permissions computed correctly from inherited + assigned policies
- [ ] Action inference determines resource types

### Integration Tests
- [ ] Create policy with multiple resource types
- [ ] Assign existing policy to user via Member page
- [ ] Create user-specific policy via Member page
- [ ] Policy evaluation handles new schema format
- [ ] Migration converts existing policies correctly
- [ ] `GET /members/{memberId}/policies` returns inherited + assigned policies

### E2E Tests
- [ ] Full role-based policy creation flow
- [ ] Edit existing policy with new format
- [ ] Member page shows inherited policies (read-only)
- [ ] Member page allows assigning/removing user-specific policies
- [ ] Assign existing policy to user
- [ ] Create custom policy for user with expiration
- [ ] Preview updates in real-time
- [ ] Validation prevents invalid combinations

---

## Related Files

- `packages/web/src/routes/organizations/$organizationId/settings/policies.tsx` - Policy list page
- `packages/web/src/routes/organizations/$organizationId/settings/members.tsx` - Members list page
- `packages/web/src/components/policies/PolicyBuilderModal.tsx` - Current form (to be refactored)
- `packages/core/src/authorization/PolicyConditions.ts` - Condition schemas
- `packages/core/src/authorization/AuthorizationPolicy.ts` - Policy entity
- `packages/api/src/Definitions/PolicyApi.ts` - API definitions
- `packages/api/src/Definitions/MemberApi.ts` - Member API (needs policy endpoints)
- `packages/persistence/src/Layers/PolicyRepositoryLive.ts` - Repository

---

## URGENT: System Policy Sync with Simplified Fiscal Period States

### Background

The fiscal period states have been simplified from 5 states to 2 states:

**Before (5 states):**
- Future - Period hasn't started
- Open - Period is active
- SoftClose - Period is soft-closed (controllers can still work)
- Closed - Period is closed
- Locked - Period is permanently locked

**After (2 states):**
- Open - Period is active and accepts journal entries
- Closed - Period is closed (no entries allowed)

The domain layer (`packages/core/src/fiscal/FiscalPeriodStatus.ts`) has been updated, but the policy system is **out of sync**.

### Current Issues

#### 1. PeriodStatusCondition References Old States

**File:** `packages/core/src/authorization/PolicyConditions.ts` (lines 140-146)

```typescript
// CURRENT - OUT OF SYNC
export const PeriodStatusCondition = Schema.Literal(
  "Future",      // ❌ No longer exists
  "Open",        // ✓ Valid
  "SoftClose",   // ❌ No longer exists
  "Closed",      // ✓ Valid
  "Locked"       // ❌ No longer exists
)
```

#### 2. System Policies Reference Non-Existent States

**File:** `packages/persistence/src/Seeds/SystemPolicies.ts`

Current system policies (8 total) include 5 that reference obsolete states:

| Policy | Status Condition | Issue |
|--------|------------------|-------|
| Prevent Modifications to Locked Periods | `["Locked"]` | ❌ State removed |
| Prevent Modifications to Closed Periods | `["Closed"]` | ✓ Valid |
| Prevent Entries in Future Periods | `["Future"]` | ❌ State removed |
| Allow SoftClose Period Access for Controllers | `["SoftClose"]` | ❌ State removed |
| Restrict SoftClose Period Access | `["SoftClose"]` | ❌ State removed |

#### 3. Obsolete Priority Constants

**File:** `packages/core/src/authorization/AuthorizationPolicy.ts`

```typescript
// CURRENT - OUT OF SYNC
export const SYSTEM_POLICY_PRIORITIES = {
  PLATFORM_ADMIN_OVERRIDE: 1000,
  LOCKED_PERIOD_PROTECTION: 999,     // ❌ No longer needed
  CLOSED_PERIOD_PROTECTION: 999,     // ✓ Keep
  FUTURE_PERIOD_PROTECTION: 999,     // ❌ No longer needed
  SOFTCLOSE_CONTROLLER_ACCESS: 998,  // ❌ No longer needed
  SOFTCLOSE_DEFAULT_DENY: 997,       // ❌ No longer needed
  OWNER_FULL_ACCESS: 900,            // ✓ Keep
  VIEWER_READ_ONLY: 100              // ✓ Keep
}
```

### Required Changes

#### 1. Update PeriodStatusCondition Schema

```typescript
// packages/core/src/authorization/PolicyConditions.ts

// AFTER - Aligned with domain
export const PeriodStatusCondition = Schema.Literal(
  "Open",
  "Closed"
)
```

#### 2. Simplify SYSTEM_POLICY_PRIORITIES

```typescript
// packages/core/src/authorization/AuthorizationPolicy.ts

export const SYSTEM_POLICY_PRIORITIES = {
  PLATFORM_ADMIN_OVERRIDE: 1000,
  CLOSED_PERIOD_PROTECTION: 999,
  OWNER_FULL_ACCESS: 900,
  VIEWER_READ_ONLY: 100
} as const
```

#### 3. Simplify System Policies (8 → 4)

**Keep these 4 policies:**

1. **Platform Admin Full Access** (priority 1000)
   - No changes needed

2. **Organization Owner Full Access** (priority 900)
   - No changes needed

3. **Viewer Read-Only Access** (priority 100)
   - No changes needed

4. **Prevent Modifications to Closed Periods** (priority 999)
   - Keeps the same logic, just ensure it only references `["Closed"]`
   - This single policy now covers all "no modifications after closing" scenarios

**Remove these 4 policies:**

- ~~Prevent Modifications to Locked Periods~~ - Merged into Closed protection
- ~~Prevent Entries in Future Periods~~ - Future state no longer exists
- ~~Allow SoftClose Period Access for Controllers~~ - SoftClose no longer exists
- ~~Restrict SoftClose Period Access~~ - SoftClose no longer exists

#### 4. Update hasSystemPolicies Check

```typescript
// packages/persistence/src/Seeds/SystemPolicies.ts

export function hasSystemPolicies(
  policies: ReadonlyArray<{ isSystemPolicy: boolean }>
): boolean {
  const systemPolicyCount = policies.filter((p) => p.isSystemPolicy).length
  return systemPolicyCount >= 4  // Changed from 8 to 4
}
```

#### 5. Update JournalEntryService Type

```typescript
// packages/core/src/journal/JournalEntryService.ts (line 222)

// BEFORE
export type PeriodStatus = "Future" | "Open" | "SoftClose" | "Closed" | "Locked"

// AFTER - Use the domain type
import { FiscalPeriodStatus } from "../fiscal/FiscalPeriodStatus.ts"
```

### Migration Considerations

1. **Existing Organizations**: Existing organizations may have the old 8 system policies seeded. A migration should:
   - Delete the 4 obsolete policies
   - Verify the 4 remaining policies are correct

2. **Custom Policies**: User-created policies that reference `periodStatus: ["Locked"]`, `["Future"]`, or `["SoftClose"]` should:
   - Be migrated to `["Closed"]` or removed
   - Or the system should gracefully ignore non-existent status values

### Files to Update

| File | Change |
|------|--------|
| `packages/core/src/authorization/PolicyConditions.ts` | Update `PeriodStatusCondition` to only `"Open"` and `"Closed"` |
| `packages/core/src/authorization/AuthorizationPolicy.ts` | Remove obsolete priority constants |
| `packages/core/src/journal/JournalEntryService.ts` | Use domain `FiscalPeriodStatus` type |
| `packages/persistence/src/Seeds/SystemPolicies.ts` | Reduce from 8 to 4 policies, update `hasSystemPolicies` |
| `packages/persistence/test/Seeds/SystemPolicies.test.ts` | Update test expectations for 4 policies |
| `packages/persistence/test/PolicyEngine.test.ts` | Remove tests using obsolete status values |

### Implementation Phase (Add to Phase 1)

Add to **Phase 1: Multi-Resource Type Support (Backend + Policy Page)**:

1. [ ] Update `PeriodStatusCondition` schema to only `"Open"` and `"Closed"`
2. [ ] Remove obsolete `SYSTEM_POLICY_PRIORITIES` constants
3. [ ] Simplify system policies from 8 to 4 in `SystemPolicies.ts`
4. [ ] Update `hasSystemPolicies` check from 8 to 4
5. [ ] Create migration to delete obsolete system policies from existing organizations
6. [ ] Update `JournalEntryService` to use domain `FiscalPeriodStatus` type
7. [ ] Update all related tests

---

## Priority

**MEDIUM-HIGH** - The current policy UI works but creates friction for common use cases. These improvements will significantly enhance the admin experience when setting up authorization rules.

**System Policy Sync: HIGH** - The misalignment between domain and policy layer could cause authorization failures or unexpected behavior. Should be addressed before the UX improvements.
