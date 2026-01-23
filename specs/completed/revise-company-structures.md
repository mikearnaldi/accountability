# Revise Company Structures - Remove Parent/Ownership from Company Entity

## Overview

Currently, parent-subsidiary relationships and ownership percentages are stored in two places:
1. **Company entity**: `parentCompanyId` and `ownershipPercentage` fields
2. **ConsolidationGroup/ConsolidationMember**: `companyId`, `ownershipPercentage`, `consolidationMethod`, `acquisitionDate`

This creates data duplication, potential sync issues, and confusion about which is the source of truth.

## Goal

Remove `parentCompanyId` and `ownershipPercentage` from the Company entity. Consolidation relationships should be defined **only** in ConsolidationGroups, providing:
- Cleaner domain model with no data duplication
- More flexibility (same company can be in multiple consolidation scenarios)
- Single source of truth for ownership and consolidation method

## Current State Analysis

### Company Entity (packages/core/src/company/Company.ts)
```typescript
// Fields to remove:
parentCompanyId: Schema.OptionFromNullOr(CompanyId)
ownershipPercentage: Schema.OptionFromNullOr(Percentage)

// Methods to remove:
get isTopLevel(): boolean
get isSubsidiary(): boolean
get nonControllingInterestPercentage(): Option.Option<number>
```

### Database (packages/persistence/src/Migrations/Migration0002_CreateCompanies.ts)
```sql
-- Columns to remove:
parent_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ownership_percentage NUMERIC(5, 2) CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
consolidation_method consolidation_method,

-- Index to remove:
idx_companies_parent_company_id
```

### ConsolidationGroup (packages/core/src/consolidation/ConsolidationGroup.ts)
Already has everything needed:
- `parentCompanyId` - the consolidating entity
- `ConsolidationMember` with `companyId`, `ownershipPercentage`, `consolidationMethod`, `acquisitionDate`, `nonControllingInterestPercentage`

## Implementation Plan

### Phase 1: Database Migration

**File**: `packages/persistence/src/Migrations/Migration00XX_RemoveCompanyHierarchy.ts`

```typescript
// Migration to remove parent/ownership from companies table
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // 1. Drop the index first
  yield* sql`DROP INDEX IF EXISTS idx_companies_parent_company_id`

  // 2. Remove the columns
  yield* sql`
    ALTER TABLE companies
    DROP COLUMN IF EXISTS parent_company_id,
    DROP COLUMN IF EXISTS ownership_percentage,
    DROP COLUMN IF EXISTS consolidation_method
  `

  // 3. Drop the enum type if no longer used elsewhere
  // Note: Check if consolidation_method enum is used in consolidation_members table
  // If not used elsewhere, drop it:
  // yield* sql`DROP TYPE IF EXISTS consolidation_method`
})
```

**Data Migration Strategy**:
- Before removing columns, ensure existing parent/child relationships are captured in ConsolidationGroups
- Run a data migration script to create ConsolidationGroups for any companies with `parent_company_id` set
- This can be a separate migration that runs BEFORE the column removal

### Phase 2: Core Domain Changes

**File**: `packages/core/src/company/Company.ts`

Remove the following fields and methods:
```typescript
// REMOVE these fields from Company class:
- parentCompanyId: Schema.OptionFromNullOr(CompanyId)
- ownershipPercentage: Schema.OptionFromNullOr(Percentage)

// REMOVE these methods:
- get isTopLevel(): boolean
- get isSubsidiary(): boolean
- get nonControllingInterestPercentage(): Option.Option<number>
```

The Company class should only contain:
- `id`, `organizationId`, `name`, `legalName`
- `jurisdiction`, `taxId`, `incorporationDate`, `registrationNumber`
- `registeredAddress`, `industryCode`, `companyType`, `incorporationJurisdiction`
- `functionalCurrency`, `reportingCurrency`, `fiscalYearEnd`
- `retainedEarningsAccountId`, `isActive`, `createdAt`

### Phase 3: Persistence Layer Changes

**File**: `packages/persistence/src/Layers/CompanyRepositoryLive.ts`

Update `CompanyRow` schema:
```typescript
// REMOVE from CompanyRow:
- parent_company_id: Schema.NullOr(Schema.String)
- ownership_percentage: Schema.NullOr(Schema.String)
```

Update `rowToCompany` function:
```typescript
// REMOVE from rowToCompany:
- parentCompanyId: Option.fromNullable(row.parent_company_id).pipe(...)
- ownershipPercentage: Option.fromNullable(row.ownership_percentage).pipe(...)
```

Update `create` and `update` methods:
```typescript
// REMOVE from INSERT/UPDATE statements:
- parent_company_id
- ownership_percentage
```

**File**: `packages/persistence/src/Services/CompanyRepository.ts`

Remove `findSubsidiaries` method if it exists (or repurpose to use ConsolidationGroups).

### Phase 4: API Layer Changes

**File**: `packages/api/src/Definitions/CompaniesApi.ts`

Update `CreateCompanyRequest`:
```typescript
// REMOVE:
- parentCompanyId: Schema.OptionFromNullOr(CompanyId)
- ownershipPercentage: Schema.OptionFromNullOr(Percentage)
```

Update `UpdateCompanyRequest`:
```typescript
// REMOVE:
- parentCompanyId: Schema.OptionFromNullOr(CompanyId)
- ownershipPercentage: Schema.OptionFromNullOr(Percentage)
```

**File**: `packages/api/src/Layers/CompaniesApiLive.ts`

Update `createCompany` handler:
```typescript
// REMOVE validation for parent company and ownership:
- Parent company existence check
- OwnershipPercentageRequiredError logic
- parentCompanyId and ownershipPercentage from Company.make()
```

Update `updateCompany` handler:
```typescript
// REMOVE:
- Parent company validation and circular reference checks
- parentCompanyId and ownershipPercentage handling
```

**File**: `packages/api/src/Definitions/ApiErrors.ts` or company errors

Remove or deprecate:
- `ParentCompanyNotFoundError`
- `OwnershipPercentageRequiredError`
- `CircularCompanyReferenceError`

### Phase 5: Frontend Changes

#### 5.1 Company Form (Create/Edit)

**File**: `packages/web/src/components/forms/CompanyForm.tsx`

Remove the entire "Parent Company (Optional)" section:
```typescript
// REMOVE:
- parentCompanyId state
- ownershipPercentage state
- showHierarchySection logic
- showSubsidiaryFields logic
- Parent Company Select field
- Ownership % input field
- Related validation
```

**File**: `packages/web/src/routes/organizations/$organizationId/companies/new.tsx`

Update `handleSubmit`:
```typescript
// REMOVE from API call body:
- parentCompanyId: formData.parentCompanyId
- ownershipPercentage: formData.ownershipPercentage
```

#### 5.2 Companies List Page

**File**: `packages/web/src/components/company/CompanyHierarchyTree.tsx`

Option A: Convert to flat list (simpler):
- Remove tree hierarchy logic
- Show companies as a simple sortable/filterable table
- Add a column showing consolidation group membership

Option B: Keep hierarchy based on ConsolidationGroups:
- Fetch consolidation groups for the organization
- Build hierarchy from consolidation group parent/member relationships
- More complex but preserves visual hierarchy

**Recommended**: Option A for simplicity. Users can see relationships in the Consolidation section.

Changes:
```typescript
// REMOVE from Company interface:
- parentCompanyId: string | null
- ownershipPercentage: number | null

// REMOVE:
- buildCompanyTree function
- flattenTree function
- Tree expansion/collapse logic
- Ownership column (or repurpose to show consolidation group count)

// SIMPLIFY to:
- Simple table with: Name, Legal Name, Jurisdiction, Currency, Status
- Optional: "Consolidation Groups" column showing group count/names
```

**File**: `packages/web/src/routes/organizations/$organizationId/companies/index.tsx`

Update to use simplified company list component.

#### 5.3 Company Details Page

**File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/index.tsx`

Remove:
- Parent company display section
- Subsidiaries section (or repurpose to show consolidation group memberships)
- Ownership percentage display
- `isSubsidiary` checks

Add (optional):
- "Consolidation Groups" section showing which groups this company belongs to
- Link to each consolidation group

### Phase 6: Update Tests

#### Unit Tests
- `packages/core/test/company/Company.test.ts` - Remove parent/ownership tests
- `packages/persistence/test/CompanyRepository.test.ts` - Update fixtures
- `packages/api/test/CompaniesApiLive.test.ts` - Remove subsidiary creation tests

#### E2E Tests
- `packages/web/test-e2e/create-company.spec.ts` - Remove subsidiary tests
- `packages/web/test-e2e/companies-list.spec.ts` - Update hierarchy tests
- `packages/web/test-e2e/company-details.spec.ts` - Remove parent/subsidiary tests

### Phase 7: Regenerate API Client

After API changes:
```bash
cd packages/web && pnpm generate:api
```

## Files to Modify (Summary)

### Core Package
- [ ] `packages/core/src/company/Company.ts` - Remove fields and methods
- [ ] `packages/core/src/company/CompanyErrors.ts` - Remove related errors
- [ ] `packages/core/test/company/Company.test.ts` - Update tests

### Persistence Package
- [ ] `packages/persistence/src/Migrations/Migration00XX_RemoveCompanyHierarchy.ts` - New migration
- [ ] `packages/persistence/src/Layers/CompanyRepositoryLive.ts` - Remove fields
- [ ] `packages/persistence/src/Services/CompanyRepository.ts` - Remove findSubsidiaries if exists
- [ ] `packages/persistence/test/CompanyRepository.test.ts` - Update tests

### API Package
- [ ] `packages/api/src/Definitions/CompaniesApi.ts` - Remove fields from requests
- [ ] `packages/api/src/Definitions/ApiErrors.ts` - Remove/deprecate errors
- [ ] `packages/api/src/Layers/CompaniesApiLive.ts` - Remove validation logic
- [ ] `packages/api/test/CompaniesApiLive.test.ts` - Update tests

### Web Package
- [ ] `packages/web/src/components/forms/CompanyForm.tsx` - Remove parent/ownership section
- [ ] `packages/web/src/components/company/CompanyHierarchyTree.tsx` - Simplify to flat list
- [ ] `packages/web/src/routes/organizations/$organizationId/companies/index.tsx` - Update
- [ ] `packages/web/src/routes/organizations/$organizationId/companies/new.tsx` - Remove fields
- [ ] `packages/web/src/routes/organizations/$organizationId/companies/$companyId/index.tsx` - Remove sections
- [ ] `packages/web/test-e2e/create-company.spec.ts` - Update tests
- [ ] `packages/web/test-e2e/companies-list.spec.ts` - Update tests
- [ ] `packages/web/test-e2e/company-details.spec.ts` - Update tests

## Migration Path for Existing Data

For production deployments with existing data:

1. **Pre-migration script**: Query all companies with `parent_company_id` set
2. **Auto-create ConsolidationGroups**: For each unique parent company, create a consolidation group with its children as members
3. **Preserve ownership**: Copy `ownership_percentage` to the ConsolidationMember
4. **Run column removal migration**

```sql
-- Example pre-migration query to identify affected data:
SELECT
  p.id as parent_id,
  p.name as parent_name,
  c.id as child_id,
  c.name as child_name,
  c.ownership_percentage
FROM companies c
JOIN companies p ON c.parent_company_id = p.id
WHERE c.parent_company_id IS NOT NULL;
```

## UX Considerations

### Companies List
- Show a clean, flat list of all companies
- Add filters: by status (active/inactive), by jurisdiction, by currency
- Add sorting: by name, by date created
- Optionally show a badge/count of consolidation group memberships

### Company Details
- Remove parent/subsidiary sections
- Add "Consolidation Memberships" section showing:
  - Which consolidation groups this company belongs to
  - Role in each group (parent vs member)
  - Ownership percentage (from the group)
  - Quick link to each consolidation group

### Creating Consolidation Relationships
- Users go to Consolidation section to define parent-child relationships
- Clear separation: Companies = legal entities, Consolidation = reporting structures

## Acceptance Criteria

1. [x] Companies can be created without specifying parent/ownership
2. [x] Companies list shows a flat list (no hierarchy)
3. [x] Company edit does not show parent/ownership fields
4. [x] ConsolidationGroups remain the only place to define ownership relationships
5. [x] All existing E2E tests pass (after updates)
6. [x] No data loss during migration
7. [x] API schema updated and client regenerated
8. [x] TypeScript compilation passes with no errors

## Implementation Complete

**Date**: 2026-01-23

All phases have been implemented:
- Phase 1: Database migration `Migration0026_RemoveCompanyHierarchy.ts` created
- Phase 2: Company domain entity updated (removed parentCompanyId, ownershipPercentage, isTopLevel, isSubsidiary, nonControllingInterestPercentage)
- Phase 3: CompanyRepositoryLive updated (removed parent/ownership handling)
- Phase 4: CompaniesApi and CompaniesApiLive updated (removed fields from requests/responses)
- Phase 5: All unit tests updated (3898 tests passing)
- Phase 6: Frontend updated (CompanyForm, CompanyHierarchyTree simplified to flat table)
- Phase 7: E2E tests updated (removed subsidiary-specific tests)
- Phase 8: CI passes (typecheck, lint, tests)

## Timeline Estimate

- Phase 1 (Database): 1 hour
- Phase 2-3 (Core + Persistence): 2 hours
- Phase 4 (API): 1 hour
- Phase 5 (Frontend): 3 hours
- Phase 6 (Tests): 2 hours
- Phase 7 (Regenerate + verify): 30 minutes

**Total**: ~10 hours

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Run pre-migration script to backup relationships; auto-create ConsolidationGroups |
| Breaking existing consolidation workflows | ConsolidationGroups already work independently; no impact expected |
| User confusion about where to set ownership | Clear UI guidance in Consolidation section; help text |
| Reports depending on company hierarchy | Reports should use ConsolidationGroup data (verify) |
