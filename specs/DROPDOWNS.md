# Dropdown Design Improvements

## Problem Statement

The current dropdown implementations have visual inconsistencies:

1. **Chevron positioned too far right** - The down arrow at `right-3` (12px from edge) looks disconnected from the content and doesn't align well with other UI elements
2. **Inconsistent patterns** - Some dropdowns have custom chevrons, some rely on browser native, some only show spinners
3. **Asymmetric padding** - `pl-3 pr-9` creates visual imbalance
4. **No visual hierarchy** - Chevrons use `text-gray-500` which can look too subtle

## Current State

### Select.tsx (main dropdown component)
```tsx
// Current: Chevron too far right, asymmetric padding
<select className="pl-3 pr-9 ...">
<ChevronDown className="absolute right-3 top-1/2 h-4 w-4 text-gray-500" />
```

### CurrencySelect.tsx / JurisdictionSelect.tsx
```tsx
// Current: No chevron at all, only spinner when loading
<select className="px-3 py-2 ...">
{isLoading && <Spinner className="absolute right-3" />}
// Missing: chevron when not loading
```

### OrganizationSelector.tsx (custom dropdown)
```tsx
// Current: Uses flex gap which works better
<button className="flex items-center gap-2 ...">
  <Icon />
  <span>Text</span>
  <ChevronDown className="h-4 w-4 text-gray-500" />
</button>
```

## Design Solution

### 1. Adjust Chevron Positioning

**Change from `right-3` to `right-2.5`** (10px) for better visual balance:

```tsx
// Before
<ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />

// After
<ChevronDown className="absolute right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
```

Changes:
- `right-3` → `right-2.5` - Brings chevron slightly closer to edge for better alignment
- `h-4 w-4` → `h-5 w-5` - Slightly larger icon (20px) for better visibility
- `text-gray-500` → `text-gray-400` - Lighter color to reduce visual weight

### 2. Adjust Select Padding

**Use symmetric base padding with right adjustment:**

```tsx
// Before
<select className="pl-3 pr-9 ...">

// After
<select className="pl-3 pr-8 ...">
```

Changes:
- `pr-9` → `pr-8` - Reduces right padding (32px instead of 36px) for tighter chevron placement

### 3. Add Chevron to All Selects

CurrencySelect and JurisdictionSelect should show a chevron when not loading:

```tsx
// After
{isLoading ? (
  <Spinner className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5" />
) : (
  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
)}
```

### 4. Consistent Hover/Focus States

Add subtle color change on hover/focus:

```tsx
// Container with group class
<div className="relative group">
  <select className="peer ...">
  <ChevronDown className="... text-gray-400 peer-hover:text-gray-600 peer-focus:text-gray-600" />
</div>
```

---

## Implementation Tasks

### Phase 1: Update Core Select Component

- [ ] Update `packages/web/src/components/ui/Select.tsx`
  - Change chevron positioning from `right-3` to `right-2.5`
  - Change chevron size from `h-4 w-4` to `h-5 w-5`
  - Change chevron color from `text-gray-500` to `text-gray-400`
  - Change select padding from `pr-9` to `pr-8`
  - Add hover/focus color transition

### Phase 2: Update Currency/Jurisdiction Selects

- [ ] Update `packages/web/src/components/ui/CurrencySelect.tsx`
  - Add chevron icon when not loading
  - Use same positioning/sizing as Select.tsx
  - Update padding to `pr-8`

- [ ] Update `packages/web/src/components/ui/JurisdictionSelect.tsx`
  - Add chevron icon when not loading
  - Use same positioning/sizing as Select.tsx
  - Update padding to `pr-8`

### Phase 3: Update Other Dropdowns

- [ ] Update `packages/web/src/components/ui/ConsolidationMethodSelect.tsx`
  - Add custom chevron (currently uses browser native)
  - Match styling with Select.tsx

- [ ] Update `packages/web/src/components/ui/FiscalYearEndPicker.tsx`
  - Add custom chevrons to month/day selects
  - Match styling with Select.tsx

- [ ] Review inline selects in forms (CompanyForm parent select, JournalEntryLineEditor account select)
  - Decide: use Select component or add custom chevrons

### Phase 4: Verify Visual Consistency

- [ ] Visual review of all dropdowns in the app
- [ ] Ensure chevrons align with other icons (sidebar, buttons, etc.)
- [ ] Test hover/focus states
- [ ] Test disabled states

---

## CSS Reference

### Final Select Classes

```tsx
// Select element
className={clsx(
  "w-full rounded-lg border py-2 pl-3 pr-8 text-gray-900 bg-white",
  "focus:outline-none focus:ring-2 focus:ring-offset-0",
  "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
  "appearance-none cursor-pointer",
  hasError
    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
)}

// Chevron icon
className="pointer-events-none absolute right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
```

### Spacing Visual

```
┌─────────────────────────────────────────┐
│ pl-3      Selected Value          ▼    │ pr-8
│ (12px)                          (10px) │ (32px total)
│           ←── content area ──→  right-2.5
└─────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/web/src/components/ui/Select.tsx` | Chevron position, size, color, padding |
| `packages/web/src/components/ui/CurrencySelect.tsx` | Add chevron, update padding |
| `packages/web/src/components/ui/JurisdictionSelect.tsx` | Add chevron, update padding |
| `packages/web/src/components/ui/ConsolidationMethodSelect.tsx` | Add custom chevron |
| `packages/web/src/components/ui/FiscalYearEndPicker.tsx` | Add custom chevrons |

---

## Success Criteria

1. All dropdowns have consistent chevron styling
2. Chevrons are visually balanced (not too far right)
3. Chevron size (20px) matches other icons in the UI
4. Hover/focus states provide subtle feedback
5. No visual regression in existing functionality
