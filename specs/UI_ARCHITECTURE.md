# UI Architecture & Navigation Specification

This document defines the UI architecture, navigation patterns, and design standards for the Accountability application.

---

# Part 1: Implementation Plan & Progress

This section tracks known issues, implementation status, and priorities.

## Known Issues

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

### Issue 10: Redundant "Add First Exchange Rate" on Exchange Rate Page
- **Status**: Open
- **Problem**: The Exchange Rate page shows "Add First Exchange Rate" which is redundant (likely duplicate CTA or empty state showing incorrectly)
- **Expected**: Single clear CTA to add exchange rate - either in the page header OR in empty state, not both
- **Fix**:
  1. If page has data: show only the header "+ Add Exchange Rate" button
  2. If page is empty: show only the empty state with CTA
  3. Remove any duplicate/redundant buttons

### Issue 11: Add Buttons Broken Layout (Icon on Separate Line)
- **Status**: Open
- **Problem**: All "Add" buttons across the app display the "+" on a separate line from the text, making them look broken and unprofessional
- **Expected**: Add buttons should be single-line with a proper icon and text inline, looking polished across the entire app
- **Fix**: Create a standardized Add/Create button component:
  1. Use `whitespace-nowrap` or `flex-nowrap` to prevent line breaks
  2. Use a proper Plus icon from Lucide (`<Plus />`) instead of plain "+" text
  3. Use `inline-flex items-center gap-2` for proper icon + text alignment
  4. Apply consistent sizing: `px-4 py-2` padding
  5. Example structure:
     ```tsx
     <button className="inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 bg-blue-600 text-white rounded-lg">
       <Plus className="h-4 w-4" />
       <span>Add Exchange Rate</span>
     </button>
     ```
  6. Create a reusable `<AddButton>` component and use it everywhere

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
The `/organizations` page is the ONLY page that doesn't show the full sidebar. Instead it shows:
- A clean card-based selection UI
- "Create New Organization" button
- Each card shows: Name, Currency, Companies count
- Click card → navigate to org dashboard

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

| Menu Item | Opens | Route |
|-----------|-------|-------|
| Journal Entry | Journal entry creation form | `/organizations/:orgId/companies/:companyId/journal-entries/new` (prompts for company if needed) |
| Company | Company creation form | `/organizations/:orgId/companies/new` |
| Account | Account creation form | `/organizations/:orgId/companies/:companyId/accounts/new` (prompts for company if needed) |
| Exchange Rate | Exchange rate creation form | `/organizations/:orgId/exchange-rates/new` |

**IMPORTANT:** "New Company" MUST open the company creation form (`/companies/new`), NOT the companies list page.

### Sidebar State

- Sidebar is collapsible (save preference)
- Collapsed state shows icons only
- Keyboard shortcut: Ctrl+B or Cmd+B to toggle
- Mobile: sidebar hidden by default, hamburger menu to open

## Header

### Desktop Header
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Logo]  [Organization: Acme Holdings ▾]         [🔍]  [Avatar ▾]     │
└──────────────────────────────────────────────────────────────────────┘
```

Components:
1. **Logo**: Click returns to org dashboard (or org selector if no org)
2. **Organization Selector**: Dropdown to switch organizations
3. **Search** (future): Global search icon
4. **User Menu**: Avatar with dropdown for profile, settings, logout

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

**IMPORTANT:** "+ Create New Organization" MUST link to `/organizations/new`.

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
