# Consolidated Financial Reports Spec

## Overview

Implement standard financial reports for consolidation runs, transforming the consolidated trial balance into proper financial statement formats per GAAP presentation requirements.

## Current State

### ✅ ALL PHASES COMPLETE (2026-01-16)

**Phase 1 (Backend API) ✅ COMPLETE:**
- `ConsolidatedReportService` implemented in `packages/core/src/Services/ConsolidatedReportService.ts`
- Four report generation methods: `generateBalanceSheet()`, `generateIncomeStatement()`, `generateCashFlow()`, `generateEquityStatement()`
- API endpoints in `ConsolidationApiLive.ts` call the service methods
- `accountCategory` field added to `ConsolidatedTrialBalanceLineItem` for proper report section grouping

**Phase 2 (Frontend Routes) ✅ COMPLETE:**
- Reports hub page (`/consolidation/:groupId/runs/:runId/reports/`)
- Consolidated Balance Sheet (`/consolidation/:groupId/runs/:runId/reports/balance-sheet`)
- Consolidated Income Statement (`/consolidation/:groupId/runs/:runId/reports/income-statement`)
- Consolidated Cash Flow Statement (`/consolidation/:groupId/runs/:runId/reports/cash-flow`)
- Consolidated Statement of Changes in Equity (`/consolidation/:groupId/runs/:runId/reports/equity-statement`)
- "View Reports" navigation button on run detail page (visible when run is Completed)

**Phase 3 (Export & Print) ✅ COMPLETE:**
- PDF export via `jspdf` + `jspdf-autotable`
- Excel export via `xlsx` library
- Print styling via browser print dialog (`window.print()`)
- Export utilities in `packages/web/src/utils/report-export.ts`
- All 5 report pages have Print, Excel, PDF export buttons

**Also Implemented:**
- Consolidated Trial Balance (displayed on run detail page)
- Individual company reports: Balance Sheet, Income Statement, Cash Flow, Equity Statement

---

## Domain Model Analysis

This section documents how consolidated reports can be generated based on the existing domain model.

### What Already Exists

The consolidation pipeline already performs all the heavy lifting. After a `ConsolidationRun` completes, the `ConsolidatedTrialBalance` contains fully processed data:

| Domain Entity | Location | Purpose |
|---------------|----------|---------|
| `ConsolidationGroup` | `packages/core/src/Domains/ConsolidationGroup.ts` | Parent + member companies, ownership %, consolidation methods |
| `ConsolidationRun` | `packages/core/src/Domains/ConsolidationRun.ts` | 7-step pipeline execution, stores final trial balance |
| `ConsolidatedTrialBalance` | `packages/core/src/Domains/ConsolidationRun.ts` | Line items with aggregated, elimination, NCI, and final balances |
| `EliminationRule` | `packages/core/src/Domains/EliminationRule.ts` | 6 elimination types per ASC 810 |
| `BalanceSheetService` | `packages/core/src/Services/BalanceSheetService.ts` | Single-company balance sheet (pattern to follow) |

### The 7-Step Consolidation Pipeline

The `ConsolidationRun` executes these steps in order:

```
1. Validate    → Ensures all members have closed periods, balanced trial balances
2. Translate   → Converts each member's balances to reporting currency (ASC 830)
3. Aggregate   → Sums all member account balances
4. MatchIC     → Identifies intercompany transactions for elimination
5. Eliminate   → Applies elimination rules (AR/AP, revenue/expense, investments, etc.)
6. NCI         → Calculates non-controlling interest share
7. GenerateTB  → Produces final ConsolidatedTrialBalance
```

### ConsolidatedTrialBalanceLineItem Structure

Each line item in the consolidated trial balance contains:

```typescript
ConsolidatedTrialBalanceLineItem {
  accountNumber: string
  accountName: string
  accountType: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
  accountCategory: AccountCategory     // ✅ ADDED 2026-01-16: Detailed subcategory for report sections
  aggregatedBalance: MonetaryAmount    // Sum of all members (after translation)
  eliminationAmount: MonetaryAmount    // Intercompany eliminations applied
  nciAmount: Option<MonetaryAmount>    // Non-controlling interest portion
  consolidatedBalance: MonetaryAmount  // Final = aggregated - eliminations
}
```

### Data Flow: Trial Balance → Balance Sheet

```
ConsolidationRun (status: "Completed")
        │
        ▼
ConsolidatedTrialBalance.lineItems
        │
        │  Filter by accountType + accountCategory
        │
        ├─► "Asset" lines ────────► Current Assets + Non-Current Assets
        │                           ✅ UNBLOCKED: accountCategory distinguishes CurrentAsset, NonCurrentAsset, etc.
        │
        ├─► "Liability" lines ────► Current Liabilities + Non-Current Liabilities
        │                           ✅ UNBLOCKED: accountCategory distinguishes CurrentLiability, NonCurrentLiability
        │
        └─► "Equity" lines ───────► Parent Equity sections
                │                   ✅ UNBLOCKED: accountCategory distinguishes ContributedCapital, RetainedEarnings, etc.
                └─► nciAmount fields ──► Non-Controlling Interest (separate line per ASC 810)
        │
        ▼
ConsolidatedBalanceSheetReport
        │
        └─► Validate: Total Assets === Total Liabilities + Total Equity
```

### ~~The Blocking Issue: Account Classification~~ ✅ RESOLVED 2026-01-16

**Resolution:** Added `accountCategory` field to `ConsolidatedTrialBalanceLineItem` and updated the consolidation pipeline to propagate the category from source accounts during aggregation.

**Changes made:**
1. Added `accountCategory: AccountCategory` to `ConsolidatedTrialBalanceLineItem` schema in `packages/core/src/Domains/ConsolidationRun.ts`
2. Added `accountCategory` to `AggregatedBalance` in `ConsolidationService.ts` to propagate during aggregation
3. Updated `executeAggregateStep` to copy `accountCategory` from trial balance line items
4. Updated `GenerateTB` step to populate `accountCategory` in final line items
5. Added backward compatibility handling in persistence layer for data stored before this field was added
6. Updated all tests to include `accountCategory` in test fixtures

**Original issue description (for reference):**

~~**Verified in code (2025-01-16):**~~

~~The `Account` domain model **HAS** `accountCategory`, but `ConsolidatedTrialBalanceLineItem` **does NOT** include it.~~

#### What `Account` has (packages/core/src/Domains/Account.ts, line 308):

```typescript
export class Account extends Schema.Class<Account>("Account")({
  // ...
  accountType: AccountType,        // ← "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
  accountCategory: AccountCategory, // ← DETAILED CLASSIFICATION EXISTS HERE
  // ...
})
```

The `AccountCategory` type (lines 95-123) includes:
```typescript
AccountCategory =
  // Assets
  | "CurrentAsset" | "NonCurrentAsset" | "FixedAsset" | "IntangibleAsset"
  // Liabilities
  | "CurrentLiability" | "NonCurrentLiability"
  // Equity
  | "ContributedCapital" | "RetainedEarnings" | "OtherComprehensiveIncome" | "TreasuryStock"
  // Revenue
  | "OperatingRevenue" | "OtherRevenue"
  // Expenses
  | "CostOfGoodsSold" | "OperatingExpense" | "DepreciationAmortization"
  | "InterestExpense" | "TaxExpense" | "OtherExpense"
```

#### What `ConsolidatedTrialBalanceLineItem` has (packages/core/src/Domains/ConsolidationRun.ts, lines 454-505):

```typescript
export class ConsolidatedTrialBalanceLineItem extends Schema.Class<ConsolidatedTrialBalanceLineItem>(
  "ConsolidatedTrialBalanceLineItem"
)({
  accountNumber: Schema.NonEmptyTrimmedString,
  accountName: Schema.NonEmptyTrimmedString,
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"), // ← Only type, NO category
  aggregatedBalance: MonetaryAmount,
  eliminationAmount: MonetaryAmount,
  nciAmount: Schema.OptionFromNullOr(MonetaryAmount),
  consolidatedBalance: MonetaryAmount,
}) {}
```

**The Gap:** When accounts from multiple companies are aggregated during the `GenerateTB` consolidation step, the `accountCategory` information is **lost**. Only `accountType` is preserved.

**Impact:** Cannot generate proper balance sheet sections because we can't distinguish:
- Current Assets vs Non-Current Assets
- Current Liabilities vs Non-Current Liabilities
- Different equity components (Contributed Capital, Retained Earnings, AOCI, Treasury Stock)
- Revenue/Expense subtypes for income statement formatting

#### Solution Options

1. **Option A (Recommended):** Add `accountCategory` to `ConsolidatedTrialBalanceLineItem`
   - Small schema change in `ConsolidationRun.ts`
   - Update `GenerateTB` step to populate category from source accounts
   - Category should be consistent across members (same logical account)

2. **Option B:** Join with Account data during report generation
   - No schema change needed
   - But requires looking up accounts by number across all member companies
   - More complex, potential performance issues

3. **Option C:** Use account number ranges as heuristic
   - E.g., 1000-1499 = Current Assets per numbering convention
   - Fragile, not recommended

### Implementation Approach (Option A - Recommended)

**Step 1:** Add `accountCategory` to `ConsolidatedTrialBalanceLineItem` in `packages/core/src/Domains/ConsolidationRun.ts`:

```typescript
import { AccountCategory } from "./Account.ts"  // ← Import the domain type

export class ConsolidatedTrialBalanceLineItem extends Schema.Class<ConsolidatedTrialBalanceLineItem>(
  "ConsolidatedTrialBalanceLineItem"
)({
  accountNumber: Schema.NonEmptyTrimmedString,
  accountName: Schema.NonEmptyTrimmedString,
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),
  accountCategory: AccountCategory,  // ← USE AccountCategory schema, NOT Schema.String
  aggregatedBalance: MonetaryAmount,
  eliminationAmount: MonetaryAmount,
  nciAmount: Schema.OptionFromNullOr(MonetaryAmount),
  consolidatedBalance: MonetaryAmount,
}) {}
```

**IMPORTANT:** Use the `AccountCategory` schema from `Account.ts`, NOT `Schema.String`. This preserves type safety and ensures only valid categories can be assigned. See CLAUDE.md guideline #9: "ALWAYS use precise domain schemas".

**Step 2:** Update the `GenerateTB` consolidation step to populate `accountCategory` from source accounts. Location: find where `ConsolidatedTrialBalanceLineItem` instances are created (likely in `packages/core/src/Services/ConsolidationService.ts` or similar).

**Step 3:** Check if the consolidated trial balance is persisted to database (JSONB column). If so, no migration needed since JSONB is flexible. If stored in normalized tables, add column.

**Step 4:** Once `accountCategory` is available, report generation becomes straightforward grouping:

```typescript
// Balance Sheet sections
const currentAssets = lineItems.filter(l =>
  l.accountType === "Asset" && l.accountCategory === "CurrentAsset")
const nonCurrentAssets = lineItems.filter(l =>
  l.accountType === "Asset" && ["NonCurrentAsset", "FixedAsset", "IntangibleAsset"].includes(l.accountCategory))
// etc.
```

### Report Generation Service Pattern

Follow the existing `BalanceSheetService` pattern:

```typescript
// packages/core/src/Services/ConsolidatedReportService.ts

export class ConsolidatedReportService extends Context.Tag("ConsolidatedReportService")<
  ConsolidatedReportService,
  {
    readonly generateBalanceSheet: (
      runId: ConsolidationRunId
    ) => Effect.Effect<ConsolidatedBalanceSheetReport, ReportGenerationError>

    readonly generateIncomeStatement: (
      runId: ConsolidationRunId
    ) => Effect.Effect<ConsolidatedIncomeStatementReport, ReportGenerationError>

    readonly generateCashFlow: (
      runId: ConsolidationRunId,
      priorRunId: Option<ConsolidationRunId>  // Needed for period-over-period changes
    ) => Effect.Effect<ConsolidatedCashFlowReport, ReportGenerationError>

    readonly generateEquityStatement: (
      runId: ConsolidationRunId,
      priorRunId: Option<ConsolidationRunId>
    ) => Effect.Effect<ConsolidatedEquityStatementReport, ReportGenerationError>
  }
>() {}
```

### NCI Handling

The consolidated trial balance already has `nciAmount` on each line item (calculated in the NCI step). For the balance sheet:

- Sum all `nciAmount` values from equity line items
- Present as a separate line in the Equity section per ASC 810
- Label: "Non-controlling interests" or "Minority interests"

For the income statement:
- Sum all `nciAmount` values from revenue/expense line items
- Present as "Net income attributable to non-controlling interests"

---

## Requirements

### 1. Consolidated Balance Sheet

**Route:** `/organizations/:orgId/consolidation/:groupId/runs/:runId/reports/balance-sheet`

**Content:**
- Assets (Current, Non-Current)
- Liabilities (Current, Non-Current)
- Equity
  - Parent company equity
  - Non-controlling interests (NCI) - separate line item per ASC 810
- Total Liabilities and Equity

**Data Source:** Consolidated trial balance lines filtered by account type (Asset, Liability, Equity)

**Special Considerations:**
- NCI must be presented as a separate component of equity (not liability)
- Elimination entries already applied in trial balance
- Show comparative periods if available (prior run)

### 2. Consolidated Income Statement

**Route:** `/organizations/:orgId/consolidation/:groupId/runs/:runId/reports/income-statement`

**Content:**
- Revenue
- Cost of Goods Sold
- Gross Profit
- Operating Expenses
- Operating Income
- Other Income/Expenses
- Income Before Tax
- Tax Expense
- Net Income
- Net Income Attributable to:
  - Parent company shareholders
  - Non-controlling interests

**Data Source:** Consolidated trial balance lines filtered by account type (Revenue, Expense)

**Special Considerations:**
- NCI share of net income must be separately disclosed
- Intercompany revenue/expenses already eliminated in trial balance

### 3. Consolidated Cash Flow Statement

**Route:** `/organizations/:orgId/consolidation/:groupId/runs/:runId/reports/cash-flow`

**Content (Indirect Method):**
- Operating Activities
  - Net income
  - Adjustments for non-cash items
  - Changes in working capital
- Investing Activities
- Financing Activities
- Net Change in Cash
- Beginning Cash
- Ending Cash

**Data Source:**
- Current period consolidated trial balance
- Prior period consolidated trial balance (for changes)
- Account metadata for classification

**Special Considerations:**
- Requires prior period data to calculate changes
- May need additional metadata on accounts for cash flow classification
- Intercompany cash flows already eliminated

### 4. Consolidated Statement of Changes in Equity

**Route:** `/organizations/:orgId/consolidation/:groupId/runs/:runId/reports/equity-statement`

**Content:**
- Beginning Balance (by equity component)
- Net Income
- Other Comprehensive Income
- Dividends
- Stock Issuances/Repurchases
- Other Changes
- Ending Balance
- Columns: Common Stock, Additional Paid-in Capital, Retained Earnings, AOCI, NCI, Total

**Data Source:**
- Equity accounts from consolidated trial balance
- Movement analysis between periods

---

## Implementation Plan

### Phase 1: Backend API ✅ COMPLETE (2026-01-16)

1. **Create report generation service** ✅
   - `ConsolidatedReportService` in `packages/core/src/Services/ConsolidatedReportService.ts`
   - Transform trial balance lines into report sections using `accountCategory`
   - Four report generation methods: `generateBalanceSheet`, `generateIncomeStatement`, `generateCashFlow`, `generateEquityStatement`

2. **Add API endpoints** ✅
   ```
   GET /api/v1/consolidation/runs/:runId/reports/balance-sheet
   GET /api/v1/consolidation/runs/:runId/reports/income-statement
   GET /api/v1/consolidation/runs/:runId/reports/cash-flow
   GET /api/v1/consolidation/runs/:runId/reports/equity-statement
   ```
   - All endpoints now call `ConsolidatedReportService` instead of returning NOT_IMPLEMENTED
   - `ConsolidationApiLive.ts` updated to wire service to endpoints

3. **Response schemas** ✅
   - Defined in `ConsolidatedReportService.ts` and `ConsolidationApi.ts`
   - Include metadata (runId, groupName, asOfDate, currency, periodRef)
   - Proper section/line item structures with subtotals

### Phase 2: Frontend Routes ✅ COMPLETE

1. **Create report routes** ✅
   ```
   packages/web/src/routes/organizations/$organizationId/
     consolidation/$groupId/runs/$runId/reports/
       index.tsx           # Report selection hub page
       balance-sheet.tsx   # Consolidated balance sheet with ASC 810 NCI presentation
       income-statement.tsx # Consolidated P&L with NCI attribution per ASC 220
       cash-flow.tsx       # Consolidated cash flow per ASC 230
       equity-statement.tsx # Statement of changes in equity with columnar layout
   ```

2. **Components used** ✅
   - AppLayout with sidebar and breadcrumbs
   - Button, Tooltip components for UI
   - Professional table display with tooltips on column headers
   - Loading states, error handling, "not implemented" messages

3. **Navigation** ✅
   - "View Reports" button on run detail page (visible when run is Completed)
   - Reports hub shows 4 report type cards
   - Each report has "Back to Reports" link and proper breadcrumbs

### Phase 3: Export & Print ✅ COMPLETE (2026-01-16)

1. **PDF export** ✅ - Generate printable PDF versions via `jspdf` + `jspdf-autotable`
2. **Excel export** ✅ - Download as spreadsheet via `xlsx` library
3. **Print styling** ✅ - Browser print dialog via `window.print()`, `.print-hide` class hides export buttons during print

**Implementation:**
- Export utilities in `packages/web/src/utils/report-export.ts`:
  - `exportToExcel()` - Table-based Excel export with metadata headers
  - `exportMultiSectionToExcel()` - Multi-section report Excel export
  - `exportToPdf()` - Table-based PDF export with autoTable formatting
  - `exportMultiSectionToPdf()` - Multi-section report PDF export
  - `printReport()` - Triggers browser print dialog
  - `formatAmount()` - Formats numbers for export
  - `generateFilename()` - Creates sanitized filenames with dates
- All consolidated report pages have Print, Excel, PDF buttons that call these utilities
- Trial balance page also has full export functionality

---

## UI Design

### Report Header
```
┌─────────────────────────────────────────────────────────────┐
│ [Group Name]                                                │
│ Consolidated Balance Sheet                                  │
│ As of December 31, 2025                                     │
│ (In thousands of USD)                                       │
├─────────────────────────────────────────────────────────────┤
│ [Export PDF] [Export Excel] [Print]                         │
└─────────────────────────────────────────────────────────────┘
```

### Report Navigation
```
┌─────────────────────────────────────────────────────────────┐
│ Consolidation Run: 2025 P12                                 │
│                                                             │
│ Reports:                                                    │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ Balance     │ │ Income      │ │ Cash Flow   │            │
│ │ Sheet       │ │ Statement   │ │ Statement   │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│ ┌─────────────┐ ┌─────────────┐                            │
│ │ Equity      │ │ Trial       │                            │
│ │ Statement   │ │ Balance     │                            │
│ └─────────────┘ └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Account Classification

Reports require accounts to be classified into sections. This can be done via:

1. **Account Type** - Already exists (Asset, Liability, Equity, Revenue, Expense)
2. **Account Subtype** - May need to add (CurrentAsset, NonCurrentAsset, etc.)
3. **Report Line Mapping** - Configuration that maps accounts to report lines

### Recommended: Add Account Subtype

```typescript
type AccountSubtype =
  // Assets
  | "CurrentAsset"
  | "NonCurrentAsset"
  | "FixedAsset"
  | "IntangibleAsset"
  // Liabilities
  | "CurrentLiability"
  | "NonCurrentLiability"
  // Equity
  | "CommonStock"
  | "RetainedEarnings"
  | "AOCI"
  | "NCI"
  // Revenue
  | "OperatingRevenue"
  | "OtherIncome"
  // Expenses
  | "CostOfSales"
  | "OperatingExpense"
  | "InterestExpense"
  | "TaxExpense"
```

---

## Dependencies

All dependencies are satisfied:

- ✅ Consolidated Trial Balance (exists - displayed on run detail page)
- ✅ Account type classification (exists - `accountType` field on line items)
- ✅ Account subtype classification (exists - `accountCategory` field added 2026-01-16)
- ✅ Prior period data for comparative/cash flow (service accepts optional `priorTrialBalance` parameter)

---

## Testing

### Unit Tests
- Report generation logic from trial balance
- Account classification
- NCI calculations
- Totals and subtotals

### E2E Tests
- Navigate to each report type
- Verify report renders with data
- Export functionality
- Print preview

---

## Open Questions

1. **Comparative periods** - Show prior period column? Requires storing/accessing prior run data.

2. ~~**Account subtype** - Add to Account schema or use a separate mapping configuration?~~
   **RESOLVED:** The `Account` domain already has `accountCategory`. The issue is that `ConsolidatedTrialBalanceLineItem` doesn't include it. **Solution: Add `accountCategory` to line items during GenerateTB step.** See "Domain Model Analysis" section above.

3. **Cash flow method** - Direct or indirect method? Indirect is more common but requires different data.

4. **Segment reporting** - Show breakdown by subsidiary? Or just consolidated totals?

5. **Currency display** - Show in thousands/millions? Configurable precision?

---

## Implementation Priority

All implementation work is complete:

1. ~~**Add `accountCategory` to `ConsolidatedTrialBalanceLineItem`** (BLOCKING)~~
   ✅ **COMPLETED 2026-01-16** - Schema updated, GenerateTB step populates category, all tests pass

2. ~~**Implement `ConsolidatedReportService`**~~
   ✅ **COMPLETED 2026-01-16** - All four report generation methods implemented:
   - `generateBalanceSheet()` - Groups line items by accountCategory into Current/Non-Current Assets, Liabilities, Equity
   - `generateIncomeStatement()` - Revenue, Cost of Sales, Operating Expenses, Other Income/Expense, Tax
   - `generateCashFlow()` - Operating, Investing, Financing activities (simplified implementation)
   - `generateEquityStatement()` - Opening/Closing balance with movement rows for Net Income

3. ~~**Wire up API endpoints**~~
   ✅ **COMPLETED 2026-01-16** - `ConsolidationApiLive.ts` updated to call service methods

4. ~~**Frontend already complete**~~
   ✅ **COMPLETED** - All routes work with real API data, Export & Print buttons functional
