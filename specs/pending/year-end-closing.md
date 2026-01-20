# Year-End Closing Workflow

## Overview

This spec defines the implementation of a proper year-end closing workflow that generates the required accounting entries to close a fiscal year.

## Current State

### What Exists

| Component | Status | Description |
|-----------|--------|-------------|
| Fiscal Year status model | ✅ Exists | `Open` → `Closing` → `Closed` |
| `beginYearClose` API | ✅ Exists | Changes status to `Closing` (does nothing else) |
| `completeYearClose` API | ✅ Exists | Changes status to `Closed` (does nothing else) |
| UI buttons | ✅ Exists | "Begin Year-End Close" and "Complete Close" |
| Closing journal entries | ❌ Missing | No entries generated |
| Error handling | ❌ Poor | UI just shows "Error" with no details |

### Problems

1. **No actual closing entries** - The APIs just toggle status, no accounting work is done
2. **"Closing" state is meaningless** - It serves no purpose in the current implementation
3. **Poor error UX** - Users see generic "Failed to begin year-end close" with no actionable information
4. **No preview/review** - Users can't see what will happen before committing
5. **No retained earnings account selection** - System doesn't know where to post net income

## Design Decision: Remove "Closing" State

**Recommendation: Remove the intermediate "Closing" state.**

### Rationale

1. **Consistency** - We simplified fiscal period status from 5 → 2 states (Open/Closed). Fiscal year should follow the same principle.
2. **Simplicity** - Users don't need to click two buttons to close a year
3. **Atomicity** - Year-end close should be a single atomic operation
4. **Preview instead** - Rather than a "Closing" state, show a preview dialog before executing

### New Fiscal Year Status Model

```
Open ←→ Closed
```

| Status | Description |
|--------|-------------|
| **Open** | Year is active, accepts journal entries |
| **Closed** | Year is closed, no entries allowed |

## Year-End Close Workflow

### User Flow

```
1. User clicks "Close Year" on an Open fiscal year
2. System validates prerequisites
3. System shows confirmation dialog:
   "Close FY 2025?
    Net income of $70,000 will be posted to Retained Earnings (3200)."
   [Cancel] [Close Year]
4. User confirms
5. System generates closing entries
6. System closes all periods (if not already closed)
7. System sets fiscal year status to Closed
8. User sees success toast with link to view closing entries
```

### Retained Earnings Account

The retained earnings account is configured **once per company**, not selected during each year-end close.

**Auto-configuration via Chart of Accounts Template:**
- When applying a CoA template, the template's retained earnings account is automatically set on the company
- Templates should mark one Equity account as `isRetainedEarnings: true`
- No manual configuration needed in most cases

**Manual override in Company Settings:**
- Field: "Retained Earnings Account" (dropdown of Equity accounts)
- Pre-populated if set via template
- Can be changed if needed

### Prerequisites Validation

Before allowing year-end close, validate:

| Check | Error if Failed |
|-------|-----------------|
| All periods exist (1-13) | "Fiscal year is missing periods" |
| Retained earnings account configured | "Configure retained earnings account in Company Settings" |
| Trial balance is balanced | "Trial balance is out of balance by {amount}" |

**Note**: Periods do NOT need to be closed first. The year-end close process will close them automatically.

### Closing Entries

Year-end close generates journal entries to transfer income statement balances to retained earnings:

#### Entry 1: Close Revenue Accounts

```
DR: All Revenue Accounts (individual amounts)
  CR: Retained Earnings (total revenue)
```

#### Entry 2: Close Expense Accounts

```
DR: Retained Earnings (total expenses)
  CR: All Expense Accounts (individual amounts)
```

**Result**: Net income (Revenue - Expenses) is transferred to Retained Earnings.

### Closing Entry Properties

| Property | Value |
|----------|-------|
| Date | Last day of fiscal year (end date) |
| Period | Period 13 (Adjustment Period) |
| Description | "Year-end closing entry - FY {year}" |
| Source | `system:year-end-close` |
| Is Adjusting | `true` |
| Is Closing | `true` (new field) |

## Implementation Plan

### Phase 1: Backend Changes

#### 1.1 Remove "Closing" Status

**Files to modify:**
- `packages/core/src/fiscal/FiscalYearStatus.ts`

```typescript
// Before
export const FiscalYearStatus = Schema.Literal("Open", "Closing", "Closed")

// After
export const FiscalYearStatus = Schema.Literal("Open", "Closed")
```

#### 1.2 Add Retained Earnings Account to Company

**Files to modify:**
- `packages/core/src/company/Company.ts`
- `packages/core/src/accounting/Account.ts` (add `isRetainedEarnings` flag)
- `packages/core/src/accounting/ChartOfAccountsTemplate.ts` (mark retained earnings in templates)
- `packages/api/src/Definitions/CompanyApi.ts` (update company endpoints)
- `packages/web/.../companies/$companyId/settings.tsx` (add field to UI)
- Database migration

**Company schema:**

```typescript
retainedEarningsAccountId: Schema.optionalWith(AccountId, { as: "Option" })
```

**Account schema** (new field):

```typescript
isRetainedEarnings: Schema.optionalWith(Schema.Boolean, { default: () => false })
```

**Template application logic:**

```typescript
// When applying CoA template:
const retainedEarningsAccount = createdAccounts.find(a => a.isRetainedEarnings)
if (retainedEarningsAccount) {
  await companyService.update(companyId, {
    retainedEarningsAccountId: retainedEarningsAccount.id
  })
}
```

**Company Settings UI:**
- Dropdown to select retained earnings account (filtered to Equity accounts)
- Pre-populated if set via template
- Shows "Not configured" with warning if empty and fiscal years exist

#### 1.3 Create Year-End Close Service

**New file:** `packages/core/src/fiscal/YearEndCloseService.ts`

```typescript
interface YearEndCloseService {
  // Preview what closing will do (no side effects)
  // Uses company's configured retained earnings account
  previewYearEndClose: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<YearEndClosePreview, YearEndCloseError>

  // Execute the year-end close
  // Uses company's configured retained earnings account
  executeYearEndClose: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<YearEndCloseResult, YearEndCloseError>

  // Reopen a closed year (reverses closing entries)
  reopenFiscalYear: (
    companyId: CompanyId,
    fiscalYearId: FiscalYearId,
    reason: string
  ) => Effect.Effect<FiscalYear, YearEndCloseError>
}
```

#### 1.4 Preview Response Schema

```typescript
class YearEndClosePreview extends Schema.Class<YearEndClosePreview>("YearEndClosePreview")({
  fiscalYearId: FiscalYearId,
  fiscalYearName: Schema.String,

  // Calculated amounts
  totalRevenue: MoneyAmount,
  totalExpenses: MoneyAmount,
  netIncome: MoneyAmount,

  // Target account (from company settings)
  retainedEarningsAccount: AccountSummary,

  // Validation
  canProceed: Schema.Boolean,
  blockers: Schema.Array(Schema.String)
}) {}
```

#### 1.5 Update API Endpoints

**Remove:**
- `POST /fiscal-years/{id}/begin-close`

**Modify:**
- `POST /fiscal-years/{id}/complete-close` → `POST /fiscal-years/{id}/close`

**Add:**
- `POST /fiscal-years/{id}/close/preview` - Returns preview without executing
- `POST /fiscal-years/{id}/reopen` - Reopens a closed year

**New endpoint schemas:**

```typescript
// Preview - no request body, uses company's configured account
// GET /fiscal-years/{id}/close/preview

// Close - no request body, uses company's configured account
// POST /fiscal-years/{id}/close

// Close response
const YearEndCloseResponse = Schema.Struct({
  fiscalYear: FiscalYear,
  closingEntryIds: Schema.Array(JournalEntryId),
  netIncome: MoneyAmount
})

// Reopen request
const ReopenFiscalYearRequest = Schema.Struct({
  reason: Schema.String.pipe(Schema.minLength(10))
})
```

#### 1.6 Add Journal Entry Fields

**Files to modify:**
- `packages/core/src/journal/JournalEntry.ts`
- Database migration

Add `isClosingEntry` field:

```typescript
isClosingEntry: Schema.optionalWith(Schema.Boolean, { default: () => false })
```

### Phase 2: Frontend Changes

#### 2.1 Remove "Begin Year-End Close" Button

The two-step process is eliminated. Only show "Close Year" button for Open years.

#### 2.2 Simple Confirmation Dialog

No complex modal needed. Use a simple confirmation dialog:

```tsx
// When user clicks "Close Year", fetch preview first
const handleCloseYear = async () => {
  const preview = await api.GET(".../close/preview")

  if (!preview.canProceed) {
    // Show error with blockers
    setError(preview.blockers.join(", "))
    return
  }

  // Show confirmation
  setConfirmDialog({
    title: "Close Fiscal Year?",
    message: `Net income of ${formatCurrency(preview.netIncome)} will be posted to ${preview.retainedEarningsAccount.name}.`,
    confirmLabel: "Close Year",
    onConfirm: executeClose
  })
}
```

**Confirmation dialog content:**
```
┌─────────────────────────────────────────┐
│  Close Fiscal Year?                     │
│                                         │
│  Net income of $70,000 will be posted   │
│  to Retained Earnings (3200).           │
│                                         │
│  This will:                             │
│  • Close all revenue accounts           │
│  • Close all expense accounts           │
│  • Close all open periods               │
│                                         │
│            [Cancel]  [Close Year]       │
└─────────────────────────────────────────┘
```

**Error state (if retained earnings not configured):**
```
┌─────────────────────────────────────────┐
│  Cannot Close Year                      │
│                                         │
│  ⚠ Retained earnings account not        │
│    configured.                          │
│                                         │
│  Configure it in Company Settings.      │
│                                         │
│         [Go to Settings]  [Cancel]      │
└─────────────────────────────────────────┘
```

#### 2.3 Improve Error Handling

Replace generic error messages with specific, actionable feedback:

| Error | User Message |
|-------|--------------|
| `TrialBalanceNotBalanced` | "Trial balance is out of balance by {amount}. Review journal entries before closing." |
| `MissingRetainedEarningsAccount` | "Select a retained earnings account to continue." |
| `PeriodsNotClosed` | "Close all periods before closing the fiscal year." |
| `YearAlreadyClosed` | "This fiscal year is already closed." |
| `InvalidAccountType` | "The selected account must be an Equity account." |

#### 2.4 Update FiscalYearCard

```tsx
// Before
{fiscalYear.status === "Open" && (
  <Button onClick={handleBeginYearClose}>Begin Year-End Close</Button>
)}
{fiscalYear.status === "Closing" && (
  <Button onClick={handleCompleteYearClose}>Complete Close</Button>
)}

// After
{fiscalYear.status === "Open" && canManage && (
  <Button onClick={handleCloseYear}>Close Year</Button>
)}
{fiscalYear.status === "Closed" && canManage && (
  <Button variant="ghost" onClick={handleReopenYear}>Reopen</Button>
)}
```

#### 2.5 Add Retained Earnings to Company Settings

Update Company Settings page to include:

```tsx
<FormField label="Retained Earnings Account" required>
  <AccountSelect
    value={company.retainedEarningsAccountId}
    onChange={handleRetainedEarningsChange}
    filter={(account) => account.category === "Equity"}
    placeholder="Select retained earnings account"
  />
  <p className="text-sm text-gray-500">
    Net income will be posted to this account during year-end close.
  </p>
</FormField>
```

### Phase 3: Database Migration

```sql
-- 1. Add retained earnings account to companies
ALTER TABLE companies
ADD COLUMN retained_earnings_account_id UUID REFERENCES accounts(id);

-- 2. Add is_closing_entry to journal entries
ALTER TABLE journal_entries
ADD COLUMN is_closing_entry BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Convert "Closing" fiscal years to "Open"
UPDATE fiscal_years SET status = 'Open' WHERE status = 'Closing';

-- 4. Update status check constraint
ALTER TABLE fiscal_years
DROP CONSTRAINT IF EXISTS fiscal_years_status_check;

ALTER TABLE fiscal_years
ADD CONSTRAINT fiscal_years_status_check
CHECK (status IN ('Open', 'Closed'));
```

## API Reference

### Preview Year-End Close

```
GET /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/close/preview

Response (200):
{
  "fiscalYearId": "uuid",
  "fiscalYearName": "FY 2025",
  "totalRevenue": 150000,
  "totalExpenses": 80000,
  "netIncome": 70000,
  "retainedEarningsAccount": {
    "id": "uuid",
    "number": "3200",
    "name": "Retained Earnings"
  },
  "canProceed": true,
  "blockers": []
}

Response (422 - cannot proceed):
{
  "fiscalYearId": "uuid",
  "fiscalYearName": "FY 2025",
  "totalRevenue": 0,
  "totalExpenses": 0,
  "netIncome": 0,
  "retainedEarningsAccount": null,
  "canProceed": false,
  "blockers": ["Retained earnings account not configured"]
}
```

### Execute Year-End Close

```
POST /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/close

Request: (empty body)

Response (200):
{
  "fiscalYear": { ... },
  "closingEntryIds": ["uuid", "uuid"],
  "netIncome": 70000
}

Errors:
- 400 RetainedEarningsNotConfigured - "Configure retained earnings account in Company Settings"
- 400 TrialBalanceNotBalanced - "Trial balance is out of balance by {amount}"
- 404 FiscalYearNotFound
- 409 YearAlreadyClosed - "This fiscal year is already closed"
```

### Reopen Fiscal Year

```
POST /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/reopen

Request:
{
  "reason": "Need to make adjusting entries for audit findings"
}

Response (200):
{
  "fiscalYear": { ... },
  "reversedEntryIds": ["uuid", "uuid"]
}

Errors:
- 400 YearNotClosed - "Cannot reopen a year that is not closed"
- 404 FiscalYearNotFound
```

## Testing Checklist

### Unit Tests
- [ ] Preview correctly calculates revenue/expense totals
- [ ] Preview identifies unbalanced trial balance
- [ ] Closing entries are correctly generated
- [ ] Net income calculation is accurate
- [ ] Reopen correctly reverses closing entries

### Integration Tests
- [ ] Full close workflow with real accounts
- [ ] Close → Reopen → Close cycle
- [ ] Multi-currency closing entries

### E2E Tests
- [ ] Close year via modal
- [ ] Error states display correctly
- [ ] Preview → Close flow
- [ ] Reopen year flow

## Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/fiscal/FiscalYearStatus.ts` | Remove "Closing" |
| `packages/core/src/fiscal/FiscalYear.ts` | Update status type |
| `packages/core/src/fiscal/YearEndCloseService.ts` | New service |
| `packages/core/src/company/Company.ts` | Add retainedEarningsAccountId |
| `packages/core/src/accounting/Account.ts` | Add isRetainedEarnings flag |
| `packages/core/src/journal/JournalEntry.ts` | Add isClosingEntry |
| `packages/persistence/src/Layers/YearEndCloseServiceLive.ts` | New implementation |
| `packages/persistence/src/Layers/ChartOfAccountsServiceLive.ts` | Auto-set retained earnings on template apply |
| `packages/api/src/Definitions/FiscalPeriodApi.ts` | Update endpoints |
| `packages/api/src/Definitions/CompanyApi.ts` | Add retained earnings to update |
| `packages/api/src/Layers/FiscalPeriodApiLive.ts` | Update handlers |
| `packages/web/.../fiscal-periods/index.tsx` | Simplify to single "Close Year" button |
| `packages/web/.../companies/$companyId/settings.tsx` | Add retained earnings selector |
| `packages/web/src/components/ui/ConfirmDialog.tsx` | Reusable confirmation dialog |
| CoA templates (seed data) | Mark retained earnings account |
| Database migration | Schema changes |
| Tests | All layers |

## Design Decisions

1. **Closing entries are immutable** - System-generated, cannot be edited or deleted manually.

2. **Reopen preserves Period 13 entries** - Only reverses the system-generated closing entries, keeps user's adjusting entries.

3. **No partial year close** - Always closes all income statement accounts. Keep it simple.

4. **Multi-currency** - Each currency has its own closing entries with amounts in that currency.

5. **No modal for account selection** - Retained earnings is a company setting, configured once, used for all year-end closes.

6. **Auto-configure via templates** - When applying a CoA template, automatically set the retained earnings account. Most users never need to manually configure it.
