/**
 * ApplyTemplateModal Component
 *
 * Modal for selecting and applying account templates to a company.
 * Shows available templates with descriptions and account counts,
 * then applies the selected template via API.
 */

import { useState, useEffect } from "react"
import { useRouter } from "@tanstack/react-router"
import { api } from "@/api/client"

// =============================================================================
// Types
// =============================================================================

type TemplateType = "GeneralBusiness" | "Manufacturing" | "ServiceBusiness" | "HoldingCompany"

interface AccountTemplateItem {
  readonly templateType: TemplateType
  readonly name: string
  readonly description: string
  readonly accountCount: number
}

interface ApplyTemplateModalProps {
  readonly organizationId: string
  readonly companyId: string
  readonly onClose: () => void
}

// =============================================================================
// Template Display Info
// =============================================================================

const TEMPLATE_INFO: Record<TemplateType, { icon: string; color: string }> = {
  GeneralBusiness: {
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    color: "bg-blue-100 text-blue-600"
  },
  Manufacturing: {
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    color: "bg-amber-100 text-amber-600"
  },
  ServiceBusiness: {
    icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    color: "bg-green-100 text-green-600"
  },
  HoldingCompany: {
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    color: "bg-purple-100 text-purple-600"
  }
}

// =============================================================================
// Component
// =============================================================================

export function ApplyTemplateModal({ organizationId, companyId, onClose }: ApplyTemplateModalProps) {
  const router = useRouter()

  // State
  const [templates, setTemplates] = useState<readonly AccountTemplateItem[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true)
      setError(null)

      const { data, error: apiError } = await api.GET("/api/v1/account-templates")

      if (apiError) {
        setError("Failed to load templates. Please try again.")
        setIsLoading(false)
        return
      }

      setTemplates(data?.templates ?? [])
      setIsLoading(false)
    }

    fetchTemplates().catch(() => {})
  }, [])

  // Handle template selection
  const handleSelectTemplate = (type: TemplateType) => {
    setSelectedTemplate(type)
    setShowConfirmation(true)
    setError(null)
  }

  // Handle back from confirmation
  const handleBackToSelection = () => {
    setShowConfirmation(false)
    setSelectedTemplate(null)
  }

  // Handle apply template
  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return

    setIsApplying(true)
    setError(null)

    const { data, error: apiError } = await api.POST("/api/v1/account-templates/{type}/apply", {
      params: { path: { type: selectedTemplate } },
      body: { organizationId, companyId }
    })

    if (apiError) {
      let errorMessage = "Failed to apply template. Please try again."
      if (typeof apiError === "object" && apiError !== null && "message" in apiError) {
        errorMessage = String(apiError.message)
      }
      setError(errorMessage)
      setIsApplying(false)
      return
    }

    // Show success message
    setSuccessMessage(`Successfully created ${data?.createdCount ?? 0} accounts from the ${formatTemplateType(selectedTemplate)} template.`)
    setIsApplying(false)

    // Invalidate first, then close after a short delay to show success message
    // The invalidate must complete before closing so the accounts list refreshes
    await router.invalidate()
    setTimeout(() => {
      onClose()
    }, 1500)
  }

  // Get selected template details
  const selectedTemplateDetails = templates.find((t) => t.templateType === selectedTemplate)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        data-testid="apply-template-modal"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {showConfirmation ? "Confirm Template" : "Apply Account Template"}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            data-testid="apply-template-close-button"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            data-testid="apply-template-error"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3"
          >
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div
            data-testid="apply-template-success"
            className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3"
          >
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12" data-testid="apply-template-loading">
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-gray-600">Loading templates...</span>
            </div>
          </div>
        )}

        {/* Template Selection */}
        {!isLoading && !showConfirmation && !successMessage && (
          <div className="space-y-3" data-testid="apply-template-list">
            <p className="text-sm text-gray-600">
              Select a template to bootstrap your chart of accounts. Each template is designed for a specific business type.
            </p>
            <div className="mt-4 space-y-3">
              {templates.map((template) => (
                <TemplateCard
                  key={template.templateType}
                  template={template}
                  onSelect={() => handleSelectTemplate(template.templateType)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Confirmation View */}
        {!isLoading && showConfirmation && selectedTemplateDetails && !successMessage && (
          <div data-testid="apply-template-confirmation">
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-amber-800">Confirm Template Application</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    This action will create <strong>{selectedTemplateDetails.accountCount} accounts</strong> in your chart of accounts. This cannot be easily undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-medium text-gray-900">Selected Template</h4>
              <div className="mt-2 flex items-center gap-3">
                <div className={`rounded-lg p-2 ${TEMPLATE_INFO[selectedTemplateDetails.templateType].color}`}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={TEMPLATE_INFO[selectedTemplateDetails.templateType].icon}
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedTemplateDetails.name}</p>
                  <p className="text-sm text-gray-600">{selectedTemplateDetails.accountCount} accounts</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">{selectedTemplateDetails.description}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBackToSelection}
                disabled={isApplying}
                data-testid="apply-template-back-button"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleApplyTemplate}
                disabled={isApplying}
                data-testid="apply-template-confirm-button"
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isApplying ? (
                  <span className="flex items-center justify-center">
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                      <path
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Applying...
                  </span>
                ) : (
                  "Apply Template"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Template Card Component
// =============================================================================

function TemplateCard({
  template,
  onSelect
}: {
  readonly template: AccountTemplateItem
  readonly onSelect: () => void
}) {
  const info = TEMPLATE_INFO[template.templateType]

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`template-card-${template.templateType}`}
      className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="flex items-start gap-4">
        <div className={`rounded-lg p-3 ${info.color}`}>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={info.icon} />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">{template.name}</h3>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600" data-testid={`template-count-${template.templateType}`}>
              {template.accountCount} accounts
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{template.description}</p>
        </div>
      </div>
    </button>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTemplateType(type: TemplateType): string {
  const names: Record<TemplateType, string> = {
    GeneralBusiness: "General Business",
    Manufacturing: "Manufacturing",
    ServiceBusiness: "Service Business",
    HoldingCompany: "Holding Company"
  }
  return names[type]
}
