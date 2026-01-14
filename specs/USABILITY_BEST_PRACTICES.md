# Usability Best Practices

This document defines usability standards for the Accountability application. All UI work must follow these guidelines.

---

## 1. Navigation

### 1.1 Always Provide a Way Home

Every page must have a clear path back to the main dashboard:

```typescript
// Header logo should link to home
<Link to="/">
  <Logo className="h-8 w-auto cursor-pointer" />
</Link>

// Auth pages (login/register) need brand link to home
<Link to="/" className="flex items-center gap-2 mb-8">
  <Logo className="h-10 w-10" />
  <span className="text-xl font-semibold">Accountability</span>
</Link>
```

### 1.2 Breadcrumbs for Nested Pages

Any page more than one level deep must show breadcrumbs:

```typescript
// Organizations > Acme Corp > Companies > Acme Inc
<nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
  <Link to="/organizations" className="hover:text-gray-700">Organizations</Link>
  <ChevronRight className="h-4 w-4" />
  <Link to={`/organizations/${orgId}`} className="hover:text-gray-700">{orgName}</Link>
  <ChevronRight className="h-4 w-4" />
  <span className="text-gray-900 font-medium">Companies</span>
</nav>
```

### 1.3 Active Route Highlighting

Sidebar navigation must clearly indicate the current page:

```typescript
const isActive = pathname.startsWith(item.href)

<Link
  to={item.href}
  className={cn(
    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
    isActive
      ? "bg-primary-100 text-primary-700 font-medium"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
  )}
>
```

### 1.4 Back Button Behavior

- Browser back button must work predictably
- Multi-step forms: back goes to previous step, not previous page
- Never lose user data on back navigation
- Provide explicit "Back" or "Cancel" links for critical flows

---

## 2. Authentication Pages (Login/Register)

### 2.1 Page Structure

```
+------------------------------------------+
|  [Logo] Accountability                   |  <- Links to home
|                                          |
|  +----------------------------------+    |
|  |  Sign In                         |    |
|  |                                  |    |
|  |  [Email field - autofocused]     |    |
|  |  [Password field + show/hide]    |    |
|  |                                  |    |
|  |  [Forgot password?]              |    |
|  |                                  |    |
|  |  [    Sign In Button    ]        |    |
|  |                                  |    |
|  |  Don't have an account? Register |    |  <- Switch link
|  +----------------------------------+    |
+------------------------------------------+
```

### 2.2 Form Best Practices

```typescript
// Auto-focus first field
<input
  type="email"
  autoFocus
  // Use type="email" for mobile keyboard optimization
/>

// Show/hide password toggle (NO confirm password field)
const [showPassword, setShowPassword] = useState(false)

<div className="relative">
  <input
    type={showPassword ? "text" : "password"}
    className="pr-10"
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2"
  >
    {showPassword ? <EyeOff /> : <Eye />}
  </button>
</div>

// Validate on blur, not on change
<input
  onBlur={(e) => validateEmail(e.target.value)}
/>
```

### 2.3 Password Requirements

Show requirements while user is typing, not after failure:

```typescript
// Show when password field is focused and has content
{passwordFocused && password.length > 0 && (
  <ul className="mt-2 text-sm space-y-1">
    <li className={hasMinLength ? "text-green-600" : "text-gray-500"}>
      {hasMinLength ? "✓" : "○"} At least 8 characters
    </li>
    <li className={hasUppercase ? "text-green-600" : "text-gray-500"}>
      {hasUppercase ? "✓" : "○"} One uppercase letter
    </li>
    {/* ... */}
  </ul>
)}
```

### 2.4 Easy Switching Between Forms

Always provide a link at the bottom:

```typescript
// On login page
<p className="text-center text-sm text-gray-600">
  Don't have an account?{" "}
  <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
    Register
  </Link>
</p>

// On register page
<p className="text-center text-sm text-gray-600">
  Already have an account?{" "}
  <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
    Sign in
  </Link>
</p>
```

### 2.5 Remember Values Between Attempts

Don't clear form on failed submission:

```typescript
// Keep email populated after failed login
const handleSubmit = async () => {
  try {
    await login({ email, password })
  } catch (error) {
    setError(error.message)
    setPassword("") // Only clear password, keep email
  }
}
```

### 2.6 Caps Lock Warning

```typescript
const [capsLock, setCapsLock] = useState(false)

<input
  type="password"
  onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
  onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
/>
{capsLock && (
  <p className="text-amber-600 text-sm mt-1">
    Caps Lock is on
  </p>
)}
```

---

## 3. Empty States

### 3.1 Structure

Every empty state must include:
1. **Illustration or icon** - Visual element to soften the blank screen
2. **Explanation** - What will appear here when populated
3. **Call-to-action** - How to add the first item

```typescript
function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {title}
      </h3>
      <p className="text-gray-500 text-center max-w-sm mb-6">
        {description}
      </p>
      {action}
    </div>
  )
}

// Usage
<EmptyState
  icon={Building2}
  title="No organizations yet"
  description="Organizations help you group related companies together. Create your first organization to get started."
  action={
    <Button onClick={openCreateModal}>
      <Plus className="h-4 w-4 mr-2" />
      Create Organization
    </Button>
  }
/>
```

### 3.2 Context-Specific Messages

Tailor empty states to the specific context:

| Context | Title | Description |
|---------|-------|-------------|
| Organizations list | No organizations yet | Create an organization to group your companies together |
| Companies list | No companies in this organization | Add your first company to start tracking finances |
| Accounts list | No accounts configured | Set up your chart of accounts to begin recording transactions |
| Journal entries | No journal entries | Create your first journal entry to record a transaction |
| Search results | No results found | Try adjusting your search terms or filters |

---

## 4. Loading States

### 4.1 Skeleton Loaders

Match the skeleton to the actual content layout:

```typescript
// Card skeleton
function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  )
}

// List skeleton
function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  )
}
```

### 4.2 Button Loading States

```typescript
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Spinner className="h-4 w-4 mr-2 animate-spin" />
      Saving...
    </>
  ) : (
    "Save Changes"
  )}
</Button>
```

### 4.3 Prevent Double Submission

Always disable the form/button during submission:

```typescript
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmit = async () => {
  if (isSubmitting) return // Guard clause
  setIsSubmitting(true)
  try {
    await submitForm()
  } finally {
    setIsSubmitting(false)
  }
}

<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "Submitting..." : "Submit"}
</Button>
```

### 4.4 Page-Level Loading

For initial page loads, show a centered spinner or skeleton:

```typescript
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner className="h-8 w-8 text-primary-600 animate-spin" />
    </div>
  )
}
```

---

## 5. Error States

### 5.1 Error Message Structure

Every error must answer three questions:

1. **WHAT happened?** - Describe the specific action that failed
2. **WHY did it happen?** - Explain the cause (if known)
3. **WHAT should the user DO?** - Provide clear next steps

```typescript
// BAD - Generic, unhelpful
<Alert variant="error">
  An error occurred. Please try again.
</Alert>

// GOOD - Specific, actionable
<Alert variant="error">
  <AlertTitle>Unable to save changes</AlertTitle>
  <AlertDescription>
    Your session has expired. Please sign in again to continue.
  </AlertDescription>
  <AlertAction>
    <Button onClick={redirectToLogin}>Sign In</Button>
  </AlertAction>
</Alert>
```

### 5.2 Inline Form Errors

Show errors next to the relevant field:

```typescript
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    className={cn(
      "w-full rounded-lg border px-3 py-2",
      error ? "border-red-500 focus:ring-red-500" : "border-gray-300"
    )}
    aria-describedby={error ? "email-error" : undefined}
  />
  {error && (
    <p id="email-error" className="mt-1 text-sm text-red-600">
      {error}
    </p>
  )}
</div>
```

### 5.3 Specific Error Messages

| Scenario | Bad | Good |
|----------|-----|------|
| Email exists | "Error creating account" | "An account with this email already exists. Sign in instead?" |
| Wrong password | "Invalid credentials" | "Incorrect password. Forgot your password?" |
| Network error | "Request failed" | "Unable to connect. Check your internet and try again." |
| Validation | "Invalid input" | "Password must be at least 8 characters" |
| Permission | "Access denied" | "You don't have permission to edit this company" |

### 5.4 Recoverable vs Non-Recoverable Errors

```typescript
// Recoverable - provide retry action
<ErrorState
  title="Failed to load organizations"
  description="We couldn't fetch your data. This might be a temporary issue."
  action={<Button onClick={retry}>Try Again</Button>}
/>

// Non-recoverable - provide alternative path
<ErrorState
  title="Organization not found"
  description="This organization may have been deleted or you don't have access."
  action={<Button onClick={() => navigate("/organizations")}>Go to Organizations</Button>}
/>
```

### 5.5 Error Boundaries

Wrap major sections with error boundaries:

```typescript
<ErrorBoundary
  fallback={({ error, resetError }) => (
    <ErrorState
      title="Something went wrong"
      description={error.message}
      action={<Button onClick={resetError}>Try Again</Button>}
    />
  )}
>
  <OrganizationsList />
</ErrorBoundary>
```

---

## 6. Form Design

### 6.1 Labels and Placeholders

- Labels are required for accessibility
- Placeholders are optional hints, not replacements for labels
- Use `htmlFor` to connect labels to inputs

```typescript
// GOOD - Label with optional placeholder
<label htmlFor="company-name" className="block text-sm font-medium mb-1">
  Company Name
</label>
<input
  id="company-name"
  placeholder="e.g., Acme Corporation"
/>

// BAD - Placeholder as label
<input placeholder="Company Name" /> // No label!
```

### 6.2 Required vs Optional Fields

Mark optional fields, not required ones (most fields are required):

```typescript
<label>
  Tax ID <span className="text-gray-500 font-normal">(optional)</span>
</label>
```

### 6.3 Input Types for Mobile

Use appropriate input types for better mobile keyboards:

```typescript
<input type="email" />    // @ and .com keys
<input type="tel" />      // Number pad
<input type="url" />      // / and .com keys
<input type="number" />   // Number pad
<input inputMode="decimal" /> // Number pad with decimal
```

### 6.4 Multi-Step Forms

For long forms, break into logical steps:

```typescript
// Show progress
<div className="flex items-center gap-2 mb-8">
  {steps.map((step, i) => (
    <div
      key={step.id}
      className={cn(
        "flex items-center gap-2",
        i <= currentStep ? "text-primary-600" : "text-gray-400"
      )}
    >
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
        i < currentStep ? "bg-primary-600 text-white" :
        i === currentStep ? "border-2 border-primary-600" :
        "border-2 border-gray-300"
      )}>
        {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
      </div>
      <span className="hidden sm:block">{step.label}</span>
    </div>
  ))}
</div>
```

---

## 7. Accessibility

### 7.1 Keyboard Navigation

All interactive elements must be keyboard accessible:

```typescript
// Ensure custom components are focusable
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

### 7.2 Focus Indicators

Never remove focus outlines without providing an alternative:

```css
/* In index.css */
:focus-visible {
  @apply outline-2 outline-offset-2 outline-primary-500;
}
```

### 7.3 ARIA Labels

Provide context for screen readers:

```typescript
// Icon-only buttons need labels
<button aria-label="Close modal">
  <X className="h-5 w-5" />
</button>

// Loading states
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? "Loading..." : content}
</div>

// Error announcements
<div role="alert" aria-live="assertive">
  {error}
</div>
```

### 7.4 Touch Targets

Minimum touch target size is 44x44 pixels:

```typescript
// Ensure buttons and links are large enough
<button className="min-h-[44px] min-w-[44px] p-2">
  <Icon />
</button>
```

---

## 8. Feedback & Confirmation

### 8.1 Success Feedback

Confirm successful actions:

```typescript
// Toast notification for background saves
toast.success("Changes saved")

// Inline confirmation for visible changes
<Alert variant="success">
  Organization created successfully
</Alert>
```

### 8.2 Destructive Actions

Require confirmation for destructive actions:

```typescript
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Company</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete "Acme Inc"?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete the company and all its data.
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>
        Delete Company
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 8.3 Unsaved Changes Warning

Warn before navigating away from unsaved changes:

```typescript
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault()
      e.returnValue = ""
    }
  }
  window.addEventListener("beforeunload", handleBeforeUnload)
  return () => window.removeEventListener("beforeunload", handleBeforeUnload)
}, [hasUnsavedChanges])
```

---

## 9. Quick Reference Checklist

Before marking any UI task complete, verify:

### Navigation
- [ ] Logo links to home/dashboard
- [ ] Breadcrumbs on pages 2+ levels deep
- [ ] Active route highlighted in sidebar
- [ ] Back button works as expected

### Forms
- [ ] First field is auto-focused
- [ ] Labels are clickable (htmlFor)
- [ ] Password has show/hide toggle
- [ ] Validation on blur with inline errors
- [ ] Submit button shows loading state
- [ ] Button disabled during submission

### Auth Pages
- [ ] Brand/logo links to home
- [ ] Easy switch between login/register
- [ ] Password requirements shown while typing
- [ ] Values remembered after failed attempts

### States
- [ ] Empty state with illustration + CTA
- [ ] Loading state with skeleton/spinner
- [ ] Error state with WHAT/WHY/WHAT TO DO

### Accessibility
- [ ] All elements keyboard navigable
- [ ] Focus indicators visible
- [ ] Touch targets 44px minimum
- [ ] ARIA labels on icon buttons

---

## References

- [15 Tips for Better Signup/Login UX](https://www.learnui.design/blog/tips-signup-login-ux.html)
- [12 Best Practices for Sign-Up and Login](https://uxdworld.com/12-best-practices-for-sign-up-and-login-page-design/)
- [Login & Signup UX 2025 Guide](https://www.authgear.com/post/login-signup-ux-guide)
- [Empty State UX in SaaS](https://userpilot.com/blog/empty-state-saas/)
- [Error Message UX Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-analysis-error-feedback)
- [Back Button UX Design](https://www.smashingmagazine.com/2022/08/back-button-ux-design/)
