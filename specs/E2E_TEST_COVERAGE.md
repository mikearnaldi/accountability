# E2E Test Coverage Spec

## Current State (January 2026)

**Total Tests:** 235 passed, 2 skipped

### Existing E2E Test Files

| Test File | Coverage Area | Status |
|-----------|---------------|--------|
| `auth.spec.ts` | Authentication basics | Good |
| `login.spec.ts` | Login flows | Good |
| `register.spec.ts` | Registration flows | Good |
| `home.spec.ts` | Home page | Good |
| `smoke.spec.ts` | Basic smoke tests | Good |
| `organizations.spec.ts` | Organization list CRUD | Good |
| `organization-details.spec.ts` | Organization detail page | Good |
| `organization-settings.spec.ts` | Organization settings | Good |
| `organization-selector.spec.ts` | Org switcher component | Good |
| `create-organization.spec.ts` | Org creation flow | Good |
| `dashboard.spec.ts` | Organization dashboard | Good |
| `org-dashboard.spec.ts` | Dashboard widgets | Good |
| `companies-list.spec.ts` | Company list, hierarchy tree | Good |
| `company-details.spec.ts` | Company detail, edit | Good |
| `create-company.spec.ts` | Company creation | Good |
| `accounts.spec.ts` | Chart of accounts CRUD | Good |
| `apply-template.spec.ts` | Account template application | Good |
| `journal-entries.spec.ts` | Journal entry CRUD | Good |
| `journal-entry-workflow.spec.ts` | JE status workflow | Good |
| `consolidation.spec.ts` | Consolidation groups and runs | Good |
| `exchange-rates.spec.ts` | Exchange rate list, forms, navigation | Good |
| `intercompany.spec.ts` | Intercompany transactions, create, navigation | Good |
| `reports.spec.ts` | Financial reports hub, report navigation, parameters | Good |
| `audit-log.spec.ts` | Audit log list, filters, refresh | Good |

---

## Coverage Gaps

### Priority 1: Critical Business Flows

#### 1. Consolidation Module ✅ RESOLVED (2026-01-16)
**Routes:** `/organizations/:orgId/consolidation/*`
- [x] Consolidation group list page (empty state, with groups)
- [x] Create consolidation group flow
- [x] Consolidation group detail page
- [x] Add members to group (via create flow)
- [x] Activate/deactivate group
- [x] Initiate consolidation run (modal opens)
- [x] Delete group (shows "not implemented" error - backend limitation)
- [x] Navigate from list to detail
- [x] Status filter (active/inactive)

**Test file:** `consolidation.spec.ts` (12 tests)

**Note:** Group deletion is not implemented in the backend - the API returns "Group deletion is not yet implemented. Use deactivation instead." The E2E test verifies this behavior.

#### 2. Exchange Rates ✅ RESOLVED (2026-01-16)
**Routes:** `/organizations/:orgId/exchange-rates/*`
- [x] Exchange rate list page (empty state)
- [x] Navigate to exchange rates via sidebar
- [x] New exchange rate page form display
- [x] Cancel and return to list
- [x] Back link to return to list
- [x] Navigate to new rate from sidebar quick actions
- [x] Open create rate modal from empty state
- [x] Close modal on cancel
- [x] Client-side validation for same currencies

**Test file:** `exchange-rates.spec.ts` (11 tests)

**Note:** Rate creation/edit/delete functionality cannot be fully tested due to a backend bug - the ExchangeRate domain entity is missing `organizationId` but the database requires it (organization_id NOT NULL). This causes SQL errors when trying to insert rates. Tests verify the UI components (forms, modals, navigation) work correctly.

#### 3. Intercompany Transactions ✅ RESOLVED (2026-01-16)
**Routes:** `/organizations/:orgId/intercompany/*`
- [x] Intercompany transaction list page (empty state, no companies state)
- [x] Navigate to intercompany via sidebar
- [x] Create transaction page form display
- [x] Form validation (required fields, same company validation)
- [x] Cancel and return to list
- [x] Back link navigation
- [x] Transaction type dropdown options
- [x] JE linking section (shows after company selection)

**Test file:** `intercompany.spec.ts` (12 tests)

**Note:** Full transaction creation/edit/delete and matching status tests require backend fixes for intercompany transaction API. The current tests verify UI components (forms, modals, navigation, validation) work correctly.

### Priority 2: Supporting Features

#### 4. Reports ✅ RESOLVED (2026-01-16)
**Routes:** `/organizations/:orgId/reports/*`, `/organizations/:orgId/companies/:companyId/reports/*`
- [x] Reports hub page (company selection - Step 1)
- [x] Reports hub empty state (no companies)
- [x] Navigate from reports hub to company reports
- [x] Company reports page (report type selection - Step 2)
- [x] Trial balance report page and form
- [x] Balance sheet report page navigation
- [x] Income statement report page navigation
- [x] Cash flow statement page navigation
- [x] Equity statement page navigation
- [x] Back navigation from report pages
- [x] Sidebar navigation to reports

**Test file:** `reports.spec.ts` (13 tests)

#### 5. Audit Log ✅ RESOLVED (2026-01-16)
**Routes:** `/organizations/:orgId/audit-log`
- [x] Audit log list page
- [x] Filter by entity type
- [x] Filter by action
- [x] Clear filters
- [x] Date range filter inputs
- [x] Sidebar navigation to audit log
- [x] Refresh button functionality

**Test file:** `audit-log.spec.ts` (10 tests)

### Priority 3: Enhancement Coverage

#### 6. User Profile
**Routes:** `/profile`
- [ ] View profile information
- [ ] Update display name
- [ ] Change password
- [ ] View linked identities

**Test file to create:** `profile.spec.ts`

#### 7. Error States
- [ ] 404 page handling
- [ ] Network error recovery
- [ ] Session expiration handling
- [ ] Permission denied states

**Add to:** `error-states.spec.ts`

---

## Implementation Plan

### Phase 1: Critical Business Flows
1. ~~**consolidation.spec.ts** - Full consolidation workflow~~ ✅ DONE (12 tests)
2. ~~**exchange-rates.spec.ts** - Exchange rate management~~ ✅ DONE (11 tests, backend bug limits full coverage)
3. ~~**intercompany.spec.ts** - Intercompany transaction flows~~ ✅ DONE (12 tests, backend bug limits full coverage)

### Phase 2: Reporting
4. ~~**reports.spec.ts** - All financial reports~~ ✅ DONE (13 tests)

### Phase 3: Supporting Features
5. ~~**audit-log.spec.ts** - Audit trail verification~~ ✅ DONE (10 tests)
6. **profile.spec.ts** - User profile management

### Phase 4: Error Handling
7. **error-states.spec.ts** - Error recovery scenarios

---

## Test Patterns to Follow

Based on existing tests, new E2E tests should:

1. **Setup via API** - Create test data via API calls before UI testing
2. **Unique identifiers** - Use `Date.now()` in names to avoid collisions
3. **Session management** - Set cookies via `page.context().addCookies()`
4. **Assertions** - Use `toBeVisible()`, `toContainText()`, `toHaveURL()`
5. **Data-testid** - Use `data-testid` attributes for reliable selectors
6. **Cleanup** - Tests should be independent (no shared state)

### Example Test Structure

```typescript
test("should create and view consolidation group", async ({ page, request }) => {
  // 1. Register test user
  // 2. Login to get session token
  // 3. Create organization via API
  // 4. Create companies via API (parent + subsidiary)
  // 5. Set session cookie
  // 6. Navigate to consolidation page
  // 7. Click "New Consolidation Group"
  // 8. Fill form and submit
  // 9. Verify redirect to detail page
  // 10. Verify group information displayed
})
```

---

## Skipped Tests

Currently 2 tests are skipped. Investigate and fix:

```bash
pnpm test:e2e --grep "skip"
```

---

## Running Tests

```bash
# All E2E tests
pnpm test:e2e

# Specific test file
pnpm test:e2e --grep "consolidation"

# With UI mode
pnpm test:e2e:ui

# View report
pnpm test:e2e:report
```

---

## Known Issues

### Server Error Display
**Issue:** Server errors show raw JSON: `{"status":500,"unhandled":true,"message":"HTTPError"}`

**Expected:** User-friendly error message with retry option

**Affected areas:**
- Route error boundaries
- API error handling in loaders
- Form submission error states

**Fix needed:** Update error components to parse and display friendly messages

---

## Coverage Metrics Target

| Metric | Current | Target |
|--------|---------|--------|
| Route coverage | ~85% | 95% |
| Critical flows | ~98% | 100% |
| Error handling | ~20% | 80% |
| Total test count | 235 | 250+ |
