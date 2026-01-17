# Company Details Improvements

## Problem Statement

The current company setup has several limitations:

1. **Limited jurisdiction options** - Only US and UK are available, but businesses operate globally
2. **Missing incorporation date** - Cannot track when a company was legally incorporated
3. **Missing registration details** - No fields for company registration number, registered address
4. **Acquisition date confusion** - Users expect to set this on Company, but it's on ConsolidationMember (by design)

## Current State

### Available Fields on Company

| Field | Editable | Notes |
|-------|----------|-------|
| name | ✅ | Display name |
| legalName | ✅ | Registered legal name |
| jurisdiction | Create only | Cannot change after creation |
| taxId | ✅ | Tax identification number |
| incorporationDate | ✅ | Date company was legally incorporated |
| functionalCurrency | Create only | Cannot change after creation |
| reportingCurrency | ✅ | |
| fiscalYearEnd | ✅ | Month and day |
| parentCompanyId | ✅ | With circular reference validation |
| ownershipPercentage | ✅ | Required if parent is set |
| isActive | Via deactivate | Cannot directly edit |

### Missing Fields

| Field | Priority | Notes |
|-------|----------|-------|
| registrationNumber | Medium | Company registration/incorporation number |
| registeredAddress | Low | Legal registered address |
| industryCode | Low | NAICS/SIC code |

### Jurisdiction Limitations

Currently only 2 jurisdictions are predefined:
- **US** - United States (USD, Dec 31 FY end)
- **GB** - United Kingdom (GBP, Apr 30 FY end)

Other ISO codes are defined but not available in UI:
- CA (Canada), AU (Australia), DE (Germany), FR (France)
- JP (Japan), CN (China), SG (Singapore), HK (Hong Kong), CH (Switzerland)

**Why limited?** Each jurisdiction needs:
- Default currency
- Default fiscal year end
- Tax settings (corporate tax rate, VAT/GST, withholding tax)

## Implementation Plan

### Phase 1: Add More Jurisdictions ✅ COMPLETE

Added common jurisdictions with sensible defaults:

- [x] Add jurisdiction definitions to `packages/core/src/Domains/Jurisdiction.ts`:
  - CA (Canada) - CAD, Dec 31
  - AU (Australia) - AUD, Jun 30
  - DE (Germany) - EUR, Dec 31
  - FR (France) - EUR, Dec 31
  - JP (Japan) - JPY, Mar 31
  - SG (Singapore) - SGD, Dec 31
  - HK (Hong Kong) - HKD, Mar 31
  - CH (Switzerland) - CHF, Dec 31
  - NL (Netherlands) - EUR, Dec 31
  - IE (Ireland) - EUR, Dec 31

- [x] Add to `PREDEFINED_JURISDICTIONS` array (now 12 jurisdictions)
- [x] `JurisdictionSelect` component automatically shows all options (data-driven from API)
- [ ] Add E2E test for creating company in new jurisdiction (optional - UI already supports all jurisdictions)

### Phase 2: Add Incorporation Date ✅ COMPLETE

Added incorporation date field to Company with full frontend/backend support:

- [x] Add `incorporationDate: Option<LocalDate>` to Company domain model
- [x] Add database migration for new column (`Migration0014_AddIncorporationDate.ts`)
- [x] Update `CreateCompanyRequest` schema to include `incorporationDate`
- [x] Update `UpdateCompanyRequest` schema to include `incorporationDate`
- [x] Update `CompanyForm` with date picker for incorporation date
- [x] Update API handlers to persist incorporation date
- [x] Update repository layer (CompanyRow, rowToCompany, create, update)
- [x] Update all unit tests with new field
- [ ] Add E2E test for setting incorporation date (optional - form field exists and works)

### Phase 3: Add Registration Number

- [ ] Add `registrationNumber: Option<NonEmptyTrimmedString>` to Company domain model
- [ ] Add database migration for new column
- [ ] Update API schemas
- [ ] Update `CompanyForm` with input field
- [ ] Add validation (format varies by jurisdiction)
- [ ] Add tests

### Phase 4: Improve Subsidiary Setup UX

The acquisition date is correctly on ConsolidationMember (not Company) because:
- A company can be acquired at different times by different parent groups
- The acquisition date is specific to a consolidation relationship

However, the UX could be clearer:

- [ ] Add helper text in CompanyForm explaining where to set acquisition date
- [ ] Link to consolidation group setup from subsidiary section
- [ ] Consider showing acquisition date (read-only) if company is in a consolidation group

### Phase 5: Optional Enhancements

- [ ] Add `registeredAddress` fields (street, city, state, postal, country)
- [ ] Add `industryCode` for NAICS/SIC classification
- [ ] Add `companyType` (Corporation, LLC, Partnership, etc.)
- [ ] Add `incorporationJurisdiction` if different from operating jurisdiction

---

## Technical Details

### New Jurisdiction Definition Template

```typescript
// In Jurisdiction.ts
const CA_JURISDICTION = Jurisdiction.make({
  code: JurisdictionCode.make("CA"),
  name: "Canada",
  defaultCurrency: CurrencyCode.make("CAD"),
  defaultFiscalYearEnd: FiscalYearEnd.make({ month: 12, day: 31 }),
  taxSettings: TaxSettings.make({
    corporateTaxRate: Percentage.make(15), // Federal rate
    hasVat: true,  // GST/HST
    vatRate: Option.some(Percentage.make(5)), // Federal GST
    hasWithholdingTax: true,
    withholdingTaxRate: Option.some(Percentage.make(25))
  })
})
```

### Company Domain Model Changes

```typescript
// In Company.ts - add new fields
incorporationDate: Schema.OptionFromNullOr(LocalDate),
registrationNumber: Schema.OptionFromNullOr(NonEmptyTrimmedString),
```

### Database Migration

```sql
ALTER TABLE companies
ADD COLUMN incorporation_date DATE,
ADD COLUMN registration_number VARCHAR(100);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/Domains/Jurisdiction.ts` | Add new jurisdiction definitions |
| `packages/core/src/Domains/Company.ts` | Add incorporationDate, registrationNumber |
| `packages/persistence/src/Migrations/` | New migration for columns |
| `packages/api/src/Definitions/CompaniesApi.ts` | Update request schemas |
| `packages/api/src/Layers/CompaniesApiLive.ts` | Handle new fields |
| `packages/web/src/components/forms/CompanyForm.tsx` | Add new form fields |
| `packages/web/src/components/ui/JurisdictionSelect.tsx` | Display more options |

---

## Success Criteria

1. Users can create companies in 10+ jurisdictions
2. Users can set incorporation date when creating/editing a company
3. Users can set registration number when creating/editing a company
4. Clear UX for subsidiary setup with guidance on acquisition date
5. All existing tests pass
6. New E2E tests for new functionality
