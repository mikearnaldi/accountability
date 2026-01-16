# Consolidated Financial Reports Spec

## Overview

Implement standard financial reports for consolidation runs, transforming the consolidated trial balance into proper financial statement formats per GAAP presentation requirements.

## Current State

**Implemented:**
- Consolidated Trial Balance (displayed on run detail page)
- Individual company reports: Balance Sheet, Income Statement, Cash Flow, Equity Statement
- **Phase 1 (Backend API):** API endpoints exist with stub implementations that return NOT_IMPLEMENTED error
- **Phase 2 (Frontend Routes):** All 5 consolidated report routes created with full UI:
  - Reports hub page (`/consolidation/:groupId/runs/:runId/reports/`)
  - Consolidated Balance Sheet (`/consolidation/:groupId/runs/:runId/reports/balance-sheet`)
  - Consolidated Income Statement (`/consolidation/:groupId/runs/:runId/reports/income-statement`)
  - Consolidated Cash Flow Statement (`/consolidation/:groupId/runs/:runId/reports/cash-flow`)
  - Consolidated Statement of Changes in Equity (`/consolidation/:groupId/runs/:runId/reports/equity-statement`)
  - "View Reports" navigation button on run detail page (visible when run is Completed)

**Not Implemented (Backend Logic):**
- Consolidated Balance Sheet report generation
- Consolidated Income Statement report generation
- Consolidated Cash Flow Statement report generation
- Consolidated Statement of Changes in Equity report generation

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

### Phase 1: Backend API

1. **Create report generation service**
   - `ConsolidatedReportService` in `packages/core/src/Services/`
   - Transform trial balance lines into report sections
   - Account type/subtype classification logic

2. **Add API endpoints**
   ```
   GET /api/v1/consolidation/runs/:runId/reports/balance-sheet
   GET /api/v1/consolidation/runs/:runId/reports/income-statement
   GET /api/v1/consolidation/runs/:runId/reports/cash-flow
   GET /api/v1/consolidation/runs/:runId/reports/equity-statement
   ```

3. **Response schemas**
   - Define typed schemas for each report structure
   - Include metadata (period, currency, group name)

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

### Phase 3: Export & Print

1. **PDF export** - Generate printable PDF versions
2. **Excel export** - Download as spreadsheet
3. **Print styling** - CSS for print media

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

- Consolidated Trial Balance (exists)
- Account type classification (exists)
- Account subtype classification (needs implementation or mapping)
- Prior period data for comparative/cash flow (may need additional queries)

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

2. **Account subtype** - Add to Account schema or use a separate mapping configuration?

3. **Cash flow method** - Direct or indirect method? Indirect is more common but requires different data.

4. **Segment reporting** - Show breakdown by subsidiary? Or just consolidated totals?

5. **Currency display** - Show in thousands/millions? Configurable precision?
