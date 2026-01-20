# Fiscal Periods Specification

This document specifies the design and implementation of fiscal year and period management in the Accountability application.

---

## Overview

Fiscal periods are the foundation of accounting time management. Every financial transaction is recorded within a specific fiscal period, and period status controls what operations are allowed.

**Key Principle**: Every fiscal year MUST have exactly 13 periods:
- Periods 1-12: Regular periods (typically monthly)
- Period 13: Adjustment period (for year-end adjustments, audit entries, closing entries)

This is required for:
1. **Consolidation compatibility** - Consolidation runs support periods 1-13
2. **Audit compliance** - Year-end adjustments must be segregated from regular activity
3. **Standard accounting practice** - The 13th period is an industry standard

---

## Status: IMPLEMENTED

All fiscal period features have been implemented:
- ✅ Period 13 is mandatory (always created with every fiscal year)
- ✅ Simplified 2-status model (Open/Closed) for better UX
- ✅ Status transitions work correctly
- ✅ Journal entry posting respects period status

---

## Domain Model

### FiscalYear

A fiscal year represents an accounting year for a company.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| companyId | UUID | Yes | FK to Company |
| year | number | Yes | Fiscal year number (e.g., 2025) |
| name | string | Yes | Display name (e.g., "FY 2025") |
| startDate | LocalDate | Yes | First day of fiscal year |
| endDate | LocalDate | Yes | Last day of fiscal year |
| status | FiscalYearStatus | Yes | Open, Closing, or Closed |
| createdAt | Timestamp | Yes | Creation time |
| updatedAt | Timestamp | Yes | Last update time |

**FiscalYearStatus:**
| Status | Description |
|--------|-------------|
| Open | Active year, periods can be managed |
| Closing | Year-end close in progress |
| Closed | Year fully closed, no modifications |

**Relationships:**
- Belongs to **Company**
- Has exactly **13 FiscalPeriods** (always)

### FiscalPeriod

A period within a fiscal year.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Primary key |
| fiscalYearId | UUID | Yes | FK to FiscalYear |
| periodNumber | number | Yes | 1-12 regular, 13 adjustment |
| name | string | Yes | Display name (e.g., "January 2025", "Adjustment Period") |
| periodType | FiscalPeriodType | Yes | Regular, Adjustment, or Closing |
| startDate | LocalDate | Yes | First day of period |
| endDate | LocalDate | Yes | Last day of period |
| status | FiscalPeriodStatus | Yes | Workflow state |
| closedBy | UUID | No | User who closed the period |
| closedAt | Timestamp | No | When the period was closed |

**FiscalPeriodType:**
| Type | Description |
|------|-------------|
| Regular | Normal accounting period (periods 1-12) |
| Adjustment | Year-end adjustment period (period 13) |
| Closing | Year-end closing period (optional, for closing entries) |

**FiscalPeriodStatus (Simplified 2-Status Model):**
| Status | Description | Posting Allowed |
|--------|-------------|-----------------|
| Open | Active period, accepts journal entries | Yes |
| Closed | Period closed, no entries allowed | No |

**Status Workflow:**
```
Open ←→ Closed
```

A period is either open for entries or it's not. This simplified model replaced the original 5-status model (Future/Open/SoftClose/Closed/Locked) for better UX. The transition requires `fiscal_period:manage` permission.

---

## Business Rules

### Fiscal Year Creation

1. **Period 13 is mandatory** - Every fiscal year MUST be created with exactly 13 periods
2. **No `includeAdjustmentPeriod` option** - Remove this from API and UI
3. **Period dates are calculated automatically**:
   - Periods 1-12: Divide the fiscal year into 12 equal(ish) periods (typically monthly)
   - Period 13: Same end date as period 12, zero-length adjustment period
4. **Fiscal year dates** are based on company's `fiscalYearEnd` setting
5. **Duplicate prevention** - Cannot create a fiscal year if one already exists for that year

### Period Status Transitions

| From Status | To Status | Action | Requirements |
|-------------|-----------|--------|--------------|
| Closed | Open | Open Period | `fiscal_period:manage` permission |
| Open | Closed | Close Period | `fiscal_period:manage` permission |

### Posting Rules by Period Status

| Period Status | Users with `journal_entry:create` |
|---------------|-----------------------------------|
| Open | Can post |
| Closed | Cannot post |

### Period 13 (Adjustment Period) Rules

1. **Always created** - Never optional
2. **Same date range as Period 12** - Shares the fiscal year end date
3. **Used for**:
   - Year-end audit adjustments
   - Accrual corrections
   - Closing entries (revenue/expense to retained earnings)
   - Consolidation adjustments
4. **Status independent** - Can be opened even if periods 1-12 are closed
5. **Consolidation requirement** - Consolidation runs can target period 13
6. **Period lookup prioritization** - When a date falls within both Period 12 and Period 13 (e.g., Dec 31), the regular period (12) is used for journal entries. The adjustment period (13) must be explicitly selected.

### Consolidation Compatibility

The consolidation system enforces `fiscal_period >= 1 AND fiscal_period <= 13`:

```sql
-- From Migration0009_CreateConsolidationRuns.ts
fiscal_period INTEGER NOT NULL CHECK (fiscal_period >= 1 AND fiscal_period <= 13)
```

This means:
- Every fiscal year MUST have period 13 to support consolidation runs
- Consolidation reports can be run for any period 1-13
- Period 13 consolidation captures year-end adjustments from all subsidiaries

---

## API Endpoints

### Fiscal Years

```
GET    /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years
GET    /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}
DELETE /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/begin-close
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/complete-close
```

### Fiscal Periods

```
GET    /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods
GET    /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/open
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/soft-close
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/close
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/lock
POST   /api/v1/organizations/{orgId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/reopen
```

### Create Fiscal Year Request

```typescript
// BEFORE (with optional adjustment period)
interface CreateFiscalYearRequest {
  year: number
  name?: string | null
  startDate: LocalDate
  endDate: LocalDate
  includeAdjustmentPeriod?: boolean | null  // REMOVE THIS
}

// AFTER (period 13 always created)
interface CreateFiscalYearRequest {
  year: number
  name?: string | null
  startDate: LocalDate
  endDate: LocalDate
  // No includeAdjustmentPeriod - always creates 13 periods
}
```

### Reopen Period Request

```typescript
interface ReopenPeriodRequest {
  reason: string  // Required, min 10 characters
}
```

---

## UI Components

### Fiscal Periods Page

**Route:** `/organizations/:orgId/companies/:companyId/fiscal-periods`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Fiscal Periods                                        [Create Fiscal Year]   │
│ Manage fiscal years and periods for {Company Name}                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ FY 2025 ─────────────────────────────────────── Open ── [Begin Close] ─┐ │
│ │ Jan 1, 2025 - Dec 31, 2025                                        [▼]   │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ Period    │ Type       │ Date Range              │ Status    │ Actions  │ │
│ │ January   │ Regular    │ Jan 1 - Jan 31          │ Locked    │ [Reopen] │ │
│ │ February  │ Regular    │ Feb 1 - Feb 28          │ Closed    │ [Lock]   │ │
│ │ March     │ Regular    │ Mar 1 - Mar 31          │ Closed    │ [Lock]   │ │
│ │ ...       │            │                         │           │          │ │
│ │ December  │ Regular    │ Dec 1 - Dec 31          │ Open      │ [Close]  │ │
│ │ Adj       │ Adjustment │ Dec 31 - Dec 31         │ Future    │ [Open]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ FY 2024 ─────────────────────────────────────── Closed ────────────────┐ │
│ │ Jan 1, 2024 - Dec 31, 2024                                        [▶]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Create Fiscal Year Modal

**IMPORTANT:** Remove the "Include adjustment period" checkbox - period 13 is always created.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create Fiscal Year                                                    [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Year *                                                                      │
│ [2025___________]                                                           │
│ The fiscal year number (e.g., 2025)                                         │
│                                                                             │
│ Name (optional)                                                             │
│ [FY 2025________]                                                           │
│                                                                             │
│ Start Date *                    End Date *                                  │
│ [2025-01-01]                    [2025-12-31]                                │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ℹ️ This will create 13 periods:                                         │ │
│ │    • Periods 1-12: Regular monthly periods                              │ │
│ │    • Period 13: Adjustment period for year-end entries                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                          [Cancel]  [Create Fiscal Year]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reopen Period Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Reopen Period                                                         [X]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠️ Warning                                                               │ │
│ │ Reopening a closed or locked period allows modifications to posted      │ │
│ │ entries. This action will be recorded in the audit log.                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ You are about to reopen March 2025 (Mar 1 - Mar 31).                       │
│                                                                             │
│ Reason for reopening *                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Provide justification for reopening this period...                      │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                              [Cancel]  [Reopen Period]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Period Status Badges

| Status | Color | Icon |
|--------|-------|------|
| Open | Green (`bg-green-100 text-green-800`) | CheckCircle |
| Closed | Gray (`bg-gray-100 text-gray-800`) | Lock |

---

## Implementation Status

### Phase 1: Make Period 13 Mandatory ✅ COMPLETE

1. ✅ **Backend: Update FiscalYearServiceLive** - Always generates 13 periods
2. ✅ **Backend: Update API schema** - `includeAdjustmentPeriod` removed
3. ✅ **Frontend: Update CreateFiscalYearModal** - Shows 13-period info message
4. ✅ **Migration** - Existing data handled via application logic

### Phase 2: Simplified Status Model ✅ COMPLETE

The original 5-status model was simplified to 2 statuses (Open/Closed) for better UX.
See `completed/fix-fiscal-periods.md` for historical context on this change.

### Future Enhancements (Not Implemented)

- Bulk period operations (open/close multiple periods at once)
- Period templates (monthly, quarterly, 4-4-5)
- Automatic period opening when current closes
- Period calendar view

---

## Database Schema

### fiscal_years table

```sql
CREATE TABLE fiscal_years (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2999),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, year),
  CHECK (start_date < end_date),
  CHECK (status IN ('Open', 'Closing', 'Closed'))
);
```

### fiscal_periods table

```sql
CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 13),
  name VARCHAR(100) NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Closed',
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (fiscal_year_id, period_number),
  CHECK (start_date <= end_date),
  CHECK (period_type IN ('Regular', 'Adjustment', 'Closing')),
  CHECK (status IN ('Open', 'Closed'))
);

-- Index for finding periods by year
CREATE INDEX idx_fiscal_periods_year ON fiscal_periods(fiscal_year_id);

-- Index for finding open periods
CREATE INDEX idx_fiscal_periods_status ON fiscal_periods(status) WHERE status = 'Open';
```

---

## Testing Requirements

### Unit Tests ✅
- ✅ Fiscal year creation always generates 13 periods
- ✅ Period 13 has type "Adjustment"
- ✅ Period status transitions (Open ↔ Closed)
- ✅ Cannot create duplicate fiscal year for same company/year

### Integration Tests ✅
- ✅ Create fiscal year API creates 13 periods
- ✅ Period status transition APIs work correctly
- ✅ Journal entry posting respects period status
- ✅ Consolidation run can target period 13

### E2E Tests ✅
- ✅ Create fiscal year shows all 13 periods
- ✅ Period status transitions from UI (Open/Close buttons)
- ✅ Period status badges display correctly

---

## Related Files

**Backend:**
- `packages/core/src/Domains/FiscalYear.ts` - Domain model
- `packages/core/src/Domains/FiscalPeriod.ts` - Domain model
- `packages/core/src/Domains/FiscalPeriodType.ts` - Type enum
- `packages/core/src/Domains/FiscalPeriodStatus.ts` - Status enum
- `packages/persistence/src/Layers/FiscalYearRepositoryLive.ts` - Repository
- `packages/persistence/src/Layers/FiscalYearServiceLive.ts` - Service
- `packages/api/src/Definitions/FiscalYearApi.ts` - API definitions

**Frontend:**
- `packages/web/src/routes/organizations/$organizationId/companies/$companyId/fiscal-periods/index.tsx` - Page

**Migrations:**
- `packages/persistence/src/Migrations/Migration0009_CreateConsolidationRuns.ts` - Has period 1-13 constraint

---

## Glossary

| Term | Definition |
|------|------------|
| **Fiscal Year** | A 12-month accounting period used for financial reporting |
| **Fiscal Period** | A subdivision of a fiscal year (typically monthly) |
| **Adjustment Period** | Period 13, used for year-end adjustments and audit entries |
| **Open** | Period status that allows journal entry posting |
| **Closed** | Period status that prevents journal entry posting |
