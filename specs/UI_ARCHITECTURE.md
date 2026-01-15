# UI Architecture & Navigation Specification

This document defines the UI architecture, navigation patterns, and design standards for the Accountability application.

---

# Part 1: Implementation Plan & Progress

This section tracks known issues, implementation status, and priorities.

## Known Issues

### Issue 15: UI Structure - Organization Selector & New Dropdown - RESOLVED
- **Status**: Completed
- **Resolution**: Added "Organization" as the first option in the "+ New" dropdown menu in the sidebar. This option is ALWAYS visible, even when no organization is selected. The QuickActionMenu now shows conditionally:
  - Organization: Always available (navigates to `/organizations/new`)
  - Journal Entry: Requires org + company selected
  - Company: Requires org selected
  - Account: Requires org + company selected
  - Exchange Rate: Requires org selected
- The Organization Selector in the header already includes "+ Create New Organization" link, providing two ways to create organizations as specified.

### Issue 11: Add Buttons Broken Layout - RESOLVED
- **Status**: Completed
- **Resolution**: Added `whitespace-nowrap` to the base Button component class list in `packages/web/src/components/ui/Button.tsx`. This ensures all buttons with icons and text display on a single line without text wrapping, regardless of container width.

### Issue 8: Tooltip Positioning/Overflow - RESOLVED
- **Status**: Completed
- **Resolution**: Implemented smart tooltip positioning using `@floating-ui/react` library:
  1. **Collision detection**: Tooltips now automatically detect viewport edges and reposition
  2. **Flip middleware**: If tooltip doesn't fit on preferred side, it flips to opposite side
  3. **Shift middleware**: Tooltips shift along axis to stay fully visible with 8px padding from edges
  4. **High z-index**: Tooltip renders in a FloatingPortal with z-index 9999, above sidebar
  5. **Accessible**: Includes proper hover, focus, dismiss, and role interactions
- Updated `packages/web/src/components/ui/Tooltip.tsx` to use Floating UI instead of pure CSS positioning

### Issue 9: Filter Input Icon Alignment Inconsistency - RESOLVED
- **Status**: Completed
- **Resolution**: Standardized filter input styling across the application:
  1. Updated Journal Entries filter inputs (Status, Type, Fiscal Year, Fiscal Period, From Date, To Date) to use `pl-3 pr-8` instead of `px-3` for consistent right padding that accommodates native browser icons
  2. Updated the shared `Select` component in `packages/web/src/components/ui/Select.tsx` to use `pl-3 pr-8` as the default padding, ensuring all select dropdowns have consistent icon positioning
  3. Both select inputs and date inputs now have the same visual spacing, with `pr-8` providing adequate room for native browser controls (dropdown arrows, calendar icons)

### Issue 18: Organization Selector Dropdown - RESOLVED
- **Status**: Completed
- **Resolution**: Updated `OrganizationSelector.tsx` to follow the spec from Part 2:
  1. "Switch Organization" header
  2. List of organizations to choose from (or empty state message if none exist)
  3. Footer with "+ Create New Organization" link (per spec requirement for two ways to create organizations)
- This provides two ways to create organizations as specified: "+ New > Organization" in sidebar AND "+ Create New Organization" in header dropdown

### Issue 21: Chart of Accounts Table Header Doesn't Resize Correctly - RESOLVED
- **Status**: Completed
- **Resolution**: Replaced CSS Grid layout with semantic HTML table (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`):
  1. Changed outer container from grid to table with `overflow-x-auto` wrapper
  2. Added `min-w-[800px]` to ensure table doesn't shrink below readable size
  3. Used percentage-based column widths (`w-[33%]`, `w-[14%]`, etc.) for proportional resizing
  4. Header and body columns now perfectly align since they share the same table structure
  5. At narrow viewports, table scrolls horizontally instead of columns collapsing
  6. Works correctly with sidebar collapsed and expanded
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/accounts/index.tsx`

### Issue 22: Breadcrumbs Don't Resize Correctly - RESOLVED
- **Status**: Completed
- **Resolution**: Updated breadcrumbs to be fully responsive with proper overflow handling:
  1. Added `min-w-0 overflow-hidden` to the nav container to prevent horizontal overflow
  2. Added `flex-shrink-0` to icons and separators so they don't shrink
  3. Added `truncate` and `max-w-[150px]` to intermediate breadcrumb segments
  4. Added `truncate` and `max-w-[200px] sm:max-w-[300px]` to the last (current) segment
  5. Added `hidden sm:block` and `hidden sm:flex` to hide "Organizations" link and middle segments on mobile
  6. On very narrow viewports, only shows: Home > Organization > Current Page
- **Files modified**:
  - `packages/web/src/components/layout/Breadcrumbs.tsx`

### Issue 20: Remove Redundant Organization Display from Sidebar - RESOLVED
- **Status**: Completed
- **Resolution**: Removed the "Current Organization" section (data-testid="sidebar-current-org") from the Sidebar component. The header's OrganizationSelector already displays the current organization name, so showing it again in the sidebar was redundant and wasted space.
- **Files modified**:
  - `packages/web/src/components/layout/Sidebar.tsx` - Removed lines 468-476

### Issue 19: Organization Selector Shows Empty List When In Organization Context - RESOLVED
- **Status**: Completed
- **Resolution**: Created a layout route `packages/web/src/routes/organizations/$organizationId/route.tsx` that:
  1. Uses `beforeLoad` to fetch all organizations once for all child routes
  2. Provides organizations via route context to all pages under `/organizations/$organizationId/*`
  3. Updated ALL child routes (19 files) to access `context.organizations` and pass it to AppLayout
- **Implementation Details**:
  - The layout route fetches organizations in `beforeLoad` and returns `{ organizations }` as route context
  - Child routes access via `const organizations = context.organizations ?? []`
  - AppLayout receives `organizations` prop and passes it to the OrganizationSelector
  - This ensures the organization list is always available when switching organizations
- **Files modified**:
  - Created: `packages/web/src/routes/organizations/$organizationId/route.tsx` (layout route)
  - Updated: All 19 child route files to pass organizations to AppLayout

### Issue 17: Organization Selector Should Be Dropdown Menu - RESOLVED
- **Status**: Completed
- **Resolution**: Updated `OrganizationSelector.tsx` to always show a dropdown menu regardless of organization count:
  1. Button now shows "Select Organization" when none selected (instead of link saying "Add Organization")
  2. Dropdown always opens with consistent UI: header, organization list (or empty state message), and footer actions
  3. Empty state shows friendly message "No organizations yet" with hint to create first organization
  4. Footer actions always show "Create New Organization" and "View All Organizations" links
  5. Works consistently with 0, 1, or many organizations

### Issue 16: Missing Delete Organization UI - RESOLVED
- **Status**: Completed
- **Resolution**: Organization Settings page (`packages/web/src/routes/organizations/$organizationId/settings.tsx`) already has a fully implemented "Danger Zone" section with:
  1. "Danger Zone" section with AlertTriangle icon and red border styling
  2. "Delete Organization" button with danger variant (red)
  3. Type-to-confirm dialog requiring user to type exact organization name
  4. Disabled confirm button until text matches
  5. Error handling for API errors (shows message if org has companies)
  6. Navigation to `/organizations` after successful deletion

## Completed Items

### Issue 23: Reports Page 3-Step Flow - RESOLVED
- **Status**: Completed
- **Problem**: Reports page at `/organizations/:orgId/reports` was showing report types first, then company selection second. This violated the spec which requires users to first select a company before seeing report types.
- **Resolution**: Updated the Reports Hub page to follow the correct 3-step flow:
  1. **Step 1: Company Selection** - Org-level reports page (`/organizations/:orgId/reports`) now shows ONLY company selection cards with a step indicator showing "1. Select Company → 2. Choose Report → 3. View Report"
  2. **Step 2: Report Type Selection** - After selecting a company, navigates to company-level reports page (`/organizations/:orgId/companies/:companyId/reports`) which shows available report types with step indicator showing step 2 active
  3. **Step 3: Report View** - Clicking a report navigates to the specific report page
- **Files modified**:
  - `packages/web/src/routes/organizations/$organizationId/reports/index.tsx` - Removed report type cards, shows only company selection with step indicator
  - `packages/web/src/routes/organizations/$organizationId/companies/$companyId/reports/index.tsx` - Added step indicator showing step 2 (Choose Report) as active

### Issue 1: Post-Login Redirect - RESOLVED
- **Status**: Completed
- Login page (`packages/web/src/routes/login.tsx`) now follows Post-Login Flow correctly:
  - No organizations → `/organizations/new`
  - Single organization → `/organizations/:id/dashboard`
  - Multiple organizations → `/organizations`

### Issue 2: Home Route Redirect - RESOLVED
- **Status**: Completed
- Home page (`packages/web/src/routes/index.tsx`) redirects authenticated users following Post-Login Flow

### Issue 3: Organization Detail Page Layout - RESOLVED
- **Status**: Completed
- Organization detail page (`packages/web/src/routes/organizations/$organizationId/index.tsx`) uses AppLayout with sidebar and header

### Issue 4: Dashboard Breadcrumb Stability - RESOLVED
- **Status**: Completed
- Resolved by fixing issues #1 and #2

### Issue 5: Consistent Page Layouts - RESOLVED
- **Status**: Completed
- All pages under `/organizations` now use AppLayout consistently, including:
  - Dashboard, Companies, Reports, Exchange Rates, Consolidation, Intercompany, Audit Log, Settings
  - All form pages (new company, new journal entry, new account, new exchange rate)
  - All detail pages

### Issue 6: Sidebar Flat Navigation - RESOLVED
- **Status**: Completed
- Sidebar now uses flat links for all items (Companies, Reports, etc.)
- CompaniesNavSection removed
- No expanding sub-menus in sidebar

### Issue 7: Create New Organization Link - RESOLVED
- **Status**: Completed
- OrganizationSelector dropdown includes "+ Create New Organization" that links to `/organizations/new`

### Issue 10: Redundant "Add First Exchange Rate" - RESOLVED
- **Status**: Completed
- Exchange Rate page already correctly implements mutually exclusive CTAs:
  - Header "Add Rate" button visible only when there are existing rates
  - Empty state with "Add First Exchange Rate" CTA visible only when no rates exist
- No code changes needed - page was already correctly implemented

### Issue 11: Add Buttons Broken Layout - REOPENED
- **Status**: Reopened - moved back to Known Issues
- Originally marked complete but buttons still display on two lines in most interfaces
- Only "Add Company" button displays correctly on single line
- See Known Issues section for fix requirements

### Issue 12: "Create New Organization" Routing & Layout - RESOLVED
- **Status**: Completed
- **Problem 1 - Wrong Link**: The "Add Organization" button in OrganizationSelector had wrong link (`/organizations` instead of `/organizations/new`)
- **Fix 1**: Changed link target from `/organizations` to `/organizations/new` in `OrganizationSelector.tsx`
- **Problem 2 - Inconsistent Layout**: The Create Organization page had a completely different layout (no sidebar, custom header) unlike all other authenticated pages
- **Fix 2**: Updated `/organizations/new.tsx` to use AppLayout with sidebar, header, and breadcrumbs - now consistent with rest of app
- **Problem 3 - Organizations List Page Layout**: The `/organizations` page (org selector) also had a different layout without sidebar/header
- **Fix 3**: Updated `/organizations/index.tsx` to use AppLayout with sidebar, header, and breadcrumbs

### Issue 13: Exchange Rates "Add Rate" Button - RESOLVED
- **Status**: Completed
- The "Add Rate" button on Exchange Rates page uses Button component with inline Plus icon
- Button works correctly: `<Button onClick={...}><Plus className="mr-2 h-4 w-4" />Add Rate</Button>`

### Issue 14: User Menu "Settings" & "Profile" Links - RESOLVED
- **Status**: Completed
- Settings button now correctly navigates to `/organizations/:orgId/settings` when an org is selected
- Profile button is disabled with "Soon" indicator since profile page doesn't exist yet
- Updated in `packages/web/src/components/layout/Header.tsx`

---

# Part 2: Design & Specification

This section defines the UI architecture that MUST be implemented.

## Design Philosophy

Accountability is a **professional multi-company accounting application**. The UI must:
- Feel professional and trustworthy (users are managing financial data)
- Be consistent across all pages (no jarring layout changes)
- Follow established accounting software patterns (QuickBooks, Xero, Wave)
- Support efficient workflows for daily accounting tasks

## Navigation Architecture

### Global Layout Structure

**ALL authenticated pages MUST use the same layout:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo]  [Org Selector ▾]                    [Search]  [User Menu ▾]    │
├─────────────┬──────────────────────────────────────────────────────────┤
│             │                                                          │
│  + New ▾    │  Breadcrumbs: Org > Companies > Acme Corp > Accounts     │
│             │  ──────────────────────────────────────────────────────  │
│  Dashboard  │                                                          │
│             │  [Page Content]                                          │
│  Companies  │                                                          │
│             │                                                          │
│  Reports    │                                                          │
│             │                                                          │
│  Exchange   │                                                          │
│  Rates      │                                                          │
│             │                                                          │
│  Consolid.  │                                                          │
│             │                                                          │
│  Settings   │                                                          │
│             │                                                          │
└─────────────┴──────────────────────────────────────────────────────────┘
```

**Note:** Sidebar items are flat links (no sub-menus). Navigation into company-specific pages happens through the main content area, not sidebar expansion.

### Critical Requirements

1. **Sidebar is ALWAYS present** on every authenticated page
2. **Organization selector is ALWAYS accessible** from header
3. **User menu is ALWAYS accessible** from header
4. **Breadcrumbs show current location** on every page
5. **Mobile menu provides full navigation** on small screens

### NO Exceptions

The following are explicitly **FORBIDDEN**:
- Pages without the sidebar
- Pages without the header
- Different layouts for different sections
- Manual breadcrumb HTML in individual pages
- Pages where user cannot switch organizations
- Sub-navigation menus in the sidebar (e.g., expanding Companies or Reports into sub-items)
- Form/creation pages without the standard AppLayout (e.g., "Create Journal Entry" must have sidebar)

## Post-Login Flow

### First-Time User (No Organizations)
```
Login → /organizations/new (Create your first organization)
```

### User with Single Organization
```
Login → /organizations/:id/dashboard (Auto-redirect to that org)
```

### User with Multiple Organizations
```
Login → /organizations (Organization selector page)
  Click org card → /organizations/:id/dashboard
```

### Organization Selector Page
The `/organizations` page uses the standard AppLayout (with sidebar and header) and shows:
- A card-based selection UI for choosing an organization
- "New Organization" button in the page header
- Each card shows: Name, Currency, Companies count
- Click card → navigate to org dashboard
- Sidebar shows limited navigation since no org is selected yet

## Sidebar Navigation

### Navigation Structure

When organization is selected, sidebar shows:

```
+ New ▾
  └─ Journal Entry
  └─ Company
  └─ Account

Dashboard

Companies          → /organizations/:orgId/companies

Reports            → /organizations/:orgId/reports

Exchange Rates     → /organizations/:orgId/exchange-rates

Consolidation      → /organizations/:orgId/consolidation

Intercompany       → /organizations/:orgId/intercompany

Audit Log          → /organizations/:orgId/audit-log

──────────────
Settings           → /organizations/:orgId/settings
```

**NO sub-navigation in sidebar.** Companies and Reports do NOT expand into sub-items. Clicking "Companies" goes to the companies list. Clicking "Reports" goes to the reports page.

### Reports Page Flow

Reports are **company-scoped** - you must select a company before viewing reports. The Reports page (`/organizations/:orgId/reports`) flow:

1. **Step 1: Company Selection** - Show list of companies in the organization as selectable cards
2. **Step 2: Report Type Selection** - After selecting a company, show available report types (Trial Balance, Balance Sheet, Income Statement, Cash Flow, Equity Statement)
3. **Step 3: Report View** - Navigate to `/organizations/:orgId/companies/:companyId/reports/:reportType`

The Reports page should NOT immediately show a list of report types. Users must first choose which company's reports they want to view.

### "+ New" Quick Action Menu

The "+ New" button at top of sidebar provides fast access to common creation actions. Each item opens the corresponding **creation form** directly (NOT list pages):

| Menu Item | Opens | Route | Availability |
|-----------|-------|-------|--------------|
| Organization | Organization creation form | `/organizations/new` | ALWAYS available |
| Journal Entry | Journal entry creation form | `/organizations/:orgId/companies/:companyId/journal-entries/new` | Requires org + company |
| Company | Company creation form | `/organizations/:orgId/companies/new` | Requires org selected |
| Account | Account creation form | `/organizations/:orgId/companies/:companyId/accounts/new` | Requires org + company |
| Exchange Rate | Exchange rate creation form | `/organizations/:orgId/exchange-rates/new` | Requires org selected |

**IMPORTANT:**
- "Organization" MUST ALWAYS be visible in the "+ New" dropdown, even when no organization is selected. This is the PRIMARY way to create new organizations.
- "New Company" MUST open the company creation form (`/companies/new`), NOT the companies list page.
- The "+ New" dropdown should be visible on ALL authenticated pages.

### Sidebar State

- Sidebar is collapsible (save preference)
- Collapsed state shows icons only
- Keyboard shortcut: Ctrl+B or Cmd+B to toggle
- Mobile: sidebar hidden by default, hamburger menu to open

## Header

The header is a **global element** that appears on ALL authenticated pages. The organization selector in the header is the PRIMARY way to switch between organizations.

### Desktop Header
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Logo]  [Organization: Acme Holdings ▾]         [🔍]  [Avatar ▾]     │
└──────────────────────────────────────────────────────────────────────┘
```

Components:
1. **Logo**: Click returns to org dashboard (or org selector if no org)
2. **Organization Selector**: **PRIMARY** dropdown to switch organizations - always visible, always accessible
3. **Search** (future): Global search icon
4. **User Menu**: Avatar with dropdown for profile, settings, logout

**IMPORTANT:** The Organization Selector in the header is a GLOBAL element - users must be able to switch organizations from ANY page in the application.

### Mobile Header
```
┌──────────────────────────────────────────────────────────────────────┐
│ [☰]  [Logo]  [Org: Acme ▾]                              [Avatar]     │
└──────────────────────────────────────────────────────────────────────┘
```

Components:
1. **Hamburger**: Opens mobile sidebar drawer
2. **Logo**: Returns to dashboard
3. **Organization**: Compact selector
4. **Avatar**: Opens user menu

### Organization Selector Dropdown

When clicked, shows:
```
┌─────────────────────────────────────────┐
│ 🔍 Search organizations...              │
├─────────────────────────────────────────┤
│ ✓ Acme Holdings       USD  3 companies  │
│   Beta Corporation    EUR  1 company    │
│   Personal Finances   USD  1 company    │
├─────────────────────────────────────────┤
│ + Create New Organization               │
└─────────────────────────────────────────┘
```

**IMPORTANT:**
- "+ Create New Organization" MUST link to `/organizations/new`
- The Organization Selector dropdown provides a SECONDARY way to create organizations (in addition to the "+ New" dropdown in the sidebar)
- Both methods should work: "+ New > Organization" in sidebar AND "+ Create New Organization" in header dropdown

## Breadcrumbs

### Format
```
Organization > Section > [Subsection] > [Item Name]
```

### Examples
```
Acme Holdings > Dashboard
Acme Holdings > Companies
Acme Holdings > Companies > Acme Corp
Acme Holdings > Companies > Acme Corp > Chart of Accounts
Acme Holdings > Companies > Acme Corp > Journal Entries > JE-2024-0001
Acme Holdings > Exchange Rates
Acme Holdings > Settings
```

### Rules
- Always show at least org name + current section
- Each segment is clickable and navigates to that level
- Current page (last segment) is not a link
- Use consistent naming (not "Journal Entry Detail" - just the entry number)

## Route Structure

### URL Patterns

```
/organizations                                    # Org selector (special case)
/organizations/new                                # Create org (special case)
/organizations/:orgId/dashboard                   # Org dashboard
/organizations/:orgId/settings                    # Org settings
/organizations/:orgId/companies                   # Companies list
/organizations/:orgId/companies/new               # Create company
/organizations/:orgId/companies/:companyId        # Company detail
/organizations/:orgId/companies/:companyId/accounts           # Chart of accounts
/organizations/:orgId/companies/:companyId/accounts/new       # Create account
/organizations/:orgId/companies/:companyId/accounts/:id       # Account detail
/organizations/:orgId/companies/:companyId/journal-entries    # JE list
/organizations/:orgId/companies/:companyId/journal-entries/new
/organizations/:orgId/companies/:companyId/journal-entries/:id
/organizations/:orgId/companies/:companyId/reports            # Reports hub
/organizations/:orgId/companies/:companyId/reports/trial-balance
/organizations/:orgId/companies/:companyId/reports/balance-sheet
/organizations/:orgId/companies/:companyId/fiscal             # Fiscal periods
/organizations/:orgId/exchange-rates              # Exchange rates (org level)
/organizations/:orgId/consolidation               # Consolidation groups
/organizations/:orgId/consolidation/:groupId
/organizations/:orgId/intercompany                # Intercompany transactions
/organizations/:orgId/audit-log                   # Audit log
```

### Route File Structure

Use TanStack Router's layout routes to ensure consistent layout:

```
routes/
├── __root.tsx                 # Root layout
├── _auth.tsx                  # Auth-required layout (redirects to login)
├── _auth/
│   └── organizations/
│       ├── index.tsx          # Org selector (special layout)
│       ├── new.tsx            # Create org (special layout)
│       └── $organizationId/
│           ├── _layout.tsx    # Standard layout with sidebar
│           ├── dashboard.tsx
│           ├── settings.tsx
│           ├── companies/
│           │   ├── index.tsx
│           │   ├── new.tsx
│           │   └── $companyId/
│           │       ├── index.tsx
│           │       ├── accounts/...
│           │       ├── journal-entries/...
│           │       ├── reports/...
│           │       └── fiscal/...
│           ├── exchange-rates/
│           ├── consolidation/
│           ├── intercompany/
│           └── audit-log/
└── login.tsx
└── register.tsx
```

## Dashboard Design

### Organization Dashboard (`/organizations/:id/dashboard`)

Layout: Widget-based dashboard with key metrics and quick actions

```
┌──────────────────────────────────────────────────────────────────┐
│ Welcome to Acme Holdings                                         │
│ Reporting Currency: USD                                          │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌──────┐
│ 3               │ │ 156             │ │ 5               │ │ 2    │
│ Companies       │ │ Total Accounts  │ │ Pending         │ │ Open │
│                 │ │                 │ │ Approval        │ │Period│
│ [View →]        │ │                 │ │ [Review →]      │ │      │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └──────┘

┌────────────────────────────────────────────────────────────────┐
│ Quick Actions                                                   │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│ │+ JE Entry   │ │+ Company    │ │📊 Reports   │ │⚙ Settings  │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Recent Activity                                                 │
│ ────────────────────────────────────────────────────────────── │
│ • JE-2024-0047 posted by John         Today, 2:30 PM           │
│ • Account 4100 created by Jane        Today, 11:00 AM          │
│ • Period Jan 2024 closed              Yesterday                │
└────────────────────────────────────────────────────────────────┘
```

### Widget Requirements
- Summary cards at top (companies, accounts, pending items)
- Quick actions section for common tasks
- Recent activity feed (from audit log)
- All cards link to relevant pages
- Responsive: stack vertically on mobile

## Page Templates

### List Pages

Standard structure for all list pages (Companies, Accounts, Journal Entries, etc.):

```
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Page Title                                        [+ Create Button]  │
│ Optional description text                                            │
├──────────────────────────────────────────────────────────────────────┤
│ Filters: [Status ▾] [Type ▾] [Date Range] [Search...]    [Clear]     │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ Column 1     │ Column 2     │ Column 3     │ Status  │ Actions │  │
│ ├──────────────┼──────────────┼──────────────┼─────────┼─────────┤  │
│ │ Row 1 data   │ ...          │ ...          │ Badge   │ ⋮       │  │
│ │ Row 2 data   │ ...          │ ...          │ Badge   │ ⋮       │  │
│ └─────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 156 items                        [< Prev] [Next >]   │
└──────────────────────────────────────────────────────────────────────┘
```

### Detail Pages

Standard structure for detail/view pages:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ [← Back]  Item Name/Title                    [Edit] [Delete] [More▾] │
│           Status Badge                                               │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐  ┌─────────────────────────────────┐ │
│ │ Primary Information          │  │ Secondary Information           │ │
│ │ - Field: Value               │  │ - Field: Value                  │ │
│ │ - Field: Value               │  │ - Field: Value                  │ │
│ └─────────────────────────────┘  └─────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ [Tab 1] [Tab 2] [Tab 3]                                              │
│ ─────────────────────────────────────────────────────────────────    │
│ Tab content area...                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Form Pages (Create/Edit)

**ALL form pages use AppLayout** with sidebar and header visible. This includes:
- Create Journal Entry (`/organizations/:orgId/companies/:companyId/journal-entries/new`)
- New Company (`/organizations/:orgId/companies/new`)
- New Account (`/organizations/:orgId/companies/:companyId/accounts/new`)
- Edit forms for any entity

Form pages are NOT special modal dialogs or standalone pages. They are regular pages within the standard layout.

Standard structure for create/edit forms:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                          │
├──────────────────────────────────────────────────────────────────────┤
│ [← Cancel]  Create New [Entity]                                      │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Section 1 Title                                                 │   │
│ │ ─────────────────────────────────────────────────────────────  │   │
│ │ Field Label *                                                   │   │
│ │ [Input field                                           ]        │   │
│ │ Helper text                                                     │   │
│ │                                                                 │   │
│ │ Field Label                                                     │   │
│ │ [Dropdown                                              ▾]       │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Section 2 Title (Collapsible)                              [▾] │   │
│ │ ...                                                             │   │
│ └────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│                                              [Cancel]  [Save Draft]  │
│                                                        [Submit →]    │
└──────────────────────────────────────────────────────────────────────┘
```

## Empty States

### Requirements
Every list/data page MUST have a proper empty state:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                        [Illustration/Icon]                           │
│                                                                      │
│                     No [entities] yet                                │
│                                                                      │
│         [Brief explanation of what this section is for               │
│          and why they should create their first item]                │
│                                                                      │
│                    [+ Create First Entity]                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Examples

**No Companies:**
```
No companies yet
Companies are legal entities within your organization.
Create your first company to start tracking its financial activity.
[+ Create Company]
```

**No Journal Entries:**
```
No journal entries yet
Journal entries record financial transactions in your general ledger.
Create your first entry or apply a template to get started.
[+ Create Entry]  [Apply Template]
```

## Loading States

### Page Loading
- Show skeleton loader matching page layout
- Never show blank white pages
- Sidebar/header remain visible during content load

### Data Loading
- Table: Show skeleton rows
- Cards: Show skeleton cards
- Forms: Disable inputs, show spinner on submit button

### Error States
```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                        [Error Icon]                                  │
│                                                                      │
│                  Something went wrong                                │
│                                                                      │
│         [Specific error message if available]                        │
│                                                                      │
│                       [Try Again]                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Responsive Design

### Breakpoints
- Desktop: >= 1024px (full sidebar visible)
- Tablet: 768px - 1023px (sidebar collapsible)
- Mobile: < 768px (sidebar hidden, hamburger menu)

### Mobile Adaptations
1. Sidebar becomes full-screen drawer
2. Tables become card-based lists
3. Forms stack vertically
4. Header simplifies (shorter org name, icon-only actions)

## Component Standards

### Buttons
- Primary: Blue, filled (main actions)
- Secondary: Gray outline (cancel, back)
- Danger: Red (delete, destructive actions)
- All buttons must have loading states

### Status Badges
Consistent colors across all status types:
- Draft: Gray
- Pending/Pending Approval: Yellow/Amber
- Active/Approved/Open: Green
- Posted/Completed: Blue
- Inactive/Closed: Gray
- Reversed/Cancelled/Error: Red
- Locked: Purple

### Forms
- Labels above inputs
- Required fields marked with asterisk (*)
- Helper text below fields
- Error messages in red below field
- Disable submit until form is valid

### Tables
- Sortable columns where appropriate
- Row hover highlight
- Action menu (three dots) for row actions
- Checkbox for bulk selection when needed
- **Column header tooltips**: Every column header MUST show an explanatory tooltip on hover describing what the column contains. Examples:
  - "Normal" → "The normal balance side for this account type. Dr (Debit) for assets/expenses, Cr (Credit) for liabilities/equity/revenue."
  - "Status" → "Current state of this record (Draft, Posted, Reversed, etc.)"
  - "Balance" → "Current account balance in the account's currency"

## Accessibility

- All interactive elements keyboard accessible
- Focus indicators visible
- Color not sole indicator (use icons/text with colors)
- ARIA labels on icon-only buttons
- Skip to main content link

## Testing Requirements

All UI components must have `data-testid` attributes:
- `data-testid="sidebar"` - Main sidebar
- `data-testid="header"` - Main header
- `data-testid="org-selector"` - Organization dropdown
- `data-testid="user-menu"` - User dropdown
- `data-testid="breadcrumbs"` - Breadcrumb nav
- `data-testid="page-title"` - Page title
- `data-testid="create-button"` - Primary create action
- `data-testid="[entity]-list"` - List tables
- `data-testid="[entity]-row-[id]"` - Table rows
- `data-testid="empty-state"` - Empty state container
- `data-testid="loading-state"` - Loading indicator
- `data-testid="error-state"` - Error container
