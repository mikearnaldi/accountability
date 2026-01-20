# Consolidation Method Cleanup Specification

## Status: COMPLETED

Implemented on 2026-01-15. The `consolidationMethod` field has been removed from the Company entity. All type checks, lint, and tests pass.

## Problem Statement

The `consolidationMethod` field existed in two places:
1. **Company entity** - Asked during company creation
2. **ConsolidationGroup members** - Where it actually belongs

This created UX confusion: users set up parent-subsidiary relationships with consolidation methods during company creation, then must recreate the same configuration when setting up consolidation groups.

**The consolidation method is a reporting decision, not an organizational fact.** It now only exists in consolidation group configuration.

## Changes Implemented

### 1. Core Domain (`packages/core/src/Domains/Company.ts`)

**Kept:**
- `ConsolidationMethod` type definition (still used by ConsolidationGroup)
- `parentCompanyId` field (organizational fact)
- `ownershipPercentage` field (organizational fact)

**Removed:**
- `consolidationMethod` field from `Company` class

### 2. API Layer (`packages/api/src/Definitions/CompaniesApi.ts`)

**Removed from create/update request schemas:**
- `consolidationMethod` parameter

**Updated:**
- `CompaniesApiLive.ts` - Removed consolidationMethod handling and validation

### 3. Persistence Layer (`packages/persistence/src/Layers/CompanyRepositoryLive.ts`)

**Removed:**
- `consolidation_method` column from SQL row schema
- `consolidation_method` from insert/update statements

**Note:** Database column remains (nullable) for backwards compatibility.

### 4. Frontend (`packages/web/`)

**Removed from `CompanyForm.tsx`:**
- `consolidationMethod` state
- `ConsolidationMethodSelect` component usage
- Related validation logic
- Related form data field

**Updated:**
- `companies/new.tsx` - Removed consolidationMethod from submit payload
- `companies/$companyId/index.tsx` - Removed consolidation method display
- `companies/index.tsx` - Removed consolidationMethod from create payload
- `CompanyHierarchyTree.tsx` - Removed consolidation method column and helper function

**Updated Company interfaces in:**
- `routes/organizations/$organizationId/index.tsx`
- `components/company/CompanyHierarchyTree.tsx`

### 5. Tests

Updated all tests that referenced `consolidationMethod` on Company:

- `packages/core/test/Domains/Company.test.ts` - Removed consolidationMethod from test data and assertions
- `packages/persistence/test/CompanyRepository.test.ts` - Removed from test Company.make() calls
- `packages/api/test/CompaniesApiLive.test.ts` - Removed from test Company.make() calls
- `packages/api/test/AccountsApiLive.test.ts` - Removed from test Company.make() calls
- `packages/api/test/JournalEntriesApiLive.test.ts` - Removed from test Company.make() calls
- `packages/api/test/ReportsApiLive.test.ts` - Removed from test Company.make() calls

### 6. Generated API Schema

Regenerated via `pnpm generate:api` - schema.ts and client.ts now reflect the removed field.

## Validation Results

1. `pnpm typecheck` - All type errors resolved
2. `pnpm test` - All 3587 unit tests pass
3. `pnpm lint` - All lint checks pass

## Notes

- The `ConsolidationMethod` type definition stays in `Company.ts` for use by ConsolidationGroup
- Parent company and ownership percentage remain on Company - these are organizational facts
- Consolidation method only appears in ConsolidationGroup member configuration going forward
- A note was added to the CompanyForm UI explaining that "Consolidation method is configured in Consolidation Groups"
