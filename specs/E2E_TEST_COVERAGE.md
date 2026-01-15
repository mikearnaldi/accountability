# E2E Test Coverage Spec

## Current State (January 2026)

**Total Tests:** 178 passed, 2 skipped

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

---

## Coverage Gaps

### Priority 1: Critical Business Flows (No Coverage)

#### 1. Consolidation Module
**Routes:** `/organizations/:orgId/consolidation/*`
- [ ] Consolidation group list page
- [ ] Create consolidation group flow
- [ ] Consolidation group detail page
- [ ] Add/remove members from group
- [ ] Activate/deactivate group
- [ ] Initiate consolidation run
- [ ] View run status and results
- [ ] Consolidated trial balance view

**Test file to create:** `consolidation.spec.ts`

#### 2. Exchange Rates
**Routes:** `/organizations/:orgId/exchange-rates/*`
- [ ] Exchange rate list page
- [ ] Create exchange rate manually
- [ ] Filter by currency pair
- [ ] Filter by rate type (spot, average)
- [ ] Edit exchange rate
- [ ] Delete exchange rate

**Test file to create:** `exchange-rates.spec.ts`

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
1. **consolidation.spec.ts** - Full consolidation workflow
2. **intercompany.spec.ts** - Intercompany transaction flows
3. **exchange-rates.spec.ts** - Exchange rate management

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
| Route coverage | ~60% | 95% |
| Critical flows | ~70% | 100% |
| Error handling | ~20% | 80% |
| Total test count | 178 | 250+ |
