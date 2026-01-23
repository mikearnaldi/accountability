import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

interface QuickActionLinkProps {
  readonly to: string
  readonly params: { readonly organizationId: string; readonly companyId: string }
  readonly icon: ReactNode
  readonly title: string
  readonly subtitle: string
  readonly testId?: string
}

export function QuickActionLink({
  to,
  params,
  icon,
  title,
  subtitle,
  testId
}: QuickActionLinkProps) {
  return (
    <Link
      to={to}
      params={params}
      className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
      data-testid={testId}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        {icon}
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </Link>
  )
}
