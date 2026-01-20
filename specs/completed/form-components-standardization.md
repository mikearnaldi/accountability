# Form Components Standardization

## Status: ✅ COMPLETE

All phases of form component standardization are complete. All selects, filters, and inputs now use consistent styling through shared `Input`, `Select`, and `Button` components.

## Goal

All selects, filters, and inputs in the app should use consistent styling through shared components.

## Existing Components

### `components/ui/Input.tsx`
- Text input with label, error, helper text support
- Prefix/suffix icon support (`inputPrefix`, `inputSuffix`)
- Consistent styling: `rounded-lg border px-3 py-2`

### `components/ui/Select.tsx`
- Dropdown with custom chevron icon
- Uses `appearance-none` to hide native arrow
- Chevron: `absolute right-3 top-1/2 h-4 w-4 text-gray-500`
- Consistent styling: `rounded-lg border py-2 pl-3 pr-9`

## Files Using Inline Elements

### Inline `<select>` elements (need to use Select component or match styling):

| File | Location | Notes |
|------|----------|-------|
| `routes/.../journal-entries/index.tsx` | Filter dropdowns (lines 468-544) | 4 filter selects + 2 date inputs |
| `routes/.../accounts/index.tsx` | Filter dropdowns | Category, type filters |
| `routes/.../companies/.../index.tsx` | Filters | Status filters |
| `routes/.../index.tsx` (org level) | Filters | Various filters |
| `components/forms/CompanyForm.tsx` | Parent company select | Line ~490 |
| `components/forms/AccountForm.tsx` | Various selects | Category, type, etc. |
| `components/journal/JournalEntryLineEditor.tsx` | Account select | In table rows |
| `components/ui/FiscalYearEndPicker.tsx` | Month/day selects | Dual selects |
| `components/ui/CurrencySelect.tsx` | Currency dropdown | Has spinner but no chevron |
| `components/ui/JurisdictionSelect.tsx` | Country dropdown | Has spinner but no chevron |
| `components/ui/ConsolidationMethodSelect.tsx` | Method dropdown | No custom chevron |

### Inline `<input>` elements (need to use Input component or match styling):

| File | Location | Notes |
|------|----------|-------|
| `routes/.../journal-entries/index.tsx` | Search input, date filters | Lines 449-565 |
| `routes/organizations/index.tsx` | Search input | Org search |
| `routes/.../accounts/index.tsx` | Search input | Account search |
| `routes/login.tsx` | Email/password | Auth form |
| `routes/register.tsx` | Registration fields | Auth form |
| `routes/profile.tsx` | Profile fields | User settings |
| `components/forms/JournalEntryForm.tsx` | Date, reference, amounts | Multiple inputs |
| `components/reports/ReportParameterForm.tsx` | Date inputs | Report params |
| Various modals | Search, filters | Scattered |

## Implementation Plan

### Phase 1: Fix Select Component Chevron

The current chevron at `right-3` may appear too far right. Options:
- Adjust to `right-2` or `right-2.5`
- This needs visual verification in browser

### Phase 2: Update Specialized Select Components ✅ COMPLETE

These should show chevron when not loading:

- [x] `CurrencySelect.tsx` - Add chevron, use `appearance-none` ✅
- [x] `JurisdictionSelect.tsx` - Add chevron, use `appearance-none` ✅
- [x] `ConsolidationMethodSelect.tsx` - Add chevron, use `appearance-none` ✅
- [x] `FiscalYearEndPicker.tsx` - Add chevrons to both selects ✅

### Phase 3: Replace Inline Selects in Routes ✅ COMPLETE

Convert inline `<select>` to use `Select` component:

- [x] `journal-entries/index.tsx` - 4 filter selects ✅ (status, type, fiscal year, fiscal period filters now use Select component)
- [x] `accounts/index.tsx` - filter selects ✅ (type and status filters now use Select component with chevron icons)
- [x] `companies/$companyId/index.tsx` - EditCompanyModal ✅ (reporting currency, fiscal month/day selects now use Select component)
- [x] `organizations/index.tsx` - no filter selects present

### Phase 4: Replace Inline Inputs in Routes ✅ COMPLETE

Convert inline `<input>` to use `Input` component:

- [x] `journal-entries/index.tsx` - search input, date filters ✅ (search uses Input with prefix icon, date filters use Input component)
- [x] `organizations/index.tsx` - search input ✅ (now uses Input component with Search icon prefix)
- [x] `accounts/index.tsx` - search input ✅ (search now uses Input component with Search icon prefix)
- [x] `companies/$companyId/index.tsx` - EditCompanyModal ✅ (name, legal name, tax ID, functional currency inputs now use Input component)
- Auth pages (login, register) - already styled

### Phase 5: Form Components ✅ COMPLETE

- [x] `CompanyForm.tsx` - parent company select ✅ (now uses Select component with chevron, ownership input uses Input component)
- [x] `AccountForm.tsx` - various selects ✅ (type, category, normal balance, parent, cash flow category selects now use Select component; number, name inputs use Input component; buttons use Button component)
- [x] `JournalEntryForm.tsx` - date input, reference input, entry type select, description, currency select, exchange rate ✅
- [x] `JournalEntryLineEditor.tsx` - account select, memo input, debit/credit inputs with currency prefix ✅

### Phase 6: Action Buttons and Edit Page ✅ COMPLETE

- [x] `JournalEntryForm.tsx` - action buttons ✅ (Cancel, Save Draft, Submit buttons now use Button component with loading prop)
- [x] `journal-entries/$entryId/edit.tsx` - all form elements ✅ (date, reference, type selects now use Input/Select; currency select and exchange rate use Select/Input; action buttons use Button component with loading prop)
- [x] `journal-entries/$entryId/index.tsx` - workflow action buttons ✅ (Submit, Approve, Reject, Post, Delete, Reverse buttons now use Button component with loading prop)
- [x] `journal-entries/$entryId/index.tsx` - modals ✅ (RejectModal uses Input for reason and Button for actions; ConfirmDialog uses Button for actions)

## Target Styling

All form elements should have:

```css
/* Base */
rounded-lg border border-gray-300
py-2 px-3
text-sm text-gray-900
bg-white

/* Focus */
focus:outline-none focus:ring-2 focus:ring-offset-0
focus:border-blue-500 focus:ring-blue-500

/* Disabled */
disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed

/* Select specific */
appearance-none cursor-pointer
pr-9 (to make room for chevron)

/* Chevron (for selects) */
absolute right-3 top-1/2 -translate-y-1/2
h-4 w-4 text-gray-500
pointer-events-none
```

## Notes

- Table-embedded selects (JournalEntryLineEditor) may need compact variant
- Date inputs use browser native picker, just need consistent border/focus styling
- Search inputs typically have a search icon prefix
