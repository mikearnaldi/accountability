# UI Architecture & Navigation Specification

This document defines the UI architecture, navigation patterns, and design standards for the Accountability application. All UI implementations MUST follow these specifications.

## ⚠️ CRITICAL: Current Known Issues (MUST FIX)

The following issues are currently broken and MUST be fixed as highest priority:

### 1. Post-Login Redirect is Wrong
- **Expected**: After login, follow Post-Login Flow (see below):
  - No organizations → `/organizations/new`
  - Single organization → `/organizations/:id/dashboard`
  - Multiple organizations → `/organizations`
- **Actual**: User goes to `/` (home page) which shows a generic dashboard
- **File**: `packages/web/src/routes/login.tsx`
- **Fix**: After successful login, fetch organizations and redirect based on count:
  ```typescript
  // After successful login, determine redirect destination
  const orgsResult = await api.GET("/api/v1/organizations")
  const orgs = orgsResult.data?.organizations ?? []

  let redirectTo = searchParams.get("redirect")
  if (!redirectTo) {
    if (orgs.length === 0) {
      redirectTo = "/organizations/new"
    } else if (orgs.length === 1) {
      redirectTo = `/organizations/${orgs[0].id}/dashboard`
    } else {
      redirectTo = "/organizations"
    }
  }
  navigate({ to: redirectTo })
  ```
- Also update `beforeLoad` to redirect already-authenticated users the same way

### 2. Home Route (`/`) Should Redirect When Logged In
- **Expected**: When authenticated user visits `/`, redirect following Post-Login Flow (see below):
  - No organizations → `/organizations/new`
  - Single organization → `/organizations/:id/dashboard`
  - Multiple organizations → `/organizations`
- **Actual**: `/` shows a generic "main dashboard" that is NOT scoped to any organization
- **File**: `packages/web/src/routes/index.tsx`
- **Fix**: Add `beforeLoad` that fetches user's organizations and redirects accordingly:
  ```typescript
  beforeLoad: async ({ context }) => {
    if (context.user) {
      // Fetch organizations and redirect based on count
      const orgs = await fetchOrganizations()
      if (orgs.length === 0) {
        throw redirect({ to: "/organizations/new" })
      } else if (orgs.length === 1) {
        throw redirect({ to: "/organizations/$organizationId/dashboard", params: { organizationId: orgs[0].id } })
      } else {
        throw redirect({ to: "/organizations" })
      }
    }
  }
  ```

### 3. Organization Detail Page Missing AppLayout
- **Expected**: `/organizations/:id` should use AppLayout with sidebar and header
- **Actual**: Organization detail page has its own custom header (lines 205-219), NO sidebar
- **File**: `packages/web/src/routes/organizations/$organizationId/index.tsx`
- **Fix**:
  1. Import and wrap content in `AppLayout` component
  2. Remove the custom `<header>` element
  3. Pass organization data to AppLayout for breadcrumbs and sidebar

### 4. Dashboard Breadcrumb Flickers/Unstable
- **Expected**: Breadcrumbs should be stable, clicking "Organizations" navigates cleanly
- **Actual**: Clicking "Organizations" in breadcrumb briefly shows "Organizations" then flickers
- **Root Cause**: The `/` route (home) shows dashboard with breadcrumbs, but `/organizations` is a different page
- **Fix**: Once issues #1 and #2 are fixed, this should resolve itself

### 5. Inconsistent Page Layouts Across Routes
- **Problem**: Multiple pages under `/organizations` don't use AppLayout consistently
- **Files to audit**:
  - `packages/web/src/routes/organizations/$organizationId/index.tsx` - BROKEN (no AppLayout)
  - `packages/web/src/routes/organizations/index.tsx` - Check if uses AppLayout
  - `packages/web/src/routes/organizations/new.tsx` - Check if uses AppLayout
- **Fix**: Every authenticated route MUST use AppLayout wrapper

### Priority Order
1. Fix #2 first (redirect `/` to `/organizations` when logged in)
2. Fix #1 (post-login redirect)
3. Fix #3 (organization detail page layout)
4. Audit and fix #5 (all other pages)

---

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
│   └─ Acme   │                                                          │
│   └─ Beta   │                                                          │
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

Companies
  └─ [Company 1]
  └─ [Company 2]
  └─ [Add Company]

Reports
  └─ Trial Balance
  └─ Balance Sheet
  └─ Income Statement
  └─ Cash Flow
  └─ Equity Statement

Exchange Rates

Consolidation

Intercompany

Audit Log

──────────────
Settings
```

### "+ New" Quick Action Menu

The "+ New" button at top of sidebar provides fast access to common creation actions:
- New Journal Entry (most common)
- New Company
- New Account
- New Exchange Rate

### Company Sub-navigation

When a company is selected (user is on a company-scoped page), show company-specific navigation in the sidebar:

```
Companies
  └─ Acme Corp ← (selected, highlighted)
      └─ Chart of Accounts
      └─ Journal Entries
      └─ Fiscal Periods
      └─ Reports
  └─ Beta Inc
  └─ [Add Company]
```

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

### Form Pages

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
