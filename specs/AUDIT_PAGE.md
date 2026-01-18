# Audit Log Page Specification

This document specifies the design and implementation of a professional audit log page for the Accountability application.

---

## Current Issues

The existing audit log page has several problems:

1. ~~**Shows "null" values** - User ID displays as "null" because CurrentUserId is not passed to audit service~~ ✅ FIXED
2. ~~**Truncated changes** - Shows "+17 more" without ability to expand~~ ✅ FIXED (expandable rows)
3. ~~**No detail view** - Cannot click to see full entry details~~ ✅ FIXED (expandable detail panel)
4. ~~**Truncated IDs** - Entity IDs are cut off with no way to copy~~ ✅ FIXED (copy buttons)
5. ~~**No user names** - Shows raw UUIDs instead of user display names (Phase 2 - denormalization)~~ ✅ FIXED (Migration 0021, user names denormalized)
6. ~~**No entity names** - Shows raw IDs instead of entity names (e.g., account name)~~ ✅ FIXED
7. ~~**No organization scoping** - Shows entries from all organizations (security issue)~~ ✅ FIXED
8. ~~**Account entities not tracked** - Account create/update/delete operations are not being logged to the audit trail. This is a compliance gap - all account changes must be audited for SOX/GAAP requirements. Need to add `AuditLogService` calls to `AccountServiceLive`.~~ ✅ FIXED (Audit logging added to AccountsApiLive for create, update, and deactivate operations, AND AccountTemplatesApiLive for template-based account creation. Verified with integration test `AccountTemplatesApi.test.ts` "creates audit log entries when applying template". Updated to use `Effect.catchTag("AuditLogError")` instead of `Effect.catchAll` per spec requirements - ensures context issues surface as errors rather than being silently swallowed.)

---

## Design Goals

1. **Compliance-Ready** - Meet SOX, GAAP audit trail requirements
2. **User-Friendly** - Easy to search, filter, and understand changes
3. **Performant** - Handle large datasets with pagination and lazy loading
4. **Accessible** - Full keyboard navigation and screen reader support
5. **Actionable** - Link to affected entities, export capabilities

---

## CRITICAL: Testing Must Not Drive Architecture

**Tests should NEVER impose decisions on production code.**

The current codebase has patterns like:
- `Effect.serviceOption(AuditLogService)` - making audit logging optional
- `Effect.catchAllCause(() => Effect.void)` - silently swallowing errors
- `Effect.ignore` - discarding errors entirely

These patterns exist because someone decided "the code needs audit logging to be optional for tests and contexts where it's not available."

**This is completely wrong.**

### Why This Is Bad

1. **Tests should adapt to code, not the other way around** - If a service requires AuditLogService, tests must provide it
2. **Optional dependencies hide bugs** - When audit logging silently fails, you don't know until production
3. **Silent failures are unacceptable** - `catchAllCause` catches defects (bugs) which should crash, not be swallowed
4. **Compliance requires audit logging** - Making it optional defeats its entire purpose

### The Correct Approach

1. **Services are always required** - Use `yield* AuditLogService`, never `Effect.serviceOption`
2. **Tests provide real or test implementations** - Create `AuditLogServiceTest` that stores entries in memory
3. **Errors are always handled explicitly** - Use `Effect.catchTag` for expected errors, let defects crash
4. **No silent failures** - If audit logging fails, the operation should fail

### Example Test Layer

```typescript
// Test implementation that captures audit entries for assertions
const AuditLogServiceTest = Layer.succeed(
  AuditLogService,
  AuditLogService.of({
    logCreate: (entry) => Effect.sync(() => { testEntries.push(entry) }),
    logUpdate: (entry) => Effect.sync(() => { testEntries.push(entry) }),
    logDelete: (entry) => Effect.sync(() => { testEntries.push(entry) }),
    // ... etc
  })
)

// Tests provide the layer - code doesn't need to be "optional"
const TestLayer = Layer.mergeAll(
  DatabaseTestLayer,
  AuditLogServiceTest,
  CurrentUserIdTest
)
```

**Lint rules now enforce this:**
- `no-service-option` - Bans `Effect.serviceOption`
- `no-effect-ignore` - Bans `Effect.ignore`
- `no-effect-catchallcause` - Bans `Effect.catchAllCause`

### Two Types of Context: Global vs Per-Request

Context comes in two distinct types. This distinction is **critical**.

#### 1. Global Context (Application Services)

**Provided via Layers at application startup.** Long-lived services shared across all requests:
- Database connections, repositories, business services, configuration

```typescript
// Global context - provided via Layer at startup
const AppLayer = Layer.mergeAll(SqlClientLive, AccountServiceLive, AuditLogServiceLive)
const program = mainApp.pipe(Effect.provide(AppLayer))
```

#### 2. Per-Request Context (Request-Scoped Data)

**Provided via `Effect.provideService` for each request.** Data specific to a single HTTP request:
- `CurrentUserId` - the authenticated user
- `CurrentOrganizationMembership` - user's role in current org
- `CurrentEnvironmentContext` - IP, time, user agent from request

```typescript
// CORRECT - per-request context provided via Effect.provideService
const handleRequest = (req: Request) =>
  businessLogic().pipe(
    Effect.provideService(CurrentUserId, extractUserId(req)),
    Effect.provideService(CurrentEnvironmentContext, createEnvContext(req))
  )

// WRONG - NEVER use Layers for per-request data
businessLogic().pipe(
  Effect.provide(Layer.succeed(CurrentUserId, userId))  // NO! Layers are memoized
)
```

**Why `Effect.provideService` not Layers?**
- Layers are **memoized and shared** - using them for per-request data gives stale/wrong data
- `Effect.provideService` is **per-execution** - fresh value for each request

### Layer Creation vs Method Invocation Context

**Layer requirements** vs **method return type requirements** are different things:

```typescript
// Layer is created ONCE at startup - only needs global services
export const AuthorizationServiceLive: Layer.Layer<
  AuthorizationService,
  never,
  PolicyRepository | PolicyEngine  // Global services only - NO CurrentEnvironmentContext
> = Layer.effect(AuthorizationService, make)

// Methods are called PER REQUEST - declare request-scoped requirements in return type
interface AuthorizationService {
  checkPermission: (action: Action) => Effect.Effect<
    void,
    PermissionDeniedError,
    CurrentEnvironmentContext | CurrentOrganizationMembership  // Request-scoped here
  >
}
```

**The pattern:**
1. **Layer creation** - Does NOT include per-request context in requirements
2. **Service method return types** - MUST declare per-request context in their `R` type parameter
3. **HTTP middleware** - Provides per-request context via `Effect.provideService`
4. **Tests** - Provide test implementations via `Effect.provideService` (NOT layers for per-request context)

**DO NOT** try to add `CurrentEnvironmentContext` or `CurrentUserId` to Layer requirements - that's architecturally wrong.

---

## Page Layout

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Audit Log                                              [Export] [Refresh]│
│ Track all changes made to your organization's data                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Filter Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Search by user, entity, or description...]                              │
│                                                                          │
│ Action: [All ▼]  Entity: [All ▼]  Date: [From] - [To]  [Clear Filters]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Entries Table

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Timestamp          │ User        │ Action   │ Entity          │ Summary │
├─────────────────────────────────────────────────────────────────────────┤
│ Jan 15, 2:30 PM    │ Jane Smith  │ ● Update │ Account: Cash   │ 3 fields│
│ [expand ▼]                                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Jan 15, 2:28 PM    │ John Doe    │ ● Create │ Journal Entry   │ Created │
│ [expand ▼]                                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Expanded Row Detail

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Jan 15, 2025 at 2:30:45 PM EST                                          │
│                                                                          │
│ User: Jane Smith (jane@example.com)                                      │
│ Action: Update                                                           │
│ Entity: Account "Petty Cash" (1001)                                      │
│ Entity ID: 4ff540e3-8675-4f2c-b123-abc123456789                [Copy]   │
│                                                                          │
│ Changes:                                                                 │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ Field              │ Before              │ After                  │   │
│ ├───────────────────────────────────────────────────────────────────┤   │
│ │ name               │ "Petty Cash"        │ "Petty Cash Fund"      │   │
│ │ description        │ null                │ "Office expenses"      │   │
│ │ isActive           │ true                │ false                  │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│ [View Entity] [Copy Entry ID]                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. AuditLogEntry Row

**Display:**
- **Timestamp**: Relative time with full timestamp on hover (e.g., "2 hours ago" → "Jan 15, 2025 2:30:45 PM EST")
- **User**: Display name with email in tooltip; shows "System" for automated changes
- **Action**: Color-coded badge
  - Create: Green (`bg-green-100 text-green-800`)
  - Update: Blue (`bg-blue-100 text-blue-800`)
  - Delete: Red (`bg-red-100 text-red-800`)
  - StatusChange: Purple (`bg-purple-100 text-purple-800`)
- **Entity**: Type + Name (e.g., "Account: Cash", "Journal Entry: JE-00123")
- **Summary**: Brief description
  - Create: "Created"
  - Update: "N fields changed"
  - Delete: "Deleted"
  - StatusChange: "Status: Open → Closed"

**Interactions:**
- Click row to expand/collapse detail view
- Chevron icon indicates expandable state
- Keyboard: Enter/Space to toggle, Tab to navigate

### 2. AuditLogDetail Panel

**Sections:**

1. **Header**
   - Full timestamp with timezone
   - Entry ID with copy button

2. **Actor Information**
   - User name and email (or "System" for automated)
   - User role at time of action (if available)
   - IP address (if captured)
   - User agent/browser (if captured)

3. **Entity Information**
   - Entity type and human-readable name
   - Entity ID with copy button
   - Link to view entity (if user has permission)

4. **Changes Table**
   - Three columns: Field, Before, After
   - Null values shown as styled "—" dash
   - Long values truncated with expand option
   - JSON objects shown with syntax highlighting
   - Diff highlighting for text changes

5. **Actions**
   - "View Entity" button (links to entity detail page)
   - "Copy Entry ID" button
   - "Copy as JSON" button (for developers)

### 3. Filters

**Action Filter (Select):**
```
All Actions
─────────────
● Create
● Update
● Delete
● Status Change
```

**Entity Type Filter (Select):**
```
All Entity Types
─────────────
Organization
Company
Account
Journal Entry
Fiscal Year
Fiscal Period
... (all 14 types)
```

**Date Range:**
- Two date inputs (From, To)
- Preset buttons: "Today", "Last 7 days", "Last 30 days", "This month"
- Clear button to reset

**Search:**
- Searches across: user name, user email, entity name, entity ID
- Debounced (300ms)
- Shows search icon and clear button

### 4. Empty State

When no entries match filters:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         📋                                               │
│                                                                          │
│                   No audit entries found                                 │
│                                                                          │
│         Try adjusting your filters or date range                         │
│                                                                          │
│                      [Clear Filters]                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

When organization has no audit entries at all:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                         📋                                               │
│                                                                          │
│                   No activity recorded yet                               │
│                                                                          │
│     Changes to your organization's data will appear here                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5. Pagination

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Showing 1-25 of 1,234 entries          [← Previous]  Page 1 of 50  [Next →]│
└─────────────────────────────────────────────────────────────────────────┘
```

- 25 entries per page (configurable: 25, 50, 100)
- Previous/Next buttons disabled at bounds
- Shows total count
- Page size selector

---

## Data Integrity

### Organization Relationship

**All audit entries are always tied to an organization.** The `organization_id` is a required foreign key, not nullable.

```sql
ALTER TABLE audit_log
  ADD COLUMN organization_id UUID NOT NULL
  REFERENCES organizations(id);
```

### No Orphaned Entries

**Organizations cannot be hard-deleted, only soft-deleted.** This ensures:

1. **Audit trail preservation** - Every audit entry always has a valid organization reference
2. **Historical accuracy** - Past changes remain tied to their organizational context
3. **Compliance requirements** - SOX/GAAP require complete, unbroken audit trails
4. **No cascading deletes** - Deleting an organization would destroy potentially years of audit history

When an organization is "deleted":
- Set `is_active = false` or `deleted_at = NOW()`
- Audit entries remain intact and queryable
- Organization name preserved in historical records
- Admin can view audit history of deactivated organizations

This pattern extends to all audited entities:
- **Companies** - soft delete only, audit entries preserved
- **Accounts** - soft delete only, audit entries preserved
- **Journal Entries** - soft delete only, audit entries preserved
- **Fiscal Years/Periods** - soft delete only, audit entries preserved

---

## Data Requirements

### API Changes Needed

#### 1. Add Organization Filtering

```typescript
// Current
GET /api/v1/audit-log?entityType=Account&limit=25

// Required
GET /api/v1/organizations/{orgId}/audit-log?entityType=Account&limit=25
```

The API must scope audit entries to the current organization.

#### 2. Add User Lookup Endpoint

```typescript
// New endpoint to batch-fetch user display info
POST /api/v1/users/batch
Body: { userIds: string[] }
Response: { users: { id, displayName, email }[] }
```

Or enhance audit log response to include user info:

```typescript
// Enhanced response
{
  entries: [{
    ...existing fields,
    user: {
      id: string,
      displayName: string,
      email: string
    } | null
  }],
  total: number
}
```

#### 3. Add Entity Name Lookup

For better UX, the API should return entity names where possible:

```typescript
{
  entries: [{
    ...existing fields,
    entityName: string | null  // "Petty Cash", "JE-00123", etc.
  }]
}
```

This requires the service to capture entity names at audit time (not just IDs).

### Database Changes

#### 1. Add Organization ID to Audit Log

```sql
ALTER TABLE audit_log ADD COLUMN organization_id UUID;
CREATE INDEX idx_audit_log_org ON audit_log(organization_id, timestamp DESC);
```

All audit entries must be associated with an organization for proper scoping.

#### 2. Add Entity Name Column

```sql
ALTER TABLE audit_log ADD COLUMN entity_name VARCHAR(255);
```

Capture human-readable name at audit time for display purposes.

#### 3. Add User Name Column (Denormalized)

```sql
ALTER TABLE audit_log ADD COLUMN user_display_name VARCHAR(255);
ALTER TABLE audit_log ADD COLUMN user_email VARCHAR(255);
```

Denormalize user info to avoid joins and preserve historical names.

---

## Implementation Phases

### Phase 1: Fix Critical Issues

1. **Add organization scoping to API** ✅ DONE
   - ✅ Add `organizationId` parameter to audit log endpoint
   - ✅ Filter entries by organization in repository
   - ✅ Update page to pass current organization ID

2. **Capture user context** ✅ DONE
   - ✅ Implement `CurrentUserId` in API middleware (from AUTHORIZATION_MISSING.md)
   - ✅ Pass user ID to audit service calls
   - ✅ Update audit entries to include user info

3. **Add entity name capture** ✅ DONE
   - ✅ Update `AuditLogService.logCreate/Update/Delete` to accept entity name
   - ✅ Update all service integrations to pass entity names
   - ✅ Add migration for `entity_name` column
   - ✅ Update frontend to display entity names in table and detail panel

### Phase 2: Improve Display

4. **Implement expandable row detail** ✅ DONE
   - ✅ Added `AuditLogRow` component with expand/collapse toggle
   - ✅ Added `AuditLogDetailPanel` component showing all changes in expanded view
   - ✅ Added copy buttons for Entry ID, Entity ID, and User ID
   - ✅ Added "Copy as JSON" button for developers
   - ✅ Keyboard navigation (Enter/Space to toggle, Tab to navigate)
   - ✅ ARIA attributes for accessibility (aria-expanded, role="button")
   - ✅ Changes table with Before/After columns in detail panel
   - ✅ Long values are collapsible with `<details>` element

5. **Add user display names** ✅ DONE
   - ✅ Denormalize user name/email into audit entries (Migration 0021, updated AuditLogServiceLive to look up user info)
   - ✅ Display "System" for null users (italic styling)
   - ✅ Show email in tooltip (Tooltip on user display name shows email)

6. **Improve changes display** ✅ DONE
   - ✅ Format null as styled dash (—)
   - ✅ Color-coded changes (red for "before", green for "after")
   - ✅ Long JSON values expandable with `<details>` element
   - ✅ Summary shows "Entity created", "Entity deleted", or "N fields changed"

7. **Format Effect-TS types for human-readable display** ✅ DONE
   - [x] Render Option types properly: `Option.None` → "—" (em-dash), `Option.Some(value)` → the unwrapped value
   - [x] Render DateTime/Timestamp: `{ "epochMillis": 1768774143932 }` → "Jan 18, 2026, 9:29 AM"
   - [x] Render Date objects: `{ "day": 31, "month": 12 }` → "December 31"
   - [x] Render Date with year: `{ "year": 2026, "month": 1, "day": 15 }` → "Jan 15, 2026"
   - [x] Render booleans: `true` → "Yes", `false` → "No"
   - [x] Render currency codes: Show as-is (e.g., "USD")
   - [x] Render BigDecimal: `{ "value": "1000.50" }` → "1,000.50"
   - [x] Implemented `formatEffectValue()` helper that detects and formats these types
   - [x] Updated `ChangeValue` component to use the new formatter
   - [x] Updated CSV export to use human-readable formatting

   **Implementation:** See `formatEffectValue()` in `packages/web/src/routes/organizations/$organizationId/audit-log/index.tsx`

   **Example Transformations:**

   | Raw Value | Rendered |
   |-----------|----------|
   | `{ "_id": "Option", "_tag": "None" }` | — |
   | `{ "_id": "Option", "_tag": "Some", "value": "Active" }` | Active |
   | `{ "epochMillis": 1768774143932 }` | Jan 18, 2026, 9:29 AM |
   | `{ "day": 31, "month": 12 }` | December 31 |
   | `{ "year": 2026, "month": 1, "day": 15 }` | Jan 15, 2026 |
   | `true` | Yes |
   | `false` | No |
   | `1000.5` | 1,000.5 |
   | `{ "value": "1000.50" }` | 1,000.50 |
   | `"USD"` | USD |

### Phase 3: Enhanced Features

8. **Add search functionality** ✅ DONE
   - ✅ Full-text search across entity name and entity ID (case-insensitive ILIKE)
   - ✅ Debounced input (300ms)
   - ✅ Search icon in input field
   - ✅ Search included in "Clear Filters" functionality

9. **Add date range presets** ✅ DONE
   - ✅ "Today", "Last 7 days", "Last 30 days", "This month" preset buttons
   - ✅ Custom date range picker (via date inputs)
   - ✅ Active preset is highlighted
   - ✅ Presets immediately apply and fetch filtered data

10. **Add export functionality** ✅ DONE
    - ✅ Export filtered results as CSV (Export CSV button in page header)
    - ✅ Export single entry as JSON (Copy as JSON button in detail panel)

11. **Add entity linking** ✅ DONE
    - ✅ "View Entity" button on detail panel
    - ✅ Links to entity detail page based on entity type (Organization, Company, Account, JournalEntry, ConsolidationGroup, ExchangeRate, FiscalYear, FiscalPeriod)
    - ✅ Button hidden for deleted entities and entity types without detail pages

---

## Component Structure

```
packages/web/src/
├── routes/organizations/$organizationId/audit-log/
│   └── index.tsx                    # Page component
├── components/audit-log/
│   ├── AuditLogTable.tsx           # Main table component
│   ├── AuditLogRow.tsx             # Single row (collapsed)
│   ├── AuditLogDetail.tsx          # Expanded detail panel
│   ├── AuditLogFilters.tsx         # Filter bar
│   ├── AuditLogChangesTable.tsx    # Changes diff table
│   ├── AuditLogEmptyState.tsx      # Empty states
│   └── AuditLogPagination.tsx      # Pagination controls
```

---

## Accessibility

1. **Keyboard Navigation**
   - Tab through rows and interactive elements
   - Enter/Space to expand/collapse rows
   - Escape to collapse expanded row

2. **Screen Reader Support**
   - ARIA labels on all interactive elements
   - Announce row expansion state
   - Describe action badges with text

3. **Focus Management**
   - Focus trap in expanded detail panel
   - Return focus to row when collapsed
   - Skip link to main content

---

## Testing Requirements

### Unit Tests
- [ ] AuditLogRow renders all states correctly
- [ ] AuditLogDetail displays changes table
- [ ] AuditLogFilters update query params
- [ ] Pagination calculates pages correctly

### Integration Tests
- [ ] API returns organization-scoped entries
- [ ] User names display correctly
- [ ] Entity names display correctly
- [ ] Filters apply to API query

### E2E Tests
- [ ] Filter by action type
- [ ] Filter by entity type
- [ ] Filter by date range
- [ ] Expand row shows detail
- [ ] Copy ID buttons work
- [ ] Pagination navigates correctly
- [ ] Empty state displays when no entries

---

## Related Files

- `specs/AUTHORIZATION_MISSING.md` - Section 3: Audit Log Integration Gap
- `packages/core/src/Domains/AuditLog.ts` - Domain model
- `packages/api/src/Definitions/AuditLogApi.ts` - API definition
- `packages/persistence/src/Layers/AuditLogRepositoryLive.ts` - Repository
- `packages/persistence/src/Layers/AuditLogServiceLive.ts` - Service implementation

---

## Priority

**HIGH** - Audit logging is a compliance requirement for accounting software. A proper, usable audit log is essential for SOX compliance, internal controls, and debugging production issues.
