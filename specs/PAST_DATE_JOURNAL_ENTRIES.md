# Past Date Journal Entries Spec

## Problem Statement

Users report that it is not possible to write journal entries with past dates. This is a critical issue because:

1. **Historical data entry** - Users frequently need to enter transactions that occurred in the past (e.g., receipts found later, corrections, backdated entries)
2. **Synthetic data generation** - The synthetic data generator script needs to create entries for 2024-2025 (past years relative to current date 2026)
3. **Multi-year accounting** - Accounting systems must support entering data for prior periods

## Status: RESOLVED

After thorough investigation, **no code restrictions were found that prevent past date journal entries**. The system accepts any valid date from year 1 to year 9999.

### Investigation Results

| Layer | File | Date Validation | Status |
|-------|------|-----------------|--------|
| **Domain Schema** | `packages/core/src/Domains/LocalDate.ts` | Format only (YYYY-MM-DD), year 1-9999, month 1-12, day 1-31 | OK |
| **Service Layer** | `packages/core/src/Services/JournalEntryService.ts` | No date validation (period validation deliberately removed) | OK |
| **API Definitions** | `packages/api/src/Definitions/JournalEntriesApi.ts` | Uses `LocalDateFromString` - accepts any valid date | OK |
| **API Handlers** | `packages/api/src/Layers/JournalEntriesApiLive.ts` | Passes date through without validation | OK |
| **Repository** | `packages/persistence/src/Services/JournalEntryRepository.ts` | No date constraints | OK |
| **Database** | `packages/persistence/src/Migrations/` | No CHECK constraints on dates | OK |
| **Frontend Form** | `packages/web/src/components/forms/JournalEntryForm.tsx` | No `min`/`max` attributes on date input | OK |

### Conclusion

The original issue was likely user confusion or a transient browser issue. The system fully supports past date journal entries.

---

## Completed Tasks

### Phase 1: Investigation COMPLETED

- [x] Manually tested creating journal entries with various past dates via the UI
- [x] Verified no JavaScript errors when selecting past dates
- [x] Confirmed API accepts all past dates (2024, 2000, 1900)
- [x] Verified fiscal period computation works correctly for past dates

### Phase 2: Testing COMPLETED

- [x] Added E2E tests for past date journal entries (`packages/web/test-e2e/journal-entries-past-dates.spec.ts`)
  - Test 1: Create journal entry with date from previous year (2024)
  - Test 2: Create journal entry with date from 2 years ago via API
  - Test 3: Create journal entry on fiscal year boundary (Dec 31)
  - Test 4: Create journal entry on fiscal year boundary (Jan 1)
  - Test 5: Fiscal period displays correctly for various past dates
  - Test 6: Create journal entry with very old date (year 2000)

- [x] Added unit tests for LocalDate schema with historical dates (`packages/core/test/Domains/LocalDate.test.ts`)
  - Test: accepts dates from previous years (2024, 2020)
  - Test: accepts dates far in the past (year 2000, 1900, year 1)
  - Test: parses past dates from previous years via LocalDateFromString

### Phase 3: Verified Robust Past Date Support COMPLETED

- [x] All E2E tests pass for past date scenarios (6 tests)
- [x] All unit tests pass for LocalDate with historical dates
- [x] Fiscal period correctly computed for any past date based on company fiscal year end
- [x] No regression in existing functionality

---

## Expected Behavior (Verified)

1. **UI**: Users can select any valid past date in the date picker
2. **API**: All past dates are accepted without error
3. **Fiscal Period**: Correctly computed for any past date based on company fiscal year end
4. **Synthetic Data**: Generator script runs successfully with 2024-2025 dates
5. **Feedback**: Clear error messages if a date is rejected (e.g., for closed periods - not implemented)

---

## Test Files Added

| File | Description |
|------|-------------|
| `packages/web/test-e2e/journal-entries-past-dates.spec.ts` | E2E tests for past date journal entries |
| `packages/core/test/Domains/LocalDate.test.ts` | Extended with historical date unit tests |

---

## Future Enhancements (Optional)

If the organization wants to control which periods accept entries:

- [ ] Implement fiscal period status tracking (Open, Closed, Locked)
- [ ] Add UI for period management
- [ ] Add soft warnings (not hard blocks) for entries in closed periods
- [ ] Add audit trail for entries made in closed periods

These are optional enhancements for future consideration. The current system intentionally allows unrestricted past date entry, which is the standard behavior for accounting systems.

---

## Notes

- **No hard restrictions on past dates** - Accounting systems need to support historical entries
- **Soft warnings acceptable** - May warn about closed periods but should still allow entry (not implemented)
- **Audit trail important** - Track who entered what and when for compliance (already implemented via createdAt/updatedAt)
- **Fiscal period display** - Shows the correct period for the selected date (verified)
