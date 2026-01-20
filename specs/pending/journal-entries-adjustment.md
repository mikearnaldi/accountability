# Journal Entry Period Selection and Validation

## Overview

This spec defines improvements to journal entry creation:
1. **Date picker constraints** - Only allow dates within open fiscal periods
2. **Period override** - Allow explicit selection of Period 13 (Adjustment)
3. **Backend validation** - Validate period exists and is open before creating entries

## Problems

### Problem 1: No Period Validation
Currently, journal entries can be created with any fiscal period, even if:
- The fiscal year doesn't exist
- The period doesn't exist
- The period is closed

The validation was intentionally removed (see `JournalEntryService.ts`):
> NOTE: Period validation functions have been removed.

### Problem 2: No Way to Post to Period 13
The UI auto-computes periods 1-12 from transaction date. Period 13 (Adjustment) cannot be selected, but it's needed for:
- Year-end adjustments
- Audit entries
- Closing entries

### Problem 3: Dates Outside Fiscal Periods Allowed
Users can select any date, even dates that fall outside any defined fiscal period, leading to orphaned entries.

## Solution

### 1. Constrain Date Selection to Open Periods

The date picker should only allow dates that fall within **open** fiscal periods.

**User Flow:**
```
1. User opens "Create Journal Entry" form
2. Date picker shows current date (if within an open period) or first available open date
3. Dates outside open periods are disabled/grayed out
4. Tooltip on disabled dates: "Period is closed" or "No fiscal period defined"
```

### 2. Period Override for Adjustment Period

Allow explicit selection of Period 13 when the transaction date falls on the fiscal year end.

**User Flow:**
```
1. User selects Dec 31, 2025 (fiscal year end)
2. System shows computed period: "P12 FY2025"
3. User clicks "Override period"
4. Dropdown shows: P12 - December 2025, P13 - Adjustment Period
5. User selects P13
6. Warning banner: "Posting to adjustment period"
```

### 3. Backend Validation

Add validation to journal entry creation:
- Period must exist
- Period must be Open

## UI Design

### Date Picker with Period Constraints

```
┌─────────────────────────────────────────────────────────────┐
│ Transaction Date *                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [2025-12-15]                                      [📅]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Available periods: Jan 2025 - Dec 2025 (P1-P12 Open)       │
└─────────────────────────────────────────────────────────────┘
```

**Calendar View:**
```
        December 2025
  Su  Mo  Tu  We  Th  Fr  Sa
      1   2   3   4   5   6     <- Clickable (P12 Open)
  7   8   9  10  11  12  13
 14  15  16  17  18  19  20
 21  22  23  24  25  26  27
 28  29  30  31                  <- Dec 31 allows P12 or P13

        January 2026
  Su  Mo  Tu  We  Th  Fr  Sa
              1   2   3   4     <- Grayed out (no FY2026 yet)
  5   6   7   8   9  10  11
```

### No Open Periods State

If no fiscal periods are open, show an error state:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Cannot Create Journal Entry                              │
│                                                             │
│ No open fiscal periods available. All periods are closed.  │
│                                                             │
│ Contact your administrator to open a fiscal period.        │
│                                                             │
│ [Go to Fiscal Periods]                                      │
└─────────────────────────────────────────────────────────────┘
```

### Period Override (for Period 13)

Only shown when transaction date is the fiscal year end date:

```
┌─────────────────────────────────────────────────────────────┐
│ Fiscal Period                                               │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📅 P12 FY2025 (December 2025)                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ☐ Post to adjustment period (P13)                          │
│   Use for year-end adjustments and audit entries           │
└─────────────────────────────────────────────────────────────┘
```

When checked:

```
┌─────────────────────────────────────────────────────────────┐
│ Fiscal Period                                               │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📅 P13 FY2025 (Adjustment Period)                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ☑ Post to adjustment period (P13)                          │
│   Use for year-end adjustments and audit entries           │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ℹ️ Adjustment period entries are typically used for:    │ │
│ │   • Year-end audit adjustments                          │ │
│ │   • Accrual corrections                                 │ │
│ │   • Closing entries                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Backend - Add Period Validation

#### 1.1 Add Validation to JournalEntryService

**File:** `packages/core/src/journal/JournalEntryService.ts`

Add new error types:

```typescript
export class FiscalPeriodNotFoundError extends Schema.TaggedError<FiscalPeriodNotFoundError>()(
  "FiscalPeriodNotFoundError",
  {
    companyId: CompanyId,
    fiscalYear: Schema.Number,
    periodNumber: Schema.Number
  }
) {}

export class FiscalPeriodClosedError extends Schema.TaggedError<FiscalPeriodClosedError>()(
  "FiscalPeriodClosedError",
  {
    companyId: CompanyId,
    fiscalYear: Schema.Number,
    periodNumber: Schema.Number,
    periodStatus: Schema.String
  }
) {}
```

Add validation in `create` method:

```typescript
// Validate fiscal period exists and is open
const period = yield* fiscalPeriodService.getPeriodByYearAndNumber(
  entry.companyId,
  entry.fiscalPeriod.year,
  entry.fiscalPeriod.period
)

if (Option.isNone(period)) {
  return yield* Effect.fail(new FiscalPeriodNotFoundError({
    companyId: entry.companyId,
    fiscalYear: entry.fiscalPeriod.year,
    periodNumber: entry.fiscalPeriod.period
  }))
}

if (period.value.status !== "Open") {
  return yield* Effect.fail(new FiscalPeriodClosedError({
    companyId: entry.companyId,
    fiscalYear: entry.fiscalPeriod.year,
    periodNumber: entry.fiscalPeriod.period,
    periodStatus: period.value.status
  }))
}
```

#### 1.2 Add getPeriodByYearAndNumber to FiscalPeriodService

**File:** `packages/core/src/fiscal/FiscalPeriodService.ts`

```typescript
readonly getPeriodByYearAndNumber: (
  companyId: CompanyId,
  fiscalYear: number,
  periodNumber: number
) => Effect.Effect<Option<FiscalPeriod>, FiscalYearNotFoundError>
```

#### 1.3 Implement in FiscalPeriodServiceLive

**File:** `packages/persistence/src/Layers/FiscalPeriodServiceLive.ts`

```typescript
getPeriodByYearAndNumber: (companyId, fiscalYear, periodNumber) =>
  Effect.gen(function* () {
    const maybeFiscalYear = yield* periodRepo.findFiscalYearByNumber(companyId, fiscalYear)
    if (Option.isNone(maybeFiscalYear)) {
      return Option.none()
    }
    return yield* periodRepo.findPeriodByNumber(maybeFiscalYear.value.id, periodNumber)
  })
```

### Phase 2: API - Add Periods Summary Endpoint

#### 2.1 New Endpoint: Get All Periods for Company

**File:** `packages/api/src/Definitions/FiscalPeriodApi.ts`

Returns ALL periods (open and closed) so the frontend can:
- Enable dates in open periods
- Disable dates in closed periods with tooltip "Period is closed"
- Disable dates with no period with tooltip "No fiscal period defined"

```typescript
// GET /companies/{companyId}/fiscal-periods/summary
// Returns all periods with their status for date picker constraints

HttpApiEndpoint.get("getPeriodsSummary", "/companies/:companyId/fiscal-periods/summary")
  .setPath(Schema.Struct({ companyId: CompanyId }))
  .addSuccess(Schema.Struct({
    periods: Schema.Array(Schema.Struct({
      fiscalYearId: FiscalYearId,
      fiscalYear: Schema.Number,
      periodId: FiscalPeriodId,
      periodNumber: Schema.Number,
      periodName: Schema.String,
      periodType: FiscalPeriodType,
      startDate: LocalDateFromString,
      endDate: LocalDateFromString,
      status: FiscalPeriodStatus  // "Open" or "Closed"
    })),
    // Computed ranges for easier frontend logic
    openDateRanges: Schema.Array(Schema.Struct({
      startDate: LocalDateFromString,
      endDate: LocalDateFromString
    })),
    closedDateRanges: Schema.Array(Schema.Struct({
      startDate: LocalDateFromString,
      endDate: LocalDateFromString
    }))
  }))
```

Response example:
```json
{
  "periods": [
    {
      "fiscalYearId": "...",
      "fiscalYear": 2025,
      "periodId": "...",
      "periodNumber": 1,
      "periodName": "Period 1",
      "periodType": "Regular",
      "startDate": "2025-01-01",
      "endDate": "2025-01-31",
      "status": "Closed"
    },
    {
      "fiscalYearId": "...",
      "fiscalYear": 2025,
      "periodId": "...",
      "periodNumber": 2,
      "periodName": "Period 2",
      "periodType": "Regular",
      "startDate": "2025-02-01",
      "endDate": "2025-02-28",
      "status": "Open"
    },
    // ... periods 3-12
    {
      "fiscalYearId": "...",
      "fiscalYear": 2025,
      "periodId": "...",
      "periodNumber": 13,
      "periodName": "Period 13 (Adjustment)",
      "periodType": "Adjustment",
      "startDate": "2025-12-31",
      "endDate": "2025-12-31",
      "status": "Open"
    }
  ],
  "openDateRanges": [
    { "startDate": "2025-02-01", "endDate": "2025-12-31" }
  ],
  "closedDateRanges": [
    { "startDate": "2025-01-01", "endDate": "2025-01-31" }
  ]
}
```

### Phase 3: Frontend - Date Picker Constraints

#### 3.1 Fetch Periods Summary in Loader

**File:** `packages/web/src/routes/.../journal-entries/new.tsx`

```typescript
// Fetch all periods for date picker constraints
const periodsSummaryResult = await serverApi.GET(
  "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-periods/summary",
  { params: { path: { organizationId, companyId } }, headers: { Authorization } }
)
```

#### 3.2 Create PeriodDatePicker Component

**New file:** `packages/web/src/components/forms/PeriodDatePicker.tsx`

```typescript
interface Period {
  fiscalYear: number
  periodNumber: number
  periodName: string
  periodType: string
  startDate: string
  endDate: string
  status: "Open" | "Closed"
}

interface DateRange {
  startDate: string
  endDate: string
}

interface PeriodDatePickerProps {
  value: string
  onChange: (date: string) => void
  periods: Period[]
  openDateRanges: DateRange[]
  closedDateRanges: DateRange[]
  disabled?: boolean
}

type DateStatus = "open" | "closed" | "no-period"

export function PeriodDatePicker({
  value,
  onChange,
  periods,
  openDateRanges,
  closedDateRanges,
  disabled
}: PeriodDatePickerProps) {

  // Determine the status of a date
  const getDateStatus = useCallback((dateStr: string): DateStatus => {
    // Check if date is in an open period (exclude P13 - handled separately)
    const inOpenPeriod = openDateRanges.some(range =>
      dateStr >= range.startDate && dateStr <= range.endDate
    )
    if (inOpenPeriod) return "open"

    // Check if date is in a closed period
    const inClosedPeriod = closedDateRanges.some(range =>
      dateStr >= range.startDate && dateStr <= range.endDate
    )
    if (inClosedPeriod) return "closed"

    // Date has no fiscal period defined
    return "no-period"
  }, [openDateRanges, closedDateRanges])

  // Get tooltip text for disabled dates
  const getTooltip = useCallback((dateStr: string): string | undefined => {
    const status = getDateStatus(dateStr)
    switch (status) {
      case "closed":
        return "Period is closed"
      case "no-period":
        return "No fiscal period defined"
      default:
        return undefined
    }
  }, [getDateStatus])

  // Check if date is selectable
  const isDateSelectable = useCallback((dateStr: string): boolean => {
    return getDateStatus(dateStr) === "open"
  }, [getDateStatus])

  // ... render date input with validation and tooltips
}
```

#### 3.3 Date Picker Visual States

```
┌─────────────────────────────────────────────────────────────┐
│        December 2025                                        │
│  Su  Mo  Tu  We  Th  Fr  Sa                                │
│      1   2   3   4   5   6    <- Open (clickable)          │
│  7   8   9  10  11  12  13                                 │
│ 14  15  16  17  18  19  20                                 │
│ 21  22  23  24  25  26  27                                 │
│ 28  29  30  31                                              │
│                                                             │
│        January 2026                                         │
│  Su  Mo  Tu  We  Th  Fr  Sa                                │
│              1   2   3   4    <- Gray + "No fiscal period" │
│  5   6   7   8   9  10  11       tooltip on hover          │
│                                                             │
│        January 2025 (if P1 is closed)                      │
│  Su  Mo  Tu  We  Th  Fr  Sa                                │
│              1   2   3   4    <- Gray + "Period is closed" │
│  5   6   7   8   9  10  11       tooltip on hover          │
└─────────────────────────────────────────────────────────────┘

Legend:
  [15]  = Open period, clickable (normal style)
  [15]  = Closed period, disabled (gray text + tooltip)
  [15]  = No period, disabled (light gray + tooltip)
```

#### 3.4 Update JournalEntryForm

**File:** `packages/web/src/components/forms/JournalEntryForm.tsx`

```typescript
interface PeriodsSummary {
  periods: Period[]
  openDateRanges: DateRange[]
  closedDateRanges: DateRange[]
}

interface JournalEntryFormProps {
  // ... existing props
  periodsSummary: PeriodsSummary  // New prop
}

// Replace date input with PeriodDatePicker
<PeriodDatePicker
  value={transactionDate}
  onChange={setTransactionDate}
  periods={periodsSummary.periods}
  openDateRanges={periodsSummary.openDateRanges}
  closedDateRanges={periodsSummary.closedDateRanges}
  disabled={isSubmitting}
/>

// Show Period 13 checkbox only when:
// 1. Date is the fiscal year end (P13 start date)
// 2. P13 is Open
const adjustmentPeriod = useMemo(() => {
  return periodsSummary.periods.find(p =>
    p.periodType === "Adjustment" &&
    p.startDate === transactionDate &&
    p.status === "Open"
  )
}, [transactionDate, periodsSummary.periods])

const canPostToAdjustmentPeriod = adjustmentPeriod !== undefined

{canPostToAdjustmentPeriod && (
  <div className="mt-2">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={useAdjustmentPeriod}
        onChange={(e) => setUseAdjustmentPeriod(e.target.checked)}
      />
      <span className="text-sm text-gray-700">
        Post to adjustment period (P13)
      </span>
    </label>
    <p className="ml-6 text-xs text-gray-500">
      Use for year-end adjustments and audit entries
    </p>
  </div>
)}
```

#### 3.5 Handle Edge Cases

**No Fiscal Periods Defined:**
```typescript
// In new.tsx loader
const hasPeriods = periodsSummaryResult.data?.periods.length > 0

// In component
if (!hasPeriods) {
  return (
    <AppLayout ...>
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h2 className="text-lg font-medium text-yellow-800">
          Cannot Create Journal Entry
        </h2>
        <p className="mt-2 text-yellow-700">
          No fiscal periods defined for this company. Create a fiscal year first.
        </p>
        <Link
          to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
          params={{ organizationId, companyId }}
          className="mt-4 inline-block text-yellow-800 underline"
        >
          Go to Fiscal Periods
        </Link>
      </div>
    </AppLayout>
  )
}
```

**All Periods Closed:**
```typescript
const hasOpenPeriods = periodsSummaryResult.data?.periods.some(
  p => p.status === "Open" && p.periodType === "Regular"
) ?? false

if (!hasOpenPeriods) {
  return (
    <AppLayout ...>
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h2 className="text-lg font-medium text-yellow-800">
          Cannot Create Journal Entry
        </h2>
        <p className="mt-2 text-yellow-700">
          All fiscal periods are closed. Open a period to post entries.
        </p>
        <Link
          to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
          params={{ organizationId, companyId }}
          className="mt-4 inline-block text-yellow-800 underline"
        >
          Go to Fiscal Periods
        </Link>
      </div>
    </AppLayout>
  )
}
```

### Phase 4: Update API Error Responses

#### 4.1 Map Domain Errors to HTTP Errors

**File:** `packages/api/src/Layers/JournalEntryApiLive.ts`

```typescript
.pipe(
  Effect.catchTag("FiscalPeriodNotFoundError", (e) =>
    Effect.fail(new BadRequest({
      message: `Fiscal period P${e.periodNumber} does not exist for FY${e.fiscalYear}`
    }))
  ),
  Effect.catchTag("FiscalPeriodClosedError", (e) =>
    Effect.fail(new BadRequest({
      message: `Fiscal period P${e.periodNumber} FY${e.fiscalYear} is ${e.periodStatus}. Open the period to post entries.`
    }))
  )
)
```

## Validation Rules Summary

| Rule | Layer | Behavior |
|------|-------|----------|
| Fiscal year must exist | Backend | `FiscalPeriodNotFoundError` |
| Period must exist (1-13) | Backend | `FiscalPeriodNotFoundError` |
| Period must be Open | Backend | `FiscalPeriodClosedError` |
| Date in open period | Frontend | Clickable, normal style |
| Date in closed period | Frontend | Disabled, gray, tooltip: "Period is closed" |
| Date with no period | Frontend | Disabled, light gray, tooltip: "No fiscal period defined" |
| P13 available | Frontend | Checkbox shown only when date = FY end AND P13 is Open |
| P13 closed | Frontend | Checkbox hidden (can't post to closed P13) |
| No periods defined | Frontend | Error state: "Create a fiscal year first" |
| All periods closed | Frontend | Error state: "Open a period to post entries" |

## Testing Checklist

### Unit Tests
- [ ] JournalEntryService rejects non-existent period
- [ ] JournalEntryService rejects closed period
- [ ] getPeriodByYearAndNumber returns correct period
- [ ] getPeriodByYearAndNumber returns None for missing period

### Integration Tests
- [ ] Creating entry in valid open period succeeds
- [ ] Creating entry in closed period fails with clear error
- [ ] Creating entry in non-existent period fails with clear error
- [ ] Creating entry in P13 succeeds when P13 is open

### E2E Tests
- [ ] Date picker allows dates in open periods (clickable)
- [ ] Date picker disables dates in closed periods with tooltip "Period is closed"
- [ ] Date picker disables dates with no period with tooltip "No fiscal period defined"
- [ ] No fiscal periods shows error state: "Create a fiscal year first"
- [ ] All periods closed shows error state: "Open a period to post entries"
- [ ] P13 checkbox appears only on fiscal year end date when P13 is open
- [ ] P13 checkbox hidden when P13 is closed
- [ ] P13 entry creation works end-to-end
- [ ] Error message when trying to post to closed period (backend validation)

## Files to Create/Modify

| File | Changes |
|------|---------|
| `packages/core/src/journal/JournalEntryService.ts` | Add period validation, new error types |
| `packages/core/src/journal/JournalEntryErrors.ts` | New error classes |
| `packages/core/src/fiscal/FiscalPeriodService.ts` | Add getPeriodByYearAndNumber, getPeriodsForCompany |
| `packages/persistence/src/Layers/FiscalPeriodServiceLive.ts` | Implement getPeriodByYearAndNumber, getPeriodsForCompany |
| `packages/api/src/Definitions/FiscalPeriodApi.ts` | Add getPeriodsSummary endpoint |
| `packages/api/src/Layers/FiscalPeriodApiLive.ts` | Implement getPeriodsSummary |
| `packages/api/src/Layers/JournalEntryApiLive.ts` | Map new errors to HTTP |
| `packages/web/src/components/forms/PeriodDatePicker.tsx` | New component with date status tooltips |
| `packages/web/src/components/forms/JournalEntryForm.tsx` | Use PeriodDatePicker, add P13 checkbox |
| `packages/web/src/routes/.../journal-entries/new.tsx` | Fetch periods summary, handle edge cases |
| `packages/web/src/routes/.../journal-entries/$entryId/edit.tsx` | Same changes as new.tsx |

## Design Decisions

1. **Date picker shows Regular periods only** - Period 13 dates are the same as Period 12, so we don't show them in the date picker. Users select the date, then optionally check "Post to adjustment period".

2. **P13 checkbox only on fiscal year end** - The checkbox to post to P13 only appears when the selected date is the fiscal year end date (when P12 and P13 overlap).

3. **Backend validation is authoritative** - Frontend constraints are for UX; backend validation prevents invalid data regardless of client.

4. **Clear error messages** - Tell users exactly what's wrong and how to fix it (e.g., "Period is closed. Open the period to post entries.").

5. **No auto-creation of periods** - If a period doesn't exist, we don't create it. Users must explicitly manage fiscal years/periods.
