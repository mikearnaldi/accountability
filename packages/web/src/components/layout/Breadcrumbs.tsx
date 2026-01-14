/**
 * Breadcrumbs component
 *
 * Breadcrumb navigation for nested pages.
 * Features:
 * - Automatic generation from route path
 * - Clickable links for parent routes
 * - Current page shown without link
 * - Data-testid attributes for E2E testing
 */

import { Link, useLocation } from "@tanstack/react-router"
import { ChevronRight, Home } from "lucide-react"

interface BreadcrumbItem {
  readonly label: string
  readonly href: string
}

interface BreadcrumbsProps {
  /** Custom breadcrumb items (overrides automatic generation) */
  readonly items?: readonly BreadcrumbItem[]
  /** Whether to show home icon */
  readonly showHome?: boolean
}

/**
 * Convert path segment to readable label
 */
function formatSegment(segment: string): string {
  // Replace dashes and underscores with spaces
  const formatted = segment.replace(/[-_]/g, " ")
  // Capitalize first letter of each word
  return formatted
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Generate breadcrumbs from current route
 */
function generateBreadcrumbs(pathname: string): readonly BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  let currentPath = ""
  for (const segment of segments) {
    currentPath += `/${segment}`

    // Skip parameter segments (those starting with $) in the URL
    // but we'd need to resolve them with actual data
    // For now, just show the segment as-is
    const label = segment.startsWith("$")
      ? segment.slice(1).replace(/Id$/, "")
      : formatSegment(segment)

    breadcrumbs.push({
      label,
      href: currentPath
    })
  }

  return breadcrumbs
}

export function Breadcrumbs({ items, showHome = true }: BreadcrumbsProps) {
  const location = useLocation()

  // Use custom items if provided, otherwise generate from path
  const breadcrumbItems = items ?? generateBreadcrumbs(location.pathname)

  // Don't show breadcrumbs on home page or if only one item
  if (
    location.pathname === "/" ||
    (breadcrumbItems.length <= 1 && !showHome)
  ) {
    return null
  }

  return (
    <nav
      className="flex items-center gap-2 text-sm mb-6"
      aria-label="Breadcrumb"
      data-testid="breadcrumbs"
    >
      {/* Home Link */}
      {showHome && (
        <>
          <Link
            to="/"
            data-testid="breadcrumb-home"
            className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
          {breadcrumbItems.length > 0 && (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </>
      )}

      {/* Breadcrumb Items */}
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1

        return (
          <span key={item.href} className="flex items-center gap-2">
            {isLast ? (
              <span
                className="text-gray-900 font-medium"
                data-testid={`breadcrumb-${index}`}
              >
                {item.label}
              </span>
            ) : (
              <>
                <Link
                  to={item.href}
                  data-testid={`breadcrumb-${index}`}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {item.label}
                </Link>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </>
            )}
          </span>
        )
      })}
    </nav>
  )
}

/**
 * Static breadcrumb component for when you know the exact items
 */
export function StaticBreadcrumbs({
  items
}: {
  readonly items: readonly BreadcrumbItem[]
}) {
  return <Breadcrumbs items={items} showHome={true} />
}
