# Company Details Page UI Improvement Plan

## Overview

The company details page (`/organizations/$organizationId/companies/$companyId`) needs a redesign to:
1. Better organize and display company information
2. Fix the unbalanced info cards grid (3 cards in a 4-column layout)
3. Add useful statistics and quick insights
4. Prepare for consolidation group membership display (from the restructure)
5. Improve visual hierarchy and information architecture

## Current Problems

### 1. Unbalanced Layout
- Info cards grid has only 3 cards in a `lg:grid-cols-4` layout
- Cards have inconsistent content density

### 2. Overloaded Cards
- "Fiscal Year Card" contains too much unrelated info:
  - Fiscal year end date
  - Tax ID
  - Incorporation date
  - Registration number
- These should be organized by category, not cramped together

### 3. Missing Information
- Company type not displayed
- Industry code not displayed
- Registered address not displayed
- No consolidation group membership (future)
- No statistics (account count, journal entry count, etc.)

### 4. Poor Visual Hierarchy
- All sections have similar visual weight
- No clear primary/secondary information distinction
- Edit modal is a wall of form fields

## Proposed Design

### Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER CARD                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Company Name          [Active Badge] [Jurisdiction Badge]       │ │
│ │ Legal Name                                        [Edit] [...]  │ │
│ │ Created Date • Company Type                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ STATS ROW (4 cards)                                                 │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│ │ Accounts  │ │ Journal   │ │ Functional│ │ Fiscal    │            │
│ │    42     │ │ Entries   │ │ Currency  │ │ Year End  │            │
│ │           │ │   156     │ │   USD     │ │  Dec 31   │            │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TWO-COLUMN LAYOUT                                                   │
│ ┌─────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ COMPANY INFORMATION         │ │ QUICK ACTIONS                   │ │
│ │                             │ │                                 │ │
│ │ Legal & Tax                 │ │ ┌───────────┐ ┌───────────┐     │ │
│ │ • Tax ID: 12-3456789        │ │ │ Chart of  │ │ Journal   │     │ │
│ │ • Registration: ABC123      │ │ │ Accounts  │ │ Entries   │     │ │
│ │ • Incorporated: Jan 1, 2020 │ │ └───────────┘ └───────────┘     │ │
│ │ • Industry: 541512 (NAICS)  │ │ ┌───────────┐ ┌───────────┐     │ │
│ │                             │ │ │ Reports   │ │ Fiscal    │     │ │
│ │ Financial                   │ │ │           │ │ Periods   │     │ │
│ │ • Functional: USD           │ │ └───────────┘ └───────────┘     │ │
│ │ • Reporting: USD            │ │                                 │ │
│ │ • Retained Earnings: 3000   │ ├─────────────────────────────────┤ │
│ │                             │ │ CONSOLIDATION GROUPS            │ │
│ │ Address                     │ │ (Future - after restructure)    │ │
│ │ • 123 Main Street           │ │ • Acme Corp Group (Parent)      │ │
│ │ • Suite 100                 │ │ • Regional Holdings (80%)       │ │
│ │ • San Francisco, CA 94102   │ │                                 │ │
│ └─────────────────────────────┘ └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ METADATA FOOTER (collapsed, expandable)                             │
│ Company ID: 462add83-d9f8-450f-b489-be43ff2c2aad                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Fetch Additional Data

**File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/index.tsx`

Add API calls to fetch statistics:

```typescript
// In fetchCompanyData, add:
const [companyResult, orgResult, allCompaniesResult, accountsResult, journalEntriesCountResult] = await Promise.all([
  // ... existing calls
  serverApi.GET("/api/v1/journal-entries", {
    params: {
      query: {
        organizationId: data.organizationId,
        companyId: data.companyId,
        limit: 0  // Just need count
      }
    },
    headers: { Authorization }
  })
])

// Return:
return {
  // ... existing
  accountCount: accountsResult.data?.accounts?.length ?? 0,
  journalEntryCount: journalEntriesCountResult.data?.totalCount ?? 0
}
```

**Note**: May need to add a count endpoint to the API if pagination doesn't return total count.

### Phase 2: Create Stats Card Component

**File**: `packages/web/src/components/company/StatCard.tsx`

```typescript
interface StatCardProps {
  readonly label: string
  readonly value: string | number
  readonly subtext?: string
  readonly icon?: React.ReactNode
  readonly testId?: string
}

export function StatCard({ label, value, subtext, icon, testId }: StatCardProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            {icon}
          </div>
        )}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
      </div>
    </div>
  )
}
```

### Phase 3: Create Company Info Card Component

**File**: `packages/web/src/components/company/CompanyInfoCard.tsx`

```typescript
interface CompanyInfoCardProps {
  readonly title: string
  readonly children: React.ReactNode
  readonly testId?: string
}

export function CompanyInfoCard({ title, children, testId }: CompanyInfoCardProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white"
      data-testid={testId}
    >
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

// Info row component for consistent styling
interface InfoRowProps {
  readonly label: string
  readonly value: string | null | undefined
  readonly mono?: boolean
}

export function InfoRow({ label, value, mono }: InfoRowProps) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
```

### Phase 4: Refactor Company Details Page

**File**: `packages/web/src/routes/organizations/$organizationId/companies/$companyId/index.tsx`

#### 4.1 Updated Header Card

```tsx
{/* Company Header Card */}
<div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="company-header-card">
  <div className="flex items-start justify-between">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="company-name">
          {company.name}
        </h1>
        <StatusBadge isActive={company.isActive} />
        <JurisdictionBadge code={company.jurisdiction} />
      </div>
      <p className="mt-1 text-gray-600" data-testid="company-legal-name">
        {company.legalName}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Created {createdDate}
        {company.companyType && (
          <> &middot; {formatCompanyType(company.companyType)}</>
        )}
      </p>
    </div>
    <div className="flex items-center gap-2">
      {canUpdateCompany && (
        <Button variant="secondary" onClick={() => setIsEditing(true)} data-testid="edit-company-button">
          Edit
        </Button>
      )}
      {canDeleteCompany && (
        <DropdownMenu>
          <DropdownMenuItem onClick={handleToggleActive}>
            {company.isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        </DropdownMenu>
      )}
    </div>
  </div>
</div>
```

#### 4.2 Stats Row

```tsx
{/* Stats Row */}
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard
    label="Accounts"
    value={accountCount}
    icon={<CreditCard className="h-5 w-5" />}
    testId="stat-accounts"
  />
  <StatCard
    label="Journal Entries"
    value={journalEntryCount}
    icon={<FileText className="h-5 w-5" />}
    testId="stat-journal-entries"
  />
  <StatCard
    label="Functional Currency"
    value={company.functionalCurrency}
    icon={<DollarSign className="h-5 w-5" />}
    testId="stat-currency"
  />
  <StatCard
    label="Fiscal Year End"
    value={fiscalYearEndDate}
    icon={<Calendar className="h-5 w-5" />}
    testId="stat-fiscal-year"
  />
</div>
```

#### 4.3 Two-Column Layout

```tsx
{/* Main Content - Two Columns */}
<div className="grid gap-6 lg:grid-cols-2">
  {/* Left Column - Company Information */}
  <div className="space-y-4">
    {/* Legal & Tax Information */}
    <CompanyInfoCard title="Legal & Tax Information" testId="legal-tax-card">
      <InfoRow label="Tax ID" value={company.taxId} mono />
      <InfoRow label="Registration Number" value={company.registrationNumber} mono />
      <InfoRow label="Incorporation Date" value={incorporationDateFormatted} />
      <InfoRow label="Industry Code" value={company.industryCode} mono />
      <InfoRow label="Company Type" value={formatCompanyType(company.companyType)} />
      {!company.taxId && !company.registrationNumber && !company.incorporationDate && (
        <p className="text-sm text-gray-400 italic">No legal information provided</p>
      )}
    </CompanyInfoCard>

    {/* Financial Settings */}
    <CompanyInfoCard title="Financial Settings" testId="financial-settings-card">
      <InfoRow label="Functional Currency" value={company.functionalCurrency} />
      <InfoRow label="Reporting Currency" value={company.reportingCurrency} />
      <InfoRow label="Fiscal Year End" value={fiscalYearEndDate} />
      <InfoRow
        label="Retained Earnings Account"
        value={retainedEarningsAccount?.name ?? "Not configured"}
      />
    </CompanyInfoCard>

    {/* Registered Address */}
    {company.registeredAddress && hasAddressData(company.registeredAddress) && (
      <CompanyInfoCard title="Registered Address" testId="address-card">
        <div className="text-sm text-gray-900">
          {company.registeredAddress.street1 && <p>{company.registeredAddress.street1}</p>}
          {company.registeredAddress.street2 && <p>{company.registeredAddress.street2}</p>}
          <p>
            {[
              company.registeredAddress.city,
              company.registeredAddress.state,
              company.registeredAddress.postalCode
            ].filter(Boolean).join(", ")}
          </p>
          {company.registeredAddress.country && <p>{company.registeredAddress.country}</p>}
        </div>
      </CompanyInfoCard>
    )}
  </div>

  {/* Right Column - Actions & Relationships */}
  <div className="space-y-4">
    {/* Quick Actions */}
    <CompanyInfoCard title="Company Data" testId="quick-actions-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickActionLink
          to="/organizations/$organizationId/companies/$companyId/accounts"
          params={params}
          icon={<CreditCard className="h-5 w-5" />}
          title="Chart of Accounts"
          subtitle={`${accountCount} accounts`}
        />
        <QuickActionLink
          to="/organizations/$organizationId/companies/$companyId/journal-entries"
          params={params}
          icon={<FileText className="h-5 w-5" />}
          title="Journal Entries"
          subtitle={`${journalEntryCount} entries`}
        />
        <QuickActionLink
          to="/organizations/$organizationId/companies/$companyId/reports"
          params={params}
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports"
          subtitle="Financial statements"
        />
        <QuickActionLink
          to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
          params={params}
          icon={<Calendar className="h-5 w-5" />}
          title="Fiscal Periods"
          subtitle="Year-end closing"
        />
      </div>
    </CompanyInfoCard>

    {/* Consolidation Groups (Future - after revise-company-structures.md) */}
    {/*
    <CompanyInfoCard title="Consolidation Groups" testId="consolidation-groups-card">
      {consolidationGroups.length > 0 ? (
        <div className="space-y-2">
          {consolidationGroups.map(group => (
            <Link
              key={group.id}
              to="/organizations/$organizationId/consolidation/$groupId"
              params={{ organizationId, groupId: group.id }}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">{group.name}</p>
                <p className="text-sm text-gray-500">
                  {group.role === 'parent' ? 'Parent Company' : `${group.ownershipPercentage}% ownership`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          Not a member of any consolidation group
        </p>
      )}
    </CompanyInfoCard>
    */}
  </div>
</div>
```

#### 4.4 Metadata Footer

```tsx
{/* Metadata Footer */}
<details className="rounded-lg border border-gray-200 bg-white">
  <summary className="cursor-pointer px-4 py-3 text-sm text-gray-500 hover:bg-gray-50">
    Technical Details
  </summary>
  <div className="border-t border-gray-200 px-4 py-3">
    <InfoRow label="Company ID" value={company.id} mono />
    <InfoRow label="Organization ID" value={company.organizationId} mono />
  </div>
</details>
```

### Phase 5: Create QuickActionLink Component

**File**: `packages/web/src/components/company/QuickActionLink.tsx`

```typescript
interface QuickActionLinkProps {
  readonly to: string
  readonly params: { readonly organizationId: string; readonly companyId: string }
  readonly icon: React.ReactNode
  readonly title: string
  readonly subtitle: string
}

export function QuickActionLink({ to, params, icon, title, subtitle }: QuickActionLinkProps) {
  return (
    <Link
      to={to}
      params={params}
      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        {icon}
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </Link>
  )
}
```

### Phase 6: Improve Edit Modal

The current edit modal is a long scrolling form. Consider:

1. **Tabbed Interface**: Group fields into tabs (Basic Info, Financial, Address)
2. **Inline Editing**: Instead of modal, allow inline editing of sections
3. **Drawer**: Use a slide-out drawer instead of modal for more space

Recommended: **Tabbed Modal** for now:

```tsx
{/* Edit Modal with Tabs */}
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
    {/* Tabs */}
    <div className="flex border-b border-gray-200">
      <TabButton active={activeTab === 'basic'} onClick={() => setActiveTab('basic')}>
        Basic Info
      </TabButton>
      <TabButton active={activeTab === 'financial'} onClick={() => setActiveTab('financial')}>
        Financial
      </TabButton>
      <TabButton active={activeTab === 'address'} onClick={() => setActiveTab('address')}>
        Address
      </TabButton>
    </div>

    {/* Tab Content */}
    <div className="max-h-[60vh] overflow-y-auto p-6">
      {activeTab === 'basic' && <BasicInfoFields />}
      {activeTab === 'financial' && <FinancialFields />}
      {activeTab === 'address' && <AddressFields />}
    </div>

    {/* Footer */}
    <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>
    </div>
  </div>
</div>
```

## Files to Create/Modify

### New Files
- [x] `packages/web/src/components/company/StatCard.tsx`
- [x] `packages/web/src/components/company/CompanyInfoCard.tsx`
- [x] `packages/web/src/components/company/QuickActionLink.tsx`

### Modified Files
- [x] `packages/web/src/routes/organizations/$organizationId/companies/$companyId/index.tsx`

## API Changes (Optional)

Journal entries API already returns a `total` field in the response, no changes needed.

## Acceptance Criteria

1. [x] Stats row shows 4 balanced cards with meaningful data (Accounts, Journal Entries, Functional Currency, Fiscal Year End)
2. [x] Company information is organized into logical sections (Legal & Tax, Financial Settings, Address)
3. [x] Quick actions show counts/subtitles (e.g., "12 accounts", "47 entries")
4. [x] Empty states are handled gracefully (shows "No legal information provided" when no tax/registration data)
5. [x] Edit modal is easier to navigate (3 tabs: Basic Info, Financial, Address)
6. [x] Technical metadata is collapsed by default (Company ID, Organization ID in "Technical Details" section)
7. [x] Page is responsive (collapses to single column on mobile)
8. [x] All existing E2E tests pass
9. [x] No regression in functionality

## Future Enhancements (Post revise-company-structures.md)

After implementing the consolidation group restructure:

1. Add "Consolidation Groups" section showing group memberships
2. Display ownership percentage and role (parent/subsidiary) per group
3. Quick link to each consolidation group
4. Badge on header if company is a parent in any group

## Visual Mockup Reference

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Effectful Technologies Ltd                                              │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  Effectful UK                    [Active] [United Kingdom]    [Edit ▾]  │
│  Created January 15, 2024 • Corporation                                  │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │     12     │  │     47     │  │    GBP     │  │   Dec 31   │         │
│  │  Accounts  │  │  Entries   │  │  Currency  │  │  Year End  │         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐       │
│  │ Legal & Tax Information     │  │ Company Data                │       │
│  │                             │  │                             │       │
│  │ Tax ID         GB123456789 │  │ ┌─────────┐ ┌─────────┐     │       │
│  │ Registration   12345678    │  │ │ Accounts│ │ Journal │     │       │
│  │ Incorporated   Jan 1, 2020 │  │ │ 12 accts│ │ 47 ents │     │       │
│  │ Industry       541512      │  │ └─────────┘ └─────────┘     │       │
│  │ Type           Corporation │  │ ┌─────────┐ ┌─────────┐     │       │
│  │                             │  │ │ Reports │ │ Fiscal  │     │       │
│  ├─────────────────────────────┤  │ │         │ │ Periods │     │       │
│  │ Financial Settings          │  │ └─────────┘ └─────────┘     │       │
│  │                             │  │                             │       │
│  │ Functional     GBP          │  ├─────────────────────────────┤       │
│  │ Reporting      USD          │  │ Consolidation Groups        │       │
│  │ Retained       3000-RE      │  │                             │       │
│  │                             │  │ • Acme Corp (Parent)        │       │
│  ├─────────────────────────────┤  │ • Regional Group (80%)      │       │
│  │ Registered Address          │  │                             │       │
│  │                             │  │                             │       │
│  │ 123 Main Street             │  │                             │       │
│  │ London, EC1A 1BB            │  │                             │       │
│  │ United Kingdom              │  │                             │       │
│  └─────────────────────────────┘  └─────────────────────────────┘       │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  ▶ Technical Details                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```
