# React Best Practices

This document covers React patterns and conventions for the Accountability project.

---

## 1. State Management: Effect Atom First

### 1.1 Use Effect Atom for All Shared State

**All application state should live in atoms**, not React state:

```typescript
// atoms/ui.ts
import * as Atom from "@effect-atom/atom/Atom"

// UI state
export const sidebarOpenAtom = Atom.make(true)
export const selectedTabAtom = Atom.make<string>("overview")
export const modalStateAtom = Atom.make<{ type: string; data?: unknown } | null>(null)

// Filter/search state
export const searchQueryAtom = Atom.make("")
export const filterAtom = Atom.make<FilterState>({ status: "", type: "" })

// Selection state
export const selectedIdsAtom = Atom.make<ReadonlySet<string>>(new Set())
```

```typescript
// Component usage
function Sidebar() {
  const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom)

  return (
    <aside className={isOpen ? "w-64" : "w-16"}>
      <button onClick={() => setIsOpen(o => !o)}>Toggle</button>
    </aside>
  )
}
```

### 1.2 When useState is Acceptable

Use `useState` ONLY for:

1. **Truly local, ephemeral UI state** that no other component needs:
   ```typescript
   // OK: Form input before submission
   function SearchInput() {
     const [draft, setDraft] = useState("")
     const [, setSearch] = useAtom(searchQueryAtom)

     const handleSubmit = () => {
       setSearch(draft)
       setDraft("")
     }

     return <input value={draft} onChange={e => setDraft(e.target.value)} />
   }
   ```

2. **Uncontrolled component wrappers**:
   ```typescript
   // OK: Local hover/focus state
   function Tooltip({ children, content }: Props) {
     const [isVisible, setIsVisible] = useState(false)

     return (
       <div
         onMouseEnter={() => setIsVisible(true)}
         onMouseLeave={() => setIsVisible(false)}
       >
         {children}
         {isVisible && <div className="tooltip">{content}</div>}
       </div>
     )
   }
   ```

3. **Animation/transition state**:
   ```typescript
   // OK: CSS transition state
   function Collapsible({ children, isOpen }: Props) {
     const [height, setHeight] = useState(0)
     const ref = useRef<HTMLDivElement>(null)

     useEffect(() => {
       if (ref.current) setHeight(ref.current.scrollHeight)
     }, [children])

     return (
       <div style={{ height: isOpen ? height : 0 }} className="transition-all">
         <div ref={ref}>{children}</div>
       </div>
     )
   }
   ```

### 1.3 useState Anti-Patterns

```typescript
// ❌ BAD: Loading state that should come from Result
const [isLoading, setIsLoading] = useState(false)

// ❌ BAD: Error state that should come from Result
const [error, setError] = useState<string | null>(null)

// ❌ BAD: Data that should be in an atom
const [users, setUsers] = useState<User[]>([])

// ❌ BAD: Filter state that other components might need
const [statusFilter, setStatusFilter] = useState("")

// ❌ BAD: Modal/dialog state
const [showModal, setShowModal] = useState(false)

// ❌ BAD: Selection state
const [selectedIds, setSelectedIds] = useState<string[]>([])
```

### 1.4 Derived State with Atoms

Don't duplicate state - derive it:

```typescript
// atoms/entries.ts
export const entriesAtom = ApiClient.query("entries", "list", { ... })
export const statusFilterAtom = Atom.make<string>("")

// Derived atom - computed from other atoms
export const filteredEntriesAtom = Atom.readable((get) => {
  const result = get(entriesAtom)
  const filter = get(statusFilterAtom)

  if (!Result.isSuccess(result)) return result
  if (!filter) return result

  return Result.map(result, entries =>
    entries.filter(e => e.status === filter)
  )
})
```

```typescript
// Component just reads the derived atom
function EntriesList() {
  const result = useAtomValue(filteredEntriesAtom)
  // No local filtering logic needed
}
```

---

## 2. Styling: Tailwind CSS

### 2.1 Use Tailwind Classes Directly

```typescript
// ✅ GOOD: Tailwind classes
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

// ❌ BAD: Inline styles
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

### 2.3 Use clsx or cn for Conditional Classes

```typescript
import { clsx } from "clsx"
// Or use a cn utility combining clsx + tailwind-merge

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

### 3.1 Result-Driven Rendering

Always handle all Result states:

```typescript
function DataList() {
  const result = useAtomValue(dataAtom)

  // Handle all states explicitly
  if (Result.isInitial(result)) {
    return <Skeleton />
  }

  if (Result.isWaiting(result)) {
    // Show previous data with loading indicator
    const previous = Result.value(result)
    return (
      <div className="relative">
        <LoadingOverlay />
        {Option.isSome(previous) && <List items={previous.value} />}
      </div>
    )
  }

  if (Result.isFailure(result)) {
    return <ErrorCard cause={result.cause} />
  }

  return <List items={result.value} />
}
```

### 3.2 Presentational vs Container Components

**Container components** connect to atoms:

```typescript
// containers/UserList.tsx
function UserListContainer() {
  const result = useAtomValue(usersAtom)
  const [, deleteUser] = useAtom(deleteUserMutation)

  const handleDelete = (id: string) => {
    deleteUser({ path: { id }, reactivityKeys: ["users"] })
  }

  if (!Result.isSuccess(result)) {
    return <LoadingOrError result={result} />
  }

  return <UserList users={result.value} onDelete={handleDelete} />
}
```

**Presentational components** receive props, no atoms:

```typescript
// components/UserList.tsx
interface UserListProps {
  readonly users: ReadonlyArray<User>
  readonly onDelete: (id: string) => void
}

function UserList({ users, onDelete }: UserListProps) {
  return (
    <ul className="divide-y divide-gray-200">
      {users.map(user => (
        <UserRow key={user.id} user={user} onDelete={() => onDelete(user.id)} />
      ))}
    </ul>
  )
}
```

### 3.3 Composition Over Props

```typescript
// ✅ GOOD: Composition
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

// ❌ BAD: Prop drilling
<Card
  title="Title"
  titleClassName="text-xl font-bold"
  content={<p>Content here</p>}
  showHeader={true}
  headerBorder={true}
/>
```

### 3.4 Form Handling

Use atoms for form state when the form affects other parts of the app:

```typescript
// atoms/forms.ts
export const createEntryFormAtom = Atom.make<CreateEntryForm>({
  description: "",
  amount: "",
  accountId: ""
})

// Reset form
export const resetCreateEntryForm = () => {
  // This could be called from anywhere
}
```

For simple, isolated forms, local state is acceptable:

```typescript
function SimpleSearchForm() {
  // OK: Form state only used here until submission
  const [query, setQuery] = useState("")
  const [, setGlobalSearch] = useAtom(searchQueryAtom)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalSearch(query)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="flex-1 rounded-md border px-3 py-2"
        placeholder="Search..."
      />
      <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white">
        Search
      </button>
    </form>
  )
}
```

---

## 4. Data Fetching Patterns

### 4.1 Query Atoms with Families

```typescript
// atoms/companies.ts
export const companyFamily = Atom.family((id: CompanyId) =>
  ApiClient.query("companies", "get", {
    path: { id },
    timeToLive: Duration.minutes(5)
  })
)

// Component
function CompanyDetails({ companyId }: { companyId: string }) {
  const result = useAtomValue(companyFamily(CompanyId.make(companyId)))

  return Result.match(result, {
    onInitial: () => <Skeleton className="h-48" />,
    onSuccess: ({ value }) => <CompanyCard company={value} />,
    onFailure: ({ cause }) => <ErrorCard cause={cause} />
  })
}
```

### 4.2 Dependent Queries

```typescript
// Query that depends on another atom's value
export const companyAccountsAtom = Atom.readable((get) => {
  const companyResult = get(selectedCompanyAtom)

  if (!Result.isSuccess(companyResult)) {
    return companyResult  // Propagate loading/error
  }

  // Create query for this specific company
  return get(ApiClient.query("accounts", "list", {
    urlParams: { companyId: companyResult.value.id },
    timeToLive: Duration.minutes(5)
  }))
})
```

### 4.3 Mutations with Feedback

```typescript
function DeleteButton({ entryId }: { entryId: string }) {
  const [result, deleteEntry] = useAtom(deleteEntryMutation)

  const handleDelete = () => {
    if (confirm("Are you sure?")) {
      deleteEntry({
        path: { id: entryId },
        reactivityKeys: ["entries"]
      })
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={Result.isWaiting(result)}
      className={clsx(
        "rounded-md px-3 py-1.5 text-sm",
        "bg-red-600 text-white hover:bg-red-700",
        "disabled:opacity-50"
      )}
    >
      {Result.isWaiting(result) ? "Deleting..." : "Delete"}
    </button>
  )
}
```

---

## 5. Performance Patterns

### 5.1 Memoize Expensive Computations in Atoms

```typescript
// Do computation in atom, not component
export const sortedEntriesAtom = Atom.readable((get) => {
  const result = get(entriesAtom)
  const sortBy = get(sortByAtom)
  const sortOrder = get(sortOrderAtom)

  if (!Result.isSuccess(result)) return result

  // Sorting happens once when dependencies change
  const sorted = [...result.value].sort((a, b) => {
    const cmp = a[sortBy] < b[sortBy] ? -1 : 1
    return sortOrder === "asc" ? cmp : -cmp
  })

  return Result.success(sorted)
})

// Component just renders
function EntriesList() {
  const result = useAtomValue(sortedEntriesAtom)
  // No sorting logic here
}
```

### 5.2 Avoid Inline Object/Array Creation

```typescript
// ❌ BAD: New object every render
function Component() {
  const result = useAtomValue(ApiClient.query("items", "list", {
    urlParams: { page: 1 }  // New object each render!
  }))
}

// ✅ GOOD: Stable atom reference
const itemsAtom = ApiClient.query("items", "list", {
  urlParams: { page: 1 }
})

function Component() {
  const result = useAtomValue(itemsAtom)
}

// ✅ GOOD: Memoized with useMemo
function Component({ page }: { page: number }) {
  const atom = React.useMemo(
    () => ApiClient.query("items", "list", { urlParams: { page } }),
    [page]
  )
  const result = useAtomValue(atom)
}

// ✅ BEST: Use Atom.family
const itemsFamily = Atom.family((page: number) =>
  ApiClient.query("items", "list", { urlParams: { page } })
)

function Component({ page }: { page: number }) {
  const result = useAtomValue(itemsFamily(page))
}
```

### 5.3 Split Large Components

```typescript
// ❌ BAD: One large component with many atoms
function Dashboard() {
  const users = useAtomValue(usersAtom)
  const stats = useAtomValue(statsAtom)
  const recent = useAtomValue(recentActivityAtom)
  const alerts = useAtomValue(alertsAtom)
  // ... renders everything
}

// ✅ GOOD: Split into focused components
function Dashboard() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <StatsPanel className="col-span-12" />
      <UsersList className="col-span-8" />
      <RecentActivity className="col-span-4" />
      <AlertsBanner />
    </div>
  )
}

function StatsPanel({ className }: { className?: string }) {
  const result = useAtomValue(statsAtom)
  // Only re-renders when stats change
}
```

---

## 6. Testing Patterns

### 6.1 Test Presentational Components in Isolation

```typescript
// components/UserCard.test.tsx
import { render, screen } from "@testing-library/react"
import { UserCard } from "./UserCard"

const mockUser = {
  id: "1",
  name: "John Doe",
  email: "john@example.com"
}

test("renders user name", () => {
  render(<UserCard user={mockUser} />)
  expect(screen.getByText("John Doe")).toBeInTheDocument()
})
```

### 6.2 Test Container Components with Registry

```typescript
// containers/UserList.test.tsx
import { render, screen } from "@testing-library/react"
import { RegistryProvider } from "@effect-atom/atom-react"
import * as Registry from "@effect-atom/atom/Registry"
import { UserListContainer } from "./UserListContainer"
import { usersAtom } from "../atoms/users"
import * as Result from "@effect-atom/atom/Result"

test("renders users from atom", () => {
  const registry = Registry.make()
  // Pre-populate atom with test data
  registry.set(usersAtom, Result.success([
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" }
  ]))

  render(
    <RegistryProvider registry={registry}>
      <UserListContainer />
    </RegistryProvider>
  )

  expect(screen.getByText("Alice")).toBeInTheDocument()
  expect(screen.getByText("Bob")).toBeInTheDocument()
})
```

---

## 7. Summary

| Do | Don't |
|----|-------|
| Use Effect Atom for shared state | Use useState for shared state |
| Use Tailwind classes for styling | Use inline styles |
| Use clsx for conditional classes | String concatenation for classes |
| Handle all Result states | Assume success |
| Use Atom.family for parameterized queries | Create atoms in render |
| Split into focused components | Create monolithic components |
| Use composition (children) | Prop drilling everything |
| Derive state in atoms | Duplicate state |
| Memoize atoms with useMemo or family | Create new atoms each render |
| Use useState only for ephemeral local state | Use useState for app state |
