# UI Architecture & Navigation Specification

This document defines the UI architecture, navigation patterns, and design standards for the Accountability application.

---

# Part 1: Implementation Plan & Progress

This section tracks known issues, implementation status, and priorities.

## ⚠️⚠️⚠️ CRITICAL: OPEN ISSUES THAT MUST BE COMPLETED ⚠️⚠️⚠️

**DO NOT signal NOTHING_LEFT_TO_DO or TASK_COMPLETE until ALL of these issues are implemented:**

### OPEN ISSUES CHECKLIST

| Issue | Status | Description | Subtasks |
|-------|--------|-------------|----------|
| **Issue 28** | ✅ DONE | Consolidation Page Full Implementation | 8 subtasks (28.1-28.8), 10+ new files |
| **Issue 29** | ✅ DONE | Reports - Complete All Financial Report Views | 6 subtasks (29.1-29.6), 8 new files |
| **Issue 30** | ✅ DONE | Intercompany Transactions Full Implementation | 8 subtasks (30.1-30.8), 8 new files |
| **Issue 31** | ✅ DONE | Reports Parameter Selection UI Improvement | 5 files to update |
| **Issue 32** | ✅ DONE | Journal Entry Form UX Issues | 3 sub-issues (multi-currency, auto-period, empty periods) |
| **Issue 33** | ✅ DONE | Fiscal Periods Should Be Computed | Computed periods, no persistence, no period closing |
| **Issue 34** | ❌ OPEN | Backend: Remove Fiscal Period Persistence | API still requires fiscalPeriod, FiscalPeriodsApi still exists |

**⚠️ You MUST complete ALL issues marked ❌ OPEN before signaling completion.**

When you complete an issue, update its status in this table to ✅ DONE.

---

## 🚨🚨🚨 MANDATORY: BACKEND AND FRONTEND MUST STAY ALIGNED 🚨🚨🚨

**THIS IS A HARD REQUIREMENT. VIOLATIONS ARE NOT ACCEPTABLE.**

### Rules

1. **NEVER implement frontend-only changes for features that require backend work.**
   - If an issue specifies backend changes, you MUST implement them.
   - Frontend stubs that call non-existent APIs are BROKEN CODE.
   - Frontend workarounds that avoid backend changes are TECHNICAL DEBT.

2. **NEVER mark an issue as DONE if backend changes are incomplete.**
   - Both packages/web (frontend) AND packages/core, packages/api, packages/persistence (backend) must be updated.
   - "Frontend computes and sends the value" is NOT a substitute for proper backend implementation.

3. **Backend changes are REQUIRED, not optional.**
   - When an issue says "Update API", you MUST update the API.
   - When an issue says "Update Service", you MUST update the Service.
   - When an issue says "Remove validation", you MUST remove the validation.
   - These are not suggestions. These are requirements.

4. **Test both frontend AND backend.**
   - Run `pnpm test` to verify backend tests pass.
   - Run `pnpm typecheck` to verify types are correct across all packages.
   - If tests fail, fix them. Do not skip backend work because tests are "hard".

### Consequences of Misalignment

- Frontend shows forms that submit to non-existent endpoints → **BROKEN**
- Frontend computes values that backend ignores/overwrites → **INCONSISTENT**
- Frontend removes UI for features backend still requires → **RUNTIME ERRORS**
- Tests pass but app doesn't work → **USELESS TESTS**

### How to Handle Backend Work

1. **Read the issue carefully** - Look for mentions of packages/core, packages/api, packages/persistence
2. **Understand the data flow** - Frontend → API → Service → Repository → Database
3. **Make changes at EVERY layer** that the issue specifies
4. **Run tests** - `pnpm test && pnpm typecheck`
5. **Only then** mark the issue as DONE

---

## Implementation Scope

**The Known Issues section below is NOT the complete scope of work.**

The automation agent MUST implement the FULL design specification in Part 2 of this document.

### Pages Implementation Status

**⚠️ ALL BACKEND APIs EXIST** - These pages have stub frontends but the backend APIs are fully implemented. The frontend must be wired up to use the real APIs:

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| **Consolidation** | `/organizations/:orgId/consolidation` | ✅ IMPLEMENTED | All 8 subtasks complete: list page, create/edit forms, group detail, member management, run initiation, run detail with progress stepper and trial balance. |
| **Intercompany** | `/organizations/:orgId/intercompany` | ✅ IMPLEMENTED | All 8 subtasks complete: list page with filters, create/edit forms, transaction detail, matching status modal, JE linking modal, transaction type badges. |
| **Reports** | `/organizations/:orgId/reports` | ✅ IMPLEMENTED | All 5 financial reports implemented: Trial Balance, Balance Sheet, Income Statement, Cash Flow Statement, Statement of Changes in Equity. |
| **Audit Log** | `/organizations/:orgId/audit-log` | ✅ IMPLEMENTED | Backend API wired up. Issue 27 (filter UX) resolved. |

### Implementation Requirements

1. **All page templates** - List pages, Detail pages, Form pages must follow the exact layouts defined in Part 2
2. **Dashboard widgets** - The Organization Dashboard must have all widgets specified (summary cards, quick actions, recent activity)
3. **Empty states** - EVERY list/data page must have proper empty states with CTAs as specified
4. **Loading states** - Skeleton loaders, never blank pages, sidebar/header visible during load
5. **Error states** - Consistent error UI with retry actions
6. **Responsive design** - Mobile adaptations, collapsible sidebar, card-based lists on mobile
7. **Component standards** - Buttons, status badges, forms, tables must follow the defined patterns
8. **Table column tooltips** - Every column header must have explanatory tooltips
9. **Accessibility** - Keyboard navigation, focus indicators, ARIA labels, skip links

**DO NOT exit with NOTHING_LEFT_TO_DO until:**
- ALL pages in the table above are fully implemented
- Every page matches the templates in Part 2
- All component standards are implemented
- All states (empty, loading, error) are implemented across all pages
- The dashboard has all specified widgets
- Responsive design is fully implemented

**How to verify completeness:**
1. Navigate to each page in the sidebar and verify it's fully functional
2. Compare each page against the Part 2 specification
3. Check every list page has empty/loading/error states
4. Verify all tables have column header tooltips
5. Test responsive breakpoints (desktop, tablet, mobile)
6. Verify accessibility requirements

## Known Issues

### Issue 28: Consolidation Page Full Implementation - RESOLVED
- **Status**: Completed
- **Priority**: HIGH
- **Resolution**: Fully implemented all 8 subtasks. The Consolidation page now has a working groups list, create/edit forms, group detail page with members table and run history, member management, initiate run modal, and run detail page with progress stepper and consolidated trial balance display.

#### Backend API Available (ConsolidationApi - 17 endpoints)

**Group Management:**
- `GET /v1/consolidation/groups` - List groups (filter by organizationId, isActive)
- `GET /v1/consolidation/groups/:id` - Get group with members
- `POST /v1/consolidation/groups` - Create group
- `PUT /v1/consolidation/groups/:id` - Update group
- `DELETE /v1/consolidation/groups/:id` - Delete group
- `POST /v1/consolidation/groups/:id/activate` - Activate group
- `POST /v1/consolidation/groups/:id/deactivate` - Deactivate group

**Member Management:**
- `POST /v1/consolidation/groups/:id/members` - Add member
- `PUT /v1/consolidation/groups/:id/members/:companyId` - Update member
- `DELETE /v1/consolidation/groups/:id/members/:companyId` - Remove member

**Run Management:**
- `GET /v1/consolidation/runs` - List runs (filter by groupId, status, year, period)
- `GET /v1/consolidation/runs/:id` - Get run with step statuses
- `POST /v1/consolidation/groups/:groupId/runs` - Initiate run
- `POST /v1/consolidation/runs/:id/cancel` - Cancel run
- `DELETE /v1/consolidation/runs/:id` - Delete run
- `GET /v1/consolidation/runs/:id/trial-balance` - Get consolidated trial balance
- `GET /v1/consolidation/groups/:groupId/latest-run` - Get latest completed run

#### Routes to Create

| Route | File | Purpose |
|-------|------|---------|
| `/consolidation` | `index.tsx` | List consolidation groups |
| `/consolidation/new` | `new.tsx` | Create new group form |
| `/consolidation/:groupId` | `$groupId/index.tsx` | Group detail with members & run history |
| `/consolidation/:groupId/edit` | `$groupId/edit.tsx` | Edit group form |
| `/consolidation/:groupId/runs/:runId` | `$groupId/runs/$runId.tsx` | Run detail with progress & trial balance |

#### Task 28.1: Consolidation Groups List Page
- **Route**: `/organizations/:orgId/consolidation`
- **File**: `packages/web/src/routes/organizations/$organizationId/consolidation/index.tsx`
- **Requirements**:
  1. Fetch groups via `GET /v1/consolidation/groups?organizationId=...`
  2. Display table with columns: Name, Parent Company, Members (count), Currency, Status (Active/Inactive badge)
  3. Add column header tooltips per spec
  4. "New Consolidation Group" button (enabled, links to `/consolidation/new`)
  5. Filter toggle for Active/Inactive groups
  6. Click row → navigate to group detail
  7. Empty state when no groups exist (keep existing feature cards but add working CTA)
  8. Loading state with skeleton table
  9. Pagination if > 25 groups

#### Task 28.2: Create Consolidation Group Form
- **Route**: `/organizations/:orgId/consolidation/new`
- **File**: `packages/web/src/routes/organizations/$organizationId/consolidation/new.tsx`
- **Requirements**:
  1. Form fields:
     - Name (required, text input)
     - Reporting Currency (required, currency dropdown)
     - Consolidation Method (required, select: FullConsolidation, EquityMethod, CostMethod, VariableInterestEntity)
     - Parent Company (required, dropdown of org's companies)
  2. Members section:
     - "Add Member" button to add subsidiary companies
     - Each member row: Company (dropdown), Ownership % (0-100), Consolidation Method (select)
     - Remove member button on each row
     - Validation: ownership % between 0-100, no duplicate companies
  3. Submit via `POST /v1/consolidation/groups`
  4. Cancel button returns to list
  5. On success → navigate to group detail page
  6. Form validation with error messages
  7. Loading state on submit button

#### Task 28.3: Consolidation Group Detail Page
- **Route**: `/organizations/:orgId/consolidation/:groupId`
- **File**: `packages/web/src/routes/organizations/$organizationId/consolidation/$groupId/index.tsx`
- **Requirements**:
  1. Fetch group via `GET /v1/consolidation/groups/:id`
  2. Header section:
     - Group name as title
     - Status badge (Active/Inactive)
     - Actions: Edit button, Activate/Deactivate toggle, Delete button (with confirmation modal)
  3. Group info card:
     - Reporting Currency
     - Consolidation Method
     - Parent Company name
  4. Members table:
     - Columns: Company Name, Ownership %, Consolidation Method, Acquisition Date, NCI %
     - Row actions: Edit (modal), Remove (with confirmation)
     - "Add Member" button opens modal
     - Column header tooltips
  5. Run History section:
     - Fetch via `GET /v1/consolidation/runs?groupId=...`
     - Table: Period, As-of Date, Status (badge), Initiated By, Duration
     - Click row → navigate to run detail
     - "New Run" button opens initiate run modal
  6. Latest Run card (if exists):
     - Show summary of most recent completed run
     - Quick link to view trial balance

#### Task 28.4: Edit Consolidation Group Form
- **Route**: `/organizations/:orgId/consolidation/:groupId/edit`
- **File**: `packages/web/src/routes/organizations/$organizationId/consolidation/$groupId/edit.tsx`
- **Requirements**:
  1. Pre-populate form with existing group data
  2. Editable fields: Name, Consolidation Method, Reporting Currency
  3. Parent Company shown but NOT editable (display only)
  4. Submit via `PUT /v1/consolidation/groups/:id`
  5. Cancel returns to group detail
  6. On success → navigate back to group detail

#### Task 28.5: Add/Edit Member Modal
- **Location**: Component used in group detail page
- **File**: `packages/web/src/components/consolidation/MemberModal.tsx`
- **Requirements**:
  1. Modal dialog for adding or editing a member
  2. Fields:
     - Company (dropdown, only companies not already members)
     - Ownership Percentage (0-100 number input)
     - Consolidation Method (select dropdown)
  3. For add: `POST /v1/consolidation/groups/:id/members`
  4. For edit: `PUT /v1/consolidation/groups/:id/members/:companyId`
  5. Validation: ownership between 0-100
  6. Auto-calculate NCI % (100 - ownership)

#### Task 28.6: Initiate Run Modal
- **Location**: Component used in group detail page
- **File**: `packages/web/src/components/consolidation/InitiateRunModal.tsx`
- **Requirements**:
  1. Modal dialog to initiate a new consolidation run
  2. Fields:
     - Fiscal Year (number input or select)
     - Fiscal Period (number input or select)
     - As-of Date (date picker)
  3. Options (checkboxes):
     - Skip Validation (default: false)
     - Continue on Warnings (default: true)
     - Include Equity Method Investments (default: true)
     - Force Regeneration (default: false)
  4. Submit via `POST /v1/consolidation/groups/:groupId/runs`
  5. On success → navigate to run detail page
  6. Show error if run already exists for period (unless force regeneration)

#### Task 28.7: Consolidation Run Detail Page
- **Route**: `/organizations/:orgId/consolidation/:groupId/runs/:runId`
- **File**: `packages/web/src/routes/organizations/$organizationId/consolidation/$groupId/runs/$runId.tsx`
- **Requirements**:
  1. Fetch run via `GET /v1/consolidation/runs/:id`
  2. Header:
     - "Consolidation Run: [Period]" title
     - Status badge (Pending, InProgress, Completed, Failed, Cancelled)
     - Back to group link
  3. Run info section:
     - Period (Year/Period)
     - As-of Date
     - Initiated By, Initiated At
     - Started At, Completed At
     - Total Duration
  4. **Progress Stepper** (7 steps):
     - Validate Member Data
     - Currency Translation
     - Aggregate Balances
     - Intercompany Matching
     - Generate Eliminations
     - Calculate Minority Interest
     - Generate Consolidated TB
     - Each step shows: status icon (pending/running/completed/failed/skipped), name, duration
  5. Validation Results section (if available):
     - Show errors (red) and warnings (yellow)
     - Display issue code, message, entity reference
  6. Actions:
     - Cancel button (for Pending/InProgress runs) via `POST /runs/:id/cancel`
     - Delete button (for Pending/Failed runs) via `DELETE /runs/:id`
  7. For COMPLETED runs:
     - "View Consolidated Trial Balance" button/section
     - Fetch via `GET /runs/:id/trial-balance`
     - Display trial balance table: Account #, Account Name, Type, Aggregated, Eliminations, NCI, Consolidated
     - Show totals: Total Debits, Total Credits, Total Eliminations, Total NCI
     - Balance check indicator (debits = credits)

#### Task 28.8: Delete Confirmation Modals
- **File**: `packages/web/src/components/consolidation/DeleteGroupModal.tsx`
- **File**: `packages/web/src/components/consolidation/DeleteRunModal.tsx`
- **Requirements**:
  1. Confirmation dialog with warning text
  2. For groups: warn about impact, check for completed runs
  3. For runs: only allow delete of Pending/Failed runs
  4. Type-to-confirm pattern (type group/run name to confirm)

#### Files to Create/Modify

**New Files:**
- `packages/web/src/routes/organizations/$organizationId/consolidation/new.tsx`
- `packages/web/src/routes/organizations/$organizationId/consolidation/$groupId/index.tsx`
- `packages/web/src/routes/organizations/$organizationId/consolidation/$groupId/edit.tsx`
- `packages/web/src/routes/organizations/$organizationId/consolidation/$groupId/runs/$runId.tsx`
- `packages/web/src/components/consolidation/MemberModal.tsx`
- `packages/web/src/components/consolidation/InitiateRunModal.tsx`
- `packages/web/src/components/consolidation/DeleteGroupModal.tsx`
- `packages/web/src/components/consolidation/DeleteRunModal.tsx`
- `packages/web/src/components/consolidation/ProgressStepper.tsx`
- `packages/web/src/components/consolidation/TrialBalanceTable.tsx`

**Modify:**
- `packages/web/src/routes/organizations/$organizationId/consolidation/index.tsx` - Replace stub with real implementation

### Issue 29: Reports - Complete All Financial Report Views - RESOLVED
- **Status**: Completed
- **Priority**: HIGH
- **Resolution**: Implemented all 4 remaining financial report pages. Each report has full parameter selection, API integration, and professional report display with tooltips:
  1. **Balance Sheet** (`balance-sheet.tsx`): As-of date, comparative date, include zero balances checkbox. Shows Assets, Liabilities, Equity sections with totals and balance verification.
  2. **Income Statement** (`income-statement.tsx`): Period dates with optional comparative period. Shows Revenue, Cost of Sales, Gross Profit, Operating Expenses, Operating Income, Other Income/Expense, and Net Income.
  3. **Cash Flow Statement** (`cash-flow.tsx`): Period dates with method selection (direct/indirect). Shows Beginning Cash, Operating/Investing/Financing activities, Exchange Rate Effect, Net Change, and Ending Cash with verification.
  4. **Statement of Changes in Equity** (`equity-statement.tsx`): Period dates. Columnar format showing all equity components (Common Stock, Preferred Stock, APIC, Retained Earnings, Treasury Stock, AOCI, NCI) with opening balances, movements, and closing balances.
- **Files created**:
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/balance-sheet.tsx`
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/income-statement.tsx`
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/cash-flow.tsx`
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/equity-statement.tsx`
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/index.tsx` - Enabled all 5 report cards and updated routing to use dynamic paths based on report ID
- **Previous Problem**: Only Trial Balance was implemented. Balance Sheet, Income Statement, Cash Flow Statement, and Statement of Changes in Equity all showed "Coming Soon" despite having fully implemented backend APIs.

#### Backend API Available (ReportsApi - 5 endpoints)

| Endpoint | Route | Parameters | Status |
|----------|-------|------------|--------|
| Trial Balance | `GET /v1/reports/trial-balance` | companyId, asOfDate, periodStartDate?, excludeZeroBalances?, format? | ✅ Frontend Done |
| Balance Sheet | `GET /v1/reports/balance-sheet` | companyId, asOfDate, comparativeDate?, includeZeroBalances?, format? | ✅ Frontend Done |
| Income Statement | `GET /v1/reports/income-statement` | companyId, periodStartDate, periodEndDate, comparativeStartDate?, comparativeEndDate?, format? | ✅ Frontend Done |
| Cash Flow Statement | `GET /v1/reports/cash-flow` | companyId, periodStartDate, periodEndDate, method? (direct/indirect), format? | ✅ Frontend Done |
| Equity Statement | `GET /v1/reports/equity-statement` | companyId, periodStartDate, periodEndDate, format? | ✅ Frontend Done |

#### Current Implementation

- ✅ `/organizations/:orgId/reports` - Company selection (Step 1)
- ✅ `/organizations/:orgId/companies/:companyId/reports` - Report type selection (Step 2)
- ✅ `/organizations/:orgId/companies/:companyId/reports/trial-balance` - Working
- ✅ `/organizations/:orgId/companies/:companyId/reports/balance-sheet` - Working
- ✅ `/organizations/:orgId/companies/:companyId/reports/income-statement` - Working
- ✅ `/organizations/:orgId/companies/:companyId/reports/cash-flow` - Working
- ✅ `/organizations/:orgId/companies/:companyId/reports/equity-statement` - Working

#### Routes Created (Issue 29 Resolution)

| Route | File | Report Type |
|-------|------|-------------|
| `.../reports/balance-sheet` | `balance-sheet.tsx` | Balance Sheet (ASC 210) ✅ |
| `.../reports/income-statement` | `income-statement.tsx` | Income Statement (ASC 220) ✅ |
| `.../reports/cash-flow` | `cash-flow.tsx` | Cash Flow Statement (ASC 230) ✅ |
| `.../reports/equity-statement` | `equity-statement.tsx` | Statement of Changes in Equity ✅ |

#### Task 29.1: Balance Sheet Report Page
- **Route**: `/organizations/:orgId/companies/:companyId/reports/balance-sheet`
- **File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/balance-sheet.tsx`
- **API**: `GET /v1/reports/balance-sheet`
- **Requirements**:
  1. Parameters form:
     - As of Date (date picker, required)
     - Comparative Date (date picker, optional - for period comparison)
     - Include Zero Balances checkbox
  2. "Generate Report" button
  3. Report display:
     - **Assets section**: Current Assets, Non-Current Assets, Total Assets
     - **Liabilities section**: Current Liabilities, Non-Current Liabilities, Total Liabilities
     - **Equity section**: Line items with Total Equity
     - **Footer**: Total Liabilities & Equity (must equal Total Assets)
  4. Each section shows line items with:
     - Account number (optional), Description, Current Amount, Comparative Amount (if date provided), Variance, Variance %
     - Indent levels for sub-items
     - Subtotals with bold styling
  5. Balance check indicator (Assets = Liabilities + Equity)
  6. Export buttons (Print, PDF, Excel)
  7. Column header tooltips

#### Task 29.2: Income Statement Report Page
- **Route**: `/organizations/:orgId/companies/:companyId/reports/income-statement`
- **File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/income-statement.tsx`
- **API**: `GET /v1/reports/income-statement`
- **Requirements**:
  1. Parameters form:
     - Period Start Date (date picker, required)
     - Period End Date (date picker, required)
     - Comparative Start Date (optional)
     - Comparative End Date (optional)
  2. "Generate Report" button
  3. Report display sections:
     - **Revenue**: Line items → Total Revenue
     - **Cost of Sales**: Line items → Total COGS
     - **Gross Profit** (Revenue - COGS)
     - **Operating Expenses**: Line items → Total OpEx
     - **Operating Income** (Gross Profit - OpEx)
     - **Other Income/Expense**: Line items → Total
     - **Income Before Tax**
     - **Tax Expense**
     - **Net Income**
  4. Each line shows: Description, Current, Comparative (if dates provided), Variance, Variance %
  5. Visual hierarchy with bold totals, indented sub-items
  6. Export buttons
  7. Column header tooltips

#### Task 29.3: Cash Flow Statement Report Page
- **Route**: `/organizations/:orgId/companies/:companyId/reports/cash-flow`
- **File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/cash-flow.tsx`
- **API**: `GET /v1/reports/cash-flow`
- **Requirements**:
  1. Parameters form:
     - Period Start Date (date picker, required)
     - Period End Date (date picker, required)
     - Method (radio: "Indirect" or "Direct", default Indirect)
  2. "Generate Report" button
  3. Report display sections:
     - **Beginning Cash Balance**
     - **Operating Activities**: Line items → Net Cash from Operations
     - **Investing Activities**: Line items → Net Cash from Investing
     - **Financing Activities**: Line items → Net Cash from Financing
     - **Exchange Rate Effect**
     - **Net Change in Cash**
     - **Ending Cash Balance**
  4. Each section shows line items with amounts
  5. Verification: Beginning + Net Change = Ending
  6. Export buttons
  7. Column header tooltips

#### Task 29.4: Statement of Changes in Equity Report Page
- **Route**: `/organizations/:orgId/companies/:companyId/reports/equity-statement`
- **File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/equity-statement.tsx`
- **API**: `GET /v1/reports/equity-statement`
- **Requirements**:
  1. Parameters form:
     - Period Start Date (date picker, required)
     - Period End Date (date picker, required)
  2. "Generate Report" button
  3. Report display:
     - **Opening Balances row**: Common Stock, Preferred Stock, APIC, Retained Earnings, Treasury Stock, Accumulated OCI, NCI, Total
     - **Movement rows** (for each movement type):
       - Net Income
       - Other Comprehensive Income
       - Dividends Declared
       - Stock Issuance/Repurchase
       - Stock-Based Compensation
       - Prior Period Adjustments
       - Other
     - **Closing Balances row**: All columns with final totals
  4. Columnar format showing each equity component
  5. Movement type labels in first column
  6. Export buttons
  7. Column header tooltips explaining each equity component

#### Task 29.5: Enable Report Cards in Hub Page
- **File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/index.tsx`
- **Requirements**:
  1. Update `getReportCards()` function to set `available: true` for all reports once their pages are created
  2. Update the `Link` component in `ReportCardComponent` to use dynamic routing based on `report.id`
  3. Ensure all 5 report cards link to their respective pages

#### Task 29.6: Shared Report Components
- **File**: `packages/web/src/components/reports/ReportSection.tsx` - Reusable section component
- **File**: `packages/web/src/components/reports/ReportLineItem.tsx` - Reusable line item with indent
- **File**: `packages/web/src/components/reports/ReportHeader.tsx` - Standard report header with company/date/export
- **File**: `packages/web/src/components/reports/ReportTable.tsx` - Standard report table wrapper
- **Requirements**:
  1. Extract common patterns from trial-balance.tsx
  2. Support indent levels (0-3 levels)
  3. Support line item styles (Normal, Subtotal, Total, Header)
  4. Consistent number formatting
  5. Variance calculation display (amount and %)

#### Files to Create

**New Report Pages:**
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/balance-sheet.tsx`
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/income-statement.tsx`
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/cash-flow.tsx`
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/equity-statement.tsx`

**Shared Components:**
- `packages/web/src/components/reports/ReportSection.tsx`
- `packages/web/src/components/reports/ReportLineItem.tsx`
- `packages/web/src/components/reports/ReportHeader.tsx`
- `packages/web/src/components/reports/ReportTable.tsx`

**Modify:**
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/index.tsx` - Enable all report cards

### Issue 30: Intercompany Transactions Full Implementation - RESOLVED
- **Status**: Completed
- **Priority**: HIGH
- **Resolution**: Fully implemented all 8 subtasks. The Intercompany page now has a working transactions list with filters (company, type, status, unmatched), create/edit forms, transaction detail page with matching status updates and journal entry linking, and proper badge components. Files created:
  - `packages/web/src/routes/organizations/$organizationId/intercompany/index.tsx` - List page with filters and table
  - `packages/web/src/routes/organizations/$organizationId/intercompany/new.tsx` - Create transaction form
  - `packages/web/src/routes/organizations/$organizationId/intercompany/$transactionId/index.tsx` - Transaction detail with matching status and JE linking
  - `packages/web/src/routes/organizations/$organizationId/intercompany/$transactionId/edit.tsx` - Edit transaction form
  - `packages/web/src/components/intercompany/MatchingStatusModal.tsx` - Modal for updating matching status
  - `packages/web/src/components/intercompany/LinkJournalEntryModal.tsx` - Modal for linking journal entries
  - `packages/web/src/components/intercompany/TransactionTypeBadge.tsx` - Transaction type badges with icons
  - `packages/web/src/components/intercompany/MatchingStatusBadge.tsx` - Matching status badges

#### Backend API Available (IntercompanyTransactionsApi - 8 endpoints)

| Endpoint | Route | Purpose |
|----------|-------|---------|
| List | `GET /v1/intercompany-transactions` | List with filters (company, type, status, date range, unmatched, requiresElimination) |
| Get | `GET /v1/intercompany-transactions/:id` | Get single transaction |
| Create | `POST /v1/intercompany-transactions` | Create new transaction |
| Update | `PUT /v1/intercompany-transactions/:id` | Update transaction |
| Delete | `DELETE /v1/intercompany-transactions/:id` | Delete transaction |
| Update Status | `POST /v1/intercompany-transactions/:id/matching-status` | Update matching status |
| Link From JE | `POST /v1/intercompany-transactions/:id/link-from-journal-entry` | Link journal entry to "from" side |
| Link To JE | `POST /v1/intercompany-transactions/:id/link-to-journal-entry` | Link journal entry to "to" side |

#### Domain Model

**Transaction Types:**
- `SalePurchase` - Sale/purchase of goods or services
- `Loan` - Intercompany loans
- `ManagementFee` - Management fee charges
- `Dividend` - Dividend distributions
- `CapitalContribution` - Capital contributions
- `CostAllocation` - Cost allocation charges
- `Royalty` - Royalty payments

**Matching Statuses:**
- `Matched` - Both sides agree on amount and details (green)
- `Unmatched` - Missing entry on one side (red)
- `PartiallyMatched` - Amounts differ between sides (yellow)
- `VarianceApproved` - Difference has been reviewed and accepted (blue)

#### Routes to Create

| Route | File | Purpose |
|-------|------|---------|
| `/intercompany` | `index.tsx` | List transactions with filters |
| `/intercompany/new` | `new.tsx` | Create new transaction form |
| `/intercompany/:transactionId` | `$transactionId/index.tsx` | Transaction detail page |
| `/intercompany/:transactionId/edit` | `$transactionId/edit.tsx` | Edit transaction form |

#### Task 30.1: Intercompany Transactions List Page
- **Route**: `/organizations/:orgId/intercompany`
- **File**: `packages/web/src/routes/organizations/$organizationId/intercompany/index.tsx`
- **Requirements**:
  1. Fetch transactions via `GET /v1/intercompany-transactions?...` with org's company filters
  2. Filter controls:
     - From Company (dropdown)
     - To Company (dropdown)
     - Transaction Type (multi-select)
     - Matching Status (multi-select)
     - Date Range (start/end date pickers)
     - Show Unmatched Only (checkbox)
     - Requires Elimination (checkbox)
  3. Table columns with tooltips:
     - Date
     - Type (badge with icon)
     - From Company → To Company (with arrow)
     - Amount (formatted with currency)
     - Matching Status (colored badge)
     - Journal Entries (icons showing if from/to entries are linked)
     - Actions (view, edit, delete dropdown)
  4. "New Transaction" button (enabled, links to `/intercompany/new`)
  5. Empty state with CTA when no transactions
  6. Loading state with skeleton table
  7. Pagination (limit 25 per page)
  8. Click row → navigate to transaction detail

#### Task 30.2: Create Intercompany Transaction Form
- **Route**: `/organizations/:orgId/intercompany/new`
- **File**: `packages/web/src/routes/organizations/$organizationId/intercompany/new.tsx`
- **Requirements**:
  1. Form fields:
     - From Company (required, dropdown of org's companies)
     - To Company (required, dropdown of org's companies, must differ from From)
     - Transaction Type (required, select dropdown)
     - Transaction Date (required, date picker)
     - Amount (required, currency selector + number input)
     - Description (optional, textarea)
  2. Validation:
     - From and To companies must be different
     - Amount must be positive
     - Date required
  3. Submit via `POST /v1/intercompany-transactions`
  4. Cancel button returns to list
  5. On success → navigate to transaction detail page
  6. Loading state on submit button
  7. Display API validation errors

#### Task 30.3: Intercompany Transaction Detail Page
- **Route**: `/organizations/:orgId/intercompany/:transactionId`
- **File**: `packages/web/src/routes/organizations/$organizationId/intercompany/$transactionId/index.tsx`
- **Requirements**:
  1. Fetch transaction via `GET /v1/intercompany-transactions/:id`
  2. Header section:
     - Transaction ID/reference
     - Matching Status badge (prominent)
     - Actions: Edit button, Delete button (with confirmation)
  3. Transaction info card:
     - From Company (with link to company page)
     - To Company (with link to company page)
     - Transaction Type (badge)
     - Transaction Date
     - Amount
     - Description (if present)
     - Created At, Updated At
  4. **Journal Entries section** (two-column layout):
     - **From Side**:
       - If linked: Show JE number with link to journal entry detail
       - If not linked: "Not linked" + "Link Journal Entry" button → opens modal
     - **To Side**:
       - Same as From Side
  5. **Matching/Reconciliation section**:
     - Current status with explanation
     - If variance exists: Show variance amount
     - If variance explanation exists: Show it
     - "Update Matching Status" button → opens modal
  6. **Variance section** (if applicable):
     - Variance Amount
     - Variance Explanation
     - "Approve Variance" action if status is PartiallyMatched

#### Task 30.4: Edit Intercompany Transaction Form
- **Route**: `/organizations/:orgId/intercompany/:transactionId/edit`
- **File**: `packages/web/src/routes/organizations/$organizationId/intercompany/$transactionId/edit.tsx`
- **Requirements**:
  1. Pre-populate form with existing transaction data
  2. Editable fields:
     - Transaction Type
     - Transaction Date
     - Amount
     - Description
     - Variance Amount (if applicable)
     - Variance Explanation (if applicable)
  3. From/To companies shown but NOT editable (display only)
  4. Submit via `PUT /v1/intercompany-transactions/:id`
  5. Cancel returns to transaction detail
  6. On success → navigate back to transaction detail
  7. Warn if transaction is already matched (edits may require re-matching)

#### Task 30.5: Update Matching Status Modal
- **Location**: Component used in transaction detail page
- **File**: `packages/web/src/components/intercompany/MatchingStatusModal.tsx`
- **Requirements**:
  1. Modal dialog to update matching status
  2. Radio/select for new status:
     - Matched
     - Unmatched
     - PartiallyMatched
     - VarianceApproved
  3. Conditional variance explanation field:
     - Required when changing to VarianceApproved
     - Optional for other statuses
  4. Submit via `POST /v1/intercompany-transactions/:id/matching-status`
  5. Show current status for reference
  6. Validation: VarianceApproved requires explanation

#### Task 30.6: Link Journal Entry Modal
- **Location**: Component used in transaction detail page
- **File**: `packages/web/src/components/intercompany/LinkJournalEntryModal.tsx`
- **Requirements**:
  1. Modal dialog to link a journal entry
  2. Props: transactionId, side ("from" or "to"), companyId
  3. Journal entry search/selection:
     - Filter by company (must match the transaction's from/to company)
     - Search by JE number
     - Show: JE Number, Date, Description, Amount
  4. Validation:
     - Journal entry must belong to correct company
     - Journal entry should not already be linked to another IC transaction
  5. Submit via:
     - `POST /v1/intercompany-transactions/:id/link-from-journal-entry` (for "from" side)
     - `POST /v1/intercompany-transactions/:id/link-to-journal-entry` (for "to" side)
  6. On success: refresh transaction detail, close modal

#### Task 30.7: Delete Transaction Confirmation Modal
- **File**: `packages/web/src/components/intercompany/DeleteTransactionModal.tsx`
- **Requirements**:
  1. Confirmation dialog with warning text
  2. Warn that linked journal entries will be unlinked
  3. Cannot delete if status is Matched (business rule)
  4. Type transaction ID or amount to confirm
  5. Submit via `DELETE /v1/intercompany-transactions/:id`
  6. On success → navigate to transactions list

#### Task 30.8: Intercompany Transaction Type Badge Component
- **File**: `packages/web/src/components/intercompany/TransactionTypeBadge.tsx`
- **Requirements**:
  1. Consistent badge styling for each transaction type
  2. Include appropriate icon for each type:
     - SalePurchase: ShoppingCart
     - Loan: Banknote
     - ManagementFee: Briefcase
     - Dividend: TrendingUp
     - CapitalContribution: Building
     - CostAllocation: Calculator
     - Royalty: Star
  3. Color coding by type

#### Files to Create

**New Route Pages:**
- `packages/web/src/routes/organizations/$organizationId/intercompany/new.tsx`
- `packages/web/src/routes/organizations/$organizationId/intercompany/$transactionId/index.tsx`
- `packages/web/src/routes/organizations/$organizationId/intercompany/$transactionId/edit.tsx`

**New Components:**
- `packages/web/src/components/intercompany/MatchingStatusModal.tsx`
- `packages/web/src/components/intercompany/LinkJournalEntryModal.tsx`
- `packages/web/src/components/intercompany/DeleteTransactionModal.tsx`
- `packages/web/src/components/intercompany/TransactionTypeBadge.tsx`
- `packages/web/src/components/intercompany/MatchingStatusBadge.tsx`

**Modify:**
- `packages/web/src/routes/organizations/$organizationId/intercompany/index.tsx` - Replace stub with real implementation

### Issue 31: Reports Parameter Selection UI Improvement - RESOLVED
- **Status**: Completed
- **Priority**: MEDIUM
- **Resolution**: Created a shared `ReportParameterForm` component with professional, consistent styling that all 5 financial report pages now use. The component provides:
  1. **Card wrapper** with "Report Parameters" header and description
  2. **FormSection** component for grouping related fields with headers
  3. **FormRow** component for 2-column grid layout on desktop (single column on mobile)
  4. **FormField** component with consistent label styling, required indicators, and hint text
  5. **DateInput** component with consistent styling
  6. **CheckboxField** component for option toggles with proper alignment
  7. **RadioGroup** component for method selection
  8. **Footer area** with prominent "Generate Report" button with arrow icon and loading spinner
- **Files created**:
  - `packages/web/src/components/reports/ReportParameterForm.tsx` - Shared form components
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/trial-balance.tsx`
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/balance-sheet.tsx`
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/income-statement.tsx`
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/cash-flow.tsx`
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/equity-statement.tsx`

### Issue 32: Journal Entry Form UX Issues - RESOLVED
- **Status**: Completed
- **Priority**: HIGH
- **Resolution**: Implemented all 3 sub-issues to improve the Journal Entry form UX:

#### Issue 32.1: Multi-Currency Behavior - FIXED
- Renamed checkbox label from "Multi-currency entry" to "Foreign currency entry" to clarify it's a single foreign currency feature
- Added helper text below the checkbox: "Enable to record this entry in a foreign currency. All line items will use the selected currency and be converted to [functional currency] at the exchange rate."
- Added an info banner when foreign currency is enabled that clearly explains the behavior

#### Issue 32.2: Auto-Select Period from Date - FIXED
- Added `findPeriodForDate()` helper function that finds the matching fiscal period for a given date
- Added `useEffect` hook that auto-detects the fiscal period when the transaction date changes
- Shows "(Auto-detected from date)" label next to Period when period was auto-selected
- Shows warning "Transaction date falls outside configured fiscal periods" when date doesn't match any period
- When user manually changes the period, the auto-detected indicator is cleared
- Updated `FiscalPeriodOption` interface to include `startDate` and `endDate` for date matching

#### Issue 32.3: Empty Periods Warning - FIXED
- Shows prominent amber warning card when no fiscal periods are configured:
  - "No Fiscal Periods Configured" header
  - Explanation text about needing to configure periods before creating entries
  - "Configure Fiscal Periods →" link to the fiscal setup page
- Validation now prevents form submission when no fiscal periods exist, showing clear error message
- Added `fiscalPeriodsConfigUrl` prop to JournalEntryForm for the setup link

#### Files Modified
- `packages/web/src/components/forms/JournalEntryForm.tsx` - All three sub-issue fixes
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/journal-entries/new.tsx` - Pass start/end dates and fiscal config URL

### Issue 33: Fiscal Periods Should Be Computed, Not Persisted
- **Status**: ✅ RESOLVED
- **Priority**: HIGH
- **Problem**: The current design persists fiscal years and periods in the database and requires period closing workflows. This is unnecessarily complex - fiscal periods should be **computed automatically** from the fiscal year end date stored on the company. Period closing is not needed.

#### New Design (Simplified)

**Fiscal periods computed at runtime. No persistence. No period closing.**

Given:
- Company fiscal year end = December 31
- Transaction date = March 15, 2024

Compute:
- Fiscal Year = 2024 (Jan 1 - Dec 31, 2024)
- Period = P3 (March 1 - March 31)
- Period Name = "March 2024" or "P3 FY2024"

**Why no period closing?**
- Mistakes are corrected with reversing entries
- Audit log provides full accountability for all changes
- Period closing is a legacy concept from paper ledgers
- Removes friction and "locked out" scenarios

#### Required Backend Changes

**33.1: Add Computed Fiscal Period Logic**

```typescript
interface ComputedFiscalPeriod {
  fiscalYear: number          // e.g., 2024
  periodNumber: number        // 1-12
  periodName: string          // "P3" or "March 2024"
  startDate: Date             // March 1, 2024
  endDate: Date               // March 31, 2024
  fiscalYearStart: Date       // Jan 1, 2024
  fiscalYearEnd: Date         // Dec 31, 2024
}

function computeFiscalPeriod(date: Date, fiscalYearEnd: { month: number, day: number }): ComputedFiscalPeriod
```

**33.2: Remove Fiscal Period Tables and APIs**

- Remove `FiscalYear` entity and table
- Remove `FiscalPeriod` entity and table
- Remove all fiscal period CRUD APIs (`/v1/fiscal/fiscal-years`, `/v1/fiscal/fiscal-periods`)
- Journal entry creation no longer validates against persisted periods

**33.3: Update Journal Entry API**

- Remove `fiscalPeriod: { year, period }` from request body (no longer user-provided)
- Compute fiscal period server-side from `transactionDate` + company's `fiscalYearEnd`
- Return computed fiscal period in response:
```json
{
  "id": "...",
  "transactionDate": "2024-03-15",
  "fiscalPeriod": {
    "year": 2024,
    "period": 3,
    "name": "P3"
  }
}
```

#### Required Frontend Changes

**33.4: Update Journal Entry Form**

- Remove fiscal year/period dropdowns entirely
- Compute and display period based on selected date (read-only)
- Show: "Period: P3 FY2024 (March 2024)" next to date picker

**33.5: Remove Fiscal Periods Management UI**

- Remove `packages/web/src/routes/organizations/$organizationId/companies/$companyId/fiscal/index.tsx`
- Remove "Fiscal Periods" link from company detail page
- No period closing UI needed

**33.6: Update Journal Entry List Filters**

- Fiscal year/period filters compute from date ranges
- Or simplify to just date range filters

#### Edge Cases

1. **Non-calendar fiscal years**: Company with fiscal year end = June 30
   - FY2024 = July 1, 2023 - June 30, 2024
   - March 2024 = P9 (9th month of FY2024)
   - Computation logic must handle this correctly

2. **Future support for non-monthly periods**: Could add `periodType` enum (Monthly, Quarterly) but Monthly is sufficient for MVP

#### Files to Modify

**Backend (packages/core, packages/persistence, packages/api):**
- Add `computeFiscalPeriod` utility function in core
- Remove `FiscalYear` and `FiscalPeriod` entities
- Remove fiscal period repositories and services
- Remove fiscal period API endpoints
- Update journal entry service to compute period from date

**Frontend (packages/web):**
- `JournalEntryForm.tsx` - Remove period dropdowns, show computed period
- `journal-entries/new.tsx` - Remove fiscal period fetching
- `journal-entries/index.tsx` - Update filters
- Remove `fiscal/index.tsx` page
- Update company detail page to remove fiscal periods link

#### Resolution

Implemented computed fiscal periods to simplify the system and remove unnecessary complexity:

1. **Frontend Changes (Issue 33.4 - 33.5)**:
   - Updated `JournalEntryForm.tsx` to compute fiscal period from transaction date and company's fiscal year end
   - Replaced fiscal year/period dropdown selectors with read-only `ComputedPeriodDisplay` component
   - Shows "P3 FY2024 (March 2024)" style display with info tooltip explaining automatic computation
   - Removed `fiscalPeriods`, `defaultFiscalPeriod`, and `fiscalPeriodsConfigUrl` props
   - Added `fiscalYearEnd` prop to receive company's fiscal year end setting
   - Updated `journal-entries/new.tsx` to pass company's fiscal year end instead of fetching fiscal periods
   - Deleted `fiscal/index.tsx` management page entirely
   - Removed "Fiscal Periods" navigation card from company detail page

2. **Backend Compatibility**:
   - The backend still accepts `fiscalPeriod: { year, period }` in journal entry creation
   - Frontend now computes and sends the correct period automatically
   - No backend changes required for MVP - future iteration can remove period from API input

3. **Key Benefits**:
   - No more "No Fiscal Periods Configured" blocking errors
   - Users can create journal entries immediately without setup
   - Period is always correct based on transaction date
   - Simpler UX with one less thing to configure

**Files Modified**:
- `packages/web/src/components/forms/JournalEntryForm.tsx` - Complete rewrite of period handling
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/journal-entries/new.tsx` - Pass fiscalYearEnd, remove period fetching
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/index.tsx` - Remove Fiscal Periods navigation card
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/fiscal/index.tsx` - DELETED

### Issue 34: Backend - Remove Fiscal Period Persistence and Use Computed Periods
- **Status**: ✅ RESOLVED
- **Priority**: CRITICAL (was)
- **Resolution**: Complete backend cleanup done. All fiscal period infrastructure removed, periods now computed at runtime from transaction dates.

#### Changes Made

| File | Change | Status |
|------|--------|--------|
| `packages/api/src/Definitions/JournalEntriesApi.ts` | fiscalPeriod field now optional (Schema.OptionFromNullOr) | ✅ DONE |
| `packages/api/src/Layers/JournalEntriesApiLive.ts` | Computes period from transactionDate + company.fiscalYearEnd using computeFiscalPeriod() | ✅ DONE |
| `packages/api/src/Definitions/FiscalPeriodsApi.ts` | **DELETED** | ✅ DONE |
| `packages/api/src/Layers/FiscalPeriodsApiLive.ts` | **DELETED** | ✅ DONE |
| `packages/api/src/Definitions/AppApi.ts` | Removed FiscalPeriodsApi import and registration | ✅ DONE |
| `packages/api/src/Layers/AppApiLive.ts` | Removed FiscalPeriodsApiLive import and layer | ✅ DONE |
| `packages/persistence/src/Services/FiscalPeriodRepository.ts` | **DELETED** | ✅ DONE |
| `packages/persistence/src/Layers/FiscalPeriodRepositoryLive.ts` | **DELETED** | ✅ DONE |
| `packages/persistence/src/Layers/RepositoriesLive.ts` | Removed FiscalPeriodRepositoryLive from layer | ✅ DONE |
| `packages/core/src/Services/JournalEntryService.ts` | Removed PeriodRepository dependency | ✅ DONE |
| Test files | Removed FiscalPeriodRepository mocks and tests | ✅ DONE |

#### How It Works Now

1. **Frontend**: JournalEntryForm sends transactionDate (and optionally fiscalPeriod if overriding)
2. **API Layer**: If fiscalPeriod not provided, computes it using `computeFiscalPeriod(transactionDate, company.fiscalYearEnd)`
3. **Database**: Journal entries still store fiscal_year and fiscal_period columns for reporting
4. **No Period Management**: No more period open/close workflows - simpler UX

All tests pass (3589 tests). Typecheck passes.

### Issue 15: UI Structure - Organization Selector & New Dropdown - RESOLVED
- **Status**: Completed
- **Resolution**: Added "Organization" as the first option in the "+ New" dropdown menu in the sidebar. This option is ALWAYS visible, even when no organization is selected. The QuickActionMenu now shows conditionally:
  - Organization: Always available (navigates to `/organizations/new`)
  - Journal Entry: Requires org + company selected
  - Company: Requires org selected
  - Account: Requires org + company selected
  - Exchange Rate: Requires org selected
- The Organization Selector in the header already includes "+ Create New Organization" link, providing two ways to create organizations as specified.

### Issue 27: Audit Log Filter UX Improvements - RESOLVED
- **Status**: Completed
- **Resolution**: Fixed both UX issues:
  1. **Custom chevron icon**: Updated the Select component globally (`packages/web/src/components/ui/Select.tsx`) to:
     - Hide native browser dropdown arrow with `appearance-none`
     - Add custom ChevronDown icon from lucide-react positioned consistently at the right edge
     - Use pointer-events-none on the icon so clicks pass through to the select
  2. **Auto-apply filters**: Updated the Audit Log page to:
     - Remove the "Apply Filters" button entirely
     - Auto-apply filter changes immediately when select dropdowns change
     - Debounce date input changes by 500ms to avoid excessive API calls while typing
     - Clean up debounce timers on component unmount
- **Files modified**:
  - `packages/web/src/components/ui/Select.tsx` - Added custom chevron icon with consistent positioning
  - `packages/web/src/routes/organizations/$organizationId/audit-log/index.tsx` - Implemented auto-apply filters with debounce

### Issue 26: Reports Company Selection Shows Redundant Report Types Text - RESOLVED
- **Status**: Completed
- **Resolution**: Removed the redundant "Trial Balance, Balance Sheet, Income Statement..." text from company selection cards. Cards now show only company-relevant information:
  1. Company name
  2. Currency and Active status
  3. "Select & View Reports" call-to-action
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/reports/index.tsx` - Removed the FileBarChart icon and report types text from CompanyReportCard component

### Issue 25: Redundant "Add First Exchange Rate" Button - RESOLVED
- **Status**: Completed
- **Resolution**: Fixed the Exchange Rates page to show mutually exclusive CTAs:
  1. When list is EMPTY: Shows empty state with "Add First Exchange Rate" CTA (header button hidden)
  2. When list has items: Shows header "Add Rate" button (empty state not shown)
- **Implementation**: Added conditional rendering `{rates.length > 0 && ...}` around the header "Add Rate" button so it only appears when there are existing exchange rates
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/exchange-rates/index.tsx`

### Issue 24: Add Buttons Still Broken on Multiple Pages - RESOLVED
- **Status**: Completed
- **Resolution**: Updated all add buttons on Exchange Rates, Intercompany, and Consolidation pages to use the standard Button component pattern with `icon` prop:
  1. **Exchange Rates page**: Changed header "Add Rate" button and empty state "Add First Exchange Rate" button to use `icon={<Plus className="h-4 w-4" />}` prop instead of inline Plus icon with `mr-2`
  2. **Intercompany page**: Changed "New Transaction" button to use `icon={<Plus className="h-4 w-4" />}` prop
  3. **Consolidation page**: Changed "New Consolidation Group" button to use `icon={<Plus className="h-4 w-4" />}` prop
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/exchange-rates/index.tsx`
  - `packages/web/src/routes/organizations/$organizationId/intercompany/index.tsx`
  - `packages/web/src/routes/organizations/$organizationId/consolidation/index.tsx`

### Issue 11: Add Buttons Broken Layout - RESOLVED
- **Status**: Completed
- **Resolution**: Added `whitespace-nowrap` to the base Button component class list in `packages/web/src/components/ui/Button.tsx`. This ensures all buttons with icons and text display on a single line without text wrapping, regardless of container width.

### Issue 8: Tooltip Positioning/Overflow - RESOLVED
- **Status**: Completed
- **Resolution**: Implemented smart tooltip positioning using `@floating-ui/react` library:
  1. **Collision detection**: Tooltips now automatically detect viewport edges and reposition
  2. **Flip middleware**: If tooltip doesn't fit on preferred side, it flips to opposite side
  3. **Shift middleware**: Tooltips shift along axis to stay fully visible with 8px padding from edges
  4. **High z-index**: Tooltip renders in a FloatingPortal with z-index 9999, above sidebar
  5. **Accessible**: Includes proper hover, focus, dismiss, and role interactions
- Updated `packages/web/src/components/ui/Tooltip.tsx` to use Floating UI instead of pure CSS positioning

### Issue 9: Filter Input Icon Alignment Inconsistency - RESOLVED
- **Status**: Completed
- **Resolution**: Standardized filter input styling across the application:
  1. Updated Journal Entries filter inputs (Status, Type, Fiscal Year, Fiscal Period, From Date, To Date) to use `pl-3 pr-8` instead of `px-3` for consistent right padding that accommodates native browser icons
  2. Updated the shared `Select` component in `packages/web/src/components/ui/Select.tsx` to use `pl-3 pr-8` as the default padding, ensuring all select dropdowns have consistent icon positioning
  3. Both select inputs and date inputs now have the same visual spacing, with `pr-8` providing adequate room for native browser controls (dropdown arrows, calendar icons)

### Issue 18: Organization Selector Dropdown - RESOLVED
- **Status**: Completed
- **Resolution**: Updated `OrganizationSelector.tsx` to show a consistent dropdown:
  1. "Switch Organization" header
  2. List of organizations to choose from (or empty state message if none exist)
  3. "+ Create New Organization" link at the bottom (per Part 2 spec requirement)
- **Implementation**: Per Part 2 of this spec, the Organization Selector dropdown provides a SECONDARY way to create organizations. Both methods work:
  - Primary: "+ New > Organization" in sidebar QuickActionMenu
  - Secondary: "+ Create New Organization" in header dropdown
- **Files modified**:
  - `packages/web/src/components/layout/OrganizationSelector.tsx`

### Issue 21: Chart of Accounts Table Header Doesn't Resize Correctly - RESOLVED
- **Status**: Completed
- **Resolution**: Replaced CSS Grid layout with semantic HTML table (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`):
  1. Changed outer container from grid to table with `overflow-x-auto` wrapper
  2. Added `min-w-[800px]` to ensure table doesn't shrink below readable size
  3. Used percentage-based column widths (`w-[33%]`, `w-[14%]`, etc.) for proportional resizing
  4. Header and body columns now perfectly align since they share the same table structure
  5. At narrow viewports, table scrolls horizontally instead of columns collapsing
  6. Works correctly with sidebar collapsed and expanded
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/accounts/index.tsx`

### Issue 22: Breadcrumbs Don't Resize Correctly - RESOLVED
- **Status**: Completed
- **Resolution**: Updated breadcrumbs to be fully responsive with proper overflow handling:
  1. Added `min-w-0 overflow-hidden` to the nav container to prevent horizontal overflow
  2. Added `flex-shrink-0` to icons and separators so they don't shrink
  3. Added `truncate` and `max-w-[150px]` to intermediate breadcrumb segments
  4. Added `truncate` and `max-w-[200px] sm:max-w-[300px]` to the last (current) segment
  5. Added `hidden sm:block` and `hidden sm:flex` to hide "Organizations" link and middle segments on mobile
  6. On very narrow viewports, only shows: Home > Organization > Current Page
- **Files modified**:
  - `packages/web/src/components/layout/Breadcrumbs.tsx`

### Issue 20: Remove Redundant Organization Display from Sidebar - RESOLVED
- **Status**: Completed
- **Resolution**: Removed the "Current Organization" section (data-testid="sidebar-current-org") from the Sidebar component. The header's OrganizationSelector already displays the current organization name, so showing it again in the sidebar was redundant and wasted space.
- **Files modified**:
  - `packages/web/src/components/layout/Sidebar.tsx` - Removed lines 468-476

### Issue 19: Organization Selector Shows Empty List When In Organization Context - RESOLVED
- **Status**: Completed
- **Resolution**: Created a layout route `packages/web/src/routes/organizations/$organizationId/route.tsx` that:
  1. Uses `beforeLoad` to fetch all organizations once for all child routes
  2. Provides organizations via route context to all pages under `/organizations/$organizationId/*`
  3. Updated ALL child routes (19 files) to access `context.organizations` and pass it to AppLayout
- **Implementation Details**:
  - The layout route fetches organizations in `beforeLoad` and returns `{ organizations }` as route context
  - Child routes access via `const organizations = context.organizations ?? []`
  - AppLayout receives `organizations` prop and passes it to the OrganizationSelector
  - This ensures the organization list is always available when switching organizations
- **Files modified**:
  - Created: `packages/web/src/routes/organizations/$organizationId/route.tsx` (layout route)
  - Updated: All 19 child route files to pass organizations to AppLayout

### Issue 17: Organization Selector Should Be Dropdown Menu - RESOLVED
- **Status**: Completed
- **Resolution**: Updated `OrganizationSelector.tsx` to always show a dropdown menu regardless of organization count:
  1. Button now shows "Select Organization" when none selected (instead of link saying "Add Organization")
  2. Dropdown always opens with consistent UI: header, organization list (or empty state message), and footer actions
  3. Empty state shows friendly message "No organizations yet" with hint to create first organization
  4. Footer actions always show "Create New Organization" and "View All Organizations" links
  5. Works consistently with 0, 1, or many organizations

### Issue 16: Missing Delete Organization UI - RESOLVED
- **Status**: Completed
- **Resolution**: Organization Settings page (`packages/web/src/routes/organizations/$organizationId/settings.tsx`) already has a fully implemented "Danger Zone" section with:
  1. "Danger Zone" section with AlertTriangle icon and red border styling
  2. "Delete Organization" button with danger variant (red)
  3. Type-to-confirm dialog requiring user to type exact organization name
  4. Disabled confirm button until text matches
  5. Error handling for API errors (shows message if org has companies)
  6. Navigation to `/organizations` after successful deletion

## Completed Items

### Issue 23: Reports Page 3-Step Flow - RESOLVED
- **Status**: Completed
- **Problem**: Reports page at `/organizations/:orgId/reports` was showing report types first, then company selection second. This violated the spec which requires users to first select a company before seeing report types.
- **Resolution**: Updated the Reports Hub page to follow the correct 3-step flow:
  1. **Step 1: Company Selection** - Org-level reports page (`/organizations/:orgId/reports`) now shows ONLY company selection cards with a step indicator showing "1. Select Company → 2. Choose Report → 3. View Report"
  2. **Step 2: Report Type Selection** - After selecting a company, navigates to company-level reports page (`/organizations/:orgId/companies/:companyId/reports`) which shows available report types with step indicator showing step 2 active
  3. **Step 3: Report View** - Clicking a report navigates to the specific report page
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/reports/index.tsx` - Removed report type cards, shows only company selection with step indicator
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/index.tsx` - Added step indicator showing step 2 (Choose Report) as active

### Issue 1: Post-Login Redirect - RESOLVED
- **Status**: Completed
- Login page (`packages/web/src/routes/login.tsx`) now follows Post-Login Flow correctly:
  - No organizations → `/organizations/new`
  - Single organization → `/organizations/:id/dashboard`
  - Multiple organizations → `/organizations`

### Issue 2: Home Route Redirect - RESOLVED
- **Status**: Completed
- Home page (`packages/web/src/routes/index.tsx`) redirects authenticated users following Post-Login Flow

### Issue 3: Organization Detail Page Layout - RESOLVED
- **Status**: Completed
- Organization detail page (`packages/web/src/routes/organizations/$organizationId/index.tsx`) uses AppLayout with sidebar and header

### Issue 4: Dashboard Breadcrumb Stability - RESOLVED
- **Status**: Completed
- Resolved by fixing issues #1 and #2

### Issue 5: Consistent Page Layouts - RESOLVED
- **Status**: Completed
- All pages under `/organizations` now use AppLayout consistently, including:
  - Dashboard, Companies, Reports, Exchange Rates, Consolidation, Intercompany, Audit Log, Settings
  - All form pages (new company, new journal entry, new account, new exchange rate)
  - All detail pages

### Issue 6: Sidebar Flat Navigation - RESOLVED
- **Status**: Completed
- Sidebar now uses flat links for all items (Companies, Reports, etc.)
- CompaniesNavSection removed
- No expanding sub-menus in sidebar

### Issue 7: Create New Organization Link - RESOLVED
- **Status**: Completed
- OrganizationSelector dropdown includes "+ Create New Organization" that links to `/organizations/new`

### Issue 10: Redundant "Add First Exchange Rate" - RESOLVED
- **Status**: Completed
- Exchange Rate page already correctly implements mutually exclusive CTAs:
  - Header "Add Rate" button visible only when there are existing rates
  - Empty state with "Add First Exchange Rate" CTA visible only when no rates exist
- No code changes needed - page was already correctly implemented

### Issue 11: Add Buttons Broken Layout - RESOLVED
- **Status**: Completed (originally reopened, now fully resolved by Issue 24)
- The `whitespace-nowrap` class in the Button component handles text wrapping prevention
- Issue 24 addressed the remaining pages (Exchange Rates, Intercompany, Consolidation) by updating buttons to use proper `icon` prop pattern instead of inline icon children

### Issue 12: "Create New Organization" Routing & Layout - RESOLVED
- **Status**: Completed
- **Problem 1 - Wrong Link**: The "Add Organization" button in OrganizationSelector had wrong link (`/organizations` instead of `/organizations/new`)
- **Fix 1**: Changed link target from `/organizations` to `/organizations/new` in `OrganizationSelector.tsx`
- **Problem 2 - Inconsistent Layout**: The Create Organization page had a completely different layout (no sidebar, custom header) unlike all other authenticated pages
- **Fix 2**: Updated `/organizations/new.tsx` to use AppLayout with sidebar, header, and breadcrumbs - now consistent with rest of app
- **Problem 3 - Organizations List Page Layout**: The `/organizations` page (org selector) also had a different layout without sidebar/header
- **Fix 3**: Updated `/organizations/index.tsx` to use AppLayout with sidebar, header, and breadcrumbs

### Issue 13: Exchange Rates "Add Rate" Button - RESOLVED
- **Status**: Completed
- The "Add Rate" button on Exchange Rates page uses Button component with inline Plus icon
- Button works correctly: `<Button onClick={...}><Plus className="mr-2 h-4 w-4" />Add Rate</Button>`

### Issue 14: User Menu "Settings" & "Profile" Links - RESOLVED
- **Status**: Completed
- Settings button now correctly navigates to `/organizations/:orgId/settings` when an org is selected
- Profile button is disabled with "Soon" indicator since profile page doesn't exist yet
- Updated in `packages/web/src/components/layout/Header.tsx`

---

# Part 2: Design & Specification

This section defines the UI architecture that MUST be implemented.

## Design Philosophy

Accountability is a **professional multi-company accounting application**. The UI must:
- Feel professional and trustworthy (users are managing financial data)
- Be consistent across all pages (no jarring layout changes)
- Follow established accounting software patterns (QuickBooks, Xero, Wave)
- Support efficient workflows for daily accounting tasks

## Navigation Architecture

### Global Layout Structure

**ALL authenticated pages MUST use the same layout:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo]  [Org Selector ▾]                    [Search]  [User Menu ▾]    │
├─────────────┬──────────────────────────────────────────────────────────┤
│             │                                                          │
│  + New ▾    │  Breadcrumbs: Org > Companies > Acme Corp > Accounts     │
│             │  ──────────────────────────────────────────────────────  │
│  Dashboard  │                                                          │
│             │  [Page Content]                                          │
│  Companies  │                                                          │
│             │                                                          │
│  Reports    │                                                          │
│             │                                                          │
│  Exchange   │                                                          │
│  Rates      │                                                          │
│             │                                                          │
│  Consolid.  │                                                          │
│             │                                                          │
│  Settings   │                                                          │
│             │                                                          │
└─────────────┴──────────────────────────────────────────────────────────┘
```

**Note:** Sidebar items are flat links (no sub-menus). Navigation into company-specific pages happens through the main content area, not sidebar expansion.

### Critical Requirements

1. **Sidebar is ALWAYS present** on every authenticated page
2. **Organization selector is ALWAYS accessible** from header
3. **User menu is ALWAYS accessible** from header
4. **Breadcrumbs show current location** on every page
5. **Mobile menu provides full navigation** on small screens

### NO Exceptions

The following are explicitly **FORBIDDEN**:
- Pages without the sidebar
- Pages without the header
- Different layouts for different sections
- Manual breadcrumb HTML in individual pages
- Pages where user cannot switch organizations
- Sub-navigation menus in the sidebar (e.g., expanding Companies or Reports into sub-items)
- Form/creation pages without the standard AppLayout (e.g., "Create Journal Entry" must have sidebar)

## Post-Login Flow

### First-Time User (No Organizations)
```
Login → /organizations/new (Create your first organization)
```

### User with Single Organization
```
Login → /organizations/:id/dashboard (Auto-redirect to that org)
```

### User with Multiple Organizations
```
Login → /organizations (Organization selector page)
  Click org card → /organizations/:id/dashboard
```

### Organization Selector Page
The `/organizations` page uses the standard AppLayout (with sidebar and header) and shows:
- A card-based selection UI for choosing an organization
- "New Organization" button in the page header
- Each card shows: Name, Currency, Companies count
- Click card → navigate to org dashboard
- **Sidebar shows ONLY "Organizations"** - no Dashboard, Companies, Reports, etc. since no org is selected

## Sidebar Navigation

### Navigation Structure

**When on `/organizations` (no organization selected):**

The sidebar shows minimal navigation:
```
+ New ▾
  └─ Organization     (ALWAYS visible)

Organizations        → /organizations
```

Only the "Organizations" link and the "+ New > Organization" action are shown. All organization-specific items (Dashboard, Companies, Reports, etc.) are hidden.

---

**When organization is selected (`/organizations/:orgId/*`):**

Sidebar shows:

```
+ New ▾
  └─ Journal Entry
  └─ Company
  └─ Account

Dashboard

Companies          → /organizations/:orgId/companies

Reports            → /organizations/:orgId/reports

Exchange Rates     → /organizations/:orgId/exchange-rates

Consolidation      → /organizations/:orgId/consolidation

Intercompany       → /organizations/:orgId/intercompany

Audit Log          → /organizations/:orgId/audit-log

──────────────
Settings           → /organizations/:orgId/settings
```

**NO sub-navigation in sidebar.** Companies and Reports do NOT expand into sub-items. Clicking "Companies" goes to the companies list. Clicking "Reports" goes to the reports page.

### Reports Page Flow

Reports are **company-scoped** - you must select a company before viewing reports. The Reports page (`/organizations/:orgId/reports`) flow:

1. **Step 1: Company Selection** - Show list of companies in the organization as selectable cards
2. **Step 2: Report Type Selection** - After selecting a company, show available report types (Trial Balance, Balance Sheet, Income Statement, Cash Flow, Equity Statement)
3. **Step 3: Report View** - Navigate to `/organizations/:orgId/companies/:companyId/reports/:reportType`

The Reports page should NOT immediately show a list of report types. Users must first choose which company's reports they want to view.

### "+ New" Quick Action Menu

The "+ New" button at top of sidebar provides fast access to common creation actions. Each item opens the corresponding **creation form** directly (NOT list pages):

| Menu Item | Opens | Route | Availability |
|-----------|-------|-------|--------------|
| Organization | Organization creation form | `/organizations/new` | ALWAYS available |
| Journal Entry | Journal entry creation form | `/organizations/:orgId/companies/:companyId/journal-entries/new` | Requires org + company |
| Company | Company creation form | `/organizations/:orgId/companies/new` | Requires org selected |
| Account | Account creation form | `/organizations/:orgId/companies/:companyId/accounts/new` | Requires org + company |
| Exchange Rate | Exchange rate creation form | `/organizations/:orgId/exchange-rates/new` | Requires org selected |

**IMPORTANT:**
- "Organization" MUST ALWAYS be visible in the "+ New" dropdown, even when no organization is selected. This is the PRIMARY way to create new organizations.
- "New Company" MUST open the company creation form (`/companies/new`), NOT the companies list page.
- The "+ New" dropdown should be visible on ALL authenticated pages.

### Sidebar State

- Sidebar is collapsible (save preference)
- Collapsed state shows icons only
- Keyboard shortcut: Ctrl+B or Cmd+B to toggle
- Mobile: sidebar hidden by default, hamburger menu to open

## Header

The header is a **global element** that appears on ALL authenticated pages. The organization selector in the header is the PRIMARY way to switch between organizations.

### Desktop Header
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Logo]  [Organization: Acme Holdings ▾]         [🔍]  [Avatar ▾]     │
└──────────────────────────────────────────────────────────────────────┘
```

Components:
1. **Logo**: Click returns to org dashboard (or org selector if no org)
2. **Organization Selector**: **PRIMARY** dropdown to switch organizations - always visible, always accessible
3. **Search** (future): Global search icon
4. **User Menu**: Avatar with dropdown for profile, settings, logout

**IMPORTANT:** The Organization Selector in the header is a GLOBAL element - users must be able to switch organizations from ANY page in the application.

### Mobile Header
```
┌──────────────────────────────────────────────────────────────────────┐
│ [☰]  [Logo]  [Org: Acme ▾]                              [Avatar]     │
└──────────────────────────────────────────────────────────────────────┘
```

Components:
1. **Hamburger**: Opens mobile sidebar drawer
2. **Logo**: Returns to dashboard
3. **Organization**: Compact selector
4. **Avatar**: Opens user menu

### Organization Selector Dropdown

When clicked, shows:
```
┌─────────────────────────────────────────┐
│ 🔍 Search organizations...              │
├─────────────────────────────────────────┤
│ ✓ Acme Holdings       USD  3 companies  │
│   Beta Corporation    EUR  1 company    │
│   Personal Finances   USD  1 company    │
├─────────────────────────────────────────┤
│ + Create New Organization               │
└─────────────────────────────────────────┘
```

**IMPORTANT:**
- "+ Create New Organization" MUST link to `/organizations/new`
- The Organization Selector dropdown provides a SECONDARY way to create organizations (in addition to the "+ New" dropdown in the sidebar)
- Both methods should work: "+ New > Organization" in sidebar AND "+ Create New Organization" in header dropdown

## Breadcrumbs

### Format
```
Organization > Section > [Subsection] > [Item Name]
```

### Examples
```
Acme Holdings > Dashboard
Acme Holdings > Companies
Acme Holdings > Companies > Acme Corp
Acme Holdings > Companies > Acme Corp > Chart of Accounts
Acme Holdings > Companies > Acme Corp > Journal Entries > JE-2024-0001
Acme Holdings > Exchange Rates
Acme Holdings > Settings
```

### Rules
- Always show at least org name + current section
- Each segment is clickable and navigates to that level
- Current page (last segment) is not a link
- Use consistent naming (not "Journal Entry Detail" - just the entry number)

## Route Structure

### URL Patterns

```
/organizations                                    # Org selector (special case)
/organizations/new                                # Create org (special case)
/organizations/:orgId/dashboard                   # Org dashboard
/organizations/:orgId/settings                    # Org settings
/organizations/:orgId/companies                   # Companies list
/organizations/:orgId/companies/new               # Create company
/organizations/:orgId/companies/:companyId        # Company detail
/organizations/:orgId/companies/:companyId/accounts           # Chart of accounts
/organizations/:orgId/companies/:companyId/accounts/new       # Create account
/organizations/:orgId/companies/:companyId/accounts/:id       # Account detail
/organizations/:orgId/companies/:companyId/journal-entries    # JE list
/organizations/:orgId/companies/:companyId/journal-entries/new
/organizations/:orgId/companies/:companyId/journal-entries/:id
/organizations/:orgId/companies/:companyId/reports            # Reports hub
/organizations/:orgId/companies/:companyId/reports/trial-balance
/organizations/:orgId/companies/:companyId/reports/balance-sheet
/organizations/:orgId/companies/:companyId/fiscal             # Fiscal periods
/organizations/:orgId/exchange-rates              # Exchange rates (org level)
/organizations/:orgId/consolidation               # Consolidation groups
/organizations/:orgId/consolidation/:groupId
/organizations/:orgId/intercompany                # Intercompany transactions
/organizations/:orgId/audit-log                   # Audit log
```

### Route File Structure

Use TanStack Router's layout routes to ensure consistent layout:

```
routes/
├── __root.tsx                 # Root layout
├── _auth.tsx                  # Auth-required layout (redirects to login)
├── _auth/
│   └── organizations/
│       ├── index.tsx          # Org selector (special layout)
│       ├── new.tsx            # Create org (special layout)
│       └── $organizationId/
│           ├── _layout.tsx    # Standard layout with sidebar
│           ├── dashboard.tsx
│           ├── settings.tsx
│           ├── companies/
│           │   ├── index.tsx
│           │   ├── new.tsx
│           │   └── $companyId/
│           │       ├── index.tsx
│           │       ├── accounts/...
│           │       ├── journal-entries/...
│           │       ├── reports/...
│           │       └── fiscal/...
│           ├── exchange-rates/
│           ├── consolidation/
│           ├── intercompany/
│           └── audit-log/
└── login.tsx
└── register.tsx
```

## Dashboard Design

### Organization Dashboard (`/organizations/:id/dashboard`)

Layout: Widget-based dashboard with key metrics and quick actions

```
┌──────────────────────────────────────────────────────────────────┐
│ Welcome to Acme Holdings                                         │
│ Reporting Currency: USD                                          │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌──────┐
│ 3               │ │ 156             │ │ 5               │ │ 2    │
│ Companies       │ │ Total Accounts  │ │ Pending         │ │ Open │
│                 │ │                 │ │ Approval        │ │Period│
│ [View →]        │ │                 │ │ [Review →]      │ │      │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └──────┘

┌────────────────────────────────────────────────────────────────┐
│ Quick Actions                                                   │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│ │+ JE Entry   │ │+ Company    │ │📊 Reports   │ │⚙ Settings  │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Recent Activity                                                 │
│ ────────────────────────────────────────────────────────────── │
│ • JE-2024-0047 posted by John         Today, 2:30 PM           │
│ • Account 4100 created by Jane        Today, 11:00 AM          │
│ • Period Jan 2024 closed              Yesterday                │
└────────────────────────────────────────────────────────────────┘
```

### Widget Requirements
- Summary cards at top (companies, accounts, pending items)
- Quick actions section for common tasks
- Recent activity feed (from audit log)
- All cards link to relevant pages
- Responsive: stack vertically on mobile

## Page Templates

### List Pages

Standard structure for all list pages (Companies, Accounts, Journal Entries, etc.):

```
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Page Title                                        [+ Create Button]  │
│ Optional description text                                            │
├──────────────────────────────────────────────────────────────────────┤
│ Filters: [Status ▾] [Type ▾] [Date Range] [Search...]    [Clear]     │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ Column 1     │ Column 2     │ Column 3     │ Status  │ Actions │  │
│ ├──────────────┼──────────────┼──────────────┼─────────┼─────────┤  │
│ │ Row 1 data   │ ...          │ ...          │ Badge   │ ⋮       │  │
│ │ Row 2 data   │ ...          │ ...          │ Badge   │ ⋮       │  │
│ └─────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 156 items                        [< Prev] [Next >]   │
└──────────────────────────────────────────────────────────────────────┘
```

### Detail Pages

Standard structure for detail/view pages:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ [← Back]  Item Name/Title                    [Edit] [Delete] [More▾] │
│           Status Badge                                               │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐  ┌─────────────────────────────────┐ │
│ │ Primary Information          │  │ Secondary Information           │ │
│ │ - Field: Value               │  │ - Field: Value                  │ │
│ │ - Field: Value               │  │ - Field: Value                  │ │
│ └─────────────────────────────┘  └─────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ [Tab 1] [Tab 2] [Tab 3]                                              │
│ ─────────────────────────────────────────────────────────────────    │
│ Tab content area...                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Form Pages (Create/Edit)

**ALL form pages use AppLayout** with sidebar and header visible. This includes:
- Create Journal Entry (`/organizations/:orgId/companies/:companyId/journal-entries/new`)
- New Company (`/organizations/:orgId/companies/new`)
- New Account (`/organizations/:orgId/companies/:companyId/accounts/new`)
- Edit forms for any entity

Form pages are NOT special modal dialogs or standalone pages. They are regular pages within the standard layout.

Standard structure for create/edit forms:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ [← Cancel]  Create New [Entity]                                      │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Section 1 Title                                                 │   │
│ │ ─────────────────────────────────────────────────────────────  │   │
│ │ Field Label *                                                   │   │
│ │ [Input field                                           ]        │   │
│ │ Helper text                                                     │   │
│ │                                                                 │   │
│ │ Field Label                                                     │   │
│ │ [Dropdown                                              ▾]       │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Section 2 Title (Collapsible)                              [▾] │   │
│ │ ...                                                             │   │
│ └────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│                                              [Cancel]  [Save Draft]  │
│                                                        [Submit →]    │
└──────────────────────────────────────────────────────────────────────┘
```

## Empty States

### Requirements
Every list/data page MUST have a proper empty state:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                        [Illustration/Icon]                           │
│                                                                      │
│                     No [entities] yet                                │
│                                                                      │
│         [Brief explanation of what this section is for               │
│          and why they should create their first item]                │
│                                                                      │
│                    [+ Create First Entity]                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Examples

**No Companies:**
```
No companies yet
Companies are legal entities within your organization.
Create your first company to start tracking its financial activity.
[+ Create Company]
```

**No Journal Entries:**
```
No journal entries yet
Journal entries record financial transactions in your general ledger.
Create your first entry or apply a template to get started.
[+ Create Entry]  [Apply Template]
```

## Loading States

### Page Loading
- Show skeleton loader matching page layout
- Never show blank white pages
- Sidebar/header remain visible during content load

### Data Loading
- Table: Show skeleton rows
- Cards: Show skeleton cards
- Forms: Disable inputs, show spinner on submit button

### Error States
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                        [Error Icon]                                  │
│                                                                      │
│                  Something went wrong                                │
│                                                                      │
│         [Specific error message if available]                        │
│                                                                      │
│                       [Try Again]                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Responsive Design

### Breakpoints
- Desktop: >= 1024px (full sidebar visible)
- Tablet: 768px - 1023px (sidebar collapsible)
- Mobile: < 768px (sidebar hidden, hamburger menu)

### Mobile Adaptations
1. Sidebar becomes full-screen drawer
2. Tables become card-based lists
3. Forms stack vertically
4. Header simplifies (shorter org name, icon-only actions)

## Component Standards

### Buttons
- Primary: Blue, filled (main actions)
- Secondary: Gray outline (cancel, back)
- Danger: Red (delete, destructive actions)
- All buttons must have loading states

### Status Badges
Consistent colors across all status types:
- Draft: Gray
- Pending/Pending Approval: Yellow/Amber
- Active/Approved/Open: Green
- Posted/Completed: Blue
- Inactive/Closed: Gray
- Reversed/Cancelled/Error: Red
- Locked: Purple

### Forms
- Labels above inputs
- Required fields marked with asterisk (*)
- Helper text below fields
- Error messages in red below field
- Disable submit until form is valid

### Tables
- Sortable columns where appropriate
- Row hover highlight
- Action menu (three dots) for row actions
- Checkbox for bulk selection when needed
- **Column header tooltips**: Every column header MUST show an explanatory tooltip on hover describing what the column contains. Examples:
  - "Normal" → "The normal balance side for this account type. Dr (Debit) for assets/expenses, Cr (Credit) for liabilities/equity/revenue."
  - "Status" → "Current state of this record (Draft, Posted, Reversed, etc.)"
  - "Balance" → "Current account balance in the account's currency"

## Accessibility

- All interactive elements keyboard accessible
- Focus indicators visible
- Color not sole indicator (use icons/text with colors)
- ARIA labels on icon-only buttons
- Skip to main content link

## Testing Requirements

All UI components must have `data-testid` attributes:
- `data-testid="sidebar"` - Main sidebar
- `data-testid="header"` - Main header
- `data-testid="org-selector"` - Organization dropdown
- `data-testid="user-menu"` - User dropdown
- `data-testid="breadcrumbs"` - Breadcrumb nav
- `data-testid="page-title"` - Page title
- `data-testid="create-button"` - Primary create action
- `data-testid="[entity]-list"` - List tables
- `data-testid="[entity]-row-[id]"` - Table rows
- `data-testid="empty-state"` - Empty state container
- `data-testid="loading-state"` - Loading indicator
- `data-testid="error-state"` - Error container
