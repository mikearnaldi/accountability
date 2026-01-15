/**
 * MatchingStatusModal component
 *
 * Modal dialog for updating the matching status of an intercompany transaction.
 */

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { X, CheckCircle, AlertCircle, AlertTriangle, ThumbsUp } from "lucide-react"

type MatchingStatus = "Matched" | "Unmatched" | "PartiallyMatched" | "VarianceApproved"

interface MatchingStatusModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSubmit: (status: MatchingStatus, explanation: string | null) => Promise<void>
  readonly currentStatus: MatchingStatus
  readonly isSubmitting: boolean
}

const STATUS_OPTIONS: Array<{
  value: MatchingStatus
  label: string
  description: string
  icon: typeof CheckCircle
  requiresExplanation: boolean
}> = [
  {
    value: "Matched",
    label: "Matched",
    description: "Both sides agree on amount and details",
    icon: CheckCircle,
    requiresExplanation: false
  },
  {
    value: "Unmatched",
    label: "Unmatched",
    description: "Missing entry on one side",
    icon: AlertCircle,
    requiresExplanation: false
  },
  {
    value: "PartiallyMatched",
    label: "Partially Matched",
    description: "Amounts differ between the two sides",
    icon: AlertTriangle,
    requiresExplanation: false
  },
  {
    value: "VarianceApproved",
    label: "Variance Approved",
    description: "Difference has been reviewed and accepted",
    icon: ThumbsUp,
    requiresExplanation: true
  }
]

export function MatchingStatusModal({
  isOpen,
  onClose,
  onSubmit,
  currentStatus,
  isSubmitting
}: MatchingStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<MatchingStatus>(currentStatus)
  const [explanation, setExplanation] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const selectedOption = STATUS_OPTIONS.find((o) => o.value === selectedStatus)
  const requiresExplanation = selectedOption?.requiresExplanation ?? false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (requiresExplanation && !explanation.trim()) {
      setError("Explanation is required when approving a variance")
      return
    }

    try {
      await onSubmit(selectedStatus, explanation.trim() || null)
      onClose()
    } catch {
      setError("Failed to update status. Please try again.")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="matching-status-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Update Matching Status
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            data-testid="close-modal-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 mb-4">
              Current status: <span className="font-medium">{currentStatus}</span>
            </p>

            {/* Status Selection */}
            <div className="space-y-2">
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedStatus === option.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={selectedStatus === option.value}
                      onChange={() => setSelectedStatus(option.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-gray-900">{option.label}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Explanation field (required for VarianceApproved) */}
            {requiresExplanation && (
              <div className="mt-4">
                <label htmlFor="explanation" className="block text-sm font-medium text-gray-700">
                  Variance Explanation <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={3}
                  placeholder="Explain why this variance is approved..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="explanation-input"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedStatus === currentStatus}
            >
              {isSubmitting ? "Updating..." : "Update Status"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
