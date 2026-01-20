# Frontend Guide

This is the consolidated guide for frontend development in the Accountability project, covering React patterns, styling, components, and UX best practices.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [State Management](#state-management)
3. [Data Fetching](#data-fetching)
4. [Styling with Tailwind](#styling-with-tailwind)
5. [Component Patterns](#component-patterns)
6. [Page Templates](#page-templates)
7. [Empty, Loading, and Error States](#empty-loading-and-error-states)
8. [Form Design](#form-design)
9. [Navigation & Layout](#navigation--layout)
10. [Accessibility](#accessibility)
11. [Design System Reference](#design-system-reference)

---

## Architecture Overview

**NO Effect code in frontend.** The frontend uses:
- **TanStack Start** - Full-stack React framework with SSR
- **openapi-fetch** - Typed fetch client generated from Effect HttpApi's OpenAPI spec
- **Tailwind CSS** - Utility-first CSS framework

**Data Flow:**
```
Frontend (openapi-fetch) → API (Effect HttpApi) → Service → Repository → Database
```

### File Structure

```
packages/web/src/
├── routes/              # TanStack file-based routing
│   ├── __root.tsx       # Root layout (AppLayout)
│   ├── index.tsx        # Home page
│   └── organizations/   # Nested routes
├── components/          # Shared components
│   ├── ui/              # Base UI components
│   └── [feature]/       # Feature-specific components
├── api/                 # API client setup
│   └── client.ts        # openapi-fetch instance
└── utils/               # Utility functions
```

---

## State Management

### Server State: Use Loaders

Fetch server data in route loaders, not in components:

```typescript
// routes/organizations/index.tsx
export const Route = createFileRoute("/organizations/")({
  loader: async () => {
    const { data } = await api.GET("/api/v1/organizations")
    return { organizations: data ?? [] }
  },
  component: OrganizationsPage
})

function OrganizationsPage() {
  // Data is immediately available from SSR
  const { organizations } = Route.useLoaderData()
  return <ul>{organizations.map(org => <li key={org.id}>{org.name}</li>)}</ul>
}
```

### Local State: Use useState

Use `useState` for local, ephemeral UI state:

```typescript
function FilterPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  // ...
}
```

### Form State: Local Until Submit

Keep form state local until submission:

```typescript
function CreateOrganizationForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const { data, error: apiError } = await api.POST("/api/v1/organizations", {
      body: { name }
    })

    if (apiError) {
      setError(apiError.body?.message ?? "Failed to create")
      setIsSubmitting(false)
      return
    }

    await router.invalidate()  // Refetch loader data
    router.navigate({ to: `/organizations/${data.id}` })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### URL State: Use Search Params

For shareable state (filters, pagination):

```typescript
const searchSchema = z.object({
  page: z.number().optional().default(1),
  status: z.string().optional()
})

export const Route = createFileRoute("/entries/")({
  validateSearch: searchSchema,
  loader: async ({ deps: { page, status } }) => {
    const { data } = await api.GET("/api/v1/entries", {
      params: { query: { page, status, limit: 20 } }
    })
    return { entries: data ?? [] }
  }
})
```

### Anti-Patterns

```typescript
// DON'T fetch data in useEffect
useEffect(() => {
  api.GET("/api/v1/items").then(({ data }) => setData(data))
}, [])

// DON'T store server data in useState
const { items } = Route.useLoaderData()
const [localItems, setLocalItems] = useState(items)  // Syncing nightmare

// DON'T manage async state manually
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
const [data, setData] = useState(null)
```

---

## Data Fetching

### Parallel Data Fetching

```typescript
export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    const [orgsResult, statsResult, recentResult] = await Promise.all([
      api.GET("/api/v1/organizations"),
      api.GET("/api/v1/dashboard/stats"),
      api.GET("/api/v1/activity/recent")
    ])

    return {
      organizations: orgsResult.data ?? [],
      stats: statsResult.data ?? null,
      recentActivity: recentResult.data ?? []
    }
  }
})
```

### Revalidation After Mutations

After any mutation, call `router.invalidate()`:

```typescript
const handleSave = async () => {
  const { error } = await api.PATCH("/api/v1/organizations/{id}", {
    params: { path: { id: organization.id } },
    body: { name }
  })

  if (!error) {
    await router.invalidate()  // Refetch all loader data
  }
}
```

---

## Styling with Tailwind

### CSS Setup for TanStack Start (CRITICAL)

**NEVER use side-effect CSS imports** - they cause Flash of Unstyled Content (FOUC):

```typescript
// CORRECT: Import CSS as URL and add to head
import appCss from "../index.css?url"

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: "stylesheet", href: appCss }]
  }),
  component: RootComponent
})

// WRONG: Side-effect import (causes FOUC)
import "../index.css"  // DON'T DO THIS
```

### Use Tailwind Classes Directly

```typescript
function Button({ children, variant = "primary" }: Props) {
  const baseClasses = "px-4 py-2 rounded-md font-medium transition-colors"
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    danger: "bg-red-600 text-white hover:bg-red-700"
  }

  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  )
}
```

### Use clsx for Conditional Classes

```typescript
import { clsx } from "clsx"

function Button({ disabled, loading, className, children }: Props) {
  return (
    <button
      className={clsx(
        "px-4 py-2 rounded-md font-medium",
        "bg-blue-600 text-white hover:bg-blue-700",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        loading && "animate-pulse",
        className
      )}
      disabled={disabled || loading}
    >
      {children}
    </button>
  )
}
```

### Responsive Design

```typescript
function Layout({ children }: Props) {
  return (
    <div className="
      flex flex-col md:flex-row
      gap-4
      p-4 md:p-6 lg:p-8
      max-w-7xl mx-auto
    ">
      {children}
    </div>
  )
}
```

---

## Component Patterns

### Presentational vs Container Components

**Presentational components** receive props:

```typescript
interface UserCardProps {
  readonly user: User
  readonly onEdit: () => void
  readonly onDelete: () => void
}

function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3>{user.name}</h3>
      <button onClick={onEdit}>Edit</button>
    </div>
  )
}
```

**Route components** connect to loader data:

```typescript
function UsersPage() {
  const { users } = Route.useLoaderData()
  const router = useRouter()

  const handleDelete = async (id: string) => {
    await api.DELETE("/api/v1/users/{id}", { params: { path: { id } } })
    router.invalidate()
  }

  return (
    <div>
      {users.map(user => (
        <UserCard
          key={user.id}
          user={user}
          onDelete={() => handleDelete(user.id)}
        />
      ))}
    </div>
  )
}
```

### Composition Over Props

```typescript
// GOOD: Composition
<Card>
  <CardHeader><h2>Title</h2></CardHeader>
  <CardBody><p>Content</p></CardBody>
</Card>

// BAD: Prop drilling
<Card
  title="Title"
  content={<p>Content</p>}
  showHeader={true}
/>
```

---

## Page Templates

### List Page Template

```
+------------------------------------------+
|  [Breadcrumbs]                           |
|  Page Title                              |
|  [Optional: Description]                 |
+------------------------------------------+
|  [Filters/Search] [Primary Action Button]|
+------------------------------------------+
|  +------------------------------------+  |
|  | Data Table / Card Grid             |  |
|  | - Column headers with tooltips     |  |
|  | - Row actions                      |  |
|  | - Pagination                       |  |
|  +------------------------------------+  |
+------------------------------------------+
```

### Detail Page Template

```
+------------------------------------------+
|  [Breadcrumbs]                           |
|  Title [Status Badge]         [Actions]  |
+------------------------------------------+
|  +------------------------------------+  |
|  | Info Card                          |  |
|  | Key-value pairs in grid            |  |
|  +------------------------------------+  |
|                                          |
|  +------------------------------------+  |
|  | Related Data Section               |  |
|  | Table with row actions             |  |
|  +------------------------------------+  |
+------------------------------------------+
```

### Form Page Template

```
+------------------------------------------+
|  [Breadcrumbs]                           |
|  Create/Edit [Entity]                    |
+------------------------------------------+
|  +------------------------------------+  |
|  | Form Card                          |  |
|  | - Form fields with labels          |  |
|  | - Validation messages              |  |
|  | - [Cancel] [Submit]                |  |
|  +------------------------------------+  |
+------------------------------------------+
```

---

## Empty, Loading, and Error States

### Empty States

Every list page must have an empty state:

```typescript
function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center py-12">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-center max-w-sm mb-6">{description}</p>
      {action}
    </div>
  )
}

// Usage
<EmptyState
  icon={Building2}
  title="No organizations yet"
  description="Create your first organization to get started."
  action={<Button>Create Organization</Button>}
/>
```

### Loading States

Use skeleton loaders that match content layout:

```typescript
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  )
}

function ButtonLoading({ isLoading, children }: Props) {
  return (
    <Button disabled={isLoading}>
      {isLoading ? (
        <>
          <Spinner className="h-4 w-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : children}
    </Button>
  )
}
```

### Error States

Every error must answer: WHAT happened, WHY, and WHAT to do:

```typescript
<ErrorState
  title="Unable to save changes"
  description="Your session has expired. Please sign in again."
  action={<Button onClick={redirectToLogin}>Sign In</Button>}
/>
```

**Specific error messages:**

| Scenario | Bad | Good |
|----------|-----|------|
| Email exists | "Error creating account" | "An account with this email already exists." |
| Wrong password | "Invalid credentials" | "Incorrect password. Forgot your password?" |
| Network error | "Request failed" | "Unable to connect. Check your internet." |

---

## Form Design

### Labels and Placeholders

Labels are required for accessibility:

```typescript
<label htmlFor="company-name" className="block text-sm font-medium mb-1">
  Company Name
</label>
<input id="company-name" placeholder="e.g., Acme Corporation" />
```

### Password Fields

Show/hide toggle, no confirm password field:

```typescript
const [showPassword, setShowPassword] = useState(false)

<div className="relative">
  <input type={showPassword ? "text" : "password"} />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2"
  >
    {showPassword ? <EyeOff /> : <Eye />}
  </button>
</div>
```

### Validation

- Validate on blur, not on change
- Show inline errors next to fields
- Show password requirements while typing
- Don't clear form on failed submission (only clear password)

### Prevent Double Submission

```typescript
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmit = async () => {
  if (isSubmitting) return
  setIsSubmitting(true)
  try {
    await submitForm()
  } finally {
    setIsSubmitting(false)
  }
}

<Button disabled={isSubmitting}>
  {isSubmitting ? "Submitting..." : "Submit"}
</Button>
```

---

## Navigation & Layout

### AppLayout

ALL authenticated pages use AppLayout with sidebar and header:

```typescript
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Breadcrumbs

Use the shared Breadcrumbs component for pages 2+ levels deep:

```typescript
<Breadcrumbs items={[
  { label: "Organizations", href: "/organizations" },
  { label: orgName, href: `/organizations/${orgId}` },
  { label: "Companies" }
]} />
```

### Sidebar Navigation

- Logo links to home/dashboard
- Active route is highlighted
- Organization selector always accessible

---

## Accessibility

### Keyboard Navigation

All interactive elements must be keyboard accessible:

```typescript
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick()
    }
  }}
  onClick={onClick}
>
```

### Focus Indicators

Never remove focus outlines without an alternative:

```css
:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary-500;
}
```

### ARIA Labels

```typescript
// Icon-only buttons need labels
<button aria-label="Close modal">
  <X className="h-5 w-5" />
</button>

// Loading states
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? "Loading..." : content}
</div>
```

### Touch Targets

Minimum touch target size is 44x44 pixels:

```typescript
<button className="min-h-[44px] min-w-[44px] p-2">
  <Icon />
</button>
```

---

## Design System Reference

### Color Palette

| Purpose | Class | Usage |
|---------|-------|-------|
| Primary | `bg-blue-600` | Primary buttons, active states |
| Success | `bg-green-100 text-green-800` | Completed, matched, approved |
| Warning | `bg-yellow-100 text-yellow-800` | Pending review |
| Error | `bg-red-100 text-red-800` | Failed, rejected |

### Typography

| Level | Class | Usage |
|-------|-------|-------|
| Page Title | `text-2xl font-bold` | Main headings |
| Section Title | `text-xl font-semibold` | Section headings |
| Card Header | `text-lg font-semibold` | Card titles |
| Body | `text-base` | Default text |
| Small | `text-sm` | Secondary text, form helpers |
| Caption | `text-xs` | Badges, table headers |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `gap-2` | 8px | Standard internal spacing |
| `gap-4` | 16px | Section spacing |
| `p-6` | 24px | Card padding |

### Buttons

| Variant | Usage |
|---------|-------|
| `primary` | Main actions (Save, Create) |
| `secondary` | Secondary actions (Cancel) |
| `danger` | Destructive actions (Delete) |
| `ghost` | Tertiary actions |

---

## Quick Reference Checklist

Before marking any UI task complete:

### Navigation
- [ ] Logo links to home
- [ ] Breadcrumbs on nested pages
- [ ] Active route highlighted

### Forms
- [ ] First field auto-focused
- [ ] Labels are clickable (htmlFor)
- [ ] Password has show/hide toggle
- [ ] Validation on blur with inline errors
- [ ] Submit button shows loading state
- [ ] Button disabled during submission

### States
- [ ] Empty state with illustration + CTA
- [ ] Loading state with skeleton
- [ ] Error state with WHAT/WHY/action

### Accessibility
- [ ] All elements keyboard navigable
- [ ] Focus indicators visible
- [ ] Touch targets 44px minimum
- [ ] ARIA labels on icon buttons
