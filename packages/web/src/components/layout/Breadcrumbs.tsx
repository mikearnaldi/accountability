/**
 * Breadcrumbs component
 *
 * Breadcrumb navigation with organization context support.
 * Features:
 * - Organization as first breadcrumb when selected
 * - Automatic generation from route path
 * - Clickable links for parent routes
 * - Current page shown without link
 * - Data-testid attributes for E2E testing
 */

import { Link, useLocation } from "@tanstack/react-router"
import { ChevronRight, Home, Building2 } from "lucide-react"
import type { Organization } from "./OrganizationSelector.tsx"

// =============================================================================
// Types
// =============================================================================

export interface BreadcrumbItem {
  readonly label: string
  readonly href: string
  readonly icon?: React.ReactNode
}

interface BreadcrumbsProps {
  /** Custom breadcrumb items (overrides automatic generation) */
  readonly items?: readonly BreadcrumbItem[]
  /** Whether to show home icon as first crumb */
  readonly showHome?: boolean
  /** Current organization (used for org-scoped breadcrumbs) */
  readonly organization?: Organization | null
}

// =============================================================================
// Helpers
// =============================================================================

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
 * Generate breadcrumbs from current route, handling organization context
 */
function generateBreadcrumbs(
  pathname: string,
  _organization?: Organization | null
): readonly BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  // Check if we're in an organization context
  const isOrgRoute = segments[0] === "organizations" && segments[1]

  // Skip the organizations segment and org ID if we have org context
  // The org will be shown separately
  const startIndex = isOrgRoute ? 2 : 0

  let currentPath = isOrgRoute ? `/organizations/${segments[1]}` : ""

  for (let i = startIndex; i < segments.length; i++) {
    const segment = segments[i]
    currentPath += `/${segment}`

    // Skip ID segments (UUIDs or numeric IDs)
    if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      continue
    }
    if (segment.match(/^\d+$/)) {
      continue
    }

    const label = formatSegment(segment)

    breadcrumbs.push({
      label,
      href: currentPath
    })
  }

  return breadcrumbs
}

// =============================================================================
// Breadcrumbs Component
// =============================================================================

export function Breadcrumbs({ items, showHome = true, organization }: BreadcrumbsProps) {
  const location = useLocation()

  // Use custom items if provided, otherwise generate from path
  const breadcrumbItems = items ?? generateBreadcrumbs(location.pathname, organization)

  // Check if we're on home page or organizations list
  const isHomePage = location.pathname === "/"
  const isOrganizationsPage = location.pathname === "/organizations"

  // Don't show breadcrumbs on home page
  if (isHomePage) {
    return null
  }

  // For organizations list, just show "Organizations"
  if (isOrganizationsPage && !organization) {
    return (
      <nav
        className="flex items-center gap-2 text-sm mb-6 min-w-0 overflow-hidden"
        aria-label="Breadcrumb"
        data-testid="breadcrumbs"
      >
        {showHome && (
          <>
            <Link
              to="/"
              data-testid="breadcrumb-home"
              className="flex items-center flex-shrink-0 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
          </>
        )}
        <span className="text-gray-900 font-medium truncate" data-testid="breadcrumb-current">
          Organizations
        </span>
      </nav>
    )
  }

  return (
    <nav
      className="flex items-center gap-2 text-sm mb-6 min-w-0 overflow-hidden"
      aria-label="Breadcrumb"
      data-testid="breadcrumbs"
    >
      {/* Home Link */}
      {showHome && (
        <>
          <Link
            to="/"
            data-testid="breadcrumb-home"
            className="flex items-center flex-shrink-0 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
        </>
      )}

      {/* Organizations link (if in org context) */}
      {organization && (
        <>
          <Link
            to="/organizations"
            search={{ org: organization.id }}
            data-testid="breadcrumb-organizations"
            className="hidden sm:block flex-shrink-0 text-gray-500 hover:text-gray-700 transition-colors"
          >
            Organizations
          </Link>
          <ChevronRight className="hidden sm:block h-4 w-4 flex-shrink-0 text-gray-400" />
          <Link
            to="/organizations/$organizationId"
            params={{ organizationId: organization.id }}
            data-testid="breadcrumb-organization"
            className="flex items-center gap-1.5 min-w-0 flex-shrink text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="max-w-[150px] truncate">{organization.name}</span>
          </Link>
          {breadcrumbItems.length > 0 && <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />}
        </>
      )}

      {/* Breadcrumb Items */}
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1
        // On mobile, hide middle items if there are more than 2
        const hideOnMobile = !isLast && index > 0 && breadcrumbItems.length > 2

        return (
          <span key={item.href} className={`flex items-center gap-2 min-w-0 ${isLast ? 'flex-shrink' : 'flex-shrink-0'} ${hideOnMobile ? 'hidden sm:flex' : ''}`}>
            {isLast ? (
              <span
                className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-[300px]"
                data-testid={`breadcrumb-${index}`}
              >
                {item.label}
              </span>
            ) : (
              <>
                <Link
                  to={item.href}
                  data-testid={`breadcrumb-${index}`}
                  className="text-gray-500 hover:text-gray-700 transition-colors truncate max-w-[150px]"
                >
                  {item.label}
                </Link>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
              </>
            )}
          </span>
        )
      })}
    </nav>
  )
}

// =============================================================================
// Static Breadcrumbs
// =============================================================================

/**
 * Static breadcrumb component for when you know the exact items
 */
export function StaticBreadcrumbs({
  items,
  organization = null
}: {
  readonly items: readonly BreadcrumbItem[]
  readonly organization?: Organization | null
}) {
  return <Breadcrumbs items={items} showHome={true} organization={organization ?? null} />
}

// =============================================================================
// Preset Breadcrumbs
// =============================================================================

interface OrganizationBreadcrumbsProps {
  readonly organization: Organization
  readonly currentPage?: string
}

export function OrganizationBreadcrumbs({ organization, currentPage }: OrganizationBreadcrumbsProps) {
  const items: BreadcrumbItem[] = currentPage
    ? [{ label: currentPage, href: "#" }]
    : []

  return <Breadcrumbs items={items} organization={organization} />
}

interface CompanyBreadcrumbsProps {
  readonly organization: Organization
  readonly companyName: string
  readonly companyId: string
  readonly currentPage?: string
}

export function CompanyBreadcrumbs({
  organization,
  companyName,
  companyId,
  currentPage
}: CompanyBreadcrumbsProps) {
  const items: BreadcrumbItem[] = [
    {
      label: "Companies",
      href: `/organizations/${organization.id}/companies`
    },
    {
      label: companyName,
      href: `/organizations/${organization.id}/companies/${companyId}`
    }
  ]

  if (currentPage) {
    items.push({ label: currentPage, href: "#" })
  }

  return <Breadcrumbs items={items} organization={organization} />
}
