# UI Architecture & Navigation Specification

This document defines the UI architecture, navigation patterns, and design standards for the Accountability application.

---

# Part 1: Implementation Plan & Progress

This section tracks known issues, implementation status, and priorities.

## Known Issues

### Issue 15: UI Structure - Organization Selector & New Dropdown
- **Status**: Open
- **Priority**: HIGH - Core navigation structure change
- **Problem**: Current UI structure does not match the intended design:
  1. "Add Organization" is not accessible from the "+ New" dropdown
  2. Organization selector placement needs to be consistent as a global header element
- **Required Changes**:
  1. **Add "Organization" to the "+ New" dropdown**: The sidebar's "+ New" menu should include "Organization" as an option that navigates to `/organizations/new`. This should be available even when no organization is currently selected.
  2. **Organization Selector in Header**: The organization selector dropdown should be prominently placed in the header as a global element, allowing users to switch organizations from any page. This is already partially implemented but needs to be the PRIMARY way to switch/add organizations.
  3. **Remove redundant organization selection UI**: The separate "Add Organization" buttons scattered throughout the app should be consolidated into the "+ New" dropdown.
- **Files to Modify**:
  - `packages/web/src/components/layout/Sidebar.tsx` - Add "Organization" to QuickActionMenu
  - `packages/web/src/components/layout/Header.tsx` - Ensure org selector is prominent
  - `packages/web/src/components/layout/OrganizationSelector.tsx` - Keep "+ Create New Organization" in dropdown
- **Design Reference**: See Global Layout Structure diagram in Part 2 of this spec

### Issue 11: Add Buttons Broken Layout (Reopened)
- **Status**: Open (Reopened)
- **Problem**: Add/Create buttons still display text on two lines instead of single line in most interfaces. Only "Add Company" displays correctly.
- **Expected**: All add buttons should display icon and text on a single line (e.g., `[+ Add Rate]` not `[+]` on one line and `[Add Rate]` on the next)
- **Affected Pages**: All pages with add buttons EXCEPT Companies list page
- **Fix**: Audit all add/create buttons and ensure they use:
  1. `whitespace-nowrap` or `flex-nowrap` to prevent text wrapping
  2. Proper flex container with `items-center` and `gap-2`
  3. Consistent Button component usage across all pages

### Issue 8: Tooltip Positioning/Overflow
- **Status**: Open
- **Problem**: Column header tooltips collide with the sidebar on the left side and get cut off by the screen edge on the right side, making them hard to read
- **Expected**: Tooltips should be fully visible regardless of column position - they should intelligently reposition to avoid collisions with screen edges and sidebar
- **Fix**: Implement smart tooltip positioning:
  1. Detect if tooltip would overflow viewport edges
  2. For left columns (near sidebar): position tooltip to the right of the element
  3. For right columns (near screen edge): position tooltip to the left of the element
  4. Consider using a tooltip library with built-in collision detection (e.g., Radix UI Tooltip, Floating UI)
  5. Ensure tooltip has `z-index` higher than sidebar

### Issue 9: Filter Input Icon Alignment Inconsistency
- **Status**: Open
- **Problem**: In Journal Entries filters, the dropdown arrow in select inputs is positioned too far to the right compared to the calendar icons in date picker inputs - inconsistent visual alignment
- **Expected**: All filter input icons (dropdown arrows, calendar icons, etc.) should have consistent positioning and padding
- **Fix**: Standardize filter input styling:
  1. Use consistent `padding-right` for all filter inputs
  2. Ensure dropdown arrows and date picker icons are aligned at the same distance from the right edge
  3. Consider creating a shared filter input component with consistent icon positioning

## Completed Items

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
