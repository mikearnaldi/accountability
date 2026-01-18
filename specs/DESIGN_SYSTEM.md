# Accountability Design System

A comprehensive design system for the Accountability multi-company accounting application. This specification defines the visual language, component patterns, and interaction guidelines that ensure a consistent, professional, and accessible user experience.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Components](#5-components)
6. [Page Patterns](#6-page-patterns)
7. [Interaction Design](#7-interaction-design)
8. [Accessibility](#8-accessibility)
9. [Responsive Design](#9-responsive-design)
10. [Icons & Imagery](#10-icons--imagery)
11. [Motion & Animation](#11-motion--animation)
12. [Implementation Reference](#12-implementation-reference)

---

## 1. Design Principles

### 1.1 Core Values

**Clarity First**
Financial data demands precision. Every element should communicate clearly without ambiguity. Avoid decoration that doesn't serve a purpose.

**Professional Trust**
The interface should inspire confidence in financial operations. Use consistent patterns, clear hierarchies, and reliable behaviors that users can depend on.

**Efficient Workflows**
Accountants work with large volumes of data. Optimize for speed and reduce friction in common tasks. Dense information display is acceptable when it improves efficiency.

**Accessible by Default**
Financial software serves diverse users. Build accessibility into every component from the start, not as an afterthought.

**Progressive Disclosure**
Show essential information upfront, with details available on demand. Avoid overwhelming users while ensuring advanced features remain discoverable.

### 1.2 Design Tenets

1. **Consistency over creativity** - Use established patterns before inventing new ones
2. **Data density over whitespace** - Financial users prefer seeing more data
3. **Explicit over implicit** - Label clearly, avoid ambiguity in critical actions
4. **Reversible over confirmatory** - Allow undo where possible, use confirmation dialogs sparingly
5. **Keyboard accessible** - Every action should be achievable without a mouse

---

## 2. Color System

### 2.1 Color Philosophy

We use the OKLCH color space for perceptually uniform colors. This ensures consistent contrast ratios and accessibility across the palette. All colors are defined in CSS custom properties for easy theming.

### 2.2 Primary Palette

The primary blue conveys trust and professionalism, appropriate for financial software.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary-50` | `oklch(97% 0.01 250)` | Subtle backgrounds, hover states |
| `--color-primary-100` | `oklch(94% 0.02 250)` | Light backgrounds, selected states |
| `--color-primary-200` | `oklch(88% 0.04 250)` | Borders on primary elements |
| `--color-primary-300` | `oklch(80% 0.07 250)` | Secondary interactive elements |
| `--color-primary-400` | `oklch(70% 0.12 250)` | Hover states on dark backgrounds |
| `--color-primary-500` | `oklch(60% 0.16 250)` | Focus rings, links |
| `--color-primary-600` | `oklch(50% 0.18 250)` | Primary buttons, active states |
| `--color-primary-700` | `oklch(42% 0.16 250)` | Hover on primary buttons |
| `--color-primary-800` | `oklch(35% 0.12 250)` | Active/pressed states |
| `--color-primary-900` | `oklch(28% 0.08 250)` | Dark text on light backgrounds |
| `--color-primary-950` | `oklch(20% 0.05 250)` | Darkest shade |

### 2.3 Neutral Palette

Grays provide structure and hierarchy without drawing attention.

| Token | Tailwind | Usage |
|-------|----------|-------|
| `gray-50` | `#f9fafb` | Page backgrounds |
| `gray-100` | `#f3f4f6` | Card backgrounds, table headers, hover states |
| `gray-200` | `#e5e7eb` | Borders, dividers |
| `gray-300` | `#d1d5db` | Input borders (default state) |
| `gray-400` | `#9ca3af` | Placeholder text, icons |
| `gray-500` | `#6b7280` | Secondary text, help text |
| `gray-600` | `#4b5563` | Body text (secondary) |
| `gray-700` | `#374151` | Labels, subheadings |
| `gray-900` | `#111827` | Primary text, headings |

### 2.4 Semantic Colors

Colors that convey meaning in the application context.

#### Status Colors

| Status | Background | Text | Border | Usage |
|--------|------------|------|--------|-------|
| **Success** | `bg-green-100` | `text-green-800` | `border-green-200` | Completed, matched, approved |
| **Warning** | `bg-yellow-100` | `text-yellow-800` | `border-yellow-200` | Partial match, pending review |
| **Error** | `bg-red-100` | `text-red-800` | `border-red-200` | Failed, unmatched, rejected |
| **Info** | `bg-blue-100` | `text-blue-800` | `border-blue-200` | Informational notices |

#### Accounting-Specific Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-debit` | `oklch(55% 0.20 145)` | Debit entries (green) |
| `--color-credit` | `oklch(55% 0.20 25)` | Credit entries (red/orange) |
| `--color-balance` | `oklch(50% 0.18 250)` | Balance verification (blue) |

**Usage classes:**
```css
.text-debit   /* Debit amounts */
.text-credit  /* Credit amounts */
.text-balance /* Balance amounts */
```

### 2.5 Specialty Badge Colors

For categorizing different transaction types and entities.

| Category | Background | Text |
|----------|------------|------|
| Management Fees | `bg-purple-100` | `text-purple-800` |
| Capital Contributions | `bg-indigo-100` | `text-indigo-800` |
| Cost Allocations | `bg-orange-100` | `text-orange-800` |
| Royalties | `bg-pink-100` | `text-pink-800` |
| Loans | `bg-amber-100` | `text-amber-800` |
| Services | `bg-teal-100` | `text-teal-800` |

### 2.6 Color Application Rules

1. **Never use color alone** to convey meaning - always pair with text or icons
2. **Maintain 4.5:1 contrast ratio** for normal text, 3:1 for large text
3. **Use semantic colors consistently** - green always means success, red always means error
4. **Limit primary color usage** to interactive elements and key actions
5. **Reserve red** for errors and destructive actions only

---

## 3. Typography

### 3.1 Font Stack

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
             Roboto, "Helvetica Neue", Arial, sans-serif;
```

System fonts ensure fast loading, native feel, and excellent legibility across platforms.

### 3.2 Type Scale

| Level | Class | Size | Weight | Line Height | Usage |
|-------|-------|------|--------|-------------|-------|
| Display | `text-3xl` | 30px | `font-bold` | 1.2 | Marketing, major headings |
| Heading 1 | `text-2xl` | 24px | `font-bold` | 1.3 | Page titles |
| Heading 2 | `text-xl` | 20px | `font-semibold` | 1.4 | Section titles |
| Heading 3 | `text-lg` | 18px | `font-semibold` | 1.5 | Card headers, subsections |
| Body | `text-base` | 16px | `font-normal` | 1.5 | Default paragraph text |
| Body Small | `text-sm` | 14px | `font-normal` | 1.5 | Secondary text, form helpers |
| Caption | `text-xs` | 12px | `font-medium` | 1.5 | Badges, table headers, tooltips |

### 3.3 Font Weights

| Weight | Class | Usage |
|--------|-------|-------|
| 400 | `font-normal` | Body text, descriptions |
| 500 | `font-medium` | Button labels, form labels, emphasis |
| 600 | `font-semibold` | Subheadings, table headers, card titles |
| 700 | `font-bold` | Page titles, strong emphasis |

### 3.4 Text Colors

| Purpose | Class | When to Use |
|---------|-------|-------------|
| Primary | `text-gray-900` | Main content, headings, critical information |
| Secondary | `text-gray-700` | Labels, less important text |
| Tertiary | `text-gray-500` | Help text, descriptions, placeholders |
| Muted | `text-gray-400` | Disabled states, decorative text |
| Link | `text-blue-600` | Interactive text links |
| Error | `text-red-600` | Error messages, validation feedback |
| Success | `text-green-700` | Success messages |

### 3.5 Typography Patterns

#### Page Title
```html
<h1 class="text-2xl font-bold text-gray-900">Page Title</h1>
```

#### Section Header
```html
<h2 class="text-lg font-semibold text-gray-900">Section Title</h2>
```

#### Card Header
```html
<h3 class="text-lg font-semibold text-gray-900">Card Title</h3>
<p class="mt-1 text-sm text-gray-500">Optional description text</p>
```

#### Form Label
```html
<label class="block text-sm font-medium text-gray-700 mb-1">
  Field Label
</label>
```

#### Form Helper Text
```html
<p class="mt-1 text-sm text-gray-500">Helper text explaining the field</p>
```

#### Form Error
```html
<p class="mt-1 text-sm text-red-600">Error message</p>
```

#### Table Header
```html
<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Column Name
</th>
```

### 3.6 Typography Rules

1. **Use sentence case** for headings, labels, and buttons (not Title Case)
2. **Left-align text** by default; right-align numbers in tables
3. **Limit line length** to 65-75 characters for readability
4. **Use consistent heading hierarchy** - never skip levels
5. **Avoid all caps** except for table headers and badges

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

Based on a 4px grid system for precise alignment.

| Token | Value | Class | Usage |
|-------|-------|-------|-------|
| `0.5` | 2px | `p-0.5` | Minimal spacing |
| `1` | 4px | `p-1`, `gap-1` | Tight internal spacing |
| `1.5` | 6px | `p-1.5`, `gap-1.5` | Button icon spacing |
| `2` | 8px | `p-2`, `gap-2` | Standard internal spacing |
| `3` | 12px | `p-3`, `gap-3` | Component spacing |
| `4` | 16px | `p-4`, `gap-4` | Section spacing |
| `6` | 24px | `p-6`, `gap-6` | Card padding, major sections |
| `8` | 32px | `p-8` | Large section spacing |
| `12` | 48px | `p-12` | Extra large spacing |
| `16` | 64px | `p-16` | Page-level spacing |

### 4.2 Layout Tokens

```css
--sidebar-width: 16rem;           /* 256px - expanded sidebar */
--sidebar-collapsed-width: 4rem;  /* 64px - collapsed sidebar */
--header-height: 4rem;            /* 64px - main header */
```

### 4.3 Page Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Sidebar (256px)  │  Main Content Area                          │
│                  │  ┌─────────────────────────────────────────┐ │
│ Logo/Brand       │  │ Header (64px)                           │ │
│                  │  │ [Mobile Menu] [Org Selector] [Profile]  │ │
│ Navigation       │  ├─────────────────────────────────────────┤ │
│ - Dashboard      │  │                                         │ │
│ - Companies      │  │ Content (flex-1, overflow-y-auto)       │ │
│ - Accounts       │  │ - Breadcrumbs                           │ │
│ - Journal        │  │ - Page Content                          │ │
│ - Reports        │  │   padding: 16px (mobile) / 24px (lg+)   │ │
│ - Consolidation  │  │                                         │ │
│ - Settings       │  │                                         │ │
│                  │  │                                         │ │
│ [Quick Actions]  │  │                                         │ │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Common Spacing Patterns

#### Form Field
```
┌─────────────────────────────┐
│ Label                       │  mb-1 (4px)
├─────────────────────────────┤
│ Input                       │
├─────────────────────────────┤
│ Helper/Error text           │  mt-1 (4px)
└─────────────────────────────┘
  mb-4 (16px) to next field
```

#### Card Layout
```
┌─────────────────────────────┐
│ p-6 (24px padding)          │
│ ┌─────────────────────────┐ │
│ │ Card Header             │ │  mb-4 (16px)
│ ├─────────────────────────┤ │
│ │                         │ │
│ │ Card Body               │ │
│ │                         │ │
│ ├─────────────────────────┤ │
│ │ Card Footer             │ │  mt-4 pt-4 border-t
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

#### Button Groups
```
┌─────────┐     ┌─────────┐
│ Cancel  │ 12px│  Save   │
└─────────┘ gap └─────────┘
```

### 4.5 Grid System

Use CSS Grid or Flexbox for layouts. Common patterns:

```html
<!-- Two-column form layout -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Input label="First Name" />
  <Input label="Last Name" />
</div>

<!-- Three-column card grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card />
  <Card />
  <Card />
</div>

<!-- Flex row with spacing -->
<div class="flex items-center gap-3">
  <Button variant="secondary">Cancel</Button>
  <Button variant="primary">Save</Button>
</div>
```

---

## 5. Components

### 5.1 Button

The primary interactive element for user actions.

#### Variants

| Variant | Usage | Appearance |
|---------|-------|------------|
| `primary` | Main actions (Save, Create, Submit) | Blue background, white text |
| `secondary` | Secondary actions (Cancel, Back) | White background, gray border |
| `danger` | Destructive actions (Delete, Remove) | Red background, white text |
| `ghost` | Tertiary actions, inline triggers | Transparent, gray text |

#### Sizes

| Size | Padding | Font | Usage |
|------|---------|------|-------|
| `sm` | `px-3 py-1.5` | `text-sm` | Compact UI, table actions |
| `md` | `px-4 py-2` | `text-sm` | Default, most buttons |
| `lg` | `px-6 py-3` | `text-base` | Prominent CTAs |

#### States

| State | Visual Change |
|-------|---------------|
| Default | Base styling |
| Hover | Darker background |
| Active/Pressed | Even darker background |
| Focus | 2px ring with offset |
| Disabled | 50% opacity, not-allowed cursor |
| Loading | Spinner, text hidden, disabled |

#### Usage Guidelines

1. Use `primary` sparingly - one per section
2. Place primary action on the right in button groups
3. Always include icon + text for important actions
4. Use loading state for async operations
5. Disable during form validation errors

### 5.2 Input

Text input field for form data entry.

#### Anatomy

```
┌─────────────────────────────────────┐
│ Label                               │
├─────────────────────────────────────┤
│ [Icon] Input text          [Icon]  │
├─────────────────────────────────────┤
│ Helper text or Error message        │
└─────────────────────────────────────┘
```

#### States

| State | Border | Ring |
|-------|--------|------|
| Default | `border-gray-300` | None |
| Focus | `border-blue-500` | `ring-blue-500` |
| Error | `border-red-300` | `ring-red-500` (on focus) |
| Disabled | `border-gray-200` | None, `bg-gray-50` |

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Form label above input |
| `error` | `string` | Error message (red) |
| `helperText` | `string` | Helper text (gray) |
| `inputPrefix` | `ReactNode` | Icon/element before input |
| `inputSuffix` | `ReactNode` | Icon/element after input |

### 5.3 Select

Dropdown for selecting from predefined options.

#### Features

- Label support
- Option groups
- Placeholder option
- Error and helper text
- Custom chevron icon

#### Specialized Selects

| Component | Purpose |
|-----------|---------|
| `CurrencySelect` | ISO 4217 currency codes |
| `JurisdictionSelect` | Country/jurisdiction selection |
| `ConsolidationMethodSelect` | Consolidation methods |
| `FiscalYearEndPicker` | Month/day picker |

### 5.4 Card

Container for grouping related content.

#### Variants

| Variant | Styling | Usage |
|---------|---------|-------|
| `default` | White bg, gray border | Standard content grouping |
| `bordered` | White bg, gray border | Same as default |
| `elevated` | White bg, shadow | Featured content, modals |

#### Composition

```jsx
<Card variant="default">
  <CardHeader
    title="Card Title"
    description="Optional description"
    action={<Button>Action</Button>}
  />
  <CardBody>
    {/* Main content */}
  </CardBody>
  <CardFooter>
    {/* Actions or metadata */}
  </CardFooter>
</Card>
```

### 5.5 Table

Data display for lists and grids.

#### Features

- Sortable column headers
- Column tooltips for explanations
- Zebra striping (optional)
- Row hover effects
- Sticky header (optional)
- Horizontal scroll on overflow

#### Composition

```jsx
<Table striped hoverable>
  <TableHeader>
    <TableRow>
      <TableHeaderCell sortable tooltip="Account unique identifier">
        Account Code
      </TableHeaderCell>
      <TableHeaderCell>Name</TableHeaderCell>
      <TableHeaderCell align="right">Balance</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>1000</TableCell>
      <TableCell>Cash</TableCell>
      <TableCell align="right">$10,000.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Cell Alignment

| Content Type | Alignment |
|--------------|-----------|
| Text | Left |
| Numbers/Currency | Right |
| Status/Actions | Center |

### 5.6 Badge

Small label for status or categorization.

#### Structure

```html
<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium [bg-color] [text-color]">
  <Icon class="h-3 w-3" />
  Badge Text
</span>
```

#### Status Badges

| Status | Classes |
|--------|---------|
| Success | `bg-green-100 text-green-800` |
| Warning | `bg-yellow-100 text-yellow-800` |
| Error | `bg-red-100 text-red-800` |
| Info | `bg-blue-100 text-blue-800` |
| Neutral | `bg-gray-100 text-gray-800` |

### 5.7 Tooltip

Contextual information on hover.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | Required | Tooltip text |
| `position` | `top\|bottom\|left\|right` | `top` | Placement |

#### Styling

```
px-2 py-1 text-xs font-normal text-white bg-gray-900 rounded shadow-lg
```

### 5.8 Empty State

Placeholder when no data is available.

#### Anatomy

```
┌─────────────────────────────────────┐
│              [Icon]                 │
│                                     │
│          Title Message              │
│                                     │
│     Description text explaining     │
│     what to do next                 │
│                                     │
│        [Primary Action]             │
│        [Secondary Action]           │
└─────────────────────────────────────┘
```

#### Sizes

| Size | Padding | Icon | Title |
|------|---------|------|-------|
| `sm` | `py-6 px-4` | `h-10 w-10` | `text-base` |
| `md` | `py-12 px-4` | `h-12 w-12` | `text-lg` |
| `lg` | `py-16 px-6` | `h-16 w-16` | `text-xl` |

#### Presets

- `NoOrganizationsEmptyState`
- `NoCompaniesEmptyState`
- `NoAccountsEmptyState`
- `NoJournalEntriesEmptyState`
- `NoSearchResultsEmptyState`

### 5.9 Loading State

Visual feedback during async operations.

#### Components

| Component | Usage |
|-----------|-------|
| `Spinner` | Inline loading indicator |
| `LoadingState` | Full container with spinner |
| `Skeleton` | Placeholder for loading content |
| `SkeletonText` | Multiple line placeholders |
| `SkeletonCard` | Card-shaped placeholder |
| `TableSkeleton` | Table placeholder |
| `PageLoader` | Full-page loading overlay |
| `InlineLoading` | Inline spinner with text |

### 5.10 Error State

Error feedback and recovery options.

#### Variants

| Variant | Usage |
|---------|-------|
| `inline` | Inline error messages |
| `card` | Error within a card context |
| `fullPage` | Full page error (404, 500) |

#### Presets

- `ErrorState` - Generic error
- `ErrorAlert` - Dismissible alert
- `NetworkErrorState` - Connection issues
- `NotFoundErrorState` - 404 errors
- `PermissionErrorState` - Access denied

---

## 6. Page Patterns

### 6.1 List Page

Display collections of items with actions.

```
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                 │
├─────────────────────────────────────────────────────────────┤
│ Page Title                              [+ Create New]      │
├─────────────────────────────────────────────────────────────┤
│ [Search] [Filters]                      [Sort] [View]       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Table Header                                            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Row 1                                                   │ │
│ │ Row 2                                                   │ │
│ │ Row 3                                                   │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Pagination                                                  │
└─────────────────────────────────────────────────────────────┘
```

#### States

1. **Loading** - Table skeleton
2. **Empty** - Empty state with CTA
3. **Error** - Error state with retry
4. **Data** - Table with content

### 6.2 Detail Page

View and manage a single entity.

```
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                 │
├─────────────────────────────────────────────────────────────┤
│ Entity Name [Status Badge]          [Edit] [Delete]         │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌────────────────────────────┐ │
│ │ Primary Info Card        │ │ Secondary Info Card        │ │
│ │                          │ │                            │ │
│ │ Key: Value               │ │ Key: Value                 │ │
│ │ Key: Value               │ │ Key: Value                 │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Related Items Section                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Related Items Table                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Form Page

Create or edit an entity.

```
┌─────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                 │
├─────────────────────────────────────────────────────────────┤
│ Form Title                                                  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Card                                                    │ │
│ │                                                         │ │
│ │ ┌─────────────────┐ ┌─────────────────┐                 │ │
│ │ │ Field 1         │ │ Field 2         │                 │ │
│ │ └─────────────────┘ └─────────────────┘                 │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────┐                 │ │
│ │ │ Field 3 (full width)                │                 │ │
│ │ └─────────────────────────────────────┘                 │ │
│ │                                                         │ │
│ │ ▼ Advanced Options (collapsible)                        │ │
│ │   ┌─────────────────────────────────────┐               │ │
│ │   │ Advanced Field                      │               │ │
│ │   └─────────────────────────────────────┘               │ │
│ │                                                         │ │
│ │                      [Cancel]  [Save]                   │ │
│ └─────────────────────────────────────────┘               │ │
└─────────────────────────────────────────────────────────────┘
```

#### Form Layout Guidelines

1. **Group related fields** visually
2. **Use 2-column layout** for short fields (name, code)
3. **Use full width** for long text fields
4. **Progressive disclosure** for advanced options
5. **Sticky footer** for long forms
6. **Validation** inline as user types

### 6.4 Dashboard Page

Overview with metrics and quick actions.

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard Title                     [Date Range Selector]   │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ Metric 1 │ │ Metric 2 │ │ Metric 3 │ │ Metric 4 │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌──────────────────────────┐ │
│ │ Chart/Graph                │ │ Quick Actions            │ │
│ │                            │ │ - Create Journal Entry   │ │
│ │                            │ │ - Run Report             │ │
│ │                            │ │ - Review Pending         │ │
│ └────────────────────────────┘ └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌──────────────────────────┐ │
│ │ Recent Activity            │ │ Upcoming Deadlines       │ │
│ │ - Item 1                   │ │ - Deadline 1             │ │
│ │ - Item 2                   │ │ - Deadline 2             │ │
│ └────────────────────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Interaction Design

### 7.1 Click/Tap Targets

- **Minimum size**: 44x44px for touch targets
- **Buttons**: Full button area is clickable
- **Links**: Text only (not padding)
- **Table rows**: Full row for navigation

### 7.2 Hover States

| Element | Hover Effect |
|---------|--------------|
| Button (primary) | Darker background |
| Button (secondary) | Light gray background |
| Link | Underline |
| Table row | Light gray background |
| Nav item | Light gray background |
| Card | None (unless clickable) |

### 7.3 Focus States

All interactive elements must have visible focus states.

```css
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
```

| Element | Focus Ring |
|---------|------------|
| Button | 2px ring with 2px offset |
| Input | 2px ring with no offset |
| Link | 2px ring with 2px offset |
| Checkbox | 2px ring with 2px offset |

### 7.4 Loading Behavior

| Action | Feedback |
|--------|----------|
| Button click (async) | Button shows spinner, disabled |
| Form submit | Button shows spinner, form disabled |
| Page load | Page skeleton |
| Data fetch | Table skeleton or inline spinner |
| Background save | Toast notification on completion |

### 7.5 Feedback Patterns

| Event | Feedback Method |
|-------|-----------------|
| Success | Toast notification (auto-dismiss) |
| Error | Inline error message, error toast |
| Warning | Warning toast or inline alert |
| Validation | Inline field errors |
| Confirmation | Modal dialog for destructive actions |

### 7.6 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus forward |
| `Shift+Tab` | Move focus backward |
| `Enter` | Activate button/link |
| `Space` | Toggle checkbox, activate button |
| `Escape` | Close modal/dropdown |
| `Arrow keys` | Navigate within menus/lists |
| `Ctrl/Cmd+B` | Toggle sidebar |

---

## 8. Accessibility

### 8.1 WCAG 2.1 AA Compliance

This design system targets WCAG 2.1 Level AA compliance.

#### Color Contrast

| Text Type | Minimum Ratio |
|-----------|---------------|
| Normal text | 4.5:1 |
| Large text (18px+) | 3:1 |
| UI components | 3:1 |

#### Focus Visibility

All interactive elements must have visible focus indicators that:
- Have at least 3:1 contrast ratio
- Are visible on all backgrounds
- Don't rely on color alone

### 8.2 Semantic HTML

| Content | Element |
|---------|---------|
| Page title | `<h1>` |
| Section title | `<h2>` - `<h6>` |
| Navigation | `<nav>` |
| Main content | `<main>` |
| Form controls | `<label>`, `<input>`, etc. |
| Tables | `<table>`, `<thead>`, `<th>`, etc. |
| Lists | `<ul>`, `<ol>`, `<li>` |

### 8.3 ARIA Attributes

| Attribute | Usage |
|-----------|-------|
| `aria-label` | Icon-only buttons |
| `aria-describedby` | Input helper/error text |
| `aria-invalid` | Invalid form fields |
| `aria-busy` | Loading containers |
| `aria-live` | Dynamic content updates |
| `aria-expanded` | Expandable sections |
| `aria-selected` | Selected items |
| `aria-sort` | Sorted table columns |
| `role="status"` | Status messages |
| `role="alert"` | Error messages |

### 8.4 Screen Reader Support

1. **Skip links** - "Skip to main content" link at page start
2. **Landmarks** - Proper use of header, nav, main, footer
3. **Headings** - Logical hierarchy (h1 > h2 > h3)
4. **Alt text** - Descriptive text for meaningful images
5. **Form labels** - Every input has an associated label
6. **Error announcements** - Errors announced via aria-live

### 8.5 Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Responsive Design

### 9.1 Breakpoints

| Name | Size | Usage |
|------|------|-------|
| `sm` | 640px | Small tablets, large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops, large tablets |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

### 9.2 Mobile-First Approach

Write base styles for mobile, add complexity at larger breakpoints:

```html
<!-- Mobile: stack, Desktop: side-by-side -->
<div class="flex flex-col lg:flex-row gap-4">
  <div class="w-full lg:w-1/2">...</div>
  <div class="w-full lg:w-1/2">...</div>
</div>
```

### 9.3 Responsive Patterns

#### Navigation

| Breakpoint | Behavior |
|------------|----------|
| Mobile | Sidebar hidden, hamburger menu |
| lg+ | Sidebar visible, collapsible |

#### Content Padding

| Breakpoint | Padding |
|------------|---------|
| Mobile | `p-4` (16px) |
| lg+ | `p-6` (24px) |

#### Tables

| Breakpoint | Behavior |
|------------|----------|
| Mobile | Horizontal scroll |
| lg+ | Full table visible |

#### Form Layouts

| Breakpoint | Behavior |
|------------|----------|
| Mobile | Single column |
| md+ | Two columns where appropriate |

#### Cards

| Breakpoint | Behavior |
|------------|----------|
| Mobile | Single column |
| md+ | Two columns |
| lg+ | Three columns |

### 9.4 Touch Considerations

1. **Minimum touch target**: 44x44px
2. **Adequate spacing**: 8px+ between touch targets
3. **No hover-only interactions**: Ensure all hover effects have touch alternatives
4. **Swipe gestures**: Only as enhancement, not requirement

---

## 10. Icons & Imagery

### 10.1 Icon Library

We use [Lucide React](https://lucide.dev/) for icons.

```jsx
import { Plus, ChevronDown, Check, X, AlertCircle } from 'lucide-react'
```

### 10.2 Icon Sizes

| Size | Class | Usage |
|------|-------|-------|
| XS | `h-3 w-3` | Badges, inline indicators |
| SM | `h-4 w-4` | Buttons, form icons |
| MD | `h-5 w-5` | Navigation, standalone icons |
| LG | `h-6 w-6` | Page headers, feature icons |
| XL | `h-8 w-8` | Empty states (small) |
| 2XL | `h-12 w-12` | Empty states (medium) |
| 3XL | `h-16 w-16` | Empty states (large) |

### 10.3 Icon Usage Guidelines

1. **Always include text labels** for primary actions
2. **Use tooltips** for icon-only buttons
3. **Maintain consistent meaning** - same icon for same action
4. **Use appropriate weight** - match icon stroke to text weight
5. **Ensure accessibility** - use aria-label for icon-only buttons

### 10.4 Common Icons

| Action/Concept | Icon |
|----------------|------|
| Add/Create | `Plus` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Close | `X` |
| Search | `Search` |
| Filter | `Filter` |
| Sort | `ArrowUpDown` |
| Settings | `Settings` |
| User | `User` |
| Organization | `Building2` |
| Company | `Building` |
| Success | `Check` / `CheckCircle` |
| Warning | `AlertTriangle` |
| Error | `AlertCircle` |
| Info | `Info` |
| Expand | `ChevronDown` |
| Collapse | `ChevronUp` |
| Navigate | `ChevronRight` |
| External link | `ExternalLink` |
| Download | `Download` |
| Upload | `Upload` |

### 10.5 Empty State Illustrations

For empty states, use outlined Lucide icons in `text-gray-400`:

| Context | Icon |
|---------|------|
| No organizations | `Building2` |
| No companies | `Building` |
| No accounts | `CreditCard` |
| No journal entries | `FileText` |
| No search results | `Search` |
| Generic empty | `Inbox` |

---

## 11. Motion & Animation

### 11.1 Animation Principles

1. **Purposeful** - Animation should aid understanding, not decorate
2. **Quick** - Keep durations short (150-300ms)
3. **Subtle** - Avoid dramatic or distracting motion
4. **Consistent** - Use same timing for similar actions

### 11.2 Duration Scale

| Duration | Usage |
|----------|-------|
| 75ms | Micro-interactions (hover color) |
| 150ms | Standard transitions |
| 200ms | Sidebar collapse/expand |
| 300ms | Modal open/close |

### 11.3 Easing Functions

| Easing | Usage |
|--------|-------|
| `ease-out` | Elements entering |
| `ease-in` | Elements exiting |
| `ease-in-out` | Elements transforming |
| `linear` | Loading spinners |

### 11.4 Animation Patterns

| Element | Animation |
|---------|-----------|
| Button hover | Background color transition (75ms) |
| Sidebar toggle | Width transition (200ms) |
| Modal appear | Fade + scale up (300ms) |
| Modal disappear | Fade + scale down (200ms) |
| Dropdown open | Fade + slide down (150ms) |
| Spinner | Continuous rotation (linear) |
| Skeleton | Pulse opacity (1.5s) |

### 11.5 Reduced Motion

Always respect `prefers-reduced-motion`. When enabled:
- Replace motion with instant state changes
- Keep essential feedback (spinners can continue)
- Remove decorative animations entirely

---

## 12. Implementation Reference

### 12.1 File Structure

```
packages/web/src/
├── components/
│   ├── ui/                     # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Card.tsx
│   │   ├── Table.tsx
│   │   ├── Tooltip.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingState.tsx
│   │   ├── ErrorState.tsx
│   │   └── ...
│   ├── layout/                 # Layout components
│   │   ├── AppLayout.tsx
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Breadcrumbs.tsx
│   │   └── OrganizationSelector.tsx
│   ├── forms/                  # Form components
│   │   ├── OrganizationForm.tsx
│   │   ├── CompanyForm.tsx
│   │   └── ...
│   └── domain/                 # Domain-specific components
│       ├── dashboard/
│       ├── intercompany/
│       ├── reports/
│       └── ...
├── index.css                   # Global styles, theme tokens
└── routes/                     # Page components
```

### 12.2 CSS Custom Properties

```css
@theme {
  /* Primary palette */
  --color-primary-50: oklch(97% 0.01 250);
  --color-primary-100: oklch(94% 0.02 250);
  --color-primary-200: oklch(88% 0.04 250);
  --color-primary-300: oklch(80% 0.07 250);
  --color-primary-400: oklch(70% 0.12 250);
  --color-primary-500: oklch(60% 0.16 250);
  --color-primary-600: oklch(50% 0.18 250);
  --color-primary-700: oklch(42% 0.16 250);
  --color-primary-800: oklch(35% 0.12 250);
  --color-primary-900: oklch(28% 0.08 250);
  --color-primary-950: oklch(20% 0.05 250);

  /* Accounting colors */
  --color-debit: oklch(55% 0.20 145);
  --color-credit: oklch(55% 0.20 25);
  --color-balance: oklch(50% 0.18 250);

  /* Layout */
  --sidebar-width: 16rem;
  --sidebar-collapsed-width: 4rem;
}
```

### 12.3 Component Usage Examples

#### Button

```jsx
// Primary action
<Button variant="primary" icon={<Plus />}>
  Create Organization
</Button>

// Secondary action
<Button variant="secondary">Cancel</Button>

// Destructive action
<Button variant="danger" icon={<Trash2 />}>
  Delete
</Button>

// Loading state
<Button variant="primary" loading>
  Saving...
</Button>
```

#### Input

```jsx
<Input
  label="Organization Name"
  placeholder="Enter name"
  error={errors.name}
  helperText="This will be displayed in the sidebar"
/>
```

#### Card

```jsx
<Card>
  <CardHeader
    title="Company Details"
    description="View and manage company information"
    action={<Button variant="secondary" size="sm">Edit</Button>}
  />
  <CardBody>
    {/* Content */}
  </CardBody>
</Card>
```

#### Table

```jsx
<Table striped hoverable>
  <TableHeader>
    <TableRow>
      <TableHeaderCell sortable>Name</TableHeaderCell>
      <TableHeaderCell tooltip="International currency code">Code</TableHeaderCell>
      <TableHeaderCell align="right">Balance</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.code}</TableCell>
        <TableCell align="right">{item.balance}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

#### Empty State

```jsx
<NoAccountsEmptyState
  action={
    <Button variant="primary" icon={<Plus />}>
      Create Account
    </Button>
  }
/>
```

### 12.4 Page Template Example

```jsx
export function ListPage() {
  const { data, isLoading, error } = useData()

  if (isLoading) return <TableSkeleton rows={5} />
  if (error) return <ErrorState title="Failed to load" onRetry={refetch} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Items</h1>
        <Button variant="primary" icon={<Plus />}>
          Create Item
        </Button>
      </div>

      {/* Content */}
      {data.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="No items yet"
          description="Create your first item to get started"
          action={<Button variant="primary">Create Item</Button>}
        />
      ) : (
        <Card>
          <Table striped hoverable>
            {/* Table content */}
          </Table>
        </Card>
      )}
    </div>
  )
}
```

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-18 | 1.0.0 | Initial design system specification |
