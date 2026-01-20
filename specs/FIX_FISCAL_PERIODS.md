# Fiscal Periods Page Fixes

This spec documents the UX issues on the fiscal periods page and the required fixes.

**File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/fiscal-periods/index.tsx`

## Issues Summary

| Issue | Severity | Description |
|-------|----------|-------------|
| Create fiscal year doesn't update list | High | User must refresh page to see newly created fiscal year |
| Period "Open" action doesn't update list | High | User must refresh page to see status change |
| Action button icons misaligned | Medium | Icons not vertically centered with button text |
| Silent error handling | Low | Errors are swallowed without user feedback |

---

## Issue 1: Create Fiscal Year Doesn't Update List

### Current Behavior
After creating a fiscal year, the modal closes but the list doesn't show the new fiscal year. User must manually refresh the page.

### Root Cause
In `CreateFiscalYearModal.handleSubmit()` (line 337-338):
```typescript
onCreated()
onClose()
```

The `onCreated` callback maps to `handleRefresh` (line 940-942):
```typescript
const handleRefresh = () => {
  router.invalidate()
}
```

The problem is `router.invalidate()` is not awaited. The modal closes immediately via `onClose()` before the invalidation and re-fetch completes.

### Fix
1. Make `handleRefresh` async and await the invalidation:
```typescript
const handleRefresh = async () => {
  await router.invalidate()
}
```

2. Await `onCreated()` in the modal before closing:
```typescript
await onCreated()
onClose()
```

3. Update `CreateFiscalYearModal` props to accept `onCreated: () => Promise<void>` instead of `onCreated: () => void`.

---

## Issue 2: Period "Open" Action Doesn't Update List

### Current Behavior
When clicking "Open" (or other period actions like "Soft Close", "Close", "Lock"), the action succeeds but the period status badge doesn't update. User must refresh the page.

### Root Cause
In `handlePeriodAction` (lines 655-658):
```typescript
if (!error) {
  setPeriodsLoaded(false)
  await loadPeriods()
}
```

The code attempts to reload periods, but there are two potential issues:

1. **Race condition**: `setPeriodsLoaded(false)` triggers a state update, but `loadPeriods()` might not wait for the state to settle before fetching. Looking at `loadPeriods()` (lines 593-626), it checks `periodsLoaded` synchronously but the state update from `setPeriodsLoaded(false)` is async.

2. **API caching**: The `api.GET()` call might be returning cached data.

### Fix
1. Change the reload logic to force a fresh fetch regardless of `periodsLoaded` state:
```typescript
if (!error) {
  // Force reload by resetting state and fetching
  setPeriods([])
  setIsLoadingPeriods(true)
  const { data } = await api.GET(
    "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods",
    {
      params: { path: { organizationId, companyId, fiscalYearId: fiscalYear.id } }
    }
  )
  if (data) {
    setPeriods(data.periods)
  }
  setIsLoadingPeriods(false)
  setPeriodsLoaded(true)
}
```

2. Alternatively, extract the fetch logic into a separate function that doesn't depend on `periodsLoaded`:
```typescript
const fetchPeriods = async () => {
  setIsLoadingPeriods(true)
  const { data } = await api.GET(/* ... */)
  if (data) {
    setPeriods(data.periods)
  }
  setIsLoadingPeriods(false)
}

// In handlePeriodAction:
if (!error) {
  await fetchPeriods()
}
```

---

## Issue 3: Action Button Icons Misaligned

### Current Behavior
The icons in the period action buttons (Open, Soft Close, Close, Lock, Reopen) are not properly aligned with the text. They appear shifted or misaligned vertically.

### Root Cause
In the action buttons (lines 848-866):
```typescript
<Button variant="ghost" size="sm" ...>
  <ActionIcon className="mr-1 h-4 w-4" />
  {label}
</Button>
```

**Problem 1**: Icons are passed as children, not via the `icon` prop.

The `Button` component (Button.tsx lines 76-82) has built-in icon handling:
```typescript
{icon ? (
  <span className="flex-shrink-0">{icon}</span>
) : null}
{children && <span>{children}</span>}
```

When icons are passed via `icon` prop, they're wrapped in `flex-shrink-0` for proper alignment. When passed as children, they're just rendered inline with text.

**Problem 2**: Redundant `mr-1` margin class.

The Button already has gap handling via `sizeStyles` (line 28):
```typescript
sm: "px-3 py-1.5 text-sm gap-1.5"
```

The `mr-1` (0.25rem) on the icon PLUS the `gap-1.5` (0.375rem) from the button creates inconsistent spacing (0.625rem total vs expected 0.375rem).

**Problem 3**: Icon size mismatch.

Status badges use `h-3 w-3` icons while action buttons use `h-4 w-4`. This inconsistency, combined with the alignment issues, makes the page look unpolished.

### Fix
Change the action buttons to use the `icon` prop:
```typescript
<Button
  variant="ghost"
  size="sm"
  icon={<ActionIcon className="h-4 w-4" />}
  onClick={() => handlePeriodAction(period, action)}
  disabled={actionLoading === period.id}
  data-testid={`period-${action}-${period.periodNumber}`}
>
  {label}
</Button>
```

Remove `mr-1` class - the Button's gap handles spacing automatically.

---

## Issue 4: Silent Error Handling

### Current Behavior
In `handlePeriodAction` (lines 660-661):
```typescript
} catch {
  // Handle error silently
}
```

Errors are swallowed. The user gets no feedback if an action fails.

### Fix
Add toast notifications or inline error messages:
```typescript
} catch (err) {
  // Show error to user
  toast.error("Failed to update period status. Please try again.")
}
```

If the project doesn't have a toast system, show inline error:
```typescript
const [actionError, setActionError] = useState<string | null>(null)

// In catch block:
setActionError(`Failed to ${action} period. Please try again.`)

// In render, show error banner when actionError is set
```

---

## Implementation Checklist

- [x] **Issue 1**: Make `handleRefresh` async and await `router.invalidate()`
- [x] **Issue 1**: Update `CreateFiscalYearModal` to await `onCreated()` before `onClose()`
- [x] **Issue 2**: Fix period action reload to not depend on stale state
- [x] **Issue 3**: Change action buttons to use `icon` prop instead of inline icon
- [x] **Issue 3**: Remove `mr-1` class from action icons
- [x] **Issue 4**: Add user-facing error feedback for failed actions
- [x] Run `pnpm test && pnpm typecheck` to verify no regressions
- [ ] Manually test: create fiscal year → verify list updates immediately
- [ ] Manually test: click "Open" on period → verify status updates immediately
- [ ] Visually verify icon alignment in action buttons

---

## Additional UX Improvements (Optional)

These are not critical but would improve the overall experience:

1. **Loading states during actions**: Show a spinner on the specific action button while the action is in progress (partially implemented via `actionLoading` state).

2. **Optimistic updates**: Update the UI immediately when an action is clicked, then revert if the API call fails. This makes the UI feel faster.

3. **Confirmation for destructive actions**: "Lock" is irreversible - consider adding a confirmation dialog.

4. **Keyboard accessibility**: Ensure all action buttons are keyboard accessible (already should be since they're `<button>` elements).

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/web/src/routes/organizations/$organizationId/companies/$companyId/fiscal-periods/index.tsx` | All fixes |
| `packages/web/src/components/ui/Button.tsx` | No changes needed (already supports `icon` prop) |
