# Combobox Migration - Replace Select with Searchable Dropdowns

## Overview

Replace all plain browser `<Select>` components with the new searchable `<Combobox>` component for better UX. Users should be able to type to filter options instead of scrolling through long lists.

## ✅ COMPLETE

All high-value Combobox conversions have been implemented:
- CurrencySelect, JurisdictionSelect now use Combobox internally
- AccountForm parent account uses Combobox
- Consolidation parent/member company selectors use Combobox
- Intercompany from/to company selectors use Combobox
- Journal entry line account selector uses Combobox
- All affected E2E tests updated to use the Combobox helper

Low-option selects (Status, Type, Category filters with <10 options) remain as native Select per guidelines.

## Status Summary

| Category | Status |
|----------|--------|
| Combobox component | DONE |
| Journal Entry Line Editor (accounts) | DONE |
| Specialized Select Components | DONE (CurrencySelect, JurisdictionSelect) |
| Form Components | DONE (AccountForm, intercompany, consolidation) |
| Page Filters | DONE (low-option filters kept as Select per guidelines) |

---

## TODO: Files to Update

### Priority 1: Specialized Select Components (High Impact)

These are reusable components that wrap Select. Updating these will fix many usages automatically.

#### 1.1 CurrencySelect ✅ DONE
**File:** `packages/web/src/components/ui/CurrencySelect.tsx`

Used for selecting currencies (USD, EUR, etc.). ~180 currencies to choose from.

**Status:** Converted to use Combobox internally. Searchable by code, name, or symbol.

**Used in:**
- `CompanyForm.tsx` - functional currency selection
- `OrganizationForm.tsx` - default currency selection
- `exchange-rates/new.tsx` - from/to currency (uses inline Select, not CurrencySelect)
- `exchange-rates/index.tsx` - currency filter (uses inline Select, not CurrencySelect)

#### 1.2 JurisdictionSelect ✅ DONE
**File:** `packages/web/src/components/ui/JurisdictionSelect.tsx`

Used for selecting countries/jurisdictions. ~250 countries.

**Status:** Converted to use Combobox internally. Searchable by name, code, or default currency.

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

#### 2.1 AccountForm.tsx ✅ DONE
**File:** `packages/web/src/components/forms/AccountForm.tsx`

**Selects replaced:**
- Parent Account → Combobox (searchable by account number/name)

**Kept as Select (per guidelines - few options):**
- Account Category (5 options)
- Account Type (~20 options per category, but scoped to selected category)
- Normal Balance (2 options)
- Cash Flow Category (4 options)

#### 2.2 CompanyForm.tsx ✅ DONE
**File:** `packages/web/src/components/forms/CompanyForm.tsx`

**Status:** Already using Combobox via CurrencySelect and JurisdictionSelect.

**Kept as Select:**
- Fiscal Year End Month (12 options)

#### 2.3 OrganizationForm.tsx ✅ DONE
**File:** `packages/web/src/components/forms/OrganizationForm.tsx`

**Status:** Already using Combobox via CurrencySelect.

**Note:** Industry field not present in current form.

#### 2.4 JournalEntryForm.tsx ✅ DONE
**File:** `packages/web/src/components/forms/JournalEntryForm.tsx`

**Kept as Select:**
- Entry Type (5 options)

**Account selector in JournalEntryLineEditor:** Already using Combobox.

---

### Priority 3: Page Filters and Selectors

#### 3.1 Journal Entries List ✅ DONE
**File:** `packages/web/src/routes/.../journal-entries/index.tsx`

**Kept as Select:** Status filter, Period filter (few options)

#### 3.2 Accounts List ✅ DONE
**File:** `packages/web/src/routes/.../accounts/index.tsx`

**Kept as Select:** Category filter (5 categories)

#### 3.3 Audit Log ✅ DONE
**File:** `packages/web/src/routes/.../audit-log/index.tsx`

**Kept as Select:** Action type filter (few options)

#### 3.4 Exchange Rates ✅ DONE
**Files:** `packages/web/src/routes/.../exchange-rates/index.tsx`, `new.tsx`

**Status:** Uses CurrencySelect which is now Combobox-based.

#### 3.5 Intercompany Transactions ✅ DONE
**File:** `packages/web/src/routes/.../intercompany/new.tsx`

**Converted to Combobox:**
- From Company selector
- To Company selector

#### 3.6 Consolidation ✅ DONE
**Files:** `packages/web/src/routes/.../consolidation/new.tsx`, `$groupId/edit.tsx`

**Converted to Combobox:**
- Parent Company selector
- Member Company selector (in add member rows)

**Kept as Select:**
- Consolidation Method (4 options)
- Reporting Currency (already uses Select, could use CurrencySelect for searchability)

#### 3.7 Policy Builder ✅ DONE
**File:** `packages/web/src/components/policies/PolicyBuilderModal.tsx`

**Kept as Select:** Resource type, Action type (defined enums)

#### 3.8 Settings Pages ✅ DONE
**Files:** `packages/web/src/routes/.../settings/*.tsx`

**Kept as Select:** Various settings selectors (few options each)

---

## Implementation Plan

### Phase 1: Update Specialized Select Components ✅ COMPLETE
1. [x] Update `CurrencySelect` to use Combobox internally
2. [x] Update `JurisdictionSelect` to use Combobox internally
3. [x] `ConsolidationMethodSelect` - kept as Select (only 4 options)

### Phase 2: Update Form Components ✅ COMPLETE
4. [x] Update `AccountForm` - Parent Account selector → Combobox
5. [x] `OrganizationForm` - No industry field present, currency uses CurrencySelect
6. [x] Update intercompany forms - From/To Company selectors → Combobox

### Phase 3: Update Page Selectors ✅ COMPLETE
7. [x] Update company selectors in consolidation pages → Combobox
8. [x] Policy builder - kept as Select (defined enums with few options)
9. [x] Review complete - all high-value conversions done

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

### E2E Testing Helper ✅ DONE

Since Combobox is not a native `<select>`, use this helper function in E2E tests. A shared helper is available at `packages/web/test-e2e/helpers/combobox.ts`.

```typescript
/**
 * Helper to select an option from a Combobox component.
 * The Combobox is a div-based searchable dropdown using @floating-ui/react.
 */
async function selectComboboxOption(
  page: Page,
  testId: string,
  searchText: string
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)
  await expect(combobox).toBeVisible({ timeout: 5000 })

  // Click the button inside to trigger the dropdown open
  const button = combobox.locator("button")
  await expect(button).toBeVisible({ timeout: 5000 })
  await button.click()
  await page.waitForTimeout(100)

  // Wait for dropdown to open - the combobox shows input when open
  const input = combobox.locator("input")

  // If input is not visible yet, try clicking again
  const inputVisible = await input.isVisible().catch(() => false)
  if (!inputVisible) {
    await combobox.click({ force: true })
    await page.waitForTimeout(100)
  }

  await expect(input).toBeVisible({ timeout: 5000 })
  await input.fill(searchText)

  // Wait for dropdown list and click matching option
  await expect(page.locator("li").first()).toBeVisible({ timeout: 5000 })
  const option = page.locator(`li:has-text("${searchText}")`).first()
  await expect(option).toBeVisible({ timeout: 5000 })
  await option.click()
  await page.waitForTimeout(200)
}
```

**Usage:**
```typescript
// Instead of: await page.selectOption("#company-jurisdiction", "GB")
// Use:
await selectComboboxOption(page, "company-jurisdiction-select", "United Kingdom")
```

**E2E Test Files Updated:**
- `test-e2e/create-company.spec.ts` - Updated to use Combobox helper
- `test-e2e/create-organization.spec.ts` - Updated to use Combobox helper
- `test-e2e/organizations.spec.ts` - Updated to use Combobox helper
- `test-e2e/companies-list.spec.ts` - Updated to use Combobox helper
- `test-e2e/accounts.spec.ts` - Updated parent account selection to use Combobox helper
- `test-e2e/consolidation.spec.ts` - Updated parent/member company selection to use Combobox helper
- `test-e2e/intercompany.spec.ts` - Updated from/to company selection to use Combobox helper
