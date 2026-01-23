import type { ReactNode } from "react"

interface StatCardProps {
  readonly label: string
  readonly value: string | number
  readonly subtext?: string
  readonly icon?: ReactNode
  readonly testId?: string
}

export function StatCard({ label, value, subtext, icon, testId }: StatCardProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            {icon}
          </div>
        )}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
      </div>
    </div>
  )
}
