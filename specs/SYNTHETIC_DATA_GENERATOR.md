# Synthetic Data Generator Script

## Overview

Create a Playwright-based script that generates a complete synthetic dataset by interacting with the running application UI. This script will be used to populate a demo environment or create reproducible test scenarios.

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

### Phase 1: Script Infrastructure
- [ ] Create script file with Playwright setup
- [ ] Add CLI argument parsing (--url, --headless, --verbose)
- [ ] Add package.json script entry
- [ ] Create helper utilities for common UI interactions

### Phase 2: User & Organization Setup
- [ ] Implement user registration flow
- [ ] Implement organization creation
- [ ] Handle authentication state

### Phase 3: Company Setup
- [ ] Create parent company
- [ ] Create subsidiary company with ownership relationship
- [ ] Apply chart of accounts template to both

### Phase 4: Transaction Data - Year 1
- [ ] Create initial capital entries
- [ ] Create monthly operational entries (sales, COGS, payroll)
- [ ] Create quarterly intercompany entries
- [ ] Create year-end adjusting entries
- [ ] Create closing entries

### Phase 5: Transaction Data - Year 2
- [ ] Create monthly operational entries with growth
- [ ] Create quarterly intercompany entries
- [ ] Create year-end adjusting entries
- [ ] Create closing entries

### Phase 6: Company Reports
- [ ] Generate trial balances for both companies
- [ ] Generate balance sheets
- [ ] Generate income statements
- [ ] Generate cash flow statements

### Phase 7: Consolidation
- [ ] Create consolidation group
- [ ] Run Year 1 consolidation
- [ ] Run Year 2 consolidation
- [ ] Verify elimination entries

### Phase 8: Consolidated Reports
- [ ] Generate consolidated balance sheet
- [ ] Generate consolidated income statement
- [ ] Generate consolidated cash flow statement
- [ ] Generate consolidated equity statement

---

## Success Criteria

1. Script runs end-to-end without errors
2. All data is created correctly and visible in UI
3. Reports generate accurate figures
4. Consolidation eliminates intercompany transactions correctly
5. Script is idempotent (can detect existing data and skip/update)
6. Script completes in under 5 minutes
7. Verbose logging shows progress

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

## Known Issues

None yet.

---

## Notes

- This script interacts with the UI, so it depends on current page structure and selectors
- Consider using data-testid attributes for stable selectors
- The script should be updated when UI changes significantly
- For faster data seeding in CI, consider a separate API-based seeder
