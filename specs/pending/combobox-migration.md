# Combobox Migration - Replace Select with Searchable Dropdowns

## Overview

Replace all plain browser `<Select>` components with the new searchable `<Combobox>` component for better UX. Users should be able to type to filter options instead of scrolling through long lists.

## Status Summary

| Category | Status |
|----------|--------|
| Combobox component | DONE |
| Journal Entry Line Editor (accounts) | DONE |
| Specialized Select Components | TODO |
| Form Components | TODO |
| Page Filters | TODO |

---

## TODO: Files to Update

### Priority 1: Specialized Select Components (High Impact)

These are reusable components that wrap Select. Updating these will fix many usages automatically.

#### 1.1 CurrencySelect
**File:** `packages/web/src/components/ui/CurrencySelect.tsx`

Used for selecting currencies (USD, EUR, etc.). ~180 currencies to choose from.

**Current:** Native select with all currencies listed
**Change:** Convert to use Combobox internally, search by code or name

**Used in:**
- `CompanyForm.tsx` - functional currency selection
- `OrganizationForm.tsx` - default currency selection
- `exchange-rates/new.tsx` - from/to currency
- `exchange-rates/index.tsx` - currency filter

#### 1.2 JurisdictionSelect
**File:** `packages/web/src/components/ui/JurisdictionSelect.tsx`

Used for selecting countries/jurisdictions. ~250 countries.

**Current:** Native select with all countries listed
**Change:** Convert to use Combobox internally, search by name or code

**Used in:**
- `CompanyForm.tsx` - company jurisdiction

#### 1.3 ConsolidationMethodSelect
**File:** `packages/web/src/components/ui/ConsolidationMethodSelect.tsx`

Used for selecting consolidation methods. Only ~5 options.

**Current:** Native select
**Change:** Could stay as Select (few options) OR convert for consistency

**Used in:**
- `consolidation/new.tsx`
- `consolidation/$groupId/edit.tsx`

---

### Priority 2: Form Components

#### 2.1 AccountForm.tsx
**File:** `packages/web/src/components/forms/AccountForm.tsx`

**Selects to replace:**
- Account Category (Asset, Liability, Equity, Revenue, Expense) - 5 options
- Account Type (many types per category) - ~20+ options
- Parent Account - can be many accounts

**Recommendation:**
- Category: Keep as Select (only 5 options)
- Account Type: Convert to Combobox (searchable)
- Parent Account: Convert to Combobox (searchable by number/name)

#### 2.2 CompanyForm.tsx
**File:** `packages/web/src/components/forms/CompanyForm.tsx`

**Selects to replace:**
- Functional Currency → Uses CurrencySelect (fix in 1.1)
- Jurisdiction → Uses JurisdictionSelect (fix in 1.2)
- Fiscal Year End Month - 12 options

**Recommendation:**
- Fiscal Year End: Keep as Select (only 12 options)

#### 2.3 OrganizationForm.tsx
**File:** `packages/web/src/components/forms/OrganizationForm.tsx`

**Selects to replace:**
- Default Currency → Uses CurrencySelect (fix in 1.1)
- Industry - many industries

**Recommendation:**
- Industry: Convert to Combobox (searchable)

#### 2.4 JournalEntryForm.tsx
**File:** `packages/web/src/components/forms/JournalEntryForm.tsx`

**Selects to replace:**
- Entry Type (Standard, Adjusting, etc.) - ~5 options

**Recommendation:**
- Entry Type: Keep as Select (few options)

---

### Priority 3: Page Filters and Selectors

#### 3.1 Journal Entries List
**File:** `packages/web/src/routes/.../journal-entries/index.tsx`

**Selects:** Status filter, Period filter

**Recommendation:** Keep as Select (few options for filtering)

#### 3.2 Accounts List
**File:** `packages/web/src/routes/.../accounts/index.tsx`

**Selects:** Category filter

**Recommendation:** Keep as Select (5 categories)

#### 3.3 Audit Log
**File:** `packages/web/src/routes/.../audit-log/index.tsx`

**Selects:** Action type filter, User filter

**Recommendation:**
- Action type: Keep as Select
- User filter: Convert to Combobox (if many users)

#### 3.4 Exchange Rates
**File:** `packages/web/src/routes/.../exchange-rates/index.tsx`
**File:** `packages/web/src/routes/.../exchange-rates/new.tsx`

**Selects:** Currency filters → Uses CurrencySelect (fix in 1.1)

#### 3.5 Intercompany Transactions
**File:** `packages/web/src/routes/.../intercompany/index.tsx`
**File:** `packages/web/src/routes/.../intercompany/new.tsx`
**File:** `packages/web/src/routes/.../intercompany/$transactionId/edit.tsx`

**Selects:** Company selectors (from/to company)

**Recommendation:** Convert to Combobox (searchable company names)

#### 3.6 Consolidation
**File:** `packages/web/src/routes/.../consolidation/new.tsx`
**File:** `packages/web/src/routes/.../consolidation/$groupId/edit.tsx`

**Selects:**
- Consolidation method → Uses ConsolidationMethodSelect
- Company selector for adding members

**Recommendation:**
- Method: Keep as Select (few options)
- Company selector: Convert to Combobox

#### 3.7 Policy Builder
**File:** `packages/web/src/components/policies/PolicyBuilderModal.tsx`

**Selects:** Resource type, Action type, User/Role selectors

**Recommendation:**
- Resource/Action: Keep as Select (defined enum)
- User selector: Convert to Combobox (searchable)

#### 3.8 Settings Pages
**File:** `packages/web/src/routes/.../settings/index.tsx`
**File:** `packages/web/src/routes/.../settings/authorization-audit.tsx`

**Selects:** Various settings selectors

**Recommendation:** Evaluate per-use, most can stay as Select

---

## Implementation Plan

### Phase 1: Update Specialized Select Components
1. [ ] Update `CurrencySelect` to use Combobox internally
2. [ ] Update `JurisdictionSelect` to use Combobox internally
3. [ ] (Optional) Update `ConsolidationMethodSelect` for consistency

### Phase 2: Update Form Components
4. [ ] Update `AccountForm` - Parent Account selector
5. [ ] Update `OrganizationForm` - Industry selector
6. [ ] Update intercompany forms - Company selectors

### Phase 3: Update Page Selectors
7. [ ] Update company selectors in consolidation pages
8. [ ] Update user selectors in policy builder
9. [ ] Review and update remaining as needed

---

## Guidelines

### When to use Combobox vs Select

**Use Combobox when:**
- More than ~10-15 options
- Options are not easily scannable (long names, codes)
- Users likely know what they're looking for
- List includes searchable attributes (code + name)

**Keep Select when:**
- 10 or fewer options
- Options are a simple enum (Status, Type, Category)
- Users need to see all options to choose
- Options are mutually exclusive states

### Combobox Component API

```tsx
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox"

const options: ComboboxOption[] = [
  { value: "usd", label: "USD - US Dollar", searchText: "united states america" },
  { value: "eur", label: "EUR - Euro", searchText: "european union" },
]

<Combobox
  value={selectedValue}
  onChange={setSelectedValue}
  options={options}
  placeholder="Search..."
  disabled={false}
  data-testid="currency-select"
/>
```

**Props:**
- `value`: Currently selected value
- `onChange`: Callback when value changes
- `options`: Array of `{ value, label, searchText?, disabled? }`
- `placeholder`: Placeholder text
- `disabled`: Whether disabled
- `className`: Additional styling
- `data-testid`: For E2E testing

### E2E Testing Helper

Since Combobox is not a native `<select>`, use this helper function in E2E tests:

```typescript
/**
 * Helper to select an option from a Combobox component.
 * The Combobox is a div-based searchable dropdown, not a native select.
 */
async function selectComboboxOption(
  page: Page,
  testId: string,
  searchText: string
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)

  // Click to open the combobox dropdown
  await combobox.click()

  // Wait for dropdown to open and input to be visible
  await page.waitForTimeout(100)

  // Type to filter options
  const input = combobox.locator("input")
  await input.fill(searchText)

  // Wait for filtering to complete
  await page.waitForTimeout(100)

  // Click the first matching option in the dropdown
  // The dropdown is rendered in a FloatingPortal, so we need to look for it globally
  const option = page.locator(`li:has-text("${searchText}")`).first()
  await option.click()

  // Wait for dropdown to close
  await page.waitForTimeout(100)
}
```

**Usage:**
```typescript
// Instead of: await page.locator('[data-testid="account-select"]').selectOption({ label: "1000 - Cash" })
// Use:
await selectComboboxOption(page, "account-select", "1000 - Cash")
```
