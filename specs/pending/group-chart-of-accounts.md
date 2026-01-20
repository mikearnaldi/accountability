# Group Chart of Accounts & Account Mapping Specification

This specification defines the Group Chart of Accounts (Group COA) feature for consolidation, enabling companies with different local charts of accounts to be consolidated into a unified reporting structure.

---

## Overview

Currently, consolidation aggregates accounts by matching account numbers directly. This is restrictive because:
- Acquired subsidiaries often have different charts of accounts
- Local statutory requirements may mandate specific account structures
- Different accounting systems use different numbering conventions

The solution is a **two-tier chart of accounts architecture**:

| Layer | Description |
|-------|-------------|
| **Local COA** | Each company's own chart of accounts (can vary) |
| **Group COA** | Unified chart for consolidated reporting |

A **mapping table** connects local accounts to group accounts, enabling consolidation across disparate structures.

---

## Status: NOT STARTED

This is a new feature specification.

---

## Domain Model

### GroupChartOfAccounts

A Group Chart of Accounts defines the unified account structure for consolidated reporting.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | GroupChartOfAccountsId | Yes | Primary key |
| organizationId | OrganizationId | Yes | FK to Organization |
| name | NonEmptyTrimmedString | Yes | Display name (e.g., "Corporate Group COA") |
| description | Option[String] | No | Detailed description |
| baseCurrency | CurrencyCode | Yes | Default reporting currency |
| isActive | Boolean | Yes | Whether the Group COA is active |
| createdAt | Timestamp | Yes | Creation time |
| updatedAt | Timestamp | Yes | Last update time |

**Relationships:**
- Belongs to **Organization**
- Has many **GroupAccounts**
- Used by many **ConsolidationGroups**

### GroupAccount

An account in the Group Chart of Accounts.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | GroupAccountId | Yes | Primary key |
| groupChartOfAccountsId | GroupChartOfAccountsId | Yes | FK to GroupChartOfAccounts |
| accountNumber | NonEmptyTrimmedString | Yes | Group account number (e.g., "100000") |
| name | NonEmptyTrimmedString | Yes | Account name (e.g., "Cash and Cash Equivalents") |
| description | Option[String] | No | Detailed description |
| accountType | AccountType | Yes | Asset, Liability, Equity, Revenue, Expense |
| accountCategory | AccountCategory | Yes | Detailed category for reporting |
| normalBalance | NormalBalance | Yes | Debit or Credit |
| parentAccountId | Option[GroupAccountId] | No | Parent for hierarchy |
| isPostable | Boolean | Yes | Whether mappings can target this account |
| displayOrder | Number | Yes | Order in reports |
| createdAt | Timestamp | Yes | Creation time |
| updatedAt | Timestamp | Yes | Last update time |

**Constraints:**
- `accountNumber` must be unique within a GroupChartOfAccounts
- Only postable accounts (`isPostable = true`) can be mapping targets

### AccountMapping

Maps a local (company) account to a group account.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | AccountMappingId | Yes | Primary key |
| consolidationGroupId | ConsolidationGroupId | Yes | FK to ConsolidationGroup |
| companyId | CompanyId | Yes | FK to Company (the subsidiary) |
| localAccountNumber | NonEmptyTrimmedString | Yes | Account number in local COA |
| groupAccountId | GroupAccountId | Yes | FK to target GroupAccount |
| mappingType | MappingType | Yes | Direct, Range, or Pattern |
| localAccountRangeEnd | Option[String] | No | End of range (for Range type) |
| pattern | Option[String] | No | Regex pattern (for Pattern type) |
| isActive | Boolean | Yes | Whether mapping is active |
| createdAt | Timestamp | Yes | Creation time |
| updatedAt | Timestamp | Yes | Last update time |

**MappingType:**
| Type | Description | Example |
|------|-------------|---------|
| Direct | One-to-one mapping | Local `1010` → Group `100000` |
| Range | Range of accounts to one | Local `1000-1099` → Group `100000` |
| Pattern | Regex pattern to one | Local `5*` → Group `500000` |

**Constraints:**
- Combination of `(consolidationGroupId, companyId, localAccountNumber)` must be unique for Direct mappings
- Range mappings cannot overlap within the same company
- Pattern mappings are evaluated after Direct and Range

### MappingValidationResult

Result of validating account mappings for a company.

| Field | Type | Description |
|-------|------|-------------|
| companyId | CompanyId | The validated company |
| totalAccounts | Number | Total accounts in local COA |
| mappedAccounts | Number | Accounts with valid mappings |
| unmappedAccounts | Chunk[UnmappedAccount] | Accounts without mappings |
| isComplete | Boolean | Whether all accounts are mapped |

### UnmappedAccount

Details about an unmapped local account.

| Field | Type | Description |
|-------|------|-------------|
| accountNumber | String | Local account number |
| accountName | String | Local account name |
| accountType | AccountType | Account type |
| balance | MonetaryAmount | Current balance (for prioritization) |

---

## Updated ConsolidationGroup

The ConsolidationGroup entity needs a new field to reference the Group COA.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| groupChartOfAccountsId | Option[GroupChartOfAccountsId] | No | FK to GroupChartOfAccounts |

**Behavior:**
- If `groupChartOfAccountsId` is None, consolidation uses direct account number matching (current behavior)
- If set, consolidation uses the mapping table to translate local accounts to group accounts

---

## Database Schema

### Tables

```sql
-- Group Chart of Accounts
CREATE TABLE group_charts_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_currency VARCHAR(3) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, name)
);

-- Group Accounts
CREATE TABLE group_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chart_of_accounts_id UUID NOT NULL REFERENCES group_charts_of_accounts(id) ON DELETE CASCADE,
  account_number VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  account_type account_type NOT NULL,
  account_category account_category NOT NULL,
  normal_balance normal_balance NOT NULL DEFAULT 'Debit',
  parent_account_id UUID REFERENCES group_accounts(id),
  is_postable BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(group_chart_of_accounts_id, account_number)
);

-- Mapping Type Enum
CREATE TYPE account_mapping_type AS ENUM ('Direct', 'Range', 'Pattern');

-- Account Mappings
CREATE TABLE account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_group_id UUID NOT NULL REFERENCES consolidation_groups(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  local_account_number VARCHAR(20) NOT NULL,
  group_account_id UUID NOT NULL REFERENCES group_accounts(id),
  mapping_type account_mapping_type NOT NULL DEFAULT 'Direct',
  local_account_range_end VARCHAR(20),
  pattern VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Direct mappings must be unique per company/account
  UNIQUE(consolidation_group_id, company_id, local_account_number)
    WHERE mapping_type = 'Direct'
);

-- Add Group COA reference to consolidation_groups
ALTER TABLE consolidation_groups
  ADD COLUMN group_chart_of_accounts_id UUID REFERENCES group_charts_of_accounts(id);

-- Indexes
CREATE INDEX idx_group_accounts_chart ON group_accounts(group_chart_of_accounts_id);
CREATE INDEX idx_group_accounts_parent ON group_accounts(parent_account_id);
CREATE INDEX idx_account_mappings_group ON account_mappings(consolidation_group_id);
CREATE INDEX idx_account_mappings_company ON account_mappings(company_id);
CREATE INDEX idx_account_mappings_lookup ON account_mappings(consolidation_group_id, company_id, local_account_number);
```

---

## API Endpoints

### Group Chart of Accounts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/organizations/{orgId}/group-charts-of-accounts` | List all Group COAs |
| POST | `/organizations/{orgId}/group-charts-of-accounts` | Create Group COA |
| GET | `/organizations/{orgId}/group-charts-of-accounts/{id}` | Get Group COA details |
| PUT | `/organizations/{orgId}/group-charts-of-accounts/{id}` | Update Group COA |
| DELETE | `/organizations/{orgId}/group-charts-of-accounts/{id}` | Delete Group COA |

### Group Accounts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/group-charts-of-accounts/{coaId}/accounts` | List accounts in Group COA |
| POST | `/group-charts-of-accounts/{coaId}/accounts` | Create Group Account |
| PUT | `/group-charts-of-accounts/{coaId}/accounts/{id}` | Update Group Account |
| DELETE | `/group-charts-of-accounts/{coaId}/accounts/{id}` | Delete Group Account |
| POST | `/group-charts-of-accounts/{coaId}/accounts/import` | Import from template |

### Account Mappings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/consolidation-groups/{groupId}/mappings` | List all mappings for group |
| GET | `/consolidation-groups/{groupId}/mappings/company/{companyId}` | List mappings for company |
| POST | `/consolidation-groups/{groupId}/mappings` | Create mapping |
| POST | `/consolidation-groups/{groupId}/mappings/bulk` | Bulk create mappings |
| PUT | `/consolidation-groups/{groupId}/mappings/{id}` | Update mapping |
| DELETE | `/consolidation-groups/{groupId}/mappings/{id}` | Delete mapping |
| GET | `/consolidation-groups/{groupId}/mappings/validate` | Validate all mappings |
| GET | `/consolidation-groups/{groupId}/mappings/unmapped/{companyId}` | Get unmapped accounts |
| POST | `/consolidation-groups/{groupId}/mappings/auto-suggest/{companyId}` | Auto-suggest mappings |

---

## Mapping Resolution Algorithm

When consolidating, local accounts are resolved to group accounts using this priority:

```
1. Direct mapping (exact match on local_account_number)
   ↓ not found
2. Range mapping (local_account_number within range)
   ↓ not found
3. Pattern mapping (local_account_number matches regex)
   ↓ not found
4. Unmapped (reported as validation error)
```

### Pseudocode

```typescript
function resolveGroupAccount(
  consolidationGroupId: ConsolidationGroupId,
  companyId: CompanyId,
  localAccountNumber: string
): Option<GroupAccountId> {

  // 1. Try direct mapping
  const direct = findDirectMapping(consolidationGroupId, companyId, localAccountNumber)
  if (Option.isSome(direct)) return direct

  // 2. Try range mapping
  const range = findRangeMapping(consolidationGroupId, companyId, localAccountNumber)
  if (Option.isSome(range)) return range

  // 3. Try pattern mapping
  const pattern = findPatternMapping(consolidationGroupId, companyId, localAccountNumber)
  if (Option.isSome(pattern)) return pattern

  // 4. No mapping found
  return Option.none()
}
```

---

## Updated Consolidation Flow

The Aggregate step in `ConsolidationService` changes to use mappings:

### Current (Account Number Matching)

```typescript
// Accounts keyed by local account number
const balanceMap = new Map<string, AggregatedBalance>()
for (const line of trialBalance.lineItems) {
  const key = line.accountNumber  // Direct number match
  // aggregate...
}
```

### New (Group Account Mapping)

```typescript
// Accounts keyed by group account ID
const balanceMap = new Map<GroupAccountId, AggregatedBalance>()
for (const line of trialBalance.lineItems) {
  const groupAccountId = resolveGroupAccount(
    groupId,
    companyId,
    line.accountNumber
  )
  if (Option.isNone(groupAccountId)) {
    // Track unmapped account for validation
    unmappedAccounts.push(line)
    continue
  }
  // aggregate using group account...
}
```

---

## Auto-Suggest Mapping Feature

To reduce manual mapping effort, implement an auto-suggest algorithm:

### Matching Strategies

1. **Exact Name Match** - Local "Cash" → Group "Cash" (high confidence)
2. **Fuzzy Name Match** - Local "Cash and Equivalents" → Group "Cash" (medium confidence)
3. **Account Type + Category Match** - Same type/category suggests mapping
4. **Number Pattern Match** - Local `1xxx` accounts → Group `1xxxxx` (low confidence)

### Suggestion Response

```typescript
interface MappingSuggestion {
  localAccountNumber: string
  localAccountName: string
  suggestedGroupAccountId: GroupAccountId
  suggestedGroupAccountName: string
  confidence: "High" | "Medium" | "Low"
  matchReason: string
}
```

---

## UI Design

### Group Chart of Accounts Management

**Location:** Organization Settings → Group Charts of Accounts

**List View:**
- Name, Description, Account Count, Used By (consolidation groups)
- Actions: View, Edit, Delete

**Detail View:**
- Hierarchical tree view of group accounts
- Drag-and-drop reordering
- Inline editing
- Import from template button

### Account Mapping UI

**Location:** Consolidation Group → Account Mappings tab

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Account Mappings for [Consolidation Group Name]                 │
├─────────────────────────────────────────────────────────────────┤
│ Company: [Dropdown: Select subsidiary]     [Validate] [Auto-Map]│
├─────────────────────────────────────────────────────────────────┤
│ Mapping Status: 45/50 accounts mapped (90%)  ■■■■■■■■■□         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOCAL ACCOUNT              →    GROUP ACCOUNT                  │
│  ─────────────────────────────────────────────────────────────  │
│  1010 Cash - Operating      →    100000 Cash and Equivalents ✓  │
│  1020 Cash - Payroll        →    100000 Cash and Equivalents ✓  │
│  1100 Accounts Receivable   →    110000 Trade Receivables    ✓  │
│  1200 Inventory             →    [Select group account...]   ⚠  │
│  ...                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Company selector dropdown
- Progress bar showing mapping completion
- Side-by-side local ↔ group account view
- Dropdown to select group account for each local account
- Bulk actions: Auto-map suggested, Clear all
- Filter: Show unmapped only
- Validation errors highlighted

---

## Implementation Phases

### Phase 1: Domain Model & Database

**Goal**: Create domain entities and database schema.

**Files to create:**
- `packages/core/src/consolidation/GroupChartOfAccounts.ts`
- `packages/core/src/consolidation/GroupAccount.ts`
- `packages/core/src/consolidation/AccountMapping.ts`
- `packages/persistence/src/Migrations/Migration00XX_CreateGroupChartOfAccounts.ts`

**Tasks:**
- [ ] **1.1** Create `GroupChartOfAccountsId` branded type
- [ ] **1.2** Create `GroupChartOfAccounts` Schema.Class
- [ ] **1.3** Create `GroupAccountId` branded type
- [ ] **1.4** Create `GroupAccount` Schema.Class
- [ ] **1.5** Create `AccountMappingId` branded type
- [ ] **1.6** Create `MappingType` literal schema
- [ ] **1.7** Create `AccountMapping` Schema.Class
- [ ] **1.8** Create `MappingSuggestion` Schema.Class
- [ ] **1.9** Create `MappingValidationResult` Schema.Class
- [ ] **1.10** Create database migration with all tables and indexes
- [ ] **1.11** Run `pnpm typecheck` to verify

**Verification**: `pnpm typecheck` passes

---

### Phase 2: Repository Layer

**Goal**: Implement repository interfaces and implementations.

**Files to create:**
- `packages/persistence/src/Services/GroupChartOfAccountsRepository.ts`
- `packages/persistence/src/Services/GroupChartOfAccountsRepositoryLive.ts`
- `packages/persistence/src/Services/AccountMappingRepository.ts`
- `packages/persistence/src/Services/AccountMappingRepositoryLive.ts`

**Tasks:**
- [ ] **2.1** Define `GroupChartOfAccountsRepository` interface
- [ ] **2.2** Implement `GroupChartOfAccountsRepositoryLive`
- [ ] **2.3** Define `AccountMappingRepository` interface with:
  - `findByConsolidationGroup`
  - `findByCompany`
  - `resolveGroupAccount` (the mapping resolution)
  - `getUnmappedAccounts`
  - `bulkCreate`
- [ ] **2.4** Implement `AccountMappingRepositoryLive`
- [ ] **2.5** Write repository tests
- [ ] **2.6** Run `pnpm test` to verify

**Verification**: All tests pass

---

### Phase 3: Service Layer

**Goal**: Implement business logic services.

**Files to create:**
- `packages/core/src/consolidation/GroupChartOfAccountsService.ts`
- `packages/core/src/consolidation/AccountMappingService.ts`

**Tasks:**
- [ ] **3.1** Create `GroupChartOfAccountsService` with CRUD operations
- [ ] **3.2** Create `AccountMappingService` with:
  - Mapping CRUD
  - `validateMappings` - check all accounts have mappings
  - `suggestMappings` - auto-suggest algorithm
  - `resolveGroupAccount` - mapping resolution
- [ ] **3.3** Update `ConsolidationService.executeAggregateStep` to use mappings
- [ ] **3.4** Write service tests
- [ ] **3.5** Run `pnpm test` to verify

**Verification**: All tests pass

---

### Phase 4: API Layer

**Goal**: Expose REST endpoints.

**Files to create:**
- `packages/api/src/Definitions/GroupChartOfAccountsApi.ts`
- `packages/api/src/Layers/GroupChartOfAccountsApiLive.ts`
- `packages/api/src/Definitions/AccountMappingApi.ts`
- `packages/api/src/Layers/AccountMappingApiLive.ts`

**Tasks:**
- [ ] **4.1** Define `GroupChartOfAccountsApi` HttpApiGroup
- [ ] **4.2** Implement `GroupChartOfAccountsApiLive`
- [ ] **4.3** Define `AccountMappingApi` HttpApiGroup
- [ ] **4.4** Implement `AccountMappingApiLive`
- [ ] **4.5** Register in main API
- [ ] **4.6** Run `pnpm generate:api` to regenerate client
- [ ] **4.7** Write API tests
- [ ] **4.8** Run `pnpm test` to verify

**Verification**: All tests pass, API client regenerated

---

### Phase 5: Frontend - Group COA Management

**Goal**: Build UI for managing Group Charts of Accounts.

**Files to create:**
- `packages/web/src/routes/organizations/$organizationId/settings/group-charts-of-accounts/index.tsx`
- `packages/web/src/routes/organizations/$organizationId/settings/group-charts-of-accounts/$chartId/index.tsx`
- `packages/web/src/components/consolidation/GroupAccountTree.tsx`

**Tasks:**
- [ ] **5.1** Create Group COA list page
- [ ] **5.2** Create Group COA detail page with account tree
- [ ] **5.3** Implement create/edit modal for Group COA
- [ ] **5.4** Implement create/edit modal for Group Account
- [ ] **5.5** Implement import from template feature
- [ ] **5.6** Run `pnpm generate-routes`
- [ ] **5.7** Write E2E tests

**Verification**: E2E tests pass

---

### Phase 6: Frontend - Account Mapping UI

**Goal**: Build UI for managing account mappings.

**Files to create:**
- `packages/web/src/routes/organizations/$organizationId/consolidation/$groupId/mappings/index.tsx`
- `packages/web/src/components/consolidation/AccountMappingTable.tsx`
- `packages/web/src/components/consolidation/MappingProgressBar.tsx`
- `packages/web/src/components/consolidation/AutoMapModal.tsx`

**Tasks:**
- [ ] **6.1** Add "Account Mappings" tab to consolidation group detail page
- [ ] **6.2** Create company selector dropdown
- [ ] **6.3** Create mapping progress bar component
- [ ] **6.4** Create account mapping table with local → group columns
- [ ] **6.5** Implement group account selector dropdown
- [ ] **6.6** Implement auto-suggest modal
- [ ] **6.7** Implement validation and error display
- [ ] **6.8** Run `pnpm generate-routes`
- [ ] **6.9** Write E2E tests

**Verification**: E2E tests pass

---

## Business Rules

### Group Chart of Accounts

1. **Organization-scoped** - A Group COA belongs to one organization
2. **Unique names** - Group COA names must be unique within an organization
3. **Cannot delete if in use** - Cannot delete a Group COA that is referenced by any consolidation group
4. **Account hierarchy** - Group accounts can have parent-child relationships for reporting

### Account Mappings

1. **Consolidation group scoped** - Mappings are defined per consolidation group
2. **Company-specific** - Each subsidiary has its own set of mappings
3. **Complete coverage required** - All local accounts with balances should be mapped before consolidation
4. **Validation before consolidation** - Consolidation should warn (or fail) if unmapped accounts exist
5. **Many-to-one allowed** - Multiple local accounts can map to one group account
6. **One-to-many NOT allowed** - A local account can only map to one group account

### Consolidation Behavior

1. **Backward compatible** - If no Group COA is assigned, use current behavior (account number matching)
2. **Unmapped accounts** - Tracked separately and reported in validation
3. **Validation mode** - Option to fail consolidation if unmapped accounts exist vs. skip them

---

## Error Types

```typescript
// Group COA not found
class GroupChartOfAccountsNotFoundError extends Schema.TaggedError

// Group account not found
class GroupAccountNotFoundError extends Schema.TaggedError

// Duplicate mapping
class DuplicateMappingError extends Schema.TaggedError

// Overlapping range
class OverlappingRangeMappingError extends Schema.TaggedError

// Cannot delete (in use)
class GroupChartOfAccountsInUseError extends Schema.TaggedError

// Unmapped accounts during consolidation
class UnmappedAccountsError extends Schema.TaggedError
```

---

## Testing Strategy

### Unit Tests

- Domain entity validation
- Mapping resolution algorithm (direct, range, pattern priority)
- Auto-suggest algorithm accuracy

### Integration Tests

- Repository CRUD operations
- Mapping resolution with database
- Consolidation with mappings

### E2E Tests

- Create Group COA and accounts
- Create mappings for subsidiary
- Run consolidation with mappings
- Validate mapping coverage

---

## Future Enhancements

1. **AI-assisted mapping** - Use ML to suggest mappings based on historical data
2. **Mapping templates** - Save common mapping patterns for reuse
3. **Bulk import/export** - CSV import/export for mappings
4. **Change tracking** - Audit log for mapping changes
5. **Dimension mapping** - Map cost centers, departments, not just accounts
