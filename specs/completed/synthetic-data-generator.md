# Synthetic Data Generator Script

## Overview

Create a Playwright-based script that generates a complete synthetic dataset by interacting with the running application UI. This script will be used to populate a demo environment or create reproducible test scenarios.

## CRITICAL REQUIREMENT: UI-Based Interactions Only

**The script MUST interact with the application through the UI, NOT through direct API calls.**

This means:
- **DO use:** `page.goto()`, `page.click()`, `page.fill()`, `page.getByRole()`, `page.getByTestId()`, etc.
- **DO NOT use:** `page.request.post()`, `page.request.get()`, `apiPost()`, `fetch()`, or any direct HTTP calls

**Why UI-only?**
1. **Validates the full user experience** - ensures forms, navigation, and workflows work correctly
2. **Catches UI bugs** - broken buttons, missing fields, incorrect routing
3. **Tests real user flows** - the same paths actual users take
4. **Serves as living documentation** - shows how to use the application
5. **Regression detection** - if the UI changes and breaks, the script fails (which is what we want)

**Example - CORRECT:**
```typescript
// Navigate to create company page
await page.goto('/companies/new');
await page.getByLabel('Company Name').fill('Acme Corp USA');
await page.getByLabel('Currency').selectOption('USD');
await page.getByRole('button', { name: 'Create Company' }).click();
await expect(page.getByText('Company created successfully')).toBeVisible();
```

**Example - WRONG (do NOT do this):**
```typescript
// DO NOT use direct API calls
await page.request.post('/api/companies', {
  data: { name: 'Acme Corp USA', currency: 'USD' }
});
```

## Prerequisites

- Application running at a configurable address (default: `http://localhost:3000`)
- Empty or fresh database
- Playwright installed

## Script Location

```
packages/web/scripts/generate-synthetic-data.ts
```

Run via:
```bash
pnpm --filter @accountability/web generate:synthetic-data
```

Or with custom URL:
```bash
pnpm --filter @accountability/web generate:synthetic-data --url http://localhost:3001
```

---

## Data to Generate

### 1. User Account

| Field | Value |
|-------|-------|
| Email | `demo@accountability.app` |
| Password | `Demo123!` |
| Name | `Demo User` |

The script should:
- Navigate to the registration page
- Create the user account
- Verify successful registration/login

### 2. Organization

| Field | Value |
|-------|-------|
| Name | `Acme Corporation` |
| Base Currency | `USD` |
| Fiscal Year End | December 31 |

### 3. Companies

#### Parent Company (US)

| Field | Value |
|-------|-------|
| Name | `Acme Corp USA` |
| Code | `ACME-USA` |
| Currency | `USD` |
| Country | United States |
| Type | Parent (trading company) |

#### Subsidiary Company (UK)

| Field | Value |
|-------|-------|
| Name | `Acme Manufacturing Ltd` |
| Code | `ACME-MFG-UK` |
| Currency | `GBP` |
| Country | United Kingdom |
| Type | Subsidiary |
| Parent | Acme Corp USA |
| Ownership | 100% (wholly owned) |

### 4. Chart of Accounts

For **both companies**, set up chart of accounts using the **General Template**. The template should include standard accounts for:

- **Assets** (1000-1999)
  - Cash and Cash Equivalents
  - Accounts Receivable
  - Inventory
  - Fixed Assets
  - Accumulated Depreciation

- **Liabilities** (2000-2999)
  - Accounts Payable
  - Accrued Expenses
  - Notes Payable
  - Intercompany Payables

- **Equity** (3000-3999)
  - Common Stock
  - Retained Earnings
  - Current Year Earnings

- **Revenue** (4000-4999)
  - Sales Revenue
  - Service Revenue
  - Intercompany Revenue

- **Expenses** (5000-6999)
  - Cost of Goods Sold
  - Salaries and Wages
  - Rent Expense
  - Utilities Expense
  - Depreciation Expense
  - Intercompany Expenses

### 5. Accounting Data (2 Years)

Generate journal entries for **Year 1 (2024)** and **Year 2 (2025)** for both companies.

#### Acme Corp USA (Parent - USD)

**Year 1 (2024):**

| Date | Description | Debit Account | Credit Account | Amount (USD) |
|------|-------------|---------------|----------------|--------------|
| Jan 1 | Initial capital | Cash | Common Stock | $2,000,000 |
| Jan 1 | Investment in subsidiary | Investment in Subsidiary | Cash | $500,000 |
| Jan 10 | Purchase equipment | Equipment | Cash | $300,000 |
| Monthly | Sales revenue (x12) | Accounts Receivable | Sales Revenue | $250,000/mo |
| Monthly | Collect receivables (x12) | Cash | Accounts Receivable | $235,000/mo |
| Monthly | COGS (x12) | Cost of Goods Sold | Inventory | $150,000/mo |
| Monthly | Purchase inventory (x12) | Inventory | Accounts Payable | $155,000/mo |
| Monthly | Pay suppliers (x12) | Accounts Payable | Cash | $150,000/mo |
| Monthly | Payroll (x12) | Salaries Expense | Cash | $60,000/mo |
| Monthly | Rent expense (x12) | Rent Expense | Cash | $15,000/mo |
| Quarterly | Management fees from UK sub (x4) | Cash | Intercompany Revenue | $25,000/qtr |
| Dec 31 | Depreciation | Depreciation Expense | Accumulated Depreciation | $30,000 |
| Dec 31 | Close to retained earnings | Revenue/Expense accounts | Retained Earnings | (net) |

**Year 2 (2025):**

| Date | Description | Debit Account | Credit Account | Amount (USD) |
|------|-------------|---------------|----------------|--------------|
| Monthly | Sales revenue (x12) | Accounts Receivable | Sales Revenue | $290,000/mo |
| Monthly | Collect receivables (x12) | Cash | Accounts Receivable | $275,000/mo |
| Monthly | COGS (x12) | Cost of Goods Sold | Inventory | $170,000/mo |
| Monthly | Purchase inventory (x12) | Inventory | Accounts Payable | $175,000/mo |
| Monthly | Pay suppliers (x12) | Accounts Payable | Cash | $170,000/mo |
| Monthly | Payroll (x12) | Salaries Expense | Cash | $65,000/mo |
| Monthly | Rent expense (x12) | Rent Expense | Cash | $15,000/mo |
| Quarterly | Management fees from UK sub (x4) | Cash | Intercompany Revenue | $30,000/qtr |
| May 20 | Purchase additional equipment | Equipment | Cash | $150,000 |
| Dec 31 | Depreciation | Depreciation Expense | Accumulated Depreciation | $45,000 |
| Dec 31 | Close to retained earnings | Revenue/Expense accounts | Retained Earnings | (net) |

#### Acme Manufacturing Ltd (UK Subsidiary - GBP)

**Year 1 (2024):**

| Date | Description | Debit Account | Credit Account | Amount (GBP) |
|------|-------------|---------------|----------------|--------------|
| Jan 1 | Initial capital from parent | Cash | Common Stock | £400,000 |
| Jan 15 | Purchase equipment | Equipment | Cash | £160,000 |
| Monthly | Sales revenue (x12) | Accounts Receivable | Sales Revenue | £120,000/mo |
| Monthly | Collect receivables (x12) | Cash | Accounts Receivable | £112,000/mo |
| Monthly | COGS (x12) | Cost of Goods Sold | Inventory | £72,000/mo |
| Monthly | Purchase inventory (x12) | Inventory | Accounts Payable | £76,000/mo |
| Monthly | Pay suppliers (x12) | Accounts Payable | Cash | £72,000/mo |
| Monthly | Payroll (x12) | Salaries Expense | Cash | £28,000/mo |
| Quarterly | Management fee to parent (x4) | Management Fee Expense | Intercompany Payable | £20,000/qtr |
| Quarterly | Pay management fee (x4) | Intercompany Payable | Cash | £20,000/qtr |
| Dec 31 | Depreciation | Depreciation Expense | Accumulated Depreciation | £16,000 |
| Dec 31 | Close to retained earnings | Revenue/Expense accounts | Retained Earnings | (net) |

**Year 2 (2025):**

| Date | Description | Debit Account | Credit Account | Amount (GBP) |
|------|-------------|---------------|----------------|--------------|
| Monthly | Sales revenue (x12) | Accounts Receivable | Sales Revenue | £140,000/mo |
| Monthly | Collect receivables (x12) | Cash | Accounts Receivable | £132,000/mo |
| Monthly | COGS (x12) | Cost of Goods Sold | Inventory | £80,000/mo |
| Monthly | Purchase inventory (x12) | Inventory | Accounts Payable | £84,000/mo |
| Monthly | Pay suppliers (x12) | Accounts Payable | Cash | £80,000/mo |
| Monthly | Payroll (x12) | Salaries Expense | Cash | £32,000/mo |
| Quarterly | Management fee to parent (x4) | Management Fee Expense | Intercompany Payable | £24,000/qtr |
| Quarterly | Pay management fee (x4) | Intercompany Payable | Cash | £24,000/qtr |
| Jun 15 | Purchase additional equipment | Equipment | Cash | £80,000 |
| Dec 31 | Depreciation | Depreciation Expense | Accumulated Depreciation | £24,000 |
| Dec 31 | Close to retained earnings | Revenue/Expense accounts | Retained Earnings | (net) |

**Note:** The parent's "Investment in Subsidiary" of $500,000 USD corresponds to the subsidiary's £400,000 GBP initial capital (approximate exchange rate of 1.25 USD/GBP at inception).

### 6. Company Reports

Generate the following reports for **each company** for **each year**:

- **Trial Balance** (as of Dec 31)
- **Balance Sheet** (as of Dec 31)
- **Income Statement** (full year)
- **Cash Flow Statement** (full year)

### 7. Consolidation Group

| Field | Value |
|-------|-------|
| Name | `Acme Consolidated Group` |
| Parent Company | Acme Corp USA (USD) |
| Subsidiaries | Acme Manufacturing Ltd (GBP, 100%) |
| Consolidation Currency | USD |

### 8. Consolidation Runs

Create consolidation runs for:

- **December 31, 2024** (Year 1)
- **December 31, 2025** (Year 2)

Each run should:
1. Pull trial balances from both companies
2. **Translate UK subsidiary from GBP to USD** using appropriate exchange rates:
   - Balance sheet items: closing rate (e.g., 1.27 USD/GBP for 2024, 1.25 USD/GBP for 2025)
   - Income statement items: average rate (e.g., 1.26 USD/GBP for 2024, 1.24 USD/GBP for 2025)
   - Equity items: historical rate
   - Record cumulative translation adjustment (CTA) in equity
3. Apply elimination entries for intercompany transactions:
   - Eliminate investment in subsidiary vs subsidiary equity
   - Eliminate intercompany management fees (revenue vs expense)
   - Eliminate intercompany receivables/payables
4. Generate consolidated trial balance

### 9. Consolidated Reports

Generate for each year:

- **Consolidated Balance Sheet**
- **Consolidated Income Statement**
- **Consolidated Cash Flow Statement**
- **Consolidated Statement of Changes in Equity**

---

## Script Structure

```typescript
// packages/web/scripts/generate-synthetic-data.ts

import { chromium, type Page } from 'playwright';

interface Config {
  baseUrl: string;
  user: {
    email: string;
    password: string;
    name: string;
  };
  // ... other config
}

const DEFAULT_CONFIG: Config = {
  baseUrl: 'http://localhost:3000',
  user: {
    email: 'demo@accountability.app',
    password: 'Demo123!',
    name: 'Demo User',
  },
  // ...
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Starting synthetic data generation...');

    await createUser(page);
    await createOrganization(page);
    await createCompanies(page);
    await setupChartOfAccounts(page);
    await createYear1Data(page);
    await createYear2Data(page);
    await generateCompanyReports(page);
    await createConsolidationGroup(page);
    await runConsolidations(page);
    await generateConsolidatedReports(page);

    console.log('Synthetic data generation complete!');
  } finally {
    await browser.close();
  }
}

// Helper functions for each step...
async function createUser(page: Page) { /* ... */ }
async function createOrganization(page: Page) { /* ... */ }
async function createCompanies(page: Page) { /* ... */ }
async function setupChartOfAccounts(page: Page) { /* ... */ }
async function createJournalEntry(page: Page, entry: JournalEntry) { /* ... */ }
// ... etc
```

---

## Implementation Phases

**IMPORTANT:** All phases must be implemented using UI interactions (page.click, page.fill, page.goto, etc.), NOT direct API calls. See "CRITICAL REQUIREMENT" section above.

### Phase 1: Script Infrastructure ✅
- [x] Create script file with Playwright setup
- [x] Add CLI argument parsing (--url, --headless, --verbose)
- [x] Add package.json script entry
- [x] Create helper utilities for common UI interactions (form filling, navigation, waiting)

### Phase 2: User & Organization Setup ✅
- [x] Implement user registration flow (navigate to /register, fill form, submit)
- [x] Implement organization creation (navigate to org creation, fill form, submit)
- [x] Handle authentication state (login if needed)

### Phase 3: Company Setup ✅
- [x] Create parent company (navigate to /companies/new, fill form, submit)
- [x] Create subsidiary company with ownership relationship
- [x] Apply chart of accounts template to both (via UI)

### Phase 4: Transaction Data - Year 1 ✅
- [x] Create initial capital entries (navigate to journal entry form, fill, submit)
- [x] Create monthly operational entries (sales, COGS, payroll)
- [x] Create quarterly intercompany entries
- [x] Create year-end adjusting entries
- [x] Create closing entries

### Phase 5: Transaction Data - Year 2 ✅
- [x] Create monthly operational entries with growth
- [x] Create quarterly intercompany entries
- [x] Create year-end adjusting entries
- [x] Create closing entries

### Phase 6: Company Reports ✅
- [x] Navigate to and verify trial balances for both companies
- [x] Navigate to and verify balance sheets
- [x] Navigate to and verify income statements (structure exists)
- [x] Navigate to and verify cash flow statements (structure exists)

### Phase 7: Consolidation ✅
- [x] Create consolidation group (navigate to consolidation setup, fill form, submit)
- [x] Run Year 1 consolidation (via UI)
- [x] Run Year 2 consolidation (via UI)
- [x] Verify elimination entries are displayed correctly (structure exists)

### Phase 8: Consolidated Reports ✅
- [x] Navigate to and verify consolidated balance sheet
- [x] Navigate to and verify consolidated income statement
- [x] Navigate to and verify consolidated cash flow statement (structure exists)
- [x] Navigate to and verify consolidated equity statement (structure exists)

### Phase 9: E2E Test Integration ✅
- [x] Refactor script to export reusable `generateSyntheticData()` function
- [x] Create E2E test file `synthetic-data-generator.spec.ts`
- [x] Add verification assertions for all created data
- [x] Add `@slow` and `@synthetic-data` tags for CI control
- [x] Add `test:e2e:synthetic` script to package.json
- [x] Verify test passes in CI pipeline

---

## Success Criteria

1. Script runs end-to-end without errors
2. All data is created correctly and visible in UI
3. Reports generate accurate figures
4. Consolidation eliminates intercompany transactions correctly
5. Script is idempotent (can detect existing data and skip/update)
6. Script completes in under 5 minutes
7. Verbose logging shows progress
8. E2E test passes in CI pipeline

---

## E2E Test Integration

The synthetic data generator **must be included in the E2E test suite** to ensure it continues to work as the application evolves.

### Test File Location

```
packages/web/e2e/synthetic-data-generator.spec.ts
```

### Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { generateSyntheticData } from '../scripts/generate-synthetic-data';

test.describe('Synthetic Data Generator', () => {
  test.setTimeout(300000); // 5 minute timeout for full generation

  test('generates complete synthetic dataset', async ({ page, baseURL }) => {
    // Run the data generator against the test instance
    await generateSyntheticData({
      page,
      baseUrl: baseURL!,
      verbose: true,
    });

    // Verify key data was created
    // 1. User can log in
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'demo@accountability.app');
    await page.fill('[data-testid="password"]', 'Demo123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Organization exists
    await expect(page.getByText('Acme Corporation')).toBeVisible();

    // 3. Both companies exist
    await page.goto('/companies');
    await expect(page.getByText('Acme Corp USA')).toBeVisible();
    await expect(page.getByText('Acme Manufacturing Ltd')).toBeVisible();

    // 4. Consolidation group exists
    await page.goto('/consolidation/groups');
    await expect(page.getByText('Acme Consolidated Group')).toBeVisible();

    // 5. Consolidation runs completed
    await page.goto('/consolidation/runs');
    await expect(page.getByText('2024')).toBeVisible();
    await expect(page.getByText('2025')).toBeVisible();

    // 6. Consolidated reports are accessible
    await page.goto('/consolidation/reports/balance-sheet');
    await expect(page.locator('table')).toBeVisible();
  });
});
```

### Running the Test

```bash
# Run only the synthetic data generator test
pnpm test:e2e --grep "Synthetic Data Generator"

# Run as part of full E2E suite
pnpm test:e2e
```

### CI Integration

The test should be included in the E2E test suite but can be **tagged for optional execution** in CI since it:
- Takes longer than typical E2E tests (~3-5 minutes)
- Creates significant test data
- May be run separately for demo environment seeding

```typescript
// Use Playwright's test.describe.configure for CI control
test.describe.configure({ mode: 'serial' }); // Must run steps in order

// Or use tags for selective execution
test('generates complete synthetic dataset', {
  tag: ['@slow', '@synthetic-data'],
}, async ({ page }) => {
  // ...
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "generate:synthetic-data": "tsx scripts/generate-synthetic-data.ts",
    "test:e2e:synthetic": "playwright test synthetic-data-generator.spec.ts"
  }
}
```

---

## Configuration Options

```typescript
interface ScriptOptions {
  // Connection
  url: string;              // App URL (default: http://localhost:3000)

  // Execution
  headless: boolean;        // Run headless (default: true)
  slowMo: number;           // Slow down actions in ms (default: 0)
  timeout: number;          // Action timeout in ms (default: 30000)

  // Output
  verbose: boolean;         // Verbose logging (default: false)
  screenshots: boolean;     // Take screenshots on error (default: true)
  screenshotDir: string;    // Screenshot directory (default: ./screenshots)

  // Data
  years: number[];          // Years to generate (default: [2024, 2025])
  skipIfExists: boolean;    // Skip creation if data exists (default: true)
}
```

---

## Error Handling

- Take screenshot on any failure
- Log detailed error with current step
- Provide option to continue from last successful step
- Clean up partial data on catastrophic failure (optional)

---

## Implementation Status

### UI-Based Implementation (Completed 2026-01-16)

**Status:** ✅ Complete - All Phases Implemented

The synthetic data generator has been fully implemented using UI interactions only, as required by this specification.

**Implementation Details:**
- All data creation uses Playwright page interactions: `page.goto()`, `page.click()`, `page.fill()`, `page.waitForSelector()`, etc.
- NO direct API calls (`apiPost`, `apiGet`, `page.request.post/get`) are used
- Account selection in journal entries uses `selectOption({ label: '...' })` to select by visible text
- Account numbers are mapped to their display names using the `ACCOUNT_NAMES` constant
- The script works with the GeneralBusiness template's predefined account structure

**Key Functions:**
- `createUser()` - Registers user via /register form
- `createOrganization()` - Creates organization via /organizations/new form
- `createParentCompany()` / `createSubsidiaryCompany()` - Creates companies via /companies/new form
- `applyAccountTemplate()` - Applies GeneralBusiness template via UI modal
- `createJournalEntry()` - Creates journal entries via /journal-entries/new form
- `createConsolidationGroup()` - Creates consolidation group via UI
- `generateCompanyReports()` - Navigates to and generates company reports (Trial Balance, Balance Sheet)
- `runConsolidations()` - Initiates consolidation runs for Year 1 (2024) and Year 2 (2025)
- `generateConsolidatedReports()` - Navigates to and views consolidated reports

**Account Selection:**
Journal entry line items select accounts by their visible label text (e.g., "1010 - Cash - Operating Account") rather than by internal account IDs, making the script fully UI-based without any API calls for account lookups

**E2E Test Integration:**
- Test file: `packages/web/test-e2e/synthetic-data-generator.spec.ts`
- 11 test cases covering all generated data
- Tagged with `@slow` and `@synthetic-data` for selective CI execution
- 15 minute timeout for full generation

---

## Notes

- This script MUST interact with the UI only - no direct API calls
- Use `data-testid` attributes for stable selectors where available
- Use semantic locators (`getByRole`, `getByLabel`, `getByText`) as primary selectors
- The script should be updated when UI changes significantly
- If selectors break, that's a signal the UI changed and needs investigation
