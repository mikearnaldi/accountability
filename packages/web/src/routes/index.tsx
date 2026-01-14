import { createFileRoute, Link } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import { hasTokenAtom } from "../atoms/auth.ts"
import { AppShell } from "../components/AppShell.tsx"
import { ProtectedRoute } from "../components/ProtectedRoute.tsx"

export const Route = createFileRoute("/")({
  component: HomePage
})

function HomePage() {
  const hasToken = useAtomValue(hasTokenAtom)

  // For authenticated users, show the dashboard with AppShell
  if (hasToken) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              Welcome to Accountability. Select an option from the sidebar to get started.
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <DashboardCard
                title="Organizations"
                description="Manage your organizations"
                to="/organizations"
              />
              <DashboardCard
                title="Companies"
                description="View and manage companies"
                to="/companies"
              />
              <DashboardCard
                title="Journal Entries"
                description="Create and view entries"
                to="/journal-entries"
              />
              <DashboardCard
                title="Reports"
                description="View financial reports"
                to="/reports"
              />
            </div>
          </div>
        </AppShell>
      </ProtectedRoute>
    )
  }

  // For unauthenticated users, show landing page
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <h1 className="mb-4 text-4xl font-bold text-gray-900">
        Accountability
      </h1>
      <p className="mb-8 max-w-md text-center text-gray-600">
        Multi-company, multi-currency accounting application built on US GAAP
        principles.
      </p>
      <div className="flex gap-4">
        <Link
          to="/login"
          search={{}}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Sign In
        </Link>
        <Link
          to="/register"
          search={{}}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          Create Account
        </Link>
      </div>
    </div>
  )
}

interface DashboardCardProps {
  readonly title: string
  readonly description: string
  readonly to: string
}

function DashboardCard({ title, description, to }: DashboardCardProps) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
    </Link>
  )
}
