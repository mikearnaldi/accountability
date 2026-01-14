/**
 * QuickActions component
 *
 * Quick action buttons for common tasks.
 * Features:
 * - New Journal Entry
 * - Run Report
 * - Create Company
 * - Data-testid attributes for E2E testing
 */

import { Link } from "@tanstack/react-router"
import { clsx } from "clsx"
import { FileText, Building2, BookOpen, ArrowRight } from "lucide-react"

interface QuickActionProps {
  /** Action label */
  readonly label: string
  /** Action description */
  readonly description: string
  /** Icon to display */
  readonly icon: typeof FileText
  /** Link href */
  readonly href: string
  /** Icon color */
  readonly iconColor: "blue" | "green" | "purple" | "orange"
  /** Data test ID for E2E testing */
  readonly testId: string
}

const iconColorClasses = {
  blue: "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
  green: "bg-green-100 text-green-600 group-hover:bg-green-200",
  purple: "bg-purple-100 text-purple-600 group-hover:bg-purple-200",
  orange: "bg-orange-100 text-orange-600 group-hover:bg-orange-200"
}

function QuickActionCard({
  label,
  description,
  icon: Icon,
  href,
  iconColor,
  testId
}: QuickActionProps) {
  return (
    <Link
      to={href}
      data-testid={testId}
      className="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div
        className={clsx(
          "flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
          iconColorClasses[iconColor]
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4">
        <h3 className="text-base font-semibold text-gray-900">{label}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
        Get started
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

interface QuickActionsProps {
  /** Whether to show loading skeletons */
  readonly isLoading?: boolean
}

export function QuickActions({ isLoading = false }: QuickActionsProps) {
  if (isLoading) {
    return <QuickActionsSkeleton />
  }

  const actions: QuickActionProps[] = [
    {
      label: "New Journal Entry",
      description: "Record a new financial transaction",
      icon: FileText,
      href: "/organizations",
      iconColor: "blue",
      testId: "quick-action-new-journal"
    },
    {
      label: "Run Report",
      description: "Generate balance sheet, income statement, and more",
      icon: BookOpen,
      href: "/organizations",
      iconColor: "purple",
      testId: "quick-action-run-report"
    },
    {
      label: "Create Company",
      description: "Add a new company to your organization",
      icon: Building2,
      href: "/organizations",
      iconColor: "green",
      testId: "quick-action-create-company"
    }
  ]

  return (
    <div data-testid="quick-actions">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <QuickActionCard key={action.testId} {...action} />
        ))}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for QuickActions
 */
export function QuickActionsSkeleton() {
  return (
    <div data-testid="quick-actions-skeleton" className="animate-pulse">
      <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-6"
          >
            <div className="h-12 w-12 bg-gray-200 rounded-lg" />
            <div className="mt-4 h-5 w-32 bg-gray-200 rounded" />
            <div className="mt-2 h-4 w-48 bg-gray-200 rounded" />
            <div className="mt-4 h-4 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
