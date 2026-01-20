# React Best Practices

This document covers React patterns and conventions for the Accountability project frontend using TanStack Start and openapi-fetch.

---

## 1. State Management

### 1.1 Server State: Use TanStack Start Loaders

Server data should be fetched in route loaders, not in components:

```typescript
// routes/organizations/index.tsx
import { createFileRoute } from "@tanstack/react-router"
import { api } from "@/api/client"

export const Route = createFileRoute("/organizations/")({
  loader: async () => {
    const { data } = await api.GET("/api/v1/organizations")
    return { organizations: data ?? [] }
  },
  component: OrganizationsPage
})

function OrganizationsPage() {
  // Data is immediately available from SSR - no loading state needed
  const { organizations } = Route.useLoaderData()

  return (
    <ul>
      {organizations.map(org => (
        <li key={org.id}>{org.name}</li>
      ))}
    </ul>
  )
}
```

### 1.2 Local State: Use useState for UI

Use `useState` for local, ephemeral UI state:

```typescript
function FilterPanel() {
  // Local UI state
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? "Collapse" : "Expand"}
      </button>
      {isExpanded && (
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search..."
        />
      )}
    </div>
  )
}
```

### 1.3 Form State: useState Until Submit

Keep form state local until submission:

```typescript
function CreateOrganizationForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const { data, error: apiError } = await api.POST("/api/v1/organizations", {
      body: { name, defaultCurrency: currency }
    })

    if (apiError) {
      setError(apiError.body?.message ?? "Failed to create")
      setIsSubmitting(false)
      return
    }

    // Revalidate to show new data
    await router.invalidate()
    router.navigate({ to: `/organizations/${data.id}` })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} />
      <select value={currency} onChange={e => setCurrency(e.target.value)}>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
      </select>
      {error && <p className="text-red-500">{error}</p>}
      <button disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create"}
      </button>
    </form>
  )
}
```

### 1.4 URL State: Use Search Params for Shareable State

For filters, pagination, and other shareable state, use URL search params:

```typescript
import { createFileRoute, useSearch } from "@tanstack/react-router"

// Define search params schema
const searchSchema = z.object({
  page: z.number().optional().default(1),
  status: z.string().optional(),
  sort: z.enum(["name", "date"]).optional().default("name")
})

export const Route = createFileRoute("/entries/")({
  validateSearch: searchSchema,

  loader: async ({ deps: { page, status, sort } }) => {
    const { data } = await api.GET("/api/v1/entries", {
      params: { query: { page, status, sort, limit: 20 } }
    })
    return { entries: data ?? [] }
  },

  component: EntriesPage
})

function EntriesPage() {
  const { entries } = Route.useLoaderData()
  const { page, status, sort } = useSearch({ from: "/entries/" })
  const navigate = useNavigate()

  const setPage = (newPage: number) => {
    navigate({ search: { page: newPage, status, sort } })
  }

  return (
    <div>
      <FilterBar status={status} sort={sort} />
      <EntriesList entries={entries} />
      <Pagination page={page} onPageChange={setPage} />
    </div>
  )
}
```

### 1.5 State Anti-Patterns

```typescript
// Don't fetch data in useEffect
function BadComponent() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.GET("/api/v1/items").then(({ data }) => {
      setData(data ?? [])
      setLoading(false)
    })
  }, [])

  // This causes loading flash, no SSR, duplicate requests
}

// Don't store server data in useState
function AlsoBad() {
  const { items } = Route.useLoaderData()
  const [localItems, setLocalItems] = useState(items) // Syncing nightmare
}

// Don't manage async state manually
function StillBad() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  // This is what loaders handle for you
}
```

---

## 2. Styling: Tailwind CSS

### 2.0 CSS Setup for TanStack Start (CRITICAL)

To prevent Flash of Unstyled Content (FOUC), **NEVER** use side-effect CSS imports in TanStack Start. Always import CSS with the `?url` suffix and add it to the route's `head()` function:

```typescript
// CORRECT: Import CSS as URL and add to head (prevents FOUC)
import appCss from "../index.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [...],
    links: [
      { rel: "stylesheet", href: appCss }  // CSS loads in <head> before render
    ]
  }),
  component: RootComponent
})

// WRONG: Side-effect import (causes FOUC - CSS loads after hydration)
import "../index.css"  // DON'T DO THIS
```

**Why this matters:**
- Side-effect imports load CSS via JavaScript after hydration
- This causes a visible flash where HTML renders without styles
- Using `?url` + `head()` links ensures CSS is in the `<head>` tag
- The browser loads CSS synchronously before rendering content

**Tailwind v4 Setup:**
1. Install: `pnpm add tailwindcss @tailwindcss/vite`
2. Add `tailwindcss()` plugin to `vite.config.ts`
3. Create `src/index.css` with `@import "tailwindcss";`
4. Import with `?url` and add to `head()` links as shown above

### 2.1 Use Tailwind Classes Directly

```typescript
// GOOD: Tailwind classes
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

// BAD: Inline styles
function Button({ children }: Props) {
  return (
    <button style={{
      padding: "8px 16px",
      backgroundColor: "#2563eb",
      color: "white"
    }}>
      {children}
    </button>
  )
}
```

### 2.2 Organize Complex Class Lists

Use template literals or arrays for readability:

```typescript
function Card({ children, highlighted }: Props) {
  const classes = [
    // Layout
    "p-6 rounded-lg",
    // Border
    "border",
    highlighted ? "border-blue-500" : "border-gray-200",
    // Background
    highlighted ? "bg-blue-50" : "bg-white",
    // Shadow
    "shadow-sm hover:shadow-md",
    // Transition
    "transition-shadow duration-200"
  ].join(" ")

  return <div className={classes}>{children}</div>
}
```

### 2.3 Use clsx for Conditional Classes

```typescript
import { clsx } from "clsx"

function Button({ disabled, loading, className, children }: Props) {
  return (
    <button
      className={clsx(
        "px-4 py-2 rounded-md font-medium",
        "bg-blue-600 text-white",
        "hover:bg-blue-700",
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

### 2.4 Component Variants Pattern

```typescript
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
type ButtonSize = "sm" | "md" | "lg"

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200"
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg"
}

function Button({
  variant = "primary",
  size = "md",
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-md font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

### 2.5 Responsive Design

```typescript
function Layout({ children }: Props) {
  return (
    <div className="
      flex flex-col
      md:flex-row
      gap-4
      p-4 md:p-6 lg:p-8
      max-w-7xl mx-auto
    ">
      {children}
    </div>
  )
}

function Grid({ children }: Props) {
  return (
    <div className="
      grid
      grid-cols-1
      sm:grid-cols-2
      lg:grid-cols-3
      xl:grid-cols-4
      gap-4
    ">
      {children}
    </div>
  )
}
```

### 2.6 Dark Mode Support

```typescript
function Card({ children }: Props) {
  return (
    <div className="
      bg-white dark:bg-gray-800
      text-gray-900 dark:text-gray-100
      border border-gray-200 dark:border-gray-700
      rounded-lg p-6
    ">
      {children}
    </div>
  )
}
```

---

## 3. Component Patterns

### 3.1 Loading and Error States

For SSR routes, data is available immediately. Handle errors in the loader:

```typescript
export const Route = createFileRoute("/organizations/$id")({
  loader: async ({ params }) => {
    const { data, error } = await api.GET("/api/v1/organizations/{id}", {
      params: { path: { id: params.id } }
    })

    if (error) {
      throw new Error("Organization not found")
    }

    return { organization: data }
  },

  // TanStack Router handles the error boundary
  errorComponent: ({ error }) => (
    <div className="text-red-500">Error: {error.message}</div>
  ),

  // Optional: Show while navigating client-side
  pendingComponent: () => <div>Loading...</div>,

  component: OrganizationPage
})

function OrganizationPage() {
  // Data guaranteed to be available
  const { organization } = Route.useLoaderData()
  return <h1>{organization.name}</h1>
}
```

### 3.2 Mutation Loading States

For mutations, manage loading state locally:

```typescript
function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm("Are you sure?")) return

    setIsDeleting(true)
    const { error } = await api.DELETE("/api/v1/items/{id}", {
      params: { path: { id } }
    })

    if (error) {
      setIsDeleting(false)
      alert("Failed to delete")
      return
    }

    await router.invalidate()
    onDeleted()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={clsx(
        "px-3 py-1.5 text-sm rounded-md",
        "bg-red-600 text-white hover:bg-red-700",
        "disabled:opacity-50"
      )}
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  )
}
```

### 3.3 Presentational vs Container Components

**Presentational components** receive props, don't fetch data:

```typescript
// components/UserCard.tsx
interface UserCardProps {
  readonly user: User
  readonly onEdit: () => void
  readonly onDelete: () => void
}

function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium">{user.name}</h3>
      <p className="text-gray-500">{user.email}</p>
      <div className="mt-4 flex gap-2">
        <button onClick={onEdit}>Edit</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}
```

**Route components** connect to loader data and handle mutations:

```typescript
// routes/users/index.tsx
function UsersPage() {
  const { users } = Route.useLoaderData()
  const router = useRouter()

  const handleDelete = async (id: string) => {
    await api.DELETE("/api/v1/users/{id}", { params: { path: { id } } })
    router.invalidate()
  }

  return (
    <div className="grid gap-4">
      {users.map(user => (
        <UserCard
          key={user.id}
          user={user}
          onEdit={() => router.navigate({ to: `/users/${user.id}/edit` })}
          onDelete={() => handleDelete(user.id)}
        />
      ))}
    </div>
  )
}
```

### 3.4 Composition Over Props

```typescript
// GOOD: Composition
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border p-6">{children}</div>
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 border-b pb-4">{children}</div>
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

// Usage
<Card>
  <CardHeader>
    <h2 className="text-xl font-bold">Title</h2>
  </CardHeader>
  <CardBody>
    <p>Content here</p>
  </CardBody>
</Card>

// BAD: Prop drilling
<Card
  title="Title"
  titleClassName="text-xl font-bold"
  content={<p>Content here</p>}
  showHeader={true}
  headerBorder={true}
/>
```

### 3.5 Empty States

Always handle empty data gracefully:

```typescript
function OrganizationsList() {
  const { organizations } = Route.useLoaderData()

  if (organizations.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">No organizations</h3>
        <p className="mt-1 text-gray-500">Get started by creating your first organization.</p>
        <Link to="/organizations/new" className="mt-4 inline-block">
          <Button>Create Organization</Button>
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y">
      {organizations.map(org => (
        <li key={org.id}>{org.name}</li>
      ))}
    </ul>
  )
}
```

---

## 4. Data Fetching Patterns

### 4.1 Parallel Data Fetching in Loaders

```typescript
export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    // Fetch all data in parallel
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
  },
  component: DashboardPage
})
```

### 4.2 Dependent Data Fetching

When data depends on other data, fetch sequentially:

```typescript
export const Route = createFileRoute("/organizations/$orgId/companies/$companyId")({
  loader: async ({ params }) => {
    // First get the company to know its settings
    const { data: company, error } = await api.GET(
      "/api/v1/companies/{companyId}",
      { params: { path: { companyId: params.companyId } } }
    )

    if (error) throw new Error("Company not found")

    // Then fetch dependent data based on company settings
    const [accountsResult, periodsResult] = await Promise.all([
      api.GET("/api/v1/companies/{companyId}/accounts", {
        params: { path: { companyId: params.companyId } }
      }),
      api.GET("/api/v1/companies/{companyId}/fiscal-periods", {
        params: { path: { companyId: params.companyId } }
      })
    ])

    return {
      company,
      accounts: accountsResult.data ?? [],
      fiscalPeriods: periodsResult.data ?? []
    }
  }
})
```

### 4.3 Revalidation After Mutations

After any mutation, call `router.invalidate()` to refetch loader data:

```typescript
function EditOrganizationForm({ organization }: Props) {
  const router = useRouter()
  const [name, setName] = useState(organization.name)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await api.PATCH("/api/v1/organizations/{id}", {
      params: { path: { id: organization.id } },
      body: { name }
    })

    if (error) {
      setSaving(false)
      alert("Failed to save")
      return
    }

    // Refetch all loader data to show updated organization
    await router.invalidate()
    setSaving(false)
  }

  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  )
}
```

---

## 5. Performance Patterns

### 5.1 Split Large Pages into Components

```typescript
// BAD: One large component
function Dashboard() {
  const { orgs, stats, activity, alerts } = Route.useLoaderData()
  // ... renders everything, re-renders on any state change
}

// GOOD: Split into focused components
function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <StatsPanel className="col-span-12" />
      <OrganizationsList className="col-span-8" />
      <RecentActivity className="col-span-4" />
      <AlertsBanner />
    </div>
  )
}

function StatsPanel({ className }: { className?: string }) {
  const { stats } = Route.useLoaderData()
  // Only uses stats from loader data
  return <div className={className}>...</div>
}

function OrganizationsList({ className }: { className?: string }) {
  const { organizations } = Route.useLoaderData()
  // Only uses organizations from loader data
  return <div className={className}>...</div>
}
```

### 5.2 Memoize Expensive Components

```typescript
import { memo } from "react"

// Memoize presentational components that receive stable props
const AccountRow = memo(function AccountRow({
  account,
  onSelect
}: {
  account: Account
  onSelect: (id: string) => void
}) {
  return (
    <tr onClick={() => onSelect(account.id)}>
      <td>{account.code}</td>
      <td>{account.name}</td>
      <td>{account.balance}</td>
    </tr>
  )
})

// Use useCallback for handlers passed to memoized components
function AccountsList() {
  const { accounts } = Route.useLoaderData()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  return (
    <table>
      <tbody>
        {accounts.map(account => (
          <AccountRow
            key={account.id}
            account={account}
            onSelect={handleSelect}
          />
        ))}
      </tbody>
    </table>
  )
}
```

### 5.3 Lazy Load Heavy Components

```typescript
import { lazy, Suspense } from "react"

// Lazy load components not needed on initial render
const ReportViewer = lazy(() => import("./ReportViewer"))
const ChartWidget = lazy(() => import("./ChartWidget"))

function DashboardPage() {
  const [showReport, setShowReport] = useState(false)

  return (
    <div>
      <button onClick={() => setShowReport(true)}>View Report</button>

      {showReport && (
        <Suspense fallback={<div>Loading report...</div>}>
          <ReportViewer />
        </Suspense>
      )}

      <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100" />}>
        <ChartWidget />
      </Suspense>
    </div>
  )
}
```

---

## 6. Testing Patterns

### 6.1 Test Presentational Components

```typescript
// components/UserCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { UserCard } from "./UserCard"

const mockUser = {
  id: "1",
  name: "John Doe",
  email: "john@example.com"
}

test("renders user information", () => {
  render(<UserCard user={mockUser} onEdit={vi.fn()} onDelete={vi.fn()} />)

  expect(screen.getByText("John Doe")).toBeInTheDocument()
  expect(screen.getByText("john@example.com")).toBeInTheDocument()
})

test("calls onDelete when delete button clicked", () => {
  const onDelete = vi.fn()
  render(<UserCard user={mockUser} onEdit={vi.fn()} onDelete={onDelete} />)

  fireEvent.click(screen.getByText("Delete"))
  expect(onDelete).toHaveBeenCalled()
})
```

### 6.2 E2E Tests for Full Flows

For route components with loaders, use E2E tests:

```typescript
// test-e2e/organizations.spec.ts
import { test, expect } from "@playwright/test"

test("displays organizations list", async ({ page }) => {
  // Login first
  await page.goto("/login")
  await page.fill('[name="email"]', "test@example.com")
  await page.fill('[name="password"]', "password")
  await page.click('button[type="submit"]')

  // Navigate to organizations
  await page.goto("/organizations")

  // Verify data is rendered (SSR - no loading state)
  await expect(page.locator("h1")).toContainText("Organizations")
  await expect(page.locator("ul li")).toHaveCount.greaterThan(0)
})

test("creates new organization", async ({ page }) => {
  await loginAsTestUser(page)
  await page.goto("/organizations")

  await page.click('text="Create Organization"')
  await page.fill('[name="name"]', "Test Org")
  await page.click('button[type="submit"]')

  // Should redirect to new org page
  await expect(page).toHaveURL(/\/organizations\/[a-z0-9-]+/)
  await expect(page.locator("h1")).toContainText("Test Org")
})
```

---

## 7. Summary

| Do | Don't |
|----|-------|
| Use `loader()` for server data | Fetch data in useEffect |
| Use `useState` for local UI state | Store server data in useState |
| Use URL search params for filters | Store shareable state in useState |
| Use `router.invalidate()` after mutations | Manually update local state after mutations |
| Use Tailwind classes for styling | Use inline styles |
| Use clsx for conditional classes | String concatenation for classes |
| Split into focused components | Create monolithic components |
| Use composition (children) | Prop drill everything |
| Handle empty states | Assume data exists |
| Test presentational components with RTL | Only test with E2E |
| Test full flows with Playwright | Skip E2E testing |
