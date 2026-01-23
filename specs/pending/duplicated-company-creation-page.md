# Duplicated Company Creation Interface Cleanup

## Problem

There are currently **two separate interfaces** for creating companies:

1. **Dedicated Page** (`/organizations/$organizationId/companies/new`) - Full-page form with navigation and breadcrumbs
2. **Modal** (in companies list page) - Inline modal overlay triggered by "New Company" button

This duplication causes:
- Inconsistent UX - users may encounter different experiences
- Duplicated submission logic and error handling
- Maintenance burden from having two code paths
- Potential for divergence over time

## Current Implementation

### 1. Page Version (`packages/web/src/routes/organizations/$organizationId/companies/new.tsx`)

- Dedicated full-page route at `/companies/new`
- Uses `AppLayout` with sidebar and header
- Breadcrumb navigation: Companies → New Company
- Navigates back to companies list on success

### 2. Modal Version (`packages/web/src/routes/organizations/$organizationId/companies/index.tsx`)

- Lines 378-400: Modal overlay with semi-transparent backdrop
- Lines 339-347: "New Company" button triggers modal (only shown when companies exist)
- Lines 404-416: Empty state also has button that opens modal
- Uses same `CompanyForm` component as page version
- State managed via `showCreateForm` boolean

## Solution

**Standardize on the dedicated page** and remove the modal from the companies list.

### Rationale

1. **Consistency** - One way to create companies, everywhere
2. **Better UX** - Full-page forms provide better focus and fewer distractions
3. **Accessibility** - Pages are more accessible than modals (focus management, escape handling)
4. **Deep linking** - Users can bookmark/share the new company URL
5. **Back button works** - Browser navigation works naturally

## Implementation Steps

### Step 1: Update Companies List Page Buttons

In `packages/web/src/routes/organizations/$organizationId/companies/index.tsx`:

1. **Remove modal state and handlers**:
   - Remove `showCreateForm` state (line 204)
   - Remove `handleCreateCompany` function (lines 238-293)
   - Remove `handleCancelForm` function (lines 295-298)
   - Remove `isSubmitting` state (line 206)
   - Remove `apiError` state (line 207)

2. **Remove modal JSX** (lines 378-400)

3. **Update "New Company" button** (lines 339-347):
   - Change from `onClick={() => setShowCreateForm(true)}` to navigation:
   ```tsx
   <Button
     as={Link}
     to="/organizations/$organizationId/companies/new"
     params={{ organizationId: params.organizationId }}
     icon={<Plus className="h-4 w-4" />}
     data-testid="create-company-button"
   >
     New Company
   </Button>
   ```

4. **Update empty state button** (lines 404-416):
   - Change from `onClick={() => setShowCreateForm(true)}` to same navigation pattern

5. **Remove unused imports**:
   - Remove `CompanyForm` and `CompanyFormData` imports (no longer used in this file)
   - Keep `CurrencyOption` if still needed by other components

### Step 2: Clean Up Loader Data (Optional)

Since the modal is removed, currencies and jurisdictions are no longer needed in the companies list loader. However, they may be used by the `CompanyHierarchyTree` component for display purposes. Verify usage before removing.

### Step 3: Update Tests

Update any E2E tests that interact with the modal to instead navigate to the dedicated page.

## Files to Modify

| File | Changes |
|------|---------|
| `packages/web/src/routes/organizations/$organizationId/companies/index.tsx` | Remove modal, update buttons to navigate |
| E2E tests (if any) | Update to use page navigation instead of modal |

## Testing Checklist

- [x] "New Company" button navigates to `/companies/new`
- [x] Empty state "Create Company" button navigates to `/companies/new`
- [x] Company creation flow works end-to-end via page
- [x] Browser back button returns to companies list from new company page
- [x] Canceling on new company page returns to companies list
- [x] No references to `showCreateForm` state remain
- [x] No modal-related code remains in companies list page

## Implementation Complete

**Completed: 2026-01-23**

Changes made:
1. Removed modal state (`showCreateForm`, `isSubmitting`, `apiError`) from companies list page
2. Removed `handleCreateCompany` and `handleCancelForm` functions
3. Removed modal JSX from companies list page
4. Updated "New Company" button to use `<Link>` navigation to `/companies/new`
5. Updated empty state "Create Company" button to use `<Link>` navigation
6. Removed unused imports (`CompanyForm`, `CompanyFormData`, `api`, `Button`, `useRouter`)
7. Removed unused server functions (`fetchCurrencies`, `fetchJurisdictions`)
8. Updated E2E tests in `companies-list.spec.ts` and `create-company.spec.ts` to test the page-based flow

All 24 company-related E2E tests pass.
