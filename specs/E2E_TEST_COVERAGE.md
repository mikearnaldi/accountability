# E2E Test Coverage Spec

## Current State (January 2026)

**Total Tests:** 201 passed, 2 skipped

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

#### 3. Intercompany Transactions
**Routes:** `/organizations/:orgId/intercompany/*`
- [ ] Intercompany transaction list
- [ ] Create intercompany transaction
- [ ] Link to journal entries
- [ ] Transaction matching
- [ ] Settlement workflow

**Test file to create:** `intercompany.spec.ts`

### Priority 2: Supporting Features (No Coverage)

#### 4. Reports
**Routes:** `/organizations/:orgId/companies/:companyId/reports/*`
- [ ] Trial balance report
- [ ] Balance sheet report
- [ ] Income statement report
- [ ] Cash flow statement
- [ ] Equity statement
- [ ] Report date range selection
- [ ] Report export (if implemented)

**Test file to create:** `reports.spec.ts`

#### 5. Audit Log
**Routes:** `/organizations/:orgId/audit-log`
- [ ] Audit log list page
- [ ] Filter by entity type
- [ ] Filter by action
- [ ] Filter by user
- [ ] Filter by date range
- [ ] Audit log detail/expansion

**Test file to create:** `audit-log.spec.ts`

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
3. **intercompany.spec.ts** - Intercompany transaction flows

### Phase 2: Reporting
4. **reports.spec.ts** - All financial reports

### Phase 3: Supporting Features
5. **audit-log.spec.ts** - Audit trail verification
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
| Route coverage | ~65% | 95% |
| Critical flows | ~80% | 100% |
| Error handling | ~20% | 80% |
| Total test count | 190 | 250+ |
