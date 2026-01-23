import type { ReactNode } from "react"

interface CompanyInfoCardProps {
  readonly title: string
  readonly children: ReactNode
  readonly testId?: string
}

export function CompanyInfoCard({ title, children, testId }: CompanyInfoCardProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white"
      data-testid={testId}
    >
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

interface InfoRowProps {
  readonly label: string
  readonly value: string | null | undefined
  readonly mono?: boolean
  readonly testId?: string
}

export function InfoRow({ label, value, mono, testId }: InfoRowProps) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={`text-sm text-gray-900 ${mono ? "font-mono" : ""}`}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  )
}
