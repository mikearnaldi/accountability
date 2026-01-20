# Company Details Improvements

## Status: ✅ ALL PHASES COMPLETE

All 5 phases of company details improvements have been implemented:
- **Phase 1**: Added 10 new jurisdictions (CA, AU, DE, FR, JP, SG, HK, CH, NL, IE)
- **Phase 2**: Added incorporation date field
- **Phase 3**: Added registration number field
- **Phase 4**: Improved subsidiary setup UX with helper text and links
- **Phase 5**: Added optional enhancements (registeredAddress, industryCode, companyType, incorporationJurisdiction)

### Phase 6: Acquisition Date for Consolidation Members ✅ COMPLETE

Fixed the issue where acquisition dates for subsidiaries in consolidation groups could not be set:

- **Problem**: Acquisition date was hard-coded to "today" when adding members to consolidation groups
- **Solution**: Added `acquisitionDate` field to API request schemas and UI forms

**Changes Made:**
- Added `acquisitionDate` (optional) to `GroupMemberInput` schema - used when creating a group with initial members
- Added `acquisitionDate` (optional) to `AddMemberRequest` schema - used when adding a member to an existing group
- Added `acquisitionDate` to `UpdateMemberRequest` schema - used when editing a member's details
- Updated `ConsolidationApiLive` handlers to use provided acquisition date (defaults to today if not provided)
- Added acquisition date date picker to consolidation group create form (new.tsx)
- Added acquisition date date picker to consolidation group edit form (edit.tsx)
- Regenerated API client with new schema fields

---

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
| registrationNumber | ✅ | Company registration/incorporation number |
| registeredAddress | ✅ | Legal registered address (street1, street2, city, state, postalCode, country) |
| industryCode | ✅ | NAICS/SIC industry classification code |
| companyType | ✅ | Corporation, LLC, Partnership, etc. |
| incorporationJurisdiction | ✅ | Jurisdiction where company was incorporated (if different) |
| functionalCurrency | Create only | Cannot change after creation |
| reportingCurrency | ✅ | |
| fiscalYearEnd | ✅ | Month and day |
| parentCompanyId | ✅ | With circular reference validation |
| ownershipPercentage | ✅ | Required if parent is set |
| isActive | Via deactivate | Cannot directly edit |

### Additional Fields ✅ IMPLEMENTED (Phase 5)

| Field | Type | Notes |
|-------|------|-------|
| registeredAddress | Option<Address> | Legal registered address (street1, street2, city, state, postalCode, country) |
| industryCode | Option<string> | NAICS/SIC code |
| companyType | Option<CompanyType> | Corporation, LLC, Partnership, SoleProprietorship, NonProfit, Cooperative, Branch, Other |
| incorporationJurisdiction | Option<JurisdictionCode> | If different from operating jurisdiction |

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
- [x] Add E2E test for creating company in new jurisdiction (test: create-company.spec.ts - "should create company in new jurisdiction (Canada)")

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
- [x] Add E2E test for setting incorporation date (test: create-company.spec.ts - "should create company with incorporation date")

### Phase 3: Add Registration Number ✅ COMPLETE

Added registration number field to Company with full frontend/backend support:

- [x] Add `registrationNumber: Option<NonEmptyTrimmedString>` to Company domain model
- [x] Add database migration for new column (`Migration0015_AddRegistrationNumber.ts`)
- [x] Update `CreateCompanyRequest` schema to include `registrationNumber`
- [x] Update `UpdateCompanyRequest` schema to include `registrationNumber`
- [x] Update `CompanyForm` with registration number input field
- [x] Update `EditCompanyModal` with registration number input field
- [x] Update API handlers (CompaniesApiLive) to persist registration number
- [x] Update repository layer (CompanyRow, rowToCompany, create, update)
- [x] Generate new API client with updated schema
- [x] Update all unit tests with new field
- [x] Add E2E test for setting registration number (test: create-company.spec.ts - "should create company with registration number")

### Phase 4: Improve Subsidiary Setup UX ✅ COMPLETE

The acquisition date is correctly on ConsolidationMember (not Company) because:
- A company can be acquired at different times by different parent groups
- The acquisition date is specific to a consolidation relationship

UX improvements implemented:

- [x] Add helper text in CompanyForm explaining where to set acquisition date
  - Added info box in "Subsidiary Configuration" section explaining that acquisition date and consolidation method are configured in Consolidation Groups
- [x] Link to consolidation group setup from subsidiary section
  - Added info box with clickable link to Consolidation Groups page on company detail page (shown for subsidiaries)
- [x] Consider showing acquisition date (read-only) if company is in a consolidation group
  - **Decision: Not implemented** - Would require additional API calls to fetch all consolidation groups and find memberships. The helper text + link already guides users to the right place. A company can be in multiple consolidation groups with different acquisition dates, making read-only display confusing. Users can click the link to see full consolidation details.

### Phase 5: Optional Enhancements ✅ COMPLETE

Added all optional enhancement fields to Company with full frontend/backend support:

- [x] Add `registeredAddress` fields (street1, street2, city, state, postalCode, country)
  - Created `Address` value object in `packages/core/src/Domains/Address.ts`
  - Added `registeredAddress: Option<Address>` to Company domain model
  - Added database migration for address columns (`Migration0016_AddCompanyOptionalFields.ts`)
  - Updated API schemas, handlers, and repository layer
  - Updated CompanyForm with "Registered Address" section
  - Updated EditCompanyModal with address fields

- [x] Add `industryCode` for NAICS/SIC classification
  - Added `industryCode: Option<NonEmptyTrimmedString>` to Company domain model
  - Added input field in CompanyForm and EditCompanyModal

- [x] Add `companyType` (Corporation, LLC, Partnership, etc.)
  - Created `CompanyType` schema in `packages/core/src/Domains/CompanyType.ts`
  - Added `companyType: Option<CompanyType>` to Company domain model
  - Added select dropdown in CompanyForm and EditCompanyModal with 8 company types

- [x] Add `incorporationJurisdiction` if different from operating jurisdiction
  - Added `incorporationJurisdiction: Option<JurisdictionCode>` to Company domain model
  - Added JurisdictionSelect in CompanyForm for incorporation jurisdiction (optional)

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
